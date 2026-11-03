# Requête sur l’App Store (Capacitor)

L’app web reste la source unique. Capacitor l’embarque dans une app iOS native.
Les finitions natives sont déjà dans `index.html` : retours haptiques, barre de statut,
écran de lancement, retour par glissement du bord gauche, pas de zoom à deux doigts.
Elles ne s’activent que dans l’app, jamais dans Safari.

## Ce qu’il faut

- Un Mac avec Xcode (dernière version) et Node.js 20 ou plus.
- Un compte Apple Developer (99 €/an) pour publier.

## Première fois

```bash
npm install
npm run ios:add       # crée le dossier ios/ (projet Xcode)
npm run ios:assets    # génère icônes et écran de lancement depuis resources/
npm run ios           # copie l’app web, synchronise et ouvre Xcode
```

Dans Xcode : choisis ton équipe (Signing & Capabilities), puis lance sur un iPhone ou un simulateur.

## À chaque mise à jour du site

```bash
npm run ios
```

## Réglages à vérifier avant l’envoi

1. **Identifiant de l’app** : `appId` dans `capacitor.config.json` (`fr.requete.app` par défaut).
   Il doit correspondre à celui créé sur App Store Connect et ne changera plus ensuite.
2. **Orientation** : dans Xcode, garde seulement « Portrait » pour l’iPhone.
3. **Icône et lancement** : `resources/icon-only.png` (1024 × 1024, sans transparence)
   et `resources/splash.png` (2732 × 2732). Remplace-les si le logo change, puis relance `npm run ios:assets`.

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
