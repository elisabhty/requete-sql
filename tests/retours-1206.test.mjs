/* Elisa, 7 novembre, 12 h 06 (son GIF fait avec ChatGPT) : « Il tape sur son ordi → « On construit ton parcours… » (11) : il tape
   vite, l’écran s’illumine. »
   - le GIF détouré et adouci au bord : assets/chat-ordi.webp (12 images de 420 ms), en boucle pendant la construction ; en
     mouvement réduit, l’écran allumé : chat-ordi-fixe.webp ;
   - à droite du titre, à la hauteur de l’autocollant (plus large que lui : la place est là, le texte du titre s’arrête bien avant) ;
   - le GIF tape déjà : plus de frétillement (obvWork) ni de balancement par-dessus ; il arrive, puis saute de joie quand le
     parcours est prêt.
   Vérifié dans un navigateur (393 × 852 : en cours, puis prêt ; 320 × 680 : caché par obFit, comme l’autocollant). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-ordi.webp', FIXE = 'assets/chat-ordi-fixe.webp';

test('les deux images de l’ordi : le GIF d’Elisa et l’écran allumé', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [314, 358]); assert.deepEqual(taille(fixe), [314, 358]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420));
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-ordi.webp',\n  './assets/chat-ordi-fixe.webp',\n"), 'hors ligne');
});

test('« On construit ton parcours… » : le chat qui tape sur son ordi ; l’écran allumé en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ mascotReduced: () => reduit });
    vm.runInContext(cut("const MASCOT_ORDI=", '\n}') + '\n}', ctx);
    assert.equal(vm.runInContext('obChatOrdiHtml()', ctx), `<img class="ob-build-stk is-ordi" src="${reduit ? FIXE : ANIM}" width="314" height="358" alt="" draggable="false">`);
  }
  assert.ok(app.includes('<h1 class="ob-title" id="ob-title">On construit<br><em>ton parcours</em>…</h1>${obChatOrdiHtml()}'), 'à droite du titre, à la place de l’autocollant');
  assert.ok(!app.includes('<img class="ob-build-stk" src="${MASCOT_IMG}"'));
});

test('à la hauteur de l’autocollant, sans frétillement par-dessus', () => {
  const base = 'html #onboarding.ob-vitrine .ob-build-stk{position:absolute;right:4px;bottom:-2px;height:calc(100% + 12px);width:auto;max-width:62px;object-fit:contain;rotate:6deg;transform-origin:50% 92%;filter:drop-shadow(0 5px 0 rgba(27,22,64,.25));-webkit-user-drag:none;user-select:none;pointer-events:none}\n';
  assert.ok(ob.includes(base), 'la règle de l’autocollant reste entière');
  assert.ok(ob.includes(base + '/* « Il tape sur son ordi »') && ob.includes('html #onboarding.ob-vitrine .ob-build-stk.is-ordi{max-width:76px}'), 'plus large : la même hauteur (celle du titre)');
  const media = ob.slice(ob.indexOf('@media (prefers-reduced-motion:no-preference){'));
  const a = media.indexOf('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-build:not(.is-built) .ob-build-stk.is-ordi{animation:obvStkIn .6s var(--v-pop) .05s both}');
  const b = media.indexOf('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-build.is-built .ob-build-stk.is-ordi{animation:obvJoy .8s var(--v-pop) both}');
  assert.ok(a > 0 && b > a, 'dans le bloc des mouvements, comme les règles de l’autocollant');
  assert.ok(a < media.indexOf('\n}\n'), 'avant la fin du bloc');
});
