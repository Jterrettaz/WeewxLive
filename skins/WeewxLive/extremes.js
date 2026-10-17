/* weewx-live — page « Extrêmes » : records de la station, classements (jours, mois,
 * averses) et plus longues périodes de gel, de sécheresse et de pluie (data/extremes.json). */
(function () {
  "use strict";

  const REFRESH = 30 * 60 * 1000;
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // dates et heures : fuseau de la station (WXT, nav.js)
  const day = (t) => (t ? WXT.fmt(t, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
  const hm = WXT.hm;
  const month = (y, m) => new Date(y, m - 1, 1).toLocaleDateString(WXL.locale, { month: "long", year: "numeric" });
  // textes de la langue choisie (i18n.js)
  const tx = WXL.ctx("Extremes"), tc = WXL.ctx("Common");
  const $ = (id) => document.getElementById(id);

  // valeurs métriques affichées dans les unités choisies (WXU, nav.js)
  const U = (g) => WXU.get(g);
  // températures colorées comme sur le tableau de bord (paliers de 3 °C, minichart.js : en °C)
  const temp = (v) => {
    const c = window.TempScale && isNum(v) ? ` style="color:${TempScale.textColor(Math.round(v * 10) / 10)}"` : "";
    return `<b${c}>${WXU.fmt("temp", v, 1)} ${U("temp")}</b>`;
  };
  const mm = (v) => `<b>${WXU.fmt("rain", v, 1)} ${U("rain")}</b>`;
  // durée « 13 j et 17 h » (arrondie à l'heure)
  const dur = (s) => {
    const H = Math.round(s / 3600), d = Math.floor(H / 24), h = H % 24;
    return d ? WXL.fill(WXL.loc("duration_d_and_h", "{d} d {h} h"), { d, h }) : WXL.fill(WXL.loc("duration_h", "{h} h"), { h });
  };

  function table(title, sub, heads, rows, wide) {
    const body = rows.length
      ? rows.map((r, i) => `<tr><td class="rk">${i + 1}</td>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${heads.length + 1}" class="muted">${esc(tc("No data yet"))}</td></tr>`;
    return `<article class="card x-card${wide ? " wide2" : ""}">
      <header><h3>${esc(title)}</h3></header>${sub ? `<p class="x-sub">${esc(sub)}</p>` : ""}
      <div class="x-scroll"><table class="xtab">
        <thead><tr><th scope="col"><span class="sr">${esc(tx("Rank"))}</span></th>${heads.map((h) => `<th scope="col">${esc(tx(h))}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody></table></div></article>`;
  }

  function render(d) {
    const top = d.top || 10, r = d.records || {}, th = d.thresholds || {};
    if (d.since) {
      $("x-since").textContent = tc("since {date}", { date: WXT.fmt(d.since, { month: "long", year: "numeric" }) });
    }
    const tile = (label, v, sub) => `<div class="tile"><div class="t-label">${esc(tx(label))}</div>
      <div class="t-val">${v}</div><div class="t-sub">${esc(sub || "")}</div></div>`;
    const when = (x) => (x && x.t ? WXL.fill(WXL.loc("on_day_at_time", "{day} {time}"), { day: day(x.t), time: hm(x.t) }) : "");
    const rec = r.tmin || r.tmax ? `<div class="stats x-records">
        ${tile("Lowest temperature", r.tmin ? temp(r.tmin.v) : "--", when(r.tmin))}
        ${tile("Highest temperature", r.tmax ? temp(r.tmax.v) : "--", when(r.tmax))}
        ${tile("Lowest pressure", r.pmin ? `<b>${WXU.fmt("press", r.pmin.v, 1)}</b><span>${U("press")}</span>` : "--", when(r.pmin))}
        ${tile("Highest pressure", r.pmax ? `<b>${WXU.fmt("press", r.pmax.v, 1)}</b><span>${U("press")}</span>` : "--", when(r.pmax))}
        ${tile("Strongest gust", r.gust ? `<b>${WXU.fmt("wind", r.gust.v, 1)}</b><span>${U("wind")}</span>` : "--", when(r.gust))}
        ${tile("Heaviest rain in one day", r.rainDay ? `<b>${WXU.fmt("rain", r.rainDay.v, 1)}</b><span>${U("rain")}</span>` : "--", r.rainDay ? WXL.fill(WXL.loc("on_day", "{day}"), { day: day(r.rainDay.t) }) : "")}
      </div>` : "";

    const T = (k) => d[k] || [];
    const days = [
      table(tx("The {top} coldest days", { top }), "", ["Mean temperature", "Date"], T("coldDays").map((x) => [temp(x.v), day(x.t)])),
      table(tx("The {top} warmest days", { top }), "", ["Mean temperature", "Date"], T("hotDays").map((x) => [temp(x.v), day(x.t)])),
      table(tx("The {top} wettest days", { top }), "", ["Day's rain", "Date"], T("wetDays").map((x) => [mm(x.v), day(x.t)])),
      table(tx("The {top} heaviest showers", { top }), tx("Rain in one hour (clock hour)"), ["Rain in one hour", "Date"],
        T("showers").map((x) => [mm(x.v), `${day(x.t)}<small>${hm(x.t)} – ${hm(x.t + 3600)}</small>`])),
    ];
    const months = [
      table(tx("The {top} coldest months", { top }), "", ["Mean temperature", "Month"], T("coldMonths").map((x) => [temp(x.v), month(x.y, x.m)])),
      table(tx("The {top} warmest months", { top }), "", ["Mean temperature", "Month"], T("hotMonths").map((x) => [temp(x.v), month(x.y, x.m)])),
      table(tx("The {top} wettest months", { top }), "", ["Month's rain", "Month"], T("wetMonths").map((x) => [mm(x.v), month(x.y, x.m)])),
      table(tx("The {top} driest months", { top }), "", ["Month's rain", "Month"], T("dryMonths").map((x) => [mm(x.v), month(x.y, x.m)])),
    ];
    const periods = [
      table(tx("The {top} longest frost spells", { top }), tx("Temperature continuously below {value}", { value: `${WXU.fmt("temp", 0, 0)} ${U("temp")}` }),
        ["Frost duration", "Start", "End", "Mean temperature", "Minimum temperature"],
        T("frost").map((x) => [`<b>${dur(x.dur)}</b>`, `${day(x.start)}<small>${hm(x.start)}</small>`, `${day(x.end)}<small>${hm(x.end)}</small>`, temp(x.avg), temp(x.min)]), true),
      table(tx("The {top} longest dry spells", { top }), tx("Consecutive days without measured rain"),
        ["Duration (days)", "First dry day", "Last dry day"],
        T("dry").map((x) => [`<b>${esc(x.days)}</b>`, day(x.start), day(x.end)])),
      table(tx("The {top} longest wet spells", { top }), tx("Consecutive days with daily rain > {value}", { value: `${WXU.fmt("rain", th.rainDay ?? 0.2, 1)} ${U("rain")}` }),
        ["Duration (days)", "First wet day", "Last wet day", "Total rain of the spell"],
        T("wet").map((x) => [`<b>${esc(x.days)}</b>`, day(x.start), day(x.end), mm(x.total)]), true),
    ];
    $("x-root").innerHTML = `${rec}
      <h3 class="x-h">${esc(tc("Days"))}</h3><div class="x-grid">${days.join("")}</div>
      <h3 class="x-h">${esc(tc("Months"))}</h3><div class="x-grid">${months.join("")}</div>
      <h3 class="x-h">${esc(tc("Periods"))}</h3><div class="x-grid">${periods.join("")}</div>
      <p class="x-note">${esc(tx("Days: mean temperature of days measured at least {pct} % of the time (today excluded).", { pct: Math.round((th.coverage ?? 0.75) * 100) }))}
        ${esc(tx("Months: complete months only (current month excluded). Showers: heaviest rain over one clock hour, one per day."))}</p>`;
    $("gen").textContent = d.generated ? " · " + tc("generated (records) {when}", { when: WXT.fmt(d.generated, { weekday: "short", hour: "2-digit", minute: "2-digit" }) }) : "";
  }

  let last = null;   // dernières données (redessin au changement de thème)
  async function load() {
    try {
      const res = await fetch("data/extremes.json?_=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      last = d;
      render(d);
    } catch (e) {
      // relecture en échec : records déjà affichés conservés
      if (!last) $("x-root").innerHTML = `<p class="banner">${esc(tx("Records unavailable (data/extremes.json: {error}).", { error: e.message }))}</p>`;
    }
  }

  (async () => {
    // nom, sous-titre et logo : nav.js ; ici le titre de l'onglet
    let cfg = null;
    try { cfg = await window.weewxConfig; } catch (e) { /* facultatif */ }
    if (cfg && cfg.stationName) document.title = tx("Records — {station}", { station: cfg.stationName });
    load();
  })();
  setInterval(load, REFRESH);
  // thème clair / sombre : couleurs des températures recalculées
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => last && render(last));
})();
