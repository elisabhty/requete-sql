/* Les trois lots Fromagerie sont évalués sur le seed réellement embarqué. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({});
vm.runInContext(cut('const CHALLENGES=[', '\nfunction defisParProgression(){').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
const challenges = JSON.parse(JSON.stringify(ctx.CHALLENGES));
const fromagerie = challenges.filter(c => c.base === 'fromagerie');
const seedBlock = cut("fromagerie:{nom:'Fromagerie',", '\n`},\n  labo:');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => fromagerie.find(c => c.id === id);

test('le catalogue contient trente défis Fromagerie, dix par niveau', () => {
  assert.equal(fromagerie.length, 30);
  for (const [prefix, level] of [['ff', 'f'], ['fm', 'm'], ['fd', 'd']]) {
    const group = fromagerie.filter(c => c.id.startsWith(prefix));
    assert.equal(group.length, 10, prefix);
    assert.ok(group.every(c => c.niv === level && c.base === 'fromagerie'), prefix);
  }
  assert.deepEqual(fromagerie.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'ff' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'fm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'fd' + (i + 1))]);
  for (const c of fromagerie) assert.ok(c.titre && (c.situation && c.affiche.length) && c.sol && c.indice && Number.isInteger(c.apres), c.id);
});

test('les ventes pédagogiques respectent les clés, les lots et le panier de Camille', () => {
  const db = base();
  assert.equal(db.exec('SELECT COUNT(*) FROM ventes')[0].values[0][0], 55);
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
  assert.deepEqual(db.exec('SELECT ROUND(SUM(prix_total), 2) FROM ventes WHERE client_id = 1')[0].values, [[59]]);
  assert.deepEqual(db.exec('SELECT COUNT(DISTINCT f.type_pate) FROM ventes v JOIN lots l ON l.id = v.lot_id JOIN fromages f ON f.id = l.fromage_id WHERE v.client_id = 1')[0].values, [[5]]);
  assert.deepEqual(db.exec('SELECT COUNT(*) FROM (SELECT l.id FROM lots l JOIN ventes v ON v.lot_id = l.id GROUP BY l.id HAVING SUM(v.quantite_kg) > l.poids_kg)')[0].values, [[0]]);
  db.close();
});

test('les 30 solutions Fromagerie renvoient des résultats non vides et des tris stables', () => {
  for (const c of fromagerie) {
    const db = base();
    const result = db.exec(c.sol)[0]?.values ?? [];
    assert.ok(result.length > 0, `${c.id}: au moins une ligne`);
    if (c.ordered) {
      db.run('PRAGMA reverse_unordered_selects = ON');
      assert.deepEqual(db.exec(c.sol)[0].values, result, `${c.id}: ordre entièrement fixé`);
    }
    db.close();
  }
});

test('les résultats repères reflètent les données ajoutées et les requêtes corrigées', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  assert.deepEqual(rows('fm5'), [['Camille', 'Moreau', 59]]);
  assert.deepEqual(rows('fd6'), [['Camille', 'Moreau']]);
  assert.deepEqual(rows('fd7'), [['Camille', 'Moreau', 'Beaufort', 3]]);
  assert.equal(rows('fd8')[0][0], db.exec('SELECT COUNT(DISTINCT f.id) FROM fromages f JOIN lots l ON l.fromage_id = f.id JOIN ventes v ON v.lot_id = l.id')[0].values[0][0]);
  assert.deepEqual(rows('fm1')[0], ['Toscane', 144.75]);
  db.close();
});
