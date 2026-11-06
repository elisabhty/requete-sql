/* Les données que montre chaque exemple de l’écran « Entretien SQL », pour l’exécuter dans sql.js
   (tests/entretien-univers.test.mjs, tests/helpers/entretien-exemples.mjs).

   Par question :
     u        l’univers de l’exemple (une bibliothèque, un festival…), le même dans toute la question
     garde    l’exemple n’utilisait ni clients, ni commandes, ni produits : il est resté tel quel
     avant    les tables et les lignes montrées par l’exemple, créées avant d’exécuter sa requête
     autres   les blocs de la requête propres à un autre SGBD (leur commentaire de tête le dit), non exécutés
     erreurs  les instructions qui doivent échouer (une insertion refusée…), numérotées à partir de 0
     res      le résultat attendu d’une instruction : des lignes, ou { cols, rows } pour quelques colonnes
     colonnes les colonnes attendues d’une instruction
     ex       ce qui rejoue le tableau de l’exemple : { sql } ou { instr }, sur les colonnes cols, pour les lignes
              que garde lignes (par défaut, toutes)
     exLibre  pourquoi le tableau ne se rejoue pas (un tableau de notions, une sortie propre à un autre SGBD…)
     verif    un contrôle sur mesure, qui renvoie un problème ou rien */
const acceptee = r => r[r.length - 1] === 'Acceptée';

export const DONNEES = {
  'ent-v2-01': {
    u: 'bibliothèque',
    erreurs: [2],
    ex: [{ sql: 'SELECT id, nom FROM lecteurs ORDER BY id', cols: [0, 1], lignes: acceptee }],
  },
  'ent-v2-02': {
    u: 'compagnie aérienne',
    avant: `CREATE TABLE vols (id INTEGER PRIMARY KEY, numero TEXT);
      INSERT INTO vols VALUES (1, 'AF100'), (2, 'AF200');`,
    erreurs: [2],
    ex: [{ sql: 'SELECT id, vol_id FROM reservations ORDER BY id', cols: [0, 1], lignes: acceptee }],
  },
  'ent-v2-03': {
    u: 'club de sport',
    erreurs: [2],
    ex: [{ sql: 'SELECT id, email FROM adherents ORDER BY id', cols: [0, 1], lignes: acceptee }],
  },
  'ent-v2-04': {
    u: 'aquarium',
    erreurs: [2],
    ex: [{ sql: 'SELECT bassin_id, espece_id, nombre FROM bassins_especes ORDER BY rowid', cols: [0, 1, 2], lignes: acceptee }],
  },
  'ent-v2-05': {
    u: 'musée',
    avant: `CREATE TABLE oeuvres (id INTEGER PRIMARY KEY, titre TEXT, artiste TEXT, annee INTEGER);
      INSERT INTO oeuvres VALUES (1, 'Les Nymphéas', 'Monet', 1916);`,
    colonnes: { 0: ['id', 'titre', 'artiste', 'annee'], 2: ['id', 'titre', 'artiste', 'annee', 'salle'], 3: ['titre', 'artiste'] },
    verif: ({ rows, resultats }) => {
      const tout = resultats[2].columns, choix = resultats[3].columns;
      const ok = JSON.stringify(rows.map(r => r[0])) === JSON.stringify(tout)
        && rows.every(r => (r[1] === 'oui') === tout.includes(r[0]) && (r[2] === 'oui') === choix.includes(r[0]));
      return ok ? null : 'le tableau des colonnes ne correspond pas aux colonnes renvoyées';
    },
  },
  'ent-v2-06': {
    u: 'location de vélos',
    avant: `CREATE TABLE velos (id INTEGER PRIMARY KEY, station TEXT, en_service INTEGER);
      INSERT INTO velos VALUES (1, 'Bastille', 1), (2, 'Bastille', 1), (3, 'Bastille', 0),
        (4, 'Nation', 1), (5, 'Nation', 0), (6, 'Opéra', 1);`,
    res: { 0: [['Bastille', '2']] },
    ex: [{ sql: `SELECT station, COUNT(*), SUM(en_service),
        CASE WHEN SUM(en_service) >= 2 THEN 'Gardée' ELSE 'Écartée' END
      FROM velos GROUP BY station ORDER BY COUNT(*) DESC, station` }],
  },
  'ent-v2-07': {
    u: 'refuge animalier',
    avant: `CREATE TABLE animaux (id INTEGER PRIMARY KEY, nom TEXT, puce TEXT);
      INSERT INTO animaux VALUES (1, 'Moka', '250269'), (2, 'Pixel', NULL), (3, 'Tigrou', '250271'), (4, 'Filou', NULL);`,
    res: { 0: [['Pixel'], ['Filou']], 1: [['Moka'], ['Tigrou']], 2: [] },
    ex: [{ sql: `SELECT nom, puce, CASE WHEN puce IS NULL THEN 'vrai' ELSE 'faux' END,
        CASE WHEN (puce = NULL) IS NULL THEN 'inconnu' WHEN puce = NULL THEN 'vrai' ELSE 'faux' END
      FROM animaux ORDER BY id` }],
  },
  'ent-v2-08': {
    u: 'station de ski',
    avant: `CREATE TABLE pistes (id INTEGER PRIMARY KEY, nom TEXT, couleur TEXT, longueur INTEGER, altitude INTEGER);
      INSERT INTO pistes VALUES (1, 'Le Mur', 'rouge', 3100, 2600), (2, 'Le Lac', 'bleue', 900, 1800),
        (3, 'Les Sapins', 'rouge', 1200, 1900), (4, 'La Combe', 'noire', 1800, 2400), (5, 'Les Crêtes', 'bleue', 2400, 2300);`,
    ex: [{ instr: 0 }],
    verif: ({ ouvrir }) => {
      const db = ouvrir();
      const r = db.exec("SELECT x FROM (SELECT 'aigle' x UNION ALL SELECT 'Zénith' UNION ALL SELECT 'Écureuil') ORDER BY x")[0].values.map(v => v[0]).join(',');
      db.close();
      return r === 'Zénith,aigle,Écureuil' ? null : `le tri par défaut de SQLite donne ${r}`;
    },
  },
  'ent-v2-09': {
    u: 'plateforme de musique',
    avant: `CREATE TABLE titres (id INTEGER PRIMARY KEY, titre TEXT, ecoutes INTEGER);
      INSERT INTO titres VALUES (1, 'Brume', 3800), (2, 'Minuit', 9200), (3, 'Écume', 1200), (4, 'Sirocco', 5100), (5, 'Orage', 7400);`,
    autres: [1, 2],
    res: { 0: [['Minuit', '9200'], ['Orage', '7400'], ['Sirocco', '5100']] },
    ex: [{ sql: `SELECT titre, ecoutes,
        CASE WHEN ROW_NUMBER() OVER (ORDER BY ecoutes DESC) <= 3 THEN 'gardé' ELSE 'écarté' END
      FROM titres ORDER BY ecoutes DESC` }],
  },
  'ent-v2-10': {
    u: 'festival de musique',
    avant: `CREATE TABLE festivaliers (id INTEGER PRIMARY KEY, nom TEXT, email TEXT);
      INSERT INTO festivaliers VALUES (1, 'Jade', 'jade@mail.fr'), (2, 'Tom', 'tom@mail.fr'), (3, 'Malik', NULL),
        (4, 'Jade', 'jade@mail.fr'), (5, 'Rose', 'rose@mail.fr');`,
    res: { 0: [['5', '4', '3']] },
    ex: [{ sql: 'SELECT id, nom, email FROM festivaliers ORDER BY id' }],
  },
  'ent-v2-11': {
    u: 'bibliothèque',
    avant: `CREATE TABLE lecteurs (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO lecteurs VALUES (1, 'Nora'), (2, 'Paul'), (3, 'Yanis');
      CREATE TABLE emprunts (id INTEGER PRIMARY KEY, lecteur_id INTEGER REFERENCES lecteurs(id), livre TEXT);
      INSERT INTO emprunts VALUES (101, 1, 'Dune'), (102, 1, 'Germinal'), (103, 2, 'Le Horla');`,
    res: { 0: [['Nora', '101'], ['Nora', '102'], ['Paul', '103']], 1: [['Nora', '101'], ['Nora', '102'], ['Paul', '103'], ['Yanis', 'NULL']] },
    ex: [{ sql: `SELECT l.nom, e.id, CASE WHEN e.id IS NULL THEN 'non' ELSE 'oui' END, 'oui'
      FROM lecteurs l LEFT JOIN emprunts e ON e.lecteur_id = l.id ORDER BY l.id, e.id` }],
  },
  'ent-v2-12': {
    u: 'camping',
    avant: `CREATE TABLE campeurs (id INTEGER PRIMARY KEY, nom TEXT, pays TEXT);
      INSERT INTO campeurs VALUES (1, 'Janssens', 'Belgique'), (2, 'Moreau', 'France'), (3, 'Peeters', 'Belgique'),
        (4, 'Weber', NULL), (5, 'Silva', NULL);`,
    res: { 0: [['Belgique'], ['France'], ['NULL']], 1: [['Belgique', 'Janssens'], ['France', 'Moreau'], ['Belgique', 'Peeters'], ['NULL', 'Weber'], ['NULL', 'Silva']] },
    ex: [{ sql: `SELECT nom, pays,
        CASE WHEN id = (SELECT MIN(id) FROM campeurs c2 WHERE c2.pays IS c.pays) THEN COALESCE(pays, 'NULL') ELSE '—' END
      FROM campeurs c ORDER BY id` }],
  },
  'ent-v2-13': {
    u: 'service d’urgences',
    avant: `CREATE TABLE passages (id INTEGER PRIMARY KEY, patient TEXT, arrivee TEXT);
      INSERT INTO passages VALUES (1, 'Adam', date('now', '-1 day') || ' 18:20:00'),
        (2, 'Lina', date('now') || ' 09:14:00'), (3, 'Omar', date('now') || ' 16:02:00');`,
    autres: [3],
    res: { 2: { cols: [0], rows: [['2'], ['3']] } },
    ex: [{ sql: `SELECT id, CASE WHEN date(arrivee) = date('now') THEN 'aujourd’hui ' ELSE 'hier ' END || strftime('%H:%M', arrivee),
        CASE WHEN arrivee = CURRENT_DATE THEN 'vrai' ELSE 'faux' END,
        CASE WHEN DATE(arrivee) = CURRENT_DATE THEN 'vrai' ELSE 'faux' END
      FROM passages ORDER BY id` }],
  },
  'ent-v2-14': {
    u: 'théâtre',
    avant: `CREATE TABLE comediens (id INTEGER PRIMARY KEY, prenom TEXT, nom TEXT);
      INSERT INTO comediens VALUES (1, 'Alma', 'Rivière'), (2, 'Jules', 'Ferrand'), (3, NULL, 'Ozawa');`,
    res: { 0: [['Alma Rivière'], ['Jules Ferrand'], ['NULL']], 1: [['Alma Rivière'], ['Jules Ferrand'], [' Ozawa']], 2: [['Alma Rivière'], ['Jules Ferrand'], ['Ozawa']] },
    ex: [{ sql: `SELECT prenom, nom, prenom || ' ' || nom, CONCAT_WS(' ', prenom, nom) FROM comediens ORDER BY id` }],
  },
  'ent-v2-15': {
    u: 'ferme apicole',
    avant: `CREATE TABLE recoltes (id INTEGER PRIMARY KEY, ruche TEXT, kg INTEGER);
      INSERT INTO recoltes VALUES (1, 'Ruche 1', 12), (2, 'Ruche 2', 8), (3, 'Ruche 3', 40), (4, 'Ruche 4', NULL);`,
    res: { 0: [['60', '20', '8', '40']], 1: [['0']] },
    ex: [{ sql: 'SELECT ruche, kg FROM recoltes ORDER BY id' }],
    verif: ({ db }) => {
      const r = db.exec('SELECT AVG(COALESCE(kg, 0)) FROM recoltes')[0].values[0][0];
      return r === 15 ? null : `avec le NULL compté 0, la moyenne vaut ${r}`;
    },
  },
  'ent-v2-16': {
    u: 'escape game',
    avant: `CREATE TABLE parties (id INTEGER PRIMARY KEY, salle TEXT, equipe TEXT);
      INSERT INTO parties VALUES (1, 'Le Manoir', 'Hiboux'), (2, 'La Crypte', 'Lynx'), (3, 'Le Manoir', 'Lynx'),
        (4, 'Le Labo', 'Pirates'), (5, 'La Crypte', 'Hiboux'), (6, 'Le Train', 'Comètes'), (7, 'Le Manoir', 'Pirates');`,
    res: { 0: [['Le Manoir', '3'], ['La Crypte', '2'], ['Le Labo', '1'], ['Le Train', '1']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-17': {
    u: 'musée',
    avant: `CREATE TABLE artistes (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO artistes VALUES (1, 'Monet'), (2, 'Mondrian'), (3, 'Monticelli'), (4, 'Degas');`,
    res: { 0: [['Monet']], 1: [['Monet'], ['Mondrian'], ['Monticelli']] },
    ex: [{ sql: `SELECT nom, CASE WHEN nom = 'Monet' THEN 'oui' ELSE 'non' END, CASE WHEN nom LIKE 'Mon%' THEN 'oui' ELSE 'non' END
      FROM artistes ORDER BY id` }],
    verif: ({ db }) => {
      const r = db.exec("SELECT (SELECT COUNT(*) FROM artistes WHERE nom LIKE 'monet'), (SELECT COUNT(*) FROM artistes WHERE nom = 'monet')")[0].values[0].join(',');
      return r === '1,0' ? null : `LIKE / = sur 'monet' donnent ${r}`;
    },
  },
  'ent-v2-18': {
    u: 'festival de musique',
    avant: `CREATE TABLE concerts (id INTEGER PRIMARY KEY, artiste TEXT, scene TEXT);
      INSERT INTO concerts VALUES (1, 'Lumen', 'Plage'), (2, 'Vertigo', 'Grange'), (3, 'Nova', 'Forêt'), (4, 'Kalima', NULL);`,
    res: { 0: [['Lumen'], ['Nova']], 1: [['Vertigo']] },
    ex: [{ sql: `SELECT artiste, scene, CASE WHEN scene IN ('Plage', 'Forêt') THEN 'oui' ELSE 'non' END,
        CASE WHEN scene NOT IN ('Plage', 'Forêt') THEN 'oui' ELSE 'non' END
      FROM concerts ORDER BY id` }],
  },
  'ent-v2-19': {
    u: 'cinéma',
    avant: `CREATE TABLE films (id INTEGER PRIMARY KEY, titre TEXT, duree INTEGER);
      INSERT INTO films VALUES (1, 'Éclipse', 75), (2, 'La Fugue', 90), (3, 'Nuit blanche', 105), (4, 'Les Vagues', 120), (5, 'L’Odyssée', 150);
      CREATE TABLE seances (id INTEGER PRIMARY KEY, film_id INTEGER, debut TEXT);
      INSERT INTO seances VALUES (1, 2, '2025-12-31 21:00'), (2, 3, '2026-01-01 14:00'), (3, 4, '2026-01-31 20:30'), (4, 5, '2026-02-01 10:00');`,
    res: { 0: [['La Fugue', '90'], ['Nuit blanche', '105'], ['Les Vagues', '120']], 1: [['2', '2026-01-01 14:00'], ['3', '2026-01-31 20:30']] },
    ex: [{ sql: `SELECT titre, duree || ' min', CASE WHEN duree BETWEEN 90 AND 120 THEN 'oui' ELSE 'non' END FROM films ORDER BY duree` }],
  },
  'ent-v2-20': {
    u: 'station de ski',
    avant: `CREATE TABLE skieurs (id INTEGER PRIMARY KEY, nom TEXT, age INTEGER);
      INSERT INTO skieurs VALUES (1, 'Léon Garnier', 8), (2, 'Maëlle Roux', 12), (3, 'Samir Haddou', 34), (4, 'Odile Brun', 70);`,
    res: { 0: [['Léon Garnier', '8', 'Enfant'], ['Maëlle Roux', '12', 'Adulte'], ['Samir Haddou', '34', 'Adulte'], ['Odile Brun', '70', 'Senior']] },
    ex: [{ instr: 0 }],
  },
};
