# Mira Fund Engine: design (PAPER / simulated money only)

Research only. Not investment advice. No real money is handled anywhere in this system. Every number a user sees is a
simulation and must be labelled as one (the API returns `simulation: true`).

## 1. What it does

Two pooled paper portfolios, **Safe** (base dial 20% stocks) and **Growth** (base dial 60%). A cloud job runs the
statistical regime model every market day, sets each pool's target weights, advances each pool's NAV by that day's
asset returns, and writes it to Supabase. Users hold **units**; their value is `units x NAV`. Everybody's value therefore
follows what they put in and when they put it in. A user's `mira_split` (% in Growth) decides how a deposit is divided.

```
GitHub Actions cron (22:30 UTC, Mon-Fri)           Vercel (Next.js, Clerk)
  engine/daily_job.py                                 /api/fund/{status,deposit,withdraw,switch}
   1 refresh Yahoo data (no AI)                         auth() -> Clerk user id
   2 vendored model -> stress, gate, core weights       service role key (server env only)
   3 per pool: advance NAV, rebalance if due            calls Postgres functions (atomic)
   4 rpc fund_apply_nav  ----------------> Supabase <---- rpc fund_deposit / withdraw / switch
                                          fund_pools, fund_nav_history, user_units, fund_events
```

## 2. Fair pro-rata accounting

Per pool: `nav` (THB per unit, starts at 10.0) and `units_total`.

| Action | Rule |
|---|---|
| Deposit `a` | `units = round(a / nav, 8)`; user units and pool `units_total` increase; cost basis += a |
| Withdraw `a` | `units = round(a / nav, 8)` redeemed at the current NAV; cost basis leaves pro rata (`cost x units/held`) |
| Value | `units x nav` (round to satang only for display) |
| Daily update | `nav' = nav x (1 + sum(w_i x r_i))`; weights drift; rebalance cost deducted when the pool trades |
| Switch pools | redeem at pool A's NAV, mint at pool B's NAV, one transaction, cost basis moves with the money |

Why it is fair: units never change on a market day, only NAV does. Late joiners buy at today's NAV, so they get no past
gains and dilute nobody. Invariant (tested): `sum(user units) x nav = pool value`, nothing created or lost.

**Return path.** There is no separate "interest" step. Return is the pool's portfolio return: weights x each asset's daily
adjusted-close return (dividends included), cash earns the 3-month T-bill yield (^IRX / 252), minus a 10 bps
one-sided-turnover cost on each rebalance (the same cost the model's backtests assume). That return lifts NAV, and every
holder shares it by units.

**Rebalance trigger.** First run, a new calendar month (the backtested cadence), or a change of stress level. The
stress-change trigger is NOT in the backtest; it only adds trades.

**Edge cases**
- Rounding: units to 8 dp, money to 2 dp. A full exit (or a request within 1 satang of the whole holding) redeems every
  unit, so no dust remains. Requests above the holding exit fully, never go negative.
- Zero units / empty pool: first deposit mints at the pool's current NAV. `units_total` of 0 is fine: NAV keeps moving,
  there is just nobody to share it.
- Same-day deposits: all mint at the pool's last published NAV (previous close). There is no intraday price, so a
  deposit made before the daily job runs buys at yesterday's NAV and shares today's return. This is the usual
  forward-pricing trade-off for a daily-NAV fund; tell users "price = last close", or add a cut-off (Open points).
- Retries: every deposit/withdraw/switch takes a client `ref`; the same ref returns the first result and mints nothing
  (unique index on `(user_id, ref)`).
- Concurrency: each function locks the pool row `FOR UPDATE`; the daily NAV write takes the same lock, so a deposit
  can never straddle a NAV update. NAV writes for an older or equal `as_of` are ignored.
- Withdrawals and the Lender screen: the Lender locks lent money. Lent money lives in the client (`mira_*` keys), which the
  server cannot see yet, so the API cannot refuse a withdrawal of locked money. Until wallets exist server side, the
  client must pass only unlent amounts. When the Lender moves to server state (see lender-real-matching-design.md),
  add a `locked` check inside `fund_withdraw`.

## 3. Schema (migrations applied to project uocileatihtjfpgxyjrd)

`sql/001_fund_tables.sql`, `sql/002_fund_functions.sql`. Additive, RLS on.

- `fund_pools(pool pk, nav, units_total, as_of, weights jsonb, updated_at)`
- `fund_nav_history(pool, as_of, nav, weights jsonb, regime jsonb)` pk (pool, as_of)
- `user_units(user_id text, pool, units, cost, updated_at)` pk (user_id, pool)
- `fund_events(id, user_id, pool, type deposit|withdraw|rebalance, amount, units, nav, ref, created_at)`;
  `rebalance` with `user_id` null = a pool rebalance by the job; with a user id = the user moved money between pools
  (units signed).

RLS: users `SELECT` only their own `user_units` and `fund_events` (`user_id = auth.jwt()->>'sub'`, same Clerk pattern as
`user_settings`); pools and NAV history are readable by any authenticated user. No insert/update/delete policy exists, and
table privileges are revoked, so writes happen only through the service role. The four functions are executable by
`service_role` only (verified: anon and authenticated have no execute and no insert).

## 4. Daily job (`engine/daily_job.py`)

Loads the committed baseline data, overlays fresh Yahoo data (monthly bars for the 15 core ETFs + SPY + ^IRX, daily
S&P 500), builds the model with the vendored code, computes `stock share = M.share('gate', base, signals)` and the core
weights, then applies the steps in section 1. It refuses to write if the newest SPY close is more than 6 days old.
It catches up several missed days in one run, one NAV row per market day.

Run it: `python engine/daily_job.py --sink file --pool-prefix test_` (local JSON, no secrets) or `--sink supabase`
(needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in the environment; never in files).

**Headless scope.** Vendored verbatim from risk-system: `assets.py`, `allocator_backtest.py`, `mira_invest.py`, plus a stub
`throttle_backtest.py` (only `sel/metrics/dur`; the original imports the AI layer). Run: statistical regime model only
(volatility ratio, drawdown, 200-day trend, risk-budget size, stress gate, risk-parity/trend core). The local Gemma AI
news layer and the FX range state (`mira_fx.py`) are not run: FX ranges are display only and never move a pool.

## 5. Web integration contract (all JSON, Clerk session cookie, `Cache-Control: no-store`)

Load `<script src="/fund.js">`; it exposes `window.MiraFund`. Every call throws `Error(code)` on failure.

`GET /api/fund/status` / `MiraFund.getStatus()`
```json
{ "simulation": true, "note": "Paper money only. ...",
  "pools": { "safe": {"nav": 10.0381, "as_of": "2026-10-14", "units_total": 120.5, "weights": {"SPY": 0.2, "SHY": 0.23, "CASH": 0.3},
                      "day_change_pct": 0.12 }, "growth": { } },
  "me": { "safe": {"units": 70.0, "value": 702.69, "cost": 700, "pnl": 2.69},
          "growth": {"units": 15.0, "value": 301.6, "cost": 300, "pnl": 1.6},
          "total": {"value": 1004.29, "cost": 1000, "pnl": 4.29} },
  "history": { "safe": [{"as_of": "2026-10-13", "nav": 10.0262}], "growth": [] } }
```
`POST /api/fund/deposit` body `{ "amount": 1000, "growth_pct": 30, "ref": "<uuid>" }` (or `"pool": "safe"` instead of
`growth_pct`) returns `{ "ok": true, "results": [ {"pool","amount","units","nav","user_units","value","replayed"} ] }`.

`POST /api/fund/withdraw` body `{ "amount": 400, "ref": "..." }`, `{ "all": true }`, optional `"pool"`; taken pro rata from
the pools held. Returns `{ "ok": true, "results": [ {"pool","amount","units","nav","user_units","replayed"} ] }`.

`POST /api/fund/switch` body `{ "from": "safe", "to": "growth", "amount": 200, "ref": "..." }` returns
`{ "ok": true, "result": {"from","to","amount","units_out","units_in","replayed"} }`. Use after `mira_split` changes.

Errors: `{ "error": code }` with 401 `unauthorized`, 400 `bad_amount | bad_pool | bad_ref | bad_growth_pct | same_pool |
exceeds_balance | nothing_to_withdraw`, 503 `fund_not_configured` (env var missing), 500 `server_error`.

Cash side: the app's cash (`mira_topup`) is still client state. The caller must subtract a deposit from cash and add a
withdrawal back, and only after the API call succeeds. Tracked in HANDOVER.md.

## 6. What is proven and what is not

Proven (tests in this repo):
- Unit accounting: pro-rata fairness, late joiner, rebalance day, partial and full withdrawal, replay safety, stale NAV
  ignored, sum of user values = pool value (`tests/fairness.sql`, run on the live project, rolled back, left no rows).
- API logic: split, pro-rata withdraw, validation, isolation between users (`tests/fund-api.test.mjs`), NAV maths and
  sinks (`tests/test_engine.py`). Unauthenticated call returns 401 on the local dev server.
- Job: ran end to end locally against live Yahoo data into test pools (`test_safe`, `test_growth`), including a multi-day
  catch-up and a month-change rebalance.

Not proven:
- The strategy's edge. The model's published backtest (REPORT_mira_invest.md) found the "chain" variant FAILED its
  declared holdout success rule at both bases (falls shallower, growth lost). The engine uses the "gate" variant, which is
  the one in the frozen forward test (FORWARD_TEST_RULE.md): one decision logged so far, first verdict needs 12 scored
  months. Live performance is therefore unknown. The 20% base dial for Safe is not one of the forward-test bases (30, 60).
- The stress-change rebalance trigger and the daily NAV path are new and not backtested.
- The AI news layer is unproven and not used here.
- The job has not run in GitHub Actions or against the live Supabase tables (no service role key available in this
  session); the SQL functions were exercised on the live project, the REST sink only against a stub.
- Yahoo free data from cloud IPs may be rate limited; the job then fails loudly instead of writing stale NAV.

Model-session cautions (confirmed 2026-10-15): the 10 bps cost is an estimate, not a retail cost; this NAV is a separate,
simulated series and is NOT the pre-registered forward test (that scores gate vs fixed at bases 30/60, hash
bb6bfa8d9d2a051c, and must not be edited); stress is a volatility gauge, not a crash forecast. Backtest, all years:
all-stocks grew faster (+8.8% vs +5.9% a year) while the chain cut the worst fall from -50.8% to -7.7%; about 7 in 10
alarms were false.

## 7. Open points for the user
- Deposit cut-off: forward pricing at last close (as built) vs. "deposits after 22:30 UTC price at the next NAV".
- Whether Safe should use a 30% base dial to match the forward-tested bases.
- Wallet / cash ledger on the server (Lender design) so cash and units can move in one transaction.
