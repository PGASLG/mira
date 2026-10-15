"use client";

import { useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

type Lang = "th" | "en";
type Theme = "auto" | "light" | "dark";
type Size = "s" | "m" | "l";

declare global {
  interface Window { MiraAppearance?: { apply: () => void } }
}

const TXT = {
  th: {
    title: "ตั้งค่า",
    back: "← หน้าหลัก",
    edit: "จัดการบัญชี",
    editHint: "เปลี่ยนรหัสผ่าน อีเมล ชื่อผู้ใช้ ดูอุปกรณ์ที่เข้าสู่ระบบ",
    noName: "ผู้ใช้ Mira",
    appH: "การแสดงผล",
    appS: "ปรับหน้าตาให้สบายตา ใช้กับทุกหน้าของ Mira",
    theme: "โหมดสี",
    themeOpt: { auto: "ตามเครื่อง", light: "สว่าง", dark: "มืด" },
    size: "ขนาดตัวอักษร",
    sizeOpt: { s: "เล็ก", m: "ปกติ", l: "ใหญ่" },
    motion: "ลดการเคลื่อนไหว",
    motionHint: "ปิดแอนิเมชันเพื่อให้อ่านง่ายและประหยัดแบตเตอรี่",
    langH: "ภาษา",
    saved: "บันทึกแล้ว",
    privH: "ความเป็นส่วนตัวและข้อมูลของคุณ (PDPA)",
    privS: "เราเก็บอะไร เก็บที่ไหน และคุณทำอะไรกับข้อมูลได้บ้าง",
    where: "ข้อมูลของคุณอยู่ที่ไหน",
    rows: [
      ["บัญชีเข้าสู่ระบบ", "อีเมล ชื่อผู้ใช้ รหัสผ่าน ดูแลโดย Clerk (ผู้ให้บริการยืนยันตัวตน)"],
      ["การตั้งค่าและแผนของคุณ", "เก็บในเบราว์เซอร์ของคุณ ไม่ได้ส่งขึ้นเซิร์ฟเวอร์ของเรา"],
      ["การคุยกับ June", "ข้อความหรือเสียงที่คุยกับ June ถูกประมวลผลโดย ElevenLabs เพื่อตอบคุณ"],
      ["ข้อมูลเงินจริง", "ตอนนี้ Mira เป็นพอร์ตจำลอง ไม่เก็บเลขบัญชีธนาคารหรือบัตร"],
    ],
    consentH: "ความยินยอม",
    consentJune: "ให้ June ใช้ข้อมูลแผนของฉันเพื่อตอบให้ตรงกับฉัน",
    consentHint: "ถ้าปิด June จะไม่เห็นตัวเลขแผนของคุณ และตอบได้แค่เรื่องทั่วไป",
    rightsH: "สิทธิ์ของคุณตาม PDPA",
    rights: ["ขอดูและขอสำเนาข้อมูลของคุณ", "แก้ไขข้อมูลให้ถูกต้อง", "ขอลบข้อมูลหรือลบบัญชี", "ถอนความยินยอมได้ทุกเมื่อ", "คัดค้านหรือจำกัดการใช้ข้อมูล"],
    dl: "ดาวน์โหลดข้อมูลของฉัน",
    dlHint: "ไฟล์ JSON ข้อมูลบัญชีเบื้องต้น และข้อมูลในเบราว์เซอร์นี้",
    clear: "ลบข้อมูลที่เก็บในเบราว์เซอร์นี้",
    clearAsk: "ลบข้อมูลที่เก็บในเบราว์เซอร์นี้ทั้งหมดใช่ไหม? (ภาษาและการแสดงผลจะคงไว้) ย้อนกลับไม่ได้",
    cleared: "ลบข้อมูลแล้ว",
    delH: "ลบบัญชี",
    delS: "ลบบัญชีและข้อมูลที่ผูกกับบัญชีถาวร ย้อนกลับไม่ได้ (กดจัดการบัญชี แล้วเลือก Delete account)",
    delBtn: "ไปหน้าลบบัญชี",
    out: "ออกจากระบบ",
    note: "หน้านี้เป็นร่างเพื่อการสาธิต ควรให้ฝ่ายกฎหมายตรวจนโยบายความเป็นส่วนตัวก่อนใช้งานจริง ช่องทางติดต่อผู้ดูแลข้อมูล: (ทีม Mira จะระบุ)",
  },
  en: {
    title: "Settings",
    back: "← Home",
    edit: "Manage account",
    editHint: "Change password, email, username, see signed-in devices",
    noName: "Mira user",
    appH: "Appearance",
    appS: "Make Mira comfortable to look at. Applies to every page.",
    theme: "Colour mode",
    themeOpt: { auto: "Match device", light: "Light", dark: "Dark" },
    size: "Text size",
    sizeOpt: { s: "Small", m: "Normal", l: "Large" },
    motion: "Reduce motion",
    motionHint: "Turn off animations for easier reading and less battery use.",
    langH: "Language",
    saved: "Saved",
    privH: "Privacy and your data (PDPA)",
    privS: "What we keep, where, and what you can do with it",
    where: "Where your data lives",
    rows: [
      ["Sign-in account", "Email, username and password are managed by Clerk (the sign-in provider)."],
      ["Your settings and plan", "Kept in your browser, not on our server."],
      ["Chats with June", "What you type or say to June is processed by ElevenLabs to answer you."],
      ["Real money data", "Mira is a paper portfolio for now. No bank account or card numbers are stored."],
    ],
    consentH: "Consent",
    consentJune: "Let June use my plan data to answer for me",
    consentHint: "If off, June cannot see your plan numbers and can only answer in general.",
    rightsH: "Your rights under PDPA",
    rights: ["See and get a copy of your data", "Correct data that is wrong", "Ask to delete your data or account", "Withdraw consent at any time", "Object to or limit how data is used"],
    dl: "Download my data",
    dlHint: "A JSON file with basic account info and the data kept in this browser.",
    clear: "Delete data kept in this browser",
    clearAsk: "Delete all data kept in this browser? (Language and appearance are kept.) This cannot be undone.",
    cleared: "Data deleted",
    delH: "Delete account",
    delS: "Delete your account and linked data for good. This cannot be undone (open Manage account, then Delete account).",
    delBtn: "Go to delete account",
    out: "Sign out",
    note: "This page is a demo draft. Have a lawyer review the privacy policy before real use. Data controller contact: (Mira team to fill in).",
  },
};

const css = `
:root{--blue:#1e7bff;--navy:#0b3a93;--cyan:#4cc9ff;--yellow:#fdb913;--sky:#e8f2ff;--bg:#f4f8ff;--card:#fff;--ink:#0f1f3d;--mute:#5b6b88;--line:#dbe5f5;--green:#12a15c;--red:#c43d3d}
@media (prefers-color-scheme:dark){:root{--bg:#0a1226;--card:#121c36;--ink:#eaf1ff;--mute:#9fb0d0;--line:#24345a;--sky:#14264d;--green:#4cd790;--red:#ff8585}}
*{box-sizing:border-box}
.st{min-height:100vh;background:var(--bg);color:var(--ink);font:16px/1.65 "Prompt",system-ui,sans-serif;position:relative;overflow-x:hidden}
.st-glow{position:fixed;inset:-20% -10% auto -10%;height:60vh;pointer-events:none;background:radial-gradient(60% 60% at 25% 20%,rgba(30,123,255,.16),transparent 70%),radial-gradient(50% 50% at 85% 10%,rgba(253,185,19,.12),transparent 70%)}
.st-in{position:relative;max-width:560px;margin:0 auto;padding:0 20px 64px}
.st-nav{display:flex;align-items:center;justify-content:space-between;padding:14px 0;gap:8px}
.st-nav img{height:38px;width:auto;display:block}
.st-pill{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
h1.st-h{font-family:"Mali","Prompt",cursive;font-size:clamp(28px,7vw,38px);margin:8px 0 16px}
.st-card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:18px;margin-bottom:14px}
.st-card h2{font-size:17px;margin:0 0 2px}
.st-sub{color:var(--mute);font-size:14px;margin:0 0 12px}
.st-me{display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:center}
.st-av{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;display:grid;place-items:center;font-weight:700;font-size:26px;overflow:hidden}
.st-av img{width:100%;height:100%;object-fit:cover}
.st-me b{display:block;font-size:19px;line-height:1.3}
.st-me span{color:var(--mute);font-size:14.5px;word-break:break-all}
.st-btn{border:0;border-radius:999px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer}
.st-btn.p{background:linear-gradient(135deg,var(--blue),#0f5bd8);color:#fff;box-shadow:0 8px 22px rgba(30,123,255,.28)}
.st-btn.o{background:var(--card);color:var(--blue);border:1.5px solid var(--blue)}
.st-btn.d{background:transparent;color:var(--red);border:1.5px solid var(--red)}
.st-btn.w{width:100%;margin-top:14px}
.st-hint{color:var(--mute);font-size:13.5px;margin:8px 0 0}
.st-l{display:block;font-size:13px;font-weight:600;color:var(--mute);margin:14px 0 6px}
.st-seg{display:flex;gap:8px}
.st-seg button{flex:1;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:14px;padding:10px 6px;font:inherit;font-weight:600;font-size:14.5px;cursor:pointer}
.st-seg button.on{background:var(--blue);border-color:var(--blue);color:#fff}
.st-sw{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:16px}
.st-sw b{display:block}
.st-sw .st-hint{margin:0}
.st-tg{position:relative;width:52px;height:30px;flex:none;border-radius:99px;border:0;background:var(--line);cursor:pointer;transition:.2s}
.st-tg::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.st-tg.on{background:var(--blue)}
.st-tg.on::after{left:25px}
details.st-d{border-top:1px solid var(--line);padding:12px 0}
details.st-d:first-of-type{border-top:0}
details.st-d summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between}
details.st-d summary::after{content:"\\203A";color:var(--mute);transition:transform .2s}
details.st-d[open] summary::after{transform:rotate(90deg)}
details.st-d summary::-webkit-details-marker{display:none}
.st-row{padding:8px 0;border-top:1px solid var(--line);font-size:14.5px}
.st-row:first-child{border-top:0}
.st-row b{display:block}
.st-row span{color:var(--mute)}
.st-ul{margin:6px 0 0;padding-left:20px;font-size:14.5px}
.st-note{font-size:12.5px;color:var(--mute);background:var(--sky);border-radius:14px;padding:10px 14px}
.st-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,30px);opacity:0;background:var(--navy);color:#fff;padding:11px 18px;border-radius:14px;font-weight:600;font-size:14px;transition:.3s;z-index:9}
.st-toast.show{opacity:1;transform:translate(-50%,0)}
@media (min-width:1000px){
  .st-in{max-width:1080px;padding:0 40px 72px}
  .st-cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}
  .st-nav img{height:46px}
}
`;

function read(k: string, d: string) {
  try { return localStorage.getItem(k) || d; } catch { return d; }
}

export default function SettingsClient() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [lang, setLang] = useState<Lang>("th");
  const [theme, setTheme] = useState<Theme>("auto");
  const [size, setSize] = useState<Size>("m");
  const [reduce, setReduce] = useState(false);
  const [consent, setConsent] = useState(true);
  const [toast, setToast] = useState("");

  // load /appearance.js once (it is the same code every Mira page uses)
  useEffect(() => {
    const l = read("mira_lang", "th");
    if (l === "en" || l === "th") setLang(l);
    setTheme(read("mira_theme", "auto") as Theme);
    setSize(read("mira_text", "m") as Size);
    setReduce(read("mira_motion", "") === "reduce");
    setConsent(read("mira_consent_june", "1") !== "0");
    const s = document.createElement("script");
    s.src = "/appearance.js";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const t = TXT[lang];
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1600); };
  const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
  const apply = () => window.MiraAppearance?.apply();

  function onTheme(v: Theme) { setTheme(v); put("mira_theme", v); apply(); say(t.saved); }
  function onSize(v: Size) { setSize(v); put("mira_text", v); apply(); say(t.saved); }
  function onMotion() { const v = !reduce; setReduce(v); put("mira_motion", v ? "reduce" : ""); apply(); say(t.saved); }
  function onLang(l: Lang) { setLang(l); put("mira_lang", l); }
  function onConsent(v: boolean) { setConsent(v); put("mira_consent_june", v ? "1" : "0"); say(t.saved); }

  function mine() {
    const out: Record<string, string | null> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mira_")) out[k] = localStorage.getItem(k);
      }
    } catch {}
    return out;
  }
  function download() {
    const data = {
      exported_at: new Date().toISOString(),
      account: user ? { username: user.username, email: user.primaryEmailAddress?.emailAddress ?? null, created_at: user.createdAt } : null,
      data_in_this_browser: mine(),
      note: "Paper portfolio. No real money data is stored.",
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "mira-my-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function clearData() {
    if (!window.confirm(t.clearAsk)) return;
    const keep = ["mira_lang", "mira_theme", "mira_text", "mira_motion"];
    try { Object.keys(mine()).filter((k) => !keep.includes(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
    setConsent(true);
    say(t.cleared);
  }

  const display = user?.username || user?.firstName || t.noName;
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const initial = (display || "M").slice(0, 1).toUpperCase();

  return (
    <div className="st">
      <style>{css}</style>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&family=Mali:wght@600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Noto+Serif+Thai:wght@500;600&display=swap" rel="stylesheet" />
      <link href="/mira.css" rel="stylesheet" />
      <div className="st-glow" aria-hidden="true" />
      <div className="st-in">
        <div className="st-nav">
          <div className="m-backwrap">
            <a className="m-back" href="/dashboard" aria-label="Back"><span aria-hidden="true">←</span> <span>{lang === "en" ? "Back" : "กลับ"}</span></a>
            <a href="/dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo-h.png" alt="Mira" />
            </a>
          </div>
        </div>

        <h1 className="st-h">{t.title}</h1>

        <div className="st-cols">
          <div>
            <section className="st-card">
              <div className="st-me">
                <div className="st-av">
                  {user?.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={user.imageUrl} alt="" /> : initial}
                </div>
                <div><b>{display}</b><span>{email}</span></div>
              </div>
              <button className="st-btn p w" onClick={() => openUserProfile()}>{t.edit}</button>
              <p className="st-hint">{t.editHint}</p>
            </section>

            <section className="st-card">
              <h2>{t.appH}</h2>
              <p className="st-sub">{t.appS}</p>

              <span className="st-l">{t.theme}</span>
              <div className="st-seg">
                {(["auto", "light", "dark"] as Theme[]).map((v) => (
                  <button key={v} className={theme === v ? "on" : ""} onClick={() => onTheme(v)}>{t.themeOpt[v]}</button>
                ))}
              </div>

              <span className="st-l">{t.size}</span>
              <div className="st-seg">
                {(["s", "m", "l"] as Size[]).map((v) => (
                  <button key={v} className={size === v ? "on" : ""} onClick={() => onSize(v)}>{t.sizeOpt[v]}</button>
                ))}
              </div>

              <div className="st-sw">
                <div><b>{t.motion}</b><p className="st-hint">{t.motionHint}</p></div>
                <button className={"st-tg" + (reduce ? " on" : "")} role="switch" aria-checked={reduce} aria-label={t.motion} onClick={onMotion} />
              </div>

              <span className="st-l">{t.langH}</span>
              <div className="st-seg">
                <button className={lang === "th" ? "on" : ""} onClick={() => onLang("th")}>ไทย</button>
                <button className={lang === "en" ? "on" : ""} onClick={() => onLang("en")}>English</button>
              </div>
            </section>
          </div>

          <div>
            <section className="st-card">
              <h2>{t.privH}</h2>
              <p className="st-sub">{t.privS}</p>

              <details className="st-d" open>
                <summary>{t.where}</summary>
                <div style={{ marginTop: 8 }}>
                  {t.rows.map(([a, b]) => <div className="st-row" key={a}><b>{a}</b><span>{b}</span></div>)}
                </div>
              </details>

              <details className="st-d">
                <summary>{t.consentH}</summary>
                <div className="st-sw">
                  <div><b>{t.consentJune}</b><p className="st-hint">{t.consentHint}</p></div>
                  <button className={"st-tg" + (consent ? " on" : "")} role="switch" aria-checked={consent} aria-label={t.consentJune} onClick={() => onConsent(!consent)} />
                </div>
              </details>

              <details className="st-d">
                <summary>{t.rightsH}</summary>
                <ul className="st-ul">{t.rights.map((r) => <li key={r}>{r}</li>)}</ul>
              </details>

              <button className="st-btn p w" onClick={download}>{t.dl}</button>
              <p className="st-hint">{t.dlHint}</p>
              <button className="st-btn d w" onClick={clearData}>{t.clear}</button>
            </section>

            <section className="st-card">
              <h2>{t.delH}</h2>
              <p className="st-sub">{t.delS}</p>
              <button className="st-btn d w" onClick={() => openUserProfile()}>{t.delBtn}</button>
            </section>

            <button className="st-btn o w" style={{ marginBottom: 14 }} onClick={() => signOut({ redirectUrl: "/" })}>{t.out}</button>
            <p className="st-note">{t.note}</p>
          </div>
        </div>
      </div>
      <div className={"st-toast" + (toast ? " show" : "")} role="status">{toast}</div>
    </div>
  );
}
