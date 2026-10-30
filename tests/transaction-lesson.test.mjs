/* Projet NutriBoost, chapitre 13 (leçon 62 « Transactions ») : la vidéo interactive assets/anim/projet-transaction.html, testée aussi dans lesson-video.test.mjs.
   La trame est celle d’Elisa (25 octobre, 17 h 05, « Cours 1 — TRANSACTION : valider les modifications ensemble ») : Léa Simon reçoit son shaker
   personnalisé cassé et l’écrit elle-même, photo à l’appui ; le service client demande de retirer un shaker du stock et d’enregistrer son
   remplacement, en conservant son prénom. Sans transaction, le stock baisse mais le remplacement est refusé (le prénom manque) : la base ne
   reflète qu’une partie de l’opération. BEGIN TRANSACTION, puis COMMIT valide les deux modifications ensemble ; rejouée, l’opération échoue et
   ROLLBACK remet le stock à 30. Ce que la vidéo montre est ici rejoué dans SQLite : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte Transactions (le transfert de points de fidélité). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-transaction.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l62 = lessons.find(l => l.id === 62);

/* Les données de la page (le déroulé des légendes, les messages, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/[  ]/g, ' ');

/* Les requêtes que la page tape, telles qu’elle les écrit (gabarits Q_…) : sans le commentaire ni le balisage {repère|texte}. */
const Q = vm.createContext({});
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = .*$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_UP, Q_IN0, Q_IN, Q_BEGIN, Q_COMMIT, Q_ROLLBACK};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 12 la laisse : les tables de la boutique (SCHEMA_SQL), les quatre tables des ateliers, puis la table avis ;
   Nathan Dupont (chapitre 10) et Inès Lefebvre (chapitre 12) ne sont plus clients, son avis reste, sans compte. Neuf tables. */
function base() {
  const db = new SQL.Database();
  db.run(vm.runInContext('SCHEMA_SQL', ctx));
  /* Le chapitre 11 (MERGE, 30 octobre) : l’inventaire de l’entrepôt met à jour la Fibre Prébiotique (150) et Oméga 3 (75), et ajoute la Spiruline Bio. */
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
    DELETE FROM clients WHERE id = 9;`);
  return db;
}
/* La table que l’équipe logistique ajoute : les produits à renvoyer aux clients, avec leur quantité et leur personnalisation (le prénom à imprimer). */
const REMPLACEMENTS = `CREATE TABLE remplacements (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  produit_id INTEGER NOT NULL REFERENCES produits(id),
  quantite INTEGER NOT NULL,
  personnalisation TEXT NOT NULL
);`;
const avec = () => { const db = base(); db.run(REMPLACEMENTS); return db; };
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const stock = db => db.exec('SELECT stock FROM produits WHERE id = 8')[0].values[0][0];
const remplacements = db => (db.exec('SELECT id, client_id, produit_id, quantite, personnalisation FROM remplacements ORDER BY id')[0] || {values: []}).values;

test('Transactions : premier cours du module « Transactions », juste après ON DELETE et juste avant SAVEPOINT', () => {
  const m = modules.find(x => x.titre === 'Transactions');
  assert.deepEqual([...m.lessons.map(l => l.id)].slice(0, 2), [62, 63], 'Transactions, puis SAVEPOINT');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(62), liste.indexOf(68) + 1, 'Transactions vient juste après ON DELETE');
  assert.equal(liste[liste.indexOf(62) + 1], 63, 'SAVEPOINT vient juste après');
  assert.equal(l62.titre, 'Transactions');
  assert.equal(l62.résumé, 'Valider les modifications ensemble', 'le sous-titre de la trame d’Elisa');
});

test('recherche et leçon seule : ni texte de secours, ni exercice, ni quiz', () => {
  const mots = html.match(/\n  62:'([^']+)',/)[1];
  assert.ok(['transaction', 'begin transaction', 'start transaction', 'commit', 'rollback', 'valider', 'annuler', 'remplacement', 'stock', 'not null'].every(m => mots.includes(m)),
    'trouvé par la recherche : la transaction, ses trois commandes, le remplacement, le stock, NOT NULL…');
  assert.ok(l62.leconSeule && l62.video && !l62.situation && !l62.consigne && !l62.solution && !l62.petitDefi && !l62.learningCheck && !l62.testeVariants && !l62.anatomie, 'la vidéo est le cours');
  assert.equal(l62.video.moments, 6); assert.equal(l62.video.seuil, 4);
  assert.equal(l62.video.anim, 'assets/anim/projet-transaction.html?app&embed');
  const recap = l62.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🚦', '✅', '↩️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  assert.equal(vm.runInContext('QCM', ctx)[62], undefined, 'plus de quiz : la vidéo et ses moments valident la leçon (Elisa, 28 octobre)');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 245.25);
  assert.ok(page.includes('notesAt: 245.25,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 252.45);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant 0,4 s après la légende précédente. */
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* Les huit parties de la trame d’Elisa (25 octobre, 17 h 05), avec l’ouverture commune à tous les chapitres du projet dans la première ;
     sa partie « À retenir » est le récapitulatif, précédé du moment où l’élève range les situations (COMMIT ou ROLLBACK ?). */
  assert.deepEqual(chaps.map(c => c.label), ['Un colis abîmé', 'Deux modifications à réaliser', 'Ce qui peut mal se passer', 'Démarrer une transaction',
    'Effectuer les modifications', 'Valider avec COMMIT', 'Et si le remplacement échoue ?', 'COMMIT ou ROLLBACK ?', 'À retenir']);
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
  assert.deepEqual(picks.map(p => p.kind), ['tap', 'pick', 'pick', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [true, false, false], 'annulée, la transaction remet le stock à 30');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true], 'COMMIT enregistre les modifications');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [false, true, false], 'le remplacement a échoué : ROLLBACK');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, false, true], 'après le ROLLBACK, la demande reste à traiter');
  assert.equal(picks[0].need, 1, 'une seule case à toucher : le stock');
  assert.equal(picks[5].options.length, 6, 'six situations à ranger');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (25 octobre, 17 h 05) : sa trame, une phrase par bulle, avec ses mots', () => {
  const caps = val('CAPTIONS').map(c => c[2]);
  const dit = (...phrases) => phrases.forEach(p => assert.ok(caps.includes(p), `légende : ${p}`));
  /* 2 · Deux modifications à réaliser */
  dit('Pour traiter cette demande,<br>tu dois retirer un shaker du stock<br>et enregistrer son remplacement.', 'Ces deux modifications<br>doivent réussir ensemble.',
    'La <b>table remplacements</b> contient<br>les produits à renvoyer aux clients.', 'Chaque remplacement a sa quantité<br>et sa personnalisation.');
  /* 3 · Ce qui peut mal se passer : le stock diminue, le remplacement échoue ; l’élève clique sur « Comment éviter ça ? » */
  dit('Le stock a diminué,<br>mais aucun remplacement<br>n’a été enregistré.', 'La base de données ne reflète<br>qu’une partie de l’opération.', 'Clique sur le bouton<br>« Comment éviter ça ? ».');
  /* 4 · Démarrer une transaction */
  dit('Une transaction regroupe<br>plusieurs modifications.', 'Tu peux les valider toutes ensemble<br>ou les annuler pour retrouver<br>la situation de départ.',
    '<code>BEGIN TRANSACTION</code> démarre<br>la transaction.', 'Les modifications qui suivent<br>ne seront définitives<br>qu’après leur validation.');
  /* 6 · Valider avec COMMIT */
  dit('Les deux modifications ont réussi.', 'Utilise <code>COMMIT</code> pour les enregistrer<br>définitivement.', 'Le stock contient 29 shakers,<br>et le remplacement de Léa Simon<br>est enregistré.',
    'L’équipe logistique peut<br>préparer le colis.');
  /* 7 · Et si le remplacement échoue ? */
  dit('Le remplacement n’a pas été enregistré.', 'Utilise <code>ROLLBACK</code> pour annuler<br>les modifications de cette transaction.');
  /* 8 · À retenir : la dernière idée, mot pour mot */
  dit('Après <code>COMMIT</code>, tu ne peux plus utiliser<br><code>ROLLBACK</code> pour annuler<br>cette transaction.');
  assert.ok(page.includes('Regroupe plusieurs modifications pour les valider ensemble ou toutes les annuler.'), 'la bulle de la mascotte');
  /* Les pastilles d’état de la trame : « Transaction en cours », « Transaction validée », « Transaction annulée · Demande … à traiter », et le stock sans remplacement. */
  for (const t of ['<span class="emo">⚠️</span>Stock : 29 · Aucun remplacement pour Léa Simon</span>', '<span class="emo">⏳</span>Transaction en cours</span>',
    '<span class="emo">✅</span>Transaction validée</span>', '<span class="emo">↩️</span>Transaction annulée · Demande de Léa Simon à traiter</span>', '<i class="st0">⏳ Non validé</i>', '<i class="st1">✓ Validé</i>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('la base du chapitre 12 : neuf tables ; Léa Simon est la cliente 7, le shaker le produit 8 (Shaker Inox, 30 en stock)', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis'], 'la boutique, les ateliers, puis la table avis du chapitre 12');
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  assert.ok(page.includes('<span>9 tables</span>'), '9 tables');
  assert.deepEqual(db.exec('SELECT id, prenom, nom FROM clients WHERE id = 7')[0].values, [[7, 'Léa', 'Simon']]);
  assert.deepEqual(db.exec('SELECT id, nom, stock FROM produits WHERE id = 8')[0].values, [[8, 'Shaker Inox', 30]]);
  assert.deepEqual(val('SHAKER'), {id: 8, nom: 'Shaker Inox', stock: 30}); assert.equal(val('LEA'), 7);
  assert.ok(page.includes("line('tp', cell(0, '<i class=\"v\">8</i>') + cell(1, '<i class=\"v\">Shaker Inox</i>') + cell(2, sw('sk', [['30'], ['29']])"), 'la ligne de la table produits que la page montre : 8, Shaker Inox, 30 puis 29');
});

test('sans transaction : l’UPDATE fait passer le stock de 30 à 29, puis le remplacement sans prénom est refusé ; la base ne reflète qu’une partie de l’opération', () => {
  const db = avec();
  assert.deepEqual(tables(db), [...val('TB').map(t => t[3]), 'remplacements'].sort(), 'la table remplacements s’ajoute aux neuf tables');
  assert.deepEqual(db.exec(`SELECT name, "notnull", pk FROM pragma_table_info('remplacements')`)[0].values,
    [['id', 0, 1], ['client_id', 1, 0], ['produit_id', 1, 0], ['quantite', 1, 0], ['personnalisation', 1, 0]], 'cinq colonnes, comme la page les nomme ; le prénom à imprimer est obligatoire');
  assert.ok(page.includes("head([['c0 kc', KEY], ['c1 kc k-cl', LK + 'client_id'], ['c2 kc k-pr', LK + 'produit_id'], ['c3', 'quantite'], ['c4', 'personnalisation']])"), 'les colonnes de la table remplacements à l’écran');
  db.run(sql('Q_UP'));
  assert.equal(stock(db), 29, 'le stock passe à 29, enregistré aussitôt');
  assert.throws(() => db.run(sql('Q_IN0')), /NOT NULL constraint failed: remplacements\.personnalisation/, 'le prénom à imprimer n’a pas été indiqué');
  assert.equal(stock(db), 29, 'le stock reste à 29');
  assert.deepEqual(remplacements(db), [], 'aucun remplacement pour Léa Simon');
  assert.ok(page.includes("w += out('o-i1', 'err', 'Remplacement non enregistré', 'NOT NULL constraint failed:<br>remplacements.personnalisation', 'm', true);"), 'la page montre le message de la base');
  assert.ok(!/personnalisation/.test(sql('Q_IN0')) && /personnalisation/.test(sql('Q_IN')), 'la première requête oublie la colonne du prénom, la seconde la remplit');
  /* Moment 1 : la valeur qui ne correspond plus à la réalité est le stock (c2) ; pourquoi les autres cases ne conviennent pas. */
  assert.deepEqual(Object.keys(val('WHY1')).sort(), ['c0', 'c1', 'ph'], 'toutes les cases sauf le stock sont expliquées, la ligne vide comprise');
  assert.ok(/if \(i === 0\) return \{text: '[^']+', keys: \['c2'\]\};/.test(page), 'indice du moment 1 : la case du stock (c2) ressort');
  assert.equal(val('PICKS')[0].prompt, 'Touche la valeur qui ne correspond plus à la réalité.');
});

test('avec une transaction : BEGIN TRANSACTION, l’UPDATE et l’INSERT (non validés), puis COMMIT les rend définitifs ensemble ; le premier remplacement a l’identifiant 1', () => {
  const db = avec();
  db.run(sql('Q_BEGIN'));
  db.run(sql('Q_UP'));
  assert.equal(stock(db), 29, 'dans la transaction, le stock vaut 29 (non validé)');
  db.run(sql('Q_IN'));
  assert.deepEqual(remplacements(db), [[1, 7, 8, 1, 'Léa']], 'la nouvelle ligne : le remplacement 1, de Léa Simon (7), pour le shaker (8), une fois, avec son prénom');
  db.run(sql('Q_COMMIT'));
  assert.equal(stock(db), 29); assert.deepEqual(remplacements(db), [[1, 7, 8, 1, 'Léa']], 'après COMMIT : les deux modifications sont enregistrées');
  assert.equal(val('REMPLACEMENT'), 1, 'la table est nouvelle : le premier remplacement a l’identifiant 1');
  assert.ok(sql('Q_IN').includes("VALUES (1, 7, 8, 1, 'Léa');") && page.includes("[\"VALUES ({v1|1}, {v7|7}, {v8|8}, 1, {vl|'Léa'});\"]"), 'les valeurs repérées dans la requête (elles pulsent avec la légende)');
  /* Après COMMIT, il n’y a plus de transaction à annuler : ROLLBACK est refusé, et rien ne change. */
  assert.throws(() => db.run(sql('Q_ROLLBACK')), /cannot rollback - no transaction is active/);
  assert.equal(stock(db), 29); assert.equal(count(db, 'remplacements'), 1);
  /* La dernière idée à retenir le dit. */
  assert.ok(val('CAPTIONS').some(c => c[2] === 'Après <code>COMMIT</code>, tu ne peux plus utiliser<br><code>ROLLBACK</code> pour annuler<br>cette transaction.'));
});

test('moment 2 : annulée avant toute validation, la transaction remet le stock à 30', () => {
  const db = avec();
  db.run(sql('Q_BEGIN')); db.run(sql('Q_UP'));
  assert.equal(stock(db), 29);
  db.run(sql('Q_ROLLBACK'));
  assert.equal(stock(db), 30, 'la modification non validée disparaît');
  assert.equal(val('PICKS')[1].prompt, 'Si la transaction était annulée maintenant, que vaudrait le stock du shaker ?');
  assert.deepEqual(val('PICKS')[1].options.map(o => sp(o.label)), ['30 : la valeur de départ', '29 : la valeur affichée', '28 : un shaker de moins encore']);
});

test('moments 4 et 5 : le remplacement échoue dans la transaction ; elle reste ouverte, et ROLLBACK remet le stock à 30 : la demande reste à traiter', () => {
  const db = avec();
  db.run(sql('Q_BEGIN')); db.run(sql('Q_UP'));
  assert.throws(() => db.run(sql('Q_IN0')), /NOT NULL constraint failed: remplacements\.personnalisation/);
  /* Le refus d’une requête n’annule pas la transaction : le stock vaut toujours 29, en attente d’un COMMIT ou d’un ROLLBACK. */
  assert.equal(stock(db), 29, 'la transaction ne s’annule pas seule');
  db.run(sql('Q_ROLLBACK'));
  assert.equal(stock(db), 30, 'ROLLBACK : le stock revient à 30');
  assert.deepEqual(remplacements(db), [], 'aucun remplacement : la demande de Léa Simon reste à traiter');
  /* Valider à la place : le stock à 29, sans remplacement (la mauvaise réponse du moment 4 le dit). */
  const autre = avec();
  autre.run(sql('Q_BEGIN')); autre.run(sql('Q_UP'));
  assert.throws(() => autre.run(sql('Q_IN0')));
  autre.run(sql('Q_COMMIT'));
  assert.equal(stock(autre), 29); assert.deepEqual(remplacements(autre), [], 'COMMIT validerait le stock à 29 sans aucun remplacement');
  const picks = val('PICKS');
  assert.deepEqual(picks[3].options.map(o => sp(o.label)), ['Valider avec COMMIT', 'Annuler avec ROLLBACK', 'Rien : la transaction s’annule seule']);
  assert.ok(/29 sans aucun remplacement/.test(picks[3].options[0].why) && /reste à 29/.test(picks[3].options[2].why), 'chaque mauvaise réponse est expliquée par ce que la base ferait');
  assert.deepEqual(picks[4].options.map(o => sp(o.label)), ['Rien : le ROLLBACK s’en est chargé', 'Enregistrer seulement le remplacement', 'Recommencer toute la transaction']);
});

test('moment 6 : chaque situation est rangée avec COMMIT ou avec ROLLBACK', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['COMMIT', 'ROLLBACK']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['co', 'ro', 'co', 'ro', 'co', 'ro']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [3, 3], 'trois situations par commande');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]), 'les situations à ranger sont celles des correcteurs');
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique le choix`);
  const caps = val('CAPTIONS').map(c => c[2]);
  for (const c of ['Une transaction se termine<br>par <code>COMMIT</code> ou par <code>ROLLBACK</code>.', '<code>COMMIT</code> valide toutes les modifications<br>de la transaction.',
    '<code>ROLLBACK</code> annule toutes celles<br>qui ne sont pas encore validées.']) assert.ok(caps.includes(c), `légende : ${c}`);
});

test('les messages : Léa Simon écrit elle-même par SMS, sa photo dessous ; le service client demande la mise à jour ; l’app s’arrête sur chacun, sur la photo et sur les trois boutons', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 2, 'deux messages');
  /* Léa Simon : ses mots (Elisa, 25 octobre, 17 h 05), une bulle par phrase ; la photo du shaker cassé, qu’un appui agrandit. */
  assert.deepEqual([mails[0][0], mails[0][2], mails[0][3]], [['Léa', 'Simon', 'LS'], 'cliente', 'lea@mail.fr']);
  assert.deepEqual(mails[0][4], ['Je viens de recevoir ma commande, mais mon shaker personnalisé est arrivé cassé… 😕', 'Est-ce que vous pouvez m’en renvoyer un ?']);
  assert.deepEqual(mails[0][6].photo, {id: 'ph1', src: 'projet-transaction-shaker.webp', alt: 'Le shaker inox rose de Léa Simon, arrivé cassé'});   // la photo d’Elisa (18 h 30) : un shaker en inox, comme le produit 8
  const photo = fs.statSync(path.join(root, 'assets/anim/projet-transaction-shaker.webp')).size;
  assert.ok(photo > 10000 && photo < 80 * 1024, `la photo d’Elisa, légère : ${Math.round(photo / 1024)} Ko`);
  /* Léa Simon écrit au service client, qui nous écrit à son tour (Elisa, 25 octobre, 18 h 36) : ses trois phrases, par SMS ; « Pense à conserver son prénom dessus » est retiré. */
  assert.ok(val('CAPTIONS').some(c => c[2] === 'Elle envoie un message<br>au service client.'), 'la légende dit à qui Léa Simon écrit');
  assert.deepEqual([mails[1][0][0], mails[1][0][1], mails[1][2], mails[1][6]], ['Le service client', 'NutriBoost', 'équipe', {sms: true}]);
  assert.deepEqual(mails[1][4], ['Léa vient de nous envoyer un message : elle a trouvé son shaker cassé.', 'Nous allons lui envoyer gratuitement un nouveau shaker.',
    'Peux-tu mettre à jour le stock et enregistrer le remplacement pour que l’équipe logistique le prépare ?']);
  assert.ok(!JSON.stringify(mails).includes('Pense à conserver'), 'plus de « Pense à conserver son prénom dessus »');
  /* Six arrêts « toucher », rien n’y est noté : les deux messages, la photo, les trois boutons de la trame. */
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#ph1', '#ml2', '#bhow', '#bcom', '#brol']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message de Léa Simon', 'Agrandir la photo du shaker cassé', 'Ouvrir le message du service client NutriBoost',
    'Comment éviter ça ?', 'Valider les modifications', 'Annuler les modifications']);
  assert.deepEqual(opens.map(o => o.prompt), ['Touche le message pour l’ouvrir.', 'Touche la photo pour l’agrandir.', 'Touche le message pour l’ouvrir.', 'Touche le bouton.', 'Touche le bouton.', 'Touche le bouton.']);
  /* La photo : l’arrêt vient après la pause de lecture des bulles ; agrandie, elle reste le temps de la regarder ; le message part une fois la photo revenue. */
  const MAIL1 = val('MAIL1'), PH = val('PH'), lecture = MAIL1 + 1.6 + 0.62 + 0.28 * (val('mailRows(0)') - 1) + 0.35 + 0.05;
  assert.equal(val('mailRows(0)'), 5, 'Bonjour, ses deux phrases, la photo, Merci !');
  assert.ok(PH > lecture + 0.8 && PH < val('OUT1') - 1.2, `l’arrêt sur la photo (+${(PH - MAIL1).toFixed(2)} s) après la lecture (+${(lecture - MAIL1).toFixed(2)} s), avant le départ`);
  for (const t of ["hold(T + 0.7, ZOOM_HOLD);", "tl.set('#zph', {autoAlpha: 1, x: ZB.x, y: ZB.y, scale: ZB.s}, T + 0.12);", "tl.to('#zph', {x: 0, y: 0, scale: 1, duration: 0.5, ease: 'power3.out'}, T + 0.12);",
    "tl.set('#ph1', {autoAlpha: 1}, T + 1.2);", 'zoomPhoto(PH);', 'mailOut(1, OUT1);'])
    assert.ok(page.includes(t), `la photo agrandie : ${t}`);
  assert.ok(!/fromTo\('#zph'|fromTo\('#zbg'/.test(page), 'la photo agrandie ne revient jamais en arrière par un « fromTo »');
  /* Les boutons : un doigt seul sur leur coin, enfoncés au toucher, au repos sinon ; la légende demande de cliquer, l’app s’arrête pendant elle. */
  const lips = {'#bhow': '#4B30CC', '#bcom': '#157A49', '#brol': '#A92A31'};
  const bulles = {'#bhow': 'Clique sur le bouton<br>« Comment éviter ça ? ».', '#bcom': 'Utilise <code>COMMIT</code> pour les enregistrer<br>définitivement.',
    '#brol': 'Utilise <code>ROLLBACK</code> pour annuler<br>les modifications de cette transaction.'};
  for (const o of opens.slice(3)) {
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78}, `${o.sel} : le bout du doigt sur le coin bas droit du bouton`);
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: `0 2px 0 ${lips[o.sel]}`}, {y: 0, boxShadow: `0 9px 0 ${lips[o.sel]}`}], `${o.sel} : enfoncé au toucher, au repos sinon`);
    const c = caps.find(x => x[2] === bulles[o.sel]);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${o.sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  }
  assert.ok(opens.slice(0, 3).every(o => !o.hand && !o.press), 'les messages et la photo gardent leur bulle de consigne');
  assert.ok(opens[3].at > picks[0].at && opens[3].at < picks[1].at && opens[4].at > picks[2].at && opens[4].at < picks[3].at && opens[5].at > picks[3].at && opens[5].at < picks[4].at,
    '« Comment éviter ça ? » après le moment 1, « Valider » après le moment 3, « Annuler » après le moment 4');
  /* La micro-interaction du toucher (Elisa, 25 octobre, 16 h 22), la même qu’au chapitre 12 : rien que des « to », jamais de « fromTo » sur un bouton ou son anneau. */
  for (const t of ["tl.set(b + '-r', {autoAlpha: 0.9, scale: 1}, T + 0.05);", "tl.to(b + '-r', {autoAlpha: 0, scale: 1.16, duration: 0.6, ease: 'power2.out'}, T + 0.051);",
    "tl.to(b + ' .emo', {rotation: -16, transformOrigin: '50% 85%', duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut'}, T + 0.06);",
    "} else { fingerTap($(b), T, '#tapw', 0.6, 62); press($(b), T, lip, 9); }", "tapButton('bhow', HOW, '#4B30CC');", "tapButton('bcom', COM, '#157A49');", "tapButton('brol', ROL, '#A92A31');"])
    assert.ok(page.includes(t), `micro-interaction : ${t}`);
  assert.ok(!/fromTo\('#b(how|com|rol)|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  assert.equal(l62.video.moments, 6, 'les arrêts « toucher » ne comptent pas parmi les moments « À toi »');
  assert.ok(page.includes('Elisa, 25 octobre, 17 h 05'), 'la page garde la trace de la trame d’Elisa');
});

test('chapitre 13 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 13 : TRANSACTION</title>') && page.includes('<div class="tagpill">Projet · Chapitre 13</div>')
    && page.includes('<span>T</span><span>R</span><span>A</span><span>N</span><span>S</span><span>A</span><span>C</span><span>T</span><span>I</span><span>O</span><span>N</span>')
    && page.includes('<div class="abs sub">Valider les modifications ensemble</div>'), 'écran titre : « Projet · Chapitre 13 », TRANSACTION, « Valider les modifications ensemble »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les autres chapitres');
  assert.equal(caps[1], 'Au chapitre 12, tu as décidé<br>du sort des lignes liées<br>avec <code>ON DELETE</code>.', 'le chapitre précédent');
  /* La fin du chapitre 12 annonce les transactions : c’est ce chapitre. */
  const od = fs.readFileSync(path.join(root, 'assets/anim/projet-ondelete.html'), 'utf8');
  assert.ok(od.includes('à tout valider ou tout annuler<br>avec une transaction.') && od.includes('Prochaine leçon · Transactions</span>'), 'le chapitre 12 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : SAVEPOINT. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à annuler une partie d’une transaction<br>avec <code>SAVEPOINT</code>.') && page.includes('Prochaine leçon · SAVEPOINT</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 62) + 1].titre, 'SAVEPOINT');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['🚦', 'BEGIN TRANSACTION démarre la transaction.', 'Selon le SGBD, tu peux aussi écrire BEGIN ou START TRANSACTION.'],
    ['✅', 'COMMIT valide toutes ses modifications.', 'Elles deviennent définitives, et la transaction se termine.'],
    ['↩️', 'ROLLBACK annule toutes les modifications non validées de la transaction.', 'Après COMMIT, tu ne peux plus utiliser ROLLBACK pour annuler cette transaction.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:62,'), html.indexOf('guide({ id:63,'));
  const idees = [...fiche.matchAll(/\["(🚦|✅|↩️)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus de transfert de points de fidélité ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS'), val('WHY1')]);
  for (const mot of ['Sophie', 'Lucas', 'points', 'fidélité', 'SAVEPOINT avant', 'ROLLBACK TO']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  assert.ok(!html.slice(html.indexOf('guide({ id:62,'), html.indexOf('guide({ id:63,')).includes('sit:{'), 'plus de cours texte Transactions dans la fiche');
  /* La table remplacements est toujours nommée « la table remplacements », en gras dans les légendes. */
  assert.ok(!/dans remplacements\b/.test(page) && val('CAPTIONS').filter(c => /table remplacements/.test(c[2])).every(c => /<b>table remplacements<\/b>/.test(c[2])), 'toujours la <b>table remplacements</b>');
});

test('zones à toucher : les lignes des tables font 62 px (le doigt) ; les indices des moments « toucher » et « choisir » ressortent la bonne zone, en typographie française', () => {
  const h = +page.match(/\.r\{position:relative;height:(\d+)px/)[1];
  assert.ok(h >= 62, `lignes des tables produits et remplacements : ${h} px`);
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  /* Le moment 1 propose quatre zones : les trois cases du shaker, et la ligne vide de la table remplacements. */
  assert.ok(page.includes("const CELLS = [['c0', 'Identifiant du shaker'], ['c1', 'Nom du produit'], ['c2', 'Stock du shaker']];") && page.includes("{k: 'ph', label: 'Remplacement de Léa Simon'}"));
});
