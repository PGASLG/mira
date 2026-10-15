/* Mira wallet: three places for money, all paper/simulated.
   - Central cash   mira_topup          money that sits there and does nothing. "ถอนเงิน" on the home page takes money from here to a bank.
   - Investment port mira_port_lots     [{t: ISO time, a: THB}]  money working in the investment tracks.
   - Lending port   mira_lend_active    owned by lender.html (read only here): locked (matched), waiting, accrued interest.
   Moves: central -> investment is instant. investment -> central only for the part whose assets can be sold already
   (settlement days per asset type); otherwise it returns an error with the date it can be withdrawn. */
(function () {
  var DAY = 864e5;
  var SETTLE = { cash: 0, currencies: 0, crypto: 0, bonds: 1, stocks: 2, commodities: 2, "real estate": 3 };   // days to sell and settle
  var MIX = {
    low:  { bonds: 60, stocks: 15, commodities: 15, "real estate": 5, currencies: 5 },
    mid:  { stocks: 35, bonds: 30, commodities: 25, "real estate": 5, crypto: 5 },
    high: { stocks: 50, commodities: 20, bonds: 10, "real estate": 10, crypto: 10 }
  };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function num(k) { return Math.max(0, +get(k, "0") || 0); }
  function lots() { try { var l = JSON.parse(get("mira_port_lots", "[]")); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function saveLots(l) { set("mira_port_lots", JSON.stringify(l.filter(function (x) { return x.a > 0.004; }))); }
  function mix() {
    var r = get("mira_risk", "mid"), w = MIX[r] || MIX.mid, t = 0, k;
    for (k in w) t += w[k];
    var o = {}; for (k in w) o[k] = w[k] / t; return o;
  }
  function maxDelay(w) { var m = 0, k; for (k in w) if (w[k] > 0) m = Math.max(m, SETTLE[k] || 0); return m; }

  function central() { return num("mira_topup"); }
  function invest() { return lots().reduce(function (s, x) { return s + (+x.a || 0); }, 0); }
  function lending() {
    try {
      if (window.MiraLend && typeof window.MiraLend.summary === "function") {
        var m = window.MiraLend.summary();
        var lk = +m.locked || 0, wt = +m.waiting || 0, er = +m.earned || 0;
        return { on: !!m.on, locked: lk, waiting: wt, accrued: er, total: lk + wt + er };
      }
    } catch (e) {}
    var a = null; try { a = JSON.parse(get("mira_lend_active", "null")); } catch (e) {}
    if (!a || !(a.amount > 0) || !Array.isArray(a.chunks)) return { on: false, locked: 0, waiting: 0, accrued: 0, total: 0 };
    var t0 = new Date(a.start).getTime(), now = Date.now(), end = new Date(a.start); end.setMonth(end.getMonth() + (a.months || 0));
    var locked = 0, waiting = 0, acc = 0;
    a.chunks.forEach(function (c) {
      var f = t0 + (c.d || 0) * 1000;
      if (now >= f) { locked += c.s; var t = Math.min(now, end.getTime()); if (t > f) acc += c.s * (a.rate || 0) / 100 * ((t - f) / DAY) / 365; }
      else waiting += c.s;
    });
    return { on: true, locked: locked, waiting: waiting, accrued: acc, total: locked + waiting + acc };
  }
  function total() { var l = lending(); return central() + invest() + l.total; }

  // how much of the investment port can be sold and settled right now
  function withdrawable(now) {
    now = now || Date.now();
    var w = mix(), sum = 0;
    lots().forEach(function (x) {
      var age = (now - new Date(x.t).getTime()) / DAY, f = 0, k;
      for (k in w) if (age >= (SETTLE[k] || 0)) f += w[k];
      sum += (+x.a || 0) * f;
    });
    return sum;
  }
  function fullAt() {   // when every lot is fully settled
    var d = maxDelay(mix()), latest = 0;
    lots().forEach(function (x) { latest = Math.max(latest, new Date(x.t).getTime() + d * DAY); });
    return latest ? new Date(latest) : null;
  }

  function toInvest(a) {
    a = Math.round(+a || 0);
    if (!(a > 0)) return { ok: false, error: "amount" };
    if (a > central()) return { ok: false, error: "central", max: central() };
    set("mira_topup", String(central() - a));
    var l = lots(); l.push({ t: new Date().toISOString(), a: a }); saveLots(l);
    return { ok: true, amount: a };
  }
  function fromInvest(a) {
    a = Math.round(+a || 0);
    if (!(a > 0)) return { ok: false, error: "amount" };
    var have = invest();
    if (a > have) return { ok: false, error: "exceeds", max: have };
    var can = withdrawable();
    if (a > can + 0.5) return { ok: false, error: "wait", canNow: Math.floor(can), fullAt: fullAt() };
    // take from the oldest lots first
    var l = lots().sort(function (p, q) { return new Date(p.t) - new Date(q.t); }), left = a;
    l.forEach(function (x) { var t = Math.min(x.a, left); x.a -= t; left -= t; });
    saveLots(l);
    set("mira_topup", String(central() + a));
    return { ok: true, amount: a };
  }
  function toBank(a, dest, last4) {
    a = Math.round(+a || 0);
    if (!(a > 0) || a > central()) return { ok: false, error: "central", max: central() };
    set("mira_topup", String(central() - a));
    var log = []; try { log = JSON.parse(get("mira_withdrawals", "[]")); } catch (e) {}
    log.push({ t: new Date().toISOString(), amount: a, dest: dest, last4: last4 });
    set("mira_withdrawals", JSON.stringify(log));
    return { ok: true, amount: a };
  }

  // ---- demo account: sample data on this device only; leaving wipes it ----
  function demoOn() { return get("mira_demo", "") === "1"; }
  function seedDemo() {
    if (demoOn()) return;                       // one demo per device: resume instead of creating another
    try {                                       // park any real account data so the demo never mixes with it
      var keepK = ["mira_lang", "mira_theme", "mira_text", "mira_motion"], real = {}, any = false;
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("mira_") === 0 && keepK.indexOf(k) < 0) { real[k] = localStorage.getItem(k); any = true; } }
      if (any) { localStorage.setItem("mirastash_real", JSON.stringify(real)); Object.keys(real).forEach(function (k) { localStorage.removeItem(k); }); }
    } catch (e) {}
    var d = function (days) { return new Date(Date.now() - days * DAY).toISOString(); };
    set("mira_demo", "1"); set("mira_onboarded", "1"); set("mira_name", "ผู้ทดลองใช้");
    set("mira_risk", "mid"); set("mira_split", "30"); set("mira_monthly", "2000"); set("mira_day", "5");
    set("mira_topup", "8000");
    set("mira_port_lots", JSON.stringify([{ t: d(90), a: 20000 }, { t: d(60), a: 5000 }, { t: d(0.1), a: 5000 }]));
    var now = Date.now(), pieces = [], n;
    for (n = 0; n < 6; n++) pieces.push({ id: n + 1, amt: 500, months: 3, rate: 8, start: new Date(now - 20 * DAY).toISOString(), paid: 0, cover: 1.2 });
    set("mira_lend_pool", JSON.stringify({ v: 1, offers: [{ id: 7, t: now, exp: now + 90 * DAY, fb: "keep", left: 2000, k: 0 }], pieces: pieces, app: null, earned: 12, seq: 8 }));
    set("mira_profile", JSON.stringify({ income: 25000, essential: 12000, debt: 0, saved: 8000, goal: "grow", horizon: "long", react: "hold", exp: "some", split: 30, risk: "mid", monthly: 2000, at: d(0) }));
  }
  function exitDemo() {
    try {
      var keep = ["mira_lang", "mira_theme", "mira_text", "mira_motion"], del = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("mira_") === 0 && keep.indexOf(k) < 0) del.push(k); }
      del.forEach(function (k) { localStorage.removeItem(k); });
      var raw = localStorage.getItem("mirastash_real");   // give back the real data parked when the demo began
      if (raw) { var old = JSON.parse(raw); Object.keys(old).forEach(function (k) { if (k.indexOf("mira_") === 0 && keep.indexOf(k) < 0) localStorage.setItem(k, old[k]); }); localStorage.removeItem("mirastash_real"); }
    } catch (e) {}
  }

  window.MiraWallet = {
    SETTLE: SETTLE, central: central, invest: invest, lending: lending, total: total,
    withdrawable: withdrawable, fullAt: fullAt, toInvest: toInvest, fromInvest: fromInvest, toBank: toBank,
    demoOn: demoOn, seedDemo: seedDemo, exitDemo: exitDemo
  };
})();
