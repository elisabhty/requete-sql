/* Les trois lots Wok Chinois sont testés sur le seed réellement proposé dans la Console. */
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
const all = JSON.parse(JSON.stringify(ctx.CHALLENGES));
const wok = all.filter(c => c.base === 'wok');
const block = cut("wok:{nom:'Wok Chinois',", '\n`},\n  zoo:');
const seed = block.slice(block.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => wok.find(c => c.id === id);

test('Wok Chinois : dix défis par niveau, tous rattachés à la bonne base', () => {
  assert.equal(wok.length, 30);
  for (const [prefix, level] of [['wf', 'f'], ['wm', 'm'], ['wd', 'd']]) {
    const group = wok.filter(c => c.id.startsWith(prefix));
    assert.equal(group.length, 10, prefix);
    assert.ok(group.every(c => c.niv === level && c.base === 'wok'), prefix);
  }
  assert.ok(app.includes("wok:{nom:'Wok Chinois',"));
  assert.ok(app.includes('Bienvenue à La Perle du Wok, un restaurant chinois spécialisé dans la cuisine au wok.'));
});

test('les commandes pédagogiques respectent les clés et couvrent septembre, octobre, novembre', () => {
  const db = base();
  assert.equal(db.exec('SELECT COUNT(*) FROM commandes')[0].values[0][0], 42);
  assert.equal(db.exec('SELECT COUNT(*) FROM lignes_commande')[0].values[0][0], 74);
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
  assert.deepEqual(db.exec("SELECT COUNT(DISTINCT strftime('%m',date_commande)) FROM commandes WHERE client_id=1")[0].values, [[3]]);
  assert.deepEqual(db.exec("SELECT COUNT(DISTINCT c.id) FROM commandes c JOIN lignes_commande l ON l.commande_id=c.id WHERE c.client_id=1 AND l.plat_id=5")[0].values, [[3]]);
  db.close();
});

test('les 30 solutions Wok Chinois renvoient des résultats non vides et des tris stables', () => {
  for (const c of wok) {
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

test('les cas Wok représentatifs ont des résultats de référence', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  assert.deepEqual(rows('wf1'), [['Poisson vapeur thaï', 16]]);
  assert.deepEqual(rows('wf8'), [['Franz', 'Bauer', 'franz.bauer@mail.at'], ['Lisa', 'Huber', 'lisa.huber@mail.at'], ['Elena', 'Keller', 'elena.keller@mail.ch']]);
  assert.deepEqual(rows('wm6'), [['Nouilles', 5], ['Farine', 4]]);
  assert.deepEqual(rows('wm8'), [['Hugo', 'Bernard', 4], ['Jules', 'Fontaine', 4], ['Léa', 'Petit', 4], ['Noé', 'Durand', 3]]);
  assert.deepEqual(rows('wd1').slice(0, 3), [['Thomas', 'Lefevre', 430], ['Sophie', 'Martin', 387.2], ['Nadia', 'Cherif', 227.39999999999998]]);
  assert.deepEqual(rows('wd6'), [['Camille', 'Moreau', 3]]);
  assert.deepEqual(rows('wd9'), [['Camille', 'Moreau', 'Wok de nouilles au bœuf', 3]]);
  assert.deepEqual(rows('wd8').at(-1), ['Antoine', 'Girard', 0, 8]);
  assert.equal(rows('wd10').length, 11);
  db.close();
});
