# Stickers, statistiques et préférences — préparation inactive

Le socle Supabase et les modules `account/personalisation.mjs` et `account/study.mjs` sont préparés. Aucun écran ne les charge, aucun minuteur n’est installé et aucune donnée réelle n’a été importée. Les comptes et synchronisations restent désactivés dans l’application.

## Données privées communes

`personnalisation_etat` conserve l’époque d’effacement de cet espace. `personnalisation_element` conserve une valeur complète par compte et clé, avec révision, génération et marqueur de suppression. Les quatre RPC `personnalisation_lire`, `personnalisation_enregistrer`, `personnalisation_reinitialiser` et `personnalisation_effacer` utilisent le contrat du moteur de file commun.

RLS autorise uniquement la lecture de ses propres lignes. Les sessions anonymes sont refusées, même si elles utilisent le rôle authenticated. Aucun accès anonyme ou écriture directe client. Les RPC tirent le propriétaire de `auth.uid()`, vérifient son existence et utilisent un `search_path` vide. Les données disparaissent en cascade avec le compte Auth.

Cet espace est indépendant des cours, notes et projets. `reset(key, 'SUPPRIMER')` efface une valeur et conserve une nouvelle génération ; `resetAll('EFFACER')` efface les trois catégories ci-dessous et change l’époque. Une ancienne file ne peut pas les rétablir. Ces suppressions nécessitent une connexion ; elles ne constituent pas une corbeille.

## Stickers et tableau personnel

La clé `stickers:board` conserve le format existant : `got` (date d’obtention), `fresh` (nouveaux stickers non vus), `board` (ordre, position, rotation, taille) et `since` (première utilisation).

Le catalogue autorisé correspond aux 21 stickers actuels : 15 modules et 6 accomplissements. Une évolution de ce catalogue nécessite une mise à jour coordonnée du validateur et des clients ; les tests comparent les identifiants au catalogue de l’application. Un sticker placé doit figurer dans les acquisitions déclarées ; aucun doublon sur le tableau, coordonnées normalisées entre 0 et 1, taille entre 0,5 et 2. L’extraction normalise les rotations dans l’intervalle -180 à 180 degrés sans changer leur orientation.

Les acquisitions sont conservées lors d’un enregistrement : union des stickers gagnés et première date connue. La valeur historique 1 signifie « gagné, date inconnue » ; une vraie date est préférée lorsqu’un appareil la connaît. La première utilisation reste également conservée. Les nouveaux placements et l’état « vu » suivent la version explicitement choisie ; les dispositions concurrentes provoquent un conflit plutôt qu’une fusion de coordonnées.

`extractStickers(state)` prépare seulement ces champs, sans envoi. Les acquisitions restent privées et déclaratives, comme la progression ; elles ne donnent aucun point au classement. Les conditions de gain de l’interface continuent d’être celles des modules et accomplissements existants. Il n’y a pas de service d’attribution automatique activé par cette préparation.

## Statistiques d’apprentissage sans double comptage

### Nouveaux relevés

Chaque clé `study:UUID` représente une période active terminée et immuable : activité, début et fin en millisecondes. Un relevé dure au maximum une heure ; le futur point d’entrée devra produire des segments courts avec un UUID stable réutilisé lors des nouvelles tentatives réseau. Il doit respecter les contrôles existants de visibilité, d’inactivité et de suspension du navigateur. Aucun compteur ou écouteur n’est activé ici.

Une période déjà enregistrée ne peut pas être modifiée en conservant son identifiant. Elle peut être supprimée explicitement. Un même UUID reçu plusieurs fois représente une seule période.

`summariseStudy(snapshot, {accountId, timeZone})` calcule les secondes totales, par jour et par activité. Les intervalles qui se chevauchent sur plusieurs appareils ne comptent qu’une fois. Pour l’attribution par activité, la période qui commence la première est prioritaire ; les identifiants départagent les débuts identiques. Les jours sont découpés dans le fuseau du compte, avec des durées réelles : une heure au changement d’heure ne devient pas deux heures d’étude.

Le calcul utilise les dates déclarées des appareils : il ne reconstitue pas une horloge correcte à partir d’un appareil mal réglé. Ces statistiques personnelles ne sont pas une preuve pour les scores multijoueurs, dont le calcul serveur reste indépendant. Les séries et leurs records restent dérivables des journées actives déjà préparées dans la progression ; ce module ajoute les durées.

### Reprise de l’ancien temps d’étude

L’état actuel `state.study` contient des totaux par jour et activité, sans identifiants de périodes. On ne peut pas distinguer leurs chevauchements entre deux anciennes sauvegardes.

La reprise préparée `study:legacy` accepte donc **une seule source choisie explicitement** : instant de bascule `cutoff`, jours, activités et fuseau historique. Les totaux des jours et des activités doivent correspondre ; les jours futurs par rapport à cette borne sont refusés. Ce relevé est immuable : une deuxième source différente provoque un conflit, elle n’est jamais ajoutée à la première.

`extractLegacyStudy(state, {cutoff, timeZone})` produit cette reprise sans envoi. Les nouveaux segments qui précèdent la borne ne sont pas recomptés, et ceux qui la chevauchent sont tronqués à cette borne. Le futur raccordement devra capturer la source historique et commencer les nouveaux relevés à cet instant. Ne jamais créer automatiquement une reprise vide avant le choix de l’utilisateur.

Les dates historiques restent celles de la source choisie ; elles ne sont pas réinterprétées après un changement ultérieur de fuseau. En cas de données historiques incohérentes, conserver les données locales et proposer une reprise explicite adaptée, sans inventer des périodes ou additionner les appareils. Aucun historique réel n’a été migré dans cette étape.

## Préférences communes

La clé `preferences:main` conserve seulement :

- texte agrandi et souhait de réduction des animations ;
- vitesse vidéo parmi 0,5 / 0,75 / 1 / 1,5 / 2 ;
- réglages des défis : niveau, nombre de manches, solo/amis et choix explicite du niveau ;
- souhait de rappel quotidien et heure au format HH:mm.

`extractPreferences(state, options)` reçoit explicitement les valeurs stockées aujourd’hui dans plusieurs emplacements. Il ne parcourt pas le stockage de l’appareil. Une modification est une version complète et les conflits restent explicites ; préserver les champs existants quand un seul réglage change.

Les permissions de notifications, les jetons d’appareil et la réduction des mouvements du système ne sont pas partagés comme des permissions de compte. Le souhait de rappel ne doit pas autoriser une notification à lui seul. Les autorisations et la programmation locale devront être traitées sur chaque appareil dans le futur parcours prévu ; aucune permission ou notification n’est demandée ici. Le fuseau est celui du profil privé déjà préparé.

## File et raccordement restant

`createPersonalisationSync(options)` réutilise le moteur commun avec le stockage `requete-personalisation-sync-v1:COMPTE` et les RPC `personnalisation_*`. Le module reste inactif par défaut. Une première récupération connectée est nécessaire avant de mettre des modifications en file hors ligne. Le jeton capturé est lié au compte vérifié ; les conflits et suppressions ne sont pas résolus arbitrairement.

Au raccordement, isoler les caches et files par compte, ignorer les réponses d’un ancien compte, et ne pas additionner les totaux locaux à la projection cloud comme s’il s’agissait de périodes supplémentaires. La lecture du compte doit remplacer la source de statistiques affichée selon le choix d’import et la borne retenus. Les données ne contiennent ni SQL, ni fichiers, ni notes, ni identifiants d’autres joueurs.

Limites préparées : 64 Ko par valeur, 16 384 identifiants de cet espace par compte, marqueurs compris, et 16 Mio de contenu JSON total. Une reprise historique admet jusqu’à 4 096 jours et 1 024 activités. Une stratégie d’archivage des périodes devra être définie avant de dépasser ce socle ; aucune suppression silencieuse de vieux relevés n’est mise en place.

Il reste à implémenter le stockage verrouillé web/iOS, relier les trois interfaces, intégrer les modules au build Capacitor et vérifier les appareils réels. La suppression du compte doit aussi nettoyer les caches locaux correspondants. Les tables sont supprimées en cascade côté Supabase.

## Vérifications

113 tests Node ciblés passent. Les 13 nouveaux couvrent notamment le catalogue réel, les positions et dates des stickers, les préférences, les relevés immuables, les chevauchements entre appareils, minuit, le changement d’heure, la reprise historique et les conflits hors ligne.

`supabase/tests/personnalisation.sql` passe contre les vrais RPC et RLS : conservation des acquisitions, date connue après date inconnue, champs refusés, historique et périodes immuables, versions, génération, effacement indépendant, accès entre comptes/anonymes et suppression en cascade. Les fixtures sont toutes annulées. Les tables restent vides.

L’audit Supabase a été revu : les quatre RPC SECURITY DEFINER accessibles à authenticated sont intentionnelles et contrôlent l’identité ; le validateur privé est SECURITY INVOKER sans droit client. [Explication de l’avertissement 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Aucun avertissement de performance concernant cet espace n’est signalé.
