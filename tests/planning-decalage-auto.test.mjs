/* Elisa, 10 novembre, 0 h 53 (capture de la carte « 8 activités à rattraper ») : « Enlever cette notion et décaler automatiquement le
   planning (du jour suivant par rapport au jour d’étude, prendre en compte le repos) ».
   Plus de carte « activités à rattraper » ni de « Comment veux-tu reprendre ? » : une séance passée sans être terminée glisse
   d’elle-même au jour d’étude suivant (au plus tôt aujourd’hui), en sautant les jours de repos du rythme ; les séances d’après
   suivent seulement si leur jour est pris. Les activités validées restent à leur jour, et le jour manqué compte comme manqué. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const i = app.indexOf('function ' + n + '('); assert.ok(i >= 0, n); return app.slice(i, app.indexOf('\n}\n', i) + 3); };
const code = ['jour0', 'auj', 'dstr', 'parseD', 'addJ', 'planMergeSessions', 'trierSessions', 'sessionDe', 'debutPlan', 'jourRepos', 'planDecalerAuto'].map(fn).join('\n');
const PATTERN = { 2: [1, 4], 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

/* Aujourd’hui = today ; sessions : [['11-09', [1, 2, 3]], …] ; done : les activités validées */
function decaler(today, freq, sessions, done = []) {
  let saved = 0;
  const RealDate = Date;
  const ctx = {
    PATTERN, save: () => { saved++; }, itemDone: id => done.includes(id),
    state: { plan: { freq, sessions: sessions.map(([d, l]) => ({ d: '2026-' + d, lessons: [...l] })) } },
    Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : [today + 'T09:00:00'])); } },
  };
  vm.runInNewContext(code + ';this.decaler=planDecalerAuto;this.repos=jourRepos;', ctx);
  const n = ctx.decaler();
  return {
    n, saved, manques: ctx.state.plan.manques && [...ctx.state.plan.manques], repos: iso => ctx.repos(iso),
    jours: [...ctx.state.plan.sessions].map(s => s.d.slice(5) + ':' + s.lessons.join(',')),
  };
}

test('une séance manquée passe au jour d’étude suivant, en sautant les jours de repos', () => {
  /* 3 séances par semaine (lundi, mercredi, vendredi), mardi 10 novembre : la séance de lundi va mercredi, celle de mercredi vendredi,
     celle de vendredi lundi prochain */
  const r = decaler('2026-11-10', 3, [['11-09', [1, 2, 3]], ['11-11', [4, 5, 6]], ['11-13', [7, 8, 9]]]);
  assert.deepEqual(r.jours, ['11-11:1,2,3', '11-13:4,5,6', '11-16:7,8,9']);
  assert.equal(r.n, 3);
  /* En semaine seulement (5 par semaine), jeudi 12 : mardi et mercredi manqués ; le week-end est sauté */
  const s = decaler('2026-11-12', 5, [['11-10', [1, 2]], ['11-11', [3, 4]], ['11-12', [5, 6]], ['11-13', [7, 8]]]);
  assert.deepEqual(s.jours, ['11-12:1,2', '11-13:3,4', '11-16:5,6', '11-17:7,8']);
});

test('tous les jours : la séance d’hier reprend aujourd’hui, un trou dans le planning reste un trou', () => {
  const r = decaler('2026-11-10', 7, [['11-09', [1, 2, 3]], ['11-10', [4, 5, 6]], ['11-11', [7, 8, 9]], ['11-14', [10]]]);
  assert.deepEqual(r.jours, ['11-10:1,2,3', '11-11:4,5,6', '11-12:7,8,9', '11-14:10'], 'samedi 14 ne bouge pas : la place était libre');
});

test('les activités validées restent à leur jour ; rien ne bouge quand rien n’est en retard', () => {
  const r = decaler('2026-11-10', 7, [['11-09', [1, 2, 3]], ['11-10', [4, 5, 6]]], [1]);
  assert.deepEqual(r.jours, ['11-09:1', '11-10:2,3', '11-11:4,5,6']);
  const rien = decaler('2026-11-10', 7, [['11-09', [1]], ['11-10', [2]]], [1]);
  assert.deepEqual([rien.n, rien.saved, rien.jours], [0, 0, ['11-09:1', '11-10:2']], 'séance d’hier terminée : rien à décaler');
});

test('le jour manqué n’est pas un jour de repos : la série le compte comme manqué', () => {
  const r = decaler('2026-11-10', 7, [['11-09', [1, 2, 3]], ['11-10', [4]]]);
  assert.deepEqual(r.manques, ['2026-11-09']);
  assert.equal(r.repos('2026-11-09'), false, 'sa séance est partie, mais le jour reste manqué');
  assert.equal(decaler('2026-11-10', 7, [['11-09', [1]], ['11-10', [4]]], [1]).manques, undefined);
});

test('les cas vérifiés dans le navigateur le 10 novembre (fausse horloge, vrais plannings) : 2 jours, week-end, absence, fin, deux fois', () => {
  /* 2 jours par semaine (lundi, jeudi), mercredi : lundi passe à jeudi, jeudi au lundi suivant */
  assert.deepEqual(decaler('2026-11-11', 2, [['11-09', [1]], ['11-12', [2]], ['11-16', [3]]]).jours, ['11-12:1', '11-16:2', '11-19:3']);
  /* En semaine, samedi : vendredi passe au lundi, le week-end reste libre */
  assert.deepEqual(decaler('2026-11-14', 5, [['11-13', [1]], ['11-16', [2]]]).jours, ['11-16:1', '11-17:2']);
  /* Une semaine d’absence, tous les jours : tout glisse de 7 jours, l’ordre ne change pas, 7 jours manqués */
  const jours = Array.from({ length: 10 }, (_, i) => [`11-${String(2 + i).padStart(2, '0')}`, [i]]);
  const r = decaler('2026-11-09', 7, jours);
  assert.deepEqual(r.jours, Array.from({ length: 10 }, (_, i) => `11-${String(9 + i).padStart(2, '0')}:${i}`));
  assert.equal(r.manques.length, 7);
  /* La dernière séance ratée, tout le reste fait : elle passe à aujourd’hui, le reste ne bouge pas */
  assert.deepEqual(decaler('2026-11-12', 7, [['11-08', [1]], ['11-09', [2]], ['11-10', [3]]], [1, 2]).jours, ['11-08:1', '11-09:2', '11-12:3']);
  /* Deux fois le même jour : la deuxième ne change rien */
  const ctx = { PATTERN, save() {}, itemDone: () => false, state: { plan: { freq: 7, sessions: [{ d: '2026-11-09', lessons: [1] }, { d: '2026-11-10', lessons: [2] }] } },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : ['2026-11-10T00:30:00'])); } } };
  vm.runInNewContext(code + ';this.f=planDecalerAuto;', ctx);
  assert.equal(ctx.f(), 2, '0 h 30 : la séance de la veille passe à aujourd’hui');
  assert.equal(ctx.f(), 0, 'puis plus rien ne bouge');
});

test('le décalage se fait tout seul : au démarrage et dès que le planning est lu', () => {
  assert.ok(fn('infoJour').includes("if(typeof planDecalerAuto==='function')planDecalerAuto();"));
  assert.ok(app.includes('    try{ if(state.plan)planDecalerAuto(); }catch(e){}\n'), 'au démarrage, avant tout affichage');
});

test('plus de carte « activités à rattraper », ni de choix à confirmer', () => {
  for (const k of ['lateRecoveryHTML', 'Comment veux-tu reprendre', 'Tout rattraper aujourd’hui', 'Reprendre à mon rythme', 'Confirmer mon choix', 'function rattraper(', 'function etalerRetard(', 'function decalerPlanning('])
    assert.ok(!app.includes(k), k);
  assert.doesNotMatch(lq + app, /\.late-recovery|\.lr-(?:option|head|chips|confirm|later)\b/, 'leur style est parti avec eux');
});
