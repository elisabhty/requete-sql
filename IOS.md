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

## À chaque mise à jour du site

```bash
npm run ios
```

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
- **Ce que range l’app** : jusqu’à vingt questions des leçons faites, celles à revoir d’abord, dans le même ordre toute la
  journée (`widgetPoche`, avec la série, dans `widgetMaj`). Le pont les garde (`maj`) ; une nouvelle série repart de la première
  question, la même laisse le widget où il en est.
- **Les boutons** passent par **App Intents** (`RepondrePoche`, `SuivantePoche`, cachés de Raccourcis) : ils écrivent la réponse
  touchée et la question du moment dans le groupe d’apps, puis iOS redessine le widget. Les widgets n’ont de boutons qu’à partir
  d’**iOS 17** : le widget n’existe qu’à partir de là. Sans leçon faite, il le dit, et un appui ouvre la séance du jour.

### La carte mémo qui se retourne (7 novembre)

Elisa, 7 novembre (« La carte mémo qui se retourne », d’après la planche : « Touche la carte, elle se retourne. Tu dis si tu
savais : elle revient au bon moment. »). Le widget **La carte mémo** (`RequeteCarte`, dans `RequeteWidget.swift`, petit) montre
au recto le mot-clé d’une carte gagnée ; un appui la retourne : son titre, sa première idée, et deux boutons. **Je savais**
l’éloigne (3 jours, puis 7, 21 et 60, comme les révisions de l’app, `INTERVALS`) ; **À revoir** la ramène demain. « Noté ! » dit
quand elle revient ; un appui passe à la suivante. Les cartes du jour d’abord, la plus en retard en premier, puis les nouvelles,
dans l’ordre du parcours. Tout est à jour : le widget dit quand revient la prochaine, et un appui ouvre l’album
(`requete://cartes`, `raccourciOuvrir`). Comme pour la requête de poche, réviser ici n’allume pas la flamme du jour.

- **Ce que range l’app** : les cartes gagnées, avec la série (`widgetCartes`, dans `widgetMaj` ; pont `maj`, clé `cartes`).
- **Le rythme** vit dans le widget (`CartesRangement`, clé `cartesRythme` du groupe d’apps) : l’app ne le lit pas et ne
  l’efface pas en rangeant de nouveau les cartes. Le widget pose une entrée chaque minuit, le jour où une carte revient.
- **Les boutons** passent par App Intents (`RetournerCarte`, `NoterCarte`, `CarteSuivante`, cachés de Raccourcis) : ils n’existent
  qu’à partir d’**iOS 17**, comme le widget.

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

## Réglages à vérifier avant l’envoi

1. **Identifiant de l’app** : `appId` dans `capacitor.config.json` (`fr.requete.app` par défaut).
   Il doit correspondre à celui créé sur App Store Connect et ne changera plus ensuite.
2. **Info.plist** (`ios/App/App/Info.plist`, réglé le 3 novembre sur le Mac d’Elisa) : « Portrait » seulement sur iPhone,
   l’appli en français (`CFBundleDevelopmentRegion` = `fr`, `CFBundleLocalizations` = `fr`, pour que les menus d’iOS dans
   l’appli soient en français) et `ITSAppUsesNonExemptEncryption` = `NO` (pas de question sur le chiffrement à chaque envoi).
3. **Icône et lancement** : `resources/icon-only.png` (1024 × 1024, sans transparence) et `resources/splash.png`
   (2732 × 2732, l’image de référence). Remplace-les si le logo change, puis relance `npm run ios:assets`.
   **Écran de lancement** (3 novembre, 23 h 02 : « quand j’ouvre l’appli, il y a un écran noir ») : `resources/ios/LaunchScreen.storyboard`
   (fond `#F4F2FC` fixe, même en mode sombre) et `resources/ios/SplashLogo.imageset` (la touche >_ seule, 768 × 810 px au
   plus), recopiés dans `ios/` par `scripts/ios-ecran-lancement.sh` à chaque `npm run ios`, `ios:add` ou `ios:testflight`.
   L’ancien écran étirait `splash.png` entière sur un fond « couleur système » : trop lourde, iOS ne la dessinait pas et
   laissait le fond, noir en mode sombre. La touche fait 540/2732 du plus grand côté de l’écran, au centre : c’est la place
   qu’elle avait dans `splash.png`. iOS garde l’écran de lancement en mémoire : si l’ancien revient après une mise à jour,
   redémarrer l’iPhone.
   **Ouverture animée** (3 novembre) : la première image de l’appli reprend cet écran au pixel près (ludique.css, 37 bis :
   touche de 512 de côté, 28 d’épaisseur, coins de 116, fond `#F4F2FC`), puis la touche >_ s’enfonce comme une touche Entrée :
   l’écran devient une table de données (4 novembre, « en mode data ») où une onde partie de la touche fait surgir les cases
   chiffrées, la requête allume ses résultats un à un, et l’on plonge dans la touche pendant que la table file sur les côtés.
   Environ 2 s depuis le 4 novembre, 9 h 28 (« l’arrivée de l’animation au début fait mal aux yeux, trop rapide ») : avant 1,3 s,
   avec des nombres qui défilaient par crans (scintillement) et une plongée en 0,3 s ; le son et l’haptique suivent le même rythme.
   **Son et haptique** (4 novembre, 1 h 51) : un son calé sur l’animation (`assets/sons/ouverture.m4a`, fabriqué par
   `python3 tools/sons/ouverture.py` : toc de la touche, bips de l’onde, clochettes des résultats, souffle de la plongée, accord
   d’arrivée), joué par Web Audio en session « ambient » : il se mêle à la musique en cours et se tait en mode silencieux. Et une
   haptique qui suit l’onde (extension Haptics) : la touche, l’onde qui s’éloigne, les résultats, la plongée. Si l’écran de lancement change, il faut changer ces mesures aussi, sinon on verra un saut. L’écran natif reste
   jusqu’à ce que la page se soit dessinée (au plus 4 s, `launchShowDuration`). Avec « Réduire les animations » (iOS), un
   simple fondu.

## Points App Store

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
  `https://elisabhty.github.io/requete-sql/?partie=CODE&de=pseudo`. Ce lien ouvre Safari, pas l’app installée : pour qu’il
  ouvre l’app, il faudra des liens universels (le fichier `apple-app-site-association` à la racine du domaine, donc un
  domaine à soi ou le dépôt `elisabhty.github.io`, et la capacité « Associated Domains » de l’App ID). Sur le site, qui
  n’est pas encore inscrit s’inscrit d’abord (tout le parcours de bienvenue), puis entre dans la salle ; un inscrit y entre
  directement.
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
  **Résultats** : vue `parcours_votes`. Dans App Store Connect, déclarer « Identifiant
  utilisateur » (l’identifiant au hasard) et « Autres données d’usage » (le vote) ; usage « Analyses » ; non liés à
  l’identité, sans pistage. L’alerte « Préviens-moi à la sortie » reste sur l’appareil.
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
- **Passer du site à l’app** : Mon compte › Données › « Sauvegarder ma progression » sur le site (un fichier
  `requete-sauvegarde-AAAA-MM-JJ.json`), puis « Restaurer une sauvegarde » dans l’app : leçons, défis, notes, planning, projets et
  la place au classement suivent. Dans l’app, la sauvegarde ouvre la feuille de partage d’iOS (pont `RequeteWidget.partager`) ;
  le message « Sauvegardée » ne vient qu’une fois le fichier parti.
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
