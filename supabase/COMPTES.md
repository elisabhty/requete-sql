# Socle des futurs comptes

La migration `comptes_socle_profils_prives` est appliquée au projet Supabase de Requête. Aucun branchement Auth n'est ajouté au site ou à l'application, aucun compte existant n'est créé ou importé, et aucun réglage Auth n'est changé. La page de connexion reste un aperçu.

Depuis le 2 novembre 2026, les fonctions de compte sont préparées dans `account/service.mjs`. Elles ne sont importées par aucun écran et restent désactivées par défaut. La fonction de suppression est préparée dans `supabase/functions/compte-supprimer/`, sans être déployée. Aucun e-mail n'est envoyé et aucune progression locale n'est téléversée par cette préparation.

## Fonctions préparées, non activées

- `current()` : utilisateur vérifié par le serveur Auth et son profil privé ; état déconnecté si aucune session.
- `signUp({email,password})` : inscription par e-mail, avec retour distinct « confirmation requise ». Un objet utilisateur sans session n'est jamais présenté comme une connexion réussie.
- `signIn({email,password})` : connexion par e-mail. La création du profil est une étape séparée, réessayable sans faire échouer la connexion.
- `ensureProfile(prenom)` : création du profil après connexion, sans écraser un prénom déjà enregistré et sans collision entre deux appareils.
- `updateProfile({prenom}, {revision})` : modification du prénom avec la version affichée et contrôle du compte attendu ; propriétaire tiré de la session.
- `requestPasswordReset(email)` et `changePassword(password)` : récupération avec adresse de retour configurée et changement du mot de passe dans une session valide. Le futur écran doit traiter l'événement `PASSWORD_RECOVERY` du SDK.
- `startProvider(provider)` : démarrage du parcours web d'un fournisseur explicitement autorisé. Ne signifie pas que la connexion est déjà terminée. Apple et Google ne sont pas autorisés par défaut.
- `signOut()` : déconnexion de cet appareil ; `signOut({allDevices:true})` pour tous les appareils. Le module ne supprime pas la progression locale.
- `deleteAccount('SUPPRIMER')` : appel du futur service de suppression avec confirmation explicite. Aucun identifiant cible n'est fourni par l'appareil.

Le service utilise un client officiel Supabase fourni par le futur point d'entrée, sans initialiser de SDK ou de requête à l'import. La dépendance du futur service serveur est épinglée à `@supabase/supabase-js@2.118.0`.

```js
import {createAccountService} from './account/service.mjs';

// Préparation : aucune requête n'est effectuée par le service.
const account = createAccountService(supabase, {enabled:false});
// await account.current() => {enabled:false,user:null,profile:null}
```

À l'activation, le point d'entrée créera le client Supabase, configurera ses sessions et fournira une adresse HTTPS de retour autorisée dans Supabase. Le service partagé accepte `enabled:true` uniquement par configuration explicite. Le build Capacitor actuel ne copie pas ce dossier : il faudra l'inclure au moment de son raccordement, puis tester l'app iOS réellement compilée.

## Données et accès

- Supabase Auth est responsable des identités, adresses e-mail, mots de passe, sessions et futurs fournisseurs de connexion. Ne jamais copier les mots de passe dans une table de l'application.
- `public.compte_profil` contient `user_id` (clé de `auth.users`), `prenom` (80 caractères au maximum), `objectif`, `fuseau_horaire`, `revision`, `cree_le` et `modifie_le`.
- RLS impose `auth.uid() = user_id` à la lecture, à la création et à la modification. Aucun accès `anon`. Le navigateur ne peut plus écrire directement les modifications : les RPC valident prénom, objectif et fuseau avec une version attendue, jamais le propriétaire ni les dates.
- La suppression du compte Auth supprime son profil en cascade. Une future suppression de compte devra aussi révoquer ses sessions et traiter ses autres données.
- Aucun trigger n'est installé sur `auth.users`. Le profil sera initialisé après une connexion réussie : sa création ne doit pas bloquer l'inscription.
- Les pseudos, scores et clés d’appareil actuels restent indépendants tant que les comptes sont inactifs. Leur association est maintenant préparée dans [MULTIJOUEUR-COMPTE.md](MULTIJOUEUR-COMPTE.md), avec preuve de possession de la clé et sans import de points locaux.

## Contrat pour le futur client

Après une connexion via Supabase Auth et avec son JWT utilisateur, créer le profil si absent, puis lire son profil. L'identifiant vient de la session vérifiée, jamais d'une saisie utilisateur. `user_id` peut être omis à l'insertion : sa valeur par défaut est `auth.uid()`.

```js
// Exemple d'intégration future ; ce code n'est pas exécuté dans l'appli actuelle.
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) throw new Error('Connexion requise');
const { data: profile, error } = await supabase
  .from('compte_profil').select('*').eq('user_id', user.id).maybeSingle();
if (error) throw error;
if (!profile) {
  const { error: createError } = await supabase.from('compte_profil').insert({ prenom: '' });
  // Une autre fenêtre peut avoir créé le profil entre-temps.
  if (createError && createError.code !== '23505') throw createError;
}
```

La synchronisation de progression est désormais préparée séparément, sans activation, dans [PROGRESSION.md](PROGRESSION.md). Son schéma et son moteur gèrent les conflits entre appareils ; le raccordement aux écrans et au stockage iOS/web reste à réaliser.

Le compte commun sera identifié par le même `auth.users.id` sur le web et iOS. Ni le prénom ni le pseudo ne servent de preuve d'identité. La reprise du pseudo multijoueur actuel est préparée séparément dans `account/multiplayer.mjs`, avec preuve de possession de la clé d’appareil ; elle reste inactive et n’est pas appelée par le service de compte. Lors du raccordement, isoler les données locales par compte et demander une fusion explicite de la progression invitée, pour éviter de mélanger deux utilisateurs du même appareil.

## Suppression préparée pour les comptes e-mail

`compte-supprimer` doit être déployée ultérieurement avec `verify_jwt=true`. Elle est également désactivée tant que la variable serveur `REQUETE_COMPTES_ENABLED` n'est pas exactement `true`. Garder la clé privilégiée dans l'environnement Supabase uniquement.

Le service exige un jeton vérifié par Auth et la confirmation `SUPPRIMER`. Il révoque les sessions avant de supprimer l'utilisateur Auth identifié par ce jeton ; le profil est supprimé par la clé étrangère en cascade. Les erreurs internes ne sont pas exposées au client. Si la suppression échoue après révocation, l'utilisateur devra se reconnecter pour réessayer.

Ce périmètre couvre le compte Auth, le profil, les deux tables de progression, les deux tables de documents et les deux tables de projets préparées, supprimées en cascade. Le lien multijoueur préparé ajoute aussi un nettoyage des données de jeu à la suppression du compte ; voir [MULTIJOUEUR-COMPTE.md](MULTIJOUEUR-COMPTE.md). Tout ajout futur de fichiers devra intégrer son nettoyage au parcours de suppression. Les données historiques uniquement liées à une clé d'appareil ne sont pas automatiquement associées au compte.

La suppression d'un compte Apple est volontairement refusée dans ce code préparatoire : il faut d'abord ajouter la révocation des jetons Apple et la vérifier. Ne pas activer Apple avant d'avoir terminé ce parcours. Pour iOS, configurer aussi la capacité Sign in with Apple et le retour natif du bundle `fr.requete.app` ; un appel OAuth web ne remplace pas à lui seul l'intégration native.

Avant d'activer la connexion : choisir les fournisseurs (e-mail, Google, Apple…), configurer les URL de retour web/mobile et l'envoi des e-mails, relier inscription/connexion/déconnexion/récupération, puis vérifier l'expiration des sessions et les parcours sur deux appareils. Mettre à jour l'information de confidentialité lors de l'activation réelle.

## Vérification

Exécuter `supabase/tests/compte_profil.sql` dans l'éditeur SQL Supabase avec les droits du propriétaire. Le script teste les accès du propriétaire et d'un autre utilisateur, le refus des accès anonymes, les colonnes protégées, les contraintes et la suppression en cascade. Toute la transaction est annulée : aucun compte de test, profil ou mot de passe n'est conservé.

`node --test tests/account-service.test.mjs tests/account-deletion.test.mjs` vérifie les parcours avec un client simulé, le verrou d'activation, les confirmations, les erreurs, l'isolation des identifiants et l'ordre révocation/suppression. Aucun compte réel n'est créé ou supprimé. L'envoi des e-mails, les retours de connexion et la suppression réelle ne sont pas validés en production tant que les parcours restent désactivés.

Référence : [gestion des données utilisateur Supabase](https://supabase.com/docs/guides/auth/managing-user-data).

La préparation des révisions et du planning commun est décrite dans [REVISIONS-PLANNING.md](REVISIONS-PLANNING.md). Elle reste inactive et réutilise les tables de progression ; la suppression du compte couvre donc également ces données.

Le profil privé commun est complété, toujours sans activation : [PROFIL-PRIVE.md](PROFIL-PRIVE.md). Il conserve prénom, objectif et fuseau, et protège les modifications concurrentes web/iPhone.

La [collection personnelle](COLLECTION.md) est également préparée sans activation : elle se reconstruit depuis les validations privées synchronisées du compte. Aucune nouvelle table d’acquisitions n’est ajoutée.

Les [notes et requêtes enregistrées](NOTES-REQUETES.md) sont préparées dans un espace privé séparé : leur effacement ne touche pas les cours et la suppression du compte les efface en cascade. Aucun envoi automatique n’est activé.

Les [projets personnels](PROJETS-PERSONNELS.md) sont préparés dans un espace privé séparé, avec sauvegarde de l’espace SQL ou instantané SQLite explicitement choisi. Aucun projet existant n’est envoyé automatiquement.
