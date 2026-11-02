# Projets personnels sauvegardés — préparation inactive

Le socle Supabase et `account/projects.mjs` sont préparés pour le web et la future app iPhone. Aucun écran ne les charge, aucun projet existant n’est téléversé et aucune base locale n’est remplacée. `enabled` reste false par défaut.

## Deux sauvegardes explicitement distinctes

Un projet personnel conserve son identifiant `db_…`, son nom et les champs déjà utilisés par le laboratoire : brouillon SQL, description du projet, descriptions des tables, requêtes épinglées. L’historique des exécutions est optionnel ; il n’est sélectionné que si l’intégrateur transmet `includeHistory:true` après le choix de l’utilisateur.

| Choix | Ce qui est sauvegardé |
| --- | --- |
| `scope: workspace` | L’espace de travail SQL et ses métadonnées, sans base de données |
| `scope: complete` | Le même espace, avec un instantané SQLite explicitement fourni et, s’ils sont fournis, les états initiaux des tables |

Une sauvegarde de l’espace seul ne permet pas de retrouver les données des tables sur un autre appareil. Le futur écran devra afficher clairement cette différence. Aucun fichier CSV/Excel original, dossier, résultat de requête, mot de passe de connexion ou autre projet n’est parcouru par le module. Une base incluse dans un instantané complet contient ses données ; ce choix doit donc être explicite pour le projet concerné.

Les identifiants `cours` et ceux des bases de démonstration ne sont pas des identifiants de projets personnels sauvegardés : seules les clés `project:db_…` sont admises. Pour les nouveaux projets créés sur plusieurs appareils, préférer un suffixe UUID plutôt qu’une simple date ; conserver les identifiants existants lors de la reprise. Une collision d’identifiants provoque un conflit, pas une fusion automatique.

## Instantané portable et limites du socle

Les bases SQLite sont encodées en base64 et stockées avec le document privé du projet. Cela permet d’enregistrer l’état SQL et la base atomiquement, avec la même révision et la même suppression. Aucun bucket public ni URL de téléchargement publique n’est créé.

Limites préparées : 2 Mio de données binaires par instantané SQLite, 4 Mio de JSON par projet complet, 64 identifiants par compte (marqueurs de suppression compris), 64 Mio de JSON total par compte. Les projets plus volumineux sont refusés et doivent rester locaux ; une prise en charge de fichiers plus grands via Storage privé pourra être ajoutée ultérieurement. Les instantanés initiaux de tables comptent dans ces limites.

Les champs du projet sont `name`, `scope`, `draft`, `desc`, `tdesc`, `pins`, `hist`, `database`, `baselines`. Limites de texte : nom 80 caractères, brouillon et chaque requête 12 000, description de projet ou de table 4 000. Jusqu’à 128 descriptions et états initiaux de tables, 12 requêtes épinglées et 24 entrées d’historique. L’historique conserve seulement SQL, date, succès et métadonnées d’exécution bornées, sans résultats de requêtes.

Le serveur contrôle le base64 canonique, la taille et l’en-tête SQLite. Une base vide explicite est admise et se distingue de l’absence de base. Il ne charge pas SQLite et ne vérifie pas toute l’intégrité du fichier : le futur client devra ouvrir et vérifier l’instantané localement avant de remplacer une base existante. Aucun SQL du projet n’est exécuté par les RPC.

## Client préparé

`extractPersonalProject(meta, workspace, options)` produit un document à partir d’un seul projet choisi. Il ne lit ni localStorage, ni `customDbs`, ni les fichiers importés. Les champs supplémentaires ne sont pas repris. Exemple de préparation, sans envoi :

```js
const record = extractPersonalProject(meta, workspace, {
  includeDatabase: false,
  includeHistory: false
});
```

Pour un instantané complet, le futur point d’entrée doit fournir `includeDatabase:true`, `databaseBytes` (export SQLite) et les `baselines` à préserver. Le module n’exporte pas lui-même la base. Si l’export est réalisé avec SQL.js, réinstaller les fonctions de dates du moteur comme le fait déjà le laboratoire après `database.export()`.

Les états initiaux `baselines` conservent les données nécessaires au bouton existant de restauration d’une table. Si aucun état initial n’est fourni, il ne peut pas être retrouvé depuis la seule base courante : ne pas prétendre restaurer l’état d’importation d’origine. Les fichiers CSV/Excel originaux ne sont pas inclus comme pièces jointes.

`createProjectsSync(options)` réutilise le moteur commun de file et de versions avec son propre stockage `requete-projects-sync-v1:COMPTE` et ses RPC `projets_*`. Il n’installe aucun écouteur ou minuteur. Après une première récupération connectée, les modifications choisies peuvent être mises en file hors ligne puis envoyées à la reconnexion. Le stockage doit implémenter le verrou partagé requis par le moteur ; aucune implémentation web/iOS n’est activée ici.

`projectsFromSnapshot(snapshot, {accountId})` restitue les projets non supprimés du bon compte. `decodeProjectDatabase(key, data)` retourne les octets d’un instantané, ou null pour un espace seul ; il ne crée pas de base et ne remplace aucun fichier. Les métadonnées et descriptions devront être affichées comme texte échappé.

## Versions, suppressions et protection de la base

`projets_etat` et `projets_element` sont privés, isolés par RLS et supprimés en cascade avec le compte Auth. Les sessions anonymes sont refusées. Aucun client ne peut écrire directement dans les tables ; les RPC dérivent l’identité du JWT et vérifient version, génération et époque.

Un envoi est toujours un projet complet et cohérent. Deux appareils modifiant la même version conservent leurs versions jusqu’au choix explicite de l’utilisateur. Une base SQLite ne se fusionne pas ligne par ligne ; les brouillons, descriptions et listes ne se fusionnent pas non plus automatiquement. Le jeton capturé par le moteur reste lié au compte vérifié pendant la requête. Une réponse perdue est reconnue si ce même contenu est déjà enregistré.

Une sauvegarde `workspace` ne peut pas remplacer un projet `complete` existant et lui retirer silencieusement sa base : le serveur renvoie `database_removal` et le moteur refuse de forcer ce remplacement par résolution locale. Pour modifier le nom ou le texte d’un projet complet, conserver son instantané dans la version envoyée. Si l’utilisateur souhaite retirer la copie cloud de la base, prévoir un parcours explicite de suppression puis de recréation d’un espace seul, avec nouvelle génération.

`reset(key, 'SUPPRIMER')` efface le contenu du projet et conserve un marqueur de génération. Une ancienne file ne peut donc pas recréer automatiquement sa base supprimée. `resetAll('EFFACER')` efface uniquement l’espace des projets et change son époque. Les cours et notes restent dans leurs espaces distincts. Ces suppressions nécessitent une connexion dans le socle actuel. Il n’y a ni historique de versions restaurables, ni file de suppressions hors ligne, ni restauration automatique.

Supprimer le compte Auth supprime aussi les tables de projets en cascade. Au raccordement, nettoyer également les files et caches locaux correspondants ; les autres espaces et comptes ne doivent pas être mélangés. Ignorer les réponses d’un ancien compte encore en vol après un changement de session.

## Vérifications et raccordement restant

100 tests Node ciblés passent, dont un export et une réouverture d’une vraie base SQLite retrouvant ses données, la sauvegarde optionnelle de l’historique, les bases vides, les conflits de versions, les réponses perdues, les suppressions, les changements de compte et la protection d’un instantané complet contre un envoi d’espace seul.

`supabase/tests/projets_personnels.sql` passe contre les vrais RPC et RLS : structure, instantanés opaques, champs refusés, identifiants réservés, versions, génération, époque, isolation entre comptes et espaces, et suppression en cascade. Les données de test sont annulées. Le test SQL contrôle le stockage et l’en-tête ; la réouverture SQLite est vérifiée séparément en Node.

Les quatre RPC SECURITY DEFINER sont volontairement accessibles à authenticated, avec contrôle de session non anonyme et `search_path` vide. Les validateurs privés sont SECURITY INVOKER et sans droits client. L’avertissement générique a été revu : [règle Supabase 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Aucun avertissement de performance concernant ces tables n’est signalé.

Il reste à raccorder les écrans de sauvegarde et de conflit, demander les choix d’inclusion de données, implémenter le stockage verrouillé, inclure les modules dans Capacitor et tester réellement l’iPhone et le navigateur. Une restauration devra ouvrir et vérifier la copie avant de remplacer le projet local, préserver l’ancien projet si l’opération échoue, réinstaller les fonctions du moteur et reconstruire les états initiaux des tables uniquement lorsque cela est approprié. Rien de ce parcours n’est activé ici.
