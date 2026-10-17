## weewx-live : bloc « Prévisions » du tableau de bord (extras.js)
  <section class="wide">
    <article class="card fc-card" id="fc-card" style="--c: var(--sun)">
      <header><h2>$lt("Forecast", "{days}-day forecast", days=$livejson_fc_days)</h2>
        <select class="fc-select" id="fc-select" aria-label="$lt("Forecast", "Forecast model")" hidden></select>
        <span class="hint" id="fc-model">Open-Meteo</span><span class="hint fc-sun" id="fc-sun"></span></header>
      <div id="forecast"><p class="muted">$lt("Forecast", "Loading forecasts…")</p></div>
      <div class="fc-hours" id="fc-hours" hidden>
        <div class="fh-head"><h3 id="fh-title">--</h3><button type="button" class="fh-close" id="fh-close" aria-label="$lt("Forecast", "Close hourly detail")">×</button></div>
        <div class="fh-charts">
          <div><div class="fh-label">$lt("Forecast", "Temperature ({unit})", unit='<span data-ubase="°C">°C</span>')</div><div class="chart fh-chart" id="fh-temp"></div></div>
          <div class="fh-rainbox" id="fh-rainbox"><div class="fh-label">$lt("Forecast", "Precipitation ({unit} per hour)", unit='<span data-ubase="mm">mm</span>')</div><div class="chart fh-chart" id="fh-rain"></div><p class="fh-dry">$lt("Forecast", "No precipitation expected that day.")</p></div>
        </div>
        <ol class="fh-strip" id="fh-strip" aria-label="$lt("Forecast", "Hour-by-hour forecast")"></ol>
        <p class="fh-legend">$lt("Forecast", "Per hour: temperature · precipitation and probability · mean wind and gusts ({unit}) · humidity", unit='<span data-ubase="km/h">km/h</span>')</p>
      </div>
      <p class="credit">$lt("Common", "Forecasts by {source}", source='<a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a>') (CC BY 4.0)</p>
    </article>
  </section>
