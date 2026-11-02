# Notes et requêtes enregistrées — préparation inactive

Le backend Supabase et `account/documents.mjs` sont préparés pour le web et la future app iPhone. Aucun écran ne les charge, aucun éditeur n’est raccordé et aucune note réelle n’a été transférée. La synchronisation reste désactivée par défaut.

## Format conservé

L’application enregistre déjà les requêtes dans les notes. Une note synchronisable conserve son identifiant stable et seulement ces champs :

| Champ | Contenu |
| --- | --- |
| `txt` | Texte personnel, 20 000 caractères maximum |
| `sql` | Requête explicitement sauvegardée, facultative, 12 000 caractères maximum |
| `ctx` | Contexte de la note, 300 caractères maximum |
| `ts` | Date de création locale existante, en millisecondes |
| `pin` | Épingle personnelle |

Une note doit contenir du texte ou du SQL non vide. La limite totale est de 64 Ko par document ; les dates vont jusqu’à 2100 et les caractères NUL sont refusés. Le SQL est conservé tel quel, sans normalisation ou exécution par ces RPC. Une note peut contenir seulement du texte, seulement une requête, ou les deux. Aucun second catalogue de requêtes ne duplique ces données.

Le contenu choisi est envoyé tel qu’enregistré par l’utilisateur. L’extraction ne parcourt pas les brouillons d’éditeurs, l’historique de console, les fichiers, les bases importées, les résultats de requêtes, les secrets de connexion ou les points du classement. Un contenu sensible écrit dans une note sélectionnée n’est pas détecté ou retiré automatiquement.

## Espace privé distinct de la progression

- `documents_etat` : époque d’effacement de cet espace pour chaque compte.
- `documents_element` : document `note:ID`, contenu complet, révision, génération et marqueur de suppression.
- Chaque utilisateur ne peut lire que ses propres lignes ; accès anonyme et sessions Auth anonymes refusés.
- Les écritures passent uniquement par les RPC `documents_lire`, `documents_enregistrer`, `documents_reinitialiser`, `documents_effacer`. L’identité vient du JWT, jamais d’un compte cible envoyé par le client.
- Limites serveur : 2 048 identifiants par compte, marqueurs de suppression compris, et 16 Mo de contenu JSON total. Aucun droit d’écriture directe client.

Effacer la progression des cours ne supprime pas les notes ; effacer les notes ne supprime pas les cours ou le planning. Supprimer le compte Auth efface les deux tables de documents en cascade, comme ses autres données privées.

## Client et conflits préparés

`createDocumentsSync(options)` utilise le moteur commun extrait dans `account/sync-engine.mjs`, avec un préfixe de stockage et des RPC distincts de ceux de la progression. Le comportement de la progression et ses identifiants de stockage restent conservés. Chaque espace exige un stockage avec `get`, `set` et un vrai `withLock` partagé entre instances, isolé par compte.

Après une première récupération connectée :

```js
const docs = createDocumentsSync({...options, enabled: false});
// Exemple de raccordement futur, une fois activé explicitement :
// await docs.pull();
// const selected = extractSavedNotes(notesChoisies);
// for (const item of selected) await docs.enqueue(item.key, item.data);
// const result = await docs.flush();
```

`extractSavedNotes(selectedNotes)` sélectionne les seuls champs admis, conserve les identifiants et refuse leurs doublons. Il ne reçoit pas l’état complet de l’application et n’envoie rien. La reprise des notes invitées devra être proposée explicitement ; aucune importation automatique n’est installée.

`enqueue` enregistre les modifications dans la file locale sans réseau ; `flush` les envoie après vérification du compte Auth. La file survit au redémarrage. Le jeton capturé reste lié au compte vérifié pendant l’envoi ; aucun jeton n’est enregistré dans le stockage de la file. Le contenu des notes en attente, lui, y est nécessairement conservé : isoler ce stockage par compte et prévoir son nettoyage à la suppression du compte.

Chaque envoi est un document complet. Deux éditions concurrentes ne sont jamais fusionnées automatiquement : texte, SQL et épingle doivent rester une version cohérente. La version distante et la modification locale en attente sont conservées jusqu’au choix explicite `resolve(key, 'remote' | 'local')`. Le choix local réessaie avec la version distante connue ; une nouvelle modification provoque un nouveau conflit. Une réponse réseau perdue est reconnue lorsque le même contenu est déjà sauvegardé, sans deuxième écriture.

Lors du raccordement, mettre l’édition en file depuis la version effectivement affichée. Ne pas récupérer une nouvelle version cloud puis soumettre un vieux texte comme s’il avait été rédigé depuis cette version récente.

## Suppressions préparées

`reset('note:ID', 'SUPPRIMER')` supprime le contenu et conserve un marqueur avec une nouvelle génération. Une ancienne édition hors ligne ne peut donc pas rétablir cette note. `resetAll('EFFACER')` efface cet espace et change son époque pour bloquer les anciennes files. Ces suppressions nécessitent une connexion dans le socle actuel ; aucune file de suppressions hors ligne ni nouveau comportement d’annulation de l’interface n’est installé.

Un utilisateur pourra recréer volontairement une note après avoir récupéré la nouvelle génération ; une restauration ne doit jamais être déclenchée automatiquement à la résolution d’une ancienne file. Les marqueurs empêchent une résurrection, mais ne constituent pas une corbeille ou un historique des anciens contenus.

`notesFromSnapshot(snapshot, {accountId})` reconstruit les notes non supprimées, avec leurs identifiants et épingles, en refusant un autre compte. La lecture reflète les données confirmées ; l’écran futur devra aussi représenter les éditions locales en attente. Les notes sont du texte : les afficher avec échappement et ne pas interpréter leur contenu comme du HTML. La requête sauvegardée ne doit s’exécuter que sur action explicite dans le laboratoire choisi par l’utilisateur.

## Vérification et raccordement restant

88 tests Node ciblés comptes/profil/progression/collection/planning/multijoueur/documents passent, dont les conflits, le mode hors ligne, les suppressions et les changements de compte. `supabase/tests/notes_requetes.sql` passe contre les vrais RPC et RLS : SQL préservé comme donnée, champs refusés, versions, marqueurs, espaces d’effacement indépendants, isolation, anonymes et suppression du compte. Toutes ses données sont annulées à la fin.

Les quatre RPC SECURITY DEFINER sont intentionnellement accessibles à authenticated, avec contrôle Auth non anonyme, propriétaire dérivé de la session et `search_path` vide. Les avertissements de l’auditeur ont été revus : [règle Supabase 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Aucun nouveau problème de performance lié aux tables de documents n’est signalé.

Il reste à relier l’éditeur, les épingles, les choix de conflit et la suppression à ce moteur, implémenter le stockage verrouillé web/iOS, inclure les modules dans Capacitor, nettoyer les caches par compte et tester les appareils réels. Aucun de ces branchements n’est activé ici.
