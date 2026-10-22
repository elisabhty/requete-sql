/* Enveloppes (layout « envelope ») des cartes « Mission accomplie » : leur CSS. Les enveloppes des cours 4, 59 et 18 étaient
   dans le cours texte de ces cours en vidéo, retiré. */
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html} = env;

test('CSS des enveloppes : état final de base (carte rangée, cachets et coches posés), états cachés avant la lecture, pied retardé', () => {
  for (const s of [
    '.pg-grid.is-envelope{grid-template-columns:minmax(0,1fr);gap:18px;padding-top:22px}',
    '.env-card{position:absolute;z-index:0;left:12%;right:12%;top:-14px;box-sizing:border-box;',
    '@keyframes pgEnvCard{from{transform:translateY(-4px)}}',
    'text-align:center;transform:translateY(16px)}',
    '.ij-sms.is-page:not(.is-play) .env-post,.ij-sms.is-page:not(.is-play) .env-wax,.ij-sms.is-page:not(.is-play) .env-tick{opacity:0}',
    '.ij-sms.is-page.is-play .env-card{animation:pgEnvCard .55s cubic-bezier(.4,0,.2,1) both calc(var(--t) + .2s)}',
    '.ij-sms.is-page.is-play .env-post{animation:pgStamp .42s cubic-bezier(.2,.8,.3,1.25) both calc(var(--t) + .6s)}',
    '.ij-sms.is-page.is-play .env-stars i{animation:pgTwinkle .4s ease calc(var(--to) + var(--i)*.08s)}',
    '.ij-sms.is-page:has(.pg-grid.is-envelope){--extra:.5s}', '.ij-sms.is-page:has(.pg-grid.is-vip){--extra:.8s}', '.ij-sms.is-page:has(.pg-body>.env-hero){--extra:.9s}',
    '.ij-sms.is-page:not(.is-play) .pg-grid .pg-card.is-env.is-mini.is-warn{outline-color:transparent;background:#FFF8EC}',
    'pgEnvShake .3s ease calc(var(--t) + .4s),pgWarnOn .3s ease both calc(var(--t) + .4s)}',
    '@media (max-width:360px){.pg-grid.is-envelope.is-2{grid-template-columns:minmax(0,1fr)}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.env-card[^{]*\{/.test(html), 'la carte d’invitation n’est jamais cachée hors lecture : rangée dans l’enveloppe');
  assert.ok(!html.includes('.env-card small'), 'la carte se réduit à son titre : un onglet qui tient dans l’écart entre deux enveloppes');
  assert.ok(html.includes('.is-page .pg-grid .pg-card.is-env.is-mini.is-warn{border:1px solid #E9DCC3!important;outline:1.5px dashed #F59E0B;outline-offset:-1.5px}'), 'Hugo ne se distingue qu’à son tour : son liseré ambre est un outline (animable), pas la bordure !important du socle');
});
