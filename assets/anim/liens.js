/* Le lien avec la leçon d’avant et celle d’après (Elisa, 1er novembre, 21 h 30 : « faire ça pour toutes les leçons, vérifier la
   cohérence », sur le modèle des vidéos du projet). Les leçons dans l’ordre de l’appli : page (assets/anim/<page>.html), titre (pour
   la pastille « Prochaine leçon · … »), passe (ce que l’élève a fait : « Dans la leçon précédente, tu as… ») et futur (ce qu’il fera :
   « Dans la prochaine leçon, tu… »). Le moteur (core.js, et where.html) ajoute ces deux légendes : après l’intro, et à la fin.
   avant / apres : false quand la page dit déjà elle-même le lien (les vidéos du projet). Un test (tests/liens-lecons.test.mjs) vérifie
   que cet ordre est celui de l’appli. */
window.LIENS = [
  {page: 'bases-relationnelles', titre: 'Les bases de données relationnelles', passe: 'tu as découvert les tables, les clés et <code>SELECT</code>'},
  {page: 'as', titre: 'Renommer avec AS', passe: 'tu as renommé une colonne du résultat avec <code>AS</code>', futur: 'tu renommeras une colonne du résultat avec <code>AS</code>'},
  {page: 'distinct', titre: 'DISTINCT', passe: 'tu as affiché chaque valeur une seule fois avec <code>DISTINCT</code>', futur: 'tu afficheras chaque valeur une seule fois avec <code>DISTINCT</code>'},
  {page: 'where', titre: 'WHERE', passe: 'tu as filtré les lignes avec <code>WHERE</code>', futur: 'tu filtreras les lignes avec <code>WHERE</code>'},
  {page: 'comparer', titre: 'Comparer des valeurs', passe: 'tu as comparé des valeurs avec <code>=</code>, <code>&gt;</code> ou <code>&lt;</code>', futur: 'tu compareras des valeurs avec <code>=</code>, <code>&gt;</code> ou <code>&lt;</code>'},
  {page: 'and-or', titre: 'AND et OR', passe: 'tu as combiné plusieurs conditions avec <code>AND</code> et <code>OR</code>', futur: 'tu combineras plusieurs conditions avec <code>AND</code> et <code>OR</code>'},
  {page: 'not', titre: 'NOT', passe: 'tu as exclu des lignes avec <code>NOT</code>', futur: 'tu excluras des lignes avec <code>NOT</code>'},
  {page: 'null', titre: 'NULL', passe: 'tu as repéré les valeurs absentes avec <code>IS NULL</code> et <code>IS NOT NULL</code>', futur: 'tu repéreras les valeurs absentes avec <code>IS NULL</code> et <code>IS NOT NULL</code>'},
  {page: 'like', titre: 'LIKE', passe: 'tu as cherché un motif dans un texte avec <code>LIKE</code>', futur: 'tu chercheras un motif dans un texte avec <code>LIKE</code>'},
  {page: 'in', titre: 'IN', passe: 'tu as filtré avec une liste de valeurs grâce à <code>IN</code>', futur: 'tu filtreras avec une liste de valeurs grâce à <code>IN</code>'},
  {page: 'between', titre: 'BETWEEN', passe: 'tu as filtré un intervalle avec <code>BETWEEN</code>', futur: 'tu filtreras un intervalle avec <code>BETWEEN</code>'},
  {page: 'order-by', titre: 'ORDER BY', passe: 'tu as trié le résultat avec <code>ORDER BY</code>', futur: 'tu trieras le résultat avec <code>ORDER BY</code>'},
  {page: 'limit-offset', titre: 'LIMIT et OFFSET', passe: 'tu as limité le résultat et tu l’as découpé en pages avec <code>LIMIT</code> et <code>OFFSET</code>', futur: 'tu limiteras le résultat et tu le découperas en pages avec <code>LIMIT</code> et <code>OFFSET</code>'},
  {page: 'fonctions-texte', titre: 'Fonctions de texte', passe: 'tu as transformé et nettoyé du texte avec les fonctions de texte', futur: 'tu transformeras et nettoieras du texte avec les fonctions de texte'},
  {page: 'fonctions-numeriques', titre: 'Fonctions numériques', passe: 'tu as calculé et arrondi des nombres avec les fonctions numériques', futur: 'tu calculeras et arrondiras des nombres avec les fonctions numériques'},
  {page: 'fonctions-dates', titre: 'Fonctions de dates et heures', passe: 'tu as calculé avec des dates grâce aux fonctions de dates', futur: 'tu calculeras avec des dates grâce aux fonctions de dates'},
  {page: 'conversion-types', titre: 'Fonctions de conversion de types', passe: 'tu as converti une valeur d’un type à un autre', futur: 'tu convertiras une valeur d’un type à un autre'},
  {page: 'case', titre: 'CASE', passe: 'tu as affiché une valeur selon une condition avec <code>CASE</code>', futur: 'tu afficheras une valeur selon une condition avec <code>CASE</code>'},
  {page: 'coalesce', titre: 'COALESCE', passe: 'tu as remplacé les valeurs absentes avec <code>COALESCE</code>', futur: 'tu remplaceras les valeurs absentes avec <code>COALESCE</code>'},
  {page: 'count', titre: 'COUNT', passe: 'tu as compté des lignes avec <code>COUNT</code>', futur: 'tu compteras des lignes avec <code>COUNT</code>'},
  {page: 'group-by', titre: 'GROUP BY', passe: 'tu as fait un calcul par groupe avec <code>GROUP BY</code>', futur: 'tu feras un calcul par groupe avec <code>GROUP BY</code>'},
  {page: 'having', titre: 'HAVING', passe: 'tu as filtré des groupes avec <code>HAVING</code>', futur: 'tu filtreras des groupes avec <code>HAVING</code>'},
  {page: 'group-concat', titre: 'GROUP_CONCAT', passe: 'tu as rassemblé les textes d’un groupe avec <code>GROUP_CONCAT</code>', futur: 'tu rassembleras les textes d’un groupe avec <code>GROUP_CONCAT</code>'},
  {page: 'inner-join', titre: 'INNER JOIN', passe: 'tu as associé deux tables avec <code>INNER JOIN</code>', futur: 'tu associeras deux tables avec <code>INNER JOIN</code>'},
  {page: 'left-join', titre: 'LEFT JOIN', passe: 'tu as gardé toutes les lignes de la table de gauche avec <code>LEFT JOIN</code>', futur: 'tu garderas toutes les lignes de la table de gauche avec <code>LEFT JOIN</code>'},
  {page: 'right-join', titre: 'RIGHT JOIN', passe: 'tu as gardé toutes les lignes de la table de droite avec <code>RIGHT JOIN</code>', futur: 'tu garderas toutes les lignes de la table de droite avec <code>RIGHT JOIN</code>'},
  {page: 'full-outer-join', titre: 'FULL OUTER JOIN', passe: 'tu as gardé les lignes des deux tables avec <code>FULL OUTER JOIN</code>', futur: 'tu garderas les lignes des deux tables avec <code>FULL OUTER JOIN</code>'},
  {page: 'cross-join', titre: 'CROSS JOIN', passe: 'tu as créé toutes les combinaisons avec <code>CROSS JOIN</code>', futur: 'tu créeras toutes les combinaisons avec <code>CROSS JOIN</code>'},
  {page: 'jointure-3-tables', titre: 'Jointure de 3 tables', passe: 'tu as relié trois tables dans une même requête', futur: 'tu relieras trois tables dans une même requête'},
  {page: 'join-group-by', titre: 'JOIN + GROUP BY', passe: 'tu as compté les commandes par ville en reliant deux tables', futur: 'tu compteras les commandes par ville en reliant deux tables'},
  {page: 'self-join', titre: 'SELF JOIN', passe: 'tu as relié une table à elle-même avec un <code>SELF JOIN</code>', futur: 'tu relieras une table à elle-même avec un <code>SELF JOIN</code>'},
  {page: 'plusieurs-conditions-on', titre: 'Plusieurs conditions dans ON', passe: 'tu as mis plusieurs conditions dans <code>ON</code>', futur: 'tu mettras plusieurs conditions dans <code>ON</code>'},
  {page: 'quel-join-choisir', titre: 'Quel JOIN choisir ?', passe: 'tu as choisi la jointure selon les lignes à garder', futur: 'tu choisiras la jointure selon les lignes à garder'},
  {page: 'sous-requete-in', titre: 'Sous-requête dans WHERE avec IN', passe: 'tu as filtré avec une sous-requête dans <code>WHERE</code>', futur: 'tu filtreras avec une sous-requête dans <code>WHERE</code>'},
  {page: 'sous-requete-select', titre: 'Sous-requête dans SELECT', passe: 'tu as calculé une valeur par ligne avec une sous-requête dans <code>SELECT</code>', futur: 'tu calculeras une valeur par ligne avec une sous-requête dans <code>SELECT</code>'},
  {page: 'sous-requete-from', titre: 'Sous-requête dans FROM', passe: 'tu as utilisé une sous-requête comme une table dans <code>FROM</code>', futur: 'tu utiliseras une sous-requête comme une table dans <code>FROM</code>'},
  {page: 'exists', titre: 'EXISTS et NOT EXISTS', passe: 'tu as testé la présence ou l’absence d’une ligne liée avec <code>EXISTS</code> et <code>NOT EXISTS</code>', futur: 'tu testeras la présence ou l’absence d’une ligne liée avec <code>EXISTS</code> et <code>NOT EXISTS</code>'},
  {page: 'with-cte', titre: 'WITH (CTE)', passe: 'tu as réutilisé un résultat intermédiaire avec <code>WITH</code>', futur: 'tu réutiliseras un résultat intermédiaire avec <code>WITH</code>'},
  {page: 'union', titre: 'UNION et UNION ALL', passe: 'tu as empilé deux résultats avec <code>UNION</code> et <code>UNION ALL</code>', futur: 'tu empileras deux résultats avec <code>UNION</code> et <code>UNION ALL</code>'},
  {page: 'intersect-except', titre: 'INTERSECT et EXCEPT', passe: 'tu as comparé deux résultats avec <code>INTERSECT</code> et <code>EXCEPT</code>', futur: 'tu compareras deux résultats avec <code>INTERSECT</code> et <code>EXCEPT</code>'},
  {page: 'with-recursive', titre: 'WITH RECURSIVE (CTE RECURSIVE)', passe: 'tu as créé une suite de valeurs avec <code>WITH RECURSIVE</code>', futur: 'tu créeras une suite de valeurs avec <code>WITH RECURSIVE</code>'},
  {page: 'over', titre: 'OVER()', passe: 'tu as calculé sans regrouper les lignes avec <code>OVER()</code>', futur: 'tu calculeras sans regrouper les lignes avec <code>OVER()</code>'},
  {page: 'fonctions-rang', titre: 'Fonctions de rang', passe: 'tu as classé les lignes avec les fonctions de rang', futur: 'tu classeras les lignes avec les fonctions de rang'},
  {page: 'lag-lead', titre: 'LAG et LEAD', passe: 'tu as comparé chaque ligne à sa voisine avec <code>LAG</code> et <code>LEAD</code>', futur: 'tu compareras chaque ligne à sa voisine avec <code>LAG</code> et <code>LEAD</code>'},
  {page: 'fenetres-glissantes', titre: 'Fenêtres glissantes', passe: 'tu as suivi un total cumulé avec une fenêtre glissante', futur: 'tu suivras un total cumulé avec une fenêtre glissante'},
  /* Le projet : ses vidéos disent elles-mêmes le lien (« Dans la leçon précédente… », « Dans la prochaine leçon… »), sauf l’entrée du projet. */
  {page: 'projet-normaliser', titre: 'Normaliser les inscriptions', futur: 'tu commenceras le projet : la base des ateliers bien-être de NutriBoost', apres: false},
  {page: 'projet-cles', titre: 'Clés et relations', avant: false, apres: false},
  {page: 'projet-uml', titre: 'Modéliser avec UML', avant: false, apres: false},
  {page: 'projet-create', titre: 'CREATE TABLE', avant: false, apres: false},
  {page: 'projet-alter', titre: 'ALTER TABLE', avant: false, apres: false},
  {page: 'projet-drop', titre: 'DROP', avant: false, apres: false},
  {page: 'projet-schemas', titre: 'Les schémas', avant: false, apres: false},
  {page: 'projet-insert', titre: 'INSERT', avant: false, apres: false},
  {page: 'projet-update', titre: 'UPDATE', avant: false, apres: false},
  {page: 'projet-merge', titre: 'MERGE', avant: false, apres: false},
  {page: 'projet-delete', titre: 'DELETE', avant: false, apres: false},
  {page: 'projet-ondelete', titre: 'ON DELETE', avant: false, apres: false},
  {page: 'projet-transaction', titre: 'Transactions', avant: false, apres: false},
  {page: 'projet-savepoint', titre: 'SAVEPOINT', avant: false, apres: false},
  {page: 'projet-procedures', titre: 'Procédures et fonctions stockées', avant: false, apres: false},
  {page: 'projet-trigger', titre: 'Les triggers', avant: false, apres: false},
  {page: 'projet-concurrence', titre: 'Concurrence et isolation', avant: false, apres: false},
  {page: 'projet-vue', titre: 'CREATE VIEW', avant: false, apres: false},
  {page: 'projet-index', titre: 'Les index et EXPLAIN', avant: false, apres: false},
  {page: 'projet-droits', titre: 'Sécurité et droits', avant: false, apres: false}
];
/* Les deux légendes d’une page (null : rien à ajouter) : {avant: html, apres: html, suite: titre de la leçon d’après}. */
window.liensDe = function (page) {
  const L = window.LIENS, i = L.findIndex(x => x.page === page);
  if (i < 0) return null;
  const me = L[i], prev = L[i - 1], next = L[i + 1], out = {};
  if (prev && prev.passe && me.avant !== false) out.avant = `Dans la leçon précédente, ${prev.passe}.`;
  if (next && next.futur && me.apres !== false) { out.apres = `Dans la prochaine leçon, ${next.futur}.`; out.suite = next.titre; }
  return out.avant || out.apres ? out : null;
};
