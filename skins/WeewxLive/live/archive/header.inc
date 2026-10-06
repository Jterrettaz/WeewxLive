## weewx-live : en-tête des pages d'archives (jour, mois, année) : marque, menu, sélecteur de
## date (archive.js) et navigation période précédente / suivante. Variable $a = $livejson_arch.
#set $prev_txt = {'day': '‹ Veille', 'month': '‹ Mois précédent', 'year': '‹ Année précédente'}[$a.kind]
#set $next_txt = {'day': 'Lendemain ›', 'month': 'Mois suivant ›', 'year': 'Année suivante ›'}[$a.kind]
#include "live/archive/brand.inc"

  <!-- sélecteur de date : page du jour, du mois ou de l'année contenant la date choisie -->
  <form class="arch-bar" id="arch-bar" data-first="$a.first" data-today="$a.today" data-day-first="$a.dayFirst" onsubmit="return false">
    <label for="arch-date">Historique de la station — choix de la date :</label>
    <input type="date" id="arch-date" value="$a.iso" min="$a.first" max="$a.today" required>
    <span class="arch-see">voir</span>
#if $a.day
    <button type="button" data-kind="day"#if $a.kind == 'day'# aria-current="page"#end if#>Jour</button>
#end if
#if $a.month
    <button type="button" data-kind="month"#if $a.kind == 'month'# aria-current="page"#end if#>Mois</button>
#end if
#if $a.year
    <button type="button" data-kind="year"#if $a.kind == 'year'# aria-current="page"#end if#>Année</button>
#end if
    <span class="arch-msg" id="arch-msg" role="status" aria-live="polite"></span>
  </form>

  <nav class="day-nav" aria-label="Périodes">
#if $a.prev
    <a class="day-prev" href="$a.prev" rel="prev">$prev_txt</a>
#else
    <span class="day-prev" aria-hidden="true"></span>
#end if
    <h2 class="day-title">$a.label</h2>
#if $a.next
    <a class="day-next" href="$a.next" rel="next">$next_txt</a>
#else
    <span class="day-next" aria-hidden="true"></span>
#end if
  </nav>
#if $a.kind == 'month' and $a.climato
  <p class="arch-links"><a href="climato-${a.ym}.html">Tableau climatologique du mois ›</a></p>
#end if
