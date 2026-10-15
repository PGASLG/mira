/* Mira marketing site (shared): language, sign-in, mobile menu, reveal */
(function () {
  var lang = "th";
  try { lang = localStorage.getItem("mira_lang") || "th"; } catch (e) {}
  function setLang(l) {
    lang = l; document.documentElement.lang = l;
    try { localStorage.setItem("mira_lang", l); } catch (e) {}
    document.querySelectorAll(".s-lang").forEach(function (b) { b.textContent = l === "th" ? "EN" : "\u0E44\u0E17\u0E22"; });
  }
  setLang(lang);
  document.querySelectorAll(".s-lang").forEach(function (b) { b.onclick = function () { setLang(lang === "th" ? "en" : "th"); }; });
  document.querySelectorAll("[data-signin]").forEach(function (b) { b.onclick = function (e) { e.preventDefault(); location.href = "/sign-in"; }; });
  var bg = document.getElementById("s-burger"), mm = document.getElementById("s-mobile");
  if (bg && mm) bg.onclick = function () { mm.classList.toggle("open"); };
  var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }); }, { threshold: .12 });
  document.querySelectorAll(".s-reveal").forEach(function (el) { io.observe(el); });
})();
