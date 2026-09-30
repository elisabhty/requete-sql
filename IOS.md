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
  Seul le mode *Jouer* envoie un pseudo, des temps et des réactions via ntfy.sh, un service tiers.
  Déclare-les comme « Contenu utilisateur – Autre », non liés à l’identité et sans pistage.
  Pour une vraie mise en production, il vaut mieux un service temps réel à ton nom (Supabase, Firebase…).
- **Politique de confidentialité** : Apple demande une URL publique. Le texte existe dans l’app
  (Compte › Données et confidentialité) : publie-le aussi sur une page web.
- **Suppression des données** : « Effacer la progression » existe déjà dans Compte.
  Si des comptes arrivent un jour, il faudra aussi pouvoir supprimer le compte depuis l’app.
- **Rappel quotidien** : dans l’app, il devient une notification locale programmée chaque jour
  (plugin `@capacitor/local-notifications`, déjà branché). iOS demande l’autorisation à l’activation.
- **Hors ligne** : tout le contenu est embarqué. Seul le mode Jouer a besoin d’internet.
