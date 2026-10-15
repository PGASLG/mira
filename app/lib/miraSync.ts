"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

/*
 Keeps every `mira_*` browser setting in sync with the user's row in Supabase (table public.user_settings).
 - Needs Clerk added as a third-party auth provider in Supabase. Until then it quietly stays local.
 - Pull once on load (remote values fill the browser), then push changes every few seconds.
*/
type Cfg = { url: string; publishable_key: string };
export type SyncStatus = "starting" | "synced" | "local-only";

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mira_")) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {}
  return out;
}

const KEEP = ["mira_lang", "mira_theme", "mira_text", "mira_motion"];
const STASH = "mirastash_real";   // real account data parked while the demo is on (no mira_ prefix: never synced or wiped)

// Demo data and a real account must never meet. Leaving the demo wipes it and puts back the real data it parked.
export function leaveDemoIfAny(): boolean {
  try {
    if (localStorage.getItem("mira_demo") !== "1") return false;
    const del: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mira_") && !KEEP.includes(k)) del.push(k);
    }
    del.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(STASH);
    if (raw) {
      const old = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(old)) if (k.startsWith("mira_") && !KEEP.includes(k)) localStorage.setItem(k, v);
      localStorage.removeItem(STASH);
    }
    return true;
  } catch { return false; }
}

function demoOn(): boolean {
  try { return localStorage.getItem("mira_demo") === "1"; } catch { return false; }
}

export function useMiraSync() {
  const { getToken, isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("starting");
  const last = useRef("");
  const dead = useRef(false);

  useEffect(() => {
    if (isSignedIn === false) { setReady(true); setStatus("local-only"); return; }
    if (!isSignedIn) return;
    leaveDemoIfAny();   // signed in = real account: demo sample data must not be read, pushed or shown
    let stop = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function headers(cfg: Cfg) {
      const token = await getToken();
      if (!token) throw new Error("no token");
      return { apikey: cfg.publishable_key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    }

    async function run() {
      let cfg: Cfg;
      try { cfg = await (await fetch("/supabase-config.json", { cache: "no-store" })).json(); }
      catch { setReady(true); setStatus("local-only"); return; }

      // 1) pull
      try {
        const h = await headers(cfg);
        const r = await fetch(`${cfg.url}/rest/v1/user_settings?select=data&limit=1`, { headers: h });
        if (!r.ok) throw new Error(String(r.status));
        const rows = await r.json();
        const remote: Record<string, string> = rows?.[0]?.data || {};
        for (const [k, v] of Object.entries(remote)) {
          if (k.startsWith("mira_") && typeof v === "string") { try { localStorage.setItem(k, v); } catch {} }
        }
        last.current = JSON.stringify(snapshot());
        setStatus("synced");
      } catch {
        dead.current = true; // Supabase not set up for Clerk yet: stay local, do not retry in a loop
        setStatus("local-only");
      }
      if (stop) return;
      setReady(true);

      // 2) push changes
      if (dead.current) return;
      timer = setInterval(async () => {
        if (dead.current || demoOn()) return;
        const snap = JSON.stringify(snapshot());
        if (snap === last.current) return;
        try {
          const h = await headers(cfg);
          const r = await fetch(`${cfg.url}/rest/v1/user_settings?on_conflict=user_id`, {
            method: "POST",
            headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ data: JSON.parse(snap), updated_at: new Date().toISOString() }),
          });
          if (r.ok) { last.current = snap; setStatus("synced"); }
          else if (r.status === 401 || r.status === 403) { dead.current = true; setStatus("local-only"); }
        } catch { /* try again next tick */ }
      }, 4000);
    }

    run();
    return () => { stop = true; if (timer) clearInterval(timer); };
  }, [isSignedIn, getToken]);

  return { ready, status };
}
