# Installeur weewx-live :  weectl extension install weewx-live.zip
from weecfg.extension import ExtensionInstaller


def loader():
    return WeewxLiveInstaller()


class WeewxLiveInstaller(ExtensionInstaller):
    def __init__(self):
        super(WeewxLiveInstaller, self).__init__(
            version="1.46",
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
                ("skins/WeewxLive", ["skins/WeewxLive/skin.conf"]),
                ("skins/WeewxLive/live", [
                    "skins/WeewxLive/live/index.html.tmpl",
                    "skins/WeewxLive/live/panels.inc",
                    "skins/WeewxLive/live/astro.inc",
                    "skins/WeewxLive/live/detail.html",
                    "skins/WeewxLive/live/detail.js",
                    "skins/WeewxLive/live/nav.js",
                    "skins/WeewxLive/live/extras.js",
                    "skins/WeewxLive/live/climate.js",
                    "skins/WeewxLive/live/astro.js",
                    "skins/WeewxLive/live/archive.js",
                    "skins/WeewxLive/live/climato.js",
                    "skins/WeewxLive/live/extremes.html",
                    "skins/WeewxLive/live/extremes.js",
                    "skins/WeewxLive/live/style.css",
                    "skins/WeewxLive/live/app.js",
                    "skins/WeewxLive/live/minichart.js",
                    "skins/WeewxLive/live/config.json.tmpl",
                ]),
                ("skins/WeewxLive/live/archive", [
                    "skins/WeewxLive/live/archive/header.inc",
                    "skins/WeewxLive/live/archive/brand.inc",
                    "skins/WeewxLive/live/archive/day-%Y-%m-%d.html.tmpl",
                    "skins/WeewxLive/live/archive/month-%Y-%m.html.tmpl",
                    "skins/WeewxLive/live/archive/climato-%Y-%m.html.tmpl",
                    "skins/WeewxLive/live/archive/climato-%Y.html.tmpl",
                    "skins/WeewxLive/live/archive/year-%Y.html.tmpl",
                ]),
                ("skins/WeewxLive/live/vendor/leaflet", [
                    "skins/WeewxLive/live/vendor/leaflet/leaflet.js",
                    "skins/WeewxLive/live/vendor/leaflet/leaflet.css",
                ]),
                ("skins/WeewxLive/live/data", [
                    "skins/WeewxLive/live/data/history.json.tmpl",
                    "skins/WeewxLive/live/data/forecast.json.tmpl",
                    "skins/WeewxLive/live/data/climate.json.tmpl",
                    "skins/WeewxLive/live/data/extremes.json.tmpl",
                    "skins/WeewxLive/live/data/astro.json.tmpl",
                    "skins/WeewxLive/live/data/p24h.json.tmpl",
                    "skins/WeewxLive/live/data/p7d.json.tmpl",
                    "skins/WeewxLive/live/data/p30d.json.tmpl",
                    "skins/WeewxLive/live/data/p365d.json.tmpl",
                    "skins/WeewxLive/live/data/p730d.json.tmpl",
                ]),
            ],
        )
