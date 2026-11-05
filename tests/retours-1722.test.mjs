/* Elisa, 5 novembre, 17 h 22 : « Une limite reste : les autres infos du fichier (version, language, question_count) ne sont pas
   importées, seules les listes deviennent des tables. Il y a un moyen de corriger ? » Tout ce qu’un fichier JSON porte à côté de ses
   listes va dans une table infos d’une seule ligne, une colonne par information, dans l’ordre du fichier ; chaque valeur garde son type
   JSON (« 1.0 » reste le texte d’une version, 100 un nombre). Sa carte se décrit d’elle-même, et le compte rendu de l’import dit ce
   qu’elle garde. Vérifié dans un navigateur (402 px) avec son fichier : question_count = COUNT(*) sur questions. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(ROOT, 'vendor/sqljs', f) });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ctx = vm.createContext({ SCHEMA_META: [], esc, window: {},
  plur: (n, mot, pl) => n + ' ' + (Math.abs(n) > 1 ? (pl || mot + 's') : mot) });
vm.runInContext(cut('function quoteIdent(name){', '\n') + '\n' + cut('function tableRowCount(database,name){', '\n}\n') + '\n}\n'
  + fn('safeIdent') + cut('function guessFkTarget(col,tables){', 'function courseTableNames(){')
  + cut('const UML_TEINTES=', '/* « Voir ses colonnes » : sa pastille')
  + cut('/* ---------- Import CSV / JSON / SQL ---------- */', '/* Un fichier, quel qu’il soit :') + fn('importRetourHtml')
  + 'async ' + fn('createImportedTables')
  + ';Object.assign(this,{parseImportFile,parseJsonImport,jsonTableInfos,JSON_INFOS_NOTE,importRetourHtml,createImportedTables});', ctx);
const pur = x => JSON.parse(JSON.stringify(x));
const FICHIER = { title: 'Requête — Entretiens Data Analyst', version: '1.0.0', language: 'fr-FR',
  description: '100 questions orales avec réponse attendue et exemple métier.', levels: ['Débutant', 'Intermédiaire', 'Avancé'],
  categories: [{ name: 'Culture data et architecture', count: 2 }], question_count: 2,
  questions: [{ id: 'DA-001', categorie: 'Culture data et architecture', question: "Quel est le rôle d'un Data Analyst ?" },
    { id: 'DA-002', categorie: 'Culture data et architecture', question: "Qu'est-ce qu'un KPI ?" }] };
const importer = async p => { const d = new SQL.Database(); await ctx.createImportedTables(d, p.tables); return d; };
const une = (d, sql) => d.exec(sql)[0].values[0];

test('son fichier : les trois listes, puis infos, une ligne avec title, version, language, description, question_count', async () => {
  const p = ctx.parseImportFile('Requete_Entretiens_Data_Analyst_100_Questions.json', JSON.stringify(FICHIER));
  assert.equal(p.kind, 'database');
  assert.deepEqual(pur(p.tables.map(t => [t.name, t.rows.length])), [['levels', 3], ['categories', 1], ['questions', 2], ['infos', 1]],
    'infos en dernier : les données d’abord, et « Ajouter une table » descend jusqu’à la première liste');
  const inf = p.tables[3];
  assert.deepEqual(pur(inf.cols), ['title', 'version', 'language', 'description', 'question_count'], 'dans l’ordre du fichier');
  assert.deepEqual(pur(inf.types), ['TEXT', 'TEXT', 'TEXT', 'TEXT', 'INTEGER']);
  assert.equal(inf.infos, true);
  assert.equal(inf.note, ctx.JSON_INFOS_NOTE);
  assert.equal(p.hint, '4 tables · 7 lignes');
  assert.equal(p.titre, 'Requête — Entretiens Data Analyst', 'le titre nomme toujours le projet');
  const d = await importer(p);
  assert.deepEqual(une(d, 'SELECT question_count, (SELECT COUNT(*) FROM questions), version, language FROM infos'), [2, 2, '1.0.0', 'fr-FR'],
    'question_count se vérifie avec un COUNT(*) sur questions');
  assert.deepEqual(une(d, 'SELECT typeof(question_count), typeof(version) FROM infos'), ['integer', 'text']);
});

test('chaque valeur garde son type JSON : « 1.0 » et « 2.10 » restent du texte, un objet son JSON, null un NULL', async () => {
  const p = ctx.parseJsonImport({ version: '1.0', release: '2.10', total: 3, taux: 0.5, publie: true, auteur: { nom: 'Elisa' }, vide: null,
    items: [{ a: 1 }, { a: 2 }, { a: 3 }] });
  const inf = p.tables.find(t => t.infos);
  assert.deepEqual(pur(inf.types), ['TEXT', 'TEXT', 'INTEGER', 'REAL', 'TEXT', 'TEXT', 'TEXT']);
  const d = await importer(p);
  assert.deepEqual(une(d, 'SELECT version, release, total, taux, publie, auteur, vide IS NULL FROM infos'),
    ['1.0', '2.10', 3, 0.5, 'true', '{"nom":"Elisa"}', 1], 'deviné, « 1.0 » serait devenu 1');
  assert.deepEqual(une(d, 'SELECT total = COUNT(*) FROM infos, items'), [1]);
});

test('une liste et des informations autour : deux tables ; une liste seule, ou pas de liste : une table, comme avant', () => {
  const a = ctx.parseJsonImport({ total: 1, page: 1, data: [{ id: 7 }] });
  assert.equal(a.kind, 'database');
  assert.deepEqual(pur(a.tables.map(t => [t.name, t.cols])), [['data', ['id']], ['infos', ['total', 'page']]]);
  assert.equal(a.hint, '2 tables · 2 lignes');
  const b = ctx.parseJsonImport({ data: [{ id: 7 }] });
  assert.equal(b.kind, 'table');
  assert.equal(b.hint, '1 ligne · id', '« 1 ligne », plus « 1 lignes »');
  const c = ctx.parseJsonImport({ nom: 'Thé', prix: 4 });
  assert.equal(c.kind, 'table', 'un objet sans liste : sa ligne, comme avant');
  assert.equal(ctx.parseJsonImport([{ id: 1 }, { id: 2 }]).kind, 'table');
  /* Une liste vide à côté d’une version : plus « JSON : table vide sans colonnes » */
  const e = ctx.parseJsonImport({ version: '1', items: [] });
  assert.deepEqual(pur(e.tables.map(t => [t.name, t.rows.length])), [['items', 0], ['infos', 1]]);
  assert.equal(e.hint, '2 tables · 1 ligne');
});

test('une liste qui s’appelle déjà infos : la table du fichier s’appelle infos_fichier', () => {
  const p = ctx.parseJsonImport({ infos: [{ a: 1 }], version: '3' });
  assert.deepEqual(pur(p.tables.map(t => t.name)), ['infos', 'infos_fichier']);
  assert.equal(ctx.jsonTableInfos({ x: 1 }, ['INFOS', 'infos_fichier']).name, 'infos_fichier_2');
  assert.equal(ctx.jsonTableInfos({ l: [] }, []), null, 'que des listes : pas de table infos');
  /* Deux clés qui donnent la même colonne */
  assert.deepEqual(pur(ctx.jsonTableInfos({ Titre: 'a', titre: 'b' }, []).cols), ['titre', 'titre_1']);
});

test('sa carte se décrit d’elle-même, et le compte rendu dit ce qu’elle garde', () => {
  const ci = fn('confirmImport');
  assert.ok(ci.includes("const infosT=p.format==='json-db'?(p.tables||[]).find(t=>t.infos):null;"));
  assert.ok(ci.includes('if(infosN&&infosT.note){ const pj=projOf(target); pj.tdesc=pj.tdesc||{}; if(!pj.tdesc[infosN]){ pj.tdesc[infosN]=infosT.note;'),
    'une description déjà écrite reste');
  assert.ok(ci.includes('importRetourHtml(database,tabs,tn,asDb,affected.length>1&&!asDb?affected:null,infosN?{n:infosN,c:infosT.cols}:null)'));
  const d = new SQL.Database();
  d.run('CREATE TABLE infos(title TEXT, version TEXT); CREATE TABLE questions(id TEXT);');
  const h = ctx.importRetourHtml(d, ['infos', 'questions'], null, true, null, { n: 'infos', c: ['title', 'version'] });
  assert.ok(h.includes('<p class="imp-infos"><code>infos</code> garde sur une ligne les autres informations du fichier&nbsp;: <code>title</code>, <code>version</code>.</p>'));
  const aj = ctx.importRetourHtml(d, ['infos', 'questions'], null, false, ['questions', 'infos'], { n: 'infos', c: ['title', 'version'] });
  assert.ok(aj.includes('<b>Tables ajoutées</b>') && aj.includes('class="imp-infos"'), 'ajoutées à un projet aussi');
  assert.ok(!ctx.importRetourHtml(d, ['infos', 'questions'], null, true, null, null).includes('imp-infos'), 'un classeur : rien à dire');
});
