// OCR proxy for June: reads text from an image with Typhoon OCR (OpenAI-compatible server) and returns plain text.
// The key never reaches the browser. Set these in the Vercel project (Production):
//   TYPHOON_OCR_URL   e.g. https://<your-host>/v1
//   TYPHOON_OCR_KEY   the server's API key
//   TYPHOON_OCR_MODEL optional, defaults to "typhoon-ocr"
// Nothing is stored or logged: the image is sent to your own OCR server and the text comes back.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DATA_URL = 4_000_000;                       // Vercel request bodies stop at ~4.5 MB; the page shrinks images before sending
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const PROMPT = "Extract all text from this image exactly as written (Thai and English). Keep the reading order, one line per row, tables as plain lines. Return plain text only, no commentary.";

// best-effort per-instance rate limit (the OCR box is yours: stop a stranger from running it hot)
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), win = 10 * 60_000, max = 20;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < win)) hits.delete(k);
  return list.length > max;
}

export async function POST(req: Request) {
  const base = process.env.TYPHOON_OCR_URL, key = process.env.TYPHOON_OCR_KEY;
  if (!base || !key) return Response.json({ error: "not_configured" }, { status: 503 });

  // same-origin only: the browser sends Origin on POST
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "forbidden" }, { status: 403 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const b = await req.json().catch(() => null);
  const image = b && typeof b.image === "string" ? b.image : "";
  if (!image || image.length > MAX_DATA_URL || !DATA_URL.test(image)) return Response.json({ error: "bad_image" }, { status: 400 });

  try {
    const r = await fetch(base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.TYPHOON_OCR_MODEL || "typhoon-ocr",
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image } }] }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!r.ok) return Response.json({ error: "ocr_failed" }, { status: 502 });
    const j = await r.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim().slice(0, 8000);
    return Response.json({ text });
  } catch {
    return Response.json({ error: "ocr_unreachable" }, { status: 502 });
  }
}
