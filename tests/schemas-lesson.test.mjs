/* Projet NutriBoost, chapitre 7 (leçon 84 « Les schémas ») : la vidéo interactive assets/anim/projet-schemas.html, testée aussi dans
   lesson-video.test.mjs. Ajoutée le 30 octobre (le scénario d’Elisa : une base devenue difficile à gérer, tout est mélangé ; la ranger en
   espaces sans supprimer ni recréer les tables), transposé aux deux équipes de NutriBoost : la boutique et les ateliers. Dernier cours du
   module « Créer et faire évoluer les tables », juste après DROP et juste avant INSERT. Leçon seule.
   SQLite, la base de l’app, n’a pas de CREATE SCHEMA : ses tables sont dans le schéma main. Les schémas de la vidéo sont rejoués ici
   avec ATTACH, qui donne à SQLite des espaces nommés : deux tables du même nom y coexistent. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'assets/anim/projet-schemas.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l84 = lessons.find(l => l.id === 84);

/* Les données de la page (le déroulé des légendes, les tables, les six moments), évaluées telles quelles. */
const a = page.indexOf('const SCH = '), b = page.indexOf('/* ---------- Gabarits');
assert.ok(a > 0 && b > a, 'données de la page localisées');
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(a, b), D);
const val = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, D));
const strip = h => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- La base de la vidéo, telle que le chapitre 6 la laisse : huit tables (la copie du fichier Excel est retirée) ---------- */
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
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
const tables = db => db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(r => r[0]);
/* Les deux espaces de la vidéo, rejoués avec ATTACH : chaque table de la base est copiée dans son schéma. */
function espaces() {
  const db = base();
  db.run("ATTACH DATABASE ':memory:' AS boutique; ATTACH DATABASE ':memory:' AS bienetre;");
  for (const [, , , name, k] of val('TABLES')) db.run(`CREATE TABLE ${k === 'b' ? 'boutique' : 'bienetre'}.${name} AS SELECT * FROM main.${name};`);
  return db;
}

test('Les schémas : dernier cours du module « Créer et faire évoluer les tables », juste après DROP et juste avant INSERT', () => {
  const m = modules.find(x => x.titre === 'Créer et faire évoluer les tables');
  assert.deepEqual([...m.lessons.map(l => l.id)], [61, 65, 66, 84], 'CREATE TABLE, ALTER TABLE, DROP, Les schémas');
  const liste = lessons.map(l => l.id);
  assert.equal(liste.indexOf(84), liste.indexOf(66) + 1, 'juste après DROP');
  assert.equal(liste[liste.indexOf(84) + 1], 26, 'INSERT vient juste après');
  assert.equal(l84.titre, 'Les schémas');
  assert.equal(l84.résumé, 'Ranger les tables par espace');
  assert.equal(new Set(liste).size, liste.length, 'un identifiant par leçon');
});

test('recherche, carte mémo, et leçon seule sans texte de secours ni exercice', () => {
  const mots = html.match(/\n  84:'([^']+)',/)[1];
  assert.ok(['schema', 'create schema', 'adresse', 'meme nom', 'main', 'sqlite'].every(m => mots.includes(m)), 'trouvé par la recherche');
  assert.ok(l84.leconSeule && l84.video && !l84.situation && !l84.consigne && !l84.solution && !l84.petitDefi && !l84.learningCheck && !l84.testeVariants && !l84.anatomie, 'la vidéo est le cours');
  assert.equal(l84.video.moments, 6); assert.equal(l84.video.seuil, 4);
  assert.equal(l84.video.anim, 'assets/anim/projet-schemas.html?app&embed');
  const carte = vm.runInContext('CARTES[84]', ctx);
  assert.ok(carte && carte.s.includes('CREATE SCHEMA boutique;') && carte.s.includes('FROM boutique.commandes;'), 'une carte mémo à débloquer');
  const recap = l84.studio.reflex.extra;
  assert.ok(recap.includes('Les trois idées à retenir') && ['🗂️', '📍', '⚠️'].every(e => recap.includes(e)), 'les trois idées à retenir, comme à la fin de la vidéo');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./assets/anim/projet-schemas.html?app&embed'") && sw.includes("'./assets/anim/projet-schemas-thumb.webp'"), 'gardée pour le hors ligne');
});

test('le déroulé : légendes, chapitres, moments « À toi » et bouton « Ajouter à mes notes »', () => {
  const caps = val('CAPTIONS'), chaps = val('SCH.chaps'), picks = val('PICKS');
  assert.equal(val('NOTES'), 121.9);
  assert.ok(page.includes('notesAt: 121.9,'), 'notesAt écrit en clair, comme dans les autres vidéos');
  assert.equal(val('DURATION'), 129.1);
  for (let k = 1; k < caps.length; k++) assert.ok(caps[k][0] >= caps[k - 1][1] - 1e-9 || caps[k][1] === 999, `légende ${k + 1} : après la précédente`);
  chaps.forEach((c, k) => { if (k) assert.ok(c.a >= caps.filter(x => x[1] < c.a + 1e-9).slice(-1)[0][1] + 0.4 - 1e-9, `chapitre ${k + 1} : 0,4 s après la légende précédente`); });
  assert.deepEqual(chaps.map(c => c.label), ['Une base qui grandit', 'Deux espaces', 'CREATE SCHEMA', 'Une adresse', 'Le même nom', 'Les requêtes à réparer', 'Et dans SQLite ?', 'À retenir']);
  caps.forEach(([, , t, lines], k) => {
    const txt = strip(t);
    assert.ok(/^[A-ZÀ-ÖØ-Þ0-9«]/.test(txt) || /^(<b[^>]*>)?<code>/.test(t), `légende ${k + 1} : une phrase qui commence (« ${txt.slice(0, 50)} »)`);
    assert.ok(/[.!?»]$/.test(txt), `légende ${k + 1} : une phrase qui finit (« …${txt.slice(-50)} »)`);
    assert.ok(!/[.!?»] ?[A-ZÀ-ÖØ-Þ«]/.test(txt), `légende ${k + 1} : une seule phrase par bulle (« ${txt.slice(0, 70)} »)`);
    assert.equal(lines, undefined, `légende ${k + 1} : trois lignes au plus`);
    assert.ok(t.split('<br>').length <= 3, `légende ${k + 1} : trois lignes au plus`);
  });
  assert.deepEqual(picks.map(p => p.kind), ['sort', 'pick', 'pick', 'pick', 'sort', 'pick']);
  assert.deepEqual(picks.map(p => p.at), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => +(val(`A.${k}`) + 2.35).toFixed(2)));
  assert.ok(picks.every((p, k) => !k || p.at > picks[k - 1].at && p.from < p.at), 'dans l’ordre, chaque reprise commence avant son moment');
  for (const p of picks.filter(p => p.kind === 'pick')) {
    assert.equal(p.options.filter(o => o.ok).length, 1, `${p.prompt} : une seule bonne réponse`);
    assert.equal(p.options.length, 3, `${p.prompt} : trois réponses`);
    for (const o of p.options.filter(o => !o.ok)) assert.ok(o.why && strip(o.why).length > 30, `${o.label} : une correction qui explique le choix`);
  }
  assert.deepEqual([picks[0].options.length, picks[4].options.length], [8, 3], 'huit tables, puis trois requêtes');
  assert.ok(picks.every(p => !/cette requête|ci-dessus|ci-dessous/.test(p.prompt)), 'aucune question ne renvoie à une requête de l’image');
  assert.equal([...page.matchAll(/return \{text: '([^']+)'/g)].length, 6, 'six indices écrits : un par moment');
});

test('la base du chapitre 6 : huit tables (la copie du fichier Excel barrée puis retirée), chacune rangée dans l’espace de son équipe', () => {
  const db = base(), TB = val('TB'), T = val('TABLES');
  assert.deepEqual(T.map(t => t[3]).sort(), tables(db), 'les huit tables de la base, ni plus ni moins');
  assert.equal(TB[TB.length - 1][3], 'inscriptions_excel', 'la copie, en dernier : elle ne fait que rappeler le chapitre 6');
  assert.ok(page.includes('<span id="bn-a">9 tables</span><span id="bn-b">8 tables</span>') && page.includes("tl.to('#bw-xl', {height: 0,"), 'neuf tables, puis huit');
  assert.deepEqual(T.filter(t => t[4] === 'b').map(t => t[3]), ['clients', 'commandes', 'fidelite', 'produits'], 'la boutique');
  assert.deepEqual(T.filter(t => t[4] === 'a').map(t => t[3]), ['coachs', 'ateliers', 'inscriptions', 'cartes'], 'les ateliers');
  const P = val('POURQUOI');
  for (const t of T) assert.ok(strip(P[t[3]]).length > 40, `${t[3]} : une correction qui explique`);
  /* Les liens entre tables suivent ce rangement : les tables des ateliers désignent leurs coachs, ateliers et clients. */
  const fk = t => db.exec(`SELECT "table" FROM pragma_foreign_key_list('${t}')`)[0]?.values.flat() ?? [];
  assert.deepEqual([fk('ateliers'), fk('inscriptions').sort()], [['coachs'], ['ateliers', 'clients']]);
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.equal(caps[0], 'Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.');
  assert.equal(caps[1], 'Au chapitre 6, tu as retiré la copie du fichier Excel avec <code>DROP TABLE</code>.', 'le chapitre précédent');
  const mail = val('MAILS')[0];
  assert.deepEqual([mail[0][0], mail[0][1], mail[2]], ['Karim', 'Benali', 'développeur'], 'Karim écrit par mail, comme aux chapitres 4 et 6');
  assert.ok(strip(mail[4].join(' ')).includes('sans supprimer ni recréer aucune table'), 'la mission d’Elisa : ranger sans supprimer ni recréer');
});

test('les schémas, rejoués dans SQLite avec ATTACH : schéma.table, deux tables clients du même nom, les trois requêtes réparées', () => {
  const db = espaces();
  const n = q => db.exec(q)[0].values.length;
  assert.equal(n('SELECT * FROM boutique.commandes;'), 16, 'boutique.commandes : les seize commandes');
  assert.equal(n('SELECT * FROM bienetre.inscriptions;'), 7, 'bienetre.inscriptions : les sept inscriptions');
  assert.throws(() => db.exec('SELECT * FROM boutique.inscriptions;'), /no such table: boutique\.inscriptions/, 'les inscriptions ne sont pas dans la boutique');
  assert.throws(() => db.exec('SELECT * FROM inscriptions.bienetre;'), /no such table: inscriptions\.bienetre/, 'l’adresse commence par le schéma');
  /* L’équipe des ateliers crée sa propre table clients : deux tables du même nom, dans deux schémas. */
  db.run('CREATE TABLE bienetre.clients (id INTEGER PRIMARY KEY, prenom TEXT, nom TEXT);');
  db.run("INSERT INTO bienetre.clients VALUES (1, 'Julie', 'Nguyen');");
  assert.deepEqual([n('SELECT * FROM boutique.clients;'), n('SELECT * FROM bienetre.clients;')], [10, 1], 'deux tables distinctes : la seconde ne remplace pas la première');
  assert.deepEqual(val('PICKS')[3].options.map(o => [o.label, !!o.ok]), [['Oui, la seconde remplace la première', false], ['Non, leur schéma les distingue', true], ['Oui, il faut renommer l’une des deux', false]]);
  /* Les trois requêtes qui avaient perdu leur schéma. */
  const R = val('REQUETES');
  assert.deepEqual(R.map(x => x[0].replace('___', x[1] === 'b' ? 'boutique' : 'bienetre')), ['SELECT * FROM bienetre.cartes;', 'SELECT * FROM boutique.fidelite;', 'SELECT * FROM bienetre.coachs;']);
  for (const [q, k] of R) assert.ok(n(q.replace('___', k === 'b' ? 'boutique' : 'bienetre')) > 0, `${q} : la table est dans ce schéma`);
  for (const [q, k] of R) assert.throws(() => db.exec(q.replace('___', k === 'b' ? 'bienetre' : 'boutique')), /no such table/, `${q} : pas dans l’autre schéma`);
});

test('SQLite : pas de CREATE SCHEMA ; main.clients lit la table clients ; boutique.clients et clients.main sont refusés', () => {
  const db = base();
  assert.throws(() => db.run('CREATE SCHEMA boutique;'), /syntax error/, 'SQLite ne connaît pas CREATE SCHEMA');
  assert.equal(db.exec('SELECT * FROM main.clients;')[0].values.length, 10, 'main.clients : les dix clients de la base');
  assert.throws(() => db.exec('SELECT * FROM boutique.clients;'), /no such table: boutique\.clients/);
  assert.throws(() => db.exec('SELECT * FROM clients.main;'), /no such table: clients\.main/);
  assert.deepEqual(val('PICKS')[5].options.map(o => [o.label, !!o.ok]), [['SELECT * FROM boutique.clients;', false], ['SELECT * FROM main.clients;', true], ['SELECT * FROM clients.main;', false]]);
  assert.ok(page.includes("out('o-lite', 'ok', 'Requête exécutée', 'les 10 clients de la base.')") && page.includes("out('pv6-0', 'warn', 'Requête refusée', 'no such table: boutique.clients')"));
  const caps = val('CAPTIONS').map(c => c[2]);
  assert.ok(caps.includes('La base du projet garde donc<br>ses tables telles quelles.'), 'les chapitres suivants gardent la base telle quelle');
  assert.deepEqual(val('PICKS')[1].options.map(o => [o.label, !!o.ok]), [['CREATE TABLE bienetre;', false], ['CREATE SCHEMA bienetre;', true], ['CREATE DATABASE bienetre;', false]]);
});

test('chapitre 7 : écran titre ; annoncé par DROP, il annonce INSERT, qui s’ouvre sur lui ; le récapitulatif dans la vidéo comme dans la fiche', () => {
  assert.ok(page.includes('<title>Requête · Projet, chapitre 7 : Les schémas</title>') && page.includes('<div class="tagpill">Projet · Chapitre 7</div>')
    && page.includes('<div class="abs sub">Ranger les tables par espace</div>'));
  const drop = fs.readFileSync(path.join(root, 'assets/anim/projet-drop.html'), 'utf8');
  assert.ok(drop.includes('Prochaine leçon · Les schémas</span>'), 'le chapitre 6 annonce celui-ci');
  assert.ok(page.includes('Prochaine leçon · INSERT INTO</span>'), 'il annonce INSERT');
  const ins = fs.readFileSync(path.join(root, 'assets/anim/projet-insert.html'), 'utf8');
  assert.ok(ins.includes('Au chapitre 7, tu as découvert<br>les schémas, qui rangent<br>les tables par espace.'), 'INSERT s’ouvre sur ce chapitre');
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div><div class="rtxt">(.*?)<\/div><\/div>/g)].map(m => {
    const [phrase, detail] = m[2].split('<span class="rs">');
    return [m[1], strip(phrase), strip(detail.replace(/<\/span>$/, ''))];
  });
  const fiche = html.slice(html.indexOf('guide({ id:84,'), html.indexOf('guide({ id:26,'));
  const idees = [...fiche.matchAll(/\["(🗂️|📍|⚠️)","([^"]*)","([^"]*)"\]/g)].map(m => [m[1], strip(m[2]), strip(m[3])]);
  assert.equal(rows.length, 3);
  assert.deepEqual(idees, rows, 'la fiche de la leçon dit la même chose que la vidéo');
  assert.ok(!/SQL (voit|comprend|sait|lit|examine)\b/.test(page), 'SQL n’est jamais personnifié');
});
