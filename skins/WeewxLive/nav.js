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
