/* Un cours texte complet, gardé comme exemple pour les tests : l’ancienne leçon 64, CREATE VIEW en texte (situation, problème
   animé, mission, étapes avec leurs cadres Exécuter, carte « Mission accomplie » avec son dashboard, exercice), telle qu’elle était
   jusqu’au 26 octobre 2026. Elle est devenue le chapitre 16 du projet, en vidéo (assets/anim/projet-vue.html) ; il ne reste presque
   plus de cours texte dans l’app, mais le moteur des cours texte reste testé sur celui-ci (identifiant 964 : aucune leçon de l’app).
   Les tests l’évaluent dans le contexte de index.html : guide(…) renvoie la leçon. */
guide({ id:964, titre:"CREATE VIEW", résumé:"Enregistrer une requête sous un nom",
  sit:{
    blocks:[
      "L’équipe logistique prépare le réassort : chaque matin, elle consulte <b>les produits dont le stock est faible</b>, c’est-à-dire ceux qui comptent <b>moins de 50 unités</b>.",
      "La table <code>produits</code> contient au total <b>8 produits</b>. Pour préparer le réassort, l’équipe souhaite récupérer uniquement :",
      {need:[["🔢","L’identifiant du produit","table produits"],["🏷️","Son nom","table produits"],["📦","Son stock","table produits"]],label:"Les informations à récupérer"}
    ],
    problem:{
      p:["Avec <code>WHERE</code>, SQL sait déjà retrouver les produits dont le stock est inférieur à 50.","Or, la requête qui les retrouve n’est conservée nulle part : l’équipe doit la <b>réécrire à chaque consultation</b>."],
      scene:{h:"📝 Requête du matin",
        lanes:[{k:"L1",l:"Lundi",c:[["a1","SELECT id, nom, stock FROM produits WHERE stock &lt; 50;"]]},
          {k:"L2",l:"Mardi",c:[["b1","SELECT id, nom, stock FROM produits WHERE stock &lt; 50;"]]},
          {k:"L3",l:"Mercredi",c:[["c1","SELECT id, nom, stock FROM produits WHERE stock &lt; 50;"]]}],
        caps:["<b>Notre pratique</b> · Chaque matin, l’équipe écrit la requête qui affiche les produits à stock faible.","<b>Besoin</b> · Retaper trois fois la même requête fait perdre du temps et expose aux fautes de frappe.","<b>Résultat</b> · La requête ne devrait être écrite qu’une seule fois."],
        steps:[{cap:0,on:["L1","L2","L3"],d:2000},{cap:1,off:["L1","L2","L3"],mark:{a1:"is-miss",b1:"is-miss",c1:"is-miss"},d:2400},{cap:2,unmark:{a1:"is-miss",b1:"is-miss",c1:"is-miss"},fold:["L2","L3"],on:["L1"],d:2600}]},
      then:["Il faut donc indiquer à SQL de <b>conserver cette requête</b>, pour la rappeler sans la réécrire.","C’est exactement le rôle de <code>CREATE VIEW</code>."]
    },
    mission:"Aide l’équipe logistique à enregistrer, sous le nom <b>produits_stock_faible</b>, la requête qui affiche l’<b>identifiant</b>, le <b>nom</b> et le <b>stock</b> des produits de <b>moins de 50 unités</b>, afin de la consulter chaque matin sans la réécrire."
  },
  concept:{
    title:"Comment SQL peut-il savoir quelle requête conserver ?",
    blocks:[
      "Pour conserver une requête, SQL doit connaître deux choses :",
      {ask:"Quel nom lui donner, et quelle requête enregistrer ?"},
      "En SQL, on écrit le nom après <code>CREATE VIEW</code>, puis la requête après <code>AS</code>. La requête ainsi conservée s’appelle une <b>vue</b> :",
      {syntax:"⟦CREATE VIEW produits_premium AS⟧\nSELECT nom, prix\nFROM produits\nWHERE prix > 30;"},
      {scene:{h:"🔖 De la requête à la vue",
        lanes:[{k:"Q",l:"La requête",c:[["q1","SELECT nom, prix FROM produits WHERE prix &gt; 30"]]},
          {k:"V",l:"La vue enregistrée",fold:true,c:[["v1","produits_premium"]]},
          {k:"R",l:"Quand on la consulte",fold:true,cls:"is-goal",c:[["r1","Collagène Marin · 39.9"],["r2","Protéine Végétale · 34.9"]]}],
        caps:["<b>La requête</b> · Elle retrouve les produits à plus de 30 €.","<b>CREATE VIEW</b> · SQL l’enregistre sous un nom : il retient la requête, pas son résultat.","<b>SELECT * FROM produits_premium</b> · Consulter la vue exécute la requête enregistrée et affiche son résultat."],
        steps:[{cap:0,on:["Q"],d:2000},{cap:1,off:["Q"],unfold:["V"],on:["V"],d:2500},{cap:2,off:["V"],unfold:["R"],on:["R"],d:2800}]}}
    ]
  },
  steps:[
    {h:"Créer puis consulter une vue",blocks:[
      "<code>CREATE VIEW</code> enregistre la requête sans rien afficher. La vue se consulte ensuite avec un <code>SELECT</code>, comme une table :",
      {syntax:"⟦SELECT *\nFROM produits_premium;⟧"},
      {say:"👇 Exécute ces instructions pour créer la vue, puis la consulter :",run:"CREATE VIEW produits_premium AS\nSELECT nom, prix\nFROM produits\nWHERE prix > 30;\n\nSELECT *\nFROM produits_premium;"},
      {arrow:"La vue renvoie les 2 produits à plus de 30 € : le Collagène Marin et la Protéine Végétale."},
      {tip:{t:"Supprimer une vue",blocks:["<code>DROP VIEW produits_premium;</code> supprime la vue, jamais les données de la table qu’elle consultait."]}},
      {tip:{t:"Une copie pour s’exercer",blocks:["Chaque exécution part d’une <b>copie neuve</b> de la base : tu peux créer des vues sans rien encombrer. À chaque essai, la vue <code>produits_premium</code> n’existe plus : voilà pourquoi chaque exemple la recrée avant de la consulter."]}}
    ]},
    {h:"Filtrer et trier une vue",blocks:[
      "Une vue se filtre et se trie comme une table. Elle est surtout précieuse avec une requête longue : ici, deux jointures relient chaque commande à son client et à son produit.",
      {say:"👇 Exécute ces instructions pour créer la vue <code>detail_commandes</code>, puis la filtrer et la trier :",run:"CREATE VIEW detail_commandes AS\nSELECT commandes.id,\n       clients.prenom AS client,\n       produits.nom AS produit,\n       commandes.quantite\nFROM commandes\nJOIN clients\n  ON commandes.client_id = clients.id\nJOIN produits\n  ON commandes.produit_id = produits.id;\n\nSELECT client, produit\nFROM detail_commandes\nWHERE quantite >= 3\nORDER BY client;"},
      {arrow:"Les deux jointures restent cachées dans la vue. Trois commandes comptent au moins 3 unités."}
    ]},
    {h:"Une vue suit les données",blocks:[
      "Et si les données changent après la création de la vue ? La Fibre Prébiotique passe à 31 € : elle dépasse maintenant le seuil des 30 €.",
      {say:"👇 Exécute ces instructions pour voir si la vue en tient compte :",run:"CREATE VIEW produits_premium AS\nSELECT nom, prix\nFROM produits\nWHERE prix > 30;\n\nUPDATE produits\nSET prix = 31\nWHERE id = 1;\n\nSELECT *\nFROM produits_premium;"},
      {arrow:"La Fibre Prébiotique est entrée dans la vue sans aucune recréation."},
      {warn:{t:"Une copie ne suit pas",blocks:[
        "<code>CREATE TABLE … AS SELECT</code> ressemble à une vue, mais il <b>copie</b> les lignes au moment où il s’exécute.",
        {say:"👇 Teste par toi-même :",run:"CREATE TABLE copie_premium AS\nSELECT nom, prix\nFROM produits\nWHERE prix > 30;\n\nUPDATE produits\nSET prix = 31\nWHERE id = 1;\n\nSELECT *\nFROM copie_premium;"},
        "La copie date de sa création : la Fibre Prébiotique n’y figure pas."
      ]}},
      {tip:{t:"Une vue se consulte, elle ne se modifie pas",blocks:["Dans SQLite, une vue ne se modifie pas directement : un <code>INSERT</code>, un <code>UPDATE</code> ou un <code>DELETE</code> adressé à une vue provoque une erreur. Les modifications se font sur la table d’origine."]}}
    ]},
    {h:"La requête complète",blocks:[
      "Il ne reste plus qu’à construire la requête complète : donner un nom à la vue, puis y enregistrer la requête qui retrouve les produits de moins de 50 unités.",
      {say:"👇 Exécute les instructions pour créer la vue et consulter les produits à réapprovisionner :",run:"CREATE VIEW produits_stock_faible AS\nSELECT id, nom, stock\nFROM produits\nWHERE stock < 50;\n\nSELECT *\nFROM produits_stock_faible;"},
      {done:{
        label:"De 8 produits aux produits à réapprovisionner",
        funnel:[
          {n:8,t:"produits au départ",s:"toute la <code>table produits</code>",dots:"00000000"},
          {step:"CREATE VIEW produits_stock_faible",s:"enregistre la requête : la vue ne présente que les produits de moins de 50 unités"},
          {n:2,t:"⭐ produits à réapprovisionner",s:"Protéine Végétale et Shaker Inox",dots:"00000101",out:true}
        ],
        board:{ico:"🔖",h:"Vue produits_stock_faible",aria:"Chaque matin, la vue produits_stock_faible affiche les 2 produits de moins de 50 unités, sans réécrire la requête",kpi:"Moins de 50 unités",chart:"stock par produit",bar:2,cols:["id", "nom", "stock"],
          rows:[[6, "Protéine Végétale", 45], [8, "Shaker Inox", 30]],done:"✓ Liste prête pour le réassort du matin"},
        fill:["CREATE VIEW","produits_stock_faible","AS","50"],
        ui:{t:"2 produits à réapprovisionner",s:"La requête est enregistrée : chaque matin, il suffit de consulter la vue.",n:["CREATE VIEW","AS","SELECT","FROM","WHERE"]},
        rows:2
      }}
    ]}
  ],
  reflex:[
    {recap:[
      ["🔖","<code>CREATE VIEW</code> <b>enregistre une requête</b> sous un nom.","La vue ne copie aucune donnée : elle suit toujours celles de la table."],
      ["📍","Le nom se place après <code>CREATE VIEW</code>, la requête après <code>AS</code> :",null,"CREATE VIEW nom AS SELECT …"],
      ["🔎","On <b>consulte la vue comme une table</b> :",null,"SELECT * FROM produits_stock_faible"]
    ],label:"Les trois idées à retenir"}
  ],
  anatomie:[{tok:"CREATE VIEW",txt:"Crée une vue."},{tok:"produits_premium",plain:1,txt:"Le nom donné à la vue."},{tok:"AS",txt:"Introduit la requête enregistrée."},{tok:"SELECT nom, prix FROM produits WHERE prix > 30",plain:1,txt:"La requête que la vue retient et relance à chaque consultation."}],
  exemple:"CREATE VIEW produits_premium AS SELECT nom, prix FROM produits WHERE prix > 30; SELECT * FROM produits_premium;",
  attendu:"<b>2 lignes</b> : le Collagène Marin (39,90 €) et la Protéine Végétale (34,90 €), les deux produits à plus de 30 €. La vue ne contient aucune copie : elle retient la requête.",
  retenir:"<code>CREATE VIEW</code> enregistre une requête sous un nom : c’est une vue.<br>Elle ne copie rien : à chaque consultation, SQL relance la requête sur les données actuelles.<br><br>Le nom se place après <code>CREATE VIEW</code>, la requête après <code>AS</code> : <code>CREATE VIEW nom AS SELECT …</code><br><br>On consulte la vue comme une table. <code>DROP VIEW</code> la supprime, sans toucher aux données.",
  consigne:"Enregistre sous le nom <code>clients_paris</code> la requête qui affiche le <code>prenom</code>, le <code>nom</code> et l’<code>email</code> des clients qui habitent à Paris.",
  solution:"CREATE VIEW clients_paris AS\nSELECT prenom, nom, email\nFROM clients\nWHERE ville = 'Paris';",
  verif:"SELECT prenom, nom, email FROM clients_paris ORDER BY prenom, nom;",
  write:true,
  indice:"Écris <code>CREATE VIEW clients_paris AS</code>, puis la requête <code>SELECT</code> avec son filtre sur la colonne <code>ville</code>.",
  petitDefi:[{p:"Quel mot-clé introduit la requête que la vue doit enregistrer ?",sql:"CREATE VIEW commandes_en_cours __________\nSELECT id, numero_commande\nFROM commandes\nWHERE statut = 'en_preparation';",a:"AS",answers:["AS","as"]}],
  testeVariants:[{k:"base",label:"Créer la vue",sql:"CREATE VIEW produits_stock_faible AS\nSELECT id, nom, stock\nFROM produits\nWHERE stock < 50;\n\nSELECT *\nFROM produits_stock_faible;",expectRows:2},{k:"rec_source",label:"La source évolue",sql:"CREATE VIEW produits_stock_faible AS SELECT id, nom, stock FROM produits WHERE stock < 50; UPDATE produits SET stock = 45 WHERE id = 5; SELECT * FROM produits_stock_faible ORDER BY id;",out:"La Tisane Détox entre dans la vue sans recréer celle-ci.",expectRows:3}],
  learningCheck:{question:"Un produit passe sous 50 unités de stock. Faut-il recréer la vue produits_stock_faible pour qu’il y apparaisse ?",options:["Oui, la vue garde une copie figée des données","Oui, il faut la supprimer puis la recréer","Non, la vue relance sa requête à chaque consultation"],answer:2,explanation:"Une vue retient une requête, pas une copie des données : chaque consultation lit l’état actuel de la table."}
})
