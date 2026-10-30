/* Projet NutriBoost, chapitre 17 (leçon 57 « Les index et EXPLAIN ») : la vidéo interactive assets/anim/projet-index.html, testée aussi dans
   lesson-video.test.mjs. La trame est celle d’Elisa (26 octobre, 10 h 52, « INDEX / EXPLAIN — La file d’attente s’allonge »), transposée à la
   préparation des commandes avec sa photo de remplacement (11 h 57 : le bon « Commande NB-10482 » et son QR code, « Recherche de la
   commande… ») : la table commandes compte 500 000 lignes, y compris les anciennes ; la requête du scan la parcourt en entier (SCAN commandes) ;
   l’index idx_commandes_numero change le plan (SEARCH commandes USING INDEX idx_commandes_numero) et la commande de Léa Simon est retrouvée
   aussitôt. Ce que la vidéo montre est ici rejoué dans SQLite, sur une table de 500 000 commandes : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte Les index et EXPLAIN. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-index.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l57 = lessons.find(l => l.id === 57);

/* Les données de la page (le déroulé des légendes, le message, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* Les requêtes que la page tape, telles qu’elle les écrit (gabarits Q_…) : sans le commentaire ni le balisage {repère|texte}. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = [\s\S]*?\]\];$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_SEL, Q_EXP, Q_IDX};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
const ANNEES = val('ANNEES');
/* La base NutriBoost telle que le chapitre 16 la laisse (douze tables), avec la table commandes que l’équipe logistique décrit : les seize
   commandes de la base, les anciennes commandes de 2019 à 2025 (CMD-année-…), puis les commandes du jour, NB-10001 à NB-10490 ; la commande
   NB-10482 est celle de Léa Simon (la cliente 7). 500 000 lignes. */
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
    INSERT INTO ateliers VALUES (6, 'Cuisine saine', '2026-11-14', 3, 8, 1);
    INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (7, 6, '2026-10-25'); UPDATE ateliers SET places_restantes = places_restantes - 1 WHERE id = 6;
    ALTER TABLE produits ADD COLUMN selection_box INTEGER NOT NULL DEFAULT 0; UPDATE produits SET selection_box = 1 WHERE id IN (3, 5, 8);
    CREATE VIEW catalogue_box AS SELECT nom, categorie, prix FROM produits WHERE selection_box = 1;`);
  /* Les anciennes commandes, année après année, puis les commandes du jour (une ligne par commande) */
  db.run('BEGIN');
  const st = db.prepare('INSERT INTO commandes (numero_commande, client_id, produit_id, quantite, date_commande, statut) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 0;
  for (const [y, c] of ANNEES.filter(([y]) => y < 2026))
    for (let i = 0; i < c; i++) {
      n++;
      const d = new Date(Date.UTC(y, 0, 1) + Math.floor(i * 365 / c) * 86400000).toISOString().slice(0, 10);
      st.run([`CMD-${y}-${1000000 + i}`, 1 + n % 8, 1 + n % 8, 1 + n % 3, d, 'expédiée']);
    }
  for (let k = 10001; k <= 10490; k++) st.run([`NB-${k}`, k === 10482 ? 7 : k === 10483 ? 4 : 1 + k % 8, k === 10482 ? 6 : 1 + k % 8, 1, '2026-10-26', 'en_preparation']);
  st.free();
  db.run('COMMIT');
  return db;
}
const DB = base();
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const plan = q => DB.exec('EXPLAIN QUERY PLAN ' + q)[0].values.map(r => r[3]);
/* La médiane de neuf exécutions, en millisecondes */
const chrono = q => { const ts = []; for (let k = 0; k < 9; k++) { const t0 = process.hrtime.bigint(); DB.exec(q); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.sort((x, y) => x - y); return ts[4]; };

test('Les index et EXPLAIN : juste après CREATE VIEW, à la fin du module « Vues, index et optimisation », juste avant Sécurité et droits', () => {
  const m = modules.find(x => x.titre === 'Vues, index et optimisation');
  assert.deepEqual([...m.lessons.map(l => l.id)], [64, 57], 'CREATE VIEW, puis Les index et EXPLAIN');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(57), liste.indexOf(64) + 1, 'juste après CREATE VIEW');
  assert.equal(lessons[liste.indexOf(57) + 1].titre, 'Sécurité et droits');
  assert.equal(l57.titre, 'Les index et EXPLAIN');
  assert.equal(l57.résumé, 'Accélérer une recherche et lire son plan');
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  57:'([^']+)',/)[1];
  assert.ok(['index', 'create index', 'explain query plan', 'scan', 'search', 'using index', 'numero_commande', 'commande', 'qr code', 'mesure'].every(m => mots.includes(m)),
    'trouvé par la recherche : index, CREATE INDEX, EXPLAIN QUERY PLAN, SCAN, SEARCH, la commande scannée…');
  assert.ok(l57.leconSeule && l57.video && !l57.situation && !l57.consigne && !l57.solution && !l57.petitDefi && !l57.learningCheck && !l57.testeVariants && !l57.anatomie, 'la vidéo est le cours');
  assert.equal(l57.video.moments, 6); assert.equal(l57.video.seuil, 4);
  assert.equal(l57.video.anim, 'assets/anim/projet-index.html?app&embed');
  const recap = l57.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🔎', '⚡', '⚖️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.equal(vm.runInContext('QCM', ctx)[57], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 202.54);
  assert.ok(page.includes('notesAt: 202.54,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 209.74);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['La file d’attente s’allonge', 'La recherche de la commande', 'Lire le plan', 'Créer l’index', 'Le nouveau plan',
    'Le plan ou la mesure ?', 'Des index partout ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt.replace(/« Recherche de la commande… »\./, '« … ».')), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['pick', 'pick', 'pick', 'tap', 'tune', 'pick']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[0].options.map(o => !!o.ok), [true, false, false], 'sans index : les 500 000 commandes sont lues');
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, true, false], 'deux fois plus de lignes : environ deux fois plus lente');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, true, false], 'l’index sur numero_commande');
  assert.deepEqual(picks[5].options.map(o => !!o.ok), [false, true, false], 'pas d’index sur toutes les colonnes');
  assert.equal(picks[3].need, 1, 'une partie du plan à toucher');
  assert.deepEqual(picks[4].controls[0].choices, ['Le plan', 'Une mesure'], 'moment 5 : le plan, ou une mesure');
  assert.deepEqual(picks[4].answer, {v: 'Une mesure'}, 'seule une mesure prouve le gain');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (26 octobre, 10 h 52) : sa trame, une phrase par bulle, avec ses mots ; le billet devient la commande', () => {
  const lus = val('CAPTIONS').map(c => strip(c[2]));
  const suite = (...phrases) => { const i = lus.indexOf(phrases[0]); assert.ok(i >= 0, `légende : ${phrases[0]}`);
    phrases.forEach((p, k) => assert.equal(lus[i + k], p, 'ses phrases, à la suite')); };
  suite('Au service logistique, on scanne le QR code de chaque commande.', 'L’écran doit alors afficher les produits à préparer et leurs quantités.',
    'Mais l’écran affiche « Recherche de la commande… ».', 'Et la file des commandes à préparer s’allonge.');   // Elisa, 29 octobre, 17 h 44 : ce que le scan doit afficher
  suite('EXPLAIN QUERY PLAN montre comment la base prévoit d’exécuter la requête.', 'Ici, elle parcourt la table pour retrouver la commande.');
  suite('Un index permet de retrouver plus rapidement les lignes à partir d’une valeur recherchée.', 'Ici, le numéro de la commande sert à la retrouver.');
  assert.ok(lus.includes('La base utilise maintenant l’index pour retrouver la commande.'));
  assert.ok(lus.includes('Le plan confirme la méthode utilisée ; une mesure du temps d’exécution permet de vérifier le gain de vitesse.'));
  suite('Chaque index occupe de l’espace et doit être entretenu lorsque les données changent.', 'Crée-les pour les recherches qui en ont besoin.');
  /* Son dernier choix, et son explication dans la correction de la bonne réponse */
  const p6 = val('PICKS')[5];
  assert.equal(p6.prompt, 'Ajouter des index sur toutes les colonnes ?');
  assert.equal(strip(p6.options[1].why), 'Chaque index occupe de l’espace et doit être entretenu lorsque les données changent. Crée-les pour les recherches qui en ont besoin.');
  assert.ok(page.includes('Découvre comment accélérer les recherches et analyser la façon dont une requête est exécutée.'), 'la bulle de la mascotte');
  assert.ok(page.includes('Elisa (26 octobre, 10 h 52') && page.includes('11 h 57'), 'la page garde la trace de la trame d’Elisa et de sa photo');
});

test('le message : l’équipe logistique écrit par SMS, avec les mots d’Elisa ; l’app s’arrête sur lui, et sur les boutons de la trame', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 1);
  assert.deepEqual([mails[0][0], mails[0][2], mails[0][6]], [['L’équipe', 'logistique', 'EL'], 'équipe', {sms: true, hello: null, bye: null}]);
  assert.deepEqual(mails[0][4], ['On vient de lancer les expéditions du jour et la recherche des commandes est trop lente !',
    'La table contient 500 000 commandes, y compris les anciennes.', 'Peux-tu regarder ce qui se passe ?']);
  assert.equal(vm.runInContext('mailRows(0)', D), 3, 'trois bulles : ses trois phrases, sans formule');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#bexp', '#bcix', '#bexp']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de l’équipe logistique', 'Exécuter', 'Créer l’index', 'Exécuter']);
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[0].at && opens[1].at < picks[1].at && opens[2].at > picks[2].at && opens[3].at > opens[2].at && opens[3].at < picks[3].at,
    'le message avant le moment 1, le plan après lui, l’index après le moment 3, puis le nouveau plan');
  const bulles = [['#bexp', 'Clique sur le bouton<br>« Exécuter ».', '#4B30CC'], ['#bcix', 'Clique sur le bouton<br>« Créer l’index ».', '#0B5A54'],
    ['#bexp', 'Relance <code>EXPLAIN QUERY PLAN</code> :<br>clique sur « Exécuter ».', '#4B30CC']];
  opens.slice(1).forEach((o, k) => {
    const [sel, bulle, lip] = bulles[k];
    assert.equal(o.sel, sel);
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78});
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: `0 2px 0 ${lip}`}, {y: 0, boxShadow: `0 9px 0 ${lip}`}]);
    const c = caps.find(x => x[2] === bulle);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  });
  assert.ok(!/fromTo\('#b(exp|cix)|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule et la fin du SMS');
});

test('la base : douze tables, et la table commandes de 500 000 lignes, année après année', () => {
  const TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'remplacements', 'cadeaux', 'historique_prix']);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(DB), 'aucune table de la base n’est oubliée à l’écran (la vue catalogue_box n’est pas une table)');
  for (const [, , , name, n] of TB) assert.equal(count(DB, name), n, `${name} : ${n} lignes`);
  assert.equal(count(DB, 'commandes'), 500000);
  /* Les années de la lecture de la table : chaque groupe compte ses commandes */
  const parAn = DB.exec("SELECT CAST(strftime('%Y', date_commande) AS INTEGER), COUNT(*) FROM commandes GROUP BY 1 ORDER BY 1")[0].values;
  assert.deepEqual(parAn, ANNEES, 'les commandes de chaque année, de 2019 à 2026');
  /* L’extrait de la table : les deux plus anciennes, puis les trois plus récentes autour de la commande scannée */
  const extrait = val('EXTRAIT');
  for (const [id, nb, d, s] of extrait) assert.deepEqual(DB.exec(`SELECT id, numero_commande, date_commande, statut FROM commandes WHERE id = ${id}`)[0].values[0], [id, nb, d, s]);
  assert.ok(page.includes('… ${fmtN(500000 - EXTRAIT.length)} autres commandes'), 'les autres lignes sont annoncées : 499 995');
  /* La commande scannée : NB-10482, celle de Léa Simon */
  const scan = val('SCAN');
  assert.deepEqual(DB.exec(`SELECT c.id, c.numero_commande, c.client_id, cl.prenom || ' ' || cl.nom, c.date_commande, c.statut FROM commandes c JOIN clients cl ON cl.id = c.client_id WHERE c.numero_commande = 'NB-10482'`)[0].values,
    [[scan.id, scan.numero, scan.client, scan.nom, scan.date, scan.statut]]);
});

test('le plan, rejoué dans SQLite : SCAN commandes, puis SEARCH … USING INDEX, et la mesure du gain', () => {
  assert.equal(sql('Q_SEL'), "SELECT * FROM commandes\nWHERE numero_commande = 'NB-10482';");
  assert.equal(sql('Q_EXP'), "EXPLAIN QUERY PLAN\nSELECT * FROM commandes\nWHERE numero_commande = 'NB-10482';");
  assert.equal(sql('Q_IDX'), 'CREATE INDEX idx_commandes_numero\nON commandes(numero_commande);');
  const q = sql('Q_SEL');
  /* Sans index : toute la table est parcourue */
  assert.deepEqual(DB.exec(sql('Q_EXP'))[0].values.map(r => r[3]), ['SCAN commandes'], 'le plan de la vidéo');
  assert.ok(page.includes('<span class="kw" id="pscan">SCAN</span> commandes'), 'la vidéo montre ce plan');
  const avant = chrono(q);
  /* L’index, puis le nouveau plan : ses trois parties, dans la vidéo */
  DB.run(sql('Q_IDX'));
  assert.deepEqual(DB.exec("SELECT type, name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'commandes'")[0].values, [['index', 'idx_commandes_numero', 'commandes']]);
  assert.deepEqual(plan(q), ['SEARCH commandes USING INDEX idx_commandes_numero (numero_commande=?)']);
  const parts = [...page.matchAll(/<div class="pll" id="p2-\d">([\s\S]*?)<\/div>/g)].map(m => strip(m[1]));
  assert.equal(parts.join(' '), 'SEARCH commandes USING INDEX idx_commandes_numero (numero_commande=?)', 'les trois parties du plan, dans la vidéo');
  /* La même commande, retrouvée par l’index */
  assert.deepEqual(DB.exec(q)[0].values, [[499992, 'NB-10482', 7, 6, 1, '2026-10-26', 'en_preparation']]);
  /* La mesure : environ 400 fois plus rapide (au moins 50 fois sur n’importe quelle machine) */
  const apres = chrono(q), gain = avant / apres;
  assert.ok(gain > 50, `avec l’index, la recherche est ${Math.round(gain)} fois plus rapide (${avant.toFixed(1)} ms → ${apres.toFixed(3)} ms)`);
  assert.equal(val('GAIN'), 400);
  assert.ok(val('CAPTIONS').some(c => strip(c[2]) === 'Mesurée, la recherche est environ 400 fois plus rapide avec l’index.'));   // sans nommer SQLite (Elisa, 29 octobre, 17 h 44)
  /* Ce que la page montre : les deux exécutions et l’index, puis la lecture de toute la table et la commande retrouvée */
  for (const t of ["tapButton('bexp', EXE1, '#4B30CC');", "tapButton('bcix', CIX, '#0B5A54');", "tapButton('bexp', EXE2, '#4B30CC');", "show('#pl', EXE1 + 1.0,",
    "show('#pl2', EXE2 + 1.0,", "flip('#scn', q + 1, t + 0.38);", "show('#fnd', A.d5 + 0.3,"])
    assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('moments 4 et 5 : la partie du plan qui nomme l’index ; ce que donne le plan, ce que donne une mesure', () => {
  assert.deepEqual(Object.keys(val('WHY4')).sort(), ['p0', 'p2']);
  assert.ok(/if \(i === 3\) return \{text: '[^']+', keys: \['p1'\]\};/.test(page), 'indice du moment 4 : la partie USING INDEX ressort');
  assert.ok(page.includes("const M4_ANS = ['#hcu'];") && page.includes('idx_commandes_numero</span><i class="hc" id="hcu"></i>'), 'la partie USING INDEX s’entoure');
  /* Moment 5 (Elisa, 29 octobre, 17 h 44 : le rangement en deux cases n’était pas compris) : ce que l’on montre à l’équipe logistique, le plan
     ou une mesure ; la carte du choix s’affiche, le plan sans durée, la mesure avec le gain. */
  const M5 = val('M5');
  assert.deepEqual(M5.map(x => [x[0], x[1]]), [['Le plan', false], ['Une mesure', true]]);
  for (const x of M5) assert.ok(strip(x[2]).length > 60, `${x[0]} : une correction qui explique le choix`);
  assert.ok(page.includes('Durée de la recherche</span><b>?</b>') && page.includes('Environ ${GAIN} fois plus rapide</div></div>`;'), 'le plan n’a pas de durée ; la mesure donne le gain');
  assert.ok(page.includes("if (i === 4) draw5({v: M5[0][0]});") && /tune\(i, st\)\{ if \(i !== 4\) return;/.test(page), 'la carte suit le réglage dès l’ouverture du moment');
  /* Ce que le plan donne vraiment : la méthode (SCAN, l’index, la colonne), jamais une durée */
  const detail = plan(sql('Q_SEL')).join(' ');
  assert.ok(/SEARCH/.test(detail) && /idx_commandes_numero/.test(detail) && /numero_commande/.test(detail) && !/ms|seconde/.test(detail));
});

test('chapitre 17 : écran titre, ouverture comme aux autres chapitres, la photo d’Elisa, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 17 : Les index et EXPLAIN</title>') && page.includes('<div class="tagpill">Projet · Chapitre 17</div>')
    && page.includes('<span>I</span><span>N</span><span>D</span><span>E</span><span>X</span>')
    && page.includes('<div class="abs sub">Accélérer une recherche et lire son plan</div>'), 'écran titre : « Projet · Chapitre 17 », INDEX, « Accélérer une recherche et lire son plan »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 16, une vue a présenté<br>la sélection de la box à l’agence.', 'le chapitre précédent');
  const vw = fs.readFileSync(path.join(root, 'assets/anim/projet-vue.html'), 'utf8');
  assert.ok(vw.includes('Dans la prochaine leçon,<br>la file des commandes à préparer<br>s’allongera.') && vw.includes('Prochaine leçon · Les index et EXPLAIN</span>'), 'le chapitre 16 annonce celui-ci');
  assert.ok(caps.includes('Dans la prochaine leçon,<br>une nouvelle collègue aura besoin<br>des bons accès.') && page.includes('Prochaine leçon · Sécurité et droits</span>'), 'annonce de la prochaine leçon');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
  assert.ok(page.includes("const PHOTO = 'projet-index-scan.webp';") && fs.statSync(path.join(root, 'assets/anim/projet-index-scan.webp')).size > 20000, 'la photo du scan');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./assets/anim/projet-index-scan.webp'"), 'et gardée pour le hors ligne');
});

test('le récapitulatif, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🔎', 'EXPLAIN QUERY PLAN montre comment la base prévoit d’exécuter une requête.', 'SCAN : la table est parcourue ; SEARCH … USING INDEX : l’index est utilisé.'],
    ['⚡', 'Un index permet de retrouver plus rapidement les lignes à partir d’une valeur recherchée.', 'Ici, le numéro de la commande sert à la retrouver.'],
    ['⚖️', 'Un index a un coût : il occupe de l’espace et doit être entretenu lorsque les données changent.', 'Crée-les pour les recherches qui en ont besoin.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:57,'), html.indexOf('guide({ id:50,'));
  const idees = [...fiche.matchAll(/\["(🔎|⚡|⚖️)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
});

test('ce que la vidéo ne reprend pas de l’ancien cours ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('M5'), val('WHY4')]);
  for (const mot of ['idx_clients_ville', 'boîte à fiches', 'LOWER(nom)', 'inscription']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page) && !/la base (lit|réagit|ajoute|garde)\b/.test(page), 'ni SQL ni la base ne sont personnifiés');
  const fiche = html.slice(html.indexOf('guide({ id:57,'), html.indexOf('guide({ id:50,'));
  assert.ok(!fiche.includes('sit:{') && !fiche.includes('testeVariants'), 'plus de cours texte Les index et EXPLAIN dans la fiche');
  assert.ok(!/dans commandes\b/.test(page) && val('CAPTIONS').filter(c => /table commandes/.test(c[2])).every(c => /<b>table commandes<\/b>/.test(c[2])), 'toujours la <b>table commandes</b>');
});

test('zones à toucher : les lignes des tables font 62 px ; les indices passent par la typographie française', () => {
  assert.ok(page.includes('const RH = 62;') && /\.r\{position:relative;height:(6[2-9]|[7-9]\d)px/.test(page), 'lignes de 62 px au moins');
  assert.ok(/\.pl \.pll\{[^}]*min-height:(7[2-9]|[89]\d)px/.test(page), 'les parties du plan : 72 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  assert.ok(page.includes("const PARTS = [['p0', 'SEARCH commandes'], ['p1', 'USING INDEX idx_commandes_numero'], ['p2', '(numero_commande=?)']];"));
});
