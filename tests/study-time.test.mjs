/* Temps d'étude : compté pendant les cours, révisions, défis, parties, console et entretien, seulement quand l'app est à
   l'écran et qu'on s'en sert ; affiché dans « Avancement global » (total, aujourd'hui, cette semaine) et par module. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const take = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));

test('sauvegarde : state.study (secondes par jour et par activité) est gardé et nettoyé', () => {
  const ctx = vm.createContext({});
  vm.runInContext(take('function normalizeState(', 'function normalize('), ctx);
  const st = ctx.normalizeState({ study: { days: { '2026-10-07': 125.7, 'hier': 30, '2026-10-06': -5, '2026-10-05': 999999 }, items: { l2: 600, dc1: 90, 'bad key!': 10, console: 'x' } } });
  assert.equal(JSON.stringify(st.study), JSON.stringify({ days: { '2026-10-05': 86400, '2026-10-07': 125 }, items: { l2: 600, dc1: 90 } }));
  assert.equal(JSON.stringify(ctx.normalizeState({}).study), '{"days":{},"items":{}}', 'rien d’enregistré : vide');
});

/* Moteur : relevés toutes les 5 s, horloge simulée. */
function engine() {
  let now = 1_000_000, saves = 0;
  const listeners = {};
  const doc = {
    visibilityState: 'visible', active: 'scr-lesson',
    querySelector: sel => (sel === '.screen.active' ? { id: doc.active } : null),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const ctx = vm.createContext({
    Date: { now: () => now }, document: doc, window: { addEventListener() {} }, setInterval() {},
    state: {}, current: { id: 2 }, mode: 'lesson', save: () => { saves++; }, dstr: () => '2026-10-07', auj: () => 0,
  });
  vm.runInContext(take('/* ---------- Temps d’apprentissage ----------', 'function jourActif('), ctx);
  vm.runInContext('initStudyClock()', ctx);
  const fire = t => (listeners[t] || []).forEach(f => f());
  const tick = (ms = 5000) => { now += ms; vm.runInContext('studyTick()', ctx); };
  return { ctx, doc, fire, tick, saves: () => saves, study: () => JSON.parse(JSON.stringify(ctx.state.study || {})) };
}

test('un cours ouvert et utilisé : chaque relevé ajoute 5 s à la leçon et au jour ; sauvegarde toutes les 30 s', () => {
  const e = engine();
  e.fire('pointerdown');
  for (let i = 0; i < 12; i++) e.tick();
  assert.equal(JSON.stringify(e.study()), '{"days":{"2026-10-07":60},"items":{"l2":60}}');
  assert.equal(e.saves(), 2, 'sauvegardé à 30 s et à 60 s');
});

test('plus aucun geste depuis 2 min : le temps ne compte plus ; il reprend au geste suivant', () => {
  const e = engine();
  e.fire('pointerdown');
  for (let i = 0; i < 30; i++) e.tick();                 /* 150 s : seules les 120 premières comptent */
  assert.equal(e.study().items.l2, 120);
  e.fire('scroll');
  e.tick();
  assert.equal(e.study().items.l2, 125, 'un défilement relance le compte');
});

test('app masquée, relevé en retard (veille), écran hors apprentissage : rien ne compte', () => {
  const e = engine();
  e.fire('pointerdown');
  e.doc.visibilityState = 'hidden'; e.tick(); e.tick();
  e.doc.visibilityState = 'visible'; e.fire('visibilitychange');
  e.tick(60000);                                          /* relevé très en retard */
  assert.equal(JSON.stringify(e.study()), '{}');
  e.doc.active = 'scr-planning'; e.tick();
  assert.equal(JSON.stringify(e.study()), '{}', 'le planning ne compte pas');
});

test('défi, révision, partie, console et entretien ont chacun leur clé', () => {
  const e = engine();
  e.fire('keydown');
  e.ctx.mode = 'defi'; e.ctx.current = { id: 'c1' }; e.tick();
  e.ctx.mode = 'review'; e.ctx.current = { id: 7 }; e.tick();
  e.ctx.mode = 'jeu'; e.tick();
  e.doc.active = 'scr-console'; e.tick();
  e.doc.active = 'scr-entretien'; e.tick();
  assert.equal(JSON.stringify(e.study().items), '{"dc1":5,"l7":5,"jeu":5,"console":5,"entretien":5}');
  assert.equal(e.study().days['2026-10-07'], 25);
});

test('l’app démarre le compteur au lancement', () => {
  const boot = take('async function boot(){', 'function initSpotlight(){');
  assert.ok(boot.includes('initStudyClock();'));
});

/* Affichage : durées, tuile « Temps d’étude », temps par module. */
const ctx = vm.createContext({});
vm.runInContext(take('function jour0(', 'function parseD(') + take('function parseD(', 'function openItem('), ctx);
vm.runInContext(take('function moduleProgressData(', 'function prefersReduceMotion('), ctx);
vm.runInContext(take('function pgrActivity(', 'function planManageHTML('), ctx);
const today = ctx.dstr(ctx.auj()), day = n => ctx.dstr(ctx.addJ(ctx.auj(), n));
Object.assign(ctx, {
  MODULES: [{ titre: 'Introduction', lessons: [{ id: 0 }] }, { titre: 'Lire une table', lessons: [{ id: 1 }, { id: 2 }] }],
  state: { lessons: { 0: { done: true } }, actDays: {}, plan: null, study: { days: {}, items: {} } },
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
  PL_OK_SVG: '', FLAME_SVG: '', PLAN_SLIDERS_SVG: '', DEF_CHEV_SVG: '',
  prefersReduceMotion: () => true, openLesson() {}, openItem() {},
  plur: (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`, isDefiId: id => typeof id === 'string',
  jourActif: () => false, jourRepos: () => false, debutPlan: () => null,
  streakJours: () => 0, streakRecord: () => 0, itemMeta: id => ({ titre: 'Leçon ' + id }), prochaineActiviteParcours: () => 1,
});
const st = { total: 3, done: 1, reste: 2, nL: 3, resteL: 2, nD: 0, resteD: 0, fin: null, seances: 2 };

test('durées : minutes, puis heures et minutes', () => {
  const N = ' ';
  assert.equal(ctx.fmtDuree(0), `0${N}min`);
  assert.equal(ctx.fmtDuree(30), `<${N}1${N}min`);
  assert.equal(ctx.fmtDuree(25 * 60 + 40), `25${N}min`);
  assert.equal(ctx.fmtDuree(2 * 3600 + 5 * 60), `2${N}h${N}05`);
  assert.equal(ctx.fmtDuree(3600), `1${N}h`);
  assert.equal(ctx.fmtDureeHTML(2 * 3600 + 5 * 60), `2<em>${N}h${N}</em>05`);
  assert.equal(ctx.fmtDureeHTML(45 * 60), `45<em>${N}min</em>`);
});

test('« Avancement global » : tuile Temps d’étude (total, aujourd’hui, cette semaine) ; état vide expliqué', () => {
  assert.match(ctx.planOverviewHTML(st), /<div class="pgr-stat is-t">[\s\S]*Temps d’étude[\s\S]*0<em> min<\/em>[\s\S]*Compté pendant tes cours, défis et exercices/);
  ctx.state.study = { days: { [today]: 12 * 60, [day(-3)]: 33 * 60, [day(-10)]: 80 * 60 }, items: { l1: 70 * 60, dc1: 55 * 60 } };
  const card = ctx.planOverviewHTML(st);
  assert.match(card, /<b>2<em> h <\/em>05<\/b>/, 'total = somme des activités');
  assert.match(card, /<dt>Aujourd’hui<\/dt><dd>12 min<\/dd>/);
  assert.match(card, /<dt>Cette semaine<\/dt><dd>45 min<\/dd>/, '7 derniers jours seulement');
});

test('par module : le temps passé sur ses leçons, à partir d’une minute', () => {
  ctx.state.study = { days: {}, items: { l1: 20 * 60, l2: 5 * 60 + 30, l0: 40 } };
  const rows = vm.runInContext('moduleProgressRows("all")', ctx);
  assert.match(rows, /Module 02 · En cours<span class="pgr-mod-time"><span class="pgr-sr">Temps d’étude : <\/span><svg[^>]*>[\s\S]*?<\/svg>25\smin<\/span><\/p>/, 'pastille ⏱ 25 min');
  assert.match(rows, /Module 01 · Terminé<\/p>/, 'moins d’une minute : rien d’affiché');
  const src = html.slice(html.indexOf('function renderModules('), html.indexOf('function toggleCatalogTools('));
  assert.ok(src.includes("${esc(status)}${secs>=60?studyPill(secs,'home-module-time'):''}"), 'et sur les modules de l’accueil');
  ctx.state.study = { days: {}, items: { l1: 90 } };
  assert.match(vm.runInContext('moduleProgressRows("all")', ctx), /Module 02 · En cours/, 'une minute d’étude suffit pour qu’un module soit « en cours »');
});
