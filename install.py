# Installeur weewx-live :  weectl extension install weewx-live.zip
import filecmp
import os
import shutil
import time

from weecfg.extension import ExtensionInstaller
# dossier de l'extension décompressée (contient skins/WeewxLive/skin.conf)
_HERE = os.path.dirname(os.path.abspath(__file__))


def loader():
    return WeewxLiveInstaller()


class WeewxLiveInstaller(ExtensionInstaller):
    def __init__(self):
        super(WeewxLiveInstaller, self).__init__(
            version="1.31",
            name="weewx-live",
            description="Tableau de bord météo temps réel (MQTT ou archive), pages de détail, archives, "
                        "records et prévisions Open-Meteo, en JSON statique",
            author="Jacques",
            config={
                "StdReport": {
                    "WeewxLive": {
                        "skin": "WeewxLive",
                        "enable": "true",
                        # langue des pages (lang/fr.conf, en.conf, de.conf, it.conf) : prioritaire sur
                        # [StdReport] [[Defaults]] lang (= en dans le weewx.conf de weewx 5)
                        "lang": "fr",
                    }
                }
            },
            files=[
                ("bin/user", ["bin/user/livejson.py"]),
                # un tuple par dossier : compatible weewx 4 et 5
                ("skins/WeewxLive", [
                    "skins/WeewxLive/skin.fr.conf",
                    "skins/WeewxLive/index.html.tmpl",
                    "skins/WeewxLive/panels.inc",
                    "skins/WeewxLive/astro.inc",
                    "skins/WeewxLive/forecast.inc",
                    "skins/WeewxLive/maps.inc",
                    "skins/WeewxLive/climate.inc",
                    "skins/WeewxLive/layout.js",
                    "skins/WeewxLive/detail.html.tmpl",
                    "skins/WeewxLive/detail.js",
                    "skins/WeewxLive/nav.js",
                    "skins/WeewxLive/extras.js",
                    "skins/WeewxLive/climate.js",
                    "skins/WeewxLive/astro.js",
                    "skins/WeewxLive/archive.js",
                    "skins/WeewxLive/climato.js",
                    "skins/WeewxLive/extremes.html.tmpl",
                    "skins/WeewxLive/extremes.js",
                    "skins/WeewxLive/ensembles.html.tmpl",
                    "skins/WeewxLive/ensembles.js",
                    "skins/WeewxLive/meteogram.html.tmpl",
                    "skins/WeewxLive/meteogram.js",
                    "skins/WeewxLive/wxicons.js",
                    "skins/WeewxLive/units.html.tmpl",
                    "skins/WeewxLive/units.js",
                    "skins/WeewxLive/appearance.html.tmpl",
                    "skins/WeewxLive/appearance.js",
                    "skins/WeewxLive/theme.js.tmpl",
                    "skins/WeewxLive/theme.css",
                    "skins/WeewxLive/admin.html.tmpl",
                    "skins/WeewxLive/admin.js",
                    "skins/WeewxLive/webcam.html.tmpl",
                    "skins/WeewxLive/vigilance.html.tmpl",
                    "skins/WeewxLive/webcam.js",
                    "skins/WeewxLive/about.html",
                    "skins/WeewxLive/warnings.js",
                    "skins/WeewxLive/style.css",
                    "skins/WeewxLive/app.js",
                    "skins/WeewxLive/minichart.js",
                    "skins/WeewxLive/config.json.tmpl",
                    "skins/WeewxLive/wxtime.js.tmpl",
                    "skins/WeewxLive/i18n.js.tmpl",
                ]),
                # fichiers de langue (option « lang » du rapport, skin.conf : lang = fr)
                ("skins/WeewxLive/lang", [
                    "skins/WeewxLive/lang/fr.conf",
                    "skins/WeewxLive/lang/en.conf",
                    "skins/WeewxLive/lang/de.conf",
                    "skins/WeewxLive/lang/it.conf",
                    "skins/WeewxLive/lang/pl.conf",
                ]),
                ("skins/WeewxLive/NOAA", [
                    "skins/WeewxLive/NOAA/NOAA-%Y-%m.txt.tmpl",
                    "skins/WeewxLive/NOAA/NOAA-%Y.txt.tmpl",
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
                    "skins/WeewxLive/data/warnings.json.tmpl",
                    "skins/WeewxLive/data/meteogram.json.tmpl",
                    "skins/WeewxLive/data/p24h.json.tmpl",
                    "skins/WeewxLive/data/p7d.json.tmpl",
                    "skins/WeewxLive/data/p30d.json.tmpl",
                    "skins/WeewxLive/data/p365d.json.tmpl",
                    "skins/WeewxLive/data/p730d.json.tmpl",
                ]),
            ],
        )
    def configure(self, engine):
        """skin.conf : l'ancien fichier, s'il existe et diffère du nouveau, est renommé en
        skin.conf.AAAAMMJJHHMM, puis le nouveau est copié (weewx 4 et 5 copient les fichiers
        de la liste « files » avant d'appeler configure(), d'où la copie faite ici)."""
        def say(msg, level=2):
            out = getattr(engine, "printer", None)
            if out is not None:
                out.out(msg, level=level)                 # weewx 5
            elif getattr(engine, "logger", None) is not None:
                engine.logger.log(msg, level=level)       # weewx 4
        roots = getattr(engine, "root_dict", {}) or {}
        skin_root = roots.get("SKIN_DIR") or roots.get("SKIN_ROOT")
        if not skin_root:
            say("weewx-live : dossier des skins introuvable, skin.conf non copié", level=0)
            return False
        src = os.path.join(_HERE, "skins", "WeewxLive", "skin.conf")
        dst = os.path.join(skin_root, "WeewxLive", "skin.conf")
        dry = getattr(engine, "dry_run", False)
        if os.path.exists(dst) and not filecmp.cmp(src, dst, shallow=False):
            backup = dst + "." + time.strftime("%Y%m%d%H%M")
            if os.path.exists(backup):                    # deux installations dans la même minute
                backup = dst + "." + time.strftime("%Y%m%d%H%M%S")
            say("%s the previous skin.conf as %s" % ("Fake saving" if dry else "Saving", backup), level=0)
            if not dry:
                os.replace(dst, backup)
        say("Copying from '%s' to '%s'" % (src, dst), level=3)
        if not dry:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy(src, dst)
        return False
