/* Projet NutriBoost, chapitre 8 (leçon 26 « INSERT ») : la vidéo interactive assets/anim/projet-insert.html, testée aussi dans lesson-video.test.mjs.
   Karim Benali passe la main : trois mails demandent d’ajouter des lignes (une inscription, un groupe de trois inscriptions, des séances sur une carte).
   Les mails de Karim et de l’équipe NutriBoost, la légende « Jusqu’ici, Karim… » et la fin du récapitulatif sont les mots d’Elisa (24 octobre).
   Le mail de Karim vient avant « À ton tour de prendre la main ! » (Réf 1), il donne les deux dates : la correction n’est pas un second mail (Réf 3).
   Premier cours du module « Écrire et modifier les données ». Leçon seule : ni cours texte, ni exercice. Elle remplace l’ancien cours INSERT et
   fusionne l’ancien cours 69 « INSERT multiple et gestion de conflit ».
   Ce que la vidéo montre (valeurs dans l’ordre, valeurs inversées, date ou atelier oublié, groupe refusé, carte en double, ON CONFLICT)
   est ici rejoué dans SQLite : c’est ce que la base répond vraiment. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-insert.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l26 = lessons.find(l => l.id === 26);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- La base de la vidéo ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
/* La base NutriBoost de la vidéo, telle que le chapitre 6 la laisse : les quatre tables de la boutique, telles que l’app les crée (SCHEMA_SQL : clients, produits,
   commandes, fidelite) et les quatre tables des ateliers (coachs 4, ateliers 5 avec places, inscriptions 7, cartes 3 avec seances_restantes) : huit tables. */
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
    INSERT INTO inscriptions VALUES (1,1,1,'2026-09-01'),(2,4,1,'2026-09-02'),(3,5,2,'2026-09-03'),(4,7,3,'2026-09-04'),(5,3,1,'2026-09-05'),(6,6,4,'2026-09-06'),(7,1,4,'2026-09-07');
    INSERT INTO cartes VALUES (1,1,10),(2,4,5),(3,6,8);`);
  return db;
}
const HUIT = ['ateliers', 'cartes', 'clients', 'coachs', 'commandes', 'fidelite', 'inscriptions', 'produits'];   // par ordre alphabétique
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
const count = (db, t) => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];

test('INSERT : premier cours du module « Écrire et modifier les données », juste après DROP et juste avant UPDATE ; « INSERT multiple et gestion de conflit » y est fusionné', () => {
  const m = modules.find(x => x.titre === 'Écrire et modifier les données');
  assert.deepEqual([...m.lessons.map(l => l.id)], [26, 27, 28, 82], 'INSERT, UPDATE, DELETE, MERGE : le cours 69 n’existe plus');
  const ids = lessons.map(l => l.id);
  assert.equal(ids.indexOf(26), ids.indexOf(84) + 1, 'INSERT vient juste après Les schémas (30 octobre)');
  assert.equal(ids.indexOf(27), ids.indexOf(26) + 1, 'UPDATE vient juste après');
  assert.equal(l26.titre, 'INSERT');
  assert.equal(l26.résumé, 'Ajouter des lignes');
  assert.equal(lessons.find(l => l.id === 69), undefined, 'le cours 69 est fusionné dans le cours 26');
  assert.ok(!html.includes('guide({ id:69,') && !/\n  69:'/.test(html), 'ni cours, ni mots-clés de recherche pour le cours 69');
  assert.equal(vm.runInContext('QCM', ctx)[69], undefined, 'plus de quiz pour le cours fusionné 69');
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  26:'([^']+)',/)[1];
  assert.ok(['insert into', 'ajouter', 'values', 'plusieurs lignes', 'on conflict', 'upsert', 'do update', 'do nothing', 'doublon', 'not null', 'unique', 'ordre des valeurs'].every(m => mots.includes(m)),
    'trouvé par la recherche : INSERT, VALUES, plusieurs lignes, ON CONFLICT, doublons, NOT NULL… (les mots du cours 69 sont repris)');
  assert.ok(l26.leconSeule && l26.video && !l26.situation && !l26.consigne && !l26.solution && !l26.petitDefi && !l26.learningCheck && !l26.testeVariants && !l26.anatomie, 'la vidéo est le cours');
  assert.equal(l26.video.moments, 6); assert.equal(l26.video.seuil, 4);
  assert.equal(l26.video.anim, 'assets/anim/projet-insert.html?app&embed');
  const recap = l26.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['✍️', '📚', '🔁'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  /* Le bouton des notes est écrit en clair dans Course(…) : il suit la dernière légende. */
  assert.equal(val('NOTES'), 162.2);
  assert.ok(page.includes('notesAt: 162.2,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 169.4);
  /* Des légendes qui se suivent sans se chevaucher, chaque chapitre commençant après la fin de la légende précédente ; le mail occupe l’écran le temps de sa lecture
     (plus il a de lignes, plus il reste), la légende suivante commence après son départ. */
  const finsDeMail = val('[[MAIL1, 0], [MAIL2, 1], [MAIL3, 2]].map(([t, n]) => +(t + mailOutAt(n)).toFixed(2))');
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999 || finsDeMail.some(t => caps[k][0] >= t - 1e-9), `légende ${k + 1} : après la précédente (ou après un mail)`);
  assert.deepEqual(val('MAILS.map((m, n) => mailRows(n))'), [7, 5, 5], 'lignes de chaque mail : bonjour, demande, merci, signature');
  assert.ok(val('MAILS.map((m, n) => mailOutAt(n))').every((t, n, all) => !n || t <= all[0]) && val('mailOutAt(0)') > val('mailOutAt(1)'), 'le long mail de Karim reste plus longtemps à l’écran que les deux autres');
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Karim passe la main', 'Une inscription', 'L’ordre des valeurs', 'Une colonne oubliée', 'Un groupe', 'Créer ou recharger', 'À retenir']);
  /* Une seule phrase complète par bulle (Elisa, 23 octobre) ; aucune bulle de plus de trois lignes, pas même la sienne « Pour enregistrer l’inscription de Lucas… » :
     elle est en deux bulles (Elisa, 24 octobre, Réf 2 : « t’aurais pu découper en plusieurs bulles »). */
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : plus de 4e valeur (bulle de quatre lignes) : deux bulles`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  /* Un seul « Imagine » dans toute la vidéo (Elisa : « répétition de imagine ») : ensuite, une question ou « Et si… ? ». */
  const imagine = [...caps.map(c => c[2]), ...picks.flatMap(p => [p.prompt, p.hint, p.next])].filter(t => /\bImagine\b/.test(strip(t || '')));
  assert.equal(imagine.length, 1, `« Imagine » une seule fois : ${imagine.map(strip).join(' | ')}`);
  /* Six moments, dans l’ordre des chapitres ; chacun s’arrête 2,35 s après le début de sa légende « À toi ! ». */
  assert.deepEqual(picks.map(p => p.kind), ['sort', 'pick', 'pick', 'tap', 'pick', 'sort']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual(picks[1].options.map(o => !!o.ok), [false, true, false], 'les valeurs inversées : Emma Dubois, à l’atelier Pilates');
  assert.deepEqual(picks[2].options.map(o => !!o.ok), [false, false, true], 'l’atelier oublié : il est obligatoire');
  assert.deepEqual(picks[4].options.map(o => !!o.ok), [true, false, false], 'ON CONFLICT … DO UPDATE SET … + 10');
  assert.equal(picks[3].need, 1, 'une seule ligne fautive à toucher');
  assert.equal(picks[0].options.length, 3, 'trois valeurs à ranger'); assert.equal(picks[5].options.length, 4, 'quatre clients à ranger');
  /* Chaque question se suffit : sur un petit écran, le plateau des réponses recouvre le bas de l’image. */
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
});

/* ---------- Les règles d’écriture d’Elisa (23 et 24 octobre), appliquées à tout le texte que l’élève lit ---------- */
test('règles d’écriture : « l’atelier » avant un nom d’atelier, nom et prénom des clients, « identifiant », pas de personnification, noms de tables dans « la table … »', () => {
  const picks = val('PICKS'), mails = val('MAILS');
  const texts = [...val('CAPTIONS').map(c => c[2]), ...picks.flatMap(p => [p.prompt, p.hint, p.next, ...(p.options || []).flatMap(o => [o.label, o.why])]),
    ...mails.flatMap(m => m[4]), ...val('VALS').flatMap(v => Object.values(v.why)), ...val('BUY').map(x => x[2])].filter(Boolean).map(strip);
  const hints = [...page.matchAll(/return \{text: '([^']+)'/g)].map(m => strip(m[1])), valid = [...page.matchAll(/'(La ligne d[^']+)'/g)].map(m => strip(m[1]));
  assert.ok(hints.length >= 6 && valid.length === 2, 'les six aides et les deux corrections du moment 4 sont lues');
  for (const t of [...texts, ...hints, ...valid]) {
    for (const nom of ['Pilates', 'Cuisine saine', 'Yoga du matin']) for (const m of t.matchAll(new RegExp(nom, 'g')))
      assert.ok(/l’atelier $/i.test(t.slice(Math.max(0, m.index - 10), m.index)), `« ${nom} » toujours après « l’atelier » : ${t}`);
    assert.ok(!/\bnuméros?\b/i.test(t), `« identifiant », jamais « numéro » : ${t}`);
    assert.ok(!/\bliens?\b/i.test(t), `« relation », jamais « lien » : ${t}`);
    assert.ok(!/(la table|la base|la requête|SQL) (accepte|crée|lit|refuse|voit|comprend|sait|ajoute)\b/.test(t), `aucune personnification : ${t}`);
    assert.ok(!/(?<!la )table (clients|ateliers|inscriptions|cartes)\b/.test(t), `« la table … » devant le nom d’une table : ${t}`);
    /* Un prénom de client est toujours suivi de son nom (« Karim » et « Moussa » ne sont pas des clients). Seule exception : sa légende « Pour enregistrer l’inscription
       de Lucas… » (Elisa, 24 octobre, Réf 4), juste après le mail de Karim qui nomme Lucas Bernard en entier. */
    if (t.startsWith('Pour enregistrer l’inscription de Lucas,')) continue;
    for (const [, prenom, nom] of val('CLIENTS')) for (const m of t.matchAll(new RegExp(`(?<![\\wÀ-ÿ])${prenom}(?![\\wÀ-ÿ])`, 'g'))) {
      const suite = t.slice(m.index + prenom.length).match(/^ (\p{L}+)/u)?.[1];
      const noms = val('CLIENTS').filter(c => c[1] === prenom).map(c => c[2]);
      assert.ok(suite && noms.includes(suite), `« ${prenom} » toujours suivi de son nom : ${t}`);
    }
  }
  /* Dans les légendes, le nom d’une table est en gras (« la <b>table clients</b> »). */
  for (const c of val('CAPTIONS')) assert.ok(!/table (clients|ateliers|inscriptions|cartes)\b/.test(c[2].replace(/<b>table (clients|ateliers|inscriptions|cartes)<\/b>/g, '')), `légende : nom de table en gras : ${c[2]}`);
});

test('moment 1 : les trois valeurs de l’inscription de Lucas Bernard, chacune dans sa colonne, et ce qui se passe ailleurs', () => {
  const VALS = val('VALS'), col = {cl: 'client_id', at: 'atelier_id', da: 'date_inscription'};
  assert.deepEqual(VALS.map(v => v.label), ['3', '2026-09-08', '2'], 'l’ordre des puces n’est pas l’ordre des colonnes');
  for (const v of VALS) {
    const autres = Object.keys(col).filter(k => k !== v.col);
    assert.deepEqual(Object.keys(v.why).sort(), autres.sort(), `${v.label} : une explication pour chacune des deux colonnes qui ne conviennent pas`);
    for (const w of Object.values(v.why)) assert.ok(strip(w).length > 30, `${v.label} : une explication complète`);
  }
  const db = base();
  db.run("INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (2, 3, '2026-09-08');");
  const row = Object.fromEntries(db.exec('SELECT * FROM inscriptions WHERE id = 8')[0].columns.map((c, i) => [c, db.exec('SELECT * FROM inscriptions WHERE id = 8')[0].values[0][i]]));
  for (const v of VALS) assert.equal(String(row[col[v.col]]), v.label, `${v.label} va dans ${col[v.col]}`);
  assert.equal(row.id, 8, 'l’identifiant 8 est attribué automatiquement');
  assert.equal(count(db, 'inscriptions'), 8);
  assert.deepEqual(db.exec('SELECT c.prenom || \' \' || c.nom, a.titre FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id WHERE i.id = 8')[0].values, [['Lucas Bernard', 'Cuisine saine']]);
  /* Les phrases du mail et de la légende disent la même chose que la requête. */
  const mails = val('MAILS');
  assert.ok(mails[0][4][2].includes('enregistrer l’inscription de Lucas Bernard à l’atelier Cuisine saine ?') && mails[0][4][3].startsWith('Le 8 septembre est la date d’inscription.'), 'le mail de Karim');
  for (const t of ["({v1|2}", "{v2|3}", "{v3|'2026-09-08'}", '{co1|client_id}', '{co2|atelier_id}', '{co3|date_inscription}']) assert.ok(page.includes(t), `la requête montrée : ${t}`);
});

test('moment 2 : valeurs inversées, la requête est exécutée sans erreur et inscrit Emma Dubois à l’atelier Pilates ; date oubliée : NULL', () => {
  const db = base();
  db.run("INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (3, 2, '2026-09-08');");   // aucune erreur
  assert.deepEqual(db.exec('SELECT c.prenom || \' \' || c.nom, a.titre FROM inscriptions i JOIN clients c ON c.id = i.client_id JOIN ateliers a ON a.id = i.atelier_id WHERE i.id = 8')[0].values, [['Emma Dubois', 'Pilates']]);
  for (const t of ["sw('s8c1', [['2'], ['3']])", "tg('t8c1', 'k-cl', ['Lucas Bernard', 'Emma Dubois'])", "sw('s8c2', [['3'], ['2']])", "tg('t8c2', 'k-at', ['Cuisine saine', 'Pilates'])"]) assert.ok(page.includes(t), `la ligne montrée : ${t}`);
  const nul = base();
  nul.run('INSERT INTO inscriptions (client_id, atelier_id) VALUES (2, 3);');   // la date n’est pas citée
  assert.deepEqual(nul.exec('SELECT date_inscription FROM inscriptions WHERE id = 8')[0].values, [[null]], 'une colonne non citée vaut NULL (aucune valeur par défaut)');
  assert.ok(page.includes("['NULL', 'nul']"), 'la page montre NULL');
});

test('moment 3 : sans l’atelier, la requête est refusée (NOT NULL) et rien n’est ajouté', () => {
  const db = base();
  assert.throws(() => db.run("INSERT INTO inscriptions (client_id, date_inscription) VALUES (2, '2026-09-08');"), /NOT NULL constraint failed: inscriptions\.atelier_id/);
  assert.equal(count(db, 'inscriptions'), 7, 'aucune ligne ajoutée');
  const notNull = Object.fromEntries(db.exec("SELECT name, \"notnull\" FROM pragma_table_info('inscriptions')")[0].values);
  assert.deepEqual(notNull, {id: 0, client_id: 1, atelier_id: 1, date_inscription: 0}, 'client_id et atelier_id sont obligatoires, pas la date');
  assert.ok(page.includes('<i id="nn1">NOT NULL constraint failed:</i><br><i id="nn2">inscriptions.atelier_id</i>'), 'le message de SQLite, mot pour mot');
});

test('moment 4 : un groupe de trois inscriptions ; une faute (atelier 15) fait tout refuser ; corrigé, les identifiants 9 à 11 sont attribués', () => {
  const db = base();
  db.run("INSERT INTO inscriptions (client_id, atelier_id, date_inscription) VALUES (2, 3, '2026-09-08');");
  db.run('PRAGMA foreign_keys = ON;');
  const groupe = n => `INSERT INTO inscriptions (client_id, atelier_id, date_inscription)
    VALUES (6, 5, '2026-09-09'), (8, 5, '2026-09-09'), (9, ${n}, '2026-09-09');`;
  assert.throws(() => db.run(groupe(15)), /FOREIGN KEY constraint failed/);
  assert.equal(count(db, 'inscriptions'), 8, 'aucune des trois lignes n’est ajoutée');
  assert.equal(db.exec('SELECT COUNT(*) FROM ateliers WHERE id = 15')[0].values[0][0], 0, 'aucun atelier n’a l’identifiant 15');
  db.run(groupe(5));
  assert.equal(count(db, 'inscriptions'), 11);
  assert.deepEqual(db.exec('SELECT id, client_id, atelier_id FROM inscriptions WHERE id > 8 ORDER BY id')[0].values, [[9, 6, 5], [10, 8, 5], [11, 9, 5]]);
  assert.deepEqual(db.exec('SELECT c.prenom || \' \' || c.nom FROM inscriptions i JOIN clients c ON c.id = i.client_id WHERE i.id > 8 ORDER BY i.id')[0].values.flat(), ['Hugo Laurent', 'Gabriel Michel', 'Inès Lefebvre']);
  /* La page : le mail de Moussa Diallo nomme les mêmes trois clients ; le tableau montre les lignes 9 à 11 et les compteurs 7, 8, 11. */
  const mail = val('MAILS')[1][4].join(' ');
  for (const nom of ['Hugo Laurent', 'Gabriel Michel', 'Inès Lefebvre']) assert.ok(mail.includes(nom), `le mail de Moussa Diallo nomme ${nom}`);
  assert.ok(mail.includes('à l’atelier Yoga du matin'), 'Yoga du matin, l’atelier 5');
  assert.equal(db.exec('SELECT titre FROM ateliers WHERE id = 5')[0].values[0][0], 'Yoga du matin');
  for (const t of ["{gp1|(6, 5, '2026-09-09')}", "{gp2|(8, 5, '2026-09-09')}", "{gp3|(9, <span id=\\\"fxb\\\"><span class=\\\"sg\\\" id=\\\"fx1\\\">1</span>5</span>, '2026-09-09')}",
    "tg('t9c1', 'k-cl', ['Hugo Laurent'])", "tg('t10c1', 'k-cl', ['Gabriel Michel'])", "tg('t11c1', 'k-cl', ['Inès Lefebvre'])", '<span id="cn-a">7 lignes</span><span id="cn-b">8 lignes</span><span id="cn-c">11 lignes</span>',
    '15 : aucun atelier'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
});

test('chapitre 8, cartes : une seule carte par client (UNIQUE) ; ON CONFLICT … DO UPDATE recharge la carte de 8 à 18, DO NOTHING la laisse à 8, SET … = 10 la remplace par 10', () => {
  const insert = fin => `INSERT INTO cartes (client_id, seances_restantes) VALUES (6, 10) ${fin}`;
  const db = base();
  assert.throws(() => db.run(insert(';')), /UNIQUE constraint failed: cartes\.client_id/, 'une seconde carte pour Hugo Laurent est refusée');
  assert.equal(count(db, 'cartes'), 3);
  const seances = d => d.exec('SELECT seances_restantes FROM cartes WHERE client_id = 6')[0].values[0][0];
  assert.equal(seances(db), 8, 'la carte d’Hugo Laurent compte 8 séances');
  const plus = base(); plus.run(insert('ON CONFLICT (client_id) DO UPDATE SET seances_restantes = seances_restantes + 10;'));
  assert.equal(seances(plus), 18); assert.equal(count(plus, 'cartes'), 3, 'aucune seconde carte');
  const rien = base(); rien.run(insert('ON CONFLICT (client_id) DO NOTHING;'));
  assert.equal(seances(rien), 8); assert.equal(count(rien, 'cartes'), 3);
  const fixe = base(); fixe.run(insert('ON CONFLICT (client_id) DO UPDATE SET seances_restantes = 10;'));
  assert.equal(seances(fixe), 10); assert.equal(count(fixe, 'cartes'), 3);
  /* La page : l’identifiant de client 6 est celui d’Hugo Laurent ; les trois fins du moment 5 sont celles qui viennent d’être jouées ; les messages sont ceux de SQLite. */
  assert.equal(base().exec('SELECT prenom || \' \' || nom FROM clients WHERE id = 6')[0].values[0][0], 'Hugo Laurent');
  const opts = val('PICKS')[4].options.map(o => o.label.replace(/ /g, ' '));
  assert.deepEqual(opts, ['DO UPDATE SET seances_restantes = seances_restantes + 10', 'DO NOTHING', 'DO UPDATE SET seances_restantes = 10'], 'les trois fins possibles, après ON CONFLICT (client_id)');
  assert.ok(page.includes("['ec4', '{kc|ON CONFLICT} (client_id)'],"), 'la requête montrée s’arrête après ON CONFLICT (client_id) : le trou attend la fin');
  for (const t of ['UNIQUE constraint failed:<br>cartes.client_id', 'La carte d’Hugo Laurent passe à 18 séances.', 'La carte d’Hugo Laurent reste à 8 séances.', 'La carte d’Hugo Laurent passe à 10 séances.',
    "const cartes = [[1, 1, 'Sophie Martin', 10], [2, 4, 'Nathan Petit', 5], [3, 6, 'Hugo Laurent', 8]];", '<i class="a0">8</i><i class="a1">10</i><i class="a2">18</i>', '<i class="calc" id="calc">8 + 10</i>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  const mail = val('MAILS')[2][4].join(' ');
  assert.ok(mail.includes('Hugo Laurent vient d’acheter un pack de 10 séances') && mail.includes('avec un solde de 10 séances'), 'le mail de l’équipe NutriBoost');
});

test('moment 6 : quatre clients achètent un pack ; la même requête crée les cartes qui manquent et recharge les autres', () => {
  const db = base();
  const BUY = val('BUY'), clients = Object.fromEntries(db.exec("SELECT prenom || ' ' || nom, id FROM clients")[0].values);
  const aCarte = nom => db.exec(`SELECT COUNT(*) FROM cartes WHERE client_id = ${clients[nom]}`)[0].values[0][0] > 0;
  assert.deepEqual(val('BINS').map(x => x[0]), ['cr', 'rc']);
  for (const [nom, case_, why] of BUY) {
    assert.equal(case_, aCarte(nom) ? 'rc' : 'cr', `${nom} : ${aCarte(nom) ? 'a déjà une carte, rechargée' : 'pas de carte, créée'}`);
    assert.ok(why.startsWith(nom) && why.length > 40, `${nom} : une correction qui nomme le client`);
    const n = db.exec(`SELECT seances_restantes FROM cartes WHERE client_id = ${clients[nom]}`)[0]?.values[0][0];
    if (n !== undefined) assert.ok(why.includes(`de ${n} séances`), `${nom} : sa carte compte ${n} séances`);
  }
  assert.deepEqual(BUY.map(x => x[1]).sort(), ['cr', 'cr', 'rc', 'rc'], 'deux cartes créées, deux cartes rechargées');
  db.run(`INSERT INTO cartes (client_id, seances_restantes) VALUES ${BUY.map(x => `(${clients[x[0]]}, 10)`).join(', ')}
    ON CONFLICT (client_id) DO UPDATE SET seances_restantes = seances_restantes + 10;`);
  assert.equal(count(db, 'cartes'), 5, 'deux cartes de plus : trois, plus deux');
  const solde = Object.fromEntries(db.exec("SELECT cl.prenom || ' ' || cl.nom, c.seances_restantes FROM cartes c JOIN clients cl ON cl.id = c.client_id")[0].values);
  assert.deepEqual(solde, {'Sophie Martin': 20, 'Nathan Petit': 15, 'Hugo Laurent': 8, 'Chloé Moreau': 10, 'Lucas Bernard': 10}, 'cartes créées à 10 séances, cartes rechargées de 10');
});

test('la page montre la base : huit tables, leurs nombres de lignes, les extraits des tables clients et ateliers et les trois dernières inscriptions', () => {
  const db = base(), TB = val('TB');
  assert.deepEqual(tables(db), HUIT);
  assert.deepEqual(TB.map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits', 'coachs', 'ateliers', 'inscriptions', 'cartes'],
    'la boutique d’abord, puis les tables des ateliers dans l’ordre du chapitre 5 (la copie du fichier Excel est retirée au chapitre 6, dans l’ouverture du chapitre 7)');
  assert.equal(new Set(TB.map(t => t[1])).size, TB.length, 'chaque table a sa couleur');
  for (const [, , , name, n] of TB.filter(t => t[3] !== 'inscriptions_excel')) assert.equal(count(db, name), n, `${name} : ${n} lignes`);
  assert.deepEqual(val('TB').filter(t => t[3] !== 'inscriptions_excel').map(t => t[3]).sort(), tables(db), 'aucune table de la base n’est oubliée à l’écran');
  assert.ok(page.includes('<span class="bn"><span>8 tables</span></span>') && !page.includes('#bw-xl'), 'huit tables : la copie du fichier Excel n’est plus à l’écran');
  /* Les extraits : table clients (dix lignes, deux pages de cinq) et table ateliers (cinq lignes). */
  assert.deepEqual(val('CLIENTS'), db.exec('SELECT id, prenom, nom FROM clients ORDER BY id')[0].values, 'les dix clients, dans l’ordre');
  assert.deepEqual(val('ATELIERS'), db.exec('SELECT id, titre, date_atelier FROM ateliers ORDER BY id')[0].values, 'les cinq ateliers, dans l’ordre');
  assert.ok(page.includes("CLIENTS.slice(0, 5)") && page.includes("CLIENTS.slice(5)") && page.includes('lignes 1 à 5') && page.includes('lignes 6 à 10'));
  /* Les trois dernières inscriptions visibles de la table inscriptions : id, client_id, atelier_id, date. */
  const vues = [...page.matchAll(/rowOf\((\d+), (\d+), (\d+), (\d+), '([\d-]+)'\)/g)].map(m => [+m[2], +m[3], +m[4], m[5]]);
  assert.deepEqual(vues, db.exec('SELECT id, client_id, atelier_id, date_inscription FROM inscriptions WHERE id >= 5 ORDER BY id')[0].values, 'les inscriptions 5, 6 et 7');
  assert.deepEqual(db.exec("SELECT name FROM pragma_table_info('inscriptions')")[0].values.flat(), ['id', 'client_id', 'atelier_id', 'date_inscription'], 'les colonnes de l’en-tête');
  for (const t of ['<span class="emo">🔑</span>id', '<span class="emo">🔗</span>client_id', '<span class="emo">🔗</span>atelier_id', 'date_inscription']) assert.ok(page.includes(t), `en-tête : ${t}`);
  const fks = db.exec("SELECT \"from\", \"table\" FROM pragma_foreign_key_list('inscriptions') ORDER BY \"from\"")[0].values;
  assert.deepEqual(fks, [['atelier_id', 'ateliers'], ['client_id', 'clients']], 'les deux 🔗 sont les clés étrangères de la table inscriptions');
});

test('les trois mails : Karim Benali, Moussa Diallo, puis l’équipe NutriBoost ; l’app s’arrête sur chacun jusqu’au toucher', () => {
  const mails = val('MAILS'), opens = val('OPENS'), picks = val('PICKS'), mail = val('[MAIL1, MAIL2, MAIL3]'), fins = val('MAILS.map((m, n) => mailOutAt(n))');
  assert.deepEqual(mails.map(m => [m[0][0], m[0][1], m[3]]), [['Karim', 'Benali', 'karim@nutriboost.fr'], ['Moussa', 'Diallo', 'moussa@mail.fr'], ['L’équipe', 'NutriBoost', 'equipe@nutriboost.fr']],
    'trois mails : Karim n’en écrit qu’un (Elisa, 24 octobre, Réf 3 : la correction est dans le premier mail)');
  const coach = base().exec("SELECT email FROM coachs WHERE prenom = 'Moussa' AND nom = 'Diallo'")[0].values[0][0];
  assert.equal(mails[1][3], coach, 'l’adresse de Moussa Diallo est celle de la table coachs');
  assert.deepEqual(mails.map(m => m[5]), ['Karim', 'Moussa', 'L’équipe NutriBoost']);
  assert.equal(opens.length, 3);
  opens.forEach((o, n) => { assert.ok(o.at > mail[n] && o.at < mail[n] + fins[n], `mail ${n + 1} : l’app s’arrête pendant le mail`); assert.equal(o.sel, '#ml' + (n + 1)); });
  assert.ok(mail[0] < picks[0].at && mail[1] > picks[2].at && mail[1] < picks[3].at && mail[2] > picks[3].at && mail[2] < picks[4].at,
    'mail 1 avant le moment 1, mail 2 entre les moments 3 et 4, mail 3 entre les moments 4 et 5');
  assert.ok(opens.map(o => o.label).join('|') === 'Ouvrir le mail de Karim Benali|Ouvrir le mail de Moussa Diallo|Ouvrir le mail de L’équipe NutriBoost');
  assert.ok(!page.includes('mailBlock(3)') && !/mailIn\(4,/.test(page), 'plus de quatrième mail');
});

test('Réf 1 : « À ton tour de prendre la main ! » vient après le mail de Karim, et la base revient avec Karim pour le lui dire', () => {
  const A = val('A'), B = val('B'), mail1 = val('MAIL1'), fin = val('MAIL1 + mailOutAt(0)');
  assert.ok(mail1 >= B.c2 - 1e-9 && mail1 < A.c3, 'le mail commence quand la légende « Jusqu’ici, Karim… » est finie');
  assert.ok(A.c3 > fin && B.c3 < A.c4a, 'ordre : « Jusqu’ici, Karim… », le mail, « À ton tour… », puis « Pour enregistrer… »');
  const caps = val('CAPTIONS').map(c => strip(c[2]));
  assert.deepEqual(caps.slice(2, 6), ['Jusqu’ici, Karim, le développeur, s’est chargé d’ajouter les données dans les tables de NutriBoost.', 'À ton tour de prendre la main !',
    'Pour enregistrer l’inscription de Lucas, tu vas ajouter une nouvelle ligne dans la table inscriptions.', 'Cela se fait avec la commande SQL INSERT INTO.'], 'les bulles, dans l’ordre');
  /* Karim et la base attendent pendant le mail, puis reviennent ; sa pastille passe la main à la tienne pendant « À ton tour… ». */
  assert.ok(page.includes("hide(['#bc', '#wk'], MAIL1, {y: -30}, 0.35);"), 'la base et la pastille de Karim attendent pendant le mail');
  assert.ok(page.includes("sceneOn('#sa', MAIL1 + MO[0] + 0.3);") && page.includes("tl.fromTo('#wk', {autoAlpha: 0, y: 30, scale: 0.94}, {autoAlpha: 1, y: 0, scale: 1,"), 'la base revient avec Karim quand le mail est parti');
  assert.ok(page.includes("tl.to('#wk', {x: 140, autoAlpha: 0, duration: 0.35, ease: 'power2.in'}, A.c3 + 0.3);") && page.includes("{autoAlpha: 1, x: 0, duration: 0.5, ease: 'back.out(1.4)', immediateRender: false}, A.c3 + 0.6);"),
    'la pastille de Karim s’en va, la tienne arrive, pendant « À ton tour de prendre la main ! »');
  assert.ok(page.includes("hide(['#bc', '#wt'], B.c3 - 0.15, {y: -30}, 0.35);") && page.includes("sceneOn('#sb', B.c3 + 0.2);"), 'la table inscriptions prend la place de la base à la fin de la légende');
});

/* ---------- Les mots d’Elisa (24 octobre, Réf 2 à 5, 7 et 8), repris tels quels ---------- */
test('Réf 2 à 5, 7 et 8 : les phrases d’Elisa, mot pour mot', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])), mails = val('MAILS');
  assert.ok(caps.includes('Jusqu’ici, Karim, le développeur, s’est chargé d’ajouter les données dans les tables de NutriBoost.'), 'Réf 2 : première bulle');
  assert.ok(caps.includes('À ton tour de prendre la main !'), 'Réf 2 : seconde bulle');
  /* Réf 3 : le mail de Karim, ligne par ligne ; Réf 4 : sa correction, qui est dans ce même mail (Elisa, 24 octobre au soir : « une correction à faire dans notre premier mail »). */
  assert.deepEqual(mails[0][4].concat(mails[0][6].bye), ['J’espère que tu vas bien !',
    'Je serai en congé à partir de lundi prochain. Est-ce que tu pourrais prendre le relais pendant mon absence ?',
    'Je te confie une première tâche, encore en attente dans mon planning et assez urgente : pourrais-tu enregistrer l’inscription de Lucas Bernard à l’atelier Cuisine saine ?',
    'Le 8 septembre est la date d’inscription. L’atelier Cuisine saine a lieu le 19 septembre.',
    'Merci pour ton aide !']);
  assert.equal(mails[0][5], 'Karim');
  assert.ok(!mails.some(m => m[4].join(' ').includes('Petite correction')), 'plus de second mail de Karim : « Petite correction dans le mail précédent » n’existe plus');
  assert.ok(caps.includes('Pour enregistrer l’inscription de Lucas, tu vas ajouter une nouvelle ligne dans la table inscriptions.') && caps.includes('Cela se fait avec la commande SQL INSERT INTO.'),
    'Réf 4 : la légende, en deux bulles (Réf 2 du soir : plus de bulle de quatre lignes)');
  assert.equal(base().exec("SELECT date_atelier FROM ateliers WHERE titre = 'Cuisine saine'")[0].values[0][0], '2026-09-19', 'l’atelier Cuisine saine a bien lieu le 19 septembre');
  /* Réf 5 : « Imagine » une seule fois ; Réf 8 : « Et si… ? ». */
  assert.ok(caps.includes('Et si tu oublies de préciser l’atelier dans ta requête ?'), 'Réf 5');
  assert.ok(caps.includes('Et si quatre clients achètent un pack de 10 séances ?'), 'Réf 8');
  /* Réf 7 : le mail de l’équipe NutriBoost. */
  assert.deepEqual(mails[2][4], ['Hugo Laurent vient d’acheter un pack de 10 séances pour participer aux ateliers.',
    'Peux-tu ajouter ces séances à sa carte ? S’il n’en possède pas encore, il faudra lui en créer une avec un solde de 10 séances.'], 'Réf 7');
  assert.equal(mails[2][5], 'L’équipe NutriBoost');
  assert.equal(mails[2][6], undefined, 'Bonjour, … Merci !');
});

test('Réf 9 : la requête qui crée ou recharge reste affichée pendant la dernière légende du moment 6', () => {
  assert.ok(page.includes("hide('#tc', A.c31, {y: -30}, 0.35);") && page.includes("tl.fromTo('#edc', {autoAlpha: 0, y: 236 - EDC + 40}, {autoAlpha: 1, y: 236 - EDC, duration: 0.5, ease: 'expo.out', immediateRender: false}, A.c31 + 0.1);"),
    'la requête (l’éditeur) prend la place du tableau des cartes dès la légende « Avec la même requête… »');
  assert.ok(page.includes("hide('#edc', B.c31 - 0.1, {y: 236 - EDC - 40}, 0.4);"), 'elle repart avec la légende, sans sauter');
  assert.ok(page.includes("pulse('#ec2', A.c31 + 0.5, 1,") && page.includes("pulse(['#ec5', '#ec6'], A.c31 + 1.5, 1,"), 'les deux endroits qui créent et qui rechargent sont surlignés à tour de rôle');
});

/* ---------- Propre au chapitre 8 : la suite du chapitre 6, l’annonce du chapitre 9 ---------- */
test('chapitre 8 : écran titre, ouverture comme aux autres chapitres, annonce de la prochaine leçon', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 8 : INSERT INTO</title>') && page.includes('<div class="tagpill">Projet · Chapitre 8</div>')
    && page.includes('<span>I</span><span>N</span><span>S</span><span>E</span><span>R</span><span>T</span>') && page.includes('<div class="abs sub">Ajouter des lignes</div>')
    && page.includes('Ajoute de nouvelles lignes dans une table avec <span class="ic">INSERT</span>.'), 'écran titre : « Projet · Chapitre 8 », INSERT, « Ajouter des lignes »');
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.', 'la même première légende que les chapitres 2 à 6');
  assert.equal(caps[1], 'Au chapitre 7, tu as découvert<br>les schémas, qui rangent<br>les tables par espace.', 'le chapitre précédent');
  /* La fin du chapitre 7 annonce « INSERT INTO » : c’est ce chapitre. */
  const sch = fs.readFileSync(path.join(root, 'assets/anim/projet-schemas.html'), 'utf8');
  assert.ok(sch.includes('à ajouter des données dans tes tables<br>avec <code>INSERT INTO</code>.') && sch.includes('Prochaine leçon · INSERT INTO</span>'), 'le chapitre 7 annonce celui-ci');
  /* Il annonce à son tour la leçon suivante du cours : UPDATE. */
  assert.ok(caps.includes('Dans la prochaine leçon, tu apprendras<br>à modifier les données avec <code>UPDATE</code>.') && page.includes('Prochaine leçon · UPDATE</span>'), 'annonce de la prochaine leçon');
  assert.equal(lessons[lessons.findIndex(l => l.id === 26) + 1].id, 27);
  assert.equal(lessons.find(l => l.id === 27).titre, 'UPDATE');
  assert.equal(caps[caps.length - 2], 'Pour finir, voici les <b>trois idées à retenir</b>.');
});

test('le récapitulatif, mot pour mot, dans la vidéo comme dans la fiche de la leçon : trois idées, sans numéro, chacune avec son titre puis sa précision', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  /* Les mots d’Elisa (24 octobre, Réf 1 et 10) : ni « 1. », « 2. », « 3. » devant les titres. */
  const RECAP = [['✍️', 'Ajouter une ligne', 'INSERT INTO ajoute une ligne dans une table. Les valeurs suivent l’ordre des colonnes indiquées. Une colonne omise reçoit sa valeur par défaut ou NULL. Si elle est obligatoire et sans valeur par défaut, l’ajout est refusé.'],
    ['📚', 'Ajouter plusieurs lignes', 'Après VALUES, écris un groupe de valeurs entre parenthèses par ligne, séparé par une virgule.'],
    ['🔁', 'Gérer un doublon', 'ON CONFLICT précise quoi faire si une valeur existe déjà dans une colonne qui doit rester unique : • DO UPDATE met à jour la ligne existante. • DO NOTHING ignore l’ajout et conserve la ligne existante.']];
  assert.deepEqual(rows, RECAP, 'la vidéo : les trois idées');
  assert.ok(rows.every(r => !/^\d+[.)]/.test(r[1])), 'aucun titre numéroté');
  const fiche = html.slice(html.indexOf('guide({ id:26,'), html.indexOf('guide({ id:27,'));
  const idees = [...fiche.matchAll(/\["(✍️|📚|🔁)","([^"]*)","([^"]*)"(?:,"([^"]*)")?\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.deepEqual(idees, RECAP, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(page.includes('recapScene(RECAP, [RECAP + 0.7, RECAP + 2.1, RECAP + 3.5]);'), 'chaque idée se révèle à son tour');
  /* Dans la vidéo, chaque puce de « Gérer un doublon » commence sa propre ligne. */
  assert.ok((page.match(/<span class="bl">• /g) || []).length === 2 && page.includes('#s7 .rtxt .rs .bl{display:block;'), 'une ligne par puce');
});

test('ce que la vidéo ne reprend pas des deux anciens cours : plus de RETURNING, de INSERT … SELECT, de OR IGNORE ni de OR REPLACE ; le chapitre ne parle pas de SQL comme d’une personne', () => {
  const caps = val('CAPTIONS').map(c => strip(c[2])).join(' ');
  for (const mot of ['RETURNING', 'INSERT OR', 'OR REPLACE', 'OR IGNORE', 'excluded', 'SELECT nom']) assert.ok(!caps.includes(mot) && !page.includes(`>${mot}`), `la vidéo n’enseigne pas ${mot}`);
  assert.ok(!/SQL (voit|comprend|sait|lit)\b/.test(page), 'SQL n’est jamais personnifié');
});

test('zones à toucher : les trois lignes de la requête font au moins 64 px (le doigt) ; l’indice du moment 4 surligne la ligne de l’atelier 15, en typographie française', () => {
  const m = page.match(/\.sq \.ln\.vl\{height:(\d+)px;line-height:(\d+)px\}/);
  assert.ok(m && +m[1] >= 64 && m[1] === m[2], 'lignes de valeurs : hauteur de ligne = hauteur de zone, au moins 64 px');
  assert.ok(/if \(i === 3\) return \{text: '[^']+', keys: \['g3'\]\};/.test(page), 'indice du moment 4 : la troisième ligne (g3) ressort');
  assert.ok(/return h && Object\.assign\(h, \{text: fr\(h\.text\)\}\);/.test(page), 'l’indice passe par la typographie française (espaces insécables)');
});
