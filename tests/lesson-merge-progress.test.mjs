#!/usr/bin/env node
/* Fusion de cours : les leçons déjà validées restent acquises quand leur quiz s'enrichit,
   et les cours fusionnés (SELECT *, OR, ORDER BY plusieurs colonnes, OFFSET) n'existent plus. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
function load(start, end) { const a = html.indexOf(start), b = html.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a, start); vm.runInContext(html.slice(a, b), ctx); }
load('const SCHEMA_SQL =', 'let state=');
load('function qcmDe(', 'function ordreQcm(');
load('function migrerEtapes(', 'function renderValidation(');
load('const ORDERED_LESSONS=', 'function exerciseRequiresOrder(');
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx);
const titre = id => lessons.find(l => l.id === id)?.titre;

/* Les quatre cours fusionnés ont disparu ; leurs cours d'accueil portent les deux notions. */
for (const id of [3, 29, 24, 75]) assert.equal(titre(id), undefined, `le cours ${id} a été fusionné`);
assert.equal(titre(1), 'SELECT');
assert.equal(titre(6), 'AND et OR');
assert.equal(titre(11), 'ORDER BY');
assert.equal(titre(12), 'LIMIT et OFFSET');
const quiz = vm.runInContext('QCM', ctx);
for (const id of [1, 6, 11, 12]) assert.equal(quiz[id].length, 4, `quiz du cours ${id} : les questions des deux cours`);
const carte = vm.runInContext('CARTES', ctx);
for (const id of [3, 29, 75]) assert.equal(carte[id], undefined, `plus de carte mémo pour le cours fusionné ${id}`);
const ordered = vm.runInContext('ORDERED_LESSONS', ctx);
for (const id of [24, 75]) assert.equal(ordered.has(id), false, `le cours ${id} n'a plus besoin d'un ordre imposé`);
for (const id of [11, 12]) assert.equal(ordered.has(id), true, `le cours ${id} exige l'ordre des lignes`);

/* Progression : validé avant la fusion (2 questions) = toujours validé, avec les nouvelles étapes acquises. */
ctx.allLessons = lessons;
ctx.save = () => { ctx.saved = (ctx.saved || 0) + 1; };
ctx.state = { lessons: {
  11: { done: true, etapes: { exo: 1, q0: 1, q1: 1 } },     // quiz passé de 2 à 4 questions
  12: { done: true },                                         // ancien état sans étapes
  6: { done: false, etapes: { exo: 1, q0: 1 } },              // en cours : rien n'est offert
  1: { done: true, etapes: { exo: 1, q0: 1, q1: 1, q2: 1, q3: 1 } }  // déjà complet : rien ne change
} };
vm.runInContext('migrerEtapes()', ctx);
const e = id => JSON.parse(JSON.stringify(ctx.state.lessons[id].etapes));   // objets du contexte vm : on compare des copies simples
assert.deepEqual(e(11), { exo: 1, q0: 1, q1: 1, q2: 1, q3: 1 });
assert.deepEqual(e(12), { exo: 1, q0: 1, q1: 1, q2: 1, q3: 1 });
assert.deepEqual(e(6), { exo: 1, q0: 1 }, 'une leçon non validée garde sa progression partielle');
assert.deepEqual(e(1), { exo: 1, q0: 1, q1: 1, q2: 1, q3: 1 });
assert.equal(ctx.saved, 1, 'enregistrement unique');
vm.runInContext('migrerEtapes()', ctx);
assert.equal(ctx.saved, 1, 'deuxième passage : rien à enregistrer');

/* Parcours enregistré : les cours fusionnés en sortent, sans doublon. */
load('function nettoyerPlan(', 'function migrerPlan(');
load('function isDefiId(', 'function itemDone(');
load('function trierSessions(', 'function sessionDe(');
Object.assign(ctx, {
  NIVEAUX: [{ k: 'debutant', from: 0 }], leconsDepuis: () => [], itemDone: id => !!ctx.state.lessons[id]?.done,
  dstr: () => '2026-10-05', auj: () => new Date(2026, 9, 5), addJ: d => d, parseD: d => new Date(d),
});
ctx.state = { lessons: {}, plan: { niveau: 'debutant', per: 3, archive: [3, 1], sessions: [
  { d: '2026-10-05', lessons: [24, 11, 75] },
  { d: '2026-10-06', lessons: [12, 29, 6] },
  { d: '2026-10-07', lessons: [3] }
] } };
vm.runInContext('nettoyerPlan()', ctx);
const plan = JSON.parse(JSON.stringify(ctx.state.plan));
assert.deepEqual(plan.sessions, [{ d: '2026-10-05', lessons: [11] }, { d: '2026-10-06', lessons: [12, 6] }], 'les cours fusionnés quittent le parcours, les séances vides disparaissent');
assert.deepEqual(plan.archive, [1], 'et l’archive');

console.log('Fusion de cours : progression et parcours conservés, quiz et cartes à jour : OK.');
