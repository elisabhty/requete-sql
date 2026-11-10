# Carte du code de Requête

Où se trouve quoi dans le dépôt. Pour chaque fichier, son rôle en une ou deux phrases. À tenir à jour quand on ajoute un fichier ou un dossier.

## L'appli

| Fichier | Rôle |
|---|---|
| `index.html` | **Toute l'appli** : le HTML des écrans, puis un grand script en parties numérotées (base de données, programme, défis, moteur SQL, écrans, planning, onboarding, compte…). La carte du fichier est tout en haut ; chaque partie commence par « En bref : ». |
| `ludique.css` | Le thème de l'appli (violet, lavande, jaune soleil, cartes à relief), chargé en dernier. Son sommaire est en haut du fichier. |
| `onboarding-vitrine.css` | L'onboarding et le paywall aux couleurs du site. |
| `design-premium.css`, `design-premium.js` | Le socle visuel d'avant le thème « Ludique » (barre de titre compacte, ombres, typographie), toujours chargé dessous. |
| `responsive.css`, `anim-responsive.css`, `safari-surface.css`, `safari-surface.js`, `ux-polish.css`, `home-journey.css`, `memo-collection.css` | Des retouches par sujet : toutes les tailles d'écran, les animations sur petit écran, les barres de Safari, une passe UI de septembre, l'accueil, les cartes mémo. |
| `multiplayer-security.js` | Les parties classées : l'identité du joueur vient du serveur et chaque requête jouée en salle est revérifiée par `jeu-verifier`. |
| `achat.js` | Les abonnements de l'app iPhone par RevenueCat (`window.REQUETE_ACHAT`, attendu par le paywall). Éteint tant que la clé `appl_` n'est pas collée dedans. |
| `import-formats.js` | L'import de fichiers dans la console (Excel, CSV, JSON, SQL, SQLite), sans bibliothèque. |
| `onboarding-focus.js` | Le focus du clavier dans la fenêtre de l'onboarding (accessibilité). |
| `perf-probe.js` | Une sonde de fluidité, chargée seulement avec `?perf=1`. |
| `inner-join-course.js` | L'ancienne page texte du cours INNER JOIN. Plus chargé par l'appli. |
| `sw.js` | Le service worker : l'appli s'ouvre sans réseau. `SW_CACHE` change à chaque version pour que les téléphones prennent les nouveaux fichiers. |
| `manifest.webmanifest` | Le nom, l'icône et les couleurs quand on ajoute l'appli à l'écran d'accueil. |
| `vendor/sqljs/` | SQLite compilé en WebAssembly : le moteur qui exécute les requêtes dans l'appli. |
| `account/` | Le futur compte (synchronisation de la progression, des notes, des projets, du profil). Préparé et testé, mais pas encore branché. |

## Les cours en vidéo

| Dossier | Rôle |
|---|---|
| `assets/anim/` | Un fichier `<cours>.html` par cours vidéo (animation GSAP sur une scène de 1080 × 1920), avec sa vignette. `core.js` et `core.css` sont le moteur commun à tous les cours. |
| `assets/voix/<cours>/` | La voix off de chaque cours, en MP3, une phrase par fichier. |
| `tools/voix/` | Les textes de la voix (`<cours>.json`) et les outils pour la générer avec ElevenLabs. `A-REGENERER.md` liste les voix à refaire. |
| `tools/sons/` | La fabrication des sons de l'appli (le miaou, l'ouverture). |
| `assets/` | Aussi : la mascotte (`chat-*.webp`, la version `-fixe` pour le mouvement réduit), les formateurs, les polices, les sons. |

## Le site

| Dossier | Rôle |
|---|---|
| `decouvrir/` | Le site vitrine : l'accueil (`index.html`), les pages des modules, la vidéo de présentation (`video.html`), la connexion, et les pages légales (confidentialité, conditions, mentions légales). |

## Le serveur (Supabase)

| Dossier | Rôle |
|---|---|
| `supabase/migrations/` | Toutes les modifications de la base, dans l'ordre. Le nom de chaque fichier est la version enregistrée dans Supabase. |
| `supabase/functions/jeu-verifier/` | Rejoue chaque requête jouée en salle sur une copie du catalogue des défis. `catalog.json`, `sql-compat.mjs` et `matcher.mjs` sont générés depuis `index.html` par `scripts/build-secure-catalog.cjs`. |
| `supabase/functions/jeu-ile/` | La salle dans la Dynamic Island de l'iPhone (Live Activity, via Apple). |
| `supabase/functions/compte-supprimer/`, `jeu-compte-verifier/` | Pour le futur compte. Pas encore déployées. |
| `supabase/*.md` | Les notes sur chaque partie du serveur (sécurité, multijoueur, comptes…). |

Les statistiques anonymes sont dans la table privée `requete_private.stat_evenement`. `stat_tableau(30)` donne les chiffres des 30 derniers jours (à lancer depuis Supabase, jamais depuis l'appli).

## L'app iPhone

| Fichier | Rôle |
|---|---|
| `capacitor.config.json`, `IOS.md` | La configuration de l'app iPhone (Capacitor) et le pas-à-pas pour la construire. |
| `scripts/build-www.mjs` | Copie l'appli dans le dossier que Capacitor embarque. |
| `scripts/ios-*.sh`, `scripts/ios-widget.mjs` | L'écran de lancement, le widget, la vérification et l'envoi sur TestFlight. |
| `resources/` | L'icône et l'écran de lancement. |

Commande pour l'iPhone : `cd ~/SQL && git pull --ff-only && npm run ios`

## Les tests

| Dossier | Rôle |
|---|---|
| `tests/` | Plus de 350 fichiers de tests, lancés par `npm test`. Chaque fichier `retours-HHMM` garde une demande précise (l'heure de la demande est dans son nom) et vérifie qu'elle reste vraie. |
| `scripts/db-snapshot.mjs`, `db-snapshots/` | Des photos de la base des cours, pour comparer avant et après un changement (`npm run db:photo`, `db:diff`). |
