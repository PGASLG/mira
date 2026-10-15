"""Risk Radar Allocator: multi-asset (NO stocks) point-in-time paper test. NO real money, NOT investment advice.

Goal tested: growth with protection from crises, using only non-stock assets: gold, silver, commodity and agriculture
funds, Treasuries, TIPS, corporate and emerging bonds, currencies, real-estate fund, cash.

Declared BEFORE running (nothing here is fitted to results):
  Strategies  S0 equal weight | S1 risk parity (1/24m vol) | S2 S1 + trend filter (12m return > 0, else cash)
              S3 S2 + Risk Radar-style stress overlay (downside probability from the volatility-scaled pool vs its own
                 36-month median; risky weights x clip(1/ratio, 50%, 100%))
  Windows     DESIGN 2008-01..2016-12 chooses, HOLDOUT 2017-01..now judges
  Success     CAGR >= cash CAGR + 2%  AND  max drawdown no worse than -20%  AND  Sharpe >= S0's Sharpe
  Selection   among S1..S3 passing on the design window, highest Calmar; none passes -> FAILURE
  Realism     monthly decisions from data known at month end, money works the NEXT month (lag 1); lag 2 and 30 bps as stress
  Controls    leak test (signals recomputed from truncated data), paired bootstrap of the edge vs S0

Run:  python -E allocator_backtest.py
"""
import datetime as dt
import json
import os

import numpy as np

import throttle_backtest as T0

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data_multi')
ASSETS = ['GLD', 'SLV', 'DBC', 'DBA', 'TLT', 'IEF', 'SHY', 'TIP', 'LQD', 'HYG', 'EMB', 'UUP', 'FXE', 'FXY', 'VNQ']
LAST = '2026-09'
VOLW, TRENDW, MEDW = 24, 12, 36
THR = 0.03
COST = 10
DESIGN = ('2008-01', '2016-12')
HOLD = ('2017-01', '2099-12')
S0, S1, S2, S3 = 'S0 equal weight', 'S1 risk parity', 'S2 risk parity + trend', 'S3 S2 + Risk Radar stress overlay'
CRISES = [('Global financial crisis', '2008-09', '2009-03'), ('Euro crisis', '2011-07', '2011-09'),
          ('Taper tantrum', '2013-04', '2013-06'), ('China/oil 2015-16', '2015-07', '2016-01'),
          ('Q4 2018', '2018-09', '2018-12'), ('Covid', '2020-01', '2020-03'), ('2022 inflation/bond crash', '2021-12', '2022-10')]


# ------------------------------------------------------------------ data
def load_series(name):
    d = json.load(open(os.path.join(DATA, f'raw_{name}.json'), encoding='utf-8'))['chart']['result'][0]
    ind = d['indicators']
    px = (ind.get('adjclose') or [{}])[0].get('adjclose') or ind['quote'][0]['close']
    out = {}
    for t, p in zip(d['timestamp'], px):
        if p is None:
            continue
        m = dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime('%Y-%m')
        if m <= LAST:
            out[m] = float(p)
    return out


def build():
    ser = {a: load_series(a) for a in ASSETS}
    spy, irx = load_series('SPY'), load_series('_IRX')
    months = [m for m in sorted(set().union(*[set(s) for s in ser.values()])) if m >= '2002-08']
    P = np.array([[ser[a].get(m, np.nan) for a in ASSETS] for m in months])
    R = np.full(P.shape, np.nan)
    R[1:] = P[1:] / P[:-1] - 1.0
    spy_r = np.array([np.nan] + [spy[months[i]] / spy[months[i - 1]] - 1 if months[i] in spy and months[i - 1] in spy else np.nan
                                 for i in range(1, len(months))])
    cash = np.array([np.nan] + [irx.get(months[i - 1], np.nan) / 1200.0 for i in range(1, len(months))])   # yield known a month earlier
    return months, R, spy_r, cash


# ------------------------------------------------------------------ signals (point-in-time)
def signals(R):
    T, K = R.shape
    vol = np.full((T, K), np.nan)
    trend = np.full((T, K), np.nan)
    for t in range(VOLW - 1, T):
        w = R[t - VOLW + 1:t + 1]
        ok = ~np.isnan(w).any(0)
        vol[t, ok] = w[:, ok].std(0, ddof=1)
    for t in range(TRENDW - 1, T):
        w = R[t - TRENDW + 1:t + 1]
        ok = ~np.isnan(w).any(0)
        trend[t, ok] = np.prod(1 + w[:, ok], 0) - 1
    z = np.full((T, K), np.nan)
    z[:-1] = R[1:] / vol[:-1]
    S = np.full(T, np.nan)
    for t in range(VOLW, T):
        pool = z[:t].ravel()
        pool = np.sort(pool[~np.isnan(pool)])
        v = vol[t]
        ok = ~np.isnan(v)
        if len(pool) < 200 or ok.sum() < 4:
            continue
        S[t] = float(np.mean(np.searchsorted(pool, -THR / v[ok], side='right') / len(pool)))
    ratio = np.full(T, np.nan)
    for t in range(T):
        h = S[max(0, t - MEDW + 1):t + 1]
        h = h[~np.isnan(h)]
        if len(h) >= 24 and not np.isnan(S[t]):
            ratio[t] = S[t] / np.median(h)
    return vol, trend, ratio


def make_weights(vol, trend, ratio):
    avail = ~np.isnan(vol)
    w0 = np.where(avail, 1.0, 0.0)
    w0 = w0 / np.maximum(w0.sum(1, keepdims=True), 1)
    iv = np.where(avail, 1.0 / np.where(avail, vol, 1.0), 0.0)
    w1 = iv / np.maximum(iv.sum(1, keepdims=True), 1e-12)
    w2 = np.where(~np.isnan(trend) & (trend > 0), w1, 0.0)
    scale = np.where(np.isnan(ratio), 1.0, np.clip(1.0 / ratio, 0.5, 1.0))   # no overlay until 24 stress observations exist
    w3 = w2 * scale[:, None]
    for w in (w0, w1, w2, w3):
        w[avail.sum(1) < 4] = np.nan
    return {S0: w0, S1: w1, S2: w2, S3: w3}


# ------------------------------------------------------------------ simulation
def simulate(w, R, cash, months, lag, cost_bps, start='2008-01'):
    T = w.shape[0]
    net = np.full(T, np.nan)
    risky = np.full(T, np.nan)
    prev = np.zeros(w.shape[1])
    for t in range(T - 1 - lag):
        if months[t] < start or np.isnan(w[t]).any() or np.isnan(cash[t + 1 + lag]):
            continue
        r = np.nan_to_num(R[t + 1 + lag], nan=0.0)
        s = float(w[t].sum())
        net[t] = float(w[t] @ r + (1 - s) * cash[t + 1 + lag] - np.abs(w[t] - prev).sum() * cost_bps / 1e4)
        risky[t] = s
        prev = w[t]
    return net, risky


def paired_ci(a, b, n=2000, seed=0, block=6):
    x = np.asarray(a) - np.asarray(b)
    x = x[~np.isnan(x)]
    rng = np.random.default_rng(seed)
    nb = int(np.ceil(len(x) / block))
    m = [np.concatenate([x[s:s + block] for s in rng.integers(0, len(x) - block + 1, nb)])[:len(x)].mean() for _ in range(n)]
    lo, hi = np.percentile(m, [2.5, 97.5])
    return x.mean() * 12, lo * 12, hi * 12


def passes(m, cash_cagr, s0):
    return (m['cagr'] >= cash_cagr + 0.02, m['dd'] >= -0.20, m['sharpe'] >= s0['sharpe'])


def main():
    months, R, spy_r, cash = build()
    T, K = R.shape
    vol, trend, ratio = signals(R)
    books = make_weights(vol, trend, ratio)
    out = ['RISK RADAR ALLOCATOR - multi-asset, NO stocks, point-in-time paper test (research only, not advice)', '=' * 100,
           f'assets ({K}): {", ".join(ASSETS)}; cash = 3-month T-bill. Data: Yahoo Finance monthly adjusted prices through {LAST}.',
           'decisions at month end with data known then; money works the NEXT month. Costs 10 bps per unit of turnover.',
           f'DESIGN {DESIGN[0]}..{DESIGN[1]}; HOLDOUT {HOLD[0]}..now. Success: CAGR >= cash+2%, max DD >= -20%, Sharpe >= S0.', '']

    rng = np.random.default_rng(3)
    cand = [t for t in range(60, T - 2) if not np.isnan(books[S3][t]).any()]
    probe = sorted(rng.choice(cand, size=15, replace=False))
    bad = 0
    for t in probe:
        v2, t2, r2 = signals(R[:t + 1])
        if not np.allclose(make_weights(v2, t2, r2)[S3][t], books[S3][t], equal_nan=True, atol=1e-12):
            bad += 1
    out += ['TRUST CHECK 1 - LEAK TEST (weights at month t recomputed from data cut at t)', '-' * 100,
            f'15 random months: {15 - bad}/15 identical.  ' + ('PASS' if bad == 0 else 'FAIL'), '']

    nets, expo = {}, {}
    for k, w in books.items():
        nets[k], expo[k] = simulate(w, R, cash, months, 1, COST)
    nets['Cash only'], expo['Cash only'] = simulate(np.zeros((T, K)), R, cash, months, 1, 0)
    SPYK = 'SPY stocks (reference, not allocated)'
    nets[SPYK], expo[SPYK] = simulate(np.ones((T, 1)), np.nan_to_num(spy_r, nan=0.0)[:, None], cash, months, 1, 0)
    names = list(nets)

    def mm(k, lo, hi):
        x = T0.sel(nets[k], months, lo, hi)
        m = T0.metrics(x, T0.sel(expo[k], months, lo, hi))
        ex = x - T0.sel(cash, months, lo, hi)                              # Sharpe is measured OVER cash
        ex = ex[~np.isnan(ex)]
        sd = ex.std(ddof=1) if len(ex) > 2 else 0.0
        m['sharpe'] = float(ex.mean() * 12 / (sd * 12 ** 0.5)) if sd > 1e-9 else float('nan')
        return m

    wins = (('DESIGN 2008-2016', *DESIGN), ('HOLDOUT 2017-now', *HOLD), ('ALL 2008-now', '2008-01', '2099-12'))
    out += ['RESULTS IN PERCENT (lag 1, net of 10 bps)', '-' * 100,
            f'{"":42s}{"CAGR":>7s} {"vol":>6s} {"Sharpe":>7s} {"max DD":>8s} {"worst 12m":>10s} {"risky %":>8s}  success a/b/c']
    verdicts = {}
    for label, lo, hi in wins:
        out.append(f'  {label}')
        cc, s0 = mm('Cash only', lo, hi)['cagr'], mm(S0, lo, hi)
        for k in names:
            m = mm(k, lo, hi)
            flag = ''
            if k[:1] == 'S' and k[1].isdigit():
                p = passes(m, cc, s0)
                flag = ('PASS' if all(p) else 'fail') + ' ' + '/'.join('y' if x else 'n' for x in p)
                verdicts[(label, k)] = (all(p), m)
            out.append(f'     {k:39s}{m["cagr"]:+7.1%} {m["vol"]:6.1%} {m["sharpe"]:+7.2f} {m["dd"]:8.1%} {m["worst_12"]:+10.1%} '
                       f'{m["avg_exp"]:8.0%}  {flag}')
    out.append('')

    cands = [(v[1]['calmar'], k) for (lab, k), v in verdicts.items() if lab.startswith('DESIGN') and v[0] and k[:2] in ('S1', 'S2', 'S3')]
    chosen = max(cands)[1] if cands else None
    out += ['SELECTION (design window only)', '-' * 100,
            f'  chosen: {chosen} (highest Calmar among strategies that passed on 2008-2016)' if chosen else
            '  No strategy passed all three success tests on the design window -> FAILURE for selection. The tables still show',
            '  every strategy on the holdout, as information only.', '']
    if chosen:
        ok, _ = verdicts[('HOLDOUT 2017-now', chosen)]
        out += [f'HOLDOUT VERDICT for {chosen}: {"PASS" if ok else "FAIL"}', '-' * 100, '']
    focus = chosen or S3

    out += ['RESULTS IN TIME (1 month = 30.44 days)', '-' * 100]
    for label, lo, hi in wins[1:]:
        out.append(f'  {label}')
        for k in names:
            m = mm(k, lo, hi)
            out += [f'   {k}',
                    f'      100 grows to {m["final"]:.0f} (CAGR {m["cagr"]:+.1%}); time to double '
                    f'{T0.dur(m["double"]) if m["double"] else "not at this rate"}',
                    f'      longest time below a prior peak: {T0.dur(m["longest_uw"])}' + ('  (STILL underwater)' if m['still_uw'] else '')
                    + f'; worst fall took {T0.dur(m["to_trough"])}, recovery '
                    + (T0.dur(m['recover']) if m['recover'] is not None else 'not yet'),
                    f'      defensive (<=50% in risky assets): {m["defensive"]} months = {T0.dur(m["defensive"])}'
                    + (f'; exposure changes of 5+ pts about every {m["days_between"]:.0f} days' if m.get('days_between') else '')]
    out.append('')

    out += ['CRISIS REPLAY (cumulative return over the window, lag 1)', '-' * 100]
    for label, lo, hi in CRISES:
        row = []
        for k in (S0, S1, S2, S3, SPYK):
            x = T0.sel(nets[k], months, lo, hi)
            x = x[~np.isnan(x)]
            row.append(f'{(np.prod(1 + x) - 1) if len(x) else float("nan"):+7.1%}')
        out.append(f'  {label:26s} {lo}..{hi}: S0 {row[0]} | S1 {row[1]} | S2 {row[2]} | S3 {row[3]} | stocks(ref) {row[4]}')
    out.append('')

    out += ['HARDER ASSUMPTIONS (HOLDOUT): CAGR / Sharpe / max DD', '-' * 100]
    for lag, cost in ((1, 10), (2, 10), (1, 30)):
        parts = []
        for k, w in books.items():
            x, e = simulate(w, R, cash, months, lag, cost)
            xs = T0.sel(x, months, *HOLD)
            m = T0.metrics(xs, T0.sel(e, months, *HOLD))
            ex = xs - T0.sel(cash, months, *HOLD)
            ex = ex[~np.isnan(ex)]
            sh = ex.mean() * 12 / (ex.std(ddof=1) * 12 ** 0.5)
            parts.append(f'{k[:2]} {m["cagr"]:+.1%}/{sh:+.2f}/{m["dd"]:.0%}')
        out.append(f'  lag {lag}, {cost} bps: ' + ' | '.join(parts))
    out.append('')

    out += ['LUCK TEST: edge over S0 (paired block bootstrap, annualised mean monthly return, HOLDOUT)', '-' * 100]
    for k in (S1, S2, S3):
        mean, lo, hi = paired_ci(T0.sel(nets[k], months, *HOLD), T0.sel(nets[S0], months, *HOLD))
        out.append(f'  {k:38s} minus S0: {mean:+.1%} per year, 95% interval [{lo:+.1%}, {hi:+.1%}]'
                   + ('' if lo > 0 or hi < 0 else '   <- includes zero: not distinguishable from luck'))
    out.append('')

    last = T - 1
    w = books[S3][last]
    out += [f'LATEST MODEL STATE at {months[last]} (S3; research output, NOT advice)', '-' * 100]
    if not np.isnan(w).any():
        for a, x in sorted(zip(ASSETS, w), key=lambda p: -p[1]):
            if x > 0.001:
                out.append(f'  {a:5s} {x:6.1%}')
        out.append(f'  cash  {1 - w.sum():6.1%}   stress ratio {ratio[last]:.2f} (1.0 = typical)')
    out += ['', 'HONEST NOTE', '-' * 100,
            '  Four strategies and one window split: some luck is possible. History is short (2008+, ETF prices) and includes',
            '  one extraordinary decade of falling rates. Monthly bars hide intra-month crashes. Not tradable advice.']

    text = '\n'.join(out)
    print(text)
    with open(os.path.join(HERE, 'allocator_report.txt'), 'w', encoding='utf-8') as f:
        f.write(text + '\n')

    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        ii = [i for i in range(T) if months[i] >= '2008-01' and not np.isnan(nets[S0][i])]
        fig, ax = plt.subplots(figsize=(11, 5.5))
        for k in names:
            ax.plot(range(len(ii)), 100 * np.cumprod(1 + np.nan_to_num(nets[k][ii])), label=k,
                    lw=2.4 if k == focus else 1.2, ls='--' if k == SPYK else '-')
        cut = [j for j, i in enumerate(ii) if months[i] >= HOLD[0]][0]
        ax.axvline(cut, color='k', ls=':', lw=1)
        ax.set_yscale('log')
        ticks = list(range(0, len(ii), 24))
        ax.set_xticks(ticks)
        ax.set_xticklabels([months[ii[i]][:4] for i in ticks])
        ax.set_title('Multi-asset allocator (no stocks), growth of 100 (log), lag 1, net of 10 bps. Dotted = holdout starts.')
        ax.legend(fontsize=7)
        ax.grid(alpha=.3)
        fig.tight_layout()
        fig.savefig(os.path.join(HERE, 'allocator_equity.png'), dpi=130)
    except Exception as ex:
        print(f'(chart skipped: {ex})')


if __name__ == '__main__':
    main()
