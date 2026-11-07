# Multijoueur et classement vérifiés

Le navigateur ne constitue pas une preuve de réussite. Les fonctions `*_v2` sont les seuls points d'entrée autorisés pour une partie classée.

- `jeu_identite_v2` lie un identifiant public au pseudo réservé et à l'empreinte de la clé secrète de l'appareil. La clé brute n'apparaît jamais dans les messages diffusés.
- `jeu_envoyer_v2` contrôle l'identité, l'appartenance, les droits de l'hôte, la génération de partie et la limite de cinq participants. Il fournit lui-même le pseudo et l'horodatage. Les faux messages `found` sont refusés.
- Les WebSockets publics ne servent que de notifications. Les clients relisent les messages par `jeu_historique_v2`, avec leur propre clé, et n'appliquent jamais directement une charge utile diffusée par un navigateur.
- `jeu-verifier` authentifie une tentative, exécute une seule requête de lecture dans SQLite/Wasm sur une base d'exercice jetable et compare les valeurs, avec la même tolérance d'alias et d'ordre de colonnes que l'appli. Le moteur est épinglé par son SHA-256. Les appels de l'appli ciblent Paris.
- Seul `service_role`, gardé dans l'environnement de la fonction, peut appeler `jeu_essai_v2` et `jeu_valider_v2`. La validation est idempotente. Le temps et le bonus de premier essai sont établis par le serveur. Une panne du moteur renvoie une erreur temporaire, sans consommer un nouvel essai à la relance.
- `jeu_score_v2` ignore les points, le temps et le niveau annoncés par le client. Il recalcule les points depuis les réussites vérifiées et produit un reçu unique par partie. `jeu_defis_v2` ignore les listes de réussites annoncées par le navigateur.
- Le solo hors ligne conserve ses points sur l'appareil. Seules les parties vérifiées en ligne entrent au classement public. Les anciens totaux locaux ne sont jamais importés dans ce classement.

- La salle dans l’île (7 novembre) : `jeu_ile_jeton_v2` (ouverte à `anon`) ne garde le jeton de push d’une Live Activity que pour un membre de la salle, identifié par la clé de son appareil ; `jeu_ile_cibles_v2` et `jeu_ile_suivi_v2` ne sont exécutables que par `service_role`, depuis la fonction `jeu-ile` (`verify_jwt=false` : elle authentifie l’appareil par sa clé). Les jetons ne sont jamais rendus à un client. Le serveur ne pousse qu’aux autres membres encore présents, un état nouveau à la fois, cinq au plus. Alertes attendues du conseiller : « RLS Enabled No Policy » sur `requete_private.ile` et `ile_etat`, « Public Can Execute SECURITY DEFINER Function » sur `jeu_ile_jeton_v2` (voulu, comme les autres portes d’entrée).

Les tables de vérification sont dans un schéma privé, avec RLS et sans droits directs pour `anon` et `authenticated`. Le ménage horaire supprime les salles et preuves après 24 heures. Seule une empreinte de la requête est conservée, pas son texte. Les anciens points déjà publiés sont conservés ; ils ne sont pas certifiés rétroactivement.

## Vérifier les changements

- `node --test tests/salle-defis.test.mjs tests/classement.test.mjs tests/secure-sql-verifier.test.mjs`
- `node scripts/test-secure-multiplayer.mjs` : vraie intégration Supabase, six identités temporaires, faux messages, contrôle SQL, horloge serveur et absence de double comptage ; les identités sont libérées à la fin.
- `CHECK_LEGACY_REVOKED=1 node scripts/test-secure-multiplayer.mjs` vérifie en plus le refus des anciens appels.

Après un changement des défis, des bases, du moteur ou de la comparaison, exécuter `node scripts/build-secure-catalog.cjs`, vérifier l'empreinte du Wasm dans `verifier.mjs`, tester toutes les solutions, mettre à jour `requete_private.catalogue` par migration et redéployer `jeu-verifier`. Le schéma de salle et les défis doivent correspondre au catalogue déployé. `tests/serveur-synchro.test.mjs` échoue si `sql-compat.mjs`, `matcher.mjs` ou le catalogue ne suivent plus index.html.

## Déploiement

1. Appliquer les migrations additives et déployer le vérificateur avec ses fichiers locaux (`verify_jwt=false`, car il authentifie lui-même chaque demande par sa clé d'appareil avant l'exécution SQL).
   Sans la CLI (connecteur Supabase), les gros fichiers (catalogue, moteur, compatibilité, comparaison) sont importés depuis jsDelivr au commit figé, `https://cdn.jsdelivr.net/gh/elisabhty/requete-sql@<commit complet>/supabase/functions/jeu-verifier/…` : l’assembleur de Supabase refuse github.io. Le dépôt garde les imports relatifs pour les tests. Version 11 (4 novembre, 22 h 50) : commit ad38ca5 ; version 12 (23 h 30, corrections A à E de la correction des défis) : commit cca071e.
2. Vérifier les RPC et deux clients sur la vraie base.
3. Publier le client et renouveler le cache du service worker sans changer la version de progression.
4. Révoquer les anciens points d'entrée publics `jeu_envoyer`, `jeu_historique`, `jeu_balise`, `jeu_score`, `jeu_defis`. Les fonctions v2 peuvent continuer à utiliser ces fonctions internes avec les droits de leur propriétaire.
5. Refaire les tests d'intégration et l'audit des droits. Un ancien onglet doit être rechargé ; il ne doit jamais pouvoir revenir au protocole non vérifié.

Cette protection ne prouve pas qu'un humain a réfléchi sans consulter les solutions, et ne remplace pas un test de charge ni une protection contre la création massive d'identités. Aucun score déclaré par un client n'est accepté comme preuve.
