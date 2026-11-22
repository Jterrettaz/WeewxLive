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
          <div class="astro-pane">
          <div class="chart astro-chart" id="astro-chart" role="img" aria-label="$lt("Astro", "Sun and moon altitude")"></div>
          <ul class="legend" id="astro-legend"><li data-s="2,4"><i style="background:var(--sun)"></i>$lt("Astro", "Sun altitude")</li><li data-s="3,5"><i style="background:var(--moon)"></i>$lt("Astro", "Moon altitude")</li><li data-s="0"><i class="band" style="background:color-mix(in srgb, var(--sun) 18%, transparent)"></i>$lt("Astro", "Daylight")</li><li class="lg-note">$lt("Astro", "● current position · grey line: horizon")</li></ul>
          </div>
          <!-- course du soleil dans le ciel : direction (azimut) et hauteur (astro.js) -->
          <div class="astro-pane" id="astro-path-pane">
          <div class="sunpath" id="astro-path" role="img" aria-label="$lt("Astro", "Sun path in the sky")"></div>
          <p class="sp-note" id="astro-path-note"></p>
          <ul class="legend sp-legend">
            <li><svg viewBox="0 0 30 12" aria-hidden="true"><rect width="30" height="12" rx="3" class="sp-sky"/><path d="M4 6H26" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/></svg>$lt("Astro", "Sun today")</li>
            <li><svg viewBox="0 0 30 12" aria-hidden="true"><rect width="30" height="12" rx="3" class="sp-sky"/><path d="M4 6H26" stroke="#ffc46b" stroke-width="2" stroke-dasharray="4 3"/></svg>$lt("Astro", "Moon, from rise to set")</li>
            <li><svg viewBox="0 0 30 12" aria-hidden="true"><rect width="30" height="12" rx="3" class="sp-sky"/><path d="M4 6H12" stroke="#8fdc57" stroke-width="2"/><path d="M12 6H19" stroke="#86d6f7" stroke-width="2"/><path d="M19 6H26" stroke="#f07ac8" stroke-width="2"/></svg><span id="astro-path-seasons"></span></li>
            <li class="lg-note">$lt("Astro", "direction at the bottom, altitude on the left")</li>
          </ul>
          </div>
        </div>
      </div>
    </article>
  </section>
