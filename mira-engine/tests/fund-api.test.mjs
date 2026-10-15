// Tests the Next.js fund API logic (app/lib/fundApi.ts) against an in-memory Db that mimics the SQL functions.
// The real atomic maths is proven in tests/fairness.sql; this checks splitting, pro-rata withdraw, validation, idempotency.
// Run: node --test tests/fund-api.test.mjs   (Node 22+, type stripping)
import test from "node:test";
import assert from "node:assert/strict";
import { deposit, withdraw, switchPool, status } from "../../mira-next/my-clerk-next-app/app/lib/fundApi.ts";

function fakeDb() {
  const pools = { safe: { nav: 10, units_total: 0 }, growth: { nav: 20, units_total: 0 } };
  const units = {}; // `${user}|${pool}` -> {units,cost}
  const refs = new Map();
  const db = {
    calls: [],
    async select(table, q) {
      if (table === "fund_pools") return Object.entries(pools).map(([pool, p]) => ({ pool, ...p, as_of: "2026-10-14", weights: {} }));
      if (table === "user_units") {
        const u = decodeURIComponent(q.split("user_id=eq.")[1]);
        return Object.entries(units).filter(([k]) => k.startsWith(u + "|")).map(([k, v]) => ({ pool: k.split("|")[1], ...v }));
      }
      return [];
    },
    async rpc(fn, a) {
      db.calls.push([fn, a]);
      if (a.p_ref && refs.has(a.p_ref)) return { ...refs.get(a.p_ref), replayed: true };
      const key = `${a.p_user}|${a.p_pool}`;
      let out;
      if (fn === "fund_deposit") {
        const u = Math.round((a.p_amount / pools[a.p_pool].nav) * 1e8) / 1e8;
        const c = units[key] || { units: 0, cost: 0 };
        units[key] = { units: c.units + u, cost: c.cost + a.p_amount };
        pools[a.p_pool].units_total += u;
        out = { pool: a.p_pool, amount: a.p_amount, units: u };
      } else if (fn === "fund_withdraw") {
        const c = units[key];
        const value = c.units * pools[a.p_pool].nav;
        const all = a.p_all || a.p_amount == null || a.p_amount >= value - 0.01;
        const u = all ? c.units : a.p_amount / pools[a.p_pool].nav;
        units[key] = { units: c.units - u, cost: all ? 0 : c.cost * (1 - u / c.units) };
        out = { pool: a.p_pool, amount: all ? Math.round(value * 100) / 100 : a.p_amount, units: u };
      }
      if (a.p_ref) refs.set(a.p_ref, out);
      return out;
    },
  };
  return db;
}
const ref = (s) => s.padEnd(8, "x");

test("deposit splits by growth_pct and sums back to the amount", async () => {
  const db = fakeDb();
  const r = await deposit(db, "u1", { amount: 1000, growth_pct: 30, ref: ref("dep1") });
  assert.deepEqual(r.results.map((x) => [x.pool, x.amount]), [["safe", 700], ["growth", 300]]);
  const st = await status(db, "u1");
  assert.equal(st.me.total.value, 1000);
  assert.equal(st.simulation, true);
});

test("growth_pct 0 and 100 touch one pool only", async () => {
  const db = fakeDb();
  assert.equal((await deposit(db, "u", { amount: 100, growth_pct: 0 })).results.length, 1);
  assert.equal((await deposit(db, "u", { amount: 100, growth_pct: 100 })).results[0].pool, "growth");
});

test("same ref replays and mints nothing twice", async () => {
  const db = fakeDb();
  await deposit(db, "u1", { amount: 500, growth_pct: 50, ref: ref("same") });
  const r2 = await deposit(db, "u1", { amount: 500, growth_pct: 50, ref: ref("same") });
  assert.ok(r2.results.every((x) => x.replayed));
  assert.equal((await status(db, "u1")).me.total.value, 500);
});

test("withdraw is taken pro rata across pools and the parts add up", async () => {
  const db = fakeDb();
  await deposit(db, "u1", { amount: 1000, growth_pct: 25 });
  const r = await withdraw(db, "u1", { amount: 400, ref: ref("w1") });
  const sum = r.results.reduce((s, x) => s + x.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, 400);
  const st = await status(db, "u1");
  assert.equal(st.me.safe.value, 450); // 750 - 300
  assert.equal(st.me.growth.value, 150); // 250 - 100
});

test("withdraw all empties both pools; more than held is refused", async () => {
  const db = fakeDb();
  await deposit(db, "u1", { amount: 1000, growth_pct: 40 });
  await assert.rejects(() => withdraw(db, "u1", { amount: 5000 }), /exceeds_balance/);
  await withdraw(db, "u1", { all: true });
  assert.equal((await status(db, "u1")).me.total.value, 0);
  await assert.rejects(() => withdraw(db, "u1", { all: true }), /nothing_to_withdraw/);
});

test("validation: bad amount, pool, ref, pct", async () => {
  const db = fakeDb();
  await assert.rejects(() => deposit(db, "u", { amount: -5, growth_pct: 10 }), /bad_amount/);
  await assert.rejects(() => deposit(db, "u", { amount: "abc", growth_pct: 10 }), /bad_amount/);
  await assert.rejects(() => deposit(db, "u", { amount: 10, growth_pct: 120 }), /bad_growth_pct/);
  await assert.rejects(() => deposit(db, "u", { amount: 10, pool: "evil" }), /bad_pool/);
  await assert.rejects(() => deposit(db, "u", { amount: 10, growth_pct: 5, ref: "a b" }), /bad_ref/);
  await assert.rejects(() => switchPool(db, "u", { from: "safe", to: "safe", amount: 1 }), /same_pool/);
  assert.equal(db.calls.length, 0);
});

test("a user never sees another user's units", async () => {
  const db = fakeDb();
  await deposit(db, "alice", { amount: 1000, growth_pct: 50 });
  assert.equal((await status(db, "bob")).me.total.value, 0);
});
