/* weewx-live — heure de la station (WXT), puis menu commun.
 * Toutes les dates et heures des pages sont affichées dans le fuseau horaire de la station
 * (window.WX_TZ, défini par wxtime.js généré par weewx : celui du système weewx ou
 * [LiveJSON] timezone), quel que soit celui du visiteur. nav.js est chargé avant les autres
 * scripts de chaque page. Les instants sont en secondes Unix (UTC).
 *   WXT.fmt(t, options)    texte, comme toLocaleString("fr-FR", options), heure de la station
 *   WXT.hm(t)              « 14:05 »
 *   WXT.parts(t)           { y, m (1-12), d, h, mi, s, wd (0 = dimanche) } heure de la station
 *   WXT.mk(y, m, d, h, mi) instant d'une date et heure de la station (débordements admis :
 *                          d = 32, m = 13… comme Date.UTC)
 *   WXT.midnight(t), WXT.addDays(t, n), WXT.monthStart(t), WXT.addMonths(t, n)
 *                          minuit du jour, de n jours plus tard, du 1er du mois, de n mois plus tard
 *   WXT.ymd(t)             « AAAA-MM-JJ »
 *   WXT.iso(s)             instant d'une date « AAAA-MM-JJ[THH:MM] » (heure de la station)
 *   WXT.now()              instant présent */

(function () {
  "use strict";

  // fuseau : wxtime.js (généré), sinon configuration intégrée à la page, sinon navigateur
  // (pages d'archives générées avant la version 1.68, qui ne chargent pas wxtime.js)
  let TZ = window.WX_TZ || (window.WEEWX_CONFIG && window.WEEWX_CONFIG.timezone) || undefined;
  try { if (TZ) new Intl.DateTimeFormat("fr-FR", { timeZone: TZ }); }
  catch (e) { TZ = undefined; }                 // nom inconnu du navigateur

  // formats (création coûteuse) mis en cache par jeu d'options
  const formats = new Map();
  const dtf = (o) => {
    const k = JSON.stringify(o || {});
    let f = formats.get(k);
    if (!f) { f = new Intl.DateTimeFormat("fr-FR", Object.assign({}, o, { timeZone: TZ })); formats.set(k, f); }
    return f;
  };
  const fmt = (t, o) => dtf(o).format(new Date(t * 1000));

  // décalage (s) de l'heure de la station sur UTC, mémorisé par quart d'heure (les
  // changements d'heure tombent toujours sur une limite de 15 min)
  const NUM = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  const offsets = new Map();
  function offset(t) {
    const k = Math.floor(t / 900);
    let o = offsets.get(k);
    if (o === undefined) {
      const q = k * 900, p = {};
      NUM.formatToParts(new Date(q * 1000)).forEach((x) => { if (x.type !== "literal") p[x.type] = +x.value; });
      o = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) / 1000 - q;
      offsets.set(k, o);
    }
    return o;
  }

  function parts(t) {
    const d = new Date((t + offset(t)) * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
      h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay() };
  }
  function mk(y, m, d, h = 0, mi = 0) {
    const w = Date.UTC(y, m - 1, d, h, mi) / 1000;
    const t = w - offset(w);
    return w - offset(t);                         // 2e passe : changement d'heure entre w et t
  }
  const pad = (n) => String(n).padStart(2, "0");
  const midnight = (t) => { const p = parts(t); return mk(p.y, p.m, p.d); };
  const addDays = (t, n) => { const p = parts(t); return mk(p.y, p.m, p.d + n); };
  const monthStart = (t) => { const p = parts(t); return mk(p.y, p.m, 1); };
  const addMonths = (t, n) => { const p = parts(t); return mk(p.y, p.m + n, 1); };
  const ymd = (t) => { const p = parts(t); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
  function iso(s) {
    const m = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/.exec(String(s));
    return m ? mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
  }

  window.WXT = {
    tz: TZ, fmt, parts, mk, midnight, addDays, monthStart, addMonths, ymd, iso,
    hm: (t) => fmt(t, { hour: "2-digit", minute: "2-digit" }),
    now: () => Date.now() / 1000,
  };
})();

/* weewx-live — menu commun aux pages : « Tableau de bord », puis menus déroulants
 * « Données » (pages par période, une page de détail par paramètre de skin.conf,
 * « Extrêmes », « Archives »), « Climatologie » (tableaux mensuel et annuel, si
 * [[archives]] climato) et « Prévisions » (« Météogramme », « Ensembles », si activés).
 * Fournit la configuration aux autres scripts (window.weewxConfig : intégrée à la page ou
 * config.json) ; sur les pages statiques (detail, extremes, meteogram, ensembles), applique
 * aussi le nom de la station, le sous-titre et le logo. */
(function () {
  "use strict";

  const HOME = { id: "home", label: "Tableau de bord" };
  // menu par défaut (avant lecture de la configuration)
  let DATA = [
    { id: "outTemp", label: "Température" },
    { id: "wind", label: "Vent" },
    { id: "rain", label: "Pluie" },
    { id: "outHumidity", label: "Humidité" },
    { id: "barometer", label: "Pression" },
  ];
  // pages par période (tous les paramètres), en haut du menu « Données »
  const PERIOD_PAGES = [
    { id: "period:24h", label: "24 dernières heures" },
    { id: "period:7d", label: "7 derniers jours" },
    { id: "period:30d", label: "30 derniers jours" },
    { id: "period:365d", label: "365 derniers jours" },
  ];
  // pages supplémentaires du menu « Données », après les paramètres
  const EXTRA = [{ id: "extremes", label: "Extrêmes", page: "extremes.html" }];

  // menu « Climatologie » (rempli d'après la configuration : [[archives]] climato)
  const CLIMATO = [];
  // menu « Prévisions » (rempli d'après la configuration : [[ensembles]] enable)
  const FORECAST = [];
  const FC_PAGES = [{ id: "fc:meteogram", label: "Météogramme", page: "meteogram.html", key: "meteogram" },
                    { id: "fc:ensembles", label: "Ensembles", page: "ensembles.html", key: "ensembles" }];
  const fcPage = FC_PAGES.find((e) => location.pathname.endsWith("/" + e.page) || location.pathname === e.page);

  // pages situées dans un sous-dossier (pages d'archives : archive/) : préfixe des liens
  const BASE = (document.body && document.body.dataset.base) || "";
  const archM = /\/archive\/(day|month|year|climato)-([\d-]+)\.html$/.exec(location.pathname) || [];
  const archKind = archM[1];
  const isArchive = !!archKind && archKind !== "climato";
  // tableau climatologique : mensuel (climato-AAAA-MM) ou annuel (climato-AAAA)
  const climatoId = archKind === "climato" ? (archM[2].length > 4 ? "climato:month" : "climato:year") : "";

  const q = new URLSearchParams(location.search);
  const demo = q.has("demo");
  const isDetail = /detail\.html$/.test(location.pathname);
  const extra = EXTRA.find((e) => location.pathname.endsWith("/" + e.page) || location.pathname === e.page);
  let current = climatoId || (fcPage ? fcPage.id : null) || (isArchive ? "archives" : extra ? extra.id
    : isDetail ? (q.get("period") ? "period:" + q.get("period") : q.get("p") || "outTemp") : "home");

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Lien vers une page, en conservant le mode démo
  function href(id) {
    if (id === "home") return BASE + "index.html" + (demo ? "?demo" : "");
    const e = EXTRA.find((x) => x.id === id) || CLIMATO.find((x) => x.id === id) || FC_PAGES.find((x) => x.id === id);
    if (e) return BASE + e.page + (e.page.endsWith(".html") && demo ? "?demo" : "");
    const p = id.startsWith("period:") ? new URLSearchParams({ period: id.slice(7) }) : new URLSearchParams({ p: id });
    if (demo) p.set("demo", "");
    return BASE + "detail.html?" + p.toString().replace(/demo=(&|$)/, "demo$1");
  }

  // Archives (pages jour / mois / année, si générées) : page la plus fine disponible
  // pour la date du jour
  function setArchives(cfg) {
    if (cfg && !FORECAST.length) FC_PAGES.forEach((p) => { if (cfg[p.key] && cfg[p.key].enable) FORECAST.push(p); });
    const a = cfg && cfg.archives;
    if (!a || EXTRA.some((e) => e.id === "archives")) return;
    const [y, m, dd] = WXT.ymd(WXT.now()).split("-");   // date du jour de la station
    const page = a.day ? `archive/day-${y}-${m}-${dd}.html` : a.month ? `archive/month-${y}-${m}.html` : a.year ? `archive/year-${y}.html` : "";
    if (page) EXTRA.push({ id: "archives", label: "Archives", page });
    if (a.climato && !CLIMATO.length) {
      CLIMATO.push({ id: "climato:month", label: "Climatologie mensuelle", page: `archive/climato-${y}-${m}.html` },
                   { id: "climato:year", label: "Climatologie année", page: `archive/climato-${y}.html` });
    }
  }

  const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
  let menus = [];   // menus déroulants affichés : [{ dd, btn, list, links }]

  function open(st, focusFirst, last) {
    menus.forEach((o) => o !== st && close(o, false));
    st.list.hidden = false; st.btn.setAttribute("aria-expanded", "true");
    // liste alignée à droite du bouton si elle dépasse de l'écran
    st.list.style.left = st.list.style.right = "";
    if (st.list.getBoundingClientRect().right > document.documentElement.clientWidth - 8) {
      st.list.style.left = "auto"; st.list.style.right = "0";
    }
    if (focusFirst) (last ? st.links[st.links.length - 1] : st.list.querySelector('[aria-current="page"]') || st.links[0]).focus();
  }
  function close(st, refocus) {
    if (!st || st.list.hidden) return;
    st.list.hidden = true; st.btn.setAttribute("aria-expanded", "false");
    if (refocus) st.btn.focus();
  }
  // écouteurs globaux : enregistrés une seule fois (le menu est reconstruit après la config)
  document.addEventListener("click", (e) => menus.forEach((st) => { if (!st.dd.contains(e.target)) close(st, false); }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    menus.forEach((st) => { if (!st.list.hidden) close(st, st.dd.contains(document.activeElement)); });
  });

  // menu déroulant : bouton (libellé + page courante) et liste
  function dropdown(id, label, items, body) {
    const cur = items.find((d) => d.id === current);
    return `
      <div class="dd">
        <button type="button" class="dd-btn${cur ? " active" : ""}" aria-expanded="false" aria-controls="${id}">
          ${label}${cur ? `<span class="dd-cur"> · ${esc(cur.label)}</span>` : ""}${CHEVRON}
        </button>
        <ul class="dd-list" id="${id}" hidden>${body}</ul>
      </div>`;
  }

  function render() {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const item = (d) => `<li><a href="${esc(href(d.id))}"${d.id === current ? ' aria-current="page"' : ""}>${esc(d.label)}</a></li>`;
    nav.innerHTML = `
      <a href="${href("home")}"${current === "home" ? ' aria-current="page"' : ""}>${HOME.label}</a>` +
      dropdown("dd-data", "Données", [...PERIOD_PAGES, ...DATA, ...EXTRA], `
          <li class="dd-head" role="presentation">Tous les paramètres</li>
          ${PERIOD_PAGES.map(item).join("")}
          <li class="dd-sep" role="separator"></li>
          <li class="dd-head" role="presentation">Par paramètre</li>
          ${DATA.map(item).join("")}
          <li class="dd-sep" role="separator"></li>
          ${EXTRA.map(item).join("")}`) +
      (CLIMATO.length ? dropdown("dd-climato", "Climatologie", CLIMATO, CLIMATO.map(item).join("")) : "") +
      (FORECAST.length ? dropdown("dd-fc", "Prévisions", FORECAST, FORECAST.map(item).join("")) : "");
    document.querySelectorAll("a[data-detail]").forEach((a) => (a.href = href(a.dataset.detail)));

    menus = [...nav.querySelectorAll(".dd")].map((dd) => {
      const btn = dd.querySelector(".dd-btn"), list = dd.querySelector(".dd-list");
      const st = { dd, btn, list, links: [...list.querySelectorAll("a")] };
      btn.addEventListener("click", () => (list.hidden ? open(st, false) : close(st, false)));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); open(st, true); }
        else if (e.key === "ArrowUp") { e.preventDefault(); open(st, true, true); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); list.hidden ? open(st, true) : close(st, false); }
      });
      list.addEventListener("keydown", (e) => {
        const links = st.links, i = links.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
        else if (e.key === "Home") { e.preventDefault(); links[0].focus(); }
        else if (e.key === "End") { e.preventDefault(); links[links.length - 1].focus(); }
        else if (e.key === "Tab") close(st, false);
      });
      return st;
    });
  }

  // Liste des paramètres configurés (skin.conf [[parameters]]) : on reconstruit le menu
  // (la direction du vent n'a pas de page de détail ; un groupe a une seule page)
  function setParams(list) {
    if (list && list.length) DATA = list.filter((p) => p.id !== "windDir").map((p) => ({ id: p.id, label: p.title || p.id }));
    render();
  }
  // Paramètre réellement affiché par detail.js (ex. ?p= inconnu -> premier paramètre)
  function setCurrent(id) {
    if (id && id !== current) { current = id; render(); }
  }

  // Nom de la station, sous-titre et logo (pages statiques)
  function setBrand(cfg) {
    if (!cfg) return;
    const name = document.getElementById("station-name");
    if (name && cfg.stationName) name.textContent = cfg.stationName;
    const sub = document.getElementById("subtitle");
    if (sub && cfg.hardware) sub.textContent = cfg.hardware;
    const logo = cfg.logo, img = document.getElementById("brand-logo");
    if (logo && logo.src && img && img.hidden) {
      img.src = logo.src; img.alt = logo.alt || ""; img.style.height = logo.height + "px"; img.hidden = false;
    }
  }

  function apply(cfg) {
    if (!cfg) return;
    setArchives(cfg);
    setParams(cfg.parameters);
    setBrand(cfg);
  }
  if (window.WEEWX_CONFIG) {
    // tableau de bord généré par weewx : configuration intégrée à la page
    window.weewxConfig = Promise.resolve(window.WEEWX_CONFIG);
    setArchives(window.WEEWX_CONFIG);
    setParams(window.WEEWX_CONFIG.parameters);
  } else if (!demo) {
    // requête partagée avec les autres scripts de la page (window.weewxConfig)
    window.weewxConfig = fetch("config.json?_=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    window.weewxConfig.then(apply);
  } else {
    window.weewxConfig = Promise.resolve(null);
  }

  window.WeewxNav = { render, href, setParams, setCurrent, get current() { return current; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
