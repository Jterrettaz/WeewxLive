/* weewx-live — pages de détail (fichiers data/p*.json générés par weewx) :
 *   detail.html?p=<paramètre>   un paramètre (ou un panneau groupé) : statistiques +
 *                               graphique sur 24 h, 7, 30, 365 et 730 jours, l'une sous l'autre ;
 *   detail.html?period=<24h|7d|30d|365d>   une période : une section par paramètre ;
 *   archive/month-AAAA-MM.html, year-AAAA.html : idem pour un mois ou une année, données
 *   intégrées à la page (window.WEEWX_PERIOD). */
(function () {
  "use strict";

  const q = new URLSearchParams(location.search);
  const DEMO = q.has("demo");
  const REFRESH = 5 * 60 * 1000;

  // ------------------------------------------------------------------
  // Définitions
  // ------------------------------------------------------------------
  const PERIODS = {
    "24h": { label: "24 dernières heures", xTicks: "h6" },
    "7d": { label: "7 derniers jours", xTicks: "day" },
    "30d": { label: "30 derniers jours", xTicks: "week" },
    "365d": { label: "365 derniers jours", xTicks: "month" },
    "730d": { label: "730 derniers jours", xTicks: "month" },   // 2 ans
    // pages d'archives (mois, année) : jamais affichées sur la page d'un paramètre
    month: { label: "Mois", xTicks: "week", archive: true },
    year: { label: "Année", xTicks: "month", archive: true },
    // option « only: [ids] » : période réservée à certains paramètres
  };

  const P = {
    outTemp: { title: "Température", hint: "extérieure", unit: "°C", dec: 1, color: "--temp", kind: "band", obs: "outTemp", minRange: 2 },
    wind: { title: "Vent", hint: "vitesse moyenne et rafales", unit: "km/h", dec: 0, color: "--wind", kind: "wind", floor: 0, minRange: 10 },
    rain: { title: "Pluie", hint: "précipitations", unit: "mm", dec: 1, color: "--rain", kind: "rain", sumKey: "rain", floor: 0, minRange: 1 },
    outHumidity: { title: "Humidité relative", hint: "extérieure", unit: "%", dec: 0, color: "--hum", kind: "band", obs: "outHumidity", ceil: 100, minRange: 10 },
    barometer: { title: "Pression", hint: "niveau de la mer", unit: "hPa", dec: 1, color: "--press", kind: "band", obs: "barometer", minRange: 4 },
  };

  let param = "outTemp", def = P.outTemp;

  // Paramètres configurés (skin.conf [[parameters]]) : titres des paramètres standard,
  // définitions des paramètres supplémentaires (agrégat min-max, max ou sum)
  const GENERIC_COLORS = ["--press", "--hum", "--sun", "--temp", "--wind"];
  const MEMBER_COLORS = ["--wind", "--temp", "--hum", "--sun", "--press"];
  function applyParams(list) {
    if (!list || !list.length) return;
    for (const k of Object.keys(P)) if (!list.some((p) => p.id === k && p.builtin)) delete P[k];
    let gi = 0;
    for (const p of list) {
      if (p.type === "group" && p.members && p.members.length) {
        // panneau groupé : une courbe par mesure (ex. PM1 / PM2.5 / PM10)
        const units = new Set(p.members.map((m) => m.unit));
        P[p.id] = {
          title: p.title, hint: p.hint || "", unit: units.size === 1 ? p.members[0].unit : "",
          dec: p.decimals ?? p.members[0].decimals ?? 1, color: p.members[0].color || MEMBER_COLORS[0],
          kind: "group", agg: p.aggregate === "max" ? "max" : "min-max", generic: true, minRange: 1,
          members: p.members.map((m, i) => ({
            key: m.key, title: m.title, unit: m.unit || "", dec: m.decimals ?? p.decimals ?? 1,
            color: m.color || MEMBER_COLORS[i % MEMBER_COLORS.length],
          })),
        };
        continue;
      }
      if (p.builtin) { if (P[p.id] && p.title) P[p.id].title = p.title; continue; }
      const kind = p.aggregate === "sum" ? "rain" : p.aggregate === "max" ? "max" : "band";
      P[p.id] = {
        title: p.title, hint: p.hint || "", unit: p.unit || "", dec: p.decimals ?? 1,
        color: p.color || GENERIC_COLORS[gi++ % GENERIC_COLORS.length],
        kind, obs: p.key, sumKey: p.key, generic: true, minRange: 1,
        floor: p.aggregate === "sum" ? 0 : undefined,
      };
    }
  }

  // ------------------------------------------------------------------
  // Formatage
  // ------------------------------------------------------------------
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const fmt = (v, d) => isNum(v)
    ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "--";
  // dates et heures : fuseau de la station (WXT, nav.js)
  const fr = (t, o) => WXT.fmt(t, o);
  const hm = (t) => fr(t, { hour: "2-digit", minute: "2-digit" });

  const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const dirName = (d) => (isNum(d) ? DIRS[Math.round(d / 22.5) % 16] : "--");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const nextMidnight = (t) => WXT.addDays(t, 1);
  const monthStart = WXT.monthStart;
  const nextMonth = (t) => WXT.addMonths(t, 1);

  // ------------------------------------------------------------------
  // Une section par période (statistiques + graphique), empilées sur la page
  // ------------------------------------------------------------------
  const round = (v) => Math.round(v * 100) / 100;

  // couleur d'un paramètre : nom de variable CSS uniquement (ex. --temp)
  const safeColor = (c, d) => (/^--[\w-]+$/.test(c || "") ? c : d);

  // périodes longues (365, 730 jours, année) : pluie en cumuls mensuels, dates avec l'année
  const isLong = (period) => period === "365d" || period === "730d" || period === "year";

  // « du … au … » d'une période
  function rangeText(period, d) {
    return `du ${fr(d.start, { weekday: "short", day: "numeric", month: "short", year: isLong(period) ? "numeric" : undefined })} ${hm(d.start)}` +
      ` au ${fr(d.stop, { weekday: "short", day: "numeric", month: "short" })} ${hm(d.stop)}`;
  }

  // Section : statistiques + graphique d'un paramètre (sp) sur une période
  function Section(period, el, sp) {
    const param = sp, def = P[sp];
    const LONG = isLong(period);
    let chart = null;
    const $q = (sel) => el.querySelector(sel);

    // « quand » adapté à la longueur de la période
    function when(t) {
      if (!t) return "";
      if (period === "24h") return fr(t, { weekday: "short" }) + " à " + hm(t);
      if (period === "7d") return fr(t, { weekday: "short", day: "numeric", month: "short" }) + " à " + hm(t);
      if (period === "30d") return fr(t, { day: "numeric", month: "short" }) + " à " + hm(t);
      return fr(t, { day: "numeric", month: "short", year: "numeric" }) + " à " + hm(t);
    }
    function dayLabel(t) {
      return fr(t, LONG
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { weekday: "short", day: "numeric", month: "short" });
    }
    // ------------------------------------------------------------------
    // Statistiques (tuiles)
    // ------------------------------------------------------------------
    function tiles(d) {
      const st = d.stats || {}, S = d.series || {}, days = d.days, th = (days && days.thresholds) || {};
      const u = def.unit, n = def.dec;
      const T = [];
      const add = (label, value, unit, sub, dec = n) => T.push({ label, value: fmt(value, dec), unit: isNum(value) ? unit : "", sub: sub || "" });
      // pluie sur 24 h : plus forte heure [début, mm, fin]
      const maxHour = (hours) => {
        const best = hours.reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);
        add("Max. en 1 h", best ? best[1] : 0, u, best ? `${fr(best[0], { weekday: "short" })} ${hm(best[0])} – ${hm(best[2])}` : "");
      };

      if (def.kind === "band") {
        const s = st[def.obs] || {};
        add("Minimum", s.min, u, when(s.minTime));
        add("Maximum", s.max, u, when(s.maxTime));
        add("Moyenne", s.avg, u);
        if (param === "outTemp" || param === "barometer") {
          add(param === "outTemp" ? "Amplitude" : "Écart", isNum(s.max) && isNum(s.min) ? s.max - s.min : null, u, "entre min. et max.");
        }
        if (param === "outTemp" && days) {
          add("Jours de gel", days.frostDays, "", `min. < ${fmt(th.frost, 0)} °C · sur ${days.days} j`, 0);
          add("Jours chauds", days.hotDays, "", `max. ≥ ${fmt(th.hot, 0)} °C · sur ${days.days} j`, 0);
        }
      } else if (def.kind === "wind") {
        const s = st.windSpeed || {}, g = st.windGust || {}, dir = (st.windDir || {}).vecdir;
        add("Vent moyen", s.avg, u);
        add("Vent max.", s.max, u, when(s.maxTime));
        add("Rafale max.", g.max, u, when(g.maxTime));
        T.push({ label: "Direction dominante", value: dirName(dir), unit: "", sub: isNum(dir) ? Math.round(dir) + "°" : "" });
      } else if (def.kind === "max") {
        const s = st[def.obs] || {};
        add("Maximum", s.max, u, when(s.maxTime));
        add("Moyenne", s.avg, u);
        if (d.resolution === "day") {
          const mx = ((S[def.obs] || {}).max || []).map((p) => p[1]);
          if (mx.length) add("Moyenne des maxima", mx.reduce((a, b) => a + b, 0) / mx.length, u, "maximum journalier moyen");
        }
      } else if (def.kind === "rain" && def.generic) {
        add("Cumul", (st[def.sumKey] || {}).sum, u);
        if (d.resolution !== "raw") {
          const daily = (d.daily && d.daily[def.sumKey]) || [];
          const best = daily.reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);
          add("Max. journalier", best ? best[1] : null, u, best && best[1] ? dayLabel(best[0]) : "");
          add("Jours non nuls", daily.filter((x) => x[1] > 0).length, "", `sur ${daily.length} j`, 0);
        } else {
          maxHour(rainBuckets(d).filter((b) => b[1] > 0));
        }
      } else if (def.kind === "rain") {
        const r = st.rain || {}, rr = st.rainRate || {};
        add("Cumul", r.sum, u);
        add("Intensité max.", rr.max, "mm/h", rr.max ? when(rr.maxTime) : "");
        if (days) {
          add("Jours de pluie", days.rainDays, "", `≥ ${fmt(th.rain, 1)} mm · sur ${days.days} j`, 0);
          const m = days.maxDailyRain;
          add("Max. journalier", m ? m.value : null, u, m && m.value ? dayLabel(m.time) : "");
        } else {
          const hours = rainBuckets(d).filter((b) => b[1] > 0);
          maxHour(hours);
          add("Heures de pluie", hours.length, "", "au moins une averse", 0);
        }
      }
      return T;
    }

    // Panneau groupé : tableau (une ligne par mesure) au lieu des tuiles
    function groupTable(d) {
      const st = d.stats || {}, mm = def.agg === "min-max";
      const cell = (v, m, t) => `<td><b>${esc(fmt(v, m.dec))}</b>${isNum(v) && m.unit ? `<small class="u">${esc(m.unit)}</small>` : ""}${t ? `<small>${esc(when(t))}</small>` : ""}</td>`;
      const rows = def.members.map((m) => {
        const s = st[m.key] || {};
        return `<tr><th scope="row"><i class="sw" style="background:var(${m.color})"></i>${esc(m.title)}</th>
          ${mm ? cell(s.min, m, s.minTime) : ""}${cell(s.max, m, s.maxTime)}${cell(s.avg, m)}</tr>`;
      }).join("");
      return `<table class="gtab gstats"><thead><tr><th scope="col"><span class="sr">Mesure</span></th>
        ${mm ? '<th scope="col">Minimum</th>' : ""}<th scope="col">Maximum</th><th scope="col">Moyenne</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    function renderTiles(d) {
      if (def.kind === "group") { $q(".stats").classList.add("stats-group"); $q(".stats").innerHTML = groupTable(d); return; }
      $q(".stats").innerHTML = tiles(d).map((t) => `
        <div class="tile">
          <div class="t-label">${esc(t.label)}</div>
          <div class="t-val"><b>${esc(t.value)}</b>${t.unit ? `<span>${esc(t.unit)}</span>` : ""}</div>
          <div class="t-sub">${esc(t.sub)}</div>
        </div>`).join("");
    }

    // ------------------------------------------------------------------
    // Graphique
    // ------------------------------------------------------------------
    // Pluie : barres (horaires, journalières ou mensuelles) [début, mm, fin]
    function rainBuckets(d) {
      if (d.resolution === "raw") {
        const m = new Map();
        for (const [t, v] of ((d.series || {})[def.sumKey] || [])) {
          const h = Math.floor((t - 1) / 3600) * 3600;   // horodatage weewx = fin d'intervalle
          m.set(h, (m.get(h) || 0) + v);
        }
        return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, round(v), t + 3600]);
      }
      const daily = (d.daily && d.daily[def.sumKey]) || [];
      if (!LONG) return daily.map(([t, v]) => [t, v, nextMidnight(t)]);
      const m = new Map();
      for (const [t, v] of daily) { const k = monthStart(t); m.set(k, (m.get(k) || 0) + v); }
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, round(v), nextMonth(t)]);
    }

    function rainCumul(d) {
      const fine = d.resolution === "raw"
        ? ((d.series || {})[def.sumKey] || [])
        : ((d.daily && d.daily[def.sumKey]) || []).map(([t, v]) => [nextMidnight(t), v]);
      const out = [[d.start, 0]];
      let s = 0;
      for (const [t, v] of fine) { s += v; out.push([Math.min(t, d.stop), round(s)]); }
      return out;
    }

    function buildSeries(d) {
      const res = d.resolution, S = d.series || {};
      const bucket = res === "hour" ? 3600 : res === "day" ? 86400 : 0;
      const mid = (p) => [p[0] + bucket / 2, p[1]];
      const series = [], legend = [];
      const swatch = (color, band) => band
        ? `<i class="band" style="background:color-mix(in srgb, var(${color}) 30%, transparent)"></i>`
        : `<i style="background:var(${color})"></i>`;

      if (param === "outTemp" && res === "day") {
        // Barres « Hi-Low » journalières colorées selon la moyenne du jour + courbe de la moyenne
        const o = S.outTemp || {};
        const avg = new Map((o.avg || []).map((p) => [p[0], p[1]]));
        const mins = new Map((o.min || []).map((p) => [p[0], p[1]]));
        const bars = (o.max || []).filter((p) => mins.has(p[0])).map((p) => [p[0] + 43200, mins.get(p[0]), p[1], avg.get(p[0])]);
        series.push({
          type: "range", label: "Min. – max.", color: def.color, bucket: 86400, data: bars,
          // barres colorées selon la moyenne du jour (échelle continue TEMP_STOPS)
          pointColor: (p) => (isNum(p[3]) ? TempScale.color(p[3]) : "var(--text-3)"),
        });
        series.push({ type: "line", label: "Moyenne", color: "--text-2", width: 1.5, endDot: false, data: (o.avg || []).map((p) => [p[0] + 43200, p[1]]) });
        legend.push(`${TempScale.hiloSwatch()}Min. – max. du jour`);
        legend.push(swatch("--text-2") + "Moyenne journalière");
        legend.push(TempScale.legend());
      } else if (def.kind === "band") {
        const o = S[def.obs] || (res === "raw" ? [] : {});
        // températures (°C) : courbes colorées selon la valeur (paliers TEMP_STEPS)
        const ts = def.unit === "°C" && !!window.TempScale;
        const sw = (band) => (ts ? TempScale.swatch(band) : swatch(def.color, band));
        if (res === "raw") {
          series.push({ type: "line", fill: true, tempScale: ts, label: def.title, color: def.color, data: o });
          if (ts) legend.push(sw(false) + def.title, TempScale.stepLegend());
        } else {
          const mins = new Map((o.min || []).map((p) => [p[0], p[1]]));
          const band = (o.max || []).filter((p) => mins.has(p[0])).map((p) => [p[0] + bucket / 2, mins.get(p[0]), p[1]]);
          series.push({ type: "band", tempScale: ts, label: "Min. – max.", color: def.color, data: band });
          series.push({ type: "line", tempScale: ts, label: "Moyenne", color: def.color, endDot: false, data: (o.avg || []).map(mid) });
          legend.push(sw(true) + (res === "hour" ? "Min. – max. horaires" : "Min. – max. journaliers"));
          legend.push(sw(false) + (res === "hour" ? "Moyenne horaire" : "Moyenne journalière"));
          if (ts) legend.push(TempScale.stepLegend());
        }
      } else if (def.kind === "wind") {
        if (res === "raw") {
          series.push({ type: "line", fill: true, label: "Moyen", color: "--wind", data: S.windSpeed || [] });
          series.push({ type: "line", label: "Rafales", color: "--gust", width: 1.5, endDot: false, data: S.windGust || [] });
          legend.push(swatch("--wind") + "Vent moyen", swatch("--gust") + "Rafales");
        } else {
          series.push({ type: "line", fill: true, label: "Moyen", color: "--wind", endDot: false, data: ((S.windSpeed || {}).avg || []).map(mid) });
          series.push({ type: "line", label: "Rafale max.", color: "--gust", width: 1.5, endDot: false, data: ((S.windGust || {}).max || []).map(mid) });
          const per = res === "hour" ? "horaire" : "journalier";
          legend.push(swatch("--wind") + `Vent moyen ${per}`, swatch("--gust") + `Rafale max. ${res === "hour" ? "horaire" : "journalière"}`);
        }
      } else if (def.kind === "max") {
        const o = S[def.obs] || (res === "raw" ? [] : {});
        if (res === "raw") {
          series.push({ type: "line", fill: true, label: def.title, color: def.color, data: o });
        } else {
          series.push({ type: "line", fill: true, label: "Maximum", color: def.color, endDot: false, data: (o.max || []).map(mid) });
          if (o.avg && o.avg.length) series.push({ type: "line", label: "Moyenne", color: "--text-3", width: 1.5, endDot: false, data: o.avg.map(mid) });
          legend.push(swatch(def.color) + (res === "hour" ? "Maximum horaire" : "Maximum journalier"));
          if (o.avg && o.avg.length) legend.push(swatch("--text-3") + (res === "hour" ? "Moyenne horaire" : "Moyenne journalière"));
        }
      } else if (def.kind === "group") {
        // une courbe par mesure : relevés bruts (24 h), sinon moyenne ou maximum horaire / journalier
        const agg = def.agg === "max" ? "max" : "avg";
        for (const m of def.members) {
          const o = S[m.key] || (res === "raw" ? [] : {});
          const data = res === "raw" ? o : (o[agg] || []).map(mid);
          series.push({ type: "line", label: m.title, color: m.color, width: 1.75, endDot: res === "raw", data });
          legend.push(swatch(m.color) + esc(m.title));
        }
        if (res !== "raw") {
          legend.push(`<span class="lg-note">${agg === "max" ? (res === "hour" ? "maximum horaire" : "maximum journalier")
            : (res === "hour" ? "moyenne horaire" : "moyenne journalière")}</span>`);
        }
      } else if (def.kind === "rain") {
        const bars = rainBuckets(d);
        const unitLabel = res === "raw" ? "horaire" : LONG ? "mensuel" : "journalier";
        const name = def.generic ? def.title : "Pluie";
        const lab = def.generic ? `Cumul ${unitLabel}` : `Pluie ${unitLabel.replace("mensuel", "mensuelle").replace("journalier", "journalière")}`;
        const col = def.generic ? def.color : "--rain";
        series.push({ type: "bar", label: lab, color: col, data: bars, month: LONG });
        const cumCol = def.generic ? "--text-2" : "--rainsum";
        series.push({ type: "line", label: "Cumul", color: cumCol, data: rainCumul(d) });
        legend.push(swatch(col) + (def.generic ? `${name} : cumul ${unitLabel}` : lab), swatch(cumCol) + "Cumul sur la période");
      }
      return { series, legend };
    }

    function chartTitle(res) {
      if (def.kind === "rain" && def.generic) return res === "raw" ? "Cumul horaire et cumul sur la période" : LONG ? "Cumul mensuel et cumul sur la période" : "Cumul journalier et cumul sur la période";
      if (def.kind === "rain") return res === "raw" ? "Pluie horaire et cumul" : LONG ? "Pluie mensuelle et cumul" : "Pluie journalière et cumul";
      if (param === "outTemp" && res === "day") return "Températures journalières : minimum – maximum et moyenne";
      if (def.kind === "group" && res !== "raw") {
        const a = def.agg === "max" ? "Maximum" : "Moyenne";
        return res === "hour" ? `${a} horaire par mesure` : `${a} journalière par mesure`.replace("Maximum journalière", "Maximum journalier");
      }
      if (res === "raw") return "Relevés d'archive weewx";
      return res === "hour" ? "Valeurs horaires" : "Valeurs journalières";
    }

    function tipHead(res) {
      return (t, s) => {
        if (s.type === "bar") {
          if (s.month) return fr(t, { month: "long", year: "numeric" });
          if (res === "raw") { const h = Math.floor(t / 3600) * 3600; return `${fr(h, { weekday: "short" })} ${hm(h)} – ${hm(h + 3600)}`; }
          return dayLabel(t);
        }
        if (res === "raw") return fr(t, { weekday: "short", day: "numeric", month: "short" }) + " " + hm(t);
        if (res === "hour") { const h = Math.floor(t / 3600) * 3600; return `${fr(h, { weekday: "short", day: "numeric", month: "short" })}, ${hm(h)} – ${hm(h + 3600)}`; }
        return dayLabel(t);
      };
    }

    function renderChart(d) {
      const res = d.resolution;
      const { series, legend } = buildSeries(d);
      const opts = {
        unit: def.unit, decimals: def.dec, floor: def.floor, ceil: def.ceil, minRange: def.minRange,
        range: [d.start, d.stop], xTicks: PERIODS[period].xTicks, yTicks: 4, padLeft: 44,
        maxGap: res === "raw" ? 3600 : res === "hour" ? 3 * 3600 : 3 * 86400,
        tipHead: tipHead(res),
      };
      if (!chart) chart = new MiniChart($q(".chart"), Object.assign({ series }, opts));
      else chart.setSeries(series, opts);
      chart.draw();
      $q(".chart-title").textContent = chartTitle(res);
      $q(".legend").innerHTML = legend.map((l) => `<li>${l}</li>`).join("");
    }

    let last = null;   // dernières données (redessin au changement de thème clair / sombre)
    function render(d) {
      last = d;
      $q(".p-range").textContent = rangeText(period, d);
      $q(".p-msg").hidden = true;
      renderTiles(d);
      renderChart(d);
    }
    function fail(msg) {
      $q(".p-msg").textContent = msg;
      $q(".p-msg").hidden = false;
    }
    return { render, fail, redraw: () => last && render(last) };
  }

  // ------------------------------------------------------------------
  // Chargement : toutes les périodes de la page en parallèle
  // ------------------------------------------------------------------
  const sections = {};
  // pages « par période » (menu Données, en haut)
  const PAGE_PERIODS = ["24h", "7d", "30d", "365d"];
  let byPeriod = null;

  const sectionHTML = (id, head, label) => `
      <section class="period" id="${id}" aria-labelledby="h-${id}">
        <div class="period-head"><h3 id="h-${id}">${head}</h3><span class="p-range"></span></div>
        <p class="p-msg banner" hidden></p>
        <div class="stats" role="group" aria-label="Statistiques"></div>
        <div class="card big">
          <header><h4 class="chart-title">--</h4></header>
          <div class="chart chart-big" role="img" aria-label="Graphique ${esc(label)}"></div>
          <ul class="legend"></ul>
        </div>
      </section>`;

  // page d'un paramètre : une section par période
  function buildSections() {
    const root = document.getElementById("sections");
    root.innerHTML = Object.entries(PERIODS).filter(([, p]) => !p.archive && (!p.only || p.only.includes(param)))
      .map(([r, p]) => sectionHTML("p" + r, esc(p.label), p.label)).join("");
    for (const r of Object.keys(PERIODS)) {
      if (PERIODS[r].archive) continue;
      const el = document.getElementById("p" + r);
      if (el) sections[r] = Section(r, el, param);
    }
  }

  // page d'une période : une section par paramètre, avec liens rapides
  function buildPeriodSections(r) {
    const root = document.getElementById("sections");
    const ids = Object.keys(P).filter((k) => !PERIODS[r].only || PERIODS[r].only.includes(k));
    const link = (k) => {
      const h = window.WeewxNav ? WeewxNav.href(k) : "detail.html?p=" + encodeURIComponent(k);
      const anchor = { month: "30d", year: "365d" }[r] || r;
      return `<a href="${esc(h)}#p${anchor}">${esc(P[k].title)}</a>`;
    };
    root.innerHTML = `<nav class="p-jump" aria-label="Paramètres de la page">${ids.map((k) =>
      `<a href="#s-${esc(k)}"><i style="background:var(${P[k].color})"></i>${esc(P[k].title)}</a>`).join("")}</nav>` +
      ids.map((k) => sectionHTML("s-" + k,
        `<span class="sw" style="background:var(${P[k].color})"></span>${link(k)}`, `${P[k].title}, ${PERIODS[r].label}`)).join("");
    for (const k of ids) sections[k] = Section(r, document.getElementById("s-" + k), k);
  }

  const EMBED = window.WEEWX_PERIOD || null;   // page d'archive : données dans la page
  async function fetchPeriod(r) {
    if (EMBED) return EMBED.data;
    if (DEMO) return Demo.period(r);
    const res = await fetch(`data/p${r}.json?_=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  const failText = (r, e) => `Données indisponibles (${EMBED ? "données de la page" : `data/p${r}.json`} : ${e.message}).`;
  // page d'un paramètre : un fichier par période
  async function loadOne(r) {
    try {
      const d = await fetchPeriod(r);
      sections[r].render(d);
      return d;
    } catch (e) {
      sections[r].fail(failText(r, e));
      return null;
    }
  }
  // page d'une période : un seul fichier pour toutes les sections
  async function loadPeriod(r) {
    try {
      const d = await fetchPeriod(r);
      for (const x of Object.values(sections)) x.render(d);
      document.getElementById("p-last").textContent = rangeText(r, d);
      return [d];
    } catch (e) {
      for (const x of Object.values(sections)) x.fail(failText(r, e));
      return [];
    }
  }

  async function loadAll() {
    const res = byPeriod ? await loadPeriod(byPeriod) : await Promise.all(Object.keys(sections).map(loadOne));
    const gen = res.filter(Boolean).map((d) => d.generated || 0);
    document.getElementById("gen").textContent = gen.length
      ? " · générées " + fr(Math.max(...gen), { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
  }

  // ------------------------------------------------------------------
  // Mode démo (?demo) : mêmes structures que les fichiers générés par weewx
  // ------------------------------------------------------------------
  const Demo = {
    model(t) {
      const p = WXT.parts(t), h = p.h + p.mi / 60;
      const doy = (t / 86400) % 365.25;
      const season = -Math.cos(((doy - 15) / 365.25) * 2 * Math.PI);
      const sun = Math.max(0, Math.sin(((h - 7.5) / 12.5) * Math.PI));
      const n = (a) => (Math.sin(t / 13000 + a) + Math.sin(t / 4700 + a * 2)) / 2;
      const wet = Math.sin(t / 86400 / 3.1) + Math.sin(t / 86400 / 7.3) > 1.1;
      return {
        outTemp: 11 + 8 * season + 6 * Math.sin(((h - 9.5) / 24) * 2 * Math.PI) + 2.5 * n(1),
        outHumidity: Math.min(99, 74 - 18 * Math.sin(((h - 9.5) / 24) * 2 * Math.PI) + 6 * n(2)),
        barometer: 1015 + 7 * Math.sin(t / 290000) + 0.6 * n(3),
        radiation: Math.max(0, (450 + 330 * season) * Math.pow(sun, 1.3) * (0.75 + 0.25 * n(4))),
        windSpeed: Math.max(0, 9 + 5 * sun + 6 * n(5)),
        windGust: Math.max(0, 16 + 8 * sun + 9 * n(5)),
        windDir: (230 + 50 * n(6) + 360) % 360,
        rain: wet && n(7) > -0.2 ? 0.2 : 0,
        rainRate: wet && n(7) > -0.2 ? 2.4 : 0,
      };
    },
    period(r) {
      const stop = Math.floor(Date.now() / 300000) * 300, step = r === "24h" || r === "7d" ? 300 : 1800;
      const ndays = { "24h": 1, "7d": 7, "30d": 30, "365d": 365, "730d": 730 }[r];
      let start = stop - 86400;
      if (r !== "24h") start = WXT.addDays(stop - 1, 1 - ndays);
      const keys = ["outTemp", "outHumidity", "barometer", "radiation", "windSpeed", "windGust", "windDir", "rain", "rainRate"];
      const samples = [];
      for (let t = start + step; t <= stop; t += step) samples.push([t, this.model(t)]);
      if (step > 300) samples.forEach(([, m]) => { m.rain *= step / 300; });

      const stats = {}, agg = (k, arr) => {
        let mn = null, mx = null, s = 0;
        for (const [t, m] of arr) { const v = m[k]; s += v; if (!mn || v < mn[1]) mn = [t, v]; if (!mx || v > mx[1]) mx = [t, v]; }
        return { min: round(mn[1]), minTime: mn[0], max: round(mx[1]), maxTime: mx[0], avg: round(s / arr.length), sum: round(s) };
      };
      for (const k of ["outTemp", "outHumidity", "barometer", "radiation", "windSpeed", "windGust", "rainRate"]) stats[k] = agg(k, samples);
      stats.rain = { sum: agg("rain", samples).sum };
      stats.windDir = { vecdir: 232 };

      const group = (fn) => {
        const m = new Map();
        for (const s of samples) { const k = fn(s[0] - 1); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
        const out = {};
        for (const k of keys) {
          const o = { min: [], max: [], avg: [], sum: [] };
          for (const [t, arr] of m) { const a = agg(k, arr); o.min.push([t, a.min]); o.max.push([t, a.max]); o.avg.push([t, a.avg]); o.sum.push([t, a.sum]); }
          out[k] = o;
        }
        return out;
      };
      const out = { period: r, start, stop, generated: stop, stats };
      if (r === "24h") {
        out.resolution = "raw";
        out.series = {};
        for (const k of keys) out.series[k] = samples.map(([t, m]) => [t, round(m[k])]);
        return out;
      }
      const dayKey = WXT.midnight;
      const daily = group(dayKey);
      out.resolution = r === "7d" ? "hour" : "day";
      out.series = r === "7d" ? group((t) => Math.floor(t / 3600) * 3600) : daily;
      out.daily = { rain: daily.rain.sum };
      out.days = {
        days: daily.outTemp.max.length,
        frostDays: daily.outTemp.min.filter((p) => p[1] < 0).length,
        hotDays: daily.outTemp.max.filter((p) => p[1] >= 25).length,
        rainDays: daily.rain.sum.filter((p) => p[1] >= 1).length,
        thresholds: { frost: 0, hot: 25, rain: 0.2 },
      };
      const best = daily.rain.sum.reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);
      if (best) out.days.maxDailyRain = { value: best[1], time: best[0] };
      return out;
    },
  };

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  function start() {
    loadAll();
    if (!EMBED) setInterval(loadAll, REFRESH);   // page d'archive : données figées
    // thème clair / sombre : légendes (couleurs de température) reconstruites
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => Object.values(sections).forEach((x) => x.redraw()));
  }
  (async () => {
    let cfg = null;
    if (!DEMO) {
      try {
        cfg = await window.weewxConfig;   // demandée une seule fois par nav.js
      } catch (e) { /* facultatif */ }
    }
    applyParams(cfg && cfg.parameters);
    for (const k of Object.keys(P)) {
      P[k].color = safeColor(P[k].color, "--text-2");
      if (P[k].members) P[k].members.forEach((m) => (m.color = safeColor(m.color, "--text-2")));
    }
    const per = EMBED ? EMBED.kind : q.get("period");
    if (per && (EMBED || PAGE_PERIODS.includes(per))) {
      // page d'une période : tous les paramètres
      byPeriod = per;
      if (window.WeewxNav) WeewxNav.setCurrent(EMBED ? "archives" : "period:" + per);
      if (!Object.keys(P).length) {
        document.getElementById("sections").innerHTML = '<p class="banner">Aucun paramètre à afficher (voir [[parameters]] dans skin.conf).</p>';
        return;
      }
      document.body.classList.add("by-period");
      if (!EMBED) document.getElementById("p-title").innerHTML = `<span class="sw" style="background:var(--text-2)"></span>${esc(PERIODS[per].label)}`;
      document.getElementById("p-last").textContent = "";
      if (DEMO) document.getElementById("mode").textContent = " · mode démo (données simulées)";
      if (!EMBED) document.title = `${PERIODS[per].label} — ${(cfg && cfg.stationName) || "Station météo"}`;
      buildPeriodSections(per);
      start();
      return;
    }
    const wanted = q.get("p");
    param = P[wanted] ? wanted : Object.keys(P)[0];
    def = P[param];
    if (!def) {
      document.getElementById("sections").innerHTML = '<p class="banner">Aucun paramètre à afficher (voir [[parameters]] dans skin.conf).</p>';
      return;
    }
    if (window.WeewxNav) WeewxNav.setCurrent(param);   // menu : paramètre réellement affiché
    document.getElementById("p-title").innerHTML = `<span class="sw" style="background:var(${def.color})"></span>${esc(def.title)}`;
    document.getElementById("p-last").textContent = def.hint;
    document.body.style.setProperty("--c", `var(${def.color})`);
    if (DEMO) document.getElementById("mode").textContent = " · mode démo (données simulées)";
    document.title = `${def.title} — ${(cfg && cfg.stationName) || "Station météo"}`;
    buildSections();
    start();
  })();
})();
