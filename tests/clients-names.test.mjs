/* Table clients : le prénom (prenom) et le nom de famille (nom) sont deux colonnes distinctes.
   La base, le schéma affiché dans la Console et les textes des cours restent d'accord. */
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
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const db = new SQL.Database(); db.run(vm.runInContext('SCHEMA_SQL', ctx));
const rows = sql => (db.exec(sql)[0] || { values: [] }).values;

test('clients : id, prenom, nom (famille), ville… — deux colonnes distinctes pour le prénom et le nom', () => {
  assert.deepEqual(rows('PRAGMA table_info(clients)').map(r => r[1]), ['id', 'prenom', 'nom', 'ville', 'age', 'email', 'telephone', 'date_inscription']);
  const notNull = Object.fromEntries(rows('PRAGMA table_info(clients)').map(r => [r[1], r[3]]));
  assert.equal(notNull.prenom, 1, 'le prénom est obligatoire');
});

test('chaque client a un prénom et un nom de famille, différents l’un de l’autre', () => {
  const all = rows('SELECT id, prenom, nom FROM clients ORDER BY id');
  assert.equal(all.length, 10);
  for (const [id, prenom, nom] of all) {
    assert.ok(prenom && nom, `client ${id} : prénom et nom renseignés`);
    assert.notEqual(prenom, nom, `client ${id} : le nom de famille n’est pas le prénom`);
  }
  assert.equal(new Set(all.map(r => `${r[1]} ${r[2]}`)).size, 10, 'aucun homonyme complet');
});

test('les deux Nathan de Paris se distinguent par leur nom de famille, et l’e-mail de l’un le reflète', () => {
  const n = rows("SELECT id, nom, email FROM clients WHERE prenom = 'Nathan' ORDER BY id");
  assert.deepEqual(n.map(r => [r[0], r[1]]), [[4, 'Petit'], [10, 'Dupont']]);
  assert.equal(n[1][2], 'nathan.dupont@mail.fr');
  assert.deepEqual(rows("SELECT DISTINCT ville FROM clients WHERE prenom = 'Nathan'"), [['Paris']]);
});

test('le schéma affiché dans la Console (SCHEMA_META) décrit la vraie base', () => {
  const meta = vm.runInContext('SCHEMA_META', ctx);
  for (const t of meta) {
    assert.deepEqual([...t.cols.map(c => c.c)], rows(`PRAGMA table_info(${t.table})`).map(r => r[1]), `colonnes de ${t.table}`);
    assert.equal(t.n, rows(`SELECT COUNT(*) FROM ${t.table}`)[0][0], `lignes de ${t.table}`);
  }
});

test('la scène du Problème du cours WHERE montre prenom, nom et ville : de vrais clients, et seuls les non-parisiens sont écartés', () => {
  const sc = vm.runInContext('GUIDE_SCENES', ctx)[4];
  assert.ok(sc, 'le cours WHERE a une scène animée');
  const [head, ...lines] = sc.lanes;
  assert.deepEqual([...head.c.map(c => c[1])], ['prenom', 'nom', 'ville'], 'le nom de famille est la colonne du milieu');
  assert.equal(sc.cols.split(' ').length, 3, 'une colonne de la grille par colonne de la table');
  assert.ok(lines.length >= 4);
  const dimmed = new Set(sc.steps.flatMap(s => [...(s.dim || [])]));
  for (const lane of lines) {
    assert.equal(lane.c.length, 3, `${lane.k} : prénom, nom, ville`);
    const [prenom, nom, ville] = lane.c.map(c => c[1]);
    assert.equal(rows(`SELECT COUNT(*) FROM clients WHERE prenom='${prenom}' AND nom='${nom}' AND ville='${ville}'`)[0][0], 1, `${prenom} ${nom} (${ville}) est un vrai client de la table`);
    assert.equal(dimmed.has(lane.k), ville !== 'Paris', `${prenom} ${nom} : écarté si et seulement s’il n’habite pas à Paris`);
  }
});

test('les cours ne désignent plus un client par « Nathan n°… » et ne parlent plus de « nom » pour un prénom dans les cartes d’infos', () => {
  assert.ok(!/Nathan n°\s?\d/.test(html), 'jamais « Nathan n°10 » : simplement Nathan');
  assert.ok(!html.includes('<b>👤 Nom du client</b>') && !html.includes('<b>👤 Nom et e-mail du client</b>'), 'les cartes « Où se trouve chaque information » disent « Prénom »');
});
