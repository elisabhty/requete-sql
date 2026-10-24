/* Projet NutriBoost, chapitre 10 (leçon 68 « ON DELETE ») : la vidéo interactive assets/anim/projet-ondelete.html, testée aussi dans lesson-video.test.mjs.
   Deux mails : Inès Lefebvre demande la suppression de son compte (la base la refuse tant qu’une inscription la désigne), l’accueil demande de créer la
   table des avis. Les trois règles ON DELETE (CASCADE, SET NULL, RESTRICT) sont montrées sur cette table, dont la colonne du client accepte NULL.
   Seul cours du module « Contraintes et intégrité » : il remplace l’ancien cours ON DELETE (la table satisfaction, les paniers) et le cours
   « Les contraintes en action » (67, supprimé). Leçon seule : ni cours texte, ni exercice.
   Ce que la vidéo montre (FOREIGN KEY constraint failed, les trois règles, NOT NULL qui s’y oppose, ON DELETE écrit dans le DELETE, NULL que la clé
   étrangère ne vérifie pas) est ici rejoué dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-ondelete.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l68 = lessons.find(l => l.id === 68);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/[  ]/g, ' ');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo, telle que le chapitre 9 la laisse : les quatre tables de la boutique, telles que l’app les crée (SCHEMA_SQL : clients,
   produits, commandes 16, fidelite) et les quatre tables des ateliers (coachs 4, ateliers 5, inscriptions, cartes 3) ; Nathan Dupont, l’inscription de
   Léa Simon et les deux d’Hugo Laurent ont été supprimés : 9 clients, 8 inscriptions. Huit tables. */
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
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(5,3,1,'2026-09-05'),(7,1,4,'2026-09-07'),
      (8,2,3,'2026-09-08'),(10,8,5,'2026-09-09'),(11,9,5,'2026-09-09');
    INSERT INTO cartes VALUES (1,1,12),(2,4,7),(3,6,20);
    DELETE FROM clients WHERE id = 10;`);
  return db;
}
/* La requête CREATE TABLE telle que la page l’affiche (lignes e2a à e2k), sans le balisage {clé|texte} ; NOT NULL et la règle du client au choix. */
const lignes = Object.fromEntries([...page.matchAll(/\['e2([a-k])', '((?:[^'\\]|\\.)*)'\]/g)].map(m => [m[1], m[2]]));
assert.deepEqual(Object.keys(lignes), 'abcdefghijk'.split(''), 'les onze lignes de la requête');
const creation = ({notNull = false, regle = 'ON DELETE SET NULL'} = {}) => Object.keys(lignes).sort()
  .map(k => lignes[k].replace(/\{\w+\|([^}]*)\}/g, '$1').replace('<span class="sg" id="smn"> NOT NULL</span>', notNull ? ' NOT NULL' : '').replace('ON DELETE SET NULL', regle)).join('\n');
/* La base avec la table avis, créée puis remplie par les sept avis du papier (dont celui d’Inès Lefebvre). */
function avec(options) {
  const db = base();
  db.run(creation(options));
  db.run(`INSERT INTO avis (id, client_id, atelier_id, note) VALUES ${val('AVIS').map(r => `(${r[0]}, ${r[1]}, ${r[3]}, ${r[5]})`).join(', ')};`);
  return db;
}
const HUIT = ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits'];   // par ordre alphabétique
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const avis = db => db.exec('SELECT id, client_id, atelier_id, note FROM avis ORDER BY id')[0].values;
/* Le compte d’Inès Lefebvre : d’abord son inscription (chapitre 5 de la vidéo), puis la ligne de la table clients. */
const supprimerInscription = db => db.run('DELETE FROM inscriptions WHERE client_id = 9;');
const supprimerCompte = db => db.run('DELETE FROM clients WHERE id = 9;');

test('ON DELETE : seul cours du module « Contraintes et intégrité », juste après DELETE et juste avant Transactions ; la leçon 67 n’existe plus', () => {
  const m = modules.find(x => x.titre === 'Contraintes et intégrité');
  assert.deepEqual([...m.lessons.map(l => l.id)], [68], 'ON DELETE est seul dans son module');
  assert.equal(m.sous, 'Les règles que les données doivent respecter', 'le sous-titre du module ne fait pas agir la base');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(68), liste.indexOf(28) + 1, 'ON DELETE vient juste après DELETE');
  assert.equal(liste[liste.indexOf(68) + 1], 62, 'Transactions vient juste après');
  assert.equal(lessons.find(l => l.id === 62).titre, 'Transactions');
  assert.equal(l68.titre, 'ON DELETE');
  assert.equal(l68.résumé, 'Décider du sort des lignes liées');
  /* Le cours « Les contraintes en action » est supprimé, avec son quiz et ses mots-clés de recherche. */
  assert.ok(!liste.includes(67) && !html.includes('guide({ id:67,') && !/\n 67:\[/.test(html) && !/\n  67:'/.test(html), 'plus de leçon 67');
  assert.equal(vm.runInContext('QCM', ctx)[67], undefined);
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  68:'([^']+)',/)[1];
  assert.ok(['on delete', 'cascade', 'set null', 'restrict', 'cle etrangere', 'foreign key', 'constraint failed', 'not null', 'avis', 'create table', 'syntax error', 'supprimer lignes liees'].every(m => mots.includes(m)),
    'trouvé par la recherche : ON DELETE, les trois règles, la clé étrangère, NOT NULL, la table avis…');
  assert.ok(l68.leconSeule && l68.video && !l68.situation && !l68.consigne && !l68.solution && !l68.petitDefi && !l68.learningCheck && !l68.testeVariants && !l68.anatomie, 'la vidéo est le cours');
  assert.equal(l68.video.moments, 6); assert.equal(l68.video.seuil, 4);
  assert.equal(l68.video.anim, 'assets/anim/projet-ondelete.html?app&embed');
  const recap = l68.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🛑', '🔀', '📍'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 211.3);
  assert.ok(page.includes('notesAt: 211.3,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 218.5);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant 0,4 s après la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Deux demandes', 'Une suppression refusée', 'Trois sorts possibles', 'Écrire la règle', 'Le compte supprimé', 'Quelle règle choisir ?', 'À retenir']);
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
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'tap', 'pick', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, true, false], 'ON DELETE SET NULL');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, false, true], 'la suppression du client est refusée');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [true, false, false], 'une erreur de syntaxe');
  assert.equal(picks[0].need, 1, 'une seule ligne à toucher : l’inscription qui désigne Inès Lefebvre');
  assert.equal(picks[1].need, 1, 'une seule case à toucher : celle du client');
  assert.equal(picks[5].options.length, 6, 'six situations à ranger');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('la page montre la base du chapitre 9 : huit tables, neuf clients, huit inscriptions ; la neuvième table, avis, est à créer et reçoit sept avis', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), HUIT, 'huit tables avant la création de la table avis');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes'], 'la boutique d’abord, puis les tables des ateliers dans l’ordre du chapitre 5');
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  assert.equal(count(db, 'clients'), 9); assert.equal(count(db, 'inscriptions'), 8);
  assert.deepEqual(val('INSCR'), db.exec("SELECT i.id, i.client_id, c.prenom || ' ' || c.nom, i.atelier_id, a.titre, i.date_inscription FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id ORDER BY i.id")[0].values, 'la table inscriptions de la page est celle de la base');
  assert.deepEqual(val('CLI'), db.exec('SELECT id, prenom, nom, ville FROM clients ORDER BY id')[0].values, 'la table clients de la page est celle de la base');
  assert.ok(page.includes('<span>8 tables</span>') && page.includes('2 demandes à traiter'), '8 tables, 2 demandes');
  /* Les sept avis : chacun désigne un client et un atelier qui existent, avec le bon nom et le bon titre. */
  const AVIS = val('AVIS');
  assert.equal(AVIS.length, 7, 'sept avis sur papier');
  const d = avec();
  assert.deepEqual(tables(d), [...HUIT, 'avis'].sort(), 'neuf tables une fois la table avis créée');
  assert.deepEqual(AVIS.map(r => [r[0], r[2], r[4]]), d.exec("SELECT v.id, c.prenom || ' ' || c.nom, a.titre FROM avis v JOIN clients c ON c.id = v.client_id JOIN ateliers a ON a.id = v.atelier_id ORDER BY v.id")[0].values, 'le nom et l’atelier de chaque avis');
  assert.deepEqual(AVIS.map(r => r[5]), [5, 4, 5, 4, 4, 4, 5]); assert.ok(AVIS.every(r => r[5] >= 1 && r[5] <= 5), 'des notes de 1 à 5');
  assert.equal(AVIS[6][2], 'Inès Lefebvre', 'le dernier avis est celui d’Inès Lefebvre');
  assert.ok(page.includes('<span class="n0">8 lignes</span>') || /8 lignes/.test(page), 'la table inscriptions compte 8 lignes');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[3], 'La première concerne un compte,<br>la seconde une nouvelle table.');
});

test('moment 1 : supprimer le compte d’Inès Lefebvre est refusé (FOREIGN KEY constraint failed) ; une seule table la désigne, la table inscriptions, par l’inscription 11', () => {
  const db = base(), INSCR = val('INSCR'), WHY1 = val('WHY1');
  assert.throws(() => db.run('DELETE FROM clients WHERE id = 9;'), /FOREIGN KEY constraint failed/);
  assert.equal(count(db, 'clients'), 9, 'une suppression refusée ne supprime rien');
  assert.equal(db.exec("SELECT prenom || ' ' || nom FROM clients WHERE id = 9")[0].values[0][0], 'Inès Lefebvre');
  /* Les tables qui font référence à la table clients, et ce qu’elles désignent pour Inès Lefebvre. */
  const refs = db.exec("SELECT DISTINCT m.name FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table' AND f.\"table\" = 'clients' ORDER BY m.name")[0].values.flat();
  assert.deepEqual(refs, ['cartes', 'commandes', 'fidelite', 'inscriptions']);
  const REFS = val('REFS');
  assert.deepEqual(REFS.map(r => r[3]).sort(), refs, 'la page montre ces quatre tables');
  for (const r of REFS) assert.equal(db.exec(`SELECT COUNT(*) FROM ${r[3]} WHERE client_id = 9`)[0].values[0][0], r[4], `${r[3]} : ${r[4]} ligne(s) désignent Inès Lefebvre`);
  assert.deepEqual(REFS.filter(r => r[4] > 0).map(r => r[3]), ['inscriptions'], 'une seule table la désigne');
  assert.deepEqual(db.exec('SELECT id, atelier_id FROM inscriptions WHERE client_id = 9')[0].values, [[11, 5]], 'l’inscription 11, à l’atelier Yoga du matin');
  assert.deepEqual(Object.keys(WHY1).sort(), ['r1', 'r10', 'r2', 'r3', 'r5', 'r7', 'r8'], 'toutes les lignes sauf la bonne (r11) sont expliquées');
  for (const r of INSCR.filter(r => r[0] !== 11)) assert.ok(WHY1['r' + r[0]].includes(r[2]), `l’inscription ${r[0]} : la correction nomme ${r[2]}`);
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['r11'\]\};/.test(page), 'indice du moment 1 : la ligne d’Inès Lefebvre (r11) ressort');
  for (const t of ["out('o-fk', 'err', 'Requête refusée', 'FOREIGN KEY constraint failed', 'm')", "['e1c', '{kw1|WHERE} {cw1|id = 9};']"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Pourtant, la requête est refusée.') && caps.includes('La règle <code>FOREIGN KEY</code> interdit<br>de supprimer une ligne<br>encore désignée.')
    && caps.includes('Une seule table fait référence<br>à Inès Lefebvre :<br>la <b>table inscriptions</b>.'), 'les légendes disent la même chose');
  const mail = val('MAILS')[0];
  assert.ok(mail[4].join(' ').includes('Je ne reviendrai plus aux ateliers.') && mail[4].join(' ').includes('Peux-tu supprimer mon compte ?'), 'le mail d’Inès Lefebvre');
});

test('moments 2 et 3 : CASCADE supprime l’avis avec le client, SET NULL le garde en mettant NULL dans la case du client, RESTRICT refuse la suppression — comme sans règle', () => {
  const regles = {'ON DELETE CASCADE': 'cascade', 'ON DELETE SET NULL': 'setnull', 'ON DELETE RESTRICT': 'restrict', '': 'sans'};
  const avant = avec({}).exec('SELECT id, client_id, atelier_id, note FROM avis ORDER BY id')[0].values;
  assert.deepEqual(avant[6], [7, 9, 5, 5], 'l’avis d’Inès Lefebvre : client 9, atelier 5, note 5');
  const jouer = regle => { const db = avec({regle}); supprimerInscription(db); try { supprimerCompte(db); } catch (e) { return {refuse: e.message, clients: count(db, 'clients'), avis: avis(db)}; } return {clients: count(db, 'clients'), avis: avis(db)}; };
  /* CASCADE : l’avis disparaît avec le client, les six autres ne bougent pas. */
  assert.deepEqual(jouer('ON DELETE CASCADE'), {clients: 8, avis: avant.slice(0, 6)});
  /* SET NULL : l’avis reste, seule la case du client devient NULL (l’atelier et la note ne changent pas). */
  assert.deepEqual(jouer('ON DELETE SET NULL'), {clients: 8, avis: [...avant.slice(0, 6), [7, null, 5, 5]]});
  /* RESTRICT, ou pas de règle : la suppression du client est refusée, et rien ne change. */
  assert.deepEqual(jouer('ON DELETE RESTRICT'), {refuse: 'FOREIGN KEY constraint failed', clients: 9, avis: avant});
  assert.deepEqual(jouer(''), {refuse: 'FOREIGN KEY constraint failed', clients: 9, avis: avant}, 'sans règle, c’est déjà ce qui se passe');
  /* Les trois règles sont lues telles que la base les connaît. */
  const lire = regle => avec({regle}).exec(`SELECT "from", on_delete FROM pragma_foreign_key_list('avis') ORDER BY "from"`)[0].values;
  assert.deepEqual(lire('ON DELETE SET NULL'), [['atelier_id', 'CASCADE'], ['client_id', 'SET NULL']]);
  assert.deepEqual(lire('ON DELETE CASCADE'), [['atelier_id', 'CASCADE'], ['client_id', 'CASCADE']]);
  assert.deepEqual(lire('ON DELETE RESTRICT'), [['atelier_id', 'CASCADE'], ['client_id', 'RESTRICT']]);
  assert.deepEqual(lire(''), [['atelier_id', 'CASCADE'], ['client_id', 'NO ACTION']], 'sans règle : NO ACTION, qui refuse aussi');
  /* Moment 2 : la case qui devient NULL est celle du client ; les autres cases sont expliquées. */
  const WHY2 = val('WHY2'), picks = val('PICKS');
  assert.deepEqual(Object.keys(WHY2).sort(), ['c0', 'c2', 'c3'], 'toutes les cases sauf celle du client (c1)');
  assert.ok(/if \(i === 1\) return \{text: '[^']+', keys: \['c1'\]\};/.test(page), 'indice du moment 2 : la case du client (c1) ressort');
  assert.ok(picks[1].prompt.includes('<code>SET NULL</code>'), 'le moment 2 porte sur SET NULL');
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Avec <code>CASCADE</code>, l’avis<br>est supprimé avec le client.', 'Avec <code>SET NULL</code>, l’avis reste,<br>mais ne désigne plus personne.', 'Seule la case qui désigne le client<br>devient <code>NULL</code>.',
    'Avec <code>RESTRICT</code>, la suppression<br>du client est refusée.', 'Sans règle, c’est déjà<br>ce qui se passe.']) assert.ok(caps.includes(c), `légende : ${c}`);
  /* Moment 3 : la règle qui conserve les avis. */
  assert.deepEqual(picks[2].options.map(o => sp(o.label)), ['ON DELETE CASCADE', 'ON DELETE SET NULL', 'ON DELETE RESTRICT']);
  for (const t of ["out('pvo3-1', 'warn', 'Avis supprimés', 'Ils disparaissent avec le client.')", "out('pvo3-2', 'err', 'Suppression refusée', 'Le client a encore des avis.')"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  assert.ok(Object.values(regles).length === 4);
});

test('écrire la règle : la requête CREATE TABLE affichée crée la table avis ; la règle du client est SET NULL, celle de l’atelier CASCADE ; SQLite ne permet plus de la modifier ensuite', () => {
  const db = base();
  db.run(creation());
  assert.deepEqual(db.exec(`SELECT name, "notnull", pk FROM pragma_table_info('avis')`)[0].values, [['id', 0, 1], ['client_id', 0, 0], ['atelier_id', 0, 0], ['note', 0, 0]], 'la colonne du client accepte NULL');
  assert.deepEqual(db.exec(`SELECT "from", "table", "to", on_delete FROM pragma_foreign_key_list('avis') ORDER BY "from"`)[0].values,
    [['atelier_id', 'ateliers', 'id', 'CASCADE'], ['client_id', 'clients', 'id', 'SET NULL']]);
  /* Un avis n’a aucun sens sans son atelier : il disparaît avec lui (CASCADE). */
  const d = avec();
  d.run("INSERT INTO ateliers VALUES (6, 'Stretching', '2026-11-07', 1, 12); INSERT INTO avis (client_id, atelier_id, note) VALUES (1, 6, 3);");
  assert.equal(count(d, 'avis'), 8);
  d.run('DELETE FROM ateliers WHERE id = 6;');
  assert.equal(count(d, 'avis'), 7, 'l’avis de l’atelier supprimé disparaît avec lui');
  /* Les règles se déclarent dans CREATE TABLE : aucune de ces modifications n’existe dans SQLite. */
  for (const q of ['ALTER TABLE avis DROP CONSTRAINT fk_client;', 'ALTER TABLE avis ADD CONSTRAINT fk FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;', 'ALTER TABLE avis ALTER COLUMN client_id SET NOT NULL;'])
    assert.throws(() => d.run(q), /syntax error/, q);
  assert.deepEqual(d.exec(`SELECT on_delete FROM pragma_foreign_key_list('avis') WHERE "from" = 'client_id'`)[0].values, [['SET NULL']], 'la règle n’a pas changé');
  for (const t of ["out('o-ct', 'ok', 'Requête exécutée', 'Table avis créée.')", "['e2b', '{kt2|CREATE TABLE} {tn2|avis} (']", "['e2f', '    {od1|ON DELETE SET NULL},']", "['e2i', '    {od2|ON DELETE CASCADE},']"])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Un avis n’a aucun sens sans atelier :<br>avec <code>CASCADE</code>, il disparaît<br>avec son atelier.', 'La règle se déclare<br>dans <code>CREATE TABLE</code>,<br>à côté de la clé étrangère.',
    'Avec SQLite, elle ne peut plus<br>être modifiée ensuite.', 'Les sept avis sont ensuite ajoutés,<br>dont celui d’Inès Lefebvre.']) assert.ok(caps.includes(c), `légende : ${c}`);
  const mail = val('MAILS')[1];
  assert.ok(mail[4].join(' ').includes('Les clients ont déjà donné sept avis sur papier.') && mail[4].join(' ').includes('Peux-tu créer la table des avis ?'), 'le mail de l’accueil NutriBoost');
});

test('moment 4 : avec NOT NULL sur la colonne du client, SET NULL ne peut plus détacher les avis, et la suppression du client est refusée', () => {
  const db = avec({notNull: true});
  assert.deepEqual(db.exec(`SELECT "notnull" FROM pragma_table_info('avis') WHERE name = 'client_id'`)[0].values, [[1]], 'la colonne du client est obligatoire');
  supprimerInscription(db);
  assert.throws(() => supprimerCompte(db), /NOT NULL constraint failed: avis\.client_id/);
  assert.equal(count(db, 'clients'), 9, 'le client est toujours là');
  assert.equal(avis(db).length, 7, 'aucun avis n’est supprimé');
  assert.ok(avis(db).every(r => r[1] !== null), 'aucun avis n’est détaché');
  const picks = val('PICKS');
  assert.deepEqual(picks[3].options.map(o => o.label), ['Les avis restent, sans client', 'Les avis sont supprimés avec le client', 'La suppression du client est refusée']);
  assert.ok(page.includes("e += out('o-nn', 'err', 'Suppression du client refusée', 'NOT NULL constraint failed:<br>avis.client_id', 'm', true);") && page.includes('<span class="sg" id="smn"> NOT NULL</span>'), 'la page montre NOT NULL et le message de la base');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Pour détacher les avis, la colonne<br>du client doit accepter <code>NULL</code>.') && caps.includes('Avec <code>NOT NULL</code>, les avis<br>ne peuvent pas devenir <code>NULL</code> :<br>la suppression est refusée.'), 'les légendes disent la même chose');
  /* La même colonne dans la table inscriptions est NOT NULL depuis le chapitre 4 : SET NULL n’y serait pas possible non plus (d’où la table avis). */
  assert.deepEqual(base().exec(`SELECT "notnull" FROM pragma_table_info('inscriptions') WHERE name = 'client_id'`)[0].values, [[1]]);
});

test('moment 5 : ON DELETE écrit à la fin du DELETE donne une erreur de syntaxe ; le DELETE simple supprime le compte, l’avis d’Inès Lefebvre reste avec un client NULL, que la clé étrangère ne vérifie pas', () => {
  const db = avec();
  supprimerInscription(db);   // comme au chapitre 9
  assert.equal(db.getRowsModified(), 1);
  assert.throws(() => db.run('DELETE FROM clients WHERE id = 9 ON DELETE SET NULL;'), /near "ON": syntax error/);
  assert.equal(count(db, 'clients'), 9, 'rien n’est supprimé : ni le compte');
  assert.equal(count(db, 'avis'), 7, 'ni les avis');
  assert.deepEqual(avis(db)[6], [7, 9, 5, 5]);
  supprimerCompte(db);   // le DELETE simple
  assert.equal(db.getRowsModified(), 1); assert.equal(count(db, 'clients'), 8);
  assert.deepEqual(avis(db)[6], [7, null, 5, 5], 'l’avis reste, son client vaut NULL');
  assert.equal(count(db, 'avis'), 7);
  assert.deepEqual(db.exec('PRAGMA foreign_key_check'), [], 'NULL ne désigne aucun client : la clé étrangère n’a rien à vérifier');
  db.run('INSERT INTO avis (client_id, atelier_id, note) VALUES (NULL, 1, 3);');   // un avis sans client est accepté
  assert.equal(count(db, 'avis'), 8);
  const picks = val('PICKS');
  assert.deepEqual(picks[4].options.map(o => sp(o.label)), ['Une erreur de syntaxe', 'Le compte est supprimé et ses avis restent', 'Le compte et ses avis sont supprimés']);
  for (const t of ["out('o-se', 'err', 'Requête refusée', 'near \"ON\": syntax error', 'm')", "out('o-4', 'ok', 'Requête exécutée', '1 ligne supprimée.')", "out('o-5', 'ok', 'Requête exécutée', '1 ligne supprimée.')",
    "['e4c', '{kw4|WHERE} {cw4|client_id = 9};']", '<span class="sg" id="sod"> ON DELETE SET NULL</span>']) assert.ok(page.includes(t), `la page montre : ${t}`);
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['<code>ON DELETE</code> n’est pas une option<br>du <code>DELETE</code> : la règle ne s’écrit<br>jamais ici.', 'Le compte se supprime<br>avec un simple <code>DELETE</code>.', 'L’avis d’Inès Lefebvre reste<br>dans la <b>table avis</b>.',
    'Son client vaut maintenant <code>NULL</code> :<br>l’avis ne désigne plus personne.', '<code>NULL</code> ne désigne aucun client :<br>la clé étrangère n’a<br>rien à vérifier.']) assert.ok(caps.includes(c), `légende : ${c}`);
  /* Dans la vidéo, l’inscription est supprimée avant le compte, comme au chapitre 9. */
  assert.ok(caps.indexOf('On supprime d’abord son inscription,<br>comme au chapitre 9.') < caps.indexOf('Le compte se supprime<br>avec un simple <code>DELETE</code>.'));
});

test('moment 6 : chaque situation est rangée sous la bonne règle ; SET NULL ne vaut que pour une colonne qui accepte NULL', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['CASCADE', 'SET NULL', 'RESTRICT']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['ca', 'sn', 're', 'ca', 'sn', 're']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [2, 2, 2], 'deux situations par règle');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]), 'les situations à ranger sont celles des correcteurs');
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique pourquoi pas les autres règles`);
  /* La colonne concernée par chaque situation : celle qui désigne le client, l’atelier ou le produit. */
  const db = avec({}), nullable = (t, c) => db.exec(`SELECT "notnull" FROM pragma_table_info('${t}') WHERE name = '${c}'`)[0].values[0][0] === 0;
  const COLONNES = [['inscriptions', 'client_id'], ['commandes', 'client_id'], ['cartes', 'client_id'], ['avis', 'atelier_id'], ['avis', 'client_id'], ['commandes', 'produit_id']];
  ITEMS.forEach((x, k) => { if (x[1] === 'sn') assert.ok(nullable(...COLONNES[k]), `${x[0]} : SET NULL, donc une colonne qui accepte NULL (${COLONNES[k].join('.')})`); });
  assert.deepEqual(COLONNES.map(c => nullable(...c)), [false, true, false, true, true, false], 'les colonnes obligatoires de la base : inscriptions.client_id, cartes.client_id, commandes.produit_id');
  assert.equal(db.exec('SELECT COUNT(*) FROM commandes WHERE client_id IS NULL')[0].values[0][0], 1, 'une commande sans client existe déjà : commande 16');
  /* Les cartes et les commandes d’un produit : la clé est obligatoire, la suppression doit être refusée tant qu’elles existent. */
  assert.throws(() => db.run('DELETE FROM clients WHERE id = 6;'), /FOREIGN KEY constraint failed/, 'Hugo Laurent a une carte (et des commandes)');
  assert.throws(() => db.run('DELETE FROM produits WHERE id = 1;'), /FOREIGN KEY constraint failed/, 'un produit commandé ne peut pas être retiré');
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['La bonne règle dépend du sens<br>de la ligne liée.', '<code>CASCADE</code> convient à une ligne liée<br>qui n’a plus de sens sans l’autre.', '<code>SET NULL</code> convient à une ligne liée<br>qui garde sa valeur sans l’autre.',
    '<code>RESTRICT</code> convient à une ligne liée<br>à traiter d’abord à la main.', 'Attention : <code>CASCADE</code> supprime<br>sans demander de confirmation.']) assert.ok(caps.includes(c), `légende : ${c}`);
});

test('les deux mails : Inès Lefebvre, puis l’accueil ; l’app s’arrête sur chacun jusqu’au toucher', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), mail = val('[MAIL1, MAIL2]');
  assert.deepEqual(mails.map(m => [m[0][0], m[0][1], m[3]]), [['Inès', 'Lefebvre', 'ines@mail.fr'], ['L’accueil', 'NutriBoost', 'accueil@nutriboost.fr']]);
  assert.deepEqual(base().exec("SELECT prenom, nom FROM clients WHERE id = 9")[0].values[0], ['Inès', 'Lefebvre'], 'Inès Lefebvre est la cliente 9');
  assert.deepEqual(mails.map(m => m[5]), ['Inès', 'L’accueil NutriBoost']);
  assert.equal(opens.length, 2);
  opens.forEach((o, n) => { assert.ok(o.at > mail[n] && o.at < mail[n] + 4.8, `mail ${n + 1} : l’app s’arrête pendant le mail`); assert.equal(o.sel, '#ml' + (n + 1)); });
  assert.ok(mail[0] < picks[0].at && mail[1] > picks[0].at && mail[1] < picks[1].at, 'mail 1 avant le moment 1, mail 2 entre les moments 1 et 2');
  assert.equal(opens.map(o => o.label).join('|'), 'Ouvrir le message d’Inès Lefebvre|Ouvrir le mail de L’accueil NutriBoost', 'élision : « d’Inès », jamais « de Inès » ; une cliente écrit par SMS, l’accueil par mail');
  assert.deepEqual(opens.map(o => o.prompt), ['Touche le message pour l’ouvrir.', 'Touche le mail pour l’ouvrir.']);
  assert.ok(mails.every(m => m[4].length === 2), 'une phrase de contexte, une demande');
  /* Le second mail arrive juste après le refus : la table avis ouvre le chapitre 3 de la vidéo. */
  assert.ok(mail[1] === val('SCH.chaps')[2].a, 'le mail de l’accueil ouvre le chapitre « Trois sorts possibles »');
});

/* ---------- Propre au chapitre 10 : la suite du chapitre 9, l’annonce de la leçon Transactions ---------- */
test('chapitre 10 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 10 : ON DELETE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 10</div>')
    && page.includes('<span>O</span><span class="sp">N</span><span>D</span><span>E</span><span>L</span><span>E</span><span>T</span><span>E</span>') && page.includes('<div class="abs sub">Le sort des lignes liées</div>')
    && page.includes('Un compte ne peut pas être supprimé&nbsp;:<br>à toi de décider du sort des lignes liées.'), 'écran titre : « Projet · Chapitre 10 », ON DELETE, « Le sort des lignes liées »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 9');
  assert.equal(caps[1], 'Au chapitre 9, tu as supprimé<br>des lignes avec <code>DELETE</code>.', 'le chapitre précédent');
  /* La fin du chapitre 9 annonce « ON DELETE » : c’est ce chapitre. */
  const del = fs.readFileSync(path.join(root, 'assets/anim/projet-delete.html'), 'utf8');
  assert.ok(del.includes('avec <code>ON DELETE</code>.') && del.includes('Prochaine leçon · ON DELETE</span>'), 'le chapitre 9 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : Transactions. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à tout valider ou tout annuler<br>avec une transaction.') && page.includes('Prochaine leçon · Transactions</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 68) + 1].titre, 'Transactions');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🛑', 'Sans règle, la suppression d’une ligne encore désignée est refusée.', 'Le message d’erreur est FOREIGN KEY constraint failed.'],
    ['🔀', 'ON DELETE choisit le sort des lignes liées.', 'CASCADE les supprime, SET NULL les détache, RESTRICT refuse la suppression.'],
    ['📍', 'La règle se déclare dans CREATE TABLE, jamais dans le DELETE.', 'Elle se place à côté de la clé étrangère : REFERENCES clients(id) ON DELETE SET NULL.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:68,'), html.indexOf('guide({ id:62,'));
  const idees = [...fiche.matchAll(/\["(🛑|🔀|📍)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
});

test('ce que la vidéo ne reprend pas des anciens cours : plus de table satisfaction ni de paniers, de DEFAULT ni de contraintes UNIQUE ou CHECK ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])).join(' ');
  for (const mot of ['satisfaction', 'panier', 'DEFAULT', 'CHECK', 'PRAGMA', 'TRIGGER']) assert.ok(!caps.includes(mot) && !page.includes(`>${mot}`), `la vidéo n’enseigne pas ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  assert.ok(!html.slice(html.indexOf('guide({ id:68,'), html.indexOf('guide({ id:62,')).includes('sit:{'), 'plus de cours texte ON DELETE dans la fiche');
});

test('zones à toucher : les lignes de la table inscriptions font 84 px et celles de la table avis 62 px (le doigt) ; les indices des deux moments « toucher » ressortent la bonne zone, en typographie française', () => {
  const h = +page.match(/#tb \.r,\.mi \.r\{height:(\d+)px/)[1], hv = +page.match(/#tav \.r\{height:(\d+)px/)[1];
  assert.ok(h >= 84, `lignes de la table inscriptions : ${h} px`);
  assert.ok(hv >= 62, `lignes de la table avis : ${hv} px`);
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
});
