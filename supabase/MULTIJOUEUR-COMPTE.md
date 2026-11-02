# Multijoueur lié au compte — préparation inactive

Le socle est appliqué dans Supabase. `requete_private.compte_jeu_config.active` reste à `false`, aucun joueur réel n’est lié et aucun écran ne charge `account/multiplayer.mjs`. Le vérificateur `jeu-compte-verifier` est préparé mais **non déployé**. Le multijoueur invité actuel continue de fonctionner.

## Une identité commune web/iPhone

Un compte possède au maximum une identité multijoueur. Un même compte connecté sur plusieurs appareils obtient le même `pid`, le même pseudo réservé et le même classement. Aucun e-mail, identifiant Auth ou secret n’est diffusé dans les salles. Deux connexions du même compte correspondent au même joueur, jamais à deux places ni à deux crédits pour une partie.

Deux parcours futurs sont disponibles :

- `create(pseudo)` réserve un nouveau pseudo et génère son secret côté serveur. Si le compte possède déjà une identité, celle-ci est rendue ; le pseudo ne change pas implicitement.
- `link(deviceKey, 'LIER')` reprend le pseudo et les données déjà enregistrées côté serveur pour cette clé d’appareil. La clé actuelle est exigée, jamais le pseudo seul. Il faut quitter les salles actives avant la liaison. Le compte ne peut ni absorber une deuxième identité ni déplacer une identité appartenant déjà à un autre compte. Une nouvelle tentative avec la même clé et le même compte est sans effet supplémentaire.

Il n’y a aucune fusion de plusieurs classements, aucun ajout de points locaux et aucune importation de parties en attente. Si un nouveau pseudo a déjà été créé pour le compte, la liaison d’un ancien pseudo est refusée : présenter ce choix **avant** la création de l’identité.

`requete_private.compte_jeu` stocke le lien Auth et le secret nécessaire à l’adaptation du protocole v2. Cette table est privée, avec RLS et sans droit client. Le secret n’est jamais retourné. Sa copie privée permet de réutiliser les preuves et reçus existants sans les transformer en scores déclarés par l’utilisateur.

## RPC préparées

Toutes exigent une session Auth non anonyme, un utilisateur existant et le verrou serveur activé. L’identité vient de `auth.uid()` ; aucune n’accepte de `user_id` cible.

| RPC | Rôle |
| --- | --- |
| `jeu_compte_identite()` | Identité liée, ou `linked:false` |
| `jeu_compte_creer(p_pseudo)` | Nouvelle identité, ou identité existante |
| `jeu_compte_lier(p_cle, p_confirmation)` | Reprise explicite d’une identité invitée |
| `jeu_compte_envoyer(p_salle, p_m)` | Commandes de salle, avec `pid` et nom imposés par le serveur |
| `jeu_compte_historique(p_salle, p_apres)` | Historique, après contrôle d’appartenance à la salle |
| `jeu_compte_score(p_salle, p_g)` | Points calculés depuis les essais vérifiés et reçus uniques |
| `jeu_compte_classement()` | Classement et position personnelle |
| `jeu_compte_defis()` | Résultats déjà présents côté serveur, sans import de progression locale |
| `jeu_compte_essai(p_salle, p_g, p_n, p_id, p_sql)` | Allocation d’un essai autorisé, sans acceptation d’un verdict client |

Les RPC réutilisent les droits d’hôte, limites de places, générations de partie et contrôles de manche du protocole v2. Le calcul des points reste inchangé. Le client ne choisit ni son identité dans les messages, ni ses points, ni son temps de réussite.

La fonction centrale `jeu_cle` conserve son calcul d’empreinte pour les invités. Pour une identité liée, elle exige également le JWT du propriétaire. Cela bloque la réutilisation de la clé seule, y compris par l’ancien vérificateur Edge qui agit avec un JWT service sans utilisateur. Les appels sur une même clé sont sérialisés avec un verrou transactionnel pour éviter une course entre liaison et opération invitée. Aucun lien n’étant créé aujourd’hui, ce contrôle supplémentaire n’active pas les comptes.

## Vérification SQL future

`supabase/functions/jeu-compte-verifier/` contient un point d’entrée et un handler testable. Il exige `REQUETE_MULTIPLAYER_ACCOUNTS_ENABLED=true` en plus du verrou SQL. Aucun déploiement ni variable distante n’a été modifié.

Le serveur vérifie le JWT avec Auth, transmet ce même JWT à `jeu_compte_essai`, vérifie le SQL avec le catalogue et le moteur existants, puis appelle `jeu_valider_v2` avec les droits serveur. La clé privilégiée reste dans l’environnement serveur. Un client peut demander l’allocation de son propre essai, mais ne peut pas appeler la validation privilégiée ni s’attribuer une réussite. Une panne du moteur ne produit pas de verdict.

Le corps attendu contient uniquement `salle`, `g`, `n`, `id`, `sql`. Les champs compte, clé, pseudo, points, temps et verdict sont refusés. Conserver le même UUID d’essai lors d’une nouvelle tentative réseau. Les essais déjà terminés renvoient le résultat enregistré. Le SQL est soumis au vérificateur mais le protocole conserve son empreinte dans la base, comme pour les invités.

## Adaptateur client et raccordement restant

`createAccountMultiplayer({accountId, auth, url, apikey, enabled:false})` ne fait aucun appel à l’import ou à la construction. Chaque action activée vérifie le compte, puis utilise un jeton capturé pour éviter d’envoyer une action du compte A avec la session B. Aucune clé n’est persistée par ce module ; celle de liaison n’est utilisée que dans l’appel explicitement demandé.

Avant activation, raccorder les écrans et le transport des salles à cet adaptateur, choisir créer/reprendre avant de réserver un pseudo, empaqueter les modules pour Capacitor et déployer le nouveau vérificateur avec ses dépendances de catalogue/moteur. Le point d’entrée serveur utilise `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` fournis par l’environnement Supabase. Tester ensuite réellement l’iPhone et le navigateur ensemble.

À la déconnexion ou au changement de compte : arrêter les écoutes et commandes de l’ancienne salle, isoler ses données locales et ignorer les réponses d’un ancien compte encore en vol. Pour rejouer en invité, utiliser une identité invitée distincte ; ne pas réutiliser la clé désormais liée. L’adaptateur n’installe ni écouteur, ni minuteur, ni file de commandes hors ligne. Les commandes de partie ne doivent pas être rejouées aveuglément après reconnexion ; récupérer d’abord la génération et l’état de la salle. Deux appareils connectés au même compte restent un seul joueur ; une interface de contrôle simultané reste à tester lors du raccordement.

Les actions annexes actuelles de signalement et de suppression du pseudo utilisent encore le protocole invité. Avant de les proposer pour un compte lié, ajouter leurs commandes de compte dédiées et leurs confirmations ; ne jamais transmettre le secret privé à l’ancien client pour les rendre disponibles. La suppression complète du compte est déjà couverte par le nettoyage ci-dessous.

## Suppression et données conservées

La suppression du compte Auth supprime le lien par cascade. Un trigger efface son joueur classé (parties et signalements en cascade), son pseudo réservé, ses messages émis, ses essais et ses appartenances aux salles. Il retire aussi son identifiant des listes de participants des manches sans supprimer les parties des autres joueurs.

Une empreinte de clé révoquée est conservée, sans référence au compte ni secret, pour empêcher une ancienne sauvegarde de réutiliser l’identité supprimée. Les références opaques au `pid` dans d’anciens événements d’autres joueurs ou l’ancien champ hôte d’une salle peuvent subsister ; elles ne donnent aucun droit et le relais d’hôte conserve ses contrôles de présence. Les données historiques d’identités invitées jamais liées ne sont pas concernées.

Le service de suppression des comptes reste lui aussi préparé, non déployé ; ses restrictions Apple restent valables. Une future action « supprimer uniquement mon pseudo » devra distinguer son périmètre de la suppression du compte et de sa progression.

## Vérifications et audit

`supabase/tests/multijoueur_compte.sql` passe contre les vrais RPC : verrou désactivé, liaison idempotente, unicité du pseudo et de l’identité, conservation du score historique serveur, message forgé, droits de salle, score calculé, reçu sans doublon, refus de validation côté client, anciens protocoles sans JWT propriétaire, compatibilité invitée, accès secrets interdit et suppression en cascade. Tout est exécuté dans une transaction annulée ; le verrou reste désactivé et les tables de liaison/révocation restent vides.

58 tests Node ciblés passent pour comptes, suppression, progression, planning et nouveau multijoueur. Les 4 tests du moteur SQL passent aussi, dont toutes les solutions du catalogue, ainsi que 59 tests de régression des salles, du transport et du classement : 121 tests ciblés au total. Le handler Edge et les changements de compte sont testés avec des dépendances simulées ; le déploiement Edge et les sessions réelles web/iOS restent à vérifier avant activation.

L’audit Supabase a été revu. Les neuf RPC SECURITY DEFINER sont intentionnellement exécutables par authenticated, avec `search_path` vide, identité tirée de la session et verrous d’activation : [avertissement 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Les trois tables privées ont RLS sans politique client, ce qui interdit tout accès direct : [information 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Aucun nouveau droit anonyme n’a été ajouté.
