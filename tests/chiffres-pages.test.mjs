/* Les chiffres des pages (Elisa, 10 novembre : « Vérifie tous les chiffres (calcul en testant) de toutes la page »).
   La bibliothèque comptait une carte mémo par leçon validée : « 3 cartes débloquées » quand la collection et l’accueil en
   montraient 2 (une leçon validée sans carte). Les tuiles du planning appelaient « Cette semaine » les 7 derniers jours. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const fn = name => take(`function ${name}(`, '\n}\n') + '\n}\n';

test('compteStats : les cartes gagnées sont les leçons validées qui ont une carte', () => {
  const allLessons = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const CARTES = { 1: {}, 2: {}, 4: {} };
  const cas = [
    [{}, 0, 0],
    [{ 0: { done: true } }, 1, 0],
    [{ 0: { done: true }, 1: { done: true }, 2: { done: true } }, 3, 2],
    [{ 1: { done: true }, 3: { done: false }, 4: { done: true } }, 2, 2],
    [{ 0: { done: true }, 1: { done: true }, 2: { done: true }, 3: { done: true }, 4: { done: true } }, 5, 3],
  ];
  for (const [lessons, nL, nC] of cas) {
    const ctx = vm.createContext({ state: { lessons, defis: {}, notes: [] }, allLessons, CARTES, dueList: () => [], streakJours: () => 0 });
    vm.runInContext(take('function isUnlocked(id)', '\n') + '\n' + fn('compteStats'), ctx);
    const st = ctx.compteStats();
    assert.equal(st.lessons, nL, 'leçons');
    assert.equal(st.cards, nC, `cartes pour ${JSON.stringify(lessons)}`);
  }
});

test('la bibliothèque et la collection comptent les cartes de la même façon', () => {
  assert.ok(html.includes("allLessons.filter(l=>CARTES[l.id]&&isUnlocked(l.id)).length;\n  const notes="), 'compteStats');
  assert.ok(html.includes('const n=allLessons.filter(l=>CARTES[l.id]&&isUnlocked(l.id)).length;'), 'renderCollection');
});

test('planning : les 7 derniers jours ne s’appellent plus « Cette semaine »', () => {
  const ov = fn('planOverviewHTML');
  assert.ok(ov.includes('Ces 7 derniers jours : <b>'), 'la tendance');
  assert.ok(ov.includes('<dt>7 derniers jours</dt>'), 'le temps d’étude');
  assert.ok(!ov.includes('Cette semaine'), 'plus de « Cette semaine » pour une fenêtre glissante');
  assert.ok(ov.includes("'autant que les 7 jours d’avant'"), 'à égalité');
});
