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
  au hasard par l’appareil (la base n’en garde que l’empreinte). Dans App Store Connect, déclarer :
  « Contenu de jeu » et « Autre contenu utilisateur » (le pseudo), « Identifiant utilisateur » (l’identifiant
  au hasard) ; usage « Fonctionnalités de l’app » ; non utilisés pour le pistage.
- **Règle 1.2 (contenu créé par les utilisateurs)** : les pseudos sont filtrés (appli et serveur, jeu_pseudo_ok),
  chaque ligne du classement a « Signaler » (le joueur est aussitôt masqué pour soi ; 3 signalements le masquent
  pour tous), l’adresse de contact est sur le site. À surveiller : la vue `jeu_moderation` dans l’éditeur SQL de
  Supabase liste les pseudos signalés (Apple demande d’agir vite, sous 24 h) ; `update jeu_joueur set masque = true
  where id = '…'` masque un joueur.
- **Effacement** : « Retirer mes scores du classement » et « Effacer la progression » suppriment les données du
  serveur depuis l’appli (pas de compte, donc pas de suppression de compte à prévoir).
- **Passer du site à l’app** : Mon compte › Données › « Exporter ma progression » sur le site, puis « Importer une
  progression » dans l’app : leçons, défis, notes, planning, projets et la place au classement suivent.
- **Politique de confidentialité** : Apple demande une URL publique. Le texte existe dans l’app
  (Compte › Données et confidentialité) : publie-le aussi sur une page web.
- **Suppression des données** : « Effacer la progression » existe déjà dans Compte.
  Si des comptes arrivent un jour, il faudra aussi pouvoir supprimer le compte depuis l’app.
- **Rappel quotidien** : dans l’app, il devient une notification locale programmée chaque jour
  (plugin `@capacitor/local-notifications`, déjà branché). iOS demande l’autorisation à l’activation.
- **Hors ligne** : tout le contenu est embarqué. Seul le mode Jouer a besoin d’internet.
