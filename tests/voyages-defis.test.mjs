/* Les trois lots Agence de voyages sont évalués sur le seed réellement embarqué. */
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
const voyages = challenges.filter(c => c.base === 'voyages');
const seedBlock = cut("voyages:{nom:'Agence de voyages',", '\n`}');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => voyages.find(c => c.id === id);

test('le catalogue contient trente défis Agence de voyages, dix par niveau', () => {
  assert.equal(challenges.length, 267);
  assert.equal(voyages.length, 30);
  for (const [prefix, level] of [['vf', 'f'], ['vm', 'm'], ['vd', 'd']]) {
    const group = voyages.filter(c => c.id.startsWith(prefix));
    assert.equal(group.length, 10, prefix);
    assert.ok(group.every(c => c.niv === level && c.base === 'voyages'), prefix);
  }
  assert.deepEqual(voyages.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'vf' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'vm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'vd' + (i + 1))]);
  for (const c of voyages) assert.ok(c.titre && (c.situation && c.affiche.length) && c.sol && c.indice && Number.isInteger(c.apres), c.id);
});

test('les réservations pédagogiques respectent les clés et couvrent les cinq continents', () => {
  const db = base();
  assert.equal(db.exec('SELECT COUNT(*) FROM reservations')[0].values[0][0], 50);
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
  assert.deepEqual(db.exec("SELECT COUNT(DISTINCT d.continent) FROM reservations r JOIN circuits ci ON ci.id = r.circuit_id JOIN destinations d ON d.id = ci.destination_id WHERE r.client_id = 21")[0].values, [[5]]);
  assert.deepEqual(db.exec("SELECT COUNT(*) FROM reservations WHERE client_id = 13 AND circuit_id = 8")[0].values, [[3]]);
  db.close();
});

test('les 30 solutions voyages renvoient des résultats non vides et des tris stables', () => {
  for (const c of voyages) {
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

test('les résultats repères vérifient les filtres et fonctions de fenêtre', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  assert.deepEqual(rows('vf1'), [[26, '2024-10-10', 'Annulée'], [32, '2024-12-10', 'Annulée']]);
  assert.deepEqual(rows('vf2'), [['Hugo', 'Bernard', 'hugo.bernard@mail.fr']]);
  assert.deepEqual(rows('vf8'), [['Antoine', 'Girard', 'Allemand']]);
  assert.deepEqual(rows('vf10'), [['Patagonie découverte', 'Patagonie', 2500], ['Fjords norvégiens', 'Norvège fjords', 2300]]);
  assert.deepEqual(rows('vd3'), [['2024-02-01', 3600, null, null], ['2024-11-01', 3800, 3600, 200]]);
  assert.deepEqual(rows('vd6'), [['Oliver', 'Smith', 5]]);
  assert.deepEqual(rows('vd9'), [['Sophie', 'Meyer', 'Aurores boréales', 3]]);
  db.close();
});
