// Server-only Supabase access with the SERVICE ROLE key. Never import this from a client component.
import type { Db } from "./fundApi";

export function serviceDb(): Db {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("fund_not_configured");
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const fail = async (r: Response) => {
    let m = `db_${r.status}`;
    try {
      m = (await r.json()).message || m;
    } catch {}
    return new Error(m);
  };
  return {
    async rpc(fn, args) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args), cache: "no-store" });
      if (!r.ok) throw await fail(r);
      return r.json();
    },
    async select(table, query) {
      const r = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: h, cache: "no-store" });
      if (!r.ok) throw await fail(r);
      return r.json();
    },
  };
}
