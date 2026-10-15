// Shared wrapper for /api/fund/* routes: Clerk auth, JSON body, error mapping. Server-only.
import { auth } from "@clerk/nextjs/server";
import { ApiError, type Db } from "./fundApi";
import { serviceDb } from "./fundDb";

const USER_ERRORS = ["nothing to withdraw", "nothing to switch", "bad amount", "amount too small", "unknown pool", "same pool"];

export async function handle(req: Request | null, fn: (db: Db, userId: string, body: any) => Promise<unknown>) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = req ? await req.json().catch(() => ({})) : {};
    return Response.json(await fn(serviceDb(), userId, body), { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    const m = String(e?.message || "");
    if (m === "fund_not_configured") return Response.json({ error: "fund_not_configured" }, { status: 503 });
    if (USER_ERRORS.some((x) => m.includes(x))) return Response.json({ error: m }, { status: 400 });
    console.error("fund api error", m);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
