/* Projet NutriBoost, chapitre 15 (leçon 71 « Concurrence et isolation ») : la vidéo interactive assets/anim/projet-concurrence.html, testée aussi dans
   lesson-video.test.mjs. La trame est celle d’Elisa (25 octobre, 20 h 52, « CONCURRENCE — Deux clients, une seule place » et « ISOLATION — Sécuriser
   la dernière place ») : l’équipe ateliers écrit que deux clients ont reçu une confirmation pour la dernière place de l’atelier ; Léa Simon et Nathan
   Petit consultent la même page (« Plus qu’une place ! »), réservent au même moment, et les places restantes passent à -1. Rejouées avec un verrou
   sur la ligne de l’atelier (SELECT … FOR UPDATE, syntaxe de PostgreSQL), les deux réservations passent l’une après l’autre : Nathan Petit lit 0 place
   après le COMMIT de Léa Simon ; si elle annule avec ROLLBACK, la place reste disponible et il la réserve. Ce que la vidéo montre est ici rejoué dans
   SQLite, une réservation après l’autre (ce que le verrou impose) : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte Concurrence et isolation (les deux caisses, BEGIN IMMEDIATE). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-concurrence.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l71 = lessons.find(l => l.id === 71);

/* Les données de la page (le déroulé des légendes, le message, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* La réservation que la page montre (gabarit Q_RES) : sans le commentaire ni le balisage {repère|texte}. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = [\s\S]*?\]\];$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_RES};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');
/* Les instructions de la réservation, une par une (BEGIN, la lecture verrouillée, l’inscription, la place retirée, COMMIT). */
const instructions = () => sql('Q_RES').split(/;\n?/).map(s => s.trim()).filter(Boolean);

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 14 la laisse (douze tables : la table historique_prix garde le changement de prix du collagène), avec la
   nouvelle date de l’atelier Cuisine saine programmée par l’équipe ateliers : l’atelier 6, le 14 novembre, avec Julie Nguyen (la coach 3), dans sa
   petite salle de 8 places ; la colonne places_restantes compte les places encore libres : il en reste 1. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  /* Le chapitre 10 (MERGE, 30 octobre) : l’inventaire de l’entrepôt met à jour la Fibre Prébiotique (150) et Oméga 3 (75), et ajoute la Spiruline Bio. */
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
    INSERT INTO cadeaux (client_id, produit_id, quantite) VALUES (7, 6, 1); UPDATE produits SET stock = stock - 1 WHERE id = 6;
    CREATE TABLE historique_prix (produit_id INTEGER REFERENCES produits(id), ancien_prix REAL, nouveau_prix REAL, date_changement TEXT);
    INSERT INTO historique_prix VALUES (2, 39.9, 34.9, '2026-10-25 14:32:00'); UPDATE produits SET prix = 34.9, stock = stock - 1 WHERE id = 2;
    ALTER TABLE ateliers ADD COLUMN places_restantes INTEGER;
    INSERT INTO ateliers VALUES (6, 'Cuisine saine', '2026-11-14', 3, 8, 1);`);
  return db;
}
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const places = db => db.exec('SELECT places_restantes FROM ateliers WHERE id = 6')[0].values[0][0];
const inscrits = db => (db.exec('SELECT client_id FROM inscriptions WHERE atelier_id = 6 ORDER BY id')[0] || {values: []}).values.map(r => r[0]);
/* Une réservation, rejouée dans SQLite : BEGIN, la lecture (sans FOR UPDATE, que SQLite ne connaît pas), puis, s’il reste une place, l’inscription
   et la place retirée ; enfin COMMIT ou ROLLBACK. Le client est celui de la requête de Léa Simon (7), ou un autre. */
function reserve(db, client = 7, fin = 'COMMIT') {
  const [begin, lecture, insert, update] = instructions();
  db.run(begin + ';');
  const vu = db.exec(lecture.replace(/\s*FOR UPDATE$/, '') + ';')[0].values[0][0];
  if (vu > 0) { db.run(insert.replace('VALUES (7,', `VALUES (${client},`) + ';'); db.run(update + ';'); }
  db.run(fin + ';');
  return vu;
}

test('Concurrence et isolation : juste après Les triggers, dans le module « Triggers et concurrence », juste avant CREATE VIEW', () => {
  const m = modules.find(x => x.titre === 'Triggers et concurrence');
  assert.deepEqual([...m.lessons.map(l => l.id)], [70, 71], 'Les triggers, puis Concurrence et isolation');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(71), liste.indexOf(70) + 1);
  assert.equal(lessons[liste.indexOf(71) + 1].titre, 'CREATE VIEW', 'CREATE VIEW vient juste après');
  assert.equal(l71.titre, 'Concurrence et isolation');
  assert.equal(l71.résumé, 'Gérer les accès simultanés', 'les mots du « À retenir » d’Elisa');
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  71:'([^']+)',/)[1];
  assert.ok(['concurrence', 'isolation', 'verrou', 'for update', 'transaction', 'commit', 'rollback', 'places_restantes', 'derniere place', 'acces simultanes'].every(m => mots.includes(m)),
    'trouvé par la recherche : concurrence, isolation, verrou, FOR UPDATE, la dernière place…');
  assert.ok(l71.leconSeule && l71.video && !l71.situation && !l71.consigne && !l71.solution && !l71.petitDefi && !l71.learningCheck && !l71.testeVariants && !l71.anatomie, 'la vidéo est le cours');
  assert.equal(l71.video.moments, 6); assert.equal(l71.video.seuil, 4);
  assert.equal(l71.video.anim, 'assets/anim/projet-concurrence.html?app&embed');
  const recap = l71.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['👥', '🔒', '🛡️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.equal(vm.runInContext('QCM', ctx)[71], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 249.94);
  assert.ok(page.includes('notesAt: 249.94,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 257.14);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* Les deux parties de la trame d’Elisa, avec ses titres (« Deux clients, une seule place », la sécurisation de la dernière place), découpées
     comme les autres chapitres du projet : une partie par geste, puis « Attendre ou continuer ? », où l’élève range les situations, et le récapitulatif. */
  assert.deepEqual(chaps.map(c => c.label), ['Deux clients, une seule place', 'Au ralenti', 'La concurrence', 'Verrouiller la ligne', 'Rejouer avec le verrou',
    'Et avec ROLLBACK ?', 'Attendre ou continuer ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'pick', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.equal(picks[0].need, 1, 'une case à toucher : les places restantes');
  assert.equal(picks[1].prompt, 'Comment faire pour qu’une seule inscription soit confirmée ?', 'la question d’Elisa, mot pour mot');
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, true, false], 'verrouiller la ligne de l’atelier pendant la réservation');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [true, false, false], 'la transaction de Nathan Petit attend');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, false, true], 'Nathan Petit lit 0 place');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, true, false], 'après ROLLBACK, la place reste disponible');
  assert.equal(picks[5].options.length, 6, 'six situations à ranger');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (25 octobre, 20 h 52) : sa trame, une phrase par bulle, avec ses mots', () => {
  const lus = val('CAPTIONS').map(c => strip(c[2]));
  const dit = (...phrases) => phrases.forEach(p => assert.ok(lus.includes(p), `légende : ${p}`));
  /* CONCURRENCE : les deux téléphones, puis le déroulement au ralenti, ses quatre étapes. « Le déroulement ralentit. », seule, ne se
     comprenait pas (Elisa, 26 octobre, 9 h 49 : « C’est à dire ? ») : la bulle dit ce qu’on va voir. */
  dit('Léa Simon et Nathan Petit consultent le même atelier.', 'Sur leurs écrans : « Plus qu’une place ! »', 'Voici ce qui s’est passé, au ralenti.',
    'Léa Simon consulte la disponibilité : 1 place.', 'Nathan Petit consulte la disponibilité : 1 place.', 'Léa Simon lance son inscription.',
    'Nathan Petit lance la sienne avant que celle de Léa Simon soit terminée.');
  assert.ok(!lus.includes('Le déroulement ralentit.'), 'plus de « Le déroulement ralentit. » seul');
  dit('Deux opérations accèdent aux mêmes données au même moment : c’est la concurrence.',
    'Si chacune se fie à la place qu’elle a vue disponible, elles peuvent toutes les deux tenter de la réserver.');
  /* ISOLATION : ses deux bulles, puis les cinq étapes avec le verrou */
  dit('Une transaction regroupe les modifications d’une réservation.', 'L’isolation encadre ce que les transactions peuvent voir et faire pendant qu’elles s’exécutent en même temps.',
    'Léa Simon commence sa transaction.', 'Elle verrouille la ligne de l’atelier et vérifie qu’il reste une place.', 'Nathan Petit tente de réserver.',
    'Sa transaction attend de pouvoir verrouiller cette même ligne.', 'Son écran indique « Vérification de la disponibilité… ».',
    'Léa Simon enregistre son inscription.', 'Le nombre de places passe de 1 à 0.', 'Léa Simon valide avec COMMIT.', 'Son inscription est confirmée et le verrou est libéré.',
    'Nathan Petit peut vérifier la disponibilité à son tour.', 'Il reste 0 place : aucune inscription n’est créée pour lui.',
    'Le verrou empêche les deux réservations de modifier simultanément la disponibilité de cet atelier.', 'Nathan Petit vérifie les places après la fin de la transaction de Léa Simon.');
  /* La deuxième fin, puis le « À retenir » d’Elisa */
  dit('La place reste disponible.', 'Nathan Petit peut alors la réserver.', 'Une transaction seule ne suffit pas à éviter tous les conflits.',
    'Le niveau d’isolation et les mécanismes utilisés, comme les verrous, déterminent comment les accès simultanés sont gérés.');
  /* Le téléphone de Nathan Petit, et la photo de l’atelier */
  assert.ok(page.includes('Cet atelier vient d’être complet. Découvre les prochaines dates.') && page.includes('Vérification de la disponibilité…</div>')
    && page.includes('<span class="emo">🔥</span>Plus qu’une place !'), 'ce que montrent les téléphones : les mots d’Elisa');
  assert.ok(page.includes("const PHOTO = 'projet-concurrence-atelier.webp';") && fs.statSync(path.join(root, 'assets/anim/projet-concurrence-atelier.webp')).size > 20000,
    'la photo de l’atelier (Elisa, 20 h 52) est livrée avec la page');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./assets/anim/projet-concurrence-atelier.webp'"), 'et gardée pour le hors ligne');
  assert.ok(page.includes('Comprends comment la base gère plusieurs opérations effectuées au même moment.'), 'la bulle de la mascotte');
  assert.ok(page.includes('Elisa, 25 octobre, 20 h 52'), 'la page garde la trace de la trame d’Elisa');
});

test('la base du chapitre 14 : douze tables ; l’atelier 6 (l’atelier Cuisine saine du 14 novembre) n’a plus qu’une place', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'remplacements', 'cadeaux', 'historique_prix']);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.ok(page.includes('<span>12 tables</span>'), '12 tables');
  assert.deepEqual(db.exec('SELECT id, titre, date_atelier, coach_id, places_restantes FROM ateliers WHERE id = 6')[0].values, [[6, 'Cuisine saine', '2026-11-14', 3, 1]]);
  assert.deepEqual(val('ATELIER'), {id: 6, titre: 'Cuisine saine', date: '2026-11-14', coach: 3, places: 8, restantes: 1});
  assert.deepEqual(db.exec('SELECT prenom, nom FROM coachs WHERE id = 3')[0].values, [['Julie', 'Nguyen']], 'avec Julie Nguyen, sur les téléphones');
  assert.deepEqual(db.exec('SELECT id, prenom, nom FROM clients WHERE id IN (4, 7) ORDER BY id')[0].values, [[4, 'Nathan', 'Petit'], [7, 'Léa', 'Simon']]);
  assert.deepEqual([val('LEA'), val('NATHAN')], [7, 4]);
  assert.equal(new Date('2026-11-14T12:00:00Z').getUTCDay(), 6, 'le 14 novembre 2026 est un samedi');
  assert.ok(page.includes('Samedi 14 novembre · 10 h'));
});

test('sans verrou : les deux réservations lisent 1 place, s’inscrivent toutes les deux, et les places restantes passent à -1', () => {
  const db = base(), [begin, lecture, insert, update] = instructions();
  const lit = () => db.exec(lecture.replace(/\s*FOR UPDATE$/, '') + ';')[0].values[0][0];
  assert.deepEqual([lit(), lit()], [1, 1], 'Léa Simon, puis Nathan Petit : 1 place chacun');
  db.run(insert + ';'); db.run(update + ';');
  assert.equal(places(db), 0, 'l’inscription de Léa Simon : la place passe à 0');
  db.run(insert.replace('VALUES (7,', 'VALUES (4,') + ';'); db.run(update + ';');
  assert.equal(places(db), -1, 'celle de Nathan Petit : -1, une place réservée deux fois');
  assert.deepEqual(inscrits(db), [7, 4], 'deux inscriptions pour la dernière place');
  assert.ok(page.includes("sw('pr6', [['1'], ['0'], ['-1', 'neg'], ['1'], ['0'], ['1'], ['0']])"), 'la vidéo montre ces valeurs, dans cet ordre');
  assert.equal(begin, 'BEGIN');
});

test('la réservation de Léa Simon : BEGIN, SELECT … FOR UPDATE, INSERT, UPDATE, COMMIT ; SQLite ne connaît pas FOR UPDATE', () => {
  assert.equal(sql('Q_RES'), "BEGIN;\nSELECT places_restantes\nFROM ateliers\nWHERE id = 6\nFOR UPDATE;\nINSERT INTO inscriptions\n  (client_id, atelier_id, date_inscription)\n" +
    "VALUES (7, 6, '2026-10-25');\nUPDATE ateliers\nSET places_restantes = places_restantes - 1\nWHERE id = 6;\nCOMMIT;", 'la requête de la vidéo');
  const db = base(), [, lecture] = instructions();
  assert.throws(() => db.exec(lecture + ';'), /near "FOR": syntax error/, 'FOR UPDATE est la syntaxe de PostgreSQL (et de MySQL) : SQLite ne la connaît pas');
  assert.ok(page.includes('celle-ci est notamment celle de PostgreSQL.'), 'le récapitulatif le dit');
});

test('avec le verrou : Nathan Petit vérifie les places après le COMMIT de Léa Simon : 0 place, aucune inscription pour lui', () => {
  const db = base();
  assert.equal(reserve(db, 7), 1, 'Léa Simon lit 1 place');
  assert.equal(places(db), 0, 'le nombre de places passe de 1 à 0');
  assert.equal(reserve(db, 4), 0, 'Nathan Petit lit 0 place, après la fin de la transaction de Léa Simon');
  assert.deepEqual(inscrits(db), [7], 'une seule inscription : celle de Léa Simon');
  assert.equal(places(db), 0);
  /* Ce que la page montre : le verrou de Léa Simon, l’attente de Nathan Petit, puis son verrou à lui, après le COMMIT. */
  for (const t of ['tapPhone(RES);', 'lockOn(0, A.e3 + 0.4);', "state('pn', 0, 2, A.e4 + 0.8);", "mark('#wt .a0', A.e5 + 0.5);", "rowOut('#rti0', A.e7 + 0.4); rowIn('#rtiL', A.e7 + 0.45);",
    "swap('#pr6 .a3', '#pr6 .a4', A.e8 + 0.5);", "state('pl', 1, 3, A.e9 + 0.7);", 'lockOff(0, A.e10 + 1.3);', 'lockOn(1, A.e11 + 0.5);', "state('pn', 2, 4, A.e12 + 1.0);",
    "swap('#pn-bg', '#pn-bf', A.e12 + 1.3, false);"]) assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('la deuxième fin : la transaction de Léa Simon est annulée avec ROLLBACK, la place reste disponible, Nathan Petit la réserve', () => {
  const db = base();
  reserve(db, 7, 'ROLLBACK');
  assert.equal(places(db), 1, 'la place reste disponible');
  assert.deepEqual(inscrits(db), [], 'l’inscription de Léa Simon est annulée');
  assert.equal(reserve(db, 4), 1, 'Nathan Petit lit 1 place');
  assert.deepEqual(inscrits(db), [4], 'il est inscrit');
  assert.equal(places(db), 0);
  for (const t of ["state('pl', 3, 1, A.f2 + 0.4);", "state('pn', 4, 2, A.f2 + 0.4);", "rowOut('#rtiL', A.f3 + 0.9); rowIn('#rti0', A.f3 + 0.95);", "swap('#pr6 .a4', '#pr6 .a5', A.f3 + 1.4);",
    "state('pl', 1, 5, A.f3 + 1.7);", "rowOut('#rti0', A.f5 + 1.0); rowIn('#rtiN', A.f5 + 1.05);", "swap('#pr6 .a5', '#pr6 .a6', A.f5 + 1.6);", "state('pn', 2, 3, A.f5 + 1.9);"])
    assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('moment 1 : la valeur qui montre la place réservée deux fois ; moment 6 : la réservation attend, ou elle continue', () => {
  assert.deepEqual(Object.keys(val('WHY1')).sort(), ['c0', 'c1', 'c2']);
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['c3'\]\};/.test(page), 'indice du moment 1 : la case des places restantes ressort');
  assert.ok(page.includes("const M1_ANS = ['#hc3'];"), 'la case des places restantes s’entoure');
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['Elle attend', 'Elle continue']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['at', 'co', 'at', 'co', 'co', 'at']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [3, 3], 'trois situations par case');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]));
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique le choix`);
  /* Les deux situations qui terminent la transaction de Léa Simon (COMMIT, ROLLBACK) libèrent le verrou : la réservation continue. */
  assert.ok(ITEMS.filter(x => /avec COMMIT$|est annulée$/.test(x[0])).every(x => x[1] === 'co'));
});

test('le message : l’équipe ateliers écrit par SMS ; l’app s’arrête sur lui, et sur le bouton « Réserver ma place » de Léa Simon', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 1);
  assert.deepEqual([mails[0][0], mails[0][2], mails[0][6]], [['L’équipe', 'ateliers', 'EA'], 'équipe', {sms: true, hello: 'Bonjour !', bye: null}]);
  /* Elisa, 25 octobre, 20 h 52 : son message, mot pour mot (« Bonjour ! », puis ses deux phrases, sans « Merci ! » de plus). */
  assert.deepEqual(mails[0][4], ['Deux clients ont reçu une confirmation pour la dernière place de notre atelier.',
    'Peux-tu comprendre ce qui s’est passé et éviter que ça se reproduise ?']);
  assert.equal(vm.runInContext('mailRows(0)', D), 3, 'trois bulles : « Bonjour ! » et ses deux phrases');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#pl-0']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de l’équipe ateliers', 'Réserver ma place pour Léa Simon']);
  assert.deepEqual([opens[1].hand, opens[1].press, opens[1].rest], [{x: 0.84, y: 0.74}, {y: 5, boxShadow: '0 2px 0 #4B30CC'}, {y: 0, boxShadow: '0 7px 0 #4B30CC'}]);
  const c = caps.find(x => x[2] === 'Clique sur « Réserver ma place »<br>sur le téléphone de Léa Simon.');
  assert.ok(c && opens[1].at > c[0] + 1 && opens[1].at < c[1] - 1, 'le bouton est visible pendant sa légende, puis l’app s’arrête');
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[1].at && opens[1].at < picks[2].at, 'le message avant le moment 1, le bouton entre les moments 2 et 3');
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule et la fin du SMS');
});

test('chapitre 15 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 15 : Concurrence et isolation</title>') && page.includes('<div class="tagpill">Projet · Chapitre 15</div>')
    && page.includes('<span>C</span><span>O</span><span>N</span><span>C</span><span>U</span><span>R</span><span>R</span><span>E</span><span>N</span><span>C</span><span>E</span>')
    && page.includes('<div class="abs sub">Gérer les accès simultanés</div>'), 'écran titre : « Projet · Chapitre 15 », CONCURRENCE, « Gérer les accès simultanés »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 14, un trigger<br>t’a permis de garder<br>chaque changement de prix.', 'le chapitre précédent');
  const tg = fs.readFileSync(path.join(root, 'assets/anim/projet-trigger.html'), 'utf8');
  assert.ok(tg.includes('deux clients<br>réserveront la dernière place') && tg.includes('Prochaine leçon · Concurrence et isolation</span>'), 'le chapitre 14 annonce celui-ci');
  assert.ok(caps.includes('Dans la prochaine leçon, tu découvriras<br>les vues : des requêtes enregistrées<br>sous un nom.') && page.includes('Prochaine leçon · CREATE VIEW</span>'), 'annonce de la prochaine leçon');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['👥', 'La concurrence : deux opérations accèdent aux mêmes données au même moment.', 'Chacune peut se fier à une place qu’une autre est en train de réserver.'],
    ['🔒', 'FOR UPDATE verrouille la ligne lue jusqu’à la fin de la transaction.', 'La syntaxe varie selon le SGBD : celle-ci est notamment celle de PostgreSQL.'],
    ['🛡️', 'Une transaction seule ne suffit pas à éviter tous les conflits.', 'Le niveau d’isolation et les mécanismes utilisés, comme les verrous, déterminent comment les accès simultanés sont gérés.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const a71 = html.indexOf('guide({ id:71,'), fiche = html.slice(a71, html.indexOf('guide({ id:', a71 + 10));
  const idees = [...fiche.matchAll(/\["(👥|🔒|🛡️)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de caisses ni de BEGIN IMMEDIATE ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS'), val('WHY1')]);
  for (const mot of ['caisse', 'BEGIN IMMEDIATE', 'Protéine', 'stock']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page) && !/la base (choisit|réagit|refuse|décide)/.test(page), 'ni SQL ni la base ne sont personnifiés');
  const a71 = html.indexOf('guide({ id:71,'), fiche = html.slice(a71, html.indexOf('guide({ id:', a71 + 10));
  assert.ok(!fiche.includes('sit:{') && !fiche.includes('testeVariants'), 'plus de cours texte Concurrence et isolation dans la fiche');
  assert.ok(val('CAPTIONS').filter(c => /table (ateliers|inscriptions)/.test(c[2])).every(c => /<b>table (ateliers|inscriptions)<\/b>/.test(c[2])), 'toujours la <b>table ateliers</b>, la <b>table inscriptions</b>');
});

test('zones à toucher : les lignes des tables font 62 px ; les indices passent par la typographie française', () => {
  assert.ok(page.includes('const RH = 62;') && /\.r\{position:relative;height:(6[2-9]|[7-9]\d)px/.test(page), 'lignes de 62 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  assert.ok(page.includes("const CELLS = [['c0', 'Identifiant de l’atelier : 6'], ['c1', 'Titre : l’atelier Cuisine saine'], ['c2', 'Date de l’atelier'], ['c3', 'Places restantes : -1']];"));
});
