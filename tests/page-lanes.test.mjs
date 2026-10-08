/* Couloirs (guidePage, layout « lanes ») : carnet de route de la tournée (cours 9, look « route ») et trois versions d'un
   message (cours 21, look « versions »). Les cartes restent dans l'ordre du résultat (contrôle des pages) ; le CSS (order)
   les range sous la tête de leur couloir. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = l => { const b = l.studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const withBody = (l, f) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: f(l.studio.uses.body)})})});
const page = m => vm.runInContext(`guidePage(${JSON.stringify(m)})`, ctx);
const T = s => `calc(var(--t0,.15s) + .95s + ${s}*var(--sg,.28s))`;

test('cours 9 (IN) : carnet de route — les 4 étapes dans l’ordre du IN, chaque invité sous sa ville, la camionnette à la dernière', () => {
  const l = lessonOf(9), c = cardOf(l);
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:9;--sg:0\.45s" data-total="5"/, '4 étapes + 5 invités');
  assert.ok(c.includes('<div class="pg-grid is-lanes is-route">'));
  const heads = [...c.matchAll(/<div class="ln-head( is-last)?" style="order:(\d+);--t:([^;]+);--w:calc\((\d)\*var\(--sg,\.28s\)\)"><i class="ln-pin" aria-hidden="true">(\d)<\/i><b>([^<]+)<\/b><small>([^<]+)<\/small><\/div>/g)].map(m => [m[6], +m[2], m[3], +m[4], m[7], !!m[1]]);
  assert.deepEqual(heads, [['Lyon', 0, T(0), 3, 'Étape 1', false], ['Marseille', 2, T(3), 2, 'Étape 2', false], ['Bordeaux', 4, T(5), 2, 'Étape 3', false], ['Toulouse', 6, T(7), 2, 'Étape 4', true]], 'une étape par ville, la camionnette y reste jusqu’à la suivante');
  const cards = [...c.matchAll(/<div class="pg-card is-chip" style="order:(\d+);--t:([^"]+)"><i aria-hidden="true">📩<\/i><span class="pg-who"><b class="db-x pg-name" data-c="0" data-v="([^"]+)">/g)].map(m => [m[3], +m[1], m[2]]);
  assert.deepEqual(cards, [['Lucas', 1, T(1)], ['Emma', 3, T(4)], ['Chloé', 5, T(6)], ['Hugo', 1, T(2)], ['Gabriel', 7, T(8)]], 'ordre du résultat dans le DOM ; Lucas et Hugo (lignes 1 et 4) sous Lyon, chacun après l’arrivée à son étape');
  assert.ok(c.indexOf('class="ln-head') < c.indexOf('<div class="pg-card'), 'les étapes (sans donnée) avant la 1re carte');
  assert.ok(c.includes('<span class="db-x" data-c="2" data-v="Lyon" hidden></span></div>'), 'la ville, non montrée sur l’étiquette, est reportée');
  assert.ok(c.includes('</div><em class="pg-seal" aria-hidden="true">Tournée prête</em></div></div><p class="ij-sms-done">✓ 5 invitations envoyées, dont 2 pour l’étape de Lyon</p>'));
  assert.doesNotThrow(() => checkGuideLesson(env, l));
  assert.throws(() => checkGuideLesson(env, withBody(l, b => b.replace('data-c="2" data-v="Toulouse"', 'data-c="2" data-v="Nantes"'))), /la carte 5 montre toutes les colonnes/);
});

test('cours 21 (CASE) : trois versions du message — une bulle par catégorie, les pastilles dans l’ordre du résultat', () => {
  const l = lessonOf(21), c = cardOf(l);
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:10;--sg:0\.3s" data-total="10"/);
  assert.ok(c.includes('<div class="pg-grid is-lanes is-versions">'));
  const heads = [...c.matchAll(/<div class="ln-head is-bubble" data-g="(\d)" style="order:(\d+);--t:([^;]+);--tl:([^"]+)"><small class="ln-tag">([^<]+)<\/small><small class="ln-range">([^<]+)<\/small><span class="ln-msg">[^<]+<\/span><i class="ln-ticks" aria-hidden="true">✓✓<\/i><\/div>/g)].map(m => [m[5], +m[1], +m[2], m[3], m[4], m[6]]);
  assert.deepEqual(heads, [
    ['Jeune', 0, 0, 'calc(var(--t0,.15s) + 0.2s)', T(7), 'moins de 30 ans'],
    ['Adulte', 1, 2, 'calc(var(--t0,.15s) + 0.35s)', T(9), 'de 30 à 50 ans'],
    ['Senior', 2, 4, 'calc(var(--t0,.15s) + 0.5s)', T(5), 'plus de 50 ans'],
  ], '3 bulles d’abord ; le ✓✓ de chacune après son dernier destinataire (Gabriel, Nathan, Hugo)');
  const cards = [...c.matchAll(/<div class="pg-card is-chip" data-g="(\d)" style="order:(\d+);--t:([^"]+)"><b class="db-x pg-name" data-c="0" data-v="([^"]+)">[^<]+<\/b> <small class="db-x pg-sub" data-c="1" data-v="(\d+)">\d+<span class="ln-unit"> ans<\/span><\/small><span class="db-x" data-c="2" data-v="([^"]+)" hidden><\/span><\/div>/g)].map(m => [m[4], +m[5], m[6], +m[1], +m[2], m[3]]);
  const lane = {Jeune: 0, Adulte: 1, Senior: 2};
  const want = [['Sophie', 34, 'Adulte'], ['Lucas', 28, 'Jeune'], ['Emma', 45, 'Adulte'], ['Nathan', 31, 'Adulte'], ['Chloé', 26, 'Jeune'], ['Hugo', 52, 'Senior'], ['Léa', 38, 'Adulte'], ['Gabriel', 29, 'Jeune'], ['Inès', 41, 'Adulte'], ['Nathan', 30, 'Adulte']];
  assert.deepEqual(cards, want.map((r, i) => [...r, lane[r[2]], 2 * lane[r[2]] + 1, T(i)]), 'une pastille par client, dans l’ordre du résultat (rang = étape) : chacune saute dans son couloir ; Nathan (30 ans) chez les Adultes');
  assert.ok(c.includes('<p class="ij-sms-done">✓ 10 messages envoyés, chacun dans la version de sa catégorie</p>'));
  assert.doesNotThrow(() => checkGuideLesson(env, l));
  assert.throws(() => checkGuideLesson(env, withBody(l, b => b.replace('data-c="2" data-v="Senior"', 'data-c="2" data-v="Adulte"'))), /la carte 6 montre toutes les colonnes/);
});

test('couloirs : une valeur absente de order ouvre un couloir de plus, à la fin ; unité au pluriel ({s})', () => {
  const h = page({h: 'X', chrome: false, layout: 'lanes', look: 'versions', lane: {col: 1, order: ['A']}, name: 0, sub: [{col: 2, tpl: '{v} commande{s}'}], rows: [['p', 'B', 2], ['q', 'A', 1]], done: '✓'});
  assert.ok(h.includes('<div class="ln-head is-bubble" data-g="0" style="order:0;') && h.includes('<div class="ln-head is-bubble" data-g="1" style="order:2;'), 'A puis B (couloir ajouté)');
  assert.ok(h.includes('<div class="pg-card is-chip" data-g="1" style="order:3;') && h.includes('<div class="pg-card is-chip" data-g="0" style="order:1;'));
  assert.ok(h.includes('data-v="2">2<span class="ln-unit"> commandes</span></small>') && h.includes('data-v="1">1<span class="ln-unit"> commande</span></small>'));
  assert.ok(h.indexOf('ln-head') < h.indexOf('<div class="pg-card'));
});

test('CSS des couloirs : état final de base (mouvement réduit), états cachés seulement avant la lecture', () => {
  for (const s of [
    '.pg-grid.is-lanes{display:flex;flex-wrap:wrap;gap:5px;align-content:flex-start}',
    '.is-route .ln-head.is-last::after{opacity:1}',
    '.ij-sms.is-page:not(.is-play) .is-route .ln-head::after,.ij-sms.is-page:not(.is-play) .ln-ticks{opacity:0}',
    '.ij-sms.is-page.is-play .is-route .ln-head::after{animation:lnVan var(--w) ease both var(--t)}',
    '.ij-sms.is-page.is-play .is-route .ln-head.is-last::after{animation:lnVanStay .45s ease both var(--t)}',
    '.ij-sms.is-page.is-play .ln-ticks{animation:smsPop .3s cubic-bezier(.2,.8,.3,1.25) both calc(var(--tl) + .35s)}',
    '.ij-sms.is-page:has(.pg-grid.is-versions){--extra:.4s}',
    '@media (max-width:360px){.ln-unit{display:none}}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\n  \.ln-ticks\{[^}]*opacity:0/.test(html) && !/\n  \.is-route \.ln-pin\{[^}]*background:#fff/.test(html), 'sans lecture, ✓✓ visibles et épingles pleines');
});
