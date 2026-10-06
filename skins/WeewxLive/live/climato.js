/* weewx-live — tableau climatologique mensuel (archive/climato-AAAA-MM.html).
 * Données intégrées à la page par weewx (window.WEEWX_CLIMATO, livejson.climato_data) :
 * une ligne par jour (températures min. / moy. / max., vent moyen et rafale max., secteur
 * dominant, pluie, humidité, pression) et une ligne de synthèse du mois.
 * Couleurs : températures selon les paliers de 3 °C du site (TempScale.stepColor,
 * minichart.js) ; vent, pluie, humidité et pression selon des échelles propres à ce tableau.
 * Une icône à gauche du numéro du jour ouvre la page d'archives de ce jour. */
(function () {
  "use strict";

  const D = window.WEEWX_CLIMATO;
  const wrap = document.getElementById("cm-wrap");
  const bar = document.getElementById("cm-bar");
  if (!D || !wrap) return;
  const U = D.units || {};

  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v, d = 1) => v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  const withUnit = (v, u, d) => `${num(v, d)}<span class="u"> ${esc(u || "")}</span>`;
  const SECT = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const sector = (deg) => SECT[Math.round(deg / 45) % 8];
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
  const toC = (v) => (U.tmin === "°F" ? (v - 32) * 5 / 9 : v);
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
  // vent moyen : gris d'autant plus soutenu que le vent est fort (relatif au mois)
  let windMax = 0;
  const wStyle = (v) => {
    if (!isNum(v) || !windMax) return "";
    const p = Math.round(4 + 18 * Math.min(1, v / windMax));
    return ` style="background:color-mix(in oklab, var(--text) ${p}%, var(--surface))"`;
  };

  // ------------------------------------------------------------------
  // Tableau
  // ------------------------------------------------------------------
  const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.5h7l4 4v4.2M15 17.5H4v-15" fill="none"/><path d="M11 2.5v4h4" fill="none"/>' +
    '<circle cx="12.5" cy="13" r="3" fill="none"/><path d="M14.7 15.2l2.8 2.8"/></svg>';
  const cfg = bar ? bar.dataset : {};
  const dayPages = cfg.day === "1";

  function render() {
    const days = D.days || [];
    const T = D.total || {};
    const has = (k) => days.some((r) => isNum(r[k])) || isNum(T[k]);
    const cols = { temp: has("tmin") || has("tmax"), wind: has("wind") || has("gust"), dir: has("dir"),
                   rain: has("rain"), hum: has("hum"), baro: has("baro") };
    windMax = Math.max(0, ...days.map((r) => (isNum(r.wind) ? r.wind : 0)));
    const ext = (k, f) => { const v = days.map((r) => r[k]).filter(isNum); return v.length ? f(...v) : null; };
    const lowMin = ext("tmin", Math.min), highMax = ext("tmax", Math.max), topGust = ext("gust", Math.max);
    const [y, m] = (D.days[0] && D.days[0].iso || "").split("-");
    const mName = m ? `${MONTHS[+m - 1]} ${y}` : "";

    const td = (v, u, d, style, bold) => `<td${style || ""}${bold ? ' class="cm-rec"' : ""}>${isNum(v) ? withUnit(v, u, d) : "—"}</td>`;
    const windCell = (r, total) => {
      const w = isNum(r.wind) ? withUnit(r.wind, U.wind, 1) : "—";
      const g = isNum(r.gust) ? ` (${withUnit(r.gust, U.gust, 1)})` : "";
      const rec = !total && isNum(r.gust) && r.gust === topGust;
      return `<td class="cm-wind${rec ? " cm-rec" : ""}"${total ? "" : wStyle(r.wind)}>${w}${g}</td>`;
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
      <p class="cm-note">En gras : température la plus basse, la plus haute et rafale la plus forte du mois.
      Ligne « Mois » : minimum, moyenne et maximum du mois, vent moyen (rafale max.), cumul de pluie, humidité et pression moyennes.</p>`
      : `<p class="muted">Pas de données pour ce mois.</p>`;
  }

  // ------------------------------------------------------------------
  // Choix du mois : climato-AAAA-MM.html (si le mois est couvert par les archives)
  // ------------------------------------------------------------------
  if (bar) {
    const msg = document.getElementById("cm-msg");
    bar.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ym = `${document.getElementById("cm-year").value}-${document.getElementById("cm-month").value}`;
      const first = (cfg.first || "").slice(0, 7), last = (cfg.today || "").slice(0, 7);
      if (ym < first || ym > last) {
        const f = (s) => { const [a, b] = s.split("-"); return `${MONTHS[+b - 1]} ${a}`; };
        msg.textContent = `Pas de données pour ce mois (archives de ${f(first)} à ${f(last)}).`;
        return;
      }
      if (ym === cfg.ym) return;
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
