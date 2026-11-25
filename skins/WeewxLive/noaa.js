/* weewx-live — page « Climatologie → Rapports NOAA » (noaa.html) : choix de l'année et du mois
 * (ou de l'année entière), affichage du rapport texte NOAA/NOAA-AAAA-MM.txt ou
 * NOAA/NOAA-AAAA.txt (générés par weewx, livejson.py) et lien de téléchargement.
 * Période proposée : window.WX_NOAA { first, last } (« AAAA-MM »). Choix dans l'adresse :
 * noaa.html#2026-11 (mois) ou noaa.html#2026 (année). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const tn = WXL.ctx("NOAA");
  const R = window.WX_NOAA || {};
  const now = WXT.ymd(WXT.now()).slice(0, 7);
  const [fy, fm] = (/^\d{4}-\d{2}$/.test(R.first) ? R.first : now).split("-").map(Number);
  const [ly, lm] = (/^\d{4}-\d{2}$/.test(R.last) ? R.last : now).split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const year = $("noaa-year"), month = $("noaa-month");

  for (let y = ly; y >= fy; y--) year.add(new Option(String(y), String(y)));

  // mois disponibles de l'année choisie, puis « Année entière »
  function months(y, keep) {
    const m0 = y === fy ? fm : 1, m1 = y === ly ? lm : 12;
    month.innerHTML = "";
    month.add(new Option(tn("Whole year"), ""));
    for (let m = m0; m <= m1; m++) month.add(new Option(cap(WXL.months[m - 1]), pad(m)));
    if (keep !== undefined && [...month.options].some((o) => o.value === keep)) month.value = keep;
  }

  let seq = 0;
  async function show() {
    const y = year.value, m = month.value;
    const file = `NOAA/NOAA-${y}${m ? "-" + m : ""}.txt`;
    history.replaceState(null, "", "#" + y + (m ? "-" + m : ""));
    $("noaa-dl").href = file;
    $("noaa-dl").setAttribute("download", file.slice(5));
    const id = ++seq, msg = $("noaa-msg"), pre = $("noaa-text");
    msg.textContent = WXL.t("Common", "Loading…");
    msg.hidden = false;
    try {
      const r = await fetch(file + "?_=" + Math.floor(Date.now() / 300000), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = await r.text();
      if (id !== seq) return;
      pre.textContent = txt;
      pre.hidden = false;
      msg.hidden = true;
    } catch (e) {
      if (id !== seq) return;
      pre.hidden = true;
      msg.textContent = tn("Report not available ({file}).", { file });
    }
  }

  // choix d'après l'adresse (#AAAA-MM ou #AAAA), sinon le mois en cours (dernier disponible)
  function fromHash() {
    const h = /^#(\d{4})(?:-(\d{2}))?$/.exec(location.hash);
    const y0 = h && +h[1] >= fy && +h[1] <= ly ? h[1] : String(ly);
    year.value = y0;
    months(+y0, h && h[1] === y0 ? (h[2] || "") : pad(lm));
    show();
  }
  year.addEventListener("change", () => { months(+year.value, month.value); show(); });
  month.addEventListener("change", show);
  window.addEventListener("hashchange", fromHash);    // lien vers un autre rapport, même page
  fromHash();
})();
