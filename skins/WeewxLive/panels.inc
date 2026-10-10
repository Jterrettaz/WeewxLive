## weewx-live : panneaux des paramètres (tableau de bord et pages « jour »)
## Variable $day_page (#set global avant l'#include) : vrai sur une page « jour »
## Panneaux : un par paramètre de skin.conf [[parameters]], dans l'ordre configuré.
## Paramètres standard : panneau spécialisé ; autres : panneau générique (min-max, max, sum).
## $hrs : fenêtre des graphiques et cumuls glissants ([LiveJSON] hours ; 24 h sur une page « jour »)
#set $hrs = 24 if $day_page else $livejson_hours
#for $p in $livejson_params
#if $p.builtin and $p.id == "outTemp"
    <!-- Température -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="outTemp" style="--c: var(--temp)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="outTemp" href="detail.html?p=outTemp">$p.title</a></h2><span class="hint">#if $day_page#moyenne du jour#else#extérieure#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="°C">°C</span></div>
#if not $day_page
#if $livejson_temp_deltas
        <p class="aux" title="Écart avec la température d'il y a 1 h et 24 h (* : estimé d'après l'historique)">Sur 1 h <b data-k="d1h">--</b><span class="aux-sep">·</span>Sur 24 h <b data-k="d24h">--</b></p>
#end if
        <p class="aux frost" data-k="frostRow" hidden title="Temps écoulé depuis la dernière mesure à 0 °C ou plus">Durée du gel en cours : <b data-k="frost">--</b></p>
#end if
        <dl class="ext">
          <div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="outTemp" role="img" aria-label="Température #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "wind"
    <!-- Vent -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="wind" style="--c: var(--wind)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="wind" href="detail.html?p=wind">$p.title</a></h2><span class="hint">#if $day_page#moyen du jour · direction dominante#else#moyen · rafales#end if#</span></header>
        <div class="now">
          <span class="val" data-k="value">--</span><span class="unit" data-ubase="km/h">km/h</span>
          <span class="side">
            <svg class="compass" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" class="ring"/>
              <text x="20" y="8.5" class="cardinal">N</text>
              <g class="needle" data-k="needle"><path d="M20 6 L25 26 L20 22 L15 26 Z"/></g>
            </svg>
            <span class="dir"><b data-k="dirTxt">--</b><small data-k="dirDeg"></small></span>
          </span>
        </div>
#if not $day_page
        <p class="aux">Rafale <b data-k="gust">--</b> <span data-ubase="km/h">km/h</span></p>
#end if
        <dl class="ext">
          <div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
          <div><dt>Rafale max</dt><dd><b data-k="gustMax">--</b><small data-k="gustMaxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="wind" role="img" aria-label="Vent #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
        <ul class="legend"><li><i style="background:var(--wind)"></i>Vent moyen</li><li><i style="background:var(--gust)"></i>Rafales</li></ul>
      </div>
    </article>
#elif $p.builtin and $p.id == "windDir"
    <!-- Direction du vent -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="windDir" style="--c: var(--wind)">
      <div class="card-main">
        <header><h2>$p.title</h2><span class="hint">#if $day_page#vent dominant du jour#else#$hrs dernières heures#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-k="deg"></span></div>
        <p class="aux">Dominante <b data-k="dominant">--</b><span class="aux-sep">·</span>Calme <b data-k="calm">--</b></p>
        <div class="rose-row">
          <svg class="rose" id="rose" viewBox="-110 -110 220 220" role="img" aria-label="Rose des vents #if $day_page#sur la journée#else#sur $hrs heures#end if#"></svg>
          <ul class="rose-legend" aria-label="Classes de vitesse de la rose des vents">
            <li><i style="background:var(--ws4)"></i>≥ <span data-uval="30|km/h">30</span> <span data-ubase="km/h">km/h</span></li>
            <li><i style="background:var(--ws3)"></i><span data-uval="20|km/h">20</span>–<span data-uval="30|km/h">30</span></li>
            <li><i style="background:var(--ws2)"></i><span data-uval="10|km/h">10</span>–<span data-uval="20|km/h">20</span></li>
            <li><i style="background:var(--ws1)"></i>&lt; <span data-uval="10|km/h">10</span></li>
            <li class="note">Part du temps par direction ; calme : &lt; <span data-uval="1|km/h">1</span> <span data-ubase="km/h">km/h</span></li>
          </ul>
        </div>
      </div>
      <div class="card-side">
        <div class="mini-label">Direction relevée (un point par mesure)</div>
        <div class="chart dir-chart" data-chart="windDir" role="img" aria-label="Direction du vent #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "rain"
    <!-- Pluie -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="rain" style="--c: var(--rain)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="rain" href="detail.html?p=rain">$p.title</a></h2><span class="hint">cumul du jour</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="mm">mm</span></div>
#if not $day_page
        <p class="aux">Intensité <b data-k="rate">--</b> <span data-ubase="mm/h">mm/h</span></p>
#end if
        <dl class="ext">
          <div><dt>Intensité max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
          <div><dt>Cumul $hrs h</dt><dd><b data-k="sum24">--</b><small data-ubase="mm">mm</small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="rain" role="img" aria-label="Pluie horaire et cumul #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
        <ul class="legend"><li><i style="background:var(--rain)"></i>Pluie horaire</li><li><i style="background:var(--rainsum)"></i>Cumul $hrs h (échelle de droite)</li></ul>
      </div>
    </article>
#elif $p.builtin and $p.id == "outHumidity"
    <!-- Humidité -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="outHumidity" style="--c: var(--hum)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="outHumidity" href="detail.html?p=outHumidity">$p.title</a></h2><span class="hint">#if $day_page#moyenne du jour#else#extérieure#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit">%</span></div>
        <dl class="ext">
          <div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="outHumidity" role="img" aria-label="Humidité #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "barometer"
    <!-- Pression -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="barometer" style="--c: var(--press)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="barometer" href="detail.html?p=barometer">$p.title</a></h2><span class="hint">#if $day_page#niveau de la mer · moyenne du jour#else#niveau de la mer#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="hPa">hPa</span></div>
#if not $day_page
        <p class="aux">Tendance 3 h <b data-k="trend">--</b></p>
#end if
        <dl class="ext">
          <div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="barometer" role="img" aria-label="Pression #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
      </div>
    </article>
#elif $p.type == "group"
    <!-- $p.title (panneau groupé : $len($p.members) mesures, agrégat $p.aggregate) -->
    <article#if $p.admin# data-admin="1"#end if# class="card group-card" data-param="$p.id" data-generic="1" data-group="1" style="--c: var($p.members[0].color)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="$p.id" href="detail.html?p=$p.id_url">$p.title</a></h2><span class="hint">$p.hint</span></header>
        <table class="gtab">
          <thead><tr><th scope="col"><span class="sr">Mesure</span></th><th scope="col">#if $day_page#Moyenne#else#Actuel#end if#</th>#if $p.aggregate == "min-max"#<th scope="col">Min</th><th scope="col">Max</th>#else#<th scope="col">Max du jour</th>#end if#</tr></thead>
          <tbody>
#for $m in $p.members
            <tr>
              <th scope="row"><i class="sw" style="background:var($m.color)"></i>$m.title</th>
              <td class="gnow"><b data-k="$m.id:value">--</b><small data-ubase="$m.unit">$m.unit</small></td>
#if $p.aggregate == "min-max"
              <td><b data-k="$m.id:min">--</b><small data-k="$m.id:minTime"></small></td>
#end if
              <td><b data-k="$m.id:max">--</b><small data-k="$m.id:maxTime"></small></td>
            </tr>
#end for
          </tbody>
        </table>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="$p.key" role="img" aria-label="$p.title #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
        <ul class="legend">#for $m in $p.members#<li><i style="background:var($m.color)"></i>$m.title</li>#end for#</ul>
      </div>
    </article>
#else
    <!-- $p.title (paramètre ajouté : agrégat $p.aggregate) -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="$p.id" data-generic="1" style="--c: var($p.color)">
      <div class="card-main">
        <header><h2><a class="more" data-detail="$p.id" href="detail.html?p=$p.id_url">$p.title</a></h2><span class="hint">#if $day_page and $p.aggregate != "sum"##if $p.hint#$p.hint · #end if#moyenne du jour#else#$p.hint#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="$p.unit">$p.unit</span></div>
        <dl class="ext">
#if $p.aggregate == "min-max"
          <div><dt>Min</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>Max</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
#elif $p.aggregate == "max"
          <div><dt>Max du jour</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
#else
          <div><dt>Cumul $hrs h</dt><dd><b data-k="sum24">--</b><small data-ubase="$p.unit">$p.unit</small></dd></div>
#end if
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="$p.key" role="img" aria-label="$p.title #if $day_page#sur la journée#else#sur $hrs heures#end if#"></div>
#if $p.aggregate == "sum"
        <ul class="legend"><li><i style="background:var($p.color)"></i>Cumul horaire</li><li><i style="background:var(--text-2)"></i>Cumul $hrs h (échelle de droite)</li></ul>
#end if
      </div>
    </article>
#end if

#end for
