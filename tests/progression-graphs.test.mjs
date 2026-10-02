/* Parcours : les graphiques de « Avancement global » et « Ma progression par module ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ctx = vm.createContext({});
const take = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));

/* Dates réelles du parcours, outils de calendrier et modules (tels que dans l'app). */
vm.runInContext(take('function jour0(', 'function parseD(') + take('function parseD(', 'function openItem('), ctx);
vm.runInContext(take('function moduleProgressData(', 'function prefersReduceMotion('), ctx);
vm.runInContext(take('function pgrActivity(', 'function planManageHTML('), ctx);

const today = ctx.dstr(ctx.auj());
const day = n => ctx.dstr(ctx.addJ(ctx.auj(), n));
Object.assign(ctx, {
  MODULES: [
    { titre: 'Introduction', lessons: [{ id: 0 }] },
    { titre: 'Lire une table', lessons: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] },
    { titre: 'Jointures <b>', lessons: [{ id: 5 }, { id: 6 }] },
  ],
  state: { lessons: { 0: { done: true }, 1: { done: true }, 2: { done: true }, 5: { done: true } }, actDays: {}, plan: null },
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
  PL_OK_SVG: '<svg class="ok"></svg>', FLAME_SVG: '<svg class="flame"></svg>', PLAN_SLIDERS_SVG: '', DEF_CHEV_SVG: '',
  prefersReduceMotion: () => true, openLesson() {}, openItem() {},
  plur: (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`, isDefiId: id => typeof id === 'string',
  jourActif: iso => !!ctx.state.actDays[iso], jourRepos: () => false, debutPlan: () => day(-10),
  streakJours: () => 3, streakRecord: () => 5,
  itemMeta: id => ({ titre: 'Leçon ' + id }), prochaineActiviteParcours: () => 7,
});

/* Statut et lignes par module */
const rows = ctx.moduleProgressData(ctx.MODULES, ctx.state.lessons);
assert.deepEqual(rows.map(r => ctx.moduleStatus(r)), ['done', 'started', 'started']);
assert.equal(vm.runInContext('moduleProgressRows("all")', ctx).split('class="pgr-mod ').length - 1, 3);
assert.equal(vm.runInContext('moduleProgressRows("started")', ctx).split('class="pgr-mod ').length - 1, 2);
assert.equal(vm.runInContext('moduleProgressRows("done")', ctx).split('class="pgr-mod ').length - 1, 1);
assert.match(vm.runInContext('moduleProgressRows("todo")', ctx), /Tous les modules sont commencés/);
const all = vm.runInContext('moduleProgressRows("all")', ctx);
assert.match(all, /Jointures &lt;b&gt;/, 'titres échappés');
assert.match(all, /Revoir Introduction/); assert.match(all, /Continuer Lire une table/);
assert.match(all, /aria-valuenow="3" aria-label|aria-label="Progression du module Lire une table" aria-valuemin="0" aria-valuemax="4" aria-valuenow="2"/);

/* Carte des modules, filtres et aperçu en segments */
const explorer = vm.runInContext('moduleExplorerHtml()', ctx);
assert.equal(explorer.split('class="pgr-tile ').length - 1, 3, 'une tuile par module');
assert.match(explorer, /3 leçons validées|<b>4<em>\/7<\/em>/, 'total des leçons validées');
assert.match(explorer, /1 terminé · 2 en cours · 0 à découvrir/);
assert.equal(explorer.split('<b class="is-').length - 1, 3, 'un segment par module dans le résumé');
assert.match(explorer, /role="radiogroup" aria-label="Afficher les modules"/);
assert.match(explorer, /data-f="todo"/);

/* Activité : 14 jours, aujourd'hui en dernier, compte par jour */
ctx.state.actDays = { [today]: 2, [day(-1)]: 1, [day(-5)]: 4 };
const act = JSON.parse(JSON.stringify(ctx.pgrActivity(14)));
assert.equal(act.length, 14);
assert.equal(act[13].iso, today); assert.equal(act[13].today, true); assert.equal(act[13].count, 2);
assert.equal(act[12].count, 1); assert.equal(act[8].count, 4);
assert.equal(act[0].iso, day(-13));
assert.deepEqual(act.filter(a => a.kind === 'done').length, 3);
assert.equal(act[10].kind, 'missed', 'jour passé sans activité après le début du parcours');
assert.ok(act.every(a => /^[DLMJVS]$/.test(a.letter)));

/* Anneau : deux arcs proportionnels (leçons puis défis) */
const donut = ctx.pgrDonut(10, 5, 100);
assert.match(donut, /is-l" cx="50" cy="50" r="40" style="--len:25\.1;--off:0"/);
assert.match(donut, /is-d" cx="50" cy="50" r="40" style="--len:12\.6;--off:-25\.1"/);
assert.doesNotMatch(ctx.pgrDonut(0, 0, 100), /pgr-arc/, 'rien de validé : seulement la piste');

/* Carte complète */
const st = { total: 82, done: 13, reste: 69, nL: 58, resteL: 47, nD: 24, resteD: 22, fin: '2026-11-12', seances: 30 };
const card = ctx.planOverviewHTML(st);
assert.match(card, /16<small>%<\/small>/);
assert.match(card, /aria-label="16 % du parcours validé : 11 leçons et 2 défis sur 82 activités"/);
assert.match(card, /<b>11<em>\/58<\/em>/); assert.match(card, /<b>2<em>\/24<\/em>/);
assert.match(card, /Record 5 j/);
assert.equal(card.split('<li class="is-').length - 1, 14, '14 barres');
assert.match(card, /Cette semaine : <b>7 activités<\/b>, 7 de plus que la semaine d’avant/);
assert.match(card, /Prochain cap/); assert.match(card, /Leçon 7/); assert.match(card, /onclick="openItem\(7\)"/);
assert.match(card, /class="pl-overview-adjust"/, 'le bouton Ajuster reste branché sur la feuille de réglage');
ctx.state.actDays = {};
assert.match(ctx.planOverviewHTML(st), /dès ta première activité validée/, 'état vide expliqué');
ctx.prochaineActiviteParcours = () => null;
assert.doesNotMatch(ctx.planOverviewHTML(st), /class="pgr-go"/, 'parcours terminé : plus de bouton Continuer');
ctx.prochaineActiviteParcours = () => 'c3';
assert.match(ctx.planOverviewHTML(st), /openItem\('c3'\)/, 'un défi s’ouvre aussi');
console.log('Graphiques du parcours : OK');
