# weewx-live

Site météo pour une station **Davis Vantage Pro 2** (ou toute station) pilotée par **weewx**,
publiable sur un hébergement web **statique** : le serveur weewx reste sur le réseau local
et n'a pas besoin d'être joignable depuis internet. Version 1.50.

- **Tableau de bord** : pour chaque paramètre configuré, valeur actuelle, minimum et maximum
  du jour (avec l'heure) et graphique sur 24 h. Mise à jour **en temps réel par MQTT**, ou à
  **chaque archive weewx** si MQTT est désactivé.
  - Panneaux spécialisés : température (écarts sur 1 h et 24 h), vent (boussole, rafales),
    direction du vent (rose des vents et graphique de la direction sur 24 h), pluie (barres
    horaires + courbe de cumul), rayonnement, humidité, pression (tendance sur 3 h).
  - Paramètres supplémentaires et **panneaux groupés** (ex. particules PM1 / PM2.5 / PM10).
  - Chaque panneau peut être **réduit** (valeurs seules) ; les panneaux réduits sont regroupés
    en tête, en tuiles. Choix mémorisé par panneau dans le navigateur ; « Tout réduire » /
    « Tout développer ».
  - **Soleil et Lune** : lever / coucher du soleil et de la lune, durée du jour et écart avec
    la veille, phase de la lune, courbes de hauteur et position actuelle.
  - **Prévisions Open-Meteo** (7 jours, détail heure par heure), **radar** et **satellite**
    (cartes Windy, ou RainViewer / EUMETSAT).
  - **Ce jour et ce mois au fil des ans** : records de chaque année pour la date du jour et le
    mois en cours, comparés aux valeurs actuelles.
- **Une page par paramètre** (menu « Données » ou titre d'un panneau) : statistiques et
  graphique sur **24 h, 7 jours, 30 jours, 365 jours et 730 jours**,
  l'un sous l'autre.
- **Une page par période** (en haut du menu « Données ») : 24 dernières heures, 7, 30 et
  365 derniers jours, avec une section par paramètre (statistiques et graphique).
- **Archives** (`archive/day-AAAA-MM-JJ.html`, `month-AAAA-MM.html`, `year-AAAA.html`) :
  une page par jour (tous les panneaux du tableau de bord), par mois et par année (une section
  par paramètre), avec sélecteur de date et navigation précédent / suivant (désactivables).
- **Climatologie** (menu « Climatologie ») : tableau **mensuel** (`archive/climato-AAAA-MM.html`,
  une ligne par jour : températures, vent, secteur, pluie, humidité, pression ; lien vers la
  page d'archives de chaque jour) et **annuel** (`archive/climato-AAAA.html`, une ligne par
  mois : températures et nombres de jours de gel / sans dégel / forte chaleur, pluie, vent ;
  lien vers le tableau de chaque mois). Cellules colorées.
- **Prévisions d'ensemble** (menu « Prévisions » → « Ensembles », `ensembles.html`) : tous
  les membres des modèles d'ensemble d'Open-Meteo (ECMWF, GFS, ICON, GEM, Google…), moyenne
  groupée, pluie et probabilité par jour, analyse écrite, comparaison des modèles, tableau
  jour après jour ; modèles configurables.
- **Page « Extrêmes »** : records absolus, classements (jours, mois, averses) et plus longues
  périodes de gel, de sécheresse et de pluie, sur toute la base de données.
- Températures colorées selon leur valeur (bleus ≤ 0 °C, verts de 0 à 10 °C, jaune → rouge
  au-delà), thème clair / sombre automatique, affichage mobile.

```
 Réseau local                              │  Internet
                                           │
 Vantage Pro 2 ─► weewx ─┬─ weewx-mqtt ────┼──► broker MQTT (wss) ──────┐
                         │   (sortant)     │      (facultatif)          │ temps réel
                         │                 │                            ▼
                         └─ rapport        │                       navigateur
                            WeewxLive ─► FTP/RSYNC ─► hébergement web ──┘
                            (JSON à chaque │   (sortant)   live/index.html
                             archive)      │               live/data/*.json
```

Toutes les connexions partent du serveur weewx vers l'extérieur (FTP/rsync, MQTT) :
aucun port à ouvrir sur votre box.

## Contenu

| Fichier | Rôle |
|---|---|
| `install.py` | installeur pour `weectl extension install` |
| `bin/user/livejson.py` | extension weewx (SearchList) : calcule tous les fichiers JSON et les valeurs du gabarit |
| `skins/WeewxLive/skin.conf` | configuration du rapport : paramètres affichés, MQTT, prévisions, cartes, extrêmes |
| `skins/WeewxLive/live/panels.inc` | panneaux des paramètres, partagés par le tableau de bord et les pages d'archives « jour » |
| `skins/WeewxLive/live/astro.inc` | panneau « Soleil et Lune » du tableau de bord |
| `skins/WeewxLive/live/archive/day-%Y-%m-%d.html.tmpl` | page d'archives « jour » (une par journée) |
| `skins/WeewxLive/live/archive/month-%Y-%m.html.tmpl`, `year-%Y.html.tmpl` | pages d'archives « mois » et « année » |
| `skins/WeewxLive/live/archive/header.inc`, `archive.js` | en-tête commun des archives : menu, sélecteur de date, précédent / suivant |
| `skins/WeewxLive/live/archive/brand.inc` | marque (logo, nom) et menu des pages du dossier `archive/` |
| `skins/WeewxLive/live/archive/climato-%Y-%m.html.tmpl`, `climato-%Y.html.tmpl`, `climato.js` | tableaux climatologiques mensuel et annuel |
| `skins/WeewxLive/live/index.html.tmpl`, `app.js` | tableau de bord : gabarit Cheetah (un panneau par paramètre de `[[parameters]]`, configuration intégrée à la page) et script temps réel |
| `skins/WeewxLive/live/extras.js` | prévisions, radar et satellite du tableau de bord |
| `skins/WeewxLive/live/climate.js` | « Ce jour et ce mois au fil des ans » |
| `skins/WeewxLive/live/astro.js` | « Soleil et Lune » (affichage des données de l'almanach weewx) |
| `skins/WeewxLive/live/detail.html`, `detail.js` | pages de détail par paramètre |
| `skins/WeewxLive/live/extremes.html`, `extremes.js` | page « Extrêmes » |
| `skins/WeewxLive/live/ensembles.html`, `ensembles.js` | page « Prévisions — Ensembles » |
| `skins/WeewxLive/live/nav.js` | menu commun ; nom, sous-titre et logo des pages statiques |
| `skins/WeewxLive/live/minichart.js` | moteur de graphiques canvas + échelles de couleur des températures |
| `skins/WeewxLive/live/style.css` | thème (clair / sombre) |
| `skins/WeewxLive/live/data/*.json.tmpl`, `config.json.tmpl` | gabarits des fichiers JSON |
| `skins/WeewxLive/live/vendor/leaflet/` | bibliothèque de cartes Leaflet 1.9.4 (RainViewer / EUMETSAT) |

weewx produit dans `HTML_ROOT/live/` :

| Fichier | Contenu | Régénération |
|---|---|---|
| `index.html` | tableau de bord | à chaque archive |
| `config.json` | configuration de la page | à chaque archive |
| `data/history.json` | séries 24 h, extrêmes et cumuls du jour | à chaque archive |
| `data/p24h.json` | page de détail, 24 h | à chaque archive |
| `data/p7d.json` | 7 jours | 30 min max. |
| `data/p30d.json`, `p365d.json`, `p730d.json` | 30, 365, 730 jours | 1 h max. |
| `data/climate.json` | au fil des ans | 15 min max. |
| `data/extremes.json` | records | 1 h max. |
| `data/forecast.json` | prévisions Open-Meteo (cache) | à chaque archive, téléchargement 1 fois par heure |
| `data/astro.json` | soleil et lune du jour (almanach weewx) | à chaque archive |
| `data/ensembles.json` | prévisions d'ensemble Open-Meteo (membres) | toutes les 30 min, téléchargement au plus une fois par 3 h et par modèle |
| `archive/day-…`, `month-…`, `year-…`, `climato-…html` | pages d'archives | période en cours à chaque archive ; périodes passées une fois |
| `detail.html`, `extremes.html`, `ensembles.html`, `*.js`, `style.css`, `img/`, `vendor/` | fichiers copiés | à chaque archive (le FTP n'envoie que les fichiers modifiés) |

Les extrêmes du jour viennent des résumés journaliers de weewx (ils incluent les pics
mesurés entre deux archives). Les unités sont converties par weewx lui-même, quel que soit
le système d'unités de la base (US, METRIC, METRICWX) : °C, km/h, mm, mm/h, hPa, W/m², %,
µg/m³, h (durées), hPa/h, cm, °C·j, Wh, lx… (groupes d'unités de `GROUP_TARGET` dans
`livejson.py` ; les autres mesures restent dans l'unité de la base).

## 1. Installer l'extension

```bash
# weewx 5
weectl extension install weewx-live.zip
# weewx 4
sudo wee_extension --install weewx-live.zip
```

L'installeur ajoute dans `weewx.conf` :

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true
```

**Ordre des rapports** : `[[WeewxLive]]` doit être placé **avant** `[[FTP]]` / `[[RSYNC]]`,
sinon les fichiers sont envoyés avec un cycle de retard. weewx 5 le fait automatiquement ;
avec weewx 4, déplacez la section à la main.

**Mise à jour** : la réinstallation remplace `skin.conf` et les fichiers du skin (dont
`minichart.js`). Placez vos réglages dans `weewx.conf` (voir
[Conserver ses réglages](#conserver-ses-réglages-lors-des-mises-à-jour-weewxconf)).

## 2. Envoi vers l'hébergement web

Utilisez le rapport FTP ou RSYNC standard de weewx :

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true

    [[FTP]]
        skin = Ftp
        enable = true
        user = moncompte
        password = ********
        server = ftp.mon-hebergeur.fr
        path = /www/meteo          # la page sera sur https://mon-site/meteo/live/
        secure_ftp = true
```

ou

```ini
    [[RSYNC]]
        skin = Rsync
        enable = true
        server = mon-serveur.fr
        user = meteo
        path = /var/www/meteo
        delete = false
```

`FTP`/`RSYNC` envoient tout le contenu de `HTML_ROOT`, donc le dossier `live/` avec le reste
(skin Seasons, etc.). Paquet Debian/Ubuntu : `HTML_ROOT = /var/www/html/weewx`, la page
locale est alors aussi visible sur `http://serveur-weewx/weewx/live/`.

### Fréquence

Par défaut, un cycle à chaque archive (`archive_interval`, souvent 300 s). Pour une autre
fréquence (ex. toutes les 10 min) — à reporter aussi sur `[[FTP]]` pour rester synchronisé :

```ini
    [[WeewxLive]]
        report_timing = */10 * * * *
```

La page affiche un bandeau si `data/history.json` a plus de 30 minutes (génération ou envoi
interrompu).

## 3. Temps réel : MQTT (facultatif)

### Avec MQTT

Les visiteurs reçoivent les mesures directement du broker, qui doit donc être joignable
depuis internet, en **WebSocket sécurisé (`wss://`)** si la page est en HTTPS. Deux options :

- **Broker hébergé** (offres gratuites de type HiveMQ Cloud, EMQX Cloud…) : WebSocket TLS
  fourni, aucun serveur à gérer ;
- **Mosquitto sur un VPS / le serveur web**, avec `listener 9001` + `protocol websockets`
  derrière un reverse proxy HTTPS (nginx `location /mqtt` avec `Upgrade`/`Connection`).

weewx se connecte au broker en **sortant**. Configuration weewx-mqtt (`weewx.conf`) :

```ini
[StdRESTful]
    [[MQTT]]
        server_url = mqtts://weewx:MOT_DE_PASSE@broker.example.org:8883/
        topic = weather
        unit_system = METRIC
        binding = loop          # indispensable pour le temps réel
        aggregation = aggregate # un message JSON par paquet -> topic weather/loop
        [[[tls]]]
            tls_version = tlsv12
```

Le mode « individual » de weewx-mqtt (un topic par mesure, `weather/outTemp_C`…) est aussi
compris (topic `weather/#`) ; ne publiez pas les deux formes sur le même topic, la pluie
serait comptée deux fois.

Les clés `<mesure>_<unité>` sont converties (`_F`, `_mph`, `_in`, `_inHg`, `_knot`, `_cm`,
`_mbar`…). Une unité inconnue est signalée dans la console du navigateur et la valeur
affichée telle quelle.

**Variations de température sur 1 h et 24 h** (panneau Température) : la page lit dans
chaque message les clés `OutTemp-1h_C` (température d'il y a une heure) et `OutTemp-24h_C`
(il y a 24 heures) ; noms réglables par `temp_1h_key` et `temp_24h_key` dans `[[mqtt]]`.
Tant qu'une clé n'est pas reçue, l'écart est estimé à partir de l'historique weewx et suivi
d'un astérisque.

Créez deux comptes sur le broker : `weewx` (écriture sur `weather/#`) et un compte
**lecture seule** pour la page — ses identifiants sont publics puisque lus par le navigateur.

### mqtt.js en local (recommandé)

Sans copie locale, la page charge `mqtt.js` depuis unpkg.com. Pour l'héberger avec la page :

```bash
mkdir -p skins/WeewxLive/live/vendor
curl -L -o skins/WeewxLive/live/vendor/mqtt.min.js https://unpkg.com/mqtt@5/dist/mqtt.min.js
```

(le dossier `live/vendor/` est déjà prévu dans `copy_always`).

### Sans MQTT (mise à jour à chaque archive)

```ini
    [[mqtt]]
        enable = false
        archive_poll = 60      # secondes entre deux vérifications (15 à 3600)
```

La page affiche le dernier enregistrement d'archive (valeurs actuelles, extrêmes et cumuls du
jour, graphiques) et relit `data/history.json` toutes les `archive_poll` secondes ;
l'affichage change dès qu'une nouvelle archive a été générée et envoyée. L'indicateur d'état
affiche « Archive weewx » et l'âge du dernier enregistrement (« Pas de données » au-delà de
30 min). Les écarts de température sur 1 h / 24 h sont calculés d'après l'historique (« * »).

Ce fonctionnement sert aussi de **repli** si l'adresse du broker est vide, si mqtt.js ne peut
pas être chargé ou si la connexion ne peut pas être créée ; un bandeau l'indique.

### Changement de jour

Les extrêmes et cumuls du jour suivent le **jour de la station** (fuseau horaire du serveur
weewx) : `history.json` publie le minuit suivant de la station et la page change de jour à
ce moment-là, quel que soit le fuseau horaire du visiteur.

## 4. Configurer la page

Dans `skins/WeewxLive/skin.conf` (dossier skins de weewx, ex. `/etc/weewx/skins/` ou
`~/weewx-data/skins/`), section `[LiveJSON]` :

```ini
[LiveJSON]
    hours = 24                   # profondeur de l'historique du tableau de bord (1 à 72 h)
    station_name = ""            # vide = [Station] location de weewx.conf
    page_refresh = 300           # rechargement complet du tableau de bord (s, 0 = jamais)
    [[mqtt]]
        enable = true
        url = wss://broker.example.org:8884/mqtt
        topic = weather/loop
        username = lecteur
        password = mot-de-passe-lecture
```

`page_refresh` recharge la page entière (prise en compte d'une modification de `skin.conf`) ;
avec MQTT, cela interrompt brièvement le temps réel : mettez `0` pour ne jamais recharger,
les données étant de toute façon relues par la page.

Le sous-titre des pages est le modèle de station déclaré par weewx (`[Station]`, ex.
« Vantage · weewx »).

### Logo

Un logo peut s'afficher à gauche du nom de la station (toutes les pages) : déposez l'image
dans `skins/WeewxLive/live/img/` (copiée avec le site) et indiquez-la :

```ini
    logo = img/logo.png        # ou une adresse https://…
    logo_alt = Logo de la station
    logo_height = 48           # hauteur en pixels (16 à 200)
```

### Vérifier

```bash
sudo systemctl restart weewx
weectl report run WeewxLive        # weewx 5 : génération immédiate, sans attendre l'archive
ls HTML_ROOT/live/data/
```

Puis ouvrir `https://mon-site/…/live/`. Le pied de page indique l'heure de génération de
l'historique ; la pastille en haut à droite l'état de la connexion (« En direct »,
« Archive weewx », « Pas de données »…).

`?demo` à la fin de l'adresse du tableau de bord ou d'une page de détail : données simulées,
sans broker.

## 5. Paramètres affichés (`[[parameters]]`)

La liste des paramètres du tableau de bord, des pages de détail et du menu « Données » se
définit dans `[LiveJSON]` → `[[parameters]]` : une sous-section par paramètre, **dans l'ordre
d'affichage**.

```ini
    [[parameters]]
        # order = outTemp, wind, …    # facultatif, voir plus bas
        [[[outTemp]]]
            title = Température       # titre affiché
            column = outTemp          # colonne de la base weewx
            mqtt = outTemp            # nom MQTT (avant le suffixe d'unité : outTemp_C)
            aggregate = min-max       # min-max | max | sum
        …
        [[[UV]]]
            title = Indice UV
            column = UV
            mqtt = UV
            aggregate = max
            decimals = 1              # facultatif ; aussi : unit, hint, color (ex. --sun)
```

| Agrégat | Tableau de bord | Pages de détail |
|---|---|---|
| `min-max` | valeur, min. et max. du jour, courbe 24 h | min., max., moyenne ; moyenne + bande min–max |
| `max` | valeur, max. du jour, courbe 24 h | max., moyenne, moyenne des maxima ; courbe des maxima |
| `sum` | cumul du jour, cumul 24 h, barres horaires + cumul | cumul, max. journalier ; barres (heure / jour / mois) + cumul |

- Les 7 paramètres standard (`outTemp`, `wind`, `windDir`, `rain`, `radiation`,
  `outHumidity`, `barometer`) gardent leur panneau spécialisé tant que leur agrégat n'est pas
  modifié ; leurs `title`, `column` et `mqtt` sont modifiables. Changer leur agrégat les
  transforme en panneau générique.
- Supprimer une sous-section (ou `enable = false`) retire le paramètre partout. Sans aucune
  sous-section, les 7 paramètres standard sont affichés.
- `color` : nom d'une variable CSS du thème (`--temp`, `--wind`, `--rain`, `--sun`, `--hum`,
  `--press`…) ; toute autre valeur est ignorée.
- Un paramètre en °C (ex. température intérieure) a sa courbe colorée selon la température.
- Le tableau de bord (`index.html`) est **généré par weewx** à partir de
  `live/index.html.tmpl` : panneaux, titres et ordre suivent `[[parameters]]`, et la
  configuration est intégrée à la page. Après une modification, la page est régénérée à
  l'archive suivante (ou par `weectl report run WeewxLive`).
- L'unité est déduite de la colonne weewx et convertie ; `unit = …` impose le libellé.
- Le nom MQTT est comparé sans tenir compte de la casse, avec ou sans suffixe d'unité, et
  peut contenir « _ » (`pm2_5`) ; plusieurs paramètres peuvent lire la même mesure.
- Une mesure sans résumé journalier dans la base (type calculé par weewx) est agrégée par
  weewx pour les pages 30 / 365 jours (plus lent).

### Panneaux groupés (plusieurs mesures dans un panneau)

Une sous-section qui contient elle-même des sous-sections `[[[[…]]]]` décrit un **groupe** :
ses mesures partagent un panneau du tableau de bord (tableau valeur / min. / max. + un
graphique 24 h avec une courbe par mesure) et une page de détail (tableau min. / max. /
moyenne par mesure et par période ; une courbe par mesure : relevés bruts sur 24 h, moyennes
— ou maxima pour `aggregate = max` — horaires sur 7 jours et journalières au-delà).

```ini
        [[[particules]]]
            title = Particules fines
            aggregate = min-max       # min-max | max (commun à toutes les mesures)
            unit = µg/m³              # facultatif ; aussi decimals, hint
            [[[[pm1_0]]]]
                title = PM1
                column = pm1_0        # colonnes du schéma étendu weewx (wview_extended)
                mqtt = pm1_0
            [[[[pm2_5]]]]
                title = PM2.5
                column = pm2_5
                mqtt = pm2_5
            [[[[pm10_0]]]]
                title = PM10
                column = pm10_0
                mqtt = pm10_0         # facultatif par mesure : unit, decimals, color
```

- Le menu « Données » propose une seule page pour le groupe.
- Les identifiants (groupes et mesures) doivent être uniques dans `[[parameters]]` ; un
  doublon est signalé dans le journal de weewx et ignoré.
- Couleurs par défaut, dans l'ordre : bleu, orange, vert, jaune, violet.
- `aggregate = sum` n'est pas proposé pour un groupe.

### Conserver ses réglages lors des mises à jour (`weewx.conf`)

La réinstallation de l'extension écrase `skin.conf`. Les réglages peuvent être placés dans
`weewx.conf`, section `[StdReport]` → `[[WeewxLive]]` : weewx les fusionne avec `skin.conf`
et ils sont prioritaires (ajouter un niveau de crochets à chaque section).

```ini
[StdReport]
    [[WeewxLive]]
        skin = WeewxLive
        enable = true
        [[[LiveJSON]]]
            station_name = Ma station
            [[[[mqtt]]]]
                url = wss://broker.example.org:8884/mqtt
                username = lecteur
                password = ********
            [[[[parameters]]]]
                order = outTemp, particules, wind, windDir, rain, outHumidity, barometer
                [[[[[radiation]]]]]
                    enable = false
                [[[[[particules]]]]]
                    title = Particules fines
                    unit = µg/m³
                    [[[[[[pm1_0]]]]]]
                        title = PM1
                    [[[[[[pm2_5]]]]]]
                        title = PM2.5
```

- La fusion ajoute ou remplace, mais ne supprime pas : masquer un paramètre de `skin.conf`
  avec `enable = false`.
- Les paramètres ajoutés dans `weewx.conf` se placent après ceux de `skin.conf` ;
  `order = …` fixe l'ordre d'affichage (paramètres listés d'abord, dans cet ordre, puis
  les autres ; un identifiant inconnu est signalé dans le journal et ignoré).
- Redémarrer weewx après modification de `weewx.conf`.
- `weectl extension uninstall` supprime la section `[[WeewxLive]]` de `weewx.conf`.

## 6. Soleil et Lune, prévisions, radar et satellite (tableau de bord)

### Soleil et Lune

Avant les prévisions, un panneau donne pour aujourd'hui :

- **Soleil** : heures de lever et de coucher, durée du jour, écart de durée avec la veille
  (vert quand les jours rallongent), midi solaire et hauteur maximale, position actuelle
  (hauteur et direction) ;
- **Lune** : heures de lever et de coucher (« — » s'il n'y en a pas ce jour-là), phase avec
  son dessin et pourcentage éclairé, position actuelle ;
- un **graphique** de la hauteur du soleil et de la lune de 0 h à 24 h, avec l'horizon, la
  période de jour (fond) et la position actuelle de chacun (point), actualisé chaque minute.

Les calculs sont faits par **l'almanach de weewx** (`weewx.almanac`, le même que `$almanac`
dans les gabarits, avec PyEphem) pour la latitude, la longitude et l'altitude de la station
(`[Station]` de `weewx.conf`, ou `latitude`/`longitude` de `[[forecast]]`), en tenant compte de
la température et de la pression actuelles (réfraction). Ils sont publiés dans
`data/astro.json` à chaque archive : levers, couchers et passages au méridien, durée du jour
de la veille, phase de la lune, hauteurs et azimuts toutes les 10 minutes ; la page en
déduit la position actuelle. Les journées sont celles de la station ; les heures sont
affichées dans le fuseau horaire du visiteur.

PyEphem est installé avec weewx 5 (dépendance du paquet et de l'installation pip). Sans lui,
l'almanach de weewx ne fournit que le lever et le coucher du soleil et la phase de la lune :
le panneau affiche alors ces valeurs, sans lever / coucher de la lune ni graphique.
Pour masquer le panneau :

```ini
    [[astro]]
        enable = false
```

| Bloc | Source | Détails |
|---|---|---|
| **Prévisions** | [Open-Meteo](https://open-meteo.com/), modèle `best_match` | temps (pictogramme), max./min., pluie et probabilité, vent dominant et rafales ; lever/coucher du soleil et UV du jour. **Un clic sur un jour ouvre le détail heure par heure** : courbe de température, barres de précipitations et bandeau des 24 heures. |
| **Radar précipitations** | [Windy.com](https://embed.windy.com/) (par défaut) ou [RainViewer](https://www.rainviewer.com/api.html) | Windy : carte officielle intégrée (iframe), couche radar, animation par le bouton ▶. RainViewer : animation automatique des 2 dernières heures. |
| **Satellite** | [Windy.com](https://embed.windy.com/) (par défaut) ou [EUMETSAT EUMETView](https://view.eumetsat.int/) (WMS) | Windy : carte intégrée, couche satellite. EUMETSAT : animation Meteosat des 2 dernières heures (infrarouge ou couleurs vraies). |

**Cache des prévisions** (1 heure par défaut, `cache` en secondes dans `[[forecast]]`) :
weewx télécharge les prévisions au plus une fois par période et les publie dans
`data/forecast.json` ; tous les visiteurs lisent ce fichier. Si le téléchargement échoue, la
copie précédente est conservée et weewx ne réessaie qu'après 15 minutes (le rapport n'est
pas ralenti). Si le fichier est inutilisable, le navigateur interroge Open-Meteo lui-même et
garde la réponse en cache local pendant la même durée. L'heure de mise à jour est affichée
dans l'en-tête du bloc.

Le radar et le satellite sont demandés **directement par le navigateur** des visiteurs (sans
clé d'API) ; les cartes ne se chargent que lorsqu'elles deviennent visibles. Coordonnées :
celles de `[Station]` dans `weewx.conf`, ou `latitude`/`longitude` dans `[[forecast]]`.

```ini
    [[forecast]]
        enable = true
        model = best_match        # ou un modèle précis : meteofrance_seamless, icon_seamless…
        days = 7                  # 1 à 16
        cache = 3600              # secondes
    [[radar]]
        enable = true
        provider = windy          # ou rainviewer
        windy_overlay = radar     # autre couche Windy possible : satellite, rain, wind…
        windy_product = radar     # radar, satellite, ecmwf, gfs, icon…
        windy_url = ""            # ou l'adresse de l'iframe copiée depuis https://embed.windy.com
        zoom = 7
    [[satellite]]
        enable = true
        provider = windy          # ou eumetsat
        windy_overlay = satellite
        windy_product = satellite
        windy_url = ""
        zoom = 5
        # avec provider = eumetsat :
        layers = "mtg_fd:ir105_hrfi|Infrarouge", "mtg_fd:rgb_truecolour|Couleurs vraies"
        latency_minutes = 30      # délai de mise en ligne des images EUMETSAT
```

Conditions d'utilisation (les mentions sont déjà affichées) :

- **Open-Meteo** : gratuit pour un usage non commercial, attribution CC BY 4.0.
- **Windy** : widget d'intégration gratuit, sans clé ; pas de lancement automatique de
  l'animation, thème sombre uniquement. L'API cartographique Windy demande une clé payante.
- **RainViewer** : API gratuite pour un usage personnel ou éducatif, attribution obligatoire ;
  depuis janvier 2026 : passé seulement, une seule palette, zoom 7 max., 100 requêtes/minute
  par IP (une animation en consomme environ 52).
- **EUMETSAT** : images sous licence CC BY 4.0, mention « Contains modified EUMETSAT Meteosat data ».
- **Fond de carte** : © OpenStreetMap, © CARTO (usage non commercial).
- **Leaflet** (BSD-2, utilisé seulement par RainViewer et EUMETSAT) est inclus dans
  `live/vendor/leaflet/` ; s'il manque, il est chargé depuis cdnjs.

Les noms des couches EUMETView peuvent évoluer : liste à jour dans le
[GetCapabilities](https://view.eumetsat.int/geoserver/ows?service=WMS&version=1.3.0&request=GetCapabilities).

## 7. Ce jour et ce mois au fil des ans

En bas du tableau de bord, deux panneaux pour la date du jour et le mois en cours : records
de chaque année depuis le début des données (moyenne la plus chaude / froide, températures et
pressions extrêmes, jour le plus chaud / froid du mois, le plus pluvieux / sec, le plus
venteux), la valeur actuelle en regard (mise en évidence si elle bat le record, « provisoire »
pour une moyenne en cours), et des graphiques par année (barres Hi-Low colorées selon la
moyenne, précipitations). Données : `data/climate.json` (résumés journaliers) ; les valeurs
du jour sont complétées par les mesures en cours.

## 8. Pages de détail

`detail.html?p=<paramètre>` (ou l'identifiant d'un groupe). La page présente les périodes
l'une sous l'autre (statistiques puis graphique) ; ancres : `#p24h`, `#p7d`, `#p30d`,
`#p365d`, `#p730d`.

| Période | Fenêtre | Graphique |
|---|---|---|
| 24 h | 24 h glissantes | relevés d'archive |
| 7 jours | 7 jours civils, aujourd'hui inclus | moyennes + min–max horaires |
| 30 jours | 30 jours civils | moyennes + min–max journaliers (température : barres Hi-Low) |
| 365 jours | 365 jours civils | idem |
| 730 jours | 730 jours civils (2 ans) | idem (pluie : cumuls mensuels) |

| Paramètre | Statistiques |
|---|---|
| Température | minimum, maximum (date et heure), moyenne, amplitude ; jours de gel (min. < 0 °C) et jours chauds (max. ≥ 25 °C) à partir de 7 jours |
| Humidité | minimum, maximum, moyenne |
| Pression | minimum, maximum, moyenne, écart |
| Rayonnement | maximum, moyenne, moyenne des maxima journaliers |
| Vent | vent moyen, vent max., rafale max., direction dominante (vecteur moyen) |
| Pluie | cumul, intensité max. ; jours de pluie (≥ 0,2 mm) et maximum journalier à partir de 7 jours, max. en 1 h et heures de pluie sur 24 h |
| Groupe | tableau min. / max. / moyenne par mesure |

Les extrêmes et moyennes viennent des résumés journaliers de weewx ; les séries journalières
sont lues en une requête par mesure, rapide même sur un Raspberry Pi. Fréquences de
régénération : `stale_age` dans `skin.conf` ; seuils (gel, chaleur, pluie) en tête de
`bin/user/livejson.py`.

### Pages par période (tous les paramètres)

`detail.html?period=24h` (ou `7d`, `30d`, `365d`), en haut du menu « Données » (« Tous les
paramètres ») : une section par paramètre, identique à celle de la page de détail pour cette
période (statistiques puis graphique), avec des liens rapides vers chaque section en haut de
page. Le titre de chaque section mène à la page de détail du paramètre. Les données viennent
des mêmes fichiers `data/p24h.json`… (un seul fichier lu par page).

### Archives (pages jour, mois, année)

Pages statiques générées dans `archive/` (section `[[SummaryByDay]]`, `[[SummaryByMonth]]` et
`[[SummaryByYear]]` de `skin.conf`), accessibles par l'entrée **« Archives »** du menu
« Données » (page du jour en cours, ou du mois / de l'année si les pages jour sont désactivées) :

| Page | Gabarit | Contenu |
|---|---|---|
| `archive/day-AAAA-MM-JJ.html` | `live/archive/day-%Y-%m-%d.html.tmpl` | tous les panneaux du tableau de bord pour ce jour : min. et max. avec l'heure, cumuls, graphique de 0 h à 24 h, rose des vents ; la grande valeur est la dernière mesure de la journée |
| `archive/month-AAAA-MM.html` | `live/archive/month-%Y-%m.html.tmpl` | une section par paramètre (statistiques puis graphique jour par jour), comme les pages de période |
| `archive/year-AAAA.html` | `live/archive/year-%Y.html.tmpl` | idem, sur l'année |

En haut de chaque page : **« Historique de la station — choix de la date »** (calendrier) et
boutons **Jour / Mois / Année** qui ouvrent la page du jour, du mois ou de l'année contenant
la date choisie (Entrée : même type de page que la page affichée). Le sélecteur est limité à
la période couverte par la base ; une date sans page « jour » (antérieure à la limite `days`)
affiche un message proposant « Mois » ou « Année ». Puis liens précédent / suivant.
Pas de temps réel, ni « Soleil et Lune », ni prévisions, ni cartes.

Les données sont intégrées à chaque page (aucun fichier JSON à lire). La page de la période
en cours est régénérée à chaque archive ; celles des périodes passées ne sont produites
qu'une fois (si le fichier n'existe pas déjà).

```ini
    [[archives]]
        day = true        # pages « jour »
        month = true      # pages « mois » (toutes, depuis le début de la base)
        year = true       # pages « année » (toutes)
        climato = true    # tableaux climatologiques mensuels et annuels (tous)
        days = 0          # pages « jour » produites en remontant depuis aujourd'hui (0 = toutes, défaut)
```

L'ancienne section `[[day_pages]]` (`enable`, `days`, versions 1.41-1.42) reste reconnue.
Les pages « jour » des versions précédentes étaient dans `days/` : ce dossier peut être
supprimé du serveur.

Par défaut (`days = 0`), la première génération produit une page pour chaque journée de la
base (plusieurs milliers sur une base de plusieurs années, environ 40 à 90 Ko chacune) : elle
peut prendre du temps et le premier envoi FTP sera volumineux ; les suivantes ne produisent
que la page du jour. Pour limiter, par exemple, aux 365 derniers jours : `days = 365`. Le skin utilise pour cela son
propre générateur (`user.livejson.LiveCheetahGenerator`, le générateur Cheetah de weewx avec
ces options), déclaré dans `[Generators]` de `skin.conf`.

### Climatologie mensuelle

`archive/climato-AAAA-MM.html` (gabarit `live/archive/climato-%Y-%m.html.tmpl`, section
`[[SummaryByMonth]]`, option `climato` de `[[archives]]`), menu **« Climatologie »** →
**« Climatologie mensuelle »** (mois en cours). Un tableau par mois, une ligne par jour
(de 0 h à 24 h) :

| Colonne | Valeur | Couleur |
|---|---|---|
| Jour | numéro ; l'icône ouvre la page d'archives du jour (si elle existe) | — |
| Température min. / moy. / max. | résumés journaliers de weewx | paliers de 3 °C du site (`TEMP_STEPS`) |
| Vent moyen (rafale max.) | vitesse moyenne du jour, plus forte rafale | gris, d'autant plus foncé que le vent est fort (relatif au mois) |
| Secteur | direction du vent vectoriel moyen (8 secteurs) | — |
| Pluie | cumul du jour | vert pâle → bleu → violet |
| Humidité, Pression | moyennes du jour | jaune → vert → cyan ; cyan (basse) → vert → jaune (haute) |

En gras : température la plus basse, la plus haute et rafale la plus forte du mois. Dernière
ligne « Mois » : minimum, moyenne et maximum, vent moyen (rafale max.), secteur dominant,
cumul de pluie, humidité et pression moyennes. Une colonne sans données (pas de baromètre…)
est masquée. En haut : choix du mois et de l'année (« Afficher »), mois précédent / suivant,
liens vers les graphiques du mois et le tableau climatologique de l'année. Les pages « mois » des archives ont
un lien « Tableau climatologique du mois ». Sur petit écran, le tableau défile
horizontalement (colonne « Jour » fixe).

Les couleurs de la pression supposent des hPa (conversion automatique depuis inHg, mmHg,
kPa) ; celles de la pluie, des mm (conversion depuis in et cm).

### Climatologie annuelle

`archive/climato-AAAA.html` (gabarit `live/archive/climato-%Y.html.tmpl`, section
`[[SummaryByYear]]`, même option `climato`), menu **« Climatologie »** → **« Climatologie
année »** (année en cours). Trois tableaux, une ligne par mois (les mois sans données
affichent « — ») et une ligne « Année » ; l'icône à gauche du mois ouvre le tableau mensuel :

| Tableau | Colonnes |
|---|---|
| Température | moyenne, moyenne des minima, minimum, moyenne des maxima, maximum (couleurs `TEMP_STEPS`) ; jours sans dégel (max. ≤ 0 °C), jours de gel (min. < 0 °C), jours de forte chaleur (max. > 30 °C) |
| Pluie | cumul (vert pâle → bleu → violet), jours de pluie (≥ 0,2 mm), jours ≥ 10 mm |
| Vent | vent moyen, plus forte vitesse moyenne sur un intervalle d'archive (« vent 10 min » si `archive_interval = 600`), rafale maximum (gris relatif à l'année) |

En gras : extrêmes de l'année. En haut : choix de l'année, année précédente / suivante, lien
vers les graphiques de l'année ; la page « année » des archives a un lien « Tableau
climatologique de l'année ». Les seuils sont dans `livejson.py` (`CLIMATO_ICE_C`,
`CLIMATO_HEAT_C`, `CLIMATO_HEAVY_MM`, `FROST_C`, `RAIN_DAY_MM`) et s'appliquent en °C et
en mm quelles que soient les unités affichées.

## 9. Page « Extrêmes » (records de la station)

**Données → Extrêmes** (`extremes.html`) : calculs faits par weewx sur **toute la base**
(`data/extremes.json`, au plus une fois par heure).

- **Records absolus** : température la plus basse / la plus haute, pression la plus basse /
  la plus haute, rafale la plus forte (date et heure), plus forte pluie en un jour (date).
- **Jours** : les jours les plus froids et les plus chauds (température moyenne, jours mesurés
  à au moins `min_day_coverage`, aujourd'hui exclu), les plus pluvieux, et les averses les
  plus fortes (plus forte pluie sur une heure d'horloge locale, une par jour).
- **Mois** (complets, mois en cours exclu) : les plus froids, chauds, pluvieux, secs.
- **Périodes** :
  - gel : température continuellement < 0 °C d'après les enregistrements d'archive (durée,
    début, fin, moyenne, minimum) ; un trou dans les données coupe la période ;
  - sécheresse : jours consécutifs sans pluie mesurée ;
  - pluie : jours consécutifs avec au moins `rain_day_threshold` mm, pluie totale.
  Un jour sans données, ou mesuré sur moins de `min_day_coverage`, interrompt la série.

```ini
    [[extremes]]
        top = 10                    # lignes par classement (3 à 50)
        rain_day_threshold = 0.2    # mm (valeur incluse) : jour d'une période de pluie
        min_day_coverage = 0.75     # fraction du jour mesurée (0 à 1)
```

## 10. Prévisions d'ensemble (`ensembles.html`)

Menu **« Prévisions » → « Ensembles »**. Une prévision d'ensemble est calculée plusieurs fois
(les « membres ») avec des conditions de départ légèrement différentes : leur dispersion
mesure l'incertitude. La page regroupe les membres de plusieurs modèles de l'
[API Ensemble d'Open-Meteo](https://open-meteo.com/en/docs/ensemble-api) (présentation
inspirée de la page « Prévisions Open-Meteo » de Météo Sciez et des scripts de
digitalurban) :

- **boutons des modèles** (cliquer pour retirer / remettre un modèle ; au moins un reste
  affiché) et **horizon** (3, 7, 10, 16 jours) ; le choix est mémorisé par le navigateur ;
- **Température, Vent moyen, Pression — chaque membre** : une courbe fine par membre, à la
  couleur de son modèle, la **moyenne groupée** (tous les membres des modèles affichés) et la
  bande **10–90 %** ; l'infobulle donne aussi la moyenne de chaque modèle ;
- **Pluie — total du jour et probabilité** : moyenne groupée (barre bleue), 90e centile
  (barre grise), moyenne de chaque modèle (points), et pourcentage des membres prévoyant au
  moins `rain_threshold` mm ;
- **Analyse écrite** : chiffres clés (moyenne des maximales, enveloppe des membres, pluie
  totale, jours secs, vent maximal, nombre de membres, confiance) et texte généré : aperçu
  général, pluie, vent et pression, accord des modèles, prévisibilité ;
- **Comparaison des modèles** sur l'horizon (moyennes des max. / min., pluie, vent, pression,
  le plus chaud / le plus frais) et **jour après jour** (moyenne, intervalle 10–90 % et
  extrêmes, risque de pluie, confiance température et pluie, vent, pression ; « 3/5 » quand
  certains modèles ne vont pas jusqu'à ce jour).

weewx télécharge chaque modèle au plus une fois par `cache` (3 h ; les modèles sont recalculés
toutes les 6 à 12 h) et publie dans `data/ensembles.json` (environ 400 Ko pour 5 modèles et
207 membres) les membres de température, vent et pression (un point toutes les `step`
heures) et les valeurs journalières de chaque membre (max., min., pluie, vent max.,
pression moyenne, jour local de la station). Le navigateur fait tous les calculs, selon les
modèles cochés et l'horizon.

```ini
    [[ensembles]]
        enable = true
        models = ecmwf_ifs_025, gfs_seamless, icon_seamless_eps, gem_global, weathernext_ensemble_2
        days = 16                 # échéance téléchargée (limitée par chaque modèle)
        horizons = 3, 7, 10, 16   # boutons d'horizon (jours)
        default_horizon = 3
        step = 3                  # heures entre deux points des courbes (1, 2, 3, 4 ou 6)
        cache = 10800             # secondes (minimum 1800)
        rain_threshold = 0.2      # mm : pluie « mesurable » (risque de pluie)
        heavy_rain = 5            # mm : forte pluie (analyse écrite)
        # latitude / longitude : par défaut celles de [[forecast]] ou de [Station]
```

Modèles disponibles (identifiant, membres, échéance) : `ecmwf_ifs_025` (ECMWF ENS, 51, 15 j),
`ecmwf_aifs_025` (ECMWF AIFS, IA, 51, 15 j), `gfs_seamless` (NOAA GEFS, 31, 16 j et plus),
`icon_seamless_eps` (DWD ICON EPS, 40, 7,5 j), `icon_eu_eps` (40, 5 j), `icon_d2_eps` (20, 2 j),
`gem_global` (ECCC GEPS, 21, 16 j), `weathernext_ensemble_2` (Google WeatherNext 2, IA, 64,
15 j), `ukmo_mogreps_global` (Met Office, 18, 8 j), `bom_access_ge` (BOM, 18, 10 j),
`meteoswiss_icon_ch1` / `meteoswiss_icon_ch2`, `aigefs_025`, `ecmwf_ifs_europe`… (liste
complète dans la documentation d'Open-Meteo). Un modèle inconnu de l'extension est accepté
et affiché sous son identifiant. Plus de modèles = plus de membres à dessiner et un
`ensembles.json` plus gros.

Chaque modèle est demandé au plus jusqu'à sa propre échéance (`days` est limité pour
chacun) ; si Open-Meteo refuse quand même l'échéance (erreur 400), l'extension retient la
limite indiquée dans la réponse et refait la demande. La raison des erreurs renvoyée par
Open-Meteo est écrite dans le journal de weewx.

Usage gratuit de l'API d'Open-Meteo réservé aux usages non commerciaux (une requête par
modèle et par période de cache). Pour les modèles au pas de 6 h, les min. / max. journaliers
sont calculés sur 4 valeurs et sont donc moins précis.

## 11. Couleurs des températures

Les échelles sont définies une seule fois dans **`live/minichart.js`** (`window.TempScale`) :

| Échelle | Utilisée par |
|---|---|
| `TEMP_STOPS` (continue) | barres Hi-Low des pages de détail (30 / 365 / 730 j) et « au fil des ans », légende `legend()` |
| `TEMP_STEPS` (paliers de 3 °C) | courbes de température (tableau de bord, détail 24 h / 7 j, prévisions heure par heure, paramètres en °C), chiffres du panneau Température, des prévisions et de la page Extrêmes, légende `stepLegend()` |

```js
const TEMP_STOPS = {
  light: [[-10, "#0b2a7a"], [-5, "#1a4fc4"], [0, "#5b9be8"],                 // ≤ 0 °C : bleus
          [0, "#2e8b57"], [10, "#7cb342"],                                    // 0 – 10 °C : verts
          [10, "#e6b800"], [20, "#f28c1e"], [27, "#e8501a"], [33, "#c81e1e"], [40, "#7a0a0a"]],  // jaune → rouge
  dark:  [ … mêmes paliers, teintes éclaircies … ],
};
const TEMP_STEPS = {
  // [borne supérieure incluse, couleur]
  light: [[-9, "#0b2a7a"], [-6, "#1640a8"], [-3, "#2463d0"], [0, "#5b9be8"],        // ≤ 0 °C : bleus
          [3, "#2e8b57"], [6, "#4f9e48"], [10, "#7cb342"],                           // 0 – 10 °C : verts
          [13, "#e6c200"], [16, "#e6a800"], [19, "#f29400"], [22, "#f27f1e"], [25, "#ec6a1a"],
          [28, "#e5531a"], [31, "#d9381a"], [34, "#c81e1e"], [37, "#a51212"], [40, "#7a0a0a"]],  // jaune → rouge
  dark:  [ … mêmes tranches, teintes éclaircies … ],
};
```

- `TEMP_STOPS` : `[température, couleur]` par ordre croissant, couleur interpolée entre deux
  paliers ; deux paliers à la même température (0 et 10 °C) créent une rupture nette.
- `TEMP_STEPS` : une valeur prend la couleur de la première tranche dont la borne est ≥ à
  elle (0 °C bleu, 0,1 °C vert, 10 °C vert, 10,1 °C jaune ; au-delà de 40 °C, dernière
  couleur). La tranche 6 – 10 °C fait 4 °C pour que les verts s'arrêtent à 10 °C.
- La couleur d'un chiffre est calculée sur la valeur arrondie affichée.
- Chiffres et courbes gardent 95 % de la couleur de la tranche, mélangée à 5 % de la couleur
  du texte (`TempScale.textColor`, `TempScale.lineColor`).
- Modifier les jeux `light` et `dark` ensemble ; si les bornes changent, adapter aussi les
  graduations des légendes (`legend()`, `stepLegend()`).
- Une réinstallation de l'extension remplace `minichart.js` : noter ses modifications.

## Notes

- Les journées (min/max, cumul du jour) suivent le fuseau horaire du serveur weewx.
- Capteur absent (pas de capteur solaire, etc.) : la carte correspondante reste à « -- ».
- Accessibilité : graphiques annoncés comme images avec une description, menu utilisable au
  clavier (flèches, Début / Fin, Échap), bandeaux annoncés aux lecteurs d'écran.
- Les valeurs de configuration hors limites sont ramenées dans leurs bornes (ex. `top`,
  `zoom`, `frame_delay`) ; les erreurs de configuration sont écrites dans le journal de weewx
  (`livejson:`).
