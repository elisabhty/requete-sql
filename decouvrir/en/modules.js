/* Catalogue des modules de la vitrine (page d’accueil et module.html).

   Ajouter un module : copier l’entrée « sql » ci-dessous, changer l’id, les textes, les affiches et le programme.
   Il apparaît alors dans « Un parcours pour chaque objectif » sur la page d’accueil, et sa fiche s’ouvre sur
   module.html?m=<id>. Avec statut:'bientot', le module s’affiche en carte « Bientôt », sans fiche.

   Le programme du parcours SQL reprend les modules (chapitres) et les leçons de l’appli (MODULES dans ../index.html) :
   titre, résumé et durée de la vidéo en secondes. tests/vitrine-modules.test.mjs vérifie qu’il reste à jour. */
window.MODULES=[
{
  id:'sql',
  statut:'disponible',
  titre:'SQL, from zero to advanced',
  nom:'SQL',
  accroche:'Learn to query, combine and analyze data, from your first queries to advanced techniques. Progress at your own pace by practicing right on a real database.',
  apropos:[
    'Learn SQL step by step, from your first queries to the most advanced concepts: joins, window functions, transactions and much more. No prior knowledge needed.',
    'Here, you don’t just watch: you practice. Each lesson is an immersive, interactive video. At every step, you write your own queries, run them and see the results right away.',
    'Throughout the path, you play a Data Analyst at NutriBoost, an online store. Through real-life situations, you explore its customer, product and order data to solve genuine business problems.',
    'To keep progressing, you also get case studies, reviews, challenges and a SQL lab with open access. You can even import your own Excel or CSV files to practice on your data.',
    'Your goal: understand SQL, know how to use it and become independent.'
  ],
  niveau:{de:1,a:3,texte:'Beginner to advanced'},
  badge:'Interactive video',
  defis:477,
  cartes:47,
  affiches:['where','inner-join','over'],
  details:[
    ['jeu','Gamified and interactive'],
    ['carte','Flashcards to unlock as you go'],
    ['langue','In English'],
    ['appareil','On iPhone'],
    ['horsligne','Even offline, at your own pace'],
    ['maj','Updated November 3, 2026']
  ],
  competences:[
    ['Query a database','SELECT, WHERE, ORDER BY and LIMIT to find exactly the rows and columns you need.'],
    ['Combine several tables','Every kind of join, subqueries and CTEs to link customers, products and orders.'],
    ['Analyze and summarize','Aggregates, GROUP BY, HAVING and window functions to compute revenue, a ranking or a trend.'],
    ['Design a solid database','Model, create the tables, set constraints and write data safely with transactions.'],
    ['Speed up and protect','Views, indexes, EXPLAIN, triggers and access rights, just like in a real company.']
  ],
  themes:['SELECT queries','Filters and sorting','Fonctions','Aggregates','Joins','Subqueries','CTE','Window functions','Modeling','Creating tables','Transactions','Indexes and performance','Security'],
  programme:[
    {titre:"Introduction", sous:"Databases, tables, relationships and SELECT", lecons:[
      ["Relational databases", "Tables, keys and reading with SELECT", 648]
    ]},
    {titre:"Reading a table", sous:"SELECT, filters, sorting and pagination", lecons:[
      ["Renaming with AS", "Give a result column a readable name", 107],
      ["DISTINCT", "Unique values", 153],
      ["WHERE", "Filtering rows", 126],
      ["Comparing values", "Filtering with =, !=, >, <, >=, <=", 162],
      ["AND and OR", "Combining several conditions", 156],
      ["NOT", "Excluding based on a condition", 171],
      ["NULL", "The missing value", 130],
      ["LIKE", "Searching for a pattern", 191],
      ["IN", "Filtering with a list", 160],
      ["BETWEEN", "Filtering a range", 157],
      ["ORDER BY", "Sorting the result", 135],
      ["LIMIT and OFFSET", "Limiting the result and splitting it into pages", 234]
    ]},
    {titre:"Functions and expressions", sous:"Transforming values row by row", lecons:[
      ["Text functions", "Transforming, cleaning and slicing text", 217],
      ["Numeric functions", "Calculating, rounding and handling numbers", 169],
      ["Date and time functions", "Getting, extracting and calculating with a date", 170],
      ["Type conversion functions", "Going from one type to another", 185],
      ["CASE", "Showing a value based on a condition", 165],
      ["COALESCE", "Replacing missing values", 153]
    ]},
    {titre:"Aggregates and grouping", sous:"Calculating, grouping and aggregating", lecons:[
      ["COUNT", "Counting rows", 145],
      ["SUM, AVG, MIN and MAX", "Sum, average, minimum and maximum", 180],
      ["GROUP BY", "One calculation per group", 150],
      ["GROUP BY on several columns", "One group per combination of values", 204],
      ["HAVING", "Filtering after grouping", 155],
      ["Order of execution", "In what order a query runs", 204],
      ["GROUP_CONCAT", "Combine the texts of a group", 173]
    ]},
    {titre:"Joins", sous:"Querying several tables at once", lecons:[
      ["INNER JOIN", "Matching the corresponding rows of two tables", 152],
      ["LEFT JOIN", "Keeping rows even without a match", 167],
      ["RIGHT JOIN", "Keeping everything on the right", 204],
      ["FULL OUTER JOIN", "Keeping everything on both sides", 196],
      ["CROSS JOIN", "Creating every combination", 159],
      ["Joining 3 tables", "Linking the whole story", 228],
      ["JOIN + GROUP BY", "Counting orders by city", 169],
      ["SELF JOIN", "Comparing rows of the same table", 193],
      ["Several conditions in ON", "Linking only the orders to deliver to Paris", 205],
      ["Which JOIN should you choose?", "Choosing the right join for the rows you need", 211]
    ]},
    {titre:"Subqueries and sets", sous:"IN, EXISTS, CTE and UNION", lecons:[
      ["Subquery in WHERE with IN", "Filtering with the list returned by a subquery", 237],
      ["Subquery in SELECT", "Calculating a value for each row", 205],
      ["Subquery in FROM", "Using a subquery as a table", 201],
      ["INSERT … SELECT and CREATE TABLE AS", "Saving the result of a query", 196],
      ["EXISTS and NOT EXISTS", "Testing whether a linked row exists or not", 235],
      ["ANY and ALL", "Comparing against a whole list", 215],
      ["WITH (CTE)", "Creating and reusing an intermediate result", 237],
      ["UNION and UNION ALL", "Stacking two results, with or without duplicates", 223],
      ["INTERSECT and EXCEPT", "Comparing two results", 179],
      ["WITH RECURSIVE (recursive CTE)", "Generating a sequence automatically", 208]
    ]},
    {titre:"Window functions", sous:"Calculating without grouping rows", lecons:[
      ["OVER()", "Calculating without grouping rows", 202],
      ["Ranking functions", "Ranking rows, ties included", 178],
      ["LAG and LEAD", "Comparing a row to the previous or the next one", 203],
      ["Sliding windows", "Tracking how orders change over time", 185],
      ["FIRST_VALUE, LAST_VALUE and NTILE", "First and last value, equal groups", 219]
    ]},
    {titre:"Modeling", sous:"Normalization, cardinalities and UML", lecons:[
      ["Normalizing enrollments", "From the workshops Excel file to tables", 238],
      ["Keys and relationships", "Linking tables together", 307],
      ["Modeling with UML", "From the class diagram to tables", 322]
    ]},
    {titre:"Creating and evolving tables", sous:"CREATE, ALTER and DROP TABLE", lecons:[
      ["CREATE TABLE", "Creating a table’s structure", 276],
      ["ALTER TABLE", "Changing a table’s structure", 298],
      ["DROP", "Removing a table from the database", 160],
      ["Schemas", "Organizing tables into namespaces", 144]
    ]},
    {titre:"Writing and changing data", sous:"INSERT, UPDATE, DELETE", lecons:[
      ["INSERT", "Adding rows", 243],
      ["UPDATE", "Changing rows", 192],
      ["MERGE", "Syncing two tables", 191],
      ["DELETE", "Deleting rows", 183]
    ]},
    {titre:"Integrity of linked tables", sous:"What happens to linked rows", lecons:[
      ["ON DELETE", "Deciding what happens to linked rows", 256]
    ]},
    {titre:"Transactions and concurrency", sous:"Commit all, roll back all, without conflicts", lecons:[
      ["Transactions", "Committing changes together", 283],
      ["SAVEPOINT", "Rolling back part of the changes", 259],
      ["Concurrency and isolation", "Handling simultaneous access", 255]
    ]},
    {titre:"Procedures and triggers", sous:"Automating processing", lecons:[
      ["Stored procedures and functions", "Reusing a process or a calculation", 197],
      ["Triggers", "Triggering an action automatically", 262]
    ]},
    {titre:"Views, indexes and optimization", sous:"Structuring and speeding up", lecons:[
      ["CREATE VIEW", "Saving a query under a name", 244],
      ["Indexes and EXPLAIN", "Speeding up a search and reading its plan", 217]
    ]},
    {titre:"Security and permissions", sous:"Controlling access", lecons:[
      ["Security and permissions", "Controlling access with GRANT and REVOKE", 287]
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
    fleche:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    lecture:'<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    ampoule:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>'
  },
  icone:function(k,ep){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(ep||2)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+this.ICONES[k]+'</svg>';},
  esc:function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
};
