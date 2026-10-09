/* weewx-live — tableaux climatologiques (dossier archive/), données intégrées à la page par
 * weewx (window.WEEWX_CLIMATO) :
 *  - mensuel (climato-AAAA-MM.html, livejson.climato_data) : une ligne par jour
 *    (températures min. / moy. / max., vent moyen et rafale max., secteur dominant, pluie,
 *    humidité, pression) et une ligne de synthèse du mois ; l'icône à gauche du numéro du
 *    jour ouvre la page d'archives de ce jour ;
 *  - annuel (climato-AAAA.html, livejson.climato_year_data) : une ligne par mois dans trois
 *    tableaux (températures et nombres de jours, pluie, vent) et une ligne « Année » ;
 *    l'icône à gauche du mois ouvre le tableau mensuel.
 * Couleurs : températures selon les paliers de 3 °C du site (TempScale.stepColor,
 * minichart.js) ; vent, pluie, humidité et pression selon des échelles propres à ces tableaux. */
(function () {
  "use strict";

  const D = window.WEEWX_CLIMATO;
  const wrap = document.getElementById("cm-wrap");
  const bar = document.getElementById("cm-bar");
  if (!D || !wrap) return;
  const U = D.units || {};

  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v, d = 1) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—");
  const withUnit = (v, u, d) => `${num(v, d)}<span class="u"> ${esc(u || "")}</span>`;
  const SECT = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const sector = (deg) => SECT[Math.round(deg / 45) % 8];
  // méthode de calcul (skin.conf [[archives]] climato_method) : texte de la note des tableaux
  const METHOD = D.method === "omm"
    ? "Méthode OMM (heures UTC) : Tn de la veille 18 h au jour 18 h ; Tx et pluie du jour 6 h au lendemain 6 h ; " +
      "température moyenne : moyenne des 8 relevés trihoraires (0, 3 … 21 h) ; vent, humidité et pression : journée de 0 h à 24 h."
    : "Journées de 0 h à 24 h (heure de la station), d'après les résumés journaliers de weewx.";
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  // ------------------------------------------------------------------
  // Couleurs de fond (avec texte noir ou blanc selon la luminance du fond)
  // ------------------------------------------------------------------
  const rgb = (c) => {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const r = /rgba?\(([^)]+)\)/.exec(c);
    return r ? r[1].split(",").slice(0, 3).map(Number) : null;
  };
  const lum = ([r, g, b]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const fill = (bg) => {
    const c = rgb(bg);
    if (!c) return "";
    return ` style="background:${bg};color:${lum(c) > 0.22 ? "#111" : "#fff"}"`;
  };
  // échelle continue [[valeur, couleur]] -> couleur interpolée
  function ramp(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
    let i = 0; while (v > stops[i + 1][0]) i++;
    const [v0, c0] = stops[i], [v1, c1] = stops[i + 1], f = (v - v0) / (v1 - v0);
    const a = rgb(c0), b = rgb(c1);
    return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",")})`;
  }
  // températures : paliers de 3 °C du site (valeurs converties en °C si besoin)
  const toC = (v) => ((U.tmin || U.temp) === "°F" ? (v - 32) * 5 / 9 : v);
  const tFill = (v) => (window.TempScale && isNum(v) ? fill(TempScale.stepColor(toC(v))) : "");
  // pluie journalière (mm) : vert pâle (faible) -> cyan -> bleu -> violet (forte)
  const RAIN = [[0.1, "#9ef0c0"], [1, "#6ee0b4"], [3, "#5cc8e8"], [6, "#3a8de8"], [10, "#2525e6"], [25, "#3b0aa0"]];
  const rainMm = (v) => (U.rain === "in" ? v * 25.4 : U.rain === "cm" ? v * 10 : v);
  const rFill = (v) => (isNum(v) && rainMm(v) >= 0.1 ? fill(ramp(RAIN, rainMm(v))) : "");
  // humidité moyenne (%) : jaune (sec) -> vert -> cyan (humide)
  const HUM = [[55, "#f5e04a"], [65, "#c9ef4f"], [72, "#8ee65a"], [80, "#7fe6a0"], [86, "#86ecf4"], [95, "#5bbcf2"]];
  const hFill = (v) => (isNum(v) ? fill(ramp(HUM, v)) : "");
  // pression moyenne (hPa) : basse (cyan) -> normale (vert) -> haute (jaune)
  const BARO = [[995, "#5bbcf2"], [1008, "#6fe3cf"], [1015, "#7fe38a"], [1022, "#b9ef5a"], [1032, "#f5e04a"]];
  const pHpa = (v) => (U.baro === "inHg" ? v * 33.8639 : U.baro === "mmHg" ? v * 1.33322 : U.baro === "kPa" ? v * 10 : v);
  const pFill = (v) => (isNum(v) && /hPa|mbar|inHg|mmHg|kPa/.test(U.baro || "") ? fill(ramp(BARO, pHpa(v))) : "");
  // vent : gris d'autant plus soutenu que le vent est fort (relatif au maximum de la colonne)
  const grey = (v, max) => {
    if (!isNum(v) || !max) return "";
    const p = Math.round(4 + 18 * Math.min(1, v / max));
    return ` style="background:color-mix(in oklab, var(--text) ${p}%, var(--surface))"`;
  };
  // pluie mensuelle (mm) : vert pâle -> bleu -> violet
  const RAIN_M = [[5, "#9ef0c0"], [20, "#5cc8e8"], [45, "#3a8de8"], [75, "#2525e6"], [110, "#7a1fd0"], [180, "#3b0a70"]];
  const rmFill = (v) => (isNum(v) && rainMm(v) > 0 ? fill(ramp(RAIN_M, rainMm(v))) : "");

  // ------------------------------------------------------------------
  // Tableau
  // ------------------------------------------------------------------
  const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.5h7l4 4v4.2M15 17.5H4v-15" fill="none"/><path d="M11 2.5v4h4" fill="none"/>' +
    '<circle cx="12.5" cy="13" r="3" fill="none"/><path d="M14.7 15.2l2.8 2.8"/></svg>';
  const cfg = bar ? bar.dataset : {};
  const dayPages = cfg.day === "1";

  function render() { return D.months ? renderYear() : renderMonth(); }

  // ------------------------------------------------------------------
  // Tableaux annuels : températures, pluie, vent (une ligne par mois)
  // ------------------------------------------------------------------
  function renderYear() {
    const M = D.months || [], T = D.total || {}, TH = D.thresholds || {};
    const has = (...ks) => ks.some((k) => M.some((r) => isNum(r[k])) || isNum(T[k]));
    const any = (r) => Object.keys(r).some((k) => k !== "m" && k !== "ym" && isNum(r[k]));
    const ext = (k, f) => { const v = M.map((r) => r[k]).filter(isNum); return v.length ? f(...v) : null; };
    const val = (v, u, d, style, rec) => `<td${style || ""}${rec ? ' class="cm-rec"' : ""}>${isNum(v) ? (u === null ? v : withUnit(v, u, d)) : "—"}</td>`;
    const cnt = (v) => val(v, null);
    const monthCell = (r) => {
      const label = `${MONTHS[r.m - 1]} ${D.year}`;
      return `<th scope="row">${any(r)
        ? `<a class="cm-day" href="climato-${r.ym}.html" title="Climatologie de ${esc(label)}" aria-label="Climatologie de ${esc(label)}">${ICON}<span>${MONTHS[r.m - 1]}</span></a>`
        : `<span class="cm-day"><span class="cm-noicon"></span><span>${MONTHS[r.m - 1]}</span></span>`}</th>`;
    };
    // tableau : groupe d'en-tête, colonnes [titre, cellule(r, total)]
    const table = (title, cols, caption) => `<div class="cm-scroll">
      <table class="cm-table cm-year">
        <caption class="sr">${esc(caption)}</caption>
        <thead><tr><th rowspan="2" scope="col" class="cm-jour">Mois</th><th colspan="${cols.length}" scope="colgroup" class="cm-grp">${title}</th></tr>
          <tr>${cols.map(([h]) => `<th scope="col" class="cm-sub2">${h}</th>`).join("")}</tr></thead>
        <tbody>${M.map((r) => `<tr>${monthCell(r)}${cols.map(([, c]) => c(r, false)).join("")}</tr>`).join("")}</tbody>
        <tfoot><tr><th scope="row" class="cm-tot">Année</th>${cols.map(([, c]) => c(T, true)).join("")}</tr></tfoot>
      </table></div>`;
    const out = [];
    const ut = U.temp, ur = U.rain;

    if (has("tavg", "tmin", "tmax")) {
      const lo = ext("tmin", Math.min), hi = ext("tmax", Math.max);
      const tc = (k, rec) => (r, tot) => val(r[k], ut, 1, tot ? "" : tFill(r[k]), !tot && rec && r[k] === rec);
      out.push(table("Température", [
        ["moy", tc("tavg")], ["moy min", tc("tminAvg")], ["min", tc("tmin", lo)],
        ["moy max", tc("tmaxAvg")], ["max", tc("tmax", hi)],
        [`Jours sans dégel<br><small>(max ≤ ${num(TH.ice)} °C)</small>`, (r) => cnt(r.ice)],
        [`Jours de gel<br><small>(min &lt; ${num(TH.frost)} °C)</small>`, (r) => cnt(r.frost)],
        [`Jours<br><small>(max &gt; ${num(TH.heat)} °C)</small>`, (r) => cnt(r.heat)],
      ], `Températures par mois, ${D.year}`));
    }
    if (has("rain")) {
      const top = ext("rain", Math.max);
      out.push(table("Pluie", [
        ["pluie totale", (r, tot) => val(r.rain, ur, 1, tot ? "" : rmFill(r.rain), !tot && r.rain === top && top > 0)],
        [`jours de pluie<br><small>(≥ ${num(TH.rain)} mm)</small>`, (r) => cnt(r.rainDays)],
        [`jours ≥ ${num(TH.heavy)} mm`, (r) => cnt(r.heavyDays)],
      ], `Pluie par mois, ${D.year}`));
    }
    if (has("wind", "gust")) {
      const mw = ext("windMax", Math.max), mg = ext("gust", Math.max);
      out.push(table("Vent", [
        ["vent moyen", (r) => val(r.wind, U.wind, 1)],
        ["vent moyen max<br><small>(intervalle d'archive)</small>", (r, tot) => val(r.windMax, U.wind, 1, tot ? "" : grey(r.windMax, mw), !tot && r.windMax === mw)],
        ["rafale maximum", (r, tot) => val(r.gust, U.gust, 1, tot ? "" : grey(r.gust, mg), !tot && r.gust === mg)],
      ], `Vent par mois, ${D.year}`));
    }
    wrap.innerHTML = out.length ? `<div class="cm-tables">${out.join("")}</div>
      <p class="cm-note">${esc(METHOD)} En gras : extrêmes de l'année.
      Ligne « Année » : moyennes, extrêmes, cumuls et totaux de l'année.</p>`
      : `<p class="muted">Pas de données pour cette année.</p>`;
  }

  // ------------------------------------------------------------------
  // Tableau mensuel (une ligne par jour)
  // ------------------------------------------------------------------
  function renderMonth() {
    const days = D.days || [];
    const T = D.total || {};
    const has = (k) => days.some((r) => isNum(r[k])) || isNum(T[k]);
    const cols = { temp: has("tmin") || has("tmax"), wind: has("wind") || has("gust"), dir: has("dir"),
                   rain: has("rain"), hum: has("hum"), baro: has("baro") };
    const windMax = Math.max(0, ...days.map((r) => (isNum(r.wind) ? r.wind : 0)));
    const ext = (k, f) => { const v = days.map((r) => r[k]).filter(isNum); return v.length ? f(...v) : null; };
    const lowMin = ext("tmin", Math.min), highMax = ext("tmax", Math.max), topGust = ext("gust", Math.max);
    const [y, m] = ((days[0] && days[0].iso) || "").split("-");
    const mName = m ? `${MONTHS[+m - 1]} ${y}` : "";

    const td = (v, u, d, style, bold) => `<td${style || ""}${bold ? ' class="cm-rec"' : ""}>${isNum(v) ? withUnit(v, u, d) : "—"}</td>`;
    const windCell = (r, total) => {
      const w = isNum(r.wind) ? withUnit(r.wind, U.wind, 1) : "—";
      const g = isNum(r.gust) ? ` (${withUnit(r.gust, U.gust, 1)})` : "";
      const rec = !total && isNum(r.gust) && r.gust === topGust;
      return `<td class="cm-wind${rec ? " cm-rec" : ""}"${total ? "" : grey(r.wind, windMax)}>${w}${g}</td>`;
    };
    const cells = (r, total) => [
      cols.temp ? td(r.tmin, U.tmin, 1, total ? "" : tFill(r.tmin), !total && r.tmin === lowMin) +
                  td(r.tavg, U.tavg, 1, total ? "" : tFill(r.tavg)) +
                  td(r.tmax, U.tmax, 1, total ? "" : tFill(r.tmax), !total && r.tmax === highMax) : "",
      cols.wind ? windCell(r, total) : "",
      cols.dir ? `<td class="cm-dir">${isNum(r.dir) ? sector(r.dir) : "—"}</td>` : "",
      cols.rain ? td(r.rain, U.rain, 1, total ? "" : rFill(r.rain)) : "",
      cols.hum ? td(r.hum, U.hum, 0, total ? "" : hFill(r.hum)) : "",
      cols.baro ? td(r.baro, U.baro, U.baro === "inHg" ? 2 : 1, total ? "" : pFill(r.baro)) : "",
    ].join("");

    const rows = days.map((r) => {
      const empty = !["tmin", "tmax", "wind", "rain", "hum", "baro"].some((k) => isNum(r[k]));
      const link = dayPages && !empty && r.iso >= (cfg.dayFirst || "") && r.iso <= (cfg.today || "9999");
      const label = `${r.d} ${mName}`;
      const day = link
        ? `<a class="cm-day" href="day-${r.iso}.html" title="Archives du ${esc(label)}" aria-label="Archives du ${esc(label)}">${ICON}<span>${r.d}</span></a>`
        : `<span class="cm-day"><span class="cm-noicon"></span><span>${r.d}</span></span>`;
      return `<tr><th scope="row">${day}</th>${cells(r, false)}</tr>`;
    }).join("");

    const head1 = [
      `<th rowspan="2" scope="col" class="cm-jour">Jour</th>`,
      cols.temp ? `<th colspan="3" scope="colgroup" class="cm-grp">Température</th>` : "",
      cols.wind || cols.dir ? `<th colspan="${(cols.wind ? 1 : 0) + (cols.dir ? 1 : 0)}" scope="colgroup" class="cm-grp">Vent</th>` : "",
      cols.rain ? `<th rowspan="2" scope="col">Pluie</th>` : "",
      cols.hum ? `<th rowspan="2" scope="col">Humidité</th>` : "",
      cols.baro ? `<th rowspan="2" scope="col">Pression</th>` : "",
    ].join("");
    const head2 = [
      cols.temp ? `<th scope="col" class="cm-sub2">min</th><th scope="col" class="cm-sub2">moy</th><th scope="col" class="cm-sub2">max</th>` : "",
      cols.wind ? `<th scope="col" class="cm-sub2">Vent moyen (rafale max)</th>` : "",
      cols.dir ? `<th scope="col" class="cm-sub2">Secteur</th>` : "",
    ].join("");

    wrap.innerHTML = days.length ? `
      <table class="cm-table">
        <caption class="sr">Climatologie mensuelle, ${esc(mName)} : valeurs journalières</caption>
        <thead><tr>${head1}</tr><tr>${head2}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th scope="row" class="cm-tot">Mois</th>${cells(T, true)}</tr></tfoot>
      </table>
      <p class="cm-note">${esc(METHOD)} En gras : température la plus basse, la plus haute et rafale la plus forte du mois.
      Ligne « Mois » : minimum, moyenne et maximum du mois, vent moyen (rafale max.), cumul de pluie, humidité et pression moyennes.</p>`
      : `<p class="muted">Pas de données pour ce mois.</p>`;
  }

  // ------------------------------------------------------------------
  // Choix du mois (climato-AAAA-MM.html) ou de l'année (climato-AAAA.html), si couvert par les archives
  // ------------------------------------------------------------------
  if (bar) {
    const msg = document.getElementById("cm-msg");
    bar.addEventListener("submit", async (e) => {
      e.preventDefault();
      const selM = document.getElementById("cm-month");
      const year = !selM;                      // tableau annuel : choix de l'année seule
      const ym = document.getElementById("cm-year").value + (year ? "" : `-${selM.value}`);
      const n = year ? 4 : 7;
      const first = (cfg.first || "").slice(0, n), last = (cfg.today || "").slice(0, n);
      if (ym < first || ym > last) {
        const f = (s) => { if (year) return s; const [a, b] = s.split("-"); return `${MONTHS[+b - 1]} ${a}`; };
        msg.textContent = `Pas de données pour ${year ? "cette année" : "ce mois"} (archives de ${f(first)} à ${f(last)}).`;
        return;
      }
      if (ym === (year ? cfg.y : cfg.ym)) return;
      const url = `climato-${ym}.html`;
      msg.textContent = "";
      try {
        const r = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!r.ok) { msg.textContent = `Page non disponible (${url}).`; return; }
      } catch (err) { /* hors ligne ou HEAD refusé : on tente l'ouverture */ }
      location.href = url;
    });
    bar.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => (msg.textContent = "")));
  }

  render();
  // changement de thème clair / sombre : couleurs des températures recalculées
  const mq = window.matchMedia && matchMedia("(prefers-color-scheme: dark)");
  if (mq && mq.addEventListener) mq.addEventListener("change", render);
})();
