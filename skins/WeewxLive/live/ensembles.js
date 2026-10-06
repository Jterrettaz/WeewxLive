/* weewx-live — page « Prévisions — Ensembles » (ensembles.html).
 * Données : data/ensembles.json, produit par weewx (livejson.ensembles) à partir de l'API
 * Ensemble d'Open-Meteo : pour chaque modèle configuré ([LiveJSON] [[ensembles]] models),
 * les membres de température, vent et pression (un point toutes les « step » heures) et les
 * valeurs journalières de chaque membre (max., min., pluie, vent max., pression moyenne).
 * Tout le reste est calculé ici selon les modèles cochés et l'horizon choisi :
 *   - graphiques « chaque membre » (couleur du modèle) avec moyenne groupée et bande 10–90 % ;
 *   - pluie par jour (moyenne groupée, 90e centile, moyenne de chaque modèle) et probabilité ;
 *   - comparaison des modèles, tableau jour après jour.
 * Inspiré de la page « Prévisions Open-Meteo » de Météo Sciez (scripts de digitalurban). */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = $("en-root");
  if (!root) return;

  const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v, d = 1) => (isNum(v) ? Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const fmtT = (v) => (isNum(v) ? `${fmt(v, 1)} °C` : "—");
  const dayLabel = (iso) => isoDate(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const isoDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const tOf = (iso) => isoDate(iso).getTime() / 1000;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : null);
  function pct(sorted, q) {
    if (!sorted.length) return null;
    const x = (sorted.length - 1) * q, i = Math.floor(x), f = x - i;
    return i + 1 >= sorted.length ? sorted[i] : sorted[i] + f * (sorted[i + 1] - sorted[i]);
  }
  // statistiques d'une liste de valeurs (null ignorés)
  function stats(vals) {
    const v = vals.filter(isNum).sort((a, b) => a - b);
    if (!v.length) return null;
    return { n: v.length, mean: mean(v), p10: pct(v, 0.1), p90: pct(v, 0.9), min: v[0], max: v[v.length - 1], vals: v };
  }
  // couleurs des modèles (variables CSS --m1 … --m8, dans l'ordre de la configuration)
  const PAL = ["--m1", "--m2", "--m3", "--m4", "--m5", "--m6", "--m7", "--m8"];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("weewx-ens-" + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem("weewx-ens-" + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };

  let D = null, MODELS = [], sel = new Set(), H = 3;
  const charts = {};

  // ------------------------------------------------------------------
  // Chargement
  // ------------------------------------------------------------------
  async function load() {
    try {
      const opt = { cache: "no-store" };
      if (window.AbortSignal && AbortSignal.timeout) opt.signal = AbortSignal.timeout(30000);
      const r = await fetch("data/ensembles.json?_=" + Math.floor(Date.now() / 600000), opt);
      if (!r.ok) throw new Error("HTTP " + r.status);
      D = await r.json();
      if (D.error) throw new Error(D.error);
    } catch (e) {
      root.innerHTML = `<p class="muted">Prévisions d'ensemble indisponibles (${esc(e.message)}).</p>`;
      return;
    }
    MODELS = D.models.filter((m) => !m.error && m.daily && m.daily.dates && m.daily.dates.length);
    MODELS.forEach((m, i) => (m.color = PAL[i % PAL.length]));
    const saved = store.get("sel");
    sel = new Set((Array.isArray(saved) ? saved : []).filter((id) => MODELS.some((m) => m.id === id)));
    if (!sel.size) MODELS.forEach((m) => sel.add(m.id));
    const hs = D.horizons || [3, 7, 10, 16];
    const sh = store.get("h");
    H = hs.includes(sh) ? sh : hs.includes(D.horizon) ? D.horizon : hs[0];
    if (!MODELS.length) {
      root.innerHTML = `<p class="muted">Aucun modèle disponible pour le moment.</p>${errors()}`;
      return;
    }
    build();
    update();
  }

  function errors() {
    const bad = D.models.filter((m) => m.error);
    const stale = D.models.filter((m) => m.stale);
    return (bad.length ? `<p class="en-warn">Indisponible : ${bad.map((m) => `${esc(m.short)} (${esc(m.error)})`).join(", ")}.</p>` : "") +
      (stale.length ? `<p class="en-warn">Données précédentes conservées (téléchargement en échec) : ${stale.map((m) => esc(m.short)).join(", ")}.</p>` : "");
  }

  // ------------------------------------------------------------------
  // Structure de la page
  // ------------------------------------------------------------------
  function build() {
    // page reconstruite (relecture des données) : anciens graphiques libérés
    Object.keys(charts).forEach((k) => { charts[k].destroy(); delete charts[k]; });
    const hs = D.horizons || [3, 7, 10, 16];
    root.innerHTML = `
      <div class="en-bar">
        <div class="en-chips" role="group" aria-label="Modèles affichés">
          ${MODELS.map((m) => `<button type="button" class="en-chip" data-id="${esc(m.id)}" style="--mc: var(${m.color})" title="${esc(m.label)}">
            <i></i><b>${esc(m.short)}</b><span>${m.members} membres</span></button>`).join("")}
        </div>
        <div class="en-hz" role="group" aria-label="Horizon">
          ${hs.map((h) => `<button type="button" data-h="${h}">${h} jours</button>`).join("")}
        </div>
      </div>
      <p class="en-sum" id="en-sum"></p>
      ${errors()}
      <div class="en-grid">
        <article class="card en-card"><header><h2>Température — chaque membre</h2></header>
          <div class="chart en-chart" id="en-temp" role="img" aria-label="Température : chaque membre des modèles"></div>
          <ul class="legend" id="en-leg-temp"></ul></article>
        <article class="card en-card"><header><h2>Pluie — total du jour et probabilité</h2></header>
          <div class="chart en-chart en-chart-rain" id="en-rain" role="img" aria-label="Pluie par jour"></div>
          <div class="chart en-chart-prob" id="en-prob" role="img" aria-label="Pourcentage des membres prévoyant de la pluie"></div>
          <ul class="legend" id="en-leg-rain"></ul></article>
        <article class="card en-card"><header><h2>Vent moyen — chaque membre</h2></header>
          <div class="chart en-chart" id="en-wind" role="img" aria-label="Vent : chaque membre des modèles"></div>
          <ul class="legend" id="en-leg-wind"></ul></article>
        <article class="card en-card"><header><h2>Pression — chaque membre</h2></header>
          <div class="chart en-chart" id="en-press" role="img" aria-label="Pression : chaque membre des modèles"></div>
          <ul class="legend" id="en-leg-press"></ul></article>
      </div>
      <article class="card en-block" id="en-compare"></article>
      <article class="card en-block" id="en-days"></article>
      <p class="en-foot">Source : API Ensemble d'Open-Meteo · ${MODELS.map((m) => esc(m.label)).join(" · ")}.
        Il ne s'agit pas d'une prévision humaine ; au-delà du 7<sup>e</sup> jour, considérez-la comme une tendance et non comme une prévision détaillée.</p>`;
    root.querySelectorAll(".en-chip").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.id;
      if (sel.has(id)) { if (sel.size > 1) sel.delete(id); } else sel.add(id);
      store.set("sel", [...sel]);
      update();
    }));
    root.querySelectorAll(".en-hz button").forEach((b) => b.addEventListener("click", () => {
      H = +b.dataset.h; store.set("h", H); update();
    }));
  }

  // ------------------------------------------------------------------
  // Calculs : séries horaires groupées et statistiques journalières
  // ------------------------------------------------------------------
  const selected = () => MODELS.filter((m) => sel.has(m.id));

  function window_() {
    const S = selected();
    const start = Math.min(...S.map((m) => m.t0));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day0 = today.getTime() / 1000;
    return { start, day0, end: day0 + H * 86400 };
  }

  // séries d'une variable (temp / wind / press) : membres, moyennes par modèle, groupées
  function hourly(key, w) {
    const S = selected();
    const step = S[0].step;
    const members = [], perModel = [];
    const bucket = new Map();     // t -> valeurs de tous les membres
    for (const m of S) {
      const rows = (m.series && m.series[key]) || [];
      const mm = new Map();
      for (const row of rows) {
        const data = [];
        row.forEach((v, i) => {
          const t = m.t0 + i * m.step;
          if (t > w.end) return;
          data.push([t, v]);
          if (!isNum(v)) return;
          if (!bucket.has(t)) bucket.set(t, []);
          bucket.get(t).push(v);
          if (!mm.has(t)) mm.set(t, []);
          mm.get(t).push(v);
        });
        members.push({ m, data });
      }
      perModel.push({ m, data: [...mm.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, mean(v)]) });
    }
    const ts = [...bucket.keys()].sort((a, b) => a - b);
    const grp = ts.map((t) => [t, stats(bucket.get(t))]);
    return { members, perModel, step, grp };
  }

  // statistiques journalières groupées (tous les modèles cochés) et par modèle
  function daily(w) {
    const S = selected();
    const dates = [];
    for (let i = 0; i < H; i++) {
      const d = new Date(w.day0 * 1000); d.setDate(d.getDate() + i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    const thr = D.threshold;
    const days = dates.map((iso) => {
      const all = { tmax: [], tmin: [], rain: [], wind: [], press: [] };
      const per = [];
      let models = 0;
      for (const m of S) {
        const j = m.daily.dates.indexOf(iso);
        if (j < 0) continue;
        const pm = {};
        let any = false;
        for (const k of Object.keys(all)) {
          const v = (m.daily[k] || []).map((r) => r[j]).filter(isNum);
          if (v.length) any = true;
          all[k].push(...v);
          pm[k] = v.length ? mean(v) : null;
        }
        if (any) { models++; per.push({ m, ...pm }); }
      }
      const r = { iso, models, per, n: all.tmax.length };
      for (const k of Object.keys(all)) r[k] = stats(all[k]);
      if (r.rain) {
        r.prob = r.rain.vals.filter((v) => v >= thr - 1e-6).length / r.rain.n;
      }
      // confiance : dispersion des maxima (température) ; accord des membres et
      // dispersion des cumuls (pluie)
      if (r.tmax) {
        const sp = r.tmax.p90 - r.tmax.p10;
        r.confT = sp <= 2.5 ? 2 : sp <= 5 ? 1 : 0;
      }
      if (r.rain) {
        const a = Math.max(r.prob, 1 - r.prob), sp = r.rain.p90 - r.rain.p10;
        r.confR = a >= 0.85 && sp <= Math.max(3, r.rain.mean) ? 2 : a >= 0.7 ? 1 : 0;
      }
      return r;
    }).filter((r) => r.n);
    return days;
  }

  // ------------------------------------------------------------------
  // Graphiques
  // ------------------------------------------------------------------
  const CONF = ["Bas", "Moyen", "Haut"];
  const confCls = (c) => ["en-low", "en-mid", "en-high"][c];

  function lineChart(id, key, unit, dec, w, opts) {
    const h = hourly(key, w);
    const many = h.members.length > 120;
    const s = [
      { type: "band", label: "10–90 %", color: "--text-2", alpha: 0.13, tipRank: 2,
        data: h.grp.map(([t, st]) => [t, st && st.n >= 3 ? st.p10 : null, st && st.n >= 3 ? st.p90 : null]) },
      ...h.members.map(({ m, data }) => ({ type: "line", label: m.short, color: m.color, width: 1, alpha: many ? 0.22 : 0.32, endDot: false, noTip: true, data })),
      ...h.perModel.map(({ m, data }) => ({ type: "line", ghost: true, label: m.short, color: m.color, tipRank: 3, data })),
      { type: "line", label: "Moyenne groupée", color: "--text", width: 2.5, endDot: false, tipRank: 1,
        data: h.grp.map(([t, st]) => [t, st ? st.mean : null]) },
    ];
    const o = Object.assign({
      unit, decimals: dec, range: [w.start, w.end], xTicks: "day", maxGap: h.step * 1.5, yTicks: 4, padLeft: 44,
      tipHead: (t) => new Date(t * 1000).toLocaleString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      series: s,
    }, opts || {});
    draw(id, o);
    const leg = $("en-leg-" + key);
    if (leg) {
      leg.innerHTML = selected().map((m) => `<li><i style="background:var(${m.color})"></i>${esc(m.short)}</li>`).join("") +
        `<li><i style="background:var(--text)"></i>Moyenne groupée</li><li><i class="band" style="background:var(--text-2);opacity:.35"></i>10–90 %</li>`;
    }
  }

  function draw(id, o) {
    if (charts[id]) { charts[id].setSeries(o.series, o); charts[id].draw(); }
    else { charts[id] = new MiniChart($(id), o); charts[id].draw(); }
  }

  function rainCharts(days, w) {
    const u = D.units.rain;
    const series = [
      { type: "bar", label: "90e centile", color: "--grid", bucket: 86400, tipRank: 2,
        data: days.filter((r) => r.rain).map((r) => [tOf(r.iso), r.rain.p90]) },
      { type: "bar", label: "Moyenne groupée", color: "--rain", bucket: 86400, tipRank: 1,
        data: days.filter((r) => r.rain).map((r) => [tOf(r.iso), r.rain.mean]) },
    ];
    selected().forEach((m) => series.push({
      type: "dots", label: m.short, color: m.color, r: 3.5, alpha: 1, tipRank: 3,
      data: days.map((r) => { const p = r.per.find((x) => x.m === m); return [tOf(r.iso) + 43200, p ? p.rain : null]; }).filter((p) => isNum(p[1])),
    }));
    draw("en-rain", { unit: u, decimals: 1, range: [w.day0, w.end], xTicks: "day", floor: 0, maxGap: 43200, yTicks: 4, padLeft: 44,
      tipHead: (t) => new Date(t * 1000).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      series });
    draw("en-prob", { unit: "%", decimals: 0, range: [w.day0, w.end], xTicks: "day", yFixed: [0, 100, 50], maxGap: 86400 * 1.5, padLeft: 44,
      yFormat: (v) => `${v} %`,
      tipHead: (t) => new Date(t * 1000).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      series: [{ type: "line", label: `Membres avec pluie (≥ ${fmt(D.threshold, 1)} mm)`, color: "--text", width: 2, endDot: false,
        data: days.filter((r) => isNum(r.prob)).map((r) => [tOf(r.iso) + 43200, Math.round(r.prob * 100)]) },
      { type: "dots", label: "", color: "--text", r: 3, alpha: 1, noTip: true,
        data: days.filter((r) => isNum(r.prob)).map((r) => [tOf(r.iso) + 43200, Math.round(r.prob * 100)]) }] });
    $("en-leg-rain").innerHTML = `<li><i style="background:var(--grid)"></i>90e centile</li><li><i style="background:var(--rain)"></i>Moyenne groupée</li>` +
      selected().map((m) => `<li><i class="dot" style="background:var(${m.color})"></i>${esc(m.short)}</li>`).join("") +
      `<li><i style="background:var(--text)"></i>% des membres avec pluie (≥ ${fmt(D.threshold, 1)} mm)</li>`;
  }

  // ------------------------------------------------------------------
  // Tableaux : comparaison des modèles, jour après jour
  // ------------------------------------------------------------------
  const nj = (n) => `${n} jour${n > 1 ? "s" : ""}`;

  // moyennes par modèle sur la période
  function compareModels(days) {
    return selected().map((m) => {
      const per = days.map((r) => r.per.find((x) => x.m === m)).filter(Boolean);
      const v = (k) => per.map((p) => p[k]).filter(isNum);
      return { m, days: per.length, tmax: mean(v("tmax")), tmin: mean(v("tmin")),
               rain: v("rain").length ? sum(v("rain")) : null, wind: mean(v("wind")), press: mean(v("press")) };
    });
  }

  function compareTable(days) {
    const cmp = compareModels(days);
    const withT = cmp.filter((c) => isNum(c.tmax));
    const hot = withT.length > 1 ? withT.reduce((a, b) => (b.tmax > a.tmax ? b : a)) : null;
    const cold = withT.length > 1 ? withT.reduce((a, b) => (b.tmax < a.tmax ? b : a)) : null;
    return `<header><h2>Comparaison des modèles · ${nj(days.length)}</h2></header>
      <div class="cm-scroll"><table class="en-table">
        <thead><tr><th scope="col">Modèle</th><th scope="col">Membres</th><th scope="col">Moy. max</th><th scope="col">Moy. min</th>
          <th scope="col">Pluie</th><th scope="col">Vent km/h</th><th scope="col">hPa</th><th scope="col">Jours</th></tr></thead>
        <tbody>${cmp.map((c) => `<tr>
          <th scope="row"><span class="en-sq" style="background:var(${c.m.color})"></span><b>${esc(c.m.label)}</b><small>${esc(c.m.origin || "")}</small></th>
          <td>${c.m.members}</td>
          <td>${tcol(c.tmax)}${c === hot ? '<small class="en-hot">le plus chaud</small>' : c === cold ? '<small class="en-cold">le plus frais</small>' : ""}</td>
          <td>${tcol(c.tmin)}</td><td>${isNum(c.rain) ? `${fmt(c.rain, 1)} mm` : "—"}</td>
          <td>${fmt(c.wind, 0)}</td><td>${fmt(c.press, 0)}</td><td>${c.days}/${days.length}</td></tr>`).join("")}</tbody>
      </table></div>`;
  }
  const tcol = (v) => (isNum(v) ? `<span class="en-t"${window.TempScale ? ` style="color:${TempScale.textColor(Math.round(v * 10) / 10)}"` : ""}>${fmt(v, 1)}°</span>` : "—");

  function dayTable(days) {
    const nS = selected().length;
    return `<header><h2>Jour après jour · tous les modèles confondus</h2></header>
      <div class="cm-scroll"><table class="en-table en-days">
        <thead><tr><th scope="col">Jour</th><th scope="col">Max °C</th><th scope="col">Min °C</th><th scope="col">Conf. temp.</th>
          <th scope="col">Risque de pluie</th><th scope="col">Pluie mm</th><th scope="col">Conf. pluie</th><th scope="col">Vent km/h</th><th scope="col">hPa</th></tr></thead>
        <tbody>${days.map((r) => `<tr>
          <th scope="row">${dayLabel(r.iso)}${r.models < nS ? ` <small class="en-cov" title="modèles disponibles ce jour-là">${r.models}/${nS}</small>` : ""}</th>
          <td>${r.tmax ? `${tcol(r.tmax.mean)}<small>${fmt(r.tmax.p10, 1)}–${fmt(r.tmax.p90, 1)}° · pic ${fmt(r.tmax.max, 1)}°</small>` : "—"}</td>
          <td>${r.tmin ? `${tcol(r.tmin.mean)}<small>${fmt(r.tmin.p10, 1)}–${fmt(r.tmin.p90, 1)}° · min. ${fmt(r.tmin.min, 1)}°</small>` : "—"}</td>
          <td class="${isNum(r.confT) ? confCls(r.confT) : ""}">${isNum(r.confT) ? CONF[r.confT] : "—"}</td>
          <td>${isNum(r.prob) ? `<span class="en-pbar"><i style="width:${Math.round(r.prob * 100)}%"></i></span><small>${Math.round(r.prob * 100)} % des membres</small>` : "—"}</td>
          <td>${r.rain ? `<b>${fmt(r.rain.mean, 1)}</b><small>${fmt(r.rain.p10, 1)}–${fmt(r.rain.p90, 1)} · max ${fmt(r.rain.max, 1)} mm</small>` : "—"}</td>
          <td class="${isNum(r.confR) ? confCls(r.confR) : ""}">${isNum(r.confR) ? CONF[r.confR] : "—"}</td>
          <td>${r.wind ? `<b>${fmt(r.wind.mean, 0)}</b><small>p90 ${fmt(r.wind.p90, 0)}</small>` : "—"}</td>
          <td>${r.press ? fmt(r.press.mean, 0) : "—"}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="cm-note">Max / min : moyenne des membres, puis intervalle 10–90 % et extrême. Risque de pluie : part des membres prévoyant au moins
        ${fmt(D.threshold, 1)} mm. Confiance température : écart 10–90 % des maximales (haut ≤ 2,5 °C, moyen ≤ 5 °C) ; confiance pluie : accord des
        membres sur la pluie (≥ 85 % haut, ≥ 70 % moyen) et dispersion des cumuls. Vent : maximum journalier du vent moyen.</p>`;
  }

  // ------------------------------------------------------------------
  function update() {
    root.querySelectorAll(".en-chip").forEach((b) => b.setAttribute("aria-pressed", sel.has(b.dataset.id) ? "true" : "false"));
    root.querySelectorAll(".en-hz button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.h === H ? "true" : "false"));
    const S = selected();
    const w = window_();
    const fetched = Math.max(...S.map((m) => m.fetched || 0));
    const maxDays = Math.max(...S.map((m) => m.daily.dates.length));
    $("en-sum").textContent = `${sum(S.map((m) => m.members))} membres · ${S.map((m) => `${m.short} ${m.members}`).join(" · ")} · jusqu'à ${maxDays} jours` +
      (fetched ? ` · données du ${new Date(fetched * 1000).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "");
    const U = D.units;
    lineChart("en-temp", "temp", U.temp, 1, w);
    lineChart("en-wind", "wind", U.wind, 0, w, { floor: 0 });
    lineChart("en-press", "press", U.press, 0, w, { minRange: 10 });
    const days = daily(w);
    rainCharts(days, w);
    $("en-compare").innerHTML = compareTable(days);
    $("en-days").innerHTML = dayTable(days);
  }

  load();
  // relecture toutes les 30 minutes (données recalculées par weewx)
  setInterval(() => { if (D) load(); }, 30 * 60 * 1000);
})();
