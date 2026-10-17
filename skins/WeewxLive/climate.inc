## weewx-live : bloc « Ce jour et ce mois au fil des ans » du tableau de bord (climate.js)
  <section class="wide climate" id="climate" hidden aria-label="$lt("Dashboard", "This day and this month over the years")">
    <article class="card cl-card" id="cl-day">
      <header><h2 id="cl-day-title">$lt("Climate", "This day over the years")</h2></header>
      <p class="cl-since"></p>
      <div class="cl-text" id="cl-day-text"></div>
      <h3 class="cl-h" id="cl-day-th">$lt("Climate", "Temperatures")</h3>
      <div class="chart cl-chart" id="cl-day-temp" role="img" aria-label="$lt("Climate", "Temperatures over the years")"></div>
      <ul class="legend"><li><i class="hilo"></i>$lt("Common", "Min. – max.")</li><li><i class="midmark"></i>$lt("Climate", "Mean")</li><li class="cl-scale"></li></ul>
      <h3 class="cl-h" id="cl-day-rh">$lt("Climate", "Precipitation")</h3>
      <div class="chart cl-chart cl-chart-rain" id="cl-day-rain" role="img" aria-label="$lt("Climate", "Precipitation over the years")"></div>
    </article>
    <article class="card cl-card" id="cl-month">
      <header><h2 id="cl-month-title">$lt("Climate", "This month over the years")</h2></header>
      <p class="cl-since"></p>
      <div class="cl-text" id="cl-month-text"></div>
      <h3 class="cl-h" id="cl-month-th">$lt("Climate", "Temperatures")</h3>
      <div class="chart cl-chart" id="cl-month-temp" role="img" aria-label="$lt("Climate", "Temperatures over the years")"></div>
      <ul class="legend"><li><i class="hilo"></i>$lt("Common", "Min. – max.")</li><li><i class="midmark"></i>$lt("Climate", "Mean")</li><li class="cl-scale"></li></ul>
      <h3 class="cl-h" id="cl-month-rh">$lt("Climate", "Precipitation")</h3>
      <div class="chart cl-chart cl-chart-rain" id="cl-month-rain" role="img" aria-label="$lt("Climate", "Precipitation over the years")"></div>
    </article>
  </section>
