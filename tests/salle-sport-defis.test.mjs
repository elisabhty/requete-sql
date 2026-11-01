/* Les défis Salle de sport sont exécutés sur le seed réellement embarqué. */
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
const sport = challenges.filter(c => c.base === 'salle_sport');
const seedBlock = cut("salle_sport:{nom:'Salle de sport',", '\n`}\n};');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };

test('la Salle de sport a dix défis par niveau, du Facile 1 au Difficile 10', () => {
  assert.equal(challenges.length, 267);
  assert.equal(sport.length, 30);
  assert.deepEqual(sport.map(c => c.id), [
    ...Array.from({ length: 10 }, (_, i) => `sf${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `sm${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `sd${i + 1}`),
  ]);
  assert.ok(sport.every(c => c.titre && c.contexte && c.q && c.sol && c.indice && Number.isInteger(c.apres) && c.ordered));
  assert.ok(sport.slice(0, 10).every(c => c.niv === 'f'));
  assert.ok(sport.slice(10, 20).every(c => c.niv === 'm'));
  assert.ok(sport.slice(20).every(c => c.niv === 'd'));
});

test('les solutions s’exécutent et leurs tris sont stables; le cours moyen 9 est volontairement vide', () => {
  for (const c of sport) {
    const db = base();
    const result = db.exec(c.sol);
    if (c.id === 'sm9') assert.equal(result.length, 0, `${c.id}: aucun planning n’est vide dans le seed`);
    else assert.ok(result[0]?.values.length, `${c.id}: résultat non vide`);
    db.run('PRAGMA reverse_unordered_selects = ON');
    assert.deepEqual(db.exec(c.sol), result, `${c.id}: ordre stable`);
    db.close();
  }
});

test('les résultats repères du yoga, des capacités, de Camille et du classement des coachs correspondent au seed', () => {
  const db = base();
  const rows = id => db.exec(sport.find(c => c.id === id).sol)[0]?.values ?? [];
  assert.deepEqual(rows('sf2'), [['Sophie', 'Martin', '2020-03-01'], ['Emma', 'Rousseau', '2024-02-18']]);
  assert.deepEqual(rows('sf4'), [['Antoine', 'Girard', 'CrossFit']]);
  assert.deepEqual(rows('sm6'), [['Pilates Avancé', 'Vendredi', '10:00', 10, 10], ['Zumba Party', 'Mercredi', '18:00', 25, 25]]);
  assert.deepEqual(rows('sm7'), [['Annuel', 15], ['Étudiant', 12], ['Mensuel', 3]]);
  assert.deepEqual(rows('sd3'), [['2024-09', 3, null, null]]);
  const coachRank = rows('sd8');
  assert.deepEqual(coachRank[0], ['Nadia', 'Cherif', 29, 1]);
  assert.deepEqual(coachRank.at(-1), ['Antoine', 'Girard', 0, 8]);
  db.close();
});
