/* Elisa, 7 novembre, 11 h 45 (son GIF fait avec ChatGPT) : « Il pose une question → questions de l’onboarding (10) : il penche la
   tête et se tapote le menton. »
   - le GIF détouré et adouci au bord : assets/chat-question.webp (12 images de 420 ms), en boucle tant que la question est là ; en
     mouvement réduit, l’image où il réfléchit, la patte au menton : chat-question-fixe.webp ;
   - toutes les bulles de l’onboarding (obMascotQuestion : prénom, pseudo, pays, âge, métier, objectif, niveau, première requête,
     comment tu as connu Requête, rappel, widget, rythme, jours) ;
   - à la largeur de l’autocollant : moins haut, il laisse la question et ses réponses tenir sans rapetisser l’écran (l’objectif
     tient avec un palier de moins) ; plus de balancement par-dessus, il arrive et saute de joie au choix comme avant.
   Vérifié dans un navigateur (393 × 852) : prénom, objectif. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-question.webp', FIXE = 'assets/chat-question-fixe.webp';

test('les deux images de la question : le GIF d’Elisa et le chat qui réfléchit', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [287, 362]); assert.deepEqual(taille(fixe), [287, 362]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420));
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-question.webp',\n  './assets/chat-question-fixe.webp',\n"), 'hors ligne');
});

test('chaque bulle de l’onboarding : le chat qui pose la question ; l’image fixe en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), mascotReduced: () => reduit });
    vm.runInContext(cut('const MASCOT_QUESTION=', 'function obMascotQuestion(text){') + cut('function obMascotQuestion(text){', '\n}') + '\n}', ctx);
    assert.equal(vm.runInContext("obMascotQuestion('Salut ! Comment dois-je t’appeler ?')", ctx),
      `<div class="ob-chat"><img class="ob-chat-stk is-question" src="${reduit ? FIXE : ANIM}" width="287" height="362" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Salut ! Comment dois-je t’appeler ?</div></div>`);
  }
  /* 14 h 04 : quelques bulles ont un autre chat (obMascotDit : coucou, « C’est parti ! », le présentateur, retours-1404) */
  const n = (app.match(/obMascot(?:Question|Dit)\(/g) || []).length;
  /* 12 novembre, 12 h 24 : la page du pays n’a plus de bulle (sa carte dit tout, le chat est assis dessus) */
  assert.ok(n >= 17, `les bulles de l’onboarding passent toutes par obMascotQuestion ou obMascotDit (${n})`);
});

test('à la largeur de l’autocollant, sans balancement par-dessus', () => {
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-chat img.is-question{aspect-ratio:287/362}'), 'sa vraie forme, pas celle de l’autocollant');
  assert.ok(ob.indexOf('.ob-chat img.is-question{aspect-ratio') > ob.indexOf('html #onboarding.ob-vitrine .ob-chat img{width:72px!important;height:auto!important;aspect-ratio:450/674;'));
  assert.ok(ob.includes('box-shadow:none!important;\n  filter:none!important;rotate:-5deg;transform-origin:50% 92%;'), 'la règle de l’autocollant reste entière (rien d’inséré au milieu)');
  assert.ok(!/\.ob-chat:has\(img\.is-question\)\{grid-template-columns/.test(ob), 'la colonne du chat garde sa largeur (une colonne plus large faisait disparaître la bulle de l’objectif)');
  const a = ob.indexOf('html #onboarding.ob-vitrine .ob-chat img.is-question{animation:obvApparait .24s ease-out both}');
  const b = ob.indexOf('html #onboarding.ob-vitrine:not(.ob-enter) .ob-chat img.is-question{animation:none}');
  const c = ob.indexOf('html #onboarding.ob-vitrine.ob-cheer .ob-chat img.is-question{animation:obvJoy .8s var(--v-pop) both}');
  assert.ok(a > 0 && b > a && c > b, 'il arrive, ne se balance plus, saute de joie au choix (dans cet ordre, la dernière l’emporte)');
  assert.ok(ob.indexOf('html #onboarding.ob-vitrine.ob-cheer .ob-chat img{animation:obvJoy') < a);
});
