# Journal des modifications — weewx-live

*English version: [changelog.md](changelog.md).*

## 1.3

- Rapports NOAA (texte) pour chaque mois et chaque année (`NOAA/NOAA-AAAA-MM.txt`, `NOAA-AAAA.txt`), affichés par la nouvelle page « Climatologie » → « Rapports NOAA » ; option `noaa` de `[[archives]]`.
- Documentation : guide d'installation court dans `README.md` / `README.fr.md` ; la documentation complète passe dans `docs/manual.md` / `docs/manual.fr.md`.


## 1.2

- « Soleil et Lune » : course du soleil dans le ciel (direction / hauteur) à droite du graphique des hauteurs : aujourd'hui, 21 juin, équinoxe, 21 décembre, lune du lever au coucher.
- « Réorganiser » : bouton « Développer » / « Réduire » sur chaque panneau de mesures.
- Profils du tableau de bord : pendant la réorganisation, la disposition (ordre et affichage des
  cadres et panneaux, état réduit / développé de chaque panneau) peut être enregistrée sous un
  nom ; une liste « Profil » en haut du tableau de bord applique un profil enregistré.
  L'administrateur peut proposer des profils de la station à tous les visiteurs
  (`[[dashboard]] [[[profiles]]]`).
- Thèmes de couleurs (`theme.css` : Classique, Léman, Alpage, Ardoise, Forêt) et page « Réglages →
  Apparence » : chaque visiteur choisit le mode clair / sombre et le thème de couleurs (mémorisé
  par son navigateur). Défaut du site : `[LiveJSON] [[appearance]]` ; noms des thèmes :
  `[Texts] [[Themes]]` des fichiers de langue.

## 1.0

- Version finale.
