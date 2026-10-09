# -*- coding: utf-8 -*-
"""
weewx-live — extension de liste de recherche (SearchList) pour weewx 4.x / 5.x

Fournit aux gabarits Cheetah du skin « WeewxLive » :

  $livejson_history        JSON : séries des dernières 24 h + extrêmes et cumuls du jour
  $livejson_config         JSON : configuration de la page (MQTT, paramètres, prévisions…)
  $livejson_config_inline  idem, prêt à être intégré dans un <script> (index.html.tmpl)
  $livejson_forecast       JSON : prévisions Open-Meteo de plusieurs modèles (cache en
                           mémoire, 1 h par défaut)
  $livejson_meteogram      JSON : météogramme Open-Meteo multi-modèle (sol et altitude)
  $livejson_ensembles      JSON : prévisions d'ensemble Open-Meteo (membres de chaque modèle)
  $livejson_climate        JSON : « ce jour / ce mois au fil des ans »
  $livejson_extremes       JSON : records de la station (page « Extrêmes »)
  $livejson_astro          JSON : soleil et lune du jour (almanach weewx)
  $livejson_day, $livejson_span, $livejson_arch : pages d'archives (archive/day-AAAA-MM-JJ,
                           month-AAAA-MM, year-AAAA.html : SummaryByDay / Month / Year)
  $livejson_climato, $livejson_climato_year : tableaux climatologiques mensuel et annuel
                           (archive/climato-AAAA-MM.html, climato-AAAA.html)
  $livejson_period.p24h …  JSON : pages de détail (24 h, 7, 30, 365 et 730 jours)
  $livejson_params, $livejson_station, $livejson_logo, $livejson_hardware,
  $livejson_dash_order, $livejson_refresh, $livejson_fc_days : valeurs pour les gabarits
                           HTML (index.html.tmpl, pages d'archives)
  $livejson_tz             fuseau horaire de la station, chaîne JSON (wxtime.js.tmpl)

Le générateur LiveCheetahGenerator applique l'option [[archives]] (types de pages
d'archives produits, nombre de pages « jour »).

Les fichiers sont régénérés par weewx à chaque période d'archive (ou selon stale_age),
puis envoyés sur le serveur web public par le rapport FTP/RSYNC habituel de weewx : le
serveur weewx n'a pas besoin d'être joignable depuis internet.

Les valeurs sont converties en °C, km/h, mm, mm/h, hPa, W/m², %… quel que soit le système
d'unités de la base (paramètres standard et groupes d'unités de GROUP_TARGET ; les autres
mesures sont publiées dans l'unité de la base).
"""

import bisect
import calendar
import datetime
import html
import re
import json
import logging
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import weewx
import weewx.almanac
import weewx.units
import weewx.xtypes
from weewx.cheetahgenerator import CheetahGenerator, SearchList
from weeutil.config import accumulateLeaves
from weeutil.weeutil import TimeSpan, archiveDaySpan, getFileName, to_bool

log = logging.getLogger(__name__)

VERSION = "1.88"

# Périodes des pages de détail : nom -> (nombre de jours civils, résolution des séries)
PERIODS = {
    "24h": (1, "raw"),      # 24 h glissantes, enregistrements d'archive bruts
    "7d": (7, "hour"),      # 7 jours civils (aujourd'hui inclus), agrégats horaires
    "30d": (30, "day"),     # 30 jours, agrégats journaliers (résumés journaliers weewx)
    "365d": (365, "day"),   # 365 jours, agrégats journaliers
    "730d": (730, "day"),   # 730 jours (2 ans), agrégats journaliers
}

# Statistiques sur la période : (observation, agrégats)
PERIOD_AGGREGATES = (
    ("outTemp", ("min", "max", "avg")),
    ("outHumidity", ("min", "max", "avg")),
    ("barometer", ("min", "max", "avg")),
    ("windSpeed", ("max", "avg")),
    ("windGust", ("max",)),
    ("rainRate", ("max",)),
)

# Séries agrégées : observation -> agrégats (horaires ou journaliers)
SERIES_AGGREGATES = {
    "outTemp": ("min", "max", "avg"),
    "outHumidity": ("min", "max", "avg"),
    "barometer": ("min", "max", "avg"),
    "windSpeed": ("avg",),
    "windGust": ("max",),
    "rain": ("sum",),
}

# Seuils des comptages journaliers
FROST_C = 0.0
HOT_C = 25.0
RAIN_DAY_MM = 0.2      # mm (valeur incluse) : jour de pluie

# observation weewx -> unité cible
TARGET = {
    "outTemp": "degree_C",
    "outHumidity": "percent",
    "barometer": "mbar",            # 1 mbar = 1 hPa
    "windSpeed": "km_per_hour",
    "windGust": "km_per_hour",
    "windDir": "degree_compass",
    "rain": "mm",
    "rainRate": "mm_per_hour",
}

UNIT_LABELS = {
    "outTemp": "°C", "outHumidity": "%", "barometer": "hPa", "windSpeed": "km/h",
    "windGust": "km/h", "windDir": "°", "rain": "mm", "rainRate": "mm/h",
}

# Extrêmes du jour : (observation, agrégats)
DAY_AGGREGATES = (
    ("outTemp", ("min", "max")),
    ("outHumidity", ("min", "max")),
    ("barometer", ("min", "max")),
    ("windSpeed", ("min", "max")),
    ("windGust", ("max",)),
    ("rainRate", ("max",)),
)


# ----------------------------------------------------------------------
# Paramètres affichés (skin.conf : [LiveJSON] [[parameters]])
# ----------------------------------------------------------------------
# Paramètres « standard » : panneaux spécialisés (vent + rafales, pluie + cumul, etc.).
# id : (titre, colonne SQLite, clé MQTT, agrégat par défaut, clé interne des données)
BUILTIN_PARAMS = {
    "outTemp": ("Température", "outTemp", "outTemp", "min-max", "outTemp"),
    "wind": ("Vent", "windSpeed", "windSpeed", "min-max", "windSpeed"),
    "windDir": ("Direction du vent", "windDir", "windDir", "direction", "windDir"),
    "rain": ("Pluie", "rain", "rain", "sum", "rain"),
    "outHumidity": ("Humidité relative", "outHumidity", "outHumidity", "min-max", "outHumidity"),
    "barometer": ("Pression", "barometer", "barometer", "min-max", "barometer"),
}
AGGREGATES = ("min-max", "max", "sum")
GROUP_AGGREGATES = ("min-max", "max")       # agrégats possibles d'un panneau groupé
# couleurs des courbes d'un panneau groupé (palette catégorielle, dans cet ordre)
GROUP_PALETTE = ("--wind", "--temp", "--hum", "--sun", "--press")

WEEKDAYS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
MONTHS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
          "octobre", "novembre", "décembre")

# Phases de la lune (index weewx 0 à 7)
MOON_PHASES = ("Nouvelle lune", "Premier croissant", "Premier quartier", "Gibbeuse croissante",
               "Pleine lune", "Gibbeuse décroissante", "Dernier quartier", "Dernier croissant")

# groupe d'unités weewx -> (unité cible, libellé affiché)
GROUP_TARGET = {
    "group_temperature": ("degree_C", "°C"),
    "group_speed": ("km_per_hour", "km/h"),
    "group_speed2": ("km_per_hour2", "km/h"),
    "group_rain": ("mm", "mm"),
    "group_rainrate": ("mm_per_hour", "mm/h"),
    "group_pressure": ("mbar", "hPa"),
    "group_radiation": ("watt_per_meter_squared", "W/m²"),
    "group_percent": ("percent", "%"),
    "group_direction": ("degree_compass", "°"),
    "group_uv": ("uv_index", ""),
    "group_illuminance": ("lux", "lx"),
    "group_concentration": ("microgram_per_meter_cubed", "µg/m³"),
    "group_moisture": ("centibar", "cb"),
    "group_distance": ("km", "km"),
    "group_altitude": ("meter", "m"),
    "group_volt": ("volt", "V"),
    "group_fraction": ("ppm", "ppm"),
    "group_interval": ("hour", "h"),      # durées en minutes (ex. interval)
    "group_deltatime": ("hour", "h"),     # durées en secondes (ex. sunshineDur, rainDur)
    "group_pressurerate": ("mbar_per_hour", "hPa/h"),
    "group_length": ("cm", "cm"),
    "group_degree_day": ("degree_C_day", "°C·j"),
    "group_energy": ("watt_hour", "Wh"),
}

COLOR_RE = re.compile(r"^--[A-Za-z0-9_-]+$")    # couleur = nom de variable CSS (ex. --temp)


TZ_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_+-]*(?:/[A-Za-z0-9_+-]+)*$")


def _valid_tz(name):
    """Vrai si « name » est un fuseau IANA connu (non vérifiable avant Python 3.9 : accepté)."""
    if not TZ_NAME_RE.match(name):
        return False
    try:
        import zoneinfo
    except ImportError:
        return True
    try:
        zoneinfo.ZoneInfo(name)
        return True
    except Exception:
        return False


def _station_tz(value=None):
    """Fuseau horaire IANA de la station (ex. « Europe/Paris »).

    weewx compte les jours, mois et années en heure locale du système : les pages affichent
    cette même heure, quel que soit le fuseau du visiteur. Ordre : option [LiveJSON]
    timezone, variable TZ, /etc/timezone, lien /etc/localtime ; à défaut, heure fixe du
    moment (Etc/GMT±N, sans changement d'heure) ou None (fuseau du navigateur)."""
    env = os.environ.get("TZ", "").lstrip(":")
    cands = [("timezone", str(value or "").strip()), ("TZ", env)]
    # TZ définie (même au format POSIX, ex. CET-1CEST) : c'est elle que suit weewx, les
    # fichiers du système ne s'appliquent pas
    if not env:
        try:
            with open("/etc/timezone") as f:
                cands.append(("/etc/timezone", f.read().strip()))
        except OSError:
            pass
        link = os.path.realpath("/etc/localtime")
        if "zoneinfo/" in link:
            cands.append(("/etc/localtime", link.split("zoneinfo/", 1)[1]))
    for src, name in cands:
        if name and _valid_tz(name):
            return name
        if name and src == "timezone":
            log.error("livejson: timezone = %s : fuseau inconnu, détection automatique", name)
    off = -(time.altzone if time.localtime().tm_isdst > 0 else time.timezone)
    if off == 0:
        return "UTC"
    if off % 3600 == 0:
        # convention POSIX des noms Etc/ : signe inversé (Etc/GMT-1 = UTC+1)
        log.info("livejson: fuseau horaire non trouvé, heure fixe UTC%+d utilisée", off // 3600)
        return "Etc/GMT%+d" % (-off // 3600)
    log.error("livejson: fuseau horaire non trouvé (option timezone) : heure du navigateur")
    return None


def _int(v, default, lo=None, hi=None):
    """Entier tolérant (valeur absente, « None », texte invalide -> défaut), borné."""
    try:
        r = int(float(v)) if v not in (None, "", "None") else default
    except (TypeError, ValueError):
        r = default
    if lo is not None:
        r = max(lo, r)
    if hi is not None:
        r = min(hi, r)
    return r


def _color(c, default):
    """Couleur d'un paramètre : nom de variable CSS uniquement (sécurité du HTML généré)."""
    c = str(c or "").strip()
    if c and not COLOR_RE.match(c):
        log.error("livejson: couleur « %s » ignorée (attendu : variable CSS, ex. --temp)", c)
        c = ""
    return c or default


def _unit_info(column):
    """(unité cible, libellé, décimales par défaut) d'une colonne, d'après son groupe d'unités
    weewx ; unité cible None si le groupe est inconnu (valeurs publiées sans conversion)."""
    group = weewx.units.obs_group_dict.get(column)
    target, label = GROUP_TARGET.get(group, (None, ""))
    decimals = 0 if group in ("group_percent", "group_radiation", "group_direction") else 1
    return target, label, decimals


def _archive_options(opts):
    """[LiveJSON] [[archives]] : pages d'archives (jour, mois, année). Compatibilité avec
    l'ancienne section [[day_pages]] (enable, days)."""
    old = opts.get("day_pages", {})
    a = opts.get("archives", {})
    return {
        "day": to_bool(a.get("day", old.get("enable", True))),
        "days": _int(a.get("days", old.get("days")), 0, 0, 100000),     # 0 = toutes (défaut)
        "month": to_bool(a.get("month", True)),
        "year": to_bool(a.get("year", True)),
        "climato": to_bool(a.get("climato", True)),    # tableaux climatologiques mensuels et annuels
        # méthode des tableaux climatologiques : civil (journées de 0 h à 24 h, résumés
        # journaliers) ou omm (fenêtres UTC de l'OMM / Météo-France, enregistrements d'archive)
        "climato_method": "omm" if str(a.get("climato_method", "civil")).strip().lower() in ("omm", "wmo") else "civil",
    }


def _parse_params(opts):
    """Liste ordonnée des paramètres à afficher, d'après [[parameters]] (sinon : les 6 standard).

    Une sous-section contenant elle-même des sous-sections décrit un panneau groupé
    (plusieurs mesures dans un même panneau, ex. particules PM1 / PM2.5 / PM10) :
    l'entrée renvoyée a type = "group" et la liste de ses mesures dans « members »."""
    section = opts.get("parameters")
    ids = list(section.sections) if section is not None and section.sections else list(BUILTIN_PARAMS)
    ids = _apply_order(ids, section.get("order") if section is not None else None)
    out = []
    palette = ("--press", "--hum", "--sun", "--temp", "--wind")   # couleurs des paramètres ajoutés
    n_generic = 0
    seen = set()
    for pid in ids:
        sec = section[pid] if section is not None and pid in section else None
        conf = {k: sec[k] for k in sec.scalars} if sec is not None else {}
        if not to_bool(conf.get("enable", True)):
            continue
        if sec is not None and sec.sections:
            grp = _parse_group(pid, sec, conf, seen)
            if grp:
                out.append(grp)
            continue
        b = BUILTIN_PARAMS.get(pid)
        title = conf.get("title", b[0] if b else pid)
        column = conf.get("column", b[1] if b else pid)
        mqtt = conf.get("mqtt", b[2] if b else column)
        agg = str(conf.get("aggregate", b[3] if b else "min-max")).lower().replace("_", "-")
        if b is None and agg not in AGGREGATES:
            log.error("livejson: agrégat « %s » inconnu pour %s (min-max, max, sum)", agg, pid)
            agg = "min-max"
        # panneau spécialisé si paramètre standard avec son agrégat d'origine
        builtin = b is not None and agg == b[3]
        key = b[4] if builtin else pid
        if key in seen or pid in seen:
            log.error("livejson: paramètre %s défini deux fois, ignoré", pid)
            continue
        seen.update((key, pid))
        color = _color(conf.get("color"), "" if builtin else palette[n_generic % len(palette)])
        if not builtin:
            n_generic += 1
        target, label, decimals = _unit_info(column)
        out.append({
            "id": pid, "key": key, "type": "single", "title": title, "column": column, "mqtt": mqtt,
            "aggregate": agg, "builtin": builtin, "target": target,
            "unit": conf.get("unit", label if target else ""),
            "decimals": _int(conf.get("decimals"), decimals, 0, 4),
            "color": color,
            "hint": conf.get("hint", "cumul du jour" if agg == "sum" and not builtin else ""),
        })
    return out


def _apply_order(ids, order):
    """Option « order » de [[parameters]] : identifiants listés d'abord, dans cet ordre,
    puis les autres dans l'ordre des sous-sections. Permet de réordonner depuis weewx.conf,
    où les sections ajoutées se placent après celles de skin.conf."""
    if not order:
        return ids
    if isinstance(order, str):
        order = order.split(",")
    first = []
    for pid in (str(x).strip() for x in order):
        if not pid or pid in first:
            continue
        if pid not in ids:
            log.error("livejson: order : paramètre « %s » inconnu, ignoré", pid)
            continue
        first.append(pid)
    return first + [pid for pid in ids if pid not in first]


def _parse_group(gid, sec, conf, seen):
    """Panneau groupé : [[[gid]]] (titre, agrégat, unité…) + une sous-section par mesure."""
    if gid in seen:
        log.error("livejson: identifiant %s défini deux fois, groupe ignoré", gid)
        return None
    seen.add(gid)
    agg = str(conf.get("aggregate", "min-max")).lower().replace("_", "-")
    if agg not in GROUP_AGGREGATES:
        log.error("livejson: agrégat « %s » non pris en charge pour le groupe %s (min-max, max)", agg, gid)
        agg = "min-max"
    members = []
    for mid in sec.sections:
        m = {k: sec[mid][k] for k in sec[mid].scalars}
        if not to_bool(m.get("enable", True)):
            continue
        if mid in seen or mid == gid:
            log.error("livejson: mesure %s (groupe %s) définie deux fois, ignorée", mid, gid)
            continue
        seen.add(mid)
        column = m.get("column", mid)
        target, label, decimals = _unit_info(column)
        members.append({
            "id": mid, "key": mid, "type": "member", "group": gid,
            "title": m.get("title", mid), "column": column, "mqtt": m.get("mqtt", column),
            "aggregate": agg, "builtin": False, "target": target,
            "unit": m.get("unit", conf.get("unit", label if target else "")),
            "decimals": _int(m.get("decimals", conf.get("decimals")), decimals, 0, 4),
            "color": _color(m.get("color"), GROUP_PALETTE[len(members) % len(GROUP_PALETTE)]),
            "hint": "",
        })
    if not members:
        log.error("livejson: groupe %s sans mesure, ignoré", gid)
        return None
    units = {m["unit"] for m in members}
    unit = conf.get("unit", members[0]["unit"] if len(units) == 1 else "")
    return {
        "id": gid, "key": gid, "type": "group", "title": conf.get("title", gid),
        "column": "", "mqtt": "", "aggregate": agg, "builtin": False, "target": None,
        "unit": unit,
        "decimals": _int(conf.get("decimals"), members[0]["decimals"], 0, 4),
        "color": "", "hint": conf.get("hint", unit), "members": members,
    }


def _round(v, nd=2):
    return None if v is None else round(float(v), nd)


def _convert(vt, obs, target=None):
    """Convertit un ValueTuple (scalaire ou liste) vers l'unité cible de « obs »
    (target : table clé -> unité, par défaut TARGET)."""
    if vt is None or vt.value is None:
        return vt
    unit = (target if target is not None else TARGET).get(obs)
    if unit is None:
        return vt
    try:
        return weewx.units.convert(vt, unit)
    except KeyError:
        # unité inconnue du groupe : on laisse telle quelle
        return vt


def _to_float(v, default=None):
    try:
        return round(float(v), 4)
    except (TypeError, ValueError):
        return default


def _layers(spec):
    """'nom|libellé, nom2|libellé2' (chaîne ou liste configobj) -> [{name, label}]"""
    if isinstance(spec, str):
        spec = spec.split(",")
    out = []
    for item in spec:
        item = item.strip()
        if not item:
            continue
        name, _, label = item.partition("|")
        out.append({"name": name.strip(), "label": (label or name).strip()})
    return out


# ----------------------------------------------------------------------
# Téléchargements Open-Meteo (prévisions, météogramme, ensembles)
# ----------------------------------------------------------------------
# échéance refusée par Open-Meteo (erreur 400 : « … forecast_days … range from 0 to 4 »)
_DAYS_RANGE_RE = re.compile(r"(?i)forecast.?days.*?\b0\s*(?:to|-|…|\.\.)\s*(\d+)")


def _om_fetch(url, timeout):
    """Requête Open-Meteo -> (données, erreur, raison, échéance maximale) : en cas de succès
    (données, None, "", None) ; en cas d'échec, données = None, erreur = message pour le
    journal et le JSON, raison = texte de l'erreur Open-Meteo, échéance maximale = nombre de
    jours annoncé par une erreur HTTP 400 sur forecast_days (sinon None)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "weewx-live/%s" % VERSION})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("error"):
            raise ValueError(data.get("reason", "erreur Open-Meteo"))
        return data, None, "", None
    except urllib.error.HTTPError as e:
        # raison donnée par Open-Meteo ({"error": true, "reason": "…"})
        reason = ""
        try:
            reason = json.loads(e.read().decode("utf-8")).get("reason", "")
        except Exception:
            pass
        m = _DAYS_RANGE_RE.search(reason) if e.code == 400 else None
        return (None, "HTTP %s%s" % (e.code, " : " + reason if reason else ""), reason,
                int(m.group(1)) if m else None)
    except Exception as e:
        return None, str(e), "", None


# ----------------------------------------------------------------------
# Prévisions Open-Meteo du tableau de bord : cache en mémoire du processus weewxd
# (clé = URL de la requête -> (horodatage du téléchargement, données))
# ----------------------------------------------------------------------
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAILY = ("weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum",
                  "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max",
                  "wind_direction_10m_dominant", "sunrise", "sunset", "uv_index_max")
FORECAST_HOURLY = ("temperature_2m", "weather_code", "precipitation", "precipitation_probability",
                   "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "relative_humidity_2m",
                   "is_day")
_FORECAST_CACHE = {}
# dernier échec de téléchargement (clé = URL) : pas de nouvel essai avant FORECAST_RETRY s,
# pour ne pas bloquer chaque rapport quand Open-Meteo est injoignable (délai commun aux
# prévisions, au météogramme et aux ensembles, borné par leur durée de cache)
_FORECAST_FAIL = {}
FORECAST_RETRY = 900
_FORECAST_MAXDAYS = {}   # modèle -> échéance maximale annoncée par Open-Meteo (erreur 400)
# modèles proposés par défaut (liste déroulante des prévisions du tableau de bord)
FORECAST_DEFAULT_MODELS = "best_match, icon_seamless, meteofrance_seamless, ecmwf_ifs025, gfs_seamless"
FORECAST_MAX_MODELS = 5


# ----------------------------------------------------------------------
# Prévisions d'ensemble Open-Meteo (page « Prévisions — Ensembles ») : un téléchargement
# par modèle, au plus une fois par période de cache, en mémoire du processus weewxd.
# ----------------------------------------------------------------------
ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
# identifiant Open-Meteo (paramètre models=) -> (nom court, nom complet, origine,
# échéance maximale en jours)
ENSEMBLE_MODELS = {
    "ecmwf_ifs025": ("ECMWF", "ECMWF ENS", "Reading", 15),
    "ecmwf_ifs025_ensemble": ("ECMWF", "ECMWF ENS", "Reading", 15),
    "ecmwf_ifs_europe_ensemble": ("ECMWF-EU", "ECMWF ENS Europe", "Reading", 15),
    "ecmwf_aifs025": ("AIFS", "ECMWF AIFS ENS (IA)", "Reading", 15),
    "ecmwf_aifs025_ensemble": ("AIFS", "ECMWF AIFS ENS (IA)", "Reading", 15),
    "ecmwf_aifs_europe_ensemble": ("AIFS-EU", "ECMWF AIFS ENS Europe (IA)", "Reading", 15),
    "gfs_seamless": ("GFS", "NOAA GEFS", "États-Unis", 35),
    "ncep_gefs_seamless": ("GFS", "NOAA GEFS", "États-Unis", 35),
    "ncep_gefs025": ("GFS", "NOAA GEFS 0,25°", "États-Unis", 16),
    "ncep_gefs05": ("GFS", "NOAA GEFS 0,5°", "États-Unis", 35),
    "ncep_aigefs025": ("AIGEFS", "NOAA AIGEFS (IA)", "États-Unis", 16),
    "icon_seamless_eps": ("ICON", "DWD ICON EPS", "Allemagne", 7.5),
    "icon_global_eps": ("ICON", "DWD ICON EPS Global", "Allemagne", 7.5),
    "icon_eu_eps": ("ICON-EU", "DWD ICON EPS Europe", "Allemagne", 5),
    "icon_d2_eps": ("ICON-D2", "DWD ICON EPS D2", "Allemagne", 2),
    "gem_global": ("GEM", "ECCC GEPS", "Canada", 16),
    "gem_global_ensemble": ("GEM", "ECCC GEPS", "Canada", 16),
    "google_weathernext2_ensemble": ("GWE", "Google WeatherNext 2 (IA)", "États-Unis", 15),
    "ukmo_global_ensemble_20km": ("UKMO", "Met Office MOGREPS-G", "Royaume-Uni", 8),
    "ukmo_uk_ensemble_2km": ("UKMO-UK", "Met Office MOGREPS-UK", "Royaume-Uni", 5),
    "bom_access_global_ensemble": ("ACCESS", "BOM ACCESS-GE", "Australie", 10),
    "meteoswiss_icon_ch1": ("CH1", "MeteoSuisse ICON-CH1", "Suisse", 1.5),
    "meteoswiss_icon_ch2": ("CH2", "MeteoSuisse ICON-CH2", "Suisse", 5),
}
# anciens identifiants (versions 1.49 à 1.52, erronés) -> identifiants Open-Meteo
ENSEMBLE_ALIASES = {
    "ecmwf_ifs_025": "ecmwf_ifs025", "ecmwf_aifs_025": "ecmwf_aifs025",
    "ecmwf_ifs_europe": "ecmwf_ifs_europe_ensemble", "ecmwf_aifs_europe": "ecmwf_aifs_europe_ensemble",
    "gfs_025": "ncep_gefs025", "gfs_05": "ncep_gefs05", "aigefs_025": "ncep_aigefs025",
    "weathernext_ensemble_2": "google_weathernext2_ensemble",
    "ukmo_mogreps_global": "ukmo_global_ensemble_20km", "ukmo_mogreps_uk": "ukmo_uk_ensemble_2km",
    "bom_access_ge": "bom_access_global_ensemble",
}
ENSEMBLE_DEFAULT_MODELS = "ecmwf_ifs025, gfs_seamless, icon_seamless_eps, gem_global, google_weathernext2_ensemble"
# variables horaires téléchargées : (clé publiée, variable Open-Meteo, décimales)
ENSEMBLE_VARS = (("temp", "temperature_2m", 1), ("rain", "precipitation", 1),
                 ("wind", "wind_speed_10m", 1), ("press", "pressure_msl", 1))
ENSEMBLE_MODEL_RE = re.compile(r"^[a-z0-9_]{2,40}$")
_ENS_CACHE = {}      # modèle -> (clé de requête, horodatage, réponse)
_ENS_FAIL = {}       # modèle -> horodatage du dernier échec
_ENS_MAXDAYS = {}    # modèle -> échéance maximale annoncée par Open-Meteo (erreur 400)
_ENS_SKIPVARS = {}   # modèle -> variables refusées par Open-Meteo pour ce modèle (erreur 400)


# ----------------------------------------------------------------------
# Météogramme (page meteogram.html) : prévision horaire Open-Meteo au sol et en altitude
# (niveaux de pression) de chaque modèle de [[meteogram]] models, téléchargée au plus une
# fois par période de cache, en mémoire du processus weewxd.
# ----------------------------------------------------------------------
METEOGRAM_SURFACE = ("temperature_2m", "relative_humidity_2m", "precipitation", "showers", "snowfall",
                     "snow_depth", "weather_code", "cloud_cover", "wind_speed_10m", "wind_direction_10m",
                     "wind_gusts_10m", "is_day", "freezing_level_height")
# niveaux de pression (hPa) : du sol à environ 12 km
METEOGRAM_LEVELS = (1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200)
# variable par niveau : (clé publiée, préfixe Open-Meteo, décimales)
METEOGRAM_LVARS = (("z", "geopotential_height", 0), ("t", "temperature", 1), ("cc", "cloud_cover", 0),
                   ("ws", "wind_speed", 0), ("wd", "wind_direction", 0))
METEOGRAM_MODELS = {
    "icon_seamless": "DWD ICON (ICON-D2, puis ICON-EU, puis global)",
    "icon_d2": "DWD ICON-D2", "icon_eu": "DWD ICON-EU", "icon_global": "DWD ICON global",
    "best_match": "Meilleur modèle (Open-Meteo best match)",
    "meteofrance_seamless": "Météo-France (AROME, puis ARPEGE)",
    "meteofrance_arome_france": "Météo-France AROME", "meteofrance_arpege_europe": "Météo-France ARPEGE",
    "ecmwf_ifs025": "ECMWF IFS", "gfs_seamless": "NOAA GFS", "gem_seamless": "ECCC GEM",
    "meteoswiss_icon_ch1": "MeteoSuisse ICON-CH1", "meteoswiss_icon_ch2": "MeteoSuisse ICON-CH2",
    "ukmo_seamless": "Met Office UKMO (UK 2 km, puis global 10 km)",
}
# modèles proposés par défaut (liste déroulante de la page ; le premier est affiché) ;
# METEOGRAM_MODELS sert aussi aux libellés des modèles des prévisions du tableau de bord
METEOGRAM_DEFAULT_MODELS = "icon_seamless, meteofrance_seamless, ecmwf_ifs025, gfs_seamless, ukmo_seamless"
METEOGRAM_MAX_MODELS = 5
_MG_CACHE = {}       # clé de requête -> (horodatage, réponse)
_MG_FAIL = {}        # clé de requête -> horodatage du dernier échec
_MG_MAXDAYS = {}     # modèle -> échéance maximale annoncée par Open-Meteo (erreur 400)


# fonds de carte possibles pour les cartes RainViewer / EUMETSAT ([[basemap]] provider)
BASEMAPS = ("osm", "esri", "opentopomap", "carto")

# cadres du tableau de bord ([LiveJSON] [[dashboard]] order) : ordre par défaut
DASH_BLOCKS = ("parameters", "forecast", "maps", "astro", "climate")


def _dash_order(opts):
    """Ordre des cadres du tableau de bord : ceux de l'option order (identifiants connus,
    sans doublon), puis les cadres oubliés, dans l'ordre par défaut."""
    order = []
    for b in _as_list(opts.get("dashboard", {}).get("order", ", ".join(DASH_BLOCKS))):
        b = b.lower()
        if b not in DASH_BLOCKS:
            log.error("livejson: [[dashboard]] order : cadre « %s » inconnu (%s)", b, ", ".join(DASH_BLOCKS))
        elif b not in order:
            order.append(b)
    return order + [b for b in DASH_BLOCKS if b not in order]


def _as_list(v):
    """Liste d'une option configobj (« a, b » -> ['a', 'b'])."""
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v).split(",") if x.strip()]


class _Lazy(object):
    """Calcul différé : Cheetah n'appelle __str__ que si le gabarit utilise la variable."""

    def __init__(self, fn):
        self.fn = fn
        self._cache = None

    def __str__(self):
        if self._cache is None:
            self._cache = self.fn()
        return self._cache


class _LazyDict(object):
    """Dictionnaire calculé au premier accès ($livejson_arch.label dans un gabarit)."""

    def __init__(self, fn):
        self._fn = fn
        self._d = None

    def _get(self):
        if self._d is None:
            self._d = self._fn()
        return self._d

    def __getattr__(self, k):
        if k.startswith("_"):
            raise AttributeError(k)
        try:
            return self._get()[k]
        except KeyError:
            raise AttributeError(k)

    def __getitem__(self, k):
        return self._get()[k]

    def has_key(self, k):
        return k in self._get()


class LiveJSON(SearchList):

    def __init__(self, generator):
        SearchList.__init__(self, generator)
        opts = generator.skin_dict.get("LiveJSON", {})
        self.hours = _int(opts.get("hours"), 24, 1, 72)
        # rechargement complet du tableau de bord (s ; 0 = jamais)
        self.page_refresh = _int(opts.get("page_refresh"), 300, 0, 86400)
        self.binding = opts.get("data_binding", "wx_binding")
        self.pretty = to_bool(opts.get("pretty", False))
        self.station_name = opts.get("station_name", "") or ""
        # fuseau horaire des pages (heure de la station) ; les prévisions Open-Meteo sont
        # demandées dans ce même fuseau (dates « AAAA-MM-JJTHH:MM » lues par wxtime.js)
        self.tz = _station_tz(opts.get("timezone"))
        self.om_tz = self.tz or "auto"
        self.logo = self._logo(opts)
        self.mqtt = dict(opts.get("mqtt", {}))
        # écarts de température sur 1 h et 24 h du panneau Température ([[mqtt]] temp_deltas)
        self.temp_deltas = to_bool(self.mqtt.get("temp_deltas", True))
        self.forecast = dict(opts.get("forecast", {}))
        self.radar = dict(opts.get("radar", {}))
        self.satellite = dict(opts.get("satellite", {}))
        self.basemap = dict(opts.get("basemap", {}))
        self.basemap_cfg = self._basemap()        # validé une fois (erreurs journalisées une fois)
        self.astro = dict(opts.get("astro", {}))
        self.ensembles = dict(opts.get("ensembles", {}))
        self.meteogram = dict(opts.get("meteogram", {}))
        self.dash_order = _dash_order(opts)
        self.arch = _archive_options(opts)
        ext = opts.get("extremes", {})
        self.ext_top = _int(ext.get("top"), 10, 3, 50)
        # mm : pluie journalière minimale d'un jour de « période de pluie »
        self.ext_wet = max(0.0, _to_float(ext.get("rain_day_threshold"), RAIN_DAY_MM))
        # fraction (0 à 1) du jour couverte par des mesures ; « 75 » est compris comme 75 %
        cov = _to_float(ext.get("min_day_coverage"), 0.75)
        self.ext_cover = min(1.0, max(0.0, cov / 100.0 if cov > 1 else cov))
        self._setup_params(opts)

    def _setup_params(self, opts):
        """Prépare colonnes, unités et agrégats à calculer selon [[parameters]]."""
        self.params = _parse_params(opts)
        # mesures individuelles (les panneaux groupés sont remplacés par leurs mesures)
        self.measures = [m for p in self.params for m in (p["members"] if p["type"] == "group" else (p,))]
        # tables propres à l'instance (les constantes du module ne sont jamais modifiées)
        self.target = dict(TARGET)
        self.units = dict(UNIT_LABELS)
        self._raw_cache = {}
        self._first_ts = None             # premier enregistrement de la base (pages d'archives)
        # clé interne -> colonne SQLite (par défaut : la clé elle-même)
        self.cols = {}
        self.series_aggs = {k: list(v) for k, v in SERIES_AGGREGATES.items()}
        self.period_aggs = {k: list(v) for k, v in PERIOD_AGGREGATES}
        self.day_aggs = {k: list(v) for k, v in DAY_AGGREGATES}
        self.sum_keys = ["rain"]
        need = {"min-max": (("min", "max", "avg"), ("min", "max", "avg"), ("min", "max")),
                "max": (("max", "avg"), ("max", "avg"), ("max",)),
                "sum": (("sum",), (), ())}
        for p in self.measures:
            key, col = p["key"], p["column"]
            self.cols[key] = col
            if p["target"]:
                self.target[key] = p["target"]
            elif key not in self.target:
                self.target[key] = None
            if p["unit"] or key not in self.units:
                self.units[key] = p["unit"]
            if p["builtin"]:
                continue
            s_aggs, p_aggs, d_aggs = need[p["aggregate"]]
            for dst, aggs in ((self.series_aggs, s_aggs), (self.period_aggs, p_aggs), (self.day_aggs, d_aggs)):
                cur = dst.setdefault(key, [])
                cur.extend(a for a in aggs if a not in cur)
            if p["aggregate"] == "sum" and key not in self.sum_keys:
                self.sum_keys.append(key)

    @property
    def raw_keys(self):
        """Mesures brutes utiles aux panneaux configurés (évite les requêtes inutiles)."""
        aux = {"outTemp": ("outTemp",), "wind": ("windSpeed", "windGust", "windDir"),
               "windDir": ("windDir", "windSpeed"), "rain": ("rain", "rainRate"),
               "outHumidity": ("outHumidity",), "barometer": ("barometer",)}
        keys = []
        for p in self.measures:
            for k in (aux.get(p["id"], ()) if p["builtin"] else (p["key"],)):
                if k not in keys:
                    keys.append(k)
        return keys

    def col(self, key):
        return self.cols.get(key, key)

    def _conv(self, vt, key):
        return _convert(vt, key, self.target)

    # ------------------------------------------------------------------
    def get_extension_list(self, timespan, db_lookup):
        stop = timespan.stop

        def period(name):
            return _Lazy(lambda: self._dump(self.period(name, stop, db_lookup)))

        return [{
            "livejson_history": _Lazy(lambda: self._dump(self.history(stop, db_lookup))),
            "livejson_config": _Lazy(lambda: self._dump(self.config())),
            "livejson_forecast": _Lazy(lambda: self._dump(self.forecast_data())),
            "livejson_climate": _Lazy(lambda: self._dump(self.climate(stop, db_lookup))),
            "livejson_extremes": _Lazy(lambda: self._dump(self.extremes(stop, db_lookup))),
            "livejson_astro": _Lazy(lambda: self._dump(self.astro_data(stop, db_lookup))),
            # prévisions d'ensemble Open-Meteo (data/ensembles.json)
            "livejson_ensembles": _Lazy(lambda: self._dump(self.ensembles_data())),
            # météogramme Open-Meteo (data/meteogram.json)
            "livejson_meteogram": _Lazy(lambda: self._dump(self.meteogram_data())),
            # pages « jour » (gabarit archive/day-%Y-%m-%d.html.tmpl, timespan = la journée)
            "livejson_day": _Lazy(lambda: self._dump(self.day_data(timespan, db_lookup)).replace("</", "<\\/")),
            # pages « mois » et « année » : statistiques et séries journalières de la période
            "livejson_span": _Lazy(lambda: self._dump(self.span_data(timespan, db_lookup)).replace("</", "<\\/")),
            # dates, titres et liens des pages d'archives (sélecteur de date compris)
            "livejson_arch": _LazyDict(lambda: self.arch_info(timespan, db_lookup)),
            # tableau climatologique mensuel (archive/climato-AAAA-MM.html)
            "livejson_climato": _Lazy(lambda: self._dump(self.climato_data(timespan, db_lookup)).replace("</", "<\\/")),
            # tableau climatologique annuel (archive/climato-AAAA.html)
            "livejson_climato_year": _Lazy(lambda: self._dump(self.climato_year_data(timespan, db_lookup)).replace("</", "<\\/")),
            # gabarit index.html.tmpl : paramètres (chaînes déjà échappées pour le HTML),
            # nom de la station et configuration à intégrer dans la page
            "livejson_params": self.template_params(),
            "livejson_station": html.escape(self.station_label()),
            # logo (chaînes échappées) ou chaîne vide
            "livejson_logo": ({k: html.escape(str(v)) for k, v in self.logo.items()} if self.logo else ""),
            "livejson_hardware": html.escape(self.hardware_label()),
            # ordre des cadres du tableau de bord (index.html.tmpl)
            "livejson_dash_order": self.dash_order,
            "livejson_refresh": self.page_refresh,
            # méthode des tableaux climatologiques (civil / omm), sous-titre des pages climato
            "livejson_climato_method": self.arch["climato_method"],
            # ligne « Sur 1 h · Sur 24 h » du panneau Température ([[mqtt]] temp_deltas)
            "livejson_temp_deltas": self.temp_deltas,
            # fenêtre des graphiques du tableau de bord (heures, [LiveJSON] hours)
            "livejson_hours": self.hours,
            # fuseau horaire de la station (wxtime.js.tmpl), chaîne JSON ou null
            "livejson_tz": json.dumps(self.tz),
            "livejson_fc_days": self._fc_days(),
            "livejson_config_inline": _Lazy(lambda: self._dump(self.config()).replace("</", "<\\/")),
            # $livejson_period.p7d, etc.
            "livejson_period": {"p" + name: period(name) for name in PERIODS},
        }]

    def _dump(self, obj):
        if self.pretty:
            return json.dumps(obj, indent=1, ensure_ascii=True)
        return json.dumps(obj, separators=(",", ":"), ensure_ascii=True)

    @staticmethod
    def _logo(opts):
        """Logo de la station : chemin relatif (ex. img/logo.png) ou adresse http(s)."""
        src = str(opts.get("logo", "") or "").strip()
        if not src:
            return None
        low = src.lower()
        if ":" in low.split("/")[0] and not low.startswith(("http://", "https://")):
            log.error("livejson: logo ignoré (adresse non autorisée) : %s", src)
            return None
        return {"src": src, "alt": str(opts.get("logo_alt", "") or ""),
                "height": _int(opts.get("logo_height"), 48, 16, 200)}

    # ------------------------------------------------------------------
    def station_label(self):
        if self.station_name:
            return self.station_name
        try:
            return self.generator.stn_info.location or "Station météo"
        except AttributeError:
            return "Station météo"

    def hardware_label(self):
        """Sous-titre des pages : modèle de station (weewx.conf [Station]) · weewx."""
        hw = ""
        try:
            hw = self.generator.stn_info.hardware or ""
        except AttributeError:
            pass
        return (hw + " · weewx") if hw else "weewx"

    def template_params(self):
        def esc(p):
            q = {k: (html.escape(str(v)) if isinstance(v, str) else v) for k, v in p.items()}
            q["id_url"] = urllib.parse.quote(p["id"])
            if p["type"] == "group":
                q["members"] = [esc(m) for m in p["members"]]
            return q
        return [esc(p) for p in self.params]

    def _coords(self, section=None):
        """Coordonnées (latitude, longitude) : options de « section » ([[meteogram]],
        [[ensembles]]), sinon de [[forecast]], sinon celles de la station (weewx.conf)."""
        stn = self.generator.stn_info
        lat = _to_float(self.forecast.get("latitude"), getattr(stn, "latitude_f", None))
        lon = _to_float(self.forecast.get("longitude"), getattr(stn, "longitude_f", None))
        if section:
            lat = _to_float(section.get("latitude"), lat)
            lon = _to_float(section.get("longitude"), lon)
        return lat, lon

    def config(self):
        lat, lon = self._coords()
        f, r, sat = self.forecast, self.radar, self.satellite
        fc_models, fc_default = self._fc_models()
        return {
            "stationName": self.station_label(),
            "hardware": self.hardware_label(),
            "logo": self.logo,
            "timezone": self.tz,
            # fenêtre des graphiques et cumuls glissants du tableau de bord (heures)
            "hours": self.hours,
            "latitude": lat,
            "longitude": lon,
            # pages d'archives : archive/day-AAAA-MM-JJ.html, month-…, year-…, climato-…
            "archives": {k: self.arch[k] for k in ("day", "days", "month", "year", "climato")},
            # « Soleil et Lune » : almanach weewx (data/astro.json)
            "astro": {"enable": to_bool(self.astro.get("enable", True))},
            # ordre des cadres du tableau de bord défini par l'administrateur (layout.js)
            "dashboard": {"order": self.dash_order},
            # prévisions d'ensemble (menu « Prévisions », page ensembles.html)
            "ensembles": {"enable": to_bool(self.ensembles.get("enable", True))},
            "meteogram": {"enable": to_bool(self.meteogram.get("enable", True))},
            "forecast": {
                "enable": to_bool(f.get("enable", True)),
                # modèle par défaut et modèles de la liste déroulante (identifiant, nom)
                "model": fc_default,
                "models": [{"id": m, "label": METEOGRAM_MODELS.get(m, m)} for m in fc_models],
                "days": self._fc_days(),
                # durée de validité du cache (secondes), côté weewx et côté navigateur
                "cache": self._forecast_ttl(),
            },
            # fond des cartes RainViewer / EUMETSAT (osm, esri, opentopomap, carto + clé)
            "basemap": self.basemap_cfg,
            "radar": {
                "enable": to_bool(r.get("enable", True)),
                # windy (carte Windy.com intégrée) ou rainviewer (animation Leaflet)
                "provider": str(r.get("provider", "windy")).lower(),
                "overlay": r.get("windy_overlay", "radar"),
                "product": r.get("windy_product", "radar"),
                "windyUrl": r.get("windy_url", ""),
                "zoom": _int(r.get("zoom"), 7, 1, 12),
                "frames": _int(r.get("frames"), 13, 2, 13),
                "delay": _int(r.get("frame_delay"), 500, 100, 5000),
            },
            "satellite": {
                "enable": to_bool(sat.get("enable", True)),
                # windy (carte Windy.com intégrée) ou eumetsat (animation Leaflet)
                "provider": str(sat.get("provider", "windy")).lower(),
                "overlay": sat.get("windy_overlay", "satellite"),
                "product": sat.get("windy_product", "satellite"),
                "windyUrl": sat.get("windy_url", ""),
                "url": sat.get("url", "https://view.eumetsat.int/geoserver/wms"),
                "layers": _layers(sat.get("layers", "mtg_fd:ir105_hrfi|Infrarouge, mtg_fd:rgb_truecolour|Couleurs vraies")),
                "zoom": _int(sat.get("zoom"), 5, 1, 12),
                "frames": _int(sat.get("frames"), 12, 2, 36),
                "step": _int(sat.get("step_minutes"), 10, 5, 60),
                "latency": _int(sat.get("latency_minutes"), 30, 0, 240),
                "delay": _int(sat.get("frame_delay"), 400, 100, 5000),
            },
            # paramètres affichés (tableau de bord, pages de détail, menu « Données »)
            "parameters": [self._public_param(p) for p in self.params],
            "mqtt": {
                # false : pas de temps réel ; la page se met à jour à chaque archive weewx
                # (relecture de data/history.json toutes les archivePoll secondes)
                "enable": to_bool(self.mqtt.get("enable", True)),
                "archivePoll": _int(self.mqtt.get("archive_poll"), 60, 15, 3600),
                "url": self.mqtt.get("url", ""),
                "topic": self.mqtt.get("topic", "weather/loop"),
                "username": self.mqtt.get("username", ""),
                "password": self.mqtt.get("password", ""),
                # écarts « Sur 1 h / Sur 24 h » (false : ni affichés, ni clés lues) et clés
                # du paquet MQTT portant la température d'il y a 1 h et 24 h
                "tempDeltas": self.temp_deltas,
                "temp1hKey": self.mqtt.get("temp_1h_key", "OutTemp-1h_C"),
                "temp24hKey": self.mqtt.get("temp_24h_key", "OutTemp-24h_C"),
            },
        }

    def _basemap(self):
        """Fond des cartes RainViewer / EUMETSAT : fournisseur et clé (CARTO)."""
        prov = str(self.basemap.get("provider", "osm") or "osm").strip().lower()
        if prov not in BASEMAPS:
            log.error("livejson: [[basemap]] provider « %s » inconnu (%s) : osm utilisé", prov, ", ".join(BASEMAPS))
            prov = "osm"
        key = str(self.basemap.get("key", "") or "").strip()
        if prov == "carto" and not key:
            log.error("livejson: [[basemap]] provider = carto sans clé (key) : osm utilisé")
            prov = "osm"
        return {"provider": prov, "key": key}

    @staticmethod
    def _public_param(p):
        q = {k: p[k] for k in ("id", "key", "type", "title", "column", "mqtt", "aggregate",
                               "builtin", "unit", "decimals", "color", "hint")}
        if p["type"] == "group":
            q["members"] = [LiveJSON._public_param(m) for m in p["members"]]
        return q

    # ------------------------------------------------------------------
    # Prévisions Open-Meteo mises en cache
    # ------------------------------------------------------------------
    def _fc_days(self):
        return _int(self.forecast.get("days"), 7, 1, 16)

    def _forecast_ttl(self):
        return _int(self.forecast.get("cache"), 3600, 60, 86400)

    def _fc_models(self):
        """Modèles des prévisions du tableau de bord ([[forecast]] models, 5 au plus) et
        modèle affiché par défaut (option model, sinon le premier de la liste)."""
        f = self.forecast
        models = []
        for m in _as_list(f.get("models", FORECAST_DEFAULT_MODELS)):
            m = m.lower()
            if not ENSEMBLE_MODEL_RE.match(m):
                log.error("livejson: prévisions : modèle « %s » ignoré", m)
            elif m not in models:
                models.append(m)
        default = str(f.get("model", "") or "").strip().lower()
        if default and ENSEMBLE_MODEL_RE.match(default) and default not in models:
            models.insert(0, default)
        models = models[:FORECAST_MAX_MODELS] or ["best_match"]
        return models, (default if default in models else models[0])

    def _fc_fetch(self, model, lat, lon, days, ttl, timeout):
        """Prévisions d'un modèle (cache de « ttl » secondes) -> (données, horodatage, erreur)."""
        params = {
            "latitude": lat, "longitude": lon,
            "daily": ",".join(FORECAST_DAILY), "hourly": ",".join(FORECAST_HOURLY),
            "models": model, "timezone": self.om_tz,
            "forecast_days": min(days, _FORECAST_MAXDAYS.get(model, 99)),
        }
        url = OPEN_METEO_URL + "?" + urllib.parse.urlencode(params)
        now = time.time()
        cached = _FORECAST_CACHE.get(url)
        if cached is not None and now - cached[0] < ttl:
            return cached[1], cached[0], None
        if now - _FORECAST_FAIL.get(url, 0) < min(ttl, FORECAST_RETRY):
            err = "nouvel essai après un échec récent"
        else:
            data, err, _reason, maxdays = _om_fetch(url, timeout)
            if data is not None:
                _FORECAST_CACHE[url] = (now, data)
                _FORECAST_FAIL.pop(url, None)
                log.debug("livejson: prévisions Open-Meteo (%s) téléchargées", model)
                return data, now, None
            # échéance refusée (« … range 0 to 4 … ») : limite retenue, nouvel essai
            if maxdays and model not in _FORECAST_MAXDAYS and maxdays < days:
                _FORECAST_MAXDAYS[model] = maxdays
                log.info("livejson: prévisions %s : échéance limitée à %s jours", model, maxdays)
                return self._fc_fetch(model, lat, lon, days, ttl, timeout)
            _FORECAST_FAIL[url] = now
            log.error("livejson: échec du téléchargement Open-Meteo (%s) : %s", model, err)
        if cached is not None:
            return cached[1], cached[0], err           # copie précédente conservée
        return None, None, err

    def forecast_data(self):
        """Prévisions Open-Meteo de chaque modèle de [[forecast]] models, téléchargées au plus
        une fois par période de cache (1 h par défaut) et publiées dans data/forecast.json :
        les visiteurs lisent ce fichier (et y choisissent le modèle) au lieu d'interroger
        Open-Meteo chacun de leur côté."""
        f = self.forecast
        if not to_bool(f.get("enable", True)):
            return {"error": "prévisions désactivées"}
        lat, lon = self._coords()
        if lat is None or lon is None:
            return {"error": "coordonnées de la station inconnues"}
        models, default = self._fc_models()
        ttl = self._forecast_ttl()
        days = self._fc_days()
        timeout = _int(f.get("timeout"), 15, 2, 60)
        # entrées du cache des modèles retirés de la configuration : supprimées
        for key in [k for k in _FORECAST_CACHE
                    if dict(urllib.parse.parse_qsl(k.split("?", 1)[-1])).get("models") not in models]:
            _FORECAST_CACHE.pop(key, None)
        out = []
        for m in models:
            data, fetched, err = self._fc_fetch(m, lat, lon, days, ttl, timeout)
            item = {"id": m, "label": METEOGRAM_MODELS.get(m, m)}
            if data is None:
                item["error"] = err or "prévisions indisponibles"
            else:
                item.update(fetched=int(fetched), expires=int(fetched + ttl), daily=data.get("daily"),
                            hourly=data.get("hourly"), utc_offset_seconds=data.get("utc_offset_seconds"))
                if err:
                    item["stale"] = True          # données de la période précédente, conservées
                    item["warning"] = err
            out.append(item)
        res = {"source": "open-meteo", "default": default, "cache": ttl, "models": out}
        # compatibilité (pages plus anciennes) : modèle par défaut au premier niveau
        first = next((x for x in out if x["id"] == default and "daily" in x), None) or \
            next((x for x in out if "daily" in x), None)
        if first:
            res.update(model=first["id"], fetched=first["fetched"], expires=first["expires"],
                       daily=first["daily"], hourly=first["hourly"],
                       utc_offset_seconds=first["utc_offset_seconds"])
        return res

    # ------------------------------------------------------------------
    # Prévisions d'ensemble Open-Meteo (data/ensembles.json, page ensembles.html).
    # weewx publie les membres bruts (échantillonnés) et les valeurs journalières de chaque
    # membre ; le navigateur calcule moyennes, percentiles et probabilités selon
    # les modèles cochés et l'horizon choisi.
    # ------------------------------------------------------------------
    def _ens_options(self):
        e = self.ensembles
        models = []
        for m in _as_list(e.get("models", ENSEMBLE_DEFAULT_MODELS)):
            m = m.lower()
            if m in ENSEMBLE_ALIASES:
                log.info("livejson: ensembles : modèle %s -> %s (identifiant Open-Meteo)", m, ENSEMBLE_ALIASES[m])
                m = ENSEMBLE_ALIASES[m]
            models.append(m)
        bad = [m for m in models if not ENSEMBLE_MODEL_RE.match(m)]
        if bad:
            log.error("livejson: ensembles : modèle(s) ignoré(s) : %s", ", ".join(bad))
        models = [m for i, m in enumerate(models) if ENSEMBLE_MODEL_RE.match(m) and m not in models[:i]]
        step = _int(e.get("step"), 1, 1, 6)
        if 24 % step:
            step = 1
        # valeurs invalides (texte, 0) écartées avant de borner à 1-35 jours
        horizons = sorted({min(35, h) for h in (_int(x, 0) for x in _as_list(e.get("horizons", "3, 7, 10, 16"))) if h > 0})
        return {
            "enable": to_bool(e.get("enable", True)),
            "models": models,
            "days": _int(e.get("days"), 16, 1, 35),
            "step": step,                                   # heures entre deux points
            "cache": _int(e.get("cache"), 10800, 1800, 86400),
            "timeout": _int(e.get("timeout"), 30, 5, 120),
            "horizons": horizons or [3, 7, 10, 16],
            "horizon": _int(e.get("default_horizon"), 10, 1, 35),
            # mm : pluie « mesurable » (risque de pluie)
            "threshold": max(0.0, _to_float(e.get("rain_threshold"), RAIN_DAY_MM)),
        }

    def _ens_fetch(self, model, lat, lon, days, o):
        """Réponse Open-Meteo d'un modèle (cache de o['cache'] secondes). -> (données,
        horodatage, erreur)."""
        # forecast_days ne doit pas dépasser l'échéance du modèle (sinon : erreur 400)
        mdays = ENSEMBLE_MODELS.get(model, (0, 0, 0, days))[3]
        fdays = max(1, min(days, int(math.ceil(mdays)), _ENS_MAXDAYS.get(model, 99)))
        params = {
            "latitude": lat, "longitude": lon, "models": model,
            "hourly": ",".join(v for _k, v, _d in ENSEMBLE_VARS if v not in _ENS_SKIPVARS.get(model, ())),
            "timezone": self.om_tz, "timeformat": "unixtime",
            "forecast_days": fdays,
        }
        key = urllib.parse.urlencode(params)
        now = time.time()
        cached = _ENS_CACHE.get(model)
        if cached and cached[0] == key and now - cached[1] < o["cache"]:
            return cached[2], cached[1], None
        if now - _ENS_FAIL.get(model, 0) < min(o["cache"], FORECAST_RETRY):
            err = "nouvel essai après un échec récent"
        else:
            data, err, reason, maxdays = _om_fetch(ENSEMBLE_URL + "?" + key, o["timeout"])
            if data is not None:
                _ENS_CACHE[model] = (key, now, data)
                _ENS_FAIL.pop(model, None)
                log.debug("livejson: ensemble %s téléchargé", model)
                return data, now, None
            # échéance refusée (« … allowed range 0 to 15 … ») : limite retenue et nouvel
            # essai immédiat
            if maxdays is not None and maxdays < fdays and model not in _ENS_MAXDAYS:
                _ENS_MAXDAYS[model] = max(1, maxdays)
                log.info("livejson: ensemble %s : échéance limitée à %s jours", model, _ENS_MAXDAYS[model])
                return self._ens_fetch(model, lat, lon, days, o)
            # variable refusée pour ce modèle (nommée dans la raison, erreur 400) : retirée,
            # nouvel essai
            skip = _ENS_SKIPVARS.setdefault(model, set())
            bad = [v for _k, v, _d in ENSEMBLE_VARS if v not in skip and re.search(r"\b%s\b" % v, reason)]
            if err.startswith("HTTP 400") and bad and len(skip) + len(bad) < len(ENSEMBLE_VARS):
                skip.update(bad)
                log.warning("livejson: ensemble %s : variable(s) non disponible(s) : %s", model, ", ".join(bad))
                return self._ens_fetch(model, lat, lon, days, o)
            _ENS_FAIL[model] = now
            log.error("livejson: échec du téléchargement de l'ensemble %s : %s", model, err)
        if cached and cached[0] == key:
            return cached[2], cached[1], err            # données précédentes conservées
        return None, None, err

    @staticmethod
    def _ens_members(hourly, var, model):
        """Membres d'une variable : [contrôle, membre 1, …] (listes horaires)."""
        # suffixe de modèle éventuel (nom du domaine Open-Meteo, pas forcément l'identifiant demandé)
        rx = re.compile(r"^%s(?:_member(\d+))?(?:_[a-z][a-z0-9_]*)?$" % re.escape(var))
        found = []
        for k, v in hourly.items():
            m = rx.match(k)
            if m and isinstance(v, list):
                found.append((int(m.group(1) or 0), v))
        found.sort(key=lambda x: x[0])
        # membres entièrement vides (variable non fournie par ce modèle) : ignorés
        return [v for _, v in found if any(x is not None for x in v)]

    def _ens_process(self, data, model, o):
        hourly = data.get("hourly") or {}
        times = hourly.get("time") or []
        if not times:
            return {"error": "réponse vide"}
        now = time.time()
        i0 = next((i for i, t in enumerate(times) if t >= now - now % 3600), None)
        if i0 is None:
            return {"error": "prévision périmée"}
        st = o["step"]
        mem = {k: self._ens_members(hourly, var, model) for k, var, _d in ENSEMBLE_VARS}
        dec = {k: d for k, _v, d in ENSEMBLE_VARS}

        def rnd(v, d):
            return None if v is None else round(v, d)

        # séries échantillonnées (température, vent, pression) à partir de l'heure en cours
        series, nmax = {}, 0
        for k in ("temp", "wind", "press"):
            rows = []
            for arr in mem[k]:
                row = []
                for a in range(i0, len(times), st):
                    v = arr[a] if a < len(arr) else None
                    if v is None:            # pas du modèle > 1 h : valeur voisine
                        v = next((arr[j] for j in range(a, min(a + st, len(arr))) if arr[j] is not None), None)
                    row.append(rnd(v, dec[k]))
                while row and row[-1] is None:
                    row.pop()
                rows.append(row)
            if rows and any(rows):
                n = max(len(r) for r in rows)
                series[k] = rows
                nmax = max(nmax, n)

        # valeurs journalières de chaque membre (jour local de la station, dès aujourd'hui)
        days, order = {}, []
        today = datetime.date.today()
        for i, t in enumerate(times):
            d = datetime.date.fromtimestamp(t)
            if d < today:
                continue
            if d not in days:
                days[d] = []
                order.append(d)
            days[d].append(i)

        def covered(arr, idx):
            """Indices utiles si la journée est couverte : au moins 4 valeurs, dont une avant
            6 h et une après 18 h (modèles au pas de 6 h compris)."""
            ok = [i for i in idx if i < len(arr) and arr[i] is not None]
            if len(ok) < 4:
                return None
            h0 = time.localtime(times[ok[0]]).tm_hour
            h1 = time.localtime(times[ok[-1]]).tm_hour
            return ok if h0 < 6 and h1 >= 18 else None

        daily = {"tmax": [], "tmin": [], "rain": [], "wind": [], "press": []}
        for arr in mem["temp"]:
            mx, mn = [], []
            for d in order:
                ok = covered(arr, days[d])
                mx.append(rnd(max(arr[i] for i in ok), 1) if ok else None)
                mn.append(rnd(min(arr[i] for i in ok), 1) if ok else None)
            daily["tmax"].append(mx)
            daily["tmin"].append(mn)
        for key, fn in (("rain", sum), ("wind", max), ("press", lambda v: sum(v) / len(v))):
            for arr in mem[key]:
                row = []
                for d in order:
                    ok = covered(arr, days[d])
                    row.append(rnd(fn([arr[i] for i in ok]), 1) if ok else None)
                daily[key].append(row)
        # jours sans aucune valeur en fin de prévision : retirés
        nd = len(order)
        while nd and not any(r[nd - 1] is not None for rows in daily.values() for r in rows if len(r) >= nd):
            nd -= 1
        daily = {k: [r[:nd] for r in rows] for k, rows in daily.items()}
        return {
            "t0": int(times[i0]), "step": st * 3600, "n": nmax,
            "members": max([len(v) for v in mem.values()] or [0]),
            "series": series,
            "daily": dict(daily, dates=[d.isoformat() for d in order[:nd]]),
        }

    # ------------------------------------------------------------------
    # Météogramme (data/meteogram.json, page meteogram.html)
    # ------------------------------------------------------------------
    def _mg_models(self):
        """Modèles du météogramme ([[meteogram]] models, 5 au plus) et modèle affiché par
        défaut (option model, sinon le premier de la liste)."""
        g = self.meteogram
        models = []
        for m in _as_list(g.get("models", METEOGRAM_DEFAULT_MODELS)):
            m = m.lower()
            if not ENSEMBLE_MODEL_RE.match(m):
                log.error("livejson: météogramme : modèle « %s » ignoré", m)
            elif m not in models:
                models.append(m)
        default = str(g.get("model", "") or "").strip().lower()
        if default and ENSEMBLE_MODEL_RE.match(default) and default not in models:
            models.insert(0, default)
        models = models[:METEOGRAM_MAX_MODELS] or ["icon_seamless"]
        return models, (default if default in models else models[0])

    def meteogram_data(self):
        """Prévision horaire de chaque modèle du météogramme depuis l'heure en cours : valeurs
        au sol et, pour chaque niveau de pression, altitude, température, nébulosité et
        vent ; le navigateur dessine les coupes en altitude et propose le choix du modèle."""
        g = self.meteogram
        if not to_bool(g.get("enable", True)):
            return {"error": "météogramme désactivé"}
        lat, lon = self._coords(g)
        if lat is None or lon is None:
            return {"error": "coordonnées de la station inconnues"}
        models, default = self._mg_models()
        days = _int(g.get("days"), 4, 1, 16)
        ttl = _int(g.get("cache"), 3600, 600, 86400)
        timeout = _int(g.get("timeout"), 30, 5, 120)
        # entrées du cache des modèles retirés de la configuration : supprimées
        for key in [k for k in _MG_CACHE if dict(urllib.parse.parse_qsl(k)).get("models") not in models]:
            _MG_CACHE.pop(key, None)
        out = [dict(self._mg_model(m, lat, lon, days, ttl, timeout), id=m, label=METEOGRAM_MODELS.get(m, m))
               for m in models]
        return {
            "version": VERSION, "generated": int(time.time()), "source": "open-meteo",
            "latitude": lat, "longitude": lon, "cache": ttl, "default": default,
            "units": {"temp": "°C", "rain": "mm", "snow": "cm", "wind": "km/h", "z": "m"},
            # sommets des panneaux (m) ; top_humidity : ancien nom de top_clouds (avant 1.68)
            "top": {"clouds": _int(g.get("top_clouds", g.get("top_humidity")), 12000, 3000, 16000),
                    "temperature": _int(g.get("top_temperature"), 4500, 1500, 12000)},
            "models": out,
        }

    def _mg_model(self, model, lat, lon, days, ttl, timeout):
        """Prévision d'un modèle (cache de « ttl » secondes) ; {"error": …} si indisponible."""
        hourly = list(METEOGRAM_SURFACE) + ["%s_%dhPa" % (v, p) for p in METEOGRAM_LEVELS for _k, v, _d in METEOGRAM_LVARS]
        params = {"latitude": lat, "longitude": lon, "models": model, "hourly": ",".join(hourly),
                  "timezone": self.om_tz, "timeformat": "unixtime",
                  "forecast_days": min(days, _MG_MAXDAYS.get(model, 99))}
        key = urllib.parse.urlencode(params)
        now = time.time()
        cached = _MG_CACHE.get(key)
        err = None
        if cached is None or now - cached[0] >= ttl:
            if now - _MG_FAIL.get(key, 0) < min(ttl, FORECAST_RETRY):
                err = "nouvel essai après un échec récent"
            else:
                data, err, _reason, maxdays = _om_fetch(OPEN_METEO_URL + "?" + key, timeout)
                if data is not None:
                    cached = (now, data)
                    _MG_CACHE[key] = cached
                    _MG_FAIL.pop(key, None)
                # échéance refusée (« … range 0 to 4 … ») : limite retenue, nouvel essai
                elif maxdays and model not in _MG_MAXDAYS and maxdays < days:
                    _MG_MAXDAYS[model] = maxdays
                    log.info("livejson: météogramme %s : échéance limitée à %s jours", model, maxdays)
                    return self._mg_model(model, lat, lon, days, ttl, timeout)
                else:
                    _MG_FAIL[key] = now
                    log.error("livejson: échec du téléchargement du météogramme (%s) : %s", model, err)
        if cached is None:
            return {"error": err or "prévision indisponible"}
        fetched, data = cached
        h = data.get("hourly") or {}
        times = h.get("time") or []
        i0 = next((i for i, t in enumerate(times) if t >= now - now % 3600), len(times))
        n = len(times) - i0
        if n <= 0:
            return {"error": "prévision vide ou périmée"}

        def col(name, dec):
            a = (h.get(name) or [])[i0:]
            a = a + [None] * (n - len(a))
            return [None if v is None else (round(v, dec) if dec else int(round(v))) for v in a]

        sdec = {"temperature_2m": 1, "relative_humidity_2m": 0, "precipitation": 1, "showers": 1,
                "snowfall": 1, "snow_depth": 2, "weather_code": 0, "cloud_cover": 0, "wind_speed_10m": 0,
                "wind_direction_10m": 0, "wind_gusts_10m": 0, "is_day": 0, "freezing_level_height": 0}
        surface = {k: col(k, d) for k, d in sdec.items()}
        levels = []
        for p in METEOGRAM_LEVELS:
            lv = {k: col("%s_%dhPa" % (v, p), d) for k, v, d in METEOGRAM_LVARS}
            if any(x is not None for x in lv["z"]) and any(x is not None for x in lv["t"]):
                lv["p"] = p
                levels.append(lv)
        out = {
            "elevation": data.get("elevation"), "fetched": int(fetched),
            "t0": int(times[i0]), "n": n, "surface": surface, "levels": levels,
        }
        if err:
            out["stale"] = True
            out["warning"] = err
        return out

    def ensembles_data(self):
        """Prévisions d'ensemble de chaque modèle configuré ([LiveJSON] [[ensembles]])."""
        t1 = time.time()
        o = self._ens_options()
        if not o["enable"]:
            return {"error": "prévisions d'ensemble désactivées"}
        lat, lon = self._coords(self.ensembles)
        if lat is None or lon is None:
            return {"error": "coordonnées de la station inconnues"}
        if not o["models"]:
            return {"error": "aucun modèle configuré"}
        models = []
        for m in o["models"]:
            short, label, origin, _d = ENSEMBLE_MODELS.get(m, (m.upper()[:8], m, "", o["days"]))
            info = {"id": m, "short": short, "label": label, "origin": origin}
            data, fetched, err = self._ens_fetch(m, lat, lon, o["days"], o)
            if data is None:
                models.append(dict(info, error=err or "indisponible"))
                continue
            try:
                r = self._ens_process(data, m, o)
            except Exception as ex:
                log.error("livejson: ensemble %s : données inattendues : %s", m, ex)
                r = {"error": "données inattendues"}
            r.update(info, fetched=int(fetched))
            if err and "error" not in r:
                r["stale"] = True
                r["warning"] = err
            models.append(r)
        log.debug("livejson: ensembles calculés en %.2f s", time.time() - t1)
        return {
            "version": VERSION, "generated": int(time.time()), "source": "open-meteo",
            "latitude": lat, "longitude": lon, "cache": o["cache"],
            "horizons": o["horizons"], "horizon": o["horizon"],
            "threshold": o["threshold"],
            "units": {"temp": "°C", "rain": "mm", "wind": "km/h", "press": "hPa"},
            "models": models,
        }

    def history(self, stop, db_lookup):
        """data/history.json : séries brutes des « hours » dernières heures, extrêmes et cumuls
        du jour de la station."""
        t1 = time.time()
        dbm = db_lookup(self.binding)
        start = stop - self.hours * 3600
        span = TimeSpan(start, stop)

        series = self._raw_series(span, dbm)
        day_span = archiveDaySpan(stop)
        day = self._day_aggregates(day_span, dbm)

        out = {
            "version": VERSION,
            "generated": int(time.time()),
            "stop": int(stop),
            "midnight": int(day_span.start),
            # fin du jour de la station (minuit suivant, heure d'été comprise) : le navigateur
            # change de jour à cette heure-là, quel que soit son propre fuseau horaire
            "nextMidnight": int(day_span.stop),
            "hours": self.hours,
            "units": self.units,
            "series": series,
            "day": day,
            # gel en cours (température < 0 °C) : début, même au-delà de « hours » heures
            "frost": self._frost(stop, dbm),
        }
        log.debug("livejson: historique généré en %.2f s", time.time() - t1)
        return out

    def _frost(self, stop, dbm):
        """Gel en cours : {"since": dernier enregistrement à 0 °C ou plus} si la dernière
        température de l'archive est négative, sinon None ; « partial » : aucune température
        positive dans la base (le gel dure au moins depuis le premier enregistrement).
        Seuil dans l'unité de chaque enregistrement (usUnits 1 = US, °F)."""
        col, table = self.col("outTemp"), dbm.table_name
        above = "((usUnits = 1 AND %s >= 32) OR (usUnits <> 1 AND %s >= 0))" % (col, col)
        try:
            last = dbm.getSql("SELECT %s, usUnits FROM %s WHERE dateTime <= ? AND %s IS NOT NULL "
                              "ORDER BY dateTime DESC LIMIT 1" % (col, table, col), (stop,))
            if not last or last[0] >= (32 if last[1] == 1 else 0):
                return None
            # parcours de l'index dateTime à rebours : rapide tant que le gel est récent
            row = dbm.getSql("SELECT dateTime FROM %s WHERE dateTime <= ? AND %s "
                             "ORDER BY dateTime DESC LIMIT 1" % (table, above), (stop,))
            if row:
                return {"since": int(row[0])}
            first = dbm.getSql("SELECT MIN(dateTime) FROM %s WHERE %s IS NOT NULL" % (table, col))
            return {"since": int(first[0]), "partial": True} if first and first[0] else None
        except Exception as e:
            log.debug("livejson: durée du gel indisponible : %s", e)
            return None

    def _day_aggregates(self, day_span, dbm):
        """Extrêmes (avec l'heure) et cumuls d'une journée, d'après les résumés journaliers."""
        day = {}
        for obs, aggs in self.day_aggs.items():
            d = {}
            for agg in aggs:
                try:
                    vt = weewx.xtypes.get_aggregate(self.col(obs), day_span, agg, dbm)
                    tt = weewx.xtypes.get_aggregate(self.col(obs), day_span, agg + "time", dbm)
                except (weewx.UnknownType, weewx.UnknownAggregation):
                    continue
                except Exception as e:
                    log.debug("livejson: agrégat %s.%s indisponible : %s", obs, agg, e)
                    continue
                vt = self._conv(vt, obs)
                if vt is not None and vt.value is not None:
                    d[agg] = _round(vt.value)
                    d[agg + "Time"] = int(tt.value) if tt.value is not None else None
            if d:
                day[obs] = d
        for key in self.sum_keys:
            try:
                vt = self._conv(weewx.xtypes.get_aggregate(self.col(key), day_span, "sum", dbm), key)
                day.setdefault(key, {})["sum"] = _round(vt.value) if vt.value is not None else 0.0
            except Exception as e:
                log.debug("livejson: cumul %s indisponible : %s", key, e)
        return day

    # ------------------------------------------------------------------
    # Pages « jour » (SummaryByDay) : tous les panneaux pour une journée
    # ------------------------------------------------------------------
    @staticmethod
    def _day_span_of(timespan):
        return archiveDaySpan(timespan.start + 1)

    def day_data(self, timespan, db_lookup):
        """Même structure que history.json, pour la journée de « timespan » (minuit à minuit,
        ou jusqu'à la dernière archive pour le jour en cours)."""
        t1 = time.time()
        dbm = db_lookup(self.binding)
        day_span = self._day_span_of(timespan)
        stop = min(int(day_span.stop), int(timespan.stop), int(dbm.lastGoodStamp() or day_span.stop))
        series = self._raw_series(TimeSpan(day_span.start, stop), dbm)
        day = self._day_aggregates(day_span, dbm)
        # valeurs de la journée affichées en grand : moyennes du jour (température, vent,
        # humidité, pression et paramètres ajoutés hors cumuls ; la direction dominante est
        # calculée par la page, d'après la rose des vents)
        avg_keys = ["outTemp", "windSpeed", "outHumidity", "barometer"]
        avg_keys += [m["key"] for m in self.measures if not m["builtin"] and m["aggregate"] != "sum"]
        for obs in avg_keys:
            try:
                vt = self._conv(weewx.xtypes.get_aggregate(self.col(obs), day_span, "avg", dbm), obs)
                if vt is not None and vt.value is not None:
                    day.setdefault(obs, {})["avg"] = _round(vt.value)
            except Exception as e:
                log.debug("livejson: moyenne du jour %s indisponible : %s", obs, e)
        out = {
            "version": VERSION, "generated": int(time.time()), "stop": stop,
            "midnight": int(day_span.start), "nextMidnight": int(day_span.stop),
            "units": self.units, "series": series, "day": day,
        }
        log.debug("livejson: page jour générée en %.2f s", time.time() - t1)
        return out

    def span_data(self, timespan, db_lookup):
        """Pages « mois » / « année » : même structure que les pages de détail (résolution
        journalière), du début de la période à sa fin (ou à la dernière archive)."""
        t1 = time.time()
        dbm = db_lookup(self.binding)
        last = dbm.lastGoodStamp() or timespan.stop
        stop = min(int(timespan.stop), int(last))
        out = self._period_payload("span", int(timespan.start), stop, "day", dbm)
        out["end"] = int(timespan.stop)
        log.debug("livejson: page d'archive générée en %.2f s", time.time() - t1)
        return out

    def arch_info(self, timespan, db_lookup):
        """Titre, liens précédent / suivant et bornes du sélecteur de date des pages
        d'archives (le type de page se déduit de la durée de « timespan »)."""
        dbm = db_lookup(self.binding)
        if self._first_ts is None:                    # une requête pour toutes les pages
            self._first_ts = dbm.firstGoodStamp() or 0
        first_ts = self._first_ts or timespan.start
        gen = getattr(self.generator, "gen_ts", None) or dbm.lastGoodStamp() or time.time()
        first = datetime.date.fromtimestamp(first_ts)
        today = datetime.date.fromtimestamp(gen - 1)
        a = self.arch
        day_first = max(first, today - datetime.timedelta(days=a["days"] - 1)) if a["days"] else first
        d = datetime.date.fromtimestamp(timespan.start + 43200)
        length = timespan.stop - timespan.start

        def fname(kind, x):
            return {"day": "day-%04d-%02d-%02d.html" % (x.year, x.month, x.day),
                    "month": "month-%04d-%02d.html" % (x.year, x.month),
                    "year": "year-%04d.html" % x.year}[kind]

        info = {"first": first.isoformat(), "today": today.isoformat(), "dayFirst": day_first.isoformat(),
                "day": a["day"], "month": a["month"], "year": a["year"], "climato": a["climato"],
                "iso": d.isoformat(), "ym": "%04d-%02d" % (d.year, d.month), "y": d.year, "m": d.month,
                "years": list(range(first.year, today.year + 1))}
        if length <= 90000:                                  # journée
            prev_d, next_d = d - datetime.timedelta(days=1), d + datetime.timedelta(days=1)
            info.update(kind="day", label="%s %d %s %d" % (WEEKDAYS[d.weekday()], d.day, MONTHS[d.month - 1], d.year),
                        prev=fname("day", prev_d) if prev_d >= day_first else "",
                        next=fname("day", next_d) if next_d <= today else "")
        elif length <= 32 * 86400:                           # mois
            pm = datetime.date(d.year - (d.month == 1), (d.month - 2) % 12 + 1, 1)
            nm = datetime.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
            has_p, has_n = pm >= first.replace(day=1), nm <= today
            info.update(kind="month", label="%s %d" % (MONTHS[d.month - 1], d.year),
                        prev=fname("month", pm) if has_p else "",
                        next=fname("month", nm) if has_n else "",
                        # tableau climatologique : mois précédent / suivant (AAAA-MM)
                        prevYm="%04d-%02d" % (pm.year, pm.month) if has_p else "",
                        nextYm="%04d-%02d" % (nm.year, nm.month) if has_n else "")
        else:                                                # année
            info.update(kind="year", label="Année %d" % d.year,
                        prevY=d.year - 1 if d.year > first.year else "",
                        nextY=d.year + 1 if d.year < today.year else "",
                        prev=fname("year", datetime.date(d.year - 1, 1, 1)) if d.year > first.year else "",
                        next=fname("year", datetime.date(d.year + 1, 1, 1)) if d.year < today.year else "")
        return info

    # ------------------------------------------------------------------
    # Tableau climatologique mensuel (archive/climato-AAAA-MM.html) : une ligne par jour
    # (températures min. / moy. / max., vent moyen et rafale max., secteur dominant, pluie,
    # humidité et pression moyennes) et une ligne de synthèse du mois.
    # ------------------------------------------------------------------
    CLIMATO_COLS = (
        # clé de sortie, mesure (unités), résumé journalier (colonne de [[parameters]] le cas
        # échéant), valeur
        ("tmin", "outTemp", "outTemp", "min"), ("tavg", "outTemp", "outTemp", "avg"),
        ("tmax", "outTemp", "outTemp", "max"), ("wind", "windSpeed", "windSpeed", "avg"),
        ("gust", "windGust", "windGust", "max"), ("rain", "rain", "rain", "sum"),
        ("hum", "outHumidity", "outHumidity", "avg"), ("baro", "barometer", "barometer", "avg"),
    )

    @staticmethod
    def _vecdir(x, y):
        """Direction (° compas) du vecteur vent moyen (xsum : est, ysum : nord, comme weewx)."""
        if x is None or y is None or (x == 0 and y == 0):
            return None
        return round((90.0 - math.degrees(math.atan2(y, x))) % 360.0)

    # ------------------------------------------------------------------
    # Journées climatologiques selon les règles horaires de l'OMM (Météo-France) :
    #   Tn du jour J : minimum de J-1 18 h UTC à J 18 h UTC ;
    #   Tx et RR du jour J : maximum et cumul de J 6 h UTC à J+1 6 h UTC ;
    #   Tm : moyenne des 8 relevés trihoraires de J (0, 3, 6 … 21 h UTC).
    # Calcul sur les enregistrements d'archive (horodatage = fin de l'intervalle) ; Tn et Tx
    # viennent des colonnes lowOutTemp / highOutTemp si la base les contient, sinon de outTemp
    # (moyenne de l'intervalle d'archive : extrêmes un peu atténués).
    # ------------------------------------------------------------------
    OMM_SYNOP_MIN = 6          # relevés trihoraires requis pour la Tm d'un jour (sur 8)
    OMM_SYNOP_TOL = 600        # s : écart toléré entre un relevé et l'heure synoptique (au
                               # moins la moitié de l'intervalle d'archive)

    def _omm_days(self, first, last, dbm):
        """{date: {"tn", "tx", "rr", "obs": [températures trihoraires]}} du jour first au jour
        last (dates civiles, inclus), en °C et mm."""
        col_t, col_r, table = self.col("outTemp"), self.col("rain"), dbm.table_name
        keys = set(getattr(dbm, "sqlkeys", ()) or ())
        lo = "lowOutTemp" if col_t == "outTemp" and "lowOutTemp" in keys else col_t
        hi = "highOutTemp" if col_t == "outTemp" and "highOutTemp" in keys else col_t

        def utc(d, h):
            return calendar.timegm((d.year, d.month, d.day, h, 0, 0))
        one = datetime.timedelta(days=1)
        t0, t1 = utc(first - one, 18), utc(last + one, 6)
        sql = ("SELECT dateTime, usUnits, `interval`, %s, %s, %s, %s FROM %s WHERE dateTime > ? AND dateTime <= ? "
               "ORDER BY dateTime" % (col_t, lo, hi, col_r, table))
        try:
            rows = list(dbm.genSql(sql, (t0, t1)))
        except Exception as e:
            log.error("livejson: climatologie OMM : lecture de l'archive impossible : %s", e)
            return {}

        # conversions (affines) vers °C et mm, par système d'unités des enregistrements
        lin = {}

        def to(us, obs, target):
            k = (us, obs)
            if k not in lin:
                unit, grp = weewx.units.getStandardUnitType(us, obs)
                f = lambda v: weewx.units.convert(weewx.units.ValueTuple(v, unit, grp), target)[0]
                b = f(0.0)
                lin[k] = (f(1.0) - b, b)
            a, b = lin[k]
            return lambda v: None if v is None else a * v + b

        days = {}

        def day(d):
            return days.setdefault(d, {"tn": None, "tx": None, "rr": None, "obs": []})
        ts_list, temps, tols = [], [], []
        for ts, us, iv, t, tl, th, r in rows:
            ct, cr = to(us, "outTemp", "degree_C"), to(us, "rain", "mm")
            t, tl, th, r = ct(t), ct(tl if tl is not None else t), ct(th if th is not None else t), cr(r)
            # Tn : (J-1 18 h, J 18 h] UTC ; Tx et RR : (J 6 h, J+1 6 h] UTC
            dn = datetime.datetime.fromtimestamp(ts - 1 + 21600, datetime.timezone.utc).date()
            dx = datetime.datetime.fromtimestamp(ts - 1 - 21600, datetime.timezone.utc).date()
            if tl is not None and first <= dn <= last:
                d = day(dn)
                d["tn"] = tl if d["tn"] is None else min(d["tn"], tl)
            if first <= dx <= last:
                d = day(dx)
                if th is not None:
                    d["tx"] = th if d["tx"] is None else max(d["tx"], th)
                if r is not None:
                    d["rr"] = (d["rr"] or 0.0) + r
            if t is not None:
                ts_list.append(ts)
                temps.append(t)
                tols.append(max(self.OMM_SYNOP_TOL, (iv or 0) * 30))   # interval en minutes
        # relevés trihoraires : enregistrement à l'heure synoptique, sinon le plus proche
        d = first
        while d <= last:
            for h in range(0, 24, 3):
                s = utc(d, h)
                i = bisect.bisect_left(ts_list, s)
                best = None
                for j in (i - 1, i):
                    if 0 <= j < len(ts_list) and abs(ts_list[j] - s) <= tols[j]:
                        if best is None or abs(ts_list[j] - s) < abs(ts_list[best] - s):
                            best = j
                if best is not None:
                    day(d)["obs"].append(temps[best])
            d += one
        return days

    def _omm_tm(self, o):
        """Tm d'un jour : moyenne des relevés trihoraires (au moins OMM_SYNOP_MIN sur 8)."""
        obs = o.get("obs") or []
        return sum(obs) / len(obs) if len(obs) >= self.OMM_SYNOP_MIN else None

    def _final_times(self, d):
        """Instants où les valeurs du jour d deviennent définitives : (Tn, Tx et pluie).
        omm : J 18 h UTC et J+1 6 h UTC ; civil : fin de la journée (minuit local)."""
        if self.arch["climato_method"] == "omm":
            nxt = d + datetime.timedelta(days=1)
            return (calendar.timegm((d.year, d.month, d.day, 18, 0, 0)),
                    calendar.timegm((nxt.year, nxt.month, nxt.day, 6, 0, 0)))
        end = int(time.mktime((d + datetime.timedelta(days=1)).timetuple()))
        return end, end

    def _disp(self, v, obs):
        """Valeur en °C (outTemp) ou mm (rain) -> unité affichée."""
        if v is None:
            return None
        unit, grp = ("degree_C", "group_temperature") if obs == "outTemp" else ("mm", "group_rain")
        return self._conv(weewx.units.ValueTuple(v, unit, grp), obs).value

    def climato_data(self, timespan, db_lookup):
        t1 = time.time()
        dbm = db_lookup(self.binding)
        start, end = int(timespan.start), int(timespan.stop)
        last = int(dbm.lastGoodStamp() or end)
        stop = max(start, min(end, last))
        rows = {}                                   # date -> {clé: valeur}

        def read(obs, col, sql_cols, pick):
            """Lit le résumé journalier « col » du mois ; pick(ligne, conv) -> {clé: valeur}."""
            sql = ("SELECT dateTime, %s FROM %s_day_%s WHERE dateTime >= ? AND dateTime < ? ORDER BY dateTime"
                   % (sql_cols, dbm.table_name, col))
            try:
                res = list(dbm.genSql(sql, (start, end)))
            except Exception as e:
                log.debug("livejson: résumé journalier %s indisponible : %s", col, e)
                return False
            unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, obs)

            def conv(v):
                if v is None:
                    return None
                return _round(self._conv(weewx.units.ValueTuple(v, unit, group), obs).value, 1)
            for r in res:
                vals = {k: v for k, v in pick(r[1:], conv).items() if v is not None}
                if vals:
                    rows.setdefault(datetime.date.fromtimestamp(r[0]), {}).update(vals)
            return True

        def avg(ws, st):
            return ws / st if ws is not None and st else None

        cols = {}
        for key, obs, col, how in self.CLIMATO_COLS:
            cols.setdefault((obs, self.col(col)), []).append((key, how))
        for (obs, col), wanted in cols.items():
            def pick(r, conv, wanted=wanted):
                mn, mx, ws, st, sm = r
                v = {"min": mn, "max": mx, "avg": avg(ws, st), "sum": sm}
                return {k: conv(v[how]) for k, how in wanted}
            ok = read(obs, col, "min, max, wsum, sumtime, sum", pick)
            if not ok and obs == "windGust":
                # pas de résumé windGust : maximum du vecteur vent (rafale)
                read("windGust", "wind", "min, max, wsum, sumtime, sum", pick)
        # secteur dominant du jour (vent vectoriel moyen)
        read("windSpeed", "wind", "xsum, ysum",
             lambda r, conv: {"dir": self._vecdir(r[0], r[1])})

        first = datetime.date.fromtimestamp(start)
        last_day = datetime.date.fromtimestamp(stop - 1) if stop > start else first
        days, d = [], first
        while d <= last_day and d < datetime.date.fromtimestamp(end):
            r = rows.get(d, {})
            r["d"] = d.day
            r["iso"] = d.isoformat()
            days.append(r)
            d += datetime.timedelta(days=1)

        # synthèse du mois (agrégats weewx sur la période)
        span = TimeSpan(start, stop)
        total = {}
        for key, obs, col, how in self.CLIMATO_COLS:
            try:
                vt = self._conv(weewx.xtypes.get_aggregate(self.col(col), span, how, dbm), obs)
                if vt is not None and vt.value is not None:
                    total[key] = _round(vt.value, 1)
            except Exception as e:
                log.debug("livejson: agrégat mensuel %s.%s indisponible : %s", col, how, e)
        if "gust" not in total:
            try:
                vt = self._conv(weewx.xtypes.get_aggregate("wind", span, "max", dbm), "windGust")
                if vt is not None and vt.value is not None:
                    total["gust"] = _round(vt.value, 1)
            except Exception:
                pass
        try:
            vt = weewx.xtypes.get_aggregate("wind", span, "vecdir", dbm)
            if vt.value is not None:
                total["dir"] = round(vt.value)
        except Exception as e:
            log.debug("livejson: direction dominante du mois indisponible : %s", e)

        method = self.arch["climato_method"]
        if method == "omm" and days:
            # températures et pluie selon les fenêtres UTC de l'OMM (le reste : journée civile)
            od = self._omm_days(first, datetime.date.fromisoformat(days[-1]["iso"]), dbm)
            obs_all, tns, txs, rrs = [], [], [], []
            for r in days:
                o = od.get(datetime.date.fromisoformat(r["iso"]), {})
                for k in ("tmin", "tavg", "tmax", "rain"):
                    r.pop(k, None)
                vals = {"tmin": (o.get("tn"), "outTemp"), "tavg": (self._omm_tm(o), "outTemp"),
                        "tmax": (o.get("tx"), "outTemp"), "rain": (o.get("rr"), "rain")}
                for k, (v, obs) in vals.items():
                    if v is not None:
                        r[k] = _round(self._disp(v, obs), 1)
                obs_all += o.get("obs") or []
                if o.get("tn") is not None:
                    tns.append(o["tn"])
                if o.get("tx") is not None:
                    txs.append(o["tx"])
                if o.get("rr") is not None:
                    rrs.append(o["rr"])
            for k in ("tmin", "tavg", "tmax", "rain"):
                total.pop(k, None)
            # mois : Tn la plus basse, Tx la plus haute, moyenne de tous les relevés trihoraires
            for k, v, obs in (("tmin", min(tns) if tns else None, "outTemp"),
                              ("tavg", sum(obs_all) / len(obs_all) if obs_all else None, "outTemp"),
                              ("tmax", max(txs) if txs else None, "outTemp"),
                              ("rain", sum(rrs) if rrs else None, "rain")):
                if v is not None:
                    total[k] = _round(self._disp(v, obs), 1)

        # valeurs provisoires : fenêtre du jour pas encore close à la dernière archive (Tn ;
        # Tx et pluie) -> {clé: instant où la valeur devient définitive} ; ligne « Mois » :
        # colonnes dont au moins un jour est provisoire
        prov_cols = set()
        for r in days:
            ftn, ftx = self._final_times(datetime.date.fromisoformat(r["iso"]))
            p = {k: f for k, f in (("tmin", ftn), ("tmax", ftx), ("rain", ftx)) if k in r and last < f}
            if p:
                r["prov"] = p
                prov_cols.update(p)
        if prov_cols:
            total["prov"] = sorted(prov_cols)

        units = {k: self.units.get(obs, "") for k, obs, _c, _h in self.CLIMATO_COLS}
        log.debug("livejson: tableau climatologique généré en %.2f s", time.time() - t1)
        return {"version": VERSION, "generated": int(time.time()), "start": start, "end": end,
                "stop": stop, "units": units, "days": days, "total": total, "method": method}

    # Tableau climatologique annuel (archive/climato-AAAA.html) : une ligne par mois, en
    # trois tableaux (températures et nombres de jours, pluie, vent) et une ligne « Année ».
    # Seuils des nombres de jours (valeurs en °C et mm, quelles que soient les unités
    # affichées) :
    CLIMATO_ICE_C = 0.0        # jour sans dégel : max. <= 0 °C
    CLIMATO_HEAT_C = 30.0      # jour de forte chaleur : max. > 30 °C
    CLIMATO_HEAVY_MM = 10.0    # jour de forte pluie : cumul >= 10 mm

    def climato_year_data(self, timespan, db_lookup):
        t1 = time.time()
        dbm = db_lookup(self.binding)
        start, end = int(timespan.start), int(timespan.stop)

        def table(obs, col, cols):
            """Lignes [date, valeurs…] du résumé journalier de l'année + conversions
            (unités affichées, et unité de référence pour les seuils)."""
            sql = ("SELECT dateTime, %s FROM %s_day_%s WHERE dateTime >= ? AND dateTime < ? ORDER BY dateTime"
                   % (cols, dbm.table_name, col))
            try:
                res = list(dbm.genSql(sql, (start, end)))
            except Exception as e:
                log.debug("livejson: résumé journalier %s indisponible : %s", col, e)
                return None, None, None
            unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, obs)

            def conv(v):
                return None if v is None else self._conv(weewx.units.ValueTuple(v, unit, group), obs).value

            def ref(v, target):
                return None if v is None else weewx.units.convert(weewx.units.ValueTuple(v, unit, group), target).value
            return [(datetime.date.fromtimestamp(r[0]), r[1:]) for r in res], conv, ref

        months = [dict() for _ in range(12)]
        year = {}

        def acc(m, key, v, how):
            """Accumule v dans le mois m et dans l'année : min, max, somme, moyenne, compte."""
            for d in (months[m], year):
                if how == "min":
                    d[key] = v if d.get(key) is None else min(d[key], v)
                elif how == "max":
                    d[key] = v if d.get(key) is None else max(d[key], v)
                elif how in ("sum", "count"):
                    d[key] = d.get(key, 0) + v
                elif how == "mean":                          # moyenne simple (liste)
                    d.setdefault(key, []).append(v)
                elif how == "wavg":                          # moyenne pondérée (wsum, sumtime)
                    w, t = d.get(key, (0.0, 0.0))
                    d[key] = (w + v[0], t + v[1])

        method = self.arch["climato_method"]
        if method == "omm":
            # températures et pluie selon les fenêtres UTC de l'OMM (_omm_days) ; valeurs déjà
            # dans les unités affichées (conv, conv_r : identité)
            conv = conv_r = (lambda v: v)
            jan1 = datetime.date.fromtimestamp(start + 43200).replace(month=1, day=1)
            last_d = datetime.date.fromtimestamp(min(end, int(dbm.lastGoodStamp() or end)) - 1)
            last_d = min(last_d, jan1.replace(month=12, day=31))
            od = self._omm_days(jan1, last_d, dbm) if last_d >= jan1 else {}
            for day, o in sorted(od.items()):
                m = day.month - 1
                tn, tx, rr, obs = o["tn"], o["tx"], o["rr"], o["obs"]
                if tn is not None:
                    acc(m, "tmin", self._disp(tn, "outTemp"), "min")
                    acc(m, "tminAvg", self._disp(tn, "outTemp"), "mean")
                    acc(m, "frost", 1 if tn < FROST_C else 0, "count")
                if tx is not None:
                    acc(m, "tmax", self._disp(tx, "outTemp"), "max")
                    acc(m, "tmaxAvg", self._disp(tx, "outTemp"), "mean")
                    acc(m, "ice", 1 if tx <= self.CLIMATO_ICE_C else 0, "count")
                    acc(m, "heat", 1 if tx > self.CLIMATO_HEAT_C else 0, "count")
                if obs:
                    # moyenne de tous les relevés trihoraires du mois (et de l'année)
                    acc(m, "tavg", (sum(self._disp(v, "outTemp") for v in obs), len(obs)), "wavg")
                if rr is not None:
                    acc(m, "rain", self._disp(rr, "rain"), "sum")
                    acc(m, "rainDays", 1 if rr >= RAIN_DAY_MM - 1e-6 else 0, "count")
                    acc(m, "heavyDays", 1 if rr >= self.CLIMATO_HEAVY_MM else 0, "count")
        else:
            rows, conv, ref = table("outTemp", self.col("outTemp"), "min, max, wsum, sumtime")
            for day, (mn, mx, ws, st) in rows or ():
                m = day.month - 1
                if mn is not None:
                    acc(m, "tmin", conv(mn), "min")
                    acc(m, "tminAvg", conv(mn), "mean")
                    acc(m, "frost", 1 if ref(mn, "degree_C") < FROST_C else 0, "count")
                if mx is not None:
                    acc(m, "tmax", conv(mx), "max")
                    acc(m, "tmaxAvg", conv(mx), "mean")
                    acc(m, "ice", 1 if ref(mx, "degree_C") <= self.CLIMATO_ICE_C else 0, "count")
                    acc(m, "heat", 1 if ref(mx, "degree_C") > self.CLIMATO_HEAT_C else 0, "count")
                if ws is not None and st:
                    acc(m, "tavg", (ws, st), "wavg")
                    # moyenne affichée : convertie à la fin (température : conversion affine)
            rows, conv_r, ref_r = table("rain", self.col("rain"), "sum")
            for day, (sm,) in rows or ():
                if sm is None:
                    continue
                m = day.month - 1
                mm = ref_r(sm, "mm")
                acc(m, "rain", sm, "sum")
                acc(m, "rainDays", 1 if mm >= RAIN_DAY_MM - 1e-6 else 0, "count")
                acc(m, "heavyDays", 1 if mm >= self.CLIMATO_HEAVY_MM else 0, "count")
        rows, conv_w, _ = table("windSpeed", self.col("windSpeed"), "max, wsum, sumtime")
        for day, (mx, ws, st) in rows or ():
            m = day.month - 1
            if mx is not None:
                acc(m, "windMax", conv_w(mx), "max")
            if ws is not None and st:
                acc(m, "wind", (ws, st), "wavg")
        rows, conv_g, _ = table("windGust", self.col("windGust"), "max")
        if rows is None:                                    # pas de résumé windGust
            rows, conv_g, _ = table("windGust", "wind", "max")
        for day, (mx,) in rows or ():
            if mx is not None:
                acc(day.month - 1, "gust", conv_g(mx), "max")

        def finish(d):
            out = {}
            for k, v in d.items():
                if k in ("tavg", "wind"):
                    w, t = v
                    c = conv if k == "tavg" else conv_w
                    v = c(w / t) if t else None
                elif k in ("tminAvg", "tmaxAvg"):
                    v = sum(v) / len(v) if v else None
                elif k == "rain":
                    v = conv_r(v)
                if v is not None:
                    out[k] = _round(v, 1) if isinstance(v, float) else v
            return out

        y = datetime.date.fromtimestamp(start + 43200).year
        # mois provisoire : son dernier jour n'est pas encore définitif à la dernière archive
        # (Tx et pluie : lendemain 6 h UTC en méthode omm, minuit sinon)
        last_ts = int(dbm.lastGoodStamp() or 0)
        out_months = []
        for i, d in enumerate(months):
            row = dict(finish(d), m=i + 1, ym="%04d-%02d" % (y, i + 1))
            last_day = datetime.date(y + (i == 11), 1 if i == 11 else i + 2, 1) - datetime.timedelta(days=1)
            if len(row) > 2 and last_ts < self._final_times(last_day)[1]:
                row["prov"] = True
            out_months.append(row)
        res = {"version": VERSION, "generated": int(time.time()), "year": y,
               "units": {"temp": self.units.get("outTemp", ""), "rain": self.units.get("rain", ""),
                         "wind": self.units.get("windSpeed", ""), "gust": self.units.get("windGust", "")},
               "thresholds": {"frost": FROST_C, "ice": self.CLIMATO_ICE_C, "heat": self.CLIMATO_HEAT_C,
                              "rain": RAIN_DAY_MM, "heavy": self.CLIMATO_HEAVY_MM},
               "months": out_months,
               "total": dict(finish(year), **({"prov": True} if any(r.get("prov") for r in out_months) else {})),
               "method": method}
        log.debug("livejson: tableau climatologique annuel généré en %.2f s", time.time() - t1)
        return res

    # ------------------------------------------------------------------
    # Pages de détail
    # ------------------------------------------------------------------
    def period(self, name, stop, db_lookup):
        """Pages de détail (data/pNNN.json) : 24 h glissantes ou N jours civils (PERIODS)."""
        t1 = time.time()
        dbm = db_lookup(self.binding)
        ndays, resolution = PERIODS[name]
        if resolution == "raw":
            start = stop - 86400
        else:
            # début du jour civil, (ndays - 1) jours avant le jour de « stop »
            # (un enregistrement de 00:00 appartient à la veille, d'où stop - 1)
            d = datetime.date.fromtimestamp(stop - 1) - datetime.timedelta(days=ndays - 1)
            start = int(time.mktime(d.timetuple()))
        out = self._period_payload(name, start, stop, resolution, dbm)
        log.debug("livejson: période %s générée en %.2f s", name, time.time() - t1)
        return out

    def _period_payload(self, name, start, stop, resolution, dbm):
        """Statistiques et séries d'une période [start, stop] (pages de détail, pages
        « mois » et « année »)."""
        span = TimeSpan(start, stop)
        out = {
            "version": VERSION,
            "period": name,
            "resolution": resolution,
            "generated": int(time.time()),
            "start": int(start),
            "stop": int(stop),
            "units": self.units,
            "stats": self._period_stats(span, dbm),
        }
        if resolution == "raw":
            out["series"] = self._raw_series(span, dbm)
        elif resolution == "hour":
            out["series"] = self._agg_series(span, dbm, 3600)
        if resolution != "raw":
            daily = self._daily(start, stop, dbm)
            if resolution == "day":
                out["series"] = daily
            out["daily"] = {k: daily.get(k, {}).get("sum", []) for k in self.sum_keys}
            out["days"] = self._day_counts(daily)
        return out

    def _raw_series(self, span, dbm):
        series = {}
        ck = (int(span.start), int(span.stop))
        if ck in self._raw_cache:            # history.json et p24h.json (même fenêtre si hours = 24)
            return self._raw_cache[ck]
        for obs in self.raw_keys:
            try:
                _start_vt, stop_vt, data_vt = weewx.xtypes.get_series(self.col(obs), span, dbm)
            except (weewx.UnknownType, weewx.UnknownAggregation):
                continue
            except Exception as e:  # colonne absente, etc.
                log.debug("livejson: série %s indisponible : %s", obs, e)
                continue
            data_vt = self._conv(data_vt, obs)
            series[obs] = [[int(ts), _round(v)]
                           for ts, v in zip(stop_vt.value, data_vt.value) if v is not None]
        self._raw_cache = {ck: series}
        return series

    def _agg_series(self, span, dbm, interval, which=None):
        """Séries agrégées par intervalle (horodatage = début de l'intervalle) ;
        which : {mesure: agrégats} (par défaut toutes les séries utiles)."""
        series = {}
        for obs, aggs in (which or self.series_aggs).items():
            d = {}
            for agg in aggs:
                try:
                    start_vt, _stop_vt, data_vt = weewx.xtypes.get_series(
                        self.col(obs), span, dbm, aggregate_type=agg, aggregate_interval=interval)
                except Exception as e:
                    log.debug("livejson: série %s/%s indisponible : %s", obs, agg, e)
                    continue
                data_vt = self._conv(data_vt, obs)
                d[agg] = [[int(ts), _round(v)]
                          for ts, v in zip(start_vt.value, data_vt.value) if v is not None]
            if d:
                series[obs] = d
        return series

    # ------------------------------------------------------------------
    # « Ce jour et ce mois au fil des ans » : une ligne par année pour la date du
    # jour (même jour/mois) et pour le mois en cours, lues dans les résumés journaliers.
    # ------------------------------------------------------------------
    def climate(self, stop, db_lookup):
        t1 = time.time()
        dbm = db_lookup(self.binding)
        today = datetime.date.fromtimestamp(stop - 1)
        cols = {
            # observation : colonnes lues -> clés
            "outTemp": ("min", "mintime", "max", "maxtime", "wsum", "sumtime"),
            "barometer": ("min", "mintime", "max", "maxtime"),
            "rain": ("sum",),
            "windSpeed": ("wsum", "sumtime"),
            "windGust": ("max", "maxtime"),
        }
        days = {}       # date -> {obs: {col: val}}
        convs = {}      # obs -> conversion vers l'unité affichée
        for obs, cl in cols.items():
            # colonne configurée dans [[parameters]] (ex. rain -> autre pluviomètre)
            rows, conv = self._day_table(dbm, obs, cl)
            if conv is None:
                continue
            convs[obs] = conv
            for r in rows:
                d = datetime.date.fromtimestamp(r[0])
                rec = dict(zip(cl, r[1:]))
                if "wsum" in rec:
                    rec["avg"] = conv(rec["wsum"] / rec["sumtime"]) if rec["wsum"] is not None and rec["sumtime"] else None
                for k in ("min", "max", "sum"):
                    if k in rec:
                        rec[k] = conv(rec[k])
                days.setdefault(d, {})[obs] = rec
        if not days:
            return {"error": "pas de résumés journaliers"}

        def g(rec, obs, k):
            return (rec.get(obs) or {}).get(k)

        # --- même jour, chaque année ---
        day_rows = []
        for d in sorted(days):
            if (d.month, d.day) != (today.month, today.day):
                continue
            r = days[d]
            day_rows.append({
                "year": d.year,
                "tmin": _round(g(r, "outTemp", "min")), "tminTime": g(r, "outTemp", "mintime"),
                "tmax": _round(g(r, "outTemp", "max")), "tmaxTime": g(r, "outTemp", "maxtime"),
                "tavg": _round(g(r, "outTemp", "avg")),
                "pmin": _round(g(r, "barometer", "min")), "pminTime": g(r, "barometer", "mintime"),
                "pmax": _round(g(r, "barometer", "max")), "pmaxTime": g(r, "barometer", "maxtime"),
                "rain": _round(g(r, "rain", "sum")),
                "wind": _round(g(r, "windSpeed", "avg")),
                "gust": _round(g(r, "windGust", "max")), "gustTime": g(r, "windGust", "maxtime"),
            })

        # --- mois en cours, chaque année ---
        by_year = {}
        for d in sorted(days):
            if d.month == today.month:
                by_year.setdefault(d.year, []).append((d, days[d]))
        month_rows = []
        for year, lst in sorted(by_year.items()):
            def ext(obs, k, best):
                cand = [(g(r, obs, k), g(r, obs, k + "time")) for _, r in lst if g(r, obs, k) is not None]
                return best(cand, key=lambda c: c[0]) if cand else (None, None)

            def wavg(obs):
                ws = sum((g(r, obs, "wsum") or 0) for _, r in lst)
                st = sum((g(r, obs, "sumtime") or 0) for _, r in lst)
                if not st or obs not in convs:
                    return None
                return convs[obs](ws / st)

            tmin, tmint = ext("outTemp", "min", min)
            tmax, tmaxt = ext("outTemp", "max", max)
            pmin, pmint = ext("barometer", "min", min)
            pmax, pmaxt = ext("barometer", "max", max)
            davg = [(g(r, "outTemp", "avg"), int(time.mktime(d.timetuple()))) for d, r in lst
                    if g(r, "outTemp", "avg") is not None]
            rain = [g(r, "rain", "sum") for _, r in lst if g(r, "rain", "sum") is not None]
            ndays = (datetime.date(year + (today.month == 12), today.month % 12 + 1, 1)
                     - datetime.date(year, today.month, 1)).days
            month_rows.append({
                "year": year, "days": len(lst), "daysInMonth": ndays,
                "complete": len(lst) >= ndays - 1 and not (year == today.year),
                "tavg": _round(wavg("outTemp")),
                "tmin": _round(tmin), "tminTime": tmint, "tmax": _round(tmax), "tmaxTime": tmaxt,
                "pmin": _round(pmin), "pminTime": pmint, "pmax": _round(pmax), "pmaxTime": pmaxt,
                "hotDay": {"v": _round(max(davg)[0]), "t": max(davg)[1]} if davg else None,
                "coldDay": {"v": _round(min(davg)[0]), "t": min(davg)[1]} if davg else None,
                "rain": _round(sum(rain)) if rain else None,
                "wind": _round(wavg("windSpeed")),
            })

        first = min(days)
        log.debug("livejson: statistiques au fil des ans générées en %.2f s", time.time() - t1)
        return {
            "version": VERSION, "generated": int(time.time()),
            "since": int(time.mktime(first.timetuple())),
            "today": {"year": today.year, "month": today.month, "day": today.day},
            "day": day_rows, "month": month_rows,
        }

    # ------------------------------------------------------------------
    # « Soleil et Lune » : almanach weewx (weewx.almanac, calculs PyEphem — dépendance de
    # weewx 5). Lever / coucher / passage au méridien, durée du jour et écart avec la veille,
    # phase de la lune, hauteurs et azimuts toutes les 10 min pour le graphique. Sans
    # PyEphem : seulement lever / coucher du soleil et phase de la lune.
    # ------------------------------------------------------------------
    def astro_data(self, stop, db_lookup):
        t1 = time.time()
        if not to_bool(self.astro.get("enable", True)):
            return {"error": "désactivé"}
        lat, lon = self._coords()
        if lat is None or lon is None:
            return {"error": "coordonnées de la station inconnues"}
        stn = self.generator.stn_info
        try:
            alt_m = weewx.units.convert(stn.altitude_vt, "meter")[0]
        except Exception:
            alt_m = 0.0
        # température et pression actuelles : réfraction (comme $almanac des gabarits weewx)
        temp_c, press = 15.0, 1010.0
        try:
            rec = db_lookup(self.binding).getRecord(stop, max_delta=3600)
            if rec:
                if rec.get("outTemp") is not None:
                    temp_c = weewx.units.convert(weewx.units.as_value_tuple(rec, "outTemp"), "degree_C")[0]
                if rec.get("barometer") is not None:
                    press = weewx.units.convert(weewx.units.as_value_tuple(rec, "barometer"), "mbar")[0]
        except Exception as e:
            log.debug("livejson: almanach, mesures indisponibles : %s", e)

        day = archiveDaySpan(stop)                    # jour de la station (minuit à minuit)
        noon = day.start + (day.stop - day.start) // 2
        alm = weewx.almanac.Almanac(noon, lat, lon, altitude=alt_m, temperature=temp_c,
                                    pressure=press, moon_phases=MOON_PHASES)
        prev = alm(almanac_time=noon - 86400)

        def raw(vh):
            try:
                v = vh.raw
            except Exception:
                return None
            return int(round(v)) if v is not None else None

        out = {"version": VERSION, "generated": int(time.time()), "ephem": bool(alm.hasExtras),
               "latitude": lat, "longitude": lon, "start": int(day.start), "stop": int(day.stop)}
        try:
            if alm.hasExtras:
                sun = alm.sun
                rise, sset, transit = raw(sun.rise), raw(sun.set), raw(sun.transit)
                visible = sun.visible.raw
                prev_visible = prev.sun.visible.raw
                out["sun"] = {
                    "rise": rise, "set": sset, "transit": transit,
                    "transitAlt": _round(alm(almanac_time=transit).sun.alt, 1) if transit else None,
                    "daylight": int(round(visible)), "daylightPrev": int(round(prev_visible)),
                    "diff": int(round(visible - prev_visible)),
                }
                moon = alm.moon
                out["moon"] = {"rise": raw(moon.rise), "set": raw(moon.set), "transit": raw(moon.transit)}
                # hauteurs et azimuts toutes les 10 min (réfraction comprise)
                step = 600
                times = list(range(int(day.start), int(day.stop) + 1, step))
                curve = {"step": step, "t0": times[0], "sun": [], "sunAz": [], "moon": [], "moonAz": []}
                for t in times:
                    a = alm(almanac_time=t)
                    s_, m_ = a.sun, a.moon
                    curve["sun"].append(_round(s_.alt, 2)); curve["sunAz"].append(_round(s_.az, 1))
                    curve["moon"].append(_round(m_.alt, 2)); curve["moonAz"].append(_round(m_.az, 1))
                out["curve"] = curve
            else:
                rise, sset = raw(alm.sunrise), raw(alm.sunset)
                prise, pset = raw(prev.sunrise), raw(prev.sunset)
                daylight = (sset - rise) if rise and sset else None
                prev_daylight = (pset - prise) if prise and pset else None
                out["sun"] = {"rise": rise, "set": sset, "transit": None, "transitAlt": None,
                              "daylight": daylight, "daylightPrev": prev_daylight,
                              "diff": daylight - prev_daylight if daylight is not None and prev_daylight is not None else None}
                out["moon"] = {"rise": None, "set": None, "transit": None}
            # phase de la lune à l'heure du rapport
            now_alm = alm(almanac_time=stop)
            out["moon"].update({"index": int(now_alm.moon_index), "phase": MOON_PHASES[int(now_alm.moon_index) % 8],
                                "fullness": _round(now_alm.moon_fullness, 0)})
        except Exception as e:
            log.error("livejson: almanach indisponible : %s", e)
            return {"error": "almanach indisponible (%s)" % e}
        log.debug("livejson: almanach généré en %.2f s", time.time() - t1)
        return out

    # ------------------------------------------------------------------
    # Page « Extrêmes » : records absolus, classements (jours, mois, averses) et plus
    # longues périodes de gel, de sécheresse et de pluie, depuis le début des données.
    # ------------------------------------------------------------------
    def _day_table(self, dbm, obs, cols):
        """Lignes du résumé journalier de « obs » (colonnes demandées) + fonction de conversion."""
        col = self.col(obs)
        sql = "SELECT dateTime, %s FROM %s_day_%s ORDER BY dateTime" % (", ".join(cols), dbm.table_name, col)
        try:
            rows = list(dbm.genSql(sql))
        except Exception as e:
            log.debug("livejson: résumé journalier %s indisponible : %s", obs, e)
            return [], None
        unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, col)

        def conv(v):
            if v is None:
                return None
            return self._conv(weewx.units.ValueTuple(v, unit, group), obs).value
        return rows, conv

    def extremes(self, stop, db_lookup):
        t1 = time.time()
        dbm = db_lookup(self.binding)
        top = self.ext_top
        today = datetime.date.fromtimestamp(stop - 1)
        midnight = int(time.mktime(today.timetuple()))
        r1 = lambda v: None if v is None else round(v, 1)
        out = {"version": VERSION, "generated": int(time.time()), "top": top,
               "thresholds": {"rainDay": self.ext_wet, "coverage": self.ext_cover}}

        # --- température : résumés journaliers ---
        trows, tconv = self._day_table(dbm, "outTemp", ("min", "mintime", "max", "maxtime", "wsum", "sumtime"))
        tdays = []          # (début du jour, min, mintime, max, maxtime, moyenne, couverture)
        for ts, mn, mnt, mx, mxt, ws, st in trows:
            if mn is None:
                continue
            avg = tconv(ws / st) if ws is not None and st else None
            tdays.append((int(ts), tconv(mn), mnt, tconv(mx), mxt, avg, (st or 0) / 86400.0))
        # --- pluie ---
        rrows, rconv = self._day_table(dbm, "rain", ("sum", "count", "sumtime"))
        rdays = [(int(ts), rconv(sm) or 0.0) for ts, sm, n, st in rrows if n]
        # jours suffisamment mesurés (aujourd'hui toujours admis) : seuls comptés dans les
        # mois et les périodes, pour qu'une panne ne passe pas pour un jour sec
        rok = {int(ts) for ts, sm, n, st in rrows
               if n and ((st or 0) / 86400.0 >= self.ext_cover or int(ts) >= midnight)}
        firsts = [d[0] for d in tdays[:1]] + [d[0] for d in rdays[:1]]
        out["since"] = min(firsts) if firsts else None

        # --- records absolus ---
        rec = {}
        if tdays:
            lo = min(tdays, key=lambda d: d[1])
            hi = max((d for d in tdays if d[3] is not None), key=lambda d: d[3], default=None)
            rec["tmin"] = {"v": r1(lo[1]), "t": lo[2]}
            if hi:
                rec["tmax"] = {"v": r1(hi[3]), "t": hi[4]}
        for obs, k, cols in (("barometer", "p", ("min", "mintime", "max", "maxtime")),):
            rows, conv = self._day_table(dbm, obs, cols)
            rows = [r for r in rows if r[1] is not None]
            if rows:
                lo = min(rows, key=lambda r: r[1])
                hi = max((r for r in rows if r[3] is not None), key=lambda r: r[3], default=None)
                rec[k + "min"] = {"v": r1(conv(lo[1])), "t": lo[2]}
                if hi:
                    rec[k + "max"] = {"v": r1(conv(hi[3])), "t": hi[4]}
        rows, conv = self._day_table(dbm, "windGust", ("max", "maxtime"))
        rows = [r for r in rows if r[1] is not None]
        if rows:
            hi = max(rows, key=lambda r: r[1])
            rec["gust"] = {"v": r1(conv(hi[1])), "t": hi[2]}
        if rdays:
            ts, v = max(rdays, key=lambda d: d[1])
            rec["rainDay"] = {"v": r1(v), "t": ts}
        out["records"] = rec

        # --- jours : moyenne journalière (jours complets, hors aujourd'hui) ---
        full = [d for d in tdays if d[5] is not None and d[6] >= self.ext_cover and d[0] < midnight]
        out["coldDays"] = [{"v": r1(d[5]), "t": d[0]} for d in sorted(full, key=lambda d: (d[5], -d[0]))[:top]]
        out["hotDays"] = [{"v": r1(d[5]), "t": d[0]} for d in sorted(full, key=lambda d: (-d[5], -d[0]))[:top]]
        out["wetDays"] = [{"v": r1(v), "t": ts} for ts, v in sorted(rdays, key=lambda d: (-d[1], -d[0]))[:top] if v > 0]

        # --- averses : plus forte pluie en une heure (heure d'horloge), une par jour ---
        out["showers"] = self._showers(dbm, top)

        # --- mois complets (hors mois en cours) ---
        months = {}
        for ts, ws, st in ((int(r[0]), r[5], r[6]) for r in trows):
            d = datetime.date.fromtimestamp(ts)
            m = months.setdefault((d.year, d.month), {"ws": 0.0, "st": 0.0, "tdays": 0, "rain": 0.0, "rdays": 0})
            if ws is not None and st:
                m["ws"] += ws; m["st"] += st; m["tdays"] += 1
        for ts, v in rdays:
            d = datetime.date.fromtimestamp(ts)
            m = months.setdefault((d.year, d.month), {"ws": 0.0, "st": 0.0, "tdays": 0, "rain": 0.0, "rdays": 0})
            m["rain"] += v
            m["rdays"] += ts in rok
        tm, rm = [], []
        for (y, mo), m in months.items():
            if (y, mo) >= (today.year, today.month):
                continue
            ndays = (datetime.date(y + (mo == 12), mo % 12 + 1, 1) - datetime.date(y, mo, 1)).days
            # mois complet : au plus un jour manquant, couverture globale ≥ min_day_coverage
            if m["tdays"] >= ndays - 1 and m["st"] >= ndays * 86400 * self.ext_cover:
                tm.append((tconv(m["ws"] / m["st"]), y, mo))
            if m["rdays"] >= ndays - 1:
                rm.append((m["rain"], y, mo))
        mk = lambda v, y, mo: {"v": r1(v), "y": y, "m": mo}
        out["coldMonths"] = [mk(*x) for x in sorted(tm, key=lambda x: (x[0], -x[1], -x[2]))[:top]]
        out["hotMonths"] = [mk(*x) for x in sorted(tm, key=lambda x: (-x[0], -x[1], -x[2]))[:top]]
        out["wetMonths"] = [mk(*x) for x in sorted(rm, key=lambda x: (-x[0], -x[1], -x[2]))[:top]]
        out["dryMonths"] = [mk(*x) for x in sorted(rm, key=lambda x: (x[0], -x[1], -x[2]))[:top]]

        # --- périodes : gel (enregistrements < 0 °C), sécheresse, pluie ---
        out["frost"] = self._frost_periods(dbm, tdays, top)
        out["dry"], out["wet"] = self._rain_periods(rdays, rok, top)
        log.debug("livejson: extrêmes générés en %.2f s", time.time() - t1)
        return out

    def _showers(self, dbm, top):
        """Plus fortes pluies sur une heure d'horloge locale (une par jour). Regroupement fait
        en Python : portable (SQLite, MySQL/MariaDB) et indépendant du fuseau horaire."""
        col = self.col("rain")
        sql = "SELECT dateTime, %s FROM %s WHERE %s > 0" % (col, dbm.table_name, col)
        hours = {}      # début de l'heure locale -> cumul (unités de la base)
        try:
            for ts, v in dbm.genSql(sql):
                t = int(ts) - 1                  # horodatage weewx = fin d'intervalle
                lt = time.localtime(t)
                h = t - lt.tm_min * 60 - lt.tm_sec
                hours[h] = hours.get(h, 0.0) + v
        except Exception as e:
            log.debug("livejson: averses indisponibles : %s", e)
            return []
        unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, col)
        best = {}       # jour -> (mm, début de l'heure)
        for t, v in hours.items():
            mm = self._conv(weewx.units.ValueTuple(v, unit, group), "rain").value
            day = datetime.date.fromtimestamp(t)
            if day not in best or mm > best[day][0]:
                best[day] = (mm, t)
        lst = sorted(best.values(), key=lambda x: (-x[0], -x[1]))[:top]
        return [{"v": round(v, 1), "t": t} for v, t in lst]

    def _frost_periods(self, dbm, tdays, top):
        """Plus longues périodes continues sous 0 °C, d'après les enregistrements d'archive
        des seuls jours dont le minimum est négatif (jours consécutifs regroupés)."""
        cand = [d[0] for d in tdays if d[1] is not None and d[1] < 0.0]
        if not cand:
            return []
        ranges, cur = [], [cand[0], cand[0]]
        for ts in cand[1:]:
            if ts - cur[1] <= 90000:            # jour suivant (marge pour l'heure d'été)
                cur[1] = ts
            else:
                ranges.append(cur); cur = [ts, ts]
        ranges.append(cur)
        col = self.col("outTemp")
        unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, col)
        # 0 °C dans l'unité de la base : comparaison sans conversion, seules les valeurs
        # négatives sont converties
        zero = weewx.units.convert(weewx.units.ValueTuple(0.0, "degree_C", "group_temperature"), unit).value \
            if unit else 0.0
        conv = lambda v: self._conv(weewx.units.ValueTuple(v, unit, group), "outTemp").value
        periods = []
        for a, b in ranges:
            sql = ("SELECT dateTime, %s, interval FROM %s WHERE dateTime > ? AND dateTime <= ? "
                   "AND %s IS NOT NULL ORDER BY dateTime" % (col, dbm.table_name, col))
            try:
                rows = list(dbm.genSql(sql, (a, b + 90000)))
            except Exception as e:
                log.debug("livejson: périodes de gel indisponibles : %s", e)
                return []
            run = None
            prev = None
            for ts, v, iv in rows:
                t = conv(v) if v < zero else None
                ivs = (iv or 5) * 60
                gap = prev is not None and ts - prev > 2 * ivs + 60
                if t is not None and not (run and gap):
                    if run is None:
                        run = {"start": ts - ivs, "end": ts, "w": 0.0, "n": 0.0, "min": t}
                    run["end"] = ts; run["w"] += t * ivs; run["n"] += ivs; run["min"] = min(run["min"], t)
                else:
                    if run:
                        periods.append(run)
                    run = None
                    if t is not None:                 # trou de données : nouvelle période
                        run = {"start": ts - ivs, "end": ts, "w": t * ivs, "n": ivs, "min": t}
                prev = ts
            if run:
                periods.append(run)
        periods.sort(key=lambda r: (-(r["end"] - r["start"]), -r["start"]))
        return [{"start": int(r["start"]), "end": int(r["end"]), "dur": int(r["end"] - r["start"]),
                 "avg": round(r["w"] / r["n"], 1) if r["n"] else None, "min": round(r["min"], 1)}
                for r in periods[:top]]

    def _rain_periods(self, rdays, rok, top):
        """Jours consécutifs sans pluie (sécheresse) et avec pluie ≥ seuil (périodes de pluie).
        Un jour sans données ou insuffisamment mesuré (absent de « rok ») interrompt la série."""
        rdays = [d for d in rdays if d[0] in rok]
        dry, wet = [], []
        cur_d = cur_w = None
        prev = None
        for ts, v in rdays:
            d = datetime.date.fromtimestamp(ts)
            cont = prev is not None and (d - prev).days == 1
            if not cont:
                if cur_d: dry.append(cur_d)
                if cur_w: wet.append(cur_w)
                cur_d = cur_w = None
            if v < 0.05:
                cur_d = [cur_d[0], ts, cur_d[2] + 1] if cur_d else [ts, ts, 1]
            elif cur_d:
                dry.append(cur_d); cur_d = None
            if v >= self.ext_wet - 1e-6:
                cur_w = [cur_w[0], ts, cur_w[2] + 1, cur_w[3] + v] if cur_w else [ts, ts, 1, v]
            elif cur_w:
                wet.append(cur_w); cur_w = None
            prev = d
        if cur_d: dry.append(cur_d)
        if cur_w: wet.append(cur_w)
        dry.sort(key=lambda x: (-x[2], -x[0]))
        wet.sort(key=lambda x: (-x[2], -x[3], -x[0]))
        return ([{"start": a, "end": b, "days": n} for a, b, n in dry[:top]],
                [{"start": a, "end": b, "days": n, "total": round(t, 1)} for a, b, n, t in wet[:top]])

    def _daily(self, start, stop, dbm):
        """Valeurs journalières lues directement dans les résumés journaliers
        (une requête par observation : rapide même sur 365 jours). Mesure sans résumé
        journalier (type dérivé xtypes…) : agrégats journaliers calculés par weewx."""
        series = {}
        for obs, aggs in self.series_aggs.items():
            table = "%s_day_%s" % (dbm.table_name, self.col(obs))
            sql = ("SELECT dateTime, min, max, wsum, sumtime, sum FROM %s "
                   "WHERE dateTime >= ? AND dateTime < ? ORDER BY dateTime" % table)
            try:
                rows = list(dbm.genSql(sql, (start, stop)))
            except Exception as e:
                log.debug("livejson: résumé journalier %s indisponible (%s) : calcul par weewx", obs, e)
                d = self._agg_series(TimeSpan(start, stop), dbm, 86400, {obs: aggs}).get(obs)
                if d:
                    series[obs] = d
                continue
            unit, group = weewx.units.getStandardUnitType(dbm.std_unit_system, self.col(obs))

            def conv(v):
                if v is None:
                    return None
                return _round(self._conv(weewx.units.ValueTuple(v, unit, group), obs).value)

            d = {agg: [] for agg in aggs}
            for ts, mn, mx, wsum, sumtime, sm in rows:
                vals = {
                    "min": mn, "max": mx, "sum": sm,
                    "avg": (wsum / sumtime) if wsum is not None and sumtime else None,
                }
                for agg in aggs:
                    v = conv(vals[agg])
                    if v is not None:
                        d[agg].append([int(ts), v])
            series[obs] = d
        return series

    @staticmethod
    def _day_counts(daily):
        t = daily.get("outTemp", {})
        rain = daily.get("rain", {}).get("sum", [])
        out = {
            "days": len(t.get("max", [])) or len(rain),
            "frostDays": sum(1 for _, v in t.get("min", []) if v < FROST_C),
            "hotDays": sum(1 for _, v in t.get("max", []) if v >= HOT_C),
            "rainDays": sum(1 for _, v in rain if v >= RAIN_DAY_MM - 1e-6),
            "thresholds": {"frost": FROST_C, "hot": HOT_C, "rain": RAIN_DAY_MM},
        }
        if rain:
            ts, v = max(rain, key=lambda p: p[1])
            out["maxDailyRain"] = {"value": v, "time": ts}
        return out

    def _period_stats(self, span, dbm):
        """Extrêmes (avec l'heure), moyennes et cumuls de la période, direction dominante."""
        stats = {}
        for obs, aggs in self.period_aggs.items():
            d = {}
            for agg in aggs:
                try:
                    vt = self._conv(weewx.xtypes.get_aggregate(self.col(obs), span, agg, dbm), obs)
                    if vt is None or vt.value is None:
                        continue
                    d[agg] = _round(vt.value)
                    if agg in ("min", "max"):
                        tt = weewx.xtypes.get_aggregate(self.col(obs), span, agg + "time", dbm)
                        d[agg + "Time"] = int(tt.value) if tt.value is not None else None
                except Exception as e:
                    log.debug("livejson: agrégat %s.%s indisponible : %s", obs, agg, e)
            if d:
                stats[obs] = d
        for key in self.sum_keys:
            try:
                vt = self._conv(weewx.xtypes.get_aggregate(self.col(key), span, "sum", dbm), key)
                stats.setdefault(key, {})["sum"] = _round(vt.value) if vt.value is not None else 0.0
            except Exception as e:
                log.debug("livejson: cumul %s indisponible : %s", key, e)
        try:
            vt = weewx.xtypes.get_aggregate("wind", span, "vecdir", dbm)
            if vt.value is not None:
                stats["windDir"] = {"vecdir": _round(vt.value, 0)}
        except Exception as e:
            log.debug("livejson: direction dominante indisponible : %s", e)
        return stats


# ----------------------------------------------------------------------
# Générateur Cheetah du skin : celui de weewx, avec l'option [LiveJSON] [[archives]] pour
# les pages d'archives (sections [[SummaryByDay]], [[SummaryByMonth]], [[SummaryByYear]]) :
# désactivation par type de page (day / month / year / climato = false, d'après le nom du
# gabarit) et limite des pages « jour » aux N derniers jours (days = N ; 0 = toutes).
# ----------------------------------------------------------------------
ARCH_TEMPLATE_RE = re.compile(r"^(day|month|year|climato)-%")


class LiveCheetahGenerator(CheetahGenerator):

    def _refresh_closed(self, section, gen_ts):
        """Méthode omm : le tableau climatologique du mois (ou de l'année) précédent a été
        produit pour la dernière fois avant que les valeurs de son dernier jour soient
        définitives (Tx et pluie : le 1er à 6 h UTC). weewx ne refait jamais la page d'une
        période passée : elle est supprimée, une seule fois après cette heure, pour être
        régénérée aussitôt avec les valeurs définitives."""
        try:
            rd = accumulateLeaves(section)
            by = rd.get("summarize_by")
            if by not in ("SummaryByMonth", "SummaryByYear"):
                return
            template, dest_dir, _enc, _binding = self._prepGen(rd)
            ref = gen_ts or time.time()
            today = datetime.date.fromtimestamp(ref - 1)
            cur = today.replace(day=1) if by == "SummaryByMonth" else today.replace(month=1, day=1)
            prev_last = cur - datetime.timedelta(days=1)
            prev = prev_last.replace(day=1) if by == "SummaryByMonth" else prev_last.replace(month=1, day=1)
            final = calendar.timegm((cur.year, cur.month, cur.day, 6, 0, 0))
            path = os.path.join(dest_dir, getFileName(template, time.mktime(prev.timetuple())))
            if ref >= final and os.path.exists(path) and os.path.getmtime(path) < final:
                os.remove(path)
                log.info("livejson: %s régénéré (valeurs devenues définitives)", os.path.basename(path))
        except Exception as e:
            log.debug("livejson: rafraîchissement du tableau climatologique précédent : %s", e)

    def generate(self, section, section_name, gen_ts):
        a = _archive_options(self.skin_dict.get("LiveJSON", {}))
        if "template" in section:
            m = ARCH_TEMPLATE_RE.match(os.path.basename(str(section["template"])))
            if m and not a[m.group(1)]:
                return 0
            if m and m.group(1) == "climato" and a["climato_method"] == "omm":
                self._refresh_closed(section, gen_ts)
        if section_name != "SummaryByDay" or not a["day"] or not a["days"]:
            return CheetahGenerator.generate(self, section, section_name, gen_ts)
        ref = gen_ts or time.time()
        # jour du rapport (un rapport de 00:00 appartient à la veille, comme dans arch_info)
        first = datetime.date.fromtimestamp(ref - 1) - datetime.timedelta(days=a["days"] - 1)
        first_ts = int(time.mktime(first.timetuple()))
        gd = CheetahGenerator.generator_dict
        orig = gd["SummaryByDay"]
        # seules les journées récentes sont produites (la fonction est rétablie ensuite)
        gd["SummaryByDay"] = lambda start_ts, stop_ts: orig(max(start_ts, first_ts), stop_ts)
        try:
            return CheetahGenerator.generate(self, section, section_name, gen_ts)
        finally:
            gd["SummaryByDay"] = orig
