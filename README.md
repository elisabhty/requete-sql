# Requête — Apprends le SQL

Application web progressive pour apprendre le SQL en pratiquant sur une **vraie base SQLite** dans le navigateur.

## Fonctionnalités

- **62 cours en vidéo interactive** : chaque cours est une leçon seule, validée par ses moments « À toi » (ni exercice ni quiz)
- **Onboarding** pour démarrer en 30 secondes
- **Planning** personnalisable + séance du jour
- **Défis** métier sans filet
- **Console** SQL libre + visualiseur pas à pas
- **Cartes** : collection de cartes débloquées
- **Notes** : stylo ✎ disponible partout
- **Compte** : profil, stats, export/import, schéma, reset
- Persistance locale (`localStorage`)

## Lancer en local

Ouvre `index.html` dans un navigateur moderne, ou sers le dossier :

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

> Le moteur `sql.js` est chargé depuis un CDN : une connexion internet est nécessaire au premier chargement.

## Déploiement (prod)

Le site est statique. Options simples :

1. **GitHub Pages** — active Pages sur la branche `main` (dossier `/` ou `/docs`)
2. **Netlify / Vercel / Cloudflare Pages** — pointe vers ce dépôt, build : aucun, publish : `.`

## Stack

- HTML / CSS / JS vanilla
- [sql.js](https://sql.js.org/) (SQLite compilé en WebAssembly)
- JetBrains Mono + system UI

## Licence

Usage personnel / pédagogique — adapte librement.

### Vérification des cours

`node tests/curriculum-production.test.mjs` vérifie les 62 cours (tous en leçon seule) et le contrôle des réponses SQL, sur d’anciens exercices gardés en exemple (tri, alias, contraintes, transactions, triggers et droits).
