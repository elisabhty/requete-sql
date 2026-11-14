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
requête d’origine sur la base française.

**Branché depuis le module 1 (14 novembre)** : en anglais, `buildDb` crée la base avec `sql(SCHEMA_SQL)` (les valeurs par défaut
aussi : `DEFAULT 'processing'`), et les noms des produits sont traduits (`Prebiotic Fiber`…). Le schéma et l’aide à la saisie
(`SCHEMA_META`) prennent les noms anglais. La solution d’un exercice et sa requête de vérification passent par `langueSql` ; un
défi qui a sa propre base (Aéroport, Zoo…) reste en français pour l’instant (`langueSqlDe`), et son code affiché aussi
(`REQUETE_LANGUE.autreBase`). Le code affiché dans `<code>` est récrit pour la base de la langue (`<code>prenom</code>` devient
`first_name`) : une table suivie d’une parenthèse reste une table (`REFERENCES clients(id)`), une colonne citée seule prend la
traduction commune à ses tables (`client_id`), sinon celle de la première table qui l’a (`nom` : `last_name`).

## Les vidéos des cours

Chaque vidéo (`assets/anim/<cours>.html`) charge `../../langues.js?v=4` avec `data-textes="{langue}/<cours>.js?v=1"` : en anglais,
`assets/anim/en/<cours>.js` ajoute ses textes (`REQUETE_LANGUE.ajouter`). Dans le moteur (`core.js`), `fr()` rend le texte traduit
(les légendes, les moments « À toi » envoyés au lecteur, les chapitres), les lignes de code (`.ln`, `.codepill`, `.rq`, `.tye`, `.m`)
sont récrites pour la base anglaise avant la frappe, et la voix est celle de la langue (`voix` dans le fichier de la vidéo) : sans
voix anglaise, la vidéo garde ses pauses de lecture, sans voix. Les clés des voix restent celles des légendes françaises.
En français, la vidéo rend exactement la même chose qu’avant (vérifié dans un navigateur, `window.__ready` identique).

Pour une vidéo : 1. ajouter la ligne `langues.js` ; 2. récolter ses textes en anglais (`?langue=en`, parcourir la timeline, puis
`REQUETE_LANGUE.manquants()`) ; 3. écrire `en/<cours>.js` ; 4. regarder les images : un mot plus long (`first_name`,
`customer_id`) peut demander une colonne plus large (`html[lang="en"] …` et `EN` dans la page), un même mot qui change selon
l’endroit se règle sur l’élément (`data-en="name"`), une image qui porte du texte a sa version (`data-en-src`, le badge
NutriBoost) ; 5. sa vignette en anglais (`assets/anim/en/<cours>-thumb.webp`, la première image de la vidéo en anglais) et son
nom dans `LV_VIGNETTES`. Les noms, les e-mails, les villes et les adresses des clients restent tels quels.

## Où on en est

- **Fait** : le système ; l’onboarding en anglais (le pilote) ; l’interface (14 novembre, 22 h 51 : « Tout traduire ») : l’accueil,
  les onglets, Mon compte et ses feuilles, le planning, les défis (Jouer, Classement, Mes stats, profil d’un joueur, salle
  d’attente et partie), les stickers, les cartes, les notes, l’entretien (la liste des questions), la console, « Selon le SGBD »,
  les pages de fête (niveau, sticker, fin de module), et les noms des modules, des leçons et des niveaux. Environ 2 450 textes.
- **Le moteur a appris** (14 novembre) : le pseudo d’un autre joueur (« Profil de @nora ») se range sous `{p1}` ; ton pseudo sous
  `{pseudo}` et le nom de ton niveau sous `{niveau}` (remis traduit) ; un nombre français à milliers (« 1 200 ») est un seul
  nombre, écrit « 1,200 » en anglais.
- **Le module 1** (14 novembre) : la base en anglais, la vidéo « Les bases de données relationnelles » (282 textes, son code,
  ses cinq moments, le badge et la vignette en anglais), l’écran de la leçon, son lecteur et sa fin. Sa voix anglaise reste à
  générer (environ 10 000 caractères, autant de crédits ElevenLabs).
- **À reprendre avec les défis** : dans une salle, le serveur (`jeu-verifier`) vérifie la requête sur la base française ; une
  requête écrite en anglais sur un défi de la base des cours y serait refusée. À régler avant de traduire les défis.
- **Ensuite** : les écrans des leçons et des défis (le cadre autour du contenu) ; puis les cours, module par module :
  les textes des vidéos (`assets/anim/<cours>.html`), leurs voix en anglais (`tools/voix/` ; environ 258 000 caractères au
  total, soit autant de crédits ElevenLabs, à valider avant toute dépense ; le moteur des vidéos attend déjà la fin de chaque
  phrase, une voix plus longue ou plus courte ne décale rien), les leçons, les défis, les cartes.
- **Aussi à prévoir** : les initiales des jours (« L M M J V S D » de la semaine et du planning : des lettres seules, que le
  moteur ne traduit pas ; à écrire avec `REQUETE_LANGUE.locale`), le détail « en réflexion, 0 point » des joueurs d’une salle
  (une phrase par combinaison : à traduire morceau par morceau dans le code), les stickers dont l’image porte du français
  (« 1er défi », « 10 leçons », « jours », « NIV. »… : 15 images, environ 6 500 crédits pour les refaire), les dates et les nombres (`'fr-FR'` est écrit en dur à une cinquantaine d’endroits ;
  `REQUETE_LANGUE.locale` donne la bonne valeur), les noms des produits de la base et les filtres `LIKE`, les noms de pays, les
  widgets et l’île (du Swift : un envoi Apple), les notifications, le site et les pages légales, la fiche App Store (un envoi
  Apple).
- **Limite connue** : un endroit du code qui relirait un texte affiché pour le comparer à un texte français ne marcherait plus
  dans une autre langue. Aucun n’a été rencontré dans l’onboarding ; à surveiller écran par écran.
