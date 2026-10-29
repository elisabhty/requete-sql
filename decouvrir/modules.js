/* Catalogue des modules de la vitrine (page d’accueil et module.html).

   Ajouter un module : copier l’entrée « sql » ci-dessous, changer l’id, les textes, les affiches et le programme.
   Il apparaît alors dans « Un parcours pour chaque objectif » sur la page d’accueil, et sa fiche s’ouvre sur
   module.html?m=<id>. Avec statut:'bientot', le module s’affiche en carte « Bientôt », sans fiche.

   Le programme du module SQL reprend les chapitres et les leçons de l’appli (MODULES dans ../index.html) :
   titre, résumé et durée de la vidéo en secondes. tests/vitrine-modules.test.mjs vérifie qu’il reste à jour. */
window.MODULES=[
{
  id:'sql',
  statut:'disponible',
  titre:'SQL, de zéro à avancé',
  nom:'SQL',
  accroche:'Interroger, croiser et analyser des données avec le langage n°1 des data analysts, sur une vraie base.',
  apropos:[
    'Le SQL est la langue des bases de données : c’est avec lui qu’on interroge les clients, les produits ou les commandes d’une entreprise. Ce module te l’apprend du tout premier SELECT jusqu’aux fonctions de fenêtre, aux transactions et aux droits d’accès.',
    'Chaque cours est une courte vidéo interactive qui s’arrête sur des moments « À toi » : tu écris la requête, la base te répond. Tu deviens l’analyste de NutriBoost, une boutique en ligne, et ses clients, ses produits et ses commandes servent d’exemples d’un bout à l’autre.',
    'Entre les cours, des défis métier sans filet, des révisions qui reviennent au bon moment et une console SQL libre te font pratiquer. Tu peux aussi importer tes propres fichiers Excel ou CSV et les interroger comme une vraie base.'
  ],
  niveau:{de:1,a:3,texte:'Débutant à avancé'},
  badge:'Vidéo interactive',
  defis:25,
  affiches:['where','inner-join','over'],
  details:[
    ['jeu','Gamifié et interactif'],
    ['carte','Une carte mémo à débloquer par cours'],
    ['langue','En français'],
    ['appareil','Sur ordinateur, tablette et téléphone'],
    ['horsligne','Même hors ligne, à ton rythme'],
    ['maj','Mis à jour le 29 octobre 2026']
  ],
  competences:[
    ['Interroger une base','SELECT, WHERE, ORDER BY et LIMIT pour trouver exactement les lignes et les colonnes dont tu as besoin.'],
    ['Croiser plusieurs tables','Toutes les jointures, les sous-requêtes et les CTE pour relier clients, produits et commandes.'],
    ['Analyser et résumer','Agrégats, GROUP BY, HAVING et fonctions de fenêtre pour calculer un chiffre d’affaires, un classement ou une évolution.'],
    ['Concevoir une base solide','Modéliser, créer les tables, poser les contraintes et écrire les données sans risque grâce aux transactions.'],
    ['Accélérer et protéger','Vues, index, EXPLAIN, triggers et droits d’accès, comme dans une vraie entreprise.']
  ],
  themes:['Requêtes SELECT','Filtres et tris','Fonctions','Agrégats','Jointures','Sous-requêtes','CTE','Fonctions de fenêtre','Modélisation','Création de tables','Transactions','Index et performance','Sécurité'],
  programme:[
    {titre:"Introduction", sous:"Bases de données, tables, relations et SELECT", lecons:[
      ["Les bases de données relationnelles", "Tables, clés et lecture avec SELECT", 559]
    ]},
    {titre:"Lire une table", sous:"SELECT, filtres, tri et pagination", lecons:[
      ["Renommer avec AS", "Donner un nom lisible à une colonne du résultat", 91],
      ["DISTINCT", "Valeurs uniques", 138],
      ["WHERE", "Filtrer les lignes", 109],
      ["Comparer des valeurs", "Filtrer avec =, !=, >, <, >=, <=", 128],
      ["AND et OR", "Combiner plusieurs conditions", 132],
      ["NOT", "Exclure selon une condition", 138],
      ["NULL", "La valeur absente", 113],
      ["LIKE", "Chercher un motif", 157],
      ["IN", "Filtrer avec une liste", 132],
      ["BETWEEN", "Filtrer un intervalle", 128],
      ["ORDER BY", "Ordonner le résultat", 118],
      ["LIMIT et OFFSET", "Limiter le résultat et le découper en pages", 205]
    ]},
    {titre:"Fonctions et expressions", sous:"Transformer les valeurs ligne par ligne", lecons:[
      ["Fonctions de texte", "Transformer, nettoyer et découper du texte", 188],
      ["Fonctions numériques", "Calculer, arrondir et manipuler des nombres", 138],
      ["Fonctions de dates et heures", "Obtenir, extraire et calculer avec une date", 136],
      ["Fonctions de conversion de types", "Passer d’un type à un autre", 150],
      ["CASE", "Afficher une valeur selon une condition", 144],
      ["COALESCE", "Remplacer les valeurs absentes", 138]
    ]},
    {titre:"Agrégats et regroupements", sous:"Calculer, regrouper et agréger", lecons:[
      ["COUNT", "Compter les lignes", 126],
      ["GROUP BY", "Un calcul par groupe", 129],
      ["HAVING", "Filtrer après regroupement", 133],
      ["GROUP_CONCAT", "Rassembler les textes d’un groupe", 153]
    ]},
    {titre:"Jointures", sous:"Interroger plusieurs tables à la fois", lecons:[
      ["INNER JOIN", "Associer les lignes correspondantes de deux tables", 125],
      ["LEFT JOIN", "Garder même sans correspondance", 148],
      ["RIGHT JOIN", "Tout garder à droite", 186],
      ["FULL OUTER JOIN", "Tout garder des deux côtés", 179],
      ["CROSS JOIN", "Créer toutes les combinaisons", 143],
      ["Jointure de 3 tables", "Relier toute l’histoire", 202],
      ["JOIN + GROUP BY", "Compter les commandes par ville", 154],
      ["SELF JOIN", "Retrouver les clients qui habitent dans la même ville", 161],
      ["Plusieurs conditions dans ON", "Relier seulement les produits encore en stock", 183],
      ["Quel JOIN choisir ?", "Choisir la bonne jointure selon les lignes à garder", 191]
    ]},
    {titre:"Sous-requêtes et ensembles", sous:"IN, EXISTS, CTE et UNION", lecons:[
      ["Sous-requête dans WHERE avec IN", "Quels clients ont déjà commandé du Magnésium ?", 223],
      ["Sous-requête dans SELECT", "Calculer une valeur pour chaque ligne", 192],
      ["Sous-requête dans FROM", "Utiliser une sous-requête comme table", 182],
      ["EXISTS et NOT EXISTS", "Tester la présence ou l’absence d’une ligne liée", 210],
      ["WITH (CTE)", "Créer et réutiliser un résultat intermédiaire", 209],
      ["UNION et UNION ALL", "Empiler deux résultats, avec ou sans doublons", 206],
      ["INTERSECT et EXCEPT", "Comparer deux résultats", 167],
      ["WITH RECURSIVE (CTE RECURSIVE)", "Créer une suite automatiquement", 186]
    ]},
    {titre:"Fonctions de fenêtre", sous:"Calculer sans regrouper les lignes", lecons:[
      ["OVER()", "Calculer sans regrouper les lignes", 186],
      ["Fonctions de rang", "Classer les lignes, ex æquo compris", 165],
      ["LAG et LEAD", "Comparer une ligne à la précédente ou à la suivante", 188],
      ["Fenêtres glissantes", "Suivre l’évolution des commandes", 169]
    ]},
    {titre:"Modéliser", sous:"Normalisation, cardinalités et UML", lecons:[
      ["Normaliser les inscriptions", "Du fichier Excel des ateliers aux tables", 183],
      ["Clés et relations", "Relier les tables entre elles", 282],
      ["Modéliser avec UML", "Du diagramme de classes aux tables", 297]
    ]},
    {titre:"Créer et faire évoluer les tables", sous:"CREATE, ALTER et DROP TABLE", lecons:[
      ["CREATE TABLE", "Créer la structure d’une table", 257],
      ["ALTER TABLE", "Faire évoluer la structure d’une table", 287],
      ["DROP", "Supprimer une table de la base", 156]
    ]},
    {titre:"Écrire et modifier les données", sous:"INSERT, UPDATE, DELETE", lecons:[
      ["INSERT", "Ajouter des lignes", 238],
      ["UPDATE", "Modifier des lignes", 185],
      ["DELETE", "Supprimer des lignes", 180]
    ]},
    {titre:"Contraintes et intégrité", sous:"Les règles que les données doivent respecter", lecons:[
      ["ON DELETE", "Décider du sort des lignes liées", 247]
    ]},
    {titre:"Transactions", sous:"Tout valider ou tout annuler", lecons:[
      ["Transactions", "Valider les modifications ensemble", 259],
      ["SAVEPOINT", "Annuler une partie des modifications", 253]
    ]},
    {titre:"Triggers et concurrence", sous:"Automatiser et isoler les écritures", lecons:[
      ["Les triggers", "Déclencher une action automatiquement", 247],
      ["Concurrence et isolation", "Gérer les accès simultanés", 249]
    ]},
    {titre:"Vues, index et optimisation", sous:"Structurer et accélérer", lecons:[
      ["CREATE VIEW", "Enregistrer une requête sous un nom", 232],
      ["Les index et EXPLAIN", "Accélérer une recherche et lire son plan", 205]
    ]},
    {titre:"Sécurité et droits", sous:"Contrôler les accès", lecons:[
      ["Sécurité et droits", "Contrôler les accès avec GRANT et REVOKE", 280]
    ]}
  ]
}
];

/* Outils partagés par les deux pages */
window.VITRINE={
  module:function(id){return MODULES.filter(function(m){return m.id===id;})[0]||null;},
  nbCours:function(m){return (m.programme||[]).reduce(function(s,c){return s+c.lecons.length;},0);},
  secondes:function(m){return (m.programme||[]).reduce(function(s,c){return s+c.lecons.reduce(function(t,l){return t+l[2];},0);},0);},
  /* 11 514 s → « 3 h » ; arrondi à la demi-heure, en minutes sous l’heure */
  duree:function(s){
    if(s<3600)return Math.max(1,Math.round(s/60))+' min';
    var h=Math.round(s/1800)/2;return String(h).replace('.',',')+' h';
  },
  minutes:function(s){return Math.max(1,Math.round(s/60))+' min';},
  barres:function(n){
    return '<span class="bars" aria-hidden="true">'+[1,2,3].map(function(i){return '<i'+(i>=n.de&&i<=n.a?' class="on"':'')+'></i>';}).join('')+'</span>';
  },
  ICONES:{
    horloge:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    livre:'<path d="M12 6.5C10.3 5 8 4.5 4 4.5v13c4 0 6.3.5 8 2 1.7-1.5 4-2 8-2v-13c-4 0-6.3.5-8 2Z"/><path d="M12 6.5v13"/>',
    jeu:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    carte:'<rect x="4" y="3" width="13" height="17" rx="2.5"/><path d="M8 8h5M8 12h5"/><path d="M20 7v12a2 2 0 0 1-2 2H8"/>',
    langue:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    appareil:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    horsligne:'<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
    maj:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    gratuit:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    fleche:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    lecture:'<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    ampoule:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>'
  },
  icone:function(k,ep){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(ep||2)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+this.ICONES[k]+'</svg>';},
  esc:function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
};
