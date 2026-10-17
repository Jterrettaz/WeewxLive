/* weewx-live — page « Réglages → Admin » : entrée dans le mode admin (mot de passe de
 * skin.conf [[admin]] password, vérifié par son empreinte, WXA dans nav.js) et sortie. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const form = $("a-form"), root = $("a-root");
  // textes de la langue choisie (i18n.js)
  const ta = WXL.ctx("Admin"), th = (k) => esc(ta(k));
  let reserved = null;   // titres des paramètres réservés (configuration), si connus

  const listHTML = () => (reserved && reserved.length
    ? `<ul class="a-list">${reserved.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");

  function render(msg, isErr) {
    const note = `<span id="a-msg" class="a-msg${isErr ? " err" : ""}" role="status" aria-live="polite">${msg ? esc(msg) : ""}</span>`;
    if (!WXA.enabled) {
      root.innerHTML = `<p class="a-state"><i></i>${th("Admin mode not configured")}</p>
        <p class="muted">${th("No password is defined for this site ([LiveJSON] [[admin]] password in skin.conf or weewx.conf).")}</p>`;
      return;
    }
    if (WXA.active()) {
      root.innerHTML = `<p class="a-state on"><i></i>${th("Admin mode active")}</p>
        ${reserved && reserved.length ? `<p class="muted">${th("Reserved parameters shown:")}</p>${listHTML()}` : ""}
        <div class="u-tools"><button type="button" id="a-out">${th("Leave admin mode")}</button>${note}</div>`;
      $("a-out").addEventListener("click", () => {
        WXA.logout();
        if (window.WeewxNav) WeewxNav.refreshAdmin();
        render(ta("Admin mode left"));
        const pw = $("a-pw");
        if (pw) pw.focus();
      });
      return;
    }
    root.innerHTML = `<p class="a-state"><i></i>${th("Admin mode inactive")}</p>
      <input type="text" name="username" value="admin" autocomplete="username" hidden>
      <div class="a-row">
        <label for="a-pw">${th("Password")}</label>
        <input type="password" id="a-pw" name="password" autocomplete="current-password" required>
      </div>
      <div class="u-tools"><button type="submit" id="a-in">${th("Enter admin mode")}</button>${note}</div>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("a-pw"), btn = $("a-in");
    if (!pw || !btn) return;
    btn.disabled = true;
    const ok = await WXA.login(pw.value);
    if (ok) {
      if (window.WeewxNav) WeewxNav.refreshAdmin();
      render(ta("Admin mode on"));
      $("a-out").focus();
    } else {
      btn.disabled = false;
      $("a-msg").className = "a-msg err";
      $("a-msg").textContent = ta("Wrong password");
      pw.select();
    }
  });

  render();
  // titres des paramètres réservés (configuration du site)
  window.weewxConfig.then((cfg) => {
    reserved = ((cfg && cfg.parameters) || []).filter((p) => p.admin).map((p) => p.title || p.id);
    if (WXA.active()) render();
  });
})();
