/* Mira appearance settings. Applies the user's choices on every page.
   Keys: mira_theme = auto | light | dark   mira_text = s | m | l   mira_motion = reduce | "" */
(function () {
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  // Pages only know "dark if the system is dark". To force light/dark, rewrite those media rules.
  function patchSheets(theme) {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try { rules = sheets[i].cssRules; } catch (e) { continue; } // cross-origin sheet
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (r.type !== 4 || !r.media) continue; // CSSMediaRule
        var text = r.media.mediaText || "";
        if (r.__miraOrig === undefined) {
          if (text.indexOf("prefers-color-scheme") === -1 || text.indexOf("dark") === -1) continue;
          r.__miraOrig = text;
        }
        r.media.mediaText = theme === "dark" ? "all" : theme === "light" ? "not all" : r.__miraOrig;
      }
    }
  }

  function apply() {
    var theme = get("mira_theme", "auto");
    var size = get("mira_text", "m");
    var motion = get("mira_motion", "");
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme === "auto" ? "light dark" : theme;
    patchSheets(theme);

    var zoom = size === "s" ? 0.92 : size === "l" ? 1.14 : 1;
    if (document.body) document.body.style.zoom = zoom === 1 ? "" : String(zoom);

    var id = "mira-motion-style", el = document.getElementById(id);
    if (motion === "reduce") {
      if (!el) {
        el = document.createElement("style"); el.id = id;
        el.textContent = "*,*::before,*::after{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important;scroll-behavior:auto!important}";
        document.head.appendChild(el);
      }
    } else if (el) { el.remove(); }
  }

  window.MiraAppearance = { apply: apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  window.addEventListener("load", apply);
  window.addEventListener("storage", apply);
})();
