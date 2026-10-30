/* Projet NutriBoost, chapitre 15 (leçon 83 « Procédures et fonctions stockées ») : la vidéo interactive assets/anim/projet-procedures.html,
   testée aussi dans lesson-video.test.mjs. Ajoutée le 30 octobre (le scénario d’Elisa : 18 h 02, les commandes affluent ; une action ou un
   calcul ; la procédure expedier_commande et son paramètre ; la fonction calculer_points, 1 € dépensé = 2 points ; le duel ; les quatre
   tickets). Premier cours du module « Triggers et concurrence », juste avant Les triggers. Leçon seule.
   SQLite, la base de l’app, n’a ni procédure ni fonction stockée : ce que la vidéo affirme est rejoué ici avec la requête qu’elles enregistrent. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-procedures.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l83 = lessons.find(l => l.id === 83);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- La base de la vidéo, telle que le chapitre 14 la laisse ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  /* Le chapitre 11 (MERGE) : la Fibre Prébiotique à 150, Oméga 3 à 75, la Spiruline Bio ajoutée. */
  db.run("UPDATE produits SET stock = 150 WHERE id = 1; UPDATE produits SET stock = 75 WHERE id = 7; INSERT INTO produits VALUES (9, 'Spiruline Bio', 'Nutrition', 22.90, 40);");
  db.run(`PRAGMA foreign_keys = ON;
    CREATE TABLE coachs (id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL REFERENCES coachs(id), places INTEGER DEFAULT 12);
    CREATE TABLE inscriptions (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), atelier_id INTEGER NOT NULL REFERENCES ateliers(id), date_inscription DATE);
    CREATE TABLE cartes (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id), seances_restantes INTEGER NOT NULL DEFAULT 10 CHECK (seances_restantes >= 0));
    INSERT INTO coachs VALUES (1,'Salma','Haddad','salma@pro.fr'),(2,'Moussa','Diallo','moussa@mail.fr'),(3,'Julie','Nguyen','julie@mail.fr'),(4,'Diego','Ramos','diego@mail.fr');
    INSERT INTO ateliers VALUES (1,'Récupération','2026-09-12',1,12),(2,'Pilates','2026-09-18',2,12),(3,'Cuisine saine','2026-09-19',3,12),(4,'Méditation','2026-09-24',4,12),(5,'Yoga du matin','2026-10-03',2,12);
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(5,3,1,'2026-09-05'),(7,1,4,'2026-09-07'),
      (8,2,3,'2026-09-08'),(10,8,5,'2026-09-09'),(11,9,5,'2026-09-09');
    INSERT INTO cartes VALUES (1,1,12),(2,4,7),(3,6,20);
    DELETE FROM clients WHERE id = 10;
    CREATE TABLE avis (id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, produit_id INTEGER REFERENCES produits(id), note INTEGER, commentaire TEXT);
    INSERT INTO avis VALUES (1, 9, 6, 5, 'Je recommande !');
    DELETE FROM inscriptions WHERE client_id = 9;
    DELETE FROM clients WHERE id = 9;
    CREATE TABLE remplacements (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id),
      quantite INTEGER NOT NULL, personnalisation TEXT NOT NULL);
    INSERT INTO remplacements VALUES (1, 7, 8, 1, 'Léa'); UPDATE produits SET stock = stock - 1 WHERE id = 8;
    CREATE TABLE cadeaux (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id), quantite INTEGER NOT NULL);
    INSERT INTO cadeaux (client_id, produit_id, quantite) VALUES (7, 6, 1); UPDATE produits SET stock = stock - 1 WHERE id = 6;`);
  return db;
}
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const statuts = db => db.exec('SELECT id, statut FROM commandes WHERE id >= 11 ORDER BY id')[0].values;
/* La procédure, telle que la vidéo l’enregistre : l’UPDATE de l’équipe, l’identifiant de la commande en paramètre. */
const expedier = (db, id) => { db.run("UPDATE commandes SET statut = 'expédiée' WHERE id = ?;", [id]); return db.getRowsModified(); };

test('Procédures et fonctions stockées : premier cours du module « Triggers et concurrence », juste après SAVEPOINT et juste avant Les triggers', () => {
  const m = modules.find(x => x.titre === 'Triggers et concurrence');
  assert.deepEqual([...m.lessons.map(l => l.id)], [83, 70, 71]);
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(83), liste.indexOf(63) + 1, 'juste après SAVEPOINT');
  assert.equal(liste[liste.indexOf(83) + 1], 70, 'Les triggers viennent juste après');
  assert.equal(l83.titre, 'Procédures et fonctions stockées');
  assert.equal(l83.résumé, 'Réutiliser un traitement ou un calcul');
  assert.equal(new Set(liste).size, liste.length, 'un identifiant par leçon');
});

test('recherche, carte mémo, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  83:'([^']+)',/)[1];
  assert.ok(['procedure', 'fonction', 'call', 'create procedure', 'create function', 'parametre', 'sgbd'].every(m => mots.includes(m)), 'trouvé par la recherche');
  assert.ok(l83.leconSeule && l83.video && !l83.situation && !l83.consigne && !l83.solution && !l83.petitDefi && !l83.learningCheck && !l83.testeVariants && !l83.anatomie, 'la vidéo est le cours');
  assert.equal(l83.video.moments, 6); assert.equal(l83.video.seuil, 4);
  assert.equal(l83.video.anim, 'assets/anim/projet-procedures.html?app&embed');
  assert.equal(l83.video.thumb, 'assets/anim/projet-procedures-thumb.webp');
  const carte = vm.runInContext('CARTES[83]', ctx);
  assert.ok(carte && carte.s.includes('CALL expedier_commande(13);') && carte.s.includes('SELECT calculer_points(80);'), 'une carte mémo à débloquer');
  const recap = l83.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🛠️', '🧮', '⚠️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./assets/anim/projet-procedures.html?app&embed'") && sw.includes("'./assets/anim/projet-procedures-thumb.webp'"), 'gardée pour le hors ligne');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 161.82);
  assert.ok(page.includes('notesAt: 161.82,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 169.02);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Les commandes affluent', 'Action ou calcul ?', 'Une procédure stockée', 'Une fonction stockée', 'Le duel', 'Les quatre tickets', 'Selon le SGBD', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  /* Six moments : ranger, choisir, régler, choisir deux fois (le duel), ranger (les quatre tickets). */
  assert.deepEqual(picks.map(p => p.kind), ['sort', 'pick', 'tune', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.equal(picks[1].options.length, 3, 'le paramètre : trois réponses');
  assert.deepEqual([picks[3], picks[4]].map(p => p.options.map(o => o.label)), [['Une procédure stockée', 'Une fonction stockée'], ['Une procédure stockée', 'Une fonction stockée']], 'le duel : procédure ou fonction');
  assert.deepEqual([picks[0].options.length, picks[5].options.length], [2, 4], 'deux demandes, puis quatre tickets');
  assert.deepEqual(picks[2].controls, [{k: 'm', type: 'range', label: 'Montant', min: 0, max: 200, step: 5, value: 80, unit: ' €'}], 'le réglage : le montant, de 0 à 200 €, part de 80 €');
  assert.deepEqual(picks[2].answer, {m: 120});
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 6, 'six indices écrits : un par moment');
});

test('la base du chapitre 14 : onze tables et leurs lignes ; les dernières commandes de la page sont celles de la base', () => {
  const db = base(), TB = val('TB');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.equal(TB.length, 11);
  assert.ok(page.includes('<span>11 tables</span>'));
  assert.deepEqual(val('COMMANDES'), db.exec("SELECT c.id, c.numero_commande, c.client_id, COALESCE(cl.prenom || ' ' || cl.nom, ''), c.statut FROM commandes c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.id >= 11 ORDER BY c.id")[0].values,
    'les commandes 11 à 16 de la page sont celles de la base');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 14, un savepoint<br>t’a permis d’annuler<br>une partie d’une transaction.', 'le chapitre précédent');
});

test('la procédure : l’identifiant de la commande est son paramètre ; CALL expedier_commande(13), puis (14), expédie ces deux commandes, et elles seules', () => {
  const db = base();
  assert.deepEqual(statuts(db), [[11, 'expédiée'], [12, 'en_preparation'], [13, 'en_preparation'], [14, 'en_preparation'], [15, 'en_preparation'], [16, 'en_preparation']]);
  assert.equal(expedier(db, 13), 1); assert.equal(expedier(db, 14), 1);
  assert.deepEqual(statuts(db), [[11, 'expédiée'], [12, 'en_preparation'], [13, 'expédiée'], [14, 'expédiée'], [15, 'en_preparation'], [16, 'en_preparation']], 'la même procédure, deux valeurs');
  assert.deepEqual(val('PICKS')[1].options.map(o => [o.label, !!o.ok]), [['Le nom de la table', false], ['L’identifiant de la commande', true], ['Le mot UPDATE', false]]);
  assert.ok(page.includes("['ep1', 'UPDATE commandes'], ['ep2', \"SET statut = 'expédiée'\"], ['ep3', 'WHERE id = {pid|13};']"), 'l’UPDATE de l’équipe pour la commande 13');
  assert.ok(page.includes("['ec1', '{kc1|CALL} expedier_commande({pa1|13});'], ['ec2', '{kc2|CALL} expedier_commande({pa2|14});']"), 'les deux appels');
  assert.ok(page.includes("'expedier_commande(id_commande)'") && page.includes("'expedier_commande(<b class=\"bad\">nom_table</b>)'"), 'la signature : le paramètre, ou en rouge une mauvaise réponse');
  /* Les chapitres suivants n’utilisent pas les commandes 13 et 14 : ils s’appuient sur leurs propres commandes (INDEX, Sécurité et droits). */
  for (const f of ['projet-trigger', 'projet-concurrence', 'projet-vue']) assert.ok(!/commande (13|14)\b/.test(fs.readFileSync(path.join(root, `assets/anim/${f}.html`), 'utf8')), `${f} ne parle pas des commandes 13 et 14`);
});

test('la fonction : 1 € dépensé = 2 points ; calculer_points(80) renvoie 160, (120) renvoie 240 ; le réglage juste est 120 €', () => {
  const POINTS = m => vm.runInContext(`POINTS(${m})`, D);
  assert.deepEqual([80, 120, 75].map(POINTS), [160, 240, 150]);
  /* La fonction rejouée dans SQLite : la requête qu’elle enregistre. */
  const db = base();
  assert.equal(db.exec('SELECT 80 * 2')[0].values[0][0], 160);
  assert.ok(page.includes("['ef1', 'SELECT calculer_points(80);']") && page.includes("alt('ef1b', 'SELECT calculer_points(120);', 1)"), 'l’appel, puis l’appel réglé');
  assert.ok(page.includes("if (POINTS(m) === 240) { sfx('pop', 3, 0.6); return {ok: true, done: true, why: fr('120 € × 2 = 240 points.')"), 'le réglage est jugé par la page');
  const mails = val('MAILS');
  assert.deepEqual(mails.map(m => [m[0][0], m[2], m[6]]), [['L’équipe logistique', 'équipe', {sms: true, hello: 'Bonjour !'}], ['L’équipe fidélité', 'équipe', {sms: true, hello: 'Bonjour !'}]]);
  assert.ok(mails[1][4].some(p => p.includes('1 € dépensé rapporte 2 points')), 'la règle vient de l’équipe fidélité');
  const opens = val('OPENS');
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de l’équipe logistique NutriBoost', 'Ouvrir le message de l’équipe fidélité NutriBoost']);
});

test('les demandes et les tickets : une action va avec la procédure, une valeur avec la fonction', () => {
  assert.deepEqual(val('DEMANDES').map(x => x[1]), ['ac', 'va']);
  assert.deepEqual(val('TICKETS').map(x => [x[0], x[1]]), [['Annuler une commande et remettre les produits en stock', 'pr'], ['Calculer le prix après remise', 'fn'],
    ['Valider une commande et diminuer le stock', 'pr'], ['Calculer les points fidélité d’un achat', 'fn']], 'les quatre tickets du scénario');
  for (const x of [...val('DEMANDES'), ...val('TICKETS')]) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique`);
});

test('chapitre 15 : écran titre, la carte PostgreSQL, SQLite ; annoncé par SAVEPOINT, il annonce Les triggers, qui s’ouvrent sur lui', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 15 : Procédures et fonctions stockées</title>') && page.includes('<div class="tagpill">Projet · Chapitre 15</div>')
    && page.includes('<div class="abs sub">et fonctions stockées</div>'));
  const eg = [...page.matchAll(/\['eg\d', (?:'([^']*)'|"([^"]*)")\]/g)].map(m => (m[1] ?? m[2]).replace(/\{\w+\|([^}]*)\}/g, '$1'));
  assert.equal(eg.length, 10, 'dix lignes, commentaire compris');
  assert.ok(eg.includes('CREATE PROCEDURE expedier_commande(id_commande INT)') && eg.includes('CREATE FUNCTION calculer_points(montant NUMERIC)') && eg.includes('  SELECT montant * 2;'), 'la création, dans PostgreSQL');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Dans SQLite, la base de l’app,<br>elles n’existent pas.'), 'SQLite n’en a pas');
  assert.throws(() => base().run('CREATE PROCEDURE expedier_commande(id_commande INT) AS SELECT 1;'), /syntax error/, 'SQLite refuse CREATE PROCEDURE');
  const sp = fs.readFileSync(path.join(root, 'assets/anim/projet-savepoint.html'), 'utf8');
  assert.ok(sp.includes('Prochaine leçon · Procédures et fonctions</span>'), 'le chapitre 14 annonce celui-ci');
  assert.ok(page.includes('Prochaine leçon · Les triggers</span>'), 'il annonce Les triggers');
  const trig = fs.readFileSync(path.join(root, 'assets/anim/projet-trigger.html'), 'utf8');
  assert.ok(trig.includes('Au chapitre 15, une procédure<br>stockée t’a permis de réutiliser<br>un traitement.'), 'Les triggers s’ouvrent sur ce chapitre');
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const fiche = html.slice(html.indexOf('guide({ id:83,'), html.indexOf('guide({ id:70,'));
  const idees = [...fiche.matchAll(/\["(🛠️|🧮|⚠️)","([^"]*)","([^"]*)"\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.equal(rows.length, 3);
  assert.deepEqual(idees, rows, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(!/SQL (voit|comprend|sait|lit|examine)\b/.test(page), 'SQL n’est jamais personnifié');
});
