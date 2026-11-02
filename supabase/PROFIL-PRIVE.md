# Profil privé commun web/iPhone — préparation inactive

La table `compte_profil` et ses RPC sont préparées dans Supabase. Les modules `account/profile.mjs` et `account/service.mjs` ne sont chargés par aucun écran et restent désactivés par défaut. Aucune donnée locale réelle n’a été importée. Les tests utilisent des transactions annulées.

## Données communes

| Champ | Rôle |
| --- | --- |
| `user_id` | Même identité Supabase Auth sur le web et iOS ; propriétaire fixé par la session |
| `prenom` | Prénom privé, 80 caractères maximum ; chaîne vide autorisée |
| `objectif` | Choix de l’accueil : career/interview/work/advanced/curious, ou vide |
| `fuseau_horaire` | Fuseau IANA du compte, UTC par défaut en l’absence de choix explicite |
| `revision` | Version générée par le serveur pour protéger les modifications concurrentes |
| `cree_le`, `modifie_le` | Dates générées par le serveur |

Ce profil n’est ni diffusé dans les salles ni ajouté au classement. Le pseudo multijoueur reste géré par son identité dédiée. Les mots de passe et e-mails restent dans Supabase Auth ; ils ne sont pas dupliqués ici. Les initiales d’avatar se déduisent du prénom ; aucun téléversement de photo n’est préparé dans cette étape.

Le profil ne duplique pas le niveau initial du planning, les scores ou la progression. L’âge, le métier, la provenance marketing, la signature du pacte, les notes, fichiers et requêtes SQL ne sont pas sélectionnés par l’export préparé.

## Accès et conflits

RLS protège les lectures et l’initialisation : chaque compte ne voit que sa ligne, les sessions Auth anonymes sont refusées même si elles portent le rôle Postgres authenticated. Aucune modification directe depuis le client n’est autorisée. L’ancienne insertion limitée à `user_id`/`prenom` reste disponible pour l’initialisation du service de compte, sans droit sur les champs supplémentaires ou les dates.

- `compte_profil_lire()` retourne son profil, ou null s’il n’existe pas. La lecture ne crée rien.
- `compte_profil_creer(p_donnees)` crée le profil avec les valeurs explicitement choisies, sans remplacer un profil existant. Deux appareils peuvent initialiser le compte sans écraser le premier.
- `compte_profil_enregistrer(p_revision, p_donnees, p_compte_attendu)` modifie uniquement les champs fournis si la version correspond. Le compte attendu sert à refuser une session ayant changé depuis l’action ; le propriétaire reste déterminé par `auth.uid()`, jamais choisi par ce paramètre.

Les données acceptées dans un patch sont exclusivement `prenom`, `objectif`, `fuseau_horaire`. Les champs inconnus et valeurs invalides sont refusés. Une mise à jour conserve les champs non modifiés, incrémente la révision et actualise la date serveur. Un conflit renvoie `{ok:false, reason:'revision_or_missing', profile:...}` sans écriture. Aucune ancienne sauvegarde n’est réappliquée automatiquement. Un accusé réseau perdu peut donc nécessiter une relecture : ne pas présenter une panne comme une sauvegarde confirmée.

## Client préparé

`createPrivateProfile({accountId, auth, url, apikey, enabled:false})` expose `current()`, `create(patch)` et `update(patch, {revision})`. Aucune requête ne part à l’import ou à la construction. Une fois explicitement activée, chaque action vérifie le compte via Auth, puis utilise le jeton capturé pour cet utilisateur. Le module ne crée ni stockage local ni file d’envoi, et ne conserve aucun jeton.

`extractPrivateProfile(state, {timeZone})` produit seulement un aperçu des champs autorisés depuis le prénom et l’objectif locaux. Il ne l’envoie pas. Le futur écran devra proposer explicitement la reprise des données invitées. Si un profil cloud existe déjà, la création le conserve ; le modifier nécessite sa version affichée et un choix explicite.

Le service historique `updateProfile({prenom}, {revision})` exige maintenant aussi cette version et utilise le RPC protégé. Un conflit y lève `profile_conflict`. `current()` et `ensureProfile()` renvoient aussi l’objectif, le fuseau et la révision. Les retours Auth et la synchronisation des autres données restent séparés.

## Raccordement restant

Relier l’éditeur de profil, les messages de conflit et les états de réseau, isoler les caches par compte et inclure les modules dans le build Capacitor. Une réponse provenant d’un ancien compte doit être ignorée après un changement de session. Le transport du module profil capture son jeton ; l’initialisation historique filtre aussi explicitement l’identifiant propriétaire.

Utiliser le fuseau choisi du compte pour les futurs calculs des journées d’activité et comme référence du planning. Un changement explicite de fuseau ne doit ni convertir les dates civiles d’un planning existant ni réinterpréter les anciennes journées d’activité. Aucune de ces adaptations d’écran ou d’activité n’est activée ici. Certaines variantes IANA peuvent différer entre ICU et Postgres : conserver les saisies en cas de refus serveur et proposer un nom canonique.

La suppression du compte Auth efface ce profil en cascade, comme avant. Il reste à vérifier réellement le parcours sur navigateur et iPhone lors de l’activation générale des comptes.

## Vérifications

67 tests Node ciblés comptes, profil privé, progression, planning et multijoueur passent. Les tests du profil couvrent l’inactivité, la sélection des données, les validations, deux clients concurrents, les changements de compte et les pannes réseau. `supabase/tests/compte_profil.sql` vérifie les RPC, les versions, les droits de colonnes, les accès entre comptes et anonymes, et la suppression en cascade contre la base réelle, puis annule toutes les données de test.

Les trois RPC SECURITY DEFINER sont intentionnellement exécutables par authenticated ; elles vérifient la session, refusent les anonymes et utilisent un `search_path` vide. Leurs validateurs privés sont SECURITY INVOKER et sans droit client. L’avertissement générique de l’auditeur est revu et documenté : [règle Supabase 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
