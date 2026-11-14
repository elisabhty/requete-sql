/* 14 novembre, 14 h 29 (Elisa, sa capture de Mes stats, une partie à 6) : « pour ce genre de graphique, ça peut descendre jusqu’en
   bas. Je préfère avoir +10. Sur toute cette page-là, je veux pas que ça déborde trop, qu’on doive trop scroller » ; 14 h 33 : « Ok »
   à mes quatre conseils. Mes stats passe de 3 080 à 2 190 px sur un iPhone 15 (une partie à 8 joueurs) :
   1. le barème est replié (son titre et ce qu’une manche peut rapporter) ; il s’ouvre d’un toucher, et tout seul depuis « Comment sont
      calculés les points ? » ;
   2. sous le graphique, au-delà de 3 joueurs : une ligne, le 1er, toi, puis « +N » qui déplie les autres ; chacun avec sa place ;
   3. « À plusieurs » : les derniers adversaires en une rangée de cartes, le podium moins haut ;
   4. la légende plus courte, sans chiffre d’exemple. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a >= 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };
const bloc = css.slice(css.indexOf('/* ---------- 14 novembre, 14 h 33 (Elisa : « je veux pas que ça déborde trop'));

const ctx = vm.createContext({
  esc: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'), perfDay: () => 'Aujourd’hui', perfGame: () => 'En solo · Facile',
  perfColor: () => 1, jeuInitial: n => String(n).replace('@', '')[0].toUpperCase(), JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' },
});
vm.runInContext(fn('perfCapHTML') + fn('perfTeintes'), ctx);
const cap = ppl => vm.runInContext('perfCapHTML(h)', Object.assign(ctx, { h: { at: 1, niv: 'f', solo: 0, players: ppl.length, ppl } }));
const puces = html => [...html.matchAll(/<span(?: class="([^"]*)")?><i class="jeu-av"[^>]*>[^<]*<\/i><small class="perf-cap-pl">([^<]+)<\/small><em class="perf-cap-n">([^<]+)<\/em><b>(\d+)<\/b><\/span>/g)]
  .map(m => [m[3], m[2], /is-plus/.test(m[1] || '') ? 'caché' : 'vu']);
const six = ['@marie_charlotte', '@jean_baptiste9', '@chloe_sql', '@alexandre_dupo', '@noah'].map((n, i) => ({ n, pts: 800 - i * 150, place: i < 4 ? i + 1 : 6 }))
  .concat([{ n: '@elisa', pts: 60, place: 5, me: 1 }]);

test('au-delà de 3 joueurs : le 1er, toi avec ta place, puis « +4 » ; les autres à leur place, cachés', () => {
  const h = cap(six);
  assert.ok(h.includes('<span class="perf-cap-ppl is-court">'));
  assert.deepEqual(puces(h), [['@marie_charlotte', '1er', 'vu'], ['@jean_baptiste9', '2e', 'caché'], ['@chloe_sql', '3e', 'caché'], ['@alexandre_dupo', '4e', 'caché'],
    ['Toi', '5e', 'vu'], ['@noah', '6e', 'caché']]);
  assert.ok(h.endsWith('<button type="button" class="perf-cap-plus" data-n="4" aria-expanded="false" aria-label="Voir les 4 autres joueurs" onclick="perfCapTout(this)">+4</button></span>'));
});

test('toi en tête : toi et le 2e ; 3 joueurs ou moins : tout le monde, sans « +N »', () => {
  const tete = six.map(x => x.me ? { ...x, place: 1, pts: 900 } : { ...x, place: x.place + 1 });
  assert.deepEqual(puces(cap(tete)).filter(x => x[2] === 'vu').map(x => x.slice(0, 2)), [['Toi', '1er'], ['@marie_charlotte', '2e']]);
  const trois = cap(six.slice(0, 2).concat([{ n: '@elisa', pts: 60, place: 3, me: 1 }]));
  assert.ok(!trois.includes('is-court') && !trois.includes('perf-cap-plus') && !trois.includes('is-plus'));
  assert.equal(puces(trois).length, 3);
});

test('« +4 » déplie, « Réduire » replie', () => {
  const cls = new Set(), attrs = {};
  const box = { classList: { toggle: k => (cls.has(k) ? (cls.delete(k), false) : (cls.add(k), true)) } };
  const b = { dataset: { n: '4' }, textContent: '+4', closest: () => box, setAttribute: (k, v) => { attrs[k] = v; } };
  vm.runInContext(fn('perfCapTout'), ctx);
  ctx.perfCapTout(b);
  assert.equal(b.textContent, 'Réduire'); assert.equal(attrs['aria-expanded'], 'true'); assert.ok(cls.has('is-tout'));
  ctx.perfCapTout(b);
  assert.equal(b.textContent, '+4'); assert.equal(attrs['aria-label'], 'Voir les 4 autres joueurs'); assert.ok(!cls.has('is-tout'));
  for (const r of ['html.lq #scr-defis .perf-cap-ppl.is-court:not(.is-tout){flex-wrap:nowrap}', 'html.lq #scr-defis .perf-cap-ppl.is-court:not(.is-tout)>span.is-plus{display:none}',
    'html.lq #scr-defis .perf-cap-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'])
    assert.ok(bloc.includes(r), r);
});

test('le barème replié, ouvert d’un toucher ou depuis « Comment sont calculés les points ? »', () => {
  const r = fn('renderDefisRules');
  assert.ok(r.includes('<section class="room-rules ${ouvert?\'is-ouvert\':\'is-ferme\'}" aria-labelledby="room-rules-h">'));
  assert.ok(r.includes('<button type="button" class="room-rules-tog" aria-expanded="${ouvert}" aria-controls="room-rules-corps" onclick="defisRulesOuvrir()">'));
  assert.ok(r.includes('<small>Jusqu’à ${parfaite}&nbsp;points par manche en ${JEU_NIVL[k]}</small>'));
  assert.ok(r.includes('<div class="room-rules-corps" id="room-rules-corps"${ouvert?\'\':\' hidden\'}>'));
  assert.ok(app.includes('let defisReglesOuvert=false;'));
  assert.ok(fn('defisStats').includes("if(regles){defisReglesNiv='';defisReglesOuvert=true;renderDefisRules();}"));
});

test('« À plusieurs » : une rangée de cartes ; le podium moins haut ; la légende sans chiffre', () => {
  assert.ok(fn('perfMateHTML').includes('<small>${m.g} partie${m.g>1?\'s\':\'\'}</small>'));
  for (const r of ['html.lq #scr-defis ul.perf-mates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));',
    'html.lq #scr-defis .perf-podium .jeu-step.is-1>i{height:62px!important}'])
    assert.ok(bloc.includes(r), r);
  assert.ok(app.includes('<p class="perf-legend is-ligne"><span><i class="perf-legend-o" aria-hidden="true"></i>points des adversaires</span><span class="perf-legend-t">au pied des barres&nbsp;: nombre de joueurs</span></p>'));
  assert.ok(!app.includes('perf-legend-n'), 'pas de chiffre d’exemple (31 octobre, 18 h 19)');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=381">') && sw.includes("const CACHE = 'requete-2026-11-14-essai-v3028';"));
});
