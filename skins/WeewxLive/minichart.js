/* MiniChart — petit moteur de graphiques canvas (ligne, aire, bande min–max, barres,
 * points, barres « Hi-Low ») avec réticule et infobulle (#tip), commun à toutes les pages ;
 * échelles de couleur des températures (window.TempScale). Aucune dépendance.
 *
 * Séries (communs : label, color = variable CSS ex. "--temp") :
 *   { type: "line", data: [[t, v], …], fill, width, endDot, tempScale, dash }  // dash : motif du trait ([7, 4]…)
 *   { type: "band", data: [[t, lo, hi], …], alpha, tempScale }   // aire entre deux courbes
 *   { type: "bar",  data: [[t, v] | [t, v, tFin], …], bucket, month } // tFin facultatif
 *   { type: "dots", data: [[t, v], …], r, alpha }           // nuage de points (direction du vent)
 *   { type: "range", data: [[t, lo, hi, moy], …], bucket, pointColor(p), midTick, valueLabels }
 *                                                            // barres « Hi-Low » flottantes
 *   axis: "right" : série sur une seconde échelle, graduée à droite (ex. cumul de pluie à côté
 *   des barres horaires) ; options y2 { floor, minRange, unit, decimals } ; ses graduations
 *   tombent sur les lignes de la grille de l'échelle de gauche
 *   maxGap (line, band) : écart maximal entre deux points d'un même tronçon (s), propre à
 *   la série (ex. cumul : jamais interrompu) ; sinon option maxGap du graphique
 *   noTip: true : série décorative, ignorée par le réticule et l'infobulle
 *   ghost: true : série non dessinée, présente seulement dans l'infobulle
 *   alpha (line) : opacité de la courbe ; tipRank : ordre dans l'infobulle (croissant)
 *   tempScale: true colore la courbe selon la valeur, par paliers de 3 °C (TempScale,
 *   TEMP_STEPS) — dégradé vertical sur l'axe Y. Une valeur null interrompt la courbe.
 * Unités : les données sont en unités métriques ; si « unit » (ou y2.unit) est une unité
 * convertible (°C, km/h, mm, mm/h, hPa, m, cm : WXU.groupOf, nav.js), le graphique affiche
 * l'unité choisie par le visiteur (copie convertie des séries, données intactes) ; floor,
 * ceil et minRange restent exprimés en unités métriques. ugroup : grandeur imposée (null : aucune).
 * Options : unit, decimals, floor, ceil, minRange, maxGap, padLeft, yTicks,
 *   span (fenêtre glissante, s) ou range [t0, t1] (fenêtre fixe),
 *   xTicks : "h6" | "day" | "week" | "month" | "list" (+ xTickList [{t, label}]),
 *   tipHead(t, série, point) -> en-tête de l'infobulle,
 *   yFixed [lo, hi, pas] (axe Y fixe), yFormat(v) (étiquettes Y), valueFormat(v) (valeur de l'infobulle)
 * Courbes masquées (temporairement, jusqu'au rechargement de la page) par un clic sur leur
 * légende : MiniChart.linkLegend(ul, graphique ou [graphiques]) ; chaque <li data-s="0,2">
 * masque / réaffiche les séries d'indices 0 et 2 (data-sc="1" : du 2e graphique de la liste).
 * Sans data-s, si la légende a autant d'éléments que le graphique de séries, l'élément i
 * correspond à la série i. Les séries masquées sont exclues de l'échelle et de l'infobulle.
 */
(function () {
  "use strict";

  // styles calculés de la racine (objet « vivant » : suit le thème clair / sombre)
  let rootStyle = null;
  const css = (name) => (rootStyle || (rootStyle = getComputedStyle(document.documentElement))).getPropertyValue(name).trim();
  // couleur utilisable par le canvas : « var(--x) » ou « --x » -> valeur de la variable CSS
  const canvasColor = (c) => {
    const m = /^(?:var\()?(--[\w-]+)\)?$/.exec(c || "");
    return m ? css(m[1]) : c;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const DARK_MQ = matchMedia("(prefers-color-scheme: dark)");

  function rgba(color, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  const fmtNum = (v, d) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "--");
  // dates et heures : fuseau de la station (WXT, nav.js)
  const fr = (t, o) => WXT.fmt(t, o);

  // Graduations X : [{t, label, align}]
  function xTicks(mode, t0, t1, list) {
    const out = [];
    if (mode === "list") return (list || []).filter((k) => k.t >= t0 && k.t <= t1).map((k) => Object.assign({ align: "center" }, k));
    if (mode === "h6") {
      for (let t = Math.ceil(t0 / 3600) * 3600; t <= t1; t += 3600) {
        const h = WXT.parts(t).h;
        if (h % 6 === 0) out.push({ t, label: String(h).padStart(2, "0") + " h", align: "center" });
      }
      return out;
    }
    let t = mode === "month" ? WXT.monthStart(t0) : WXT.midnight(t0);
    while (t <= t1) {
      if (t >= t0) {
        const p = WXT.parts(t);
        if (mode === "day") out.push({ t, label: fr(t, { weekday: "short", day: "numeric" }), align: "left" });
        else if (mode === "week") { if (p.wd === 1) out.push({ t, label: fr(t, { day: "numeric", month: "short" }), align: "left" }); }
        else if (mode === "month") {
          // janvier : on affiche l'année (utile sur 2 ans)
          const label = p.m === 1 ? String(p.y) : fr(t, { month: "short" }).replace(".", "");
          out.push({ t, label, align: "left", strong: p.m === 1 });
        }
      }
      t = mode === "month" ? WXT.addMonths(t, 1) : WXT.addDays(t, 1);
    }
    return out;
  }

  const tip = () => document.getElementById("tip");
  const hideTip = () => { const el = tip(); if (el) el.hidden = true; };

  class MiniChart {
    constructor(el, o) {
      this.el = el;
      this.o = Object.assign({ span: 86400, decimals: 1, maxGap: 1200, minRange: 1, xTicks: "h6" }, o);
      this.series = o.series;
      this.off = new Set();      // indices des séries masquées par le visiteur (légende)
      this.now = Date.now() / 1000;
      this.hover = null;
      this.canvas = document.createElement("canvas");
      el.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");

      this._ro = new ResizeObserver(() => this.draw());
      this._ro.observe(el);
      this._onTheme = () => this.draw();
      DARK_MQ.addEventListener("change", this._onTheme);

      // survol : un seul dessin par image (requestAnimationFrame)
      const move = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        this.hover = pt.clientX - r.left;
        this._pt = { clientX: pt.clientX, clientY: pt.clientY };
        if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); this.showTip(this._pt); });
      };
      const leave = () => {
        if (this.hover === null) return;
        this.hover = null; hideTip(); this.draw();
      };
      this._leave = leave;
      addEventListener("scroll", leave, { passive: true, capture: true });
      this.canvas.addEventListener("mousemove", move);
      this.canvas.addEventListener("mouseleave", leave);
      this.canvas.addEventListener("touchstart", move, { passive: true });
      this.canvas.addEventListener("touchmove", move, { passive: true });
      this.canvas.addEventListener("touchend", leave);
    }

    setNow(t) { this.now = t; }
    setRange(t0, t1) { this.o.range = [t0, t1]; }
    setSeries(series, opts) {
      // autre composition (nombre de séries) : courbes masquées réaffichées
      if (!series || !this.series || series.length !== this.series.length) this.off.clear();
      this.series = series; if (opts) Object.assign(this.o, opts);
      if (this.hover !== null) { this.hover = null; hideTip(); }
    }
    // libère les observateurs (graphique recréé ou retiré de la page)
    destroy() {
      this._ro.disconnect();
      DARK_MQ.removeEventListener("change", this._onTheme);
      removeEventListener("scroll", this._leave, { capture: true });
      this.canvas.remove();
    }

    geom() {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      const right = this.series.some((s) => s.axis === "right");
      return { w, h, l: this.o.padLeft || 36, r: right ? (this.o.padRight || 34) : 10, t: 8, b: 20 };
    }

    window() {
      if (this.o.range) return { t0: this.o.range[0], t1: this.o.range[1] };
      const t1 = this.now;
      return { t0: t1 - this.o.span, t1 };
    }

    static barEnd(s, p) { return p.length > 2 ? p[2] : p[0] + (s.bucket || 3600); }

    // échelle d'un ensemble de séries (par défaut : celles de l'échelle de gauche), options o
    yRange(list = this.series.filter((s) => s.axis !== "right"), o = this.o) {
      if (o.yFixed) { const [lo, hi, step] = o.yFixed; return { lo, hi, step }; }
      const { t0, t1 } = this.window();
      let lo = Infinity, hi = -Infinity;
      for (const s of list) {
        for (const p of s.data) {
          const tEnd = s.type === "bar" ? MiniChart.barEnd(s, p) : p[0];
          if (tEnd < t0 || p[0] > t1) continue;
          const vals = s.type === "band" || s.type === "range" ? [p[1], p[2]] : [p[1]];
          for (const v of vals) {
            if (v === null || v === undefined) continue;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
      }
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      // place pour les étiquettes de valeurs (barres Hi-Low)
      if (list.some((s) => s.valueLabels)) { const pad = (hi - lo) * 0.1; lo -= pad; hi += pad; }
      if (o.floor !== undefined) lo = o.floor;   // ex. 0 pour pluie, vent, rayonnement
      const minRange = o.minRange || 0;
      if (hi - lo < minRange) {
        const mid = (hi + lo) / 2;
        lo = mid - minRange / 2; hi = mid + minRange / 2;
        if (o.floor !== undefined && lo < o.floor) { hi += o.floor - lo; lo = o.floor; }
      }
      const step = niceStep(hi - lo, o.yTicks || this.o.yTicks || 3);
      lo = o.floor !== undefined && lo <= o.floor ? o.floor : Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
      if (o.ceil !== undefined) hi = Math.min(hi, o.ceil);
      return { lo, hi, step };
    }

    // seconde échelle (séries axis: "right") : autant d'intervalles que l'échelle de gauche,
    // pas « rond » (1, 1,5, 2, 2,5, 3, 4, 5, 6, 8 × 10^n) juste suffisant pour le maximum
    yRange2(left) {
      const list = this.series.filter((s) => s.axis === "right");
      if (!list.length) return null;
      const o = this._o2 || Object.assign({ floor: 0, minRange: 1 }, this.o.y2);
      const r = this.yRange(list, Object.assign({}, o, { ceil: undefined }));
      const n = Math.max(1, Math.round((left.hi - left.lo) / left.step));
      const raw = Math.max(r.hi - r.lo, o.minRange) / n;
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((v) => v >= raw - 1e-9) || 10 * p;
      const lo = r.lo;
      return { lo, hi: lo + step * n, step, o };
    }

    // Vue des séries dans les unités affichées (WXU) : copies converties, mises en cache tant
    // que les données d'origine ne changent pas ; chaque point converti garde l'original
    // (q._src : couleurs calculées en métrique, ex. pointColor) ; s._g : grandeur de la série.
    // Prépare aussi les options d'échelle converties (this._oL, this._o2) et les libellés.
    _view() {
      const W = window.WXU, o = this.o;
      const grp = (unit, forced) => (forced !== undefined ? forced : W ? W.groupOf(unit) : null);
      const gL = W ? grp(o.unit, o.ugroup) : null;
      const y2 = o.y2 || {};
      const gR = W ? grp(y2.unit ?? o.unit, y2.ugroup !== undefined ? y2.ugroup : o.ugroup) : null;
      const scaleOpts = (src, g) => {
        if (!g) return src;
        const out = Object.assign({}, src);
        for (const k of ["floor", "ceil"]) if (isNum(src[k])) out[k] = W.conv(g, src[k]);
        if (isNum(src.minRange)) out.minRange = W.delta(g, src.minRange);
        if (src.yFixed) out.yFixed = src.yFixed;
        return out;
      };
      this._oL = scaleOpts(o, gL);
      this._o2 = scaleOpts(Object.assign({ floor: 0, minRange: 1 }, y2), gR);
      this._u = {
        L: { d: gL ? W.dec(gL, o.decimals) : o.decimals, u: gL ? W.label(gL) : (o.unit || "") },
        R: { d: gR ? W.dec(gR, y2.decimals ?? o.decimals) : (y2.decimals ?? o.decimals), u: gR ? W.label(gR) : (y2.unit ?? o.unit ?? "") },
      };
      if (!gL && !gR) return this.series;
      this._vc = this._vc || new WeakMap();
      return this.series.map((s) => {
        const g = s.axis === "right" ? gR : gL;
        if (!g) return s;
        const u = W.get(g), src = s.data, n = src.length, last = n ? src[n - 1] : null;
        let c = this._vc.get(s);
        const lv = last ? String(last.slice(1)) : "";
        if (!c || c.src !== src || c.n !== n || c.last !== last || c.lv !== lv || c.u !== u) {
          const two = s.type === "band" || s.type === "range";
          const data = src.map((p) => {
            const q = p.slice(); q._src = p;
            if (isNum(q[1])) q[1] = W.conv(g, q[1]);
            if (two && isNum(q[2])) q[2] = W.conv(g, q[2]);
            if (s.type === "range" && isNum(q[3])) q[3] = W.conv(g, q[3]);
            return q;
          });
          c = { src, n, last, lv, u, view: Object.assign(Object.create(s), { data, _g: g }) };
          this._vc.set(s, c);
        }
        return c.view;
      });
    }

    // tronçons continus d'une courbe ; écart maximal : maxGap de la série, sinon du graphique
    segments(pts, maxGap = this.o.maxGap) {
      const segs = []; let cur = [];
      for (let i = 0; i < pts.length; i++) {
        // valeur manquante : interruption de la courbe
        if (!isNum(pts[i][1]) || (pts[i].length > 2 && !isNum(pts[i][2]))) { if (cur.length) segs.push(cur); cur = []; continue; }
        if (cur.length && pts[i][0] - cur[cur.length - 1][0] > maxGap) { segs.push(cur); cur = []; }
        cur.push(pts[i]);
      }
      if (cur.length) segs.push(cur);
      return segs;
    }

    // masque des séries (indices), ou les réaffiche si elles sont toutes masquées
    toggleSeries(idx) {
      const hide = !idx.every((i) => this.off.has(i));
      idx.forEach((i) => (hide ? this.off.add(i) : this.off.delete(i)));
      if (this.hover !== null) { this.hover = null; hideTip(); }
      this.draw();
    }

    // dessin dans les unités affichées : séries converties le temps du dessin (sans les
    // séries masquées)
    draw() {
      const src = this.series;
      if (this.off.size) this.series = src.filter((_s, i) => !this.off.has(i));
      this.series = this._view();
      try { this._draw(); } finally { this.series = src; }
    }

    _draw() {
      const g = this.geom();
      if (!g.w || !g.h) return;
      const dpr = window.devicePixelRatio || 1;
      const c = this.canvas, ctx = this.ctx;
      if (c.width !== Math.round(g.w * dpr) || c.height !== Math.round(g.h * dpr)) {
        c.width = Math.round(g.w * dpr); c.height = Math.round(g.h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);

      const { t0, t1 } = this.window();
      const left = this.yRange(undefined, this._oL);
      const { step } = left;
      let { lo, hi } = left;
      const pw = g.w - g.l - g.r, ph = g.h - g.t - g.b;
      const X = (t) => g.l + ((t - t0) / (t1 - t0)) * pw;
      const scale = (a, b) => (v) => g.t + (1 - (v - a) / (b - a || 1)) * ph;
      const YL = scale(lo, hi);
      let Y = YL;
      // seconde échelle (à droite) et échelle d'une série
      const r2 = this.yRange2(left), Y2 = r2 ? scale(r2.lo, r2.hi) : null;
      const axisOf = (s) => (r2 && s.axis === "right" ? { Y: Y2, lo: r2.lo, hi: r2.hi } : { Y: YL, lo: left.lo, hi: left.hi });
      this._g = { X, Y: YL, t0, t1, g, pw };

      const gridC = css("--grid"), muted = css("--text-3"), surface = css("--surface"), textC = css("--text");
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.lineWidth = 1;

      // Grille horizontale + étiquettes Y
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = muted;
      // décimales des étiquettes Y selon le pas (2,5 -> 1 décimale, 0,25 -> 2…)
      const yDec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (Math.abs(step / Math.pow(10, Math.floor(Math.log10(step) + 1e-9)) - 2.5) < 1e-6 ? 1 : 0));
      for (let v = lo; v <= hi + step * 1e-6; v += step) {
        const y = Math.round(Y(v)) + 0.5;
        ctx.strokeStyle = gridC;
        ctx.beginPath(); ctx.moveTo(g.l, y); ctx.lineTo(g.w - g.r, y); ctx.stroke();
        ctx.fillText(this.o.yFormat ? this.o.yFormat(v) : fmtNum(v, yDec), g.l - 6, y);
      }
      // étiquettes de la seconde échelle (à droite, couleur de sa première série)
      if (r2) {
        // décimales : juste ce qu'il faut pour écrire le pas (1,5 -> 1 ; 0,25 -> 2)
        const d2 = [0, 1, 2, 3].find((k) => Math.abs(r2.step * 10 ** k - Math.round(r2.step * 10 ** k)) < 1e-6) ?? 3;
        ctx.textAlign = "left"; ctx.fillStyle = css(this.series.find((s) => s.axis === "right").color) || muted;
        for (let v = r2.lo; v <= r2.hi + r2.step * 1e-6; v += r2.step) ctx.fillText(fmtNum(v, d2), g.w - g.r + 5, Math.round(Y2(v)) + 0.5);
        ctx.fillStyle = muted;
      }

      // Graduations X (étiquettes éclaircies si elles se chevauchent)
      ctx.textBaseline = "top";
      const ticks = xTicks(this.o.xTicks, t0, t1, this.o.xTickList);
      let every = 1;
      if (ticks.length > 1) {
        const widest = Math.max(...ticks.map((k) => ctx.measureText(k.label).width)) + 10;
        const spacing = pw / ticks.length;
        every = Math.max(1, Math.ceil(widest / spacing));
      }
      ticks.forEach((k, i) => {
        const x = Math.round(X(k.t)) + 0.5;
        ctx.strokeStyle = gridC;
        ctx.beginPath(); ctx.moveTo(x, g.t); ctx.lineTo(x, g.t + ph + 3); ctx.stroke();
        if (i % every) return;
        ctx.textAlign = k.align;
        const lx = k.align === "left" ? x + 3 : x;
        const lw = ctx.measureText(k.label).width;
        if (k.align === "left" && lx + lw > g.w) return;
        if (k.align === "center" && (lx + lw / 2 > g.w || lx - lw / 2 < 0)) return;
        ctx.fillText(k.label, lx, g.t + ph + 5);
      });

      ctx.save();
      ctx.beginPath(); ctx.rect(g.l, 0, pw + 1, g.h); ctx.clip();

      for (const s of this.series) {
        if (s.ghost) continue;          // infobulle seulement
        const col = css(s.color);
        ({ Y, lo, hi } = axisOf(s));    // échelle de la série (gauche ou droite)

        if (s.type === "bar") {
          ctx.fillStyle = col;
          for (const p of s.data) {
            const v = p[1], end = MiniChart.barEnd(s, p);
            if (!(v > 0) || end < t0 || p[0] > t1) continue;
            const slot = X(end) - X(p[0]);
            const bw = Math.max(1, Math.min(24, slot - 2));
            const x = X((p[0] + end) / 2) - bw / 2;
            const y = Y(v), y0 = Y(lo), h = Math.max(1, y0 - y);
            const r = Math.min(4, bw / 2, h);
            ctx.beginPath();
            ctx.moveTo(x, y0); ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.lineTo(x + bw - r, y); ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
            ctx.lineTo(x + bw, y0); ctx.closePath(); ctx.fill();
          }
          continue;
        }

        const pg = s.maxGap ?? this.o.maxGap;
        const pts = s.data.filter((p) => p[0] >= t0 - pg && p[0] <= t1 + pg);
        if (!pts.length) continue;

        if (s.type === "range") {
          // largeur : un créneau par point (bucket), 2 px d'écart, 24 px max.
          const slot = ((s.bucket || 86400) / (t1 - t0)) * pw;
          const gap = slot > 6 ? 2 : slot * 0.3;
          const bw = Math.max(1, Math.min(24, slot - gap));
          for (const p of pts) {
            if (p[1] === null || p[2] === null) continue;
            const x = X(p[0]) - bw / 2, yTop = Y(p[2]), yBot = Y(p[1]);
            const h = Math.max(1, yBot - yTop), r = Math.min(4, bw / 2, h / 2);
            ctx.fillStyle = s.pointColor ? canvasColor(s.pointColor(p._src || p)) : col;
            ctx.beginPath();
            if (r >= 1 && ctx.roundRect) ctx.roundRect(x, yTop, bw, h, r); else ctx.rect(x, yTop, bw, h);
            ctx.fill();
            // repère de la moyenne (p[3]) : petit trait cerclé de la couleur du fond
            if (s.midTick && p[3] !== null && p[3] !== undefined && bw >= 6) {
              const ym = Math.round(Y(p[3])) + 0.5, w = Math.max(4, bw - 6);
              ctx.fillStyle = surface; ctx.fillRect(X(p[0]) - w / 2 - 1, ym - 2.5, w + 2, 5);
              ctx.fillStyle = textC; ctx.fillRect(X(p[0]) - w / 2, ym - 1, w, 2);
            }
            // étiquettes max. (au-dessus) et min. (en dessous) si la place le permet
            if (s.valueLabels && bw >= 14) {
              ctx.save();
              ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
              ctx.fillStyle = muted; ctx.textAlign = "center";
              ctx.textBaseline = "bottom"; ctx.fillText(fmtNum(p[2], this._u ? this._u.L.d : this.o.decimals), X(p[0]), yTop - 2);
              ctx.textBaseline = "top"; ctx.fillText(fmtNum(p[1], this._u ? this._u.L.d : this.o.decimals), X(p[0]), yBot + 2);
              ctx.restore();
            }
          }
          continue;
        }

        if (s.type === "dots") {
          ctx.fillStyle = rgba(col, s.alpha || 0.75);
          for (const [t, v] of pts) {
            if (v === null || v === undefined) continue;
            ctx.beginPath(); ctx.arc(X(t), Y(v), s.r || 2, 0, Math.PI * 2); ctx.fill();
          }
          continue;
        }

        // dégradé vertical des températures (couleur selon la valeur, axe Y)
        // (paliers en °C : échelle Y et bornes ramenées en °C si la série est convertie)
        const toC = s._g === "temp" ? (v) => WXU.back("temp", v) : (v) => v;
        const Yc = s._g === "temp" ? (v) => Y(WXU.conv("temp", v)) : Y;
        const tg = s.tempScale && window.TempScale ? TempScale.gradient(ctx, Yc, toC(lo), toC(hi)) : null;

        if (s.type === "band") {
          ctx.fillStyle = tg ? tg.fill : rgba(col, s.alpha || 0.2);
          if (tg) ctx.globalAlpha = s.alpha || 0.22;
          for (const seg of this.segments(pts, s.maxGap ?? this.o.maxGap)) {
            ctx.beginPath();
            seg.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[2])) : ctx.moveTo(X(p[0]), Y(p[2]))));
            for (let i = seg.length - 1; i >= 0; i--) ctx.lineTo(X(seg[i][0]), Y(seg[i][1]));
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          continue;
        }

        for (const seg of this.segments(pts, s.maxGap ?? this.o.maxGap)) {
          if (s.fill && seg.length > 1) {
            ctx.beginPath();
            ctx.moveTo(X(seg[0][0]), Y(lo));
            for (const [t, v] of seg) ctx.lineTo(X(t), Y(v));
            ctx.lineTo(X(seg[seg.length - 1][0]), Y(lo));
            ctx.closePath();
            if (tg) { ctx.fillStyle = tg.fill; ctx.globalAlpha = 0.14; }
            else ctx.fillStyle = rgba(col, 0.1);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.beginPath();
          seg.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
          ctx.strokeStyle = tg ? tg.stroke : col; ctx.lineWidth = s.width || 2;
          ctx.lineJoin = "round"; ctx.lineCap = "round";
          if (s.alpha) ctx.globalAlpha = s.alpha;
          if (s.dash) ctx.setLineDash(s.dash);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        if (s.endDot !== false) {
          const [t, v] = pts[pts.length - 1];
          if (isNum(v)) dot(ctx, X(t), Y(v), tg ? TempScale.lineColor(toC(v)) : col, surface);
        }
      }
      ctx.restore();
      ({ Y, lo, hi } = axisOf({}));

      // Réticule
      this._hits = [];
      if (this.hover !== null) {
        const hx = Math.max(g.l, Math.min(g.l + pw, this.hover));
        const ht = t0 + ((hx - g.l) / pw) * (t1 - t0);
        for (const s of this.series) {
          if (s.noTip) continue;     // série décorative (fond, repère) : ni réticule ni infobulle
          const p = nearest(s, ht, Math.max(this.o.maxGap || 0, s.bucket || 0));
          if (p) this._hits.push({ s, p });
        }
        if (this._hits.some((h) => h.s.tipRank !== undefined)) {
          this._hits.sort((a, b) => (a.s.tipRank || 0) - (b.s.tipRank || 0));
        }
        const ref = this._hits[0];
        if (ref) {
          const x = Math.round(X(center(ref.s, ref.p))) + 0.5;
          ctx.strokeStyle = muted; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, g.t); ctx.lineTo(x, g.t + ph); ctx.stroke();
          for (const { s, p } of this._hits) {
            if (!isNum(p[1]) || s.ghost) continue;
            const ts = s.tempScale && window.TempScale;
            const toC = s._g === "temp" ? (v) => WXU.back("temp", v) : (v) => v;
            const col = (v) => (ts ? TempScale.lineColor(toC(v)) : css(s.color));
            const Ys = axisOf(s).Y;
            if (s.type === "line" || s.type === "dots") dot(ctx, X(p[0]), Ys(p[1]), col(p[1]), surface);
            else if (s.type === "band") { dot(ctx, X(p[0]), Ys(p[1]), col(p[1]), surface, 3); dot(ctx, X(p[0]), Ys(p[2]), col(p[2]), surface, 3); }
          }
        }
      }
    }

    showTip(e) {
      const el = tip();
      if (!el) return;
      if (!this._hits || !this._hits.length) { el.hidden = true; return; }
      const { s, p } = this._hits[0];
      const tc = center(s, p);
      let head;
      if (this.o.tipHead) head = this.o.tipHead(tc, s, p);
      else if (s.type === "bar") head = `${fr(p[0], { hour: "2-digit", minute: "2-digit" })} – ${fr(MiniChart.barEnd(s, p), { hour: "2-digit", minute: "2-digit" })}`;
      else head = fr(p[0], { weekday: "short", hour: "2-digit", minute: "2-digit" });
      const rows = this._hits.map(({ s, p }) => {
        // unité et décimales affichées (WXU) ; seconde échelle : options y2
        const U = (this._u || {})[s.axis === "right" ? "R" : "L"] || { d: this.o.decimals, u: this.o.unit || "" };
        const d = U.d, u = esc(U.u);
        const toC = s._g === "temp" ? (v) => WXU.back("temp", v) : (v) => v;
        const val = this.o.valueFormat ? `<b>${this.o.valueFormat(p[1])}</b>`
          : s.type === "range" && s.midTick && p[3] !== null && p[3] !== undefined
            ? `<b>${fmtNum(p[1], d)}</b> – <b>${fmtNum(p[2], d)}</b> ${u} · moy. <b>${fmtNum(p[3], d)}</b> ${u}`
          : s.type === "band" || s.type === "range" ? `<b>${fmtNum(p[1], d)}</b> – <b>${fmtNum(p[2], d)}</b> ${u}`
          : `<b>${fmtNum(p[1], d)}</b> ${u}`;
        const sw = s.pointColor ? s.pointColor(p._src || p)
          : s.tempScale && window.TempScale ? TempScale.stepColor(toC(s.type === "band" ? (p[1] + p[2]) / 2 : p[1])) : css(s.color);
        return `<div><i style="background:${esc(sw)}"></i>${esc(s.label)} ${val}</div>`;
      });
      el.innerHTML = `<div class="t">${head}</div>${rows.join("")}`;
      el.hidden = false;
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = e.clientX + 14, y = e.clientY - h - 12;
      if (x + w > innerWidth - 8) x = e.clientX - w - 14;
      if (y < 8) y = e.clientY + 16;
      el.style.left = x + "px"; el.style.top = y + "px";
    }
  }

  // ------------------------------------------------------------------
  // Légendes cliquables : masquer / réafficher une courbe
  // ------------------------------------------------------------------
  const chartsOf = (ul) => (ul && ul._mc ? ul._mc : []);
  function syncLegend(ul) {
    const cs = chartsOf(ul);
    ul.querySelectorAll(":scope > li[data-s]").forEach((li) => {
      const c = cs[+(li.dataset.sc || 0)];
      // un graphique d'une seule série : rien à masquer
      if (!c || !c.series || c.series.length < 2) { li.classList.remove("lg-tg", "lg-off"); li.removeAttribute("role"); li.removeAttribute("tabindex"); return; }
      const idx = li.dataset.s.split(",").map(Number);
      const off = idx.every((i) => c.off.has(i));
      const name = li.textContent.replace(/\s+/g, " ").trim();
      li.classList.add("lg-tg");
      li.classList.toggle("lg-off", off);
      li.setAttribute("role", "button");
      li.tabIndex = 0;
      li.setAttribute("aria-pressed", String(!off));
      li.title = `${off ? "Afficher" : "Masquer"} « ${name} » sur le graphique`;
    });
  }
  // relie une légende (ul) à un ou plusieurs graphiques ; à rappeler après chaque
  // reconstruction de la légende (état des éléments réappliqué)
  MiniChart.linkLegend = (ul, charts) => {
    if (!ul) return;
    const cs = (Array.isArray(charts) ? charts : [charts]).filter(Boolean);
    if (!cs.length) return;
    ul._mc = cs;
    const lis = [...ul.children].filter((x) => x.tagName === "LI");
    if (!lis.some((x) => x.dataset.s !== undefined) && cs[0].series && lis.length === cs[0].series.length) {
      lis.forEach((x, i) => (x.dataset.s = String(i)));
    }
    syncLegend(ul);
  };
  function onLegend(e) {
    const li = e.target.closest && e.target.closest("li.lg-tg[data-s]");
    if (!li) return;
    if (e.type === "keydown") {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
    }
    const ul = li.parentElement, c = chartsOf(ul)[+(li.dataset.sc || 0)];
    if (!c) return;
    c.toggleSeries(li.dataset.s.split(",").map(Number));
    syncLegend(ul);
  }
  document.addEventListener("click", onLegend);
  document.addEventListener("keydown", onLegend);

  function center(s, p) {
    return s.type === "bar" ? (p[0] + MiniChart.barEnd(s, p)) / 2 : p[0];
  }

  function dot(ctx, x, y, col, surface, r = 4) {
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fillStyle = surface; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  }

  // point le plus proche de t (null si trop éloigné : pas de réticule au-dessus d'un trou)
  function nearest(s, t, maxGap) {
    const a = s.data;
    if (!a.length) return null;
    if (s.type === "bar") {
      for (const p of a) if (t >= p[0] && t < MiniChart.barEnd(s, p)) return p;
      return null;
    }
    let lo = 0, hi = a.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (a[m][0] < t) lo = m; else hi = m;
    }
    const p = Math.abs(a[lo][0] - t) <= Math.abs(a[hi][0] - t) ? a[lo] : a[hi];
    return maxGap && Math.abs(p[0] - t) > maxGap ? null : p;
  }

  window.MiniChart = MiniChart;

  // ------------------------------------------------------------------
  // Échelles de couleur des températures (window.TempScale)
  //   TEMP_STOPS : échelle continue — barres Hi-Low (pages de détail 30 / 365 / 730 j,
  //                « au fil des ans »), légende legend(), pastille hiloSwatch()
  //   TEMP_STEPS : paliers de 3 °C — courbes (tempScale), chiffres (textColor),
  //                légende stepLegend(), pastille swatch()
  // ------------------------------------------------------------------
  window.TempScale = (function () {
  // Couleur d'une température, interpolée entre les paliers. Trois familles séparées par
  // des ruptures nettes (deux paliers à la même valeur) :
  //   ≤ 0 °C : bleus (du plus foncé au plus clair) ; 0 – 10 °C : verts ;
  //   > 10 °C : du jaune (10 °C) à l'orange puis au rouge (40 °C).
  // Deux jeux : thème clair / sombre (teintes éclaircies sur fond sombre).
  const TEMP_STOPS = {
    light: [[-10, "#0b2a7a"], [-5, "#1a4fc4"], [0, "#5b9be8"],
            [0, "#2e8b57"], [10, "#7cb342"],
            [10, "#e6b800"], [20, "#f28c1e"], [27, "#e8501a"], [33, "#c81e1e"], [40, "#7a0a0a"]],
    dark:  [[-10, "#2f5fe0"], [-5, "#4a7ef0"], [0, "#7fb2f5"],
            [0, "#3fa86b"], [10, "#8fcc4f"],
            [10, "#ffd21a"], [20, "#ffa02a"], [27, "#ff6a2a"], [33, "#ff3b30"], [40, "#ff4d6d"]],
  };
  const darkMode = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : DARK_MQ.matches;
  };
  function color(v) {
    const st = TEMP_STOPS[darkMode() ? "dark" : "light"];
    if (v <= st[0][0]) return st[0][1];
    if (v >= st[st.length - 1][0]) return st[st.length - 1][1];
    let i = 0; while (v > st[i + 1][0]) i++;
    const [v0, c0] = st[i], [v1, c1] = st[i + 1], f = (v - v0) / (v1 - v0);
    const a = parseInt(c0.slice(1), 16), b = parseInt(c1.slice(1), 16);
    const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - f) + ((b >> sh) & 255) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  // graduations et libellés des légendes dans l'unité choisie (WXU, nav.js) ; positions en °C
  const tU = () => (window.WXU ? WXU.get("temp") : "°C");
  const tLab = (v) => (window.WXU ? WXU.fmt("temp", v, 0) : String(v)).replace("-", "−");
  function legend() {
    // dégradé et graduations proportionnels aux valeurs (paliers non équidistants)
    const st = TEMP_STOPS[darkMode() ? "dark" : "light"];
    const v0 = st[0][0], v1 = st[st.length - 1][0], pos = (v) => ((v - v0) / (v1 - v0)) * 100;
    const grad = st.map(([v, c]) => `${c} ${pos(v).toFixed(1)}%`).join(", ");
    const ticks = [-10, 0, 10, 20, 30, 40].filter((v) => v >= v0 && v <= v1)
      .map((v) => `<span style="left:${pos(v).toFixed(1)}%">${tLab(v)}</span>`).join("");
    return `<span class="tscale"><span class="tscale-bar" style="background:linear-gradient(90deg, ${grad})"></span>` +
      `<span class="tscale-lab">${ticks}</span></span> couleur : moyenne du jour (${tU()})`;
  }
  // ------------------------------------------------------------------
  // Paliers de 3 °C (courbes et chiffres de température) : une couleur fixe par tranche,
  // [borne supérieure incluse, couleur] — v reçoit la couleur de la première tranche
  // dont la borne est ≥ v ; au-delà de la dernière borne, la dernière couleur.
  //   ≤ 0 °C : bleus ; 0 – 10 °C : verts ; > 10 °C : du jaune au rouge (tranches de 3 °C
  //   à partir de 10 °C, jusqu'à 40 °C). La tranche 6 – 10 °C fait 4 °C pour que la
  //   limite des verts tombe à 10 °C.
  // ------------------------------------------------------------------
  const TEMP_STEPS = {
    light: [[-9, "#0b2a7a"], [-6, "#1640a8"], [-3, "#2463d0"], [0, "#5b9be8"],
            [3, "#2e8b57"], [6, "#4f9e48"], [10, "#7cb342"],
            [13, "#e6c200"], [16, "#e6a800"], [19, "#f29400"], [22, "#f27f1e"], [25, "#ec6a1a"],
            [28, "#e5531a"], [31, "#d9381a"], [34, "#c81e1e"], [37, "#a51212"], [40, "#7a0a0a"]],
    dark:  [[-9, "#2f5fe0"], [-6, "#4a7ef0"], [-3, "#6a9cf3"], [0, "#8fbdf7"],
            [3, "#3fa86b"], [6, "#62b85a"], [10, "#8fcc4f"],
            [13, "#ffd21a"], [16, "#ffbf1a"], [19, "#ffa82a"], [22, "#ff922a"], [25, "#ff7a2a"],
            [28, "#ff632a"], [31, "#ff4d2e"], [34, "#ff3b30"], [37, "#ff3f55"], [40, "#ff4d6d"]],
  };
  const steps = () => TEMP_STEPS[darkMode() ? "dark" : "light"];
  function stepColor(v) {
    const st = steps();
    for (const [up, c] of st) if (v <= up) return c;
    return st[st.length - 1][1];
  }
  // Chiffres : 95 % de la couleur de la tranche, 5 % de la couleur du texte
  // (très légèrement assombrie en thème clair, éclaircie en thème sombre).
  function textColor(v) {
    return `color-mix(in oklab, ${stepColor(v)} 95%, var(--text))`;
  }
  // Courbes (canvas : pas de color-mix ni de variables CSS) : même mélange, 95 %.
  const rgbOf = (c) => {
    const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const r = /rgba?\(([^)]+)\)/.exec(c);
    return r ? r[1].split(",").slice(0, 3).map(Number) : [128, 128, 128];
  };
  const textRgb = () => rgbOf(css("--text") || "#000");
  function lineColor(v, k = 0.95, b = textRgb()) {
    const a = rgbOf(stepColor(v));
    return `rgb(${a.map((x, i) => Math.round(x * k + b[i] * (1 - k))).join(",")})`;
  }
  // Dégradé vertical canvas en paliers : couleur fixe par tranche, rupture nette à chaque
  // borne (Y : valeur -> pixel)
  function gradient(ctx, Y, lo, hi) {
    const y0 = Y(lo), y1 = Y(hi);
    if (!isFinite(y0) || !isFinite(y1) || y0 === y1) return null;
    const stroke = ctx.createLinearGradient(0, y0, 0, y1), fill = ctx.createLinearGradient(0, y0, 0, y1);
    const txt = textRgb(), eps = (hi - lo) * 1e-5, off = (v) => (v - lo) / (hi - lo);
    const add = (v, at) => { stroke.addColorStop(at, lineColor(v, 0.95, txt)); fill.addColorStop(at, stepColor(v)); };
    add(lo, 0);
    for (const [up] of steps()) {
      if (up > lo && up < hi) { add(up, off(up)); add(up + eps, Math.min(1, off(up) + 1e-6)); }
    }
    add(hi, 1);
    return { stroke, fill };
  }
  // Pastille de légende (HTML) d'une courbe : quatre tranches représentatives
  // (froid, frais, doux, chaud)
  function swatch(band) {
    const c = [-2, 5, 14, 24].map(stepColor);
    const grad = `linear-gradient(90deg, ${c.map((x, i) => `${x} ${i * 25}% ${(i + 1) * 25}%`).join(", ")})`;
    return `<i class="${band ? "band " : ""}tgrad" style="background:${grad}${band ? ";opacity:.45" : ""}"></i>`;
  }
  // Pastille de légende des barres Hi-Low (échelle continue, chaud en haut)
  function hiloSwatch() {
    const st = TEMP_STOPS[darkMode() ? "dark" : "light"];
    return `<i class="hilo" style="background:linear-gradient(0deg, ${st[0][1]}, ${st[Math.floor(st.length / 2)][1]}, ${st[st.length - 1][1]})"></i>`;
  }
  // Légende des courbes : tranches de 3 °C, largeur proportionnelle (de −12 à 40 °C)
  function stepLegend() {
    const st = steps(), v0 = -12, v1 = 40, pos = (v) => ((Math.max(v0, Math.min(v1, v)) - v0) / (v1 - v0)) * 100;
    let prev = v0;
    const grad = st.map(([up, c]) => { const s = `${c} ${pos(prev).toFixed(1)}% ${pos(up).toFixed(1)}%`; prev = up; return s; }).join(", ");
    const ticks = [-9, 0, 10, 19, 28, 40].map((v) => `<span style="left:${pos(v).toFixed(1)}%">${tLab(v)}</span>`).join("");
    const w = (window.WXU ? WXU.delta("temp", 3) : 3).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    return `<span class="tscale"><span class="tscale-bar" style="background:linear-gradient(90deg, ${grad})"></span>` +
      `<span class="tscale-lab">${ticks}</span></span> couleur : tranches de ${w} ${tU()}`;
  }
  return { color, stepColor, textColor, lineColor, gradient, swatch, hiloSwatch, legend, stepLegend, darkMode };
  })();
})();
