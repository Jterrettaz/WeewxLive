# Change log — weewx-live

*Version française : [changelog.fr.md](changelog.fr.md).*

Summary of the changes in each version, from the most recent to the oldest (since version
1.49). Skipped numbers are cancelled versions (see the end of the list).

## 2.15

- **"About" menu and page** (`[LiveJSON] [[about]]`, disabled by default): `enable = true`
  adds an "About" menu entry (last of the menu, on all pages) opening `about.html`, or another
  page with `page = …`. `about.html` is an example to adapt (station, equipment, position,
  site, contact), in French and English (the version of the site language is shown), with
  fields filled from the configuration (`data-cfg`: station name, equipment, latitude,
  longitude); menu, logo and common footer as on the other pages.
- Reinstalling replaces `about.html`: keep a copy of your version (see README).

## 2.14

- Archive pages, date picker: **calendar in the site language**. The browser's native date
  picker followed the browser language, not the page language (French day and month names on
  an English site, for example). It is replaced by a button showing the date in words and a
  calendar whose month and day names follow the page language (`intl_locale`); first day of the
  week Monday (Sunday in US English). Dates outside the archives are disabled; keyboard: arrows,
  Page Up / Page Down (month), Home / End, Esc; double click on a day opens the page of the
  same type.
- Also applies to archive pages already generated (`archive.js` is copied at each archive).

## 2.13

- **Common footer on all pages** (`[LiveJSON] [[footer]]`), below each page's own footer:
  station (`station`, otherwise the station name) and weewx software with its version
  (`software`), disclaimer (`disclaimer_title`, paragraphs `disclaimer_1`, `disclaimer_2`…
  in the order of their number, line after the first one), final warning in bold
  (`warning`), copyright and contact address (`copyright`, `email`, `email_label`).
  `enable = false`: no footer.
- Rendered by `nav.js` from `config.json`: also shown on archive pages generated before this
  version. Texts shown as plain text, whatever the page language.

## 2.12

- **Change log in English**: `changelog.md` is now in English, the French version becomes
  `changelog.fr.md`; link to the other language at the top of each file. Both are kept up to
  date at each version.

## 2.11

- **Weather warnings: United States and Canada.** New `source` option for a location of
  `[[meteoalarm]]`: `meteoalarm` (default, Europe), `nws` (National Weather Service,
  `api.weather.gov/alerts/active`, query by point or by NWS zones with `region`) or `eccc`
  (Environment and Climate Change Canada, `weather-alerts` collection of MSC GeoMet, point
  inside the alert regions). Same pills, same "Weather warnings" page; locations of different
  sources are mixed and grouped.
- NWS levels: Advisory / Watch yellow, Warning orange, Emergency or Extreme severity red;
  ECCC: risk colour of the alert. Statements are not shown. Replaced, cancelled, ended or
  expired alerts: ignored.
- Two new phenomenon types: tornado and tropical cyclone (hurricane, tropical storm);
  phenomenon recognition keywords extended to the English NWS / ECCC names ("Winter Storm",
  "Wind Chill", "Red Flag", "Storm Surge"…), matched at the start of a word.
- "Weather warnings" page: footer giving the sources used.
- New texts in the 4 language files; README (English and French) and `skin.conf` /
  `skin.fr.conf` completed.

## 2.10

- **Documentation in English by default**: `README.md` is now in English (formerly
  `README.eng.md`), the French version becomes `README.fr.md`; link to the other language at
  the top of each file. `skin.conf` has English comments (formerly `skin.en.conf`), the copy
  with French comments becomes `skins/WeewxLive/skin.fr.conf` (not read by weewx). Settings
  unchanged, including the page language (`lang = fr`).
- Update: reinstalling replaces `skin.conf` with the English version and adds
  `skin.fr.conf`; the old `skin.en.conf` can be deleted.

## 2.09

- Dashboard, warning pills: locations with the same warning (same level, same phenomenon)
  are grouped in a single pill, e.g. "Thunderstorms (Sciez, Aosta Valley)" in yellow instead
  of two pills. Tooltip: end of the warning for each location. Link to the location's
  section if there is only one, otherwise to the top of the "Weather warnings" page.

## 2.08

- "Weather warnings" page: the pill at the top of each warning also gives the location
  (`title` of the location in `[[meteoalarm]]`), e.g. "Orange warning · Sciez", to identify
  the location concerned without scrolling back to its section header.

## 2.07

- Weather warnings: new level colours, yellow `#f9e400`, orange `#f7a401`, red `#e71919`
  (dashboard pills, "Weather warnings" page). Dark text on yellow and orange, white on red
  (contrast ≥ 4.5:1).

## 2.06

- **MeteoAlarm weather warnings** (EUMETNET): new section `[LiveJSON] [[meteoalarm]]`, one or
  more locations, possibly in different countries (`country`: English name or ISO code;
  location identified by `region` = NUTS3 / EMMA_ID area code, `area` = area name, or
  `latitude` / `longitude` inside the area polygons, otherwise the station coordinates).
  weewx downloads the feed of each country at most every 5 minutes (`cache`) and publishes
  `data/warnings.json`; the pages re-read it every 5 minutes.
- **Dashboard**: pills of the warnings in force (yellow, orange, red) at the top of the
  page, one per location and per phenomenon (several levels possible at the same time);
  nothing when there is no warning.
- **"Weather warnings" page** (`vigilance.html`, "Forecasts" menu, opened by a click on a
  pill): for each location, warnings in progress and upcoming with level, phenomenon, period,
  description, instructions, area, issuer, severity / certainty / urgency and link to the
  weather service; meaning of the levels.
- Expired, cancelled or replaced warnings: ignored. Phenomenon type derived from the name when
  the feed does not give it (MeteoSwiss). Texts in the page language if the feed provides
  it, otherwise in English.
- New texts (`[[Warnings]]` context, "Weather warnings" menu entry) in the 4 language files.

## 2.05

- **Fix for weewx 5.0 to 5.3** (e.g. 5.3.1): the `LiveCheetahGenerator` generator did not load
  ("ImportError: cannot import name 'getFileName' from 'weeutil.weeutil'") and the WeewxLive
  report was not produced. `getFileName` only exists since weewx 5.4: livejson.py now contains
  a copy of it, used when weewx does not provide it.

## 2.04

- Dashboard, **Forecasts**: days without data are no longer shown. Beyond their range
  (Météo-France, MeteoSwiss ICON… 4 to 5 days), some models return empty values: only the
  available days appear, across the full width of the block, and the title gives their number
  ("4-day forecast"). The hour-by-hour detail of a day missing from the new model closes; a
  model without any data shows "Forecasts unavailable for this model (empty response)".

## 2.03

- **"Day" archive pages disabled by default**: `[[archives]] day = false` in `skin.conf` (one
  page per day of the database made the first generation long and the first FTP upload
  large). The "Archives" entry then opens the page of the current month, the date picker
  offers "Month" and "Year", the monthly climatological table no longer links to the days. To
  keep them: `day = true`, preferably in `weewx.conf` (`[[WeewxLive]]` → `[[[LiveJSON]]]` →
  `[[[[archives]]]]`), otherwise the update disables them. Pages already generated stay in
  place.
- README (French and English): new section "Setting the language in `skin.conf`" (weewx
  priorities, steps, effect of updates).

## 2.02

- **Documentation in English** included in the extension: `README.eng.md` (translation of the
  README) and `skins/WeewxLive/skin.en.conf` (copy of `skin.conf` with translated comments,
  identical settings; not read by weewx, to be renamed `skin.conf` to use it). Kept up to date
  at each version, like the README and `skin.conf`.
- `skin.conf`: comment of the `lang` option completed (de, it).

## 2.01

- **Pages in German and Italian**: new files `lang/de.conf` and `lang/it.conf` (same keys as
  `fr.conf` and `en.conf`), chosen with `lang = de` or `lang = it` in `[StdReport]
  [[WeewxLive]]`. Numbers and dates `de-DE` / `it-IT`, wind directions, moon phases,
  measurement titles, forecast weather, Blitzortung map in the language. Suggested
  translations, to be reviewed.

## 2.00

- **Units of extra parameters** configurable in `skin.conf`, with weewx unit names: section
  `[LiveJSON] [[unit_groups]]` (one unit per weewx group, e.g. `group_distance = mile`) and
  `units` option of a parameter or grouped panel (takes precedence). Values converted by
  weewx, displayed label derived from the unit; `unit` remains a label only. Configurable
  groups: distance, energy, degree days, durations, pressure change.
- Standard parameters and groups converted in the browser (temperature, speed, rain, rate,
  pressure, altitude, length): metric publication unchanged, default units still set by
  `[[units]]`; `units` or `[[unit_groups]]` on these groups: ignored, message in the log.
- Invalid settings (unknown group or unit, unit not belonging to the group): ignored, message
  in the weewx log.

## 1.99

- "Day" archive pages: collapsed / expanded panels remembered **separately from the
  dashboard**, with a single state for all "day" pages (browser key
  `weewx-live:compact-day`). Collapsing a panel on one day collapses it on all the others,
  without changing the dashboard, and vice versa.
- Choices already remembered for the dashboard are kept; on "day" pages, all panels start
  expanded again (default value) until the first choice.

## 1.98

- **Pages in several languages**, following the weewx guidelines: texts in the skin's `lang/`
  folder, one file per language — `fr.conf` (French) and `en.conf` (English, suggested
  translation); language chosen with the report's `lang` option. The installer adds
  `lang = fr` to `weewx.conf` `[StdReport] [[WeewxLive]]` (takes precedence over
  `[[Defaults]] lang = en` of the weewx 5 `weewx.conf`); `skin.conf`: `lang = fr`.
- Everything is translated: templates (`$lt`), scripts (`i18n.js`, generated:
  `window.WXL`), Python module (archive page titles, month and day names, moon phases, model
  and country names, published error messages). Numbers and dates according to the language
  (`intl_locale`), wind directions and forecast weather translated, Blitzortung map in the
  chosen language.
- Pages `detail`, `extremes`, `ensembles`, `meteogram`, `units`, `admin` and `webcam`:
  templates (`*.html.tmpl`, generated at each archive) instead of copied files.
- Parameter titles: without `title`, the language's one (`[Labels] [[Generic]]`);
  `skin.conf` no longer sets the titles of the 6 standard parameters. EUMETSAT satellite
  layers without a label: translated label.
- Archive pages generated before 1.98: `i18n.js` loaded by `nav.js` (texts in the chosen
  language). Texts missing from a language file: English key shown, list in
  `window.WXL_MISSING`.
- In French, pages identical to 1.97.

## 1.97

- Archive pages ("day", "month", "year"): panel and section titles as plain text, without a
  link to `detail.html` (pages of the current period). The dashboard and the period pages
  keep their links; common menu unchanged.
- Archive pages already generated: unchanged until they are regenerated (delete the
  `archive/` folder of `HTML_ROOT` to rebuild them).

## 1.95

- New **"Webcam"** page (`webcam.html`, `webcam.js`, "Webcam" menu): images and videos one
  below the other, configured in `[[webcam]]` (one subsection per item: `url`, `title`,
  `caption`, `type`, `admin`, `refresh`, `autoplay`, `enable`).
- `admin = true`: item shown only in admin mode; "Webcam" menu only if the visitor can see at
  least one item.
- Images reloaded periodically without flicker, time of the last load, full-size view;
  "unavailable" message if the file is missing.

## 1.94

- **"Lightning"** menu: opens in a new tab the Blitzortung map centred on the station
  (`https://maps.blitzortung.org/fr/#7/<latitude>/<longitude>`), on all pages. Section
  `[[lightning]]` (`enable`, `zoom`); coordinates from `[Station]` or `[[forecast]]`.

## 1.93

- **Clickable legends** on charts with several curves: a click (or Enter / Space) on a legend
  item hides the curve, a second one shows it again (item struck through and greyed).
  Temporary hiding, until the page is reloaded.
  - Dashboard and "day" pages: wind (mean / gusts), rain (hourly / total), grouped panels (one
    measurement), generic totals; "Sun and Moon" (sun, moon, daytime).
  - Detail, period, "month" and "year" pages: each curve of the legend.
  - Ensembles: a model (its members), combined mean, 10–90 % band, rain series.
  - Meteogram: precipitation, showers, total; snow; clouds, isotherm; temperature, isotherm
    and wind aloft; mean wind, gusts, direction.
- Hidden curves leave the scale (e.g. gusts hidden: axis adjusted to the mean wind) and the
  tooltip.
- `minichart.js`: `MiniChart.linkLegend(ul, chart)`, `data-s` attribute of legend items
  (series indices).

## 1.92

- Dashboard: panels **collapsed by default**. A new visitor sees all panels collapsed; a
  parameter added in `skin.conf` appears collapsed, including for visitors who already chose
  "Expand all". Remembered choices (panel expanded or collapsed) are kept; "day" pages: panels
  always expanded by default.

## 1.91

- **Admin mode**: `admin = true` option of a parameter or grouped panel of `[[parameters]]`;
  this parameter is only shown in admin mode (dashboard and "Rearrange" list, "day" pages,
  detail, period, "month" and "year" pages, "Data" menu).
- New **"Settings → Admin"** page (`admin.html`, `admin.js`): entry of the password,
  remembered by the browser, and "Leave admin mode" button; "Admin (active)" menu.
- Password in `[LiveJSON] [[admin]] password`; only its SHA-256 hash is published
  (`window.WX_ADMIN` in `wxtime.js`). Hash also computed without `crypto.subtle` (page served
  over http on the local network).
- Simple hiding on display: the data stay in the published files and in MQTT.

## 1.90

- `skin.conf`: `[[units]]` section shipped with the metric units, each option followed by the
  list of possible units; `kmh` accepted for `km/h`.

## 1.89

- **Display units**: `[LiveJSON] [[units]]` chooses the site's default units (temperature
  °C/°F, wind km/h, m/s, mph, kn, rain mm/in, rate mm/h, in/h, pressure hPa, inHg, mmHg, kPa,
  altitude m/ft, snow cm/in). Data stay metric; conversion happens on display on all pages
  (values, charts, tooltips, climatological tables, records, forecasts, ensembles, meteogram).
- New **"Settings → Units"** menu (`units.html`): each visitor chooses their units, remembered
  by their browser.
- Windy map shown in the chosen units.

## 1.88

- Climatological tables: **provisional values** marked (italics and asterisk, time when the
  value becomes final in the tooltip) as long as the day's window is not closed — Tn until
  18:00 UTC, Tx and rain until 06:00 UTC the next day (`omm` method); midnight (`civil`
  method). Yearly table: current month (and "Year" row) provisional until its last day is
  closed.
- `omm` method: the table of the month (or year) that has just ended is regenerated once after
  the 1st at 06:00 UTC, to record the final values of its last day.

## 1.87

- Addition of this change log (`changelog.md`), kept up to date at each version.

## 1.86

- **Climatological tables according to the WMO hourly rules** (option):
  `[[archives]] climato_method = civil | omm`.
  - `omm` (UTC hours): Tn of day D from D-1 18:00 to D 18:00; Tx and rain from D 06:00 to
    D+1 06:00; mean temperature = mean of the 8 three-hourly readings (00, 03 … 21:00); wind,
    humidity and pressure stay from 0:00 to 24:00.
  - Computed on the archive records (`lowOutTemp` / `highOutTemp` columns if they exist,
    otherwise `outTemp`); monthly and yearly tables (frost, rain days… counted on these same
    values).
  - `civil` (default): days from 0:00 to 24:00, unchanged. Method recalled below each table.

## 1.85

- `[[mqtt]] temp_deltas` option: `false` hides the "Over 1 h · Over 24 h" line of the
  Temperature panel and no longer reads `temp_1h_key` / `temp_24h_key`.

## 1.84

- Rain detail page, 7 days: the cumulative curve was missing (cut into isolated points).
  Total computed hour by hour; a cumulative curve is never interrupted any more (`maxGap`
  option per series in MiniChart).

## 1.83

- **Rain and total on two scales**: rain bars on the left, total on the right (own scale,
  aligned with the grid). Dashboard, day pages, detail and archive pages, added parameters of
  total type.

## 1.82

- `[LiveJSON] hours` finally applies to the dashboard charts (the page always showed 24 h):
  charts, wind rose and rolling totals ("Total … h"). Day pages: unchanged (midnight to
  midnight).

## 1.81

- Temperature (°C) curves of **grouped panels** (e.g. soil temperature) coloured according to
  the temperature scale, distinguished by the line (solid, dashed, dotted); unit "°C" also
  recognised with a space.

## 1.80

- Dashboard: **expanded panels first**, collapsed panels grouped below.

## 1.79

- Dashboard panel charts reduced to **184 px** high (150 px on mobile).

## 1.77

- Meteogram: larger and thicker wind direction arrows, with an outline to stay readable over
  the curves.

## 1.74

- Day pages: "‹ Previous day" / "Next day ›" links (instead of "Day before" / "Day after").

## 1.73

- Day pages: daily mean also for humidity, pressure and added parameters (except totals,
  groups included); pressure trend and instantaneous rain rate removed.

## 1.72

- Day pages: **daily mean** temperature and wind instead of the last reading; direction:
  **prevailing wind of the day** (most frequent sector); 1 h / 24 h changes and instantaneous
  gust removed.

## 1.71

- Fix of the "WXT is not defined" error on archive pages generated before 1.68: date
  functions moved to `nav.js`; `wxtime.js` now only provides the time zone.

## 1.70

- Solar radiation is no longer a standard parameter (6 standard panels); it remains possible
  as an added parameter (commented example in `skin.conf`).

## 1.69

- Temperature panel: blue line **"Current frost duration"** when the temperature is negative
  (start of the frost looked up in the whole archive, updated every second and via MQTT).

## 1.68

- **Station time on all pages**, whatever the visitor's time zone (time zone detected on the
  weewx system, or `[LiveJSON] timezone`); Open-Meteo queried in that time zone.
- Meteogram: `top_humidity` option renamed `top_clouds` (the old name is still accepted).

## 1.67

- Complete review of the code and comments: fixes (panel order, forecast responses arriving
  out of order, members of 3 h / 6 h models in Ensembles, day page at midnight, invalid
  horizons, rain threshold), optimisations (common Open-Meteo function, caches); README with
  table of contents and option ranges.

## 1.66

- Configurable basemap for the RainViewer / EUMETSAT maps (`[[basemap]]`: osm by default,
  esri, opentopomap, carto with API key).

## 1.65

- Dashboard: frames and panels **can be hidden** by the visitor (remembered by the browser).

## 1.64

- Dashboard: measurement panels can be rearranged by the visitor.

## 1.63

- Dashboard: configurable frame order (`[[dashboard]] order`), rearrangeable by the visitor;
  "Sun and Moon" placed after the radar and satellite maps.

## 1.62

- Meteogram: model list above the information line, without repeating the model name.

## 1.61

- Ensembles: 10-day horizon and one point per hour by default.

## 1.59

- Dashboard: choice of the forecast model (5 Open-Meteo models).

## 1.58

- Meteogram: rain total curve and choice among 5 models.

## 1.57

- Meteogram: cloud cover only (upper-air relative humidity removed).

## 1.56

- **"Meteogram"** page (Open-Meteo, ground and upper air), "Forecasts" menu; shared weather
  icons (`wxicons.js`).

## 1.55

- Skin files at the root of `skins/WeewxLive` (no more `live/` subfolder); output folder of
  your choice (`HTML_ROOT`).

## 1.54

- Ensembles page: title "Forecasts - Ensembles".

## 1.53

- Ensembles: Open-Meteo model identifiers fixed (`ecmwf_ifs025`,
  `google_weathernext2_ensemble`…), old names converted automatically.

## 1.52

- Ensembles: a variable refused by a model is removed from the request; version shown.

## 1.51

- Ensembles: "Written analysis" section removed.

## 1.50

- Ensembles: range limited per model (error 400 from ECMWF / Google), reason of Open-Meteo
  errors shown.

## 1.49

- **"Forecasts - Ensembles"** page (Open-Meteo Ensemble API, configurable models), new
  "Forecasts" menu.

## Cancelled versions

- **1.60** (meteogram, reading of the old format): cancelled, back to 1.59.
- **1.75** and **1.76** (MQTT rain total, `rainDay` alias): cancelled, back to 1.74.
- **1.78** (meteoblue map widget): removed, back to 1.77.
- **1.96** (rain of each archive record on the 24 h, day and 7-day charts): removed, back to 1.95.
