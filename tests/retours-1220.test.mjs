/* Elisa, 7 novembre, 12 h 20 (son GIF fait avec ChatGPT) : « Il présente → ouverture des cours (15) : il tend la patte vers le
   titre, comme un présentateur. »
   - le GIF détouré et adouci au bord : assets/chat-presente.webp (12 images de 420 ms), en boucle sur la carte d’ouverture d’un
     cours (lessonStartShow) ; en mouvement réduit, la patte tendue : chat-presente-fixe.webp ;
   - en bas à droite de la carte, comme l’autocollant, la patte tendue vers la gauche (le titre, la phrase, la durée) ; à sa hauteur,
     plus large ; il ne flotte plus par-dessus son geste ;
   - le bilan garde le chat qui saute de joie (retours-1131).
   Vérifié dans un navigateur (393 × 852 et 320 × 680 : la carte tient au même palier qu’avant). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-presente.webp', FIXE = 'assets/chat-presente-fixe.webp';

test('les deux images du présentateur : le GIF d’Elisa et la patte tendue', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [315, 362]); assert.deepEqual(taille(fixe), [315, 362]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420));
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-presente.webp',\n  './assets/chat-presente-fixe.webp',\n"), 'hors ligne');
});

test('l’ouverture d’un cours : le chat qui présente ; la patte tendue en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ mascotReduced: () => reduit });
    vm.runInContext(cut('const MASCOT_PRESENTE=', '\nfunction lessonStartShow(l,go){'), ctx);
    assert.equal(vm.runInContext('lstChatHtml()', ctx), `<img class="lst-stk is-presente" src="${reduit ? FIXE : ANIM}" width="315" height="362" alt="" draggable="false">`);
  }
  const carte = cut('function lessonStartShow(l,go){', '<ol class="lst-plan">');
  assert.ok(carte.includes('<div class="lst-chips">${chips.join(\'\')}</div>\n      ${lstChatHtml()}'), 'sous la durée, en bas à droite de la carte');
  assert.ok(!carte.includes('<img class="lst-stk" src="${MASCOT_IMG}"'));
});

test('à la hauteur de l’autocollant, sans flotter par-dessus son geste', () => {
  assert.ok(lq.includes('.lst-stk.is-presente{width:117px;animation:none}\n.lst.lst-fit-2 .lst-stk.is-presente{width:104px}\n.lst.lst-fit-3 .lst-stk.is-presente{width:88px}\n'), '90, 80 et 68 px pour l’autocollant : la même hauteur à chaque palier');
  assert.ok(lq.indexOf('.lst-stk.is-presente{') > lq.indexOf('.lst-stk{width:90px;bottom:-14px;right:-4px}'), 'après la règle de l’autocollant');
});
