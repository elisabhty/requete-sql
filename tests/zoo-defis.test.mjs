/* Les défis Zoo disponibles sont vérifiés sur le seed réellement embarqué. */
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
const zoo = challenges.filter(c => c.base === 'zoo');
const seedBlock = cut("zoo:{nom:'Zoo',", '\n`},\n  fromagerie:');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => zoo.find(c => c.id === id);

test('le Zoo a dix défis par niveau, du Facile 1 au Difficile 10', () => {
  assert.equal(challenges.length, 267);
  assert.equal(zoo.length, 30);
  const niveau = { f: 0, m: 1, d: 2 };
  const tries = [...zoo].sort((a, b) => niveau[a.niv] - niveau[b.niv] || Number(a.id.slice(2)) - Number(b.id.slice(2)));
  assert.deepEqual(tries.map(c => c.id), [
    ...Array.from({ length: 10 }, (_, i) => `zf${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `zm${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `zd${i + 1}`),
  ]);
  assert.ok(zoo.every(c => c.niv === c.id[1] && c.titre && (c.situation && c.affiche.length) && c.sol && c.indice), 'énoncés complets');
});

test('les solutions Zoo s’exécutent et leurs tris restent stables', () => {
  for (const c of zoo) {
    const db = base();
    const result = db.exec(c.sol);
    const rows = result[0]?.values ?? [];
    assert.ok(rows.length, `${c.id}: résultat non vide (zm8 et zd6, vides, refaits le 4 novembre à 22 h 08)`);
    db.run('PRAGMA reverse_unordered_selects = ON');
    assert.deepEqual(db.exec(c.sol)[0]?.values ?? [], rows, `${c.id}: ordre stable`);
    db.close();
  }
});

test('les résultats repères du classement, des repas variés et des dépenses par ville correspondent au seed', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  assert.deepEqual(rows('zd8'), [['Karim', 'Benali', 3, 1], ['Sophie', 'Martin', 3, 1], ['Julien', 'Morel', 3, 1], ['Laura', 'Dubois', 2, 4], ['Nadia', 'Cherif', 1, 5], ['Thomas', 'Lefevre', 1, 5], ['Emma', 'Rousseau', 1, 5], ['Antoine', 'Girard', 0, 8]]);
  assert.deepEqual(rows('zd9'), [['Dumbo', 2, 3], ['Nala', 2, 2], ['Nanuq', 2, 2], ['Simba', 2, 2]]);
  assert.deepEqual(rows('zd10'), [['Londres', 'Oliver', 'Smith', 18, 15], ['Madrid', 'Lucia', 'Fernandez', 45, 31.5], ['Paris', 'Manon', 'Lambert', 63, 45]]);
  assert.deepEqual(rows('zm9').map(r => r[0]), ['Kom']);
  assert.deepEqual(rows('zd3'), [['2024-09-01', 5, null, null], ['2024-09-01', 4.5, 5, -0.5]]);
  db.close();
});
