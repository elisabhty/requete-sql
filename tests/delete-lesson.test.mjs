/* Projet NutriBoost, chapitre 9 (leçon 28 « DELETE ») : la vidéo interactive assets/anim/projet-delete.html, testée aussi dans lesson-video.test.mjs.
   Trois mails demandent de supprimer des lignes : l’inscription de Léa Simon, le compte de Nathan Dupont (il y a deux Nathan), puis les deux
   inscriptions d’Hugo Laurent. Troisième cours du module « Écrire et modifier les données ». Leçon seule : ni cours texte, ni exercice. Elle remplace
   l’ancien cours DELETE (le compte de Nathan Dupont et la table fidelite, la sous-requête dans le WHERE).
   Ce que la vidéo montre (DELETE FROM … WHERE …, un prénom partagé par deux clients, plusieurs lignes d’un coup, l’oubli du WHERE, la table qui existe
   encore, vide) est ici rejoué dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-delete.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l28 = lessons.find(l => l.id === 28);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[\u00a0\u202f]/g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/[\u00a0\u202f]/g, ' ');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo, telle que le chapitre 8 la laisse : les quatre tables de la boutique, telles que l’app les crée (SCHEMA_SQL : clients 10,
   produits, commandes 16, fidelite) et les quatre tables des ateliers (coachs 4, ateliers 5 dont Pilates décalé au 18 septembre, inscriptions 11, cartes 3
   rechargées par le cadeau de la rentrée : 12, 7 et 20 séances) : huit tables. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  db.run(`PRAGMA foreign_keys = ON;
    CREATE TABLE coachs (id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE ateliers (id INTEGER PRIMARY KEY, titre TEXT NOT NULL, date_atelier DATE, coach_id INTEGER NOT NULL REFERENCES coachs(id), places INTEGER DEFAULT 12);
    CREATE TABLE inscriptions (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), atelier_id INTEGER NOT NULL REFERENCES ateliers(id), date_inscription DATE);
    CREATE TABLE cartes (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id), seances_restantes INTEGER NOT NULL DEFAULT 10 CHECK (seances_restantes >= 0));
    INSERT INTO coachs VALUES (1,'Salma','Haddad','salma@pro.fr'),(2,'Moussa','Diallo','moussa@mail.fr'),(3,'Julie','Nguyen','julie@mail.fr'),(4,'Diego','Ramos','diego@mail.fr');
    INSERT INTO ateliers VALUES (1,'Récupération','2026-09-12',1,12),(2,'Pilates','2026-09-18',2,12),(3,'Cuisine saine','2026-09-19',3,12),(4,'Méditation','2026-09-24',4,12),(5,'Yoga du matin','2026-10-03',2,12);
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(4,7,3,'2026-09-04'),(5,3,1,'2026-09-05'),(6,6,4,'2026-09-06'),(7,1,4,'2026-09-07'),
      (8,2,3,'2026-09-08'),(9,6,5,'2026-09-09'),(10,8,5,'2026-09-09'),(11,9,5,'2026-09-09');
    INSERT INTO cartes VALUES (1,1,12),(2,4,7),(3,6,20);`);
  return db;
}
/* La base après la suppression de l’inscription de Léa Simon (moment 2), puis du compte de Nathan Dupont (moment 3). */
function apresDeux() { const db = base(); db.run('DELETE FROM inscriptions WHERE id = 4;'); db.run('DELETE FROM clients WHERE id = 10;'); return db; }
const HUIT = ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits'];   // par ordre alphabétique
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const ids = db => db.exec('SELECT id FROM inscriptions ORDER BY id')[0]?.values.flat() ?? [];
const TOUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

test('DELETE : troisième cours du module « Écrire et modifier les données », juste après UPDATE ; le cours suivant du parcours est ON DELETE', () => {
  const m = modules.find(x => x.titre === 'Écrire et modifier les données');
  assert.deepEqual([...m.lessons.map(l => l.id)], [26, 27, 28], 'INSERT, UPDATE, DELETE');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(28), liste.indexOf(27) + 1, 'DELETE vient juste après UPDATE');
  assert.equal(liste[liste.indexOf(28) + 1], 68, 'ON DELETE vient juste après');
  assert.equal(l28.titre, 'DELETE');
  assert.equal(l28.résumé, 'Supprimer des lignes');
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  28:'([^']+)',/)[1];
  assert.ok(['delete', 'supprimer', 'where', 'oubli du where', 'sans where', 'toutes les lignes', 'vider une table', 'select', 'inscription', 'compte'].every(m => mots.includes(m)),
    'trouvé par la recherche : DELETE, WHERE, l’oubli du WHERE, toutes les lignes, la table vidée…');
  assert.ok(l28.leconSeule && l28.video && !l28.situation && !l28.consigne && !l28.solution && !l28.petitDefi && !l28.learningCheck && !l28.testeVariants && !l28.anatomie, 'la vidéo est le cours');
  assert.equal(l28.video.moments, 6); assert.equal(l28.video.seuil, 4);
  assert.equal(l28.video.anim, 'assets/anim/projet-delete.html?app&embed');
  const recap = l28.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🗑️', '⚠️', '🎯'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 142.2);
  assert.ok(page.includes('notesAt: 142.2,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 149.4);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant 0,4 s après la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Trois demandes', 'Supprimer une ligne', 'Le bon client', 'Plusieurs lignes', 'L’oubli du WHERE', 'Trois mots-clés', 'À retenir']);
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
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'pick', 'pick', 'tap', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, true, false], 'WHERE id = 4');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true], 'WHERE id = 10');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, true, false], 'WHERE client_id = 6');
  assert.equal(picks[0].need, 1, 'une seule ligne à toucher : l’inscription de Léa Simon');
  assert.equal(picks[4].need, 8, 'les huit inscriptions qui resteraient');
  assert.equal(picks[5].options.length, 6, 'six demandes à ranger');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('la page montre la base : huit tables, leurs nombres de lignes, la table inscriptions (onze lignes) et la table clients (dix, dont deux Nathan)', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), HUIT);
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes'], 'la boutique d’abord, puis les tables des ateliers dans l’ordre du chapitre 5');
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  assert.deepEqual(val('INSCR'), db.exec("SELECT i.id, i.client_id, c.prenom || ' ' || c.nom, i.atelier_id, a.titre, i.date_inscription FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id ORDER BY i.id")[0].values, 'la table inscriptions de la page est celle de la base');
  assert.deepEqual(val('CLI'), db.exec('SELECT id, prenom, nom, ville FROM clients ORDER BY id')[0].values, 'la table clients de la page est celle de la base');
  assert.deepEqual(val('ATELIERS'), db.exec('SELECT id, titre, date_atelier FROM ateliers ORDER BY id')[0].values, 'la table ateliers de la page : Pilates a déjà été décalé au chapitre 8');
  assert.ok(page.includes('<span>8 tables</span>') && page.includes('3 demandes à traiter'), '8 tables, 3 demandes');
  assert.ok(page.includes('<span id="bn0">11 lignes</span><span id="bn1">10 lignes</span><span id="bn2">8 lignes</span><span id="bn3">0 ligne</span>'), 'la table inscriptions passe de 11 à 10, 8, puis 0 ligne');
  assert.ok(page.includes('<span id="cn0">10 lignes</span><span id="cn1">9 lignes</span>'), 'la table clients passe de 10 à 9 lignes');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[3], 'Cette fois, toutes demandent<br>de supprimer des lignes.', 'toutes les demandes suppriment des lignes');
});

test('moments 1 et 2 : l’inscription de Léa Simon est celle d’identifiant 4 ; WHERE id = 4 la supprime seule ; id = 7 supprimerait celle de Sophie Martin, atelier_id = 3 en supprimerait deux', () => {
  const db = base(), INSCR = val('INSCR'), WHY1 = val('WHY1');
  assert.deepEqual(db.exec("SELECT i.id, a.titre, i.date_inscription FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id WHERE c.prenom = 'Léa' AND c.nom = 'Simon'")[0].values,
    [[4, 'Cuisine saine', '2026-09-04']], 'Léa Simon n’a qu’une inscription : l’atelier Cuisine saine');
  assert.deepEqual(Object.keys(WHY1).sort(), ['r1', 'r10', 'r11', 'r2', 'r3', 'r5', 'r6', 'r7', 'r8', 'r9'], 'toutes les lignes sauf la bonne sont expliquées');
  for (const r of INSCR.filter(r => r[0] !== 4)) assert.ok(WHY1['r' + r[0]].includes(r[2]), `l’inscription ${r[0]} : la correction nomme ${r[2]}`);
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['r4'\]\};/.test(page), 'indice du moment 1 : la ligne de Léa Simon (r4) ressort');
  const opts = val('PICKS')[1].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['WHERE id = 7', 'WHERE id = 4', 'WHERE atelier_id = 3'], 'les trois fins possibles, après DELETE FROM inscriptions');
  const jouer = fin => { const d = base(); d.run(`DELETE FROM inscriptions ${fin};`); return [d.getRowsModified(), ids(d)]; };
  assert.deepEqual(jouer(opts[0]), [1, TOUTES.filter(i => i !== 7)], 'l’identifiant 7 est celui de l’inscription de Sophie Martin');
  assert.equal(db.exec("SELECT prenom || ' ' || nom FROM clients WHERE id = 7")[0].values[0][0], 'Léa Simon', 'et 7 est l’identifiant de Léa Simon dans la table clients : la confusion que la correction explique');
  assert.equal(db.exec("SELECT c.prenom || ' ' || c.nom FROM inscriptions i JOIN clients c ON c.id = i.client_id WHERE i.id = 7")[0].values[0][0], 'Sophie Martin');
  assert.deepEqual(jouer(opts[1]), [1, TOUTES.filter(i => i !== 4)], 'seule l’inscription de Léa Simon est supprimée');
  assert.deepEqual(jouer(opts[2]), [2, TOUTES.filter(i => i !== 4 && i !== 8)], 'les inscriptions de Léa Simon et de Lucas Bernard à l’atelier Cuisine saine');
  /* L’atelier existe toujours : une inscription est une ligne de la table inscriptions, pas de la table ateliers. */
  const d = base(); d.run('DELETE FROM inscriptions WHERE id = 4;');
  assert.equal(count(d, 'ateliers'), 5); assert.equal(d.exec("SELECT COUNT(*) FROM ateliers WHERE titre = 'Cuisine saine'")[0].values[0][0], 1);
  for (const t of ["out('o-1', 'ok', 'Requête exécutée', '1 ligne supprimée.')", "out('pvo2-1', 'warn', 'Exécutée sans erreur', '1 ligne supprimée.')", "out('pvo2-2', 'warn', 'Exécutée sans erreur', '2 lignes supprimées.')",
    "['e1c', '{kw1|WHERE} {cw1|id = 4};']", "['e1c2', 'WHERE id = 7;'], ['e1c3', 'WHERE atelier_id = 3;']"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Seule la ligne dont l’identifiant<br>vaut 4 est supprimée.') && caps.includes('L’atelier Cuisine saine existe<br>toujours dans la <b>table ateliers</b>.'), 'les légendes disent la même chose');
  const mail = val('MAILS')[0];
  assert.ok(mail[4].join(' ').includes('Je ne pourrai pas venir à l’atelier Cuisine saine prévu le 19 septembre.') && mail[4].join(' ').includes('Peux-tu annuler mon inscription ?'), 'le mail de Léa Simon');
  assert.equal(base().exec("SELECT date_atelier FROM ateliers WHERE titre = 'Cuisine saine'")[0].values[0][0], '2026-09-19', 'le 19 septembre est bien la date de l’atelier');
});

test('moment 3 : il y a deux Nathan ; WHERE id = 10 supprime Nathan Dupont, que ne désigne aucune autre table ; le prénom seul désignerait aussi Nathan Petit', () => {
  const db = base(), CLI = val('CLI');
  assert.deepEqual(db.exec("SELECT id, nom FROM clients WHERE prenom = 'Nathan' ORDER BY id")[0].values, [[4, 'Petit'], [10, 'Dupont']], 'deux Nathan');
  const opts = val('PICKS')[2].options.map(o => sp(o.label));
  assert.deepEqual(opts, ["WHERE prenom = 'Nathan'", 'WHERE id = 4', 'WHERE id = 10']);
  /* Ce que chaque condition désigne. */
  const designe = fin => db.exec(`SELECT id FROM clients ${fin.replace(/;$/, '')} ORDER BY id`)[0].values.flat();
  assert.deepEqual(designe(opts[0]), [4, 10], 'le prénom désigne les deux Nathan');
  assert.deepEqual(designe(opts[1]), [4], 'l’identifiant 4 est celui de Nathan Petit');
  assert.deepEqual(designe(opts[2]), [10], 'l’identifiant 10 est celui de Nathan Dupont');
  assert.equal(CLI.find(c => c[0] === 10)[2], 'Dupont');
  /* Les tables qui font référence à la table clients : aucune ne désigne Nathan Dupont, plusieurs désignent Nathan Petit. */
  const refs = db.exec("SELECT DISTINCT m.name FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table' AND f.\"table\" = 'clients' ORDER BY m.name")[0].values.flat();
  assert.deepEqual(refs, ['cartes', 'commandes', 'fidelite', 'inscriptions'], 'quatre tables font référence à la table clients');
  assert.deepEqual(val('REFS').map(r => r[3]).sort(), refs, 'la page montre ces quatre tables');
  for (const t of refs) assert.equal(db.exec(`SELECT COUNT(*) FROM ${t} WHERE client_id = 10`)[0].values[0][0], 0, `${t} : aucune ligne ne désigne Nathan Dupont`);
  assert.ok(db.exec('SELECT COUNT(*) FROM inscriptions WHERE client_id = 4')[0].values[0][0] > 0, 'Nathan Petit, lui, est désigné');
  /* La suppression réussit : la clé étrangère n’a rien à refuser. */
  const d = base(); d.run('DELETE FROM clients WHERE id = 10;');
  assert.equal(d.getRowsModified(), 1); assert.equal(count(d, 'clients'), 9);
  assert.equal(d.exec("SELECT COUNT(*) FROM clients WHERE prenom = 'Nathan'")[0].values[0][0], 1, 'Nathan Petit reste');
  /* Le prénom seul ne serait pas exécutable ici : Nathan Petit est désigné par d’autres tables, d’où « désignés » plutôt que « supprimés » dans l’aperçu. */
  assert.throws(() => base().run("DELETE FROM clients WHERE prenom = 'Nathan';"), /FOREIGN KEY constraint failed/);
  for (const t of ["out('o-2', 'ok', 'Requête exécutée', '1 ligne supprimée.')", "out('pvo3-1', 'warn', 'Deux clients désignés', 'Nathan Petit et Nathan Dupont.')",
    "out('pvo3-2', 'warn', 'Un seul client désigné', 'Nathan Petit, et non Nathan Dupont.')", "['e2c', '{kw2|WHERE} {cw2|id = 10};']", '<i>✓ 0 ligne</i>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Cette table contient deux Nathan :<br>le prénom seul ne suffit pas.') && caps.includes('Aucune autre table<br>ne fait référence à Nathan Dupont.'), 'les légendes disent la même chose');
  const mail = val('MAILS')[1];
  assert.equal(mail[3], db.exec("SELECT email FROM clients WHERE id = 10")[0].values[0][0], 'l’adresse du mail est celle de la table clients');
  assert.ok(mail[4].join(' ').includes('Peux-tu supprimer mon compte ?'));
});

test('moment 4 : les deux inscriptions d’Hugo Laurent ont le client 6 ; WHERE client_id = 6 les supprime ensemble ; id = 6 en laisserait une, client_id > 6 viserait d’autres clients', () => {
  const opts = val('PICKS')[3].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['WHERE id = 6', 'WHERE client_id = 6', 'WHERE client_id > 6']);
  const db = apresDeux();
  assert.deepEqual(db.exec("SELECT i.id, a.titre FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id WHERE c.prenom = 'Hugo' AND c.nom = 'Laurent' ORDER BY i.id")[0].values,
    [[6, 'Méditation'], [9, 'Yoga du matin']], 'Hugo Laurent a deux inscriptions, d’identifiants 6 et 9');
  /* Le SELECT qui lit d’abord les lignes a le même WHERE, et ne modifie rien. */
  assert.deepEqual(db.exec('SELECT id, client_id FROM inscriptions WHERE client_id = 6 ORDER BY id')[0].values, [[6, 6], [9, 6]], 'les deux lignes ont le même identifiant de client');
  assert.equal(count(db, 'inscriptions'), 10, 'lire ne supprime rien');
  const jouer = fin => { const d = apresDeux(); d.run(`DELETE FROM inscriptions ${fin};`); return [d.getRowsModified(), ids(d)]; };
  const reste = val('REST');
  assert.deepEqual(jouer(opts[1]), [2, reste], 'deux lignes supprimées par une seule requête : il en reste huit');
  assert.deepEqual(jouer(opts[0]), [1, [1, 2, 3, 5, 7, 8, 9, 10, 11]], 'l’identifiant 6 est celui d’une seule inscription : la seconde resterait');
  assert.deepEqual(jouer(opts[2]), [2, [1, 2, 3, 5, 6, 7, 8, 9]], 'client_id > 6 : les inscriptions de Gabriel Michel et d’Inès Lefebvre (celle de Léa Simon est déjà supprimée)');
  assert.deepEqual(db.exec("SELECT c.prenom || ' ' || c.nom FROM inscriptions i JOIN clients c ON c.id = i.client_id WHERE i.client_id > 6 ORDER BY i.id")[0].values.flat(), ['Gabriel Michel', 'Inès Lefebvre']);
  for (const t of ["out('o-3', 'ok', 'Requête exécutée', '2 lignes supprimées.')", "out('o-sel', 'ok', 'Requête exécutée', '2 lignes trouvées.')", "out('pvo4-1', 'warn', 'Exécutée sans erreur', '1 ligne supprimée.')",
    "out('pvo4-2', 'warn', 'Exécutée sans erreur', '2 lignes supprimées.')", "['e3c', '{kw3|WHERE} {cw3|client_id = 6};']", "['es3', '{kws|WHERE} {cws|client_id = 6};']"])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Dans les deux lignes, l’identifiant<br>du client est 6.') && caps.includes('Deux lignes sont supprimées<br>par une seule requête.'), 'les légendes disent la même chose');
  /* Comme au chapitre 8, on lit d’abord les lignes concernées : le SELECT passe avant la suppression, qui n’est exécutée qu’après la relecture. */
  assert.ok(caps.findIndex(c => c.includes('un <code>SELECT</code>')) < caps.indexOf('Deux lignes sont supprimées<br>par une seule requête.'), 'la relecture, puis la suppression');
  const mail = val('MAILS')[2];
  assert.ok(mail[4].join(' ').includes('Hugo Laurent déménage') && mail[4].join(' ').includes('Peux-tu supprimer toutes ses inscriptions ?'), 'le mail de l’accueil NutriBoost');
});

test('moment 5 : sans WHERE, la requête est exécutée sans erreur et les huit inscriptions restantes disparaissent ; la table existe encore, vide ; DROP TABLE la supprime elle-même', () => {
  const d = apresDeux(); d.run('DELETE FROM inscriptions WHERE client_id = 6;');
  assert.deepEqual(ids(d), val('REST'), 'les huit lignes que la page montre');
  d.run('DELETE FROM inscriptions;');   // aucune erreur
  assert.equal(d.getRowsModified(), 8, 'toutes les lignes sont supprimées');
  assert.equal(count(d, 'inscriptions'), 0);
  assert.deepEqual(d.exec("SELECT name FROM pragma_table_info('inscriptions')")[0].values.flat(), ['id', 'client_id', 'atelier_id', 'date_inscription'], 'la table existe encore, avec ses quatre colonnes');
  assert.ok(tables(d).includes('inscriptions'));
  d.run('DROP TABLE inscriptions;');
  assert.ok(!tables(d).includes('inscriptions'), 'DROP TABLE supprime la table elle-même (chapitre 6)');
  assert.throws(() => d.exec('SELECT * FROM inscriptions;'), /no such table: inscriptions/);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('La requête est exécutée<br>sans la moindre erreur.') && caps.includes('La table existe toujours,<br>mais elle est vide.'), 'les légendes disent la même chose');
  assert.ok(caps.includes('Imagine que tu oublies le <code>WHERE</code>.'), 'l’oubli du WHERE est imaginé : rien n’est supprimé pour de bon');
  assert.ok(caps.includes('Au chapitre 6, c’est <code>DROP TABLE</code><br>qui supprimait la table elle-même.'));
  assert.ok(page.includes("out('o-8', 'warn', 'Requête exécutée', '8 lignes supprimées.')") && page.includes("out('o-ex', 'ok', 'Requête exécutée', 'Aucune erreur.')"), 'la page montre les deux résultats');
  assert.equal(val('PICKS')[4].need, val('REST').length, 'l’élève touche les huit lignes');
});

test('moment 6 : chaque demande est rangée sous le bon mot-clé, et la base fait ce que le mot-clé annonce', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['INSERT INTO', 'UPDATE', 'DELETE FROM']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['de', 'up', 'in', 'up', 'de', 'in']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [2, 2, 2], 'deux demandes par mot-clé');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]), 'les demandes à ranger sont celles des correcteurs');
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique pourquoi pas les autres mots-clés`);
  /* Ce que la base fait de chaque demande (le nombre de lignes de la table concernée). */
  const effet = (table, sql) => { const db = base(), avant = count(db, table); try { db.run(sql); } catch (e) { return {refuse: e.message, delta: count(db, table) - avant}; } return {delta: count(db, table) - avant, modifiees: db.getRowsModified()}; };
  assert.deepEqual(effet('inscriptions', 'DELETE FROM inscriptions WHERE client_id = 6;'), {delta: -2, modifiees: 2}, 'une inscription annulée : DELETE FROM');
  assert.deepEqual(effet('ateliers', "UPDATE ateliers SET date_atelier = '2026-09-19' WHERE titre = 'Pilates';"), {delta: 0, modifiees: 1}, 'l’atelier décalé : UPDATE');
  assert.deepEqual(effet('inscriptions', "INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (8, 1, '2026-09-20');"), {delta: 1, modifiees: 1}, 'une nouvelle inscription : INSERT INTO');
  assert.deepEqual(effet('cartes', 'UPDATE cartes SET seances_restantes = seances_restantes - 8 WHERE client_id = 4;'),
    {refuse: 'CHECK constraint failed: seances_restantes >= 0', delta: 0}, 'les séances retirées : UPDATE (ici refusé par la règle CHECK du chapitre 8), jamais une ligne supprimée');
  assert.deepEqual(effet('clients', 'DELETE FROM clients WHERE id = 10;'), {delta: -1, modifiees: 1}, 'le compte fermé : DELETE FROM');
  assert.deepEqual(effet('coachs', "INSERT INTO coachs (prenom, nom, email) VALUES ('Alix', 'Garnier', 'alix@mail.fr');"), {delta: 1, modifiees: 1}, 'un nouveau coach : INSERT INTO');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Pour changer le contenu d’une table,<br>il existe trois mots-clés.') && caps.includes('Retirer des séances ne supprime pas<br>de ligne : c’est un <code>UPDATE</code>.'), 'les légendes disent la même chose');
  assert.ok(page.includes('<span class="emo">📬</span>6 demandes à ranger'), 'six demandes');
});

test('les trois mails : Léa Simon, Nathan Dupont, puis l’accueil ; l’app s’arrête sur chacun jusqu’au toucher', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), mail = val('[MAIL1, MAIL2, MAIL3]');
  assert.deepEqual(mails.map(m => [m[0][0], m[0][1], m[3]]), [['Léa', 'Simon', 'lea@mail.fr'], ['Nathan', 'Dupont', 'nathan.dupont@mail.fr'], ['L’accueil', 'NutriBoost', 'accueil@nutriboost.fr']]);
  const db = base();
  assert.equal(mails[0][3], db.exec("SELECT email FROM clients WHERE prenom = 'Léa' AND nom = 'Simon'")[0].values[0][0], 'l’adresse de Léa Simon est celle de la table clients');
  assert.deepEqual(mails.map(m => m[5]), ['Léa', 'Nathan', 'L’accueil NutriBoost']);
  assert.equal(opens.length, 3);
  opens.forEach((o, n) => { assert.ok(o.at > mail[n] && o.at < mail[n] + 4.8, `mail ${n + 1} : l’app s’arrête pendant le mail`); assert.equal(o.sel, '#ml' + (n + 1)); });
  assert.ok(mail[0] < picks[0].at && mail[1] > picks[1].at && mail[1] < picks[2].at && mail[2] > picks[2].at && mail[2] < picks[3].at, 'mail 1 avant le moment 1, mail 2 entre les moments 2 et 3, mail 3 entre les moments 3 et 4');
  assert.equal(opens.map(o => o.label).join('|'), 'Ouvrir le message de Léa Simon|Ouvrir le message de Nathan Dupont|Ouvrir le mail de L’accueil NutriBoost', 'deux clients écrivent par SMS, l’accueil par mail');
  assert.deepEqual(opens.map(o => o.prompt), ['Touche le message pour l’ouvrir.', 'Touche le message pour l’ouvrir.', 'Touche le mail pour l’ouvrir.']);
  /* Aucun mail n’est paresseux : deux paragraphes au plus, pour que le mail se referme après sa lecture. */
  assert.ok(mails.every(m => m[4].length === 2), 'une phrase de contexte, une demande');
});

/* ---------- Propre au chapitre 9 : la suite du chapitre 8, l’annonce de la leçon ON DELETE ---------- */
test('chapitre 9 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 9 : DELETE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 9</div>')
    && page.includes('<span>D</span><span>E</span><span>L</span><span>E</span><span>T</span><span>E</span>') && page.includes('<div class="abs sub">Supprimer des lignes</div>')
    && page.includes('Des lignes ne servent plus&nbsp;:<br>à toi de les supprimer de la base.'), 'écran titre : « Projet · Chapitre 9 », DELETE, « Supprimer des lignes »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 8');
  assert.equal(caps[1], 'Au chapitre 8, tu as modifié<br>des lignes avec <code>UPDATE</code>.', 'le chapitre précédent');
  /* La fin du chapitre 8 annonce « DELETE » : c’est ce chapitre. */
  const update = fs.readFileSync(path.join(root, 'assets/anim/projet-update.html'), 'utf8');
  assert.ok(update.includes('à supprimer des lignes avec <code>DELETE</code>.') && update.includes('Prochaine leçon · DELETE</span>'), 'le chapitre 8 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : ON DELETE, pour une ligne que d’autres tables référencent. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à supprimer une ligne que d’autres<br>tables référencent, avec <code>ON DELETE</code>.') && page.includes('Prochaine leçon · ON DELETE</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 28) + 1].titre, 'ON DELETE');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
  assert.ok(base().exec("SELECT COUNT(*) FROM inscriptions i JOIN clients c ON c.id = i.client_id WHERE c.id = 4")[0].values[0][0] > 0, 'une ligne que d’autres tables référencent existe : Nathan Petit');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🗑️', 'DELETE FROM supprime des lignes entières.', 'WHERE sélectionne les lignes à supprimer ; les autres lignes ne changent pas.'],
    ['⚠️', 'Sans WHERE, toutes les lignes de la table sont supprimées.', 'La table existe encore, mais elle est vide. Lis d’abord les lignes avec un SELECT.'],
    ['🎯', 'La condition peut désigner une ou plusieurs lignes.', 'Un identifiant désigne une seule ligne ; un prénom ou un identifiant de client peut en désigner plusieurs.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:28,'), html.indexOf('guide({ id:68,'));
  const idees = [...fiche.matchAll(/\["(🗑️|⚠️|🎯)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de sous-requête dans le WHERE, de points de fidélité ni de commandes d’une seule unité ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])).join(' ');
  for (const mot of ['sous-requête', 'IN (', 'points', 'quantite', 'TRUNCATE', 'RETURNING', 'COUNT']) assert.ok(!caps.includes(mot) && !page.includes(`>${mot}`), `la vidéo n’enseigne pas ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  assert.ok(!html.slice(html.indexOf('guide({ id:28,'), html.indexOf('guide({ id:68,')).includes('sit:{'), 'plus de cours texte DELETE dans la fiche');
});

test('zones à toucher : les lignes de la table inscriptions font 62 px (onze lignes sous la requête et son résultat) ; l’indice du moment 1 surligne la ligne de Léa Simon, en typographie française', () => {
  const h = +page.match(/#tb \.r\{height:(\d+)px/)[1];
  assert.ok(h >= 62, `lignes de la table inscriptions : ${h} px`);
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
});
