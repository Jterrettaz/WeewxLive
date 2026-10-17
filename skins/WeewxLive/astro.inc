## weewx-live : panneau « Soleil et Lune » (almanach weewx, astro.js)
  <section class="wide" hidden>
    <article class="card astro-card" id="astro-card" style="--c: var(--sun)">
      <header><h2>$lt("Astro", "Sun and Moon")</h2><span class="hint">$lt("Common", "today")</span></header>
      <div class="astro">
        <div class="astro-info">
          <div class="astro-col"><h3><i class="as-dot" style="background:var(--sun)"></i>$lt("Astro", "Sun")</h3><div id="astro-sun"></div></div>
          <div class="astro-col"><h3><i class="as-dot" style="background:var(--moon)"></i>$lt("Astro", "Moon")</h3><div id="astro-moon"></div></div>
        </div>
        <div class="astro-side">
          <div class="chart astro-chart" id="astro-chart" role="img" aria-label="$lt("Astro", "Sun and moon altitude")"></div>
          <ul class="legend" id="astro-legend"><li data-s="2,4"><i style="background:var(--sun)"></i>$lt("Astro", "Sun altitude")</li><li data-s="3,5"><i style="background:var(--moon)"></i>$lt("Astro", "Moon altitude")</li><li data-s="0"><i class="band" style="background:color-mix(in srgb, var(--sun) 18%, transparent)"></i>$lt("Astro", "Daylight")</li><li class="lg-note">$lt("Astro", "● current position · grey line: horizon")</li></ul>
        </div>
      </div>
    </article>
  </section>
