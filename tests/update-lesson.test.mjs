/* Projet NutriBoost, chapitre 8 (leçon 27 « UPDATE ») : la vidéo interactive assets/anim/projet-update.html, testée aussi dans lesson-video.test.mjs.
   À la rentrée, trois mails demandent de modifier des lignes qui existent déjà : la date de l’atelier Pilates, le solde de toutes les cartes,
   puis le solde de la carte de Nathan Petit (modification refusée par la règle CHECK). Deuxième cours du module « Écrire et modifier les données ».
   Leçon seule : ni cours texte, ni exercice. Elle remplace l’ancien cours UPDATE (hausse de 10 % des prix de la table produits).
   Ce que la vidéo montre (UPDATE … SET … WHERE, l’oubli du WHERE, le SELECT qui relit, la valeur calculée, la règle CHECK)
   est ici rejoué dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-update.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l27 = lessons.find(l => l.id === 27);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/ /g, ' ');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo, telle que le chapitre 7 la laisse : les quatre tables de la boutique, telles que l’app les crée (SCHEMA_SQL : clients, produits,
   commandes, fidelite) et les quatre tables des ateliers (coachs 4, ateliers 5, inscriptions 11 avec les quatre ajoutées au chapitre 7, cartes 3 dont celle
   d’Hugo Laurent, rechargée à 18 séances) : huit tables. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  db.run(`PRAGMA foreign_keys = ON;
    CREATE TABLE coachs (id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL REFERENCES coachs(id), places INTEGER DEFAULT 12);
    CREATE TABLE inscriptions (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), atelier_id INTEGER NOT NULL REFERENCES ateliers(id), date_inscription DATE);
    CREATE TABLE cartes (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id), seances_restantes INTEGER NOT NULL DEFAULT 10 CHECK (seances_restantes >= 0));
    INSERT INTO coachs VALUES (1,'Salma','Haddad','salma@pro.fr'),(2,'Moussa','Diallo','moussa@mail.fr'),(3,'Julie','Nguyen','julie@mail.fr'),(4,'Diego','Ramos','diego@mail.fr');
    INSERT INTO ateliers VALUES (1,'Récupération','2026-09-12',1,12),(2,'Pilates','2026-09-17',2,12),(3,'Cuisine saine','2026-09-19',3,12),(4,'Méditation','2026-09-24',4,12),(5,'Yoga du matin','2026-10-03',2,12);
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(4,7,3,'2026-09-04'),(5,3,1,'2026-09-05'),(6,6,4,'2026-09-06'),(7,1,4,'2026-09-07'),
      (8,2,3,'2026-09-08'),(9,6,5,'2026-09-09'),(10,8,5,'2026-09-09'),(11,9,5,'2026-09-09');
    INSERT INTO cartes VALUES (1,1,10),(2,4,5),(3,6,18);`);
  return db;
}
const HUIT = ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits'];   // par ordre alphabétique
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const dates = db => db.exec('SELECT date_atelier FROM ateliers ORDER BY id')[0].values.flat();
const soldes = db => db.exec('SELECT seances_restantes FROM cartes ORDER BY id')[0].values.flat();
const NOUVELLE = '2026-09-18';

test('UPDATE : deuxième cours du module « Écrire et modifier les données », juste après INSERT et juste avant DELETE', () => {
  const m = modules.find(x => x.titre === 'Écrire et modifier les données');
  assert.deepEqual([...m.lessons.map(l => l.id)], [26, 27, 28], 'INSERT, UPDATE, DELETE');
  const ids = lessons.map(l => l.id);
  assert.equal(ids.indexOf(27), ids.indexOf(26) + 1, 'UPDATE vient juste après INSERT');
  assert.equal(ids.indexOf(28), ids.indexOf(27) + 1, 'DELETE vient juste après');
  assert.equal(l27.titre, 'UPDATE');
  assert.equal(l27.résumé, 'Modifier des lignes');
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  27:'([^']+)',/)[1];
  assert.ok(['update', 'modifier', 'set', 'where', 'oubli du where', 'sans where', 'select', 'calculer', 'check', 'modification refusee'].every(m => mots.includes(m)),
    'trouvé par la recherche : UPDATE, SET, WHERE, l’oubli du WHERE, la valeur calculée, la règle CHECK…');
  assert.ok(l27.leconSeule && l27.video && !l27.situation && !l27.consigne && !l27.solution && !l27.petitDefi && !l27.learningCheck && !l27.testeVariants && !l27.anatomie, 'la vidéo est le cours');
  assert.equal(l27.video.moments, 6); assert.equal(l27.video.seuil, 4);
  assert.equal(l27.video.anim, 'assets/anim/projet-update.html?app&embed');
  const recap = l27.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['✏️', '⚠️', '🔢'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 173.4);
  assert.ok(page.includes('notesAt: 173.4,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 180.6);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant 0,4 s après la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Trois demandes', 'Cibler une ligne', 'L’oubli du WHERE', 'Lire avant d’écrire', 'Une valeur calculée', 'Une règle de la table', 'À retenir']);
  /* Une seule phrase complète par bulle (Elisa, 23 octobre) ; aucune bulle de plus de trois lignes. */
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  /* Six moments, dans l’ordre des chapitres ; chacun s’arrête 2,35 s après le début de sa légende « À toi ! ». */
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'tap', 'pick', 'pick', 'pick']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, false, true], 'WHERE id = 2');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [true, false, false], 'SELECT … WHERE id = 2');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, true, false], 'SET seances_restantes = seances_restantes + 2');
  assert.deepEqual(picks[5].options.map(o => !!o.ok), [false, false, true], 'le solde passerait sous 0');
  assert.equal(picks[0].need, 1, 'une seule case à toucher : la date de l’atelier Pilates');
  assert.equal(picks[2].need, 5, 'les cinq ateliers dont la date change');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

/* ---------- Les règles d’écriture d’Elisa (23 et 24 octobre), appliquées à tout le texte que l’élève lit ---------- */
test('règles d’écriture : « l’atelier » avant un nom d’atelier, nom et prénom des clients, « identifiant », pas de personnification, noms de tables dans « la table … »', () => {
  const picks = val('PICKS'), mails = val('MAILS'), db = base();
  const texts = [...val('CAPTIONS').map(c => c[2]), ...picks.flatMap(p => [p.prompt, ...(p.options || []).flatMap(o => [o.label, o.why])]),
    ...mails.flatMap(m => m[4]), ...Object.values(val('WHY1'))].filter(Boolean).map(strip);
  const hints = [...page.matchAll(/return \{text: '([^']+)'/g)].map(m => strip(m[1]));
  assert.equal(hints.length, 6, 'les six aides sont lues');
  const clients = db.exec('SELECT prenom, nom FROM clients')[0].values;
  const ateliers = db.exec('SELECT titre FROM ateliers')[0].values.flat();
  for (const t of [...texts, ...hints]) {
    for (const nom of ateliers) for (const m of t.matchAll(new RegExp(nom, 'g')))
      assert.ok(/l’atelier $/i.test(t.slice(Math.max(0, m.index - 10), m.index)), `« ${nom} » toujours après « l’atelier » : ${t}`);
    assert.ok(!/\bnuméros?\b/i.test(t), `« identifiant », jamais « numéro » : ${t}`);
    assert.ok(!/\bliens?\b/i.test(t), `« relation », jamais « lien » : ${t}`);
    assert.ok(!/(la table|la base|la requête|SQL) (accepte|crée|lit|refuse|voit|comprend|sait|ajoute|modifie)\b/.test(t), `aucune personnification : ${t}`);
    assert.ok(!/(?<!la )table (clients|ateliers|inscriptions|cartes)\b/.test(t), `« la table … » devant le nom d’une table : ${t}`);
    /* Un prénom de client est toujours suivi de son nom (« Moussa » n’est pas un client). */
    for (const prenom of new Set(clients.map(c => c[0]))) for (const m of t.matchAll(new RegExp(`(?<![\\wÀ-ÿ])${prenom}(?![\\wÀ-ÿ])`, 'g'))) {
      if (t.slice(m.index).startsWith('Nathan conserve ses 7 séances')) continue;   // mots d’Elisa (24 octobre, Réf 6), juste après « Nathan Petit » : exception de la charte
      const suite = t.slice(m.index + prenom.length).match(/^ (\p{L}+)/u)?.[1];
      assert.ok(suite && clients.filter(c => c[0] === prenom).map(c => c[1]).includes(suite), `« ${prenom} » toujours suivi de son nom : ${t}`);
    }
  }
  /* Dans les légendes, le nom d’une table est en gras (« la <b>table ateliers</b> »). */
  for (const c of val('CAPTIONS')) assert.ok(!/table (clients|ateliers|inscriptions|cartes)\b/.test(c[2].replace(/<b>table (clients|ateliers|inscriptions|cartes)<\/b>/g, '')), `légende : nom de table en gras : ${c[2]}`);
  assert.ok(val('CAPTIONS').some(c => c[2].includes('la <b>table ateliers</b>')), 'la table ateliers est nommée en gras');
});

test('moment 1 : la case à toucher est la date de l’atelier Pilates ; les autres cases sont expliquées, avec le bon atelier', () => {
  const ateliers = val('ATELIERS'), WHY1 = val('WHY1');
  const db = base();
  assert.deepEqual(ateliers, db.exec('SELECT id, titre, date_atelier FROM ateliers ORDER BY id')[0].values, 'les cinq ateliers, dans l’ordre');
  assert.equal(ateliers[1][1], 'Pilates'); assert.equal(ateliers[1][2], '2026-09-17');
  assert.equal(val('NEW_DATE'), NOUVELLE, 'le 18 septembre');
  /* Une explication pour chaque autre date (elle nomme l’atelier de cette ligne) et pour le titre. */
  assert.deepEqual(Object.keys(WHY1).sort(), ['d1', 'd3', 'd4', 'd5', 't2'], 'toutes les cases sauf la bonne');
  for (const [id, titre] of ateliers.filter(x => x[0] !== 2).map(x => [x[0], x[1]])) assert.ok(WHY1['d' + id].includes(`l’atelier ${titre}`), `la date n° ${id} : l’atelier ${titre}`);
  assert.ok(WHY1.t2.includes('atelier Pilates') && WHY1.t2.includes('date'), 'le titre ne change pas : c’est la date qui change');
  /* Ce que fait la requête : la date de l’atelier Pilates passe du 17 au 18, les quatre autres ne bougent pas. */
  const before = dates(db);
  db.run(`UPDATE ateliers SET date_atelier = '${NOUVELLE}' WHERE id = 2;`);
  assert.equal(db.getRowsModified(), 1);
  assert.deepEqual(dates(db), before.map((d, k) => k === 1 ? NOUVELLE : d));
  /* Le mail de Moussa Diallo dit la même chose. */
  const mail = val('MAILS')[0][4].join(' ');
  assert.ok(mail.includes('L’atelier Pilates est décalé d’un jour') && mail.includes('le 18 septembre, au lieu du 17.'), 'le mail : du 17 au 18 septembre');
});

test('moment 2 : WHERE id = 2 modifie seulement l’atelier Pilates ; id = 18 ne modifie aucune ligne ; id > 2 modifie les ateliers 3, 4 et 5', () => {
  const opts = val('PICKS')[1].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['WHERE id = 18', 'WHERE id > 2', 'WHERE id = 2'], 'les trois fins possibles, après SET date_atelier = \'2026-09-18\'');
  const jouer = fin => { const db = base(); db.run(`UPDATE ateliers SET date_atelier = '${NOUVELLE}' ${fin};`); return [db.getRowsModified(), dates(db)]; };
  const avant = dates(base());
  assert.deepEqual(jouer(opts[0]), [0, avant], 'aucun atelier n’a l’identifiant 18 : exécutée sans erreur, aucune ligne modifiée');
  assert.equal(base().exec('SELECT COUNT(*) FROM ateliers WHERE id = 18')[0].values[0][0], 0);
  assert.deepEqual(jouer(opts[1]), [3, [avant[0], avant[1], NOUVELLE, NOUVELLE, NOUVELLE]], 'les ateliers 3, 4 et 5 changent de date, pas l’atelier Pilates');
  assert.deepEqual(jouer(opts[2]), [1, [avant[0], NOUVELLE, avant[2], avant[3], avant[4]]], 'seule l’atelier Pilates change');
  /* La page : les deux aperçus des mauvais choix disent ce que la base répond. */
  for (const t of ["out('pvo2-1', 'warn', 'Exécutée sans erreur', '0 ligne modifiée.')", "out('pvo2-2', 'warn', 'Exécutée sans erreur', '3 lignes modifiées.')",
    "['ed4b', 'WHERE id = 18;'], ['ed4c', 'WHERE id > 2;']", "['ed4', '{kw|WHERE} {cw|id = 2};']"]) assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('moment 3 : sans WHERE, la requête est exécutée sans la moindre erreur et les cinq ateliers passent au 18 septembre', () => {
  const db = base();
  db.run(`UPDATE ateliers SET date_atelier = '${NOUVELLE}';`);   // aucune erreur
  assert.equal(db.getRowsModified(), 5, 'toutes les lignes sont modifiées');
  assert.deepEqual(dates(db), Array(5).fill(NOUVELLE));
  assert.equal(count(db, 'ateliers'), 5, 'aucune ligne ajoutée ni retirée');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Sans <code>WHERE</code>, la modification s’applique<br>à toutes les lignes de la table.') && caps.includes('Résultat : les cinq ateliers<br>sont désormais programmés<br>le 18 septembre !'), 'les légendes disent la même chose');
  assert.ok(caps.includes('La requête s’exécute sans erreur,<br>mais 5 lignes ont été modifiées<br>au lieu d’une.') && caps.includes('Pense à vérifier ce nombre<br>après chaque mise à jour !'), 'sans erreur, mais cinq lignes modifiées au lieu d’une : le nombre est à vérifier');
  assert.ok(caps.includes('Imagine que tu oublies le <code>WHERE</code>.'), 'l’oubli du WHERE est imaginé : rien n’est écrit pour de bon');
  assert.ok(page.includes("out('o-5', 'warn', 'Requête exécutée', '5 lignes modifiées.')") && page.includes("out('o-ex', 'ok', 'Requête exécutée', 'Aucune erreur.')"), 'la page montre les deux résultats');
});

test('moment 4 : le SELECT garde le même WHERE ; il lit la ligne de l’atelier Pilates sans rien modifier ; l’UPDATE modifie ensuite une ligne', () => {
  const opts = val('PICKS')[3].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['SELECT * FROM ateliers WHERE id = 2', 'SELECT * FROM ateliers', "SELECT * FROM ateliers WHERE date_atelier = '2026-09-18'"]);
  const db = base(), avant = dates(db);
  const lire = q => db.exec(`${q};`)[0]?.values ?? [];
  assert.deepEqual(lire(opts[0]), [[2, 'Pilates', '2026-09-17', 2, 12]], 'une seule ligne : l’atelier Pilates');
  assert.equal(lire(opts[1]).length, 5, 'sans WHERE : les cinq ateliers');
  assert.equal(lire(opts[2]).length, 0, 'aucun atelier n’a encore la date du 18 septembre');
  assert.deepEqual(dates(db), avant, 'lire ne modifie rien');
  /* La ligne lue est bien celle que l’UPDATE modifie ensuite : même WHERE, une ligne. */
  db.run(`UPDATE ateliers SET date_atelier = '${NOUVELLE}' WHERE id = 2;`);
  assert.equal(db.getRowsModified(), 1);
  assert.equal(lire(opts[2]).length, 1, 'ensuite, l’atelier Pilates a la date du 18 septembre');
  /* Dans la vidéo, la date de l’atelier Pilates ne change qu’après la relecture : l’UPDATE n’est exécuté qu’à la légende « La ligne est la bonne ». */
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.indexOf('La ligne est la bonne :<br>tu peux exécuter l’<code>UPDATE</code>.') > caps.findIndex(c => c.includes('le <code>SELECT</code>')), 'la relecture, puis l’exécution');
  assert.ok(page.includes("show('#o-1', A.c15b + 2.5,") && page.includes("swap('#ds2 .a0', '#ds2 .a1', A.c15b + 3.9);"), 'le résultat « 1 ligne modifiée » et la nouvelle date arrivent après la légende de la relecture');
  assert.ok(caps.includes('Avec <code>WHERE id = 2</code>,<br>seul l’atelier Pilates a été modifié :<br>il est désormais prévu le 18 septembre.'), 'avec WHERE id = 2, seul l’atelier Pilates est modifié');
  assert.ok(page.includes("out('o-sel', 'ok', 'Requête exécutée', '1 ligne trouvée.')") && page.includes("out('o-1', 'ok', 'Requête exécutée', '1 ligne modifiée.')"), 'la page montre les deux résultats');
});

test('moment 5 : « = seances_restantes + 2 » ajoute 2 séances à chaque carte (10, 5 et 18 deviennent 12, 7 et 20) ; « = 2 » remplace les soldes ; avec WHERE id = 1, une seule carte', () => {
  const opts = val('PICKS')[4].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['SET seances_restantes = 2', 'SET seances_restantes = seances_restantes + 2', 'SET seances_restantes = seances_restantes + 2 WHERE id = 1']);
  const jouer = fin => { const db = base(); db.run(`UPDATE cartes ${fin};`); return [db.getRowsModified(), soldes(db)]; };
  assert.deepEqual(soldes(base()), [10, 5, 18]);
  assert.deepEqual(jouer(opts[0]), [3, [2, 2, 2]], 'les trois cartes passent à 2 séances : l’ancien solde est remplacé');
  assert.deepEqual(jouer(opts[1]), [3, [12, 7, 20]], 'chaque solde augmente de 2');
  assert.deepEqual(jouer(opts[2]), [1, [12, 5, 18]], 'seule la carte d’identifiant 1 reçoit ses 2 séances');
  /* La page montre les mêmes soldes, avant et après, et le nom du client de chaque carte. */
  const CARTES = val('CARTES'), db = base();
  assert.deepEqual(CARTES.map(c => [c[0], c[1], c[3]]), db.exec('SELECT id, client_id, seances_restantes FROM cartes ORDER BY id')[0].values, 'id, client_id et solde avant');
  assert.deepEqual(CARTES.map(c => c[4]), jouer(opts[1])[1], 'le solde après le cadeau de la rentrée');
  assert.deepEqual(CARTES.map(c => c[2]), db.exec("SELECT cl.prenom || ' ' || cl.nom FROM cartes c JOIN clients cl ON cl.id = c.client_id ORDER BY c.id")[0].values.flat());
  const mail = val('MAILS')[1][4].join(' ');
  assert.ok(mail.includes('NutriBoost offre 2 séances à tous ses membres.') && mail.includes('à toutes les cartes'), 'le mail de l’équipe NutriBoost');
  for (const t of ["out('pvo5-1', 'warn', 'Exécutée sans erreur', 'Les trois cartes passent à 2 séances.')", "out('pvo5-2', 'warn', 'Exécutée sans erreur', 'Une seule carte est modifiée.')", "out('o-c1', 'ok', 'Requête exécutée', '3 lignes modifiées.')",
    "'SET seances_restantes = {kcc|seances_restantes + 2};'"]) assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('moment 6 : retirer 8 séances à Nathan Petit (7 séances après le cadeau) est refusé par la règle CHECK ; la carte garde ses 7 séances', () => {
  const db = base(), clients = Object.fromEntries(db.exec("SELECT prenom || ' ' || nom, id FROM clients")[0].values);
  assert.equal(clients['Nathan Petit'], 4, 'Nathan Petit est le client 4');
  db.run('UPDATE cartes SET seances_restantes = seances_restantes + 2;');   // le cadeau de la rentrée, exécuté avant
  const solde = () => db.exec('SELECT seances_restantes FROM cartes WHERE client_id = 4')[0].values[0][0];
  assert.equal(solde(), 7, 'sa carte compte 7 séances');
  assert.throws(() => db.run('UPDATE cartes SET seances_restantes = seances_restantes - 8 WHERE client_id = 4;'), /CHECK constraint failed: seances_restantes >= 0/);
  assert.equal(solde(), 7, 'une modification refusée n’est pas écrite');
  assert.deepEqual(soldes(db), [12, 7, 20], 'les autres cartes ne bougent pas non plus');
  /* Un retrait que la règle accepte : 7 − 7 = 0. */
  db.run('UPDATE cartes SET seances_restantes = seances_restantes - 7 WHERE client_id = 4;');
  assert.equal(solde(), 0);
  /* La règle est celle du chapitre 4 (la colonne s’appelait seances, elle a été renommée au chapitre 5). */
  const create = fs.readFileSync(path.join(root, 'assets/anim/projet-create.html'), 'utf8'), alter = fs.readFileSync(path.join(root, 'assets/anim/projet-alter.html'), 'utf8');
  assert.ok(/CHECK/.test(create) && /seances_restantes/.test(alter), 'le chapitre 4 crée la règle CHECK, le chapitre 5 renomme la colonne');
  const opts = val('PICKS')[5].options;
  assert.ok(sp(opts[2].label) === 'Le solde passerait sous 0, ce que la règle de la table interdit', 'la bonne réponse');
  for (const t of ["out('o-ck', 'err', 'Requête refusée', 'CHECK constraint failed:<br>seances_restantes &gt;= 0', 'm', true)", '<span><b>CHECK</b> (seances_restantes &gt;= 0)</span>', '<i class="calc bad" id="cx">7 − 8 = −1</i>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('La règle <code>CHECK</code> du chapitre 4<br>s’applique aussi quand<br>tu modifies une ligne.') && caps.includes('Une modification refusée<br>n’est pas écrite :<br>Nathan conserve ses 7 séances.'), 'les légendes disent la même chose');
  const mail = val('MAILS')[2][4].join(' ');
  assert.ok(mail.includes('Nathan Petit s’inscrit à un stage de 8 séances.') && mail.includes('retirer ces 8 séances de sa carte'), 'le mail du service client NutriBoost');
});

test('la page montre la base : huit tables, leurs nombres de lignes (les inscriptions passent de 7 à 11) et la table ateliers', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), HUIT);
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes'], 'la boutique d’abord, puis les tables des ateliers dans l’ordre du chapitre 5');
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  assert.ok(page.includes('<span class="n0">7 lignes</span><span class="n1">${n} lignes</span>'), 'inscriptions : 7 lignes, puis 11');
  assert.ok(page.includes('<span>8 tables</span>') && page.includes('3 demandes à traiter'), '8 tables, 3 demandes');
  assert.deepEqual(db.exec("SELECT name FROM pragma_table_info('ateliers')")[0].values.flat().slice(0, 3), ['id', 'titre', 'date_atelier'], 'les colonnes de l’en-tête de la table ateliers');
  for (const t of ['<span class="emo">🔑</span>id', '<span class="c1">titre</span>', '<span class="c2">date_atelier</span>', '<span class="c2">seances_restantes</span>', '<span class="emo">🔗</span>client_id']) assert.ok(page.includes(t), `en-tête : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[2], 'À la rentrée, tu reçois trois demandes<br>par mail pour mettre à jour<br>les données de NutriBoost.', 'les trois demandes : première bulle d’Elisa');
  assert.equal(caps[3], '<span class="dense">Pour les traiter, tu vas modifier<br>des informations dans des lignes<br>existantes avec la commande SQL <code>UPDATE</code>.</span>',
    'deuxième bulle d’Elisa, mot pour mot : trop longue pour trois lignes à 44 px, elle prend la classe « dense » (police 42 px)');
});

test('les trois mails : Moussa Diallo, l’équipe NutriBoost, puis le service client ; l’app s’arrête sur chacun jusqu’au toucher', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), mail = val('[MAIL1, MAIL2, MAIL3]');
  assert.deepEqual(mails.map(m => [m[0][0], m[0][1], m[3]]), [['Moussa', 'Diallo', 'moussa@mail.fr'], ['L’équipe', 'NutriBoost', 'equipe@nutriboost.fr'], ['Le service client', 'NutriBoost', 'service.client@nutriboost.fr']]);
  const coach = base().exec("SELECT email FROM coachs WHERE prenom = 'Moussa' AND nom = 'Diallo'")[0].values[0][0];
  assert.equal(mails[0][3], coach, 'l’adresse de Moussa Diallo est celle de la table coachs');
  assert.equal(base().exec("SELECT c.nom FROM ateliers a JOIN coachs c ON c.id = a.coach_id WHERE a.titre = 'Pilates'")[0].values[0][0], 'Diallo', 'Moussa Diallo anime l’atelier Pilates');
  assert.deepEqual(mails.map(m => m[5]), ['Moussa', 'L’équipe NutriBoost', 'Le service client NutriBoost']);
  assert.equal(opens.length, 3);
  opens.forEach((o, n) => { assert.ok(o.at > mail[n] && o.at < mail[n] + 4.8, `mail ${n + 1} : l’app s’arrête pendant le mail`); assert.equal(o.sel, '#ml' + (n + 1)); });
  assert.ok(mail[0] < picks[0].at && mail[1] > picks[3].at && mail[1] < picks[4].at && mail[2] > picks[4].at && mail[2] < picks[5].at, 'mail 1 avant le moment 1, mail 2 entre les moments 4 et 5, mail 3 entre les moments 5 et 6');
  assert.ok(opens.map(o => o.label).join('|') === 'Ouvrir le mail de Moussa Diallo|Ouvrir le mail de L’équipe NutriBoost|Ouvrir le mail du service client NutriBoost');
});

/* ---------- Propre au chapitre 8 : la suite du chapitre 7, l’annonce de la leçon DELETE ---------- */
test('chapitre 8 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 8 : UPDATE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 8</div>')
    && page.includes('<span>U</span><span>P</span><span>D</span><span>A</span><span>T</span><span>E</span>') && page.includes('<div class="abs sub">Modifier des lignes</div>')
    && page.includes('Les informations changent&nbsp;:<br>à toi de les modifier dans la base.'), 'écran titre : « Projet · Chapitre 8 », UPDATE, « Modifier des lignes »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 7');
  assert.equal(caps[1], 'Au chapitre 7, tu as ajouté des lignes avec <code>INSERT INTO</code>.', 'le chapitre précédent');
  /* La fin du chapitre 7 annonce « UPDATE » : c’est ce chapitre. */
  const insert = fs.readFileSync(path.join(root, 'assets/anim/projet-insert.html'), 'utf8');
  assert.ok(insert.includes('à modifier les données avec <code>UPDATE</code>.') && insert.includes('Prochaine leçon · UPDATE</span>'), 'le chapitre 7 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : DELETE. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à supprimer des lignes avec <code>DELETE</code>.') && page.includes('Prochaine leçon · DELETE</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 27) + 1].id, 28);
  assert.equal(lessons.find(l => l.id === 28).titre, 'DELETE');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  /* Les mots d’Elisa (24 octobre, Réf 7), sans « 1. », « 2. », « 3. ». */
  const RECAP = [['✏️', 'Modifier des données existantes', 'UPDATE modifie les valeurs de lignes déjà présentes. SET précise les colonnes à modifier et leurs nouvelles valeurs ; WHERE sélectionne les lignes concernées.'],
    ['⚠️', 'Vérifier les lignes avant de modifier', 'Sans WHERE, la modification s’applique à toute la table. Avant d’exécuter ton UPDATE, vérifie les lignes ciblées avec un SELECT utilisant le même WHERE.'],
    ['🔢', 'Calculer une nouvelle valeur', 'Tu peux partir de la valeur actuelle, par exemple pour ajouter 2 séances. La nouvelle valeur doit respecter les règles de la table, sinon la modification est refusée.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:27,'), html.indexOf('guide({ id:28,'));
  const idees = [...fiche.matchAll(/\["(✏️|⚠️|🔢)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
});

test('les mots d’Elisa (24 octobre, 22 h 29), mot pour mot : une phrase par bulle, dans l’ordre de la vidéo', () => {
  /* Ses phrases, corrigées seulement de la ponctuation et de l’orthographe (« À la rentrée, tu reçois… »). Chacune est une bulle à elle seule :
     jamais coupée en deux, jamais collée à une autre. */
  const dits = val('CAPTIONS').map(c => sp(strip(c[2])));
  const ELISA = ['À la rentrée, tu reçois trois demandes par mail pour mettre à jour les données de NutriBoost.',          // Réf 2 et 3, première bulle
    'Pour les traiter, tu vas modifier des informations dans des lignes existantes avec la commande SQL UPDATE.',          // deuxième bulle
    'Sans WHERE, la modification s’applique à toutes les lignes de la table.',                                              // Réf 1
    'Résultat : les cinq ateliers sont désormais programmés le 18 septembre !',
    'La requête s’exécute sans erreur, mais 5 lignes ont été modifiées au lieu d’une.',                                     // Réf 4
    'Pense à vérifier ce nombre après chaque mise à jour !',
    'Avec WHERE id = 2, seul l’atelier Pilates a été modifié : il est désormais prévu le 18 septembre.',                   // Réf 5
    'Une modification refusée n’est pas écrite : Nathan conserve ses 7 séances.'];                                          // Réf 6
  const places = ELISA.map(t => { assert.ok(dits.includes(t), `bulle d’Elisa : « ${t} »`); return dits.indexOf(t); });
  assert.ok(places.every((n, k) => !k || n > places[k - 1]), 'dans l’ordre : demandes, oubli du WHERE, résultat, vérification, modification refusée');
  /* Les mots restent les siens : ni « on » ni « il convient », « tu » partout. */
  assert.ok(!dits.some(t => /\b(veuillez|il convient|afin de|ledit)\b/i.test(t)), 'des phrases parlées');
  /* La phrase trop longue pour trois lignes à 44 px prend la classe « dense » (police 42 px) ; aucune autre bulle n’en a besoin. */
  assert.equal([...page.matchAll(/class=\\?"dense\\?"/g)].length, 1, 'une seule bulle « dense »');
  assert.ok(/#cap \.c p \.dense\{[^}]*font-size:42px/.test(fs.readFileSync(path.join(root, 'assets/anim/core.css'), 'utf8')), 'la classe « dense » : 42 px, sans retour à la ligne automatique');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de changes(), de sous-requête, de CASE, de UPDATE … FROM ni de SET sur plusieurs colonnes ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])).join(' ');
  for (const mot of ['changes()', 'CASE', 'UPDATE … FROM', 'COALESCE', 'IN (', 'UNIQUE', 'ROUND', 'produits']) assert.ok(!caps.includes(mot) && !page.includes(`>${mot}`), `la vidéo n’enseigne pas ${mot}`);
  assert.ok(!/SET [a-z_]+ = [^,;]+, [a-z_]+ =/.test(page), 'un seul changement par SET');
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
});

test('zones à toucher : les lignes de la table ateliers font au moins 84 px (le doigt) ; l’indice du moment 1 surligne la date de l’atelier Pilates, en typographie française', () => {
  const h = +page.match(/#ta \.r\{height:(\d+)px/)[1];
  assert.ok(h >= 84, `lignes de la table ateliers : ${h} px`);
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['d2'\]\};/.test(page), 'indice du moment 1 : la date de l’atelier Pilates (d2) ressort');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
});
