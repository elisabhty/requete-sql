/* Un cours texte complet, gardé comme exemple pour les tests : l’ancienne leçon 50, Sécurité et droits en texte (l’outil de reporting
   et son compte app_user, GRANT SELECT sur la table clients, REVOKE, les commandes simulées d’un serveur PostgreSQL, l’exercice
   « REVOKE SELECT ON commandes FROM stagiaire »), telle qu’elle était jusqu’au 26 octobre 2026. C’était le dernier cours texte de
   l’app : il est devenu le chapitre 18 du projet, en vidéo (assets/anim/projet-droits.html) ; le moteur des cours texte, et celui
   des commandes simulées (noExec, serverConcept, sim), restent testés sur celui-ci (identifiant 950 : aucune leçon de l’app).
   Les tests l’évaluent dans le contexte de index.html : guide(…) renvoie la leçon. */
guide({ id:950, titre:"Sécurité et droits", résumé:"Contrôler les accès avec GRANT et REVOKE",
  sit:{
    blocks:[
      "L’équipe data branche <b>un outil de reporting</b> sur la base de la boutique. L’outil se connecte avec un compte dédié, <code>app_user</code>, qui doit pouvoir <b>lire</b> la table <code>clients</code>, mais pas la modifier.",
      "Un SGBD <b>serveur</b> (PostgreSQL, MySQL, SQL Server) gère des comptes : chaque utilisateur se connecte avec le sien, et chaque compte reçoit des <b>droits</b>. Pour ouvrir cet accès, l’équipe souhaite définir uniquement :",
      {need:[["👤","Le compte concerné","app_user"],["📋","La table à ouvrir","clients"],["👀","Le droit accordé","lecture seule"]],label:"Ce qu’il faut définir"},
      {tip:{t:"Des commandes simulées",p:["SQLite, le moteur de cette application, n’a pas de comptes : <code>GRANT</code> et <code>REVOKE</code> ne s’y exécutent pas. Le bouton <b>Simuler</b> affiche donc la réponse qu’un serveur PostgreSQL donnerait."]}}
    ],
    problem:{
      p:["Avec <code>SELECT</code>, <code>INSERT</code>, <code>UPDATE</code> et <code>DELETE</code>, SQL sait lire et modifier les tables, mais il ne se demande pas <b>qui</b> envoie la requête.","Or, sans règle, un compte connecté pourrait <b>modifier ou supprimer</b> des clients : <code>app_user</code> ne doit pouvoir que lire."],
      scene:{h:"🔐 Que peut faire app_user ?",cols:"1.1fr 1fr .9fr",
        lanes:[{c:[["h1","action","t"],["h2","commande","t"],["h3","autorisé ?","t"]]},
          {k:"R1",c:[["a1","lire"],["a2","SELECT"],["a3","?","q"]]},
          {k:"R2",c:[["b1","ajouter"],["b2","INSERT"],["b3","?","q"]]},
          {k:"R3",c:[["c1","modifier"],["c2","UPDATE"],["c3","?","q"]]},
          {k:"R4",c:[["d1","supprimer"],["d2","DELETE"],["d3","?","q"]]}],
        caps:["<b>Notre compte</b> · app_user peut envoyer quatre sortes de commandes à la table clients.","<b>Besoin</b> · Il doit seulement pouvoir lire.","<b>Résultat</b> · Lire est autorisé ; ajouter, modifier et supprimer doivent être refusés."],
        steps:[{cap:0,on:["R1","R2","R3","R4"],d:1900},{cap:1,off:["R2","R3","R4"],dim:["R2","R3","R4"],d:2300},{cap:2,undim:["R2","R3","R4"],text:{a3:"✅ oui",b3:"⛔ non",c3:"⛔ non",d3:"⛔ non"},stagger:350,d:3000}]},
      then:["Il faut donc indiquer au serveur <b>quels droits</b> accorder à ce compte, et sur <b>quelle table</b>.","C’est exactement le rôle de <code>GRANT</code>."]
    },
    mission:"Aide l’équipe data à donner à <b>app_user</b> le droit de <b>lire</b> la table <b>clients</b>, sans lui accorder aucun autre droit, afin que l’outil de reporting consulte les clients sans pouvoir les modifier."
  },
  concept:{
    title:"Comment un serveur peut-il savoir ce qu’un compte a le droit de faire ?",
    blocks:[
      "Le serveur garde, pour chaque compte, la liste de ses droits. Avant d’exécuter une requête, il la compare à cette liste :",
      {ask:"Ce compte a-t-il le droit de faire cela, sur cette table ?"},
      "En SQL, on accorde un droit avec <code>GRANT</code>, en précisant le droit, la table et le compte :",
      {syntax:"GRANT ⟦SELECT⟧\nON ⟦clients⟧\nTO ⟦app_user⟧;"},
      {scene:{h:"🔑 Les droits d’app_user",
        lanes:[{k:"D",l:"Droits sur la table clients",c:[["d1","SELECT"],["d2","INSERT"],["d3","UPDATE"],["d4","DELETE"]]}],
        caps:["<b>Au départ</b> · app_user n’a aucun droit sur la table clients.","<b>GRANT SELECT ON clients TO app_user</b> · Le droit de lire est accordé : les trois autres restent refusés.","<b>REVOKE SELECT ON clients FROM app_user</b> · Le droit est retiré : la lecture est de nouveau refusée."],
        steps:[{cap:0,dim:["d1","d2","d3","d4"],d:2200},{cap:1,undim:["d1"],on:["d1"],d:2600},{cap:2,off:["d1"],dim:["d1"],d:2600}]}},
      {looks:[["GRANT","accorde un droit à un compte"],["REVOKE","retire un droit à un compte"]],label:"Accorder ou retirer"}
    ]
  },
  steps:[
    {h:"Accorder un droit avec GRANT",blocks:[
      "Le droit le plus courant est <code>SELECT</code>.",
      {syntax:"GRANT ⟦SELECT⟧\nON produits\nTO app_user;"},
      {looks:[["SELECT","le droit accordé : lire les lignes de la table"],["ON produits","la table concernée"],["TO app_user","le compte qui reçoit le droit"]]},
      {say:"👇 Simule cette commande pour accorder à <code>app_user</code> la lecture des produits :",run:"GRANT SELECT\nON produits\nTO app_user;",sim:"GRANT"},
      {arrow:"Le serveur répond <code>GRANT</code> : le droit est accordé, <code>app_user</code> peut lire la table <code>produits</code>."}
    ]},
    {h:"Retirer un droit avec REVOKE",blocks:[
      "<code>REVOKE</code> retire un droit déjà accordé. Le compte se place après <code>FROM</code>, et non après <code>TO</code> :",
      {syntax:"REVOKE ⟦SELECT⟧\nON produits\n⟦FROM⟧ app_user;"},
      {say:"👇 Simule cette commande pour retirer le droit de lecture :",run:"REVOKE SELECT\nON produits\nFROM app_user;",sim:"REVOKE"},
      {arrow:"Le serveur répond <code>REVOKE</code> : <code>app_user</code> n’a plus le droit de lire la table <code>produits</code>."},
      {say:"👇 Simule maintenant une lecture envoyée par <code>app_user</code> :",run:"SELECT nom, prix\nFROM produits;",sim:"ERROR:  permission denied for table produits"},
      {arrow:"Le serveur refuse la requête : sans le droit <code>SELECT</code>, la table lui est fermée."}
    ]},
    {h:"Donner le minimum de droits",blocks:[
      "Le piège classique est d’accorder trop de droits.",
      {warn:{t:"Tous les droits d’un coup",blocks:[
        "Si tu écris :",
        {syntax:"GRANT ALL PRIVILEGES\nON clients\nTO app_user;"},
        "<code>ALL PRIVILEGES</code> accorde <b>tous</b> les droits : lire, mais aussi ajouter, modifier et supprimer. L’outil de reporting pourrait alors abîmer la table par erreur.",
        {say:"👇 Simule une modification envoyée par <code>app_user</code>, une fois ces droits accordés :",run:"UPDATE clients\nSET email = NULL;",sim:"UPDATE 10"},
        {arrow:"Le serveur répond <code>UPDATE 10</code> : tous les emails viennent d’être effacés."}
      ]}},
      {tip:{t:"Le bon réflexe",p:["Pose-toi toujours la même question : <b>quel est le droit minimal</b> dont ce compte a besoin ? Un compte de lecture reçoit <code>SELECT</code>, rien de plus."]}}
    ]},
    {h:"La requête complète",blocks:[
      "Il ne reste plus qu’à construire la commande complète : le droit de lecture, sur la table <code>clients</code>, pour le compte <code>app_user</code>.",
      {say:"👇 Simule la commande pour ouvrir la lecture de <code>clients</code> :",run:"GRANT SELECT\nON clients\nTO app_user;",sim:"GRANT"},
      {done:{
        label:"De quatre droits possibles à un seul droit accordé",
        unit:"free",
        funnel:[
          {n:4,t:"droits possibles",s:"lire, ajouter, modifier ou supprimer dans la <code>table clients</code>",dots:"0000"},
          {step:"GRANT SELECT ON clients TO app_user",s:"n’accorde que le droit de lecture"},
          {n:1,t:"⭐ droit accordé",s:"<code>app_user</code> peut lire <code>clients</code>, sans pouvoir la modifier",dots:"1000",out:true}
        ],
        board:{ico:"🔐",h:"Droits d’app_user sur clients",aria:"app_user reçoit le droit de lire la table clients ; ajouter, modifier et supprimer restent refusés",kpi:"Droits accordés",count:{t:"Droits accordés",from:0,to:1},ops:{"0": {"op": "upd", "from": {"2": "⛔ non"}}},cols:["action", "commande", "autorisé ?"],rows:[["lire", "SELECT", "✅ oui"], ["ajouter", "INSERT", "⛔ non"], ["modifier", "UPDATE", "⛔ non"], ["supprimer", "DELETE", "⛔ non"]],done:"✓ Droit de lecture accordé, rien de plus"},
        fill:["GRANT","SELECT","clients","app_user"],
        ui:{t:"Un accès en lecture seule",s:"L’outil de reporting est branché sans risque.",n:["GRANT","SELECT","ON","TO"]},
        rows:1
      }}
    ]}
  ],
  reflex:[
    {recap:[
      ["🔑","<code>GRANT</code> <b>accorde</b> un droit sur une table à un compte :",null,"GRANT SELECT ON clients TO app_user"],
      ["↩️","<code>REVOKE</code> <b>retire</b> un droit accordé : le compte le perd aussitôt.",null,"REVOKE SELECT ON clients FROM app_user"],
      ["🎯","Donne le <b>minimum nécessaire</b> : un compte de lecture reçoit <code>SELECT</code>, jamais <code>ALL PRIVILEGES</code>."]
    ],label:"Les trois idées à retenir"}
  ],
  anatomie:[{tok:"GRANT SELECT ON clients",txt:"Donne le droit de lecture sur la table clients."},{tok:"TO app_user",txt:"À l’utilisateur app_user."},{tok:"REVOKE SELECT ON clients",txt:"Retire le droit de lecture sur clients."},{tok:"FROM app_user",txt:"Pour le même utilisateur."}],
  exemple:"-- Exemple de principe (la syntaxe varie selon le SGBD)\nGRANT SELECT ON clients TO app_user;\n\nREVOKE SELECT ON clients FROM app_user;",
  attendu:"Le serveur répond <code>REVOKE</code> : <code>stagiaire</code> ne peut plus lire la table <code>commandes</code>. Cette commande ne s’exécute pas dans SQLite.",
  retenir:"<code>GRANT</code> accorde un droit sur une table à un compte. <code>REVOKE</code> le retire.<br><br>Un SGBD serveur (PostgreSQL, MySQL, SQL Server) gère des comptes, chacun avec ses droits. SQLite, le moteur de cette application, n’en a pas : les commandes de droits y sont simulées.<br><br>Principe : accorder le <b>minimum nécessaire</b>. Pour seulement lire <code>clients</code> : <code>GRANT SELECT</code>, pas <code>ALL PRIVILEGES</code>.",
  consigne:"Le compte <code>stagiaire</code> peut lire la table <code>commandes</code>, mais son stage est terminé. Retire-lui uniquement ce droit de lecture.",
  solution:"REVOKE SELECT ON commandes FROM stagiaire;",
  indice:"Écris <code>REVOKE SELECT</code> sur la table <code>commandes</code>, puis précise le compte avec <code>FROM</code> : un retrait de droit ne s’écrit pas avec <code>TO</code>.",
  noExec:true,
  serverConcept:true,
  noExecNote:"Cette commande ne s’exécute pas dans SQLite : on compare ce que tu écris à la commande attendue.",
  noExecWhy:"SQLite n’a pas de comptes : <code>GRANT</code> et <code>REVOKE</code> sont des commandes de SQL serveur.",
  noExecOk:{b:"✓ Correct — le droit est retiré",t:"<code>REVOKE SELECT ON commandes FROM stagiaire</code> retire le droit de lecture : <code>stagiaire</code> ne peut plus lire <code>commandes</code>. Cette commande ne s’exécute pas dans SQLite."},
  petitDefi:[{p:"Quel mot introduit le compte qui reçoit le droit, dans un <code>GRANT</code> ?",sql:"GRANT SELECT ON produits __________ app_user;",a:"TO",answers:["TO","to","To"]}],
  testeVariants:[{k:"grant_select",label:"GRANT SELECT",sql:"GRANT SELECT ON clients TO app_user;",out:"Droit de lecture seulement — non exécutable ici.",tone:"good",exec:false},{k:"grant_all",label:"GRANT ALL",sql:"GRANT ALL PRIVILEGES ON clients TO app_user;",out:"Trop de droits pour un simple besoin de lecture.",tone:"bad",exec:false},{k:"revoke",label:"REVOKE",sql:"REVOKE SELECT ON clients FROM app_user;",out:"Le droit de lecture est retiré.",tone:"neutral",exec:false}],
  learningCheck:{question:"app_user doit seulement lire la table clients. Quelle commande lui donne exactement ce droit ?",options:["GRANT ALL PRIVILEGES ON clients TO app_user;","GRANT SELECT ON clients TO app_user;","REVOKE SELECT ON clients FROM app_user;"],answer:1,explanation:"SELECT est le droit de lecture : c’est le minimum nécessaire. ALL PRIVILEGES donnerait aussi le droit de modifier et de supprimer, et REVOKE retire un droit au lieu de l’accorder."}
})
