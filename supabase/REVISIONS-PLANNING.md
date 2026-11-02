# Révisions et planning — préparation inactive web/iPhone

Le socle est appliqué dans Supabase, mais aucun écran n’importe les modules `account/`. Aucun planning ni résultat réel n’a été transféré. La connexion et la synchronisation restent désactivées. Le stockage natif, les écrans de résolution et les notifications ne sont pas raccordés.

## Planning commun

Le planning complet occupe une seule clé `planning:main` dans `progression_element`. Il bénéficie des mêmes contrôles de propriétaire, versions, générations, effacements et suppression du compte que la progression. Il ne nécessite pas de nouvelle table ni de nouvelle API publique.

Champs admis : `niveau` (debutant/bases/inter), `rythme` (calme/regulier/intensif), `freq` (2/3/5/7), `per` (1 à 100), `mix` booléen, `sessions` avec dates `AAAA-MM-JJ` et identifiants numériques de leçons dans leur ordre, `archive` et `timeZone` (fuseau IANA partagé, par exemple Europe/Paris). Tous sont obligatoires : un envoi représente le planning complet. Limites : 512 journées, 1 024 leçons distinctes, 32 Ko ; dates entre 2000 et 2100. Une leçon ne peut figurer qu’à un seul emplacement, y compris dans l’archive. Les dates impossibles, journées dupliquées, champs inconnus et défis sont refusés.

Les dates du calendrier restent des dates civiles : changer de téléphone ou de fuseau ne les convertit pas en un autre jour. Le fuseau choisi pour le planning doit aussi servir au futur calcul des journées d’activité ; le fuseau du téléphone ne doit pas modifier le compte implicitement. Certaines variantes de noms IANA peuvent différer entre les versions ICU/Postgres : une erreur serveur doit conserver la file et proposer un nom canonique.

`extractPlan(state, {lessonIds, timeZone})` sélectionne les seuls champs admis, en retirant les anciens défis et identifiants absents du catalogue. Il exige un fuseau explicite. Les doublons restants sont refusés, jamais réparés en choisissant arbitrairement une date. Un état `plan:null` produit `null` : l’intégrateur doit distinguer « pas de planning à importer » d’une suppression explicitement demandée.

`movePlanLesson(plan, id, date, index)` prépare un déplacement sans modifier l’objet source ; il retire l’ancien emplacement et conserve l’ordre choisi. Lors du raccordement, les activités terminées doivent conserver la règle d’ancrage à leur date de validation déjà présente dans l’application. Ce helper générique ne connaît pas la progression ni cette règle métier.

## Deux appareils et mode hors ligne

Le moteur `createProgressionSync` accepte `planning:main` et réutilise sa file locale durable. Après une première récupération connectée, l’intégrateur pourra faire :

```js
const plan = extractPlan(state, {lessonIds, timeZone: 'Europe/Paris'});
if (plan) await sync.enqueue('planning:main', plan);
// Plus tard, à la reconnexion :
const result = await sync.flush();
```

Une sauvegarde de planning est atomique. Deux appareils modifiant la même version provoquent un conflit conservé en file ; aucune fusion automatique ne peut doubler une leçon ou annuler un déplacement silencieusement. L’écran futur devra montrer les deux choix avant `resolve('planning:main', 'remote' | 'local')`. Le choix local remplace le planning complet, donc peut remplacer aussi d’autres déplacements : l’expliquer à l’utilisateur. Une nouvelle modification distante pendant la résolution provoque un nouveau conflit.

`reset('planning:main', 'RECOMMENCER')` laisse un marqueur de suppression. Une ancienne file hors ligne ne peut pas recréer le planning : elle doit être abandonnée, puis un nouveau planning créé volontairement dans la nouvelle génération. `resetAll('EFFACER')` efface aussi le planning ; l’interface future devra annoncer ce périmètre. Les réinitialisations exigent une connexion. Une réponse réseau perdue est reconnue sans double sauvegarde.

## Révisions

Les révisions utilisent les champs existants `level` et `due` de `lesson:ID`, pas une deuxième copie de la progression. `reviewPatch(current, success, now)` prépare les deux valeurs ensemble selon les intervalles existants de 1, 3, 7, 21 et 60 jours (durées de 24 heures, comme aujourd’hui dans l’application). Une réussite monte d’un niveau, au maximum 4 ; un échec revient au niveau 0 avec une échéance dans un jour. L’export de progression conserve désormais le niveau zéro, indispensable pour transmettre un échec.

`dueReviews(elements, {lessonIds, now})` renvoie les révisions échues par échéance croissante. Le catalogue passé doit contenir seulement les leçons réellement révisables. Les cours actuels marqués `leconSeule` ne deviennent pas des exercices par cette préparation ; aucun QCM ni système de révision de cartes mémo n’est créé. La collection reste dérivée des leçons débloquées.

L’intégrateur devra calculer la révision depuis la version locale affichée et la mettre en file au moment de l’action. Ne pas récupérer une nouvelle version cloud puis envoyer un vieux calcul local comme s’il était récent. Les conflits de niveau/échéance restent explicites : ni maximum des niveaux, ni date la plus lointaine, ni horloge du téléphone utilisée pour décider du gagnant. Aucun historique détaillé des tentatives n’est conservé dans ce socle.

## Vérification

45 tests Node ciblés comptes/progression/planning/révisions passent, avec deux appareils simulés, file hors ligne, réponse perdue et niveau zéro. `supabase/tests/revisions_planning.sql` et `supabase/tests/progression.sql` passent contre les vrais RPC et RLS dans des transactions annulées. Les données de test ne sont pas conservées. Il reste à raccorder et tester les écrans web, le stockage verrouillé et la future application iPhone avant activation.

Les RPC SECURITY DEFINER existantes conservent leurs contrôles `auth.uid()`, leur refus des sessions anonymes, leur `search_path` vide et leurs droits limités à authenticated ; les nouveaux validateurs privés sont SECURITY INVOKER sans droit d’exécution client. L’avertissement de l’auditeur concernant l’exécution authentifiée des quatre RPC est attendu et a été revu : [documentation Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
