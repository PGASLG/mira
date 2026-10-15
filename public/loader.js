/* Mira loading screen. Shows until the page has loaded (min 450ms).
   Also usable by pages:  MiraLoading.show("กำลังเชื่อมต่อ June...")  /  MiraLoading.hide()  */
(function () {
  // tab icon: Mira circle logo (static pages have no <link rel=icon>)
  document.querySelectorAll("link[rel~=icon]").forEach(function (l) { l.remove(); });
  var ic = document.createElement("link"); ic.rel = "icon"; ic.href = "/icon.png"; document.head.appendChild(ic);
  // user appearance settings (theme, text size, motion)
  var ap = document.createElement("script"); ap.src = "appearance.js"; document.head.appendChild(ap);
  // shared design system: fonts + mira.css (flat, editorial look)
  var ff = document.createElement("link"); ff.rel = "stylesheet";
  ff.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Noto+Serif+Thai:wght@500;600&display=swap";
  document.head.appendChild(ff);
  var mc = document.createElement("link"); mc.rel = "stylesheet"; mc.href = "/mira.css"; document.head.appendChild(mc);
  var css = document.createElement("style");
  css.textContent =
    "#mira-load{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;" +
    "background:#f7f6f2;color:#0e1b33;font:500 15px/1.5 Prompt,system-ui,sans-serif;transition:opacity .35s,visibility .35s}" +
    "@media (prefers-color-scheme:dark){#mira-load{background:#0d1424;color:#f1efe8}}" +
    "#mira-load.off{opacity:0;visibility:hidden}" +
    "#mira-load img{height:64px;width:auto;animation:ml-float 1.6s ease-in-out infinite}" +
    "#mira-load .dots{display:flex;gap:8px}" +
    "#mira-load .dots i{width:10px;height:10px;border-radius:50%;background:#1e7bff;animation:ml-b 1s infinite ease-in-out}" +
    "#mira-load .dots i:nth-child(2){animation-delay:.15s;background:#4cc9ff}" +
    "#mira-load .dots i:nth-child(3){animation-delay:.3s;background:#fdb913}" +
    "@keyframes ml-b{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}" +
    "@keyframes ml-float{50%{transform:translateY(-8px)}}" +
    "@media (prefers-reduced-motion:reduce){#mira-load *{animation:none!important}}";
  document.head.appendChild(css);

  var el = document.createElement("div");
  el.id = "mira-load";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = '<img src="assets/logo-h.png" alt="Mira"><div class="dots"><i></i><i></i><i></i></div><div id="mira-load-msg"></div>';
  document.documentElement.appendChild(el);

  var msg = el.querySelector("#mira-load-msg");
  var lang = "th";
  try { lang = localStorage.getItem("mira_lang") || "th"; } catch (e) {}
  var DEFAULT = lang === "th" ? "กำลังโหลด รอแป๊บนะ..." : "Loading, one moment...";
  msg.textContent = DEFAULT;


  // Back button: always top-left, easy to find, on inner screens only
  function addBack() {
    var f = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var inner = ["investment.html", "track.html", "june.html", "lending.html", "lender.html", "pay.html", "evidence.html"];
    if (inner.indexOf(f) === -1) return;
    var logoImg = document.querySelector('nav img[src*="logo"], header img[src*="logo"], .st-nav img');
    var logo = logoImg ? logoImg.closest("a") : null;
    if (!logo || document.querySelector(".m-back")) return;
    var lg = "th"; try { lg = localStorage.getItem("mira_lang") || "th"; } catch (e) {}
    var a = document.createElement("a");
    a.className = "m-back"; a.href = "/dashboard.html"; a.setAttribute("aria-label", "Back");
    a.innerHTML = "<span aria-hidden='true'>←</span> <span>" + (lg === "en" ? "Back" : "กลับ") + "</span>";
    var wrap = document.createElement("div");
    wrap.className = "m-backwrap";
    logo.parentNode.insertBefore(wrap, logo);
    wrap.appendChild(a); wrap.appendChild(logo);
    // hide the page's own right-side back links so there is only one
    document.querySelectorAll("a,button").forEach(function (el) {
      if (el === a) return;
      var t = (el.textContent || "").trim();
      if (t.charAt(0) === "←") el.style.display = "none";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBack); else addBack();


  // Demo account banner: sample data, one per device, wiped when you leave
  function demoBar() {
    var on = ""; try { on = localStorage.getItem("mira_demo") || ""; } catch (e) {}
    if (on !== "1" || document.getElementById("mira-demo-bar")) return;
    var lg = "th"; try { lg = localStorage.getItem("mira_lang") || "th"; } catch (e) {}
    var bar = document.createElement("div");
    bar.id = "mira-demo-bar";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99990;background:#0e1b33;color:#f7f6f2;font:600 14px/1.4 'IBM Plex Sans Thai',system-ui,sans-serif;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap";
    var txt = document.createElement("span");
    txt.textContent = lg === "en" ? "Demo account: sample money, stays on this device only. Leaving wipes it." : "บัญชีทดลอง: เงินตัวอย่าง อยู่ในเครื่องนี้เท่านั้น ออกแล้วข้อมูลหายทั้งหมด";
    var b = document.createElement("button");
    b.textContent = lg === "en" ? "Leave demo" : "ออกจากโหมดทดลอง";
    b.style.cssText = "border:1px solid #f2b01e;background:#f2b01e;color:#0e1b33;border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer";
    b.onclick = function () {
      try {
        var keep = ["mira_lang", "mira_theme", "mira_text", "mira_motion"], del = [];
        for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("mira_") === 0 && keep.indexOf(k) < 0) del.push(k); }
        del.forEach(function (k) { localStorage.removeItem(k); });
        var raw = localStorage.getItem("mirastash_real");   // give back the real data parked when the demo began
        if (raw) { var old = JSON.parse(raw); Object.keys(old).forEach(function (k) { if (k.indexOf("mira_") === 0 && keep.indexOf(k) < 0) localStorage.setItem(k, old[k]); }); localStorage.removeItem("mirastash_real"); }
      } catch (e) {}
      top.location.href = "/";
    };
    bar.appendChild(txt); bar.appendChild(b); document.body.appendChild(bar);
    document.body.style.paddingBottom = "56px";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demoBar); else demoBar();

  var started = Date.now(), pending = 1; // 1 = page load itself
  function maybeHide() {
    if (pending > 0) return;
    var wait = Math.max(0, 450 - (Date.now() - started));
    setTimeout(function () { if (pending <= 0) el.classList.add("off"); }, wait);
  }
  window.MiraLoading = {
    show: function (text) { pending++; msg.textContent = text || DEFAULT; el.classList.remove("off"); },
    hide: function () { pending = Math.max(0, pending - 1); maybeHide(); }
  };
  function pageDone() { pending = Math.max(0, pending - 1); maybeHide(); }
  if (document.readyState === "complete") pageDone(); else window.addEventListener("load", pageDone);
  // never trap the user: give up after 8s
  setTimeout(function () { pending = 0; el.classList.add("off"); }, 8000);
})();
