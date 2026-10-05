/* Le schéma affiché (explorateur de la Console, feuille « Schéma », autocomplétion) est lu dans la base elle-même :
   un ALTER TABLE, un CREATE TABLE ou un DROP faits dans la Console y apparaissent aussitôt. Les requêtes des cours,
   elles, partent sur une copie jetable : la base du cours ne change pas et le résultat le dit. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
/* Une fonction du fichier : de « function nom( » jusqu'à la fonction suivante. */
const fn = name => {
  const a = html.indexOf(`function ${name}(`);
  assert.ok(a >= 0, `function ${name}( présente`);
  const b = html.indexOf('\nfunction ', a + 10);
  return html.slice(a, b);
};
for (const name of ['quoteIdent', 'listTables', 'guessFkTarget', 'annotateColumnKeys', 'introspectTable', 'schemaVersion']) vm.runInContext(fn(name), ctx);
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const fresh = () => { const d = new SQL.Database(); d.run(vm.runInContext('SCHEMA_SQL', ctx)); return d; };
const cols = (d, t) => JSON.parse(JSON.stringify(ctx.introspectTable(d, t))).map(c => c.c);

test('base intacte : le schéma lu dans la base est celui des métadonnées du cours (4 tables)', () => {
  const d = fresh();
  const meta = JSON.parse(JSON.stringify(vm.runInContext('SCHEMA_META', ctx)));
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.listTables(d))), meta.map(t => t.table).sort());
  for (const t of meta) {
    const live = JSON.parse(JSON.stringify(ctx.introspectTable(d, t.table)));
    assert.deepEqual(live.map(c => [c.c, c.t, c.b || undefined]), t.cols.map(c => [c.c, c.t, c.b]), `${t.table} : colonnes, types, clés`);
  }
});

test('ALTER TABLE ADD COLUMN : la colonne apparaît dans le schéma, la version du schéma change', () => {
  const d = fresh();
  const v0 = ctx.schemaVersion(d);
  assert.ok(!cols(d, 'clients').includes('pays'));
  d.run("ALTER TABLE clients ADD COLUMN pays TEXT DEFAULT 'France'");
  const c = JSON.parse(JSON.stringify(ctx.introspectTable(d, 'clients')));
  assert.equal(c.at(-1).c, 'pays');
  assert.equal(c.at(-1).t, 'TEXT');
  assert.equal(c.length, 10);
  assert.notEqual(ctx.schemaVersion(d), v0, 'le numéro de version du schéma change (clé du cache d’autocomplétion)');
});

test('CREATE TABLE puis DROP TABLE : la table apparaît puis disparaît du schéma', () => {
  const d = fresh();
  d.run('CREATE TABLE test_x (a INTEGER, b TEXT)');
  assert.ok(ctx.listTables(d).includes('test_x'));
  assert.deepEqual(cols(d, 'test_x'), ['a', 'b']);
  d.run('DROP TABLE test_x');
  assert.ok(!ctx.listTables(d).includes('test_x'));
});

test('une modification de données ne change pas le numéro de version du schéma', () => {
  const d = fresh();
  const v0 = ctx.schemaVersion(d);
  d.run("INSERT INTO produits (nom, categorie, prix, stock) VALUES ('Zinc', 'Bien-être', 17.9, 40)");
  assert.equal(ctx.schemaVersion(d), v0);
});

test('autocomplétion : le catalogue suit la version du schéma, et le schéma de la Console est lu dans la base', () => {
  const cat = html.slice(html.indexOf('function kbarSchemaCatalog('), html.indexOf('function kbarLessonHints('));
  assert.ok(cat.includes('schemaVersion(database)'), 'clé du cache = identifiant de la base + version du schéma');
  const intro = fn('introspectTable');
  assert.ok(!/activeDbId==='cours'/.test(intro), 'plus de métadonnées figées pour la base du cours');
  assert.ok(intro.includes('PRAGMA table_info('), 'colonnes lues avec PRAGMA table_info');
});

test('cours : une structure créée, modifiée ou supprimée part sur une copie jetable, et le résultat le dit', () => {
  const run = html.slice(html.indexOf('function runExemple('), html.indexOf('function openVizSql('));
  assert.ok(run.includes('testeNeedsSandbox(runSql)'), 'la requête d’un cours part sur une copie si elle écrit');
  assert.ok(run.includes('xf-copy-note') && /CREATE\|ALTER\|DROP/.test(run), 'note « Exécuté sur une copie » pour CREATE, ALTER, DROP');
  assert.ok(/Exécuté sur une copie : la base du cours n’est pas modifiée/.test(run));
  assert.ok(html.includes('#scr-lesson .xf-result p.xf-copy-note'), 'style de la note');
});
