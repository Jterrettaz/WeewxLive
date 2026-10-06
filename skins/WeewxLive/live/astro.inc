## weewx-live : panneau « Soleil et Lune » (almanach weewx, astro.js)
  <section class="wide" hidden>
    <article class="card astro-card" id="astro-card" style="--c: var(--sun)">
      <header><h2>Soleil et Lune</h2><span class="hint">aujourd'hui</span></header>
      <div class="astro">
        <div class="astro-info">
          <div class="astro-col"><h3><i class="as-dot" style="background:var(--sun)"></i>Soleil</h3><div id="astro-sun"></div></div>
          <div class="astro-col"><h3><i class="as-dot" style="background:var(--moon)"></i>Lune</h3><div id="astro-moon"></div></div>
        </div>
        <div class="astro-side">
          <div class="chart astro-chart" id="astro-chart" role="img" aria-label="Hauteur du soleil et de la lune"></div>
          <ul class="legend"><li><i style="background:var(--sun)"></i>Hauteur du soleil</li><li><i style="background:var(--moon)"></i>Hauteur de la lune</li><li><i class="band" style="background:color-mix(in srgb, var(--sun) 18%, transparent)"></i>Jour</li><li class="lg-note">● position actuelle · trait gris : horizon</li></ul>
        </div>
      </div>
    </article>
  </section>
