## weewx-live : bloc « Radar et satellite » du tableau de bord (extras.js)
  <section class="wide maps">
    <article class="card map-card" id="radar-card" style="--c: var(--rain)">
      <header><h2>Radar précipitations</h2><span class="hint" id="radar-hint">2 dernières heures</span></header>
      <div class="map" id="radar-map"><p class="map-msg" id="radar-msg" hidden></p></div>
      <div class="player" id="radar-player"></div>
      <p class="credit" id="radar-credit">Radar <a href="https://www.rainviewer.com/" rel="noopener">RainViewer</a></p>
    </article>
    <article class="card map-card" id="sat-card" style="--c: var(--press)">
      <header><h2>Satellite</h2><span class="hint" id="sat-hint">Meteosat</span><div class="seg" id="sat-layers" role="group" aria-label="Type d'image"></div></header>
      <div class="map" id="sat-map"><p class="map-msg" id="sat-msg" hidden></p></div>
      <div class="player" id="sat-player"></div>
      <p class="credit" id="sat-credit">Images <a href="https://view.eumetsat.int/" rel="noopener">EUMETSAT EUMETView</a> (CC BY 4.0)</p>
    </article>
  </section>
