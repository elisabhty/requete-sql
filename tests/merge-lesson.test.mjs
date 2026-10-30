/* Projet NutriBoost, chapitre 10 (leçon 82 « MERGE ») : la vidéo interactive assets/anim/projet-merge.html, testée aussi dans lesson-video.test.mjs.
   Ajoutée le 30 octobre (Elisa : un mini-jeu de synchronisation d’urgence, « choix → feedback immédiat → progression → piège → boss final »).
   L’équipe logistique envoie une alerte : l’inventaire de l’entrepôt ne correspond plus aux stocks du site, les ventes du soir commencent
   dans 5 minutes. L’élève décide d’une action par produit, construit MERGE pas à pas (ON, WHEN MATCHED, WHEN NOT MATCHED), évite le piège
   du Magnésium, puis répare la requête d’un collègue. Quatrième cours du module « Écrire et modifier les données ». Leçon seule.
   MERGE n’existe pas dans SQLite, la base de l’app : ce que la vidéo affirme est rejoué ici avec son équivalent, INSERT … ON CONFLICT,
   que la vidéo montre à la fin. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-merge.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l82 = lessons.find(l => l.id === 82);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const sp = s => s.replace(/[  ]/g, ' ');

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost telle que le chapitre 9 la laisse : les quatre tables de la boutique (SCHEMA_SQL de l’app : produits 8) et les quatre tables
   des ateliers ; Nathan Dupont, l’inscription de Léa Simon et les deux d’Hugo Laurent ont été supprimés. Huit tables. */
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
/* La base avec l’inventaire importé : la table temporaire entrepot, telle que la page la montre. */
function avecInventaire() {
  const db = base();
  db.run('CREATE TEMP TABLE entrepot (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, categorie TEXT, prix REAL, stock INTEGER);');
  for (const [id, nom, cat, prix, stock] of val('ENTREPOT')) db.run('INSERT INTO entrepot VALUES (?, ?, ?, ?, ?);', [id, nom, cat, +prix, stock]);
  return db;
}
/* La requête SQLite que la vidéo montre à la fin (sans son commentaire) : le même résultat que MERGE. */
const SQLITE = [...page.matchAll(/\['eq[1-4]', '([^']*)'\]/g)].map(m => m[1].replace(/\{\w+\|([^}]*)\}/g, '$1')).join('\n');
const produits = db => db.exec('SELECT id, nom, categorie, printf(\'%.2f\', prix), stock FROM produits ORDER BY id')[0].values;
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);

test('MERGE : quatrième cours du module « Écrire et modifier les données », juste après DELETE ; le cours suivant du parcours est ON DELETE', () => {
  const m = modules.find(x => x.titre === 'Écrire et modifier les données');
  assert.deepEqual([...m.lessons.map(l => l.id)], [26, 27, 28, 82], 'INSERT, UPDATE, DELETE, MERGE');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(82), liste.indexOf(28) + 1, 'MERGE vient juste après DELETE');
  assert.equal(liste[liste.indexOf(82) + 1], 68, 'ON DELETE vient juste après');
  assert.equal(l82.titre, 'MERGE');
  assert.equal(l82.résumé, 'Synchroniser deux tables');
  assert.equal(new Set(liste).size, liste.length, 'un identifiant par leçon');
});

test('recherche, carte mémo, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  82:'([^']+)',/)[1];
  assert.ok(['merge', 'when matched', 'when not matched', 'using', 'synchroniser', 'on conflict', 'sqlite'].every(m => mots.includes(m)), 'trouvé par la recherche : MERGE, ses branches, la synchronisation, l’équivalent SQLite');
  assert.ok(l82.leconSeule && l82.video && !l82.situation && !l82.consigne && !l82.solution && !l82.petitDefi && !l82.learningCheck && !l82.testeVariants && !l82.anatomie, 'la vidéo est le cours');
  assert.equal(l82.video.moments, 6); assert.equal(l82.video.seuil, 4);
  assert.equal(l82.video.anim, 'assets/anim/projet-merge.html?app&embed');
  assert.equal(l82.video.thumb, 'assets/anim/projet-merge-thumb.webp');
  const carte = vm.runInContext('CARTES[82]', ctx);
  assert.ok(carte && carte.k === 'MERGE' && carte.s.includes('WHEN MATCHED THEN') && carte.s.includes('WHEN NOT MATCHED THEN'), 'une carte mémo à débloquer');
  const recap = l82.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🔀', '🧭', '🔁'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./assets/anim/projet-merge.html?app&embed'") && sw.includes("'./assets/anim/projet-merge-thumb.webp'"), 'gardée pour le hors ligne');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 165.3);
  assert.ok(page.includes('notesAt: 165.3,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 172.5);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['L’alerte stock', 'Une action par produit', 'La clé de comparaison', 'MATCHED ou NOT MATCHED', 'Le piège', 'La requête du collègue', 'Et dans SQLite ?', 'À retenir']);
  /* Une seule phrase complète par bulle (Elisa, 23 octobre) ; aucune bulle de plus de trois lignes. */
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  /* Six moments, dans l’ordre du scénario : ranger, choisir, choisir, toucher, le piège, le boss. */
  assert.deepEqual(picks.map(p => p.kind), ['sort', 'pick', 'pick', 'tap', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.equal(picks[3].need, 1, 'une seule ligne sans correspondance : la Spiruline Bio');
  assert.equal(picks[0].options.length, 4, 'quatre produits à ranger');
  assert.equal(picks[5].options.length, 2, 'deux actions à remettre en place');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 6, 'six indices écrits : un par moment');
});

test('la page montre la base du chapitre 9 : huit tables et leurs lignes ; la table produits est celle de l’app', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits']);
  for (const [, , , name, n] of TB) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(val('PRODUITS'), produits(db).map(r => [r[0], r[1], r[2], r[3], r[4]]), 'la table produits de la page est celle de la base');
  assert.ok(page.includes('<span>8 tables</span>') && page.includes('<span id="pc0">8 lignes</span><span id="pc1">9 lignes</span>'), 'la table produits passe de 8 à 9 lignes');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les autres chapitres');
  assert.equal(caps[1], 'Au chapitre 9, tu as supprimé<br>des lignes avec <code>DELETE</code>.', 'le chapitre précédent');
});

test('moment 1 : chaque produit reçoit l’action que MERGE prendra ensuite', () => {
  const db = avecInventaire(), ITEMS = val('ITEMS');
  assert.deepEqual(val('BINS').map(b => b[1]), ['UPDATE', 'INSERT', 'Ne rien faire']);
  assert.deepEqual(ITEMS.map(x => [x[0].split(' :')[0], x[1]]), [['Fibre Prébiotique', 'up'], ['Spiruline Bio', 'in'], ['Magnésium', 'no'], ['Oméga 3', 'up']]);
  for (const x of ITEMS) assert.ok(strip(x[2]).length > 40, `${x[0]} : une correction qui explique l’action`);
  /* Les chiffres des étiquettes sont ceux des deux tables. */
  const site = id => db.exec(`SELECT stock FROM produits WHERE id = ${id}`)[0]?.values[0][0], stock = id => db.exec(`SELECT stock FROM entrepot WHERE id = ${id}`)[0]?.values[0][0];
  assert.deepEqual([site(1), stock(1), site(7), stock(7), site(9), stock(9), site(3), stock(3)], [120, 150, 90, 75, undefined, 40, 500, undefined]);
  assert.ok(ITEMS[0][0].includes('site 120, entrepôt 150') && ITEMS[3][0].includes('site 90, entrepôt 75') && ITEMS[1][0].includes('entrepôt 40') && ITEMS[2][0].includes('site 500'));
  /* Ce que dit l’équipe logistique, et la place où l’app s’arrête sur son SMS. */
  const mail = val('MAILS')[0], open = val('OPENS')[0], t = val('MAIL1'), sortie = val('MO[0]');
  assert.deepEqual([mail[0][0], mail[0][1], mail[2], mail[6]], ['L’équipe logistique', 'NutriBoost', 'équipe', {sms: true, hello: 'Bonjour !'}]);
  assert.ok(mail[4].some(p => p.includes('Magnésium')) && mail[4].some(p => p.includes('5 minutes')) && mail[4].some(p => p.includes('inventaire')), 'l’alerte : l’inventaire, le Magnésium, les ventes du soir');
  assert.ok(open.at > t && open.at < t + sortie && open.sel === '#ml1');
  assert.equal(open.label, 'Ouvrir le message de l’équipe logistique NutriBoost'); assert.equal(open.prompt, 'Touche le message pour l’ouvrir.');
});

test('moment 2 : ON produits.id = entrepot.id reconnaît le même produit ; le stock ferait correspondre la Fibre Prébiotique à la Vitamine D', () => {
  const db = avecInventaire(), opts = val('PICKS')[1].options.map(o => sp(o.label));
  assert.deepEqual(opts, ['ON produits.nom = entrepot.nom', 'ON produits.id = entrepot.id', 'ON produits.stock = entrepot.stock']);
  const paires = cond => db.exec(`SELECT e.nom, p.nom FROM entrepot e JOIN produits p ${cond.replace(/produits\./g, 'p.').replace(/entrepot\./g, 'e.')} ORDER BY e.id`)[0]?.values ?? [];
  assert.deepEqual(paires(opts[1]), [['Fibre Prébiotique', 'Fibre Prébiotique'], ['Oméga 3', 'Oméga 3']], 'l’identifiant : deux correspondances, les bonnes');
  assert.deepEqual(paires(opts[2]), [['Fibre Prébiotique', 'Vitamine D']], 'le stock : les 150 unités de la Fibre Prébiotique tombent sur la Vitamine D');
  assert.deepEqual(paires(opts[0]), paires(opts[1]), 'le nom : ici, les mêmes paires (la correction le dit), mais il n’est pas unique');
  assert.ok(val('PICKS')[1].options[2].why.includes('Vitamine D') && val('PICKS')[1].options[0].why.startsWith('Ici, les noms concordent'));
});

test('moments 3 et 4 : WHEN MATCHED met à jour la Fibre Prébiotique et Oméga 3 ; un INSERT serait refusé ; la Spiruline Bio, sans correspondance, est ajoutée', () => {
  const db = avecInventaire(), p3 = val('PICKS')[2].options.map(o => sp(o.label));
  assert.deepEqual(p3, ['INSERT', 'UPDATE SET stock = entrepot.stock', 'DELETE']);
  /* Un INSERT d’un produit qui existe déjà : l’identifiant est déjà pris. */
  assert.throws(() => avecInventaire().run("INSERT INTO produits SELECT * FROM entrepot WHERE id IN (1, 7);"), /UNIQUE constraint failed: produits\.id/);
  /* Les lignes sans correspondance : une seule, la Spiruline Bio. */
  assert.deepEqual(db.exec('SELECT id, nom FROM entrepot WHERE id NOT IN (SELECT id FROM produits)')[0].values, [[9, 'Spiruline Bio']]);
  assert.deepEqual(Object.keys(val('WHY4')).sort(), ['e1', 'e7'], 'les deux autres lignes sont expliquées');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Le stock de la Fibre Prébiotique<br>passera de 120 à 150.') && caps.includes('Celui d’Oméga 3 passera de 90 à 75.') && caps.includes('Aucun produit n’a l’identifiant 9 :<br>la Spiruline Bio est nouvelle.'));
});

test('moment 5 et l’exécution : le Magnésium reste tel quel ; 3 lignes traitées, 2 modifiées, 1 ajoutée ; l’équivalent SQLite donne la même table', () => {
  const opts = val('PICKS')[4].options;
  assert.deepEqual(opts.map(o => o.label), ['Il est supprimé', 'Son stock passe à 0', 'Il reste tel quel']);
  assert.ok(opts[2].ok);
  /* La synchronisation, faite comme MERGE la décrit : WHEN MATCHED (UPDATE), puis WHEN NOT MATCHED (INSERT). */
  const merge = avecInventaire();
  merge.run('UPDATE produits SET stock = (SELECT stock FROM entrepot WHERE entrepot.id = produits.id) WHERE id IN (SELECT id FROM entrepot);');
  const modifiees = merge.getRowsModified();
  merge.run('INSERT INTO produits SELECT * FROM entrepot WHERE id NOT IN (SELECT id FROM produits);');
  assert.deepEqual([modifiees, merge.getRowsModified()], [2, 1], '2 modifiées, 1 ajoutée');
  const attendu = [[1, 'Fibre Prébiotique', 'Bien-être', '29.90', 150], [2, 'Collagène Marin', 'Beauté', '39.90', 80], [3, 'Magnésium', 'Bien-être', '19.90', 500],
    [4, 'Vitamine D', 'Nutrition', '14.90', 150], [5, 'Tisane Détox', 'Boisson', '12.50', 60], [6, 'Protéine Végétale', 'Nutrition', '34.90', 45],
    [7, 'Oméga 3', 'Bien-être', '24.90', 75], [8, 'Shaker Inox', 'Accessoire', '15.00', 30], [9, 'Spiruline Bio', 'Nutrition', '22.90', 40]];
  assert.deepEqual(produits(merge), attendu, 'la table produits après la synchronisation : 9 lignes, le Magnésium à 500');
  /* L’équivalent SQLite que la vidéo montre, mot pour mot : le même résultat ; sans WHERE true, SQLite ne le lit pas. */
  assert.equal(SQLITE, 'INSERT INTO produits\nSELECT * FROM entrepot WHERE true\nON CONFLICT (id) DO UPDATE\nSET stock = excluded.stock;');
  const lite = avecInventaire(); lite.run(SQLITE);
  assert.deepEqual(produits(lite), attendu, 'INSERT … ON CONFLICT : la même table que MERGE');
  assert.throws(() => avecInventaire().run(SQLITE.replace(' WHERE true', '')), /syntax error/, 'WHERE true est obligatoire dans cette forme');
  assert.ok(page.includes("b += out('o-run', 'ok', 'Requête exécutée', '3 lignes traitées : 2 modifiées, 1 ajoutée.');"));
  /* Les stocks que les chapitres 12 à 15 reprennent ne bougent pas : collagène 80, tisane 60, protéine 45, shaker 30. */
  for (const [id, n] of [[2, 80], [5, 60], [6, 45], [8, 30]]) assert.equal(attendu[id - 1][4], n);
  const vue = fs.readFileSync(path.join(root, 'assets/anim/projet-vue.html'), 'utf8');
  assert.ok(vue.includes("[1, 'Fibre Prébiotique', 'Bien-être', '29.90', 150, 0, 0],") && vue.includes("[7, 'Oméga 3', 'Bien-être', '24.90', 75, 0, 0],")
    && vue.includes("[9, 'Spiruline Bio', 'Nutrition', '22.90', 40, 0, 0]"), 'le catalogue du chapitre 17 suit la synchronisation');
});

test('moment 6 : la requête du collègue a inversé les deux actions ; chacune retourne dans sa branche', () => {
  assert.deepEqual(val('BRANCHES').map(b => b[1]), ['WHEN MATCHED THEN', 'WHEN NOT MATCHED THEN']);
  assert.deepEqual(val('ACTIONS').map(x => [x[0], x[1]]), [['INSERT (…) VALUES (…)', 'n'], ['UPDATE SET stock = entrepot.stock', 'm']]);
  assert.ok(page.includes("['ec5', '  {xa1|INSERT (…) VALUES (…)}'],") && page.includes("['ec7', '  {xa2|UPDATE SET stock = entrepot.stock};']"), 'la requête du collègue : INSERT sous WHEN MATCHED, UPDATE sous WHEN NOT MATCHED');
  assert.ok(page.includes("alt('ec5b', '  UPDATE SET stock = entrepot.stock', 5)") && page.includes("alt('ec7b', '  INSERT (…) VALUES (…);', 7)"), 'puis remise en place');
});

test('chapitre 10 : écran titre, annonce par DELETE, annonce de ON DELETE, et récapitulatif dans la vidéo comme dans la fiche', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 10 : MERGE</title>') && page.includes('<div class="tagpill">Projet · Chapitre 10</div>')
    && page.includes('<span>M</span><span>E</span><span>R</span><span>G</span><span>E</span>') && page.includes('<div class="abs sub">Synchroniser deux tables</div>'));
  const del = fs.readFileSync(path.join(root, 'assets/anim/projet-delete.html'), 'utf8');
  assert.ok(del.includes('en une seule requête, avec <code>MERGE</code>.') && del.includes('Prochaine leçon · MERGE</span>'), 'le chapitre 9 annonce celui-ci');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à supprimer une ligne que d’autres<br>tables référencent, avec <code>ON DELETE</code>.') && page.includes('Prochaine leçon · ON DELETE</span>'));
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const fiche = html.slice(html.indexOf('guide({ id:82,'), html.indexOf('guide({ id:68,'));
  const idees = [...fiche.matchAll(/\["(🔀|🧭|🔁)","([^"]*)","([^"]*)"\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.equal(rows.length, 3);
  assert.deepEqual(idees, rows, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(!/SQL (voit|comprend|sait|lit|examine)\b/.test(page), 'SQL n’est jamais personnifié');
});
