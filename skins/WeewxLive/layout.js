/* weewx-live — ordre des cadres du tableau de bord (index.html).
 * L'ordre par défaut est celui de [LiveJSON] [[dashboard]] order (le gabarit émet les cadres
 * dans cet ordre). Chaque visiteur peut le changer : bouton « Réorganiser », puis flèches
 * ↑ / ↓ sur chaque cadre (repliés pendant la réorganisation) ; son ordre est mémorisé par le navigateur (localStorage) et
 * appliqué dès le chargement. « Ordre par défaut » revient à l'ordre de l'administrateur.
 * Ce script est chargé juste après les cadres, avant les autres scripts : les cartes et
 * graphiques sont créés une fois les cadres à leur place. */
(function () {
  "use strict";

  const dash = document.getElementById("dash");
  if (!dash) return;
  const KEY = "weewx-live:dash-order";
  const blocks = () => [...dash.querySelectorAll(":scope > .dash-block")];
  const ids = () => blocks().map((b) => b.dataset.block);
  const DEFAULT = ids();                 // ordre de l'administrateur (gabarit)

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ } },
  };

  // place les cadres dans l'ordre donné (identifiants inconnus ignorés, cadres oubliés à la fin
  // dans l'ordre par défaut)
  function apply(order) {
    const byId = new Map(blocks().map((b) => [b.dataset.block, b]));
    const seq = (order || []).filter((id) => byId.has(id));
    DEFAULT.forEach((id) => { if (!seq.includes(id)) seq.push(id); });
    seq.forEach((id) => dash.appendChild(byId.get(id)));
  }
  const saved = store.get();
  if (Array.isArray(saved)) apply(saved);

  // ------------------------------------------------------------------
  // Mode « Réorganiser »
  // ------------------------------------------------------------------
  const btn = document.getElementById("dash-edit");
  const tools = document.getElementById("grid-tools");
  if (!btn || !tools) return;
  const reset = document.createElement("button");
  reset.type = "button"; reset.hidden = true; reset.textContent = "Ordre par défaut";
  reset.title = "Revenir à l'ordre défini par la station";
  btn.after(reset);
  const live = document.createElement("span");
  live.className = "sr"; live.setAttribute("aria-live", "polite");
  tools.appendChild(live);

  function bars(on) {
    blocks().forEach((b) => {
      let bar = b.querySelector(":scope > .dash-bar");
      if (!on) { if (bar) bar.remove(); return; }
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "dash-bar";
        bar.innerHTML = `<span class="dash-name"></span>
          <button type="button" data-move="-1" aria-label="Monter">↑ Monter</button>
          <button type="button" data-move="1" aria-label="Descendre">↓ Descendre</button>`;
        bar.querySelector(".dash-name").textContent = b.dataset.label || b.dataset.block;
        bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-label", `${x.dataset.move < 0 ? "Monter" : "Descendre"} « ${b.dataset.label} »`));
        b.prepend(bar);
      }
    });
    refresh();
  }
  function refresh() {
    const list = blocks();
    list.forEach((b, i) => {
      const bar = b.querySelector(":scope > .dash-bar");
      if (!bar) return;
      bar.querySelector('[data-move="-1"]').disabled = i === 0;
      bar.querySelector('[data-move="1"]').disabled = i === list.length - 1;
    });
    const custom = ids().join() !== DEFAULT.join();
    reset.disabled = !custom;
  }
  function save() {
    const cur = ids();
    store.set(cur.join() === DEFAULT.join() ? null : cur);
  }

  dash.addEventListener("click", (e) => {
    const m = e.target.closest("[data-move]");
    if (!m) return;
    const b = m.closest(".dash-block"), dir = +m.dataset.move;
    const other = dir < 0 ? b.previousElementSibling : b.nextElementSibling;
    if (!other) return;
    if (dir < 0) dash.insertBefore(b, other); else dash.insertBefore(other, b);
    save(); refresh();
    live.textContent = `« ${b.dataset.label} » : position ${ids().indexOf(b.dataset.block) + 1} sur ${DEFAULT.length}`;
    // focus conservé sur le bouton utilisé (ou l'autre s'il est désactivé)
    (m.disabled ? b.querySelector(`[data-move="${-dir}"]`) : m).focus();
    b.scrollIntoView({ block: "nearest" });
  });
  reset.addEventListener("click", () => {
    apply(DEFAULT); store.set(null); refresh();
    live.textContent = "Ordre par défaut rétabli";
  });
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "Terminer" : "Réorganiser";
    reset.hidden = !on;
    document.body.classList.toggle("dash-editing", on);
    bars(on);
    // fin de la réorganisation : les cadres réapparaissent, graphiques et cartes recalculés
    if (!on) window.dispatchEvent(new Event("resize"));
  });
})();
