# Journal des modifications — weewx-live

Résumé des changements de chaque version, de la plus récente à la plus ancienne (depuis la
version 1.49). Les numéros sautés correspondent à des versions annulées (voir en bas de liste).

## 1.95

- Nouvelle page **« Webcam »** (`webcam.html`, `webcam.js`, menu « Webcam ») : images et
  vidéos l'une sous l'autre, configurées dans `[[webcam]]` (une sous-section par élément :
  `url`, `title`, `caption`, `type`, `admin`, `refresh`, `autoplay`, `enable`).
- `admin = true` : élément affiché seulement en mode admin ; menu « Webcam » seulement si le
  visiteur peut voir au moins un élément.
- Images rechargées périodiquement sans clignotement, heure du dernier chargement, ouverture
  en grand ; message « indisponible » si le fichier est absent.

## 1.94

- Menu **« Éclairs »** : ouvre dans un nouvel onglet la carte Blitzortung centrée sur la
  station (`https://maps.blitzortung.org/fr/#7/<latitude>/<longitude>`), sur toutes les
  pages. Section `[[lightning]]` (`enable`, `zoom`) ; coordonnées de `[Station]` ou de
  `[[forecast]]`.

## 1.93

- **Légendes cliquables** sur les graphiques à plusieurs courbes : un clic (ou Entrée /
  Espace) sur un élément de la légende masque la courbe, un second la réaffiche (élément
  barré et grisé). Masquage temporaire, jusqu'au rechargement de la page.
  - Tableau de bord et pages « jour » : vent (moyen / rafales), pluie (horaire / cumul),
    panneaux groupés (une mesure), cumuls génériques ; « Soleil et Lune » (soleil, lune, jour).
  - Pages de détail, par période, « mois » et « année » : chaque courbe de la légende.
  - Ensembles : un modèle (ses membres), moyenne groupée, bande 10–90 %, séries de pluie.
  - Météogramme : précipitations, averses, cumul ; neige ; nuages, isotherme ; température,
    isotherme et vent en altitude ; vent moyen, rafales, direction.
- Les courbes masquées sortent de l'échelle (ex. rafales masquées : axe ajusté au vent moyen)
  et de l'infobulle.
- `minichart.js` : `MiniChart.linkLegend(ul, graphique)`, attribut `data-s` des éléments de
  légende (indices des séries).

## 1.92

- Tableau de bord : panneaux **réduits par défaut**. Un nouveau visiteur voit tous les
  panneaux réduits ; un paramètre ajouté dans `skin.conf` apparaît réduit, y compris chez les
  visiteurs ayant déjà choisi « Tout développer ». Les choix mémorisés (panneau développé
  ou réduit) sont conservés ; pages « jour » : panneaux toujours développés par défaut.

## 1.91

- **Mode admin** : option `admin = true` d'un paramètre ou d'un panneau groupé de
  `[[parameters]]` ; ce paramètre n'est affiché qu'en mode admin (tableau de bord et liste
  « Réorganiser », pages « jour », pages de détail, par période, « mois » et « année », menu
  « Données »).
- Nouvelle page **« Réglages → Admin »** (`admin.html`, `admin.js`) : entrée du mot de passe,
  mémorisé par le navigateur, et bouton « Quitter le mode admin » ; menu « Admin (actif) ».
- Mot de passe dans `[LiveJSON] [[admin]] password` ; seule son empreinte SHA-256 est
  publiée (`window.WX_ADMIN` dans `wxtime.js`). Calcul de l'empreinte aussi sans
  `crypto.subtle` (page servie en http sur le réseau local).
- Simple masquage à l'affichage : les données restent dans les fichiers publiés et dans MQTT.

## 1.90

- `skin.conf` : section `[[units]]` livrée avec les unités métriques, chaque option suivie
  de la liste des unités possibles ; `kmh` accepté pour `km/h`.

## 1.89

- **Unités d'affichage** : `[LiveJSON] [[units]]` choisit les unités par défaut du site
  (température °C/°F, vent km/h, m/s, mph, kn, pluie mm/in, intensité mm/h, in/h, pression
  hPa, inHg, mmHg, kPa, altitude m/ft, neige cm/in). Les données restent métriques ; la
  conversion se fait à l'affichage sur toutes les pages (valeurs, graphiques, infobulles,
  tableaux climatologiques, records, prévisions, ensembles, météogramme).
- Nouveau menu **« Réglages → Unités »** (`units.html`) : chaque visiteur choisit ses unités,
  mémorisées par son navigateur.
- Carte Windy affichée dans les unités choisies.

## 1.88

- Tableaux climatologiques : **valeurs provisoires** marquées (italique et astérisque, heure
  de passage en définitif dans l'infobulle) tant que la fenêtre du jour n'est pas close — Tn
  jusqu'à 18 h UTC, Tx et pluie jusqu'au lendemain 6 h UTC (méthode `omm`) ; minuit (méthode
  `civil`). Tableau annuel : mois en cours (et ligne « Année ») provisoires jusqu'à la clôture
  de son dernier jour.
- Méthode `omm` : le tableau du mois (ou de l'année) qui vient de se terminer est régénéré une
  fois après le 1er à 6 h UTC, pour inscrire les valeurs définitives de son dernier jour.

## 1.87

- Ajout de ce journal des modifications (`changelog.md`), tenu à jour à chaque version.

## 1.86

- **Tableaux climatologiques selon les règles horaires de l'OMM** (option) :
  `[[archives]] climato_method = civil | omm`.
  - `omm` (heures UTC) : Tn du jour J de J-1 18 h à J 18 h ; Tx et pluie de J 6 h à J+1 6 h ;
    température moyenne = moyenne des 8 relevés trihoraires (0, 3 … 21 h) ; vent, humidité et
    pression restent de 0 h à 24 h.
  - Calcul sur les enregistrements d'archive (colonnes `lowOutTemp` / `highOutTemp` si elles
    existent, sinon `outTemp`) ; tableaux mensuels et annuels (jours de gel, de pluie… comptés
    sur ces mêmes valeurs).
  - `civil` (défaut) : journées de 0 h à 24 h, inchangé. Méthode rappelée sous chaque tableau.

## 1.85

- Option `[[mqtt]] temp_deltas` : `false` masque la ligne « Sur 1 h · Sur 24 h » du panneau
  Température et ne lit plus `temp_1h_key` / `temp_24h_key`.

## 1.84

- Page de détail Pluie, 7 jours : la courbe de cumul manquait (coupée en points isolés). Cumul
  calculé heure par heure ; une courbe de cumul n'est plus jamais interrompue (option `maxGap`
  par série dans MiniChart).

## 1.83

- **Pluie et cumul sur deux échelles** : barres de pluie à gauche, cumul à droite (échelle
  propre, alignée sur la grille). Tableau de bord, pages jour, pages de détail et d'archives,
  paramètres ajoutés de type cumul.

## 1.82

- `[LiveJSON] hours` s'applique enfin aux graphiques du tableau de bord (la page affichait
  toujours 24 h) : graphiques, rose des vents et cumuls glissants (« Cumul … h »). Pages jour :
  inchangées (minuit à minuit).

## 1.81

- Courbes de température (°C) des **panneaux groupés** (ex. température du sol) colorées selon
  l'échelle des températures, distinguées par le trait (plein, tirets, pointillés) ; unité « °C »
  reconnue aussi avec un espace.

## 1.80

- Tableau de bord : panneaux **développés en tête**, panneaux réduits regroupés en dessous.

## 1.79

- Graphiques des panneaux du tableau de bord ramenés à **184 px** de haut (150 px sur mobile).

## 1.77

- Météogramme : flèches de direction du vent plus grandes et plus épaisses, avec un liseré pour
  rester lisibles sur les courbes.

## 1.74

- Pages jour : liens « ‹ Jour précédent » / « Jour suivant › » (au lieu de « Veille » /
  « Lendemain »).

## 1.73

- Pages jour : moyenne du jour aussi pour l'humidité, la pression et les paramètres ajoutés
  (hors cumuls, groupes compris) ; tendance de pression et intensité de pluie instantanée retirées.

## 1.72

- Pages jour : température et vent **moyens du jour** au lieu de la dernière mesure ; direction :
  **vent dominant du jour** (secteur le plus fréquent) ; écarts 1 h / 24 h et rafale instantanée
  retirés.

## 1.71

- Correction de l'erreur « WXT is not defined » sur les pages d'archives générées avant 1.68 :
  fonctions de date déplacées dans `nav.js` ; `wxtime.js` ne fournit plus que le fuseau.

## 1.70

- Le rayonnement solaire n'est plus un paramètre standard (6 panneaux standard) ; il reste
  possible comme paramètre ajouté (exemple commenté dans `skin.conf`).

## 1.69

- Panneau Température : ligne bleue **« Durée du gel en cours »** quand la température est
  négative (début du gel cherché dans toute l'archive, mise à jour chaque seconde et par MQTT).

## 1.68

- **Heure de la station sur toutes les pages**, quel que soit le fuseau du visiteur (fuseau
  détecté sur le système weewx, ou `[LiveJSON] timezone`) ; Open-Meteo interrogé dans ce fuseau.
- Météogramme : option `top_humidity` renommée `top_clouds` (l'ancien nom reste accepté).

## 1.67

- Revue complète du code et des commentaires : corrections (ordre des panneaux, réponses de
  prévisions arrivant dans le désordre, membres des modèles à 3 h / 6 h dans Ensembles, page du
  jour à minuit, horizons invalides, seuil de pluie), optimisations (fonction Open-Meteo commune,
  caches) ; README avec sommaire et plages des options.

## 1.66

- Fond des cartes RainViewer / EUMETSAT configurable (`[[basemap]]` : osm par défaut, esri,
  opentopomap, carto avec clé d'API).

## 1.65

- Tableau de bord : cadres et panneaux **masquables** par le visiteur (mémorisé par le navigateur).

## 1.64

- Tableau de bord : panneaux de mesures réorganisables par le visiteur.

## 1.63

- Tableau de bord : ordre des cadres configurable (`[[dashboard]] order`) et réorganisable par
  le visiteur ; « Soleil et Lune » placé après les cartes radar et satellite.

## 1.62

- Météogramme : liste des modèles au-dessus de la ligne d'information, sans répéter le nom du
  modèle.

## 1.61

- Ensembles : horizon de 10 jours et un point par heure par défaut.

## 1.59

- Tableau de bord : choix du modèle des prévisions (5 modèles Open-Meteo).

## 1.58

- Météogramme : courbe du cumul de pluie et choix parmi 5 modèles.

## 1.57

- Météogramme : couverture nuageuse seule (humidité relative en altitude retirée).

## 1.56

- Page **« Météogramme »** (Open-Meteo, sol et altitude), menu « Prévisions » ; pictogrammes
  météo partagés (`wxicons.js`).

## 1.55

- Fichiers du skin à la racine de `skins/WeewxLive` (plus de sous-dossier `live/`) ; dossier de
  sortie au choix (`HTML_ROOT`).

## 1.54

- Page des ensembles : titre « Prévisions - Ensembles ».

## 1.53

- Ensembles : identifiants des modèles Open-Meteo corrigés (`ecmwf_ifs025`,
  `google_weathernext2_ensemble`…), anciens noms convertis automatiquement.

## 1.52

- Ensembles : une variable refusée par un modèle est retirée de la requête ; version affichée.

## 1.51

- Ensembles : section « Analyse écrite » retirée.

## 1.50

- Ensembles : échéance limitée par modèle (erreur 400 d'ECMWF / Google), raison des erreurs
  Open-Meteo affichée.

## 1.49

- Page **« Prévisions - Ensembles »** (API Ensemble d'Open-Meteo, modèles configurables),
  nouveau menu « Prévisions ».

## Versions annulées

- **1.60** (météogramme, lecture de l'ancien format) : annulée, retour à 1.59.
- **1.75** et **1.76** (cumul de pluie MQTT, alias `rainDay`) : annulées, retour à 1.74.
- **1.78** (widget de cartes meteoblue) : supprimée, retour à 1.77.
