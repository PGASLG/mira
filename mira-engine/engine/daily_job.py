"""Mira Fund Engine: daily job. PAPER (simulated) money only. Research only, not investment advice.

Each run:  refresh market data (Yahoo, no AI) -> run the statistical/regime model headless -> target weights per pool
           -> advance each pool's NAV by the market days since its last as_of -> rebalance when due -> write NAV.
Pools:     safe = model chain at base dial 20% stocks, growth = base dial 60% (the Low-risk / High-risk tracks in the app).
Sinks:     --sink file (local JSON, no secrets)  |  --sink supabase (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars).
Not here:  the local Gemma AI news layer (needs the user's own gateway). Only the vendored statistical code runs.

  python engine/daily_job.py --sink file --pool-prefix test_       # local test pools
  python engine/daily_job.py --sink supabase                       # what GitHub Actions runs
"""
import argparse
import datetime as dt
import json
import os
import shutil
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, 'vendor', 'model')
sys.path.insert(0, MODEL)
import allocator_backtest as AB   # noqa: E402
import assets                     # noqa: E402
import mira_invest as M           # noqa: E402

START_NAV = 10.0
COST_BPS = M.COST                  # 10 bps on one-sided turnover, same assumption as the model's backtests
POOLS = {'safe': 20, 'growth': 60}         # pool -> base dial (% stocks when the market is calm)
RULE = 'gate'                              # model variant: base x gate[stress]. Same rule as the forward test (not 'chain', which
                                           # failed its holdout success rule in REPORT_mira_invest.md)
IRX_DAYS = 252.0
MAX_STALE_DAYS = 6
MONTHLY = AB.ASSETS + ['SPY', '_IRX']
YAHOO_SYMBOL = {'_IRX': '^IRX'}
BASELINE = os.path.join(ROOT, 'data', 'baseline')
WORK = os.path.join(ROOT, 'data', 'work')


# ------------------------------------------------------------------ NAV maths (pure, unit-tested)
def advance(nav, w, rets):
    """One market day: portfolio return from weights held, NAV update, weights drift. rets: {sym: simple return}."""
    r = sum(wt * rets.get(k, 0.0) for k, wt in w.items())
    nav = nav * (1.0 + r)
    return nav, {k: wt * (1.0 + rets.get(k, 0.0)) / (1.0 + r) for k, wt in w.items()}, r


def rebalance(nav, w, target, cost_bps=COST_BPS):
    turnover = 0.5 * sum(abs(target.get(k, 0.0) - w.get(k, 0.0)) for k in set(w) | set(target))
    return nav * (1.0 - turnover * cost_bps / 1e4), dict(target), turnover


def target_weights(state, stock_share):
    s = float(stock_share)
    w = {'SPY': s}
    for a, x in state['core_weights'].items():
        w[a] = w.get(a, 0.0) + (1 - s) * float(x)
    w['CASH'] = (1 - s) * float(state['core_cash_share'])
    tot = sum(w.values())
    return {k: round(v / tot, 6) for k, v in w.items() if v > 1e-9}


def is_due(held_regime, state, day):
    """Rebalance on first run, on a new calendar month (the backtested cadence), or when the stress level changed."""
    if not held_regime:
        return True, 'first run'
    if held_regime.get('rebalance_month') != day[:7]:
        return True, 'new month'
    if held_regime.get('stress') != state['stress']:
        return True, 'stress level changed'
    return False, 'hold'


# ------------------------------------------------------------------ data
def yahoo_daily(http, sym, rng='1y'):
    y = YAHOO_SYMBOL.get(sym, sym)
    url = ('https://query1.finance.yahoo.com/v8/finance/chart/' + urllib.parse.quote(y, safe='') +
           f'?range={rng}&interval=1d&includeAdjustedClose=true')
    r = json.loads(http(url))['chart']['result'][0]
    ind = r['indicators']
    px = (ind.get('adjclose') or [{}])[0].get('adjclose') or ind['quote'][0]['close']
    out = {}
    for t, p in zip(r['timestamp'], px):
        if p is not None and p > 0:
            out[dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime('%Y-%m-%d')] = float(p)
    return out


def refresh_data(http, today, log=print):
    """Seed WORK from the committed baseline, then overwrite with fresh Yahoo data. Reports partial failures loudly."""
    multi, daily = os.path.join(WORK, 'multi'), os.path.join(WORK, 'daily')
    os.makedirs(multi, exist_ok=True)
    os.makedirs(daily, exist_ok=True)
    for n in MONTHLY:
        dst = os.path.join(multi, f'raw_{n}.json')
        if not os.path.exists(dst):
            shutil.copy(os.path.join(BASELINE, 'multi', f'raw_{n}.json'), dst)
    g = os.path.join(daily, '_GSPC.json')
    if not os.path.exists(g):
        shutil.copy(os.path.join(BASELINE, 'daily', '_GSPC.json'), g)
    failed = []
    for n in MONTHLY:
        url = ('https://query1.finance.yahoo.com/v8/finance/chart/' + urllib.parse.quote(YAHOO_SYMBOL.get(n, n), safe='') +
               '?range=max&interval=1mo&includeAdjustedClose=true')
        try:
            txt = http(url)
            r = json.loads(txt)['chart']['result'][0]
            if not r.get('timestamp'):
                raise ValueError('empty chart')
            open(os.path.join(multi, f'raw_{n}.json'), 'w', encoding='utf-8').write(txt)
        except Exception as e:
            failed.append(f'{n}: {type(e).__name__}')
        time.sleep(0.3)
    try:                                              # merge recent daily S&P 500 closes into the long history
        old = json.load(open(g, encoding='utf-8'))['closes']
        start = (dt.date.fromisoformat(max(old)) - dt.timedelta(days=30)).isoformat()
        new = assets.fetch_series(http, '^GSPC', start, (today + dt.timedelta(days=1)).isoformat())
        old.update(new)
        assets.save_cache('^GSPC', old, outdir=daily)
    except Exception as e:
        failed.append(f'^GSPC daily: {type(e).__name__}')
    log('refresh: ' + ('ok' if not failed else 'PARTIAL, kept baseline for: ' + '; '.join(failed)))
    return failed


def last_complete_month(today):
    y, m = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    return f'{y:04d}-{m:02d}'


def build_model(today):
    saved = (AB.DATA, AB.LAST, assets.CACHE)
    AB.DATA, AB.LAST, assets.CACHE = os.path.join(WORK, 'multi'), last_complete_month(today), os.path.join(WORK, 'daily')
    try:
        return M.build()
    finally:
        AB.DATA, AB.LAST, assets.CACHE = saved


# ------------------------------------------------------------------ sinks
class FileSink:
    """Local JSON store with the same shape as the Supabase tables (for tests and offline runs)."""
    def __init__(self, path):
        self.path = path
        self.db = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {'pools': {}, 'history': []}

    def get_pool(self, pool):
        return self.db['pools'].get(pool)

    def last_regime(self, pool):
        h = [x for x in self.db['history'] if x['pool'] == pool]
        return max(h, key=lambda x: x['as_of'])['regime'] if h else None

    def apply_nav(self, pool, nav, as_of, weights, regime):
        cur = self.db['pools'].get(pool)
        if cur and cur['as_of'] >= as_of:
            return False
        units = cur['units_total'] if cur else 0
        self.db['pools'][pool] = dict(pool=pool, nav=round(nav, 8), as_of=as_of, weights=weights, units_total=units)
        self.db['history'].append(dict(pool=pool, as_of=as_of, nav=round(nav, 8), weights=weights, regime=regime))
        return True

    def close(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        json.dump(self.db, open(self.path, 'w', encoding='utf-8'), indent=1)


class SupabaseSink:
    """PostgREST with the service-role key from env. The key is never printed or written anywhere."""
    def __init__(self, url, key, http=None):
        self.url, self.key = url.rstrip('/'), key
        self.http = http or self._http

    def _http(self, method, path, body=None):
        req = urllib.request.Request(self.url + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                     headers={'apikey': self.key, 'Authorization': f'Bearer {self.key}',
                                              'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or 'null')

    def get_pool(self, pool):
        rows = self.http('GET', f'/rest/v1/fund_pools?pool=eq.{urllib.parse.quote(pool)}&select=*')
        return rows[0] if rows else None

    def last_regime(self, pool):
        rows = self.http('GET', f'/rest/v1/fund_nav_history?pool=eq.{urllib.parse.quote(pool)}&select=regime&order=as_of.desc&limit=1')
        return rows[0]['regime'] if rows else None

    def apply_nav(self, pool, nav, as_of, weights, regime):
        r = self.http('POST', '/rest/v1/rpc/fund_apply_nav',
                      {'p_pool': pool, 'p_nav': round(nav, 8), 'p_as_of': as_of, 'p_weights': weights, 'p_regime': regime})
        return bool(r.get('applied'))

    def close(self):
        pass


# ------------------------------------------------------------------ run
def run(sink, prefix='', http=None, today=None, refresh=True, log=print):
    http = http or assets.default_http
    today = today or dt.date.today()
    if refresh:
        refresh_data(http, today, log)
    D = build_model(today)
    state = M.current_state(D)
    sg = M.signals_at(D['px'], len(D['px']) - 1)
    syms = ['SPY'] + list(AB.ASSETS)
    px = {}
    for s in syms + ['_IRX']:
        px[s] = yahoo_daily(http, s)
        time.sleep(0.2)
    cal = sorted(px['SPY'])
    latest = cal[-1]
    age = (today - dt.date.fromisoformat(latest)).days
    if age > MAX_STALE_DAYS:
        raise SystemExit(f'REFUSED: newest SPY close is {latest} ({age} days old). Data refresh failed; NAV not updated.')

    def day_rets(d, prev):
        r = {}
        for s in syms:
            if d in px[s] and prev in px[s]:
                r[s] = px[s][d] / px[s][prev] - 1.0
        irx = px['_IRX'].get(prev)
        r['CASH'] = irx / 100.0 / IRX_DAYS if irx else 0.0
        return r

    report = []
    for name, base in POOLS.items():
        pool = prefix + name
        stock = M.share(RULE, base / 100.0, sg)
        target = target_weights(state, stock)
        regime = dict(stress=state['stress'], alarms=state['alarms'], vol_ratio=state['vol_ratio'],
                      drawdown_pct=state['drawdown_pct'], e_size=state['e_size'], gate=state['gate'], rule=RULE,
                      stock_share=round(stock, 4), model_as_of=state['as_of'], base=base,
                      source='statistical regime model only (no AI news layer)')
        row = sink.get_pool(pool)
        if row is None:
            regime.update(rebalance_month=latest[:7], reason='pool opened')
            ok = sink.apply_nav(pool, START_NAV, latest, target, regime)
            report.append((pool, latest, START_NAV, 'opened', ok))
            continue
        days = [d for d in cal if d > row['as_of']]
        if not days:
            report.append((pool, row['as_of'], float(row['nav']), 'up to date', False))
            continue
        nav, w = float(row['nav']), {k: float(v) for k, v in row['weights'].items()}
        held = sink.last_regime(pool) or {}
        rb_month = held.get('rebalance_month')
        prev = row['as_of'] if row['as_of'] in px['SPY'] else cal[max(0, cal.index(days[0]) - 1)]
        for d in days:
            nav, w, r = advance(nav, w, day_rets(d, prev))
            prev = d
            if d != days[-1]:
                sink.apply_nav(pool, nav, d, w, dict(catchup=True, rebalance_month=rb_month, stress=held.get('stress'),
                                                     day_return=round(r, 6)))
        due, why = is_due(held, state, latest)
        cost = 0.0
        if due:
            nav, w, turn = rebalance(nav, w, target)
            cost, rb_month = turn * COST_BPS / 1e4, latest[:7]
        regime.update(rebalance_month=rb_month, reason=why, turnover_cost=round(cost, 6), days_applied=len(days))
        if not due:
            regime['stress'] = held.get('stress', state['stress'])
        ok = sink.apply_nav(pool, nav, latest, w, regime)
        report.append((pool, latest, nav, why, ok))
    for pool, d, nav, why, ok in report:
        log(f'{pool:14s} as_of={d} nav={nav:.6f} {why:22s} {"written" if ok else "no change"}')
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sink', choices=['file', 'supabase'], default='file')
    ap.add_argument('--file', default=os.path.join(ROOT, 'data', 'local_fund.json'))
    ap.add_argument('--pool-prefix', default='')
    ap.add_argument('--no-refresh', action='store_true')
    a = ap.parse_args()
    if a.sink == 'supabase':
        url, key = os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub Actions secrets).')
        sink = SupabaseSink(url, key)
    else:
        sink = FileSink(a.file)
    try:
        run(sink, prefix=a.pool_prefix, refresh=not a.no_refresh)
    finally:
        sink.close()


if __name__ == '__main__':
    main()
