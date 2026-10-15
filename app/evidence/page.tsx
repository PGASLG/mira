import { auth } from "@clerk/nextjs/server";

// Signed-in users only. The page itself is a static file served from /public.
export default async function Evidence() {
  await auth.protect();
  return (
    <iframe
      src="/evidence.html"
      title="Mira: assets, spread, risk"
      style={{ border: 0, width: "100%", height: "100vh", display: "block" }}
    />
  );
}
