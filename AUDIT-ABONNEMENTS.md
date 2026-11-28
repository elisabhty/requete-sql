# Audit des abonnements iOS (27 et 28 novembre 2026)

Demandé par Elisa le 28 novembre (0 h 25) : « Effectue un audit complet du système d’abonnement iOS de Requête, notamment de
l’intégration RevenueCat et StoreKit », après trois essais gratuits de l’« Annuel » terminés en « Billing error » le 27 novembre,
alors que les achats directs de l’« Annuel bienvenue » passent. Corrections demandées le 28 novembre (8 h 32) : « oui enregistre et
corrige les erreurs ».

Aucune donnée personnelle ici : ni identifiant RevenueCat, ni numéro de transaction (ils restent dans RevenueCat, fiche du client,
« Event Data »).

## En bref

- Aucun bug ni erreur de configuration n’explique les trois échecs. Apple donne pour les trois la même raison, `BILLING_ERROR` :
  il n’a pas pu débiter le moyen de paiement. Les 3 prélèvements ont été tentés pile 72 h après le début de l’essai.
- Réserve : en septembre 2026, un autre développeur a décrit exactement le même schéma (toutes les conversions d’essai en
  `expirationIntent` 2, achats initiaux qui passent, contrats et banque actifs), sans réponse publique d’Apple :
  https://developer.apple.com/forums/thread/847462. Des cartes refusées restent l’explication la plus probable, pas une certitude.
  Le prochain essai « Annuel » non résilié (fin le 28 ou le 29 novembre) tranchera ; s’il échoue aussi, message au support
  développeur d’Apple (App Store Connect › Nous contacter), avec les numéros de transaction.
- Trois anomalies mineures dans le code, sans lien avec les échecs : corrigées (v3160, voir plus bas).

## Ce qui a été vérifié

- Le code : `achat.js`, le paywall et la garde de l’abonnement (`index.html`), le module natif iOS
  (`resources/ios/widget/App/RequeteWidgetPlugin.swift`).
- Le plugin `@revenuecat/purchases-capacitor` 14.1.0 (PurchasesHybridCommon 20.1.0), dans son code source.
- RevenueCat : produits, droit `premium`, offre `default`, réglages de l’app App Store, événements des trois échecs.
- App Store Connect : groupe « Requête Premium » (22566229), les deux annuels, le délai de grâce, les contrats.

## Les 12 points

| # | Point | Résultat |
|---|---|---|
| 1 | Identifiants des produits | ✅ Les mêmes partout : `achat.js` (`PRODUITS`), RevenueCat (3 produits App Store), App Store Connect. `fr.requete.app.annuel`, `fr.requete.app.annuel.bienvenue`, `fr.requete.app.hebdo`. |
| 2 | Annuel et Annuel bienvenue | ✅ Approuvés, 1 an, niveau 1, 175 pays, même prix (44,99 € en zone euro). Annuel : essai gratuit de 3 jours dans les 175 pays. Bienvenue : première année payée d’avance (22,49 € en zone euro). |
| 3 | Essai et passage en payant | ✅ Le prélèvement se fait sur les serveurs d’Apple, sans l’app. L’app ne lit que le droit `premium` actif (`achat.js`, `noterClient`). |
| 4 | Démarrage du SDK, clé | ✅ Clé publique iOS de production (`appl_…`) ; les événements arrivent sur l’app App Store de RevenueCat, en production. Clé d’achat intégré et clé API App Store Connect valides dans RevenueCat. |
| 5 | Offres, paquets, droit | ✅ Offre `default` : `$rc_annual` (annuel), `$rc_weekly` (hebdo), `bienvenue` (paquet personnalisé). Les 8 produits (App Store, Play, Test Store) donnent `premium`. `offreDe` les retrouve. |
| 6 | Identifiants des utilisateurs | ✅ Anonymes seulement, sans `logIn` (voulu). Après une réinstallation ou sur un nouvel iPhone, « Restaurer » est nécessaire (sur Android, l’appli le fait d’elle-même). |
| 7 | StoreKit et RevenueCat | ✅ Pas de conflit : le module natif n’utilise StoreKit que pour `AppStore.showManageSubscriptions` et la demande de note, jamais pour les transactions. |
| 8 | Renouvellements | ✅ Les renouvellements TestFlight de l’Annuel sont bien enregistrés (chaque jour) et l’app reste débloquée. Notifications serveur d’Apple : « configured correctly » dans RevenueCat. |
| 9 | Paiement refusé, relances, délai de grâce | ✅ Délai de grâce actif depuis le 27 novembre : 3 jours, tous les renouvellements, production et sandbox. Le plugin affiche de lui-même le message d’Apple pour régler un paiement (`shouldShowInAppMessagesAutomatically`, vrai par défaut). |
| 10 | Synchro et restauration | ✅ « Restaurer » → `restorePurchases` ; abonnement relu au retour dans l’app et tenu à jour par `addCustomerInfoUpdateListener`. |
| 11 | Différence entre les deux annuels | Seule l’offre de départ change, donc le moment du prélèvement : bienvenue débite tout de suite, la personne devant l’écran (un problème de carte se règle sur place) ; l’Annuel débite 3 jours plus tard, sans personne. |
| 12 | Bug de reconnaissance d’un renouvellement | Aucun trouvé. |

## Anomalies du code (corrigées en v3160)

1. **`achat.js`, `ANDROID`** : `C.getPlatform` était lu sans vérifier que `C` (Capacitor) existe : hors de l’app, `achat.js`
   plantait au chargement. Aucun effet sur iPhone. Corrigé : `!!(C && typeof C.getPlatform === 'function' && …)`.
2. **`achat.js`, `annule`** : une erreur dont le message contenait « cancel » passait pour une feuille refermée (et le paywall
   proposait l’offre −50 %). Et un achat passé dont la réponse ne montrait pas encore `premium` rendait `false`, pris lui aussi pour
   une feuille refermée. Corrigé : l’annulation se reconnaît au code seulement (« 1 », y compris sous `data`, où Capacitor range
   les détails) ; un achat passé sans `premium` est relu une fois 2 s plus tard, puis, toujours rien, une erreur à part
   (`NON_CONFIRME`).
3. **`index.html`, paywall et offre de bienvenue** : un paiement en attente (code « 20 », « Demander l’autorisation d’achat »,
   validation de la banque) affichait « Le paiement n’a pas abouti. Tu n’as pas été débité·e, réessaie. ». Corrigé :
   `pwEchecTexte(e)`, avec `REQUETE_ACHAT.raison(e)` :
   - en attente : « Ton paiement attend une validation. Requête se débloque dès qu’il est accepté. »
   - achat passé non confirmé : « Ton achat est passé, mais sa confirmation tarde. Dans un instant, touche « Restaurer » en haut
     de l’écran. »
   - sinon, le message d’avant. Les deux phrases sont traduites dans `langue-en.js`.

Tests : `tests/retours-0832-audit-achat.test.mjs`.

## Réglages à revoir (sans lien avec les échecs)

- RevenueCat › app App Store › Apple Small Business Program : date d’entrée vide, donc revenus calculés avec 30 % de commission.
  À renseigner si le compte est inscrit au programme (15 %). Ne change que les chiffres affichés.
- App Store Connect › Business › formulaires fiscaux : « Formulaire fiscal pour le Brésil : Informations fiscales manquantes ».
  Ne concerne que le Brésil.

## À vérifier à la main

- Le prochain essai « Annuel » non résilié (fin le 28 ou le 29 novembre) : passé en payant, ou `BILLING_ERROR` lui aussi.
- App Store Connect › Ventes et tendances › Abonnements (événements) : comparer avec RevenueCat (essais passés en relance de
  paiement, conversions).

## Ce qui relève d’Apple ou de la banque

- Les trois échecs : `BILLING_ERROR`, période `TRIAL`, production, `fr.requete.app.annuel`, sans partage familial ni code d’offre ;
  deux en France (EUR), un au Sénégal (facturé en USD).
- Un produit retiré de la vente ou un contrat non signé donne autre chose qu’une erreur de paiement (Apple :
  https://developer.apple.com/forums/thread/847338). Ici, contrat des apps payantes actif depuis le 16 novembre 2026, compte
  bancaire actif, les trois produits approuvés.
