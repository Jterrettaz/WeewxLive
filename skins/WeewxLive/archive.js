/* weewx-live — sélecteur de date des pages d'archives (archive/day-AAAA-MM-JJ.html,
 * month-AAAA-MM.html, year-AAAA.html) : ouvre la page du jour, du mois ou de l'année qui
 * contient la date choisie, après avoir vérifié qu'elle existe. */
(function () {
  "use strict";

  const bar = document.getElementById("arch-bar");
  if (!bar) return;
  const input = document.getElementById("arch-date");
  const msg = document.getElementById("arch-msg");
  const { first, today, dayFirst } = bar.dataset;

  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  function fileFor(kind, iso) {
    const [y, m, d] = iso.split("-").map(Number);
    if (kind === "day") return `day-${y}-${pad(m)}-${pad(d)}.html`;
    if (kind === "month") return `month-${y}-${pad(m)}.html`;
    return `year-${y}.html`;
  }

  function say(text) { msg.textContent = text; }

  async function go(kind) {
    const iso = input.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return say("Choisissez une date.");
    if (iso < first || iso > today) {
      return say(`Pas de données à cette date (archives du ${fmtDate(first)} au ${fmtDate(today)}).`);
    }
    if (kind === "day" && iso < dayFirst) {
      return say(`Pages « jour » disponibles à partir du ${fmtDate(dayFirst)} ; essayez « Mois » ou « Année ».`);
    }
    const url = fileFor(kind, iso);
    say("");
    try {
      // la page existe-t-elle sur le serveur ? (journée pas encore générée, etc.)
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!r.ok) return say(`Page non disponible (${url}).`);
    } catch (e) { /* hors ligne ou HEAD refusé : on tente l'ouverture */ }
    location.href = url;
  }

  bar.querySelectorAll("button[data-kind]").forEach((b) => b.addEventListener("click", () => go(b.dataset.kind)));
  // Entrée dans le champ : même type de page que la page affichée
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const cur = bar.querySelector('button[aria-current="page"]') || bar.querySelector("button[data-kind]");
    if (cur) go(cur.dataset.kind);
  });
  input.addEventListener("input", () => say(""));
})();
