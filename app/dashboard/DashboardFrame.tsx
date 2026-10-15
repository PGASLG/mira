"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMiraSync } from "../lib/miraSync";

// Puts the signed-in username where the static dashboard can read it, syncs settings with Supabase,
// then shows the dashboard page. The username never goes into the URL.
export default function DashboardFrame() {
  const { user, isLoaded } = useUser();
  const { ready } = useMiraSync();
  const [named, setNamed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    const name = user?.username || user?.firstName || "";
    try { if (name) localStorage.setItem("mira_name", name); } catch {}
    setNamed(true);
  }, [isLoaded, user]);

  if (!named || !ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f8ff", color: "#0f1f3d", fontFamily: "system-ui, sans-serif" }}>
        กำลังโหลด รอแป๊บนะ...
      </div>
    );
  }
  return (
    <iframe
      src="/dashboard.html"
      title="Mira dashboard"
      style={{ border: 0, width: "100%", height: "100vh", display: "block" }}
    />
  );
}
