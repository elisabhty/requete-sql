/* Projet NutriBoost, chapitre 6 (leçon 66 « DROP ») : la vidéo interactive assets/anim/projet-drop.html, testée aussi dans lesson-video.test.mjs.
   Karim Benali demande de retirer de la base NutriBoost la copie du fichier Excel (la table inscriptions_excel).
   Dernier cours du module « Créer et faire évoluer les tables ». Leçon seule : ni cours texte, ni exercice.
   Ce que la vidéo montre (DELETE FROM, DROP TABLE, refus sur la table clients, table inscriptions supprimée sans erreur, IF EXISTS)
   est ici rejoué dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-drop.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l66 = lessons.find(l => l.id === 66);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));

test('DROP : dernier cours du module « Créer et faire évoluer les tables », juste avant INSERT', () => {
  const m = modules.find(x => x.titre === 'Créer et faire évoluer les tables');
  assert.equal(m.lessons[m.lessons.length - 1].id, 66, 'DROP termine le module');
  const ids = lessons.map(l => l.id);
  assert.equal(ids.indexOf(26), ids.indexOf(66) + 1, 'INSERT vient juste après');
  assert.equal(l66.titre, 'DROP');
  assert.equal(l66.résumé, 'Supprimer une table de la base');
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  66:'([^']+)',/)[1];
  assert.ok(['drop table', 'supprimer', 'delete from', 'vider', 'if exists', 'cle etrangere', 'no such table'].every(m => mots.includes(m)), 'trouvé par la recherche : drop, supprimer, vider, IF EXISTS, clé étrangère…');
  assert.ok(!/ vue | index /.test(mots), 'DROP VIEW et DROP INDEX ne sont plus enseignés : plus de mots-clés pour eux');
  assert.ok(l66.leconSeule && l66.video && !l66.situation && !l66.consigne && !l66.solution && !l66.petitDefi && !l66.learningCheck && !l66.testeVariants && !l66.anatomie, 'la vidéo est le cours');
  assert.equal(l66.video.moments, 6); assert.equal(l66.video.seuil, 4);
  const recap = l66.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🗑️', '🔗', '🛟'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.ok(recap.includes('DROP TABLE IF EXISTS inscriptions_excel;'), 'avec la requête du moment 6');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 106.8);
  assert.ok(page.includes('notesAt: 106.8,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 114);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant après la fin de la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['La table de trop', 'Vider ou supprimer', 'La requête', 'Une table liée', 'Noms proches', 'IF EXISTS', 'À retenir']);
  /* Une seule phrase complète par bulle (Elisa, 23 octobre). */
  caps.forEach(([, , t], k) => {
    const txt = t.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').trim();
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
  });
  /* Six moments, dans l’ordre des chapitres ; chacun s’arrête 2,35 s après le début de sa légende « À toi ! ». */
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'sort', 'pick', 'tap', 'pick', 'pick']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && o.why.length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true]);
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, true, false], 'la table inscriptions est supprimée, sans erreur');
  assert.deepEqual(picks[5].options.map(o => !!o.ok), [true, false, false], 'IF EXISTS entre TABLE et le nom de la table');
  /* Chaque question se suffit : sur un petit écran (iPhone SE, 320 à 375 px de large), le plateau des réponses recouvre le bas de l’image,
     donc la requête affichée au-dessus ; la question du moment 5 la cite. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
  assert.equal(picks[4].prompt.replace(/\u00a0/g, ' '), 'Que se passe-t-il avec <code>DROP TABLE inscriptions</code> ?', 'la question du moment 5 cite la requête');
  /* Le mail de Karim ouvre le premier chapitre et arrête l’app jusqu’au toucher (moment « ouvrir »). */
  assert.equal(val('MAILS').length, 1); assert.equal(val('MAILS')[0][0][0], 'Karim'); assert.equal(val('MAILS')[0][0][1], 'Benali');
  assert.equal(val('OPENS').length, 1); assert.ok(val('OPENS')[0].at > val('MAIL') && val('OPENS')[0].at < picks[0].at);
});

test('les quatre situations à ranger : deux requêtes DELETE FROM, deux requêtes DROP TABLE, chaque correction nomme la requête qui convient', () => {
  const cases = val('CASES');
  assert.deepEqual(cases.map(c => c[1]), ['del', 'drop', 'del', 'drop']);
  assert.deepEqual(val('BINS').map(c => c[1]), ['DELETE FROM', 'DROP TABLE']);
  for (const [label, kind, why] of cases) assert.ok(label.length < 50 && why.length > 40 && (kind === 'drop' ? !/^La table doit rester/.test(why) : true), `${label} : une correction`);
});

/* ---------- Ce que SQLite répond vraiment (c’est ce que la vidéo montre) ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo : l’état que le chapitre 5 laisse (coachs 4, ateliers 5 avec places, clients 10, inscriptions 7, cartes 3 avec
   seances_restantes), plus la copie du fichier Excel du chapitre 1 (six lignes, six colonnes). */
function base({copie = true} = {}) {
  const db = new SQL.Database();
  db.run(`PRAGMA foreign_keys = ON;
    CREATE TABLE coachs (id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL REFERENCES coachs(id), places INTEGER DEFAULT 12);
    CREATE TABLE clients (id INTEGER PRIMARY KEY, prenom TEXT, nom TEXT, adresse TEXT, ville TEXT, age INTEGER, email TEXT, telephone TEXT, date_inscription TEXT);
    CREATE TABLE inscriptions (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), atelier_id INTEGER NOT NULL REFERENCES ateliers(id), date_inscription DATE);
    CREATE TABLE cartes (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id), seances_restantes INTEGER NOT NULL DEFAULT 10 CHECK (seances_restantes >= 0));
    INSERT INTO coachs VALUES (1,'Salma','Haddad','salma@pro.fr'),(2,'Moussa','Diallo','moussa@mail.fr'),(3,'Julie','Nguyen','julie@mail.fr'),(4,'Diego','Ramos','diego@mail.fr');
    INSERT INTO ateliers VALUES (1,'Récupération','2026-09-12',1,12),(2,'Pilates','2026-09-17',2,12),(3,'Cuisine saine','2026-09-19',3,12),(4,'Méditation','2026-09-24',4,12),(5,'Yoga du matin','2026-10-03',2,12);
    INSERT INTO clients (id, prenom, nom) VALUES (1,'Sophie','Martin'),(2,'Lucas','Bernard'),(3,'Emma','Dubois'),(4,'Nathan','Petit'),(5,'Chloé','Moreau'),(6,'Hugo','Laurent'),(7,'Léa','Simon'),(8,'Jade','Roux'),(9,'Omar','Aziz'),(10,'Inès','Faure');
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(4,7,3,'2026-09-04'),(5,3,1,'2026-09-05'),(6,6,4,'2026-09-06'),(7,1,4,'2026-09-07');
    INSERT INTO cartes VALUES (1,1,10),(2,4,5),(3,6,8);`);
  if (copie) db.run(`CREATE TABLE inscriptions_excel (client TEXT, atelier TEXT, date TEXT, coach TEXT, email_coach TEXT, inscrit_le TEXT);
    INSERT INTO inscriptions_excel VALUES ('Sophie Martin','Récupération','12/09','Salma Haddad','salma@pro.fr','01/09'),('Nathan Petit','Récupération','12/09','Salma Haddad','salma@pro.fr','02/09'),
      ('Chloé Moreau','Pilates','17/09','Moussa Diallo','moussa@mail.fr','03/09'),('Léa Simon','Cuisine saine','19/09','Julie Nguyen','julie@mail.fr','04/09'),
      ('Emma Dubois','Récupération','12/09','Salma Haddad','salma@pro.fr','05/09'),('Hugo Laurent','Méditation','24/09','Diego Ramos','diego@mail.fr','06/09');`);
  return db;
}
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];

test('la page montre les tables de la base : leurs lignes, leurs colonnes et leurs clés étrangères sont celles de la base', () => {
  const TB = val('TB'), db = base();
  assert.deepEqual(TB.map(t => t[3]), ['coachs', 'ateliers', 'clients', 'inscriptions', 'cartes', 'inscriptions_excel'], 'dans l’ordre du chapitre 5, la copie en dernier');
  const byKey = Object.fromEntries(TB.map(t => [t[1], t[3]]));
  for (const [, kc, , name, n, cols] of TB) {
    assert.equal(count(db, name), n, `${name} : ${n} lignes`);
    assert.deepEqual(db.exec(`SELECT name FROM pragma_table_info('${name}')`)[0].values.map(r => r[0]), cols.map(c => c[0]), `${name} : ses colonnes, dans l’ordre`);
    const fks = db.exec(`SELECT "from", "table" FROM pragma_foreign_key_list('${name}') ORDER BY "from"`);
    const shown = cols.filter(c => c[1] === 'fk').map(c => [c[0], byKey[c[2]]]).sort();
    assert.deepEqual(fks.length ? fks[0].values : [], shown, `${name} : les 🔗 sont ses clés étrangères`);
    for (const c of cols.filter(c => c[1] === 'pk')) assert.equal(c[0], 'id', `${name} : 🔑 id`);
  }
  assert.equal(tables(db).length, 6, 'cinq tables, plus la copie');
  assert.equal(val('TB').filter(t => t[3] === 'inscriptions_excel')[0][5].length, 6, 'la copie garde les six colonnes du fichier Excel');
});

test('DELETE FROM vide la copie, DROP TABLE la supprime', () => {
  const db = base();
  db.run('DELETE FROM inscriptions_excel');
  assert.equal(count(db, 'inscriptions_excel'), 0, '0 ligne : la table répond toujours');
  assert.equal(db.exec("SELECT COUNT(*) FROM pragma_table_info('inscriptions_excel')")[0].values[0][0], 6, 'avec ses six colonnes');
  db.run('DROP TABLE inscriptions_excel;');
  assert.deepEqual(tables(db), ['ateliers', 'cartes', 'clients', 'coachs', 'inscriptions'], 'cinq tables : les autres sont intactes');
  assert.throws(() => db.exec('SELECT * FROM inscriptions_excel'), /no such table: inscriptions_excel/);
  assert.deepEqual([count(db, 'coachs'), count(db, 'ateliers'), count(db, 'clients'), count(db, 'cartes'), count(db, 'inscriptions')], [4, 5, 10, 3, 7]);
});

test('la requête et ses variantes du moment 3', () => {
  const db = base();
  assert.throws(() => db.run('DROP inscriptions_excel;'), /near "inscriptions_excel": syntax error/, 'sans TABLE');
  assert.throws(() => db.run('DROP TABLE FROM inscriptions_excel;'), /near "FROM": syntax error/, 'FROM appartient à DELETE');
  assert.equal(tables(db).length, 6, 'rien n’a été supprimé');
  assert.throws(() => db.run('DELETE TABLE inscriptions_excel;'), /near "TABLE": syntax error/);
});

test('une table à laquelle une clé étrangère fait référence ne se supprime pas (la table clients) ; sans référence, la suppression réussit (la table inscriptions)', () => {
  const db = base();
  db.run('PRAGMA foreign_keys = ON;');
  assert.throws(() => db.run('DROP TABLE clients;'), /FOREIGN KEY constraint failed/, 'inscriptions et cartes y font référence');
  assert.ok(tables(db).includes('clients') && count(db, 'clients') === 10, 'la table clients est intacte');
  const refs = db.exec("SELECT m.name FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table' AND f.\"table\" = 'clients' ORDER BY m.name")[0].values.map(r => r[0]);
  assert.deepEqual(refs, ['cartes', 'inscriptions'], 'les deux tables que l’élève touche au moment 4');
  const refsIns = db.exec("SELECT m.name FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table' AND f.\"table\" = 'inscriptions'");
  assert.equal(refsIns.length, 0, 'aucune table ne fait référence à la table inscriptions');
  db.run('DROP TABLE inscriptions;');   // aucune erreur, avec ses sept lignes
  assert.ok(!tables(db).includes('inscriptions'));
  assert.ok(tables(db).includes('inscriptions_excel'), 'le nom ressemble, mais la copie reste : deux tables différentes');
  assert.throws(() => db.exec('SELECT * FROM inscriptions'), /no such table: inscriptions/);
});

test('IF EXISTS : sur le serveur de test (sans la copie), la requête échoue ; avec IF EXISTS, aucune erreur ; IF EXISTS se place entre TABLE et le nom', () => {
  const test_ = base({copie: false});
  assert.throws(() => test_.run('DROP TABLE inscriptions_excel;'), /no such table: inscriptions_excel/, 'la mise en ligne s’arrête');
  test_.run('DROP TABLE IF EXISTS inscriptions_excel;');
  assert.equal(tables(test_).length, 5, 'rien n’est supprimé, aucune erreur');
  const prod = base();
  prod.run('DROP TABLE IF EXISTS inscriptions_excel;');
  assert.equal(tables(prod).length, 5, 'sur la base de NutriBoost, la copie est supprimée');
  assert.throws(() => test_.run('DROP IF EXISTS TABLE inscriptions_excel;'), /near "IF": syntax error/);
  assert.throws(() => test_.run('DROP TABLE inscriptions_excel IF EXISTS;'), /near "IF": syntax error/);
  for (const sqlText of ['DROP TABLE IF EXISTS inscriptions_excel;']) assert.ok(page.includes(sqlText) && html.includes(sqlText), 'la requête du moment 6 est celle du récapitulatif');
});

/* ---------- Propre au chapitre 6 : la suite du chapitre 5 ---------- */
test('chapitre 6 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 6 : DROP TABLE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 6</div>')
    && page.includes('<span>D</span><span>R</span><span>O</span><span>P</span>') && page.includes('<div class="abs sub">Supprimer une table</div>'),
    'écran titre : « Projet · Chapitre 6 », DROP, « Supprimer une table »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 5');
  assert.equal(caps[1], 'Au chapitre 5, tu as fait évoluer les tables avec <code>ALTER TABLE</code>.', 'le chapitre précédent');
  /* La fin du chapitre 5 annonce « Chapitre 6 · DROP » et « DROP TABLE » : c’est ce chapitre. */
  const alter = fs.readFileSync(path.join(root, 'assets/anim/projet-alter.html'), 'utf8');
  assert.ok(alter.includes('Chapitre 6 · DROP') && alter.includes('avec <code>DROP TABLE</code>.'), 'le chapitre 5 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : INSERT. */
  assert.ok(caps.includes('Dans la prochaine leçon,<br>tu ajouteras des lignes avec <code>INSERT</code>.') && page.includes('Prochaine leçon · INSERT</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 66) + 1].id, 26);
  assert.equal(lessons.find(l => l.id === 26).titre, 'INSERT');
});

test('la base est celle que le chapitre 5 laisse (mêmes tables, même ordre, mêmes colonnes, mêmes nombres de lignes) ; la copie est le fichier du chapitre 1', () => {
  const alter = fs.readFileSync(path.join(root, 'assets/anim/projet-alter.html'), 'utf8');
  const A5 = vm.createContext({});
  vm.runInContext(alter.slice(alter.indexOf('const COACHS'), alter.indexOf('/* Les requêtes, une carte de code chacune')) + ';this.TABLES = TABLES;', A5);
  const names = c => c.map(x => Array.isArray(x) ? x[0] : x);
  /* Au chapitre 5, ateliers reçoit places (ADD COLUMN) et cartes renomme seances en seances_restantes (RENAME COLUMN). */
  const fin5 = A5.TABLES.map(([, , nom, cols, n]) => [nom, nom === 'ateliers' ? [...names(cols), 'places'] : nom === 'cartes' ? names(cols).map(c => c === 'seances' ? 'seances_restantes' : c) : names(cols), n]);
  const ici = val('TB').filter(t => t[3] !== 'inscriptions_excel').map(t => [t[3], t[5].map(c => c[0]), t[4]]);
  assert.deepEqual(ici, JSON.parse(JSON.stringify(fin5)));
  /* La copie : les six colonnes et les six lignes du fichier du chapitre 1 ; elle répète le nom et l’e-mail des coachs, qui sont déjà dans la table coachs. */
  const normaliser = fs.readFileSync(path.join(root, 'assets/anim/projet-normaliser.html'), 'utf8');
  assert.ok(normaliser.includes("const COLS = ['client', 'atelier', 'date', 'coach', 'e-mail du coach', 'inscrit le'];"), 'les six colonnes du fichier');
  const db = base();
  assert.equal(count(db, 'inscriptions_excel'), 6, 'six lignes, comme le fichier (la 7e inscription est arrivée après)');
  assert.equal(db.exec("SELECT COUNT(*) FROM inscriptions_excel x WHERE NOT EXISTS (SELECT 1 FROM coachs c WHERE c.prenom || ' ' || c.nom = x.coach AND c.email = x.email_coach)")[0].values[0][0], 0,
    'chaque coach et son e-mail sont déjà dans la table coachs');
  const salma = ['coachs', 'inscriptions_excel'].filter(t => db.exec(`SELECT COUNT(*) FROM ${t} WHERE ${t === 'coachs' ? 'email' : 'email_coach'} = 'salma@pro.fr'`)[0].values[0][0] > 0);
  assert.deepEqual(salma, ['coachs', 'inscriptions_excel'], 'l’e-mail de Salma Haddad est dans deux tables');
});
