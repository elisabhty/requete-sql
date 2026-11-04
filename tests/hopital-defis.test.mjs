/* Les trois lots de défis Hôpital sont évalués sur le seed réellement embarqué. */
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
const hospital = challenges.filter(c => c.base === 'hopital');
const seedBlock = cut("hopital:{nom:'Hôpital',", '\n`},\n  wok:');
const seed = seedBlock.slice(seedBlock.indexOf('sql:`') + 5);
const base = () => { const db = new SQL.Database(); db.run(seed); return db; };
const challenge = id => hospital.find(c => c.id === id);

 test('le catalogue contient les 30 défis Hôpital, dix par niveau', () => {
  assert.equal(challenges.length, 267);
  assert.equal(hospital.length, 30);
  for (const [prefix, level] of [['hf', 'f'], ['hm', 'm'], ['hd', 'd']]) {
    const group = hospital.filter(c => c.id.startsWith(prefix));
    assert.equal(group.length, 10, prefix);
    assert.ok(group.every(c => c.niv === level && c.base === 'hopital'), prefix);
  }
  for (const c of hospital)
    assert.ok(c.titre && ((c.situation && c.affiche.length) || (['ld1','ld9','zm8','zd6','sm9','sd3'].includes(c.id) && c.contexte && c.q)) && c.sol && c.indice && Number.isInteger(c.apres), c.id);
});

test('le seed Hôpital conserve ses clés et le parcours pédagogique couvre les six services', () => {
  const db = base();
  assert.equal(db.exec('SELECT COUNT(*) FROM consultations')[0].values[0][0], 50);
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
  assert.deepEqual(db.exec("SELECT COUNT(DISTINCT m.service_id) FROM consultations c JOIN medecins m ON m.id=c.medecin_id WHERE c.patient_id=4")[0].values, [[6]]);
  db.close();
});

test('les 30 solutions Hôpital renvoient des résultats non vides et des tris stables', () => {
  for (const c of hospital) {
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

test('les résultats Hôpital repères sont cohérents avec les données', () => {
  const db = base();
  const rows = id => db.exec(challenge(id).sol)[0].values;
  assert.deepEqual(rows('hf7'), [[13, '1 g', 7], [28, '1 g', 7]]);
  assert.deepEqual(rows('hm8'), [['Noé', 'Durand', 6, 6]]);
  assert.deepEqual(rows('hd5'), [['Noé', 'Durand', 6, 1.13]]);
  assert.equal(rows('hd3').length, 2);
  assert.equal(rows('hd8').length, 5);
  assert.deepEqual(rows('hd8')[0], ['Noé', 'Durand', '2024-10-22', 'Cardiologie', 'Pédiatrie']);
  assert.deepEqual(rows('hd10'), [['Noé', 'Durand']]);
  db.close();
});
