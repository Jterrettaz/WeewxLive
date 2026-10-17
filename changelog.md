# Journal des modifications — weewx-live

Résumé des changements de chaque version, de la plus récente à la plus ancienne (depuis la
version 1.49). Les numéros sautés correspondent à des versions annulées (voir en bas de liste).

## 2.02

- **Documentation en anglais** incluse dans l'extension : `README.eng.md` (traduction du
  README) et `skins/WeewxLive/skin.en.conf` (copie de `skin.conf` aux commentaires traduits,
  réglages identiques ; non lue par weewx, à renommer en `skin.conf` pour l'utiliser). Tenues
  à jour à chaque version, comme le README et `skin.conf`.
- `skin.conf` : commentaire de l'option `lang` complété (de, it).

## 2.01

- **Pages en allemand et en italien** : nouveaux fichiers `lang/de.conf` et `lang/it.conf`
  (mêmes clés que `fr.conf` et `en.conf`), choisis par `lang = de` ou `lang = it` dans
  `[StdReport] [[WeewxLive]]`. Nombres et dates `de-DE` / `it-IT`, directions du vent,
  phases de la lune, titres des mesures, temps prévu, carte Blitzortung dans la langue.
  Traductions proposées, à relire.

## 2.00

- **Unités des paramètres supplémentaires** réglables dans `skin.conf`, avec des noms
  d'unités weewx : section `[LiveJSON] [[unit_groups]]` (une unité par groupe weewx, ex.
  `group_distance = mile`) et option `units` d'un paramètre ou d'un panneau groupé
  (prioritaire). Valeurs converties par weewx, libellé affiché déduit de l'unité ; `unit`
  reste un libellé seul. Groupes réglables : distance, énergie, degrés-jours, durées,
  variation de pression.
- Paramètres standard et groupes convertis dans le navigateur (température, vitesse, pluie,
  intensité, pression, altitude, longueur) : publication métrique inchangée, unités par
  défaut toujours réglées par `[[units]]` ; `units` ou `[[unit_groups]]` sur ces groupes :
  ignoré, message dans le journal.
- Réglages invalides (groupe ou unité inconnus, unité étrangère au groupe) : ignorés,
  message dans le journal de weewx.

## 1.99

- Pages d'archives « jour » : panneaux réduits / développés mémorisés **séparément du tableau
  de bord**, avec un seul état pour toutes les pages « jour » (clé `weewx-live:compact-day`
  du navigateur). Réduire un panneau sur une journée le réduit sur toutes les autres, sans
  changer le tableau de bord, et inversement.
- Les choix déjà mémorisés du tableau de bord sont conservés ; sur les pages « jour », tous les
  panneaux repartent développés (valeur par défaut) jusqu'au premier choix.

## 1.98

- **Pages en plusieurs langues**, selon les directives weewx : textes dans le dossier `lang/`
  du skin, un fichier par langue — `fr.conf` (français) et `en.conf` (anglais, traduction
  proposée) ; langue choisie par l'option `lang` du rapport. L'installeur ajoute `lang = fr`
  dans `weewx.conf` `[StdReport] [[WeewxLive]]` (prioritaire sur `[[Defaults]] lang = en` du
  `weewx.conf` de weewx 5) ; `skin.conf` : `lang = fr`.
- Tout est traduit : gabarits (`$lt`), scripts (`i18n.js`, généré : `window.WXL`), module
  Python (titres des pages d'archives, noms des mois et des jours, phases de la lune, noms des
  modèles et pays, messages d'erreur publiés). Nombres et dates selon la langue
  (`intl_locale`), directions du vent et temps prévu traduits, carte Blitzortung dans la
  langue choisie.
- Pages `detail`, `extremes`, `ensembles`, `meteogram`, `units`, `admin` et `webcam` :
  gabarits (`*.html.tmpl`, générés à chaque archive) au lieu de fichiers copiés.
- Titres des paramètres : sans `title`, celui de la langue (`[Labels] [[Generic]]`) ;
  `skin.conf` ne fixe plus les titres des 6 paramètres standard. Couches satellite EUMETSAT
  sans libellé : libellé traduit.
- Pages d'archives générées avant la 1.98 : `i18n.js` chargé par `nav.js` (textes dans la
  langue choisie). Textes absents d'un fichier de langue : clé anglaise affichée, liste dans
  `window.WXL_MISSING`.
- En français, pages identiques à la 1.97.

## 1.97

- Pages d'archives (« jour », « mois », « année ») : titres des panneaux et des sections en
  texte simple, sans lien vers `detail.html` (pages de la période en cours). Le tableau de
  bord et les pages par période gardent leurs liens ; menu commun inchangé.
- Pages d'archives déjà générées : inchangées tant qu'elles ne sont pas régénérées (supprimer
  le dossier `archive/` de `HTML_ROOT` pour les refaire).

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
- **1.96** (pluie de chaque relevé d'archive sur les graphiques 24 h, jour et 7 jours) : supprimée, retour à 1.95.
