# Requête en plusieurs langues

Elisa, 13 novembre, 12 h 30 : « tu peux mettre un truc en place pour faciliter la traduction dans plusieurs langues, en premier
anglais ». Ses choix : dans la version anglaise, les tables des cours passent en anglais (`customers`, `orders`…) ; d’abord le
système et un pilote (l’onboarding et les écrans principaux), puis les cours, module par module.

## Le principe

Le français reste la source : dans `index.html`, rien ne change, les textes y restent écrits en français. Chaque langue est un
fichier (`langue-en.js`) qui donne, pour chaque texte français, sa traduction. À l’affichage, `langues.js` remplace les textes
de la page par leur traduction. Un texte sans traduction reste en français, et il est noté.

En français, `langues.js` ne fait rien (ni fichier chargé, ni observateur).

## Quelle langue pour qui

Elisa, 13 novembre, 12 h 57 : « vérifie par rapport aux langues de chaque pays laquelle afficher, par exemple en Afrique beaucoup
seront en français, mais peuvent changer la langue avec un réglage ».

Dans l’ordre (`langues.js`, `choisir` et `automatique`) :

1. **Le choix de la personne** : Mon compte, « Langue » (une ligne des réglages, après « Confort de lecture »). Chaque langue y
   est écrite dans sa langue ; un toucher recharge l’appli. Le choix reste sur l’appareil (`requete-langue`) : sur un nouvel
   iPhone, l’appli repart de la langue du téléphone (accepté par Elisa).
2. **La langue de l’iPhone**, si l’appli la parle : un iPhone en anglais ouvre l’appli en anglais, même à Paris.
3. **Sinon, le pays** (un iPhone en arabe, en espagnol, en allemand…) : le français là où il est langue officielle ou seconde
   langue courante, l’anglais partout ailleurs. Le pays est celui des réglages de l’iPhone (« ar-MA »), à défaut son fuseau
   horaire ; pas l’endroit où la personne se trouve ce jour-là. La liste (`FRANCOPHONES`) : France et ses territoires, Monaco,
   Luxembourg, Sénégal, Côte d’Ivoire, Mali, Burkina Faso, Niger, Togo, Bénin, Guinée, Cameroun, Gabon, les deux Congo,
   Centrafrique, Tchad, Djibouti, Comores, Madagascar, Burundi, Maurice, Mauritanie, Maroc, Algérie, Tunisie, Haïti. La Belgique,
   la Suisse et le Canada n’y sont pas : un iPhone en français y est déjà en français, les autres lisent plus volontiers
   l’anglais. Le Rwanda non plus (passé à l’anglais). Cette liste se corrige en une ligne.

**Tant que l’anglais est « en essai »** (`essai: true` dans `langues.js`), rien de cela ne s’applique : tout le monde est en
français, et le réglage « Langue » n’existe que sur les iPhone en essai (ceux dont le pseudo est dans la liste des testeurs :
`node scripts/maj-publier.mjs --testeur @pseudo` ; voir IOS.md, « Corriger l’appli sans repasser par Apple »). Il faut que
l’anglais soit terminé avant l’envoi à Apple (règle 2.5.19 : pas de fonction cachée). Le jour où l’anglais est complet : retirer `essai: true`.

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
