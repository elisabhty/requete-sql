/* Un cours texte complet, gardé comme exemple pour les tests : l’ancienne leçon 57, Les index et EXPLAIN en texte (la commande
   retrouvée par son numéro, l’objet à thème « outil interne » de la carte « Mission accomplie », la ligne du plan, le tampon
   « Accès direct »), telle qu’elle était jusqu’au 26 octobre 2026. Elle est devenue le chapitre 16 du projet, en vidéo
   (assets/anim/projet-index.html) ; le moteur des cours texte reste testé sur celui-ci (identifiant 957 : aucune leçon de l’app).
   Les tests l’évaluent dans le contexte de index.html : guide(…) renvoie la leçon. */
guide({ id:957, titre:"Les index et EXPLAIN", résumé:"Accélérer une recherche et lire son plan",
  sit:{
    blocks:[
      "L’équipe commerciale répond chaque jour à des clients qui veulent connaître l’état de leur commande. Pour la retrouver, elle n’a qu’une information : <b>son numéro</b>.",
      "La table <code>commandes</code> contient aujourd’hui <b>16 commandes</b>, mais la boutique en comptera bientôt des millions. Pour répondre à un client, l’équipe souhaite récupérer uniquement :",
      {need:[["📅","La date de la commande","table commandes"],["🚚","Son statut","table commandes"],["🔢","La quantité commandée","table commandes"]],label:"Les informations à récupérer"}
    ],
    problem:{
      p:["Avec <code>WHERE</code>, SQL sait déjà retrouver la commande qui porte un numéro donné.","Or, rien n’indique à SQL <b>où</b> se trouve ce numéro : il doit <b>lire les commandes une par une</b>."],
      scene:{h:"🔎 Recherche d’un numéro",cols:".4fr 1.6fr",
        lanes:[{c:[["h1","id","t"],["h2","numero_commande","t"]]},
          {k:"R1",c:[["a1","1"],["a2","CMD-2026-1002481"]]},
          {k:"R2",c:[["b1","2"],["b2","CMD-2026-1003912"]]},
          {k:"R3",c:[["c1","3"],["c2","CMD-2026-1015630"]]},
          {k:"R4",c:[["d1","…"],["d2","…"]]},
          {k:"R5",c:[["e1","14"],["e2","CMD-2026-1847392"]]}],
        caps:["<b>Notre table</b> · Les commandes sont rangées dans l’ordre d’arrivée : rien n’indique où se trouve un numéro.","<b>Recherche</b> · L’équipe cherche <b>CMD-2026-1847392</b>, un numéro parmi des millions.","<b>Besoin</b> · Seule cette ligne nous intéresse."],
        steps:[{cap:0,on:["R1","R2","R3","R4","R5"],d:1900},{cap:1,off:["R1","R2","R3","R4"],dim:["R1","R2","R3","R4"],d:2300},{cap:2,fold:["R1","R2","R3","R4"],d:2600}]},
      then:["Il faut donc donner à SQL un moyen d’aller <b>directement</b> à la ligne cherchée, sans lire toute la table.","C’est exactement le rôle d’un <code>INDEX</code>."]
    },
    mission:"Aide l’équipe commerciale à retrouver plus vite la <b>date</b>, le <b>statut</b> et la <b>quantité</b> d’une commande à partir de son <b>numéro</b>, en créant l’index <b>idx_commandes_numero</b> sur la colonne <b>numero_commande</b>, afin que SQL n’ait plus à parcourir toute la table."
  },
  concept:{
    title:"Comment SQL peut-il savoir où se trouve une commande ?",
    blocks:[
      "SQL a besoin de ce que le lecteur d’un livre trouve à la fin : un <b>index</b>, une liste rangée qui indique où trouver chaque élément.",
      {ask:"À quelle ligne se trouve ce numéro ?"},
      "Dans une base, l’index range les valeurs d’une colonne et note, en face de chacune, la ligne qui la contient. Il est stocké à côté de la table, qui ne change pas. On le crée avec <code>CREATE INDEX</code> :",
      {syntax:"⟦CREATE INDEX idx_commandes_numero⟧\nON commandes(numero_commande);"},
      {scene:{h:"📖 Un index pour la table",cols:"1.7fr .8fr",
        lanes:[{c:[["h1","numero_commande","t"],["h2","ligne","t"]]},
          {k:"I1",c:[["a1","CMD-2026-1002481"],["a2","1"]]},
          {k:"I2",c:[["b1","CMD-2026-1015630"],["b2","3"]]},
          {k:"I3",c:[["c1","CMD-2026-1134085"],["c2","16"]]},
          {k:"I4",c:[["d1","CMD-2026-1847392"],["d2","14"]]},
          {k:"G",l:"Ligne 14 de la table commandes",cls:"is-goal",fold:true,cols:"1fr",c:[["g1","14 · 2026-07-30 · en_preparation"]]}],
        caps:["<b>L’index</b> · Les numéros sont rangés dans l’ordre.","<b>Recherche</b> · SQL repère CMD-2026-1847392 dans cette liste rangée, sans regarder les autres lignes de la table.","<b>Accès direct</b> · L’index indique la ligne 14 : SQL va la lire directement dans la table."],
        steps:[{cap:0,on:["I1","I2","I3","I4"],d:2000},{cap:1,off:["I1","I2","I3"],dim:["I1","I2","I3"],d:2400},{cap:2,unfold:["G"],on:["G"],d:2800}]}}
    ]
  },
  steps:[
    {h:"Voir comment SQL cherche",blocks:[
      "Pour voir comment SQL s’y prend, on place <code>EXPLAIN QUERY PLAN</code> devant une requête : SQL affiche alors son <b>plan</b> au lieu des lignes. Dans SQLite, il faut l’écrire en entier : <code>EXPLAIN</code> seul affiche le programme interne, bien moins lisible, et <code>EXPLAIN ANALYZE</code> n’existe pas.",
      {syntax:"⟦EXPLAIN QUERY PLAN⟧\nSELECT *\nFROM produits\nWHERE nom = 'Magnésium';"},
      {say:"👇 Exécute cette requête pour voir comment SQL cherche un produit à partir de son nom :",run:"EXPLAIN QUERY PLAN\nSELECT *\nFROM produits\nWHERE nom = 'Magnésium';"},
      {arrow:"La colonne <code>detail</code> décrit le plan : <b>SCAN produits</b> signifie que SQL parcourt toute la table, car aucun index ne porte sur <code>nom</code>."},
      {warn:{t:"SCAN ne veut pas dire « faux »",blocks:[
        "Un <code>SCAN</code> est logique quand on demande toutes les lignes, ou presque :",
        {say:"👇 Teste par toi-même :",run:"EXPLAIN QUERY PLAN\nSELECT *\nFROM clients;"},
        "Pour tout afficher, lire toute la table est la seule solution : le plan sert à <b>comprendre</b> le choix de SQL, pas à traquer le mot <code>SCAN</code>."
      ]}}
    ]},
    {h:"Créer un index",blocks:[
      "Un index sur la colonne <code>nom</code> peut accélérer cette recherche :",
      {syntax:"CREATE INDEX ⟦idx_produits_nom⟧\nON ⟦produits(nom)⟧;"},
      {looks:[["idx_produits_nom","est le nom donné à l’index"],["produits(nom)","désigne la table et la colonne à indexer"]]},
      {say:"👇 Exécute ces instructions pour créer l’index, puis refaire le plan :",run:"CREATE INDEX idx_produits_nom\nON produits(nom);\n\nEXPLAIN QUERY PLAN\nSELECT *\nFROM produits\nWHERE nom = 'Magnésium';"},
      {arrow:"Le plan annonce maintenant <b>SEARCH … USING INDEX idx_produits_nom</b> : SQL passe par l’index. La requête n’a pas changé, c’est SQL qui choisit de s’en servir."},
      {tip:{t:"Un index a un coût",blocks:["Un index occupe de la place, et SQL doit le mettre à jour à chaque <code>INSERT</code>, <code>UPDATE</code> ou <code>DELETE</code>. On n’indexe donc que les colonnes souvent recherchées, pas toutes « au cas où »."]}},
      {tip:{t:"Des index déjà là",blocks:["Une colonne <code>PRIMARY KEY</code> ou <code>UNIQUE</code>, comme <code>email</code> dans <code>clients</code>, reçoit un index automatique : inutile d’en créer un."]}},
      {tip:{t:"Une copie pour s’exercer",blocks:["Chaque exécution part d’une <b>copie neuve</b> de la base : tu peux créer des index sans rien abîmer. À chaque essai, l’index <code>idx_produits_nom</code> n’existe plus."]}}
    ]},
    {h:"Vérifier que SQL s’en sert",blocks:[
      "Créer un index ne suffit pas : encore faut-il que SQL puisse s’en servir, et seul le plan le montre. Ici, l’index existe sur <code>nom</code>, mais la recherche applique une fonction à la colonne :",
      {say:"👇 Exécute ces instructions pour créer l’index, puis voir si SQL l’utilise :",run:"CREATE INDEX idx_produits_nom\nON produits(nom);\n\nEXPLAIN QUERY PLAN\nSELECT *\nFROM produits\nWHERE LOWER(nom) = 'magnésium';"},
      {arrow:"Malgré l’index, le plan annonce <b>SCAN produits</b> : en transformant la colonne avec <code>LOWER</code>, la recherche empêche SQL de s’appuyer sur l’index. Avec <code>WHERE nom = 'Magnésium'</code>, comme à l’étape précédente, il l’utilise."}
    ]},
    {h:"Indexer plusieurs colonnes",blocks:[
      "Quand une recherche porte sur deux colonnes, un seul index peut les couvrir : c’est un <b>index composite</b>. Les colonnes se listent entre parenthèses, dans l’ordre voulu :",
      {syntax:"CREATE INDEX idx_commandes_client_date\nON commandes(⟦client_id, date_commande⟧);"},
      {scene:{h:"🗂️ Un index sur deux colonnes",cols:"1fr 1.4fr .6fr",
        lanes:[{c:[["h1","client_id","t"],["h2","date_commande","t"],["h3","ligne","t"]]},
          {k:"I1",c:[["a1","1"],["a2","2026-07-02"],["a3","1"]]},
          {k:"I2",c:[["b1","1"],["b2","2026-07-02"],["b3","2"]]},
          {k:"I3",c:[["c1","1"],["c2","2026-07-28"],["c3","13"]]},
          {k:"I4",c:[["d1","2"],["d2","2026-07-05"],["d3","3"]]},
          {k:"I5",c:[["e1","2"],["e2","2026-07-20"],["e3","10"]]}],
        caps:["<b>L’index</b> · Les entrées sont rangées d’abord par client, puis par date à l’intérieur de chaque client.","<b>client_id = 1</b> · SQL va directement au groupe du client 1 : les autres clients sont ignorés.","<b>date_commande ≥ 2026-07-15</b> · Dans ce groupe, les dates sont rangées : il ne reste que la ligne 13."],
        steps:[{cap:0,on:["I1","I2","I3","I4","I5"],d:2000},{cap:1,off:["I4","I5"],dim:["I4","I5"],d:2400},{cap:2,off:["I1","I2"],dim:["I1","I2"],d:2600}]}},
      {say:"👇 Exécute ces instructions pour voir le plan de la recherche des commandes d’un client à partir d’une date :",run:"CREATE INDEX idx_commandes_client_date\nON commandes(client_id, date_commande);\n\nEXPLAIN QUERY PLAN\nSELECT *\nFROM commandes\nWHERE client_id = 1\n  AND date_commande >= '2026-07-15';"},
      {arrow:"Le plan utilise les deux colonnes de l’index : <b>client_id=? AND date_commande&gt;?</b> (le <code>?</code> remplace la valeur cherchée)."},
      {warn:{t:"L’ordre des colonnes compte",blocks:[
        "Une recherche qui ne porte que sur la date ne peut pas profiter de ce rangement : les dates ne sont rangées qu’<b>à l’intérieur</b> de chaque client.",
        {say:"👇 Teste par toi-même :",run:"CREATE INDEX idx_commandes_client_date\nON commandes(client_id, date_commande);\n\nEXPLAIN QUERY PLAN\nSELECT *\nFROM commandes\nWHERE date_commande >= '2026-07-15';"},
        "SQL revient à un <b>SCAN</b> : pour cette recherche, il faudrait un index qui commence par <code>date_commande</code>."
      ]}}
    ]},
    {h:"La requête complète",blocks:[
      "Il ne reste plus qu’à construire la requête complète : créer l’index sur le numéro de commande, puis vérifier que SQL l’utilise pour retrouver la commande cherchée.",
      {say:"👇 Exécute les instructions pour créer l’index et vérifier le plan de la recherche :",run:"CREATE INDEX idx_commandes_numero\nON commandes(numero_commande);\n\nEXPLAIN QUERY PLAN\nSELECT date_commande, statut, quantite\nFROM commandes\nWHERE numero_commande = 'CMD-2026-1847392';"},
      {done:{
        label:"De 16 commandes à parcourir à une commande lue directement",
        unit:"free",
        funnel:[
          {n:16,t:"commandes à parcourir",s:"sans index, SQL lit la <code>table commandes</code> ligne par ligne",dots:"0000000000000000"},
          {step:"CREATE INDEX idx_commandes_numero",s:"range les numéros dans un index, à côté de la table"},
          {n:1,t:"⭐ commande lue directement",s:"CMD-2026-1847392, sans lire les 15 autres",dots:"0000000000000100",out:true}
        ],
        page:{ico:"🔎",h:"Recherche par numéro",aria:"Dans l’outil interne, le numéro CMD-2026-1847392 est tapé ; la commande s’affiche aussitôt, retrouvée par l’index : commandée le 30 juillet 2026, en préparation, 2 unités ; le plan annonce SEARCH … USING INDEX",url:"outil interne › commandes",layout:"search",search:{q:"CMD-2026-1847392",chip:"⚡ via l’index"},hit:{k:"Fiche de la commande",t:"CMD-2026-1847392",s:"Commandée le 30 juillet\u00a02026 · en préparation · 2 unités"},kicker:"Plan de la recherche",text:3,hlWord:"SEARCH",stamp:"Accès direct",delay:0.5,sg:1.2,rows:[[3,0,0,"SEARCH commandes USING INDEX idx_commandes_numero (numero_commande=?)"]],done:"✓ Réponse prête pour le client : statut et quantité"},
        fill:["CREATE INDEX","idx_commandes_numero","commandes","numero_commande"],
        ui:{t:"Une commande retrouvée directement",s:"Le plan annonce SEARCH et non plus SCAN : SQL passe par l’index.",n:["CREATE INDEX","ON","EXPLAIN QUERY PLAN"]},
        rows:1
      }}
    ]}
  ],
  reflex:[
    {recap:[
      ["📖","Un <b>index</b> range les valeurs d’une colonne, comme celui d’un livre. On le crée avec <code>CREATE INDEX</code> :",null,"ON commandes(numero_commande)"],
      ["🧭","<code>EXPLAIN QUERY PLAN</code> montre la méthode de SQL : <b>SCAN</b> lit toute la table, <b>SEARCH</b> passe par un index.",null,"EXPLAIN QUERY PLAN SELECT …"],
      ["⚖️","Un index <b>accélère les recherches</b> mais alourdit les écritures : on n’indexe pas tout, puis on relance le plan pour vérifier qu’il sert."]
    ],label:"Les trois idées à retenir"}
  ],
  anatomie:[{tok:"CREATE INDEX idx_commandes_numero",txt:"Crée un index et lui donne un nom."},{tok:"ON commandes",txt:"La table concernée."},{tok:"(numero_commande)",plain:1,txt:"La colonne qui sert à retrouver les lignes."}],
  exemple:"CREATE INDEX idx_produits_nom ON produits(nom);",
  attendu:"L’index est créé. La table <code>produits</code> garde les mêmes colonnes, et SQL dispose d’un chemin plus direct pour chercher par <code>nom</code>.",
  retenir:"Un <b>index</b> fonctionne comme celui d’un livre : il range les valeurs d’une colonne et indique où trouver chaque ligne. Il est créé à côté de la table, qui ne change pas.<br><br>On le crée avec <code>CREATE INDEX nom ON table(colonne)</code>. SQL décide seul de l’utiliser : la requête ne change pas. <code>EXPLAIN QUERY PLAN</code> montre son choix : <code>SCAN</code> lit toute la table, <code>SEARCH … USING INDEX</code> passe par un index.<br><br>Un index accélère les recherches mais alourdit les écritures : on n’indexe que les colonnes souvent recherchées, puis on relance le plan pour vérifier qu’il est utilisé.",
  consigne:"Crée un index nommé <code>idx_clients_ville</code> sur la colonne <code>ville</code> de la table <code>clients</code>.",
  solution:"CREATE INDEX idx_clients_ville ON clients(ville);",
  verif:"SELECT name AS colonne FROM pragma_index_info('idx_clients_ville');",
  write:true,
  indice:"Écris <code>CREATE INDEX</code>, le nom de l’index, puis <code>ON</code> suivi de la table et de la colonne entre parenthèses.",
  testeVariants:[{k:"scan",label:"Sans index",sql:"EXPLAIN QUERY PLAN SELECT * FROM clients WHERE ville = 'Paris';",out:"SCAN clients : SQL parcourt les lignes. La colonne ville n’a pas encore d’index."},{k:"search",label:"Avec index",sql:"CREATE INDEX idx_clients_ville ON clients(ville);\nEXPLAIN QUERY PLAN SELECT * FROM clients WHERE ville = 'Paris';",out:"SEARCH clients USING INDEX idx_clients_ville : SQL utilise l’index. Le résultat de la requête reste identique.",tone:"good"}],
  learningCheck:{question:"Quel est l’effet d’un index sur la requête WHERE numero_commande = 'CMD-2026-1847392' ?",options:["Le résultat change : d’autres lignes sont renvoyées","SQL retrouve la même ligne sans parcourir toute la table","La table commandes reçoit une nouvelle colonne"],answer:1,explanation:"Un index ne change ni le résultat ni les colonnes de la table : il donne à SQL un chemin plus direct vers les lignes cherchées."}
})
