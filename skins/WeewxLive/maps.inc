## weewx-live : bloc « Radar et satellite » du tableau de bord (extras.js)
  <section class="wide maps">
    <article class="card map-card" id="radar-card" style="--c: var(--rain)">
      <header><h2>$lt("Maps", "Precipitation radar")</h2><span class="hint" id="radar-hint">$lt("Maps", "last 2 hours")</span></header>
      <div class="map" id="radar-map"><p class="map-msg" id="radar-msg" hidden></p></div>
      <div class="player" id="radar-player"></div>
      <p class="credit" id="radar-credit">$lt("Maps", "Radar {credit}", credit='<a href="https://www.rainviewer.com/" rel="noopener">RainViewer</a>')</p>
    </article>
    <article class="card map-card" id="sat-card" style="--c: var(--press)">
      <header><h2>$lt("Maps", "Satellite")</h2><span class="hint" id="sat-hint">Meteosat</span><div class="seg" id="sat-layers" role="group" aria-label="$lt("Maps", "Image type")"></div></header>
      <div class="map" id="sat-map"><p class="map-msg" id="sat-msg" hidden></p></div>
      <div class="player" id="sat-player"></div>
      <p class="credit" id="sat-credit">$lt("Maps", "Images {credit}", credit='<a href="https://view.eumetsat.int/" rel="noopener">EUMETSAT EUMETView</a>') (CC BY 4.0)</p>
    </article>
  </section>
