// Card / PayPal / other methods go to Stripe Checkout. Needs STRIPE_SECRET_KEY (use a sk_test_ key: Mira is a paper portfolio).
// Without the key the page falls back to the demo screen.
const okId = (s: unknown) => typeof s === "string" && /^[a-z0-9]{6,40}$/.test(s);
const stripe = (path: string, key: string, body?: URLSearchParams) =>
  fetch("https://api.stripe.com/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + key, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
  });

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ demo: true });
  const b = await req.json().catch(() => ({}));
  const amt = Math.round(Number(b.amt));
  if (!okId(b.id) || !(amt >= 5 && amt <= 100000)) return Response.json({ error: "bad_input" }, { status: 400 });
  if (amt < 10) return Response.json({ error: "below_stripe_min" }, { status: 400 }); // Stripe's THB minimum is 10.00
  const origin = new URL(req.url).origin;
  const p = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "thb",
    "line_items[0][price_data][product_data][name]": "Mira paper top-up (demo)",
    "line_items[0][price_data][unit_amount]": String(amt * 100),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/pay.html?m=card&id=${b.id}&amt=${amt}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard`,
  });
  const r = await stripe("checkout/sessions", key, p);
  const j = await r.json();
  if (!r.ok || !j.url) return Response.json({ error: "stripe_error" }, { status: 502 });
  return Response.json({ url: j.url });
}

export async function GET(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const sid = new URL(req.url).searchParams.get("session_id") || "";
  if (!key || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return Response.json({ paid: false }, { status: 400 });
  const r = await stripe("checkout/sessions/" + sid, key);
  const j = await r.json();
  return Response.json({ paid: j.payment_status === "paid" });
}
