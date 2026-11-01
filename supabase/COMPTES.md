# Socle des futurs comptes

La migration `comptes_socle_profils_prives` est appliquée au projet Supabase de Requête. Aucun branchement Auth n'est ajouté au site ou à l'application, aucun compte existant n'est créé ou importé, et aucun réglage Auth n'est changé. La page de connexion reste un aperçu.

## Données et accès

- Supabase Auth est responsable des identités, adresses e-mail, mots de passe, sessions et futurs fournisseurs de connexion. Ne jamais copier les mots de passe dans une table de l'application.
- `public.compte_profil` contient `user_id` (clé de `auth.users`), `prenom` (80 caractères au maximum), `cree_le` et `modifie_le`.
- RLS impose `auth.uid() = user_id` à la lecture, à la création et à la modification. Aucun accès `anon`. Le navigateur ne peut modifier que le prénom, jamais le propriétaire ni les dates.
- La suppression du compte Auth supprime son profil en cascade. Une future suppression de compte devra aussi révoquer ses sessions et traiter ses autres données.
- Aucun trigger n'est installé sur `auth.users`. Le profil sera initialisé après une connexion réussie : sa création ne doit pas bloquer l'inscription.
- Les pseudos, scores et clés d'appareil actuels restent indépendants. Une association future devra prouver la possession de la clé d'appareil côté serveur. Ne jamais rattacher des scores à partir d'un pseudo seul ni accepter des points locaux comme preuve.

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

La sauvegarde et la synchronisation de progression ne sont pas implémentées par ce socle. Elles nécessiteront leur propre schéma et une gestion des conflits entre appareils.

Avant d'activer la connexion : choisir les fournisseurs (e-mail, Google, Apple…), configurer les URL de retour web/mobile et l'envoi des e-mails, relier inscription/connexion/déconnexion/récupération, puis vérifier l'expiration des sessions et les parcours sur deux appareils. Mettre à jour l'information de confidentialité lors de l'activation réelle.

## Vérification

Exécuter `supabase/tests/compte_profil.sql` dans l'éditeur SQL Supabase avec les droits du propriétaire. Le script teste les accès du propriétaire et d'un autre utilisateur, le refus des accès anonymes, les colonnes protégées, les contraintes et la suppression en cascade. Toute la transaction est annulée : aucun compte de test, profil ou mot de passe n'est conservé.

Référence : [gestion des données utilisateur Supabase](https://supabase.com/docs/guides/auth/managing-user-data).
