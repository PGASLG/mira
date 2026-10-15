/* Mira Fund client helper. PAPER (simulated) money only. No keys here: the server holds the service role key.
   window.MiraFund.getStatus() / deposit(amount, growthPct) / withdraw(amount | {all:true}) / switchPool(from, to, amount)
   Each call returns the parsed JSON, or throws Error(code) where code is e.g. "unauthorized", "bad_amount", "exceeds_balance",
   "fund_not_configured". A fresh `ref` is generated per user action; pass the same ref again to retry safely. */
(function () {
  function newRef() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  async function call(method, path, body) {
    var r = await fetch("/api/fund/" + path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    var j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((j && j.error) || "http_" + r.status);
    return j;
  }
  window.MiraFund = {
    newRef: newRef,
    getStatus: function () { return call("GET", "status"); },
    /* growthPct = mira_split (0-100): share that goes to the Growth pool, the rest to Safe */
    deposit: function (amount, growthPct, ref) {
      return call("POST", "deposit", { amount: amount, growth_pct: growthPct, ref: ref || newRef() });
    },
    /* withdraw(500) or withdraw({all:true}); optional {pool:"safe"|"growth"}; taken pro rata otherwise */
    withdraw: function (arg, ref) {
      var b = typeof arg === "object" && arg ? arg : { amount: arg };
      b.ref = ref || newRef();
      return call("POST", "withdraw", b);
    },
    /* move money between pools after a mira_split change */
    switchPool: function (from, to, amount, ref) {
      return call("POST", "switch", { from: from, to: to, amount: amount, ref: ref || newRef() });
    },
  };
})();
