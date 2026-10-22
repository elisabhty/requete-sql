/* Cours « Modéliser avec UML » (leçon 81) : le diagramme de classes des ateliers NutriBoost, traduit en tables.
   Placé dans le module Modéliser, après « Clés et relations » et avant CREATE TABLE. */
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
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l81 = lessons.find(l => l.id === 81);
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const run = (sql, verif) => {
  const db = new SQL.Database();
  try { db.run(vm.runInContext('SCHEMA_SQL', ctx)); db.run('PRAGMA foreign_keys = ON;'); const r = db.exec(sql); return JSON.stringify(verif ? db.exec(verif) : r); }
  finally { db.close(); }
};

test('Modéliser avec UML : dans le module Modéliser, après Clés et relations et avant CREATE TABLE', () => {
  const m = modules.find(x => x.titre === 'Modéliser');
  assert.deepEqual([...m.lessons.map(l => l.id)], [56, 72, 81]);
  assert.equal(m.sous, 'Normalisation, cardinalités et UML');
  const ids = lessons.map(l => l.id);
  assert.equal(ids.indexOf(81), ids.indexOf(72) + 1);
  assert.equal(ids.indexOf(61), ids.indexOf(81) + 1, 'CREATE TABLE vient juste après');
  assert.equal(l81.titre, 'Modéliser avec UML');
  assert.equal(l81.résumé, 'Du diagramme de classes aux tables');
});

test('le diagramme de classes : trois classes, deux associations, une multiplicité à chaque bout', () => {
  const fig = /<figure class="uml"[\s\S]*?<\/figure>/.exec(l81.studio.problem.extra);
  assert.ok(fig, 'le diagramme est dans le concept');
  const d = fig[0];
  assert.deepEqual([...d.matchAll(/<b class="uml-n">([^<]+)<\/b>/g)].map(m => m[1]), ['Coach', 'Atelier', 'Client']);
  assert.deepEqual([...d.matchAll(/<span class="uml-m is-(top|bot)">([^<]+)<\/span>/g)].map(m => m[1] + ' ' + m[2]), ['top 1', 'bot 0..*', 'top 0..*', 'bot 0..*']);
  assert.ok(d.includes('anime<i aria-hidden="true">▾</i>') && d.includes('s’inscrit à<i aria-hidden="true">▴</i>'), 'le nom de chaque association, avec son sens de lecture');
  assert.ok(d.includes('aria-label="Le diagramme des ateliers : Coach anime Atelier (Coach 1, Atelier 0..*) ; Client s’inscrit à Atelier (Atelier 0..*, Client 0..*)"'), 'lu par VoiceOver');
  assert.ok(!/coach_id|client_id/.test(d), 'un diagramme UML ne montre pas de clé étrangère : elle naît de la traduction');
  assert.ok(html.includes('.uml-c{width:min(100%,232px);') && html.includes('.uml-m.is-top{top:8px}'), 'styles du diagramme');
});

test('la requête complète crée les trois tables du diagramme : le tableau de la mission est celui de SQLite', () => {
  assert.ok(l81.missionSql.startsWith('CREATE TABLE coachs (') && l81.missionSql.endsWith("SELECT name FROM sqlite_master\nWHERE type = 'table';"));
  const res = JSON.parse(run(l81.missionSql));
  assert.deepEqual(res.at(-1).values, [['clients'], ['produits'], ['commandes'], ['fidelite'], ['coachs'], ['ateliers'], ['inscriptions']]);
  assert.ok(html.includes('rows:[["clients"], ["produits"], ["commandes"], ["fidelite"], ["coachs"], ["ateliers"], ["inscriptions"]],done:"✓ Le diagramme est traduit : chaque relation à sa place"'));
  assert.deepEqual(JSON.parse(run(l81.missionSql, "SELECT \"from\", \"table\" FROM pragma_foreign_key_list('inscriptions') ORDER BY \"from\"; SELECT name, pk FROM pragma_table_info('inscriptions') ORDER BY cid;")).map(r => r.values),
    [[['atelier_id', 'ateliers'], ['client_id', 'clients']], [['client_id', 1], ['atelier_id', 2]]], 'table d’association : deux clés étrangères, clé primaire sur le couple');
  for (const line of l81.missionSql.split('\n')) assert.ok(line.length <= 34, `ligne lisible sur un téléphone : ${line}`);
});

test('exercice Programme 1 — 0..* Séance : la clé étrangère du bon côté, et nulle part ailleurs', () => {
  const ok = run(l81.solution, l81.verif);
  const wrong = run("CREATE TABLE programmes (\n  id INTEGER PRIMARY KEY,\n  nom TEXT,\n  seance_id INTEGER\n    REFERENCES seances(id)\n);\nCREATE TABLE seances (\n  id INTEGER PRIMARY KEY,\n  titre TEXT\n);", l81.verif);
  const noFk = run('CREATE TABLE programmes (\n  id INTEGER PRIMARY KEY,\n  nom TEXT\n);\nCREATE TABLE seances (\n  id INTEGER PRIMARY KEY,\n  titre TEXT,\n  programme_id INTEGER\n);', l81.verif);
  assert.notEqual(wrong, ok, 'clé placée côté Programme : refusée');
  assert.notEqual(noFk, ok, 'colonne sans REFERENCES : refusée');
  assert.ok(l81.write && l81.exoNeeds[0].re === '\\bREFERENCES\\b');
  /* Ni la solution ni les tables de l’exercice ne figurent dans le cours (situation, concept, étapes, réflexe). */
  const course = [l81.situation, l81.studio.problem.extra, l81.studio.uses.body, l81.studio.reflex.extra].join('\n');
  assert.ok(!/programme|seance|séance/i.test(course), 'le cours ne dévoile pas l’exercice');
});

test('quiz, recherche et défi du cours', () => {
  const qcm = vm.runInContext('QCM', ctx)[81];
  assert.equal(qcm.length, 4);
  assert.deepEqual([...qcm.map(q => q.b)], [1, 1, 2, 0]);
  assert.ok(html.includes("81:'uml diagramme de classes"), 'trouvé par la recherche « uml » ou « diagramme de classes »');
  assert.equal(l81.petitDefi[0].a, '0..*');
  assert.equal(l81.learningCheck.options[l81.learningCheck.answer], 'ateliers');
});
