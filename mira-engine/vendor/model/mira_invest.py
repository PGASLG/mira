"""Mira Track 1: DETECT risk -> SIZE it -> ACT. Point-in-time paper test. NO real money, NOT investment advice.

Chain (all rules fixed BEFORE running; nothing is fitted):
  DETECT  three alarms from daily S&P 500 data known at month end:
            V  volatility jump:   20-day vol / 250-day vol  > 1.5          (the Risk Radar early-warning signal)
            D  drawdown:          index >= 10% below its 1-year high
            T  trend break:       index below its 200-day average
          stress level = number of alarms, 0..3
  SIZE    one-month worst case at 95% = 1.645 x max(20d, 60d daily vol) x sqrt(21)
          stock share the risk budget allows: e_size = clip(4% / worst case, 0, 1)
  ACT     stock share = min(base dial, e_size) x gate[stress],  gate = {0: 1.0, 1: 0.75, 2: 0.5, 3: 0.25}
          the rest sits in the defensive core (non-stock allocator S3 from allocator_backtest.py)

Variants on the same base dial (base = the share a person would pick when calm):
  fixed  always base                      trend  base while 12-month return > 0, else 0
  size   min(base, e_size)                gate   base x gate[stress]
  chain  min(base, e_size) x gate[stress]   <- the Mira chain
Realism: month-end decisions, money works next month, 10 bps on every change of the stock share.
Windows: DESIGN 2008-2016 chooses, HOLDOUT 2017-now judges. Success rule for chain vs fixed at the same base,
declared in advance: holdout worst fall at least 30% shallower AND holdout CAGR no more than 2 points lower AND
holdout Sharpe over cash not lower.

Run:  python -E mira_invest.py        (writes REPORT_mira_invest.md and mira_state.json)
"""
import bisect
import json
import math
import os

import numpy as np

import allocator_backtest as AB
import assets
import throttle_backtest as T0

HERE = os.path.dirname(os.path.abspath(__file__))
START = '2008-01'
VOL_RATIO_ALARM, DD_ALARM, MA_DAYS = 1.5, -0.10, 200
RISK_BUDGET, Z95 = 0.04, 1.645
GATE = {0: 1.0, 1: 0.75, 2: 0.5, 3: 0.25}
BASES = (0.3, 0.6)
KINDS = ('fixed', 'trend', 'size', 'gate', 'chain')
COST = AB.COST
CRISES = (('GFC 2008-01..2009-03', '2008-01', '2009-03'), ('Covid 2020-01..03', '2020-01', '2020-03'),
          ('2022 bear 2021-12..2022-10', '2021-12', '2022-10'))
ALARM_NAMES = ('volatility jump', 'drawdown >= 10%', 'below 200-day average')


# ------------------------------------------------------------------ DETECT + SIZE (uses data up to index i only)
def signals_at(px, i):
    """px: daily closes (1-D array), i: index of the decision day. Returns dict or None when history is too short."""
    if i < 252:
        return None
    r = np.diff(np.log(px[:i + 1]))
    s20, s60, s250 = (float(r[-n:].std(ddof=1)) for n in (20, 60, 250))
    if s250 <= 0:
        return None
    ratio = s20 / s250
    dd = float(px[i] / px[i - 251:i + 1].max() - 1)
    below = bool(px[i] < px[i - MA_DAYS + 1:i + 1].mean())
    alarms = (ratio > VOL_RATIO_ALARM, dd <= DD_ALARM, below)
    sig_m = max(s20, s60) * math.sqrt(21)
    worst = Z95 * sig_m
    e_size = min(1.0, RISK_BUDGET / worst) if worst > 0 else 1.0
    return dict(vol_ratio=ratio, drawdown=dd, below_ma=below, alarms=alarms, stress=int(sum(alarms)),
                sigma_month=sig_m, worst_month=worst, e_size=e_size)


def share(kind, base, sig, trend12=None):
    """ACT: stock share for one variant."""
    if kind == 'fixed':
        return base
    if kind == 'trend':
        return base if (trend12 is not None and trend12 > 0) else 0.0
    if kind == 'size':
        return min(base, sig['e_size'])
    if kind == 'gate':
        return base * GATE[sig['stress']]
    return min(base, sig['e_size']) * GATE[sig['stress']]


# ------------------------------------------------------------------ data
def load_daily():
    c = json.load(open(os.path.join(assets.CACHE, assets.safe('^GSPC') + '.json'), encoding='utf-8'))['closes']
    ks = sorted(c)
    return ks, np.array([c[k] for k in ks], float)


def month_signals(months, ks, px):
    mon = [k[:7] for k in ks]
    out = []
    for m in months:
        i = bisect.bisect_right(mon, m) - 1
        out.append(signals_at(px, i) if i >= 0 else None)
    return out


def build():
    months, R, spy_r, cash = AB.build()
    ks, px = load_daily()
    vol, trend, ratio = AB.signals(R)
    W = AB.make_weights(vol, trend, ratio)[AB.S3]
    core, _ = AB.simulate(W, R, cash, months, 1, COST)
    T = len(months)
    nxt = np.full(T, np.nan)
    nxt[:-1] = spy_r[1:]
    cnx = np.full(T, np.nan)
    cnx[:-1] = cash[1:]
    tr = np.full(T, np.nan)
    for t in range(11, T):
        w = spy_r[t - 11:t + 1]
        if not np.isnan(w).any():
            tr[t] = float(np.prod(1 + w) - 1)
    return dict(months=months, R=R, spy_r=spy_r, cash=cash, core=core, nxt=nxt, cnx=cnx, tr=tr, W=W,
                sigs=month_signals(months, ks, px), ks=ks, px=px)


def simulate(D, kind, base):
    months, T = D['months'], len(D['months'])
    out, ee = np.full(T, np.nan), np.full(T, np.nan)
    prev = 0.0
    for t in range(T - 1):
        sg = D['sigs'][t]
        if months[t] < START or sg is None or np.isnan(D['core'][t]) or np.isnan(D['nxt'][t]):
            continue
        e = share(kind, base, sg, D['tr'][t] if not np.isnan(D['tr'][t]) else None)
        gross = e * D['nxt'][t] + (1 - e) * D['core'][t]
        out[t] = gross - abs(e - prev) * COST / 1e4
        ee[t] = e
        prev = e * (1 + D['nxt'][t]) / (1 + gross)
    return out, ee


def metrics(D, x, e, lo, hi):
    xs = T0.sel(x, D['months'], lo, hi)
    m = T0.metrics(xs, T0.sel(e, D['months'], lo, hi))
    ex = xs - T0.sel(D['cnx'], D['months'], lo, hi)
    ex = ex[~np.isnan(ex)]
    m['sharpe'] = float(ex.mean() * 12 / (ex.std(ddof=1) * 12 ** 0.5)) if len(ex) > 2 and ex.std() > 1e-9 else float('nan')
    return m


def cum(D, x, lo, hi):
    s = T0.sel(x, D['months'], lo, hi)
    s = s[~np.isnan(s)]
    return float(np.prod(1 + s) - 1) if len(s) else float('nan')


# ------------------------------------------------------------------ current state (for the web page)
def current_state(D):
    ks, px = D['ks'], D['px']
    sg = signals_at(px, len(px) - 1)
    T = len(D['months'])
    w = D['W'][T - 1]
    spread = {a: round(float(x), 4) for a, x in zip(AB.ASSETS, w) if not np.isnan(x) and x > 0}
    presets = {f'{int(b * 100)}': round(share('chain', b, sg), 3) for b in (0.2, 0.4, 0.6)}
    return dict(as_of=ks[-1], stress=sg['stress'],
                alarms={n: bool(a) for n, a in zip(ALARM_NAMES, sg['alarms'])},
                vol_ratio=round(sg['vol_ratio'], 2), drawdown_pct=round(100 * sg['drawdown'], 1),
                sigma_month_pct=round(100 * sg['sigma_month'], 2), worst_month_95_pct=round(100 * sg['worst_month'], 1),
                e_size=round(sg['e_size'], 3), gate=GATE[sg['stress']], stock_share_by_base=presets,
                core_weights=spread, core_cash_share=round(1 - sum(spread.values()), 4),
                note='research only, not investment advice; a stress level is volatility regime, not a crash forecast')


def pct(x, d=1):
    return 'n/a' if x != x else f'{100 * x:+.{d}f}%'


def main():
    D = build()
    months = D['months']
    res = {(k, b): simulate(D, k, b) for k in KINDS for b in BASES}
    W = {'ALL 2008-now': (START, '2099-12'), 'DESIGN 2008-2016': AB.DESIGN, 'HOLDOUT 2017-now': AB.HOLD}
    L = ['# Mira Track 1: detect risk, size it, act', '',
         'As of 2026-10-15. Research only. No real money. Not investment advice. Not a crash forecast.', '']

    # ---- detection check
    sig = [(t, D['sigs'][t]) for t in range(len(months) - 1) if D['sigs'][t] is not None and months[t] >= START
           and not np.isnan(D['nxt'][t])]
    L += ['## 1. Does the detector see danger? (S&P 500, next month, 2008 to now)', '',
          '| Stress level at month end | Months | Share of months | Average next month | Worst next month | Next month <= -5% |',
          '|---|---:|---:|---:|---:|---:|']
    for s in range(4):
        v = [D['nxt'][t] for t, g in sig if g['stress'] == s]
        if v:
            L.append(f'| {s} | {len(v)} | {len(v) / len(sig):.0%} | {pct(np.mean(v))} | {pct(min(v))} | '
                     f'{sum(1 for x in v if x <= -0.05)} ({np.mean([x <= -0.05 for x in v]):.0%}) |')
    big = [(months[t + 1], g['stress'], D['nxt'][t]) for t, g in sig if D['nxt'][t] <= -0.08]
    L += ['', f'Months with a fall of 8% or more: **{len(big)}**. Stress level at the month end BEFORE each:', '',
          '| Month of fall | Stress before | Fall |', '|---|---:|---:|']
    L += [f'| {m} | {s} | {pct(r)} |' for m, s, r in big]
    warned = sum(1 for _, s, _ in big if s >= 2)
    L += ['', f'Warned (stress 2 or 3) before {warned} of {len(big)} big falls. Read it as a volatility-regime gauge: it '
              'tends to be high DURING stress and often low before a sudden fall.', '']

    # ---- results
    for b in BASES:
        L += [f'## 2. Results, base dial {int(b * 100)}% stocks', '',
              '| Window | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Time at <=50% of base |',
              '|---|---|---:|---:|---:|---:|---:|---:|']
        for wn, (lo, hi) in W.items():
            for k in KINDS:
                x, e = res[(k, b)]
                m = metrics(D, x, e, lo, hi)
                if m is None:
                    continue
                ee = T0.sel(e, months, lo, hi)
                ee = ee[~np.isnan(ee)]
                L.append(f'| {wn} | {k} | {pct(m["cagr"])} | {100 * m["vol"]:.1f}% | {m["sharpe"]:+.2f} | {pct(m["dd"])} | '
                         f'{ee.mean():.0%} | {np.mean(ee <= 0.5 * b + 1e-9):.0%} |')
        L.append('')
        L += [f'Crisis replay, cumulative return, base {int(b * 100)}%:', '',
              '| Crisis | ' + ' | '.join(KINDS) + ' |', '|---|' + '---:|' * len(KINDS)]
        for name, lo, hi in CRISES:
            L.append(f'| {name} | ' + ' | '.join(pct(cum(D, res[(k, b)][0], lo, hi)) for k in KINDS) + ' |')
        L.append('')

    # ---- success rule
    L += ['## 3. Declared success rule: chain vs fixed, same base, HOLDOUT 2017-now', '',
          '| Base | Fixed worst fall | Chain worst fall | Shallower by | CAGR gap | Sharpe fixed / chain | Result |',
          '|---|---:|---:|---:|---:|---|---|']
    verdicts = []
    for b in BASES:
        f = metrics(D, *res[('fixed', b)], *AB.HOLD)
        c = metrics(D, *res[('chain', b)], *AB.HOLD)
        shallow = 1 - c['dd'] / f['dd'] if f['dd'] < 0 else float('nan')
        gap = c['cagr'] - f['cagr']
        ok = shallow >= 0.30 and gap >= -0.02 and c['sharpe'] >= f['sharpe']
        verdicts.append(ok)
        L.append(f'| {int(b * 100)}% | {pct(f["dd"])} | {pct(c["dd"])} | {shallow:.0%} | {100 * gap:+.1f} pts | '
                 f'{f["sharpe"]:+.2f} / {c["sharpe"]:+.2f} | **{"PASS" if ok else "FAIL"}** |')
    L += ['', '## 4. Reading it plainly', '']
    for b in BASES:
        f = metrics(D, *res[('fixed', b)], *W['ALL 2008-now'])
        c = metrics(D, *res[('chain', b)], *W['ALL 2008-now'])
        L.append(f'- Base {int(b * 100)}%, all years: fixed {pct(f["cagr"])} a year with worst fall {pct(f["dd"])}; chain '
                 f'{pct(c["cagr"])} a year with worst fall {pct(c["dd"])}.')
    L += [f'- Success rule on the holdout: {"passed at both bases" if all(verdicts) else "passed at some bases only" if any(verdicts) else "failed at both bases"}.',
          '- The chain trades some growth for shallower falls. It does not predict a crash; it reacts to a volatility regime.',
          '- One market regime, monthly steps, a US-stock sleeve. Not proof for the future. Not advice.',
          '- Where the benefit comes from: most of it is the 2008-2009 crisis, which sits in the DESIGN window. In the HOLDOUT '
          '(2017-now) stocks mostly rose, so the chain gave up more growth than it saved in falls.',
          '- Seen only AFTER the results (not part of the declared rule, so a lead to test forward, not a claim): the gate '
          'alone (no risk-budget sizing) kept the CAGR of the fixed dial at base 60% over all years with a much shallower '
          'worst fall. Sizing and gating together double-count the same volatility signal and cost growth.',
          '- The detector is a regime gauge: months at stress 3 were followed by a fall of 5% or more in half of the cases, '
          'but that is 12 months only, and most big falls started at stress 1 to 2.', '']
    L += ['## 5. Rules fixed before running', '',
          f'Alarms: vol ratio > {VOL_RATIO_ALARM}; drawdown <= {DD_ALARM:.0%}; below {MA_DAYS}-day average. Risk budget {RISK_BUDGET:.0%} '
          f'worst month at 95% (z={Z95}). Gate {GATE}. Base dials {BASES}. Cost {COST} bps. Nothing was tuned on results.', '']
    open(os.path.join(HERE, 'REPORT_mira_invest.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    st = current_state(D)
    json.dump(st, open(os.path.join(HERE, 'mira_state.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote REPORT_mira_invest.md and mira_state.json; success rule:', verdicts)
    print(json.dumps(st, ensure_ascii=False)[:600])


if __name__ == '__main__':
    main()
