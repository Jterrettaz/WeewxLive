/* weewx-live — ordre des cadres et des panneaux de mesures du tableau de bord (index.html).
 * Ordres par défaut : cadres selon [LiveJSON] [[dashboard]] order, panneaux selon
 * [[parameters]] (le gabarit les émet dans cet ordre). Chaque visiteur peut les changer :
 * bouton « Réorganiser », puis ↑ / ↓ sur chaque cadre et, dans « Mesures de la station »,
 * sur chaque panneau (cadres repliés pendant la réorganisation). Les deux ordres sont
 * mémorisés par le navigateur (localStorage) et appliqués dès le chargement ;
 * « Ordre par défaut » revient aux ordres de l'administrateur.
 * Ce script est chargé juste après les cadres, avant les autres scripts : cartes et
 * graphiques sont créés une fois les cadres et panneaux à leur place. */
(function () {
  "use strict";

  const dash = document.getElementById("dash");
  if (!dash) return;
  const grid = dash.querySelector("main.grid");

  // Liste réordonnable : conteneur, éléments, identifiant, clé de stockage
  function orderable(box, sel, key, idOf) {
    const items = () => (box ? [...box.querySelectorAll(`:scope > ${sel}`)] : []);
    const ids = () => items().map(idOf);
    const o = { box, items, ids, key, idOf, DEFAULT: ids() };
    o.apply = (order) => {
      const byId = new Map(items().map((el) => [idOf(el), el]));
      const seq = (order || []).filter((id) => byId.has(id));
      o.DEFAULT.forEach((id) => { if (!seq.includes(id)) seq.push(id); });
      // éléments créés après coup (inconnus de l'ordre par défaut) : laissés à la fin
      byId.forEach((_el, id) => { if (!seq.includes(id)) seq.push(id); });
      seq.forEach((id) => box.appendChild(byId.get(id)));
    };
    o.custom = () => ids().join() !== o.DEFAULT.join();
    o.load = () => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
    o.save = () => {
      try { if (o.custom()) localStorage.setItem(key, JSON.stringify(ids())); else localStorage.removeItem(key); }
      catch (e) { /* stockage indisponible */ }
    };
    const saved = o.load();
    if (box && Array.isArray(saved)) o.apply(saved);
    return o;
  }
  const BLOCKS = orderable(dash, ".dash-block", "weewx-live:dash-order", (b) => b.dataset.block);
  const PANELS = orderable(grid, ".card[data-param]", "weewx-live:panel-order", (c) => c.dataset.param);

  // nom d'un panneau (titre, sans la flèche du lien de détail)
  const panelName = (c) => {
    const h = c.querySelector("h2");
    return (h ? h.textContent : c.dataset.param).replace(/[›>]\s*$/, "").replace(/\s+/g, " ").trim();
  };

  // ------------------------------------------------------------------
  // Mode « Réorganiser »
  // ------------------------------------------------------------------
  const btn = document.getElementById("dash-edit");
  const tools = document.getElementById("grid-tools");
  if (!btn || !tools) return;
  const reset = document.createElement("button");
  reset.type = "button"; reset.hidden = true; reset.textContent = "Ordre par défaut";
  reset.title = "Revenir aux ordres définis par la station";
  btn.after(reset);
  const live = document.createElement("span");
  live.className = "sr"; live.setAttribute("aria-live", "polite");
  tools.appendChild(live);

  const moveButtons = (name, kind) => `<button type="button" data-${kind}="-1" aria-label="Monter « ${esc(name)} »">↑<span class="w"> Monter</span></button>
    <button type="button" data-${kind}="1" aria-label="Descendre « ${esc(name)} »">↓<span class="w"> Descendre</span></button>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function build(on) {
    BLOCKS.items().forEach((b) => {
      b.querySelectorAll(":scope > .dash-bar, :scope > .dash-sub").forEach((x) => x.remove());
      if (!on) return;
      const name = b.dataset.label || b.dataset.block;
      const bar = document.createElement("div");
      bar.className = "dash-bar";
      bar.innerHTML = `<span class="dash-name">${esc(name)}</span>${moveButtons(name, "move")}`;
      b.prepend(bar);
      // panneaux de mesures : sous-liste réordonnable
      if (b.contains(grid) && PANELS.items().length > 1) {
        const sub = document.createElement("ol");
        sub.className = "dash-sub";
        sub.setAttribute("aria-label", "Ordre des panneaux de mesures");
        sub.innerHTML = PANELS.items().map((c) => `<li data-param="${esc(c.dataset.param)}">
          <span class="dash-pname">${esc(panelName(c))}</span>${moveButtons(panelName(c), "pmove")}</li>`).join("");
        bar.after(sub);
      }
    });
    refresh();
  }
  function refresh() {
    const set = (list, attr) => list.forEach((el, i) => {
      const up = el.querySelector(`:scope > [data-${attr}="-1"], :scope > .dash-bar [data-${attr}="-1"]`);
      const down = el.querySelector(`:scope > [data-${attr}="1"], :scope > .dash-bar [data-${attr}="1"]`);
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === list.length - 1;
    });
    set(BLOCKS.items(), "move");
    set([...dash.querySelectorAll(".dash-sub > li")], "pmove");
    reset.disabled = !BLOCKS.custom() && !PANELS.custom();
  }
  // échange un élément avec son voisin (dir -1 / +1) dans son conteneur
  function swap(el, dir) {
    const other = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!other || other.matches(".dash-bar, .dash-sub")) return false;
    if (dir < 0) el.parentNode.insertBefore(el, other); else el.parentNode.insertBefore(other, el);
    return true;
  }

  dash.addEventListener("click", (e) => {
    const m = e.target.closest("[data-move], [data-pmove]");
    if (!m) return;
    if (m.dataset.move) {                    // cadre
      const b = m.closest(".dash-block"), dir = +m.dataset.move;
      if (!swap(b, dir)) return;
      BLOCKS.save(); refresh();
      live.textContent = `« ${b.dataset.label} » : position ${BLOCKS.ids().indexOf(b.dataset.block) + 1} sur ${BLOCKS.ids().length}`;
      (m.disabled ? b.querySelector(`.dash-bar [data-move="${-dir}"]`) : m).focus();
      b.scrollIntoView({ block: "nearest" });
    } else {                                 // panneau de mesures
      const li = m.closest("li"), dir = +m.dataset.pmove;
      const card = grid.querySelector(`:scope > .card[data-param="${CSS.escape(li.dataset.param)}"]`);
      if (!card || !swap(li, dir)) return;
      swap(card, dir);
      PANELS.save(); refresh();
      live.textContent = `« ${panelName(card)} » : position ${PANELS.ids().indexOf(card.dataset.param) + 1} sur ${PANELS.ids().length}`;
      (m.disabled ? li.querySelector(`[data-pmove="${-dir}"]`) : m).focus();
    }
  });
  reset.addEventListener("click", () => {
    BLOCKS.apply(BLOCKS.DEFAULT); PANELS.apply(PANELS.DEFAULT);
    BLOCKS.save(); PANELS.save();
    build(true);
    live.textContent = "Ordre par défaut rétabli";
    reset.focus();
  });
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "Terminer" : "Réorganiser";
    reset.hidden = !on;
    document.body.classList.toggle("dash-editing", on);
    build(on);
    // fin de la réorganisation : cadres et panneaux réapparaissent, graphiques recalculés
    if (!on) window.dispatchEvent(new Event("resize"));
  });
})();
