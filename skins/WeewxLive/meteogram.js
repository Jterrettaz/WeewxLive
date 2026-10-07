/* weewx-live — page « Météogramme » (meteogram.html).
 * Données : data/meteogram.json, produit par weewx (livejson.meteogram_data) à partir de
 * l'API de prévision d'Open-Meteo pour chaque modèle de [LiveJSON] [[meteogram]] models
 * (liste déroulante de la page, choix mémorisé par le navigateur) : valeurs horaires au sol
 * et, pour chaque niveau de pression, altitude géopotentielle, température, nébulosité et vent.
 * Panneaux (axe du temps commun, réticule et infobulle partagés) :
 *   pictogrammes du temps · température à 2 m (min. / max. de chaque jour) ·
 *   couverture nuageuse selon l'altitude · précipitations horaires (dont averses) et cumul
 *   · neige · température et vent en altitude (isotherme 0 °C) · vent moyen et rafales au sol.
 * Les coupes en altitude sont interpolées entre les niveaux de pression (et la valeur au
 * sol), puis dessinées pixel par pixel ; les isothermes par « marching squares ». */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = $("mg-root");
  if (!root) return;

  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v, d = 1) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const dirName = (d) => (isNum(d) ? DIRS[Math.round(d / 22.5) % 16] : "");
  const dark = () => (window.TempScale ? TempScale.darkMode() : matchMedia("(prefers-color-scheme: dark)").matches);
  const L = 50, R = 44, TOP = 8, BOT = 20;      // marges des graphiques (px ; à droite : axe du cumul de pluie)

  let ALL = null, D = null, S = null, N = 0, T0 = 0;   // ALL : fichier ; D : modèle affiché
  const store = {
    get() { try { return localStorage.getItem("weewx-mg-model"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem("weewx-mg-model", v); } catch (e) { /* stockage indisponible */ } },
  };
  const panels = [];
  let hover = null, raf = 0;                     // hover : { i, panel, y, cx, cy }

  // ------------------------------------------------------------------
  // Échelles de couleur
  // ------------------------------------------------------------------
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function ramp(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
    let i = 0; while (v > stops[i + 1][0]) i++;
    const [v0, c0] = stops[i], [v1, c1] = stops[i + 1], f = (v - v0) / (v1 - v0);
    return c0.map((x, k) => x + (c1[k] - x) * f);
  }
  // température en altitude : bleus sous 0 °C, du jaune pâle au rouge au-dessus (pivot 0 °C)
  const T_STOPS = [[-40, "#24125e"], [-28, "#3a2fa3"], [-16, "#2f63c9"], [-8, "#4f97e3"], [-2, "#a9d3f2"],
    [0, "#e9f1f4"], [2, "#f7ecb8"], [8, "#f5cc63"], [14, "#f19a3e"], [22, "#df5a2c"], [30, "#a51d22"]].map(([v, c]) => [v, hex(c)]);

  // ------------------------------------------------------------------
  // Profils verticaux (interpolation entre niveaux de pression)
  // ------------------------------------------------------------------
  const elev = () => (isNum(D.elevation) ? D.elevation : 0);
  // points d'une heure : sol (2 m / 10 m) puis niveaux au-dessus du sol, triés par altitude
  function column(i) {
    const s = D.surface, pts = [];
    const uv = (ws, wd) => (isNum(ws) && isNum(wd) ? [-ws * Math.sin(wd * Math.PI / 180), -ws * Math.cos(wd * Math.PI / 180)] : [null, null]);
    const [u0, v0] = uv(s.wind_speed_10m[i], s.wind_direction_10m[i]);
    pts.push({ z: elev(), t: s.temperature_2m[i], cc: null, u: u0, v: v0 });
    for (const lv of D.levels) {
      const z = lv.z[i];
      if (!isNum(z) || z <= elev() + 10) continue;
      const [u, v] = uv(lv.ws[i], lv.wd[i]);
      pts.push({ z, t: lv.t[i], cc: lv.cc[i], u, v });
    }
    pts.sort((a, b) => a.z - b.z);
    return pts;
  }
  function interp(pts, k, z) {
    const p = pts.filter((q) => isNum(q[k]));
    if (!p.length) return null;
    if (z <= p[0].z) return p[0][k];
    for (let j = 1; j < p.length; j++) {
      if (z <= p[j].z) { const a = p[j - 1], b = p[j], f = (z - a.z) / (b.z - a.z); return a[k] + f * (b[k] - a[k]); }
    }
    return null;                                 // au-dessus du dernier niveau
  }
  // grille [ligne d'altitude][heure] pour une liste de variables
  function grid(keys, top, rows) {
    const z0 = elev(), zs = [];
    for (let r = 0; r < rows; r++) zs.push(z0 + (top - z0) * r / (rows - 1));
    const out = {};
    keys.forEach((k) => (out[k] = zs.map(() => new Array(N).fill(null))));
    for (let i = 0; i < N; i++) {
      const pts = column(i);
      zs.forEach((z, r) => keys.forEach((k) => (out[k][r][i] = interp(pts, k, z))));
    }
    return { zs, g: out };
  }
  // valeur bilinéaire (r, c fractionnaires) d'une grille
  function bilin(G, r, c) {
    const r0 = Math.floor(r), c0 = Math.floor(c), r1 = Math.min(r0 + 1, G.length - 1), c1 = Math.min(c0 + 1, G[0].length - 1);
    const fr = r - r0, fc = c - c0;
    const a = G[r0][c0], b = G[r0][c1], d = G[r1][c0], e = G[r1][c1];
    if (![a, b, d, e].every(isNum)) return [a, b, d, e].find(isNum) ?? null;
    return (a * (1 - fc) + b * fc) * (1 - fr) + (d * (1 - fc) + e * fc) * fr;
  }

  // ------------------------------------------------------------------
  // Panneaux (canvas) : fond mis en cache, réticule redessiné au survol
  // ------------------------------------------------------------------
  class Panel {
    constructor(el, o) {
      this.el = el; this.o = o;
      this.canvas = document.createElement("canvas");
      el.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this.base = document.createElement("canvas");
      const move = (e) => {
        const r = this.canvas.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
        const x = p.clientX - r.left, y = p.clientY - r.top;
        const i = Math.round(((x - L) / this.pw) * (N - 1));
        hover = i >= 0 && i < N ? { i, panel: this, y, cx: p.clientX, cy: p.clientY } : null;
        // un seul dessin par image (requestAnimationFrame)
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; redrawAll(); showTip(); });
      };
      this.canvas.addEventListener("mousemove", move);
      this.canvas.addEventListener("touchstart", move, { passive: true });
      this.canvas.addEventListener("touchmove", move, { passive: true });
      this.canvas.addEventListener("mouseleave", () => { hover = null; redrawAll(); showTip(); });
    }
    get w() { return this.el.clientWidth; }
    get h() { return this.el.clientHeight; }
    get pw() { return this.w - L - R; }
    get ph() { return this.h - TOP - BOT; }
    X(i) { return L + (i / (N - 1)) * this.pw; }
    render() {
      const dpr = window.devicePixelRatio || 1, w = this.w, h = this.h;
      if (!w || !h) return;
      for (const c of [this.canvas, this.base]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const b = this.base.getContext("2d");
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.clearRect(0, 0, w, h);
      b.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      this.o.draw(b, this);
      timeAxis(b, this);
      this.cross = css("--text");                // couleur du réticule (lue une fois par rendu)
      this.overlay();
    }
    overlay() {
      const dpr = window.devicePixelRatio || 1, c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.drawImage(this.base, 0, 0);
      if (!hover) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = Math.round(this.X(hover.i)) + 0.5;
      c.strokeStyle = this.cross; c.globalAlpha = 0.55; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, TOP); c.lineTo(x, TOP + this.ph); c.stroke();
      if (hover.panel === this && this.o.yOf && hover.y > TOP && hover.y < TOP + this.ph) {
        c.beginPath(); c.moveTo(L, hover.y + 0.5); c.lineTo(L + this.pw, hover.y + 0.5); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }
  function redrawAll() { panels.forEach((p) => p.overlay()); }

  // axe du temps : minuit (trait plein, nom du jour), toutes les 6 h (tirets)
  function timeAxis(ctx, p) {
    const muted = css("--text-3"), grid = css("--grid"), text = css("--text-2");
    ctx.textBaseline = "top"; ctx.textAlign = "center";
    for (let i = 0; i < N; i++) {
      const t = T0 + i * 3600, hh = WXT.parts(t).h;    // heure de la station (wxtime.js)
      if (hh % 6) continue;
      const x = Math.round(p.X(i)) + 0.5;
      ctx.strokeStyle = hh === 0 ? muted : grid; ctx.lineWidth = 1;
      ctx.setLineDash(hh === 0 ? [] : [3, 3]);
      ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, TOP + p.ph); ctx.stroke();
      ctx.setLineDash([]);
      const label = hh === 0 ? WXT.fmt(t, { weekday: "short", day: "numeric" }) : `${String(hh).padStart(2, "0")} h`;
      ctx.fillStyle = hh === 0 ? text : muted;
      ctx.font = hh === 0 ? "600 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
      const lw = ctx.measureText(label).width;
      if (x - lw / 2 >= L - 4 && x + lw / 2 <= p.w) ctx.fillText(label, x, TOP + p.ph + 5);
    }
    ctx.strokeStyle = css("--border");
    ctx.strokeRect(L + 0.5, TOP + 0.5, p.pw, p.ph);
  }
  function niceStep(range, target) {
    const raw = range / Math.max(1, target), pw = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pw;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pw;
  }
  // axe Y (valeurs) : renvoie Y(v)
  function yAxis(ctx, p, lo, hi, opts = {}) {
    const step = opts.step || niceStep(hi - lo || 1, opts.ticks || 4);
    lo = opts.floor !== undefined ? opts.floor : Math.floor(lo / step) * step;
    hi = Math.max(lo + step, Math.ceil(hi / step) * step);
    const Y = (v) => TOP + (1 - (v - lo) / (hi - lo)) * p.ph;
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = css("--text-3");
    ctx.strokeStyle = css("--grid"); ctx.lineWidth = 1;
    for (let v = lo; v <= hi + step * 1e-6; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      if (!opts.noGrid) { ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + p.pw, y); ctx.stroke(); }
      ctx.fillText(opts.format ? opts.format(v) : fmt(v, step < 1 ? 1 : 0), L - 6, y);
    }
    return { Y, lo, hi };
  }

  // ------------------------------------------------------------------
  // Dessins des panneaux
  // ------------------------------------------------------------------
  function drawTemp(ctx, p) {
    const t = S.temperature_2m;
    const vals = t.filter(isNum);
    if (!vals.length) return;
    const { Y } = yAxis(ctx, p, Math.min(...vals) - 1, Math.max(...vals) + 1, { ticks: 4 });
    ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 1; i < N; i++) {
      if (!isNum(t[i - 1]) || !isNum(t[i])) continue;
      ctx.strokeStyle = window.TempScale ? TempScale.lineColor((t[i - 1] + t[i]) / 2) : css("--temp");
      ctx.beginPath(); ctx.moveTo(p.X(i - 1), Y(t[i - 1])); ctx.lineTo(p.X(i), Y(t[i])); ctx.stroke();
    }
    // min. et max. de chaque jour (journée complète ou partielle affichée)
    ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "center";
    const days = {};
    for (let i = 0; i < N; i++) {
      if (!isNum(t[i])) continue;
      const k = WXT.ymd(T0 + i * 3600);
      const d = days[k] || (days[k] = { min: i, max: i });
      if (t[i] < t[d.min]) d.min = i;
      if (t[i] > t[d.max]) d.max = i;
    }
    for (const d of Object.values(days)) {
      for (const [i, up] of [[d.max, true], [d.min, false]]) {
        if (i === 0 || i === N - 1) continue;           // extrémité de la prévision : pas un extrême
        ctx.fillStyle = window.TempScale ? TempScale.textColor(Math.round(t[i] * 10) / 10) : css("--text");
        ctx.textBaseline = up ? "bottom" : "top";
        const y = Y(t[i]) + (up ? -5 : 5);
        ctx.fillText(fmt(t[i], 1), Math.min(Math.max(p.X(i), L + 14), L + p.pw - 14), Math.max(TOP + 12, Math.min(TOP + p.ph - 2, y)));
      }
    }
  }

  // coupe verticale dessinée pixel par pixel ; pix(r, c) -> [r, g, b, a] ou null
  function raster(ctx, p, rows, pix) {
    const w = Math.max(1, Math.round(p.pw)), h = Math.max(1, Math.round(p.ph));
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const r = (1 - y / (h - 1)) * (rows - 1);
      for (let x = 0; x < w; x++) {
        const c = (x / (w - 1)) * (N - 1);
        const col = pix(r, c);
        if (!col) continue;
        const o = (y * w + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3];
      }
    }
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    tmp.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, L, TOP, p.pw, p.ph);
  }
  // axe des altitudes : sol (altitude du modèle) puis multiples ronds de « step » ; tirets
  // discrets (pas de quadrillage sur les coupes colorées)
  function altAxis(ctx, p, top, step) {
    const z0 = elev();
    const Y = (z) => TOP + (1 - (z - z0) / (top - z0)) * p.ph;
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = css("--text-3");
    ctx.strokeStyle = css("--text-3"); ctx.lineWidth = 1;
    const ticks = [z0];
    for (let z = Math.ceil((z0 + step * 0.35) / step) * step; z <= top + 1; z += step) ticks.push(z);
    for (const z of ticks) {
      const y = Math.round(Y(z)) + 0.5;
      ctx.beginPath(); ctx.moveTo(L - 4, y); ctx.lineTo(L, y); ctx.stroke();
      ctx.fillText(Math.round(z).toLocaleString("fr-FR"), L - 6, y);
    }
    return { Y };
  }

  // grilles interpolées du modèle affiché (calculées au premier dessin, gardées au redimensionnement)
  let CLD = null, TMP = null;
  // couverture nuageuse : gris d'autant plus opaque que le ciel est couvert (≥ 5 %)
  const cloudRGB = () => (dark() ? [205, 205, 200] : [92, 92, 90]);
  function drawClouds(ctx, p) {
    const top = D.top.clouds || D.top.humidity || 12000;   // sommet du panneau (option top_clouds ; humidity : fichier antérieur à 1.68)
    CLD = CLD || grid(["cc"], top, 110);
    const cloud = cloudRGB();
    raster(ctx, p, CLD.zs.length, (r, c) => {
      const cc = bilin(CLD.g.cc, r, c);
      if (!isNum(cc) || cc < 5) return null;
      return [cloud[0], cloud[1], cloud[2], Math.round(Math.min(1, cc / 100) * 0.9 * 255)];
    });
    const { Y } = altAxis(ctx, p, top, top - elev() > 8000 ? 2000 : 1000);
    p.o.yOf = (y) => elev() + (1 - (y - TOP) / p.ph) * (top - elev());
    // isotherme 0 °C (altitude du gel) en tirets
    const fz = S.freezing_level_height;
    ctx.strokeStyle = css("--wind"); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    let on = false;
    for (let i = 0; i < N; i++) {
      if (!isNum(fz[i]) || fz[i] > top) { on = false; continue; }
      const y = Y(Math.max(elev(), fz[i]));
      on ? ctx.lineTo(p.X(i), y) : ctx.moveTo(p.X(i), y); on = true;
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  // isolignes (marching squares) d'une grille ; seg(x1, y1, x2, y2)
  function contours(G, level, seg) {
    const R2 = G.length, C = G[0].length;
    const lerp = (a, b) => (level - a) / (b - a);
    for (let r = 0; r < R2 - 1; r++) {
      for (let c = 0; c < C - 1; c++) {
        const a = G[r][c], b = G[r][c + 1], d = G[r + 1][c + 1], e = G[r + 1][c];
        if (![a, b, d, e].every(isNum)) continue;
        const idx = (a > level) | ((b > level) << 1) | ((d > level) << 2) | ((e > level) << 3);
        if (idx === 0 || idx === 15) continue;
        const pts = {
          s: [c + lerp(a, b), r], E: [c + 1, r + lerp(b, d)], n: [c + lerp(e, d), r + 1], w: [c, r + lerp(a, e)],
        };
        const P = {
          1: ["s", "w"], 2: ["s", "E"], 3: ["w", "E"], 4: ["E", "n"], 5: ["s", "E", "w", "n"], 6: ["s", "n"], 7: ["w", "n"],
          8: ["w", "n"], 9: ["s", "n"], 10: ["s", "w", "E", "n"], 11: ["E", "n"], 12: ["w", "E"], 13: ["s", "E"], 14: ["s", "w"],
        }[idx];
        for (let k = 0; k < P.length; k += 2) seg(pts[P[k]], pts[P[k + 1]]);
      }
    }
  }

  function drawUpperTemp(ctx, p) {
    const top = D.top.temperature;
    TMP = TMP || grid(["t", "u", "v"], top, 90);
    const rows = TMP.zs.length;
    raster(ctx, p, rows, (r, c) => {
      const t = bilin(TMP.g.t, r, c);
      if (!isNum(t)) return null;
      const col = ramp(T_STOPS, t);
      return [col[0], col[1], col[2], 235];
    });
    const { Y } = altAxis(ctx, p, top, top - elev() > 6000 ? 2000 : 500);
    p.o.yOf = (y) => elev() + (1 - (y - TOP) / p.ph) * (top - elev());
    const gx = (c) => p.X(c), gy = (r) => Y(TMP.zs[0] + (TMP.zs[rows - 1] - TMP.zs[0]) * r / (rows - 1));
    // isothermes tous les 2 °C (fines), 0 °C en trait épais
    ctx.save();
    ctx.beginPath(); ctx.rect(L, TOP, p.pw, p.ph); ctx.clip();
    for (let lv = -40; lv <= 40; lv += 2) {
      ctx.beginPath();
      contours(TMP.g.t, lv, (a, b) => { ctx.moveTo(gx(a[0]), gy(a[1])); ctx.lineTo(gx(b[0]), gy(b[1])); });
      ctx.strokeStyle = lv === 0 ? "#1d3fb8" : "rgba(20, 20, 20, .28)";
      ctx.lineWidth = lv === 0 ? 2.2 : 0.8;
      ctx.stroke();
    }
    // vecteurs vent : un tous les k pas horaires et tous les 500 m (vers où souffle le vent)
    const k = Math.max(1, Math.ceil(26 / (p.pw / (N - 1))));
    const step = top - elev() > 6000 ? 1000 : 500;
    ctx.strokeStyle = "rgba(15, 15, 15, .78)"; ctx.fillStyle = "rgba(15, 15, 15, .78)"; ctx.lineWidth = 1.2;
    for (let i = 0; i < N; i += k) {
      for (let z = Math.ceil((elev() + 150) / step) * step; z < top - 100; z += step) {
        const r = ((z - TMP.zs[0]) / (TMP.zs[rows - 1] - TMP.zs[0])) * (rows - 1);
        const u = bilin(TMP.g.u, r, i), v = bilin(TMP.g.v, r, i);
        if (!isNum(u) || !isNum(v)) continue;
        arrow(ctx, p.X(i), Y(z), u, -v, Math.hypot(u, v));
      }
    }
    ctx.restore();
  }
  // flèche centrée en (x, y), direction (dx, dy) écran, longueur selon la vitesse (km/h)
  function arrow(ctx, x, y, dx, dy, speed) {
    if (speed < 0.5) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill(); return; }
    const len = Math.min(26, 6 + speed * 0.45), n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
    const x0 = x - ux * len / 2, y0 = y - uy * len / 2, x1 = x + ux * len / 2, y1 = y + uy * len / 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * 5 - uy * 3, y1 - uy * 5 + ux * 3); ctx.lineTo(x1 - ux * 5 + uy * 3, y1 - uy * 5 - ux * 3);
    ctx.closePath(); ctx.fill();
  }

  function bars(ctx, p, Y, vals, color, frac = 1) {
    const slot = p.pw / (N - 1), bw = Math.max(1, Math.min(14, slot * 0.8)) * frac;
    ctx.fillStyle = color;
    vals.forEach((v, i) => {
      if (!(v > 0)) return;
      const y = Y(v), y0 = Y(0), h = Math.max(1, y0 - y);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.X(i) - bw / 2, y, bw, h, [Math.min(3, bw / 2), Math.min(3, bw / 2), 0, 0]);
      else ctx.rect(p.X(i) - bw / 2, y, bw, h);
      ctx.fill();
    });
  }
  // cumul des précipitations depuis le début de la prévision (calculé dans show())
  let CUM = [];
  const cumul = () => { let c = 0; return S.precipitation.map((v) => (c += isNum(v) ? v : 0)); };
  function drawRain(ctx, p) {
    const pr = S.precipitation, sh = S.showers;
    const mx = Math.max(1, ...pr.filter(isNum));
    const { Y } = yAxis(ctx, p, 0, mx, { floor: 0, ticks: 3 });
    bars(ctx, p, Y, pr, css("--rain"));
    bars(ctx, p, Y, sh.map((v, i) => (isNum(v) && isNum(pr[i]) ? Math.min(v, pr[i]) : v)), css("--text-3"), 0.5);
    // cumul : courbe, échelle de droite (mm)
    const cu = CUM, cmax = Math.max(1, cu[cu.length - 1] || 0);
    const step = niceStep(cmax, 3), hi = Math.ceil(cmax / step) * step;
    const Yc = (v) => TOP + (1 - v / hi) * p.ph;
    const col = css("--press");
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = col;
    for (let v = 0; v <= hi + step * 1e-6; v += step) ctx.fillText(fmt(v, step < 1 ? 1 : 0), L + p.pw + 6, Yc(v));
    ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
    ctx.beginPath();
    cu.forEach((v, i) => (i ? ctx.lineTo(p.X(i), Yc(v)) : ctx.moveTo(p.X(i), Yc(v))));
    ctx.stroke();
  }
  function drawSnow(ctx, p) {
    const sf = S.snowfall, sd = S.snow_depth.map((v) => (isNum(v) ? v * 100 : null));
    const mx = Math.max(1, ...sf.filter(isNum), ...sd.filter(isNum));
    const { Y } = yAxis(ctx, p, 0, mx, { floor: 0, ticks: 3 });
    ctx.globalAlpha = 0.6; ctx.fillStyle = css("--press");
    ctx.beginPath(); let on = false;
    sd.forEach((v, i) => { if (!isNum(v)) return; on ? ctx.lineTo(p.X(i), Y(v)) : ctx.moveTo(p.X(i), Y(v)); on = true; });
    if (on) { ctx.lineTo(p.X(N - 1), Y(0)); ctx.lineTo(p.X(0), Y(0)); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    bars(ctx, p, Y, sf, css("--wind"));
  }
  function drawWind(ctx, p) {
    const ws = S.wind_speed_10m, gu = S.wind_gusts_10m, wd = S.wind_direction_10m;
    const mx = Math.max(10, ...gu.filter(isNum), ...ws.filter(isNum));
    const { Y } = yAxis(ctx, p, 0, mx * 1.08, { floor: 0, ticks: 3 });
    const line = (vals, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.beginPath();
      let on = false;
      vals.forEach((v, i) => { if (!isNum(v)) { on = false; return; } on ? ctx.lineTo(p.X(i), Y(v)) : ctx.moveTo(p.X(i), Y(v)); on = true; });
      ctx.stroke();
    };
    line(gu, css("--bad"), 2);
    line(ws, css("--text"), 2);
    // direction : flèche sur la courbe du vent moyen
    const k = Math.max(1, Math.ceil(22 / (p.pw / (N - 1))));
    ctx.strokeStyle = css("--wind"); ctx.fillStyle = css("--wind"); ctx.lineWidth = 1.4;
    for (let i = 0; i < N; i += k) {
      if (!isNum(wd[i]) || !isNum(ws[i])) continue;
      const a = wd[i] * Math.PI / 180;
      arrow(ctx, p.X(i), Y(ws[i]) - 1, -Math.sin(a), Math.cos(a), 14);
    }
    // plus forte rafale de chaque jour
    ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillStyle = css("--bad");
    const days = {};
    gu.forEach((v, i) => {
      if (!isNum(v)) return;
      const key = WXT.ymd(T0 + i * 3600);
      if (days[key] === undefined || v > gu[days[key]]) days[key] = i;
    });
    Object.values(days).forEach((i) => ctx.fillText(fmt(gu[i], 0), Math.min(Math.max(p.X(i), L + 12), L + p.pw - 12), Math.max(TOP + 12, Y(gu[i]) - 4)));
  }

  // ------------------------------------------------------------------
  // Pictogrammes du temps (une case toutes les k heures)
  // ------------------------------------------------------------------
  function icons() {
    const row = $("mg-icons");
    if (!row || !window.WxIcons) return;
    const w = row.clientWidth, pw = w - L - R;
    const k = [1, 2, 3, 6].find((s) => (pw / (N - 1)) * s >= 26) || 6;
    let html = "";
    for (let i = 0; i < N; i += k) {
      const code = S.weather_code[i];
      if (!isNum(code)) continue;
      const [label, ic] = WxIcons.WMO[code] || ["—", "cloud"];
      const x = L + (i / (N - 1)) * pw;
      const hh = WXT.fmt(T0 + i * 3600, { weekday: "short", hour: "2-digit", minute: "2-digit" });
      html += `<span class="mg-ic" style="left:${x.toFixed(1)}px" title="${esc(hh)} : ${esc(label)}">${WxIcons.icon(WxIcons.nightIcon(ic, S.is_day[i]), label)}</span>`;
    }
    row.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Infobulle
  // ------------------------------------------------------------------
  function showTip() {
    const tip = $("tip");
    if (!hover) { tip.hidden = true; return; }
    const i = hover.i, t = T0 + i * 3600, cum = CUM[i];
    const rows = [
      ["Température", isNum(S.temperature_2m[i]) ? `${fmt(S.temperature_2m[i], 1)} °C` : "—", window.TempScale && isNum(S.temperature_2m[i]) ? TempScale.stepColor(S.temperature_2m[i]) : css("--temp")],
      ["Humidité", isNum(S.relative_humidity_2m[i]) ? `${fmt(S.relative_humidity_2m[i], 0)} %` : "—", css("--hum")],
      ["Nébulosité", isNum(S.cloud_cover[i]) ? `${fmt(S.cloud_cover[i], 0)} %` : "—", css("--text-3")],
      ["Précipitations", `${fmt(S.precipitation[i], 1)} mm${S.showers[i] > 0 ? ` (dont averses ${fmt(S.showers[i], 1)})` : ""}`, css("--rain")],
      ["Cumul depuis le début", `${fmt(cum, 1)} mm`, css("--press")],
    ];
    if (S.snowfall[i] > 0 || S.snow_depth[i] > 0) rows.push(["Neige", `${fmt(S.snowfall[i], 1)} cm · au sol ${fmt((S.snow_depth[i] || 0) * 100, 0)} cm`, css("--wind")]);
    rows.push(["Vent", `${fmt(S.wind_speed_10m[i], 0)} km/h ${dirName(S.wind_direction_10m[i])} · rafales ${fmt(S.wind_gusts_10m[i], 0)} km/h`, css("--bad")]);
    if (isNum(S.freezing_level_height[i])) rows.push(["Isotherme 0 °C", `${Number(S.freezing_level_height[i]).toLocaleString("fr-FR")} m`, "#1d3fb8"]);
    // valeur sous le curseur dans les coupes en altitude
    const p = hover.panel;
    if (p && p.o.yOf && hover.y > TOP && hover.y < TOP + p.ph) {
      const z = p.o.yOf(hover.y), pts = column(i);
      const tz = interp(pts, "t", z), cc = interp(pts, "cc", z), u = interp(pts, "u", z), v = interp(pts, "v", z);
      const sp = isNum(u) && isNum(v) ? Math.hypot(u, v) : null;
      const from = isNum(u) && isNum(v) ? (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360 : null;
      rows.push([`À ${(Math.round(z / 10) * 10).toLocaleString("fr-FR")} m`, [isNum(tz) ? `${fmt(tz, 1)} °C` : "",
        isNum(cc) ? `nuages ${fmt(cc, 0)} %` : "", isNum(sp) ? `vent ${fmt(sp, 0)} km/h ${dirName(from)}` : ""].filter(Boolean).join(" · "), css("--text")]);
    }
    tip.innerHTML = `<div class="t">${WXT.fmt(t, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>` +
      rows.map(([k, v, c]) => `<div><i style="background:${esc(c)}"></i>${esc(k)} <b>${esc(v)}</b></div>`).join("");
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = hover.cx + 14, y = hover.cy - h - 12;
    if (x + w > innerWidth - 8) x = hover.cx - w - 14;
    if (y < 8) y = hover.cy + 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }

  // ------------------------------------------------------------------
  // Construction
  // ------------------------------------------------------------------
  function build() {
    const total = CUM[N - 1] || 0;
    const snowy = S.snowfall.some((v) => v > 0) || S.snow_depth.some((v) => v > 0);
    const fetched = WXT.fmt(D.fetched, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    $("mg-sub").textContent = `Open-Meteo · altitude du modèle ${isNum(D.elevation) ? Math.round(D.elevation) + " m" : "inconnue"} · données du ${fetched}`;
    const sec = (id, title, legend, h, extra = "") => `
      <section class="mg-panel">
        <h3>${title}${extra}</h3>
        <div class="mg-c" id="${id}" style="height:${h}px"></div>
        ${legend ? `<ul class="legend">${legend}</ul>` : ""}
      </section>`;
    const li = (c, t, cls = "") => `<li><i class="${cls}" style="background:${c}"></i>${t}</li>`;
    root.innerHTML = `
      ${D.stale ? `<p class="en-warn">Prévision précédente conservée (téléchargement en échec : ${esc(D.warning || "")}).</p>` : ""}
      <div class="mg-scroll"><div class="mg-inner">
        <div class="mg-icons" id="mg-icons" role="group" aria-label="Temps prévu"></div>
        ${sec("mg-temp", "Température à 2 m (°C)", "", 170)}
        ${sec("mg-cloud", "Couverture nuageuse selon l'altitude (m)",
          li(`linear-gradient(90deg,rgba(${cloudRGB()},.15),rgba(${cloudRGB()},.9))`, "nuages : de 10 à 100 % (plus foncé = plus couvert)") +
          li("var(--wind)", "isotherme 0 °C", "dash"), 200)}
        ${sec("mg-rain", "Précipitations (mm par heure)", li("var(--rain)", "précipitations") + li("var(--text-3)", "dont averses") +
          li("var(--press)", "cumul depuis le début (mm, échelle de droite)"), 140,
          ` <span class="mg-tot">cumul sur la période : <b>${fmt(total, 1)} mm</b></span>`)}
        ${snowy ? sec("mg-snow", "Neige (cm)", li("var(--wind)", "chute de neige (cm par heure)") + li("var(--press)", "épaisseur au sol"), 100)
                : `<section class="mg-panel"><h3>Neige</h3><p class="muted mg-none">Pas de neige prévue sur la période.</p></section>`}
        ${sec("mg-up", "Température et vent en altitude (m)",
          li("linear-gradient(90deg,#2f63c9,#a9d3f2,#e9f1f4,#f5cc63,#df5a2c)", "température (pivot 0 °C)") + li("#1d3fb8", "isotherme 0 °C") +
          li("rgba(15,15,15,.78)", "vent (flèche vers où il souffle, longueur selon la force)"), 300)}
        ${sec("mg-wind", "Vent à 10 m (km/h)", li("var(--text)", "vent moyen") + li("var(--bad)", "rafales") + li("var(--wind)", "direction"), 140)}
      </div></div>
      <p class="en-foot">Prévision automatique d'un modèle numérique, sans expertise humaine. Les coupes en altitude sont interpolées
        entre les niveaux de pression du modèle (${D.levels.length} niveaux, de ${D.levels[0] ? D.levels[0].p : "?"} à ${D.levels.length ? D.levels[D.levels.length - 1].p : "?"} hPa).</p>`;
    panels.length = 0;
    const add = (id, draw) => { const el = $(id); if (el) panels.push(new Panel(el, { draw })); };
    add("mg-temp", drawTemp);
    add("mg-cloud", drawClouds);
    add("mg-rain", drawRain);
    add("mg-snow", drawSnow);
    add("mg-up", drawUpperTemp);
    add("mg-wind", drawWind);
    renderAll();
  }
  function renderAll() { icons(); panels.forEach((p) => p.render()); }

  // liste déroulante des modèles (modèles en erreur : désactivés), reconstruite à chaque
  // relecture du fichier seulement (le focus reste sur la liste au changement de modèle)
  function modelBar() {
    const bar = $("mg-bar");
    if (!bar) return;
    bar.innerHTML = `<label for="mg-model">Modèle</label>
      <select id="mg-model">${ALL.models.map((m) => `<option value="${esc(m.id)}"${m.error ? " disabled" : ""}>${esc(m.label)}${m.error ? " (indisponible)" : ""}</option>`).join("")}</select>`;
    $("mg-model").addEventListener("change", (e) => { store.set(e.target.value); show(e.target.value); });
  }
  // affiche un modèle (identifiant) ; à défaut : modèle par défaut, puis premier disponible
  function show(id) {
    const ok = ALL.models.filter((m) => !m.error && m.n > 1 && m.surface);
    D = ok.find((m) => m.id === id) || ok.find((m) => m.id === ALL.default) || ok[0] || null;
    hover = null; CLD = null; TMP = null;
    const selEl = $("mg-model");
    if (selEl && D) selEl.value = D.id;
    if (!D) {
      const errs = ALL.models.map((m) => `${esc(m.label)} : ${esc(m.error || "prévision vide")}`).join(" ; ");
      root.innerHTML = `<p class="muted">Météogramme indisponible (${errs}).</p>`;
      return;
    }
    D.top = ALL.top;
    S = D.surface; N = D.n; T0 = D.t0;
    CUM = cumul();
    build();
  }

  async function load() {
    try {
      const r = await fetch("data/meteogram.json?_=" + Math.floor(Date.now() / 600000), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const all = await r.json();
      if (all.error) throw new Error(all.error);
      if (!Array.isArray(all.models) || !all.models.length) throw new Error("aucun modèle");
      if (ALL && all.generated && all.generated === ALL.generated) return;   // fichier inchangé
      ALL = all;
    } catch (e) {
      if (!ALL) root.innerHTML = `<p class="muted">Météogramme indisponible (${esc(e.message)}).</p>`;
      return;
    }
    if ($("gen") && ALL.version) $("gen").textContent = ` · calcul weewx-live ${ALL.version}`;
    modelBar();
    // modèle : celui déjà affiché, sinon ?model= dans l'adresse, sinon le dernier choisi
    show((D && D.id) || new URLSearchParams(location.search).get("model") || store.get());
  }

  // largeur modifiée : panneaux redessinés (pas de nouveau calcul des grilles)
  let rt = 0, rw = root.clientWidth;
  new ResizeObserver(() => {
    if (root.clientWidth === rw) return;
    rw = root.clientWidth;
    clearTimeout(rt); rt = setTimeout(() => { if (D) renderAll(); }, 120);
  }).observe(root);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (D) build(); });
  addEventListener("scroll", () => { if (hover) { hover = null; redrawAll(); showTip(); } }, { passive: true, capture: true });
  load();
  setInterval(load, 30 * 60 * 1000);
})();
