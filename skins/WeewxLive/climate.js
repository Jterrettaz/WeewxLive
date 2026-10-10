/* weewx-live — cadre « Ce jour et ce mois au fil des ans » du tableau de bord : records
 * des mêmes jour et mois des années passées, comparés aux valeurs actuelles ; graphiques
 * par année. Données : data/climate.json (weewx, résumés journaliers) ; valeurs du jour
 * complétées par les mesures du tableau de bord (app.js, window.weewxLiveState). */
(function () {
  "use strict";

  const DEMO = new URLSearchParams(location.search).has("demo");
  const $ = (id) => document.getElementById(id);
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const fmt = (v, d = 1) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "--");
  // valeur en gras ; unité métrique convertie dans l'unité d'affichage choisie (WXU, nav.js)
  const B = (v, u, d = 1) => {
    const g = WXU.groupOf(u);
    return `<b>${g ? WXU.fmt(g, v, d) : fmt(v, d)}${u ? " " + (g ? WXU.get(g) : u) : ""}</b>`;
  };
  // dates et heures : fuseau de la station (WXT, nav.js)
  const hm = (t) => (isNum(t) ? WXT.hm(t) : "--");
  const dmy = (t) => (isNum(t) ? WXT.fmt(t, { day: "2-digit", month: "long", year: "numeric" }) : "--");
  const dmyShort = (t) => WXT.fmt(t, { day: "2-digit", month: "2-digit", year: "numeric" });
  const monthName = (m) => new Date(2000, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
  const de = (word) => (/^[aeiouyhâéèêîôû]/i.test(word) ? "d'" : "de ") + word;   // « d'octobre », « de mars »

  let data = null;
  const charts = {};

  // ------------------------------------------------------------------
  // Valeurs du jour : fichier weewx + mesures temps réel du tableau de bord
  // ------------------------------------------------------------------
  function withLive(d) {
    const S = window.weewxLiveState;
    const out = JSON.parse(JSON.stringify(d));
    if (!S || !S.day) return out;
    // le jour de climate.json doit être celui des mesures en cours (fichier régénéré au plus
    // toutes les 15 min : juste après minuit, il décrit encore la veille)
    const midnightOfToday = WXT.mk(out.today.year, out.today.month, out.today.day);
    if (S.midnight && Math.abs(midnightOfToday - S.midnight) > 7200) return out;
    const y = out.today.year;
    const dayRow = out.day.find((r) => r.year === y);
    const monthRow = out.month.find((r) => r.year === y);
    const t = S.day.outTemp || {}, p = S.day.barometer || {};
    const upd = (row, k, v, tk, tv, better) => {
      if (!row || !isNum(v)) return;
      if (!isNum(row[k]) || better(v, row[k])) { row[k] = v; row[tk] = tv; }
    };
    for (const row of [dayRow, monthRow]) {
      upd(row, "tmin", t.min, "tminTime", t.minTime, (a, b) => a < b);
      upd(row, "tmax", t.max, "tmaxTime", t.maxTime, (a, b) => a > b);
      upd(row, "pmin", p.min, "pminTime", p.minTime, (a, b) => a < b);
      upd(row, "pmax", p.max, "pmaxTime", p.maxTime, (a, b) => a > b);
    }
    if (dayRow && isNum(S.dayRain)) {
      if (monthRow && isNum(monthRow.rain) && isNum(dayRow.rain)) monthRow.rain = monthRow.rain - dayRow.rain + S.dayRain;
      dayRow.rain = S.dayRain;
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Textes
  // ------------------------------------------------------------------
  const best = (rows, k, cmp) => rows.filter((r) => isNum(r[k])).reduce((a, r) => (!a || cmp(r[k], a[k]) ? r : a), null);
  const hi = (a, b) => a > b, lo = (a, b) => a < b;

  // ligne « actuelle » mise en évidence si elle dépasse le record
  // (provisional : moyenne d'un jour / d'un mois encore en cours)
  const now = (html, record, provisional) => `<p class="cl-now${record ? " cl-record" : ""}">${html}${record
    ? ` <span class="cl-badge">${provisional ? "record provisoire" : "record"}</span>` : ""}</p>`;

  function dayText(d) {
    const y = d.today.year, past = d.day.filter((r) => r.year !== y), cur = d.day.find((r) => r.year === y) || {};
    const L = [];
    const rec = (label, row, txt) => row ? `<p><b>${label} :</b> en ${row.year} ${txt}</p>` : "";
    const hot = best(past, "tavg", hi), cold = best(past, "tavg", lo);
    L.push(`<div class="cl-group">${rec("Le plus chaud", hot, `avec une température moyenne de ${B(hot && hot.tavg, "°C")}`)}`,
      now(`Aujourd'hui, la température moyenne actuelle est de ${B(cur.tavg, "°C")}`,
        hot && isNum(cur.tavg) && (cur.tavg > hot.tavg || (cold && cur.tavg < cold.tavg)), true),
      `${rec("Le plus froid", cold, `avec une température moyenne de ${B(cold && cold.tavg, "°C")}`)}</div>`);
    const tmx = best(past, "tmax", hi), tmn = best(past, "tmin", lo);
    L.push(`<div class="cl-group">${rec("Température la plus haute", tmx, `avec ${B(tmx && tmx.tmax, "°C")} à ${tmx ? hm(tmx.tmaxTime) : ""}`)}`,
      now(`Aujourd'hui, la température maximale est de ${B(cur.tmax, "°C")}`, tmx && cur.tmax > tmx.tmax),
      rec("Température la plus basse", tmn, `avec ${B(tmn && tmn.tmin, "°C")} à ${tmn ? hm(tmn.tminTime) : ""}`),
      `${now(`Aujourd'hui, la température minimale est de ${B(cur.tmin, "°C")}`, tmn && cur.tmin < tmn.tmin)}</div>`);
    const pmx = best(past, "pmax", hi), pmn = best(past, "pmin", lo);
    L.push(`<div class="cl-group">${rec("Pression la plus haute", pmx, `avec ${B(pmx && pmx.pmax, "hPa")}`)}`,
      now(`Aujourd'hui, la pression maximale est de ${B(cur.pmax, "hPa")}`, pmx && cur.pmax > pmx.pmax),
      rec("Pression la plus basse", pmn, `avec ${B(pmn && pmn.pmin, "hPa")}`),
      `${now(`Aujourd'hui, la pression minimale est de ${B(cur.pmin, "hPa")}`, pmn && cur.pmin < pmn.pmin)}</div>`);
    const wet = best(past, "rain", hi), windy = best(past, "wind", hi);
    L.push(`<div class="cl-group">${rec("Le plus pluvieux", wet, `avec ${B(wet && wet.rain, "mm")}`)}`,
      `${now(`Aujourd'hui : ${B(cur.rain, "mm")}`, wet && cur.rain > wet.rain)}</div>`);
    L.push(`<div class="cl-group">${rec("Le plus venteux", windy, `avec un vent moyen de ${B(windy && windy.wind, "km/h")} (rafale max. de ${B(windy && windy.gust, "km/h", 0)})`)}</div>`);
    return L.join("");
  }

  function monthText(d) {
    const y = d.today.year, mn = monthName(d.today.month), dmn = de(mn);
    const past = d.month.filter((r) => r.year !== y), full = past.filter((r) => r.complete);
    const cur = d.month.find((r) => r.year === y) || {};
    const L = [];
    const hot = best(full, "tavg", hi), cold = best(full, "tavg", lo);
    L.push(`<div class="cl-group">${hot ? `<p>Le mois ${dmn} <b>le plus chaud</b> : en ${hot.year} avec une température moyenne de ${B(hot.tavg, "°C")}</p>` : ""}`,
      now(`Ce mois-ci, température moyenne actuelle de ${B(cur.tavg, "°C")}`,
        isNum(cur.tavg) && ((hot && cur.tavg > hot.tavg) || (cold && cur.tavg < cold.tavg)), true),
      `${cold ? `<p>Le mois ${dmn} <b>le plus froid</b> : en ${cold.year} avec une température moyenne de ${B(cold.tavg, "°C")}</p>` : ""}</div>`);
    const tmx = best(past, "tmax", hi), tmn = best(past, "tmin", lo);
    L.push(`<div class="cl-group">${tmx ? `<p><b>Température la plus haute</b> mesurée en ${mn} : le ${dmy(tmx.tmaxTime)} avec ${B(tmx.tmax, "°C")}</p>` : ""}`,
      now(`Ce mois-ci, la plus haute est de ${B(cur.tmax, "°C")}${cur.tmaxTime ? ` le ${dmyShort(cur.tmaxTime)}` : ""}`, tmx && cur.tmax > tmx.tmax),
      tmn ? `<p><b>Température la plus basse</b> mesurée en ${mn} : le ${dmy(tmn.tminTime)} avec ${B(tmn.tmin, "°C")}</p>` : "",
      `${now(`Ce mois-ci, la plus basse est de ${B(cur.tmin, "°C")}${cur.tminTime ? ` le ${dmyShort(cur.tminTime)}` : ""}`, tmn && cur.tmin < tmn.tmin)}</div>`);
    const pmx = best(past, "pmax", hi), pmn = best(past, "pmin", lo);
    L.push(`<div class="cl-group">${pmx ? `<p><b>Pression la plus haute</b> mesurée en ${mn} : le ${dmy(pmx.pmaxTime)} avec ${B(pmx.pmax, "hPa")}</p>` : ""}`,
      now(`Ce mois-ci, la plus haute est de ${B(cur.pmax, "hPa")}${cur.pmaxTime ? ` le ${dmyShort(cur.pmaxTime)}` : ""}`, pmx && cur.pmax > pmx.pmax),
      pmn ? `<p><b>Pression la plus basse</b> mesurée en ${mn} : le ${dmy(pmn.pminTime)} avec ${B(pmn.pmin, "hPa")}</p>` : "",
      `${now(`Ce mois-ci, la plus basse est de ${B(cur.pmin, "hPa")}${cur.pminTime ? ` le ${dmyShort(cur.pminTime)}` : ""}`, pmn && cur.pmin < pmn.pmin)}</div>`);
    const hd = past.filter((r) => r.hotDay).reduce((a, r) => (!a || r.hotDay.v > a.hotDay.v ? r : a), null);
    const cd = past.filter((r) => r.coldDay).reduce((a, r) => (!a || r.coldDay.v < a.coldDay.v ? r : a), null);
    L.push(`<div class="cl-group">${hd ? `<p>Le <b>jour le plus chaud</b> en ${mn} : le ${dmy(hd.hotDay.t)} avec une moyenne de ${B(hd.hotDay.v, "°C")}</p>` : ""}`,
      `${cd ? `<p>Le <b>jour le plus froid</b> en ${mn} : le ${dmy(cd.coldDay.t)} avec une moyenne de ${B(cd.coldDay.v, "°C")}</p>` : ""}</div>`);
    const wet = best(full, "rain", hi), dry = best(full, "rain", lo);
    L.push(`<div class="cl-group">${wet ? `<p>Le mois ${dmn} <b>le plus pluvieux</b> : en ${wet.year} avec ${B(wet.rain, "mm")}</p>` : ""}`,
      dry ? `<p>Le mois ${dmn} <b>le plus sec</b> : en ${dry.year} avec ${B(dry.rain, "mm")}</p>` : "",
      `${now(`Ce mois-ci : ${B(cur.rain, "mm")} jusqu'à présent`, wet && cur.rain > wet.rain)}</div>`);
    return L.join("");
  }

  // ------------------------------------------------------------------
  // Graphiques (années en abscisse)
  // ------------------------------------------------------------------
  function yearChart(id, rows, kind, tip) {
    if (!window.MiniChart) return;
    const years = rows.map((r) => r.year);
    if (!years.length) return;
    const y0 = Math.min(...years), y1 = Math.max(...years);
    const ticks = years.map((y) => ({ t: y, label: String(y) }));
    const opts = {
      range: [y0 - 0.6, y1 + 0.6], xTicks: "list", xTickList: ticks, yTicks: 4, padLeft: 40,
      tipHead: (t) => tip(Math.round(t)),
    };
    let series;
    if (kind === "temp") {
      Object.assign(opts, { unit: "°C", decimals: 1, minRange: 5 });
      series = [{
        type: "range", label: "Min. – max.", color: "--temp", bucket: 1, midTick: true, valueLabels: true,
        data: rows.filter((r) => isNum(r.tmin) && isNum(r.tmax)).map((r) => [r.year, r.tmin, r.tmax, r.tavg]),
        pointColor: (p) => (isNum(p[3]) ? TempScale.color(p[3]) : "var(--text-3)"),
      }];
    } else {
      Object.assign(opts, { unit: "mm", decimals: 1, floor: 0, minRange: 1 });
      series = [{ type: "bar", label: "Pluie", color: "--rain", data: rows.filter((r) => isNum(r.rain)).map((r) => [r.year - 0.5, r.rain, r.year + 0.5]) }];
    }
    if (!charts[id]) charts[id] = new MiniChart($(id), Object.assign({ series }, opts));
    else charts[id].setSeries(series, opts);
    charts[id].draw();
  }

  // ------------------------------------------------------------------
  function render() {
    if (!data) return;
    const d = withLive(data);
    const { day, month } = d.today;
    const mn = monthName(month);
    const since = WXT.fmt(d.since, { month: "long", year: "numeric" });
    $("cl-day-title").textContent = `${day === 1 ? "1er" : day} ${mn} : extrêmes`;
    $("cl-month-title").textContent = `Pour ${mn}`;
    document.querySelectorAll(".cl-since").forEach((e) => (e.textContent = `(statistiques depuis ${since})`));
    $("cl-day-text").innerHTML = dayText(d);
    $("cl-month-text").innerHTML = monthText(d);
    $("cl-day-th").textContent = `Températures des ${day === 1 ? "1er" : day} ${mn}`;
    $("cl-day-rh").textContent = `Précipitations des ${day === 1 ? "1er" : day} ${mn}`;
    $("cl-month-th").textContent = `Températures des mois ${de(mn)}`;
    $("cl-month-rh").textContent = `Précipitations des mois ${de(mn)}`;
    yearChart("cl-day-temp", d.day, "temp", (y) => `${day} ${mn} ${y}`);
    yearChart("cl-day-rain", d.day, "rain", (y) => `${day} ${mn} ${y}`);
    yearChart("cl-month-temp", d.month, "temp", (y) => `${mn} ${y}`);
    yearChart("cl-month-rain", d.month, "rain", (y) => `${mn} ${y}${y === d.today.year ? " (en cours)" : ""}`);
    document.querySelectorAll(".cl-scale").forEach((e) => (e.innerHTML = TempScale.legend()));
    document.querySelectorAll("#climate .legend i.hilo").forEach((e) => (e.outerHTML = TempScale.hiloSwatch()));
  }

  async function load() {
    try {
      if (DEMO) data = demo();
      else {
        const r = await fetch("data/climate.json?_=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        data = j;
      }
      $("climate").hidden = false;
      render();
    } catch (e) {
      // pas de données : section masquée (les données déjà affichées sont conservées)
      if (!data) $("climate").hidden = true;
      console.warn("climate.json :", e.message);
    }
  }

  // Données simulées (?demo) : 20 ans
  function demo() {
    const t = WXT.parts(WXT.now()), y = t.y, m = t.m, dd = t.d;
    const rnd = (s) => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
    const day = [], month = [];
    for (let yr = y - 19; yr <= y; yr++) {
      const k = yr * 7, base = 12 + (rnd(k) - 0.5) * 8;
      // dates du mois : jamais dans le futur pour l'année en cours
      const ts = (h, dd2 = dd) => WXT.mk(yr, m, yr === y ? Math.min(dd2, dd) : dd2, h, 10);
      day.push({ year: yr, tavg: +base.toFixed(1), tmin: +(base - 3 - rnd(k + 1) * 4).toFixed(1), tminTime: ts(6), tmax: +(base + 3 + rnd(k + 2) * 6).toFixed(1), tmaxTime: ts(15),
        pmin: +(1008 + rnd(k + 3) * 12).toFixed(1), pminTime: ts(4), pmax: +(1015 + rnd(k + 4) * 12).toFixed(1), pmaxTime: ts(22),
        rain: rnd(k + 5) > 0.6 ? +(rnd(k + 6) * 14).toFixed(1) : 0, wind: +(3 + rnd(k + 7) * 5).toFixed(1), gust: +(20 + rnd(k + 8) * 25).toFixed(0) });
      const mb = 12 + (rnd(k + 9) - 0.5) * 4;
      month.push({ year: yr, complete: yr !== y, days: 31, tavg: +mb.toFixed(1), tmin: +(mb - 9 - rnd(k + 10) * 5).toFixed(1), tminTime: ts(6, 1 + Math.floor(rnd(k + 11) * 28)),
        tmax: +(mb + 7 + rnd(k + 12) * 6).toFixed(1), tmaxTime: ts(15, 1 + Math.floor(rnd(k + 13) * 28)),
        pmin: +(985 + rnd(k + 14) * 20).toFixed(1), pminTime: ts(3, 1 + Math.floor(rnd(k + 15) * 28)), pmax: +(1022 + rnd(k + 16) * 12).toFixed(1), pmaxTime: ts(21, 1 + Math.floor(rnd(k + 17) * 28)),
        hotDay: { v: +(mb + 5).toFixed(1), t: ts(0, 2) }, coldDay: { v: +(mb - 8).toFixed(1), t: ts(0, 28) },
        rain: +(15 + rnd(k + 18) * 180).toFixed(1), wind: +(5 + rnd(k + 19) * 4).toFixed(1) });
    }
    return { since: WXT.mk(y - 19, 4, 1), today: { year: y, month: m, day: dd }, day, month };
  }

  load();
  setInterval(load, 15 * 60 * 1000);   // relecture du fichier (mis à jour par weewx)
  setInterval(() => data && render(), 60 * 1000);      // valeurs du jour en temps réel
  // thème clair / sombre : légendes reconstruites
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => data && render());
})();
