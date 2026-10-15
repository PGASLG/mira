# Mira Fund Engine: hand-over (2026-10-15)

Status: built and tested locally. Migrations applied to Supabase project `uocileatihtjfpgxyjrd`. Nothing pushed, no GitHub
repo, no secrets set, not deployed to Vercel.

## What is where
- `D:\Claude-Access\mira-engine` : `docs/DESIGN.md` (read this first), `sql/`, `engine/daily_job.py`, `vendor/model`
  (copied read-only from risk-system, hashes below), `data/baseline`, `tests/`, `.github/workflows/daily-nav.yml`.
- `D:\Claude-Access\mira-next\my-clerk-next-app` : `app/api/fund/{status,deposit,withdraw,switch}/route.ts`,
  `app/lib/fundApi.ts` (logic), `fundDb.ts` (service role access), `fundRoute.ts` (Clerk wrapper), `public/fund.js`.
- Vendored file hashes (sha256): assets.py `86e9b525...`, allocator_backtest.py `7e0bbf65...`, mira_invest.py `d090dc22...`.

## Tests (all pass)
```bash
cd D:\Claude-Access\mira-engine
python -m unittest discover -s tests -v      # NAV maths + sinks
node --test tests/fund-api.test.mjs          # API logic (Node 22+)
```
`tests/fairness.sql` is a DO block that raises `FAIRNESS_OK` and rolls back; paste it into the Supabase SQL editor to
re-run. Local job: `python engine/daily_job.py --sink file --pool-prefix test_` (test pools only).

## Steps only the user can do
1. **GitHub repo**: create a private repo from the contents of `D:\Claude-Access\mira-engine` (`data/work` and
   `data/local_fund.json` are git-ignored). Commit `vendor/` and `data/baseline/` (needed in the cloud).
2. **GitHub secrets** (repo Settings > Secrets and variables > Actions):
   - `SUPABASE_URL` = `https://uocileatihtjfpgxyjrd.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase dashboard > Project Settings > API > `service_role` key
3. **Vercel env vars** (Project Settings > Environment Variables, Production + Preview, mark as Sensitive):
   `SUPABASE_SERVICE_ROLE_KEY` (same key). Optional `SUPABASE_URL`; otherwise `NEXT_PUBLIC_SUPABASE_URL` is used.
   Add the same to `.env.local` for local runs. Never expose it with a `NEXT_PUBLIC_` prefix. Then redeploy.
4. **First run**: Actions tab > daily-nav > Run workflow. Expect lines `safe ... opened`, `growth ... opened` (pools
   start at NAV 10). Check the `fund_pools` table. Then the cron runs Mon-Fri 22:30 UTC.
5. **Rotate** the service role key if it was ever pasted into a chat or file.

## What the Port / Investment session must change (not done here: they own those pages)
- Load `/fund.js` and use `MiraFund.getStatus()` for pool NAV, `me.*.value` / `pnl`, and 90-day `history` (replace the
  client-side index growth). Keep the "simulation" wording.
- Top-up: after the cash top-up succeeds, call `MiraFund.deposit(amount, mira_split)` and treat the response as the truth
  for invested value. Send a fresh `ref` per user action; reuse it on retry.
- Withdraw: `MiraFund.withdraw(amount | {all:true})`, then add the paid amount back to `mira_topup` only on success.
- Change of `mira_split`: call `MiraFund.switchPool(from, to, amount)` to move the difference; otherwise the stored pool
  mix and the slider disagree.
- `mira_ledger` / `mira_topup` stay client side; money in the fund must be subtracted from cash at deposit time so it is
  not counted twice (cash + fund value).
- Lender: lent money is locked on the client; pass only unlent amounts to `withdraw` (server cannot see locks yet).
- Dashboard / track screens: `weights` per pool in `status` can replace the static holdings split.

## Known limits
- Cash is client state, so a user can edit cash in localStorage and "deposit" more than they own. Fine for a paper demo,
  not for anything real; fix with the server wallet in lender-real-matching-design.md.
- Pool NAV is shared by all users: with one real user the "pooling" is cosmetic.
- Strategy edge unproven (see DESIGN.md section 6). The engine uses the gate variant, not the chain that failed its
  holdout rule.
- GitHub Actions has not run; Yahoo may rate limit cloud IPs.
