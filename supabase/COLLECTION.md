# Collection personnelle — préparation inactive web/iPhone

`account/collection.mjs` prépare la collection privée à partir de la progression commune existante. Aucun écran ne le charge ; `enabled` vaut false par défaut. Aucun compte ni carte réelle n’a été importé et aucune modification visuelle n’est activée.

## Une seule source de déblocage

L’application actuelle débloque une carte quand sa leçon est terminée (`isUnlocked` lit `state.lessons[id].done`). La préparation conserve cette règle : une carte existe dans le catalogue courant et sa ligne privée `lesson:ID` doit contenir `done:true`, sans marqueur de suppression.

Aucune table de cartes acquises, nouveau RPC ou migration n’est nécessaire. La collection réutilise `progression_lire()` et les protections déjà préparées : accès propriétaire, générations de réinitialisation, époque d’effacement global et suppression en cascade du compte. Un compte n’a donc pas deux listes de cartes susceptibles de se contredire.

Les succès sont déclaratifs et privés, comme la progression. Une carte débloquée ne constitue pas une preuve pour un score classé ou une récompense financière ; le multijoueur conserve sa vérification serveur indépendante.

## Contrat commun

`createCollectionCatalog(MODULES, CARTES)` produit les métadonnées nécessaires depuis le catalogue embarqué : identifiant stable de leçon, module, numéro d’affichage, libellé, description et caractère révisable. Seules les leçons réellement associées à une carte comptent. Les numéros et regroupements reflètent le catalogue courant ; ils ne servent pas de clés d’acquisition. Aucun texte de carte n’est dupliqué dans Supabase.

`derivePersonalCollection(snapshot, catalog, {accountId, now})` reconstruit :

- les cartes débloquées et verrouillées, avec date de première validation si elle existe ;
- le nombre total, le pourcentage et les compteurs par module ;
- les modules complets et la prochaine leçon à suivre pour obtenir une carte ;
- le niveau de maîtrise et les échéances, uniquement pour les leçons réellement révisables.

L’identifiant de compte du snapshot doit correspondre au compte affiché. Les données d’un autre compte et les doublons ambigus sont refusés. Les validations de leçons inconnues du catalogue ou sans carte n’augmentent aucun compteur. Une ancienne carte retirée du catalogue n’est plus affichée ; une nouvelle carte liée à une leçon déjà validée apparaît comme débloquée, conformément à la règle actuelle. Sa date d’acquisition représente la première validation de la leçon, pas une nouvelle date d’émission.

Les cours actuels sont des leçons seules : cette préparation ne crée ni exercice de révision, ni nouveau QCM. Les échéances existantes ne deviennent pas des révisions pour ces cours. Le badge « Acquise » suit le niveau déjà enregistré, comme l’interface actuelle.

## Lecture depuis la progression synchronisée

```js
const catalog = createCollectionCatalog(MODULES, CARTES);
const collection = createPersonalCollection({
  accountId: user.id,
  sync: progressionSync,
  catalog,
  enabled: false // Préparation seulement.
});
```

Une fois explicitement activé, `read({now})` appelle `sync.pull()` puis reconstruit la collection pour ce compte. Il ne fait aucune requête à la construction et ne conserve aucun snapshot personnel. Le moteur de progression vérifie Auth, capture son jeton et ajoute l’identité du compte au snapshot retourné.

La lecture reflète les données cloud confirmées. Les validations encore en attente dans la file de progression ne sont pas ajoutées silencieusement par ce module ; le futur écran devra distinguer les changements locaux en attente du dernier état confirmé. En cas de panne, `read()` lève une erreur et ne retourne pas une fausse collection vide. Le futur écran pourra conserver sa dernière vue confirmée et l’indiquer ; aucun stockage ni cache d’interface n’est installé ici.

Une interface hors ligne peut reconstruire sa dernière collection à partir d’un snapshot local explicitement identifié avec `derivePersonalCollection`. Ne jamais réutiliser le cache d’un ancien compte après connexion d’un autre utilisateur. Ignorer aussi les réponses d’un ancien compte encore en vol après un changement de session.

## Réinitialisations et suppression

Recommencer une leçon via le moteur de progression crée son marqueur de suppression et retire sa carte lors de la prochaine reconstruction. Les anciennes files hors ligne ne peuvent pas ressusciter la validation dans une ancienne génération. Un effacement global de progression retire les acquisitions en changeant d’époque ; le compte supprimé perd aussi sa progression, donc sa collection. Le catalogue des cartes reste disponible puisqu’il est commun à tous.

Aucun bouton indépendant « débloquer une carte » ni écriture `collection:ID` n’est créé. Les favoris, albums manuels, cartes échangées, raretés, notes privées ou notifications ne sont pas ajoutés dans cette étape.

## Vérifications et raccordement restant

77 tests Node ciblés passent pour comptes, profil, progression, planning, multijoueur et collection. Les dix nouveaux tests couvrent le catalogue réel, les leçons sans carte, les modules complets, les échéances, deux lecteurs simulés, les comptes distincts, les suppressions et les erreurs réseau. `supabase/tests/collection_personnelle.sql` passe contre les RPC et RLS réels puis annule toutes ses données de test.

Il reste à relier l’écran Collection à cette lecture, gérer son cache et les changements de compte, inclure les modules dans le build Capacitor et vérifier réellement les vues web/iPhone à l’activation. Le moteur de synchronisation et les comptes restent désactivés dans l’application.
