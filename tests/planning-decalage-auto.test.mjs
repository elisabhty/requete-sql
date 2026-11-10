/* Elisa, 10 novembre, 0 h 53 (capture de la carte « 8 activités à rattraper ») : « Enlever cette notion et décaler automatiquement le
   planning (du jour suivant par rapport au jour d’étude, prendre en compte le repos) ».
   Plus de carte « activités à rattraper » ni de « Comment veux-tu reprendre ? » : une séance passée sans être terminée glisse
   d’elle-même au jour d’étude suivant (au plus tôt aujourd’hui), en sautant les jours de repos du rythme. Les activités validées
   restent à leur jour, et le jour manqué compte comme manqué.
   6 h 23 (capture du Planning : 1, 5, 3, 2, 2, 1, 2 activités) : « rééquilibrer ». Ce qui reste est réparti en séances de la taille
   du rythme (p.per), sur les jours d’étude à partir d’aujourd’hui ; un planning d’avant est rééquilibré une fois (p.equilibre). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const i = app.indexOf('function ' + n + '('); assert.ok(i >= 0, n); return app.slice(i, app.indexOf('\n}\n', i) + 3); };
const code = ['jour0', 'auj', 'dstr', 'parseD', 'addJ', 'planMergeSessions', 'trierSessions', 'sessionDe', 'debutPlan', 'jourRepos', 'itemDoneDay', 'planAnchorDone', 'planReequilibrer', 'planDecalerAuto'].map(fn).join('\n');
const PATTERN = { 2: [1, 4], 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

/* Aujourd’hui = today ; sessions : [['11-09', [1, 2, 3]], …] ; done : { id: jour de validation } ; o.per : la taille d’une séance ;
   o.ancien : un planning d’avant le rééquilibrage (sans p.equilibre) */
function decaler(today, freq, sessions, done = {}, o = {}) {
  let saved = 0;
  const RealDate = Date;
  const lessons = Object.fromEntries(Object.entries(done).map(([id, d]) => [id, { done: true, at: new RealDate('2026-' + d + 'T18:00:00').getTime() }]));
  const ctx = {
    PATTERN, save: () => { saved++; }, itemDone: id => id in done, isDefiId: () => false, INTERVALS: [1], DAY: 864e5,
    state: { lessons, plan: Object.assign({ freq, per: o.per || 3, sessions: sessions.map(([d, l]) => ({ d: '2026-' + d, lessons: [...l] })) }, o.ancien ? {} : { equilibre: 1 }) },
    Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : [today + 'T09:00:00'])); } },
  };
  vm.runInNewContext(code + ';this.decaler=planDecalerAuto;this.repos=jourRepos;', ctx);
  const n = ctx.decaler();
  return {
    n, saved, manques: ctx.state.plan.manques && [...ctx.state.plan.manques], repos: iso => ctx.repos(iso), ctx,
    jours: [...ctx.state.plan.sessions].filter(s => s.lessons.length).map(s => s.d.slice(5) + ':' + s.lessons.join(',')),
  };
}

test('une séance manquée passe au jour d’étude suivant, en sautant les jours de repos', () => {
  /* 3 séances par semaine (lundi, mercredi, vendredi), mardi 10 novembre : lundi passe à mercredi, mercredi à vendredi, vendredi au lundi */
  const r = decaler('2026-11-10', 3, [['11-09', [1, 2, 3]], ['11-11', [4, 5, 6]], ['11-13', [7, 8, 9]]]);
  assert.deepEqual(r.jours, ['11-11:1,2,3', '11-13:4,5,6', '11-16:7,8,9']);
  /* En semaine, jeudi 12 : mardi et mercredi manqués ; le week-end est sauté */
  const s = decaler('2026-11-12', 5, [['11-10', [1, 2]], ['11-11', [3, 4]], ['11-12', [5, 6]], ['11-13', [7, 8]]], {}, { per: 2 });
  assert.deepEqual(s.jours, ['11-12:1,2', '11-13:3,4', '11-16:5,6', '11-17:7,8']);
});

test('rééquilibrer (6 h 23) : des séances de la taille du rythme, à partir d’aujourd’hui', () => {
  /* La capture : 1, 5, 3, 2… activités ; le rythme en prévoit 2 par séance */
  const r = decaler('2026-11-10', 7, [['11-10', [1]], ['11-11', [2, 3, 4, 5, 6]], ['11-12', [7, 8, 9]], ['11-13', [10, 11]]], {}, { per: 2, ancien: true });
  assert.deepEqual(r.jours, ['11-10:1,2', '11-11:3,4', '11-12:5,6', '11-13:7,8', '11-14:9,10', '11-15:11']);
  assert.equal(r.ctx.state.plan.equilibre, 1, 'une seule fois : ensuite, seul un retard relance la répartition');
  /* Après un retard, un trou dans le planning se comble aussi */
  assert.deepEqual(decaler('2026-11-10', 7, [['11-09', [1, 2]], ['11-10', [3, 4]], ['11-13', [5, 6]]], {}, { per: 2 }).jours, ['11-10:1,2', '11-11:3,4', '11-12:5,6']);
  /* Un planning commencé aujourd’hui, un jour de repos (samedi, en semaine) : sa séance du jour reste */
  assert.deepEqual(decaler('2026-11-14', 5, [['11-14', [1, 2]], ['11-16', [3, 4]]], {}, { per: 2, ancien: true }).jours, ['11-14:1,2', '11-16:3,4']);
});

test('les activités validées restent à leur jour ; rien ne bouge quand rien n’est en retard', () => {
  const r = decaler('2026-11-10', 7, [['11-09', [1, 2, 3]], ['11-10', [4, 5, 6]]], { 1: '11-09' });
  assert.deepEqual(r.jours, ['11-09:1', '11-10:2,3,4', '11-11:5,6']);
  const rien = decaler('2026-11-10', 7, [['11-09', [1]], ['11-10', [2]]], { 1: '11-09' });
  assert.deepEqual([rien.n, rien.saved, rien.jours], [0, 0, ['11-09:1', '11-10:2']], 'séance d’hier terminée : rien à décaler');
});

test('le jour manqué n’est pas un jour de repos : la série le compte comme manqué', () => {
  const r = decaler('2026-11-10', 7, [['11-09', [1, 2, 3]], ['11-10', [4]]]);
  assert.deepEqual(r.manques, ['2026-11-09']);
  assert.equal(r.repos('2026-11-09'), false, 'sa séance est partie, mais le jour reste manqué');
  assert.equal(decaler('2026-11-10', 7, [['11-09', [1]], ['11-10', [4]]], { 1: '11-09' }).manques, undefined);
});

test('les cas vérifiés dans le navigateur le 10 novembre (fausse horloge, vrais plannings) : 2 jours, week-end, absence, fin, deux fois', () => {
  /* 2 jours par semaine (lundi, jeudi), mercredi : lundi passe à jeudi, jeudi au lundi suivant */
  assert.deepEqual(decaler('2026-11-11', 2, [['11-09', [1]], ['11-12', [2]], ['11-16', [3]]], {}, { per: 1 }).jours, ['11-12:1', '11-16:2', '11-19:3']);
  /* En semaine, samedi : vendredi passe au lundi, le week-end reste libre */
  assert.deepEqual(decaler('2026-11-14', 5, [['11-13', [1]], ['11-16', [2]]], {}, { per: 1 }).jours, ['11-16:1', '11-17:2']);
  /* Une semaine d’absence, tous les jours : tout reprend aujourd’hui, l’ordre ne change pas, 7 jours manqués */
  const jours = Array.from({ length: 10 }, (_, i) => [`11-${String(2 + i).padStart(2, '0')}`, [i]]);
  const r = decaler('2026-11-09', 7, jours, {}, { per: 1 });
  assert.deepEqual(r.jours, Array.from({ length: 10 }, (_, i) => `11-${String(9 + i).padStart(2, '0')}:${i}`));
  assert.equal(r.manques.length, 7);
  /* La dernière séance ratée, tout le reste fait : elle passe à aujourd’hui, le reste ne bouge pas */
  assert.deepEqual(decaler('2026-11-12', 7, [['11-08', [1]], ['11-09', [2]], ['11-10', [3]]], { 1: '11-08', 2: '11-09' }, { per: 1 }).jours, ['11-08:1', '11-09:2', '11-12:3']);
  /* Deux fois le même jour : la deuxième ne change rien */
  const RealDate = Date;
  const ctx = { PATTERN, save() {}, itemDone: () => false, isDefiId: () => false, INTERVALS: [1], DAY: 864e5,
    state: { lessons: {}, plan: { freq: 7, per: 1, equilibre: 1, sessions: [{ d: '2026-11-09', lessons: [1] }, { d: '2026-11-10', lessons: [2] }] } },
    Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-11-10T00:30:00'])); } } };
  vm.runInNewContext(code + ';this.f=planDecalerAuto;', ctx);
  assert.equal(ctx.f(), 1, '0 h 30 : la séance de la veille passe à aujourd’hui');
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

test('un nouveau planning (onboarding, « Adapter mon rythme ») démarre le jour même, puis suit les jours du rythme (Elisa, 10 novembre, 1 h 33)', () => {
  /* « Oui le jour même et les jours suivants ça reprend normal comme décidé à l’onboarding ». Vérifié dans le navigateur pour les
     4 rythmes et les 7 jours de la semaine (253 vérifications) : onboarding, lendemain sans rien faire, « Adapter mon rythme ». */
  const ctx = { PATTERN };
  vm.runInNewContext(['jour0', 'dstr', 'parseD', 'addJ', 'datesMotif'].map(fn).join('\n') + ';this.f=datesMotif;', ctx);
  const d = (iso, freq, n) => [...ctx.f(new Date(iso + 'T00:00:00'), freq, n)].map(x => x.slice(5));
  assert.deepEqual(d('2026-11-14', 5, 3), ['11-14', '11-16', '11-17'], 'samedi, en semaine : samedi (choisi à l’instant), puis lundi, mardi');
  assert.deepEqual(d('2026-11-10', 3, 3), ['11-10', '11-11', '11-13'], 'mardi, 3 jours : mardi, puis mercredi, vendredi');
  assert.deepEqual(d('2026-11-15', 2, 3), ['11-15', '11-16', '11-19'], 'dimanche, 2 jours : dimanche, puis lundi, jeudi');
  assert.deepEqual(d('2026-11-09', 7, 3), ['11-09', '11-10', '11-11']);
  assert.ok(fn('apercuPlan').includes('const dates=datesMotif(auj(),freq,n);'), 'la création');
  assert.ok(fn('planAdjustPreview').includes('const dates=n?datesMotif(auj(),choice.freq,n):[];'), '« Adapter mon rythme »');
});

test('« 0 séance validée sur 7 » (Elisa, 10 novembre, 6 h 49) : la semaine et l’avancement se disent en positif', () => {
  const ctx = {};
  vm.runInNewContext(fn('semaineCompte') + fn('activitesCompte') + ';this.s=semaineCompte;this.a=activitesCompte;', ctx);
  assert.deepEqual([ctx.s(0, 7), ctx.s(1, 7), ctx.s(2, 7), ctx.s(7, 7), ctx.s(0, 1), ctx.s(0, 0)],
    ['7 séances prévues', '1 séance validée sur 7', '2 séances validées sur 7', '7 séances validées', '1 séance prévue', 'Aucune séance prévue']);
  assert.deepEqual([ctx.a(0, 71), ctx.a(5, 71), ctx.a(71, 71)], ['71 activités', '5 activités validées sur 71', '71 activités validées']);
  assert.ok(app.includes('<p>${semaineCompte(weekComplete,weekPlanned)}</p>') && app.includes('<summary>Avancement global<span>${activitesCompte(st.done,st.total)}</span>'));
  assert.ok(!/\$\{weekComplete\} séance/.test(app), 'plus de « 0 séance validée »');
});

test('« Voir que les 6 prochains jours » (Elisa, 10 novembre, 6 h 54) : planning, Mon compte et fin de l’inscription', () => {
  assert.ok(app.includes('const NB_JOURS_VUS=6;'));
  assert.ok(fn('joursSemaine').includes('Array.from({length:NB_JOURS_VUS},(_,i)=>addJ(d0,i))') && fn('joursSemaine').includes('semaineOffset*NB_JOURS_VUS'), 'la fenêtre avance de 6 jours');
  assert.ok(app.includes('<h2>Les ${NB_JOURS_VUS} prochains jours</h2>') && app.includes('<b>Tes ${NB_JOURS_VUS} prochains jours</b>') && app.includes('<span>Tes ${NB_JOURS_VUS} prochains jours</span>'));
  assert.ok(app.includes('.wk-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));') && lq.includes('html.lq .acct-week{margin:16px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:2px}'), 'six cases, plus larges');
  assert.ok(!/7 prochains jours/.test(app.replace(/\/\*[\s\S]*?\*\//g, '')), 'plus de « 7 prochains jours » à l’écran');
});
