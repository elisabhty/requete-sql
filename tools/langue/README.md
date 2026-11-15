# Traduire les vidéos des cours (tools/langue)

Les outils qui ont servi à mettre les 71 vidéos en anglais (14 et 15 novembre 2026), rangés pour la langue suivante.
Ils tournent avec Node et Playwright (Chromium) : chacun ouvre son propre petit serveur sur le dossier de l'appli, rien d'autre à
lancer. Les fichiers de travail vont dans `tools/langue/travail/<langue>/` (jamais publiés).

```
node tools/langue/recolter.mjs   --langue en projet-vue projet-index    # 1. ce qui manque
node tools/langue/cles.mjs       --langue en projet-vue projet-index    # 2. ce qu'il reste à traduire
#   … remplir travail/en/a-traduire.json, le recopier dans travail/en/traductions.json
node tools/langue/construire.mjs --langue en projet-vue projet-index    # 3. assets/anim/en/<cours>.js
node tools/langue/recolter.mjs   --langue en projet-vue projet-index    #    on recommence 1 à 3 jusqu'à ce qu'il ne manque rien
node tools/langue/verifier.mjs   --langue en projet-vue projet-index --francais   # 4. le français qui reste, les débordements
node tools/langue/francais.mjs   projet-vue projet-index                 # 5. la vidéo française n'a pas bougé (comparée au dernier commit)
node tools/langue/planches.mjs   --langue en projet-vue                  # 6. relire la vidéo d'un coup d'œil
node tools/langue/vignettes.mjs  --langue en projet-vue projet-index    # 7. les vignettes, LV_VIGNETTES, sw.js
node tools/langue/fiches.mjs     --langue en projet-vue projet-index    # 8. le titre, le résumé et le récapitulatif des leçons
```

« toutes » à la place des vidéos : les 71 vidéos de l'appli.

## Le moteur, en deux mots

- `langues.js` traduit l'appli et les vidéos à l'affichage : une phrase française est cherchée sous sa **clé** (les nombres en `{1}`,
  les mois et les jours en `{m1}`, les morceaux mis en forme en `<1>…</1>` et `<1/>`), dans `langue-<langue>.js` (l'interface, la base
  des cours, les fiches) puis dans le fichier de la vidéo, `assets/anim/<langue>/<cours>.js`.
- Le code SQL n'est jamais traduit mot à mot : `REQUETE_LANGUE.sql()` le récrit pour la base de la langue (`base.tables`,
  `base.defauts` pour les noms hors des tables, `base.valeurs` pour les valeurs : `'expédiée'` → `'shipped'`).
- Une langue nouvelle : son entrée dans `LANGUES` (langues.js, `essai: true` tant qu'elle n'est pas finie), son fichier
  `langue-<langue>.js` (copier celui de l'anglais : `textes`, `base`, `mots`), un dossier `assets/anim/<langue>/`, et sa liste dans
  `LV_VIGNETTES` (index.html).

## Brancher une vidéo (étape 0, une fois par vidéo)

Dans `assets/anim/<cours>.html` :
1. avant `<link rel="stylesheet" href="core.css">` :
   `<script src="../../langues.js?v=4" data-textes="{langue}/<cours>.js?v=1"></script>` ;
2. `<body data-table="…">` : la table dont parle la vidéo (le contexte des noms SQL cités seuls : `nom` est le nom d'un produit
   avec `produits`, celui d'un client avec `clients`) ;
3. les requêtes tapées lettre à lettre : avant `$$('.sq .ln').forEach(splitChars);`,
   `if (typeof LG !== 'undefined' && LG && LG.ecrireCode) $$('.sq .ln').forEach(el => LG.ecrireCode(el));` (sinon le découpage en
   lettres passe avant la traduction) ; des commentaires qui changent en cours de vidéo (`cmtStack`) : `LG.t` sur `.sq .cm > i`, juste
   avant ;
4. du code hors des éditeurs (une carte, un bouton qui montre une requête) : `Course({codeSel: '.rc', …})` ;
5. un mot que le moteur traduirait mal à cet endroit : `data-<langue>="…"` sur l'élément (`<code data-en="name">nom</code>`,
   une lettre du titre de couverture : `<span data-en="Y">E</span>`, `data-en=""` pour l'effacer) ;
6. des tables propres à la vidéo (le projet des ateliers, `remplacements`…) : à la fin du fichier de textes, après `textes`, une
   `base: {tables: {…}, defauts: {…}}` (construire.mjs la garde telle quelle).

Après chaque branchement : `francais.mjs` (la vidéo française doit rester la même).

## Traduire

`a-traduire.json` donne chaque clé française une fois (`a-traduire-videos.json` : dans quelles vidéos). Les règles suivies pour
l'anglais :
- les morceaux `<1/>`, `<2>…</2>` et les nombres `{1}` restent tous (construire.mjs refuse une traduction qui en perd un) ; les
  `<1/>` sont les retours à la ligne des légendes : les garder à peu près au même endroit ;
- les noms, les e-mails, les villes et les adresses des clients restent tels quels ; les produits ont leur nom anglais (base.valeurs) ;
- typographie de la langue (en anglais : “ ”, pas d'espace avant « : ? ! », €12.50) ;
- jamais SQL ni une table comme une personne (« la base renvoie », pas « SQL comprend ») ;
- une phrase longue de légende se traduit entière : ses mots, quand la vidéo l'écrit mot à mot, suivent (les fragments).

## Les vérifications

- `verifier.mjs` : des mots outils français, des accents ou des noms SQL français visibles (texte et code), des textes qui sortent de
  leur cadre (un parent qui coupe, la carte, la scène). Faux positifs connus, voulus : le tableau qui défile de
  bases-relationnelles, les pages de factures de limit-offset, le commentaire tronqué de projet-ondelete, le tampon de where.
- Un mot trop long pour sa colonne : une règle `html[lang="<langue>"] …` dans le `<style>` de la vidéo (élargir la colonne, réduire
  un peu la police), jamais un changement de la mise en page française. Seule la pastille du chapitre se resserre toute seule
  (langueFit dans core.js, jusqu'à 72 %) quand elle toucherait le logo ; pour tout le reste, c'est la règle.
- `francais.mjs` : 0 à 3 images différentes d'un pixel arrivent (le lissage des polices).

## L'iPhone : widgets, Live Activities, raccourcis, rappels

Ce que l'app confie à l'iPhone ne passe pas par la page : l'app le traduit avant de l'envoyer (`natifT`, `natifSql`, `pocheLangue`
dans index.html) et le widget traduit ses propres textes (`traduit` et la table `motsAnglais` en bas de RequeteWidget.swift ; il lit
la langue dans le groupe d'apps, clé « langue »).

- `natif.mjs --langue <code>` : les textes envoyés à l'iPhone qui n'ont pas de traduction (les questions de la requête de poche,
  les rappels, les raccourcis de l'icône, les titres de l'accueil, les `natifT('…')` du code). Écrit `travail/<code>/natif.json`.
  Les mots-clés SQL qui s'écrivent pareil (« LEFT JOIN », « NoSQL ») y restent : c'est normal.
- Une autre langue que l'anglais : une table `motsAnglais` de plus dans le Swift (`traduit` choisit selon la langue), puis un
  build Xcode (le widget n'est pas mis à jour à distance).
- Les noms SQL des questions de poche hors de la base des cours (ateliers, avis, entrepot…) sont dans `base.defauts` ; les valeurs
  écrites entre guillemets (`'Inconnu'`, `'Cher'`), dans `base.valeurs`.

## Le site (decouvrir/)

Le site se traduit en pages statiques, dans `decouvrir/<langue>/`, à partir des pages françaises et d'un dictionnaire
(`tools/langue/site/<langue>.json`, gardé dans le dépôt) :

1. `site.mjs --langue en recolter` : les textes à traduire (`travail/en/site-a-traduire.json`) ; un bloc de texte et sa mise en
   forme sont une seule clé (« Apprends le <b>SQL</b> »), un dessin (svg, img) y devient `<1/>`. Ce que l'appli traduit déjà
   (titres des cours, avis) est repris de `langue-<code>.js`.
2. Écrire les traductions dans le dictionnaire (une clé, sa traduction ; un morceau court de script que la récolte ne prend pas
   s'écrit sous `js:` suivi de la chaîne telle qu'elle est dans le code : `"js: fichier": " file"`).
3. `site.mjs --langue en construire`, puis `verifier` (du français visible, une adresse cassée).
4. Le jour où la langue de l'appli sort d'essai : `site.mjs --langue en publier`, puis `construire` (le menu des pages françaises
   y mène, les pages entrent dans les moteurs de recherche).

Une page française modifiée : le test `retours-1300-site-anglais` le signale (empreintes de `decouvrir/en/sources.json`) ;
recolter, traduire ce qui est nouveau, construire. La voix de la vidéo et des avis se cherche dans `decouvrir/en/voix/` et
`decouvrir/en/avis/` : muette tant qu'elle n'y est pas.

## La voix

`tools/voix/preparer-langue.mjs <cours>` prépare la voix anglaise (Brielle) depuis les légendes traduites ; ses règles de
prononciation du code (`PARLE`, `DIRE` : `customer_id` « customer underscore ID ») sont celles de l'anglais : pour une autre langue,
copier le script et écrire les siennes. Elisa génère les voix sur son Mac (`node tools/voix/generer.mjs <cours> --langue en`), puis
`tools/voix/integrer.mjs` les intègre. Le détail : `LANGUES.md`.
