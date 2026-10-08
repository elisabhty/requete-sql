/* Objets à thème « portefeuille » (guidePage, layouts coupons et loyalty) : bons de réduction des cours 22 (seconde offre),
   45 (Magnésium, vert) et 55 (bienvenue, corail), cartes de fidélité vierges du cours 80. Chaque carte porte toutes les
   colonnes de sa ligne (contrôle des pages) ; le code du bon est un décor (préfixe + prénom sans accents), sans donnée. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessonOf = id => vm.runInContext(`MODULES.flatMap(m=>m.lessons).find(l=>l.id===${id})`, ctx);
const cardOf = id => { const b = lessonOf(id).studio.uses.body; return b.slice(b.lastIndexOf('<div class="ij-done is-locked"')); };
const count = (s, re) => (s.match(re) || []).length;
const withBody = (l, b) => Object.assign({}, l, {studio: Object.assign({}, l.studio, {uses: Object.assign({}, l.studio.uses, {body: b})})});

test('cours 22 : sept bons de la seconde offre — 3 montrés, une pile de 3, Nathan Dupont (30 ans pile) en dernier', () => {
  const c = cardOf(22);
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:5;--sg:0\.4s" data-total="7"/, '3 bons + 1 pile + 1 dernier');
  assert.ok(c.includes('<div class="pg-grid is-coupons has-pile">'));
  assert.equal(count(c, /<div class="pg-card is-coupon[ "]/g), 7, 'un bon par client, tous dans le DOM');
  assert.equal(count(c, /<div class="pg-card is-coupon is-stacked"/g), 3, 'Hugo, Gabriel et Inès empilés');
  assert.equal(count(c, /<div class="pg-more"[^>]*>… et 3 autres bons<\/div>/g), 1);
  assert.equal(count(c, /<em class="pg-flag">30 ans pile<\/em>/g), 1, 'la pastille sur le seul client de 30 ans');
  assert.ok(c.includes('<div class="pg-card is-coupon is-tail"'), 'Nathan Dupont reste en vue, après la pile');
  assert.deepEqual([...c.matchAll(/<span class="cp-code">([^<]*)<\/span>/g)].map(m => m[1]), ['LUCAS', 'EMMA', 'CHLOE', 'HUGO', 'GABRIEL', 'INES', 'NATHAN'].map(p => 'OFFRE2-' + p), 'code personnel, sans accents');
  assert.equal(count(c, /<span class="cp-val" aria-hidden="true"><i>🎁<\/i><b>2ᵉ offre<\/b><\/span>/g), 7, 'bloc de l’offre');
  assert.equal(count(c, /<em class="pg-stamp">Envoyé<\/em>/g), 7);
  assert.ok(!c.includes('ij-sms-bubble') && !c.includes('ij-sms-list'), 'plus de bulle de message');
});

test('cours 45 et 55 : bons verts (Magnésium, par email) et corail (bienvenue, par SMS)', () => {
  const c45 = cardOf(45), c55 = cardOf(55);
  assert.ok(c45.includes('<div class="pg-grid is-coupons" data-tone="green">'));
  assert.deepEqual([...c45.matchAll(/<span class="cp-code">([^<]*)<\/span>/g)].map(m => m[1]), ['MAG-SOPHIE', 'MAG-LUCAS']);
  assert.ok(c45.includes('<span class="db-x pg-sub" data-c="2" data-v="sophie@mail.fr">sophie@mail.fr</span>'), 'l’email, canal de l’offre');
  assert.ok(c55.includes('<div class="pg-grid is-coupons" data-tone="coral">'));
  assert.deepEqual([...c55.matchAll(/<span class="cp-code">([^<]*)<\/span>/g)].map(m => m[1]), ['BIENVENUE-INES', 'BIENVENUE-NATHAN'], 'Inès → INES');
  assert.ok(c55.includes('<span class="db-x pg-sub" data-c="2" data-v="06 39 98 97 50">📱 06 39 98 97 50</span>'), 'le téléphone, canal du SMS');
  for (const c of [c45, c55]) {
    assert.match(c, /style="--n:2;--sg:0\.6s" data-total="2"/);
    assert.equal(count(c, /<div class="pg-card is-coupon"/g), 2);
    assert.ok(!c.includes('has-pile') && !c.includes('ij-sms-bubble'));
  }
});

test('cours 80 : quatre cartes de fidélité vierges (8 cases vides, 0 point), dans l’ordre d’EXCEPT', () => {
  const c = cardOf(80);
  assert.match(c, /<div class="ij-sms is-board is-page" style="--n:4;--sg:0\.45s" data-total="4"/);
  assert.ok(c.includes('<div class="pg-grid is-loyalty">'));
  assert.equal(count(c, /<div class="pg-card is-loyal"/g), 4);
  assert.deepEqual([...c.matchAll(/<b class="db-x pg-name" data-c="0" data-v="([^"]*)">/g)].map(m => m[1]), ['Chloé', 'Emma', 'Gabriel', 'Hugo']);
  assert.equal(count(c, /<span class="db-x pg-sub ly-tel" data-c="1" data-v="06 39 98 \d\d \d\d">/g), 4, 'le téléphone de chaque client');
  assert.equal(count(c, /<span class="ly-slots" aria-hidden="true">(?:<i style="--i:\d"><\/i>){8}<\/span>/g), 4, '8 cases de tampons par carte');
  assert.equal(count(c, /<small class="ly-pts" aria-hidden="true">0\u00a0point pour l’instant<\/small>/g), 4, 'pas encore membres (sans répéter « à activer » du titre)');
  assert.ok(!/\.ly-pts\{display:none\}/.test(html), 'la ligne des points reste lisible à 320 px (elle passe à la ligne)');
  assert.equal(count(c, /<em class="pg-stamp">Envoyée<\/em>/g), 4);
  assert.ok(!c.includes('ij-sms-bubble'));
});

test('contrôle des pages : les quatre cours passent ; une valeur changée sur un bon ou une carte est refusée', () => {
  for (const id of [22, 45, 55, 80]) {
    const l = lessonOf(id), body = l.studio.uses.body;
    assert.doesNotThrow(() => checkGuideLesson(env, l), `cours ${id}`);
    /* La colonne 1 de la dernière carte (nom de famille, email, téléphone) reçoit une valeur fausse. */
    const k = body.indexOf('data-c="1" data-v="', body.lastIndexOf('<div class="pg-card'));
    assert.ok(k > 0, `cours ${id} : colonne 1 sur la dernière carte`);
    const bad = body.slice(0, k) + body.slice(k).replace(/data-c="1" data-v="([^"]*)"/, 'data-c="1" data-v="$1x"');
    assert.throws(() => checkGuideLesson(env, withBody(l, bad)), /montre toutes les colonnes/, `cours ${id}`);
  }
});

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
  for (const id of [22, 45, 55]) assert.ok(!/<code[ >]/.test(cardOf(id).slice(cardOf(id).indexOf('<div class="pg-grid'))), `cours ${id} : pas de <code> dans les bons`);
});
