/* weewx-live — page « Extrêmes » : records de la station, classements (jours, mois,
 * averses) et plus longues périodes de gel, de sécheresse et de pluie (data/extremes.json). */
(function () {
  "use strict";

  const REFRESH = 30 * 60 * 1000;
  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const fmt = (v, d = 1) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "--");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // dates et heures : fuseau de la station (WXT, nav.js)
  const day = (t) => (t ? WXT.fmt(t, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
  const hm = WXT.hm;
  const month = (y, m) => new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const $ = (id) => document.getElementById(id);

  // températures colorées comme sur le tableau de bord (paliers de 3 °C, minichart.js)
  const temp = (v) => {
    const c = window.TempScale && isNum(v) ? ` style="color:${TempScale.textColor(Math.round(v * 10) / 10)}"` : "";
    return `<b${c}>${fmt(v)} °C</b>`;
  };
  const mm = (v) => `<b>${fmt(v)} mm</b>`;
  // durée « 13 j et 17 h » (arrondie à l'heure)
  const dur = (s) => {
    const H = Math.round(s / 3600), d = Math.floor(H / 24), h = H % 24;
    return d ? `${d} j et ${h} h` : `${h} h`;
  };

  function table(title, sub, heads, rows, wide) {
    const body = rows.length
      ? rows.map((r, i) => `<tr><td class="rk">${i + 1}</td>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${heads.length + 1}" class="muted">Pas encore de données</td></tr>`;
    return `<article class="card x-card${wide ? " wide2" : ""}">
      <header><h3>${esc(title)}</h3></header>${sub ? `<p class="x-sub">${esc(sub)}</p>` : ""}
      <div class="x-scroll"><table class="xtab">
        <thead><tr><th scope="col"><span class="sr">Rang</span></th>${heads.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody></table></div></article>`;
  }

  function render(d) {
    const top = d.top || 10, r = d.records || {}, th = d.thresholds || {};
    if (d.since) {
      $("x-since").textContent = "depuis " + WXT.fmt(d.since, { month: "long", year: "numeric" });
    }
    const tile = (label, v, sub) => `<div class="tile"><div class="t-label">${esc(label)}</div>
      <div class="t-val">${v}</div><div class="t-sub">${esc(sub || "")}</div></div>`;
    const when = (x) => (x && x.t ? `le ${day(x.t)} à ${hm(x.t)}` : "");
    const rec = r.tmin || r.tmax ? `<div class="stats x-records">
        ${tile("Température la plus basse", r.tmin ? temp(r.tmin.v) : "--", when(r.tmin))}
        ${tile("Température la plus haute", r.tmax ? temp(r.tmax.v) : "--", when(r.tmax))}
        ${tile("Pression la plus basse", r.pmin ? `<b>${fmt(r.pmin.v)}</b><span>hPa</span>` : "--", when(r.pmin))}
        ${tile("Pression la plus haute", r.pmax ? `<b>${fmt(r.pmax.v)}</b><span>hPa</span>` : "--", when(r.pmax))}
        ${tile("Rafale la plus forte", r.gust ? `<b>${fmt(r.gust.v)}</b><span>km/h</span>` : "--", when(r.gust))}
        ${tile("Pluie la plus forte en un jour", r.rainDay ? `<b>${fmt(r.rainDay.v)}</b><span>mm</span>` : "--", r.rainDay ? "le " + day(r.rainDay.t) : "")}
      </div>` : "";

    const T = (k) => d[k] || [];
    const days = [
      table(`Les ${top} jours les plus froids`, "", ["Température moyenne", "Date"], T("coldDays").map((x) => [temp(x.v), day(x.t)])),
      table(`Les ${top} jours les plus chauds`, "", ["Température moyenne", "Date"], T("hotDays").map((x) => [temp(x.v), day(x.t)])),
      table(`Les ${top} jours les plus pluvieux`, "", ["Pluie du jour", "Date"], T("wetDays").map((x) => [mm(x.v), day(x.t)])),
      table(`Les ${top} averses les plus fortes`, "Pluie en une heure (heure pleine)", ["Pluie en une heure", "Date"],
        T("showers").map((x) => [mm(x.v), `${day(x.t)}<small>${hm(x.t)} – ${hm(x.t + 3600)}</small>`])),
    ];
    const months = [
      table(`Les ${top} mois les plus froids`, "", ["Température moyenne", "Mois"], T("coldMonths").map((x) => [temp(x.v), month(x.y, x.m)])),
      table(`Les ${top} mois les plus chauds`, "", ["Température moyenne", "Mois"], T("hotMonths").map((x) => [temp(x.v), month(x.y, x.m)])),
      table(`Les ${top} mois les plus pluvieux`, "", ["Pluie du mois", "Mois"], T("wetMonths").map((x) => [mm(x.v), month(x.y, x.m)])),
      table(`Les ${top} mois les plus secs`, "", ["Pluie du mois", "Mois"], T("dryMonths").map((x) => [mm(x.v), month(x.y, x.m)])),
    ];
    const periods = [
      table(`Les ${top} plus longues périodes de gel`, "Température continuellement inférieure à 0 °C",
        ["Durée du gel", "Début", "Fin", "Température moyenne", "Température minimum"],
        T("frost").map((x) => [`<b>${dur(x.dur)}</b>`, `${day(x.start)}<small>${hm(x.start)}</small>`, `${day(x.end)}<small>${hm(x.end)}</small>`, temp(x.avg), temp(x.min)]), true),
      table(`Les ${top} plus longues périodes de sécheresse`, "Jours consécutifs sans pluie mesurée",
        ["Durée (jours)", "Premier jour sec", "Dernier jour sec"],
        T("dry").map((x) => [`<b>${esc(x.days)}</b>`, day(x.start), day(x.end)])),
      table(`Les ${top} plus longues périodes de pluie`, `Jours consécutifs avec pluie journalière > ${fmt(th.rainDay ?? 0.2)} mm`,
        ["Durée (jours)", "Premier jour pluvieux", "Dernier jour pluvieux", "Pluie totale de la période"],
        T("wet").map((x) => [`<b>${esc(x.days)}</b>`, day(x.start), day(x.end), mm(x.total)]), true),
    ];
    $("x-root").innerHTML = `${rec}
      <h3 class="x-h">Jours</h3><div class="x-grid">${days.join("")}</div>
      <h3 class="x-h">Mois</h3><div class="x-grid">${months.join("")}</div>
      <h3 class="x-h">Périodes</h3><div class="x-grid">${periods.join("")}</div>
      <p class="x-note">Jours : température moyenne des jours mesurés à au moins ${Math.round((th.coverage ?? 0.75) * 100)} % (aujourd'hui exclu).
        Mois : mois complets uniquement (mois en cours exclu). Averses : plus forte pluie sur une heure pleine, une seule par jour.</p>`;
    $("gen").textContent = d.generated ? " · générés " + WXT.fmt(d.generated, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
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
      if (!last) $("x-root").innerHTML = `<p class="banner">Records indisponibles (data/extremes.json : ${esc(e.message)}).</p>`;
    }
  }

  (async () => {
    // nom, sous-titre et logo : nav.js ; ici le titre de l'onglet
    let cfg = null;
    try { cfg = await window.weewxConfig; } catch (e) { /* facultatif */ }
    if (cfg && cfg.stationName) document.title = `Records — ${cfg.stationName}`;
    load();
  })();
  setInterval(load, REFRESH);
  // thème clair / sombre : couleurs des températures recalculées
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => last && render(last));
})();
