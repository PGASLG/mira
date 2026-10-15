/* Shared paper-portfolio maths for investment.html and track.html.
   Three places for money (wallet.js owns the moves): central cash mira_topup, investment port mira_port_lots, lending port (lend-core.js).
   This file only reads them; backtest numbers are only used for labelled strips. */
(function(){
  const D = window.MIRA_DATA, P = D.portfolio, CC = P.class_curves, N = P.curve.length;
  const ST = (D.model || {}).state, FX = (D.model || {}).fx;
  CC.cash = P.curve.map(() => 100);                 // cash index stays flat in the paper model
  const TRK = ["low", "high"], RK = {low: "20", high: "60"};
  const KIND_OF = {GLD:"commodities",SLV:"commodities",DBC:"commodities",DBA:"commodities",SHY:"bonds",HYG:"bonds",EMB:"bonds",UUP:"currencies",VNQ:"real estate"};
  const FALLBACK = {low:{stocks:20,bonds:50,commodities:15,"real estate":5,currencies:5,cash:5},high:{stocks:60,bonds:15,commodities:15,"real estate":5,currencies:0,cash:5}};
  const store = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  };

  // Real holdings the model would own in this track: the stock part is the S&P 500 index, the rest is the model's defensive core.
  function holdings(t){
    const s = ST && ST.stock_share_by_base && ST.stock_share_by_base[RK[t]];
    if(!ST || !ST.core_weights || typeof s !== "number"){
      return Object.entries(FALLBACK[t]).filter(e => e[1] > 0).map(e => ({sym: e[0] === "stocks" ? "SPX" : e[0] === "cash" ? "CASH" : null, kind: e[0], pct: e[1]}));
    }
    const tot = Object.values(ST.core_weights).reduce((a,b) => a + b, 0) + (ST.core_cash_share || 0);
    const out = [{sym: "SPX", kind: "stocks", pct: s * 100}];
    for(const [sym, v] of Object.entries(ST.core_weights)) out.push({sym, kind: KIND_OF[sym] || "commodities", pct: (1 - s) * v / tot * 100});
    out.push({sym: "CASH", kind: "cash", pct: (1 - s) * (ST.core_cash_share || 0) / tot * 100});
    return out.filter(h => h.pct > 0.05).sort((a, b) => b.pct - a.pct);
  }
  function mixFor(t){ const w = {}; holdings(t).forEach(h => { w[h.kind] = (w[h.kind] || 0) + h.pct; }); return w; }
  function mixIndex(w){
    const kinds = Object.keys(w).filter(k => w[k] > 0 && CC[k]), tot = kinds.reduce((s,k) => s + w[k], 0), idx = [100];
    for(let i = 1; i < N; i++){ let r = 0; for(const k of kinds) r += w[k] / tot * (CC[k][i] / CC[k][i-1] - 1); idx.push(idx[i-1] * (1 + r)); }
    return idx;
  }
  function stats(idx){
    const r = []; let peak = idx[0], dd = 0;
    for(let i = 1; i < N; i++){ r.push(idx[i] / idx[i-1] - 1); peak = Math.max(peak, idx[i]); dd = Math.min(dd, idx[i] / peak - 1); }
    const mu = r.reduce((a,b) => a + b, 0) / r.length, v = r.reduce((a,b) => a + (b - mu) ** 2, 0) / (r.length - 1);
    return {vol: Math.sqrt(v * 252) * 100, dd: -dd * 100};
  }

  const today = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth()+1).padStart(2,"0") + "-" + String(t.getDate()).padStart(2,"0"); };
  const W = () => window.MiraWallet;
  // money sitting in central cash (not invested, not working)
  const central = () => W() ? W().central() : Math.max(0, +store.get("mira_topup", 0) || 0);
  // investment port lots, each lot = a deposit into the tracks with its date
  function lots(){
    let L = []; try{ L = JSON.parse(store.get("mira_port_lots", "[]")); if(!Array.isArray(L)) L = []; }catch(e){ L = []; }
    return L.filter(x => x && x.a > 0 && x.t);
  }
  // money added from outside (Stripe / PromptPay demo) lands in central cash
  function addCentral(a){ store.set("mira_topup", String(central() + a)); }
  // value of one track: each lot grows with the track index from its date to the latest data date
  function trackValue(t, frac){
    const idx = mixIndex(mixFor(t)), dates = P.curve.map(c => c[0]); let value = 0, put = 0;
    for(const x of lots()){
      const day = String(x.t).slice(0, 10), i = dates.findIndex(d => d >= day), ratio = i < 0 ? 1 : idx[N-1] / idx[i];
      value += x.a * frac * ratio; put += x.a * frac;
    }
    return {value, put, bt: idx[N-1] / 100, idx};
  }
  // lending port: read only, via wallet.js (which uses lend-core.js when present)
  function lend(){
    const l = W() ? W().lending() : {on: false, locked: 0, waiting: 0, accrued: 0, total: 0};
    return {on: !!l.on, locked: l.locked || 0, waiting: l.waiting || 0, accrued: l.accrued || 0, total: l.total || 0, principal: (l.locked || 0) + (l.waiting || 0)};
  }
  window.MC = {P, CC, N, ST, FX, TRK, RK, store, holdings, mixFor, mixIndex, stats, trackValue, today, lend, central, lots, addCentral};
})();
