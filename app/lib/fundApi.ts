// Mira Fund API core. PAPER (simulated) money only. Pure logic with an injected Db so it can be unit-tested without Clerk.
// All unit minting/redeeming happens in Postgres functions (mira-engine/sql/002_fund_functions.sql), which lock the pool row.
export type Db = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  select: (table: string, query: string) => Promise<any[]>;
};
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const POOLS = ["safe", "growth"];
const REF = /^[A-Za-z0-9_-]{8,64}$/;
const r2 = (n: number) => Math.round(n * 100) / 100;

function amountOf(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0.01 || n > 10_000_000) throw new ApiError(400, "bad_amount");
  return r2(n);
}
function refOf(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !REF.test(v)) throw new ApiError(400, "bad_ref");
  return v;
}
function poolOf(v: unknown): string {
  if (typeof v !== "string" || !POOLS.includes(v)) throw new ApiError(400, "bad_pool");
  return v;
}
const sfx = (ref: string | null, s: string) => (ref ? `${ref}:${s}` : null);

export async function status(db: Db, userId: string) {
  const [pools, mine, hist] = await Promise.all([
    db.select("fund_pools", "select=pool,nav,units_total,as_of,weights,updated_at"),
    db.select("user_units", `select=pool,units,cost&user_id=eq.${encodeURIComponent(userId)}`),
    Promise.all(POOLS.map((p) => db.select("fund_nav_history", `select=as_of,nav&pool=eq.${p}&order=as_of.desc&limit=90`))),
  ]);
  const out: any = {
    simulation: true,
    note: "Paper money only. Research only, not investment advice. Past results do not promise future returns.",
    pools: {},
    me: {},
    history: {},
  };
  POOLS.forEach((p, i) => {
    const h = hist[i].slice().reverse();
    out.history[p] = h.map((x: any) => ({ as_of: x.as_of, nav: Number(x.nav) }));
    const row = pools.find((x: any) => x.pool === p);
    if (row) {
      const prev = h.length > 1 ? Number(h[h.length - 2].nav) : null;
      out.pools[p] = {
        nav: Number(row.nav),
        as_of: row.as_of,
        units_total: Number(row.units_total),
        weights: row.weights,
        day_change_pct: prev ? r2((Number(row.nav) / prev - 1) * 100) : null,
      };
    }
  });
  let value = 0;
  let cost = 0;
  for (const p of POOLS) {
    const u = mine.find((x: any) => x.pool === p);
    const nav = out.pools[p]?.nav ?? 0;
    const units = u ? Number(u.units) : 0;
    const c = u ? Number(u.cost) : 0;
    const v = r2(units * nav);
    out.me[p] = { units, value: v, cost: c, pnl: r2(v - c) };
    value += v;
    cost += c;
  }
  out.me.total = { value: r2(value), cost: r2(cost), pnl: r2(value - cost) };
  return out;
}

// body: { amount, growth_pct? (0-100, share that goes to the Growth pool), pool? (one pool only), ref? }
export async function deposit(db: Db, userId: string, body: any) {
  const amount = amountOf(body?.amount);
  const ref = refOf(body?.ref);
  const parts: [string, number][] = [];
  if (body?.pool != null) parts.push([poolOf(body.pool), amount]);
  else {
    const g = Number(body?.growth_pct);
    if (!Number.isFinite(g) || g < 0 || g > 100) throw new ApiError(400, "bad_growth_pct");
    const growth = r2((amount * g) / 100);
    const safe = r2(amount - growth);
    if (safe > 0) parts.push(["safe", safe]);
    if (growth > 0) parts.push(["growth", growth]);
  }
  const results = [];
  for (const [pool, a] of parts) {
    results.push(await db.rpc("fund_deposit", { p_user: userId, p_pool: pool, p_amount: a, p_ref: sfx(ref, pool) }));
  }
  return { ok: true, results };
}

// body: { amount? , all? , pool?, ref? }  Without pool the amount is taken pro rata from the pools the user holds.
export async function withdraw(db: Db, userId: string, body: any) {
  const ref = refOf(body?.ref);
  const all = body?.all === true;
  const amount = all ? null : amountOf(body?.amount);
  const st = await status(db, userId);
  let held = POOLS.map((p) => ({ pool: p, value: st.me[p].value as number })).filter((x) => x.value > 0);
  if (body?.pool != null) {
    const only = poolOf(body.pool);
    held = held.filter((x) => x.pool === only);
  }
  const total = held.reduce((s, x) => s + x.value, 0);
  if (total <= 0) throw new ApiError(400, "nothing_to_withdraw");
  if (amount != null && amount > total + 0.01) throw new ApiError(400, "exceeds_balance");
  const results = [];
  let left = amount ?? 0;
  for (let i = 0; i < held.length; i++) {
    const x = held[i];
    let part: number | null = null;
    if (!all && amount != null) {
      part = i === held.length - 1 ? r2(left) : r2((amount * x.value) / total);
      left = r2(left - part);
      if (part <= 0) continue;
    }
    results.push(await db.rpc("fund_withdraw", { p_user: userId, p_pool: x.pool, p_amount: part, p_ref: sfx(ref, x.pool), p_all: all }));
  }
  return { ok: true, results };
}

// body: { from, to, amount, ref? }  move value between the user's pools (a change of mira_split)
export async function switchPool(db: Db, userId: string, body: any) {
  const from = poolOf(body?.from);
  const to = poolOf(body?.to);
  if (from === to) throw new ApiError(400, "same_pool");
  const r = await db.rpc("fund_switch", { p_user: userId, p_from: from, p_to: to, p_amount: amountOf(body?.amount), p_ref: refOf(body?.ref) });
  return { ok: true, result: r };
}
