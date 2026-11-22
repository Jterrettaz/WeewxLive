/* weewx-live — « Soleil et Lune » (tableau de bord) : lever / coucher du soleil et de la
 * lune, durée du jour et écart avec la veille, phase de la lune, graphique de la hauteur du
 * soleil et de la lune sur la journée avec leur position actuelle, et course du soleil dans
 * le ciel (direction / hauteur : aujourd'hui, 21 juin, équinoxe, 21 décembre, lune du jour).
 * Calculs : almanach de weewx (PyEphem), publiés dans data/astro.json à chaque archive
 * (hauteurs et azimuts toutes les 10 min ; position actuelle interpolée). */
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
  const hm = (t) => (isNum(t) ? WXT.hm(t) : "—");   // heure de la station
  // textes de la langue choisie (i18n.js)
  const ta = WXL.ctx("Astro");
  const dur = (s) => { const m = Math.round(s / 60); return WXL.fill(WXL.loc("duration_h_min", "{h} h {m} min"), { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") }); };
  const delta = (s) => {
    const a = Math.round(Math.abs(s)), m = Math.floor(a / 60), sec = a % 60;
    const sign = s > 0.5 ? "+" : s < -0.5 ? "−" : "±";
    return sign + (m ? WXL.fill(WXL.loc("duration_min_s", "{m} min {s} s"), { m, s: String(sec).padStart(2, "0") }) : WXL.fill(WXL.loc("duration_s", "{s} s"), { s: sec }));
  };
  const dirName = WXL.dir;
  const deg = (v) => `${Math.round(v)}°`.replace("-", "−");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Lune dessinée selon sa phase : disque sombre + partie éclairée (terminateur elliptique) ;
  // index weewx 0 à 7 (0 nouvelle lune, 1 à 3 croissante, 4 pleine, 5 à 7 décroissante),
  // éclairée à droite quand elle croît (hémisphère nord), à gauche sinon
  // forme de la lune (r = 15, centrée sur 0, 0) : icône de la colonne Lune et position actuelle
  // dans la course du soleil
  function moonShape(index, fullness, south) {
    const r = 15, f = Math.min(1, Math.max(0, fullness / 100));
    let right = index < 4;
    if (south) right = !right;
    const rx = Math.abs(1 - 2 * f) * r;
    const sweepOuter = right ? 1 : 0;
    const sweepTerm = f > 0.5 ? sweepOuter : 1 - sweepOuter;
    const lit = f < 0.01 ? "" : f > 0.99
      ? `<circle r="${r}" class="moon-lit"/>`
      : `<path class="moon-lit" d="M0 ${-r} A${r} ${r} 0 0 ${sweepOuter} 0 ${r} A${rx.toFixed(2)} ${r} 0 0 ${sweepTerm} 0 ${-r}Z"/>`;
    return `<circle r="${r}" class="moon-dark"/>${lit}`;
  }
  const moonIcon = (index, fullness, south) =>
    `<svg class="moon-icon" viewBox="-17 -17 34 34" aria-hidden="true">${moonShape(index, fullness, south)}</svg>`;

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

  // ------------------------------------------------------------------
  // Course du soleil dans le ciel (SVG) : azimut en abscisse (sud au centre ; nord dans
  // l'hémisphère sud), hauteur en ordonnée
  // ------------------------------------------------------------------
  const SP = { june: "#8fdc57", equinox: "#86d6f7", december: "#f07ac8", today: "#ffffff", moon: "#ffc46b" };
  const ns = (n) => n.toFixed(1);
  function sunPath(d, now) {
    const box = $("astro-path"), c = d.curve, P = d.paths || {};
    const W = Math.max(260, box.clientWidth || 400), H = Math.round(Math.min(300, Math.max(210, W * 0.56)));
    const L = 40, R = 18, T = 12, B = 46, w = W - L - R, h = H - T - B;
    const center = d.latitude < 0 ? 0 : 180;
    const rel = (az) => ((az - center + 540) % 360) - 180;           // −180 à 180, 0 au centre
    const pairs = (k, ka) => c[k].map((a, i) => [c[ka][i], a, c.t0 + i * c.step]);
    // lune : passage complet du lever au coucher (moonPath), sinon la journée
    const today = pairs("sun", "sunAz"), moon = Array.isArray(d.moonPath) ? d.moonPath : pairs("moon", "moonAz");
    const up = (pts) => pts.filter((p) => p[1] >= 0);
    // étendue : courses au-dessus de l'horizon, arrondie à 40°
    const all = [].concat(P.june || [], P.equinox || [], P.december || [], up(today), up(moon));
    if (!all.length) return false;
    const rs = all.map((p) => rel(p[0]));
    const x0 = Math.max(-180, Math.floor((Math.min(...rs) - 5) / 40) * 40), x1 = Math.min(180, Math.ceil((Math.max(...rs) + 5) / 40) * 40);
    const yMax = Math.min(90, Math.max(20, Math.ceil((Math.max(...all.map((p) => p[1])) + 6) / 20) * 20));
    const X = (az) => L + ((rel(az) - x0) / (x1 - x0)) * w, Y = (alt) => T + h - (Math.max(0, alt) / yMax) * h;
    // tracé : segments au-dessus de l'horizon (point d'entrée / sortie sur l'horizon)
    function path(pts) {
      let dstr = "", prev = null;
      for (const p of pts) {
        if (p[1] >= 0) {
          if (prev && prev[1] < 0) {
            const f = prev[1] / (prev[1] - p[1]), az = prev[0] + f * ((((p[0] - prev[0]) + 540) % 360) - 180);
            dstr += `M${ns(X(az))} ${ns(Y(0))}L${ns(X(p[0]))} ${ns(Y(p[1]))}`;
          } else dstr += `${prev && prev[1] >= 0 ? "L" : "M"}${ns(X(p[0]))} ${ns(Y(p[1]))}`;
        } else if (prev && prev[1] >= 0) {
          const f = prev[1] / (prev[1] - p[1]), az = prev[0] + f * ((((p[0] - prev[0]) + 540) % 360) - 180);
          dstr += `L${ns(X(az))} ${ns(Y(0))}`;
        }
        prev = p;
      }
      return dstr;
    }
    const top = (pts) => pts.reduce((m, p) => (p[1] > m[1] ? p : m), [center, -90]);
    const label = (txt, pts, col, dy = -8) => {
      const p = top(pts);
      return p[1] < 0 ? "" : `<text class="sp-lab" x="${ns(X(p[0]))}" y="${ns(Y(p[1]) + dy)}" fill="${col}" text-anchor="middle">${esc(txt)}</text>`;
    };
    let g = `<defs><linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sp-sky-top"/><stop offset="1" class="sp-sky-bot"/></linearGradient>
      <radialGradient id="sp-sun"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#ffc23a"/><stop offset=".75" stop-color="#ff9a1a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a1a" stop-opacity="0"/></radialGradient>
      <clipPath id="sp-clip"><rect x="${L}" y="${T}" width="${w}" height="${h}" rx="10"/></clipPath></defs>
      <rect x="${L}" y="${T}" width="${w}" height="${h}" rx="10" fill="url(#sp-sky)"/>`;
    // grille : 20° en direction, 10° en hauteur
    let grid = "";
    for (let a = Math.ceil(x0 / 20) * 20; a <= x1; a += 20) grid += `<path d="M${ns(X(a + center))} ${T}V${T + h}"/>`;
    for (let v = 10; v < yMax; v += 10) grid += `<path d="M${L} ${ns(Y(v))}H${L + w}"/>`;
    g += `<g class="sp-grid" clip-path="url(#sp-clip)">${grid}</g>`;
    // axes : hauteurs à gauche, directions (degrés et points cardinaux) en bas
    let ax = "";
    for (let v = 0; v <= yMax; v += 20) ax += `<text x="${L - 6}" y="${ns(Y(v) + 4)}" text-anchor="end">${v}°</text>`;
    for (let a = Math.ceil(x0 / 40) * 40; a <= x1; a += 40) {
      const az = (a + center + 360) % 360;
      ax += `<text x="${ns(X(az))}" y="${T + h + 16}" text-anchor="middle">${az}°</text>`;
    }
    for (let a = Math.ceil(x0 / 45) * 45; a <= x1; a += 45) {
      const az = (a + center + 360) % 360;
      ax += `<text class="sp-card" x="${ns(X(az))}" y="${T + h + 34}" text-anchor="middle">${esc(WXL.dirs[Math.round(az / 22.5) % 16])}</text>`;
    }
    g += `<g class="sp-axis">${ax}</g><path class="sp-horizon" d="M${L} ${T + h}H${L + w}"/>`;
    // courses saisonnières, lune et soleil du jour
    let cv = "";
    [["june", P.june], ["equinox", P.equinox], ["december", P.december]].forEach(([k, pts]) => {
      if (pts && pts.length) cv += `<path d="${path(pts)}" stroke="${SP[k]}" stroke-width="2.2" fill="none"/>`;
    });
    if (up(moon).length) cv += `<path d="${path(moon)}" stroke="${SP.moon}" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/>`;
    if (up(today).length) cv += `<path d="${path(today)}" stroke="${SP.today}" stroke-width="2.6" stroke-dasharray="7 5" fill="none"/>`;
    // heures pleines sur la course du jour (étiquette toutes les 3 h)
    let hrs = "";
    for (let t = Math.ceil(c.t0 / 3600) * 3600; t < c.t0 + c.sun.length * c.step; t += 3600) {
      const alt = at(c, "sun", t), az = at(c, "sunAz", t);
      if (!isNum(alt) || alt < 2) continue;
      const hr = WXT.parts(t).h;
      hrs += `<circle cx="${ns(X(az))}" cy="${ns(Y(alt))}" r="3" fill="#fff"/>`;
      if (hr % 3 === 0) hrs += `<text class="sp-hour" x="${ns(X(az))}" y="${ns(Y(alt) + 17)}" text-anchor="middle">${esc(WXL.fill(WXL.loc("hour_suffix", "{h} h"), { h: hr }))}</text>`;
    }
    // « 21 juin », « 21 déc. » (mois abrégé de la langue des pages)
    const day = (m) => new Intl.DateTimeFormat(WXL.locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(2001, m, 21));
    const labs = (P.june ? label(day(5), P.june, SP.june) : "") + (P.equinox ? label(ta("Equinox"), P.equinox, SP.equinox) : "") +
      (P.december ? label(day(11), P.december, SP.december) : "");
    g += `<g clip-path="url(#sp-clip)">${cv}${hrs}</g>${labs}`;
    // positions actuelles : lune (disque) et soleil (avec trait vers l'horizon)
    const notes = [];
    const isToday = now >= d.start && now < d.stop;
    if (isToday) {
      const mAlt = at(c, "moon", now), mAz = at(c, "moonAz", now), sAlt = at(c, "sun", now), sAz = at(c, "sunAz", now);
      if (isNum(mAlt)) {
        // lune dessinée selon sa phase (sinon disque clair)
        const m = d.moon || {};
        if (mAlt >= 0) g += isNum(m.index) && isNum(m.fullness)
          ? `<g transform="translate(${ns(X(mAz))} ${ns(Y(mAlt))}) scale(.6)"><circle r="17" class="sp-moon-ring"/>${moonShape(m.index, m.fullness, d.latitude < 0)}</g>`
          : `<circle cx="${ns(X(mAz))}" cy="${ns(Y(mAlt))}" r="7" fill="#f4e6a8" stroke="#fff" stroke-width="1.5"/>`;
        else notes.push(ta("Moon below the horizon ({alt})", { alt: deg(mAlt) }));
      }
      if (isNum(sAlt)) {
        if (sAlt >= 0) {
          const x = ns(X(sAz)), y = ns(Y(sAlt));
          g += `<path class="sp-now" d="M${x} ${y}V${T + h}"/><circle cx="${x}" cy="${y}" r="22" fill="url(#sp-sun)"/><circle cx="${x}" cy="${y}" r="10" fill="#ffc23a" stroke="#fff3b0" stroke-width="1.5"/>`;
        } else notes.unshift(ta("Sun below the horizon ({alt})", { alt: deg(sAlt) }));
      }
    }
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}</svg>`;
    $("astro-path-note").textContent = notes.join(" · ");
    $("astro-path-note").hidden = !notes.length;
    $("astro-path-seasons").textContent = `${day(5)} · ${ta("equinox")} · ${day(11)}`;
    return true;
  }

  function info(d, now) {
    const s = d.sun || {}, m = d.moon || {}, c = d.curve;
    const today = now >= d.start && now < d.stop;
    const sAlt = c && today ? at(c, "sun", now) : null, sAz = c && today ? at(c, "sunAz", now) : null;
    const mAlt = c && today ? at(c, "moon", now) : null, mAz = c && today ? at(c, "moonAz", now) : null;
    const polar = !isNum(s.rise) && !isNum(s.set)
      ? (s.daylight >= 86000 ? ta("sun up all day") : s.daylight === 0 ? ta("sun down all day") : "") : "";
    $("astro-sun").innerHTML = `
      <div class="as-row"><span class="as-k">${esc(ta("Rise"))}</span><b>${hm(s.rise)}</b><span class="as-k">${esc(ta("Set"))}</span><b>${hm(s.set)}</b></div>
      ${polar ? `<p class="as-note">${polar}</p>` : ""}
      ${isNum(s.daylight) ? `<div class="as-row"><span class="as-k">${esc(ta("Day length"))}</span><b>${dur(s.daylight)}</b></div>` : ""}
      ${isNum(s.diff) ? `<div class="as-row"><span class="as-k">${esc(ta("Compared to yesterday"))}</span><b class="${s.diff >= 0 ? "as-up" : "as-down"}">${delta(s.diff)}</b></div>` : ""}
      <div class="as-row as-sub">${isNum(s.transit) ? `<span>${esc(ta("Solar noon {time}", { time: hm(s.transit) }))}${isNum(s.transitAlt) ? ` (${deg(s.transitAlt)})` : ""}</span>` : ""}${isNum(sAlt) ? `<span>${esc(ta("Currently {alt}, {dir}", { alt: deg(sAlt), dir: dirName(sAz) }))}</span>` : ""}</div>`;
    $("astro-moon").innerHTML = `
      ${d.ephem ? `<div class="as-row"><span class="as-k">${esc(ta("Rise"))}</span><b>${hm(m.rise)}</b><span class="as-k">${esc(ta("Set"))}</span><b>${hm(m.set)}</b></div>` : ""}
      ${isNum(m.index) ? `<div class="as-row as-phase">${moonIcon(m.index, m.fullness, d.latitude < 0)}<span><b>${esc(m.phase || "")}</b><br><span class="as-k">${esc(ta("{pct} % illuminated", { pct: Math.round(m.fullness) }))}</span></span></div>` : ""}
      ${isNum(mAlt) ? `<div class="as-row as-sub"><span>${esc(ta("Currently {alt}, {dir}", { alt: deg(mAlt), dir: dirName(mAz) }))}${mAlt < 0 ? " " + esc(ta("(below the horizon)")) : ""}</span></div>` : ""}`;
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
      { type: "band", label: ta("Daylight"), color: "--sun", alpha: 0.09, data: daylight, noTip: true },
      { type: "line", label: ta("Horizon"), color: "--text-2", width: 1.5, endDot: false, data: sun.map(([t]) => [t, 0]), noTip: true },
      { type: "line", label: ta("Sun"), color: "--sun", width: 2.25, endDot: false, data: sun },
      { type: "line", label: ta("Moon"), color: "--moon", width: 2, endDot: false, data: moon },
    ];
    if (cur.today && isNum(cur.sAlt)) {
      s.push({ type: "dots", label: ta("Sun now"), color: "--sun", alpha: 1, r: 7, data: [[now, cur.sAlt]] });
      s.push({ type: "dots", label: ta("Moon now"), color: "--moon", alpha: 1, r: 6, data: [[now, cur.mAlt]] });
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
    $("astro-path-pane").hidden = !(data.paths && sunPath(data, now));
    const { series: s, opts } = chartData(data, cur, now);
    if (!chart) {
      chart = new MiniChart($("astro-chart"), Object.assign({
        unit: "°", decimals: 0, maxGap: 1800, xTicks: "h6", yTicks: 4, padLeft: 40,
        yFormat: (v) => `${v}°`.replace("-", "−"),
        tipHead: (t) => WXT.hm(t),
        series: s,
      }, opts));
    } else chart.setSeries(s, opts);
    chart.draw();
    MiniChart.linkLegend($("astro-legend"), chart);   // clic : masquer / réafficher une courbe
    $("astro-chart").setAttribute("aria-label", ta("Sun and moon altitude today") +
      (isNum(cur.sAlt) ? ta("; sun currently at {sun}, moon at {moon}", { sun: deg(cur.sAlt), moon: deg(cur.mAlt) }) : ""));
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
    await load();
    setInterval(load, REFRESH);
    setInterval(render, 60 * 1000);      // position actuelle
    // course du soleil : redessinée à la largeur du cadre
    let rw = 0;
    if (window.ResizeObserver) new ResizeObserver(() => {
      const wNow = $("astro-path").clientWidth;
      if (data && data.paths && wNow && Math.abs(wNow - rw) > 4) { rw = wNow; sunPath(data, Date.now() / 1000); }
    }).observe($("astro-path"));
  })();
})();
