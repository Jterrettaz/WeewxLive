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

/* weewx-live — unités d'affichage (WXU).
 * Toutes les données des pages restent en unités métriques (°C, km/h, mm, mm/h, hPa, m, cm) ;
 * la conversion se fait à l'affichage, selon une grandeur :
 *   temp, wind, rain, rainRate, press, alt, snow
 * Unité retenue : choix du visiteur (page « Réglages → Unités », localStorage), sinon unité
 * par défaut du site (skin.conf [LiveJSON] [[units]] -> window.WX_UNITS, wxtime.js), sinon
 * l'unité métrique.
 *   WXU.groupOf("°C")       grandeur d'une unité métrique (null : pas de conversion)
 *   WXU.get(g), WXU.label(g) unité retenue pour la grandeur g (même valeur : son libellé)
 *   WXU.conv(g, v)          valeur métrique -> unité retenue ; WXU.back(g, v) : l'inverse
 *   WXU.delta(g, v)         écart (sans décalage : °C -> °F = × 1,8)
 *   WXU.dec(g, d)           décimales à afficher (d : celles de l'unité métrique)
 *   WXU.fmt(g, v, d)        texte localisé de la valeur convertie (sans unité)
 *   WXU.applyLabels(root)   remplace le texte des éléments [data-ubase] (unité métrique) et
 *                           [data-uval] (valeur métrique « 30|km/h », décimales en option)
 *   WXU.GROUPS, WXU.set(g, u), WXU.reset(), WXU.siteDefault(g), WXU.userChoice(g) */
(function () {
  "use strict";
  // unités possibles par grandeur : [facteur, décalage, décimales en plus] (valeur = métrique × a + b)
  const GROUPS = {
    temp: { label: "Température", base: "°C", units: { "°C": [1, 0, 0], "°F": [1.8, 32, 0] } },
    wind: { label: "Vitesse du vent", base: "km/h", units: { "km/h": [1, 0, 0], "m/s": [1 / 3.6, 0, 1], "mph": [1 / 1.609344, 0, 0], "kn": [1 / 1.852, 0, 0] } },
    rain: { label: "Pluie", base: "mm", units: { "mm": [1, 0, 0], "in": [1 / 25.4, 0, 1] } },
    rainRate: { label: "Intensité de pluie", base: "mm/h", units: { "mm/h": [1, 0, 0], "in/h": [1 / 25.4, 0, 1] } },
    press: { label: "Pression", base: "hPa", units: { "hPa": [1, 0, 0], "inHg": [0.029529983071445, 0, 1], "mmHg": [0.750061682704, 0, 0], "kPa": [0.1, 0, 1] } },
    alt: { label: "Altitude", base: "m", units: { "m": [1, 0, 0], "ft": [3.280839895, 0, 0] } },
    snow: { label: "Neige", base: "cm", units: { "cm": [1, 0, 0], "in": [1 / 2.54, 0, 1] } },
  };
  const BY_BASE = {};
  // unité métrique sans espaces ni majuscules (« ° C », « HPA ») -> grandeur
  const norm = (u) => String(u).replace(/\s+/g, "").toLowerCase();
  for (const [g, d] of Object.entries(GROUPS)) BY_BASE[norm(d.base)] = g;
  const KEY = "weewx-live:units";
  let user = {};
  try { user = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { user = {}; }
  const site = () => window.WX_UNITS || (window.WEEWX_CONFIG && window.WEEWX_CONFIG.units) || {};
  const valid = (g, u) => !!(GROUPS[g] && u && GROUPS[g].units[u]);
  const siteDefault = (g) => (valid(g, site()[g]) ? site()[g] : GROUPS[g] ? GROUPS[g].base : "");
  const get = (g) => (valid(g, user[g]) ? user[g] : siteDefault(g));
  const coef = (g) => (GROUPS[g] ? GROUPS[g].units[get(g)] : [1, 0, 0]);
  const isNum = (v) => v !== null && v !== undefined && v !== "" && !isNaN(v);
  const conv = (g, v) => { if (!isNum(v) || !GROUPS[g]) return v; const [a, b] = coef(g); return a === 1 && b === 0 ? +v : v * a + b; };
  const back = (g, v) => { if (!isNum(v) || !GROUPS[g]) return v; const [a, b] = coef(g); return (v - b) / a; };
  const delta = (g, v) => (isNum(v) && GROUPS[g] ? v * coef(g)[0] : v);
  const dec = (g, d) => (GROUPS[g] ? Math.max(0, (d || 0) + coef(g)[2]) : d);
  const fmt = (g, v, d = 1) => (isNum(v)
    ? Number(conv(g, v)).toLocaleString("fr-FR", { minimumFractionDigits: dec(g, d), maximumFractionDigits: dec(g, d) }) : "--");
  const groupOf = (u) => (u && BY_BASE[norm(u)]) || null;
  // [data-ubase="km/h"] : texte = unité retenue ; [data-uval="30|km/h"] (ou "30|km/h|1") :
  // texte = valeur convertie (décimales de l'unité métrique, ici 0 ou 1)
  function applyLabels(root = document) {
    root.querySelectorAll("[data-ubase]").forEach((el) => {
      const g = groupOf(el.dataset.ubase);
      if (g) el.textContent = get(g);
    });
    root.querySelectorAll("[data-uval]").forEach((el) => {
      const [v, u, d] = el.dataset.uval.split("|"), g = groupOf(u);
      if (g) el.textContent = fmt(g, +v, +(d || 0));
    });
  }
  function set(g, u) {
    if (!GROUPS[g]) return;
    if (valid(g, u) && u !== siteDefault(g)) user[g] = u; else delete user[g];
    try { if (Object.keys(user).length) localStorage.setItem(KEY, JSON.stringify(user)); else localStorage.removeItem(KEY); }
    catch (e) { /* stockage indisponible */ }
  }
  function reset() { user = {}; try { localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ } }
  window.WXU = { GROUPS, groupOf, get, label: get, conv, back, delta, dec, fmt, applyLabels, set, reset, siteDefault,
    userChoice: (g) => (valid(g, user[g]) ? user[g] : null) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => applyLabels());
  else applyLabels();
})();

/* weewx-live — mode admin (WXA).
 * Les paramètres marqués « admin = true » dans skin.conf [[parameters]] ne sont affichés
 * (tableau de bord, pages « jour », pages de détail et par période, menu « Données ») qu'en
 * mode admin. Le mot de passe ([LiveJSON] [[admin]] password) n'est jamais publié : wxtime.js
 * contient son empreinte SHA-256 (window.WX_ADMIN). Le visiteur saisit le mot de passe sur la
 * page « Réglages → Admin » ; son empreinte est mémorisée par le navigateur (localStorage).
 * Le mode admin est actif tant qu'elle est égale à celle du site (un changement de mot de
 * passe fait donc sortir tout le monde du mode admin). Classe « wx-admin » sur <html> : la
 * feuille de style masque les éléments [data-admin] sans elle.
 * Simple masquage à l'affichage : les données restent dans les fichiers publiés.
 *   WXA.enabled           mot de passe configuré
 *   WXA.active()          mode admin actif
 *   WXA.login(mdp)        promesse : vrai si le mot de passe est bon (mode admin activé)
 *   WXA.logout()          sortie du mode admin
 *   WXA.visible(p)        paramètre de la configuration affichable (p.admin et mode admin) */
(function () {
  "use strict";
  const KEY = "weewx-live:admin";
  const SALT = "weewx-live:";                  // même préfixe que livejson.py (ADMIN_SALT)
  const SITE = typeof window.WX_ADMIN === "string" && /^[0-9a-f]{64}$/.test(window.WX_ADMIN) ? window.WX_ADMIN : null;
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { stored = null; }
  const active = () => !!SITE && stored === SITE;
  const mark = () => document.documentElement.classList.toggle("wx-admin", active());
  mark();

  // SHA-256 (hexadécimal) : crypto.subtle (https, localhost) ; sinon calcul en JavaScript
  // (page servie en http sur le réseau local, où crypto.subtle n'existe pas)
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256js(bytes) {
    const n = bytes.length, len = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(len);
    m.set(bytes); m[n] = 0x80;
    const bits = n * 8;
    for (let i = 0; i < 8; i++) m[len - 1 - i] = i < 4 ? (bits >>> (8 * i)) & 0xff : Math.floor(bits / 2 ** (8 * i)) & 0xff;
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const W = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < len; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
      } catch (e) { /* calcul en JavaScript */ }
    }
    return sha256js(bytes);
  }

  async function login(pw) {
    if (!SITE || !pw) return false;
    const h = await sha256(SALT + pw);
    if (h !== SITE) return false;
    stored = h;
    try { localStorage.setItem(KEY, h); } catch (e) { /* stockage indisponible : mode admin pour cette page seulement */ }
    mark();
    return true;
  }
  function logout() {
    stored = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ }
    mark();
  }
  // autre onglet : connexion / déconnexion appliquée au rechargement de la page
  window.addEventListener("storage", (e) => { if (e.key === KEY && (e.newValue === SITE) !== active()) location.reload(); });

  window.WXA = { enabled: !!SITE, active, login, logout, sha256, _sha256js: sha256js,
    visible: (p) => !(p && p.admin) || active() };
})();

/* weewx-live — menu commun aux pages : « Tableau de bord », puis menus déroulants
 * « Données » (pages par période, une page de détail par paramètre de skin.conf,
 * « Extrêmes », « Archives »), « Climatologie » (tableaux mensuel et annuel, si
 * [[archives]] climato), « Prévisions » (« Météogramme », « Ensembles », si activés) et
 * « Webcam » (images et vidéos de [[webcam]], webcam.html ; seulement si un élément est
 * visible par le visiteur, éléments admin compris), lien « Éclairs » (carte Blitzortung
 * centrée sur la station, nouvel onglet ; [[lightning]]),
 * « Réglages » (« Unités » : unités choisies par le visiteur, units.html ; « Admin » : mode
 * admin, admin.html). Paramètres réservés à l'admin (skin.conf admin = true) : seulement en
 * mode admin (WXA).
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
  // lien « Éclairs » (rempli d'après la configuration : [[lightning]], coordonnées)
  let LIGHTNING = null;
  // page « Webcam » (affichée dans le menu si [[webcam]] a un élément visible)
  const WEBCAM = { id: "webcam", label: "Webcam", page: "webcam.html" };
  const isWebcam = location.pathname.endsWith("/" + WEBCAM.page) || location.pathname === WEBCAM.page;
  let hasWebcam = isWebcam;
  // menu « Réglages » (toujours présent) : choix du visiteur, mémorisés par son navigateur
  const SETTINGS = [{ id: "set:units", label: "Unités", page: "units.html" },
                    { id: "set:admin", label: WXA.active() ? "Admin (actif)" : "Admin", page: "admin.html" }];
  const setPage = SETTINGS.find((e) => location.pathname.endsWith("/" + e.page) || location.pathname === e.page);

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
  let current = climatoId || (isWebcam ? WEBCAM.id : null) || (fcPage ? fcPage.id : null) || (setPage ? setPage.id : null) || (isArchive ? "archives" : extra ? extra.id
    : isDetail ? (q.get("period") ? "period:" + q.get("period") : q.get("p") || "outTemp") : "home");

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Lien vers une page, en conservant le mode démo
  function href(id) {
    if (id === "home") return BASE + "index.html" + (demo ? "?demo" : "");
    const e = EXTRA.find((x) => x.id === id) || CLIMATO.find((x) => x.id === id) || FC_PAGES.find((x) => x.id === id) ||
      SETTINGS.find((x) => x.id === id) || (id === WEBCAM.id ? WEBCAM : null);
    if (e) return BASE + e.page + (e.page.endsWith(".html") && demo ? "?demo" : "");
    const p = id.startsWith("period:") ? new URLSearchParams({ period: id.slice(7) }) : new URLSearchParams({ p: id });
    if (demo) p.set("demo", "");
    return BASE + "detail.html?" + p.toString().replace(/demo=(&|$)/, "demo$1");
  }

  // Archives (pages jour / mois / année, si générées) : page la plus fine disponible
  // pour la date du jour
  function setArchives(cfg) {
    if (cfg && !FORECAST.length) FC_PAGES.forEach((p) => { if (cfg[p.key] && cfg[p.key].enable) FORECAST.push(p); });
    // carte des éclairs : https://maps.blitzortung.org/fr/#zoom/latitude/longitude
    const lg = cfg && cfg.lightning, lat = cfg && cfg.latitude, lon = cfg && cfg.longitude;
    const wc = cfg && cfg.webcam;
    hasWebcam = isWebcam || !!(wc && wc.enable && (wc.items || []).some((w) => WXA.visible(w)));
    if (lg && lg.enable !== false && Number.isFinite(lat) && Number.isFinite(lon)) {
      LIGHTNING = `https://maps.blitzortung.org/fr/#${lg.zoom || 7}/${lat.toFixed(3)}/${lon.toFixed(3)}`;
    }
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
      (FORECAST.length ? dropdown("dd-fc", "Prévisions", FORECAST, FORECAST.map(item).join("")) : "") +
      (hasWebcam ? `<a href="${esc(href(WEBCAM.id))}"${current === WEBCAM.id ? ' aria-current="page"' : ""}>${WEBCAM.label}</a>` : "") +
      (LIGHTNING ? `<a class="ext-link" href="${esc(LIGHTNING)}" target="_blank" rel="noopener"
        title="Carte des éclairs en temps réel (Blitzortung), dans un nouvel onglet">Éclairs<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5"/></svg><span class="sr"> (nouvel onglet)</span></a>` : "") +
      dropdown("dd-set", "Réglages", SETTINGS, SETTINGS.map(item).join(""));
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
    if (list && list.length) DATA = list.filter((p) => p.id !== "windDir" && WXA.visible(p)).map((p) => ({ id: p.id, label: p.title || p.id }));
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

  // mode admin activé / quitté sur la page « Admin » : menu « Données » et libellé mis à jour
  function refreshAdmin() {
    SETTINGS[1].label = WXA.active() ? "Admin (actif)" : "Admin";
    window.weewxConfig.then((cfg) => { setArchives(cfg); setParams(cfg && cfg.parameters); });   // menu « Webcam » compris
  }

  window.WeewxNav = { render, href, setParams, setCurrent, refreshAdmin, get current() { return current; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
