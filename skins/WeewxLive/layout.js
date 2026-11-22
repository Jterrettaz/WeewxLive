/* weewx-live — ordre et affichage des cadres et des panneaux de mesures du tableau de bord
 * (index.html).
 * Ordres par défaut : cadres selon [LiveJSON] [[dashboard]] order, panneaux selon
 * [[parameters]] (le gabarit les émet dans cet ordre). Chaque visiteur peut les changer :
 * bouton « Réorganiser », puis ↑ / ↓ sur chaque cadre et, dans « Mesures de la station »,
 * sur chaque panneau (cadres repliés pendant la réorganisation), ainsi que « Développer » /
 * « Réduire » sur chaque panneau (mémoire weewx-live:compact d'app.js). Les deux ordres sont
 * mémorisés par le navigateur (localStorage) et appliqués dès le chargement. Chaque cadre et
 * chaque panneau peut aussi être masqué (« Masquer » / « Afficher », mémorisé de même).
 * « Par défaut » revient aux ordres de l'administrateur et réaffiche tout.
 * Profils : en réorganisation, la disposition (ordres et éléments masqués) peut être
 * enregistrée sous un nom ; la liste « Profil » en haut du tableau de bord applique un profil
 * du visiteur, un profil de la station ([LiveJSON] [[dashboard]] [[[profiles]]], attribut
 * data-profiles du tableau de bord) ou la disposition de la station (localStorage :
 * weewx-live:dash-profiles, profil en cours : weewx-live:dash-profile, « u:<nom> » ou
 * « s:<nom> » ; toute modification ensuite le désélectionne). Profils d'exemple de la station
 * (option editable) : copiés une seule fois dans les profils du visiteur (identifiants déjà
 * copiés : weewx-live:dash-seeded), qui peut ensuite les modifier ou les supprimer. Un profil retient aussi les
 * panneaux développés (les autres réduits ; mémoire weewx-live:compact d'app.js, prévenu par
 * l'évènement « wx-compact », et qui signale les changements par « wx-compact-changed »).
 * Ce script est chargé juste après les cadres, avant les autres scripts : cartes et
 * graphiques sont créés une fois les cadres et panneaux à leur place. */
(function () {
  "use strict";

  const dash = document.getElementById("dash");
  if (!dash) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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

  // Éléments masqués par le visiteur : { b: [cadres], p: [panneaux] } (classe user-hidden)
  const HKEY = "weewx-live:hidden";
  const hidden = (() => {
    let h = null;
    try { h = JSON.parse(localStorage.getItem(HKEY)); } catch (e) { /* stockage indisponible */ }
    return { b: new Set(h && Array.isArray(h.b) ? h.b : []), p: new Set(h && Array.isArray(h.p) ? h.p : []) };
  })();
  const saveHidden = () => {
    try {
      if (hidden.b.size || hidden.p.size) localStorage.setItem(HKEY, JSON.stringify({ b: [...hidden.b], p: [...hidden.p] }));
      else localStorage.removeItem(HKEY);
    } catch (e) { /* stockage indisponible */ }
  };
  const applyHidden = () => {
    BLOCKS.items().forEach((b) => b.classList.toggle("user-hidden", hidden.b.has(b.dataset.block)));
    PANELS.items().forEach((c) => c.classList.toggle("user-hidden", hidden.p.has(c.dataset.param)));
  };
  applyHidden();

  // panneau réservé à l'admin hors mode admin (masqué par la feuille de style) : absent de
  // la liste « Réorganiser » et sauté par ↑ / ↓
  const adminHidden = (c) => !!c && c.matches && c.matches("[data-admin]") &&
    !document.documentElement.classList.contains("wx-admin");
  const shownPanels = () => PANELS.items().filter((c) => !adminHidden(c));

  // nom d'un panneau (titre, sans la flèche du lien de détail)
  const panelName = (c) => {
    const h = c.querySelector("h2");
    return (h ? h.textContent : c.dataset.param).replace(/[›>]\s*$/, "").replace(/\s+/g, " ").trim();
  };

  // ------------------------------------------------------------------
  // Profils : dispositions { n: nom, b, p : ordres, hb, hp : masqués, x : panneaux développés
  // (absent : état réduit / développé inchangé) }, du visiteur (u:) ou
  // de la station (s:, lecture seule)
  // ------------------------------------------------------------------
  const PKEY = "weewx-live:dash-profiles", AKEY = "weewx-live:dash-profile";
  const store = {
    get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };
  const arr = (a) => (Array.isArray(a) ? a.map(String) : []);
  const saved = store.get(PKEY, []);
  let profiles = (Array.isArray(saved) ? saved : []).filter((x) => x && typeof x.n === "string" && x.n.trim())
    .map((x) => ({ n: x.n.trim(), b: arr(x.b), p: arr(x.p), hb: arr(x.hb), hp: arr(x.hp), x: Array.isArray(x.x) ? arr(x.x) : null }));
  // panneaux développés (mémoire d'app.js ; sans choix mémorisé : réduit)
  const CKEY = "weewx-live:compact";
  const expanded = () => {
    const l = store.get(CKEY, {}) || {};
    return PANELS.ids().filter((id) => l[id] === false);
  };
  function applyExpanded(list) {
    if (list && list.length) store.set(CKEY, Object.fromEntries(PANELS.ids().map((id) => [id, !list.includes(id)])));
    else store.set(CKEY, null);
    window.dispatchEvent(new Event("wx-compact"));
  }
  // profils de la station : cadres / panneaux listés affichés dans cet ordre, les autres
  // masqués ; liste absente (null) : ordre par défaut, tout affiché
  // (id : sous-section de skin.conf ; e : profil d'exemple, copié chez le visiteur)
  const allSite = (() => {
    let d = [];
    try { d = JSON.parse(dash.dataset.profiles || "[]"); } catch (e) { d = []; }
    const conv = (list, all) => (Array.isArray(list) ? { o: arr(list), h: all.filter((id) => !list.includes(id)) } : { o: all, h: [] });
    return (Array.isArray(d) ? d : []).filter((x) => x && typeof x.n === "string" && x.n.trim()).map((x) => {
      const b = conv(x.b, BLOCKS.DEFAULT), q = conv(x.p, PANELS.DEFAULT);
      return { id: String(x.id || x.n), e: !!x.e, n: x.n.trim(), b: b.o, p: q.o, hb: b.h, hp: q.h, x: arr(x.x) };
    });
  })();
  const siteProfiles = allSite.filter((x) => !x.e);
  const findProfile = (n) => profiles.find((x) => x.n === n);
  // profils d'exemple : copiés une fois (même supprimés ensuite, ils ne reviennent pas) ; nom
  // déjà pris par un profil du visiteur : pas de copie
  (() => {
    const SKEY = "weewx-live:dash-seeded";
    const seeded = arr(store.get(SKEY, []));
    let changed = false;
    allSite.filter((x) => x.e && !seeded.includes(x.id)).forEach((x) => {
      if (!findProfile(x.n)) { profiles.push({ n: x.n, b: x.b, p: x.p, hb: x.hb, hp: x.hp, x: x.x }); changed = true; }
      seeded.push(x.id);
    });
    if (seeded.length) store.set(SKEY, seeded);
    if (changed) store.set(PKEY, profiles);
  })();
  // profil d'une clé « u:<nom> » (visiteur) ou « s:<nom> » (station)
  const byKey = (k) => (typeof k !== "string" ? null : k.startsWith("u:") ? findProfile(k.slice(2)) || null
    : k.startsWith("s:") ? siteProfiles.find((x) => x.n === k.slice(2)) || null : null);
  let active = store.get(AKEY, null);
  if (typeof active === "string" && !/^[us]:/.test(active)) active = "u:" + active;
  if (!byKey(active)) active = null;
  const snapshot = (n) => ({ n, b: BLOCKS.ids(), p: PANELS.ids(), hb: [...hidden.b], hp: [...hidden.p], x: expanded() });
  const isDefault = () => !BLOCKS.custom() && !PANELS.custom() && !hidden.b.size && !hidden.p.size && !expanded().length;
  const setActive = (n) => { active = n; store.set(AKEY, n); };
  // disposition d'un profil (null : celle de la station) appliquée et mémorisée
  function applyLayout(pr) {
    BLOCKS.apply(pr ? pr.b : BLOCKS.DEFAULT); PANELS.apply(pr ? pr.p : PANELS.DEFAULT);
    BLOCKS.save(); PANELS.save();
    hidden.b.clear(); hidden.p.clear();
    if (pr) { pr.hb.forEach((id) => hidden.b.add(id)); pr.hp.forEach((id) => hidden.p.add(id)); }
    saveHidden(); applyHidden();
    // panneaux réduits / développés (station : tous réduits ; ancien profil sans x : inchangé)
    if (!pr || pr.x) applyExpanded(pr ? pr.x : null);
  }

  // ------------------------------------------------------------------
  // Mode « Réorganiser »
  // ------------------------------------------------------------------
  const btn = document.getElementById("dash-edit");
  const tools = document.getElementById("grid-tools");
  if (!btn || !tools) return;
  // textes de la langue choisie (i18n.js) ; « (masqué) » des éléments masqués : style.css
  const tl = WXL.ctx("Layout"), tc = WXL.ctx("Common");
  document.documentElement.style.setProperty("--wx-hidden-label", JSON.stringify(" " + tl("(hidden)")));
  const reset = document.createElement("button");
  reset.type = "button"; reset.hidden = true; reset.textContent = tl("Default");
  reset.title = tl("Restore the station's default order and show all items");
  btn.after(reset);
  const live = document.createElement("span");
  live.className = "sr"; live.setAttribute("aria-live", "polite");
  tools.appendChild(live);

  // liste « Profil » (en haut du tableau de bord, s'il existe au moins un profil)
  const pick = document.createElement("label");
  pick.className = "prof-pick";
  pick.innerHTML = `<span>${esc(tl("Profile"))}</span><select id="dash-profile"></select>`;
  tools.prepend(pick);
  const sel = pick.querySelector("select");
  // édition des profils (visible en réorganisation) : nom, enregistrer, supprimer
  const pedit = document.createElement("div");
  pedit.className = "prof-edit"; pedit.hidden = true;
  pedit.setAttribute("role", "group"); pedit.setAttribute("aria-label", tl("Profiles"));
  pedit.innerHTML = `<label for="prof-name">${esc(tl("Profile name"))}</label>
    <input id="prof-name" type="text" maxlength="40" autocomplete="off" list="prof-names">
    <datalist id="prof-names"></datalist>
    <button type="button" id="prof-save" title="${esc(tl("Save the current order and visibility of the frames and panels under this name"))}">${esc(tl("Save as profile"))}</button>
    <button type="button" id="prof-del" hidden></button>`;
  tools.after(pedit);
  const pname = pedit.querySelector("#prof-name"), psave = pedit.querySelector("#prof-save"), pdel = pedit.querySelector("#prof-del");

  function renderProfiles() {
    const cur = byKey(active) ? active : isDefault() ? "" : "*";
    const opts = (list, pre) => list.map((x) => `<option value="${esc(pre + x.n)}">${esc(x.n)}</option>`).join("");
    // les deux sortes de profils : groupes « Profils de la station » / « Mes profils »
    const both = siteProfiles.length && profiles.length;
    const group = (label, html) => (both ? `<optgroup label="${esc(label)}">${html}</optgroup>` : html);
    sel.innerHTML = (cur === "*" ? `<option value="*" disabled>${esc(tl("Custom layout"))}</option>` : "") +
      `<option value="">${esc(tl("Station layout"))}</option>` +
      (siteProfiles.length ? group(tl("Station profiles"), opts(siteProfiles, "s:")) : "") +
      (profiles.length ? group(tl("My profiles"), opts(profiles, "u:")) : "");
    sel.value = cur;
    pick.hidden = !profiles.length && !siteProfiles.length;
    pedit.querySelector("datalist").innerHTML = profiles.map((x) => `<option value="${esc(x.n)}"></option>`).join("");
    renderEditor();
  }
  function renderEditor() {
    const n = pname.value.trim(), ex = findProfile(n);
    psave.disabled = !n;
    psave.textContent = tl(ex ? "Update profile" : "Save as profile");
    pdel.hidden = !ex;
    if (ex) pdel.textContent = tl("Delete profile “{name}”", { name: n });
  }
  // modification de la disposition : plus de profil en cours
  const modified = () => { if (active) setActive(null); renderProfiles(); };
  // panneau réduit ou développé par le visiteur (app.js) : boutons de la réorganisation à jour
  window.addEventListener("wx-compact-changed", () => { syncExpand(); refresh(); modified(); });

  sel.addEventListener("change", () => {
    const pr = sel.value ? byKey(sel.value) : null;
    if (sel.value && !pr) return;
    applyLayout(pr);
    setActive(pr ? sel.value : null);
    if (pr && sel.value.startsWith("u:")) pname.value = pr.n;
    renderProfiles();
    if (document.body.classList.contains("dash-editing")) build(true);
    else window.dispatchEvent(new Event("resize"));     // graphiques des panneaux réaffichés
    live.textContent = pr ? tl("Profile “{name}” applied", { name: pr.n }) : tl("Default order restored, all items shown");
  });
  pname.addEventListener("input", renderEditor);
  pname.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); psave.click(); } });
  psave.addEventListener("click", () => {
    const n = pname.value.trim().slice(0, 40);
    if (!n) { pname.focus(); return; }
    const i = profiles.findIndex((x) => x.n === n);
    if (i >= 0) profiles[i] = snapshot(n); else profiles.push(snapshot(n));
    store.set(PKEY, profiles);
    setActive("u:" + n);
    renderProfiles();
    live.textContent = tl(i >= 0 ? "Profile “{name}” updated" : "Profile “{name}” saved", { name: n });
  });
  pdel.addEventListener("click", () => {
    const n = pname.value.trim();
    if (!findProfile(n) || !confirm(tl("Delete profile “{name}”?", { name: n }))) return;
    profiles = profiles.filter((x) => x.n !== n);
    store.set(PKEY, profiles.length ? profiles : null);
    if (active === "u:" + n) setActive(null);
    pname.value = "";
    renderProfiles();
    live.textContent = tl("Profile “{name}” deleted", { name: n });
    pname.focus();
  });

  const moveButtons = (name, kind) => `<button type="button" data-${kind}="-1" aria-label="${esc(tl("Move up “{name}”", { name }))}">↑<span class="w"> ${esc(tl("Move up"))}</span></button>
    <button type="button" data-${kind}="1" aria-label="${esc(tl("Move down “{name}”", { name }))}">↓<span class="w"> ${esc(tl("Move down"))}</span></button>`;
  // bouton Masquer / Afficher (kind : hb = cadre, hp = panneau)
  const hideButton = (name, kind, id, isHidden) => `<button type="button" class="dash-hide" data-${kind}="${esc(id)}"
    aria-pressed="${isHidden}" aria-label="${esc(tc(isHidden ? "Show “{name}”" : "Hide “{name}”", { name }))}">${esc(tc(isHidden ? "Show" : "Hide"))}</button>`;

  // bouton Développer / Réduire d'un panneau (aria-pressed : développé)
  const isExpanded = (id) => (store.get(CKEY, {}) || {})[id] === false;
  const expandButton = (name, id, ex) => `<button type="button" class="dash-expand" data-xp="${esc(id)}"
    aria-pressed="${ex}" aria-label="${esc(tl(ex ? "Collapse “{name}”" : "Expand “{name}”", { name }))}">${esc(tl(ex ? "Collapse" : "Expand"))}</button>`;
  function syncExpand() {
    dash.querySelectorAll(".dash-sub > li").forEach((li) => {
      const b = li.querySelector("[data-xp]");
      if (!b) return;
      const ex = isExpanded(li.dataset.param), name = li.querySelector(".dash-pname").textContent;
      b.setAttribute("aria-pressed", String(ex));
      b.textContent = tl(ex ? "Collapse" : "Expand");
      b.setAttribute("aria-label", tl(ex ? "Collapse “{name}”" : "Expand “{name}”", { name }));
      li.classList.toggle("is-expanded", ex);
    });
  }

  function build(on) {
    BLOCKS.items().forEach((b) => {
      b.querySelectorAll(":scope > .dash-bar, :scope > .dash-sub").forEach((x) => x.remove());
      if (!on) return;
      const name = b.dataset.label || b.dataset.block;
      const bar = document.createElement("div");
      bar.className = "dash-bar";
      bar.innerHTML = `<span class="dash-name">${esc(name)}</span>${moveButtons(name, "move")}${hideButton(name, "hb", b.dataset.block, hidden.b.has(b.dataset.block))}`;
      b.prepend(bar);
      // panneaux de mesures : sous-liste réordonnable
      if (b.contains(grid) && shownPanels().length) {
        const sub = document.createElement("ol");
        sub.className = "dash-sub";
        sub.setAttribute("aria-label", tl("Order of the measurement panels"));
        sub.innerHTML = shownPanels().map((c) => {
          const id = c.dataset.param, ex = isExpanded(id), cls = [hidden.p.has(id) && "is-hidden", ex && "is-expanded"].filter(Boolean);
          return `<li data-param="${esc(id)}"${cls.length ? ` class="${cls.join(" ")}"` : ""}>
          <span class="dash-pname">${esc(panelName(c))}</span>${moveButtons(panelName(c), "pmove")}${expandButton(panelName(c), id, ex)}${hideButton(panelName(c), "hp", id, hidden.p.has(id))}</li>`;
        }).join("");
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
    reset.disabled = isDefault();
  }
  // échange un élément avec son voisin (dir -1 / +1) dans son conteneur
  function swap(el, dir) {
    const step = (x) => (dir < 0 ? x.previousElementSibling : x.nextElementSibling);
    let other = step(el);
    while (adminHidden(other)) other = step(other);
    if (!other || other.matches(".dash-bar, .dash-sub")) return false;
    if (dir < 0) el.parentNode.insertBefore(el, other); else el.parentNode.insertBefore(other, el);
    return true;
  }

  dash.addEventListener("click", (e) => {
    // développer / réduire un panneau (appliqué par app.js : évènement « wx-compact »)
    const x = e.target.closest("[data-xp]");
    if (x) {
      const id = x.dataset.xp, ex = !isExpanded(id);
      const l = store.get(CKEY, {}) || {};
      l[id] = !ex;
      store.set(CKEY, l);
      window.dispatchEvent(new Event("wx-compact"));
      syncExpand(); refresh(); modified();
      const name = x.closest("li").querySelector(".dash-pname").textContent;
      live.textContent = tl(ex ? "“{name}” expanded" : "“{name}” collapsed", { name });
      return;
    }
    // masquer / afficher un cadre ou un panneau
    const h = e.target.closest("[data-hb], [data-hp]");
    if (h) {
      const isBlock = h.dataset.hb !== undefined, id = isBlock ? h.dataset.hb : h.dataset.hp;
      const set = isBlock ? hidden.b : hidden.p;
      const now = !set.has(id);
      if (now) set.add(id); else set.delete(id);
      saveHidden(); applyHidden();
      const name = isBlock ? h.closest(".dash-block").dataset.label : h.closest("li").querySelector(".dash-pname").textContent;
      h.setAttribute("aria-pressed", String(now));
      h.textContent = tc(now ? "Show" : "Hide");
      h.setAttribute("aria-label", tc(now ? "Show “{name}”" : "Hide “{name}”", { name }));
      if (!isBlock) h.closest("li").classList.toggle("is-hidden", now);
      live.textContent = tl(now ? "“{name}” hidden" : "“{name}” shown", { name });
      refresh(); modified();
      return;
    }
    const m = e.target.closest("[data-move], [data-pmove]");
    if (!m) return;
    if (m.dataset.move) {                    // cadre
      const b = m.closest(".dash-block"), dir = +m.dataset.move;
      if (!swap(b, dir)) return;
      BLOCKS.save(); refresh(); modified();
      live.textContent = tl("“{name}”: position {pos} of {count}", { name: b.dataset.label, pos: BLOCKS.ids().indexOf(b.dataset.block) + 1, count: BLOCKS.ids().length });
      (m.disabled ? b.querySelector(`.dash-bar [data-move="${-dir}"]`) : m).focus();
      b.scrollIntoView({ block: "nearest" });
    } else {                                 // panneau de mesures
      const li = m.closest("li"), dir = +m.dataset.pmove;
      const card = grid.querySelector(`:scope > .card[data-param="${CSS.escape(li.dataset.param)}"]`);
      if (!card || !swap(li, dir)) return;
      swap(card, dir);
      PANELS.save(); refresh(); modified();
      const ids = shownPanels().map((c) => c.dataset.param);
      live.textContent = tl("“{name}”: position {pos} of {count}", { name: panelName(card), pos: ids.indexOf(card.dataset.param) + 1, count: ids.length });
      (m.disabled ? li.querySelector(`[data-pmove="${-dir}"]`) : m).focus();
    }
  });
  reset.addEventListener("click", () => {
    applyLayout(null);
    setActive(null); renderProfiles();
    build(true);
    live.textContent = tl("Default order restored, all items shown");
    reset.focus();
  });
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = WXL.t("Dashboard", on ? "Done" : "Rearrange");
    reset.hidden = !on;
    pedit.hidden = !on;
    if (on && !pname.value && active && active.startsWith("u:")) pname.value = active.slice(2);
    renderEditor();
    document.body.classList.toggle("dash-editing", on);
    build(on);
    // fin de la réorganisation : cadres et panneaux réapparaissent, graphiques recalculés
    if (!on) window.dispatchEvent(new Event("resize"));
  });
  renderProfiles();
})();
