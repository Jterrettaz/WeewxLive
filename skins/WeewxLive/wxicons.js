/* weewx-live — codes météo WMO (libellés français) et pictogrammes SVG (dessins originaux,
 * couleurs par variables CSS : classes .wx, .i-cloud, .i-sun…). Partagés par le tableau de
 * bord (extras.js, prévisions) et le météogramme (meteogram.js). */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WMO = {
    0: ["Ensoleillé", "sun"], 1: ["Plutôt ensoleillé", "suncloud"], 2: ["Éclaircies", "suncloud"], 3: ["Couvert", "cloud"],
    45: ["Brouillard", "fog"], 48: ["Brouillard givrant", "fog"],
    51: ["Bruine légère", "drizzle"], 53: ["Bruine", "drizzle"], 55: ["Bruine dense", "drizzle"],
    56: ["Bruine verglaçante", "drizzle"], 57: ["Bruine verglaçante", "drizzle"],
    61: ["Pluie faible", "rain"], 63: ["Pluie", "rain"], 65: ["Pluie forte", "rain"],
    66: ["Pluie verglaçante", "rain"], 67: ["Pluie verglaçante", "rain"],
    71: ["Neige faible", "snow"], 73: ["Neige", "snow"], 75: ["Neige forte", "snow"], 77: ["Grains de neige", "snow"],
    80: ["Averses", "showers"], 81: ["Averses", "showers"], 82: ["Fortes averses", "showers"],
    85: ["Averses de neige", "snow"], 86: ["Fortes averses de neige", "snow"],
    95: ["Orage", "storm"], 96: ["Orage et grêle", "storm"], 99: ["Orage et grêle", "storm"],
  };

  // Pictogrammes (dessins originaux, couleurs par jetons CSS)
  const CLOUD = (dx = 0, dy = 0) => `<path class="i-cloud" transform="translate(${dx} ${dy})" d="M14 36h20a7.5 7.5 0 0 0 .6-15A10.5 10.5 0 0 0 14.4 19 8.5 8.5 0 0 0 14 36z"/>`;
  const SUN = (cx, cy, r) => {
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, r1 = r + 3, r2 = r + 6.5;
      rays += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}"/>`;
    }
    return `<g class="i-sun"><circle cx="${cx}" cy="${cy}" r="${r}"/>${rays}</g>`;
  };
  const DROPS = (n, long) => {
    let s = "";
    for (let i = 0; i < n; i++) { const x = 17 + i * 7; s += long ? `<line x1="${x}" y1="39" x2="${x - 3}" y2="45"/>` : `<circle cx="${x}" cy="${41 + (i % 2) * 3}" r="1.6"/>`; }
    return `<g class="i-rain">${s}</g>`;
  };
  const ICONS = {
    sun: SUN(24, 24, 8),
    suncloud: SUN(17, 16, 6) + CLOUD(3, 2),
    cloud: CLOUD(0, -2),
    fog: CLOUD(0, -6) + `<g class="i-fog"><line x1="10" y1="37" x2="38" y2="37"/><line x1="14" y1="42" x2="34" y2="42"/></g>`,
    drizzle: CLOUD(0, -6) + DROPS(3, false),
    rain: CLOUD(0, -6) + DROPS(3, true),
    showers: SUN(17, 14, 5) + CLOUD(3, -4) + DROPS(3, true),
    snow: CLOUD(0, -6) + `<g class="i-snow"><circle cx="17" cy="40" r="2"/><circle cx="24" cy="44" r="2"/><circle cx="31" cy="40" r="2"/></g>`,
    storm: CLOUD(0, -6) + `<path class="i-bolt" d="M25 30l-6 9h5l-3 8 8-11h-5l3-6z"/>`,
  };
  // croissant de lune centré en (24, 24), redimensionné en (cx, cy) avec le facteur k
  const MOON = (cx, cy, k) => `<path class="i-moon" transform="translate(${cx - 24 * k} ${cy - 24 * k}) scale(${k})" d="M27 12a12 12 0 1 0 9 19A10 10 0 0 1 27 12z"/>`;
  ICONS.moon = MOON(24, 24, 0.9);
  ICONS.mooncloud = MOON(17, 16, 0.6) + CLOUD(3, 2);
  // variante de nuit des pictogrammes « dégagé » / « éclaircies »
  const nightIcon = (k, isDay) => (isDay === 0 ? ({ sun: "moon", suncloud: "mooncloud", showers: "rain" }[k] || k) : k);
  const icon = (k, label) => `<svg class="wx" viewBox="0 0 48 48" role="img" aria-label="${esc(label)}">${ICONS[k] || ICONS.cloud}</svg>`;

  window.WxIcons = { WMO, ICONS, nightIcon, icon };
})();
