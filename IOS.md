# Requête sur l’App Store (Capacitor)

L’app web reste la source unique. Capacitor l’embarque dans une app iOS native.
Les finitions natives sont déjà dans `index.html` : retours haptiques, barre de statut,
écran de lancement, retour par glissement du bord gauche, pas de zoom à deux doigts.
Elles ne s’activent que dans l’app, jamais dans Safari.

## Ce qu’il faut

- Un Mac avec Xcode 26 ou plus et Node.js 22 ou plus (Capacitor 8 ; le Mac d’Elisa a Node 24).
- Un compte Apple Developer (99 €/an) pour publier.

Capacitor 8 range les extensions natives avec Swift Package Manager : pas besoin de CocoaPods. Au premier lancement,
Xcode télécharge `capacitor-swift-pm` (une à deux minutes), et le premier lancement dans un simulateur tout neuf est très
lent (écran noir le temps qu’Xcode charge ses symboles) : c’est normal, les suivants sont rapides.

## Première fois

```bash
npm install
npm run ios:add       # crée le dossier ios/ (projet Xcode) et y met l’écran de lancement (resources/ios)
npm run ios:assets    # génère les icônes depuis resources/
npm run ios           # copie l’app web, synchronise et ouvre Xcode
```

Dans Xcode : choisis ton équipe (Signing & Capabilities), puis lance sur un iPhone ou un simulateur.

## Le site ne lance plus l’appli (13 novembre, 1 h 44)

Elisa : « retirer l’appli sur mon site quand on appuie sur commencer et faire descendre vers l’appli ». Requête n’existe
plus que sur iPhone :

- `index.html`, ouvert dans un navigateur, renvoie toujours à `decouvrir/` (script de tête), et retire au passage
  l’ancienne appli gardée hors ligne (service worker, caches). Il ne se charge plus que dans l’app (Capacitor), en local
  (`localhost`) et dans les navigateurs pilotés par les tests.
- Sur le site, tous les « Commencer » descendent à la section iPhone (`#mobile`, le lien de l’App Store) ; « Se
  connecter » a disparu ; la vidéo reste derrière « Voir la vidéo » et sa fin mène aussi à `#mobile` ;
  `decouvrir/connexion.html` n’est plus qu’un renvoi.
- La FAQ, la politique de confidentialité et les conditions disent ce que fait l’app : compte Apple ou Google,
  abonnement Requête Premium par l’App Store (RevenueCat reçoit un identifiant d’achat anonyme), progression sur
  l’iPhone et dans le compte. Aucun prix sur le site.

## À chaque mise à jour du site

```bash
npm run ios
```

## Vérifier que le Swift compile, sans rien envoyer

`cd ~/SQL && git pull --ff-only && npm run ios:verif` : la même préparation que `ios:testflight` (la page, Capacitor, l’écran de
lancement, le widget), puis une fabrication pour iPhone **sans signature** (`scripts/ios-verif.sh`, `CODE_SIGNING_ALLOWED=NO`) :
ni compte Apple, ni profil, rien d’envoyé à TestFlight. Les erreurs s’affichent ; le journal complet va dans `ios/verif-swift.log`
(hors de Git), que Claude lit par le dossier connecté du Mac.

## TestFlight (l’appli sur un vrai iPhone)

La première fois :

1. **Équipe** : dans Xcode, cible App › Signing & Capabilities › Team, choisir son équipe Apple Developer (compte ajouté
   dans Xcode › Réglages › Comptes). Xcode enregistre alors l’identifiant `fr.requete.app`.
2. **Fiche de l’appli** : sur App Store Connect, Apps › « + » › Nouvelle app : iOS, nom « Requête — Apprends le SQL » (unique
   sur l’App Store), langue principale Français, identifiant `fr.requete.app`, SKU `requete-sql`. Si l’identifiant n’est pas
   dans la liste : developer.apple.com › Identifiers › « + » › App IDs, description « Requete », identifiant explicite `fr.requete.app`.
3. **Envoi** :

   ```bash
   npm run ios:testflight 2>&1 | tee ios-envoi.log
   ```

   L’app web est copiée, puis `scripts/ios-testflight.sh` archive en Release et envoie à App Store Connect
   (`scripts/ios-export-options.plist` : signature automatique, numéro de build augmenté tout seul s’il a déjà servi).
4. **Sur l’iPhone** : après l’e-mail d’Apple (10 à 30 min), App Store Connect › TestFlight › Tests internes : créer un
   groupe et s’y ajouter, puis installer l’appli TestFlight sur l’iPhone : Requête y apparaît.

**Déjà fait (3 novembre)** : identifiant `fr.requete.app` enregistré (« Requete SQL »), fiche « Requête — Apprends le SQL »
sur App Store Connect (n° 6830361256), équipe `RN77C85JG4` réglée dans le projet Xcode, groupe interne « Équipe Requête »
(distribution automatique : chaque version envoyée y arrive seule) avec Elisa ; première version 1.0 (1) envoyée à 22 h 47.
Restent, pour vendre l’appli : le contrat des apps payantes (Accords, taxes et banque) et le statut de commerçant (UE).

Ensuite, à chaque nouvelle version : `npm run ios:testflight`. Si l’archive se plaint qu’il n’y a aucun appareil pour le
profil de développement, brancher l’iPhone au Mac une fois, l’ouvrir dans Xcode (en haut, à la place du simulateur) et relancer.

Si `ios-envoi.log` finit par `error: exportArchive Failed to Use Accounts` puis `** EXPORT FAILED **` (4 novembre, 16 h 55 et
18 h 41) : l’archive est bonne, c’est l’envoi depuis le Terminal qui n’arrive pas à se servir du compte Apple connecté dans
Xcode (Xcode, lui, renouvelle la session tout seul). Le script ouvre alors l’archive dans Xcode (Organizer) :
« Distribute App » › « App Store Connect » › « Distribute » ; Xcode met lui-même le bon numéro de build. À la main :
`open ~/SQL/ios/App/build/Requete.xcarchive`. Pour un envoi sans aucun clic, il faudrait une clé de l’API App Store Connect
(options `-authenticationKeyPath`, `-authenticationKeyID` et `-authenticationKeyIssuerID` de `xcodebuild`).

Si `ios-envoi.log` finit par `** ARCHIVE FAILED **` avec « the compiler is unable to type-check this expression in reasonable
time » (4 novembre, 16 h 28 : « mon TestFlight s’est arrêté à 5 », rien n’était parti) : Xcode n’arrive pas à vérifier à temps
une longue chaîne de modificateurs SwiftUI. C’était la bulle du matin du widget (`RequeteWidget.swift`, `bulle`) : une phrase au
choix (`entree.repos ? "…" : "…"`) suivie de onze modificateurs aux mesures calculées. La règle, dans le widget et dans le pont :
poser d’abord la phrase, la police, les couleurs et les mesures dans des constantes typées (`let largeur: CGFloat = w * 0.53`),
puis enchaîner les modificateurs sur ces constantes. L’erreur donne le fichier et la ligne : c’est là qu’il faut couper.

### Le widget de la série (4 novembre)

`scripts/ios-widget.mjs` (lancé par `npm run ios`, `ios:add` et `ios:testflight`, après `cap sync`) recopie
`resources/ios/widget` dans `ios/App` et, la première fois, ajoute au projet Xcode la cible **RequeteWidgetExtension**
(WidgetKit, identifiant `fr.requete.app.widget`), le groupe d’apps **`group.fr.requete.app`** (droits de l’app et du widget),
le pont `RequeteWidgetPlugin` (enregistré par `RequeteViewController`, que crée le délégué de scène — voir plus bas) et un manifeste de
confidentialité par cible (`PrivacyInfo.xcprivacy`). L’ancien projet est gardé à côté : `project.pbxproj.avant-widget`.
L’app y range la série (index.html, `widgetMaj`) chaque fois qu’elle passe en arrière-plan ; le widget la relit à minuit.

Si l’archive refuse la signature du groupe d’apps : dans Xcode, cible App puis cible RequeteWidgetExtension › Signing &
Capabilities, vérifier l’équipe, et cocher `group.fr.requete.app` sous App Groups (Xcode l’enregistre), puis relancer.


### Le widget de l’écran verrouillé (6 novembre)

Elisa, 6 novembre, 0 h 40 (« dans compte mettre ça (widget) avec les animations de comment procéder ») : Mon compte a un groupe
« Sur ton iPhone » (dans l’app iPhone seulement, quand le pont `RequeteWidget` est là) avec « Widgets de l’écran d’accueil »,
« Widgets de l’écran verrouillé » et « Noter Requête ». Chaque ligne ouvre une feuille où un iPhone dessiné rejoue les gestes
d’Apple, étape par étape (index.html, `WTU`, `wtuJouer`).

Le widget de l’écran verrouillé est `RequeteFlammeVerrou` (genre `RequeteSerieVerrou`, dans `RequeteWidget.swift`, iOS 16.1 et
plus) : la flamme du jour, pleine quand la séance est faite, et la séance du jour, « 0/1 » puis « 1/1 », en rond
(`accessoryCircular`), en bandeau (`accessoryRectangular`, avec la phrase du moment) ou sur la ligne de la date
(`accessoryInline`). Il lit les mêmes données que le widget de l’écran d’accueil (même fournisseur), et l’app le recharge avec
lui (`reloadAllTimelines`). Rien à ajouter au projet Xcode : il vit dans la même extension.

### La cheminée (7 novembre)

Elisa, 7 novembre (16 h 03 : « des supers widgets et live activity et dynamique island créatifs, à un niveau plus que
élevé » ; de 17 h 01 à 17 h 38, les images qu’elle a générées pour la planche ; son choix : « Cheminée + lunettes »). Le widget
**La cheminée** (`RequeteCheminee`, dans `RequeteWidget.swift`) est la pièce du chat, en grand widget (`systemLarge`) :

- **le feu** raconte la séance du jour : froid ; des braises le soir (de 18 h à minuit : « Ta flamme t’attend ! », le temps
  qu’il reste avant minuit, qui défile tout seul, et le bouton « Allumer ma flamme ») ; une belle flambée quand elle est faite
  (« Flamme allumée ! »). Un jour de repos du planning, la cheminée reste froide, sans presser ;
- **le ciel**, par la fenêtre, suit l’heure : l’aurore (5 h – midi), le jour, le crépuscule (18 h – 21 h), la nuit. Le
  fournisseur pose une entrée à minuit, 5 h, midi, 18 h et 21 h ; la séance du jour suit les règles du widget de la flamme ;
- **le chat** change de pose : il dort la nuit, se réveille le matin, travaille l’après-midi, tient sa bougie le soir, saute de
  joie quand la séance est faite, salue un jour de repos ;
- **la pièce se décore** : au mur, les stickers gagnés (trois au plus) ; sur la cheminée, la plante, un trophée dès le premier
  défi réussi, un diplôme dès le premier module fini. L’app les range avec la série (index.html, `widgetCheminee`, dans
  `widgetMaj` ; pont `maj`).

**Le très grand widget** (`systemExtraLargePortrait`, iOS 27, en portrait) ajoute le liège (la dernière carte mémo gagnée, et le
post-it du chat, une phrase par jour) et l’écran de l’ordinateur (la prochaine leçon, ou le prochain défi). Il n’existe que
compilé avec **Xcode 27** (Swift 6.4) : avec Xcode 26, le code le saute (`#if compiler(>=6.4)`) et le widget reste en grand.

**« Allumer ma flamme »** ouvre `requete://seance` : le délégué de scène le reçoit (l’app ouverte, ou lancée par lui),
`RequeteRaccourci.ouvrir` en fait le raccourci `fr.requete.app.seance`, et la page ouvre la séance recommandée, comme la carte de
l’accueil (`raccourciOuvrir` ; pendant l’onboarding, un bandeau le dit ; en pleine séance, on y reste). `scripts/ios-widget.mjs`
déclare le schéma `requete` (`CFBundleURLTypes`) une fois dans l’Info.plist de l’app ; un Info.plist qui a déjà ses schémas d’URL
n’est pas touché (un avertissement le dit : y ajouter `requete` sous `CFBundleURLSchemes`). Sans délégué de scène (modèles plus
anciens de Capacitor), le bouton ouvre l’app sans la séance.

La pièce est le fond du widget (`containerBackground`) : quand iOS teinte l’écran d’accueil, il l’enlève, et la phrase, le chat
et le bouton restent. Ses images (`Assets.xcassets` : `PieceGrand…` et `PieceTresGrand…` pour les quatre moments, le ciel peint
derrière les vitres ; `Feu…`, `Chat…`, `Trophee`, `Plante`, `Diplome`, `Autocollant`) restent petites : WidgetKit refuse une
image plus grande que ce que le widget peut montrer (« Widget archival failed due to image being too large », dans la console),
et le widget reste vide. La pièce existe en 2x et en 3x, chacune sous la surface d’un grand widget de l’iPhone le plus petit de
son échelle (un test le vérifie). Les places des objets sont relevées sur la planche, en pixels de l’image d’origine
(`Agencement`) : une nouvelle image de la pièce garde les mêmes proportions, ou les places sont à relever de nouveau.

### La requête de poche (7 novembre)

Elisa, 7 novembre (« Requête de poche », d’après la planche : « Une question tirée de tes leçons. Tu réponds dans le widget, sans
ouvrir l’app. »). Le widget **La requête de poche** (`RequetePoche`, dans `RequeteWidget.swift`, moyen) montre une requête à trou
et trois réponses, dont une seule marche. On touche une réponse dans le widget : « Bien vu ! », le chat hoche la tête et le trou
se remplit ; sinon « Presque ! », la bonne réponse s’allume, avec le pourquoi en une ligne. La flèche passe à la question
suivante. Son choix pour la flamme : « la séance seule » — répondre dans le widget n’allume pas la flamme du jour.

- **Les questions** : une par leçon, dans index.html (`POCHE`), chacune avec son commentaire SQL quand plusieurs réponses
  s’exécutent (« -- 60 unités ou moins »). `tests/ios-poche.test.mjs` exécute chaque requête sur la base de l’app : la bonne
  réponse marche, chaque autre échoue ou donne autre chose. Une question à changer : la modifier là, le test dit si elle tient.
- **Les questions du widget** (10 novembre, « crée des questions juste pour le widget en combinant tout ») : 97 de plus, dans
  index.html (`POCHE_PLUS`), de quatre genres : la requête à trou, le **cas pratique** (un besoin, puis la requête à compléter),
  le **QCM** (une question, sans code) et **Trouve l’erreur** (les lignes numérotées, on touche la fausse). Chacune est
  rattachée à sa leçon. L’étiquette du widget dit le genre, l’énoncé passe au-dessus du code. `tests/ios-poche-plus.test.mjs`
  exécute chaque requête : la bonne réponse, la vraie ligne fausse. Le cinquième genre, « Quel résultat ? », est parti le
  13 novembre (plus bas).
- **Ce que range l’app** : trente questions par jour, une d’entretien puis une révision (les leçons faites, celles à revoir
  d’abord), dans le même ordre toute la journée (`widgetPoche`, avec la série, dans `widgetMaj`). Le pont les garde (`maj`) ;
  une nouvelle série repart de la première question, la même laisse le widget où il en est.
- **Les boutons** passent par **App Intents** (`RepondrePoche`, `SuivantePoche`, cachés de Raccourcis) : ils écrivent la réponse
  touchée et la question du moment dans le groupe d’apps, puis iOS redessine le widget. Les widgets n’ont de boutons qu’à partir
  d’**iOS 17** : le widget n’existe qu’à partir de là. Tant que l’app n’a rangé aucune question (jamais ouverte depuis la pose
  du widget), il le dit (« Pas encore de question »), et un appui ouvre la séance du jour.

### La requête de poche : l’entretien, plus de « Quel résultat ? », trois étages (13 novembre, 8 h 32)

Elisa, 13 novembre, 8 h 32 : « Tu vois le widget du QCM, il faudrait éviter les questions combien il y a de lignes car on ne peut
pas exécuter […] Et il faudrait que tu génères des questions, pas que sur les cours, mais sur les parties, toutes les parties en
fait […] Je veux juste des questions niveau, tu sais, entretien, toutes les questions possibles, mais pas sur quel est le
résultat. Et j’ai l’impression que ce widget-là, il est mal formaté […] Il y a des trous, il y a des espaces. »

- **Plus de « Quel résultat ? »** : les vingt-cinq questions qui demandaient ce qu’une requête renvoie (combien de lignes, quelle
  valeur) sont parties de `POCHE_PLUS`. Le widget n’exécute rien : il ne pose plus de question dont la réponse est un résultat.
  `widgetPoche` les filtre, le widget aussi (`PocheRangement.questions`) : une série rangée avant la mise à jour n’en montre plus.
  Restent les requêtes à compléter (trou, cas pratique), Trouve l’erreur et les QCM.
- **L’entretien** : `POCHE_ENTRETIEN` (index.html), dix questions par partie du programme, quinze parties, 150 en tout. Ce qu’un
  recruteur demande de vive voix : une notion (« Que garantit l’atomicité ? »), une différence (`UNION` ou `UNION ALL`), un piège
  (`NOT IN` et les `NULL`), un bon réflexe (un `SELECT` avant un `UPDATE` risqué). Aucun code à lire, aucune requête à exécuter.
  Une question : `m` (le rang de la partie dans `MODULES`), `e`, trois réponses `c`, la bonne `b`, les pourquoi `oui` et `non`.
  L’étiquette du widget dit « Entretien · la partie ». Elles ne dépendent d’aucune leçon : le widget les pose dès le premier jour.
- **Écrire une question d’entretien** : l’énoncé en 100 caractères au plus ; chaque réponse en 18 caractères au plus, avec des
  mots de 12 au plus (le widget les écrit sur deux lignes et ne coupe pas un mot) ; un long mot-clé (`ROW_NUMBER`,
  `SERIALIZABLE`) va dans l’énoncé, pas dans une réponse. `tests/retours-0832-poche-entretien.test.mjs` refait la mesure du
  widget : aucune réponse sous 10 points, sur trois tailles d’iPhone.
- **La série du jour** (`widgetPoche`) : une question d’entretien, une révision, et ainsi de suite, trente au plus. L’entretien
  prend une question par partie à chaque tour, les parties commencées d’abord : les quinze premières touchent tout le
  programme. Quand les révisions manquent (les premiers jours), l’entretien remplit la série.
- **La mise en page, en trois étages** (`PocheVue.colonne`) : l’étiquette en haut ; l’énoncé et la requête au **milieu** de la
  place qui reste (`milieu`) ; les réponses puis le pied (la consigne, ou le verdict et la flèche) en bas, à hauteur fixe.
  Avant, tout s’empilait depuis le haut à 4 points d’écart, et le vide tombait d’un bloc sous les réponses. Maintenant il se
  partage au-dessus et en dessous de l’énoncé, et rien ne bouge quand on répond.
- **L’énoncé seul** (QCM, entretien) grandit quand il est court : de 14 à 17 points (`tailleEnonce`), trois lignes au plus.
- **Les réponses en mots** (`formeProse`) : sur une ligne si les trois y tiennent à 11 points ; sinon sur deux lignes, dans des
  puces plus hautes. Le widget ne peut pas mesurer un texte avant de le dessiner : la largeur est estimée lettre par lettre
  (`cadratin`), calée un peu large.
- **Le verdict en pastille** : le ✓ ou le ✗ se pose sur le coin de la puce touchée (`pastille`). Avant, il prenait sa place
  dans la ligne, et le texte de la réponse rétrécissait au moment de répondre.
- **Le code** gagne un peu : une requête de deux lignes s’écrit à 11,5 points (elle prenait la taille d’une de trois lignes).

**À regarder sur l’iPhone** (rien de tout cela n’est compilé ni dessiné ici : `npm run ios:verif` d’abord) : une question
d’entretien à deux lignes de réponses ; un cas pratique de trois lignes ; la pastille après une bonne puis une mauvaise
réponse ; l’étiquette longue (« Entretien · Agrégats et regroupements »), qui rétrécit pour tenir.

**Ce qui n’a pas été fait** : les requêtes à compléter et Trouve l’erreur restent (elles ne demandent pas de résultat) ; la
rubrique Entretien de l’app (ses 142 questions ouvertes) n’a pas changé ; le widget ne dit pas où on en est dans la série.

### La carte mémo (retirée le 10 novembre)

Le widget **La carte mémo** (petit, qui se retournait) a été retiré (« supprime le widget carte mémo »). Ses cartes restent dans
l’app (Bibliothèque › Cartes mémo) ; `CartesRangement` ne garde que les deux outils de calendrier dont Ta semaine se sert.

### Ta semaine, en résultat de requête (7 novembre)

Elisa, 7 novembre (« Ta semaine, en résultat de requête », d’après la planche : « Le widget parle SQL : ta semaine sort comme un
tableau de résultats. »). Le widget **Ta semaine** (`RequeteSemaine`, dans `RequeteWidget.swift`, moyen) affiche
`SELECT jour, flamme FROM ma_semaine;`, puis une colonne par jour, du lundi au dimanche : la flamme dorée un jour actif, la lune
un jour de repos du planning, la flamme en contour aujourd’hui tant que la séance attend, `NULL` un jour passé sans activité,
« · » à venir (et avant le premier jour qui compte). Dessous, comme sous un résultat : « 7 lignes · 4 flammes », et où en est
aujourd’hui (« samedi : en attente »). Sombre façon terminal quand l’iPhone est en **mode sombre**, clair façon tableau de
résultats sinon : les deux versions de la planche. Aujourd’hui en attente, un appui ouvre la séance du jour.

L’app range les jours avec la série (`widgetSemaine`, dans `widgetMaj` ; pont `maj`, clé `semaine`) : les jours actifs des trois
dernières semaines, les jours de repos du planning (trois semaines avant, deux après) et le premier jour qui compte (le début du
planning ou la première activité). Le widget en tire la semaine du jour, une entrée chaque minuit : la semaine change le lundi,
même si l’app n’a pas été ouverte. Sans bouton, il marche dès iOS 15.

### Le chat change dans la journée (4 novembre, 12 h 14)

Un widget ne joue ni vidéo ni boucle (iOS ne le permet pas) : il anime le passage d’un état à l’autre, à partir d’iOS 17. Le chat
a donc quatre poses (`Humeur`, dans `RequeteWidget.swift`), et le fournisseur pose une entrée à minuit, 5 h, midi et 18 h :

- **le matin** (5 h – midi) : la flamme et « 0/1 » se rangent dans le coin, le chat dit « Une petite requête ? » dans une bulle
  (« Jour de repos ! » un jour de repos du planning) ;
- **l’après-midi** (midi – 18 h, et la nuit) : comme avant ;
- **le soir** (18 h – minuit, un jour de séance) : la flamme grandit et rougeoie, « Ta flamme t’attend ! » (« Allume ta flamme ! »
  sans série) ; un jour de repos, le soir reste calme ;
- **séance faite** : la flamme dorée, le chat en l’air et penché, entre des étincelles. L’app recharge le widget en partant : en
  revenant sur l’écran d’accueil après une séance, le chat plonge et ressort d’un bond.

À chaque changement, le chat plonge et ressort dans sa nouvelle pose, la bulle sort de sa bouche, les étincelles jaillissent.
Avant iOS 17, les poses changent sans animation. Le jour de repos vient de `limite` (rangée par l’app) : avant elle, la série tient
sans séance.

12 h 35 (« pourquoi 12 ? non, je veux que la flamme du jour ! ») : le widget n’affiche plus de nombre de jours, seulement la flamme
du jour — éteinte, rougeoyante le soir, dorée quand la séance est faite. Dans la galerie des widgets, il s’appelle « Ta flamme ».
13 h 11 (« mettre 0/1 au niveau de la flamme, avec un validé coche ✅ quand c’est bon ») : à côté de la flamme, la séance du jour,
« 0/1 » (le « /1 » plus petit), puis « 1/1 » en doré quand elle est faite, le chiffre qui roule de 0 à 1 (iOS 17), et la coche menthe
« validé » qui se pose sur la flamme dorée. Un jour de repos du planning, pas d’objectif : la flamme seule.

### La leçon dans la Dynamic Island (4 novembre, 12 h 35)

Une Live Activity suit la leçon en vidéo : la page la lance à l’ouverture de la leçon (index.html, `ileDebut`), envoie l’avancement
à chaque dixième de la vidéo et dès qu’on quitte l’app (`ileMaj`), et l’arrête à la fin (`ileFin`), par le pont
(`RequeteWidget.leconDebut`, `leconMaj`, `leconFin`, dans `RequeteWidgetPlugin.swift`). Son dessin est dans le widget
(`RequeteLeconActivite`, dans `RequeteWidget.swift`) :

- **Dynamic Island** (iPhone 14 Pro et plus récents, dès qu’on quitte l’app en pleine leçon) : la flamme à gauche, les moments
  « À toi » réussis à droite (« 2/4 », le « /4 » plus petit, braise puis menthe une fois l’objectif de la leçon atteint ; 5 novembre,
  6 h 45). Avant que la vidéo ait donné ses moments, et une fois la leçon réussie, le
  pour cent à droite (« 12 % », une coche dorée une fois réussie ; 4 novembre, 17 h 27 : l’anneau d’avant ressemblait à une roue qui
  charge et iOS en coupait un bord). Appui long : le chat, le module et la leçon, une case par moment (menthe et sa coche une fois
  réussi, le contour doré sur celle qui valide la leçon), « Moments réussis : 2/4 · encore 2 pour valider » ;
- **l’animation** : le compte n’avance dans la Dynamic Island que quand on quitte l’app. Elle apparaît avec l’ancien compte, et le
  nouveau arrive une seconde après (`leconMaj` avec `anime`, une tâche de fond le temps de cette seconde) : le chiffre roule (iOS 17),
  la case se remplit et sa coche se pose ;
- **écran verrouillé** (tous les iPhone en iOS 16.2 et plus) : la même chose sur le violet de l’app ;
- un appui ramène dans l’app, sur la leçon. **Leçon réussie** : la flamme du jour s’allume, dorée (« Leçon terminée ! Ta flamme
  du jour est allumée. »), et l’activité reste un quart d’heure sur l’écran verrouillé. **Leçon fermée avant la fin** : elle s’en va.
  L’app relancée arrête une activité restée d’avant.

iOS ne montre les Live Activities que si l’Info.plist de l’app a `NSSupportsLiveActivities` : `scripts/ios-widget.mjs` l’ajoute
une fois (à chaque `npm run ios`, `ios:add` ou `ios:testflight`). Réglages › Requête › Activités en direct permet de les couper.

### Les lunettes du chat dans la Dynamic Island (7 novembre)

Sur la planche « Le chat se cache dans l’île » (son choix : « Cheminée + lunettes ») : l’île est noire, on n’y voit que les
lunettes du chat (`LunettesChat`, dessinées en formes dans `RequeteWidget.swift`), à gauche et en tout petit ; à droite, les
moments réussis, comme avant. Ses yeux suivent la leçon (`leconRegard`) : il regarde ; il sourit, l’objectif de la leçon
atteint ; il s’endort quand la leçon est en pause depuis une heure (la Live Activity est alors périmée, `isStale`, à partir
d’iOS 16.2 : le pont la met à jour avec une `staleDate` d’une heure) ; leçon réussie, des étoiles plein les yeux. Appui long : le
chat sort du noir (`ChatNoir`, sur fond noir, comme l’île). L’écran verrouillé ne change pas.

### Le défi en solo dans la Dynamic Island, et la manche (10 novembre)

« Ok pour solo et multijoueur avec le 1/2 etc. pour les manches » : une partie seule a maintenant son île, comme la salle entre
amis (`RequeteSalle`, avec une seule place) : les lunettes du chat à gauche ; à droite, la manche (« 1/3 ») et le chrono qui
descend tout seul ; entre deux manches, « 1/3 » ; à la fin, tes points. Appui long : la manche et ses points à gauche, le défi,
« Ton score : 240 pts » ; sur l’écran verrouillé, « Défi en solo ». Elle reste sur le téléphone : ni jeton de push, ni serveur
(`salleDebut` avec `push: false`). À plusieurs, la manche s’ajoute aussi à côté du chrono.

### L’onboarding dans la Dynamic Island (10 novembre)

« En plein onboarding, fais la même chose pour Requête avec les yeux du chat » (d’après la Dynamic Island d’une autre app : son
avatar à gauche, un anneau qui avance à droite). Une Live Activity (`RequeteAccueilIle`) suit le premier onboarding, de l’accueil
au parcours prêt : la page la lance et la met à jour à chaque page (index.html, `ileObSync` ; le pont, `accueilDebut`,
`accueilMaj`), et l’arrête à la fin (`accueilFin`).

- **Dynamic Island** (dès qu’on quitte l’app en plein onboarding) : à gauche, les lunettes du chat (un clin d’œil sur l’accueil,
  les yeux ouverts pendant les questions, rieurs sur le parcours prêt, endormis après une heure de pause) ; à droite, l’anneau des
  étapes, lilas, qui se remplit page après page. Appui long : le chat, « Bienvenue, Elisa », la page du moment, sa barre et
  « Étape 3 sur 18 · ≈ 3 min », le même compte que l’en-tête de l’onboarding.
- **Écran verrouillé** : la même chose, sur le violet de l’app.
- **La fin** : le parcours prêt, l’anneau menthe avec sa coche et des étoiles plein les yeux du chat, cinq minutes sur l’écran
  verrouillé. Fermé sans finir (l’aperçu de Mon compte, par exemple) : elle s’en va tout de suite. Ni l’aperçu ni la
  personnalisation d’un compte déjà inscrit ne la lancent.

### Ta flamme en direct, jusqu’à minuit (7 novembre)

Sur la planche « Ta flamme, en direct jusqu’à minuit » (« À l’heure de ton planning, si ta flamme n’est pas encore allumée, une
barre se vide toute seule jusqu’à minuit. Un tap : une leçon express. ») : une seconde Live Activity (`RequeteFlammeDirecte`, dans
`RequeteWidget.swift`), à activer dans **Mon compte › Sur ton iPhone › Ta flamme en direct** (coupée par défaut). Les soirs de
séance (pas les jours de repos du planning), à l’heure du rappel, au plus tôt 18 h (une Live Activity vit huit heures au plus), si
la flamme du jour n’est pas encore allumée :

- **Dynamic Island** : les lunettes du chat à gauche, la flamme et le temps qui reste à droite (« 3:12:45 »). Appui long : le chat
  à l’allumette, « 3:12:45 avant minuit », « Ta flamme t’attend ! », la prochaine activité (« Leçon 4 · LEFT JOIN »), la barre qui
  se vide et « Leçon express · 3 min ». Le chiffre et la barre avancent seuls (`Text(timerInterval:)`, `ProgressView(timerInterval:)`) ;
- **écran verrouillé** (tous les iPhone) : « Ta flamme t’attend ! », « Il te reste 3 h 12 min », la barre, la leçon express ;
- un appui ouvre la séance du jour (`requete://seance`, comme le bouton de La cheminée) ;
- **flamme allumée** (la première activité du jour, `noteActivityDay` → `flammeDirectAllumee`) : « Flamme allumée ! À demain. »,
  le chat en l’air, un quart d’heure sur l’écran verrouillé (tout de suite partie si la leçon est déjà dans la Dynamic Island :
  elle le dit) ; programmée pour plus tard ce soir-là, elle est annulée ;
- **minuit passé** sans séance : la Live Activity est périmée (`staleDate` à minuit, `isStale`) : le chat s’endort, « Minuit est
  passé », « Ta prochaine séance rallumera ta flamme. ». À la prochaine ouverture, l’app la retire.

Sans serveur : la page (`flammeDirectSync`, dans index.html) demande les deux prochains soirs à l’iPhone
(`RequeteWidget.flammeProgrammer`, dans `RequeteWidgetPlugin.swift`) à l’ouverture, au retour dans l’app et après chaque
enregistrement, si ce qui est prévu a changé. **À partir d’iOS 26**, iOS démarre une Live Activity programmée à l’heure dite, même
l’app fermée (`Activity.request(…, start:)`, avec une alerte obligatoire) ; **avant iOS 26**, elle démarre quand on ouvre l’app ce
soir-là sans avoir fait sa séance. Balayée, elle ne revient pas le même soir. Quand le rappel tombe à la même heure, il ne sonne pas
en plus : l’alerte de la Live Activity prend son message (`rappelMessage`). Les images du chat qu’elle montre sont en @2x et @3x
(`ChatAllumette`, `ChatBravo`, `ChatDodo`, `ChatNoir`) : iOS refuse de démarrer une Live Activity dont une image est plus grande
que sa présentation, et une image sans échelle compte ses pixels en points. Coupée dans Réglages › Requête › Activités en direct,
Mon compte le dit. Le « 23 h 40, les yeux grands ouverts » de la planche demanderait un serveur (une mise à jour poussée) : sans,
rien ne change entre l’heure dite et minuit, sauf le chiffre et la barre.

### La salle dans l’île (7 novembre)

Sur la planche « Ta salle vit dans l’île » (« Une seule activité, du code de la salle jusqu’au podium. Tu pars envoyer le code sur
WhatsApp : tu vois tes amis arriver. ») : une troisième Live Activity (`RequeteSalleIle`, dans `RequeteWidget.swift`), pour chaque
salle entre amis (pas pour une partie seule). Elle démarre quand la salle s’ouvre (la page, `ileSalleMaintenant` ; le pont,
`salleDebut`) et la suit en trois temps :

- **on attend les amis** : dans l’île, les lunettes du chat et « 2/6 » (six joueurs par salle depuis le 8 novembre) ; appui long, le code de la salle, les joueurs en pastilles,
  et pour l’hôte **Partager** (la feuille de partage d’iOS, `partagerTexte`) et **Lancer** ; sur l’écran verrouillé, « Salle K7P2QX »,
  « 2/6 · on attend Max ». Un ami qui entre : l’île s’ouvre un instant, un clin d’œil du chat et un petit **miaou**
  (`assets/sons/miaou.wav`, synthétisé par `tools/sons/miaou.py`, recopié dans Library/Sounds au lancement, où iOS cherche les sons
  des alertes) ;
- **la partie** : le chrono de la manche descend tout seul (`Text(timerInterval:)`), ma place (« 2e sur 4 »), le défi, la manche,
  les scores (« @lea 240 · Toi 210 · @max 150 ») ; entre deux manches, une coche ;
- **le podium** : « Victoire ! » (des étoiles dans les yeux) ou « 2e sur 4 », le classement, et pour l’hôte **Rejouer** (« Revanche »
  s’il n’a pas gagné) ; il reste un quart d’heure sur l’écran verrouillé. Quitter la salle avant l’arrête.

L’état est le même pour tous (`RequeteSalle.ContentState` : la phase, les joueurs et leurs points, l’hôte, la manche, le défi, la fin
du chrono en secondes depuis 1970) ; chaque téléphone s’y retrouve par son identifiant. **L’app ouverte**, la page met l’activité à
jour elle-même (`salleMaj`). **L’app fermée**, c’est le serveur : l’activité demande à Apple un jeton de push (`pushType: .token`),
que la page confie au serveur (`jeu_ile_jeton_v2`, avec la clé de l’appareil : seulement pour une salle dont il est membre) ; le
téléphone dont la salle vient de changer (il arrive, se dit prêt, trouve ; la manche ou la phase change ; pour l’hôte, quelqu’un
arrive ou part) envoie le nouvel état à la fonction **jeu-ile** (`supabase/functions/jeu-ile`), qui vérifie qu’il est dans la salle et
que l’état est nouveau (`jeu_ile_cibles_v2`), puis le pousse par Apple (APNs, « liveactivity ») aux autres joueurs ; les jetons
refusés sont oubliés (`jeu_ile_suivi_v2`). Les jetons et le dernier état partent avec la salle (ménage de 24 h).

**La clé d’Apple, une seule fois (Elisa)** — sans elle, la fonction répond « veille » et l’île ne suit la salle que l’app ouverte :

1. developer.apple.com › Account › Certificates, Identifiers & Profiles › **Keys** › « + ».
2. Un nom (« Requête push »), coche **Apple Push Notifications service (APNs)** › Configure : « Sandbox & Production »,
   « Team Scoped (All Topics) » › Save › Continue › Register.
3. **Download** : le fichier `AuthKey_XXXXXXXXXX.p8` (Apple ne le donne qu’une fois : garde-le en lieu sûr). Note le **Key ID**
   (10 caractères, sur la même page) et ton **Team ID** (Membership details).
4. supabase.com › projet requete-sql › **Edge Functions** › **Secrets** › trois secrets : `APNS_KEY` (tout le contenu du fichier
   .p8, lignes BEGIN et END comprises), `APNS_KEY_ID`, `APNS_TEAM_ID`. Save. La fonction les lit au prochain appel.

**Le droit des push** : l’app déclare `aps-environment` (`App.entitlements`). La signature automatique d’Xcode
(`-allowProvisioningUpdates`, dans `scripts/ios-testflight.sh`) ajoute la capacité **Push Notifications** à l’identifiant
fr.requete.app. Si l’archive s’arrête sur « Provisioning profile … doesn’t include the aps-environment entitlement » :
developer.apple.com › Identifiers › fr.requete.app › coche Push Notifications › Save, puis relance `npm run ios:testflight`. Une
version installée depuis Xcode (développement) a un jeton du bac à sable d’Apple : la fonction le reconnaît (refusé en production,
elle essaie le bac à sable) et s’en souvient.

### Plus vivant : la scène du retour, le temps qui défile, le clin d’œil (13 novembre, 8 h 01)

Elisa, 13 novembre, 8 h 01 : « Améliore la Dynamic Island / widget » ; ses réponses : tout (la Dynamic Island, les widgets de
l’accueil, le widget verrouillé, la page du widget), et « Plus vivant ». iOS ne laisse ni un widget ni une Live Activity tourner
en boucle : ce qui bouge tout seul, ce sont ses minuteurs et ses barres (`Text(…, style: .timer)`, `ProgressView(timerInterval:)`),
et le passage d’un état à l’autre (animé à partir d’iOS 17). Trois moyens, donc, tous publics :

- **La petite scène du retour** (`Scene`, dans `RequeteWidget.swift`). L’app recharge les widgets chaque fois qu’on la quitte
  (index.html, `widgetMaj`) : le fournisseur pose alors trois entrées à la suite, à 1,3 s d’écart, et le widget joue une scène au
  moment où l’on arrive sur l’écran d’accueil. **Ta flamme** : le chat plonge, ressort plus haut et penché, se pose ; la flamme
  gonfle un instant ; la séance faite, les étincelles suivent. **La cheminée** : le feu se tasse et reprend d’un souffle (jamais
  froide), le chat fait un petit bond. **Ta semaine** : la flamme d’aujourd’hui bat, et le compte « 4 flammes » roule quand il
  change. Chaque temps est un état complet (si iOS en saute un, rien ne manque) ; les entrées de minuit, 5 h, midi, 18 h restent
  posées. À partir d’iOS 17 seulement : avant, un widget change sans animation, et trois sauts de suite ne diraient rien.
- **Le temps qui défile.** Sur l’écran verrouillé, le soir d’un jour de séance, tant que la flamme attend : dans le rond, un
  anneau se vide tout seul de 18 h à minuit autour de la flamme et de « 0/1 » ; dans le bandeau, sous « Ta flamme t’attend ! »,
  « 3:12:45 » défile. Dans l’île de « Ta flamme en direct », toute petite (une autre activité à côté), le même anneau autour de
  la flamme. Le petit widget de l’accueil n’a pas de compte à rebours : le soir, la phrase passe juste au-dessus des oreilles du
  chat, il n’y a pas la place d’une ligne de plus (La cheminée l’a déjà).
- **L’arrivée de l’île.** On quitte l’app en pleine leçon : l’île apparaît ; une seconde après, le chat fait un clin d’œil (et
  le compte des moments roule, s’il a changé) ; huit dixièmes plus tard, il rouvre les yeux (`RequeteLeconPont.maj`, `anime` :
  la page l’envoie maintenant à chaque départ, index.html, `ileMaj`). En plein onboarding, pareil, et l’anneau avance depuis
  l’étape que l’île montrait la dernière fois (`ileObSalut`, `accueilMaj` avec `anime` et `avant`). Le champ `clin` est
  facultatif dans les deux types (une activité d’avant se lit encore) ; une tâche de fond garde l’app éveillée ces deux secondes ;
  une mise à jour plus récente arrête ce qui restait à jouer (`tour`). Les yeux du chat **clignent** à chaque changement de regard
  (`Paupiere`, `AnyTransition.clignement`) : ceux d’avant se ferment, ceux d’après s’ouvrent. La jauge des moments, la barre et
  l’anneau de l’onboarding avancent sous les yeux ; dans la salle, la place, la manche, les points et les joueurs roulent.
- **La requête de poche** : la question suivante pousse l’autre vers la gauche, le symbole du verdict se pose d’un rebond (en
  pastille sur le coin de la puce depuis le 13 novembre, 8 h 32).
- **La page du widget, dans l’app** (après la troisième leçon) : la tuile était encore dessinée avec un nombre de jours, que le
  vrai widget n’affiche plus depuis le 4 novembre. Elle est dessinée comme lui (`obWidgetTuile`) et joue sa journée en boucle
  (`obWidgetPromoJouer`) : le matin (la flamme rangée dans le coin, « Une petite requête ? »), le soir (elle grandit et rougeoie,
  « Ta flamme t’attend ! »), la séance faite (dorée, sa coche, « 1/1 », le chat penché entre des étincelles) ; entre deux, le
  chat plonge et ressort. Mouvements réduits : la séance faite, posée. Dans le tutoriel, la tuile reste sur la séance faite.

Ce qui n’a pas été fait, et pourquoi : une vraie animation continue dans un widget (une flamme qui danse) demande une interface
privée d’iOS ou une police truquée en guise de pellicule ; la première risque un refus de l’App Store, la seconde ne peut pas se
vérifier sans iPhone. La barre du temps d’une manche dans l’île demanderait l’heure de début de la manche, que l’état de la salle
ne porte pas.

**À vérifier sur l’iPhone** (rien de tout cela ne se voit ici, où le Swift n’est ni compilé ni dessiné) : `npm run ios:verif`
d’abord, puis TestFlight ; la scène du retour sur chaque widget (iOS décide de l’instant exact où il montre chaque entrée) ; le
rond du soir sur l’écran verrouillé ; le clin d’œil en quittant une leçon.

### Le jour où un parcours ouvre : la notification (11 novembre, 15 h 55)

« M’avertir au lancement », sur la page d’un parcours à venir, est une vraie notification dans l’appli iPhone : en activant
l’alerte, iOS demande l’autorisation des notifications (une seule fois) ; l’appareil s’inscrit alors à la base de l’appli
(`parcours_alerter` : l’empreinte de sa clé, le parcours, le jeton de push d’Apple ; table `parcours_alerte`,
`supabase/migrations/20261111160000_parcours_alerte_push.sql`, appliquée le 11 novembre). Couper l’alerte efface la ligne ;
« Supprimer mon compte » aussi. Notifications refusées, ou sur le site : le message dans l’appli à son ouverture, comme avant.
Le jeton arrive par l’AppDelegate (branché par `scripts/ios-widget.mjs`) et `RequetePush` (`RequeteWidgetPlugin.swift`).

**Une seule fois (Elisa)** : supabase.com › projet requete-sql › **Edge Functions** › **Secrets** › Add new secret :
`PARCOURS_ANNONCE_CLE`, avec un mot de passe que tu choisis (long, à garder : c’est lui qui autorise l’envoi). La clé d’Apple est
celle de la salle dans l’île (`APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, plus haut) : sans elle, rien ne part.

**Le jour J**, une fois en ligne sur l’App Store la mise à jour où le parcours est ouvert (`dispo:true` dans `PARCOURS`), dans le
Terminal (remplace `TA_CLE` par ton mot de passe et `python` par `excel` ou `powerbi` si besoin). D’abord l’essai, qui n’envoie
rien et dit combien d’iPhone attendent (`inscrits`) et si la clé d’Apple est là (`cleApple`) :

    curl -sS -X POST "https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/parcours-annoncer" -H "x-annonce: TA_CLE" -H "Content-Type: application/json" -d '{"parcours":"python","essai":true}'

Puis l’envoi, la même commande sans l’essai :

    curl -sS -X POST "https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/parcours-annoncer" -H "x-annonce: TA_CLE" -H "Content-Type: application/json" -d '{"parcours":"python"}'

La fonction (`supabase/functions/parcours-annoncer`) envoie « Python pour la data est ouvert ! — Le nouveau parcours t’attend
dans Requête. Mets l’appli à jour si besoin. », puis efface les inscrits servis (et les iPhone qu’Apple ne connaît plus) ; elle
répond `envoyees`, `oubliees` et `restantes` (Apple indisponible) : relancer la même commande renvoie seulement à ceux qui restent.
`"veille": true` : la clé d’Apple manque. « Clé d’annonce absente ou fausse » : le mot de passe ne correspond pas au secret.

### Les retours par e-mail (12 novembre, 22 h 07)

Un message « Contacte-nous », un avis de leçon qui porte un commentaire, un pseudo signalé au classement : chacun arrive par
e-mail, en plus du tableau de bord. À chaque nouvelle ligne, la base prévient la fonction `alerte-mail`
(`supabase/functions/alerte-mail`, migration `supabase/migrations/20261112215758_alerte_mail.sql`), qui écrit un e-mail en texte
simple et l’envoie par Resend. L’adresse laissée dans un message devient l’adresse de réponse : « Répondre » suffit. Les pièces
jointes ne partent pas, seulement un lien de lecture valable 7 jours. Rien n’est à mettre à jour dans l’appli : tout se passe
côté serveur, y compris pour les versions déjà installées. Migration appliquée et fonction déployée le 12 novembre (23 h) ;
il ne manque que la clé de Resend.

**Une seule fois (Elisa)** :

1. resend.com › créer un compte **avec l’adresse où tu veux recevoir les retours** (contact@requeteapp.com). Tant que le domaine
   requeteapp.com n’est pas vérifié chez Resend, l’adresse d’essai de Resend n’écrit qu’à l’adresse du compte.
2. Resend › **API Keys** › Create API Key (« Sending access » suffit) : copier la clé.
3. supabase.com › projet requete-sql › **Edge Functions** › **Secrets** › Add new secret : `RESEND_API_KEY`, avec cette clé.

Facultatifs : `ALERTE_MAIL_A` (une autre adresse d’arrivée ; par défaut contact@requeteapp.com) et `ALERTE_MAIL_DE`
(l’expéditeur, une fois un domaine vérifié chez Resend, par exemple `Requête <retours@requeteapp.com>` ; alors `ALERTE_MAIL_A`
peut être n’importe quelle adresse).

Pour essayer : envoyer un message depuis l’appli (Mon compte › Contacte-nous). L’e-mail arrive dans la minute (regarder aussi
les indésirables la première fois). Sans la clé, la fonction répond « veille » et rien n’est perdu : ce qui a moins de 2 jours
part dès que la clé est là. Garde-fous : 40 e-mails par jour au plus, regroupés à partir du 10e (un toutes les 10 minutes) ;
un envoi raté est réessayé chaque heure, 5 fois au plus. Ce qui ne part pas reste lisible dans Supabase (vues `contact_boite`
et `avis_commentaires`). Vérification de la base : `supabase/tests/alerte_mail.sql` (tout est annulé à la fin).

### « Une méthode fondée sur la recherche » dans l’onboarding (13 novembre, 0 h 07)

La scène de la vidéo « Le métier de data analyst » qui parle de la recherche sur l’apprentissage (`decouvrir/video.html`,
scène `sme`) est devenue une page de l’onboarding, `methode`, entre « On construit ton parcours » et « Ils apprécient
Requête » : trois cartes (pratiquer, se tester, réviser au bon moment, avec les jours de révision de l’appli), puis « 1,5 × »,
qui ouvre les trois études. Le parcours compte une étape de plus (14). La vidéo du site n’a pas changé.

L’entonnoir de l’onboarding (la vue `public.onboarding_entonnoir`, tableau de bord) la montre au rang 11, entre « Parcours
construit » et « Ils apprécient Requête » : 19 étapes. Migration `supabase/migrations/20261113001301_onboarding_entonnoir_methode.sql`,
appliquée le 13 novembre à 1 h 13 avec l’accord d’Elisa.

Il continue après l’accueil (1 h 18) : « 1re leçon commencée » (« Commencer » touché), « 1re leçon terminée », « 2e leçon
terminée », puis les demandes de note. 24 lignes ; ces étapes ne partent que si les statistiques anonymes sont activées.
Migration `20261113002420_onboarding_entonnoir_premieres_lecons.sql`, appliquée le 13 novembre à 1 h 24. Sur l’écran de fin
de leçon, une ligne « Leçon débloquée » montre le cadenas qui s’ouvre et mène à la leçon suivante.

### La note de l’app, puis la page du widget (13 novembre, 1 h 02)

Après la **deuxième** leçon validée (1 h 38 ; la première finit déjà sur la page du sticker du module 1), de retour à l’accueil,
l’app demande à iOS sa fenêtre aux cinq étoiles (le pont
`RequeteWidget.noter`, StoreKit : `AppStore.requestReview(in:)`, `SKStoreReviewController` avant iOS 16). Une seule demande
(`requete-note-demandee`), 2,6 s après le retour, une fois la leçon suivante ouverte sur le chemin. C’est iOS qui décide de
l’afficher : trois fois par an au plus pour une même personne, **jamais dans une version TestFlight** (elle apparaît lancée
depuis Xcode, et dans la version de l’App Store). La ligne « Noter Requête » de Mon compte ouvre toujours la page d’avis.

Une **deuxième demande** (1 h 18), et pas plus : 7 jours au moins après la première, à un moment fort (un module d’au moins
5 leçons terminé, ou 7 jours de série). iOS ne dit ni si la fenêtre est apparue ni si une note a été donnée : rien de tel dans
Supabase. L’entonnoir compte seulement les demandes (« Note demandée à iOS », 1re et 2e fois) ; les notes elles-mêmes se
lisent dans App Store Connect.

Après la **troisième** leçon, la page du widget (« Je t’encouragerai directement depuis ton écran d’accueil ! »), 2 s après le
retour à l’accueil ; elle venait après la première. Jamais les deux au même retour.

### Les raccourcis de l’icône (4 novembre, 9 h 02)

L’appui long sur l’icône de l’app propose, comme Duolingo : **« 😱 Tu supprimes Requête ? — On te retrouvera. »** (ouvre
l’accueil, où le chat dit dans sa bulle « Je t’avais dit que j’allais te retrouver ! ») et **« ⭐ Fais une petite requête ! —
Quelques minutes suffisent. »** (ouvre l’onglet Défis). Pendant l’onboarding, un bandeau le dit (« Termine ton parcours de
bienvenue : les défis t’attendent juste après ! ») ; en pleine leçon, une bulle. La page les pose au démarrage (index.html, `RACCOURCIS`, pont `RequeteWidget.raccourcis`) : ils apparaissent après
le premier lancement de la nouvelle version. Le raccourci choisi arrive au délégué de scène, puis à la page (événement
`raccourci`, gardé jusqu’à ce qu’elle l’écoute, même si l’app était fermée).

Le délégué de scène : celui du modèle de Capacitor 8.6 (`ios/App/App/SceneDelegate.swift`) crée lui-même un
`CAPBridgeViewController`, sans passer par `Main.storyboard` — le pont du widget n’y était donc jamais enregistré.
`scripts/ios-widget.mjs` le remplace par `resources/ios/widget/App/SceneDelegate.swift` (qui crée `RequeteViewController` et
reçoit les raccourcis) et garde l’original dans `SceneDelegate.swift.avant-requete`. Un délégué modifié à la main n’est pas
touché (un avertissement le dit) : y remplacer `CAPBridgeViewController()` par `RequeteViewController()` et y ajouter
`windowScene(_:performActionFor:completionHandler:)` comme dans le nôtre.

### Sous le clavier (4 novembre, 11 h 08)

Avec le clavier, la page rétrécit au-dessus de lui (Keyboard `resize: native`) : ses coins arrondis laissaient voir la fenêtre
de l’app, noire. La fenêtre prend maintenant le fond de l’app au lancement (`SceneDelegate.swift`), puis la couleur du bas de
la page avant chaque ouverture du clavier (index.html, `fondSousClavier`, pont `RequeteWidget.fond`) : le violet de
l’onboarding, sinon le fond de ce qui est en bas de l’écran.

**La vue ne défile pas** (12 novembre, 12 h 24 : « regarde comment la page part en haut ») : `ios.scrollEnabled` est à `false`
dans `capacitor.config.json`, et l’appli appelle `Keyboard.setScroll({isDisabled: true})` au lancement : à l’appui sur un champ,
iOS ne fait plus monter toute l’appli sous l’heure. Ce qui défile dans la page (écrans, feuilles, onboarding) défile comme avant.

## Réglages à vérifier avant l’envoi

1. **Identifiant de l’app** : `appId` dans `capacitor.config.json` (`fr.requete.app` par défaut).
   Il doit correspondre à celui créé sur App Store Connect et ne changera plus ensuite.
2. **Info.plist** (`ios/App/App/Info.plist`, réglé le 3 novembre sur le Mac d’Elisa) : « Portrait » seulement sur iPhone,
   l’appli en français (`CFBundleDevelopmentRegion` = `fr`, `CFBundleLocalizations` = `fr`, pour que les menus d’iOS dans
   l’appli soient en français) et `ITSAppUsesNonExemptEncryption` = `NO` (pas de question sur le chiffrement à chaque envoi).
3. **Icône et lancement** : `resources/icon-only.png` (1024 × 1024, sans transparence) et `resources/splash.png`
   (2732 × 2732, l’image de référence). Remplace-les si le logo change, puis relance `npm run ios:assets`.
   **Écran de lancement** (3 novembre, 23 h 02 : « quand j’ouvre l’appli, il y a un écran noir ») : `resources/ios/LaunchScreen.storyboard`
   (fond `#F4F2FC` fixe, même en mode sombre), recopié dans `ios/` par `scripts/ios-ecran-lancement.sh` à chaque `npm run ios`,
   `ios:add` ou `ios:testflight`. L’ancien écran étirait `splash.png` entière sur un fond « couleur système » : trop lourde, iOS
   ne la dessinait pas et laissait le fond, noir en mode sombre. Depuis le 11 novembre (« Le logo se construit »), il n’a plus
   d’image du tout : 23 petits carrés `#D2C6F7`, de simples vues placées en fractions de l’écran, écrits par
   `python3 tools/ecran-lancement.py` à partir de `POINTS` (index.html, script qui suit `#loader`). Si les points changent,
   relancer ce script. iOS garde l’écran de lancement en mémoire : si l’ancien revient après une mise à jour, redémarrer l’iPhone.
   **Ouverture animée** (3 novembre ; refaite le 11 novembre, 13 h 10 : « Le logo se construit ») : la première image de l’appli
   reprend ces points au pixel près (ludique.css, 37 bis). Seize d’entre eux s’envolent, grandissent en cases chiffrées et se
   posent en diagonale dans la touche >_ ; les cases se soudent, la touche tombe sur son socle, le chevron puis le curseur
   s’écrivent ; les sept autres points deviennent les lettres de « Requête » ; on appuie sur la touche et on y plonge. À chaque
   ouverture (3,2 s), le chat saute sur la touche, y marche, s’assoit et tape deux fois de ses pattes : la seconde, c’est la
   touche Entrée (11 novembre, 14 h 36 : « le chat qui marche dessus » ; ses deux GIF sur fond vert, détourés en bandes de 12
   images par `python3 tools/chat-ouverture.py marche.gif appui.gif`). Plus de version courte pour les ouvertures suivantes du
   jour (17 h 56 : « je préfère la longue »).
   **Départ rapide** (12 novembre : « Le départ est trop long ça reste trop longtemps sur ça ») : l’ouverture n’attend plus la fin
   du démarrage. Dès que l’état est lu et que le chat et son son sont prêts, `boot` la lance à sa première porte (`bootPorte`,
   qui appelle `__introPorte`), attend la fin de la construction (cases, soudure, lettres), puis reprend pendant la marche du
   chat, sans lancer d’étape à moins de 130 ms d’un retour haptique. Pendant ce temps, tout ce qui bouge doit rester en
   transform et opacité, sans `steps()` (WebKit ne les joue jamais dans le compositeur) : les images du chat défilent en paliers.
   La sortie (classe `is-sortie`) attend l’appli prête ; sinon la touche, qui remplit l’écran, reste. Mesuré dans Chromium : de
   l’écran de lancement à l’animation, 0,4 s au lieu de 0,8 s (1,4 s au lieu de 3,1 s sur un processeur quatre fois plus lent).
   **Son et haptique** (4 novembre, 1 h 51 ; 11 novembre) : un son calé sur l’animation (`assets/sons/ouverture.m4a`, fabriqué par
   `python3 tools/sons/ouverture.py` : envol, un « tic » par case posée, le toc de la touche entière, une clochette par lettre,
   l’appui, le souffle de la plongée, un accord d’arrivée), joué par Web Audio en session « ambient » : il se mêle à la musique
   en cours et se tait en mode silencieux. Et une haptique (extension Haptics) : un cran par case posée et par lettre, un coup
   fort quand la touche est entière, un coup moyen à l’appui. Si l’animation change, il faut changer ces instants aussi. L’écran natif reste
   jusqu’à ce que la page se soit dessinée (au plus 4 s, `launchShowDuration`). Avec « Réduire les animations » (iOS), un
   simple fondu.

## Points App Store

- **Les prix affichés** (13 novembre, 2 h 20 ; Elisa, sa capture TestFlight : « $19.99, 0,38 $US et 20 $US se mélangent ») : le
  texte tout fait de la boutique (`priceString`) suit les réglages de l’iPhone (« $19.99 » sur l’un, « 19,99 $US » sur
  l’autre). Tous les montants du paywall et de l’offre de bienvenue s’écrivent donc de la même main : le prix et la devise
  que donne l’App Store pour le pays de la personne (`price`, `currencyCode`), écrits par `obDevise` (index.html). Le
  11 novembre déjà, en TestFlight, la boutique renvoyait des dollars alors que la feuille de paiement d’Apple affichait
  44,99 € : le paywall montre la devise que la boutique lui donne.
- **Les prix par pays** (13 novembre, 2 h 41 ; Elisa : « pour chaque pays on a les bons prix sur le paywall ? ») : le prix et la
  devise viennent de l’App Store du pays du compte Apple (RevenueCat, `achat.js`, `prix()`). Les prix se règlent dans App Store
  Connect, abonnement par abonnement (« Prix de l’abonnement ») : à partir du prix de base (la France), Apple propose un prix
  comparable pour chaque pays, modifiable pays par pays ; l’essai de 3 jours et l’offre de bienvenue (offres de lancement) se
  règlent aussi par pays. Dans l’app, les prix en euros écrits dans `index.html` (`OB_OFFRES`) ne servent plus qu’au site et à la
  mise au point : tant que la boutique n’a pas répondu, le paywall affiche « On récupère les offres… », puis se repeint ; sans
  réponse (12 s, hors ligne), « Les offres ne se chargent pas » et « Réessayer ». Avant, la garde ouvrait le paywall au
  lancement avec « 44,99 € » pour tout le monde, sans jamais le corriger.
- **Après une connexion, l’accueil** (13 novembre, 2 h 41 : « quand on se connecte sur l’appli on va toujours pas sur
  l’accueil ») : reconnexion après une déconnexion, connexion derrière le paywall, « J’ai déjà un compte » sur un iPhone neuf
  (c’était Mon compte). La nouvelle inscrite garde ce que promet « Commencer la première leçon ».
- **Sans compte connecté, pas d’appli** (13 novembre, 3 h 22 ; Elisa : « je suis déconnectée mais j’ai quand même accès à Mon
  compte, et quand je fais retour alors que je suis déconnectée j’y suis aussi ») : la garde du compte (index.html,
  `obCompteBloque`, `obCompteGardeVoir`). Une fois l’onboarding fait, dans l’appli où la connexion est branchée
  (`REQUETE_AUTH`), sans compte connecté, la page de connexion reste devant l’appli, sans « Retour » : au lancement, après une
  déconnexion, au retour au premier plan, et dès qu’une session est perdue (compte supprimé ailleurs). Elle passe avant le
  paywall : on se connecte, puis l’abonnement est vérifié. Une invitation à une salle attend derrière elle. Sans connexion
  branchée (la mise au point dans un navigateur), rien ne change.
- **Le prix sur la feuille d’Apple** (13 novembre, 3 h 22 ; Elisa, sa capture : « Requête Premium annuel bienvenue, 44,99 € par
  an », « je pense qu’on est sur le mauvais prix ») : 44,99 € est le prix normal du produit « bienvenue » ; son −50 % est une
  offre de lancement, et Apple n’en accorde qu’une par personne et par groupe d’abonnements (l’essai de 3 jours en est une).
  Un compte Apple qui a déjà pris l’essai voit donc le prix normal, et la liste « Abonnements disponibles » d’Apple montre
  toujours tous les produits du groupe à leur prix normal. Dans l’appli, la page de l’offre de bienvenue ne s’affiche que si
  la boutique dit que la personne y a droit (`sortieDispo`, achat.js). À vérifier dans App Store Connect (pas pu le lire le
  13 novembre, session fermée) : Abonnements › « annuel bienvenue » › Prix de l’abonnement › offre de lancement, la liste des
  pays et le prix de la France.

- **Confidentialité (App Store Connect)** : l’app ne collecte rien sans compte.
  Seule la *Salle de défi* en mode « Entre amis » envoie un pseudo, des temps, un signe de vie et des réactions,
  via la base Supabase de l’appli (projet « requete-sql », à Paris ; effacés au bout de 24 h).
  Le mode « Seul » reste entièrement sur l’appareil (aucun réseau).
  Déclare-les comme « Contenu utilisateur – Autre », non liés à l’identité et sans pistage.
  Formule gratuite de Supabase : le projet se met en pause après 7 jours sans aucune partie ; il se relance
  depuis le tableau de bord Supabase (ou passer à la formule Pro pour une vraie mise en production).
- **Classement général (tous les joueurs, 5 par page depuis le 4 novembre)** : pseudo, points, nombre de parties et un identifiant tiré
  au hasard par l’appareil (la base n’en garde que l’empreinte), plus la liste des défis réussis (statistiques
  internes, jamais montrées aux joueurs). Dans App Store Connect, déclarer :
  « Contenu de jeu » et « Autre contenu utilisateur » (le pseudo), « Identifiant utilisateur » (l’identifiant
  au hasard) ; usages « Fonctionnalités de l’app » et « Analyses » (les défis trouvés) ; non utilisés pour le pistage.
- **Défis en trois onglets** (4 novembre, 19 h 10 ; appliquée le 4 novembre à 22 h 52 : `supabase/migrations/20261104215200_defis_trois_onglets.sql`) :
  le pays du profil part avec le pseudo (colonne `jeu_pseudo.pays`, fonction `jeu_pays`) pour le drapeau à côté du pseudo ;
  il se masque dans Mon compte (« Afficher mon drapeau »). Les salles publiques (le choix par défaut) apparaissent
  dans « Rejoins une partie », la liste des salles ouvertes (`jeu_salles_ouvertes`, `jeu_salle_publier`), avec le pseudo et le
  drapeau de leurs joueurs (5 novembre, 11 h 37 : plus de « Trouver une salle » ; 12 h 52 : « Rejoins une partie » et le seul « Créer une salle » dans un même cadre).
  Le classement passe à `jeu_classement_v2` (5 par page ; monde, pays ou amis ; depuis toujours ou depuis lundi).
  La liste d’amis reste sur l’appareil (`jeu_drapeaux` vérifie seulement qu’un pseudo existe). Dans App Store Connect,
  ajouter « Localisation approximative » (le pays), usage « Fonctionnalités de l’app », non liée à l’identité, sans pistage.
- **Invitation à une salle** (5 novembre, 14 h) : « Partager l’invitation » ouvre la feuille de partage d’iOS (`navigator.share`,
  pris en charge par la vue web de l’app) avec « Rejoins-moi… », le code et le lien public
  `https://requeteapp.com/?partie=CODE&de=pseudo`. Ce lien ouvre Safari, pas l’app installée : pour qu’il
  ouvre l’app, il faudra des liens universels (le fichier `apple-app-site-association` à la racine du domaine et la
  capacité « Associated Domains » de l’App ID). Depuis le 13 novembre (l’appli ne s’ouvre plus dans un navigateur), ce
  lien mène à la section iPhone du site, qui redit le code : « Tu es invité·e à un défi. Installe Requête, puis entre le
  code … dans Pratiquer › Défis › “Rejoindre avec un code” ».
- **Pseudo unique** : choisi sur une mini-page juste après l’onboarding (le prénom de l’onboarding reste sur l’appareil),
  réservé dans la table `jeu_pseudo` (même identifiant au hasard que le classement), il ne se change plus et n’est jamais
  libéré tout seul (pas de ménage) : seul « Supprimer mon compte » le libère, avec les scores. Pour libérer un pseudo sur
  demande : `delete from jeu_pseudo where pseudo = '…'` dans l’éditeur SQL de Supabase.
- **Statistiques des défis** (savoir quand en ajouter) : dans le tableau de bord Supabase, Table Editor, les vues
  `stats_defis_resume` (en une ligne : joueurs, moyenne, combien ont tout fini, par niveau), `stats_defis_joueurs`
  (un joueur par ligne) et `stats_defis_par_defi` (combien de joueurs ont réussi chaque défi). Rien n’est lisible
  depuis l’appli. Depuis le 6 novembre, le serveur note aussi les défis **joués** (`requete_private.defi_joue`, pour
  chaque joueur du classement) : `stats_defis_joues` (un joueur par ligne : joués, trouvés, faits sur le total et
  restants par niveau) et `stats_defis_restants` (une ligne par niveau : ce qu’il reste au joueur le plus avancé,
  combien de joueurs en ont moins de 10). À chaque manche, le serveur tire un défi qu’aucun joueur présent n’a joué
  ni trouvé (`requete_private.defi_tirer`).
- **Ajouter des défis** : les écrire dans index.html (CHALLENGES, DEFI_BASES), monter `JEU_CAT` (la version du
  catalogue que l’appli connaît), lancer `node scripts/build-secure-catalog.cjs`, pousser ; mettre ce commit dans les
  deux imports de `supabase/functions/jeu-verifier/index.ts`, redéployer jeu-verifier (seuls index.ts et deno.json
  partent), puis ajouter les nouveaux identifiants à `requete_private.catalogue` avec `depuis` = la nouvelle version
  (exemple : `supabase/migrations/20261106152605_defis_sept_bases.sql`). Le serveur ne tire un défi que si tous les
  téléphones de la salle le connaissent.
- **Règle 1.2 (contenu créé par les utilisateurs)** : les pseudos sont filtrés (appli et serveur, jeu_pseudo_ok),
  chaque ligne du classement a « Signaler » (le joueur est aussitôt masqué pour soi ; 3 signalements le masquent
  pour tous), « Contacte-nous » dans l’app (l’adresse du site reste à remplir : `CONTACT_EMAIL` dans decouvrir/index.html). À surveiller : la vue `jeu_moderation` dans l’éditeur SQL de
  Supabase liste les pseudos signalés (Apple demande d’agir vite, sous 24 h) ; `update jeu_joueur set masque = true
  where id = '…'` masque un joueur.
- **Contacte-nous** (avant « Nous contacter ») (Mon compte, à la place de l’ancienne aide) : le sujet (bug, idée, question, autre), le message,
  l’e-mail s’il est donné et, pour un bug, des infos techniques décochables (version, appareil, navigateur, mode, écran,
  langue) partent dans la table `contact_message` (fonction `contact_envoyer`, 3 messages en 10 min et 20 par jour par
  appareil ; effacés au bout de 3 ans). **Pour lire les messages** : tableau de bord Supabase, Table Editor, vue
  `contact_boite` (le plus récent en haut) ; cocher `lu` dans `contact_message` une fois traité. Dans App Store Connect,
  déclarer « Adresse e-mail » (facultative), « Autre contenu utilisateur » (le message et les fichiers joints),
  « Photos ou vidéos » (les captures jointes) et « Autres données de
  diagnostic » (les infos techniques) ; usage « Assistance client » (et « Fonctionnalités de l’app » pour les bugs) ;
  non liés à l’identité, sans pistage. Cela répond aussi à l’exigence d’un moyen de contact dans l’app.
  **Pièces jointes** (1er novembre) : jusqu’à 3 par message, 5 Mo chacune, dans l’espace de stockage privé
  `contact-pieces` (l’appli peut y déposer, jamais y lire). Leurs chemins sont dans la colonne `pieces` de
  `contact_boite` : Storage › contact-pieces, puis le dossier du même nom, pour les ouvrir. Le ménage des 3 ans
  n’efface que les messages : supprimer à la main les fichiers des messages traités (et les dossiers sans message,
  si un envoi a échoué après le dépôt).
- **Vote « Quel parcours après SQL ? »** (page d’un parcours à venir, 3 novembre) : le parcours choisi, sa date et l’empreinte
  de l’identifiant tiré au hasard par l’appareil partent dans la table `parcours_vote` (fonction `parcours_voter`, un vote
  par appareil, revoter le remplace). Appliquée le 4 novembre : `supabase/migrations/20261104160653_parcours_vote.sql`.
  **Résultats** : vue `parcours_votes`. Le badge « En tête » de la page d’un parcours lit `parcours_en_tete` (le seul
  parcours en tête, sans chiffres, à partir de 10 votes et sans égalité ; appliquée le 11 novembre :
  `supabase/migrations/20261111143000_parcours_en_tete.sql`). Dans App Store Connect, déclarer « Identifiant
  utilisateur » (l’identifiant au hasard) et « Autres données d’usage » (le vote) ; usage « Analyses » ; non liés à
  l’identité, sans pistage. L’alerte « M’avertir au lancement » reste sur l’appareil.
- **Avis sur les leçons** (« Donne ton avis sur la leçon », fin de leçon, 4 novembre) : la note (1 à 5 étoiles), le
  commentaire facultatif (500 signes), le numéro et le titre de la leçon, la date et l’empreinte de l’identifiant au hasard
  partent dans la table `avis_lecon` (fonction `lecon_noter`, un avis par appareil et par leçon, le changer le remplace).
  Appliquée le 4 novembre : `supabase/migrations/20261104160655_avis_lecon.sql`. **Résultats** : vues `avis_lecons` (les
  leçons les moins bien notées d’abord) et `avis_commentaires`. Dans App Store Connect, déclarer « Interactions avec le
  produit » (la note) et « Autre contenu utilisateur » (le commentaire) ; usage « Fonctionnalités de l’app » ; non liés à
  l’identité, sans pistage.
- **Étapes de l’onboarding** (4 novembre) : chaque écran de l’accueil vu une première fois (son nom et la date, ni prénom ni
  réponse), avec l’empreinte de l’identifiant au hasard, part dans la table `onboarding_etape` (fonction
  `onboarding_compter`). Appliquée le 4 novembre : `supabase/migrations/20261104160656_onboarding_entonnoir.sql`.
  **Résultats** : vue `onboarding_entonnoir` (combien d’appareils ont vu chaque écran, et la part de l’accueil), redéfinie
  sans la page « 24 jours » le 4 novembre à 18 h 30 : `supabase/migrations/20261104173026_onboarding_entonnoir_sans_promesse.sql`. Dans App
  Store Connect, déclarer « Interactions avec le produit » ; usage « Analyses » ; non lié à l’identité, sans pistage.
- **Supprimer mon compte** (4 novembre, 22 h 08 ; règle 5.1.1 v) : Mon compte › Compte et assistance › « Supprimer mon compte »,
  deux confirmations, puis `compte_supprimer` (appliquée le 4 novembre à 23 h 49 : `supabase/migrations/20261104224931_compte_supprimer.sql`) efface tout ce que le
  serveur garde pour l’appareil (pseudo et pays, classement et parties, vote, avis, écrans de l’accueil vus, messages de
  « Contacte-nous », places dans les salles) et, avec un compte connecté, le compte (ses tables privées suivent par cascade, l’identifiant
  de l’appareil est révoqué) ; puis l’appareil est vidé et l’appli repart de zéro. Si la fonction manquait (ancien serveur), l’appli
  se rabattrait sur `jeu_pseudo_liberer` (pseudo et scores). Les pièces jointes de « Contacte-nous » restent à effacer à la main
  (Storage) : la politique de confidentialité promet « dans le mois ». Celles qui n’ont plus de message (compte supprimé, ou envoi
  raté) : `select name from storage.objects o where bucket_id = 'contact-pieces' and not exists (select 1 from public.contact_message m
  where o.name = any(m.pieces));` dans l’éditeur SQL, puis les supprimer dans Storage › contact-pieces.
  **Avec la connexion Apple** (quand elle sera branchée) : Apple demande aussi de révoquer le jeton « Se connecter avec Apple » à la
  suppression (appel serveur à `appleid.apple.com/auth/revoke`, avec la clé du compte développeur).
- **Effacement** : « Effacer la progression » retire aussi la place au classement (`jeu_oublier`).
- **Télécharger mes données** : Mon compte › Tes données, tes choix › « Télécharger mes données » (un fichier
  `requete-mes-donnees-AAAA-MM-JJ.json`, une copie de la progression, des notes et du planning). Dans l’app, la feuille de partage
  d’iOS (pont `RequeteWidget.partager`) ; le message ne vient qu’une fois le fichier parti. « Restaurer une sauvegarde » est
  retirée depuis le 12 novembre : une progression faite sur le site ne se reprend plus dans l’app (la progression de l’app suit le
  compte).
- **Noter Requête** (Mon compte, dans l’app seulement) : ouvre la page « Écrire un avis » de la fiche App Store
  (`itms-apps://itunes.apple.com/app/id6830361256?action=write-review`, pont `RequeteWidget.ouvrir`) ; l’avis paraît sur la fiche.
  Elle ne marche qu’une fois l’appli publiée.
- **Se déconnecter** : dans Mon compte, seulement avec un compte connecté (rien tant que la connexion n’est pas branchée).
- **Connexion pas encore branchée** (4 novembre, 22 h 50, « Oui, masque-la » ; règle 2.1) : dans l’app, la page qui suit la première
  requête garde son bravo et ses confettis, sans les boutons « Bientôt » ni la promesse de sauvegarde ; sans première requête réussie,
  elle est sautée. Le site garde la page entière. Les boutons reviennent d’eux-mêmes quand un fournisseur est branché (`REQUETE_AUTH`).
- **iPhone seulement** (4 novembre, 22 h 50) : `scripts/ios-widget.mjs` passe toutes les cibles du projet Xcode à
  `TARGETED_DEVICE_FAMILY = 1`, à chaque envoi. Sur iPad, l’app tourne en mode iPhone ; App Store Connect ne demande pas de captures
  d’iPad. À faire avant la première publication : une fois une version publiée pour l’iPad, Apple n’accepte plus de la retirer.
- **Pièces jointes de « Contacte-nous »** : `scripts/ios-widget.mjs` ajoute `NSCameraUsageDescription` et
  `NSPhotoLibraryUsageDescription` à l’Info.plist (sans elles, « Prendre une photo » fermerait l’app).
- **Politique de confidentialité** : Apple demande une URL publique (decouvrir/confidentialite.html). Dans l’app,
  Compte › Données et confidentialité › « Comprendre mes données » la résume.
- **Suppression des données** : « Effacer la progression » et « Supprimer mon compte » sont dans Mon compte.
- **Rappel quotidien** : dans l’app, il devient une notification locale programmée chaque jour
  (plugin `@capacitor/local-notifications`, déjà branché). iOS demande l’autorisation à l’activation.
- **Hors ligne** : tout le contenu est embarqué. Seul le mode Jouer a besoin d’internet.

## La connexion (Apple et Google)

Branchée le 12 novembre (Elisa, 1 h 04 : « il faut brancher la connexion », avant la sortie, avec Apple et Google ; Apple l’exige
dès qu’on propose Google, règle 4.8). `connexion.js` définit `REQUETE_AUTH` : le plugin `@capgo/capacitor-social-login` ouvre la
feuille d’Apple ou de Google, Supabase échange le jeton d’identité contre une session (gardée sur l’iPhone, renouvelée).
`compte-moteurs.js` (produit depuis `account/*.mjs` par `npm run build:www`) synchronise leçons, défis, entretien, jours
d’activité, planning et notes avec les fonctions `progression_*` et `documents_*` (`csSync` dans index.html).

**Allumée le 12 novembre** (`ACTIVE = true` dans `connexion.js`) : Apple (Sign In with Apple sur fr.requete.app, clé « Requete
Sign in with Apple », Key ID GTYQ8X2RCP, équipe RN77C85JG4), Google (projet Google Cloud « Requete », requete-514506, écran de
consentement « Requête » publié en production, clients « Requete iOS » et « Requete Web (Supabase) ») et Supabase (Apple et Google
activés) sont réglés. Remettre `ACTIVE = false` cache de nouveau la page de connexion. Les réglages, pour mémoire :

1. **Apple** (developer.apple.com › Certificates, Identifiers & Profiles › Identifiers › fr.requete.app) : cocher
   « Sign In with Apple », Save. Le droit `com.apple.developer.applesignin` est déjà dans `App.entitlements`.
2. **Supabase** (Authentication › Sign In / Providers › Apple) : activer, « Client IDs » : `fr.requete.app`. Pas de clé
   secrète : elle ne sert qu’à la connexion par le web (et Apple impose de la refaire tous les 6 mois).
3. **Google** (console.cloud.google.com › Google Auth Platform) : Branding (nom « Requête », e-mail de contact), Audience
   « External », puis deux clients : **iOS** (Bundle ID `fr.requete.app`) et **Web application**.
4. **Supabase** (Providers › Google) : activer ; « Client IDs » : l’identifiant Web, une virgule, l’identifiant iOS ; le
   secret du client Web ; cocher « Skip nonce check » (le SDK Google d’iOS ne transmet pas le nonce).
5. Dans `connexion.js` : `GOOGLE_IOS` et `GOOGLE_WEB` (les identifiants complets, `…apps.googleusercontent.com`), puis
   `ACTIVE = true`. `ios-widget.mjs` ajoute le schéma d’URL de Google à Info.plist au prochain `npm run ios`.
6. **Avant d’envoyer à Apple** : App Store Connect › App Privacy (adresse e-mail, identifiant et nom (le prénom, gardé avec le
   compte depuis le 12 novembre), liés à la personne, pour le fonctionnement de l’app), la page de confidentialité du site (compte, progression synchronisée, suppression), et un compte
   de démonstration pour l’App Review (règle 2.1) si la connexion est demandée quelque part.

**Le compte est le seul chemin** une fois la connexion branchée (10 novembre, 10 h 29 ; redit le 12 novembre, 13 h 44 : « Pas de
sans compte stp ») : pas de « Continuer sans compte ». Pour l’App Review (règle 5.1.1(v)), la note doit expliquer pourquoi la
connexion est demandée (la progression et le planning synchronisés entre appareils) ; Apple peut se connecter avec son propre
identifiant Apple.

Supprimer son compte (Mon compte) efface aussi le compte Supabase et sa progression synchronisée (`compte_supprimer` avec le
jeton). « Effacer toute ta progression » efface aussi celle du compte, avant l’appareil.

**La révocation d’Apple** (règle 5.1.1(v) : « use the Sign in with Apple REST API to revoke user tokens ») : à la connexion avec
Apple, le code d’autorisation part à la fonction `apple-jeton`, qui l’échange chez Apple et garde le jeton de renouvellement
(`requete_private.apple_jeton`, serveur seulement) ; à la suppression du compte, elle le révoque avant `compte_supprimer`.
Il lui faut une clé (developer.apple.com › Keys › « + », cocher **Sign in with Apple** › Configure : identifiant principal
fr.requete.app ; télécharger le .p8, une seule fois) et trois secrets dans Supabase (Edge Functions › Secrets) :
`APPLE_SIWA_KEY` (le contenu du .p8, lignes BEGIN et END comprises), `APPLE_SIWA_KEY_ID` (10 caractères), `APPLE_TEAM_ID`.
Sans eux, la fonction répond « veille » : la connexion et la suppression marchent, sans la révocation.
