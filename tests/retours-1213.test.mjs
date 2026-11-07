/* Elisa, 7 novembre, 12 h 13 (son GIF fait avec ChatGPT) : « C’est parti ! → « Ton parcours est prêt » (12) : pouce levé, puis il
   pointe devant lui. »
   - le GIF détouré et adouci au bord : assets/chat-parti.webp (12 images de 420 ms), en boucle sur la dernière page de
     l’onboarding ; en mouvement réduit, le pouce levé et le clin d’œil : chat-parti-fixe.webp ;
   - à la hauteur de l’autocollant (plus large), sa bulle « C’est parti ! » au même endroit ;
   - le GIF bouge déjà : plus de balancement par-dessus ; il se colle toujours à l’arrivée, sautille au toucher.
   Vérifié dans un navigateur (393 × 852 ; 320 × 680 : caché par obFit, comme l’autocollant). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-parti.webp', FIXE = 'assets/chat-parti-fixe.webp';

test('les deux images de « C’est parti ! » : le GIF d’Elisa et le pouce levé', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [302, 359]); assert.deepEqual(taille(fixe), [302, 359]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420));
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-parti.webp',\n  './assets/chat-parti-fixe.webp',\n"), 'hors ligne');
});

test('« Ton parcours est prêt » : le chat de « C’est parti ! » ; le pouce levé en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ window: { matchMedia: () => ({ matches: reduit }) }, matchMedia: () => ({ matches: reduit }), document: { documentElement: { dataset: {} } }, esc: s => String(s), escAttr: s => String(s), Date });
    vm.runInContext(cut('const MASCOT_IMG=', '/* Coucou : l’autocollant se balance'), ctx);
    const h = vm.runInContext("mascotMedalHtml({hi:'C’est parti !',intro:true,anim:'parti'})", ctx);
    assert.ok(h.includes(`<img class="mstk-cat is-parti" src="${reduit ? FIXE : ANIM}" width="302" height="359" alt="" draggable="false" data-anim="parti">`), String(reduit));
    assert.ok(h.includes('<span class="mstk-bub" aria-hidden="true">C’est parti !</span>'), 'sa bulle');
  }
  assert.ok(cut('html=`<div class="ob-screen ready">', 'obSetFooter(').includes("${mascotMedalHtml({hi:'C’est parti\\u00a0!',intro:!mascotReduced(),anim:'parti'})}"));
});

test('à la hauteur de l’autocollant, sans balancement par-dessus', () => {
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-screen.ready .mascot-stk:has(.mstk-cat.is-parti){width:98px}'), '78 px pour l’autocollant : la même hauteur');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-screen.ready .mascot-stk:has(.mstk-cat.is-parti) .mstk-bub{left:68%}'), 'la bulle au même endroit');
  assert.ok(ob.indexOf('.mascot-stk:has(.mstk-cat.is-parti){width:98px}') > ob.indexOf('html #onboarding.ob-vitrine .ob-screen.ready .mascot-stk{width:78px;'));
  const a = lq.indexOf('html.lq .mascot-stk .mstk-cat.is-parti{animation:none}');
  const b = lq.indexOf('html.lq .mascot-stk.is-intro .mstk-cat.is-parti{animation:mstkSlap .72s cubic-bezier(.2,.8,.3,1) .15s both}');
  const c = lq.indexOf('html.lq .mascot-stk.is-hello .mstk-cat.is-parti{animation:mstkHello .95s cubic-bezier(.3,.7,.4,1) both}');
  assert.ok(a > 0 && b > a && c > b, 'il se colle à l’arrivée, sautille au toucher, ne se balance plus');
  assert.ok(a > lq.indexOf('html.lq .mascot-stk.is-hello .mstk-cat{animation:mstkHello'), 'après les règles de l’autocollant');
});
