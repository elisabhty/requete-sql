/* Elisa, 5 novembre, 16 h 56 : « c’était un fichier pour que tu testes la partie requête » : son fichier
   « Requete_Entretiens_Data_Analyst_100_Questions.json » (title, version, description, trois listes : levels, categories, questions),
   importé dans la Console, puis interrogé (GROUP BY, jointure, LIKE avec apostrophe, accents, LENGTH, UPDATE puis Réinitialiser,
   « Ajouter une table » dans un autre projet). Tout passait ; ce qu’il a montré, et qui ne doit pas revenir :
   - le projet s’appelait « Requete_Entretiens_Data_Analyst_100_Ques » (le nom du fichier coupé à 40 caractères), et ce nom sans espace
     sortait de l’écran dans la feuille Schéma ; le titre et la description du fichier étaient perdus ;
   - « 0 lien » dans le schéma UML : questions.categorie désigne pourtant categories.name, et aucune jointure n’était proposée ;
   - une réponse de 240 caractères tenait sur une seule ligne du résultat, large de plusieurs écrans.
   Vérifié dans un navigateur (402 px), avec son fichier. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(ROOT, 'vendor/sqljs', f) });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ctx = vm.createContext({ SCHEMA_META: [], esc, window: {},
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot) });
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + fn('safeIdent') + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', '/* « Voir ses colonnes » : sa pastille')
  + cut('/* ---------- Import CSV / JSON / SQL ---------- */', '/* Un fichier, quel qu’il soit :') + fn('importRetourHtml') + fn('nomDeFichierLisible')
  + ';Object.assign(this,{umlModele,umlJoin,parseImportFile,parseJsonImport,jsonInfos,importRetourHtml,nomDeFichierLisible});', ctx);
const pur = x => JSON.parse(JSON.stringify(x));
const ouvrir = sql => { const d = new SQL.Database(); d.run(sql); return d; };
const FICHIER = JSON.stringify({ title: 'Requête — Entretiens Data Analyst', version: '1.0.0', language: 'fr-FR',
  description: '100 questions orales avec réponse attendue et exemple métier.', levels: ['Débutant', 'Intermédiaire', 'Avancé'],
  categories: [{ name: 'Culture data et architecture', count: 1 }, { name: 'KPI, produit et analyse métier', count: 1 }], question_count: 2,
  questions: [{ id: 'DA-001', categorie: 'Culture data et architecture', niveau: 'Débutant', question: "Quel est le rôle d'un Data Analyst ?" },
    { id: 'DA-055', categorie: 'KPI, produit et analyse métier', niveau: 'Intermédiaire', question: "Qu'est-ce qu'un KPI ?" }] });

test('le titre et la description du fichier nomment et décrivent le projet ; sinon, un nom de fichier lisible', () => {
  const p = pur(ctx.parseImportFile('Requete_Entretiens_Data_Analyst_100_Questions.json', FICHIER));
  assert.equal(p.kind, 'database');
  assert.deepEqual(p.tables.map(t => [t.name, t.rows.length]), [['levels', 3], ['categories', 2], ['questions', 2]]);
  assert.equal(p.titre, 'Requête — Entretiens Data Analyst');
  assert.equal(p.desc, '100 questions orales avec réponse attendue et exemple métier.');
  assert.deepEqual(pur(ctx.jsonInfos({ titre: '  Mes  ventes ', items: [] })), { titre: 'Mes ventes', desc: '' });
  assert.deepEqual(pur(ctx.jsonInfos({ title: 42 })), { titre: '', desc: '' }, 'seulement du texte');
  /* Le nom proposé, sans titre : lisible et coupé entre deux mots */
  assert.equal(ctx.nomDeFichierLisible('Requete_Entretiens_Data_Analyst_100_Questions.json'), 'Requete Entretiens Data Analyst 100');
  assert.equal(ctx.nomDeFichierLisible('ventes_2025.csv'), 'ventes 2025');
  assert.equal(ctx.nomDeFichierLisible('.json'), 'Import');
  assert.equal(ctx.nomDeFichierLisible('x'.repeat(60) + '.csv').length, 40);
  const on = fn('onDataImport');
  assert.ok(on.includes('defaultDbName:parsed.titre?parsed.titre.slice(0,40):nomDeFichierLisible(file.name),'));
  assert.ok(fn('confirmImport').includes('if(neuf&&p.desc){ const pj=projOf(target); if(!pj.desc){ pj.desc=p.desc; try{ saveProjState(); }catch(e){} } }'), 'un nouveau projet seulement');
  assert.ok(lq.includes('html.lq #schema-sheet .viz-head b,html.lq #schema-sheet .viz-head h2{min-width:0;overflow-wrap:anywhere}'));
});

test('un lien par un nom : questions.categorie → categories.name, avec sa jointure toute prête', () => {
  const d = ouvrir(`CREATE TABLE categories(name TEXT, count INTEGER); INSERT INTO categories VALUES ('Culture data et architecture',1),('KPI, produit et analyse métier',1);
    CREATE TABLE questions(id TEXT, categorie TEXT, niveau TEXT); INSERT INTO questions VALUES ('DA-001','Culture data et architecture','Débutant'),('DA-055','KPI, produit et analyse métier','Intermédiaire');
    CREATE TABLE levels(valeur TEXT); INSERT INTO levels VALUES ('Débutant'),('Intermédiaire'),('Avancé');`);
  const m = ctx.umlModele(d, ['categories', 'levels', 'questions'], true);
  assert.deepEqual(pur(m.liens.map(l => [l.de, l.col, l.vers, l.versCol, l.un, l.plusieurs, !!l.devine])), [['questions', 'categorie', 'categories', 'name', '1', '0..*', true]]);
  assert.equal(ctx.umlJoin(m, m.liens[0]), 'FROM questions JOIN categories ON questions.categorie = categories.name');
  assert.ok(ctx.importRetourHtml(d, ['categories', 'levels', 'questions'], null, true).includes('<p class="imp-liens">Lien trouvé&nbsp;: <code>questions.categorie</code> → <code>categories</code>.</p>'));
  /* Une valeur absente de la table désignée, ou des doublons dans sa colonne : pas de lien */
  d.run("INSERT INTO questions VALUES ('DA-200','Inconnue','Avancé')");
  assert.equal(ctx.umlModele(d, ['categories', 'levels', 'questions'], true).liens.length, 0);
  d.run("DELETE FROM questions WHERE id='DA-200'; INSERT INTO categories VALUES ('Culture data et architecture',2)");
  assert.equal(ctx.umlModele(d, ['categories', 'levels', 'questions'], true).liens.length, 0, 'une colonne avec des doublons ne désigne rien');
  d.close();
  /* « pays » désigne la table « pays » ; un client_id reste un lien par sa clé, pas en double */
  const e = ouvrir(`CREATE TABLE pays(code TEXT, nom TEXT); INSERT INTO pays VALUES ('FR','France'),('IT','Italie');
    CREATE TABLE clients(id INTEGER PRIMARY KEY, pays TEXT); INSERT INTO clients VALUES (1,'France'),(2,'Italie'),(3,NULL);
    CREATE TABLE commandes(id INTEGER PRIMARY KEY, client_id INTEGER); INSERT INTO commandes VALUES (1,1);`);
  const m2 = ctx.umlModele(e, ['clients', 'commandes', 'pays'], true);
  assert.deepEqual(pur(m2.liens.map(l => `${l.de}.${l.col} -> ${l.vers}.${l.versCol || 'id'} [${l.un}]`)).sort(), ['clients.pays -> pays.nom [0..1]', 'commandes.client_id -> clients.id [1]'],
    'le nom (« nom ») plutôt que le code ; une valeur vide : 0..1');
  e.close();
});

test('un long texte du résultat : trois lignes dans la Console, déplié d’un toucher ; les textes courts ne changent pas', () => {
  const f = vm.createContext({ esc });
  vm.runInContext(cut('function fmtCell(v){', '\n}\n') + '\n}', f);
  assert.equal(f.fmtCell('Débutant'), '<td>Débutant</td>');
  assert.equal(f.fmtCell(null), '<td class="null">NULL</td>');
  assert.equal(f.fmtCell(12.345), '<td class="num">12.35</td>');
  const long = 'Il transforme des données en informations utiles à la décision : cadrer le besoin, collecter, nettoyer.';
  assert.equal(f.fmtCell(long), `<td class="is-long"><span>${long}</span></td>`);
  assert.ok(f.fmtCell('p < 0,05 '.repeat(8)).includes('p &lt; 0,05'), 'échappé');
  assert.ok(app.includes("const td=e.target&&e.target.closest?e.target.closest('#console-out td.is-long'):null;") && app.includes("td.classList.toggle('is-open');"));
  for (const k of ['html.lq #console-out .table-wrap tbody td.is-long{white-space:normal;text-align:left;vertical-align:top;cursor:pointer}',
    'html.lq #console-out .table-wrap tbody td.is-long>span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;width:max-content;min-width:11em;max-width:17em;',
    'html.lq #console-out .table-wrap tbody td.is-long.is-open>span{display:block;-webkit-line-clamp:unset}'])
    assert.ok(lq.includes(k), k);
});
