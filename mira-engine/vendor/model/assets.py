"""World assets: one forecast type ("asset") for stocks, indices, bonds, commodities futures, crypto, rates, real estate.

  * ASSET_MENU is a FIXED list: the model can only forecast tickers that are on it, so a symbol can never be invented
  * resolution uses the daily CLOSE from Yahoo Finance on the horizon date (or the last close up to 5 days earlier)
  * AssetAnchor gives a statistical probability for every asset forecast: pooled volatility-scaled moves over the same
    horizon, rescaled by the asset's own recent volatility (same idea as the commodity and FX anchors)
Cache: data_assets/<ticker>.json  {"symbol": "^GSPC", "closes": {"YYYY-MM-DD": 5000.1, ...}}
Refresh: python -E assets_download.py
"""
import datetime as dt
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'data_assets')
HOST = 'query1.finance.yahoo.com'
MAX_GAP_DAYS = 5
VOL_WIN = 60
EPS = 0.01
MAX_STALE_DAYS = 10
TRADING_PER_CAL = 252.0 / 365.0

# ticker -> (name, class). Index tickers (^...) are price indices; ETFs and futures are quoted as traded.
ASSET_MENU = {
    # stocks and indices
    '^GSPC': ('S&P 500 index (US large stocks)', 'stocks'), '^IXIC': ('Nasdaq Composite (US tech-heavy stocks)', 'stocks'),
    '^FTSE': ('FTSE 100 (UK stocks)', 'stocks'), '^N225': ('Nikkei 225 (Japan stocks)', 'stocks'),
    '^HSI': ('Hang Seng (Hong Kong stocks)', 'stocks'), 'THD': ('Thailand stocks ETF (MSCI Thailand)', 'stocks'),
    'EEM': ('Emerging markets stocks ETF', 'stocks'), 'AAPL': ('Apple', 'stocks'), 'NVDA': ('Nvidia', 'stocks'),
    # bonds and rates
    'TLT': ('US Treasuries 20y+ ETF', 'bonds'), 'IEF': ('US Treasuries 7-10y ETF', 'bonds'),
    'SHY': ('US Treasuries 1-3y ETF', 'bonds'), 'TIP': ('US inflation-linked bonds ETF', 'bonds'),
    'LQD': ('US investment-grade corporate bonds ETF', 'bonds'), 'HYG': ('US high-yield bonds ETF', 'bonds'),
    'EMB': ('Emerging-market bonds ETF', 'bonds'), '^TNX': ('US 10-year Treasury yield (index, % x10)', 'rates'),
    # commodities
    'GC=F': ('Gold futures', 'commodities'), 'SI=F': ('Silver futures', 'commodities'), 'CL=F': ('WTI crude oil futures', 'commodities'),
    'BZ=F': ('Brent crude oil futures', 'commodities'), 'NG=F': ('US natural gas futures', 'commodities'),
    'HG=F': ('Copper futures', 'commodities'), 'ZW=F': ('Wheat futures', 'commodities'), 'ZC=F': ('Corn futures', 'commodities'),
    'ZS=F': ('Soybean futures', 'commodities'), 'DBC': ('Broad commodity index ETF', 'commodities'),
    # currencies and crypto
    'DX-Y.NYB': ('US dollar index', 'currencies'), 'BTC-USD': ('Bitcoin in USD', 'crypto'), 'ETH-USD': ('Ethereum in USD', 'crypto'),
    # real estate and risk gauge
    'VNQ': ('US listed real estate ETF', 'real estate'), '^VIX': ('VIX stock-market fear index', 'volatility'),
}
_SAFE = re.compile(r'[^A-Za-z0-9_.\-]')


def name_of(sym):
    return ASSET_MENU[sym][0] if sym in ASSET_MENU else sym


def class_of(sym):
    return ASSET_MENU[sym][1] if sym in ASSET_MENU else 'other'


def safe(sym):
    return _SAFE.sub('_', sym)


# ------------------------------------------------------------------ data
def chart_url(sym, start_iso, end_iso):
    p1 = int(dt.datetime.combine(dt.date.fromisoformat(start_iso), dt.time(0), dt.timezone.utc).timestamp())
    p2 = int(dt.datetime.combine(dt.date.fromisoformat(end_iso), dt.time(23, 59), dt.timezone.utc).timestamp())
    q = urllib.parse.quote(sym, safe='')
    return f'https://{HOST}/v8/finance/chart/{q}?period1={p1}&period2={p2}&interval=1d'


def parse_chart(text):
    """Yahoo chart JSON -> {iso_date: close}. Skips missing or non-positive closes."""
    js = json.loads(text)
    res = ((js.get('chart') or {}).get('result') or [None])[0]
    if not res:
        raise ValueError('no chart result')
    ts = res.get('timestamp') or []
    close = (((res.get('indicators') or {}).get('quote') or [{}])[0]).get('close') or []
    out = {}
    for t, c in zip(ts, close):
        if c is None or not isinstance(c, (int, float)) or not math.isfinite(c) or c <= 0:
            continue
        out[dt.datetime.fromtimestamp(t, dt.timezone.utc).date().isoformat()] = float(c)
    return out


def default_http(url):
    if urllib.parse.urlparse(url).netloc.lower() != HOST:
        raise PermissionError('only Yahoo Finance chart API is allowed')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 RiskRadar/0.2'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', errors='replace')


def fetch_series(http, sym, start_iso, end_iso):
    if sym not in ASSET_MENU:
        raise ValueError(f'unknown asset {sym!r}')
    return parse_chart(http(chart_url(sym, start_iso, end_iso)))


def value_on(series, date_iso, max_gap=MAX_GAP_DAYS):
    """Last close on or before date within max_gap days. Returns (value, date) or None."""
    d = dt.date.fromisoformat(date_iso)
    best = None
    for k in series:
        kd = dt.date.fromisoformat(k)
        if kd <= d and (best is None or kd > best):
            best = kd
    if best is None or (d - best).days > max_gap:
        return None
    return series[best.isoformat()], best.isoformat()


def save_cache(sym, closes, outdir=CACHE):
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, safe(sym) + '.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(symbol=sym, closes=dict(sorted(closes.items()))), f)


def load_cache(outdir=CACHE):
    out = {}
    if not os.path.isdir(outdir):
        return out
    for fn in os.listdir(outdir):
        if not fn.endswith('.json'):
            continue
        try:
            js = json.load(open(os.path.join(outdir, fn), encoding='utf-8'))
            if js.get('symbol') in ASSET_MENU and isinstance(js.get('closes'), dict) and len(js['closes']) > 300:
                out[js['symbol']] = js['closes']
        except (OSError, ValueError):
            continue
    return out


# ------------------------------------------------------------------ statistical anchor
class AssetAnchor:
    """Probability for an 'asset' template from the daily history cache. Returns None when it cannot say."""

    def __init__(self, cache=None, outdir=CACHE):
        data = cache if cache is not None else load_cache(outdir)
        self.series = {}
        for sym, closes in data.items():
            ks = sorted(closes)
            self.series[sym] = (ks, np.log(np.array([closes[k] for k in ks], float)))
        self.vol = {}
        for sym, (ks, lp) in self.series.items():
            d = np.diff(lp)
            if len(d) > VOL_WIN + 10:
                w = np.lib.stride_tricks.sliding_window_view(d, VOL_WIN)
                v = np.full(len(lp), np.nan)
                v[VOL_WIN:] = w.std(axis=1)
                self.vol[sym] = v                                  # v[i] = std of the 60 daily returns ending at i
        self._pools = {}

    def pool(self, h):
        if h not in self._pools:
            zs = []
            for sym, v in self.vol.items():
                lp = self.series[sym][1]
                n = len(lp)
                if n <= VOL_WIN + h:
                    continue
                r = lp[h:] - lp[:n - h]
                z = r / (v[:n - h] * math.sqrt(h))
                zs.append(z[VOL_WIN:][np.isfinite(z[VOL_WIN:])])
            self._pools[h] = np.sort(np.concatenate(zs)) if zs else np.array([])
        return self._pools[h]

    def prob(self, t):
        if t.get('metric_kind') != 'asset' or t.get('symbol') not in self.vol:
            return None
        ks, lp = self.series[t['symbol']]
        v = self.vol[t['symbol']][-1]
        if not v or not math.isfinite(v) or v <= 0:
            return None
        last = dt.date.fromisoformat(ks[-1])
        issue = dt.date.fromisoformat(t['issue_date'])
        if (issue - last).days > MAX_STALE_DAYS:                   # stale data: say nothing rather than mislead
            return None
        days = (dt.date.fromisoformat(t['horizon_date']) - last).days
        h = max(1, int(round(days * TRADING_PER_CAL)))
        pool = self.pool(h)
        if len(pool) < 2000:
            return None
        s, n, p0 = v * math.sqrt(h), len(pool), lp[-1]

        def ge(r):
            return 1 - np.searchsorted(pool, r / s, side='left') / n

        def le(r):
            return np.searchsorted(pool, r / s, side='right') / n
        c, x = t['comparator'], t['threshold']
        if c == 'rise_ge_pct':
            p = ge(math.log(1 + x / 100.0)) if x > 0 else ge(0.0)
        elif c == 'fall_ge_pct':
            p = le(math.log(1 - x / 100.0)) if x > 0 else le(0.0)
        elif c == 'swing_ge_pct':
            p = ge(math.log(1 + x / 100.0)) + le(math.log(1 - x / 100.0))
        elif c == 'above_level':
            p = ge(math.log(x) - p0)
        elif c == 'below_level':
            p = le(math.log(x) - p0)
        else:
            lo, hi = math.log(t['threshold']) - p0, math.log(t['threshold_hi']) - p0
            p = le(hi) - (1 - ge(lo))
        return float(np.clip(p, EPS, 1 - EPS))


def download_all(http=default_http, outdir=CACHE, start='2000-01-01', end=None, sleep=1.0, log=print):
    end = end or dt.date.today().isoformat()
    ok = 0
    for sym in ASSET_MENU:
        try:
            closes = fetch_series(http, sym, start, end)
            if len(closes) < 100:
                raise ValueError(f'only {len(closes)} rows')
            save_cache(sym, closes, outdir)
            ok += 1
            log(f'  {sym:10s} {len(closes):5d} closes  {min(closes)} .. {max(closes)}')
        except Exception as e:
            log(f'  {sym:10s} FAILED {type(e).__name__}: {str(e)[:80]}')
        time.sleep(sleep)
    return ok
