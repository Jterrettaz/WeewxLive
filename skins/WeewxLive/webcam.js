/* weewx-live — page « Webcam » (webcam.html) : images (jpg, png…) et vidéos (mp4…) de
 * skin.conf [[webcam]], l'une sous l'autre, dans l'ordre de la configuration. Éléments
 * « admin = true » : seulement en mode admin (WXA, nav.js). Images rechargées toutes les
 * « refresh » secondes (paramètre anti-cache ajouté à l'adresse), sans clignotement : la
 * nouvelle image remplace l'ancienne une fois chargée. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const root = $("wc-root");
  const timers = [];
  // adresse sans cache : paramètre « _ » ajouté (ou remplacé)
  const fresh = (url) => url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const hm = (t) => WXT.hm(t / 1000);
  // textes de la langue choisie (i18n.js)
  const tw = WXL.ctx("Webcam"), th = (k, v) => esc(tw(k, v));

  function figure(w, i) {
    const cap = w.caption ? `<p class="wc-cap">${esc(w.caption)}</p>` : "";
    const badge = w.admin ? ` <span class="wc-admin" title="${th("Visible only in admin mode")}">${th("admin")}</span>` : "";
    const media = w.type === "video"
      ? `<video class="wc-media" src="${esc(w.url)}" controls muted playsinline preload="metadata"${w.autoplay ? " autoplay loop" : ""}>
           <a href="${esc(w.url)}">${th("Download the video")}</a></video>`
      : `<a class="wc-link" href="${esc(w.url)}" target="_blank" rel="noopener" title="${th("Open the full-size image (new tab)")}">
           <img class="wc-media" id="wc-img-${i}" src="${esc(w.refresh ? fresh(w.url) : w.url)}" alt="${esc(w.title)}" decoding="async"></a>`;
    return `<figure class="card wc-card" id="wc-${i}">
      <header><h3>${esc(w.title)}${badge}</h3><span class="wc-time" id="wc-t-${i}"></span></header>
      <div class="wc-box">${media}<p class="wc-err" id="wc-err-${i}" hidden>${th(w.type === "video" ? "Video unavailable." : "Image unavailable.")}</p></div>
      ${cap}</figure>`;
  }

  // image : chargement en arrière-plan puis remplacement (pas d'image vide pendant le chargement)
  function reload(w, i) {
    const img = $("wc-img-" + i);
    if (!img) return;
    const next = new Image();
    next.onload = () => { img.src = next.src; ok(i, true); };
    next.onerror = () => ok(i, false);
    next.src = fresh(w.url);
  }
  function ok(i, good) {
    const err = $("wc-err-" + i), t = $("wc-t-" + i);
    if (err) err.hidden = good;
    const media = document.querySelector(`#wc-${i} .wc-media`);
    if (media) media.classList.toggle("wc-broken", !good);
    if (t && good) t.textContent = tw("refreshed at {time}", { time: hm(Date.now()) });
  }

  function render(cfg) {
    timers.splice(0).forEach(clearInterval);
    const wc = cfg && cfg.webcam;
    const all = (wc && wc.enable && wc.items) || [];
    const items = all.filter((w) => WXA.visible(w));
    if (cfg && cfg.stationName) document.title = tw("Webcam — {station}", { station: cfg.stationName });
    if (!items.length) {
      root.innerHTML = `<p class="banner">${th(all.length
        ? "No image or video is available for now."
        : "No webcam configured ([[webcam]] section of skin.conf).")}</p>`;
      $("wc-sub").textContent = "";
      return;
    }
    const nImg = items.filter((w) => w.type !== "video").length, nVid = items.length - nImg;
    $("wc-sub").textContent = [nImg ? tw(nImg > 1 ? "{n} images" : "{n} image", { n: nImg }) : "", nVid ? tw(nVid > 1 ? "{n} videos" : "{n} video", { n: nVid }) : ""]
      .filter(Boolean).join(" · ");
    root.innerHTML = items.map(figure).join("");
    items.forEach((w, i) => {
      if (w.type === "video") {
        const v = document.querySelector(`#wc-${i} video`);
        v.addEventListener("error", () => ok(i, false));
        v.addEventListener("loadedmetadata", () => { $("wc-err-" + i).hidden = true; });
        return;
      }
      const img = $("wc-img-" + i);
      img.addEventListener("load", () => ok(i, true), { once: true });
      img.addEventListener("error", () => ok(i, false), { once: true });
      if (w.refresh) timers.push(setInterval(() => { if (!document.hidden) reload(w, i); }, w.refresh * 1000));
    });
  }

  // retour sur l'onglet : images rechargées aussitôt
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !window.weewxConfig) return;
    window.weewxConfig.then((cfg) => {
      const items = ((cfg && cfg.webcam && cfg.webcam.items) || []).filter((w) => WXA.visible(w));
      items.forEach((w, i) => { if (w.type !== "video" && w.refresh) reload(w, i); });
    });
  });

  (window.weewxConfig || Promise.resolve(null)).then(render);
})();
