# APP-SPEC — Requête
Punchline : Apprends le SQL en pratiquant sur une vraie base.
Public : débutants et curieux (étudiants, reconversion, autodidactes) qui veulent du SQL concret, pas de longs cours théoriques.
Problème résolu : apprendre le SQL sans installer une base ni se noyer dans la théorie — en écrivant de vraies requêtes, tout de suite, sur le téléphone.
Moment magique : j’écris une requête → je vois le résultat → je valide la leçon (exercice + quiz).

**Statut :** ✅ VERROUILLÉE (GATE 1) — validée le 2026-08-09.
**Base existante :** app web GitHub `elisabhty/requete-sql` (contenu + logique à porter, pas une coquille WebView).

## Features v1 (dans le build)
- Onboarding guidé (prénom, niveau, minutes / jours)
- Parcours personnalisable + séance du jour (leçons + défis intercalés, jours « pause »)
- 65 leçons en 3 slides : Cours → Exercice → Quiz
- Aide progressive sur l’exercice (indice → aide → solution selon les erreurs)
- Défis métier (filtrables : Tous / Leçons / Défis)
- Révisions espacées (spaced repetition)
- Console SQL + explorateur de bases/tables + import CSV / JSON / SQL
- Schéma de la base du cours
- Collection de cartes débloquées
- Notes (stylo global)
- Profil local : stats, export / import progression, reset
- Paywall freemium (RevenueCat) : modules de base gratuits, suite en Premium
- App **native Expo** (pas de WebView du site)

## Repoussé (pas dans la v1)
- Sync cloud / multi-appareils
- Compte obligatoire (email)
- Coach IA
- Android (après iOS stable)
- Version web dans le même monorepo
- Blog / landing marketing complète (optionnel après GATE 2a)
- Visualiseur pas-à-pas ultra-fidèle au web (version simplifiée OK en v1)

## Écrans
- Onboarding (4–5 écrans)
- Accueil / Apprendre (filtres Tous · Leçons · Défis + carte séance)
- Détail leçon (slides Cours / Exercice / Quiz)
- Défi
- Parcours (bandeau 7 jours + séance + étaler)
- Console (+ bases / tables / import)
- Schéma
- Cartes (collection)
- Notes (liste + éditeur)
- Compte / réglages
- Paywall Premium
- (Optionnel) Révision due

Navigation : barre d’onglets — Apprendre · Parcours · Console · Cartes · Compte (+ Schéma / Notes en accès secondaire).

## Compte utilisateur : non (v1)
Progression et notes en local sur l’appareil. Restauration d’achats via l’App Store (RevenueCat), sans créer de compte.
*(Si sync cloud plus tard → alors compte + suppression in-app.)*

## Monétisation : freemium
- Gratuit : onboarding + premier module (« Les bases ») + console limitée à la base du cours + cartes de ce module
- Premium : toutes les leçons, défis, parcours complet, import de données perso, révisions
- Prix : **4,99 € / mois** ou **29,99 € / an**
- Essai gratuit : **3 jours** (sur l’abonnement annuel ; le mensuel sans essai sauf décision contraire au setup RevenueCat)
- Achats uniquement via **IAP Apple** (RevenueCat) — Apple prend 15–30 %

## IA : non
Pas d’IA en v1.

## Données stockées
- Local (AsyncStorage / SQLite app) : progression, notes, bases importées, réglages
- Aucune donnée perso obligatoire envoyée à un serveur en v1
- Achats : gérés par Apple + RevenueCat (reçus), sans compte app

## Conformité Apple (à respecter au build)
- [ ] Pas de wrapper WebView du site existant (guideline 4.2) — app Expo native
- [ ] Pas de compte forcé sans valeur sync (5.1.1)
- [ ] Paywall clair + restauration d’achats
- [ ] Politique de confidentialité (URL) même sans compte — données locales + RevenueCat
- [ ] Conditions d’utilisation / mentions abonnement (prix, durée, renouvellement) sur le paywall
- [ ] Si compte ajouté plus tard : suppression de compte in-app (5.1.1(v))

## Faisabilité technique
- [ ] Moteur SQL sur iPhone → **expo-sqlite** (ou sql.js si viable) — pas de serveur SQL requis ; leçons isolées de la console (comme aujourd’hui)
- [ ] Import CSV/JSON/SQL → faisable en JS pur, OK Expo Go
- [ ] Achats / abonnement → RevenueCat : **testé sur build réel / TestFlight** (pas Expo Go) — assumé GATE 2b
- [ ] RAS hors de portée pour le cœur pédagogique en Expo Go (hors IAP)

## Design
Ambiance : claire, pédagogique, violet doux (héritage web actuel) — à affiner avec `/ui`.

## Archétype La Recette
Cœur : progression de cours + exercice interactif (proche **quiz-reco** + **list-crud** / catalogue de leçons). Contenu et règles métier repris de `index.html` / dépôt web existant.
