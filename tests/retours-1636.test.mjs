/* Elisa, 11 novembre, 16 h 36 : « il ne faut pas qu’une personne ait plus de 4 cours dans son planning par jour ». Le rythme intensif
   passe de 5 à 4 leçons par séance ; une journée ne reçoit jamais plus de 4 leçons, celles déjà validées ce jour-là comprises
   (planRemplir) ; un planning d’avant trop chargé est rééquilibré à l’ouverture (planSurcharge, planDecalerAuto). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fn = n => { const i = app.indexOf('function ' + n + '('); assert.ok(i >= 0, n); return app.slice(i, app.indexOf('\n}\n', i) + 3); };
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i > 0, a); return app.slice(i, app.indexOf(b, i)); };
const code = ['jour0', 'auj', 'dstr', 'parseD', 'addJ', 'planMergeSessions', 'trierSessions', 'sessionDe', 'debutPlan', 'jourRepos', 'itemDoneDay', 'planAnchorDone',
  'planPer', 'planFaitsParJour', 'planRemplir', 'planSurcharge', 'planReequilibrer', 'planDecalerAuto', 'datesMotif'].map(fn).join('\n');
const PATTERN = { 2: [1, 4], 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

/* Aujourd’hui = today ; sessions : [['11-09', [1, 2, 3]], …] ; done : { id: jour de validation } */
function bac(today, plan, done = {}) {
  const RealDate = Date;
  const lessons = Object.fromEntries(Object.entries(done).map(([id, d]) => [id, { done: true, at: new RealDate('2026-' + d + 'T18:00:00').getTime() }]));
  const ctx = {
    PATTERN, PLAN_MAX_JOUR: 4, save() {}, itemDone: id => id in done, isDefiId: () => false, INTERVALS: [1], DAY: 864e5,
    state: { lessons, plan: plan && { equilibre: 1, ...plan, sessions: plan.sessions.map(([d, l]) => ({ d: '2026-' + d, lessons: [...l] })) } },
    Date: class extends RealDate { constructor(...a) { super(...(a.length ? a : [today + 'T09:00:00'])); } },
  };
  vm.runInNewContext(code, ctx);
  const jours = () => [...ctx.state.plan.sessions].filter(s => s.lessons.length).map(s => s.d.slice(5) + ':' + s.lessons.join(','));
  return { ctx, jours };
}
const D = iso => `new Date('${iso}T00:00:00')`;

test('la règle : jamais plus de 4 leçons par jour', () => {
  assert.ok(app.includes('const PLAN_MAX_JOUR=4;'));
  assert.ok(app.includes(`{k:'intensif',i:'30',t:"30 minutes",d:"~4 activités · rythme intensif",per:4,min:30}`), 'le rythme intensif : 4 leçons, plus 5');
  assert.ok(fn('nearestPlanLoad').includes('const loads=[2,3,PLAN_MAX_JOUR]'), '« Adapter mon rythme » : 2, 3 ou 4 par séance');
  assert.ok(fn('planAdjustSheetHTML').includes("{n:PLAN_MAX_JOUR,name:'Intensif',min:24}"));
  assert.ok(!/~5 activités|per:5\b|\{n:5,/.test(app), 'plus de séance de 5');
  const { ctx } = bac('2026-11-11', null);
  assert.deepEqual([ctx.planPer(5), ctx.planPer(9), ctx.planPer(4), ctx.planPer(2), ctx.planPer(0), ctx.planPer('x')], [4, 4, 4, 2, 3, 3]);
});

test('planRemplir : le jour même puis les jours du rythme, sans dépasser ce qui reste de place', () => {
  const { ctx } = bac('2026-11-11', null);
  const r = (reste, per, freq, iso, faits) => JSON.parse(JSON.stringify(vm.runInNewContext(`planRemplir(${JSON.stringify(reste)},${per},${freq},${D(iso)},${JSON.stringify(faits || {})})`, ctx))).map(s => s.d.slice(5) + ':' + s.lessons.join(','));
  const ids = Array.from({ length: 9 }, (_, i) => i + 1);
  // Rien de validé : les mêmes jours que datesMotif (onboarding, « Adapter mon rythme » avant le 11 novembre)
  for (const [freq, iso] of [[7, '2026-11-11'], [5, '2026-11-14'], [3, '2026-11-10'], [2, '2026-11-15']]) {
    const jours = r(ids, 3, freq, iso).map(x => x.split(':')[0]);
    assert.deepEqual(jours, [...vm.runInNewContext(`datesMotif(${D(iso)},${freq},3)`, ctx)].map(x => x.slice(5)), `${freq} jours, départ ${iso}`);
  }
  assert.deepEqual(r(ids, 5, 7, '2026-11-11'), ['11-11:1,2,3,4', '11-12:5,6,7,8', '11-13:9'], 'un rythme de 5 : 4 au plus');
  assert.deepEqual(r(ids, 4, 7, '2026-11-11', { '2026-11-11': 3 }), ['11-11:1', '11-12:2,3,4,5', '11-13:6,7,8,9'], '3 validées aujourd’hui : une seule de plus');
  assert.deepEqual(r(ids, 3, 7, '2026-11-11', { '2026-11-11': 6 }), ['11-12:1,2,3', '11-13:4,5,6', '11-14:7,8,9'], 'journée déjà pleine : à partir de demain');
  assert.deepEqual(r(ids.slice(0, 4), 2, 3, '2026-11-12', { '2026-11-12': 1 }), ['11-12:1', '11-13:2,3', '11-16:4'], 'jeudi (repos), 3 jours : jeudi, vendredi, lundi');
});

test('le cas qui donnait 5 et plus : une séance manquée et des leçons déjà validées aujourd’hui', () => {
  /* Rythme de 3, tous les jours. Hier : 3 leçons pas faites. Aujourd’hui : 4, 5, 6 prévues, 4 et 5 validées ce matin. Avant : 4, 5
     validées + 3 de plus aujourd’hui (5). Maintenant : 4, 5 + une seule de plus (3). */
  const x = bac('2026-11-11', { freq: 7, per: 3, sessions: [['11-10', [1, 2, 3]], ['11-11', [4, 5, 6]], ['11-12', [7, 8, 9]]] }, { 4: '11-11', 5: '11-11' });
  x.ctx.planDecalerAuto();
  assert.deepEqual(x.jours(), ['11-11:4,5,1', '11-12:2,3,6', '11-13:7,8,9']);
  assert.ok(x.ctx.state.plan.sessions.every(s => s.lessons.length <= 4));
  assert.equal(x.ctx.planDecalerAuto(), 0, 'puis plus rien ne bouge');
});

test('un planning d’avant, au rythme de 5 : rééquilibré à l’ouverture, 4 par jour', () => {
  const x = bac('2026-11-11', { freq: 7, per: 5, rythme: 'intensif', sessions: [['11-10', [1, 2, 3, 4, 5]], ['11-11', [6, 7, 8, 9, 10]], ['11-12', [11, 12, 13, 14, 15]]] },
    { 1: '11-10', 2: '11-10', 3: '11-10', 4: '11-10', 5: '11-10' });
  assert.equal(x.ctx.planSurcharge(x.ctx.state.plan), true);
  assert.equal(x.ctx.planDecalerAuto(), 1);
  assert.deepEqual(x.jours(), ['11-10:1,2,3,4,5', '11-11:6,7,8,9', '11-12:10,11,12,13', '11-13:14,15'], 'les 5 validées hier restent à leur jour (c’est fait)');
  assert.equal(x.ctx.state.plan.per, 4);
  assert.equal(x.ctx.state.plan.rythme, 'intensif');
  assert.equal(x.ctx.planSurcharge(x.ctx.state.plan), false);
  assert.equal(x.ctx.planDecalerAuto(), 0);
  // Une journée trop chargée (un ancien rééquilibrage), au rythme de 3 : rééquilibrée aussi
  const y = bac('2026-11-11', { freq: 7, per: 3, sessions: [['11-11', [1, 2, 3, 4, 5, 6]], ['11-12', [7]]] }, { 1: '11-11', 2: '11-11', 3: '11-11' });
  assert.equal(y.ctx.planSurcharge(y.ctx.state.plan), true);
  y.ctx.planDecalerAuto();
  assert.deepEqual(y.jours(), ['11-11:1,2,3', '11-12:4,5,6', '11-13:7']);
  // Plus de 4 leçons validées aujourd’hui, d’elles-mêmes : c’est fait, rien à corriger
  const z = bac('2026-11-11', { freq: 7, per: 3, sessions: [['11-11', [1, 2, 3, 4, 5]], ['11-12', [6, 7, 8]]] }, { 1: '11-11', 2: '11-11', 3: '11-11', 4: '11-11', 5: '11-11' });
  assert.equal(z.ctx.planSurcharge(z.ctx.state.plan), false);
});

test('partout où le planning se refait : la création, « Adapter mon rythme », l’onboarding revu, les leçons oubliées', () => {
  // La création : au plus 4 (le rythme le plus chargé), vérifié pour les trois rythmes dans tests/retours-1732.test.mjs
  assert.ok(fn('apercuPlan').includes('const perPref=(RYTHMES.find(r=>r.k===rythme)||RYTHMES[1]).per;'));
  const prev = fn('planAdjustPreview');
  assert.ok(prev.includes('const ancrees=planAnchorDone(p,data.done);') && prev.includes('planRemplir(data.remaining,choice.per,choice.freq,auj(),planFaitsParJour(ancrees))'));
  assert.ok(fn('planAdjustCommit').includes('p.sessions=planMergeSessions(preview.ancrees,preview.seances);'));
  assert.ok(fn('planAdjustCommit').includes("p.rythme=preview.choice.per===2?'calme':(preview.choice.per===PLAN_MAX_JOUR?'intensif':'regulier');"));
  const fo = app.slice(app.lastIndexOf('function finishOnboard('), app.indexOf('\n}\n', app.lastIndexOf('function finishOnboard(')));
  assert.ok(fo.includes('neuf.sessions=planMergeSessions(ancrees,planRemplir(reste,per,draft.freq,auj(),planFaitsParJour(ancrees)));'));
  assert.ok(fn('nettoyerPlan').includes('const per=planPer(p.per),tJour=dstr(auj());'));
  assert.ok(fn('planReequilibrer').includes('const nouv=planMergeSessions(ancrees,planRemplir(reste,per,p.freq,d,planFaitsParJour(ancrees)));'));
  assert.ok(fn('planDecalerAuto').includes('if(!enRetard.length&&p.equilibre===1&&!surcharge)return 0;'));
  // Le rythme le plus chargé de la création : 4
  const ctx = vm.createContext({});
  vm.runInContext(cut('const RYTHMES=[', 'const FREQS=[') + ';this.R=RYTHMES;', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.R.map(r => r.per))), [2, 3, 4]);
});
