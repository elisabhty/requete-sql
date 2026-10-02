# Photos de la base du cours

Chaque photo est une copie de la base « Cours » telle qu’elle est décrite dans `index.html`
(constante `SCHEMA_SQL` : `CREATE TABLE` + `INSERT`), avec :

| Fichier | Rôle |
| --- | --- |
| `AAAAMMJJ_HHMM_libellé.sql` | le texte SQL exact de la base (ce que l’on remet dans `index.html`) |
| `….json` | fiche : date, empreinte SHA-256, tables, colonnes, nombre de lignes |
| `….sqlite` | la même base prête à ouvrir dans DB Browser for SQLite, TablePlus, etc. |

## Commandes

```bash
npm run db:photo -- "ajout colonne poids"   # prendre une photo de la base actuelle
npm run db:liste                              # voir les photos
npm run db:diff                               # comparer la base actuelle à la dernière photo
npm run db:restaurer -- <nom ou début du nom> # remettre une photo dans index.html
```

`db:restaurer` photographie d’abord la base actuelle sous le nom « avant-restauration » :
on peut donc toujours revenir en arrière.

## Quand on ajoute une colonne ou qu’on modifie des données

1. Prendre une photo **avant** (`npm run db:photo`).
2. Modifier `SCHEMA_SQL` dans `index.html` : le `CREATE TABLE` **et** les `INSERT` de la table
   (une colonne de plus = une valeur de plus dans chaque ligne).
3. `npm run db:diff` indique ce qui change (colonnes ajoutées, lignes en plus ou en moins) ou
   l’erreur SQL si la base ne s’exécute plus.
4. Mettre à jour `SCHEMA_META` (liste des colonnes et nombre de lignes par table) et relire les
   leçons dont le résultat attendu change.
5. Passer le cache du service worker à la version suivante (`sw.js`), lancer `npm test`.

Dans l’appli, la base « Cours » n’est jamais sauvegardée : elle est reconstruite depuis
`SCHEMA_SQL` à chaque démarrage. Les projets créés ou importés dans la Console, eux, sont
sauvegardés sur l’appareil (et ont leur propre « photo » dans la Console).
