// DEMO ONLY: in-memory top-up status so a phone that scans the PromptPay QR can tell the desktop tab it is done.
// ponytail: per-instance memory, not durable. Use a real DB + provider webhook before any real money.
type Rec = { amt: number; status: "done"; at: number };
const g = globalThis as unknown as { __miraTopups?: Map<string, Rec> };
const store = (g.__miraTopups ??= new Map<string, Rec>());
const okId = (s: unknown) => typeof s === "string" && /^[a-z0-9]{6,40}$/.test(s);

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!okId(id)) return Response.json({ status: "bad_id" }, { status: 400 });
  const r = store.get(id as string);
  return Response.json(r ? { status: r.status, amt: r.amt } : { status: "pending" });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const amt = Math.round(Number(b.amt));
  if (!okId(b.id) || !(amt >= 1 && amt <= 100000)) return Response.json({ error: "bad_input" }, { status: 400 });
  if (store.size > 500) store.clear();
  if (!store.has(b.id)) store.set(b.id, { amt, status: "done", at: Date.now() });
  return Response.json({ status: "done", amt: store.get(b.id)!.amt });
}
