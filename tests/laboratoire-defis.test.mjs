/* Les trois lots Laboratoire sont évalués sur le seed réellement embarqué. */
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
const laboratory = challenges.filter(c => c.base === 'labo');
const seedBlock = cut("labo:{nom:'Laboratoire de recherche',", '\n`},\n  voyages:');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => laboratory.find(c => c.id === id);

test('le catalogue contient trente défis Laboratoire, dix par niveau', () => {
  assert.equal(challenges.length, 267);
  assert.equal(laboratory.length, 30);
  for (const [prefix, level] of [['lf', 'f'], ['lm', 'm'], ['ld', 'd']]) {
    const group = laboratory.filter(c => c.id.startsWith(prefix));
    assert.equal(group.length, 10, prefix);
    assert.ok(group.every(c => c.niv === level && c.base === 'labo'), prefix);
  }
  assert.deepEqual(laboratory.map(c => c.id), [...Array.from({ length: 10 }, (_, i) => 'lf' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'lm' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'ld' + (i + 1))]);
  for (const c of laboratory) assert.ok(c.titre && c.contexte && c.q && c.sol && c.indice && Number.isInteger(c.apres), c.id);
});

test('le seed Laboratoire conserve ses volumes et ses clés', () => {
  const db = base();
  for (const [table, count] of Object.entries({ equipes: 6, chercheurs: 20, projets: 15, experiences: 40, echantillons: 35, resultats: 45, publications: 15, affectations_chercheurs: 46 }))
    assert.equal(db.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0], count, table);
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
  db.close();
});

test('les 30 solutions Laboratoire renvoient des résultats non vides et des tris stables', () => {
  for (const c of laboratory) {
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

test('les résultats repères des défis Laboratoire correspondent au seed', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  /* 2 novembre, 21 h 22 : ld7, ld8 et ld10 copiaient lm10, ld5 et ld4 ; remplacés par le cumul des budgets, le premier projet de chaque
     équipe et l’expérience la plus longue de chaque projet. */
  assert.equal(challenge('ld7').titre, 'Comment le budget de chaque équipe s’accumule-t-il ?');
  assert.deepEqual(rows('ld7')[2], ['Équipe Astrophysique', 'Spectroscopie des galaxies', '2024-05-01', 380000, 1300000]);
  assert.equal(challenge('ld8').titre, 'Quel est le premier projet de chaque équipe ?');
  assert.deepEqual(rows('ld8')[0], ['Équipe Astrophysique', 'Observation des exoplanètes', '2021-06-01']);
  assert.equal(rows('ld8').length, 6);
  assert.equal(challenge('ld10').titre, 'Quelle est l’expérience la plus longue de chaque projet ?');
  assert.equal(rows('ld10').length, 14);
  const sols = new Set(); for (const c of laboratory) { assert.ok(!sols.has(c.sol), c.id + ' : pas une copie d’un autre défi'); sols.add(c.sol); }
  assert.equal(rows('lf1').length, 9);
  assert.equal(rows('lf2').length, 6);
  assert.deepEqual(rows('lf4')[0], [7, 'Intensité fluorescence', 'Microscopie confocale']);
  assert.equal(rows('lf5').length, 7);
  assert.equal(rows('lf6').length, 4);
  assert.equal(rows('lf7').length, 3);
  assert.equal(rows('lf10').length, 6);
  assert.deepEqual(rows('lm9'), [['Validé', 37, 82.2], ['En attente', 8, 17.8]]);
  assert.deepEqual(rows('ld3'), [["2023-03-10", 12, null, null], ["2024-03-05", 6, 12, -6]]);
  assert.equal(rows('ld6').length > 0, true);
  assert.equal(rows('ld9').length, 3);
  db.close();
});
