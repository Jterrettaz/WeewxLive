/* weewx-live — panneaux de mesures du tableau de bord (index.html) et des pages « jour »
 * (archive/day-AAAA-MM-JJ.html) : valeurs en temps réel (MQTT, weewx-mqtt) ou mises à jour
 * à chaque archive weewx (MQTT désactivé), historique 24 h (data/history.json), panneaux
 * configurés dans skin.conf [[parameters]] (standard, génériques, groupés), panneaux
 * réduits / développés. Mode démo : ?demo. */
(function () {
  "use strict";

  const DEMO = new URLSearchParams(location.search).has("demo");
  // page « jour » (archive/day-AAAA-MM-JJ.html) : données de la journée intégrées à la page,
  // ni MQTT ni relecture ; graphiques de minuit à minuit
  const DAY = window.WEEWX_DAY || null;
  const nowS = () => (DAY ? DAY.stop : Date.now() / 1000);
  const SPAN = 24 * 3600;
  const HISTORY_REFRESH = 5 * 60 * 1000;    // relecture de data/history.json avec MQTT (régénéré par weewx)
  const FETCH_TIMEOUT = 15000;              // ms : une requête bloquée ne fige pas la page
  const HISTORY_STALE = 30 * 60;            // au-delà (s), on signale un historique non mis à jour
  const POINT_EVERY = 60;                   // un point de graphique par minute en direct

  // ------------------------------------------------------------------
  // Unités : converties en °C, km/h, mm, mm/h, hPa, W/m², % d'après le suffixe des clés
  // weewx-mqtt, de la forme <obs>_<unité> (ex. outTemp_C, rain_in) ; suffixe inconnu :
  // valeur gardée telle quelle (avertissement dans la console).
  // ------------------------------------------------------------------
  const id = (v) => v;
  const SUFFIX = {
    F: (v) => (v - 32) * 5 / 9, C: id,
    mph: (v) => v * 1.609344, kph: id, km_per_hour: id, mps: (v) => v * 3.6, meter_per_second: (v) => v * 3.6, knot: (v) => v * 1.852,
    inch: (v) => v * 25.4, in: (v) => v * 25.4, cm: (v) => v * 10, mm: id,
    mph2: (v) => v * 1.609344, kph2: id, mps2: (v) => v * 3.6, knot2: (v) => v * 1.852,
    inch_per_hour: (v) => v * 25.4, cm_per_hour: (v) => v * 10, mm_per_hour: id,
    inHg: (v) => v * 33.8638866667, mbar: id, hPa: id, kPa: (v) => v * 10, mmHg: (v) => v * 1.333224,
    Wpm2: id, watt_per_meter_squared: id, percent: id, degree_compass: id,
    uv_index: id, lux: id, centibar: id, km: id, meter: id, volt: id, ppm: id, count: id,
    microgram_per_meter_cubed: id, degree_C_day: id,
  };
  const OBS = ["dateTime", "outTemp", "outHumidity", "barometer", "windSpeed", "windGust",
               "windDir", "rain", "rainRate", "dayRain"];

  // Clés MQTT des températures passées (réglables : [[mqtt]] temp_1h_key / temp_24h_key)
  // clé en minuscules -> champ du paquet normalisé
  const PAST_KEYS = { "outtemp-1h_c": "outTemp1h", "outtemp-24h_c": "outTemp24h" };
  function setPastKeys(k1, k24) {
    for (const k of Object.keys(PAST_KEYS)) delete PAST_KEYS[k];
    PAST_KEYS[(k1 || "OutTemp-1h_C").toLowerCase()] = "outTemp1h";
    PAST_KEYS[(k24 || "OutTemp-24h_C").toLowerCase()] = "outTemp24h";
  }

  // Noms MQTT des paramètres configurés (skin.conf [[parameters]] mqtt = …) :
  // nom en minuscules -> clés internes (plusieurs paramètres peuvent lire la même mesure)
  const ALIASES = new Map();
  function setAliases(params) {
    ALIASES.clear();
    const add = (name, key) => {
      const n = String(name).toLowerCase();
      if (!ALIASES.has(n)) ALIASES.set(n, []);
      if (!ALIASES.get(n).includes(key)) ALIASES.get(n).push(key);
    };
    // mesures des panneaux groupés comprises
    const all = params.flatMap((p) => (p.type === "group" && p.members ? p.members : [p]));
    const overridden = new Set(all.filter((p) => p.builtin && p.mqtt && p.mqtt !== p.key).map((p) => p.key));
    for (const o of OBS) if (!overridden.has(o)) add(o, o);
    for (const p of all) if (p.mqtt) add(p.mqtt, p.key);
  }

  const warned = new Set();
  function warnSuffix(suf) {
    if (warned.has(suf)) return;
    warned.add(suf);
    console.warn(`weewx-live : unité « ${suf} » inconnue, valeur non convertie`);
  }

  function normalize(raw) {
    const out = {};
    for (const [k, rv] of Object.entries(raw)) {
      const v = rv === null || rv === "" || rv === "None" ? null : Number(rv);
      if (ALIASES.size) {
        // nom exact, ou nom suivi d'un suffixe d'unité (outTemp_C, pm2_5_microgram_per_meter_cubed) ;
        // casse ignorée ; le nom lui-même peut contenir « _ » (pm2_5)
        const kl = k.toLowerCase();
        let base = ALIASES.has(kl) ? kl : null;
        for (let i = kl.lastIndexOf("_"); !base && i > 0; i = kl.lastIndexOf("_", i - 1)) {
          if (ALIASES.has(kl.slice(0, i))) base = kl.slice(0, i);
        }
        if (base) {
          const suf = k.slice(base.length + 1);
          let f = id;
          if (suf) {
            f = SUFFIX[suf] || SUFFIX[suf.toLowerCase()];
            if (!f) { warnSuffix(suf); f = id; }
          }
          for (const key of ALIASES.get(base)) out[key] = v === null || isNaN(v) ? null : f(v);
          continue;
        }
      }
      const past = PAST_KEYS[k.toLowerCase()];
      if (past) {
        // unité donnée par le suffixe (_C, _F) ; °C par défaut
        const f = SUFFIX[k.slice(k.lastIndexOf("_") + 1)] || id;
        out[past] = v === null || isNaN(v) ? null : f(v);
        continue;
      }
      if (ALIASES.size) continue;   // noms configurés : pas d'autre correspondance
      for (const o of OBS) {
        if (k === o) { out[o] = v; break; }
        if (k.startsWith(o + "_")) {
          const f = SUFFIX[k.slice(o.length + 1)];
          if (f) out[o] = v === null || isNaN(v) ? null : f(v);
          break;
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Formatage
  // ------------------------------------------------------------------
  const fmt = (v, d) => v === null || v === undefined || isNaN(v) ? "--"
    : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const hhmm = (t) => t ? "à " + WXT.hm(t) : "";   // heure de la station (wxtime.js)
  const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const dirName = (d) => d === null || d === undefined ? "—" : DIRS[Math.round(d / 22.5) % 16];
  const midnightOf = WXT.midnight;
  const round = (v) => Math.round(v * 100) / 100;
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);

  const DEC = { outTemp: 1, outHumidity: 0, barometer: 1, windSpeed: 0, windGust: 0, rain: 1, rainRate: 1 };

  // ------------------------------------------------------------------
  // État
  // ------------------------------------------------------------------
  const S = {
    midnight: midnightOf(Date.now() / 1000),
    nextMidnight: WXT.addDays(Date.now() / 1000, 1),
    stationDay: false,       // true dès que le jour de la station est connu (history.json)
    lastAbove: null,         // dernière mesure à 0 °C ou plus (durée du gel en cours)
    frostPartial: false,     // gel depuis le début de la base : durée minimale (« plus de »)
    cur: {},
    day: {},                 // extrêmes du jour {obs: {min,minTime,max,maxTime}}
    dayRain: null,
    series: { outTemp: [], outHumidity: [], barometer: [], windSpeed: [], windGust: [], windDir: [] },
    rainHourly: new Map(),   // début d'heure -> mm
    rainPoints: [],          // [t, mm] : enregistrements d'archive + paquets LOOP (pour la courbe de cumul)
    acc: {},                 // accumulateurs par minute
    lastPacket: 0,
    lastArchive: 0,          // horodatage du dernier enregistrement d'archive (history.json)
    tempTime: 0,             // horodatage de la température actuelle (écarts sur 1 h / 24 h)
  };
  // Mode « archive » : MQTT désactivé ([[mqtt]] enable = false) ou non configuré ; les
  // valeurs affichées sont celles du dernier enregistrement d'archive weewx.
  let ARCHIVE_MODE = false;
  window.weewxLiveState = S;   // lu par climate.js (valeurs du jour en temps réel)

  // ------------------------------------------------------------------
  // Graphiques
  // ------------------------------------------------------------------
  // zone de graphique « k » du panneau « pid » (un panneau générique peut avoir pour clé
  // celle d'un graphique standard, ex. « rain » : recherche limitée au panneau)
  const cardChart = (pid, k) => {
    const c = document.querySelector(`main.grid > .card[data-param="${CSS.escape(pid)}"]`);
    return c && c.querySelector(`[data-chart="${CSS.escape(k)}"]`);
  };
  // graphique standard créé seulement si son panneau figure sur la page (paramètres de
  // skin.conf), pas pour un panneau générique qui reprend l'id d'un paramètre standard
  const mkChart = (k, opts) => {
    const el = cardChart(k, k);
    return el && !el.closest("[data-generic]") ? new MiniChart(el, opts) : null;
  };
  // courbes en °C : couleur selon la valeur (paliers de 3 °C, TempScale de minichart.js)
  const lineChart = (k, color, label, unit, opt = {}) => mkChart(k, Object.assign({
    unit, decimals: DEC[k], series: [{ label, color, type: "line", fill: true, tempScale: unit === "°C", data: S.series[k] }],
  }, opt));

  const charts = {
    outTemp: lineChart("outTemp", "--temp", "Température", "°C", { minRange: 2 }),
    outHumidity: lineChart("outHumidity", "--hum", "Humidité", "%", { ceil: 100, minRange: 10 }),
    barometer: lineChart("barometer", "--press", "Pression", "hPa", { minRange: 4 }),
    wind: mkChart("wind", {
      unit: "km/h", decimals: 0, floor: 0, minRange: 10,
      series: [
        { label: "Moyen", color: "--wind", type: "line", fill: true, data: S.series.windSpeed },
        { label: "Rafales", color: "--gust", type: "line", width: 1.5, endDot: false, data: S.series.windGust },
      ],
    }),
    // Direction du vent sur 24 h : nuage de points, axe N / E / S / O
    windDir: mkChart("windDir", {
      unit: "°", decimals: 0, yFixed: [0, 360, 90], maxGap: 1e9,
      yFormat: (v) => ["N", "E", "S", "O", "N"][Math.round(v / 90)] || "",
      valueFormat: (v) => `${dirName(v)} ${Math.round(v)}°`,
      series: [{ label: "Direction", color: "--wind", type: "dots", endDot: false, data: S.series.windDir }],
    }),
    rain: mkChart("rain", {
      unit: "mm", decimals: 1, floor: 0, minRange: 1,
      series: [
        { label: "Pluie horaire", color: "--rain", type: "bar", bucket: 3600, data: [] },
        { label: "Cumul 24 h", color: "--rainsum", type: "line", fill: false, data: [] },
      ],
    }),
  };

  // ------------------------------------------------------------------
  // Paramètres configurables (config.json « parameters », skin.conf [[parameters]])
  // ------------------------------------------------------------------
  const DEFAULT_PARAMS = [
    ["outTemp", "outTemp", "Température"], ["wind", "windSpeed", "Vent"], ["windDir", "windDir", "Direction du vent"],
    ["rain", "rain", "Pluie"],
    ["outHumidity", "outHumidity", "Humidité relative"], ["barometer", "barometer", "Pression"],
  ].map(([pid, key, title]) => ({ id: pid, key, title, mqtt: key, builtin: true }));
  const GENERIC_COLORS = ["--press", "--hum", "--sun", "--temp", "--wind"];
  // couleur d'un paramètre : nom de variable CSS uniquement (sécurité du HTML produit)
  const safeColor = (c) => (/^--[\w-]+$/.test(c || "") ? c : "");
  let PARAMS = DEFAULT_PARAMS;
  const GENERIC = [];                 // paramètres sans panneau spécialisé
  const genericIds = new Set();       // ids des panneaux génériques
  const genericMax = new Set();       // clés des paramètres « max » (maximum par minute)
  const genericSum = new Set();       // clés des paramètres « sum » (cumuls)
  const sumHourly = {};               // cumuls horaires des paramètres « sum »
  const daySum = {};                  // cumul du jour des paramètres « sum »
  const sumLive = {};                 // mesures temps réel des paramètres « sum » [[t, v]]
  const escH = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function genericCard(p) {
    const ext = p.aggregate === "min-max"
      ? `<div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
         <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>`
      : p.aggregate === "max"
        ? `<div><dt>Max du jour</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>`
        : `<div><dt>Cumul 24 h</dt><dd><b data-k="sum24">--</b><small>${escH(p.unit)}</small></dd></div>`;
    const el = document.createElement("article");
    el.className = "card";
    el.dataset.param = p.id;
    el.dataset.generic = "1";
    el.style.setProperty("--c", `var(${p.color})`);
    el.innerHTML = `
      <div class="card-main">
        <header><h2><a class="more" data-detail="${escH(p.id)}" href="detail.html?p=${encodeURIComponent(p.id)}">${escH(p.title)}</a></h2>
          <span class="hint">${escH(p.hint || (p.aggregate === "sum" ? "cumul du jour" : ""))}</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit">${escH(p.unit)}</span></div>
        <dl class="ext">${ext}</dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="${escH(p.key)}" role="img" aria-label="${escH(p.title)} sur 24 heures"></div>
        ${p.aggregate === "sum" ? `<ul class="legend"><li><i style="background:var(${p.color})"></i>Cumul horaire</li><li><i style="background:var(--text-2)"></i>Cumul 24 h</li></ul>` : ""}
      </div>`;
    return el;
  }

  // Panneau groupé (plusieurs mesures, ex. PM1 / PM2.5 / PM10) — page statique ou démo
  function groupCard(p) {
    const mm = p.aggregate === "min-max";
    const el = document.createElement("article");
    el.className = "card group-card";
    el.dataset.param = p.id;
    el.dataset.generic = "1";
    el.dataset.group = "1";
    el.style.setProperty("--c", `var(${p.members[0].color})`);
    const rows = p.members.map((m) => {
      const k = escH(m.id);
      return `<tr><th scope="row"><i class="sw" style="background:var(${m.color})"></i>${escH(m.title)}</th>
        <td class="gnow"><b data-k="${k}:value">--</b><small>${escH(m.unit)}</small></td>
        ${mm ? `<td><b data-k="${k}:min">--</b><small data-k="${k}:minTime"></small></td>` : ""}
        <td><b data-k="${k}:max">--</b><small data-k="${k}:maxTime"></small></td></tr>`;
    }).join("");
    el.innerHTML = `
      <div class="card-main">
        <header><h2><a class="more" data-detail="${escH(p.id)}" href="detail.html?p=${encodeURIComponent(p.id)}">${escH(p.title)}</a></h2>
          <span class="hint">${escH(p.hint || "")}</span></header>
        <table class="gtab"><thead><tr><th scope="col"><span class="sr">Mesure</span></th><th scope="col">Actuel</th>
          ${mm ? '<th scope="col">Min</th><th scope="col">Max</th>' : '<th scope="col">Max du jour</th>'}</tr></thead>
          <tbody>${rows}</tbody></table>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="${escH(p.key)}" role="img" aria-label="${escH(p.title)} sur 24 heures"></div>
        <ul class="legend">${p.members.map((m) => `<li><i style="background:var(${m.color})"></i>${escH(m.title)}</li>`).join("")}</ul>
      </div>`;
    return el;
  }
  const MEMBER_COLORS = ["--wind", "--temp", "--hum", "--sun", "--press"];

  function applyParams(list) {
    elCache.clear();
    PARAMS = list && list.length ? list : DEFAULT_PARAMS;
    setAliases(PARAMS);
    const grid = document.querySelector("main.grid");
    // panneaux standard : masqués s'ils ne sont pas configurés (ou remplacés par un panneau générique)
    grid.querySelectorAll(":scope > .card").forEach((c) => {
      const p = PARAMS.find((x) => x.id === c.dataset.param);
      if (!p || (!p.builtin && !c.dataset.generic)) { c.remove(); return; }
      if (!p.builtin) return;   // panneau générique produit par le gabarit
      const a = c.querySelector("h2 a") || c.querySelector("h2");
      if (a && p.title) a.textContent = p.title;
    });
    let gi = 0;
    for (const p of PARAMS) {
      if (p.type === "group") { applyGroup(p, grid); continue; }
      if (p.builtin) continue;
      p.color = safeColor(p.color) || GENERIC_COLORS[gi++ % GENERIC_COLORS.length];
      p.decimals = p.decimals ?? 1;
      GENERIC.push(p);
      genericIds.add(p.id);
      if (p.aggregate === "max") genericMax.add(p.key);
      S.series[p.key] = S.series[p.key] || [];
      if (p.aggregate === "sum") { genericSum.add(p.key); sumHourly[p.key] = new Map(); daySum[p.key] = null; }
      // panneau déjà produit par le gabarit weewx ; sinon (page statique, démo) on le crée
      if (!grid.querySelector(`:scope > .card[data-param="${CSS.escape(p.id)}"]`)) grid.appendChild(genericCard(p));
      const el = cardChart(p.id, p.key);
      if (!el) continue;
      const opts = { unit: p.unit, decimals: p.decimals };
      charts["g:" + p.key] = p.aggregate === "sum"
        ? new MiniChart(el, Object.assign(opts, { floor: 0, minRange: 1, maxGap: 1e9, series: [
          { label: "Cumul horaire", color: p.color, type: "bar", bucket: 3600, data: [] },
          { label: "Cumul 24 h", color: "--text-2", type: "line", data: [] }] }))
        : new MiniChart(el, Object.assign(opts, { minRange: 1, series: [
          { label: p.title, color: p.color, type: "line", fill: true, tempScale: p.unit === "°C", data: S.series[p.key] }] }));
    }
    // graphiques des panneaux retirés : libérés
    for (const [k, c] of Object.entries(charts)) if (c && !c.el.isConnected) { c.destroy(); charts[k] = null; }
  }

  // Panneau groupé : chaque mesure est traitée comme un paramètre générique (MQTT, extrêmes,
  // séries) mais affichée dans le panneau du groupe ; un seul graphique, une courbe par mesure.
  function applyGroup(p, grid) {
    if (!p.members || !p.members.length) return;
    genericIds.add(p.id);
    p.members.forEach((m, i) => {
      m.color = safeColor(m.color) || MEMBER_COLORS[i % MEMBER_COLORS.length];
      m.decimals = m.decimals ?? p.decimals ?? 1;
      m.aggregate = p.aggregate === "max" ? "max" : "min-max";
      m.cardId = p.id;
      m.kPrefix = m.id + ":";
      GENERIC.push(m);
      if (m.aggregate === "max") genericMax.add(m.key);
      S.series[m.key] = S.series[m.key] || [];
    });
    if (!grid.querySelector(`:scope > .card[data-param="${CSS.escape(p.id)}"]`)) grid.appendChild(groupCard(p));
    const el = cardChart(p.id, p.key);
    if (!el) return;
    const units = new Set(p.members.map((m) => m.unit));
    charts["grp:" + p.key] = new MiniChart(el, {
      unit: units.size === 1 ? p.members[0].unit : "", decimals: p.members[0].decimals, minRange: 1,
      series: p.members.map((m) => ({ label: m.title, color: m.color, type: "line", width: 1.75, endDot: true, data: S.series[m.key] })),
    });
  }

  function genericSumSeries(key, now) {
    const t0 = now - SPAN, m = sumHourly[key];
    const bars = [...m.entries()].filter(([t]) => t >= t0 - 3600).sort((a, b) => a[0] - b[0]);
    const cum = [[t0, 0]]; let acc = 0;
    // cumul en escalier : palier avant puis après chaque heure non nulle
    for (const [t, v] of bars) {
      if (t > t0) cum.push([t, round(acc)]);
      acc += v;
      cum.push([Math.min(t + 3600, now), round(acc)]);
    }
    cum.push([now, round(acc)]);
    return { bars, cum, total: acc };
  }

  function refreshCharts() {
    const now = nowS();
    for (const p of GENERIC) {
      if (p.aggregate !== "sum") continue;
      const { bars, cum } = genericSumSeries(p.key, now);
      const ch = charts["g:" + p.key];
      if (ch) { ch.series[0].data = bars; ch.series[1].data = cum; }
    }
    if (charts.rain) {
      charts.rain.series[0].data = [...S.rainHourly.entries()].sort((a, b) => a[0] - b[0]);
      charts.rain.series[1].data = rainCumul(now);
    }
    drawRose(now);
    for (const c of Object.values(charts)) if (c) { c.setNow(now); c.draw(); }
  }
  // Cumul glissant depuis le début de la fenêtre de 24 h, échantillonné toutes les 5 min
  // (+ le point « maintenant ») : la courbe se termine sur la valeur « Cumul 24 h ».
  function rainCumul(now) {
    const t0 = now - SPAN, step = 300;
    const pts = S.rainPoints.filter((p) => p[0] > t0).sort((a, b) => a[0] - b[0]);
    const out = [];
    let i = 0, sum = 0;
    const g0 = Math.ceil(t0 / step) * step;
    for (let g = g0; ; g += step) {
      const tg = Math.min(g, now);
      while (i < pts.length && pts[i][0] <= tg) sum += pts[i++][1];
      out.push([tg, round(sum)]);
      if (tg >= now) break;
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Rose des vents 24 h : 16 secteurs, fréquence par classe de vitesse
  // ------------------------------------------------------------------
  // classes de vitesse (légende : panels.inc)
  const ROSE_CLASSES = [
    { max: 10, color: "--ws1" }, { max: 20, color: "--ws2" }, { max: 30, color: "--ws3" }, { max: Infinity, color: "--ws4" },
  ];
  const CALM = 1;   // km/h : en dessous, vent calme (direction non significative)

  function drawRose(now) {
    const svg = document.getElementById("rose");
    if (!svg) return;
    const t0 = now - SPAN;
    // vitesse associée à chaque direction : même minute (en mode « individual » de
    // weewx-mqtt, vitesse et direction arrivent dans des messages séparés)
    const mk = (t) => Math.floor(t / 60);
    const speed = new Map(S.series.windSpeed.map((p) => [mk(p[0]), p[1]]));
    const counts = Array.from({ length: 16 }, () => ROSE_CLASSES.map(() => 0));
    const sums = Array(16).fill(0);
    let n = 0, calm = 0;
    for (const [t, dir] of S.series.windDir) {
      if (t < t0 || dir === null) continue;
      const v = speed.get(mk(t)) ?? speed.get(mk(t) - 1);
      if (v === undefined || v === null) continue;
      n++;
      if (v < CALM) { calm++; continue; }
      const sec = Math.round(dir / 22.5) % 16;
      counts[sec][ROSE_CLASSES.findIndex((c) => v < c.max)]++;
      sums[sec] += v;
    }
    const tot = counts.map((c) => c.reduce((a, b) => a + b, 0));
    const maxPct = n ? Math.max(...tot) / n * 100 : 0;
    // graduation : 2, 5, 10, 20, 25 ou 50 %
    const ringStep = [2, 5, 10, 20, 25, 50].find((s) => maxPct / s <= 4) || 50;
    const rMaxPct = Math.max(ringStep, Math.ceil(maxPct / ringStep) * ringStep);
    const R = 88, r0 = 10;
    const rad = (pct) => r0 + (pct / rMaxPct) * (R - r0);
    const pt = (r, a) => [(r * Math.sin(a)).toFixed(1), (-r * Math.cos(a)).toFixed(1)];
    let out = "";
    for (let pct = ringStep; pct <= rMaxPct + 1e-9; pct += ringStep) {
      out += `<circle class="ring" r="${rad(pct).toFixed(1)}"/>`;
      const [x, y] = pt(rad(pct), Math.PI / 8 * 1.5);
      out += `<text class="rl" x="${x}" y="${y}">${pct} %</text>`;
    }
    for (let k = 0; k < 4; k++) {
      const [x, y] = pt(R, (k * Math.PI) / 2);
      out += `<line class="axis" x1="0" y1="0" x2="${x}" y2="${y}"/>`;
    }
    for (let sec = 0; sec < 16; sec++) {
      if (!tot[sec]) continue;
      const a0 = (sec * 22.5 - 9) * Math.PI / 180, a1 = (sec * 22.5 + 9) * Math.PI / 180;
      let acc = 0;
      counts[sec].forEach((c, ci) => {
        if (!c) return;
        const ri = rad(acc / n * 100), ro = rad((acc + c) / n * 100);
        acc += c;
        const [x0, y0] = pt(ri, a0), [x1, y1] = pt(ro, a0), [x2, y2] = pt(ro, a1), [x3, y3] = pt(ri, a1);
        out += `<path class="wedge" style="fill:var(${ROSE_CLASSES[ci].color})" d="M${x0} ${y0}L${x1} ${y1}A${ro.toFixed(1)} ${ro.toFixed(1)} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${ri.toFixed(1)} ${ri.toFixed(1)} 0 0 0 ${x0} ${y0}Z"/>`;
      });
      const pct = tot[sec] / n * 100;
      out += `<path class="hit" d="M0 0L${pt(R, a0).join(" ")}A${R} ${R} 0 0 1 ${pt(R, a1).join(" ")}Z"><title>${DIRS[sec]} : ${fmt(pct, 0)} % du temps · vent moyen ${fmt(sums[sec] / tot[sec], 0)} km/h</title></path>`;
    }
    const lab = [["N", 0], ["E", 90], ["S", 180], ["O", 270]];
    for (const [l, deg] of lab) {
      const [x, y] = pt(R + 11, deg * Math.PI / 180);
      out += `<text class="card-l" x="${x}" y="${y}">${l}</text>`;
    }
    out += `<circle class="calm" r="${r0 - 1}"/>`;
    svg.innerHTML = out;
    svg.setAttribute("aria-label", n
      ? `Rose des vents sur 24 h : direction dominante ${DIRS[tot.indexOf(Math.max(...tot))]}, calme ${fmt(calm / n * 100, 0)} % du temps`
      : "Rose des vents : pas encore de données");
    set("windDir", "dominant", n > calm ? DIRS[tot.indexOf(Math.max(...tot))] : "--");
    set("windDir", "calm", n ? `${fmt(calm / n * 100, 0)} %` : "--");
  }

  let drawPending = false;
  function scheduleDraw() {
    if (drawPending) return;
    drawPending = true;
    setTimeout(() => { drawPending = false; refreshCharts(); }, 1000);
  }

  // ------------------------------------------------------------------
  // Rendu DOM
  // ------------------------------------------------------------------
  const card = (p) => document.querySelector(`.card[data-param="${CSS.escape(p)}"]`);
  // éléments mis à jour à chaque paquet : recherche DOM mise en cache
  const elCache = new Map();
  function field(p, k) {
    const ck = p + "|" + k;
    let el = elCache.get(ck);
    if (el === undefined || (el && !el.isConnected)) {
      const c = card(p);
      el = (c && c.querySelector(`[data-k="${CSS.escape(k)}"]`)) || null;
      elCache.set(ck, el);
    }
    return el;
  }
  let renderingGeneric = false;
  function set(p, k, text) {
    // un panneau générique n'est rempli que par renderGeneric (même id qu'un panneau standard remplacé)
    if (!renderingGeneric && genericIds.has(p)) return;
    const el = field(p, k);
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (k === "value") { el.classList.add("flash"); requestAnimationFrame(() => setTimeout(() => el.classList.remove("flash"), 60)); }
  }
  function setExt(p, obs, prefix = "") {
    const d = S.day[obs] || {};
    const k = (n) => prefix ? prefix + n[0].toUpperCase() + n.slice(1) : n;
    if (!prefix) {
      set(p, "min", fmt(d.min, DEC[obs])); set(p, "minTime", hhmm(d.minTime));
    }
    set(p, k("max"), fmt(d.max, DEC[obs])); set(p, k("maxTime"), hhmm(d.maxTime));
  }

  function renderGeneric() {
    renderingGeneric = true;
    try { renderGenericInner(); } finally { renderingGeneric = false; }
  }
  function renderGenericInner() {
    for (const p of GENERIC) {
      const d = p.decimals;
      // mesure d'un panneau groupé : champs « <id>:value »… dans le panneau du groupe
      const c = p.cardId || p.id, k = (n) => (p.kPrefix || "") + n;
      if (p.aggregate === "sum") {
        set(c, k("value"), fmt(daySum[p.key], d));
        set(c, k("sum24"), fmt(genericSumSeries(p.key, nowS()).total, d));
        continue;
      }
      set(c, k("value"), fmt(S.cur[p.key], d));
      const x = S.day[p.key] || {};
      if (p.aggregate === "min-max") { set(c, k("min"), fmt(x.min, d)); set(c, k("minTime"), hhmm(x.minTime)); }
      set(c, k("max"), fmt(x.max, d)); set(c, k("maxTime"), hhmm(x.maxTime));
    }
  }

  let needleDeg = null;
  function render() {
    renderGeneric();
    const c = S.cur;
    for (const o of ["outTemp", "outHumidity", "barometer"]) {
      set(o, "value", fmt(c[o], DEC[o]));
      setExt(o, o);
    }
    tintTemps();
    // Vent
    set("wind", "value", fmt(c.windSpeed, 0));
    set("wind", "gust", fmt(c.windGust, 0));
    set("wind", "dirTxt", dirName(c.windDir));
    set("wind", "dirDeg", c.windDir === null || c.windDir === undefined ? "" : Math.round(c.windDir) + "°");
    if (c.windDir !== null && c.windDir !== undefined) {
      // la flèche indique d'où vient le vent -> on la pointe vers l'aval (direction + 180°)
      const needle = field("wind", "needle");
      // rotation par le plus court chemin (359° -> 1° sans faire le tour)
      const target = c.windDir + 180;
      needleDeg = needleDeg === null ? target : needleDeg + ((((target - needleDeg) % 360) + 540) % 360 - 180);
      if (needle) needle.style.transform = `rotate(${needleDeg}deg)`;
    }
    // Direction du vent (panneau dédié) : texte + angle
    set("windDir", "value", dirName(c.windDir));
    set("windDir", "deg", c.windDir === null || c.windDir === undefined ? "" : Math.round(c.windDir) + "°");
    setExt("wind", "windSpeed");
    setExt("wind", "windGust", "gust");
    // Pluie
    set("rain", "value", fmt(S.dayRain, 1));
    set("rain", "rate", fmt(c.rainRate, 1));
    const rr = S.day.rainRate || {};
    set("rain", "max", fmt(rr.max, 1)); set("rain", "maxTime", rr.max ? hhmm(rr.maxTime) : "");
    // même calcul que la courbe de cumul du graphique (dernière valeur)
    const cum = rainCumul(nowS()), s24 = cum.length ? cum[cum.length - 1][1] : 0;
    set("rain", "sum24", fmt(s24, 1));
    // Variations de température sur 1 h et 24 h
    set("outTemp", "d1h", tempDelta("outTemp1h", 3600));
    set("outTemp", "d24h", tempDelta("outTemp24h", 86400));
    // Tendance de pression sur 3 h
    set("barometer", "trend", pressureTrend());
    renderFrost();
  }

  // Durée du gel en cours (panneau Température, tableau de bord seulement) : temps écoulé
  // depuis la dernière mesure à 0 °C ou plus, affiché en bleu tant que la température
  // actuelle est négative ; recalculé chaque seconde par tick()
  function markAbove(t) {
    if (!isNum(S.lastAbove) || t > S.lastAbove) { S.lastAbove = t; S.frostPartial = false; }
  }
  function renderFrost() {
    const row = field("outTemp", "frostRow");
    if (!row) return;
    const v = S.cur.outTemp, on = isNum(v) && v < 0 && isNum(S.lastAbove);
    if (row.hidden === on) row.hidden = !on;
    if (on) set("outTemp", "frost", (S.frostPartial ? "plus de " : "") + duration(nowS() - S.lastAbove));
  }
  // durée lisible : « 42 min », « 3 h 05 min », « 2 j 4 h »
  function duration(s) {
    const m = Math.max(0, Math.floor(s / 60)), h = Math.floor(m / 60);
    if (m < 60) return `${m} min`;
    if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
    return `${Math.floor(h / 24)} j ${h % 24} h`;
  }

  // Panneau Température : valeur actuelle, min. et max. colorés selon la température,
  // avec l'échelle des graphiques Hi-Low (TempScale, minichart.js)
  function tintTemps() {
    if (!window.TempScale || genericIds.has("outTemp")) return;
    const d = S.day.outTemp || {};
    for (const [k, v] of [["value", S.cur.outTemp], ["min", d.min], ["max", d.max]]) {
      const el = field("outTemp", k);
      // valeur arrondie à 0,1 °C comme à l'affichage (« 0,0 » reste bleu)
      if (el) el.style.color = isNum(v) ? TempScale.textColor(Math.round(v * 10) / 10) : "";
    }
  }

  // Écart avec la température d'il y a 1 h ou 24 h : valeur publiée par le broker
  // (OutTemp-1h_C / OutTemp-24h_C) si disponible, sinon valeur de l'historique
  // la plus proche de (t - ago).
  function tempDelta(pastKey, ago) {
    const now = S.cur.outTemp;
    if (now === undefined || now === null) return "--";
    let past = S.cur[pastKey], src = "";
    if (past === undefined || past === null) {
      // « ago » secondes avant l'horodatage de la valeur actuelle
      const target = (S.tempTime || nowS()) - ago;
      let best = null;
      for (const p of S.series.outTemp) if (!best || Math.abs(p[0] - target) < Math.abs(best[0] - target)) best = p;
      if (!best || Math.abs(best[0] - target) > 900) return "--";
      past = best[1]; src = " *";
    }
    const d = now - past;
    const arrow = d >= 0.1 ? "▲" : d <= -0.1 ? "▼" : "▶";
    return `${arrow} ${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d), 1)} °C${src}`;
  }

  function pressureTrend() {
    const a = S.series.barometer;
    if (a.length < 2 || !isNum(S.cur.barometer)) return "--";
    const target = nowS() - 3 * 3600;
    let best = null;
    for (const p of a) if (!best || Math.abs(p[0] - target) < Math.abs(best[0] - target)) best = p;
    if (!best || Math.abs(best[0] - target) > 1800) return "--";
    const d = S.cur.barometer - best[1];
    const arrow = d > 0.5 ? "▲" : d < -0.5 ? "▼" : "▶";
    return `${arrow} ${d > 0 ? "+" : ""}${fmt(d, 1)} hPa`;
  }

  // ------------------------------------------------------------------
  // Extrêmes du jour
  // ------------------------------------------------------------------
  function extreme(obs, v, t, onlyMax = false) {
    if (v === null || v === undefined || isNaN(v)) return;
    const d = S.day[obs] || (S.day[obs] = {});
    if (!onlyMax && (d.min === undefined || d.min === null || v < d.min)) { d.min = v; d.minTime = t; }
    if (d.max === undefined || d.max === null || v > d.max) { d.max = v; d.maxTime = t; }
  }

  // Changement de jour : à minuit de la station (history.json « nextMidnight », sinon
  // wxtime.js), quel que soit le fuseau horaire du navigateur.
  function checkMidnight(t) {
    if (t < S.nextMidnight) return;
    S.midnight = S.nextMidnight;
    S.nextMidnight = WXT.addDays(S.midnight, 1);
    S.day = {};
    S.dayRain = 0;
    for (const k of Object.keys(daySum)) daySum[k] = 0;
  }

  // ------------------------------------------------------------------
  // Paquet LOOP reçu
  // ------------------------------------------------------------------
  function onPacket(p) {
    const t = p.dateTime || Date.now() / 1000;
    checkMidnight(t);
    S.lastPacket = Date.now();

    if (p.outTemp !== undefined && p.outTemp !== null) S.tempTime = t;
    if (isNum(p.outTemp) && p.outTemp >= 0) markAbove(t);
    for (const o of ["outTemp", "outTemp1h", "outTemp24h", "outHumidity", "barometer", "windSpeed", "windGust", "windDir", "rainRate"]) {
      if (o in p) S.cur[o] = p[o];
    }
    for (const o of ["outTemp", "outHumidity", "barometer", "windSpeed"]) extreme(o, p[o], t);
    extreme("windGust", p.windGust ?? p.windSpeed, t, true);
    extreme("rainRate", p.rainRate, t, true);

    // Pluie : cumul horaire pour le graphique, cumul du jour
    if (p.rain > 0) {
      const h = Math.floor(t / 3600) * 3600;
      S.rainHourly.set(h, (S.rainHourly.get(h) || 0) + p.rain);
      S.rainPoints.push([t, p.rain]);
      if (p.dayRain === undefined) S.dayRain = (S.dayRain || 0) + p.rain;
    }
    if (p.dayRain !== undefined && p.dayRain !== null) S.dayRain = p.dayRain;

    // Paramètres configurés (génériques)
    for (const g of GENERIC) {
      const v = p[g.key];
      if (v === undefined || v === null || isNaN(v)) continue;
      if (g.aggregate === "sum") {
        if (v > 0) {
          const h = Math.floor(t / 3600) * 3600;
          sumHourly[g.key].set(h, (sumHourly[g.key].get(h) || 0) + v);
          (sumLive[g.key] || (sumLive[g.key] = [])).push([t, v]);
          daySum[g.key] = (daySum[g.key] || 0) + v;
        }
        continue;
      }
      S.cur[g.key] = v;
      extreme(g.key, v, t, g.aggregate === "max");
    }

    // Séries : moyenne par minute (max pour les rafales), point « en cours » en bout de courbe
    for (const o of Object.keys(S.series)) {
      if (genericSum.has(o)) continue;
      let v = p[o];
      if (o === "windGust" && (v === undefined || v === null)) v = p.windSpeed;
      if (v === undefined || v === null || isNaN(v)) continue;
      const arr = S.series[o];
      const a = S.acc[o] || (S.acc[o] = { sum: 0, n: 0, max: -Infinity, last: arr.length ? arr[arr.length - 1][0] : 0, tail: false });
      a.sum += v; a.n++; a.max = Math.max(a.max, v);
      if (a.tail) arr.pop();
      // direction : dernière valeur de la minute (une moyenne arithmétique d'angles serait fausse)
      const agg = o === "windGust" || genericMax.has(o) ? a.max : o === "windDir" ? v : a.sum / a.n;
      arr.push([t, round(agg)]);
      if (t - a.last >= POINT_EVERY) {
        a.last = t; a.sum = 0; a.n = 0; a.max = -Infinity; a.tail = false;
      } else a.tail = true;
    }

    render();
    scheduleDraw();
  }
  function trim() {
    if (DAY) return;
    const t0 = Date.now() / 1000 - SPAN - 3600;
    for (const arr of Object.values(S.series)) {
      let i = 0; while (i < arr.length && arr[i][0] < t0) i++;
      if (i) arr.splice(0, i);
    }
    for (const t of S.rainHourly.keys()) if (t < t0) S.rainHourly.delete(t);
    S.rainPoints = S.rainPoints.filter((p) => p[0] >= t0);
    for (const k of Object.keys(sumLive)) sumLive[k] = sumLive[k].filter((p) => p[0] >= t0);
    for (const m of Object.values(sumHourly)) for (const t of m.keys()) if (t < t0) m.delete(t);
  }

  // ------------------------------------------------------------------
  // Historique (base weewx)
  // ------------------------------------------------------------------
  function applyHistory(h) {
    const hs = h.series || {};
    // fusion d'une série : archive puis points temps réel postérieurs ; l'accumulateur
    // par minute repart de zéro (pas de point partiel dupliqué)
    const merge = (k, hist) => {
      const lastT = hist.length ? hist[hist.length - 1][0] : 0;
      const live = S.series[k].filter((q) => q[0] > lastT);
      S.series[k].length = 0;
      S.series[k].push(...hist, ...live);
      delete S.acc[k];
      return lastT;
    };
    // cumuls horaires : enregistrements d'archive (horodatés en fin d'intervalle) puis
    // mesures temps réel postérieures au dernier enregistrement
    const hourlyOf = (hist, live) => {
      const m = new Map();
      const lastT = hist.length ? hist[hist.length - 1][0] : 0;
      for (const [t, v] of hist) { const hb = Math.floor((t - 1) / 3600) * 3600; m.set(hb, (m.get(hb) || 0) + v); }
      for (const [t, v] of live) if (t > lastT) { const hb = Math.floor(t / 3600) * 3600; m.set(hb, (m.get(hb) || 0) + v); }
      return { m, lastT };
    };

    for (const k of ["outTemp", "outHumidity", "barometer", "windSpeed", "windGust", "windDir"]) merge(k, hs[k] || []);

    // Jour de la station : un fichier encore daté de la veille (juste après minuit) ne
    // remplace pas les extrêmes du nouveau jour
    const stale = S.stationDay && h.midnight && h.midnight < S.midnight;
    const newDay = !stale && h.midnight && h.midnight !== S.midnight;
    if (newDay) {
      S.day = {}; S.dayRain = null;
      for (const k of Object.keys(daySum)) daySum[k] = null;
    }

    // Paramètres configurés : séries 24 h, cumuls horaires
    for (const g of GENERIC) {
      const hist = hs[g.key] || [];
      if (g.aggregate === "sum") {
        const { m, lastT } = hourlyOf(hist, sumLive[g.key] || []);
        sumHourly[g.key] = m;
        sumLive[g.key] = (sumLive[g.key] || []).filter((q) => q[0] > lastT);
        const dsum = !stale && h.day && h.day[g.key] && h.day[g.key].sum;
        if (!stale && (ARCHIVE_MODE || !isNum(daySum[g.key]))) daySum[g.key] = isNum(dsum) ? dsum : null;
        continue;
      }
      merge(g.key, hist);
      if (!S.lastPacket && hist.length) S.cur[g.key] = hist[hist.length - 1][1];
    }

    // Pluie horaire et points de pluie (courbe de cumul)
    const rain = hs.rain || [];
    const { m: hourly, lastT: lastRainT } = hourlyOf(rain, S.rainPoints);
    S.rainHourly = hourly;
    S.rainPoints = rain.filter((q) => q[1] > 0).concat(S.rainPoints.filter((q) => q[0] > lastRainT));

    // Extrêmes du jour : on garde le plus extrême des deux sources (archive, MQTT) ;
    // mode archive : repris tels quels de l'archive
    if (!stale && h.midnight) {
      if (ARCHIVE_MODE) S.day = {};
      S.midnight = h.midnight;
      S.nextMidnight = h.nextMidnight || h.midnight + 86400;
      S.stationDay = true;
      for (const [o, d] of Object.entries(h.day || {})) {
        if (o === "rain" || !d || (d.sum !== undefined && d.min === undefined && d.max === undefined)) continue;
        const cur = S.day[o] || (S.day[o] = {});
        if (isNum(d.min) && (!isNum(cur.min) || d.min <= cur.min)) { cur.min = d.min; cur.minTime = d.minTime; }
        if (isNum(d.max) && (!isNum(cur.max) || d.max >= cur.max)) { cur.max = d.max; cur.maxTime = d.maxTime; }
      }
      if (h.day && h.day.rain && (!isNum(S.dayRain) || ARCHIVE_MODE)) S.dayRain = h.day.rain.sum;
    }

    // Gel en cours : dernière mesure à 0 °C ou plus, d'après history.json « frost » (gel
    // commencé avant l'historique) et les séries
    if (!DAY) {
      const ta = hs.outTemp || [];
      for (let i = ta.length - 1; i >= 0; i--) if (ta[i][1] >= 0) { markAbove(ta[i][0]); break; }
      if (h.frost && isNum(h.frost.since)) {
        markAbove(h.frost.since);
        if (h.frost.partial && S.lastAbove === h.frost.since) S.frostPartial = true;
      }
    }

    // Valeurs « courantes » provisoires avant le premier paquet MQTT (mode archive : toujours)
    if (!S.lastPacket) {
      for (const o of ["outTemp", "outHumidity", "barometer", "windSpeed", "windGust", "windDir", "rainRate"]) {
        const a = hs[o];
        if (a && a.length) S.cur[o] = a[a.length - 1][1];
        if (o === "outTemp" && a && a.length) S.tempTime = a[a.length - 1][0];
      }
    }
    render();
    refreshCharts();
  }

  // requête avec délai maximal (un serveur qui ne répond pas ne bloque pas la page)
  function fetchJSON(url) {
    const opt = { cache: "no-store" };
    if (window.AbortSignal && AbortSignal.timeout) opt.signal = AbortSignal.timeout(FETCH_TIMEOUT);
    return fetch(url, opt).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  let historyLoading = null;   // une seule lecture à la fois
  function loadHistory() {
    if (!historyLoading) historyLoading = loadHistoryOnce().finally(() => (historyLoading = null));
    return historyLoading;
  }
  async function loadHistoryOnce() {
    if (DEMO) return applyHistory(Demo.history());
    try {
      // paramètre anti-cache : certains hébergeurs/CDN mettent les .json en cache
      const h = await fetchJSON("data/history.json?_=" + Math.floor(Date.now() / 60000));
      if (h.error) throw new Error(h.error);
      const stop = h.stop || h.generated || 0;
      // rien à faire si l'archive n'a pas changé (ou si une réponse plus ancienne arrive)
      if (stop && S.lastArchive && stop <= S.lastArchive && ARCHIVE_MODE) return;
      if (stop && stop < S.lastArchive) return;
      S.lastArchive = stop;
      applyHistory(h);
      hideBanner("hist");
      const gen = h.generated || h.stop;
      document.getElementById("gen").textContent =
        " généré " + WXT.fmt(gen, { weekday: "short", hour: "2-digit", minute: "2-digit" });
      if (Date.now() / 1000 - gen > HISTORY_STALE) {
        showBanner("stale", "L'historique n'a pas été mis à jour depuis " +
          WXT.fmt(gen, { dateStyle: "short", timeStyle: "short" }) +
          " (génération ou envoi weewx interrompu ?).");
      } else hideBanner("stale");
    } catch (e) {
      showBanner("hist", `Historique indisponible (${e.message}). Les graphiques se rempliront au fil des données MQTT.`);
    }
  }

  // ------------------------------------------------------------------
  // MQTT
  // ------------------------------------------------------------------
  const conn = document.getElementById("conn");
  function setConn(state, text) {
    conn.className = "pill pill-" + state;
    conn.querySelector(".txt").textContent = text;
  }

  // mqtt.js : copie locale (vendor/mqtt.min.js) si présente, sinon CDN
  function loadScript(src) {
    return new Promise((ok) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = ok;
      document.head.appendChild(s);
    });
  }
  async function loadMqttLib() {
    if (window.mqtt) return;
    await loadScript("vendor/mqtt.min.js");
    if (!window.mqtt) await loadScript("https://unpkg.com/mqtt@5/dist/mqtt.min.js");
  }

  // Configuration : intégrée à la page par index.html.tmpl, sinon config.json (requête
  // partagée avec nav.js et extras.js : window.weewxConfig)
  async function loadConfig() {
    if (window.WEEWX_CONFIG) return window.WEEWX_CONFIG;
    if (DEMO) return null;
    const cfg = window.weewxConfig ? await window.weewxConfig.catch(() => null) : null;
    if (!cfg) {
      setConn("off", "Config. introuvable");
      showBanner("cfg", "Impossible de lire config.json. Le rapport WeewxLive a-t-il été généré et envoyé ?");
    }
    return cfg;
  }

  async function startMqtt(cfg) {
    if (DEMO) { setConn("on", "Démo"); return Demo.start(onPacket); }
    if (!cfg) return;
    if (cfg.stationName) {
      document.getElementById("station-name").textContent = cfg.stationName;
      document.title = cfg.stationName + " — en direct";
    }
    const m = cfg.mqtt;
    if (!m || m.enable === false || !m.url) {
      // pas de temps réel : mise à jour à chaque archive weewx
      setArchiveMode((m && m.archivePoll) || 60, m && m.enable !== false ? "MQTT non configuré" : "MQTT désactivé");
      if (m && m.enable !== false && !m.url) {
        showBanner("mqtt", "Aucun broker MQTT défini ([LiveJSON] [[mqtt]] url dans skin.conf) : mise à jour à chaque archive weewx.");
      }
      return;
    }
    await loadMqttLib();
    if (!window.mqtt) {
      // repli : mise à jour à chaque archive weewx
      setArchiveMode(m.archivePoll || 60, "mqtt.js introuvable");
      return showBanner("lib", "La bibliothèque mqtt.js n'a pas pu être chargée (voir README : vendor/mqtt.min.js) : mise à jour à chaque archive weewx.");
    }
    setPastKeys(m.temp1hKey, m.temp24hKey);
    const client = mqtt.connect(m.url, {
      username: m.username || undefined,
      password: m.password || undefined,
      clientId: "weewx-live-" + Math.random().toString(16).slice(2, 10),
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
    });
    setConn("wait", "Connexion…");
    client.on("connect", () => {
      setConn("on", "En direct");
      hideBanner("mqtt");
      client.subscribe(m.topic, { qos: 0 });
    });
    client.on("reconnect", () => setConn("wait", "Reconnexion…"));
    client.on("offline", () => setConn("off", "Hors ligne"));
    client.on("error", (e) => {
      setConn("off", "Erreur MQTT");
      showBanner("mqtt", `Erreur MQTT (${m.url}) : ${e.message}`);
    });
    client.on("message", (topic, payload) => {
      const txt = payload.toString();
      let raw;
      try {
        raw = JSON.parse(txt);
      } catch { raw = null; }
      if (raw === null || typeof raw !== "object") {
        // mode « individual » de weewx-mqtt : un topic par mesure (ex. weather/outTemp_C)
        raw = { [topic.split("/").pop()]: txt };
      }
      const p = normalize(raw);
      if (Object.keys(p).length) onPacket(p);
    });
  }

  // ------------------------------------------------------------------
  // Bandeau, horloge, fraîcheur
  // ------------------------------------------------------------------
  const banners = {};
  const bannerEl = document.getElementById("banner");
  function showBanner(k, msg) { banners[k] = msg; drawBanner(); }
  function hideBanner(k) { delete banners[k]; drawBanner(); }
  function drawBanner() {
    const msgs = Object.values(banners);
    bannerEl.hidden = !msgs.length;
    bannerEl.innerHTML = msgs.map((m) => `<div>${escH(m)}</div>`).join("");
  }

  let historyTimer = null;
  // Mode archive (MQTT désactivé, non configuré ou mqtt.js introuvable) : relecture de
  // history.json toutes les « poll » secondes, affichée dès qu'une nouvelle archive arrive
  function setArchiveMode(poll, why) {
    ARCHIVE_MODE = true;
    setConn("arch", "Archive weewx");
    document.getElementById("src").textContent = `Mise à jour à chaque archive weewx (${why || "MQTT désactivé"})`;
    clearInterval(historyTimer);
    historyTimer = setInterval(loadHistory, Math.max(15, poll) * 1000);
    if (!S.lastArchive) loadHistory();   // déjà lu au démarrage sinon
  }

  function tick() {
    if (DAY) return;
    const now = WXT.now();
    document.getElementById("clock").textContent = WXT.fmt(now, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const age = document.getElementById("age");
    if (ARCHIVE_MODE && S.lastArchive) {
      // âge du dernier enregistrement d'archive
      const s = Math.round(Date.now() / 1000 - S.lastArchive);
      age.textContent = s < 60 ? `archive il y a ${s} s` : `archive il y a ${Math.floor(s / 60)} min`;
      if (s > HISTORY_STALE && !conn.classList.contains("pill-wait")) setConn("wait", "Pas de données");
      else if (s <= HISTORY_STALE && !conn.classList.contains("pill-arch")) setConn("arch", "Archive weewx");
    } else if (S.lastPacket) {
      const s = Math.round((Date.now() - S.lastPacket) / 1000);
      age.textContent = s < 60 ? `il y a ${s} s` : `il y a ${Math.floor(s / 60)} min`;
      if (s > 120 && conn.classList.contains("pill-on")) setConn("wait", "Pas de données");
      else if (s <= 120 && conn.classList.contains("pill-wait") && conn.textContent.includes("Pas de")) setConn("on", DEMO ? "Démo" : "En direct");
    }
    checkMidnight(now);
    renderFrost();
  }

  // ------------------------------------------------------------------
  // Mode démo (?demo) : données simulées, sans serveur ni broker
  // ------------------------------------------------------------------
  const Demo = {
    model(t) {
      const p = WXT.parts(t), h = p.h + p.mi / 60;
      const sun = Math.max(0, Math.sin(((h - 7.5) / 12.5) * Math.PI));
      const n = (a) => (Math.sin(t / 1300 + a) + Math.sin(t / 470 + a * 2)) / 2;
      return {
        outTemp: 11 + 7 * Math.sin(((h - 9.5) / 24) * 2 * Math.PI) + 0.6 * n(1),
        outHumidity: Math.min(99, 72 - 22 * Math.sin(((h - 9.5) / 24) * 2 * Math.PI) + 3 * n(2)),
        barometer: 1014 + 2.5 * Math.sin(t / 60000) + 0.3 * n(3),
        radiation: Math.max(0, 780 * Math.pow(sun, 1.3) * (0.8 + 0.2 * n(4))),
        windSpeed: Math.max(0, 9 + 6 * sun + 5 * n(5)),
        windDir: (230 + 40 * n(6) + 360) % 360,
        rain: h > 3 && h < 6 ? 0.2 * (n(7) > 0.2 ? 1 : 0) : 0,
      };
    },
    history() {
      const now = Math.floor(Date.now() / 1000), start = now - SPAN, series = {};
      const keys = ["outTemp", "outHumidity", "barometer", "radiation", "windSpeed", "windGust", "windDir", "rain"];
      keys.forEach((k) => (series[k] = []));
      for (let t = Math.ceil(start / 300) * 300; t <= now; t += 300) {
        const m = this.model(t);
        for (const k of keys) {
          let v = k === "windGust" ? m.windSpeed * 1.6 + 3 : m[k];
          series[k].push([t, round(v)]);
        }
      }
      const mid = midnightOf(now), day = {};
      for (const k of ["outTemp", "outHumidity", "barometer", "radiation", "windSpeed", "windGust"]) {
        const pts = series[k].filter((p) => p[0] >= mid);
        if (!pts.length) continue;
        const lo = pts.reduce((a, b) => (b[1] < a[1] ? b : a)), hi = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
        day[k] = { min: lo[1], minTime: lo[0], max: hi[1], maxTime: hi[0] };
      }
      const rainToday = series.rain.filter((p) => p[0] >= mid).reduce((a, p) => a + p[1], 0);
      day.rain = { sum: round(rainToday) };
      day.rainRate = { min: 0, max: rainToday ? 2.4 : 0, maxTime: mid + 4.2 * 3600 };
      // paramètres configurés (skin.conf) : valeurs simulées
      for (const [i, g] of GENERIC.filter((x) => x.aggregate !== "sum").entries()) {
        series[g.key] = [];
        for (let t = Math.ceil(start / 300) * 300; t <= now; t += 300) series[g.key].push([t, round(this.extra(t, i))]);
        const pts = series[g.key].filter((p) => p[0] >= mid);
        if (!pts.length) continue;
        const lo = pts.reduce((a, b) => (b[1] < a[1] ? b : a)), hi = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
        day[g.key] = { min: lo[1], minTime: lo[0], max: hi[1], maxTime: hi[0] };
      }
      return { midnight: mid, nextMidnight: WXT.addDays(mid, 1), series, day };
    },
    // mesure simulée n° i (ex. particules : PM10 > PM2.5 > PM1)
    extra(t, i) {
      const n = (Math.sin(t / 5200 + i) + Math.sin(t / 1700 + i * 2)) / 2;
      return Math.max(0, (4 + 5 * i) * (1 + 0.45 * n));
    },
    start(cb) {
      const emit = () => {
        const t = Date.now() / 1000, m = this.model(t);
        const gust = m.windSpeed * (1.2 + Math.random() * 0.6);
        // format identique à weewx-mqtt (unit_system = METRIC, valeurs en chaînes)
        cb(normalize({
          dateTime: String(Math.floor(t)), usUnits: "16",
          outTemp_C: (m.outTemp + (Math.random() - 0.5) * 0.1).toFixed(1),
          "OutTemp-1h_C": this.model(t - 3600).outTemp.toFixed(1),
          "OutTemp-24h_C": this.model(t - 86400).outTemp.toFixed(1),
          outHumidity: m.outHumidity.toFixed(0),
          barometer_mbar: m.barometer.toFixed(1),
          windSpeed_kph: (m.windSpeed * (0.8 + Math.random() * 0.4)).toFixed(1),
          windGust_kph: gust.toFixed(1),
          windDir: (m.windDir + (Math.random() - 0.5) * 30).toFixed(0),
          radiation_Wpm2: m.radiation.toFixed(0),
          rain_cm: "0.0", rainRate_cm_per_hour: "0.0",
          // mesures configurées (même numérotation que history() ; nom MQTT, sinon clé)
          ...Object.fromEntries(GENERIC.filter((g) => g.aggregate !== "sum")
            .map((g, i) => [g.mqtt || g.key, (this.extra(t, i) * (0.95 + Math.random() * 0.1)).toFixed(1)])),
        }));
      };
      emit();
      setInterval(emit, 2500);
    },
  };

  // ------------------------------------------------------------------
  // Panneaux réduits / développés (choix mémorisé dans le navigateur, par panneau)
  // ------------------------------------------------------------------
  const LAYOUT_KEY = "weewx-live:compact";
  function loadLayout() {
    try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveLayout(l) {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch (e) { /* stockage indisponible */ }
  }
  const ICON_REDUCE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10l5-5 5 5"/></svg>';
  const ICON_EXPAND = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>';
  // panneaux réduits affichés en tête (style.css), sinon ordre du document (layout.js)
  function applyCompact(cardEl, compact) {
    cardEl.classList.toggle("compact", compact);
    const b = cardEl.querySelector(".size-btn");
    const title = cardEl.querySelector("h2").textContent.trim();
    b.innerHTML = compact ? ICON_EXPAND : ICON_REDUCE;
    b.setAttribute("aria-expanded", String(!compact));
    b.title = (compact ? "Développer le panneau " : "Réduire le panneau ") + title;
    b.setAttribute("aria-label", b.title);
  }
  function setupLayout() {
    const layout = loadLayout();
    const cards = [...document.querySelectorAll(".grid > .card")];
    for (const c of cards) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "size-btn";
      c.querySelector("header").appendChild(b);
      applyCompact(c, !!layout[c.dataset.param]);
      b.addEventListener("click", () => {
        const l = loadLayout();
        const compact = !c.classList.contains("compact");
        l[c.dataset.param] = compact;
        saveLayout(l);
        applyCompact(c, compact);
      });
    }
    document.querySelectorAll(".grid-tools [data-all]").forEach((b) => b.addEventListener("click", () => {
      const compact = b.dataset.all === "compact", l = {};
      for (const c of cards) { l[c.dataset.param] = compact; applyCompact(c, compact); }
      saveLayout(l);
    }));
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  if (DEMO) document.getElementById("mode").textContent = " · mode démo (données simulées)";
  tick();
  setInterval(tick, 1000);
  setInterval(() => { trim(); refreshCharts(); render(); }, 30 * 1000);
  if (!DAY) historyTimer = setInterval(loadHistory, HISTORY_REFRESH);
  (async () => {
    const cfg = await loadConfig();
    applyParams(cfg && cfg.parameters);
    setupLayout();
    if (DAY) {
      // page « jour » : la journée entière, de minuit à minuit
      ARCHIVE_MODE = true;
      for (const c of Object.values(charts)) if (c) c.setRange(DAY.midnight, DAY.nextMidnight);
      applyHistory(DAY);
      const last = S.tempTime || DAY.stop;
      const el = document.getElementById("day-last");
      // dernier enregistrement à minuit : il clôt la journée
      if (el && last) el.textContent = last >= DAY.nextMidnight ? " (minuit)"
        : ` (${WXT.hm(last)})`;
      return;
    }
    render();
    await loadHistory();
    startMqtt(cfg).catch((e) => {
      // ex. adresse de broker invalide : repli sur les archives
      showBanner("mqtt", `MQTT : ${e.message}`);
      setArchiveMode((cfg && cfg.mqtt && cfg.mqtt.archivePoll) || 60, "MQTT indisponible");
    });
  })();
})();
