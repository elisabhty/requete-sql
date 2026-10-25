/* Projet NutriBoost, chapitre 12 (leçon 63 « SAVEPOINT ») : la vidéo interactive assets/anim/projet-savepoint.html, testée aussi dans lesson-video.test.mjs.
   La trame est celle d’Elisa (25 octobre, 17 h 05, « Cours 2 — SAVEPOINT : annuler une partie des modifications »), reprise le 25 octobre à 19 h 13 :
   le service client demande, par SMS, d’ajouter une tisane au colis de remplacement de Léa Simon ; on reprend le remplacement juste avant sa validation.
   Un point de retour (SAVEPOINT avant_cadeau) est posé avant le cadeau ; Léa Simon préfère un autre cadeau : ROLLBACK TO SAVEPOINT annule la tisane
   et son stock, garde le remplacement, et la transaction reste ouverte ; la Protéine Végétale s’ajoute après le même repère ; COMMIT valide le tout ;
   Léa Simon écrit qu’elle a reçu son colis. Ce que la vidéo montre est ici rejoué dans SQLite : c’est ce que la base répond vraiment.
   Leçon seule : ni cours texte, ni exercice ; elle remplace l’ancien cours texte SAVEPOINT (les expéditions du jour). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-savepoint.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l63 = lessons.find(l => l.id === 63);

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
vm.runInContext([...page.matchAll(/^const Q_[A-Z0-9]+ = .*$/gm)].map(m => m[0]).join('\n') + ';this.Q = {Q_BEGIN, Q_UP8, Q_INR, Q_SP, Q_UP5, Q_INC, Q_RT, Q_UP6, Q_INP, Q_COMMIT};', Q);
const sql = q => Q.Q[q].map(([s]) => s).filter(s => !s.trim().startsWith('--')).join('\n').replace(/\{\w+\|([^{}]*)\}/g, '$1');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 11 la laisse : les tables de la boutique (SCHEMA_SQL), les quatre tables des ateliers, la table avis
   (chapitre 10) et la table remplacements (chapitre 11, où le remplacement de Léa Simon est validé). Dix tables. */
function base({remplacement = true} = {}) {
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
    DELETE FROM clients WHERE id = 10;
    CREATE TABLE avis (id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, produit_id INTEGER REFERENCES produits(id), note INTEGER, commentaire TEXT);
    INSERT INTO avis VALUES (1, 9, 6, 5, 'Je recommande !');
    DELETE FROM inscriptions WHERE client_id = 9;
    DELETE FROM clients WHERE id = 9;
    CREATE TABLE remplacements (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id),
      quantite INTEGER NOT NULL, personnalisation TEXT NOT NULL);`);
  if (remplacement) db.run("INSERT INTO remplacements VALUES (1, 7, 8, 1, 'Léa'); UPDATE produits SET stock = stock - 1 WHERE id = 8;");
  return db;
}
/* La table des cadeaux offerts : le client, le produit, la quantité ; vide au départ. */
const CADEAUX = 'CREATE TABLE cadeaux (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), produit_id INTEGER NOT NULL REFERENCES produits(id), quantite INTEGER NOT NULL);';
/* La situation de départ du chapitre : juste avant la validation du chapitre 11, donc 30 shakers et aucun remplacement. */
const depart = () => { const db = base({remplacement: false}); db.run(CADEAUX); return db; };
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const stock = (db, id) => db.exec(`SELECT stock FROM produits WHERE id = ${id}`)[0].values[0][0];
const lignes = (db, t) => (db.exec(`SELECT * FROM ${t} ORDER BY id`)[0] || {values: []}).values;
/* Le début de la transaction, rejoué (le remplacement du chapitre 11), puis le point de retour et le cadeau. */
const jusquAuCadeau = db => ['Q_BEGIN', 'Q_UP8', 'Q_INR', 'Q_SP', 'Q_UP5', 'Q_INC'].forEach(q => db.run(sql(q)));

test('SAVEPOINT : juste après Transactions, dans le module « Transactions », et juste avant Les triggers', () => {
  const m = modules.find(x => x.titre === 'Transactions');
  assert.deepEqual([...m.lessons.map(l => l.id)], [62, 63], 'Transactions, puis SAVEPOINT');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(63), liste.indexOf(62) + 1);
  assert.equal(liste[liste.indexOf(63) + 1], 70, 'Les triggers viennent juste après');
  assert.equal(l63.titre, 'SAVEPOINT');
  assert.equal(l63.résumé, 'Annuler une partie des modifications', 'le sous-titre de la trame d’Elisa');
});

test('recherche, quiz, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  63:'([^']+)',/)[1];
  assert.ok(['savepoint', 'point de retour', 'rollback to savepoint', 'rollback to', 'annuler une partie', 'transaction', 'cadeau', 'commit'].every(m => mots.includes(m)),
    'trouvé par la recherche : SAVEPOINT, le point de retour, ROLLBACK TO SAVEPOINT, le cadeau…');
  assert.ok(l63.leconSeule && l63.video && !l63.situation && !l63.consigne && !l63.solution && !l63.petitDefi && !l63.learningCheck && !l63.testeVariants && !l63.anatomie, 'la vidéo est le cours');
  assert.equal(l63.video.moments, 6); assert.equal(l63.video.seuil, 4);
  assert.equal(l63.video.anim, 'assets/anim/projet-savepoint.html?app&embed');
  const recap = l63.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['📍', '↩️', '✅'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  const quiz = vm.runInContext('QCM', ctx)[63];
  assert.equal(quiz.length, 3);
  assert.deepEqual([...quiz.map(q => q.b)], [1, 0, 2], 'la bonne réponse change de place d’une question à l’autre');
  assert.ok(quiz.every(q => q.o.length === 3 && q.e), 'trois réponses et une explication par question');
  assert.ok(/point de retour/.test(quiz[0].o[1]) && /en cours/.test(quiz[1].o[0]) && /^<code>ROLLBACK<\/code>$/.test(quiz[2].o[2]), 'les bonnes réponses : un point de retour, toujours en cours, ROLLBACK');
  assert.ok(!/expédi|commande n°/.test(JSON.stringify(quiz)), 'plus d’expéditions du jour');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 229.28);
  assert.ok(page.includes('notesAt: 229.28,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 236.48);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  /* Les parties de la trame d’Elisa, avec l’ouverture commune à tous les chapitres du projet dans la première ; le 25 octobre (19 h 13), Léa Simon
     préfère un autre cadeau : « Ajouter la protéine », puis « Le colis est arrivé » (son message) ; « Quelle commande choisir ? » ajoute le moment où
     l’élève range les situations, avant le récapitulatif. La partie 2 est raccourcie pour tenir dans la puce du chapitre. */
  assert.deepEqual(chaps.map(c => c.label), ['Un petit geste pour Léa', 'Pouvoir revenir en arrière', 'Ajouter le cadeau', 'Léa préfère un autre cadeau',
    'Observer ce qui est annulé', 'Ajouter la protéine', 'Valider ce qui reste', 'Le colis est arrivé', 'Quelle commande choisir ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['pick', 'tap', 'pick', 'pick', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une explication`);
  }
  assert.deepEqual(picks[0].options.map(o => !!o.ok), [false, true, false], 'un point de retour posé avant le cadeau');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true], 'rien n’est validé avant COMMIT');
  assert.deepEqual(picks[3].options.map(o => !!o.ok), [true, false, false], 'ROLLBACK TO SAVEPOINT avant_cadeau');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [false, false, true], 'la transaction est toujours en cours');
  assert.equal(picks[1].need, 2, 'deux lignes à toucher : les modifications d’après le repère');
  assert.equal(picks[5].options.length, 6, 'six situations à ranger');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

test('les phrases d’Elisa (25 octobre, 17 h 05 et 19 h 13) : sa trame, une phrase par bulle, avec ses mots', () => {
  const caps = val('CAPTIONS').map(c => c[2]);
  const dit = (...phrases) => phrases.forEach(p => assert.ok(caps.includes(p), `légende : ${p}`));
  /* 1 · Un petit geste pour Léa (Léa Simon, en entier, comme le veut la charte). Le message du service client prend la place de la légende
     qui annonçait la tisane (Elisa, 19 h 13 : « remplace cette partie par celle du message […] à placer avant ») : il arrive juste après l’ouverture. */
  dit('Reprenons le remplacement<br>de Léa Simon juste avant<br>sa validation.', 'Aucun <code>COMMIT</code> n’a été exécuté :<br>la transaction est toujours en cours.');
  assert.ok(!caps.some(c => /souhaite aussi lui offrir une tisane/.test(c)), 'plus de légende pour annoncer la tisane : le message le dit');
  assert.ok(val('MAIL1') > val('B.r2') - 1e-9 && val('MAIL1') < val('A.a1'), 'le message, entre l’ouverture et la reprise du remplacement');
  /* 2 · Garder la possibilité de revenir en arrière */
  dit('Le remplacement est prêt,<br>il reste à ajouter la tisane.', 'Avant d’ajouter le cadeau,<br>tu peux poser un point de retour<br>dans la transaction : un <code>SAVEPOINT</code>.',
    '<code>avant_cadeau</code> est le nom<br>que tu donnes à ce repère.', 'Tu pourras annuler les modifications<br>effectuées après lui, sans annuler<br>celles qui le précèdent.');
  /* 3 · Ajouter le cadeau */
  dit('Les cadeaux offerts sont enregistrés<br>dans la <b>table cadeaux</b>.', 'Tu vas y ajouter la tisane<br>et diminuer son stock.',
    'Les deux modifications s’ajoutent<br>après le repère <code>avant_cadeau</code>.', 'Toutes les modifications restent<br>non validées.');
  /* 4 · Léa préfère un autre cadeau */
  dit('Un <code>ROLLBACK</code> complet annulerait<br>aussi le remplacement.', 'Ici, tu veux seulement annuler<br>l’ajout de la tisane.', 'Clique sur le bouton<br>« Revenir au savepoint ».');
  /* 5 · Observer ce qui est annulé */
  dit('La ligne de Léa Simon disparaît<br>de la <b>table cadeaux</b>.', 'Le stock de tisanes revient<br>de 59 à 60.', 'Le remplacement du shaker reste là,<br>et son stock reste à 29.',
    'Le retour au savepoint annule<br>uniquement les modifications<br>effectuées après ce repère.', 'La transaction reste ouverte.');
  /* 6 · Ajouter la protéine */
  dit('Tu peux maintenant ajouter<br>le cadeau que Léa Simon préfère.', 'La protéine végétale est le produit 6,<br>avec 45 en stock.', 'L’<code>UPDATE</code> fait passer son stock<br>de 45 à 44.',
    '<code>INSERT INTO</code> ajoute la protéine<br>dans la <b>table cadeaux</b>.', 'Le nouveau cadeau s’ajoute à son tour<br>après le repère <code>avant_cadeau</code>.');
  /* 7 · Valider ce qui reste */
  dit('Il reste à valider le remplacement<br>et le nouveau cadeau.', 'Clique sur le bouton<br>« Valider le remplacement ».', 'L’équipe logistique peut préparer<br>le colis de Léa Simon.');
  /* 8 · Le colis est arrivé */
  dit('Quelques jours plus tard,<br>Léa Simon écrit au service client.', 'Grâce au savepoint, tu as changé<br>le cadeau sans refaire le remplacement.');
  /* La bulle finale */
  dit('Un savepoint ne valide rien.', 'Il te permet de revenir à une étape<br>de la transaction, avant la validation<br>finale avec <code>COMMIT</code>.');
  assert.ok(page.includes('Léa Simon change d’avis&nbsp;:<br>à toi d’annuler<br>seulement le cadeau !'), 'la bulle de la mascotte');
  /* Ce que la trame fait afficher : « Tisane annulée · Remplacement conservé · Transaction en cours », puis le colis, avec la protéine. */
  for (const t of ['<span class="q0"><span class="emo">🍵</span>Tisane annulée</span>', '<span class="q1"><span class="emo">🔁</span>Remplacement conservé</span>',
    '<span class="q2"><span class="emo">⏳</span>Transaction en cours</span>', '<b>Léa Simon</b><span class="cst">À préparer</span>', '1 shaker rose personnalisé « Léa »',
    '<div class="cl"><span class="emo">🎁</span>1 Protéine Végétale offerte</div>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  assert.ok(!page.includes('Aucun cadeau ajouté'), 'le colis part avec la protéine');
});

test('la base du chapitre 11 : dix tables ; le shaker (produit 8, 30 en stock) et la tisane (produit 5, Tisane Détox, 60 en stock)', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes', 'avis', 'remplacements']);
  assert.deepEqual(TB.map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.ok(page.includes('<span>10 tables</span>'), '10 tables');
  assert.deepEqual(lignes(db, 'remplacements'), [[1, 7, 8, 1, 'Léa']], 'le remplacement de Léa Simon, validé au chapitre 11');
  const d = depart();
  assert.deepEqual(d.exec('SELECT id, nom, stock FROM produits WHERE id IN (5, 6, 8) ORDER BY id')[0].values, [[5, 'Tisane Détox', 60], [6, 'Protéine Végétale', 45], [8, 'Shaker Inox', 30]],
    'la situation de départ : 60 tisanes, 45 protéines végétales, 30 shakers');
  assert.deepEqual(val('SHAKER'), {id: 8, nom: 'Shaker Inox', stock: 30}); assert.deepEqual(val('TISANE'), {id: 5, nom: 'Tisane Détox', stock: 60});
  assert.deepEqual(val('PROTEINE'), {id: 6, nom: 'Protéine Végétale', stock: 45});
  assert.deepEqual(lignes(d, 'remplacements'), [], 'aucun remplacement : on reprend juste avant la validation');
  assert.deepEqual(d.exec('SELECT id, prenom, nom FROM clients WHERE id = 7')[0].values, [[7, 'Léa', 'Simon']]);
});

test('le point de retour : SAVEPOINT avant_cadeau, après le remplacement ; le cadeau s’ajoute après lui ; rien n’est validé', () => {
  const db = depart();
  jusquAuCadeau(db);
  assert.equal(stock(db, 8), 29); assert.equal(stock(db, 5), 59);
  assert.deepEqual(lignes(db, 'remplacements'), [[1, 7, 8, 1, 'Léa']]);
  assert.deepEqual(lignes(db, 'cadeaux'), [[1, 7, 5, 1]], 'le cadeau 1 : Léa Simon (7), une tisane (5)');
  assert.equal(val('CADEAU'), 1);
  assert.ok(sql('Q_SP') === 'SAVEPOINT avant_cadeau;' && page.includes("const Q_SP = [['-- Poser un point de retour'], ['SAVEPOINT {spn|avant_cadeau};']];"), 'le nom du repère pulse quand la légende le cite');
  /* Moment 1 : un deuxième BEGIN TRANSACTION est refusé (une transaction est déjà en cours). */
  assert.throws(() => db.run('BEGIN TRANSACTION;'), /cannot start a transaction within a transaction/);
  /* Moment 3 : rien n’est validé ; un ROLLBACK annulerait tout, le remplacement compris. */
  db.run('ROLLBACK;');
  assert.equal(stock(db, 8), 30); assert.equal(stock(db, 5), 60);
  assert.deepEqual(lignes(db, 'remplacements'), [], 'ROLLBACK sans cible : le remplacement disparaît aussi');
  assert.deepEqual(lignes(db, 'cadeaux'), []);
  /* Moment 2 : les deux lignes d’après le repère (h4, h5) ; les autres sont expliquées. */
  assert.deepEqual(Object.keys(val('WHY2')).sort(), ['h1', 'h2', 'h3']);
  assert.ok(/if \(i === 1\) return \{text: '[^']+', keys: \['h4', 'h5'\]\};/.test(page), 'indice du moment 2 : les deux lignes d’après le repère ressortent');
  assert.equal(val('PICKS')[1].prompt, 'Touche les deux modifications qu’un retour au savepoint annulerait.');
});

test('le retour au savepoint : la tisane et son stock sont annulés, le remplacement et le stock du shaker restent, la transaction reste ouverte ; la protéine s’ajoute ; COMMIT valide le tout', () => {
  const db = depart();
  jusquAuCadeau(db);
  db.run(sql('Q_RT'));
  assert.equal(sql('Q_RT'), 'ROLLBACK TO SAVEPOINT avant_cadeau;');
  assert.equal(stock(db, 5), 60, 'le stock de tisanes revient de 59 à 60');
  assert.deepEqual(lignes(db, 'cadeaux'), [], 'la ligne de Léa Simon disparaît de la table cadeaux');
  assert.equal(stock(db, 8), 29, 'le stock du shaker reste à 29');
  assert.deepEqual(lignes(db, 'remplacements'), [[1, 7, 8, 1, 'Léa']], 'le remplacement reste');
  /* La transaction reste ouverte : un ROLLBACK, maintenant, annulerait encore tout (on le vérifie sur une copie). */
  const autre = depart(); jusquAuCadeau(autre); autre.run(sql('Q_RT')); autre.run('ROLLBACK;');
  assert.equal(stock(autre, 8), 30); assert.deepEqual(lignes(autre, 'remplacements'), [], 'après le retour au savepoint, la transaction était toujours ouverte');
  /* La protéine, le cadeau que Léa Simon préfère : son stock passe de 45 à 44, la table cadeaux reçoit sa ligne, après le même repère.
     Le cadeau garde l’identifiant 1 : la ligne de la tisane a été annulée avec tout ce qui suivait le repère. */
  assert.equal(sql('Q_UP6'), 'UPDATE produits\nSET stock = stock - 1\nWHERE id = 6;');
  assert.equal(sql('Q_INP'), 'INSERT INTO cadeaux\n  (client_id, produit_id, quantite)\nVALUES (7, 6, 1);');
  db.run(sql('Q_UP6')); db.run(sql('Q_INP'));
  assert.equal(stock(db, 6), 44, 'le stock de protéines passe de 45 à 44');
  assert.deepEqual(lignes(db, 'cadeaux'), [[1, 7, 6, 1]], 'le cadeau 1 : Léa Simon (7), une protéine végétale (6)');
  /* COMMIT valide les modifications de la transaction et la termine. */
  db.run(sql('Q_COMMIT'));
  assert.equal(stock(db, 8), 29); assert.equal(stock(db, 5), 60); assert.equal(stock(db, 6), 44);
  assert.deepEqual(lignes(db, 'remplacements'), [[1, 7, 8, 1, 'Léa']]); assert.deepEqual(lignes(db, 'cadeaux'), [[1, 7, 6, 1]], 'le colis : un shaker et la protéine');
  assert.throws(() => db.run('ROLLBACK;'), /cannot rollback - no transaction is active/, 'COMMIT a terminé la transaction');
  /* Ce que la page montre, dans l’ordre : le retour au savepoint, la protéine à la place de la tisane, puis la validation des quatre modifications. */
  for (const t of ["tapButton('bsav', SAV, '#4B30CC');", "on(['#h4 .xx', '#h5 .xx'], SAV + 0.5, 0.25);", "swap('#sk5 .a1', '#sk5 .a0', A.e2 + 0.4);",
    "rowOut('#rtp5', A.k1 + 1.0); rowIn('#rtp6', A.k1 + 1.05);", "swap('#sk6 .a0', '#sk6 .a1', A.k3 + 0.5);", "rowIn('#h6', A.k3 + 0.7);", "rowOut('#rtc0', k4 + 0.35); rowIn('#rtc2', k4 + 0.4);",
    "rowIn('#h7', k4 + 0.55);", "tapButton('bval', VAL, '#157A49');",
    "[['#bh1', 3], ['#bh2', 4], ['#bh6', 5], ['#bh7', 6]].forEach(([b, p], q) => { const t = VAL + 0.45 + q * 0.15; swap(b + ' .st0', b + ' .st1', t, false);",
    "swap('#hs .hst .h1', '#hs .hst .h2', VAL + 1.15, false);"]) assert.ok(page.includes(t), `la page montre : ${t}`);
  /* L’historique garde la hauteur de cinq lignes, son plus grand nombre à la fois ; l’extrait de la table produits, deux. */
  assert.ok(page.includes("const HROWS = ['#h1', '#h2', '#h3', '#h4', '#h5'], HNEW = ['#h6', '#h7'];") && page.includes("$('#rtp6').style.height = '0px';"), 'les hauteurs ne bougent pas');
});

test('moment 6 : chaque situation est rangée avec ROLLBACK TO SAVEPOINT, ROLLBACK ou COMMIT', () => {
  const BINS = val('BINS'), ITEMS = val('ITEMS');
  assert.deepEqual(BINS.map(b => b[1]), ['ROLLBACK TO SAVEPOINT', 'ROLLBACK', 'COMMIT']);
  assert.deepEqual(ITEMS.map(x => x[1]), ['rt', 'rb', 'co', 'rt', 'rb', 'co']);
  assert.deepEqual(BINS.map(([k]) => ITEMS.filter(x => x[1] === k).length), [2, 2, 2], 'deux situations par commande');
  assert.deepEqual(val('PICKS')[5].options.map(o => o.label), ITEMS.map(x => x[0]));
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique le choix`);
  /* Une erreur dans le remplacement (avant le repère) ne s’annule pas par un retour au savepoint : il faut ROLLBACK. */
  const db = depart(); jusquAuCadeau(db); db.run(sql('Q_RT'));
  assert.deepEqual(lignes(db, 'remplacements'), [[1, 7, 8, 1, 'Léa']], 'le retour au savepoint laisse le remplacement tel quel');
  assert.ok(ITEMS.some(x => /trompé de produit dans le remplacement/.test(x[0]) && x[1] === 'rb'));
});

test('les messages : le service client écrit deux fois par SMS, puis Léa Simon ; l’app s’arrête sur chacun, et sur les deux boutons de la trame', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), caps = val('CAPTIONS');
  assert.equal(mails.length, 3);
  for (const m of mails.slice(0, 2)) assert.deepEqual([m[0][0], m[0][1], m[2], m[6]], ['Le service client', 'NutriBoost', 'équipe', {sms: true}]);
  /* Elisa, 25 octobre, 19 h 13 : le premier message, mot pour mot (« Bonjour, » et « Merci ! » sont les bulles de chaque SMS). */
  assert.deepEqual(mails[0][4], ['Pour nous excuser du shaker arrivé abîmé, peux-tu ajouter une tisane gratuite au colis de remplacement de Léa ? 🌿']);
  assert.deepEqual(mails[1][4], ['Je viens d’avoir Léa : elle nous remercie, mais elle ne boit pas de tisane.',
    'Peux-tu remplacer la tisane par de la protéine végétale, pour qu’elle teste son nouveau shaker ?']);
  /* Le dernier : Léa Simon, colis reçu (ses mots, d’après Elisa : « Bonjour, j’ai bien reçu le colis ! … »), sans « Merci ! » de plus. */
  assert.deepEqual([mails[2][0], mails[2][2], mails[2][6]], [['Léa', 'Simon', 'LS'], 'cliente', {bye: null}]);
  assert.deepEqual(mails[2][4], ['J’ai bien reçu le colis !', 'Le shaker est arrivé en parfait état cette fois, avec le papier bulle 😊',
    'Merci pour votre réactivité et pour la protéine, c’est une attention qui fait plaisir !']);
  assert.equal(vm.runInContext('mailRows(2)', D), 4, 'quatre bulles : « Bonjour, » et ses trois phrases');
  assert.deepEqual(opens.map(o => o.sel), ['#ml1', '#ml2', '#bsav', '#bval', '#ml3']);
  assert.deepEqual(opens.map(o => o.label), ['Ouvrir le message du service client NutriBoost', 'Ouvrir le message du service client NutriBoost', 'Revenir au savepoint', 'Valider le remplacement',
    'Ouvrir le message de Léa Simon']);
  /* Le premier message ouvre le chapitre, le deuxième ouvre la partie 4, le troisième suit la validation ; la préparation s’efface le temps de chacun, puis revient. */
  assert.ok(opens[0].at < picks[0].at && opens[1].at > picks[2].at && opens[1].at < picks[3].at && opens[4].at > opens[3].at && opens[4].at < picks[5].at,
    'le premier message avant le moment 1, le deuxième entre les moments 3 et 4, le troisième après la validation');
  for (const t of ['capOff(B.r2 - 0.2);', "hide('#bc', B.r2 - 0.1, {y: -30}, 0.35);", "sceneOn('#sw', MAIL1 + MO[0] + 0.45);", 'workOff(B.c8 - 0.1);', 'workOn(MAIL2 + MO[1] + 0.35);',
    'workOff(B.h1 - 0.1);', 'workOn(MAIL3 + MO[2] + 0.35);']) assert.ok(page.includes(t), `la préparation s’efface : ${t}`);
  assert.ok(page.includes('(MAILS[n][6] || {}).hello, (MAILS[n][6] || {}).photo, (MAILS[n][6] || {}).bye)'), 'la page passe au moteur la formule, la photo et la fin de chaque SMS');
  const bulles = {'#bsav': 'Clique sur le bouton<br>« Revenir au savepoint ».', '#bval': 'Clique sur le bouton<br>« Valider le remplacement ».'}, lips = {'#bsav': '#4B30CC', '#bval': '#157A49'};
  for (const o of opens.slice(2, 4)) {
    assert.deepEqual(o.hand, {x: 0.86, y: 0.78});
    assert.deepEqual([o.press, o.rest], [{y: 7, boxShadow: `0 2px 0 ${lips[o.sel]}`}, {y: 0, boxShadow: `0 9px 0 ${lips[o.sel]}`}]);
    const c = caps.find(x => x[2] === bulles[o.sel]);
    assert.ok(c && o.at > c[0] + 1 && o.at < c[1] - 1, `${o.sel} : le bouton est visible pendant sa légende, puis l’app s’arrête`);
  }
  assert.ok(opens[2].at > picks[3].at && opens[2].at < picks[4].at && opens[3].at > picks[4].at && opens[3].at < picks[5].at, '« Revenir au savepoint » après le moment 4, « Valider » après le moment 5');
  assert.ok(!/fromTo\('#b(sav|val)|fromTo\(b\b/.test(page), 'aucun « fromTo » sur un bouton ni sur son anneau');
  assert.ok(page.includes('Elisa, 25 octobre, 17 h 05'), 'la page garde la trace de la trame d’Elisa');
});

test('chapitre 12 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 12 : SAVEPOINT</title>') && page.includes('<div class="tagpill">Projet · Chapitre 12</div>')
    && page.includes('<span>S</span><span>A</span><span>V</span><span>E</span><span>P</span><span>O</span><span>I</span><span>N</span><span>T</span>')
    && page.includes('<div class="abs sub">Annuler une partie des modifications</div>'), 'écran titre : « Projet · Chapitre 12 », SAVEPOINT, « Annuler une partie des modifications »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 11, une transaction<br>t’a permis de tout valider<br>ou de tout annuler.', 'le chapitre précédent');
  const tx = fs.readFileSync(path.join(root, 'assets/anim/projet-transaction.html'), 'utf8');
  assert.ok(tx.includes('avec <code>SAVEPOINT</code>.') && tx.includes('Prochaine leçon · SAVEPOINT</span>'), 'le chapitre 11 annonce celui-ci');
  assert.ok(caps.includes('Dans la prochaine leçon, tu découvriras<br>les triggers : des actions lancées<br>automatiquement par une modification.') && page.includes('Prochaine leçon · Les triggers</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 63) + 1].titre, 'Les triggers');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, chacune avec sa phrase puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const RECAP = [['📍', 'SAVEPOINT nom crée un point de retour.', 'La syntaxe varie selon le SGBD : celle-ci est notamment celle de PostgreSQL.'],
    ['↩️', 'ROLLBACK TO SAVEPOINT nom annule les modifications faites après ce point.', 'La transaction continue. ROLLBACK seul annule toute la transaction.'],
    ['✅', 'COMMIT valide les modifications conservées.', 'Et il termine la transaction.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  const fiche = html.slice(html.indexOf('guide({ id:63,'), html.indexOf('guide({ id:70,'));
  const idees = [...fiche.matchAll(/\["(📍|↩️|✅)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
});

test('ce que la vidéo ne reprend pas de l’ancien cours : plus d’expéditions du jour ni de RELEASE ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const textes = JSON.stringify([val('CAPTIONS'), val('PICKS'), val('MAILS'), val('ITEMS'), val('WHY2')]);
  for (const mot of ['expédi', 'transporteur', 'RELEASE', 'avant_14', 'avant_16']) assert.ok(!textes.includes(mot), `la vidéo ne parle pas de ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
  assert.ok(!html.slice(html.indexOf('guide({ id:63,'), html.indexOf('guide({ id:70,')).includes('sit:{'), 'plus de cours texte SAVEPOINT dans la fiche');
  assert.ok(!/dans cadeaux\b/.test(page) && val('CAPTIONS').filter(c => /table cadeaux/.test(c[2])).every(c => /<b>table cadeaux<\/b>/.test(c[2])), 'toujours la <b>table cadeaux</b>');
});

test('zones à toucher : les lignes de l’historique et des tables font 62 px ; les indices passent par la typographie française', () => {
  assert.ok(page.includes('const RH = 62;') && /\.r\{position:relative;height:(6[2-9]|[7-9]\d)px/.test(page), 'lignes de 62 px au moins');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page));
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 5, 'cinq indices écrits : un par moment à choix ou à toucher');
  assert.ok(page.includes("const ROWS = [['h1', 'Stock du shaker'], ['h2', 'Remplacement de Léa Simon'], ['h3', 'Repère avant_cadeau'], ['h4', 'Stock de la tisane'], ['h5', 'Tisane offerte à Léa Simon']];"));
});
