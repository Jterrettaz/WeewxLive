/* weewx-live — sélecteur de date des pages d'archives (archive/day-AAAA-MM-JJ.html,
 * month-AAAA-MM.html, year-AAAA.html) : ouvre la page du jour, du mois ou de l'année qui
 * contient la date choisie, après avoir vérifié qu'elle existe. Calendrier dans la langue
 * du site (WXL.locale) à la place du sélecteur natif du navigateur. */
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
    return new Date(y, m - 1, d).toLocaleDateString(WXL.locale, { day: "numeric", month: "long", year: "numeric" });
  };

  function fileFor(kind, iso) {
    const [y, m, d] = iso.split("-").map(Number);
    if (kind === "day") return `day-${y}-${pad(m)}-${pad(d)}.html`;
    if (kind === "month") return `month-${y}-${pad(m)}.html`;
    return `year-${y}.html`;
  }

  function say(text) { msg.textContent = text; }
  // textes de la langue choisie (i18n.js)
  const ta = WXL.ctx("Archives");

  async function go(kind) {
    const iso = input.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return say(ta("Pick a date."));
    if (iso < first || iso > today) {
      return say(ta("No data on that date (archives from {first} to {last}).", { first: fmtDate(first), last: fmtDate(today) }));
    }
    if (kind === "day" && iso < dayFirst) {
      return say(ta("Day pages available from {date}; try “Month” or “Year”.", { date: fmtDate(dayFirst) }));
    }
    const url = fileFor(kind, iso);
    say("");
    try {
      // la page existe-t-elle sur le serveur ? (journée pas encore générée, etc.)
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!r.ok) return say(WXL.t("Common", "Page not available ({url}).", { url }));
    } catch (e) { /* hors ligne ou HEAD refusé : on tente l'ouverture */ }
    location.href = url;
  }

  // ------------------------------------------------------------------
  // Calendrier dans la langue du site : le sélecteur natif (<input type="date">) suit la
  // langue du navigateur, pas celle des pages ; il est remplacé par un bouton (date en toutes
  // lettres) et un calendrier (noms des mois et des jours selon WXL.locale). Le champ reste
  // dans la page (masqué) et garde la date choisie (AAAA-MM-JJ). Les pages d'archives déjà
  // générées en profitent aussi (archive.js est recopié à chaque archive).
  // ------------------------------------------------------------------
  const L = WXL.locale;
  const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const isoOf = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  const parse = (iso) => iso.split("-").map(Number);
  const fmt = (o) => new Intl.DateTimeFormat(L, Object.assign({ timeZone: "UTC" }, o));
  const monthName = (m) => fmt({ month: "long" }).format(utc(2024, m, 1));
  // premier jour de la semaine : dimanche pour l'anglais des États-Unis, lundi sinon
  const weekStart = /^en-US$|^en$/i.test(L) ? 0 : 1;
  const wd = [...Array(7)].map((_, i) => fmt({ weekday: "short" }).format(utc(2024, 1, 7 + ((weekStart + i) % 7))));   // 7 janv. 2024 : dimanche
  const wdLong = [...Array(7)].map((_, i) => fmt({ weekday: "long" }).format(utc(2024, 1, 7 + ((weekStart + i) % 7))));
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const tx = (k) => ta(k);

  input.type = "hidden";
  const wrap = document.createElement("span");
  wrap.className = "ap";
  wrap.innerHTML = `<button type="button" class="ap-btn" aria-haspopup="dialog" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
      <span class="ap-val"></span></button>
    <div class="ap-pop" role="dialog" aria-modal="false" hidden>
      <div class="ap-head">
        <button type="button" class="ap-nav" data-step="-1"></button>
        <select class="ap-month"></select><select class="ap-year"></select>
        <button type="button" class="ap-nav" data-step="1"></button>
      </div>
      <table class="ap-grid" role="grid"><thead><tr></tr></thead><tbody></tbody></table>
    </div>`;
  input.after(wrap);
  const btn = wrap.querySelector(".ap-btn"), val = wrap.querySelector(".ap-val"), pop = wrap.querySelector(".ap-pop");
  const selM = wrap.querySelector(".ap-month"), selY = wrap.querySelector(".ap-year");
  const [prevB, nextB] = wrap.querySelectorAll(".ap-nav");
  const lab = bar.querySelector('label[for="arch-date"]');
  if (lab) { lab.removeAttribute("for"); lab.id = "arch-date-label"; btn.setAttribute("aria-labelledby", "arch-date-label"); }
  btn.title = tx("Open the calendar");
  pop.setAttribute("aria-label", tx("Open the calendar"));
  prevB.textContent = "‹"; prevB.setAttribute("aria-label", tx("Previous month"));
  nextB.textContent = "›"; nextB.setAttribute("aria-label", tx("Next month"));
  selM.setAttribute("aria-label", WXL.t("Common", "Month")); selY.setAttribute("aria-label", WXL.t("Common", "Year"));
  selM.innerHTML = [...Array(12)].map((_, i) => `<option value="${i + 1}">${cap(monthName(i + 1))}</option>`).join("");
  const [y0] = parse(first), [y1] = parse(today);
  selY.innerHTML = [...Array(y1 - y0 + 1)].map((_, i) => `<option>${y1 - i}</option>`).join("");
  wrap.querySelector("thead tr").innerHTML = wd.map((w, i) => `<th scope="col" abbr="${wdLong[i]}">${w}</th>`).join("");

  let view = parse(input.value || today);     // [année, mois] affichés
  let focusIso = input.value || today;
  const showValue = () => { val.textContent = input.value ? fmtDate(input.value) : tx("Pick a date."); };

  function draw(focus) {
    const [y, m] = view;
    selM.value = String(m); selY.value = String(y);
    prevB.disabled = `${y}-${pad(m)}` <= first.slice(0, 7);
    nextB.disabled = `${y}-${pad(m)}` >= today.slice(0, 7);
    const start = utc(y, m, 1), shift = (start.getUTCDay() - weekStart + 7) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let html = "<tr>" + "<td></td>".repeat(shift);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`, off = iso < first || iso > today;
      if ((shift + d - 1) % 7 === 0 && d > 1) html += "</tr><tr>";
      html += `<td><button type="button" data-iso="${iso}" tabindex="${iso === focusIso ? 0 : -1}"` +
        `${iso === input.value ? ' aria-pressed="true"' : ""}${iso === today ? ' class="ap-today"' : ""}${off ? " disabled" : ""}` +
        ` aria-label="${fmtDate(iso)}">${d}</button></td>`;
    }
    html += "</tr>";
    wrap.querySelector("tbody").innerHTML = html;
    if (focus) {
      const b = wrap.querySelector(`[data-iso="${focusIso}"]`) || wrap.querySelector("tbody button:not([disabled])");
      if (b) b.focus();
    }
  }
  function open() {
    // date du champ, ramenée dans la période des archives (page « année » : 1er janvier)
    focusIso = input.value || today;
    if (focusIso < first) focusIso = first; if (focusIso > today) focusIso = today;
    view = parse(focusIso);
    pop.hidden = false; btn.setAttribute("aria-expanded", "true");
    draw(true);
  }
  function close(refocus) {
    if (pop.hidden) return;
    pop.hidden = true; btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  }
  function pick(iso) {
    input.value = iso; showValue(); say(""); close(true);
  }
  function moveTo(iso) {
    if (iso < first) iso = first; if (iso > today) iso = today;
    focusIso = iso; view = parse(iso); draw(true);
  }
  btn.addEventListener("click", () => (pop.hidden ? open() : close(false)));
  prevB.addEventListener("click", () => { view = view[1] === 1 ? [view[0] - 1, 12] : [view[0], view[1] - 1]; draw(false); });
  nextB.addEventListener("click", () => { view = view[1] === 12 ? [view[0] + 1, 1] : [view[0], view[1] + 1]; draw(false); });
  selM.addEventListener("change", () => { view = [view[0], +selM.value]; draw(false); });
  selY.addEventListener("change", () => { view = [+selY.value, view[1]]; draw(false); });
  wrap.querySelector("tbody").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-iso]");
    if (b && !b.disabled) pick(b.dataset.iso);
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); return close(true); }
    const b = e.target.closest("button[data-iso]");
    if (!b) return;
    const [y, m, d] = parse(b.dataset.iso);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) { e.preventDefault(); return moveTo(isoOf(utc(y, m, d + step))); }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const dm = e.key === "PageUp" ? -1 : 1, last = new Date(Date.UTC(y, m - 1 + dm + 1, 0)).getUTCDate();
      return moveTo(isoOf(utc(y, m + dm, Math.min(d, last))));
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      return moveTo(e.key === "Home" ? `${y}-${pad(m)}-01` : isoOf(utc(y, m + 1, 0)));
    }
  });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(false); });
  showValue();

  bar.querySelectorAll("button[data-kind]").forEach((b) => b.addEventListener("click", () => go(b.dataset.kind)));
  // double-clic sur un jour du calendrier : même type de page que la page affichée
  wrap.querySelector("tbody").addEventListener("dblclick", (e) => {
    const b = e.target.closest("button[data-iso]");
    if (!b || b.disabled) return;
    const cur = bar.querySelector('button[aria-current="page"]') || bar.querySelector("button[data-kind]");
    if (cur) go(cur.dataset.kind);
  });
})();
