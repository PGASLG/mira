"""Minimal stub of risk-system/throttle_backtest.py (lines 113-166 + constants copied verbatim).
The original imports accuracy/broker/ledger (AI layer); the engine only needs sel/metrics/dur."""
import math

import numpy as np

DPM = 30.44
BIG = 0.05


def dur(m):
    if m is None or m != m:
        return 'n/a'
    y, mo = divmod(int(round(m)), 12)
    return f'{y}y {mo}m (~{int(round(m * DPM)):,} days)'


def underwater(eq):
    peaks = np.maximum.accumulate(eq)
    uw = eq < peaks
    best = cur = 0
    for v in uw:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    i_tr = int(np.argmin(eq / peaks))                                    # trough of the worst drawdown
    start = int(np.argmax(eq[:i_tr + 1]))
    rec = None
    for j in range(i_tr, len(eq)):
        if eq[j] >= peaks[i_tr]:
            rec = j - i_tr
            break
    return best, bool(uw[-1]), i_tr - start, rec


def metrics(x, e=None):
    x = np.asarray(x, float)
    ok = ~np.isnan(x)
    x = x[ok]
    n = len(x)
    if n < 12:
        return None
    eq = np.cumprod(1 + x)
    cagr = eq[-1] ** (12.0 / n) - 1
    vol = x.std(ddof=1) * math.sqrt(12)
    dd = float((eq / np.maximum.accumulate(eq) - 1).min())
    longest, still, to_trough, rec = underwater(np.concatenate([[1.0], eq]))
    r12 = [np.prod(1 + x[i:i + 12]) - 1 for i in range(n - 11)]
    m = dict(n=n, cagr=cagr, vol=vol, sharpe=(x.mean() * 12) / vol if vol > 0 else float('nan'), dd=dd,
             worst_m=float(x.min()), worst_12=float(min(r12)), calmar=cagr / abs(dd) if dd < 0 else float('nan'),
             longest_uw=longest, still_uw=still, to_trough=to_trough, recover=rec,
             double=(math.log(2) / math.log(1 + cagr) * 12) if cagr > 0 else None, final=100 * eq[-1])
    if e is not None:
        ee = np.asarray(e, float)[ok]
        m['avg_exp'] = float(ee.mean())
        m['defensive'] = int((ee <= 0.5).sum())
        ch = np.abs(np.diff(np.concatenate([[1.0], ee]))) >= BIG
        m['trades_yr'] = float(ch.sum() / (n / 12.0))
        m['days_between'] = (n * DPM / ch.sum()) if ch.sum() else None
    return m


def sel(series, months, lo, hi):
    idx = [i for i, m in enumerate(months) if lo <= m <= hi]
    return np.asarray(series)[idx]
