/* Menu commun aux pages : « Tableau de bord » + menu déroulant « Données » : pages par
 * période (tous les paramètres), une page de détail par paramètre de skin.conf, puis les
 * pages supplémentaires comme « Extrêmes ».
 * Sur les pages statiques (detail.html, extremes.html), applique aussi le nom de la
 * station, le sous-titre et le logo lus dans la configuration. */
(function () {
  "use strict";

  const HOME = { id: "home", label: "Tableau de bord" };
  // menu par défaut (avant lecture de la configuration)
  let DATA = [
    { id: "outTemp", label: "Température" },
    { id: "wind", label: "Vent" },
    { id: "rain", label: "Pluie" },
    { id: "radiation", label: "Rayonnement solaire" },
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

  // pages situées dans un sous-dossier (pages d'archives : archive/) : préfixe des liens
  const BASE = (document.body && document.body.dataset.base) || "";
  const isArchive = /\/archive\/(day|month|year)-[\d-]+\.html$/.test(location.pathname);

  const q = new URLSearchParams(location.search);
  const demo = q.has("demo");
  const isDetail = /detail\.html$/.test(location.pathname);
  const extra = EXTRA.find((e) => location.pathname.endsWith("/" + e.page) || location.pathname === e.page);
  let current = isArchive ? "archives" : extra ? extra.id
    : isDetail ? (q.get("period") ? "period:" + q.get("period") : q.get("p") || "outTemp") : "home";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Lien vers une page, en conservant le mode démo
  function href(id) {
    if (id === "home") return BASE + "index.html" + (demo ? "?demo" : "");
    const e = EXTRA.find((x) => x.id === id);
    if (e) return BASE + e.page + (e.page.endsWith(".html") && demo ? "?demo" : "");
    const p = id.startsWith("period:") ? new URLSearchParams({ period: id.slice(7) }) : new URLSearchParams({ p: id });
    if (demo) p.set("demo", "");
    return BASE + "detail.html?" + p.toString().replace(/demo=(&|$)/, "demo$1");
  }

  // Archives (pages jour / mois / année, si générées) : page la plus fine disponible
  // pour la date du jour
  function setArchives(cfg) {
    const a = cfg && cfg.archives;
    if (!a || EXTRA.some((e) => e.id === "archives")) return;
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    const page = a.day ? `archive/day-${y}-${m}-${dd}.html` : a.month ? `archive/month-${y}-${m}.html` : a.year ? `archive/year-${y}.html` : "";
    if (page) EXTRA.push({ id: "archives", label: "Archives", page });
  }

  const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
  let st = null;   // menu affiché : { nav, btn, list, links }

  function open(focusFirst, last) {
    if (!st) return;
    st.list.hidden = false; st.btn.setAttribute("aria-expanded", "true");
    if (focusFirst) (last ? st.links[st.links.length - 1] : st.list.querySelector('[aria-current="page"]') || st.links[0]).focus();
  }
  function close(refocus) {
    if (!st || st.list.hidden) return;
    st.list.hidden = true; st.btn.setAttribute("aria-expanded", "false");
    if (refocus) st.btn.focus();
  }
  // écouteurs globaux : enregistrés une seule fois (le menu est reconstruit après la config)
  document.addEventListener("click", (e) => { if (st && !st.nav.contains(e.target)) close(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && st && !st.list.hidden) close(st.nav.contains(document.activeElement));
  });

  function render() {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const cur = [...PERIOD_PAGES, ...DATA, ...EXTRA].find((d) => d.id === current);
    const item = (d) => `<li><a href="${esc(href(d.id))}"${d.id === current ? ' aria-current="page"' : ""}>${esc(d.label)}</a></li>`;
    nav.innerHTML = `
      <a href="${href("home")}"${current === "home" ? ' aria-current="page"' : ""}>${HOME.label}</a>
      <div class="dd">
        <button type="button" class="dd-btn${cur ? " active" : ""}" aria-expanded="false" aria-controls="dd-data">
          Données${cur ? `<span class="dd-cur"> · ${esc(cur.label)}</span>` : ""}${CHEVRON}
        </button>
        <ul class="dd-list" id="dd-data" hidden>
          <li class="dd-head" role="presentation">Tous les paramètres</li>
          ${PERIOD_PAGES.map(item).join("")}
          <li class="dd-sep" role="separator"></li>
          <li class="dd-head" role="presentation">Par paramètre</li>
          ${DATA.map(item).join("")}
          <li class="dd-sep" role="separator"></li>
          ${EXTRA.map(item).join("")}
        </ul>
      </div>`;
    document.querySelectorAll("a[data-detail]").forEach((a) => (a.href = href(a.dataset.detail)));

    const btn = nav.querySelector(".dd-btn"), list = nav.querySelector(".dd-list");
    st = { nav, btn, list, links: [...list.querySelectorAll("a")] };
    btn.addEventListener("click", () => (list.hidden ? open(false) : close(false)));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); open(true); }
      else if (e.key === "ArrowUp") { e.preventDefault(); open(true, true); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); list.hidden ? open(true) : close(false); }
    });
    list.addEventListener("keydown", (e) => {
      const links = st.links, i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); links[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); links[links.length - 1].focus(); }
      else if (e.key === "Tab") close(false);
    });
  }

  // Liste des paramètres configurés (skin.conf [[parameters]]) : on reconstruit le menu
  // (la direction du vent n'a pas de page de détail ; un groupe a une seule page)
  function setParams(list) {
    if (!list || !list.length) return;
    DATA = list.filter((p) => p.id !== "windDir").map((p) => ({ id: p.id, label: p.title || p.id }));
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
