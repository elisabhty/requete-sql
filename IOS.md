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

### Le widget de la série (4 novembre)

`scripts/ios-widget.mjs` (lancé par `npm run ios`, `ios:add` et `ios:testflight`, après `cap sync`) recopie
`resources/ios/widget` dans `ios/App` et, la première fois, ajoute au projet Xcode la cible **RequeteWidgetExtension**
(WidgetKit, identifiant `fr.requete.app.widget`), le groupe d’apps **`group.fr.requete.app`** (droits de l’app et du widget),
le pont `RequeteWidgetPlugin` (enregistré par `RequeteViewController`, que crée le délégué de scène — voir plus bas) et un manifeste de
confidentialité par cible (`PrivacyInfo.xcprivacy`). L’ancien projet est gardé à côté : `project.pbxproj.avant-widget`.
L’app y range la série (index.html, `widgetMaj`) chaque fois qu’elle passe en arrière-plan ; le widget la relit à minuit.

Si l’archive refuse la signature du groupe d’apps : dans Xcode, cible App puis cible RequeteWidgetExtension › Signing &
Capabilities, vérifier l’équipe, et cocher `group.fr.requete.app` sous App Groups (Xcode l’enregistre), puis relancer.

### Les raccourcis de l’icône (4 novembre, 9 h 02)

L’appui long sur l’icône de l’app propose, comme Duolingo : **« 😱 Tu supprimes Requête ? — Le chat te retrouvera. »** (ouvre
l’accueil, où le chat salue) et **« ⭐ Fais une petite requête ! — Quelques minutes suffisent. »** (ouvre la séance que propose
l’accueil). La page les pose au démarrage (index.html, `RACCOURCIS`, pont `RequeteWidget.raccourcis`) : ils apparaissent après
le premier lancement de la nouvelle version. Le raccourci choisi arrive au délégué de scène, puis à la page (événement
`raccourci`, gardé jusqu’à ce qu’elle l’écoute, même si l’app était fermée).

Le délégué de scène : celui du modèle de Capacitor 8.6 (`ios/App/App/SceneDelegate.swift`) crée lui-même un
`CAPBridgeViewController`, sans passer par `Main.storyboard` — le pont du widget n’y était donc jamais enregistré.
`scripts/ios-widget.mjs` le remplace par `resources/ios/widget/App/SceneDelegate.swift` (qui crée `RequeteViewController` et
reçoit les raccourcis) et garde l’original dans `SceneDelegate.swift.avant-requete`. Un délégué modifié à la main n’est pas
touché (un avertissement le dit) : y remplacer `CAPBridgeViewController()` par `RequeteViewController()` et y ajouter
`windowScene(_:performActionFor:completionHandler:)` comme dans le nôtre.

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
- **Classement général (Top 5 de tous les joueurs)** : pseudo, points, nombre de parties et un identifiant tiré
  au hasard par l’appareil (la base n’en garde que l’empreinte), plus la liste des défis réussis (statistiques
  internes, jamais montrées aux joueurs). Dans App Store Connect, déclarer :
  « Contenu de jeu » et « Autre contenu utilisateur » (le pseudo), « Identifiant utilisateur » (l’identifiant
  au hasard) ; usages « Fonctionnalités de l’app » et « Analyses » (les défis trouvés) ; non utilisés pour le pistage.
- **Pseudo unique** : choisi sur une mini-page juste après l’onboarding (le prénom de l’onboarding reste sur l’appareil),
  réservé dans la table `jeu_pseudo` (même identifiant au hasard que le classement), il ne se change plus et n’est jamais
  libéré tout seul (pas de ménage) : la personne le supprime dans l’appli (Mon compte › Données et confidentialité ›
  « Supprimer mon pseudo », fonction `jeu_pseudo_liberer`, qui efface aussi ses scores). Pour libérer un pseudo sur
  demande : `delete from jeu_pseudo where pseudo = '…'` dans l’éditeur SQL de Supabase.
- **Statistiques des défis** (savoir quand en ajouter) : dans le tableau de bord Supabase, Table Editor, les vues
  `stats_defis_resume` (en une ligne : joueurs, moyenne, combien ont tout fini, par niveau), `stats_defis_joueurs`
  (un joueur par ligne) et `stats_defis_par_defi` (combien de joueurs ont réussi chaque défi). Rien n’est lisible
  depuis l’appli.
- **Règle 1.2 (contenu créé par les utilisateurs)** : les pseudos sont filtrés (appli et serveur, jeu_pseudo_ok),
  chaque ligne du classement a « Signaler » (le joueur est aussitôt masqué pour soi ; 3 signalements le masquent
  pour tous), l’adresse de contact est sur le site. À surveiller : la vue `jeu_moderation` dans l’éditeur SQL de
  Supabase liste les pseudos signalés (Apple demande d’agir vite, sous 24 h) ; `update jeu_joueur set masque = true
  where id = '…'` masque un joueur.
- **Nous contacter** (Mon compte, à la place de l’ancienne aide) : le sujet (bug, idée, question, autre), le message,
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
  par appareil, revoter le remplace). À appliquer avant l’envoi : `supabase/migrations/20261103181500_parcours_vote.sql`
  (éditeur SQL de Supabase). **Résultats** : vue `parcours_votes`. Dans App Store Connect, déclarer « Identifiant
  utilisateur » (l’identifiant au hasard) et « Autres données d’usage » (le vote) ; usage « Analyses » ; non liés à
  l’identité, sans pistage. L’alerte « Préviens-moi à la sortie » reste sur l’appareil.
- **Effacement** : « Retirer mes scores du classement » et « Effacer la progression » suppriment les données du
  serveur depuis l’appli (pas de compte, donc pas de suppression de compte à prévoir).
- **Passer du site à l’app** : Mon compte › Données › « Exporter ma progression » sur le site, puis « Importer une
  progression » dans l’app : leçons, défis, notes, planning, projets et la place au classement suivent.
- **Politique de confidentialité** : Apple demande une URL publique (decouvrir/confidentialite.html). Dans l’app,
  Compte › Données et confidentialité › « Comprendre mes données » la résume.
- **Suppression des données** : « Effacer la progression » existe déjà dans Compte.
  Si des comptes arrivent un jour, il faudra aussi pouvoir supprimer le compte depuis l’app.
- **Rappel quotidien** : dans l’app, il devient une notification locale programmée chaque jour
  (plugin `@capacitor/local-notifications`, déjà branché). iOS demande l’autorisation à l’activation.
- **Hors ligne** : tout le contenu est embarqué. Seul le mode Jouer a besoin d’internet.
