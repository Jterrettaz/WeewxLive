/* weewx-live — « Soleil et Lune » (tableau de bord) : lever / coucher du soleil et de la
 * lune, durée du jour et écart avec la veille, phase de la lune, graphique de la hauteur du
 * soleil et de la lune sur la journée avec leur position actuelle.
 * Calculs : almanach de weewx (PyEphem), publiés dans data/astro.json à chaque archive
 * (hauteurs et azimuts toutes les 10 min ; position actuelle interpolée). Page « jour » :
 * données de la journée intégrées à la page (window.WEEWX_DAY.astro). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const card = $("astro-card");
  if (!card) return;
  const section = card.closest("section");
  const REFRESH = 5 * 60 * 1000;      // relecture de data/astro.json

  // ------------------------------------------------------------------
  // Formatage
  // ------------------------------------------------------------------
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const hm = (t) => (isNum(t) ? new Date(t * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");
  const dur = (s) => { const m = Math.round(s / 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`; };
  const delta = (s) => {
    const a = Math.round(Math.abs(s)), m = Math.floor(a / 60), sec = a % 60;
    const sign = s > 0.5 ? "+" : s < -0.5 ? "−" : "±";
    return `${sign}${m ? `${m} min ${String(sec).padStart(2, "0")} s` : `${sec} s`}`;
  };
  const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const dirName = (az) => DIRS[Math.round(az / 22.5) % 16];
  const deg = (v) => `${Math.round(v)}°`.replace("-", "−");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Lune dessinée selon sa phase : disque sombre + partie éclairée (terminateur elliptique) ;
  // index weewx 0 à 7 (0 nouvelle lune, 1 à 3 croissante, 4 pleine, 5 à 7 décroissante),
  // éclairée à droite quand elle croît (hémisphère nord), à gauche sinon
  function moonIcon(index, fullness, south) {
    const r = 15, f = Math.min(1, Math.max(0, fullness / 100));
    let right = index < 4;
    if (south) right = !right;
    const rx = Math.abs(1 - 2 * f) * r;
    const sweepOuter = right ? 1 : 0;
    const sweepTerm = f > 0.5 ? sweepOuter : 1 - sweepOuter;
    const lit = f < 0.01 ? "" : f > 0.99
      ? `<circle r="${r}" class="moon-lit"/>`
      : `<path class="moon-lit" d="M0 ${-r} A${r} ${r} 0 0 ${sweepOuter} 0 ${r} A${rx.toFixed(2)} ${r} 0 0 ${sweepTerm} 0 ${-r}Z"/>`;
    return `<svg class="moon-icon" viewBox="-17 -17 34 34" aria-hidden="true"><circle r="${r}" class="moon-dark"/>${lit}</svg>`;
  }

  // ------------------------------------------------------------------
  // Courbes : [[t, hauteur]] ; valeur interpolée à l'instant t (hauteur, azimut)
  // ------------------------------------------------------------------
  const series = (c, k) => c[k].map((v, i) => [c.t0 + i * c.step, v]);
  function at(c, k, t) {
    const x = (t - c.t0) / c.step, i = Math.floor(x);
    const a = c[k], n = a.length;
    if (i < 0 || i >= n - 1) return null;
    const f = x - i;
    if (k.endsWith("Az")) {
      // azimut : interpolation par le plus court chemin (359° -> 1°)
      const d = ((a[i + 1] - a[i] + 540) % 360) - 180;
      return (a[i] + f * d + 360) % 360;
    }
    return a[i] + f * (a[i + 1] - a[i]);
  }

  let data = null, chart = null;

  function info(d, now) {
    const s = d.sun || {}, m = d.moon || {}, c = d.curve;
    const today = now >= d.start && now < d.stop;
    const sAlt = c && today ? at(c, "sun", now) : null, sAz = c && today ? at(c, "sunAz", now) : null;
    const mAlt = c && today ? at(c, "moon", now) : null, mAz = c && today ? at(c, "moonAz", now) : null;
    const polar = !isNum(s.rise) && !isNum(s.set)
      ? (s.daylight >= 86000 ? "soleil levé toute la journée" : s.daylight === 0 ? "soleil couché toute la journée" : "") : "";
    $("astro-sun").innerHTML = `
      <div class="as-row"><span class="as-k">Lever</span><b>${hm(s.rise)}</b><span class="as-k">Coucher</span><b>${hm(s.set)}</b></div>
      ${polar ? `<p class="as-note">${polar}</p>` : ""}
      ${isNum(s.daylight) ? `<div class="as-row"><span class="as-k">Durée du jour</span><b>${dur(s.daylight)}</b></div>` : ""}
      ${isNum(s.diff) ? `<div class="as-row"><span class="as-k">Par rapport à hier</span><b class="${s.diff >= 0 ? "as-up" : "as-down"}">${delta(s.diff)}</b></div>` : ""}
      <div class="as-row as-sub">${isNum(s.transit) ? `<span>Midi solaire ${hm(s.transit)}${isNum(s.transitAlt) ? ` (${deg(s.transitAlt)})` : ""}</span>` : ""}${isNum(sAlt) ? `<span>Actuellement ${deg(sAlt)}, ${dirName(sAz)}</span>` : ""}</div>`;
    $("astro-moon").innerHTML = `
      ${d.ephem ? `<div class="as-row"><span class="as-k">Lever</span><b>${hm(m.rise)}</b><span class="as-k">Coucher</span><b>${hm(m.set)}</b></div>` : ""}
      ${isNum(m.index) ? `<div class="as-row as-phase">${moonIcon(m.index, m.fullness, d.latitude < 0)}<span><b>${esc(m.phase || "")}</b><br><span class="as-k">éclairée à ${Math.round(m.fullness)} %</span></span></div>` : ""}
      ${isNum(mAlt) ? `<div class="as-row as-sub"><span>Actuellement ${deg(mAlt)}, ${dirName(mAz)}${mAlt < 0 ? " (sous l'horizon)" : ""}</span></div>` : ""}`;
    return { sAlt, mAlt, today };
  }

  function chartData(d, cur, now) {
    const c = d.curve, sun = series(c, "sun"), moon = series(c, "moon");
    const all = c.sun.concat(c.moon);
    const range = Math.max(...all) - Math.min(...all);
    const step = range > 120 ? 30 : 15;
    const lo = Math.max(-90, Math.floor(Math.min(...all) / step) * step);
    const hi = Math.min(90, Math.max(step, Math.ceil(Math.max(...all) / step) * step));
    const t1 = c.t0 + (c.sun.length - 1) * c.step;
    // fond du jour : soleil au-dessus de l'horizon (bord supérieur, réfraction comprise)
    const daylight = sun.map(([t, a]) => (a >= -0.833 ? [t, lo, hi] : [t, null, null]));
    const s = [
      { type: "band", label: "Jour", color: "--sun", alpha: 0.09, data: daylight, noTip: true },
      { type: "line", label: "Horizon", color: "--text-2", width: 1.5, endDot: false, data: sun.map(([t]) => [t, 0]), noTip: true },
      { type: "line", label: "Soleil", color: "--sun", width: 2.25, endDot: false, data: sun },
      { type: "line", label: "Lune", color: "--moon", width: 2, endDot: false, data: moon },
    ];
    if (cur.today && isNum(cur.sAlt)) {
      s.push({ type: "dots", label: "Soleil maintenant", color: "--sun", alpha: 1, r: 7, data: [[now, cur.sAlt]] });
      s.push({ type: "dots", label: "Lune maintenant", color: "--moon", alpha: 1, r: 6, data: [[now, cur.mAlt]] });
    }
    return { series: s, opts: { range: [c.t0, t1], yFixed: [lo, hi, step] } };
  }

  function render() {
    if (!data) return;
    const now = Date.now() / 1000;
    const cur = info(data, now);
    const box = $("astro-chart").closest(".astro-side");
    if (!data.curve || !window.MiniChart) {
      // almanach sans PyEphem : pas de courbes
      box.hidden = true;
      return;
    }
    box.hidden = false;
    // légende « position actuelle » seulement si la journée affichée est aujourd'hui
    const note = card.querySelector(".lg-note");
    if (note) note.hidden = !cur.today;
    const { series: s, opts } = chartData(data, cur, now);
    if (!chart) {
      chart = new MiniChart($("astro-chart"), Object.assign({
        unit: "°", decimals: 0, maxGap: 1800, xTicks: "h6", yTicks: 4, padLeft: 40,
        yFormat: (v) => `${v}°`.replace("-", "−"),
        tipHead: (t) => new Date(t * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        series: s,
      }, opts));
    } else chart.setSeries(s, opts);
    chart.draw();
    $("astro-chart").setAttribute("aria-label", "Hauteur du soleil et de la lune aujourd'hui" +
      (isNum(cur.sAlt) ? ` ; soleil actuellement à ${deg(cur.sAlt)}, lune à ${deg(cur.mAlt)}` : ""));
  }

  async function load() {
    try {
      const opt = { cache: "no-store" };
      if (window.AbortSignal && AbortSignal.timeout) opt.signal = AbortSignal.timeout(15000);
      const r = await fetch("data/astro.json?_=" + Math.floor(Date.now() / 60000), opt);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      data = d;
      section.hidden = false;
      render();
    } catch (e) {
      // pas de données : section masquée (les données déjà affichées sont conservées)
      if (!data) section.hidden = true;
      console.warn("astro.json :", e.message);
    }
  }

  (async () => {
    let cfg = window.WEEWX_CONFIG || null;
    if (!cfg && window.weewxConfig) cfg = await window.weewxConfig.catch(() => null);
    if (cfg && cfg.astro && cfg.astro.enable === false) { section.hidden = true; return; }
    const day = window.WEEWX_DAY && window.WEEWX_DAY.astro;
    if (day) {
      if (day.error) { section.hidden = true; return; }
      data = day;
      section.hidden = false;
      render();
      return;
    }
    await load();
    setInterval(load, REFRESH);
    setInterval(render, 60 * 1000);      // position actuelle
  })();
})();
