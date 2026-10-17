/* weewx-live — codes météo WMO (libellés français) et pictogrammes SVG (dessins originaux,
 * couleurs par variables CSS : classes .wx, .i-cloud, .i-sun…). Partagés par le tableau de
 * bord (extras.js, prévisions) et le météogramme (meteogram.js). */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // libellés du temps prévu : [Texts] [[WeatherCodes]] du fichier de langue (clé : code WMO)
  const w = (code) => WXL.t("WeatherCodes", String(code));
  const WMO = {
    0: [w(0), "sun"], 1: [w(1), "suncloud"], 2: [w(2), "suncloud"], 3: [w(3), "cloud"],
    45: [w(45), "fog"], 48: [w(48), "fog"],
    51: [w(51), "drizzle"], 53: [w(53), "drizzle"], 55: [w(55), "drizzle"],
    56: [w(56), "drizzle"], 57: [w(57), "drizzle"],
    61: [w(61), "rain"], 63: [w(63), "rain"], 65: [w(65), "rain"],
    66: [w(66), "rain"], 67: [w(67), "rain"],
    71: [w(71), "snow"], 73: [w(73), "snow"], 75: [w(75), "snow"], 77: [w(77), "snow"],
    80: [w(80), "showers"], 81: [w(81), "showers"], 82: [w(82), "showers"],
    85: [w(85), "snow"], 86: [w(86), "snow"],
    95: [w(95), "storm"], 96: [w(96), "storm"], 99: [w(99), "storm"],
  };

  // Pictogrammes 48 × 48
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
  // variante de nuit (is_day = 0) : lune au lieu du soleil ; averses -> pluie
  const nightIcon = (k, isDay) => (isDay === 0 ? ({ sun: "moon", suncloud: "mooncloud", showers: "rain" }[k] || k) : k);
  const icon = (k, label) => `<svg class="wx" viewBox="0 0 48 48" role="img" aria-label="${esc(label)}">${ICONS[k] || ICONS.cloud}</svg>`;

  window.WxIcons = { WMO, nightIcon, icon };
})();
