/* Couloirs (guidePage, layout « lanes ») : les cartes restent dans l'ordre du résultat (contrôle des pages) ; le CSS (order)
   les range sous la tête de leur couloir. Le carnet de route (cours 9) et les trois versions du message (cours 21) étaient
   dans le cours texte de ces cours en vidéo, retiré. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const page = m => vm.runInContext(`guidePage(${JSON.stringify(m)})`, ctx);
const T = s => `calc(var(--t0,.15s) + .95s + ${s}*var(--sg,.28s))`;

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
