/* weewx-live — vigilance météo MeteoAlarm (data/warnings.json, [LiveJSON] [[meteoalarm]]) :
 *  - tableau de bord (#wa-bar) : pastilles des vigilances en cours (jaune, orange, rouge), une
 *    par lieu et par phénomène (niveau le plus élevé), lien vers vigilance.html ; masqué
 *    quand aucune vigilance n'est en cours ;
 *  - page « Vigilance météo » (#wa-root) : détail de chaque avertissement en cours ou à venir
 *    pour chaque lieu (période, phénomène, description, conseils, zone, émetteur…).
 * Relecture de data/warnings.json toutes les [[meteoalarm]] cache secondes (5 min par défaut). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const bar = $("wa-bar"), root = $("wa-root");
  if (!bar && !root) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tw = WXL.ctx("Warnings"), tc = WXL.ctx("Common");
  const BASE = (document.body && document.body.dataset.base) || "";
  const LEVEL = { 2: "Yellow warning", 3: "Orange warning", 4: "Red warning" };
  const LEVEL_DESC = { 2: "level_yellow_desc", 3: "level_orange_desc", 4: "level_red_desc" };
  const TYPES = ["wind", "snow-ice", "thunderstorm", "fog", "high-temperature", "low-temperature",
    "coastal-event", "forest-fire", "avalanches", "rain", "flooding", "rain-flood", "tornado", "tropical-cyclone", "other"];
  const typeName = (w) => tw("type_" + (TYPES.includes(w.type_id) ? w.type_id : "other"));

  // pictogrammes des phénomènes (24 × 24, trait)
  const P = {
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    "snow-ice": '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    thunderstorm: '<path d="M7 15a5 5 0 1 1 1.6-9.8A6 6 0 0 1 19 9a4 4 0 0 1-1 6"/><path d="m13 12-3 5h4l-3 5"/>',
    fog: '<path d="M4 8h16M2 12h20M4 16h16M6 20h12"/>',
    "high-temperature": '<path d="M10 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M18 5l2-2M19 10h3M18 15l2 2"/>',
    "low-temperature": '<path d="M10 14V4a2 2 0 1 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M19 4v6M16.5 5.5l5 3M21.5 5.5l-5 3"/>',
    "coastal-event": '<path d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M6 12c0-4 4-7 8-7"/>',
    "forest-fire": '<path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z"/>',
    avalanches: '<path d="M2 20 9 7l4 6 3-4 6 11z"/><circle cx="17" cy="5" r="1.5"/><circle cx="20" cy="9" r="1"/>',
    rain: '<path d="M7 13a5 5 0 1 1 1.6-9.8A6 6 0 0 1 19 7a4 4 0 0 1-1 6"/><path d="M8 16l-1 3M12 16l-1 3M16 16l-1 3"/>',
    flooding: '<path d="M4 11 12 4l8 7M6 10v4M18 10v4"/><path d="M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
    "rain-flood": '<path d="M7 11a5 5 0 1 1 1.6-9.8A6 6 0 0 1 19 5a4 4 0 0 1-1 6"/><path d="M9 13l-1 2M13 13l-1 2"/><path d="M2 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
    tornado: '<path d="M3 4h18M5 8h14M7 12h10M9 16h6M11 20h2"/>',
    "tropical-cyclone": '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C12 5 15 3 19 3c-2 1-3 3-3 5M12 14.5c0 4.5-3 6.5-7 6.5 2-1 3-3 3-5"/>',
    other: '<path d="M12 3 2 21h20zM12 10v5M12 18v.01"/>',
  };
  const icon = (w) => `<svg class="wa-ic" viewBox="0 0 24 24" aria-hidden="true">${P[w.type_id] || P.other}</svg>`;

  // dates et heures : fuseau de la station (WXT, nav.js)
  const when = (t) => WXT.fmt(t, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const nowS = () => Date.now() / 1000;
  const active = (w, now) => (!w.onset || w.onset <= now) && (!w.expires || w.expires > now);
  const period = (w) => (w.onset && w.expires ? tw("From {start} to {end}", { start: when(w.onset), end: when(w.expires) })
    : w.expires ? tw("Until {end}", { end: when(w.expires) }) : w.onset ? tw("From {start}", { start: when(w.onset) }) : "");

  let REFRESH = 300;

  async function load() {
    const r = await fetch(BASE + "data/warnings.json?_=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  // ---------------------------------------------------------------- tableau de bord
  function renderBar(d) {
    const now = nowS();
    const many = (d.locations || []).length > 1;
    // une pastille par niveau et par phénomène, regroupant les lieux concernés
    // (pour chaque lieu : niveau le plus élevé du phénomène parmi les avertissements en cours)
    const groups = new Map();
    for (const loc of d.locations || []) {
      const best = new Map();
      for (const w of (loc.warnings || []).filter((x) => active(x, now))) {
        const b = best.get(w.type_id);
        if (!b || w.level > b.level || (w.level === b.level && (w.expires || Infinity) > (b.expires || Infinity))) best.set(w.type_id, w);
      }
      for (const w of best.values()) {
        const k = w.level + "|" + w.type_id;
        if (!groups.has(k)) groups.set(k, { w, items: [] });
        groups.get(k).items.push({ loc, w });
      }
    }
    const pills = [...groups.values()].sort((a, b) => b.w.level - a.w.level || b.items.length - a.items.length);
    if (!pills.length) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.innerHTML = `<span class="wa-lead">${esc(tw("Warnings in force"))}</span>` + pills.map(({ w, items }) => {
      const places = items.map((x) => x.loc.title).join(", ");
      const label = many ? tw("{type} ({place})", { type: typeName(w), place: places }) : typeName(w);
      // infobulle : niveau · phénomène · lieu (fin de la vigilance), pour chaque lieu
      const ends = items.map((x) => [many ? x.loc.title : "", x.w.expires ? tw("Until {end}", { end: when(x.w.expires) }) : ""]
        .filter(Boolean).join(" : ")).filter(Boolean);
      const tip = [tw(LEVEL[w.level] || "Red warning"), typeName(w)].concat(ends).join(" · ");
      // un seul lieu : lien vers sa section ; plusieurs : haut de la page
      const href = BASE + "vigilance.html" + (items.length === 1 ? "#wa-" + encodeURIComponent(items[0].loc.id) : "");
      return `<a class="wa-pill wa-l${w.level}" href="${href}" title="${esc(tip)}">
        ${icon(w)}<span>${esc(label)}</span><span class="sr"> — ${esc(tw(LEVEL[w.level] || "Red warning"))}</span></a>`;
    }).join("");
    bar.hidden = false;
  }


  // ---------------------------------------------------------------- page « Vigilance météo »
  const CAP = { severity: ["Minor", "Moderate", "Severe", "Extreme"], certainty: ["Observed", "Likely", "Possible", "Unlikely"],
    urgency: ["Immediate", "Expected", "Future", "Past"] };
  const capVal = (k, v) => (v ? (CAP[k].includes(v) ? tw("cap_" + v) : v) : "");
  const para = (s) => esc(s).replace(/\r?\n/g, "<br>");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

  function warningCard(w, now, loc) {
    const on = active(w, now);
    const meta = [
      w.areas && w.areas.length ? [tw(w.areas.length > 1 ? "Areas" : "Area"), w.areas.join(", ")] : null,
      w.sender ? [tw("Issued by"), w.sender] : null,
      w.sent ? [tw("Published"), when(w.sent)] : null,
      w.severity ? [tw("Severity"), capVal("severity", w.severity)] : null,
      w.certainty ? [tw("Certainty"), capVal("certainty", w.certainty)] : null,
      w.urgency ? [tw("Urgency"), capVal("urgency", w.urgency)] : null,
    ].filter(Boolean);
    const web = safeUrl(w.web);
    return `<article class="wa-card wa-l${w.level}">
      <header>
        <span class="wa-badge wa-l${w.level}">${icon(w)}${esc(tw(LEVEL[w.level] || "Red warning"))}<span class="wa-place">${esc(loc.title)}</span></span>
        <h3>${esc(typeName(w))}</h3>
        <span class="wa-state${on ? " on" : ""}">${esc(tw(on ? "In progress" : "Upcoming"))}</span>
      </header>
      <p class="wa-period">${esc(period(w))}</p>
      ${w.event ? `<p class="wa-event">${esc(w.event)}</p>` : ""}
      ${w.headline && w.headline !== w.event ? `<p class="wa-head">${esc(w.headline)}</p>` : ""}
      ${w.description ? `<div class="wa-text">${para(w.description)}</div>` : ""}
      ${w.instruction ? `<h4>${esc(tw("Instructions"))}</h4><div class="wa-text">${para(w.instruction)}</div>` : ""}
      ${meta.length ? `<dl class="wa-meta">${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
      ${web ? `<p class="wa-link"><a href="${esc(web)}" target="_blank" rel="noopener">${esc(tw("More information ({site})", { site: web.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") }))}</a></p>` : ""}
    </article>`;
  }

  function renderPage(d) {
    const now = nowS();
    const locs = d.locations || [];
    const html = locs.map((loc) => {
      const ws = (loc.warnings || []).filter((w) => !w.expires || w.expires > now);
      const top = ws.filter((w) => active(w, now)).reduce((m, w) => Math.max(m, w.level), 0);
      const status = loc.error ? "" : top ? `<span class="wa-badge wa-l${top}">${esc(tw(LEVEL[top]))}</span>`
        : `<span class="wa-badge wa-l1">${esc(tw("No particular warning"))}</span>`;
      let body;
      if (loc.error) body = `<p class="muted">${esc(tw("Warnings unavailable ({error}).", { error: loc.error }))}</p>`;
      else if (!ws.length) body = `<p class="muted">${esc(tw("No warning in force or forecast."))}</p>`;
      else {
        const cur = ws.filter((w) => active(w, now)), next = ws.filter((w) => !active(w, now));
        body = (cur.length ? `<h3 class="wa-group">${esc(tw("In progress"))}</h3>${cur.map((w) => warningCard(w, now, loc)).join("")}` : "") +
               (next.length ? `<h3 class="wa-group">${esc(tw("Upcoming"))}</h3>${next.map((w) => warningCard(w, now, loc)).join("")}` : "");
      }
      const stale = loc.stale ? `<p class="muted">${esc(tw("Previous data kept (download failed: {error}).", { error: loc.warning || "" }))}</p>` : "";
      return `<section class="card wa-loc" id="wa-${esc(loc.id)}">
        <header><h2>${esc(loc.title)}</h2>${status}
          ${loc.fetched ? `<span class="hint">${esc(tw("updated at {time}", { time: WXT.hm(loc.fetched) }))}</span>` : ""}</header>
        ${stale}${body}</section>`;
    }).join("");
    const legend = [2, 3, 4].map((l) => `<li><span class="wa-badge wa-l${l}">${esc(tw(LEVEL[l]))}</span> ${esc(tw(LEVEL_DESC[l]))}</li>`).join("");
    root.innerHTML = (html || `<p class="muted">${esc(tw("No location configured ([[meteoalarm]] section of skin.conf)."))}</p>`) +
      `<section class="card wa-legend"><header><h2>${esc(tw("Warning levels"))}</h2></header><ul>${legend}</ul></section>`;
    // sources utilisées (MeteoAlarm, NWS, ECCC) : pied de page
    const SRC = { meteoalarm: "MeteoAlarm (EUMETNET)", nws: "National Weather Service (NOAA)", eccc: tw("src_eccc") };
    const src = $("wa-src");
    if (src && d.sources && d.sources.length) src.textContent = tw("Source: {sources}", { sources: d.sources.map((k) => SRC[k] || k).join(", ") });
    const g = $("gen");
    if (g && d.generated) g.textContent = " · " + tc("generated {when}", { when: WXT.fmt(d.generated, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
    // ancre du lieu (#wa-<id>) : défilement une fois la page remplie
    if (location.hash && !renderPage.scrolled) {
      renderPage.scrolled = true;
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView();
    }
  }

  async function update() {
    try {
      const d = await load();
      if (d.cache) REFRESH = Math.max(60, d.cache);
      if (!d.enable) {
        if (bar) bar.hidden = true;
        if (root) root.innerHTML = `<p class="muted">${esc(tw("No location configured ([[meteoalarm]] section of skin.conf)."))}</p>`;
        return;
      }
      if (bar) renderBar(d);
      if (root) renderPage(d);
    } catch (e) {
      if (root) root.innerHTML = `<p class="muted">${esc(tw("Warnings unavailable ({error}).", { error: e.message }))}</p>`;
    }
  }

  (window.weewxConfig || Promise.resolve(null)).then((cfg) => {
    const ma = cfg && cfg.meteoalarm;
    if (bar && !(ma && ma.enable)) return;        // tableau de bord : vigilance non configurée
    if (ma && ma.cache) REFRESH = Math.max(60, ma.cache);
    update();
    const tick = () => setTimeout(() => { if (!document.hidden) update(); tick(); }, REFRESH * 1000);
    tick();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
  });
})();
