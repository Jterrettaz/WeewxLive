## weewx-live : bloc « Prévisions » du tableau de bord (extras.js)
  <section class="wide">
    <article class="card fc-card" id="fc-card" style="--c: var(--sun)">
      <header><h2>Prévisions $livejson_fc_days jours</h2>
        <select class="fc-select" id="fc-select" aria-label="Modèle de prévision" hidden></select>
        <span class="hint" id="fc-model">Open-Meteo</span><span class="hint fc-sun" id="fc-sun"></span></header>
      <div id="forecast"><p class="muted">Chargement des prévisions…</p></div>
      <div class="fc-hours" id="fc-hours" hidden>
        <div class="fh-head"><h3 id="fh-title">--</h3><button type="button" class="fh-close" id="fh-close" aria-label="Fermer le détail horaire">×</button></div>
        <div class="fh-charts">
          <div><div class="fh-label">Température (°C)</div><div class="chart fh-chart" id="fh-temp"></div></div>
          <div class="fh-rainbox" id="fh-rainbox"><div class="fh-label">Précipitations (mm par heure)</div><div class="chart fh-chart" id="fh-rain"></div><p class="fh-dry">Pas de précipitations prévues ce jour-là.</p></div>
        </div>
        <ol class="fh-strip" id="fh-strip" aria-label="Prévisions heure par heure"></ol>
        <p class="fh-legend">Par heure : température · précipitations et probabilité · vent moyen et rafales (km/h) · humidité</p>
      </div>
      <p class="credit">Prévisions <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>
    </article>
  </section>
