/* weewx-live — tableau de bord : prévisions Open-Meteo (best match),
 * radar et satellite : cartes Windy.com intégrées (par défaut), ou animations
 * RainViewer (radar) et EUMETSAT / EUMETView (satellite).
 * Prévisions : data/forecast.json publié par weewx (cache), sinon appel direct à
 * Open-Meteo avec cache dans le navigateur. Cartes : services tiers appelés par le navigateur. */
(function () {
  "use strict";

  const DEMO = new URLSearchParams(location.search).has("demo");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DARK = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };

  const DEFAULTS = {
    latitude: 48.11, longitude: -1.68,
    forecast: { enable: true, model: "best_match", days: 7, cache: 3600 },
    radar: { enable: true, provider: "windy", overlay: "radar", product: "radar", windyUrl: "", zoom: 7, frames: 13, delay: 500 },
    satellite: {
      enable: true, provider: "windy", overlay: "satellite", product: "satellite", windyUrl: "", url: "https://view.eumetsat.int/geoserver/wms",
      layers: [{ name: "mtg_fd:ir105_hrfi", label: "Infrarouge" }, { name: "mtg_fd:rgb_truecolour", label: "Couleurs vraies" }],
      zoom: 5, frames: 12, step: 10, latency: 30, delay: 400,
    },
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v, d = 0) => (v === null || v === undefined || isNaN(v)) ? "--"
    : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const hm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // configuration intégrée à la page ou requête partagée avec nav.js (window.weewxConfig)
  async function getConfig() {
    let c = window.WEEWX_CONFIG || null;
    if (!c && window.weewxConfig) c = await window.weewxConfig.catch(() => null);
    c = c || {};
    const out = {};
    for (const k of Object.keys(DEFAULTS)) {
      out[k] = typeof DEFAULTS[k] === "object" ? Object.assign({}, DEFAULTS[k], c[k] || {}) : (c[k] ?? DEFAULTS[k]);
    }
    if (!out.satellite.layers || !out.satellite.layers.length) out.satellite.layers = DEFAULTS.satellite.layers;
    return out;
  }

  // ==================================================================
  // Prévisions Open-Meteo
  // ==================================================================
  // codes WMO et pictogrammes : wxicons.js (partagés avec le météogramme)
  const { WMO, nightIcon, icon } = window.WxIcons;

  const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const dirName = (d) => (d === null || d === undefined ? "" : DIRS[Math.round(d / 22.5) % 16]);

  // Prévisions : 1) fichier data/forecast.json publié par weewx (cache serveur partagé
  // par tous les visiteurs) ; 2) à défaut, appel direct à Open-Meteo avec un cache
  // dans le navigateur (localStorage) de même durée ; 3) en dernier recours, la
  // dernière copie locale, même périmée.
  async function getForecast(cfg) {
    const f = cfg.forecast;
    const ttl = Math.max(60, +f.cache || 3600) * 1000;
    if (!DEMO) {
      try {
        const r = await fetch("data/forecast.json?_=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j.daily && j.hourly) return Object.assign(j, { from: "weewx" });
        }
      } catch (e) { /* on passe à l'appel direct */ }
    }
    const p = new URLSearchParams({
      latitude: cfg.latitude, longitude: cfg.longitude,
      daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum",
        "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max",
        "wind_direction_10m_dominant", "sunrise", "sunset", "uv_index_max"].join(","),
      hourly: ["temperature_2m", "weather_code", "precipitation", "precipitation_probability",
        "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "relative_humidity_2m", "is_day"].join(","),
      models: f.model, timezone: "auto", forecast_days: f.days,
    });
    const url = "https://api.open-meteo.com/v1/forecast?" + p;
    const key = "weewx-live:forecast";
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(key)); } catch (e) { /* stockage indisponible */ }
    if (stored && stored.url === url && Date.now() - stored.fetched < ttl) {
      return Object.assign(stored.data, { fetched: stored.fetched / 1000, from: "cache" });
    }
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.reason || "HTTP " + r.status);
      const now = Date.now();
      try { localStorage.setItem(key, JSON.stringify({ url, fetched: now, data: { daily: j.daily, hourly: j.hourly } })); } catch (e) { /* quota */ }
      return { daily: j.daily, hourly: j.hourly, fetched: now / 1000, from: "open-meteo" };
    } catch (e) {
      if (stored && stored.url === url) return Object.assign(stored.data, { fetched: stored.fetched / 1000, from: "cache", stale: true });
      throw e;
    }
  }

  // changement de thème clair / sombre : couleurs des températures recalculées
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!fc.daily || !fc.f) return;
    renderForecast(fc.daily, fc.f);
    if (fc.open !== null) openDay(fc.open, true);
  });

  async function loadForecast(cfg) {
    const f = cfg.forecast;
    try {
      const j = await getForecast(cfg);
      fc.updated = "";
      if (j.fetched) {
        const t = new Date(j.fetched * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        fc.updated = ` · mises à jour à ${t}${j.stale ? " (copie précédente)" : ""}`;
      }
      renderForecast(j.daily, f);
      fc.daily = j.daily; fc.hourly = j.hourly;
      if (fc.open !== null) openDay(fc.open, true);
    } catch (e) {
      $("forecast").innerHTML = `<p class="muted">Prévisions indisponibles (${esc(e.message)}).</p>`;
    }
  }

  // Couleur des températures : paliers de 3 °C (TempScale.textColor, minichart.js)
  // (valeur arrondie comme à l'affichage : « 0° » reste bleu même pour 0,3 °C)
  const tcol = (v) => (window.TempScale && v !== null && v !== undefined && !isNaN(v) ? ` style="color:${TempScale.textColor(Math.round(v))}"` : "");
  const tstep = (v) => (window.TempScale ? TempScale.stepColor(v) : "var(--temp)");

  function renderForecast(d, f) {
    fc.f = f;
    const n = d.time.length;
    const tmin = Math.min(...d.temperature_2m_min.filter((v) => v !== null));
    const tmax = Math.max(...d.temperature_2m_max.filter((v) => v !== null));
    const span = Math.max(1, tmax - tmin);
    const today = new Date().toLocaleDateString("sv-SE");   // AAAA-MM-JJ local
    const days = [];
    for (let i = 0; i < n; i++) {
      const date = new Date(d.time[i] + "T12:00:00");
      const [label, ic] = WMO[d.weather_code[i]] || ["—", "cloud"];
      const name = d.time[i] === today ? "Aujourd'hui"
        : date.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
      const short = d.time[i] === today ? "Auj." : date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(/^./, (c) => c.toUpperCase());
      const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
      const left = ((lo - tmin) / span) * 100, width = Math.max(4, ((hi - lo) / span) * 100);
      const pr = d.precipitation_sum[i], pp = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      const wd = d.wind_direction_10m_dominant[i];
      days.push(`
        <li><button type="button" class="fc-day" data-i="${i}" aria-expanded="false" aria-controls="fc-hours" title="${esc(label)} — détail heure par heure">
          <span class="fc-when"><b><span class="long">${esc(name)}</span><span class="short">${esc(short)}</span></b><span>${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span></span>
          ${icon(ic, label)}
          <span class="fc-desc">${esc(label)}</span>
          <span class="fc-temp"><b${tcol(hi)}>${fmt(hi)}°</b><span${tcol(lo)}>${fmt(lo)}°</span></span>
          <span class="fc-bar" aria-hidden="true"><i style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:linear-gradient(90deg, ${tstep(lo)}, ${tstep(hi)})"></i></span>
          <span class="fc-rain${pr > 0 ? "" : " dry"}"><span>${fmt(pr, 1)} mm</span>${pp !== null && pp !== undefined ? `<span class="pp">${fmt(pp)} %</span>` : ""}</span>
          <span class="fc-wind">${wd !== null ? `<svg viewBox="0 0 12 12" aria-hidden="true" style="transform:rotate(${wd + 180}deg)"><path d="M6 1l3.5 9L6 8 2.5 10z"/></svg>` : ""}
            ${fmt(d.wind_speed_10m_max[i])} km/h ${esc(dirName(wd))}<span>raf. ${fmt(d.wind_gusts_10m_max[i])}</span></span>
        </button></li>`);
    }
    $("forecast").innerHTML = `<ol class="fc" style="--n:${n}">${days.join("")}</ol>
      <p class="fc-tip">Choisissez un jour pour voir les prévisions heure par heure.</p>`;
    $("forecast").querySelectorAll(".fc-day").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i;
      if (fc.open === i) closeDay(); else openDay(i);
    }));
    const i0 = d.time.indexOf(today);
    $("fc-sun").textContent = i0 >= 0
      ? `Lever ${hm(d.sunrise[i0])} · coucher ${hm(d.sunset[i0])}${d.uv_index_max && d.uv_index_max[i0] !== null ? ` · UV max. ${fmt(d.uv_index_max[i0])}` : ""}`
      : "";
    $("fc-model").textContent = (f.model === "best_match" ? "modèle « best match »" : "modèle " + f.model) + (fc.updated || "");
  }

  // ------------------------------------------------------------------
  // Détail heure par heure d'un jour
  // ------------------------------------------------------------------
  const fc = { daily: null, hourly: null, open: null, charts: null, f: null, updated: "" };

  function hourlyCharts() {
    if (fc.charts || !window.MiniChart) return fc.charts;
    // en-tête d'infobulle : heure (courbe) ou tranche horaire (barres, centrées sur la demi-heure)
    const dayTip = (t, s) => (s.type === "bar" ? `${hm((t - 1800) * 1000)} – ${hm((t + 1800) * 1000)}` : hm(t * 1000));
    fc.charts = {
      temp: new MiniChart($("fh-temp"), {
        unit: "°C", decimals: 1, minRange: 4, xTicks: "h6", maxGap: 7200, tipHead: dayTip,
        series: [{ type: "line", fill: true, tempScale: true, label: "Température", color: "--temp", endDot: false, data: [] }],
      }),
      rain: new MiniChart($("fh-rain"), {
        unit: "mm", decimals: 1, floor: 0, minRange: 1, xTicks: "h6", tipHead: dayTip,
        series: [{ type: "bar", label: "Précipitations", color: "--rain", bucket: 3600, data: [] }],
      }),
    };
    return fc.charts;
  }

  function openDay(i, keepScroll) {
    const d = fc.daily, h = fc.hourly;
    if (!d || !h || !d.time[i]) return;
    fc.open = i;
    $("forecast").querySelectorAll(".fc-day").forEach((b) => b.setAttribute("aria-expanded", String(+b.dataset.i === i)));
    const day = d.time[i];
    const idx = [];
    h.time.forEach((t, k) => { if (t.startsWith(day)) idx.push(k); });
    const ts = (k) => new Date(h.time[k]).getTime() / 1000;

    const date = new Date(day + "T12:00:00");
    $("fh-title").textContent = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
      .replace(/^./, (c) => c.toUpperCase()) + " — heure par heure";

    // Graphiques (température ; précipitations, cumul de l'heure écoulée)
    const panel = $("fc-hours");
    panel.hidden = false;
    const ch = hourlyCharts();
    if (ch && idx.length) {
      const t0 = new Date(day + "T00:00:00").getTime() / 1000, t1 = t0 + 86400;
      ch.temp.setSeries([Object.assign(ch.temp.series[0], { data: idx.map((k) => [ts(k), h.temperature_2m[k]]).filter((p) => p[1] !== null) })], { range: [t0, t1] });
      ch.rain.setSeries([Object.assign(ch.rain.series[0], { data: idx.map((k) => [ts(k) - 3600, h.precipitation[k] || 0, ts(k)]) })], { range: [t0, t1] });
      $("fh-rainbox").classList.toggle("no-rain", !idx.some((k) => h.precipitation[k] > 0));
      ch.temp.draw(); ch.rain.draw();
    }

    // Bandeau des 24 heures
    const nowH = Math.floor(Date.now() / 3600000) * 3600;
    $("fh-strip").innerHTML = idx.map((k) => {
      const t = ts(k);
      const [label, ic] = WMO[h.weather_code[k]] || ["—", "cloud"];
      const pr = h.precipitation[k], pp = h.precipitation_probability ? h.precipitation_probability[k] : null;
      const wd = h.wind_direction_10m[k];
      return `<li class="fh-hour${t === nowH ? " now" : ""}${t < nowH ? " past" : ""}" data-t="${t}">
        <span class="fh-h">${t === nowH ? "Maint." : new Date(t * 1000).getHours() + " h"}</span>
        ${icon(nightIcon(ic, h.is_day ? h.is_day[k] : 1), label)}
        <b class="fh-t"${tcol(h.temperature_2m[k])}>${fmt(h.temperature_2m[k])}°</b>
        <span class="fh-r${pr > 0 ? "" : " dry"}">${fmt(pr, 1)} mm${pp !== null && pp !== undefined ? `<small>${fmt(pp)} %</small>` : ""}</span>
        <span class="fh-w">${wd !== null ? `<svg viewBox="0 0 12 12" aria-hidden="true" style="transform:rotate(${wd + 180}deg)"><path d="M6 1l3.5 9L6 8 2.5 10z"/></svg>` : ""}${fmt(h.wind_speed_10m[k])}<small>raf. ${fmt(h.wind_gusts_10m[k])}</small></span>
        <span class="fh-hu">${fmt(h.relative_humidity_2m[k])} %</span>
      </li>`;
    }).join("");
    const strip = $("fh-strip");
    const first = strip.querySelector(".now") || strip.querySelector("li:not(.past)");
    if (first && !keepScroll) strip.scrollLeft = Math.max(0, first.offsetLeft - strip.offsetLeft - 8);
    if (!keepScroll) panel.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
  }

  function closeDay() {
    fc.open = null;
    $("fc-hours").hidden = true;
    $("forecast").querySelectorAll(".fc-day").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }

  // ==================================================================
  // Cartes animées (Leaflet)
  // ==================================================================
  function loadAsset(tag, attrs) {
    return new Promise((ok) => {
      const e = document.createElement(tag);
      Object.assign(e, attrs);
      e.onload = () => ok(true); e.onerror = () => ok(false);
      document.head.appendChild(e);
    });
  }
  let leafletPromise = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(true);
    if (!leafletPromise) {
      leafletPromise = (async () => {
        await loadAsset("link", { rel: "stylesheet", href: "vendor/leaflet/leaflet.css" });
        if (!(await loadAsset("script", { src: "vendor/leaflet/leaflet.js" })) || !window.L) {
          await loadAsset("link", { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" });
          await loadAsset("script", { src: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" });
        }
        return !!window.L;
      })();
    }
    return leafletPromise;
  }

  function baseMap(el, cfg, zoom, labelsOnTop) {
    const map = L.map(el, {
      center: [cfg.latitude, cfg.longitude], zoom, minZoom: 3, maxZoom: 10,
      scrollWheelZoom: false, attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    const style = DARK() ? "dark" : "light";
    const carto = (v) => `https://{s}.basemaps.cartocdn.com/${v}/{z}/{x}/{y}{r}.png`;
    L.tileLayer(carto(labelsOnTop ? `${style}_nolabels` : `${style}_all`), {
      subdomains: "abcd", maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    if (labelsOnTop) {
      map.createPane("labels");
      map.getPane("labels").style.zIndex = 650;
      map.getPane("labels").style.pointerEvents = "none";
      L.tileLayer(carto(`${style}_only_labels`), { subdomains: "abcd", maxZoom: 20, pane: "labels" }).addTo(map);
    }
    L.circleMarker([cfg.latitude, cfg.longitude], {
      radius: 5, weight: 2, color: "#ffffff", fillColor: "#e34948", fillOpacity: 1, pane: "markerPane",
    }).bindTooltip("Station").addTo(map);
    return map;
  }

  // Lecteur d'animation : bouton lecture/pause, curseur, heure de l'image
  class Player {
    constructor(root, delay, onShow) {
      this.delay = delay; this.onShow = onShow; this.n = 0; this.i = -1; this.timer = null; this.times = [];
      root.innerHTML = `
        <button type="button" class="pl-btn" aria-label="Lecture"><svg viewBox="0 0 16 16"><path class="pl-play" d="M4 2.5v11l9-5.5z"/><g class="pl-pause"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></g></svg></button>
        <input type="range" class="pl-range" min="0" max="0" value="0" aria-label="Image">
        <span class="pl-time">--:--</span>`;
      this.btn = root.querySelector(".pl-btn");
      this.range = root.querySelector(".pl-range");
      this.label = root.querySelector(".pl-time");
      this.btn.addEventListener("click", () => (this.timer ? this.pause() : this.play()));
      this.range.addEventListener("input", () => { this.pause(); this.show(+this.range.value); });
    }
    setFrames(times) {
      const playing = !!this.timer;
      this.pause();
      this.times = times; this.n = times.length; this.i = -1;
      this.range.max = Math.max(0, this.n - 1);
      if (this.n) this.show(this.n - 1);
      if (this.n > 1 && (playing || (!REDUCED && !this.started))) { this.started = true; this.play(); }
    }
    show(i) {
      if (!this.n) return;
      const prev = this.i;
      this.i = (i + this.n) % this.n;
      this.range.value = this.i;
      const t = this.times[this.i];
      const d = new Date(t * 1000);
      const today = d.toDateString() === new Date().toDateString();
      this.label.textContent = (today ? "" : d.toLocaleDateString("fr-FR", { weekday: "short" }) + " ") + hm(t * 1000);
      this.onShow(this.i, prev);
    }
    play() {
      if (this.n < 2) return;
      this.btn.classList.add("on"); this.btn.setAttribute("aria-label", "Pause");
      const tick = () => {
        this.show(this.i + 1);
        this.timer = setTimeout(tick, this.i === this.n - 1 ? this.delay * 4 : this.delay);
      };
      this.timer = setTimeout(tick, this.delay);
    }
    pause() {
      clearTimeout(this.timer); this.timer = null;
      this.btn.classList.remove("on"); this.btn.setAttribute("aria-label", "Lecture");
    }
  }

  // ---------------- Cartes Windy : radar et satellite (iframe officielle embed.windy.com) ----------------
  // prefix : "radar" ou "sat" (identifiants des éléments de la carte)
  function initWindy(cfg, c, prefix, title) {
    const q = new URLSearchParams({
      lat: cfg.latitude, lon: cfg.longitude, detailLat: cfg.latitude, detailLon: cfg.longitude,
      zoom: Math.max(3, Math.min(c.zoom, 11)), level: "surface",
      overlay: c.overlay, product: c.product,
      menu: "", message: "true", marker: "true", calendar: "now", pressure: "",
      type: "map", location: "coordinates", detail: "",
      metricWind: "km/h", metricTemp: "°C", radarRange: "-1",
    });
    const f = document.createElement("iframe");
    // adresse personnalisée (générateur embed.windy.com) ou construite à partir des réglages
    f.src = /^https:\/\/embed\.windy\.com\//.test(c.windyUrl || "") ? c.windyUrl : "https://embed.windy.com/embed2.html?" + q;
    f.title = title;
    f.loading = "lazy";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    f.setAttribute("allowfullscreen", "");
    f.className = "windy";
    $(prefix + "-map").appendChild(f);
    $(prefix + "-player").hidden = true;
    const seg = $(prefix + "-layers");
    if (seg) seg.hidden = true;
    $(prefix + "-hint").textContent = ["radar", "satellite"].includes(c.overlay) ? "animation : bouton ▶ de la carte" : "";
    $(prefix + "-credit").innerHTML = 'Carte <a href="https://www.windy.com/" rel="noopener">Windy.com</a>';
  }

  // ---------------- Radar RainViewer ----------------
  async function initRadar(cfg) {
    const rc = cfg.radar;
    const map = baseMap($("radar-map"), cfg, Math.min(rc.zoom, 10), false);
    let layers = [];
    const player = new Player($("radar-player"), rc.delay, (i, prev) => {
      if (layers[prev]) layers[prev].setOpacity(0);
      if (layers[i]) layers[i].setOpacity(0.8);
    });

    async function refresh() {
      try {
        const j = await (await fetch("https://api.rainviewer.com/public/weather-maps.json", { cache: "no-store" })).json();
        const past = ((j.radar && j.radar.past) || []).slice(-rc.frames);
        layers.forEach((l) => map.removeLayer(l));
        // tuiles 512 px (zoomOffset -1) : 4 fois moins de requêtes ; niveau 7 max. côté RainViewer
        layers = past.map((f) => L.tileLayer(`${j.host}${f.path}/512/{z}/{x}/{y}/2/1_1.png`, {
          tileSize: 512, zoomOffset: -1, maxNativeZoom: 8, maxZoom: 10, opacity: 0, zIndex: 5,
          attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
        }).addTo(map));
        player.setFrames(past.map((f) => f.time));
        $("radar-msg").hidden = true;
      } catch (e) {
        $("radar-msg").textContent = "Radar indisponible pour le moment.";
        $("radar-msg").hidden = false;
      }
    }
    await refresh();
    setInterval(refresh, 10 * 60 * 1000);
  }

  // ---------------- Satellite EUMETSAT (WMS) ----------------
  async function initSatellite(cfg) {
    const sc = cfg.satellite;
    const map = baseMap($("sat-map"), cfg, sc.zoom, true);
    let layer = sc.layers[0].name, overlays = [], times = [];

    const seg = $("sat-layers");
    if (sc.layers.length > 1) {
      seg.innerHTML = sc.layers.map((l, k) =>
        `<button type="button" data-l="${esc(l.name)}" aria-pressed="${k === 0}">${esc(l.label)}</button>`).join("");
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || b.dataset.l === layer) return;
        layer = b.dataset.l;
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        build();
      });
    }

    const player = new Player($("sat-player"), sc.delay, (i, prev) => {
      if (overlays[prev]) overlays[prev].setOpacity(0);
      if (overlays[i]) overlays[i].setOpacity(0.9);
    });

    function frameTimes() {
      const step = sc.step * 60;
      const last = Math.floor((Date.now() / 1000 - sc.latency * 60) / step) * step;
      const out = [];
      for (let k = sc.frames - 1; k >= 0; k--) out.push(last - k * step);
      return out;
    }

    function build() {
      overlays.forEach((o) => map.removeLayer(o));
      times = frameTimes();
      const b = map.getBounds(), size = map.getSize();
      const sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
      const scale = Math.min(1, 1024 / Math.max(size.x, size.y));
      const w = Math.round(size.x * scale), h = Math.round(size.y * scale);
      overlays = times.map((t) => {
        const q = new URLSearchParams({
          service: "WMS", version: "1.3.0", request: "GetMap", layers: layer, styles: "",
          format: "image/jpeg", crs: "EPSG:3857",
          bbox: [sw.x, sw.y, ne.x, ne.y].map((v) => v.toFixed(0)).join(","),
          width: w, height: h, time: new Date(t * 1000).toISOString(),
        });
        const o = L.imageOverlay(`${sc.url}?${q}`, b, { opacity: 0, zIndex: 5, className: "sat-img" });
        o.on("error", () => o.setUrl("data:image/gif;base64,R0lGODlhAQABAAAAACw="));
        return o.addTo(map);
      });
      player.setFrames(times);
    }

    let deb = null;
    map.on("moveend", () => { clearTimeout(deb); deb = setTimeout(build, 400); });
    map.attributionControl.addAttribution(`Contains modified EUMETSAT Meteosat data ${new Date().getFullYear()}`);
    build();
    setInterval(build, sc.step * 60 * 1000);
  }

  // Initialisation paresseuse : les cartes ne se chargent qu'une fois visibles
  function whenVisible(el, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { rootMargin: "200px" });
    io.observe(el);
  }

  // ==================================================================
  (async () => {
    const cfg = await getConfig();
    if (cfg.latitude === null || cfg.latitude === undefined) { cfg.latitude = DEFAULTS.latitude; cfg.longitude = DEFAULTS.longitude; }

    $("fh-close").addEventListener("click", closeDay);
    if (cfg.forecast.enable) {
      loadForecast(cfg);
      // relecture régulière ; les caches évitent tout appel superflu à Open-Meteo
      setInterval(() => loadForecast(cfg), Math.min(Math.max(60, +cfg.forecast.cache || 3600), 900) * 1000);
    } else $("fc-card").hidden = true;

    const maps = [];
    if (!cfg.radar.enable) $("radar-card").hidden = true;
    else if (cfg.radar.provider === "windy") whenVisible($("radar-card"), () => initWindy(cfg, cfg.radar, "radar", "Carte radar Windy"));
    else maps.push(["radar-card", initRadar]);
    if (!cfg.satellite.enable) $("sat-card").hidden = true;
    else if (cfg.satellite.provider === "windy") whenVisible($("sat-card"), () => initWindy(cfg, cfg.satellite, "sat", "Carte satellite Windy"));
    else maps.push(["sat-card", initSatellite]);
    for (const [id, init] of maps) {
      whenVisible($(id), async () => {
        if (!(await loadLeaflet())) {
          $(id).querySelector(".map-msg").textContent = "La bibliothèque Leaflet n'a pas pu être chargée.";
          $(id).querySelector(".map-msg").hidden = false;
          return;
        }
        try { await init(cfg); } catch (e) { console.error(e); }
      });
    }
  })();
})();
