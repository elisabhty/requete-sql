# Progression commune web et iPhone

> 12 novembre : raccordée à l’app iPhone (`compte-moteurs.js`, `csSync` dans index.html) derrière l’interrupteur `ACTIVE` de
> `connexion.js` ; voir IOS.md, « La connexion ». Le texte ci-dessous décrit la préparation de novembre.

Le backend est préparé dans Supabase. Le moteur `account/progression.mjs` n'est importé par aucun écran et son option `enabled` vaut `false` par défaut. Aucun écouteur n'est ajouté à `save()`, aucun envoi automatique n'est activé et aucune progression réelle n'a été migrée.

## Périmètre préparé

| Clé | Données personnelles synchronisables |
| --- | --- |
| `lesson:ID` | Validation, étapes `exo`/`qN`, première date de réussite, niveau et échéance des révisions existantes |
| `challenge:ID` | Réussite personnelle uniquement |
| `video:ID` | Position en secondes, version du contenu, réponses aux questions et moments validés |
| `interview:ID` | Marque personnelle « acquis » ou « à revoir » |
| `planning:main` | Planning complet, ordre des leçons et fuseau partagé ; voir [Révisions et planning](REVISIONS-PLANNING.md) |
| `activity:AAAA-MM-JJ` | Présence d'une activité ce jour-là, sans additionner les compteurs de deux appareils |

`extractProgression` sélectionne explicitement ces données à partir de l'état actuel de l'app et des positions/réponses vidéo fournies. Les identifiants des leçons et défis doivent venir du catalogue connu. Les brouillons SQL, réponses partielles d'animations, notes, fichiers, bases importées, jetons de connexion, clés d'appareil et points du classement sont exclus. Le planning est maintenant préparé par le module `account/learning.mjs`, sans activation ; les minutes d'apprentissage restent hors périmètre. La collection privée est désormais préparée comme une reconstruction de cette progression, sans liste d’acquisitions parallèle : voir [COLLECTION.md](COLLECTION.md).

Ces validations sont déclaratives et privées. Elles ne constituent jamais une preuve de réussite pour le classement public, dont la vérification serveur reste indépendante.

## Base et contrat commun

- `progression_etat` : une ligne par compte Auth, avec un numéro `epoch` qui change après un effacement global.
- `progression_element` : une ligne par compte et clé, avec données, révision, génération, marque de réinitialisation et date serveur. Les lignes sont supprimées en cascade avec le compte Auth.
- RLS : chaque utilisateur ne peut lire que ses lignes. Aucun accès anonyme ni écriture directe depuis l'application.
- Les quatre RPC prennent l'identité depuis `auth.uid()`, jamais depuis un identifiant envoyé par le client. Elles refusent les sessions anonymes. Leur `search_path` est vide et leurs permissions sont limitées au rôle `authenticated`.

`progression_lire()` initialise l'état et renvoie `{schemaVersion:1, epoch, elements}`. Une lecture cohérente et les écritures sont sérialisées par compte.

`progression_enregistrer(p_epoch,p_cle,p_revision,p_generation,p_data)` compare la révision attendue avant l'écriture et renvoie `{ok:true,element}` ou un conflit `revision`, `generation`, `epoch` ou `content_version`. Une limite de taille et une liste de champs autorisés empêchent d'utiliser ce stockage comme une sauvegarde globale de l'app.

`progression_reinitialiser(...)` recommence un élément en changeant sa génération. Recommencer une leçon réinitialise aussi sa vidéo, dans la même transaction. Les marques de réinitialisation restent présentes : une ancienne file hors ligne ne peut pas rétablir les validations effacées.

`progression_effacer(p_epoch)` efface la progression du compte et change son époque. Un ancien appareil reçoit un conflit au lieu de recréer sa vieille progression.

## Règles de fusion

- Une réussite de leçon ou de défi et une étape validée sont conservées, sauf réinitialisation explicite. Les étapes de deux appareils peuvent être réunies ; la première date de réussite est conservée.
- Une position vidéo n'est pas fusionnée en prenant le maximum : revenir en arrière est une action légitime. Deux modifications concurrentes attendent un choix.
- Les réponses vidéo déjà validées sont conservées. Les résultats de premier essai des moments `pN` ne sont pas remplacés par une nouvelle réponse ; recommencer passe par une réinitialisation.
- Un changement de version de vidéo exige une réinitialisation contrôlée. Ne jamais réutiliser un identifiant de cours pour un contenu différent sans migration explicite.
- Les marques d'entretien et les échéances de révision peuvent évoluer dans les deux sens ; leurs conflits ne sont pas automatiquement fusionnés.

## Moteur préparé

```js
import {createProgressionSync} from './account/progression.mjs';
const sync = createProgressionSync({enabled:false});
// await sync.status() => {enabled:false,pending:0}
```

À l'activation future, fournir `accountId`, `auth` (le client Auth officiel), l'URL et la clé publique Supabase, ainsi qu'un stockage durable proposant :

```js
store.get(key);           // Promise<object|null>
store.set(key, value);    // Promise<void>, ne doit pas masquer une panne
store.withLock(key, fn);  // verrou exclusif couvrant tous les onglets/instances de l'appareil
```

Le verrou doit être réel : Web Locks ou un mécanisme équivalent sur le web ; stockage et verrou adaptés à Capacitor pour iPhone. Les files sont séparées par identifiant de compte. Les jetons ne sont jamais enregistrés dans ces files.

- `pull()` : vérifier la session et récupérer les éléments et leurs révisions. Cette première récupération est nécessaire avant de préparer des envois. Sur une nouvelle installation, la progression invitée reste locale jusqu'à une fusion explicitement choisie.
- `enqueue(key,data)` : enregistrer un changement durablement, sans réseau, à partir du dernier état connu. Préparer uniquement les changements effectifs, pas réenvoyer un ancien état global.
- `flush()` : envoyer la file au retour du réseau, reconnaître une réponse déjà enregistrée et fusionner les validations compatibles. Une panne laisse les changements en attente. Le résultat inclut toujours l'identifiant du compte.
- `resolve(key,'remote'|'local')` : résolution explicite d'un conflit courant. Une ancienne époque ou génération ne peut jamais être réutilisée avec le choix « local » ; il faut repartir d'une nouvelle action de l'utilisateur.
- `reset(key,'RECOMMENCER')` et `resetAll('EFFACER')` : actions explicites de réinitialisation.

Chaque envoi capture un jeton vérifié pour le compte attendu. Un changement de compte au milieu d'un transfert ne redirige pas la file A vers le compte B.

Les écritures personnelles ne produisent aucun point : une réponse perdue peut donc être reconnue sans récompense en double. Les RPC gardent le contrôle de concurrence même si deux appareils envoient simultanément.

## Raccordement restant avant activation

Les écrans, le stockage durable iOS/web et le déclenchement au retour du réseau restent à raccorder. Aucun écran n'applique encore le résultat de `pull()` à l'état local. Ce raccordement devra respecter les changements en attente, traiter les conflits sans masquer les données locales et vérifier que le compte affiché est toujours celui du résultat reçu. Prévoir les libellés « En attente », « Synchronisé » et « Choisir la version ».

Le navigateur et l'app devront appeler les mêmes RPC avec le même identifiant Supabase Auth. Tester sur deux appareils réels : modification hors ligne, retour réseau, changement de compte, réinitialisation, interruption de l'app et vidéo modifiée. Le build Capacitor devra inclure le dossier `account/` lors de l'activation ; il ne le copie pas actuellement.

Pour calculer une série identique partout, le raccordement devra aussi choisir un fuseau horaire de référence pour le compte. Les jours extraits aujourd'hui sont ceux enregistrés localement par l'app ; le moteur ne réinterprète pas rétroactivement leurs dates.

L'information de confidentialité sera mise à jour à l'activation réelle. Aucune promesse de synchronisation active ne doit être ajoutée avant ce raccordement et ces essais.

## Vérification

- `node --test tests/progression-sync.test.mjs tests/account-service.test.mjs tests/account-deletion.test.mjs` : files persistantes, deux appareils simulés, réponse perdue, conflits vidéo, isolation des comptes, panne du stockage et réinitialisations.
- `supabase/tests/progression.sql` : accès réels à Postgres avec deux identités, contrôle des versions, fusion, isolation RLS et suppression en cascade. Toute la transaction est annulée ; aucun utilisateur de test ou progression réelle n'est conservé.

L'advisor signale les quatre RPC comme fonctions `SECURITY DEFINER` accessibles aux utilisateurs connectés. Cet accès est intentionnel : les écritures directes sont interdites, chaque fonction vérifie `auth.uid()` et ne traite que les données de ce compte. Aucun de ces points d'entrée n'est accessible au rôle `anon`. [Explication du contrôle Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Références : [fonctions Postgres](https://supabase.com/docs/guides/database/functions), [protection des données par RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Les [notes et requêtes explicitement sauvegardées](NOTES-REQUETES.md) disposent maintenant de leur propre espace privé, avec une file et une époque d’effacement distinctes. Elles restent exclues des envois de progression ; les brouillons et bases locales ne sont pas importés. Le moteur de file commun réside dans `account/sync-engine.mjs`, sans changement de stockage ou de protocole pour la progression.
