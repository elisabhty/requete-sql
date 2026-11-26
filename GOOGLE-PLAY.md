# La fiche Google Play et la mise en route (24 novembre 2026)

Elisa, 24 novembre, 19 h 48 : « Maintenant pousser la version Android chez Android », puis 22 h 03 : « continue le travail sur
Google Store ». Ce fichier n'envoie rien à Google : il rassemble ce qu'il faut coller dans la Play Console, et l'ordre des étapes.
Pas de prix dans les textes (Google les affiche lui-même), pas de « gratuit ». Les visuels sont dans google-play/ (à valider par
Elisa avant tout envoi). La fiche App Store : APP-STORE-FR.md et APP-STORE-EN.md.

---

## Ce qui est prêt dans le dépôt

- L'appli Android (android/, fr.requete.app) : textes Google Play au lieu d'Apple, connexion Google, bouton Retour, marges des
  bords, clavier, icônes de la barre d'état foncées même téléphone en mode sombre.
- La fabrication sur GitHub (Actions › Appli Android › Run workflow) : requete-test.apk (à installer à la main pour essayer) et
  requete.aab (pour Google Play). Les voix des cours (213 Mo) partent dans un paquet livré à l'installation : la partie principale
  fait 63 Mo, sous la limite de 200 Mo de Google Play.
- L'essai automatique sur deux téléphones Android simulés (Android 14 et 15, ce dernier en mode sombre) : l'appli démarre, les
  voix se lisent depuis leur paquet, les modules natifs sont là, aucune erreur. Il tourne à chaque fabrication.
- Les achats (achat.js) savent lire les offres de Google Play : essai de 3 jours, offre de bienvenue, identifiants
  « abonnement:forfait ». La clé RevenueCat Android est en place depuis le 26 novembre.
- La clé d'envoi : un bouton dans GitHub (Actions › Clé d'envoi Android), avec des mots de passe choisis par Elisa.
- 25 novembre : clé d'envoi fabriquée (secrets ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD ; le 4e,
  ANDROID_KEYSTORE_BASE64, à coller par Elisa depuis l'artefact « cle-envoi-android »). Empreintes, publiques :
  SHA-1 5E:9D:A2:EB:B5:E6:56:94:DD:5A:24:C6:33:F6:DB:FF:D8:67:20:62 (client « Android » de Google Cloud, fr.requete.app, pour la
  connexion Google des versions d'essai) ; SHA-256 1B:92:B6:28:29:C3:12:01:4E:E8:FD:EE:4B:AC:F1:9E:E5:98:E9:0A:06:F0:53:EE:64:BD:35:31:2B:25:F7:29.
  Les téléphones qui installent depuis Google Play ont la signature de Google : son SHA-1 (Play Console › Intégrité de l'appli) sera
  à ajouter aussi.
- 25 novembre : compte Play Console d'organisation créé (HORMEND AI LABS, D-U-N-S 278027523) ; site requeteapp.com validé dans la
  Search Console (fichier google17eb5e8ac0a6504f.html à la racine du site, à ne pas supprimer) ; identité en cours de vérification
  par Google ; profil de paiement rempli. Client OAuth « Requete Android » créé dans Google Cloud (projet requete-514506,
  fr.requete.app, SHA-1 de la clé d'envoi) : la connexion Google marche dans les versions signées avec la clé d'envoi.

- 26 novembre, nuit : appli créée dans la Play Console (« Requête — Apprends le SQL », fr.requete.app, Français, appli sans
  frais avec abonnements, protection automatique de Google laissée active ; identifiant Play 4972131845844910750). 1re version
  (31, « 1.0 ») envoyée en test interne, sans testeurs : privée, elle débloque les abonnements. Signature d'application par Google :
  clé d'origine SHA-1 F0:A8:9B:9D:6F:12:77:77:D0:78:38:F8:74:50:4B:E0:A4:E2:AB:B0, clé actuelle (« prête pour l'informatique
  quantique », classique) SHA-1 C5:CA:5E:8F:7B:0C:E4:BE:69:BD:4A:1E:CB:DA:E7:31:21:60:F3:EC. Deux clients OAuth Android ajoutés
  dans Google Cloud (requete-514506) avec ces deux empreintes : « Requete Android (Google Play) » et « … cle 2 ».
- Abonnements créés et actifs (prix choisis par Elisa le 26 novembre : comme l'App Store, 44,99 €/an et 5,99 €/semaine) :
  fr.requete.app.annuel (forfait « annuel », 44,99 € TTC en France, offre « essai-3-jours » : 3 jours gratuits pour qui n'a
  jamais eu d'abonnement dans l'appli) ; fr.requete.app.hebdo (forfait « hebdo », 5,99 € TTC) ; fr.requete.app.annuel.bienvenue
  (forfait « annuel », 44,99 €, offre « bienvenue » : 1re année payée d'avance à −50 %, soit 22,50 € en France, pour qui n'a
  jamais eu d'abonnement). Les prix des autres pays : convertis par Google depuis 37,49 € HT (annuel) et 4,99 € HT (hebdo).
- 26 novembre, RevenueCat (Elisa : « oui ») : dans Google Cloud (requete-514506), API activées (Google Play Android Developer,
  Google Play Developer Reporting, Cloud Pub/Sub) ; compte de service revenuecat@requete-514506.iam.gserviceaccount.com avec les
  rôles Administrateur Pub/Sub et Lecteur Monitoring ; invité dans la Play Console pour l'appli seulement (informations de
  l'appli, données financières, commandes et abonnements), actif. Dans RevenueCat : appli « Requête (Play Store) »
  (appcf0e1daecf, fr.requete.app), les 3 produits (fr.requete.app.annuel:annuel, fr.requete.app.hebdo:hebdo,
  fr.requete.app.annuel.bienvenue:annuel) rattachés à « premium » et aux paquets bienvenue, $rc_annual et $rc_weekly de l'offre
  « default ». Clé publique Android dans achat.js (RC_CLE_ANDROID). Le paquet d'essai de l'émulateur (GitHub) la retire pour
  garder le passe du paywall (l'émulateur n'a pas Google Play) ; requete.aab la garde (vérifié à la fabrication).
  Clé JSON du compte de service créée et déposée par Elisa dans RevenueCat : « Valid credentials ». Notifications en temps réel :
  sujet projects/requete-514506/topics/Play-Store-Notifications (créé par RevenueCat), collé dans Play Console › Monétiser ›
  Configuration de la monétisation ; la notification de test de Google est bien arrivée dans RevenueCat.
- 26 novembre, 2 h : liste de testeurs « Testeurs Requête » (Elisa seule) en test interne et en test de licence (achats d'essai
  avec les cartes de test de Google, sans paiement). Version 32 (1.0, achat branché) publiée en test interne (privée, Elisa
  seule) ; lien pour rejoindre le test : https://play.google.com/apps/internaltest/4699686658901540417
- 26 novembre, matin : achat d'essai pas encore fait. RevenueCat lit les 3 abonnements (« Published »), mais l'émulateur
  d'Android Studio sur le Mac d'Elisa se fige (Android 17 très lent ; Pixel 8 Android 15 créé, il se bloque pendant la
  connexion Google). À faire sur un vrai téléphone Android avant la production : le Samsung SM-A528B lié au compte, ou le
  téléphone d'un proche ajouté à la liste « Testeurs Requête » (test interne + test de licence, achats avec la carte de test).
- 26 novembre, midi : sur le Samsung d'Elisa (version 33/34 de Google Play), la feuille de Google s'ouvre pour les trois offres
  (annuel avec essai, hebdo, bienvenue −50 %) ; en test, une année dure 30 min, une semaine 5 min, l'essai 3 min. Carte « toujours
  refusée » : « Le paiement n'a pas abouti… » s'affiche bien ; « Restaurer » sans abonnement : « Aucun abonnement à restaurer sur
  ce compte Google ». Reste l'achat avec la carte « toujours approuvée », puis le vérifier dans RevenueCat.
- 26 novembre, vers 13 h 55 (version 35) : achat d'essai réussi sur le Samsung d'Elisa (offre de bienvenue, carte de test) ;
  RevenueCat l'a reçu (données « sandbox » : Play Store, fr.requete.app.annuel.bienvenue:annuel, « New Sub »). Les achats de
  test n'envoient pas les notifications d'un vrai achat ; en test, l'annuel se renouvelle toutes les 30 min, 6 fois au plus.
- Version 37 (Android seulement ; la 36 n'a pas été envoyée) : l'ouverture commence par le logo rond de l'écran de lancement
  d'Android (plus de logo par-dessus les cases qui volent), et ce logo n'est plus rogné en haut et en bas par la forme des icônes
  du Samsung (cercle de 176 dp au lieu de 192) ; dans une note, « Enregistrer » collé au-dessus du clavier (un seul toucher) ;
  le texte de l'appli garde la taille de l'iPhone, même si la police du téléphone est agrandie (plus de mots coupés comme
  « Recommence / r ») ; les essais sur émulateur signalent tout mot coupé (aucun sur 52 écrans, à 360 et 411 px de large).
- Version 38 (Android seulement) : l'engagement pris (onboarding), le halo vert du bouton à l'empreinte est rond (un anneau à part ;
  l'ombre étalée d'avant était dessinée en carré par la WebView du Samsung).
- 26 novembre, 13 h 30 (Elisa : « Oui stp ») : noms des abonnements raccourcis (coupés dans la feuille de Google) : « Premium annuel »
  (fr.requete.app.annuel et fr.requete.app.annuel.bienvenue : pas de « −50 % » dans le nom, qui reste affiché après la 1re année,
  au plein tarif) et « Premium hebdo » (fr.requete.app.hebdo).

## Dans l'ordre, ce qu'il reste à faire

1. **Compte Google Play Console** (organisation, D-U-N-S 278027523) : Elisa, en cours. Une fois validé, créer l'appli :
   nom « Requête — Apprends le SQL », langue par défaut Français (France), « Application », « Gratuite » (l'abonnement se prend
   dans l'appli : c'est ce que Google appelle une appli gratuite avec achats intégrés).
2. **La clé d'envoi** (Elisa, 5 minutes) : dans GitHub › Settings › Secrets and variables › Actions, créer
   ANDROID_KEYSTORE_PASSWORD (un mot de passe à elle), ANDROID_KEY_ALIAS (requete) et ANDROID_KEY_PASSWORD (le même mot de passe),
   puis Actions › Clé d'envoi Android › Run workflow. Garder le fichier .jks de l'artefact, coller le texte .base64.txt dans un
   4e secret ANDROID_KEYSTORE_BASE64. La fabrication suivante sort un AAB signé.
3. **Premier envoi** : Play Console › Tester et publier › Tests internes › Créer une version › déposer requete.aab ; accepter la
   signature d'application Google Play. Ajouter Elisa comme testeuse (son adresse Gmail) : l'appli s'installe depuis le Play Store.
4. **Les abonnements** (Play Console › Monétiser › Produits › Abonnements), les mêmes identifiants que sur iPhone :
   | Abonnement | Forfait de base | Période | Prix France | Offre |
   |---|---|---|---|---|
   | fr.requete.app.annuel | annuel | 1 an, renouvelable | 44,99 € | « essai-3-jours » : essai gratuit 3 jours, nouveaux clients |
   | fr.requete.app.hebdo | hebdo | 1 semaine, renouvelable | 5,99 € | aucune |
   | fr.requete.app.annuel.bienvenue | annuel | 1 an, renouvelable | 44,99 € | « bienvenue » : 1 an payé d'avance à 22,50 €, nouveaux clients |
   L'appli ne montre l'offre de bienvenue qu'à qui referme la feuille de paiement, et seulement si Google la renvoie.
5. **RevenueCat** : Projet Requête › Apps & providers › + Google Play (fr.requete.app), y déposer le fichier JSON d'un compte de
   service Google Cloud invité dans la Play Console (droits financiers et commandes), brancher les notifications en temps réel
   (le sujet Pub/Sub que RevenueCat donne, à coller dans Play Console › Monétiser › Configuration). Importer les 3 produits, les
   rattacher au droit « premium » et aux paquets de l'offre « default » ($rc_annual, $rc_weekly, et le paquet de bienvenue,
   comme sur iPhone). Puis me donner la clé publique « goog_… » : je la mets dans achat.js (RC_CLE_ANDROID). **Sans elle, le
   paywall se passe sur Android : ne rien publier en production avant.**
6. **Connexion Google** : Google Cloud (le projet du client web déjà utilisé) › Identifiants › Créer un client OAuth « Android »,
   paquet fr.requete.app, empreinte SHA-1 de la clé de signature d'application (Play Console › Tester et publier › Intégrité de
   l'appli). Un 2e client avec la SHA-1 de la clé d'envoi (affichée par l'étape 2) pour les versions installées hors Play.
   L'APK d'essai de GitHub est signé à chaque fois par une clé jetable : la connexion Google n'y marche pas, c'est normal.
   26 novembre : la connexion Google échouait sur le Samsung d'Elisa (version Play) : connexion.js passait des scopes au login, que
   le plugin refuse sur Android tant que MainActivity n'est pas modifiée. Android : pas de scopes, et
   skipAuthOnlyAuthorizationAfterSignIn (le jeton d'identité suffit à Supabase). Corrigé à partir de la version 34.
7. **La fiche** (textes ci-dessous), les visuels, puis les questionnaires (plus bas) ; envoi en production quand Elisa le dit.

Pas encore sur Android : la connexion avec Apple (les comptes créés avec Apple sur iPhone ne se retrouvent pas sur Android pour
l'instant ; la progression reste possible sans compte), les widgets et l'île dynamique (propres à l'iPhone).

---

## Fiche en français (langue par défaut)

### Nom de l'appli (30 caractères au plus) : 25

    Requête — Apprends le SQL

### Description courte (80 au plus) : 80

    Apprends le SQL en pratiquant : cours vidéo, labo SQL, cas pratiques, entretiens

### Description complète (4 000 au plus)

    Le SQL, ça ne s'apprend pas seulement en regardant des vidéos. Ça se pratique.

    Avec Requête, écris tes propres requêtes, exécute-les sur une vraie base de données et découvre le résultat directement sur ton téléphone. Que tu débutes, prépares un entretien de data analyst ou veuilles progresser au travail, tu avances étape par étape, à ton rythme.

    71 COURS VIDÉO INTERACTIFS
    • 71 leçons courtes, la plupart entre 2 et 5 minutes, réparties en 15 modules, avec 8 formateurs
    • La vidéo s'arrête sur des moments « À toi » : tu réponds pour continuer, puis tu écris tes propres requêtes dans les exercices
    • Du premier SELECT aux jointures, agrégats, sous-requêtes, CTE, fonctions de fenêtre, transactions, vues, index et triggers

    UN VRAI LABO SQL DANS TA POCHE
    • Écris du SQL, lance ta requête et examine les lignes renvoyées par SQLite : la base tourne sur ton téléphone, pas besoin d'ordinateur
    • L'exécution pas à pas rejoue ta requête clause par clause, pour voir comment le résultat se construit
    • Importe tes propres données : tes fichiers Excel, CSV, JSON, SQL ou SQLite deviennent des tables à interroger

    477 CAS PRATIQUES SUR 15 BASES MÉTIER
    • Aéroport, hôpital, zoo, station de ski, festival, restaurant… chaque univers te fait travailler autrement
    • Des mises en situation inspirées du travail : explorer des données, résoudre un problème, construire la bonne requête

    142 QUESTIONS POUR PRÉPARER TES ENTRETIENS
    • Du niveau débutant à avancé
    • Formule ta réponse à voix haute, compare-la avec la réponse attendue et repère les notions à revoir avant le jour J

    RÉVISE, PROGRESSE, RECOMMENCE
    • Des révisions espacées ramènent chaque leçon au bon moment (après 1, 3, 7, 21 et 60 jours)
    • 72 cartes mémo à débloquer, et des stickers à collectionner en route
    • Un planning à ton rythme (10, 20 ou 30 minutes par séance), ta flamme du jour et ta série
    • Des défis SQL entre amis, en direct : même cas, même chrono

    10 minutes aujourd'hui peuvent suffire pour commencer. L'important, c'est d'écrire ta première requête.

    Connecte-toi avec Google si tu veux sauvegarder ta progression et la retrouver sur un autre téléphone. Tes fichiers importés ne quittent jamais ton appareil.

    REQUÊTE PREMIUM
    L'accès aux leçons et à la pratique demande un abonnement Requête Premium, à souscrire dans l'appli. Le paiement passe par ton compte Google Play. L'abonnement se renouvelle automatiquement jusqu'à ce que tu l'annules, dans Google Play › Paiements et abonnements. Si un essai est proposé, il devient un abonnement payant à la fin de l'essai, sauf si tu l'annules avant.

    Conditions d'utilisation : https://requeteapp.com/decouvrir/conditions.html
    Politique de confidentialité : https://requeteapp.com/decouvrir/confidentialite.html

## Fiche en anglais (English (United States), à ajouter dans les traductions)

### App name (30 au plus) : 19

    Requête — Learn SQL

### Short description (80 au plus) : 78

    Learn SQL by doing: interactive video lessons, a SQL lab, cases and interviews

### Full description (4 000 au plus)

    Learn SQL by actually writing it. Requête takes you from your very first SELECT to window functions, step by step, on a real database that runs right on your phone.

    Whether you're switching to a data career, preparing for an interview or sharpening your skills at work, Requête builds a path around your goal, your level and the time you have.

    LEARN WITH INTERACTIVE VIDEO
    • 71 short lessons, most of them 2 to 5 minutes long, across 15 modules
    • Each video pauses on "Your turn" moments to check you've got it, then you write your own queries in the exercises
    • From SELECT, WHERE and ORDER BY to joins, GROUP BY, subqueries, CTEs, window functions, transactions, views, indexes and triggers
    • You play a data analyst at NutriBoost, an online store, and solve real business questions with its customers, products and orders

    PRACTICE LIKE AT WORK
    • 477 case studies across 15 business databases: Airport, Hospital, Zoo, Ski Resort, Music Festival and more
    • A SQL lab in your pocket: write and run any query on a real SQLite database, with a step-by-step visualizer
    • Import your own data: Excel, CSV, JSON, SQL or SQLite files become tables you can query

    GET READY FOR INTERVIEWS
    • 142 SQL interview questions across three levels, from beginner to advanced
    • Answer out loud, compare with the expected answer, then mark what you've mastered and what to review

    REMEMBER WHAT YOU LEARN
    • Spaced reviews bring each lesson back at the right time (day 1, 3, 7, 21 and 60)
    • 72 flashcards to unlock and collect, plus stickers along the way
    • A daily schedule that fits your pace: 10, 20 or 30 minutes per session

    STAY MOTIVATED
    • Keep your daily flame alive and build your streak
    • Challenge your friends in live rooms: same case, same timer, the fastest wins

    Sign in with Google if you want to save your progress and find it on another phone. Your imported files never leave your device.

    REQUÊTE PREMIUM
    Access to the lessons and practice requires a Requête Premium subscription, purchased in the app. Payment is charged to your Google Play account. The subscription renews automatically until you cancel it in Google Play › Payments & subscriptions. If a trial is offered, it converts to a paid subscription when it ends unless you cancel before.

    Terms of use: https://requeteapp.com/decouvrir/en/conditions.html
    Privacy policy: https://requeteapp.com/decouvrir/en/confidentialite.html

## Visuels (google-play/)

- Icône 512 × 512 : google-play/icone-512.png (la même que sur iPhone).
- Image de présentation 1024 × 500 : google-play/banniere-fr.png et banniere-en.png (accueil de l'appli dans un téléphone sans
  marque, la mascotte Requête, les vrais chiffres).
- Captures de téléphone (2 à 8, format 9:16, pas plus de 2 fois plus hautes que larges) : à faire. Les captures iPhone de l'App
  Store (1206 × 2622) sont trop hautes pour Google et montrent un iPhone.

## Coordonnées et catégorie

- Catégorie : Éducation. Adresse e-mail : contact@requeteapp.com. Site : https://requeteapp.com/decouvrir/
- Politique de confidentialité : https://requeteapp.com/decouvrir/confidentialite.html
- Suppression du compte (lien demandé par Google, pour qui n'a plus l'appli) :
  https://requeteapp.com/decouvrir/confidentialite.html#suppression

## Questionnaires de la Play Console (réponses préparées)

- **Accès à l'appli** : pas de connexion obligatoire (« Continuer sans compte »). Les leçons demandent l'abonnement : on peut
  donner aux vérificateurs un code promo Google Play de l'abonnement annuel (Monétiser › Codes promo), dans les instructions.
- **Annonces** : non, aucune publicité.
- **Classification du contenu** (questionnaire IARC) : catégorie « Référence, actualités ou éducation » ; pas de violence, de
  sexe, de langage grossier, de drogues ni de jeux d'argent ; les utilisateurs interagissent (pseudos, classements, défis en
  direct) ; achats numériques : oui ; partage de la position : non.
- **Public cible** : 13-15, 16-17 et 18 ans et plus (comme le 13+ de l'App Store) ; l'appli ne s'adresse pas aux enfants.
- **Sécurité des données** (d'après la politique de confidentialité et le code, comme le questionnaire d'Apple) :
  - Données collectées : oui ; partagées avec des tiers : non (Supabase, RevenueCat et Google travaillent pour nous, ce n'est pas
    un « partage » au sens de Google) ; chiffrées en transit : oui ; suppression sur demande : oui (dans l'appli et par e-mail).
  - Informations personnelles : nom (prénom reçu à la connexion), adresse e-mail, identifiants utilisateur (compte, pseudo) :
    fonctionnement de l'appli, facultatif (seulement avec un compte).
  - Position approximative : le pays choisi pour le drapeau : fonctionnement de l'appli, facultatif.
  - Informations financières › Historique des achats : l'abonnement (RevenueCat) : fonctionnement de l'appli.
  - Activité dans l'appli : interactions avec l'appli (statistiques d'usage, avec accord) : analyses ; autres contenus générés
    par l'utilisateur (notes, avis sur les leçons, messages de contact, scores et parties) : fonctionnement de l'appli.
  - Fichiers et documents : pièces jointes aux messages de contact : assistance, facultatif.
  - Infos et performances de l'appli : diagnostics (messages d'erreur, infos techniques des rapports de bug) : analyses.
  - Identifiants de l'appareil : identifiant tiré au hasard et jeton de notification : fonctionnement de l'appli.
  - Non collecté : position précise, contacts, photos de la galerie, santé, fichiers importés (ils restent sur le téléphone),
    requêtes de la console, historique web.
