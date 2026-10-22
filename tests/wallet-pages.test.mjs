/* Objets à thème « portefeuille » (guidePage, layouts coupons et loyalty) : leur CSS. Les bons des cours 22, 45 et 55 et les
   cartes de fidélité du cours 80 étaient dans le cours texte de ces cours en vidéo, retiré. */
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html} = env;

test('CSS du portefeuille : état final de base, états cachés seulement avant la lecture, pied retardé, pas de <code> (styles globaux)', () => {
  for (const s of [
    '.ij-sms.is-page:has(.pg-grid.is-coupons){--extra:.45s}',
    '.ij-sms.is-page:has(.pg-grid.is-loyalty){--extra:.5s}',
    '.ij-sms.is-page.is-play .pg-card.is-coupon{animation:pgCoupon .42s cubic-bezier(.25,.9,.3,1.2) both var(--t)}',
    '.ij-sms.is-page.is-play .pg-card.is-coupon::before{animation:pgCut .45s ease-in-out both calc(var(--t) + .25s)}',
    '.ij-sms.is-page:not(.is-play) .cp-code{clip-path:inset(0 100% 0 0)}',
    '.ij-sms.is-page.is-play .is-coupons .pg-stamp{animation-delay:calc(var(--t) + .7s)}',
    '.pg-card.is-coupon.is-stacked::before{display:none}',
    '.ij-sms.is-page.is-play .pg-card.is-loyal::after{animation:pgSheen .7s ease both calc(var(--t) + .35s)}',
    '.ij-sms.is-page.is-play .is-loyalty .pg-stamp{animation-delay:calc(var(--t) + .75s)}',
    '@keyframes pgSheen{from{transform:translateX(-130%)}}',
  ]) assert.ok(html.includes(s), s);
  assert.ok(!/\.ij-sms\.is-page:not\(\.is-play\)[^{]*\.(?:is-coupon|is-loyal|ly-slots)\b/.test(html), 'bons, cartes et cases restent visibles sans lecture');
});
