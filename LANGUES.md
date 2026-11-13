# Requête en plusieurs langues

Elisa, 13 novembre, 12 h 30 : « tu peux mettre un truc en place pour faciliter la traduction dans plusieurs langues, en premier
anglais ». Ses choix : dans la version anglaise, les tables des cours passent en anglais (`customers`, `orders`…) ; d’abord le
système et un pilote (l’onboarding et les écrans principaux), puis les cours, module par module.

## Le principe

Le français reste la source : dans `index.html`, rien ne change, les textes y restent écrits en français. Chaque langue est un
fichier (`langue-en.js`) qui donne, pour chaque texte français, sa traduction. À l’affichage, `langues.js` remplace les textes
de la page par leur traduction. Un texte sans traduction reste en français, et il est noté.

En français, `langues.js` ne fait rien (ni fichier chargé, ni observateur).

## Qui voit l’anglais

Tant qu’une langue porte `essai: true` (dans `langues.js`), elle n’est proposée qu’aux iPhone « en essai » : Mon compte, sept
touchers sur le numéro de version (voir IOS.md, « Corriger l’appli sans repasser par Apple »). Une ligne « Français · English »
apparaît alors sous le numéro de version ; changer de langue recharge l’appli. Personne d’autre ne voit cette ligne, et un
iPhone réglé en anglais reste en français. Le jour où l’anglais est complet : retirer `essai: true`, et un iPhone en anglais
passe en anglais tout seul.

Pour la mise au point sur un ordinateur : `http://localhost:…/index.html?langue=en`.

## Traduire

1. Passer en anglais sur un iPhone en essai (ou `?langue=en`), parcourir les écrans.
2. `REQUETE_LANGUE.manquants()` rend les textes rencontrés sans traduction, les plus vus d’abord. (Claude fait cette récolte en
   pilotant l’appli écran par écran.)
3. Ajouter chaque texte dans `langue-en.js`, section `textes` : `"texte français": "traduction"`.

La clé est le texte tel qu’il s’affiche, avec des espaces simples (les espaces insécables comptent comme des espaces) :

- `{1}`, `{2}`… : les nombres du texte, dans l’ordre (« Étape 3 sur 14 » se range sous `Étape {1} sur {2}`) ;
- `{m1}`, `{m2}`… : les mois et les jours (« Le 12 novembre 2026 » sous `Le {1} {m1} {2}`), traduits par la liste `mots` ;
- `{prenom}` : le prénom de la personne ;
- `<1/>` : un morceau gardé tel quel au milieu de la phrase (du code, une icône, un retour à la ligne) ;
- `<1>…</1>` : un morceau mis en forme (du gras, un mot souligné), à replacer où il faut dans la traduction.

Une icône ou une flèche au début ou à la fin d’un bouton ne fait pas partie de la clé (« Continuer → » se range sous
`Continuer`). Une phrase se traduit entière ou pas du tout : jamais à moitié.

Ce qui n’est jamais touché : ce qui porte `data-notrad`, les zones de saisie, le code (`<pre>`, `<code>`, les éditeurs), ce
que la personne écrit (ses notes, son pseudo). Pour un texte fabriqué en JavaScript qui ne passe pas par la page (une
notification, un texte envoyé au widget) : `REQUETE_LANGUE.t('texte français')`.

Le test `tests/retours-1230-langues.test.mjs` vérifie que chaque traduction garde les nombres, les mots et les morceaux de son
texte.

## La base des cours en anglais

`langue-en.js`, section `base` : le nom anglais de chaque table et de chaque colonne de NutriBoost, et les valeurs à traduire
(`expédiée` devient `shipped`). Deux fonctions s’en servent :

- `REQUETE_LANGUE.sql('SELECT nom FROM clients')` rend `SELECT last_name FROM customers` : les tables, les colonnes selon leur
  table (`nom` devient `last_name` pour un client, `name` pour un produit), les valeurs entre apostrophes ;
- `REQUETE_LANGUE.base(db)` renomme les tables, les colonnes et les valeurs d’une base SQLite.

Le test rejoue des requêtes sur la vraie base du cours : la requête récrite sur la base anglaise donne le même résultat que la
requête d’origine sur la base française. Ces deux fonctions ne sont pas encore branchées dans les leçons : elles le seront avec
la traduction du premier module (la base, les requêtes des leçons et des défis, leurs corrections).

## Où on en est

- **Fait** : le système ; l’onboarding en anglais (le pilote).
- **Ensuite** : les écrans principaux (l’accueil, les onglets, Mon compte, le paywall) ; puis les cours, module par module :
  les textes des vidéos (`assets/anim/<cours>.html`), leurs voix en anglais (`tools/voix/` ; environ 258 000 caractères au
  total, soit autant de crédits ElevenLabs, à valider avant toute dépense ; le moteur des vidéos attend déjà la fin de chaque
  phrase, une voix plus longue ou plus courte ne décale rien), les leçons, les défis, les cartes.
- **Aussi à prévoir** : les dates et les nombres (`'fr-FR'` est écrit en dur à une cinquantaine d’endroits ;
  `REQUETE_LANGUE.locale` donne la bonne valeur), les noms des produits de la base et les filtres `LIKE`, les noms de pays, les
  widgets et l’île (du Swift : un envoi Apple), les notifications, le site et les pages légales, la fiche App Store (un envoi
  Apple).
- **Limite connue** : un endroit du code qui relirait un texte affiché pour le comparer à un texte français ne marcherait plus
  dans une autre langue. Aucun n’a été rencontré dans l’onboarding ; à surveiller écran par écran.
