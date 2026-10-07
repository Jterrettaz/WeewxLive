# Installeur weewx-live :  weectl extension install weewx-live.zip
from weecfg.extension import ExtensionInstaller


def loader():
    return WeewxLiveInstaller()


class WeewxLiveInstaller(ExtensionInstaller):
    def __init__(self):
        super(WeewxLiveInstaller, self).__init__(
            version="1.66",
            name="weewx-live",
            description="Tableau de bord météo temps réel (MQTT ou archive), pages de détail et records, en JSON statique",
            author="Jacques",
            config={
                "StdReport": {
                    "WeewxLive": {
                        "skin": "WeewxLive",
                        "enable": "true",
                    }
                }
            },
            files=[
                ("bin/user", ["bin/user/livejson.py"]),
                # un tuple par dossier : compatible weewx 4 et 5
                ("skins/WeewxLive", [
                    "skins/WeewxLive/skin.conf",
                    "skins/WeewxLive/index.html.tmpl",
                    "skins/WeewxLive/panels.inc",
                    "skins/WeewxLive/astro.inc",
                    "skins/WeewxLive/forecast.inc",
                    "skins/WeewxLive/maps.inc",
                    "skins/WeewxLive/climate.inc",
                    "skins/WeewxLive/layout.js",
                    "skins/WeewxLive/detail.html",
                    "skins/WeewxLive/detail.js",
                    "skins/WeewxLive/nav.js",
                    "skins/WeewxLive/extras.js",
                    "skins/WeewxLive/climate.js",
                    "skins/WeewxLive/astro.js",
                    "skins/WeewxLive/archive.js",
                    "skins/WeewxLive/climato.js",
                    "skins/WeewxLive/extremes.html",
                    "skins/WeewxLive/extremes.js",
                    "skins/WeewxLive/ensembles.html",
                    "skins/WeewxLive/ensembles.js",
                    "skins/WeewxLive/meteogram.html",
                    "skins/WeewxLive/meteogram.js",
                    "skins/WeewxLive/wxicons.js",
                    "skins/WeewxLive/style.css",
                    "skins/WeewxLive/app.js",
                    "skins/WeewxLive/minichart.js",
                    "skins/WeewxLive/config.json.tmpl",
                ]),
                ("skins/WeewxLive/archive", [
                    "skins/WeewxLive/archive/header.inc",
                    "skins/WeewxLive/archive/brand.inc",
                    "skins/WeewxLive/archive/day-%Y-%m-%d.html.tmpl",
                    "skins/WeewxLive/archive/month-%Y-%m.html.tmpl",
                    "skins/WeewxLive/archive/climato-%Y-%m.html.tmpl",
                    "skins/WeewxLive/archive/climato-%Y.html.tmpl",
                    "skins/WeewxLive/archive/year-%Y.html.tmpl",
                ]),
                ("skins/WeewxLive/vendor/leaflet", [
                    "skins/WeewxLive/vendor/leaflet/leaflet.js",
                    "skins/WeewxLive/vendor/leaflet/leaflet.css",
                ]),
                ("skins/WeewxLive/data", [
                    "skins/WeewxLive/data/history.json.tmpl",
                    "skins/WeewxLive/data/forecast.json.tmpl",
                    "skins/WeewxLive/data/climate.json.tmpl",
                    "skins/WeewxLive/data/extremes.json.tmpl",
                    "skins/WeewxLive/data/astro.json.tmpl",
                    "skins/WeewxLive/data/ensembles.json.tmpl",
                    "skins/WeewxLive/data/meteogram.json.tmpl",
                    "skins/WeewxLive/data/p24h.json.tmpl",
                    "skins/WeewxLive/data/p7d.json.tmpl",
                    "skins/WeewxLive/data/p30d.json.tmpl",
                    "skins/WeewxLive/data/p365d.json.tmpl",
                    "skins/WeewxLive/data/p730d.json.tmpl",
                ]),
            ],
        )
