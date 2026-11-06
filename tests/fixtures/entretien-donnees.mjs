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
  'ent-v2-21': {
    u: 'stations météo',
    avant: `CREATE TABLE releves (id INTEGER PRIMARY KEY, station TEXT, jour TEXT, temp REAL);
      INSERT INTO releves VALUES (10, 'Brest', '2026-03-01', 9.5), (11, 'Brest', '2026-03-02', 11),
        (12, 'Nice', '2026-03-01', 15), (13, 'Nice', '2026-03-02', 16.5);`,
    autres: [2],
    verif: ({ rows, ouvrir }) => {
      const db = ouvrir(), n = () => db.exec('SELECT COUNT(*) FROM releves')[0].values[0][0];
      db.exec('DELETE FROM releves WHERE id = 10'); const a = n();
      db.exec('DELETE FROM releves'); const b = n();
      db.exec('DROP TABLE releves'); let erreur = false; try { n(); } catch (e) { erreur = true; }
      db.close();
      return String(a) === rows[0][1] && String(b) === rows[1][1] && erreur && rows[3][2] === 'supprimée' ? null : `après les instructions : ${a}, ${b}, erreur ${erreur}`;
    },
  },
  'ent-v2-22': {
    u: 'escape game',
    avant: `CREATE TABLE salles (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO salles VALUES (1, 'Le Manoir'), (2, 'La Crypte');`,
    erreurs: [1],
    verif: ({ db, rows }) => {
      db.exec("INSERT INTO parties VALUES (1, 'P-001', 1, 90)");
      const essais = ["(1, 'P-002', 1, 90)", "(2, 'P-001', 1, 90)", "(3, NULL, 1, 90)", "(4, 'P-004', 9, 90)", "(5, 'P-005', 1, -10)"];
      const motifs = ['UNIQUE constraint failed: parties.id', 'UNIQUE constraint failed: parties.code', 'NOT NULL constraint failed', 'FOREIGN KEY constraint failed', 'CHECK constraint failed: montant_positif'];
      const contraintes = ['PRIMARY KEY', 'UNIQUE', 'NOT NULL', 'FOREIGN KEY', 'CHECK'];
      for (let k = 0; k < essais.length; k++) {
        if (rows[k][2] !== contraintes[k]) return `ligne ${k} : ${rows[k][2]}`;
        try { db.exec('INSERT INTO parties VALUES ' + essais[k]); return `acceptée : ${essais[k]}`; } catch (e) { if (!e.message.includes(motifs[k])) return `${essais[k]} : ${e.message}`; }
      }
      return null;
    },
  },
  'ent-v2-23': {
    u: 'club de sport',
    avant: `CREATE TABLE membres (id INTEGER PRIMARY KEY, email TEXT);
      INSERT INTO membres VALUES (1, 'ines@club.fr'), (2, 'marc@club.fr');
      CREATE TABLE essais (id INTEGER PRIMARY KEY, email TEXT);
      INSERT INTO essais VALUES (1, 'marc@club.fr'), (2, 'zoe@club.fr');`,
    res: { 0: [['ines@club.fr'], ['marc@club.fr'], ['marc@club.fr'], ['zoe@club.fr']], 1: [['ines@club.fr'], ['marc@club.fr'], ['zoe@club.fr']] },
    ex: [{ sql: `SELECT email, t, 'gardé', CASE WHEN ROW_NUMBER() OVER (PARTITION BY email ORDER BY o, id) = 1 THEN 'gardé' ELSE 'retiré' END
      FROM (SELECT email, 'membres' t, 1 o, id FROM membres UNION ALL SELECT email, 'essais', 2, id FROM essais) ORDER BY o, id` }],
  },
  'ent-v2-24': {
    u: 'food truck',
    avant: `CREATE TABLE plats (id INTEGER PRIMARY KEY, nom TEXT, categorie TEXT, prix REAL);
      INSERT INTO plats VALUES (1, 'Classique', 'Burgers', 11), (2, 'Végé', 'Burgers', 13), (3, 'César', 'Salades', 10),
        (4, 'Niçoise', 'Salades', 9), (5, 'Quinoa', 'Salades', 8), (6, 'Cookie', 'Desserts', 4), (7, 'Tiramisu', 'Desserts', 6);
      CREATE TABLE ventes (id INTEGER PRIMARY KEY, plat_id INTEGER REFERENCES plats(id), quantite INTEGER);
      INSERT INTO ventes VALUES (1, 1, 3), (2, 4, 2);`,
    res: { 0: [['Burgers', '2', '12'], ['Salades', '3', '9'], ['Desserts', '2', '5']], 1: [['Classique', '3'], ['Niçoise', '2']] },
    ex: [{ instr: 0 }],
    verif: ({ db }) => {
      try { db.exec('SELECT categorie, AVG(prix) AS prix_moyen FROM plats WHERE prix_moyen > 10 GROUP BY categorie'); return 'WHERE sur l’alias d’un agrégat est accepté'; } catch (e) { return null; }
    },
  },
  'ent-v2-25': {
    u: 'auto-école',
    avant: `CREATE TABLE lecons (id INTEGER PRIMARY KEY, eleve_id INTEGER, minutes INTEGER, statut TEXT);
      INSERT INTO lecons VALUES (1, 1, 60, 'faite'), (2, 1, 80, 'faite'), (3, 2, 90, 'faite'), (4, 2, 90, 'faite'),
        (5, 3, 60, 'faite'), (6, 4, 120, 'faite'), (7, 3, 60, 'annulée'), (8, 1, 60, 'annulée');`,
    res: { 0: [['2', '180'], ['1', '140'], ['4', '120']] },
    ex: [{ cols: [2], rcols: [1], sql: `SELECT 1, COUNT(*) FROM lecons
      UNION ALL SELECT 2, COUNT(*) FROM lecons WHERE statut = 'faite'
      UNION ALL SELECT 3, COUNT(DISTINCT eleve_id) FROM lecons WHERE statut = 'faite'
      UNION ALL SELECT k, COUNT(*) FROM (SELECT eleve_id FROM lecons WHERE statut = 'faite' GROUP BY eleve_id HAVING SUM(minutes) > 100), (SELECT 4 k UNION ALL SELECT 5 UNION ALL SELECT 6) GROUP BY k
      ORDER BY 1` }],
  },
  'ent-v2-26': {
    u: 'entreprise', garde: true,
    avant: `CREATE TABLE services (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO services VALUES (1, 'Marketing'), (2, 'Finance'), (3, 'Juridique');
      CREATE TABLE employes (id INTEGER PRIMARY KEY, nom TEXT, service_id INTEGER REFERENCES services(id));
      INSERT INTO employes VALUES (1, 'Sophie', 1), (2, 'Lucas', 2), (3, 'Emma', NULL);`,
    res: { 0: [['Sophie', 'Marketing'], ['Lucas', 'Finance'], ['Emma', 'NULL']] },
    ex: [{ cols: [0, 1], sql: `SELECT 'INNER JOIN', COUNT(*) FROM employes e JOIN services s ON s.id = e.service_id
      UNION ALL SELECT 'LEFT JOIN', COUNT(*) FROM employes e LEFT JOIN services s ON s.id = e.service_id
      UNION ALL SELECT 'RIGHT JOIN', COUNT(*) FROM employes e RIGHT JOIN services s ON s.id = e.service_id
      UNION ALL SELECT 'FULL OUTER JOIN', COUNT(*) FROM employes e FULL OUTER JOIN services s ON s.id = e.service_id
      UNION ALL SELECT 'CROSS JOIN', COUNT(*) FROM employes CROSS JOIN services` }],
    verif: ({ resultats }) => (resultats[1].values.length === 9 ? null : `CROSS JOIN : ${resultats[1].values.length} lignes`),
  },
  'ent-v2-27': {
    u: 'bibliothèque',
    avant: `CREATE TABLE livres (id INTEGER PRIMARY KEY, titre TEXT);
      INSERT INTO livres VALUES (1, 'Dune'), (2, 'Germinal'), (3, 'Le Horla'), (4, 'Nana');
      CREATE TABLE emprunts (id INTEGER PRIMARY KEY, livre_id INTEGER REFERENCES livres(id), date_emprunt TEXT, date_retour TEXT);
      INSERT INTO emprunts VALUES (10, 1, '2026-01-05', '2026-01-20'), (11, 1, '2026-02-02', NULL),
        (12, 2, '2026-01-12', '2026-01-30'), (13, 4, '2026-02-10', NULL);`,
    res: { 0: [['Le Horla']], 1: [['Le Horla']] },
    ex: [{ sql: `SELECT l.titre, e.id, CASE WHEN e.id IS NULL THEN 'gardé' ELSE 'écarté' END
      FROM livres l LEFT JOIN emprunts e ON e.livre_id = l.id ORDER BY l.id, e.id` }],
  },
  'ent-v2-28': {
    u: 'escape game',
    avant: `CREATE TABLE salles (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO salles VALUES (1, 'Le Manoir'), (2, 'La Crypte');
      CREATE TABLE parties (id INTEGER PRIMARY KEY, salle_id INTEGER REFERENCES salles(id), duree INTEGER);
      INSERT INTO parties VALUES (1, 1, 75), (2, 1, 45), (3, 2, 48), (4, 2, 32);`,
    res: { 0: [['1', '1', '75']], 1: [['1', '1', '75'], ['3', '2', '48']] },
    ex: [{ sql: `SELECT CASE salle_id WHEN 1 THEN 'Manoir' ELSE 'Crypte' END, duree, (SELECT AVG(duree) FROM parties),
        (SELECT AVG(p2.duree) FROM parties p2 WHERE p2.salle_id = p.salle_id) FROM parties p ORDER BY id` }],
  },
  'ent-v2-29': {
    u: 'refuge animalier',
    avant: `CREATE TABLE familles (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO familles VALUES (1, 'Lambert'), (2, 'Diallo'), (3, 'Rossi');
      CREATE TABLE adoptions (id INTEGER PRIMARY KEY, animal TEXT, famille_id INTEGER REFERENCES familles(id));
      INSERT INTO adoptions VALUES (1, 'Moka', 1), (2, 'Pixel', 1), (3, 'Filou', 2);`,
    res: { 0: [['Lambert'], ['Diallo']], 1: [['Lambert'], ['Diallo']] },
    ex: [{ sql: `SELECT nom, id, CASE WHEN id IN (SELECT famille_id FROM adoptions) THEN 'vrai' ELSE 'faux' END,
        CASE WHEN EXISTS (SELECT 1 FROM adoptions a WHERE a.famille_id = f.id) THEN 'vrai' ELSE 'faux' END
      FROM familles f ORDER BY id` }],
  },
  'ent-v2-30': {
    u: 'course à pied',
    avant: `CREATE TABLE coureurs (id INTEGER PRIMARY KEY, nom TEXT, club TEXT, km INTEGER);
      INSERT INTO coureurs VALUES (1, 'Nils', 'Lille', 10), (2, 'Ada', 'Lille', 25), (3, 'Rémi', 'Lille', 30),
        (4, 'Inès', 'Lyon', 42), (5, 'Malo', 'Lyon', 28), (6, 'Zoé', 'Lyon', 8);`,
    autres: [0],
    res: { 0: [['Inès', '42']] },
    ex: [{ sql: `SELECT nom, km, CASE WHEN km > (SELECT MIN(km) FROM coureurs WHERE club = 'Lille') THEN 'vrai' ELSE 'faux' END,
        CASE WHEN km > (SELECT MAX(km) FROM coureurs WHERE club = 'Lille') THEN 'vrai' ELSE 'faux' END
      FROM coureurs WHERE club = 'Lyon' ORDER BY id` }],
  },
  'ent-v2-31': {
    u: 'ferme apicole',
    avant: `CREATE TABLE recoltes (id INTEGER PRIMARY KEY, ruche_id INTEGER, kg INTEGER);
      INSERT INTO recoltes VALUES (1, 1, 30), (2, 1, 25), (3, 2, 40), (4, 3, 20), (5, 4, 45), (6, 4, 25);`,
    res: { 0: [['1', '55'], ['4', '70']] },
    ex: [{ sql: `SELECT ruche_id, SUM(kg), CASE WHEN SUM(kg) > 50 THEN 'gardée' ELSE 'écartée' END FROM recoltes GROUP BY ruche_id ORDER BY ruche_id` }],
  },
  'ent-v2-32': {
    u: 'plateforme de musique',
    avant: `CREATE TABLE titres (id INTEGER PRIMARY KEY, titre TEXT, genre TEXT);
      INSERT INTO titres VALUES (1, 'Minuit', 'pop'), (2, 'Orage', 'jazz'), (3, 'Sirocco', 'pop'), (4, 'Brume', 'rap'),
        (5, 'Écume', 'pop'), (6, 'Givre', 'rock'), (7, 'Lagune', 'jazz'), (8, 'Comète', 'pop');`,
    res: { 0: [['pop', '4', '50'], ['jazz', '2', '25'], ['rap', '1', '12.5'], ['rock', '1', '12.5']] },
    ex: [{ instr: 0 }],
    verif: ({ db }) => {
      const r = db.exec("SELECT p FROM (SELECT genre, COUNT(*) * 100 / SUM(COUNT(*)) OVER () AS p FROM titres GROUP BY genre) WHERE genre = 'rap'")[0].values[0][0];
      return r === 12 ? null : `avec 100, le rap pèse ${r}`;
    },
  },
  'ent-v2-33': {
    u: 'refuge animalier',
    avant: `CREATE TABLE animaux (id INTEGER PRIMARY KEY, nom TEXT, espece TEXT, age INTEGER);
      INSERT INTO animaux VALUES (1, 'Moka', 'chat', 3), (2, 'Pixel', 'chat', 5), (3, 'Tigrou', 'chat', 4),
        (4, 'Rex', 'chien', 8), (5, 'Filou', 'chien', 4), (6, 'Caramel', 'lapin', 2);`,
    res: { 1: [['chat', '4', '3'], ['chien', '6', '2'], ['lapin', '2', '1']] },
    ex: [{ sql: `SELECT espece, AVG(age), COUNT(nom) || CASE WHEN COUNT(nom) > 1 THEN ' noms' ELSE ' nom' END FROM animaux GROUP BY espece ORDER BY espece` }],
  },
  'ent-v2-34': {
    u: 'auto-école',
    avant: `CREATE TABLE eleves (id INTEGER PRIMARY KEY, nom TEXT, telephone TEXT, email TEXT);
      INSERT INTO eleves VALUES (1, 'Lou', '0612345678', 'lou@mail.fr'), (2, 'Sam', NULL, 'sam@mail.fr'), (3, 'Noé', NULL, NULL);`,
    res: { 0: [['0612345678', 'lou@mail.fr', '0612345678'], ['NULL', 'sam@mail.fr', 'sam@mail.fr'], ['NULL', 'NULL', 'Aucun contact']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-35': {
    u: 'food truck',
    avant: `CREATE TABLE statistiques (emplacement TEXT, recette INTEGER, nb_tickets INTEGER);
      INSERT INTO statistiques VALUES ('Marché', 960, 80), ('Gare', 450, 50), ('Port', 0, 0);`,
    res: { 0: [['Marché', '12'], ['Gare', '9'], ['Port', 'NULL']] },
    ex: [{ sql: 'SELECT emplacement, recette, nb_tickets, recette / NULLIF(nb_tickets, 0) FROM statistiques ORDER BY rowid' }],
    verif: ({ db }) => (db.exec('SELECT 450 / 40')[0].values[0][0] === 11 ? null : '450 / 40 ne donne pas 11'),
  },
  'ent-v2-36': {
    u: 'location de vélos',
    avant: `CREATE TABLE abonnes (id INTEGER PRIMARY KEY, nom TEXT, email TEXT);
      INSERT INTO abonnes VALUES (1, 'Anna', 'anna@mail.fr'), (2, 'Bilal', 'bilal@mail.fr'), (3, 'Chen', NULL),
        (4, 'Anna', 'anna@mail.fr'), (5, 'Dario', NULL);`,
    res: { 0: [['anna@mail.fr', '2']], 1: [['1', 'Anna', 'anna@mail.fr'], ['4', 'Anna', 'anna@mail.fr']] },
    ex: [{ sql: 'SELECT id, nom, email FROM abonnes ORDER BY id' }],
    verif: ({ db }) => (db.exec('SELECT COUNT(*) FROM (SELECT email FROM abonnes GROUP BY email HAVING COUNT(*) > 1)')[0].values[0][0] === 2 ? null : 'sans le filtre, les NULL ne forment pas un faux doublon'),
  },
  'ent-v2-37': {
    u: 'théâtre',
    avant: `CREATE TABLE spectateurs (id INTEGER PRIMARY KEY, nom TEXT, email TEXT);
      INSERT INTO spectateurs VALUES (1, 'Alix', 'alix@mail.fr'), (2, 'Bo', 'bo@mail.fr'), (3, 'Cléo', NULL),
        (4, 'Alix', 'alix@mail.fr'), (5, 'Dan', NULL), (6, 'Alix', 'alix@mail.fr');`,
    ex: [{ avant: true, sql: `SELECT id, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id),
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) = 1 THEN 'gardée' ELSE 'supprimée' END
      FROM spectateurs WHERE email IS NOT NULL ORDER BY email, id` }],
    verif: ({ db }) => {
      const r = db.exec('SELECT id FROM spectateurs ORDER BY id')[0].values.map(v => v[0]).join(',');
      return r === '1,2,3,5' ? null : `il reste les spectateurs ${r}`;
    },
  },
  'ent-v2-38': {
    u: 'ferme apicole',
    avant: `CREATE TABLE recoltes (id INTEGER PRIMARY KEY, ruche_id INTEGER, kg INTEGER);
      INSERT INTO recoltes VALUES (1, 1, 10), (2, 1, 30), (3, 2, 6), (4, 2, 9), (5, 2, 15);`,
    res: { 0: [['1', '10', '40', '25'], ['1', '30', '40', '75'], ['2', '6', '30', '20'], ['2', '9', '30', '30'], ['2', '15', '30', '50']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-39': {
    u: 'stations météo',
    avant: `CREATE TABLE releves (id INTEGER PRIMARY KEY, station TEXT, temp REAL);
      INSERT INTO releves VALUES (1, 'Brest', 10), (2, 'Brest', 16), (3, 'Nice', 18), (4, 'Nice', 20), (5, 'Nice', 25);`,
    res: { 0: [['Brest', '13'], ['Nice', '21']] },
    ex: [{ instr: 1 }],
    verif: ({ db }) => (db.exec('SELECT AVG(AVG(temp)) OVER () FROM releves GROUP BY station')[0].values[0][0] === 17 ? null : 'la moyenne des stations ne vaut pas 17'),
  },
  'ent-v2-40': {
    u: 'jeu vidéo', garde: true,
    avant: `CREATE TABLE joueurs (id INTEGER PRIMARY KEY, nom TEXT, score INTEGER);
      INSERT INTO joueurs VALUES (1, 'Nox', 950), (2, 'Kira', 870), (3, 'Zed', 870), (4, 'Lumi', 820), (5, 'Taro', 760);`,
    ex: [{ instr: 0, rcols: [1, 2, 3, 4] }],
  },
  'ent-v2-41': {
    u: 'course à pied',
    avant: `CREATE TABLE courses (id INTEGER PRIMARY KEY, coureur_id INTEGER, date_course TEXT, temps INTEGER);
      INSERT INTO courses VALUES (1, 1, '2026-03-01', 52), (2, 1, '2026-04-05', 49), (3, 2, '2026-02-15', 61),
        (4, 2, '2026-03-01', 58), (5, 2, '2026-04-05', 55);`,
    res: { 0: [['1', '52', 'NULL', '49'], ['1', '49', '52', 'NULL'], ['2', '61', 'NULL', '58'], ['2', '58', '61', '55'], ['2', '55', '58', 'NULL']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-42': {
    u: 'location de vélos',
    avant: `CREATE TABLE locations (id INTEGER PRIMARY KEY, velo_id INTEGER, date_location TEXT, km INTEGER);
      INSERT INTO locations VALUES (1, 1, '2026-01-05', 10), (2, 2, '2026-01-08', 6), (3, 2, '2026-01-20', 9),
        (4, 1, '2026-02-10', 30), (5, 2, '2026-03-02', 15);`,
    res: { 0: { cols: [0, 2, 3], rows: [['1', '10', '10'], ['1', '30', '40'], ['2', '6', '6'], ['2', '9', '15'], ['2', '15', '30']] } },
    ex: [{ sql: `SELECT velo_id, strftime('%d/%m', date_location), km,
        SUM(km) OVER (PARTITION BY velo_id ORDER BY date_location, id ROWS UNBOUNDED PRECEDING)
      FROM locations ORDER BY velo_id, date_location, id` }],
    verif: ({ db }) => {
      const r = db.exec('SELECT SUM(km) OVER (ORDER BY date_location, id) FROM locations ORDER BY date_location, id')[0].values.map(v => v[0]).join(',');
      return r === '10,16,25,55,70' ? null : `cumul sans PARTITION BY : ${r}`;
    },
  },
  'ent-v2-43': {
    u: 'musée',
    avant: `CREATE TABLE oeuvres (id INTEGER PRIMARY KEY, inventaire TEXT, titre TEXT);
      INSERT INTO oeuvres VALUES (1, 'INV-0233', 'La Pie'), (2, 'INV-0871', 'Les Meules'), (3, 'INV-0105', 'L’Absinthe'), (4, 'INV-0420', 'Le Berceau');`,
    res: { 1: [['4', 'INV-0420', 'Le Berceau']] },
    ex: [{ sql: 'SELECT inventaire, id FROM oeuvres ORDER BY inventaire' }],
    verif: ({ db }) => {
      const plan = db.exec("EXPLAIN QUERY PLAN SELECT * FROM oeuvres WHERE inventaire = 'INV-0420'")[0].values.map(v => v[3]).join(' ');
      return /USING INDEX idx_oeuvres_inv/.test(plan) ? null : `plan : ${plan}`;
    },
  },
  'ent-v2-44': {
    u: 'stations météo',
    avant: `CREATE TABLE releves (id INTEGER PRIMARY KEY, station TEXT, jour TEXT, temp REAL);
      INSERT INTO releves VALUES (1, 'Brest', '2026-02-27', 9), (2, 'Nice', '2026-02-28', 14), (3, 'Brest', '2026-03-02', 11), (4, 'Nice', '2026-03-03', 16);`,
    res: { 1: [['1', 'Brest', '2026-02-27', '9'], ['3', 'Brest', '2026-03-02', '11']], 2: [['3', 'Brest', '2026-03-02', '11']], 3: [['3', 'Brest', '2026-03-02', '11'], ['4', 'Nice', '2026-03-03', '16']] },
    verif: ({ db, rows }) => {
      const plan = s => db.exec('EXPLAIN QUERY PLAN ' + s)[0].values.map(v => v[3]).join(' ');
      const plans = [plan("SELECT * FROM releves WHERE station = 'Brest'"), plan("SELECT * FROM releves WHERE station = 'Brest' AND jour >= '2026-03-01'"), plan("SELECT * FROM releves WHERE jour >= '2026-03-01'")];
      const vu = plans.map(p => (/^SEARCH .*USING INDEX idx_releves_station_jour/.test(p) ? 'SEARCH (index)' : /^SCAN releves$/.test(p) ? 'SCAN (table)' : p));
      return JSON.stringify(vu) === JSON.stringify(rows.map(r => r[1])) ? null : `plans : ${vu.join(' | ')}`;
    },
  },
  'ent-v2-45': {
    u: 'banque', garde: true,
    avant: `CREATE TABLE comptes (id INTEGER PRIMARY KEY, solde NUMERIC CHECK (solde >= 0));
      INSERT INTO comptes VALUES (1, 500), (2, 200);`,
    verif: ({ db, ouvrir, rows, cellule }) => {
      const soldes = b => b.exec('SELECT solde FROM comptes ORDER BY id')[0].values.map(v => cellule(v[0]));
      const b = ouvrir(); const avant = soldes(b);
      b.exec('BEGIN; UPDATE comptes SET solde = solde - 100 WHERE id = 1;'); const debit = soldes(b);
      b.exec('ROLLBACK;'); const panne = soldes(b); b.close();
      const vu = [avant, debit, panne, soldes(db)];
      return JSON.stringify(vu) === JSON.stringify(rows.map(r => [cellule(r[1]), cellule(r[2])])) ? null : `soldes : ${JSON.stringify(vu)}`;
    },
  },
  'ent-v2-46': {
    u: 'cinéma',
    avant: `CREATE TABLE seances (id INTEGER PRIMARY KEY, film TEXT, debut TEXT);
      INSERT INTO seances VALUES (10, 'La Fugue', '2026-03-01 20:30'), (11, 'Les Vagues', '2026-03-01 21:00'), (12, 'Éclipse', '2026-03-02 18:00');`,
    res: { 2: [['2']], 4: [['3']] },
    verif: ({ db, rows }) => {
      const n = db.exec('SELECT COUNT(*) FROM seances')[0].values[0][0];
      const ok = n === 2 && rows.map(r => parseInt(r[1], 10)).join(',') === '3,2,3' && rows.map(r => parseInt(r[2], 10)).join(',') === '3,2,2';
      return ok ? null : `après le COMMIT : ${n} séances`;
    },
  },
  'ent-v2-47': {
    u: 'club de sport',
    avant: `CREATE TABLE adherents (id INTEGER PRIMARY KEY, nom TEXT NOT NULL);
      CREATE TABLE certificats (adherent_id INTEGER REFERENCES adherents(id), date_certif TEXT NOT NULL);`,
    erreurs: [6],
    verif: ({ db, rows }) => {
      const vu = db.exec(`SELECT a.nom, strftime('%d/%m', c.date_certif) FROM adherents a JOIN certificats c ON c.adherent_id = a.id ORDER BY a.id`)[0].values.map(v => v.join(' '));
      const voulu = rows.filter(r => r[3] === 'importé').map(r => r[0] + ' ' + r[1]);
      const absents = rows.filter(r => r[3] === 'annulé').map(r => r[0]);
      const tous = db.exec('SELECT nom FROM adherents')[0].values.map(v => v[0]);
      return JSON.stringify(vu) === JSON.stringify(voulu) && absents.every(a => !tous.includes(a)) ? null : `après le COMMIT : ${vu.join(', ')}`;
    },
  },
  'ent-v2-48': {
    u: 'musée',
    avant: `CREATE TABLE oeuvres (id INTEGER PRIMARY KEY, titre TEXT, exposee INTEGER, valeur INTEGER);
      INSERT INTO oeuvres VALUES (1, 'La Pie', 1, 3000000), (2, 'Les Meules', 0, 5000000), (3, 'L’Absinthe', 1, 4000000);`,
    res: { 1: [['1', 'La Pie'], ['3', 'L’Absinthe']] },
    colonnes: { 1: ['id', 'titre'] },
    ex: [{ sql: `SELECT o.id, o.titre, o.exposee, CASE WHEN v.id IS NULL THEN 'non' ELSE 'oui' END
      FROM oeuvres o LEFT JOIN oeuvres_exposees v ON v.id = o.id ORDER BY o.id` }],
  },
  'ent-v2-49': {
    u: 'compagnie aérienne',
    avant: `CREATE TABLE reservations_brutes (id INTEGER PRIMARY KEY, passager TEXT, telephone TEXT);
      INSERT INTO reservations_brutes VALUES (1, 'Nadia Benali', '0611223344'), (2, 'Nadia Benali', '0699887766'),
        (3, 'Yves Caron', '0655443322'), (4, 'Nadia Benali', '0611223344');`,
    ex: [{ sql: 'SELECT id, passager, telephone FROM reservations_brutes ORDER BY id' }],
    verif: ({ db }) => {
      db.exec(`INSERT INTO passagers VALUES (1, 'Nadia Benali', '0699887766'), (2, 'Yves Caron', '0655443322');
        INSERT INTO reservations VALUES (1, 1, 120), (2, 1, 95), (3, 2, 80), (4, 1, 60);
        UPDATE passagers SET telephone = '0611223344' WHERE id = 1;`);
      const n = db.exec("SELECT COUNT(DISTINCT p.telephone) FROM reservations r JOIN passagers p ON p.id = r.passager_id WHERE p.nom = 'Nadia Benali'")[0].values[0][0];
      return n === 1 ? null : `normalisé, Nadia Benali a encore ${n} numéros`;
    },
  },
  'ent-v2-50': {
    u: 'université',
    avant: `CREATE TABLE enseignants (id INTEGER PRIMARY KEY, nom TEXT);
      CREATE TABLE etudiants (id INTEGER PRIMARY KEY, nom TEXT);`,
    verif: ({ db, rows }) => {
      db.exec(`INSERT INTO enseignants VALUES (1, 'Mme Durel'); INSERT INTO etudiants VALUES (1, 'Iris'), (2, 'Ravi');
        INSERT INTO cours VALUES (101, 1), (102, 1);`);
      for (const r of rows) db.exec(`INSERT INTO inscriptions VALUES (${r[0]}, ${r[1]})`);
      try { db.exec('INSERT INTO inscriptions VALUES (1, 101)'); return 'la même inscription est acceptée deux fois'; } catch (e) { /* refusée, comme annoncé */ }
      try { db.exec('INSERT INTO inscriptions VALUES (3, 101)'); return 'un étudiant inconnu est accepté'; } catch (e) { return null; }
    },
  },
  'ent-v2-51': {
    u: 'camping',
    avant: `CREATE TABLE sejours (id INTEGER PRIMARY KEY, date_paiement TEXT, montant INTEGER);
      INSERT INTO sejours VALUES (1, '2026-07-01', 100), (2, '2026-07-02', 50), (3, '2026-07-02', 80), (4, '2026-07-03', 40);`,
    res: { 0: [['2026-07-01', '100', '100', '100'], ['2026-07-02', '50', '150', '230'], ['2026-07-02', '80', '230', '230'], ['2026-07-03', '40', '270', '270']] },
    ex: [{ sql: `SELECT strftime('%d/%m', date_paiement), montant,
        SUM(montant) OVER (ORDER BY date_paiement, id ROWS UNBOUNDED PRECEDING),
        SUM(montant) OVER (ORDER BY date_paiement RANGE UNBOUNDED PRECEDING)
      FROM sejours ORDER BY date_paiement, id` }],
  },
  'ent-v2-52': {
    u: 'magasins', garde: true,
    avant: `CREATE TABLE ventes (id INTEGER PRIMARY KEY, magasin TEXT, vendeur TEXT, chiffre_affaires INTEGER);
      INSERT INTO ventes VALUES (1, 'Paris', 'Sophie', 8000), (2, 'Paris', 'Lucas', 6500), (3, 'Paris', 'Emma', 5000),
        (4, 'Paris', 'Nathan', 3000), (5, 'Bordeaux', 'Léa', 9000), (6, 'Bordeaux', 'Hugo', 7000),
        (7, 'Bordeaux', 'Inès', 4500), (8, 'Bordeaux', 'Chloé', 2000);`,
    res: { 0: [['Bordeaux', 'Léa', '9000', '1'], ['Bordeaux', 'Hugo', '7000', '2'], ['Bordeaux', 'Inès', '4500', '3'], ['Paris', 'Sophie', '8000', '1'], ['Paris', 'Lucas', '6500', '2'], ['Paris', 'Emma', '5000', '3']] },
    ex: [{ sql: `SELECT magasin, vendeur, chiffre_affaires, ROW_NUMBER() OVER (PARTITION BY magasin ORDER BY chiffre_affaires DESC, id)
      FROM ventes ORDER BY magasin DESC, 4` }],
  },
  'ent-v2-53': {
    u: 'station de ski',
    avant: `CREATE TABLE forfaits (id INTEGER PRIMARY KEY, forfait TEXT, prix INTEGER);
      INSERT INTO forfaits VALUES (1, 'Journée', 45), (2, 'Semaine', 220), (3, 'Matin', 25), (4, '3 jours', 120);`,
    res: { 0: [['Matin', '25', '25', '220'], ['Journée', '45', '25', '220'], ['3 jours', '120', '25', '220'], ['Semaine', '220', '25', '220']] },
    ex: [{ sql: `SELECT forfait, prix, LAST_VALUE(prix) OVER (ORDER BY prix),
        LAST_VALUE(prix) OVER (ORDER BY prix ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
      FROM forfaits ORDER BY prix` }],
  },
  'ent-v2-54': {
    u: 'entreprise', garde: true,
    avant: `CREATE TABLE employes (id INTEGER PRIMARY KEY, nom TEXT, manager_id INTEGER);
      INSERT INTO employes VALUES (1, 'Sophie', NULL), (2, 'Lucas', 1), (3, 'Emma', 1), (4, 'Nathan', 2), (5, 'Léa', 4);`,
    ex: [{ sql: `WITH RECURSIVE o AS (SELECT id, nom, 1 AS niveau FROM employes WHERE manager_id IS NULL
        UNION ALL SELECT e.id, e.nom, o.niveau + 1 FROM employes e JOIN o ON e.manager_id = o.id WHERE o.niveau < 10)
      SELECT o.nom, COALESCE(m.nom, '—'), o.niveau, 'passage ' || o.niveau
      FROM o JOIN employes x ON x.id = o.id LEFT JOIN employes m ON m.id = x.manager_id ORDER BY o.niveau, o.id` }],
  },
  'ent-v2-55': {
    u: 'aquarium',
    avant: `CREATE TABLE soigneurs (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO soigneurs VALUES (1, 'Maya'), (2, 'Théo'), (3, 'Lison');
      CREATE TABLE nourrissages (id INTEGER PRIMARY KEY, bassin TEXT, soigneur_id INTEGER REFERENCES soigneurs(id));
      INSERT INTO nourrissages VALUES (101, 'Lagon', 1), (102, 'Récif', 2), (103, 'Requins', 1), (104, 'Lagon', NULL);`,
    res: { 0: [], 1: [['Lison']], 2: [['Lison']] },
    ex: [{ sql: `SELECT nom, id,
        CASE WHEN id NOT IN (SELECT soigneur_id FROM nourrissages) THEN 'vrai'
          WHEN id IN (SELECT soigneur_id FROM nourrissages) THEN 'faux' ELSE 'inconnu' END,
        CASE WHEN NOT EXISTS (SELECT 1 FROM nourrissages n WHERE n.soigneur_id = s.id) THEN 'vrai' ELSE 'faux' END
      FROM soigneurs s ORDER BY id` }],
  },
  'ent-v2-56': {
    u: 'festival de musique',
    avant: `CREATE TABLE billets (id INTEGER PRIMARY KEY, festivalier_id INTEGER, statut TEXT, prix INTEGER);
      INSERT INTO billets VALUES (1, 1, 'Payé', 100), (2, 1, 'Payé', 50), (3, 1, 'Remboursé', 30), (4, 2, 'Payé', 200), (5, 2, 'Remboursé', 40);`,
    res: { 0: [['1', '150', '30'], ['2', '200', '40']] },
    ex: [{ rcols: [1, 2, 3, 4], sql: `SELECT 1 k, statut, prix, CASE WHEN statut = 'Payé' THEN prix ELSE 0 END,
        CASE WHEN statut = 'Remboursé' THEN prix ELSE 0 END, id FROM billets WHERE festivalier_id = 1
      UNION ALL SELECT 2, 'SUM', '', SUM(CASE WHEN statut = 'Payé' THEN prix ELSE 0 END),
        SUM(CASE WHEN statut = 'Remboursé' THEN prix ELSE 0 END), 0 FROM billets WHERE festivalier_id = 1
      ORDER BY k, id` }],
  },
  'ent-v2-57': {
    u: 'compagnie aérienne',
    avant: `CREATE TABLE reservations (id INTEGER PRIMARY KEY, passager_id INTEGER, statut TEXT, prix INTEGER);
      INSERT INTO reservations VALUES (1, 1, 'Payée', 150), (2, 1, 'Annulée', 90), (3, 2, 'Payée', 120), (4, 2, 'Payée', 80),
        (5, 3, 'Annulée', 60), (6, 3, 'Annulée', 70);`,
    res: { 0: [['1', '150', '1'], ['2', '200', '0'], ['3', 'NULL', '2']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-58': {
    u: 'théâtre',
    avant: `CREATE TABLE reservations (id INTEGER PRIMARY KEY, spectateur_id INTEGER, statut TEXT, montant INTEGER);
      INSERT INTO reservations VALUES (1, 1, 'Payée', 100), (2, 1, 'Payée', 50), (3, 1, 'Annulée', 30), (4, 2, 'Payée', 200), (5, 2, 'Annulée', 40);`,
    autres: [0],
    res: { 0: [['1', '150', '30'], ['2', '200', '40']] },
    ex: [{ instr: 0 }],
  },
  'ent-v2-59': {
    u: 'plateforme de musique',
    avant: `CREATE TABLE artistes_json (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO artistes_json VALUES (1, '{"nom": "Lumen", "debut": 2018, "pays": "France", "label": {"ville": "Lyon"}}'),
        (2, '{"nom": "Nova", "debut": 2021, "pays": "France", "label": {"ville": "Paris"}}'),
        (3, '{"nom": "Aiko", "debut": 2015, "pays": "Japon", "label": {"ville": "Osaka"}}');`,
    autres: [0, 2],
    res: { 0: [['Lyon'], ['Paris'], ['Osaka']] },
    ex: [{ cols: [0, 1], lignes: r => r[0] === "data->'nom'" || r[0] === "data->>'nom'",
      sql: `SELECT 'data->''nom''', data->'nom' FROM artistes_json WHERE id = 1 UNION ALL SELECT 'data->>''nom''', data->>'nom' FROM artistes_json WHERE id = 1` }],
    verif: ({ db, rows }) => {
      const r = db.exec("SELECT GROUP_CONCAT(data->>'nom', ', ' ORDER BY id) FROM artistes_json WHERE json_extract(data, '$.pays') = 'France'")[0].values[0][0];
      return r === rows[3][1] ? null : `les artistes français : ${r}`;
    },
  },
  'ent-v2-60': {
    u: 'refuge animalier',
    avant: `CREATE TABLE animaux_json (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO animaux_json VALUES (1, '{"nom": "Moka", "age": 3}'), (2, '{"nom": "Pixel", "age": 5}');`,
    res: { 0: [['Moka', '3']] },
    ex: [{ cols: [0, 1], lignes: r => r[0] !== 'JSON_EXTRACT(…)', sql: `SELECT '->', data -> '$.nom' FROM animaux_json WHERE id = 1 UNION ALL SELECT '->>', data ->> '$.nom' FROM animaux_json WHERE id = 1` }],
    verif: ({ rows }) => (rows[0][1] === rows[1][1] ? null : 'JSON_EXTRACT et -> ne renvoient pas la même valeur'),
  },
  'ent-v2-61': {
    u: 'compagnie aérienne',
    avant: `CREATE TABLE passagers_json (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO passagers_json VALUES (1, '{"nom": "Inès", "bagage": {"poids": 23}, "vols": [101, 102, 103]}');`,
    autres: [0, 1, 2],
    /* Les équivalents SQLite de JSON_VALUE, JSON_QUERY et OPENJSON donnent les mêmes valeurs. */
    ex: [{ sql: `SELECT 'JSON_VALUE', json_extract(data, '$.nom') FROM passagers_json
      UNION ALL SELECT 'JSON_QUERY', json_extract(data, '$.bagage') FROM passagers_json
      UNION ALL SELECT 'OPENJSON', (SELECT GROUP_CONCAT(value, ' · ') FROM json_each(p.data, '$.vols')) FROM passagers_json p` }],
  },
  'ent-v2-62': {
    u: 'service d’urgences',
    avant: `CREATE TABLE passages (id INTEGER PRIMARY KEY, patient_id INTEGER, arrivee TEXT);
      INSERT INTO passages VALUES (1, 10, '2026-03-01 08:10'), (2, 7, '2026-03-01 09:30'), (3, 10, '2026-03-04 22:45');`,
    autres: [1],
    exLibre: 'les éléments de la sortie d’EXPLAIN ANALYZE de PostgreSQL, que SQLite n’a pas',
  },
  'ent-v2-63': {
    u: 'bibliothèque',
    avant: `CREATE TABLE livres (id INTEGER PRIMARY KEY, titre TEXT, auteur TEXT, disponible INTEGER);
      INSERT INTO livres VALUES (1, 'Les Misérables', 'Hugo', 1), (2, 'Germinal', 'Zola', 1), (3, 'Nana', 'Zola', 0), (4, 'Notre-Dame de Paris', 'HUGO', 1);`,
    verif: ({ ouvrir, db, rows }) => {
      const plan = (b, s) => b.exec('EXPLAIN QUERY PLAN ' + s)[0].values.map(v => v[3]).join(' ');
      const b = ouvrir(); b.exec('CREATE INDEX idx_livres_auteur ON livres(auteur)');
      const vu = ["SELECT * FROM livres WHERE auteur = 'Hugo'", "SELECT * FROM livres WHERE UPPER(auteur) = 'HUGO'", 'SELECT * FROM livres WHERE disponible = 1']
        .map(s => plan(b, s).split(' ')[0]);
      b.close();
      if (JSON.stringify(vu) !== JSON.stringify(rows.map(r => r[1]))) return `plans : ${vu.join(', ')}`;
      const apres = plan(db, "SELECT * FROM livres WHERE UPPER(auteur) = 'HUGO'");
      if (!/^SEARCH livres USING INDEX idx_livres_auteur_upper/.test(apres)) return `avec l’index sur l’expression : ${apres}`;
      const n = db.exec("SELECT COUNT(*) FROM livres WHERE UPPER(auteur) = 'HUGO'")[0].values[0][0];
      return n === 2 ? null : `UPPER(auteur) = 'HUGO' trouve ${n} livres`;
    },
  },
  'ent-v2-64': {
    u: 'festival de musique',
    avant: `CREATE TABLE festivaliers (id INTEGER PRIMARY KEY, nom TEXT, email TEXT, pass TEXT);
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
      INSERT INTO festivaliers SELECT i, 'Festivalier ' || i, CASE WHEN i = 1 THEN 'jade@mail.fr' ELSE 'f' || i || '@mail.fr' END,
        CASE WHEN i % 2 = 0 THEN '3 jours' ELSE '1 jour' END FROM n;`,
    res: { 0: { cols: [2], rows: [['jade@mail.fr']] } },
    ex: [{ sql: `SELECT 'email', COUNT(DISTINCT email), (SELECT COUNT(*) FROM festivaliers WHERE email = 'jade@mail.fr') FROM festivaliers
      UNION ALL SELECT 'pass', COUNT(DISTINCT pass) || ' (1 jour, 3 jours)', (SELECT COUNT(*) FROM festivaliers WHERE pass = '3 jours') FROM festivaliers` }],
    verif: ({ resultats }) => (resultats[1].values.length === 500 ? null : `pass 3 jours : ${resultats[1].values.length} lignes`),
  },
  'ent-v2-65': {
    u: 'cinéma',
    autres: [0],
    exLibre: 'les anomalies que chaque niveau d’isolation laisse passer, d’après le standard',
  },
  'ent-v2-66': {
    u: 'banque', garde: true, sessions: true,
    avant: `CREATE TABLE comptes (id INTEGER PRIMARY KEY, solde NUMERIC);
      INSERT INTO comptes VALUES (1, 500), (2, 200);`,
    exLibre: 'deux sessions qui s’attendent l’une l’autre : une base sql.js n’a qu’une connexion, chaque session est jouée à part',
  },
  'ent-v2-67': {
    u: 'banque', garde: true, sessions: true,
    avant: `CREATE TABLE comptes (id INTEGER PRIMARY KEY, solde NUMERIC);
      INSERT INTO comptes VALUES (1, 1000);`,
    /* SET TRANSACTION ISOLATION LEVEL n’existe pas dans SQLite, qui ne fait pas de lecture sale. */
    erreurs: [2],
    exLibre: 'deux transactions en parallèle : une base sql.js n’a qu’une connexion, chaque session est jouée à part',
    verif: ({ db }) => (db.exec('SELECT solde FROM comptes WHERE id = 1')[0].values[0][0] === 1000 ? null : 'après le ROLLBACK, le solde n’est plus 1000'),
  },
  'ent-v2-68': {
    u: 'musée',
    avant: `CREATE TABLE oeuvres (id INTEGER PRIMARY KEY, titre TEXT, salle TEXT);
      INSERT INTO oeuvres VALUES (1, 'La Pie', 'Salle 2'), (2, 'Les Meules', 'Salle 5');
      CREATE TABLE inventaire (id INTEGER PRIMARY KEY, titre TEXT, salle TEXT);
      INSERT INTO inventaire VALUES (2, 'Les Meules', 'Réserve'), (3, 'L’Absinthe', 'Salle 1');`,
    autres: [0],
    ex: [{ sql: `SELECT COALESCE(o.id, i.id), COALESCE(o.salle, '—'), COALESCE(i.salle, '—'),
        CASE WHEN o.id IS NULL THEN 'INSERT' WHEN i.id IS NULL THEN 'aucune' ELSE 'UPDATE' END
      FROM oeuvres o FULL OUTER JOIN inventaire i ON i.id = o.id ORDER BY 1` }],
    /* Le même effet que MERGE, écrit en SQLite : la cible finale garde l’œuvre 1, met à jour la 2, ajoute la 3. */
    verif: ({ db }) => {
      db.exec('INSERT INTO oeuvres (id, titre, salle) SELECT id, titre, salle FROM inventaire WHERE true ON CONFLICT (id) DO UPDATE SET salle = excluded.salle');
      const r = db.exec('SELECT id, salle FROM oeuvres ORDER BY id')[0].values.map(v => v.join(' ')).join(', ');
      return r === '1 Salle 2, 2 Réserve, 3 Salle 1' ? null : `après la synchronisation : ${r}`;
    },
  },
  'ent-v2-69': {
    u: 'food truck',
    avant: `CREATE TABLE tickets (id INTEGER PRIMARY KEY, statut TEXT);
      INSERT INTO tickets VALUES (1, 'payé'), (2, 'servi'), (3, 'payé');
      CREATE TABLE plats (id INTEGER PRIMARY KEY, nom TEXT, prix NUMERIC);
      INSERT INTO plats VALUES (1, 'Classique', 12), (2, 'César', 9.5);`,
    autres: [0, 1, 2, 3],
    exLibre: 'un tableau de notions (procédure et fonction)',
    /* Le corps des deux traitements, lui, s’exécute aussi dans SQLite. */
    verif: ({ db }) => {
      db.exec("UPDATE tickets SET statut = 'servi' WHERE statut = 'payé'");
      const n = db.exec("SELECT COUNT(*) FROM tickets WHERE statut = 'servi'")[0].values[0][0];
      const ttc = db.exec('SELECT ROUND(12 * 1.1, 2)')[0].values[0][0];
      return n === 3 && ttc === 13.2 ? null : `après la clôture : ${n} tickets servis, TTC ${ttc}`;
    },
  },
  'ent-v2-70': {
    u: 'station de ski',
    avant: `CREATE TABLE forfaits (id INTEGER PRIMARY KEY, nom TEXT, prix INTEGER);
      INSERT INTO forfaits VALUES (1, 'Journée', 45), (2, 'Matin', 25);
      CREATE TABLE historique_tarifs (forfait_id INTEGER, ancien INTEGER, nouveau INTEGER);`,
    verif: ({ db, rows, cellule }) => {
      db.exec("UPDATE forfaits SET prix = 27 WHERE id = 2; UPDATE forfaits SET prix = 47 WHERE id = 1; UPDATE forfaits SET nom = 'Journée ski' WHERE id = 1;");
      const vu = db.exec('SELECT forfait_id, ancien, nouveau FROM historique_tarifs ORDER BY rowid')[0].values.map(r => r.map(cellule).join(' | '));
      return JSON.stringify(vu) === JSON.stringify(rows.map(r => r.map(cellule).join(' | '))) ? null : `historique : ${vu.join(' ; ')}`;
    },
  },
  'ent-v2-71': {
    u: 'plateforme de musique',
    avant: `CREATE TABLE abonnements (id INTEGER PRIMARY KEY, date_paiement TEXT, montant NUMERIC);
      INSERT INTO abonnements VALUES (1, '2026-06-03', 50), (2, '2026-06-18', 100), (3, '2026-05-30', 70);`,
    autres: [1, 2],
    /* La vue matérialisée de PostgreSQL, imitée par une table copiée : elle garde le résultat jusqu’à ce qu’on la recrée. */
    verif: ({ db, rows, cellule }) => {
      const lire = t => db.exec(`SELECT recette FROM ${t} WHERE mois = '2026-06'`)[0].values[0][0];
      db.exec('CREATE TABLE mv AS SELECT * FROM recettes_mensuelles');
      const avant = [lire('recettes_mensuelles'), lire('mv')];
      db.exec("INSERT INTO abonnements VALUES (4, '2026-06-25', 30)");
      const apres = [lire('recettes_mensuelles'), lire('mv')];
      db.exec('DROP TABLE mv; CREATE TABLE mv AS SELECT * FROM recettes_mensuelles');
      const vu = [avant, apres, [lire('recettes_mensuelles'), lire('mv')]].map(r => r.map(cellule));
      return JSON.stringify(vu) === JSON.stringify(rows.map(r => [cellule(r[1]), cellule(r[2])])) ? null : `recettes : ${JSON.stringify(vu)}`;
    },
  },
  'ent-v2-72': {
    u: 'camping',
    avant: `CREATE TABLE sejours (id INTEGER PRIMARY KEY, campeur TEXT);
      INSERT INTO sejours VALUES (1, 'Janssens');
      CREATE TABLE lignes_sejour (id INTEGER PRIMARY KEY, sejour_id INTEGER REFERENCES sejours(id), libelle TEXT, quantite INTEGER, prix NUMERIC);
      INSERT INTO lignes_sejour VALUES (1, 1, 'Emplacement', 3, 20), (2, 1, 'Électricité', 3, 5);`,
    ex: [{ rcols: [1, 2, 3, 4], sql: `SELECT 1 k, libelle, quantite, prix, quantite * prix, id FROM lignes_sejour WHERE sejour_id = 1
      UNION ALL SELECT 2, 'Total stocké', '', '', total, 0 FROM sejours WHERE id = 1 ORDER BY k, 6` }],
  },
  'ent-v2-73': {
    u: 'auto-école',
    avant: `CREATE TABLE eleves (id INTEGER PRIMARY KEY, nom TEXT);
      INSERT INTO eleves VALUES (1, 'Lemaire'), (2, 'N''Diaye'), (3, 'Roussel');`,
    res: { 0: [['1', 'Lemaire'], ['2', "N'Diaye"], ['3', 'Roussel']], 1: [] },
    /* La saisie collée dans la requête, puis passée en paramètre. */
    verif: ({ db, rows }) => {
      const colle = saisie => { try { return String(db.exec(`SELECT COUNT(*) FROM eleves WHERE nom = '${saisie}'`)[0].values[0][0]); } catch (e) { return 'erreur'; } };
      const param = saisie => { const st = db.prepare('SELECT COUNT(*) FROM eleves WHERE nom = ?'); st.bind([saisie]); st.step(); const n = st.get()[0]; st.free(); return String(n); };
      for (const r of rows) {
        const c = colle(r[0]), p = param(r[0]);
        if ((c === 'erreur' ? 'erreur SQL' : c) !== (r[1] === 'erreur SQL' ? 'erreur SQL' : String(parseInt(r[1], 10))) || p !== String(parseInt(r[2], 10))) return `saisie ${r[0]} : ${c} / ${p}`;
      }
      return null;
    },
  },
  'ent-v2-74': {
    u: 'bibliothèque',
    avant: `CREATE TABLE livres (id INTEGER PRIMARY KEY, titre TEXT);
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100) INSERT INTO livres SELECT i, 'Livre ' || i FROM n;`,
    autres: [1],
    res: { 0: { cols: [0], rows: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(String).map(x => [x]) }, 1: { cols: [0], rows: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40].map(String).map(x => [x]) } },
    verif: ({ db, rows }) => {
      for (const r of rows) {
        const [a, b] = db.exec(`SELECT MIN(id), MAX(id) FROM (SELECT id FROM livres ORDER BY id LIMIT 10 OFFSET ${+r[1]})`)[0].values[0];
        if (`${a} à ${b}` !== r[2].replace(/ /g, ' ') || +r[1] !== (+r[0] - 1) * 10) return `page ${r[0]} : ${a} à ${b}`;
      }
      return null;
    },
  },
  'ent-v2-75': {
    u: 'entreprise', garde: true,
    avant: `CREATE TABLE employes (id INTEGER PRIMARY KEY, nom TEXT, salaire INTEGER);
      INSERT INTO employes VALUES (1, 'Hugo', 5000), (2, 'Léa', 5000), (3, 'Sara', 4200), (4, 'Tom', 3800);`,
    res: { 0: [['4200']] },
    ex: [{ sql: `SELECT nom, salaire, DENSE_RANK() OVER (ORDER BY salaire DESC), ROW_NUMBER() OVER (ORDER BY salaire DESC, id)
      FROM employes ORDER BY salaire DESC, id` }],
  },
  'ent-v2-76': {
    u: 'aquarium',
    res: { 2: [['Bulle']] },
    exLibre: 'les instructions de base et leur rôle',
  },
  'ent-v2-77': {
    u: 'bibliothèque',
    avant: `CREATE TABLE lecteurs (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
      INSERT INTO lecteurs VALUES (1, 'Clara Viguier', 'Rouen'), (2, 'Omar Haddad', 'Caen');
      CREATE TABLE livres (id INTEGER PRIMARY KEY, titre TEXT, auteur TEXT);
      INSERT INTO livres VALUES (1, 'Dune', 'Herbert'), (2, 'Nana', 'Zola');
      CREATE TABLE emprunts (id INTEGER PRIMARY KEY, lecteur_id INTEGER REFERENCES lecteurs(id), livre_id INTEGER REFERENCES livres(id), date_emprunt TEXT);
      INSERT INTO emprunts VALUES (101, 1, 1, '2026-03-02'), (102, 1, 2, '2026-03-09'), (103, 2, 1, '2026-03-11');`,
    res: { 0: [['101', 'Clara Viguier', 'Dune'], ['102', 'Clara Viguier', 'Nana'], ['103', 'Omar Haddad', 'Dune']] },
    ex: [{ instr: 0 }],
    verif: ({ db }) => { try { db.exec("INSERT INTO emprunts VALUES (104, 9, 1, '2026-03-12')"); return 'un emprunt pour un lecteur inconnu est accepté'; } catch (e) { return null; } },
  },
  'ent-v2-78': {
    u: 'jardin partagé',
    avant: `CREATE TABLE jardiniers (id INTEGER PRIMARY KEY, nom TEXT, parcelle TEXT);
      INSERT INTO jardiniers VALUES (1, 'Arnaud', 'A3'), (2, 'Bérénice', 'B1'), (3, 'Cyril', 'C2');`,
    res: { 0: [['Arnaud', 'A3']], 1: [['A3'], ['B1'], ['C2']] },
    ex: [{ sql: 'SELECT id, nom, parcelle FROM jardiniers ORDER BY id' }],
  },
  'ent-v2-79': {
    u: 'club de sport',
    autres: [2, 3],
    res: { 2: [['Jeanne Royer', 'Rennes']] },
    exLibre: 'les familles d’instructions (DDL, DML, DCL)',
  },
  'ent-v2-80': {
    u: 'cinéma',
    avant: `CREATE TABLE films (id INTEGER PRIMARY KEY, titre TEXT, genre TEXT);
      INSERT INTO films VALUES (1, 'Pompon', 'Animation'), (2, 'Le Phare', 'Animation'), (3, 'La Fugue', 'Drame'), (4, 'Vertiges', 'Thriller');`,
    ex: [{ sql: 'SELECT titre, genre, reduction FROM films ORDER BY id' }],
    verif: ({ db }) => (db.exec('SELECT COUNT(*) FROM films WHERE reduction = 20')[0].values[0][0] === 2 ? null : 'l’UPDATE ne modifie pas 2 lignes'),
  },
};
