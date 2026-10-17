/* weewx-live — page « Réglages → Unités » : choix des unités d'affichage par le visiteur,
 * une unité par grandeur, valable pour toutes les pages (WXU, nav.js ; localStorage). Unité
 * par défaut : celle du site (skin.conf [LiveJSON] [[units]]). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // valeur d'exemple de chaque grandeur (unité métrique) et ses décimales
  const SAMPLE = { temp: [20, 1], wind: [25, 0], rain: [12.4, 1], rainRate: [8.2, 1], press: [1013.2, 1], alt: [1500, 0], snow: [15, 0] };
  // textes de la langue choisie (i18n.js) : noms des unités ([[Units]], clés anglaises)
  const tu = WXL.ctx("Units");
  const NAMES = { "°C": "degrees Celsius", "°F": "degrees Fahrenheit", "km/h": "kilometres per hour",
    "m/s": "metres per second", "mph": "miles per hour", "kn": "knots", "mm": "millimetres",
    "in": "inches", "mm/h": "millimetres per hour", "in/h": "inches per hour", "hPa": "hectopascals",
    "inHg": "inches of mercury", "mmHg": "millimetres of mercury", "kPa": "kilopascals", "m": "metres",
    "ft": "feet", "cm": "centimetres" };
  Object.keys(NAMES).forEach((u) => (NAMES[u] = tu(NAMES[u])));

  const example = (g) => {
    const [v, d] = SAMPLE[g] || [0, 0], base = WXU.GROUPS[g].base, u = WXU.get(g);
    const loc = (x, n) => x.toLocaleString(WXL.locale, { minimumFractionDigits: n, maximumFractionDigits: n });
    return tu("e.g. {value}", { value: u === base ? `${loc(v, d)} ${base}` : `${loc(v, d)} ${base} = ${WXU.fmt(g, v, d)} ${u}` });
  };

  function render() {
    $("u-root").innerHTML = `<div class="u-list">${Object.entries(WXU.GROUPS).map(([g, d]) => {
      const site = WXU.siteDefault(g), cur = WXU.get(g);
      const opts = Object.keys(d.units).map((u) => `<option value="${esc(u)}"${u === cur ? " selected" : ""}>${esc(u)} — ${esc(NAMES[u] || u)}${u === site ? " " + esc(tu("(site)")) : ""}</option>`).join("");
      return `<div class="u-row">
        <label for="u-${g}">${esc(d.label)}</label>
        <select id="u-${g}" data-g="${g}">${opts}</select>
        <span class="u-ex" id="u-ex-${g}">${esc(example(g))}</span></div>`;
    }).join("")}</div>`;
    $("u-reset").disabled = !Object.keys(WXU.GROUPS).some((g) => WXU.userChoice(g));
  }

  $("u-root").addEventListener("change", (e) => {
    const g = e.target.dataset && e.target.dataset.g;
    if (!g) return;
    WXU.set(g, e.target.value);
    $("u-ex-" + g).textContent = example(g);
    $("u-reset").disabled = !Object.keys(WXU.GROUPS).some((x) => WXU.userChoice(x));
    $("u-live").textContent = tu("{quantity}: {unit} (saved)", { quantity: WXU.GROUPS[g].label, unit: WXU.get(g) });
  });
  $("u-reset").addEventListener("click", () => {
    WXU.reset();
    render();
    $("u-live").textContent = tu("Site units restored");
    $("u-root").querySelector("select").focus();
  });

  render();
})();
