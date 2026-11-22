/* weewx-live — page « Réglages → Apparence » : mode (automatique / clair / sombre) et thème de
 * couleurs choisis par le visiteur, valables pour toutes les pages (WXS, theme.js ;
 * localStorage). Par défaut : réglages du site (skin.conf [LiveJSON] [[appearance]]).
 * Aperçu : la case de chaque thème est dans les couleurs de ce thème (fond, texte, bordure),
 * dans le mode affiché (attributs data-palette / data-theme, couleurs de theme.css). Noms
 * des thèmes : [Texts] [[Themes]] des fichiers de langue. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ta = WXL.ctx("Appearance");
  const MODE = {
    auto: [ta("Automatic"), ta("light or dark according to the device setting")],
    light: [ta("Light"), ta("always")],
    dark: [ta("Dark"), ta("always")],
  };
  // mode affiché : choisi, sinon réglage de l'appareil
  const DARK_MQ = matchMedia("(prefers-color-scheme: dark)");
  const shownMode = () => (WXS.mode() === "auto" ? (DARK_MQ.matches ? "dark" : "light") : WXS.mode());

  const option = (group, value, checked, body, attrs = "") => `<label class="ap-opt"${attrs}>
      <input type="radio" name="ap-${group}" value="${esc(value)}"${checked ? " checked" : ""}>
      <span class="ap-body">${body}</span></label>`;

  function render() {
    const mode = WXS.mode(), theme = WXS.theme();
    const site = (on, txt) => (on ? ` <span class="ap-site">${esc(txt)}</span>` : "");
    $("ap-root").innerHTML = `
      <fieldset class="ap-set"><legend>${esc(ta("Mode"))}</legend><div class="ap-grid">${
        WXS.MODES.map((m) => option("mode", m, m === mode,
          `<b>${esc(MODE[m][0])}${site(m === WXS.siteMode(), ta("(site mode)"))}</b><small>${esc(MODE[m][1])}</small>`)).join("")}
      </div></fieldset>
      <fieldset class="ap-set"><legend>${esc(ta("Colour theme"))}</legend><div class="ap-grid">${
        WXS.THEMES.map((t) => option("theme", t, t === theme,
          `<b>${esc(WXS.name(t))}${site(t === WXS.siteTheme(), ta("(site theme)"))}</b>`,
          ` data-palette="${esc(t)}" data-theme="${shownMode()}"`)).join("")}
      </div></fieldset>`;
    $("ap-reset").disabled = !WXS.userChoice("mode") && !WXS.userChoice("theme");
  }

  $("ap-root").addEventListener("change", (e) => {
    const k = e.target.name === "ap-mode" ? "mode" : e.target.name === "ap-theme" ? "theme" : null;
    if (!k) return;
    WXS.set(k, e.target.value);
    if (k === "mode") rerender();            // cases des thèmes dans le nouveau mode
    $("ap-reset").disabled = !WXS.userChoice("mode") && !WXS.userChoice("theme");
    $("ap-live").textContent = k === "mode"
      ? ta("Mode: {name} (saved)", { name: MODE[WXS.mode()][0] })
      : ta("Colour theme: {name} (saved)", { name: WXS.name(WXS.theme()) });
  });
  $("ap-reset").addEventListener("click", () => {
    WXS.reset();
    render();
    $("ap-live").textContent = ta("Site appearance restored");
    const c = $("ap-root").querySelector("input:checked");
    if (c) c.focus();
  });
  // nouveau rendu en gardant le focus sur le choix en cours
  function rerender() {
    const f = document.activeElement && document.activeElement.name;
    render();
    const c = f && $("ap-root").querySelector(`input[name="${f}"]:checked`);
    if (c) c.focus();
  }
  // choix fait dans un autre onglet ; mode automatique : réglage de l'appareil changé
  window.addEventListener("storage", rerender);
  DARK_MQ.addEventListener("change", rerender);

  render();
})();
