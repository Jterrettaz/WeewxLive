## weewx-live : panneaux des paramètres (tableau de bord et pages « jour »)
## Variable $day_page (#set global avant l'#include) : vrai sur une page « jour »
## Panneaux : un par paramètre de skin.conf [[parameters]], dans l'ordre configuré.
## Paramètres standard : panneau spécialisé ; autres : panneau générique (min-max, max, sum).
## Titre lien vers la page de détail sur le tableau de bord ; texte simple sur une page « jour ».
## $hrs : fenêtre des graphiques et cumuls glissants ([LiveJSON] hours ; 24 h sur une page « jour »)
#set $hrs = 24 if $day_page else $livejson_hours
## fin des descriptions des graphiques : « sur la journée » / « sur 24 heures »
#set $span_txt = $lt("Panels", "over the day") if $day_page else $lt("Panels", "over {hours} hours", hours=$hrs)
#for $p in $livejson_params
#if $p.builtin and $p.id == "outTemp"
    <!-- Température -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="outTemp" style="--c: var(--temp)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="outTemp" href="detail.html?p=outTemp">$p.title</a>#end if#</h2><span class="hint">#if $day_page#$lt("Panels", "daily mean")#else#$lt("Panels", "outside")#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="°C">°C</span></div>
#if not $day_page
#if $livejson_temp_deltas
        <p class="aux" title="$lt("Panels", "Change from the temperature 1 h and 24 h ago (*: estimated from history)")">$lt("Panels", "Over 1 h") <b data-k="d1h">--</b><span class="aux-sep">·</span>$lt("Panels", "Over 24 h") <b data-k="d24h">--</b></p>
#end if
        <p class="aux frost" data-k="frostRow" hidden title="$lt("Panels", "Time since the last reading at 0 °C or above")">$lt("Panels", "Current frost duration:") <b data-k="frost">--</b></p>
#end if
        <dl class="ext">
          <div><dt>$lt("Common", "Min")</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>$lt("Common", "Max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="outTemp" role="img" aria-label="$lt("Menu", "Temperature") $span_txt"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "wind"
    <!-- Vent -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="wind" style="--c: var(--wind)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="wind" href="detail.html?p=wind">$p.title</a>#end if#</h2><span class="hint">#if $day_page#$lt("Panels", "daily mean · prevailing direction")#else#$lt("Panels", "mean · gusts")#end if#</span></header>
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
        <p class="aux">$lt("Panels", "Gust") <b data-k="gust">--</b> <span data-ubase="km/h">km/h</span></p>
#end if
        <dl class="ext">
          <div><dt>$lt("Common", "Min")</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>$lt("Common", "Max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
          <div><dt>$lt("Panels", "Max gust")</dt><dd><b data-k="gustMax">--</b><small data-k="gustMaxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="wind" role="img" aria-label="$lt("Menu", "Wind") $span_txt"></div>
        <ul class="legend"><li><i style="background:var(--wind)"></i>$lt("Panels", "Mean wind")</li><li><i style="background:var(--gust)"></i>$lt("Panels", "Gusts")</li></ul>
      </div>
    </article>
#elif $p.builtin and $p.id == "windDir"
    <!-- Direction du vent -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="windDir" style="--c: var(--wind)">
      <div class="card-main">
        <header><h2>$p.title</h2><span class="hint">#if $day_page#$lt("Panels", "prevailing wind of the day")#else#$lt("Panels", "last {hours} hours", hours=$hrs)#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-k="deg"></span></div>
        <p class="aux">$lt("Panels", "Prevailing") <b data-k="dominant">--</b><span class="aux-sep">·</span>$lt("Panels", "Calm") <b data-k="calm">--</b></p>
        <div class="rose-row">
          <svg class="rose" id="rose" viewBox="-110 -110 220 220" role="img" aria-label="$lt("Panels", "Wind rose") $span_txt"></svg>
          <ul class="rose-legend" aria-label="$lt("Panels", "Wind rose speed classes")">
            <li><i style="background:var(--ws4)"></i>≥ <span data-uval="30|km/h">30</span> <span data-ubase="km/h">km/h</span></li>
            <li><i style="background:var(--ws3)"></i><span data-uval="20|km/h">20</span>–<span data-uval="30|km/h">30</span></li>
            <li><i style="background:var(--ws2)"></i><span data-uval="10|km/h">10</span>–<span data-uval="20|km/h">20</span></li>
            <li><i style="background:var(--ws1)"></i>&lt; <span data-uval="10|km/h">10</span></li>
            <li class="note">$lt("Panels", "Share of time by direction; calm: <") <span data-uval="1|km/h">1</span> <span data-ubase="km/h">km/h</span></li>
          </ul>
        </div>
      </div>
      <div class="card-side">
        <div class="mini-label">$lt("Panels", "Measured direction (one dot per reading)")</div>
        <div class="chart dir-chart" data-chart="windDir" role="img" aria-label="$lt("Panels", "Wind direction") $span_txt"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "rain"
    <!-- Pluie -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="rain" style="--c: var(--rain)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="rain" href="detail.html?p=rain">$p.title</a>#end if#</h2><span class="hint">$lt("Panels", "today's total")</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="mm">mm</span></div>
#if not $day_page
        <p class="aux">$lt("Panels", "Rate") <b data-k="rate">--</b> <span data-ubase="mm/h">mm/h</span></p>
#end if
        <dl class="ext">
          <div><dt>$lt("Panels", "Max rate")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
          <div><dt>$lt("Panels", "Total {hours} h", hours=$hrs)</dt><dd><b data-k="sum24">--</b><small data-ubase="mm">mm</small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="rain" role="img" aria-label="$lt("Panels", "Hourly rain and total") $span_txt"></div>
        <ul class="legend"><li><i style="background:var(--rain)"></i>$lt("Panels", "Hourly rain")</li><li><i style="background:var(--rainsum)"></i>$lt("Panels", "Total {hours} h (right scale)", hours=$hrs)</li></ul>
      </div>
    </article>
#elif $p.builtin and $p.id == "outHumidity"
    <!-- Humidité -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="outHumidity" style="--c: var(--hum)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="outHumidity" href="detail.html?p=outHumidity">$p.title</a>#end if#</h2><span class="hint">#if $day_page#$lt("Panels", "daily mean")#else#$lt("Panels", "outside")#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit">%</span></div>
        <dl class="ext">
          <div><dt>$lt("Common", "Min")</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>$lt("Common", "Max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="outHumidity" role="img" aria-label="$lt("Menu", "Humidity") $span_txt"></div>
      </div>
    </article>
#elif $p.builtin and $p.id == "barometer"
    <!-- Pression -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="barometer" style="--c: var(--press)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="barometer" href="detail.html?p=barometer">$p.title</a>#end if#</h2><span class="hint">#if $day_page#$lt("Panels", "sea level · daily mean")#else#$lt("Panels", "sea level")#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="hPa">hPa</span></div>
#if not $day_page
        <p class="aux">$lt("Panels", "3 h trend") <b data-k="trend">--</b></p>
#end if
        <dl class="ext">
          <div><dt>$lt("Common", "Min")</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>$lt("Common", "Max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="barometer" role="img" aria-label="$lt("Menu", "Pressure") $span_txt"></div>
      </div>
    </article>
#elif $p.type == "group"
    <!-- $p.title (panneau groupé : $len($p.members) mesures, agrégat $p.aggregate) -->
    <article#if $p.admin# data-admin="1"#end if# class="card group-card" data-param="$p.id" data-generic="1" data-group="1" style="--c: var($p.members[0].color)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="$p.id" href="detail.html?p=$p.id_url">$p.title</a>#end if#</h2><span class="hint">$p.hint</span></header>
        <table class="gtab">
          <thead><tr><th scope="col"><span class="sr">$lt("Panels", "Measurement")</span></th><th scope="col">#if $day_page#$lt("Common", "Average")#else#$lt("Panels", "Current")#end if#</th>#if $p.aggregate == "min-max"#<th scope="col">$lt("Common", "Min")</th><th scope="col">$lt("Common", "Max")</th>#else#<th scope="col">$lt("Panels", "Today's max")</th>#end if#</tr></thead>
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
        <div class="chart" data-chart="$p.key" role="img" aria-label="$p.title $span_txt"></div>
        <ul class="legend">#for $m in $p.members#<li><i style="background:var($m.color)"></i>$m.title</li>#end for#</ul>
      </div>
    </article>
#else
    <!-- $p.title (paramètre ajouté : agrégat $p.aggregate) -->
    <article#if $p.admin# data-admin="1"#end if# class="card" data-param="$p.id" data-generic="1" style="--c: var($p.color)">
      <div class="card-main">
        <header><h2>#if $day_page#$p.title#else#<a class="more" data-detail="$p.id" href="detail.html?p=$p.id_url">$p.title</a>#end if#</h2><span class="hint">#if $day_page and $p.aggregate != "sum"##if $p.hint#$p.hint · #end if#$lt("Panels", "daily mean")#else#$p.hint#end if#</span></header>
        <div class="now"><span class="val" data-k="value">--</span><span class="unit" data-ubase="$p.unit">$p.unit</span></div>
        <dl class="ext">
#if $p.aggregate == "min-max"
          <div><dt>$lt("Common", "Min")</dt><dd><b data-k="min">--</b><small data-k="minTime"></small></dd></div>
          <div><dt>$lt("Common", "Max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
#elif $p.aggregate == "max"
          <div><dt>$lt("Panels", "Today's max")</dt><dd><b data-k="max">--</b><small data-k="maxTime"></small></dd></div>
#else
          <div><dt>$lt("Panels", "Total {hours} h", hours=$hrs)</dt><dd><b data-k="sum24">--</b><small data-ubase="$p.unit">$p.unit</small></dd></div>
#end if
        </dl>
      </div>
      <div class="card-side">
        <div class="chart" data-chart="$p.key" role="img" aria-label="$p.title $span_txt"></div>
#if $p.aggregate == "sum"
        <ul class="legend"><li><i style="background:var($p.color)"></i>$lt("Panels", "Hourly total")</li><li><i style="background:var(--text-2)"></i>$lt("Panels", "Total {hours} h (right scale)", hours=$hrs)</li></ul>
#end if
      </div>
    </article>
#end if

#end for
