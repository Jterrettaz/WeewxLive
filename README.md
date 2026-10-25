# weewx-live

Weather website for a **Davis Vantage Pro 2** station (or any station) run by **weewx**,
that can be published on **static** web hosting: the weewx server stays on the local network
and does not need to be reachable from the internet. Version 2.13.

**Requirements: weewx 4.6 or later** (weewx 4.6 to 4.10, weewx 5), under Python 3.

*Version française : [README.fr.md](README.fr.md).*

- **Dashboard**: for each configured parameter, current value, minimum and maximum of the
  day (with time) and a 24 h chart (duration adjustable: `hours`). Updated **in real time via
  MQTT**, or at **each weewx archive** if MQTT is disabled.
  - Specialised panels: temperature (change over 1 h and 24 h, current frost duration), wind
    (compass, gusts), wind direction (wind rose and 24 h direction chart), rain (hourly bars
    + cumulative curve, on a second scale on the right), humidity, pressure (3 h trend).
  - Extra parameters and **grouped panels** (e.g. particulate matter PM1 / PM2.5 / PM10).
  - Each panel can be **collapsed** (values only); expanded panels are shown first, collapsed
    panels are grouped below as tiles. The choice is remembered per panel in the browser;
    "Collapse all" / "Expand all". On the first visit to the dashboard, and for any parameter
    added later in `skin.conf`, panels are **collapsed** ("day" pages: expanded). "Day" pages
    have their own memory, shared by all days and separate from the dashboard's.
  - **Clickable legends**: on charts with several curves (dashboard, detail and archive
    pages, Sun and Moon, Ensembles, Meteogram), a click (or Enter) on a legend item hides the
    matching curve, a second click shows it again. The scale and tooltip adapt; everything
    reappears when the page is reloaded.
  - **Sun and Moon**: sunrise / sunset and moonrise / moonset, day length and change from the
    previous day, moon phase, altitude curves and current position.
  - **Open-Meteo forecasts** (7 days, hour-by-hour detail, choice of 5 models), **radar** and
    **satellite** (Windy maps, or RainViewer / EUMETSAT).
  - Frame order chosen by the administrator; each visitor can **rearrange** and **hide**
    frames and panels.
  - **This day and this month over the years**: records of each year for today's date and the
    current month, compared with current values.
- **One page per parameter** ("Data" menu or panel title): statistics and chart over
  **24 h, 7 days, 30 days, 365 days and 730 days**, one below the other.
- **One page per period** (top of the "Data" menu): last 24 hours, last 7, 30 and 365 days,
  with one section per parameter (statistics and chart).
- **Archives** (`archive/day-YYYY-MM-DD.html`, `month-YYYY-MM.html`, `year-YYYY.html`): one
  page per day (all dashboard panels; **disabled by default**, `day = true` to enable them),
  per month and per year (one section per parameter), with a date picker and previous / next
  navigation (each page type can be disabled).
- **Climatology** ("Climatology" menu): **monthly** table (`archive/climato-YYYY-MM.html`, one
  row per day: temperatures, wind, sector, rain, humidity, pressure; link to each day's
  archive page) and **yearly** table (`archive/climato-YYYY.html`, one row per month:
  temperatures and numbers of frost / ice / hot days, rain, wind; link to each month's
  table). Coloured cells.
- **Meteogram** ("Forecasts" → "Meteogram" menu, `meteogram.html`): hourly forecast at ground
  level and aloft, choice of model (by default ICON, Météo-France, ECMWF, GFS and Met Office):
  weather, temperature, clouds by altitude, precipitation and total, snow, temperature and
  wind aloft (0 °C isotherm), wind and gusts.
- **Ensemble forecasts** ("Forecasts" → "Ensembles" menu, `ensembles.html`): all members of
  the Open-Meteo ensemble models (ECMWF, GFS, ICON, GEM, Google…), combined mean, rain and
  probability per day, model comparison, day-by-day table; models and horizons configurable.
- **Weather warnings** ("Forecasts" → "Weather warnings" menu, `vigilance.html`): warnings of
  the national weather services from MeteoAlarm (Europe), the National Weather Service (United
  States) and Environment and Climate Change Canada, for one or more locations, in one or more
  countries; pills of the warnings in force (yellow, orange, red) at the top of the
  dashboard, full details on the "Weather warnings" page; updated every 5 minutes.
- **Pages in French, English, German or Italian** (option `lang`, skin files `lang/fr.conf`,
  `en.conf`, `de.conf` and `it.conf`, following the weewx guidelines); another language is
  added with one more file (see [Page language](#page-language-lang)).
- **"Extremes" page**: all-time records, rankings (days, months, showers) and longest frost,
  dry and wet spells, over the whole database.
- **Common footer** on all pages (`[[footer]]`): station, weewx version, disclaimer, warning,
  copyright and contact.
- Temperatures coloured by value (blues ≤ 0 °C, greens from 0 to 10 °C, yellow → red above),
  automatic light / dark theme, mobile layout.

```
 Local network                             │  Internet
                                           │
 Vantage Pro 2 ─► weewx ─┬─ weewx-mqtt ────┼──► MQTT broker (wss) ──────┐
                         │   (outgoing)    │      (optional)            │ real time
                         │                 │                            ▼
                         └─ report         │                         browser
                            WeewxLive ─► FTP/RSYNC ─► web hosting ──────┘
                            (JSON at each  │   (outgoing)  index.html
                             archive)      │               data/*.json
```

All connections go out from the weewx server (FTP/rsync, MQTT): no port to open on your
router.

**Contents**: [Contents](#contents) · [1. Install](#1-install-the-extension) ·
[2. Upload](#2-upload-to-the-web-host) · [3. MQTT](#3-real-time-mqtt-optional) ·
[4. Configure the page](#4-configure-the-page) ·
[5. Displayed parameters](#5-displayed-parameters-parameters) ·
[6. Sun and Moon, forecasts, maps](#6-sun-and-moon-forecasts-radar-and-satellite-dashboard) ·
[7. Over the years](#7-this-day-and-this-month-over-the-years) ·
[8. Detail, archives, climatology](#8-detail-pages) ·
[9. Extremes](#9-extremes-page-station-records) ·
[10. Ensembles](#10-ensemble-forecasts-ensembleshtml) ·
[11. Meteogram](#11-meteogram-meteogramhtml) ·
[12. Colours](#12-temperature-colours) · [Notes](#notes)

## Contents

| File | Role |
|---|---|
| `install.py` | installer for `weectl extension install` |
| `README.fr.md` | French version of this README |
| `changelog.md`, `changelog.fr.md` | change log, version by version (English, French) |
| `bin/user/livejson.py` | weewx extension (SearchList): computes all JSON files and template values |
| `skins/WeewxLive/skin.conf` | report configuration: displayed parameters, MQTT, forecasts, maps, extremes |
| `skins/WeewxLive/skin.fr.conf` | copy of `skin.conf` with the comments in French (reference, not read by weewx) |
| `skins/WeewxLive/lang/fr.conf`, `en.conf`, `de.conf`, `it.conf` | page texts in French, English, German and Italian ([Page language](#page-language-lang)) |
| `skins/WeewxLive/i18n.js.tmpl` | texts of the chosen language for the page scripts (`i18n.js`) |
| `skins/WeewxLive/panels.inc` | parameter panels, shared by the dashboard and the "day" archive pages |
| `skins/WeewxLive/astro.inc`, `forecast.inc`, `maps.inc`, `climate.inc` | "Sun and Moon", "Forecasts", "Radar and satellite", "This day and this month over the years" frames of the dashboard |
| `skins/WeewxLive/layout.js` | order and hiding of the dashboard frames and measurement panels ("Rearrange" button) |
| `skins/WeewxLive/archive/day-%Y-%m-%d.html.tmpl` | "day" archive page (one per day) |
| `skins/WeewxLive/archive/month-%Y-%m.html.tmpl`, `year-%Y.html.tmpl` | "month" and "year" archive pages |
| `skins/WeewxLive/archive/header.inc`, `skins/WeewxLive/archive.js` | common archive header: menu, date picker, previous / next |
| `skins/WeewxLive/archive/brand.inc` | brand (logo, name) and menu of the pages in the `archive/` folder |
| `skins/WeewxLive/archive/climato-%Y-%m.html.tmpl`, `climato-%Y.html.tmpl`, `skins/WeewxLive/climato.js` | monthly and yearly climatological tables |
| `skins/WeewxLive/index.html.tmpl`, `app.js` | dashboard: Cheetah template (one panel per parameter of `[[parameters]]`, configuration embedded in the page) and real-time script |
| `skins/WeewxLive/extras.js` | dashboard forecasts, radar and satellite |
| `skins/WeewxLive/climate.js` | "This day and this month over the years" |
| `skins/WeewxLive/astro.js` | "Sun and Moon" (display of the weewx almanac data) |
| `skins/WeewxLive/detail.html.tmpl`, `detail.js` | detail pages per parameter |
| `skins/WeewxLive/extremes.html.tmpl`, `extremes.js` | "Extremes" page |
| `skins/WeewxLive/ensembles.html.tmpl`, `ensembles.js` | "Forecasts - Ensembles" page |
| `skins/WeewxLive/meteogram.html.tmpl`, `meteogram.js` | "Meteogram" page |
| `skins/WeewxLive/wxtime.js.tmpl` | station time zone (the date functions of all pages are in `nav.js`) |
| `skins/WeewxLive/units.html.tmpl`, `units.js` | "Settings → Units" page (units chosen by the visitor) |
| `skins/WeewxLive/webcam.html.tmpl`, `webcam.js` | "Webcam" page (images and videos from `[[webcam]]`) |
| `skins/WeewxLive/vigilance.html.tmpl`, `warnings.js` | MeteoAlarm weather warnings: dashboard pills and "Weather warnings" page ([Weather warnings](#weather-warnings-meteoalarm-nws-eccc)) |
| `skins/WeewxLive/admin.html.tmpl`, `admin.js` | "Settings → Admin" page (entering and leaving [admin mode](#admin-mode-reserved-parameters)) |
| `skins/WeewxLive/wxicons.js` | WMO weather codes and icons (dashboard forecasts, meteogram) |
| `skins/WeewxLive/nav.js` | station time (date functions), units, admin mode, common menu; name, subtitle and logo of the static pages |
| `skins/WeewxLive/minichart.js` | canvas chart engine + temperature colour scales |
| `skins/WeewxLive/style.css` | theme (light / dark) |
| `skins/WeewxLive/data/*.json.tmpl`, `config.json.tmpl` | JSON file templates |
| `skins/WeewxLive/vendor/leaflet/` | Leaflet 1.9.4 map library (RainViewer / EUMETSAT) |
| `skins/WeewxLive/img/`, `vendor/mqtt.min.js` | to create yourself: logo ([Logo](#logo)) and local copy of mqtt.js ([Local mqtt.js](#local-mqttjs-recommended)) |

weewx writes to the root of the report's `HTML_ROOT` folder (see
[Output folder](#output-folder-html_root)):

| File | Content | Regeneration |
|---|---|---|
| `index.html` | dashboard | at each archive |
| `config.json` | page configuration | at each archive |
| `wxtime.js` | station time zone ([Station time](#station-time)) | at each archive |
| `i18n.js` | texts of the chosen language ([Page language](#page-language-lang)) | at each archive |
| `detail.html`, `extremes.html`, `ensembles.html`, `meteogram.html`, `units.html`, `admin.html`, `webcam.html`, `vigilance.html` | translated pages (templates) | at each archive |
| `data/history.json` | 24 h series, extremes and totals of the day | at each archive |
| `data/p24h.json` | detail page, 24 h | at each archive |
| `data/p7d.json` | 7 days | 30 min max. |
| `data/p30d.json`, `p365d.json`, `p730d.json` | 30, 365, 730 days | 1 h max. |
| `data/climate.json` | over the years | 15 min max. |
| `data/extremes.json` | records | 1 h max. |
| `data/forecast.json` | Open-Meteo forecasts for each model in the list (cache) | at each archive, download once an hour per model |
| `data/astro.json` | sun and moon of the day (weewx almanac) | at each archive |
| `data/meteogram.json` | Open-Meteo meteogram (ground and pressure levels, 5 models) | every 30 min, download at most once an hour per model |
| `data/ensembles.json` | Open-Meteo ensemble forecasts (members) | every 30 min, download at most once every 3 h per model |
| `data/warnings.json` | weather warnings of each location (MeteoAlarm, NWS, ECCC) | at each archive, download at most once every 5 min per source (MeteoAlarm: per country) |
| `archive/day-…`, `month-…`, `year-…`, `climato-…html` | archive pages | current period at each archive; past periods once |
| `*.js`, `style.css`, `img/`, `vendor/` | copied files | at each archive (FTP only uploads changed files) |

Archive pages of past periods are generated only once: after a weewx-live update they keep
the old layout (they remain usable, in browser time for those older than version 1.68). To
rebuild them, delete the `archive/` folder of `HTML_ROOT`: weewx regenerates it over the
following archives (this can take several minutes with many years of data).

The extremes of the day come from the weewx daily summaries (they include peaks measured
between two archives). Units are converted by weewx itself, whatever the unit system of the
database (US, METRIC, METRICWX): °C, km/h, mm, mm/h, hPa, W/m², %, µg/m³, h (durations),
hPa/h, cm, °C·d, Wh, lx… (unit groups of `GROUP_TARGET` in `livejson.py`; other measurements
stay in the database unit).

## 1. Install the extension

**Minimum version: weewx 4.6** (Python 3). weewx 4.5 and earlier are not compatible (see
[Notes](#notes)).

```bash
# weewx 5
weectl extension install https://github.com/Jterrettaz/WeewxLive/releases/download/latest/weewx-live.zip
# weewx 4
sudo wee_extension --install https://github.com/Jterrettaz/WeewxLive/releases/download/latest/weewx-live.zip
```

The installer adds to `weewx.conf`:

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true
```

**Report order**: `[[WeewxLive]]` must come **before** `[[FTP]]` / `[[RSYNC]]`, otherwise
files are uploaded one cycle late. weewx 5 does this automatically; with weewx 4, move the
section by hand.

**Update**: reinstalling replaces `skin.conf` and the skin files (including `minichart.js`).
Put your settings in `weewx.conf` (see
[Keeping your settings across updates](#keeping-your-settings-across-updates-weewxconf)).

**Updating from a version older than 2.10**: `skin.conf` now has English comments (same
settings); the French-commented copy is `skin.fr.conf` and the old `skin.en.conf` can be
deleted.

**Updating from a version older than 2.03**: "day" archive pages are now disabled by
default (`[[archives]] day = false`). To keep producing them, add `day = true` to
`weewx.conf` (see [Archives](#archives-day-month-year-pages)).

**Updating from a version older than 1.98**: the pages `detail.html`, `extremes.html`,
`ensembles.html`, `meteogram.html`, `units.html`, `admin.html` and `webcam.html` are now
templates (`*.html.tmpl`); the old `*.html` files in `skins/WeewxLive/` are no longer used and
can be deleted. The installer adds `lang = fr` to `[[WeewxLive]]` (see
[Page language](#page-language-lang)).

**Updating from a version older than 1.55** (skin files moved from `skins/WeewxLive/live/` to
`skins/WeewxLive/`):

1. set `HTML_ROOT` in `[[WeewxLive]]` of `weewx.conf` (see
   [Output folder](#output-folder-html_root));
2. move your own files: `live/img/` (logo) to `skins/WeewxLive/img/`,
   `live/vendor/mqtt.min.js` to `skins/WeewxLive/vendor/`;
3. delete the old `skins/WeewxLive/live/` folder (it is no longer used);
4. restart weewx.

## 2. Upload to the web host

Use the standard weewx FTP or RSYNC report:

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true
        HTML_ROOT = public_html/live   # output folder (see below)

    [[FTP]]
        skin = Ftp
        enable = true
        user = myaccount
        password = ********
        server = ftp.my-host.com
        path = /www/weather        # with HTML_ROOT = public_html/live: https://my-site/weather/live/
        secure_ftp = true
```

or

```ini
    [[RSYNC]]
        skin = Rsync
        enable = true
        server = my-server.com
        user = weather
        path = /var/www/weather
        delete = false
```

`FTP`/`RSYNC` upload the whole content of `HTML_ROOT` (the one in `[StdReport]`), so the
WeewxLive folder along with the rest (Seasons skin, etc.).

### Output folder (`HTML_ROOT`)

Since version 1.55 the skin files are at the root of `skins/WeewxLive/` (there is no `live/`
subfolder any more): weewx therefore generates the pages **at the root of the report's
`HTML_ROOT`**. The installer does not set this folder; choose it in `weewx.conf`:

```ini
[StdReport]
    HTML_ROOT = public_html            # common folder (Seasons, FTP…)
    [[WeewxLive]]
        skin = WeewxLive
        HTML_ROOT = public_html/live   # same address as before 1.55: …/live/
```

- Without `HTML_ROOT` in `[[WeewxLive]]`, the pages are written directly in the common
  `HTML_ROOT`: `index.html` there **replaces the Seasons skin's one** if it is active.
- A relative path starts from `WEEWX_ROOT`; with the Debian/Ubuntu package (`HTML_ROOT =
  /var/www/html/weewx`), give the full path, for example
  `HTML_ROOT = /var/www/html/weewx/live` (local page at `http://weewx-server/weewx/live/`).
- If the chosen folder is inside the common `HTML_ROOT`, the FTP / RSYNC report uploads it
  with the rest; otherwise, set up its upload separately.
- Older installation: files already generated in `…/live/` stay in place; with
  `HTML_ROOT = public_html/live`, they are simply updated.

### Frequency

By default, one cycle at each archive (`archive_interval`, often 300 s). For another
frequency (e.g. every 10 min) — to be applied to `[[FTP]]` as well to stay in sync:

```ini
    [[WeewxLive]]
        report_timing = */10 * * * *
```

The page shows a banner if `data/history.json` is more than 30 minutes old (generation or
upload interrupted).

## 3. Real time: MQTT (optional)

### With MQTT

Visitors receive the measurements directly from the broker, which must therefore be
reachable from the internet, over **secure WebSocket (`wss://`)** if the page is served over
HTTPS. Two options:

- **Hosted broker** (free plans such as HiveMQ Cloud, EMQX Cloud…): TLS WebSocket provided,
  no server to manage;
- **Mosquitto on a VPS / the web server**, with `listener 9001` + `protocol websockets`
  behind an HTTPS reverse proxy (nginx `location /mqtt` with `Upgrade`/`Connection`).

weewx connects to the broker **outgoing**. weewx-mqtt configuration (`weewx.conf`):

```ini
[StdRESTful]
    [[MQTT]]
        server_url = mqtts://weewx:PASSWORD@broker.example.org:8883/
        topic = weather
        unit_system = METRIC
        binding = loop          # required for real time
        aggregation = aggregate # one JSON message per packet -> topic weather/loop
        [[[tls]]]
            tls_version = tlsv12
```

The "individual" mode of weewx-mqtt (one topic per measurement, `weather/outTemp_C`…) is
also understood (topic `weather/#`); do not publish both forms on the same topic, rain would
be counted twice.

Keys `<measurement>_<unit>` are converted (`_F`, `_mph`, `_in`, `_inHg`, `_knot`, `_cm`,
`_mbar`…). An unknown unit is reported in the browser console and the value is shown as is.

**Temperature change over 1 h and 24 h** (Temperature panel): the page reads in each message
the keys `OutTemp-1h_C` (temperature one hour ago) and `OutTemp-24h_C` (24 hours ago); names
can be changed with `temp_1h_key` and `temp_24h_key` in `[[mqtt]]`. Until a key is received,
the change is estimated from the weewx history and followed by an asterisk. With
`temp_deltas = false` in `[[mqtt]]`, the "Over 1 h · Over 24 h" line is not shown and these
keys are not read.

**Current frost duration** (Temperature panel, dashboard only): when the current temperature
is below 0 °C, a blue line shows the time elapsed since the last reading at 0 °C or above
("42 min", "3 h 05 min", "2 d 4 h"), updated every second. The start of the frost is looked
up in the whole weewx archive (`frost` in `history.json`), then followed through the MQTT
messages; if the database contains no positive reading, the duration is preceded by "more
than".

Create two accounts on the broker: `weewx` (write access to `weather/#`) and a **read-only**
account for the page — its credentials are public since they are read by the browser.

### Local mqtt.js (recommended)

Without a local copy, the page loads `mqtt.js` from unpkg.com. To host it with the page:

```bash
mkdir -p skins/WeewxLive/vendor
curl -L -o skins/WeewxLive/vendor/mqtt.min.js https://unpkg.com/mqtt@5/dist/mqtt.min.js
```

(the `vendor/` folder is already listed in `copy_always`).

### Without MQTT (update at each archive)

```ini
    [[mqtt]]
        enable = false
        archive_poll = 60      # seconds between two checks (15 to 3600)
```

The page shows the latest archive record (current values, extremes and totals of the day,
charts) and re-reads `data/history.json` every `archive_poll` seconds; the display changes
as soon as a new archive has been generated and uploaded. The status indicator shows "weewx
archive" and the age of the latest record ("No data" beyond 30 min). Temperature changes over
1 h / 24 h are computed from the history ("*").

This mode is also used as a **fallback** if the broker address is empty, if mqtt.js cannot be
loaded or if the connection cannot be created; a banner says so.

### Station time

All dates and times on the pages (clock, times of extremes, charts, forecasts, meteogram,
ensembles, maps, archives) are shown in **station time**, whatever the visitor's time zone.
The time zone is that of the system running weewx (`TZ` variable, `/etc/timezone` or
`/etc/localtime`), i.e. the one in which weewx counts its days, months and years; the
`timezone` option of `[LiveJSON]` (IANA name, e.g. `Europe/Paris`) replaces it if it is not
detected. It is published in `wxtime.js` (generated) and the Open-Meteo forecasts are
requested in the same time zone. If no name is found, the current winter or summer time is
used without daylight-saving changes (`Etc/GMT±N`, reported in the weewx log): this is the
case of a `TZ` variable in POSIX format (e.g. `CET-1CEST`); then set `timezone`.

The extremes and totals of the day therefore follow the **station day**: `history.json`
publishes the station's next midnight and the page changes day at that moment.

## 4. Configure the page

In `skins/WeewxLive/skin.conf` (weewx skins folder, e.g. `/etc/weewx/skins/` or
`~/weewx-data/skins/`), section `[LiveJSON]`:

```ini
[LiveJSON]
    hours = 24                   # window of the dashboard charts (1 to 72 h)
    station_name = ""            # empty = [Station] location of weewx.conf
    timezone = ""                # time zone of displayed times (e.g. Europe/Paris; empty = system's)
    page_refresh = 300           # full reload of the dashboard (s, 0 = never, max. 86400)
    data_binding = wx_binding    # weewx database read
    pretty = false               # true: indented JSON (debugging)
    [[mqtt]]
        enable = true
        url = wss://broker.example.org:8884/mqtt
        topic = weather/loop
        username = reader
        password = read-password
```

`page_refresh` reloads the whole page (to pick up a change to `skin.conf`); with MQTT this
briefly interrupts real time: set `0` to never reload, since the page re-reads the data
anyway.

The page subtitle is the station model declared by weewx (`[Station]`, e.g.
"Vantage · weewx").

### Logo

A logo can be shown to the left of the station name (all pages): put the image in
`skins/WeewxLive/img/` (copied with the site) and declare it:

```ini
    logo = img/logo.png        # or an https://… address
    logo_alt = Station logo
    logo_height = 48           # height in pixels (16 to 200)
```

### Footer (`[[footer]]`)

A footer common to all pages (dashboard, detail, period, archive and climatology pages,
forecasts, ensembles, meteogram, warnings, webcam, settings) is shown below each page's own
footer: station and weewx software, disclaimer, final warning, copyright and contact.

```ini
[LiveJSON]
    [[footer]]
        enable = true                      # false: no common footer
        station = Davis Vantage Pro 2 plus weather station   # empty: station name
        software = true                    # " - WeeWX software v.5.5.2"
        disclaimer_title = Disclaimer
        disclaimer_1 = "The data on this site come from an amateur weather station."
        disclaimer_2 = "They are provided for information only, without any guarantee of accuracy."
        disclaimer_3 = "For official forecasts and warnings, refer to the national weather service."
        warning = "Do not make important decisions based on this information alone."   # in bold
        copyright = © weewx-live
        email = webmaster@example.com      # contact ("": none)
        email_label = Contact:
```

- Paragraphs `disclaimer_1`, `disclaimer_2`… (as many as needed) are shown in the order of
  their number, with a line after the first one; `warning` closes the disclaimer, in bold.
- Texts are shown as written (plain text, no HTML), whatever the page language; put them in
  quotes if they contain commas. An empty option is not shown.
- `software`: version of the weewx that generates the site, with a link to weewx.com.
- The email address is visible in the pages and in `config.json` (as any address published on
  a website).
- Archive pages generated before this option read the footer from `config.json`: no need to
  rebuild them. To keep your texts across updates, put them in `weewx.conf`
  (`[[WeewxLive]]` → `[[[LiveJSON]]]` → `[[[[footer]]]]`).

### Check

```bash
sudo systemctl restart weewx
weectl report run WeewxLive        # weewx 5: immediate generation, without waiting for the archive
ls <HTML_ROOT of WeewxLive>/data/
```

Then open the page (for example `https://my-site/weather/live/` with the example of section
2). The footer shows when the history was generated; the badge at the top right, the
connection status ("Live", "weewx archive", "No data"…).

`?demo` at the end of the address of the dashboard or a detail page: simulated data, no
broker.

### Order of the dashboard frames

From top to bottom, by default: station measurements, forecasts, radar and satellite, Sun
and Moon, "this day and this month over the years". The administrator chooses the order in
`skin.conf` (or `weewx.conf`):

```ini
    [[dashboard]]
        order = parameters, forecast, maps, astro, climate
```

Identifiers: `parameters` (measurements), `forecast` (forecasts), `maps` (radar and
satellite), `astro` (Sun and Moon), `climate` (over the years); a forgotten frame is added at
the end.

Each **visitor** can then rearrange the dashboard: **"Rearrange"** button (at the top, next
to "Collapse all"). Frames fold into a list: **↑ Move up** / **↓ Move down** on each frame
and, in "Station measurements", on each **measurement panel** (temperature, wind, rain…).
Each frame and each panel also has a **"Hide"** button ("Show" to bring it back): a hidden
item is no longer shown on the dashboard (a hidden radar and satellite frame is not loaded).
Then **"Done"**. Orders and hidden items are remembered by the visitor's browser and applied
as soon as the page loads; **"Default"** returns to the administrator's orders
(`[[dashboard]] order` for frames, order of `[[parameters]]` or option `order` for panels)
and shows everything again. Moving the radar and satellite frame reloads the Windy maps. To
remove an item for all visitors: `enable = false` in `[[forecast]]`, `[[radar]]`,
`[[satellite]]`, `[[astro]]` or in the parameter of `[[parameters]]` (the "over the years"
frame has no disable option).

### Page language (`lang`)

Page texts are in the skin's `lang/` folder, one file per language, following the weewx
guidelines: `fr.conf` (French), `en.conf` (English), `de.conf` (German) and `it.conf`
(Italian). The language is chosen in `weewx.conf`, in the report section:

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        lang = en          # fr, en, de or it
```

- The installer adds `lang = fr` to this section (also on an update, if the option is
  missing). This setting takes precedence over `[StdReport] [[Defaults]] lang` (`en` in the
  `weewx.conf` created by weewx 5) and over `lang = fr` in `skin.conf` (see
  [Setting the language in skin.conf](#setting-the-language-in-skinconf)).
- Everything is translated: menus, titles, panels, charts and tooltips, tables, messages,
  day and month names, wind directions (O / W for west), moon phases, forecast weather,
  forecast model names and error messages. Numbers and dates follow the language
  (`intl_locale`: `fr-FR`, `en-GB`, `de-DE`, `it-IT`).
- Titles of the standard parameters: without a `title` option in `[[parameters]]`, those of
  the language (`[Labels] [[Generic]]` of the file: "Température" / "Temperature"…). A
  `title` written in `skin.conf` or `weewx.conf` is shown as is, whatever the language;
  added parameters without `title` also get the weewx title of their column (e.g.
  `soilTemp1`: "Soil temperature 1").
- German and Italian translations (2.01): suggestions to be reviewed. Wind directions are
  abbreviated according to the language (German: O = Ost, east; Italian: O = ovest, west).
- **Adding a language**: copy `en.conf` to `<code>.conf` (e.g. `es.conf`, `nl.conf`),
  translate the values (to the right of `=`, without touching the keys or the
  `{variables}`), set `intl_locale` and `html_lang` in `[[Locale]]`, then `lang = es`. weewx
  replaces a language without a file by English. A text missing from the file is shown in
  English (key); the browser console lists them: `window.WXL_MISSING`.
- The language file is replaced at each reinstallation (like `skin.conf`): keep a copy of
  your changes.
- Changing the language does not rebuild the archive pages of past periods: delete the
  `archive/` folder of `HTML_ROOT` to regenerate them in the new language. The `data/` files
  refreshed less often (meteogram, ensembles: model names) switch to the new language at
  their next generation (`stale_age`, 30 min to 1 h).

#### Setting the language in `skin.conf`

The language can also be set in `skin.conf`, with the `lang` option at the top of the file
(before `[LiveJSON]`):

```ini
SKIN_NAME = WeewxLive
SKIN_VERSION = 2.13

lang = en          # fr, en, de or it
```

weewx uses the **first** value found in this order:

| Priority | Location | Value after installation |
|---|---|---|
| 1 | `weewx.conf`, `[StdReport]` → `[[WeewxLive]]` → `lang` | `fr` (added by the installer) |
| 2 | `weewx.conf`, `[StdReport]` → `[[Defaults]]` → `lang` | `en` (weewx 5) |
| 3 | `skin.conf` → `lang` | `fr` |

The `lang` of `skin.conf` is therefore only used if the other two are absent:

1. in `skin.conf`, replace `lang = fr` with the language you want (`en`, `de`, `it`);
2. in `weewx.conf`, delete the line `lang = fr` from `[[WeewxLive]]`;
3. in `weewx.conf`, comment out `lang = en` in `[[Defaults]]` (`#lang = en`); the other
   reports (Seasons…) then use the language of their own `skin.conf`;
4. restart weewx (or `weectl report run WeewxLive`); delete the `archive/` folder of
   `HTML_ROOT` to rebuild past archive pages in the new language.

**After each update of the extension**, this setting is lost: reinstalling replaces
`skin.conf` (back to `lang = fr`) and adds `lang = fr` to `[[WeewxLive]]` again. Steps 1 and
2 must then be repeated. This is why the recommended setting remains `lang` in
`[[WeewxLive]]` of `weewx.conf`, which is kept across updates.

### Displayed units (`[[units]]`)

Data stay in metric units (°C, km/h, mm, mm/h, hPa, m, cm); conversion happens in the
browser, on **all pages** (values, charts, tooltips, tables, forecasts, meteogram). The
administrator chooses the site's default units:

```ini
    [[units]]
        temperature = °F       # °C, °F
        wind = mph             # km/h, m/s, mph, kn
        rain = in              # mm, in
        rain_rate = in/h       # mm/h, in/h
        pressure = inHg        # hPa, inHg, mmHg, kPa
        altitude = ft          # m, ft (meteogram: altitudes, 0 °C isotherm)
        snow = in              # cm, in (meteogram)
```

Missing option: metric unit. `kmh` means `km/h`; weewx unit names are also accepted
(`degree_F`, `mile_per_hour`, `inch`, `inch_per_hour`, `inHg`, `mmHg`, `foot`…); an unknown
value is reported in the weewx log and ignored.

Each **visitor** can choose their own: **"Settings → Units"** menu (`units.html`), one unit
per quantity, remembered by their browser; **"Restore the site's units"** clears that choice.
Added parameters (`[[parameters]]`) whose unit is °C, km/h, mm, mm/h, hPa, m or cm are
converted the same way. Thresholds (frost days, rain days…) and temperature colours are still
computed on the metric values.

The 6 standard parameters are always published in these metric units: their default unit is
set only here, with `[[units]]` (a `units` option on a standard parameter is ignored and
reported in the log).

### Units of extra parameters (`[[unit_groups]]`, `units`)

Added parameters are published in a unit chosen from their **weewx unit group** (radiation:
W/m², distance: km, energy: Wh, degree days: °C·d, durations: h…). Two settings change it,
with **weewx unit names**; values are converted by weewx and the displayed label follows the
unit:

```ini
[LiveJSON]
    # per group: all added parameters of that group
    [[unit_groups]]
        group_distance = mile          # km, meter, mile
        group_energy = kilowatt_hour   # watt_hour, kilowatt_hour, mega_joule, watt_second
        group_degree_day = degree_F_day
        group_deltatime = minute       # durations in seconds: hour, minute, second, day
    [[parameters]]
        [[[windrun]]]
            title = Wind run
            aggregate = sum
            units = km                 # per parameter: takes precedence over [[unit_groups]]
```

| Group | Default unit | Other possible units |
|---|---|---|
| `group_distance` | `km` | `meter`, `mile` |
| `group_energy` | `watt_hour` | `kilowatt_hour`, `mega_joule`, `watt_second` |
| `group_degree_day` | `degree_C_day` | `degree_F_day` |
| `group_interval` (durations in minutes) | `hour` | `minute`, `second`, `day` |
| `group_deltatime` (durations in seconds) | `hour` | `minute`, `second`, `day` |
| `group_pressurerate` | `mbar_per_hour` | `hPa_per_hour`, `inHg_per_hour`, `mmHg_per_hour`, `kPa_per_hour` |

- The temperature, speed, rain, rain rate, pressure, altitude and length (cm) groups are not
  set here: they stay metric and follow `[[units]]` (conversion in the browser, at the
  visitor's choice).
- Radiation (W/m²), soil moisture (cb), illuminance (lx), concentration (µg/m³), voltage (V)
  and ppm have only one unit in weewx.
- Grouped panel: `units` in the group section applies to all its measurements; a measurement
  can have its own.
- The `unit` option remains a simple **label** (no conversion), taking precedence over the
  one derived from `units`; remember to adjust `decimals` (e.g. distance in miles).
- Unknown group, group converted in the browser, unit not belonging to the group: setting
  ignored, message in the weewx log (`livejson:`).

## 5. Displayed parameters (`[[parameters]]`)

The list of parameters of the dashboard, the detail pages and the "Data" menu is defined in
`[LiveJSON]` → `[[parameters]]`: one subsection per parameter, **in display order**.

```ini
    [[parameters]]
        # order = outTemp, wind, …    # optional, see below
        [[[outTemp]]]
            # title = Temperature     # displayed title (default: the language's)
            column = outTemp          # weewx database column
            mqtt = outTemp            # MQTT name (before the unit suffix: outTemp_C)
            aggregate = min-max       # min-max | max | sum
        …
        [[[UV]]]
            title = UV index
            column = UV
            mqtt = UV
            aggregate = max
            decimals = 1              # optional; also: units, unit, hint, color (e.g. --sun)
            # admin = true            # optional: admin mode only (see below)
```

| Aggregate | Dashboard | Detail pages |
|---|---|---|
| `min-max` | value, min. and max. of the day, 24 h curve | min., max., mean; mean + min–max band |
| `max` | value, max. of the day, 24 h curve | max., mean, mean of maxima; curve of maxima |
| `sum` | total of the day, 24 h total, hourly bars + total | total, daily max.; bars (hour / day / month) + total |

- The 6 standard parameters (`outTemp`, `wind`, `windDir`, `rain`, `outHumidity`,
  `barometer`) keep their specialised panel as long as their aggregate is not changed; their
  `title` (default: title of the [language](#page-language-lang)), `column` and `mqtt` can be
  changed. Changing their aggregate turns them into a generic panel.
- Deleting a subsection (or `enable = false`) removes the parameter everywhere. Without any
  subsection, the 6 standard parameters are shown.
- Solar radiation is no longer a standard parameter (version 1.70): to show it, add it as an
  extra parameter (commented example `[[[radiation]]]` in `skin.conf`: `aggregate = max`,
  `color = --sun`).
- `color`: name of a CSS variable of the theme (`--temp`, `--wind`, `--rain`, `--sun`,
  `--hum`, `--press`…); any other value is ignored.
- A parameter in °C (e.g. inside temperature, soil temperature) has its curve coloured by
  temperature, with the same colour code as the outside temperature. In a grouped panel, each
  measurement in °C is coloured the same way and is distinguished by its line (solid,
  dashed, dotted), repeated in the legend.
- The dashboard (`index.html`) is **generated by weewx** from `index.html.tmpl`: panels,
  titles and order follow `[[parameters]]`, and the configuration is embedded in the page.
  After a change, the page is regenerated at the next archive (or with
  `weectl report run WeewxLive`).
- The unit is derived from the weewx column and converted; `unit = …` forces the label.
- The MQTT name is compared case-insensitively, with or without unit suffix, and may contain
  "_" (`pm2_5`); several parameters can read the same measurement.
- A measurement without a daily summary in the database (type computed by weewx) is
  aggregated by weewx for the 30 / 365 day pages (slower).

### Admin mode (reserved parameters)

A parameter (or a grouped panel) marked `admin = true` is shown only in **admin mode**:
dashboard (and "Rearrange" list), "day" archive pages, detail pages, period pages and
"month" / "year" archive pages, "Data" menu. The password is set in `[[admin]]`:

```ini
[LiveJSON]
    [[admin]]
        password = my-password     # empty: admin mode disabled
    [[parameters]]
        [[[inTemp]]]
            title = Inside temperature
            column = inTemp
            admin = true
```

- The visitor enters the password on the **"Settings → Admin"** page (`admin.html`). Admin
  mode is remembered by their browser; the "Leave admin mode" button on the same page exits
  it. The menu shows "Admin (active)" while it is active.
- The password is not published: `wxtime.js` only contains its SHA-256 hash, compared with
  the one the browser has stored. **Changing the password logs every browser out of admin
  mode**.
- Without a password, `admin = true` parameters are shown to nobody (message in the weewx
  log).
- Password containing a comma: write it in quotes (`password = "a,b"`).
- To keep it across reinstallations, put it in `weewx.conf`
  (`[[WeewxLive]]` → `[[[LiveJSON]]]` → `[[[[admin]]]]`, see
  [Keeping your settings](#keeping-your-settings-across-updates-weewxconf)).
- **This is hiding on display, not protection**: a static site cannot control access to
  files. The measurements of reserved parameters remain readable in the published files
  (`data/*.json`, `config.json`, archive pages) and in the MQTT messages. A short password
  can also be recovered from its hash: choose a long one, different from your other
  passwords. For real protection,
  use the host's (`.htaccess`, password-protected access).
- Archive pages of past periods, generated only once, keep the `admin` settings in force when
  they were generated (see [Archives](#archives-day-month-year-pages)).

### Grouped panels (several measurements in one panel)

A subsection that itself contains `[[[[…]]]]` subsections describes a **group**: its
measurements share a dashboard panel (value / min. / max. table + a 24 h chart with one
curve per measurement) and a detail page (min. / max. / mean table per measurement and per
period; one curve per measurement: raw readings over 24 h, hourly means — or maxima for
`aggregate = max` — over 7 days and daily beyond).

```ini
        [[[particles]]]
            title = Particulate matter
            aggregate = min-max       # min-max | max (common to all measurements)
            unit = µg/m³              # optional; also decimals, hint
            [[[[pm1_0]]]]
                title = PM1
                column = pm1_0        # columns of the weewx extended schema (wview_extended)
                mqtt = pm1_0
            [[[[pm2_5]]]]
                title = PM2.5
                column = pm2_5
                mqtt = pm2_5
            [[[[pm10_0]]]]
                title = PM10
                column = pm10_0
                mqtt = pm10_0         # optional per measurement: unit, decimals, color
```

- The "Data" menu offers a single page for the group.
- Identifiers (groups and measurements) must be unique in `[[parameters]]`; a duplicate is
  reported in the weewx log and ignored.
- Default colours, in order: blue, orange, green, yellow, purple.
- `aggregate = sum` is not available for a group.

### Keeping your settings across updates (`weewx.conf`)

Reinstalling the extension overwrites `skin.conf`. Settings can be placed in `weewx.conf`,
section `[StdReport]` → `[[WeewxLive]]`: weewx merges them with `skin.conf` and they take
precedence (add one level of brackets to each section).

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true
        [[[LiveJSON]]]
            station_name = My station
            [[[[mqtt]]]]
                url = wss://broker.example.org:8884/mqtt
                username = reader
                password = ********
            [[[[parameters]]]]
                order = outTemp, particles, wind, windDir, rain, outHumidity
                [[[[[barometer]]]]]
                    enable = false
                [[[[[particles]]]]]
                    title = Particulate matter
                    unit = µg/m³
                    [[[[[[pm1_0]]]]]]
                        title = PM1
                    [[[[[[pm2_5]]]]]]
                        title = PM2.5
```

- Merging adds or replaces, but does not delete: hide a parameter of `skin.conf` with
  `enable = false`.
- Parameters added in `weewx.conf` come after those of `skin.conf`; `order = …` sets the
  display order (listed parameters first, in that order, then the others; an unknown
  identifier is reported in the log and ignored).
- Restart weewx after changing `weewx.conf`.
- `weectl extension uninstall` removes the `[[WeewxLive]]` section from `weewx.conf`.

## 6. Sun and Moon, forecasts, radar and satellite (dashboard)

### Sun and Moon

A dashboard frame (after radar and satellite, in the default order) gives for today:

- **Sun**: sunrise and sunset times, day length, change in length from the previous day
  (green when days are getting longer), solar noon and maximum altitude, current position
  (altitude and direction);
- **Moon**: moonrise and moonset times ("—" if there is none that day), phase with its
  drawing and percentage illuminated, current position;
- a **chart** of the altitude of the sun and moon from 0:00 to 24:00, with the horizon, the
  daytime period (background) and the current position of each (dot), updated every minute.

The calculations are done by the **weewx almanac** (`weewx.almanac`, the same as `$almanac`
in templates, with PyEphem) for the station's latitude, longitude and altitude (`[Station]`
of `weewx.conf`, or `latitude`/`longitude` of `[[forecast]]`), taking the current temperature
and pressure into account (refraction). They are published in `data/astro.json` at each
archive: rises, sets and meridian transits, previous day's length, moon phase, altitudes and
azimuths every 10 minutes; the page derives the current position from them. Days and times
are the station's (see [Station time](#station-time)).

PyEphem is installed with weewx 5 (dependency of the package and of the pip installation).
Without it, the weewx almanac only provides sunrise, sunset and moon phase: the panel then
shows these values, without moonrise / moonset or chart. To hide the panel:

```ini
    [[astro]]
        enable = false
```

### Forecasts, radar and satellite

| Block | Source | Details |
|---|---|---|
| **Forecasts** | [Open-Meteo](https://open-meteo.com/), **choice of model** (drop-down list in the header, at most 5 models; `best_match` by default) | weather (icon), max./min., rain and probability, prevailing wind and gusts; sunrise/sunset and UV of the day. **A click on a day opens the hour-by-hour detail**: temperature curve, precipitation bars and 24-hour strip. |
| **Precipitation radar** | [Windy.com](https://embed.windy.com/) (default) or [RainViewer](https://www.rainviewer.com/api.html) | Windy: official embedded map (iframe), radar layer, animation with the ▶ button. RainViewer: automatic animation of the last 2 hours. |
| **Satellite** | [Windy.com](https://embed.windy.com/) (default) or [EUMETSAT EUMETView](https://view.eumetsat.int/) (WMS) | Windy: embedded map, satellite layer. EUMETSAT: Meteosat animation of the last 2 hours (infrared or true colour). |

**Choice of model**: the drop-down list in the block header offers the models of `models` (at
most 5); the choice is remembered by the browser, `model` is the one shown by default. A
model whose download failed appears as "(unavailable)". If `days` exceeds a model's range
(Météo-France: 4 days), the limit given by Open-Meteo is used for that model. Days without
data (beyond the model's range: Météo-France, MeteoSwiss ICON… 4 to 5 days) are not shown
and the block title gives the number of available days ("4-day forecast"); not all models
provide precipitation probability or UV index (values then missing).

**Forecast cache** (1 hour by default, `cache` in seconds in `[[forecast]]`): weewx downloads
the forecasts of each model at most once per period and publishes them all in
`data/forecast.json` (about 25 KB per model); all visitors read this file. If the download
fails, the previous copy is kept and weewx only retries after 15 minutes (the report is not
slowed down). If the file is unusable, the browser queries Open-Meteo itself and keeps the
response in a local cache for the same duration. The update time is shown in the block
header.

Radar and satellite are requested **directly by the visitors' browser** (no API key); maps
are only loaded when they become visible. Coordinates: those of `[Station]` in `weewx.conf`,
or `latitude`/`longitude` in `[[forecast]]`.

```ini
    [[forecast]]
        enable = true
        # models of the drop-down list (at most 5) and model shown by default
        models = best_match, icon_seamless, meteofrance_seamless, ecmwf_ifs025, gfs_seamless
        model = best_match
        days = 7                  # 1 to 16
        cache = 3600              # seconds (60 to 86400)
        # timeout = 15            # Open-Meteo response timeout (s, 2 to 60)
        # latitude / longitude: by default those of [Station]
    [[radar]]
        enable = true
        provider = windy          # or rainviewer
        windy_overlay = radar     # other possible Windy layer: satellite, rain, wind…
        windy_product = radar     # radar, satellite, ecmwf, gfs, icon…
        windy_url = ""            # or the iframe address copied from https://embed.windy.com
        zoom = 7                  # 1 to 12 (RainViewer: 7 at most)
        # with provider = rainviewer:
        frames = 13               # animation frames (2 to 13)
        frame_delay = 500         # ms between two frames (100 to 5000)
    [[satellite]]
        enable = true
        provider = windy          # or eumetsat
        windy_overlay = satellite
        windy_product = satellite
        windy_url = ""
        zoom = 5                  # 1 to 12
        # with provider = eumetsat:
        url = https://view.eumetsat.int/geoserver/wms
        layers = "mtg_fd:ir105_hrfi|Infrared", "mtg_fd:rgb_truecolour|True colour"
        frames = 12               # animation frames (2 to 36)
        step_minutes = 10         # minutes between two frames (5 to 60)
        latency_minutes = 30      # publication delay of EUMETSAT images (0 to 240)
        frame_delay = 400         # ms between two frames (100 to 5000)
```

Terms of use (the credits are already shown):

- **Open-Meteo**: free for non-commercial use, CC BY 4.0 attribution.
- **Windy**: free embed widget, no key; no automatic start of the animation, dark theme only.
  The Windy map API requires a paid key.
- **RainViewer**: free API for personal or educational use, attribution required; since
  January 2026: past only, a single colour scheme, zoom 7 max., 100 requests/minute per IP
  (one animation uses about 52).
- **EUMETSAT**: images under CC BY 4.0 licence, credit "Contains modified EUMETSAT Meteosat
  data".
- **Basemap** (RainViewer and EUMETSAT maps, `[[basemap]]`, see below): OpenStreetMap (tile
  usage policy: reasonable use, attribution), Esri, OpenTopoMap (CC-BY-SA) or CARTO (API key
  required since 2026).
- **Leaflet** (BSD-2, used only by RainViewer and EUMETSAT) is included in
  `vendor/leaflet/`; if it is missing, it is loaded from cdnjs.

### Basemap of the RainViewer and EUMETSAT maps (`[[basemap]]`)

Since summer 2026 CARTO requires an API key for its basemaps (without a key: "API KEY
REQUIRED" watermark); the basemap is therefore configurable (no effect on the Windy maps):

```ini
    [[basemap]]
        provider = osm      # osm, esri, opentopomap or carto
        key = ""            # CARTO key (provider = carto only)
```

| `provider` | Basemap | Key | Dark theme |
|---|---|---|---|
| `osm` (default) | standard OpenStreetMap | no | darkened basemap (filter) |
| `esri` | Esri light grey / dark grey, place names above the satellite (rendering close to the former CARTO) | no | dark grey |
| `opentopomap` | OpenTopoMap (relief) | no | darkened basemap (filter) |
| `carto` | CARTO light / dark | yes (free for personal use, via [carto.com/basemaps](https://carto.com/basemaps)) | dark |

`provider = carto` without a key, or an unknown value, falls back to `osm` (message in the
log).

EUMETView layer names may change: up-to-date list in the
[GetCapabilities](https://view.eumetsat.int/geoserver/ows?service=WMS&version=1.3.0&request=GetCapabilities).

### Webcam (`[[webcam]]`)

The **"Webcam"** menu opens the `webcam.html` page: images (jpg, png, gif, webp) and videos
(mp4, webm…) one below the other, in the order of the `[[webcam]]` subsections.

```ini
[LiveJSON]
    [[webcam]]
        refresh = 60                  # images: default reload interval (s); 0 = never
        [[[lake]]]
            title = View of the lake
            url = https://example.org/webcam/lake.jpg
            caption = Facing north-east         # optional
        [[[garden]]]
            title = Garden
            url = img/garden.jpg      # file placed in skins/WeewxLive/img/
            admin = true              # admin mode only
        [[[timelapse]]]
            title = Today's timelapse
            url = https://example.org/webcam/timelapse.mp4
            autoplay = true           # automatic playback, muted, looped
```

- `url`: `https://…` address, absolute path (`/webcam/lake.jpg`) or path relative to the
  site.
- `type = image | video`: optional, derived from the extension (`.mp4`, `.webm`, `.mov`…:
  video).
- `admin = true`: item shown only in [admin mode](#admin-mode-reserved-parameters) ("admin"
  badge). The "Webcam" menu only appears if the visitor can see at least one item; without
  any subsection, no menu.
- Images reloaded every `refresh` seconds (option of the item or of `[[webcam]]`), without
  flicker, and immediately when returning to the tab; time of the last load shown; click on
  the image: opens full size in a new tab. Missing file: "Image unavailable".
- Videos: browser player (muted by default). The mp4 format must be H.264 to be played by
  all browsers.
- Simple hiding for admin items: their addresses remain readable in `config.json`.

### Lightning (`[[lightning]]`)

The **"Lightning"** menu opens in a new tab the real-time lightning map of
[Blitzortung](https://maps.blitzortung.org), centred on the station
(`https://maps.blitzortung.org/en/#7/<latitude>/<longitude>`, in the page language).
Coordinates: those of `[Station]` in `weewx.conf`, or `[[forecast]] latitude / longitude`.

```ini
[LiveJSON]
    [[lightning]]
        enable = true     # false: no "Lightning" menu
        zoom = 7          # map zoom level (2 to 12)
```

### Weather warnings (MeteoAlarm, NWS, ECCC)

[MeteoAlarm](https://meteoalarm.org) (EUMETNET) gathers the warnings of the European national
weather services (Météo-France, MeteoSwiss, DWD, Aeronautica Militare…). weewx downloads the
JSON feed of each country concerned (`https://feeds.meteoalarm.org/api/v1/warnings/feeds-<country>`),
at most once per `cache` (5 minutes by default), and publishes in `data/warnings.json` the
**yellow, orange and red** warnings in force or upcoming for each configured location; the
pages re-read this file every 5 minutes.

- **Dashboard**: when a warning is in force, a row of **pills** appears at the top of the
  page, below the station name: one pill per level and per phenomenon, in the colour of its
  level (e.g. "Thunderstorms" and "Flooding" in yellow, "Avalanches" in orange). When several
  locations are configured, each pill gives the locations concerned, grouped when they have
  the same warning (e.g. "Thunderstorms (Sciez, Aosta Valley)" in yellow). Tooltip: level,
  phenomenon, end of the warning for each location. Nothing is shown when there is no warning
  (green level).
- **A click on a pill** opens the **"Weather warnings"** page (at the location's section when
  the pill concerns only one) (`vigilance.html`, also in the
  "Forecasts" menu): for each location, highest level, then each warning **in progress** and
  **upcoming**: level and location (pill at the top of the frame, e.g. "Orange warning ·
  Sciez"), phenomenon, period (start and end, in station time), official name,
  headline, description, instructions, area, issuing service, publication date, severity /
  certainty / urgency, link to the weather service website. The texts are those of the
  service, in the page language when the feed provides it, otherwise in English. At the
  bottom of the page: meaning of the levels.
- Expired, cancelled or updated (replaced) warnings are not shown. If a country does not
  provide the phenomenon type (MeteoSwiss), it is derived from the warning name.
- Level colours: yellow `#f9e400`, orange `#f7a401`, red `#e71919` (variables `--wa-2`,
  `--wa-3`, `--wa-4` of `style.css`).

```ini
[LiveJSON]
    [[meteoalarm]]
        enable = true
        cache = 300            # s between two downloads of a country (60 to 3600)
        min_level = 2          # minimum level shown: 2 yellow, 3 orange, 4 red
        # timeout = 20         # MeteoAlarm response timeout (s, 5 to 120)
        [[[home]]]
            title = Sciez
            country = france   # or fr
            area = Haute-Savoie
        [[[geneva]]]
            title = Geneva
            country = switzerland
            latitude = 46.20
            longitude = 6.15
        [[[aosta]]]
            title = Aosta Valley
            country = it
            region = IT004
```

| Location option | Role |
|---|---|
| `title` | displayed name (pills, page) |
| `country` | country of the feed: English name (`france`, `switzerland`, `italy`, `germany`, `austria`, `united-kingdom`…) or ISO code (`fr`, `ch`, `it`, `de`, `at`, `gb`…) |
| `region` | CAP area code(s) of the feed, separated by commas: NUTS3 for France (e.g. `FR825` for Var), `EMMA_ID` in most other countries (e.g. `IT004`) |
| `area` | area name(s) of the feed (`areaDesc`, e.g. `Haute-Savoie`, `Valle d'Aosta`), case-insensitive |
| `latitude`, `longitude` | point inside the area polygons: for countries whose warnings only have polygons (Switzerland) |

- Without `region`, `area` or `latitude` / `longitude`, the station coordinates are used
  (areas described by polygons only).
- Area codes and names: those of the country feed (open
  `https://feeds.meteoalarm.org/api/v1/warnings/feeds-france` in the browser and look for
  `areaDesc`), or the map of [meteoalarm.org](https://meteoalarm.org).
- Without any location: no download, no pills, no menu entry.
- Download failure: the previous copy is kept (message on the page), new attempt after
  `cache` seconds; message in the weewx log (`livejson:`).
- Updates follow the report generation: at each weewx archive (every 5 minutes with
  `archive_interval = 300`); with a longer interval, warnings are refreshed at the same pace.
- Terms of use: data from MeteoAlarm / national weather services, source credited on the
  page; non-commercial use.

#### United States (NWS) and Canada (ECCC)

A location can use another source than MeteoAlarm with the `source` option; the pills, the
"Weather warnings" page and the levels work the same way, and locations of different sources
can be mixed.

```ini
    [[meteoalarm]]
        [[[minneapolis]]]
            title = Minneapolis
            source = nws          # National Weather Service (United States)
            latitude = 44.98
            longitude = -93.27
        [[[montreal]]]
            title = Montréal
            source = eccc         # Environment and Climate Change Canada
            latitude = 45.50
            longitude = -73.57
```

| `source` | Service | Location | Levels |
|---|---|---|---|
| `meteoalarm` (default) | [MeteoAlarm](https://meteoalarm.org), Europe | `country` + `region` / `area` / `latitude`, `longitude` | `awareness_level` of the warning (yellow, orange, red) |
| `nws` | [National Weather Service](https://www.weather.gov/documentation/services-web-API) (`api.weather.gov/alerts/active`) | `latitude`, `longitude` (point query), or `region` = NWS zone or county codes (e.g. `MNZ060`, `MNC053`) | Advisory, Watch: yellow; Warning: orange; Emergency or `Extreme` severity: red (statements are not shown) |
| `eccc` | [Environment and Climate Change Canada](https://api.weather.gc.ca/collections/weather-alerts) (MSC GeoMet, `weather-alerts`) | `latitude`, `longitude` (point inside the alert regions) | risk colour of the alert (yellow, orange, red; statements are not shown) |

- Without `latitude` / `longitude` (and, for NWS, without `region`), the station coordinates
  are used. `country` is not used by these two sources.
- NWS: texts in English (event, headline, description, instructions); one request per location
  and per `cache`, with a User-Agent identifying weewx-live, as required by the NWS.
- ECCC: texts in French when the pages are in French, otherwise in English; "Severity" and
  "Certainty" show the impact and the confidence given by ECCC; link to weather.gc.ca /
  meteo.gc.ca.
- Phenomenon derived from the warning name (e.g. "Winter Storm Warning": snow / ice; "Wind
  Chill Advisory": low temperature). Two types exist only for these sources: tornado and
  tropical cyclone (hurricane, tropical storm).

## 7. This day and this month over the years

At the bottom of the dashboard, two panels for today's date and the current month: records of
each year since the start of the data (warmest / coldest mean, extreme temperatures and
pressures, warmest / coldest day of the month, wettest / driest, windiest), the current value
alongside (highlighted if it beats the record, "provisional" for a mean in progress), and
charts per year (Hi-Low bars coloured by mean, precipitation). Data: `data/climate.json`
(daily summaries); today's values are completed with the current measurements.

## 8. Detail pages

`detail.html?p=<parameter>` (or the identifier of a group). The page shows the periods one
below the other (statistics then chart); anchors: `#p24h`, `#p7d`, `#p30d`, `#p365d`,
`#p730d`.

| Period | Window | Chart |
|---|---|---|
| 24 h | rolling 24 h | archive readings |
| 7 days | 7 calendar days, today included | hourly means + min–max |
| 30 days | 30 calendar days | daily means + min–max (temperature: Hi-Low bars) |
| 365 days | 365 calendar days | same |
| 730 days | 730 calendar days (2 years) | same (rain: monthly totals) |

| Parameter | Statistics |
|---|---|
| Temperature | minimum, maximum (date and time), mean, range; frost days (min. < 0 °C) and hot days (max. ≥ 25 °C) from 7 days |
| Humidity | minimum, maximum, mean |
| Pressure | minimum, maximum, mean, range |
| Wind | mean wind, max. wind, max. gust, prevailing direction (mean vector) |
| Rain | total, max. rate; rain days (≥ 0.2 mm) and daily maximum from 7 days, max. in 1 h and rain hours over 24 h |
| Group | min. / max. / mean table per measurement |

Extremes and means come from the weewx daily summaries; daily series are read with one query
per measurement, fast even on a Raspberry Pi. Regeneration frequencies: `stale_age` in
`skin.conf`; thresholds (frost, heat, rain) at the top of `bin/user/livejson.py`.

### Period pages (all parameters)

`detail.html?period=24h` (or `7d`, `30d`, `365d`), at the top of the "Data" menu ("All
parameters"): one section per parameter, identical to that of the detail page for this
period (statistics then chart), with quick links to each section at the top of the page.
The title of each section leads to the parameter's detail page. The data come from the same
files `data/p24h.json`… (only one file read per page).

### Archives (day, month, year pages)

Static pages generated in `archive/` (sections `[[SummaryByDay]]`, `[[SummaryByMonth]]` and
`[[SummaryByYear]]` of `skin.conf`), reached through the **"Archives"** entry of the "Data"
menu (page of the current day, or of the month / year if day pages are disabled):

| Page | Template | Content |
|---|---|---|
| `archive/day-YYYY-MM-DD.html` | `archive/day-%Y-%m-%d.html.tmpl` | all dashboard panels for that day: min. and max. with time, totals, chart from 0:00 to 24:00, wind rose; large values: daily means (temperature, wind, humidity, pressure, added parameters such as radiation), prevailing wind of the day (most frequent direction, calm excluded), daily totals; no 1 h / 24 h changes, instantaneous gust or rain rate, or pressure trend |
| `archive/month-YYYY-MM.html` | `archive/month-%Y-%m.html.tmpl` | one section per parameter (statistics then day-by-day chart), like the period pages |
| `archive/year-YYYY.html` | `archive/year-%Y.html.tmpl` | same, over the year |

On these pages, panel and section titles are not links to the detail pages (`detail.html`),
which show the current period and not the archived date; the common menu remains
available.

At the top of each page: **"Station history — pick a date:"** (calendar) and **Day / Month /
Year** buttons that open the page of the day, month or year containing the chosen date
(Enter: same page type as the page shown). The picker is limited to the period covered by
the database; a date without a "day" page (older than the `days` limit) shows a message
suggesting "Month" or "Year". Then previous / next links. No real time, no "Sun and Moon",
no forecasts and no maps.

The data are embedded in each page (no JSON file to read). The page of the current period is
regenerated at each archive; those of past periods are produced only once (if the file does
not already exist).

```ini
    [[archives]]
        day = false       # "day" pages (disabled by default; true to enable them)
        month = true      # "month" pages (all, since the start of the database)
        year = true       # "year" pages (all)
        climato = true    # monthly and yearly climatological tables (all)
        climato_method = civil   # civil (0:00 to 24:00) or omm (WMO UTC windows), see below
        days = 0          # "day" pages produced going back from today (0 = all, default)
```

**"Day" pages disabled by default** (since 2.03): with `day = false`, the "Archives" entry
opens the page of the current month, the date picker offers "Month" and "Year", and the day
icon of the monthly climatological table does not appear. To enable them, set `day = true`
in `[[archives]]`, preferably in `weewx.conf` (`[[WeewxLive]]` → `[[[LiveJSON]]]` →
`[[[[archives]]]]`, see
[Keeping your settings](#keeping-your-settings-across-updates-weewxconf)), otherwise the next
update disables them again. "Day" pages already generated stay in `HTML_ROOT` and on the
server.

With `day = true` and `days = 0`, the first generation produces a page for every day in the database
(several thousand for a database of several years, about 40 to 90 KB each): it can take
some time and the first FTP upload will be large; later generations only produce the page of
the day. To limit it, for example, to the last 365 days: `days = 365`. These options are
applied by the skin generator (`user.livejson.LiveCheetahGenerator`, the weewx Cheetah
generator with these options), declared in `[Generators]` of `skin.conf`.

The old `[[day_pages]]` section (`enable`, `days`, versions 1.41-1.42) is still recognised;
the old `days/` folder of those versions can be deleted from the server.

### Monthly climatology

`archive/climato-YYYY-MM.html` (template `archive/climato-%Y-%m.html.tmpl`, section
`[[SummaryByMonth]]`, option `climato` of `[[archives]]`), **"Climatology"** → **"Monthly
climatology"** menu (current month). One table per month, one row per day (from 0:00 to
24:00):

| Column | Value | Colour |
|---|---|---|
| Day | number; the icon opens the day's archive page (if it exists) | — |
| Temperature min. / mean / max. | weewx daily summaries | the site's 3 °C steps (`TEMP_STEPS`) |
| Mean wind (max. gust) | mean speed of the day, strongest gust | grey, darker as the wind is stronger (relative to the month) |
| Sector | direction of the mean wind vector (8 sectors) | — |
| Rain | total of the day | pale green → blue → purple |
| Humidity, Pressure | daily means | yellow → green → cyan; cyan (low) → green → yellow (high) |

In bold: lowest and highest temperature and strongest gust of the month. Last row "Month":
minimum, mean and maximum, mean wind (max. gust), prevailing sector, total rain, mean
humidity and pressure. A column without data (no barometer…) is hidden. At the top: choice
of month and year ("Show"), previous / next month, links to the month's charts and to the
year's climatological table. The archive "month" pages have a "Monthly climatological table"
link. On small screens, the table scrolls horizontally ("Day" column fixed).

Pressure colours assume hPa (automatic conversion from inHg, mmHg, kPa); rain colours, mm
(conversion from in and cm).

### Calculation method of the climatological tables (`climato_method`)

Option `climato_method` of `[[archives]]` (applies to the monthly and yearly tables):

| Value | Climatological day |
|---|---|
| `civil` (default) | from 0:00 to 24:00, station time, for all columns, from the weewx daily summaries |
| `omm` | WMO hourly rules (Météo-France practice) for temperature and rain, in UTC hours: **Tn** of day D = minimum from D-1 18:00 to D 18:00; **Tx** and **rain (RR)** of day D = maximum and total from D 06:00 to D+1 06:00; **mean temperature** = mean of the 8 three-hourly readings (00, 03, 06 … 21:00) — per day (at least 6 readings out of 8) and, for the month and the year, mean of all readings. Wind, humidity and pressure are still computed from 0:00 to 24:00. |

With `omm`, values are computed on the **archive records** (the weewx daily summaries are cut
from midnight to midnight): Tn and Tx come from the `lowOutTemp` / `highOutTemp` columns if
the database has them, otherwise from `outTemp`, mean of each archive interval (usually
5 min): extremes may then be slightly less marked than with the `civil` method, which uses
instantaneous extremes. A three-hourly reading is the record closest to the synoptic hour
(within 10 min, or half an archive interval). In the yearly tables, frost, ice, hot and rain
days are counted on these same Tn, Tx and RR. The method used is recalled below each table.

**Provisional values**: as long as a day's window is not closed at the latest archive, its
Tn, Tx and rain are shown *in italics with an asterisk* (tooltip: time at which the value
becomes final). `omm` method: Tn final the same day at 18:00 UTC, Tx and rain the next day at
06:00 UTC; `civil` method: at midnight. The "Month" row is marked the same way for the
columns concerned. In the yearly table, the row of the current month (and the "Year" row)
stays provisional until the last day of the month is final. With `omm`, the table of the
month (or year) that has just ended is regenerated once, after the 1st at 06:00 UTC, to
record the final values of its last day (weewx never rebuilds the page of a past period by
itself).

Pages of past months and years are generated only once: after changing the method, delete
the `archive/climato-*.html` files of `HTML_ROOT` to rebuild them.

### Yearly climatology

`archive/climato-YYYY.html` (template `archive/climato-%Y.html.tmpl`, section
`[[SummaryByYear]]`, same option `climato`), **"Climatology"** → **"Yearly climatology"**
menu (current year). Three tables, one row per month (months without data show "—") and a
"Year" row; the icon to the left of the month opens the monthly table:

| Table | Columns |
|---|---|
| Temperature | mean, mean of minima, minimum, mean of maxima, maximum (`TEMP_STEPS` colours); ice days (max. ≤ 0 °C), frost days (min. < 0 °C), hot days (max. > 30 °C) |
| Rain | total (pale green → blue → purple), rain days (≥ 0.2 mm), days ≥ 10 mm |
| Wind | mean wind, highest mean speed over an archive interval ("10 min wind" if `archive_interval = 600`), maximum gust (grey relative to the year) |

In bold: extremes of the year. At the top: choice of year, previous / next year, link to the
year's charts; the archive "year" page has a "Yearly climatological table" link. Thresholds
are in `livejson.py` (`CLIMATO_ICE_C`, `CLIMATO_HEAT_C`, `CLIMATO_HEAVY_MM`, `FROST_C`,
`RAIN_DAY_MM`) and apply in °C and mm whatever the displayed units.

## 9. "Extremes" page (station records)

**Data → Extremes** (`extremes.html`): calculations made by weewx over **the whole
database** (`data/extremes.json`, at most once an hour).

- **All-time records**: lowest / highest temperature, lowest / highest pressure, strongest
  gust (date and time), heaviest rain in one day (date).
- **Days**: coldest and warmest days (mean temperature, days measured at least
  `min_day_coverage`, today excluded), wettest days, and heaviest showers (heaviest rain over
  one local clock hour, one per day).
- **Months** (complete, current month excluded): coldest, warmest, wettest, driest.
- **Spells**:
  - frost: temperature continuously < 0 °C according to the archive records (duration,
    start, end, mean, minimum); a gap in the data ends the spell;
  - dry: consecutive days without measured rain;
  - wet: consecutive days with at least `rain_day_threshold` mm, total rain.
  A day without data, or measured less than `min_day_coverage`, breaks the series.

```ini
    [[extremes]]
        top = 10                    # rows per ranking (3 to 50)
        rain_day_threshold = 0.2    # mm (value included): day of a wet spell
        min_day_coverage = 0.75     # fraction of the day measured (0 to 1; "75" = 75 %)
```

## 10. Ensemble forecasts (`ensembles.html`)

**"Forecasts" → "Ensembles"** menu. An ensemble forecast is computed several times (the
"members") with slightly different initial conditions: their spread measures the
uncertainty. The page gathers the members of several models of the
[Open-Meteo Ensemble API](https://open-meteo.com/en/docs/ensemble-api) (layout inspired by
the "Open-Meteo forecasts" page of Météo Sciez and by the digitalurban scripts):

- **model buttons** (click to remove / add back a model; at least one stays shown) and
  **horizon** (3, 7, 10, 16 days); the choice is remembered by the browser;
- **Temperature, Mean wind, Pressure — every member**: a thin curve per member, in the colour
  of its model, the **combined mean** (all members of the displayed models) and the
  **10–90 %** band; the tooltip also gives the mean of each model;
- **Rain — daily total and probability**: combined mean (blue bar), 90th percentile (grey
  bar), mean of each model (dots), and percentage of members forecasting at least
  `rain_threshold` mm;
- **Model comparison** over the horizon (means of max. / min., rain, wind, pressure, warmest
  / coolest) and **day after day** (mean, 10–90 % range and extremes, chance of rain,
  temperature and rain confidence, wind, pressure; "3/5" when some models do not reach that
  day).

weewx downloads each model at most once per `cache` (3 h; models are recomputed every 6 to
12 h) and publishes in `data/ensembles.json` the temperature, wind and pressure members (one
point every `step` hours) and the daily values of each member (max., min., rain, max. wind,
mean pressure, local station day): about 1 MB for the 5 default models (207 members) with
`step = 1`, 400 KB with `step = 3`. The browser does all the calculations, according to the
ticked models and the horizon.

```ini
    [[ensembles]]
        enable = true
        models = ecmwf_ifs025, gfs_seamless, icon_seamless_eps, gem_global, google_weathernext2_ensemble
        days = 16                 # downloaded range (1 to 35, limited by each model)
        horizons = 3, 7, 10, 16   # horizon buttons (days, 1 to 35)
        default_horizon = 10      # horizon shown first (otherwise the first button)
        step = 1                  # hours between two curve points (1, 2, 3, 4 or 6)
        cache = 10800             # seconds (1800 to 86400)
        rain_threshold = 0.2      # mm: "measurable" rain (chance of rain)
        # timeout = 30            # Open-Meteo response timeout (s, 5 to 120)
        # latitude / longitude: by default those of [[forecast]] or [Station]
```

Available models (identifier, members, range): `ecmwf_ifs025` (ECMWF ENS, 51, 15 d),
`ecmwf_aifs025_ensemble` (ECMWF AIFS, AI, 51, 15 d), `gfs_seamless` (NOAA GEFS, 31, 16 d and
more), `icon_seamless_eps` (DWD ICON EPS, 40, 7.5 d), `icon_eu_eps` (40, 5 d), `icon_d2_eps`
(20, 2 d), `gem_global` (ECCC GEPS, 21, 16 d), `google_weathernext2_ensemble` (Google
WeatherNext 2, AI, 64, 15 d), `ukmo_global_ensemble_20km` (Met Office, 18, 8 d),
`ukmo_uk_ensemble_2km` (5 d), `bom_access_global_ensemble` (BOM, 18, 10 d), `ncep_gefs025`,
`ncep_gefs05`, `ncep_aigefs025`, `ecmwf_ifs_europe_ensemble`, `meteoswiss_icon_ch1`,
`meteoswiss_icon_ch2`… (full list in the Open-Meteo documentation). The wrong identifiers of
versions 1.49 to 1.52 (`ecmwf_ifs_025`, `weathernext_ensemble_2`…) are converted
automatically. A model unknown to the extension is accepted and shown under its identifier.
More models = more members to draw and a larger `ensembles.json`.

Each model is requested at most up to its own range (`days` is limited for each one); if
Open-Meteo still refuses the range (error 400), the extension keeps the limit given in the
response and sends the request again; likewise, a variable refused for a model (pressure,
for example) is removed for that model. The bottom of the page shows the version of the
extension that computed `data/ensembles.json` (after an update, restart weewx; the file is
recomputed at most every 30 minutes). The error reason returned by Open-Meteo is written to
the weewx log.

Free use of the Open-Meteo API is reserved for non-commercial use (one request per model
and per cache period). For models with a 6 h step, daily min. / max. are computed on 4
values and are therefore less precise.

## 11. Meteogram (`meteogram.html`)

**"Forecasts" → "Meteogram"** menu: hourly forecast of one model of the Open-Meteo forecast
API, from now up to `days` days, in panels aligned on the same time axis (a shared crosshair
and tooltip). A **drop-down list** at the top of the page lets you choose the model among
those of `models` (at most 5); the choice is remembered by the browser (direct link possible:
`meteogram.html?model=gfs_seamless`). A model whose download failed appears as
"(unavailable)" in the list.

| Panel | Content |
|---|---|
| Icons | forecast weather (WMO codes), every 1 to 6 h depending on the width |
| Temperature at 2 m | curve coloured by temperature (3 °C steps), min. and max. of each day |
| Cloud cover by altitude | clouds (grey, darker = more overcast), altitude of the 0 °C isotherm (dashes), up to `top_clouds` m |
| Precipitation | amount per hour (bars), of which showers; **cumulative curve** since the start of the forecast (right scale, in mm); total of the period in the title |
| Snow | snowfall per hour and snow depth (otherwise "no snow expected") |
| Temperature and wind aloft | temperature (blues below 0 °C, yellow to red above), isotherms every 2 °C, 0 °C isotherm as a thick line, wind arrows (where it blows to, length by strength), up to `top_temperature` m |
| Wind at 10 m | mean wind, gusts (strongest gust of each day), direction |

The upper-air cross-sections are interpolated, hour by hour, between the ground value and the
model's pressure levels (1000 to 200 hPa, geopotential height); in these panels the tooltip
also gives the temperature, cloud cover and wind at the altitude pointed at. On small
screens the meteogram scrolls horizontally.

```ini
    [[meteogram]]
        enable = true
        # models of the drop-down list (at most 5) and model shown by default
        models = icon_seamless, meteofrance_seamless, ecmwf_ifs025, gfs_seamless, ukmo_seamless
        model = icon_seamless     # ICON-D2 (2 d), then ICON-EU (5 d), then ICON global
        days = 4                  # 1 to 16 days (limited by each model's range)
        cache = 3600              # seconds (600 to 86400)
        top_clouds = 12000        # m, top of the cloud panel (3000 to 16000)
        top_temperature = 4500    # m, top of the temperature / wind panel (1500 to 12000)
        # timeout = 30            # Open-Meteo response timeout (s, 5 to 120)
        # latitude / longitude: by default those of [[forecast]] or [Station]
```

Possible models (Open-Meteo identifiers): `icon_seamless` (DWD ICON-D2, then ICON-EU, then
global), `meteofrance_seamless` (AROME, then ARPEGE; 4 days), `ecmwf_ifs025`,
`gfs_seamless`, `ukmo_seamless` (Met Office UK 2 km, then global), `best_match`,
`gem_seamless`, `meteoswiss_icon_ch2`… If `days` exceeds a model's range, the limit given by
Open-Meteo is used for that model. Not all models provide all upper-air variables (cloud
cover per level, for example): missing values leave the area empty.

Quota: each model is downloaded at most once per `cache`; one request counts as about eight
calls in the Open-Meteo free quota (about 80 variables), i.e. about 1,000 calls per day for
5 models with the one-hour cache (free limit: 10,000 per day). `data/meteogram.json` weighs
about 150 KB for 5 models over 4 days.

## 12. Temperature colours

The scales are defined only once in **`minichart.js`** (`window.TempScale`):

| Scale | Used by |
|---|---|
| `TEMP_STOPS` (continuous) | Hi-Low bars of the detail pages (30 / 365 / 730 d) and "over the years", `legend()` legend |
| `TEMP_STEPS` (3 °C steps) | temperature curves (dashboard, 24 h / 7 d detail, hour-by-hour forecasts, parameters in °C), figures of the Temperature panel, of the forecasts and of the Extremes page, `stepLegend()` legend |

```js
const TEMP_STOPS = {
  light: [[-10, "#0b2a7a"], [-5, "#1a4fc4"], [0, "#5b9be8"],                 // ≤ 0 °C: blues
          [0, "#2e8b57"], [10, "#7cb342"],                                    // 0 – 10 °C: greens
          [10, "#e6b800"], [20, "#f28c1e"], [27, "#e8501a"], [33, "#c81e1e"], [40, "#7a0a0a"]],  // yellow → red
  dark:  [ … same steps, lighter shades … ],
};
const TEMP_STEPS = {
  // [upper bound included, colour]
  light: [[-9, "#0b2a7a"], [-6, "#1640a8"], [-3, "#2463d0"], [0, "#5b9be8"],        // ≤ 0 °C: blues
          [3, "#2e8b57"], [6, "#4f9e48"], [10, "#7cb342"],                           // 0 – 10 °C: greens
          [13, "#e6c200"], [16, "#e6a800"], [19, "#f29400"], [22, "#f27f1e"], [25, "#ec6a1a"],
          [28, "#e5531a"], [31, "#d9381a"], [34, "#c81e1e"], [37, "#a51212"], [40, "#7a0a0a"]],  // yellow → red
  dark:  [ … same bands, lighter shades … ],
};
```

- `TEMP_STOPS`: `[temperature, colour]` in increasing order, colour interpolated between two
  steps; two steps at the same temperature (0 and 10 °C) create a sharp break.
- `TEMP_STEPS`: a value takes the colour of the first band whose bound is ≥ the value (0 °C
  blue, 0.1 °C green, 10 °C green, 10.1 °C yellow; above 40 °C, last colour). The 6 – 10 °C
  band is 4 °C wide so that the greens stop at 10 °C.
- The colour of a figure is computed on the rounded displayed value.
- Figures and curves keep 95 % of the band colour, mixed with 5 % of the text colour
  (`TempScale.textColor`, `TempScale.lineColor`).
- Change the `light` and `dark` sets together; if the bounds change, also adapt the legend
  ticks (`legend()`, `stepLegend()`).
- Reinstalling the extension replaces `minichart.js`: note your changes.

## Notes

- weewx versions: **weewx 4.6.0 or later**, under Python 3. Tested (version 2.05) with
  weewx 4.6.0, 4.6.2, 4.7.0, 4.8.0, 4.10.2, 5.0.0, 5.3.1 and 5.5.2: installation, generation
  and pages without errors, in French and German. weewx 4.5 and earlier are not suitable
  (Cheetah generator of a different form, no `lang/` language files). With weewx 4, move
  `[[WeewxLive]]` before `[[FTP]]` / `[[RSYNC]]` by hand (see section 1).
- Missing sensor (no solar sensor, etc.): the matching card stays at "--".
- Accessibility: charts announced as images with a description, keyboard-usable menu
  (arrows, Home / End, Esc), banners announced to screen readers.
- Out-of-range configuration values are brought back within their bounds (e.g. `top`,
  `zoom`, `frame_delay`); configuration errors are written to the weewx log (`livejson:`).
