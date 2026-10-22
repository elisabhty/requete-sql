/* Objet à thème « doc » (guidePage, layout doc) : un document sur porte-bloc (le bon de commande du cours 5 était dans son
   cours texte, retiré : le cours est en vidéo). Reste le CSS du document. */
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html} = env;

test('CSS du document : état final de base, états cachés seulement avant la lecture, pied après le camion', () => {
  for (const s of [
    '.ij-sms.is-page:has(.dc-truck){--extra:1.4s}',
    '@media (max-width:360px){.dc-paper:has(>.pg-seal):has(>.dc-foot) .pg-grid.is-doc{margin-bottom:46px}}',
    '.ij-sms.is-page.is-play .pg-grid.is-doc .db-x::after{content:none}',
    '.ij-sms.is-page.is-play .pg-grid.is-doc .db-x{animation:none}',
    '.ij-sms.is-page.is-play .pg-card.is-line>.pg-main{animation:pgLine .35s steps(12,end) both var(--t)}',
    '.ij-sms.is-page.is-play .pg-card.is-line::before{animation:pgTick .28s cubic-bezier(.3,1.5,.5,1) both calc(var(--t) + .3s)}',
    '.ij-sms.is-page.is-play .dc-truck{animation:pgDrive 1s ease-out both calc(var(--to) + .5s)}',
    '.ij-sms.is-page:not(.is-play) .dc-gauge::before{width:0}',
  ]) assert.ok(html.includes(s), s);
  const css = html.slice(html.indexOf('/* @themed:doc:css */'), html.indexOf('/* @themed:lanes:css */'));
  assert.ok(!/opacity:0[;}]|[{;]width:0[;}]|scaleX\(0\)/.test(css.split('\n').filter(l => !/:not\(\.is-play\)|@keyframes/.test(l)).join('\n')), 'aucun état caché hors de :not(.is-play) et des keyframes');
});
