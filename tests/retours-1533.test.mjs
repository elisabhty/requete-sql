/* 4 novembre, 15 h 33 (Elisa : « Corrige », sur la capture d’une testeuse : « Ici signer ça laisse pas de temps non plus ? Genre j’ai
   dessiné c’est parti vite »). Sur « Ton engagement », un trait tiré de gauche à droite dans le cadre était pris pour le balayage de
   l’onboarding (la page repartait en arrière ; de droite à gauche, une fois signé : « Je m’engage »), et « Signé ✓ » tombait dès la fin
   du premier trait.
   5 novembre, 19 h 41 : la signature laisse la place à un doigt maintenu sur un bouton à l’empreinte (retours-1941) ; le balayage ne
   part toujours pas de ce bouton. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('un doigt posé sur le bouton de l’engagement ne fait pas changer d’étape', () => {
  /* Le balayage ne démarre pas du bouton maintenu, ni d’un cadre où l’on glisse */
  const sw = cut('function brancherObSwipeV2(){', '/* 3 novembre, 23 h 21');
  assert.ok(sw.includes("if(e.target&&e.target.closest&&e.target.closest('.ob-hold,.ob-tv-ph,input,textarea,[role=\"slider\"]')){actif=false;return;}\n    x0=e.clientX;y0=e.clientY;actif=true;"));
  let actif = null;
  const zone = { addEventListener: (t, f) => { zone[t] = f; } };
  const ctx = vm.createContext({ obSwipe2On: false, document: { querySelector: s => (s === '.ob-slides' ? zone : null), getElementById: () => ({ style: {}, disabled: false, click() { actif = 'suivant'; } }) }, obBack: () => { actif = 'retour'; } });
  vm.runInContext('var obSwipe2On=false;' + sw, ctx);
  ctx.brancherObSwipeV2();
  const geste = (cible, x0, x1) => { actif = null; zone.pointerdown({ pointerType: 'touch', clientX: x0, clientY: 300, target: { closest: s => (cible && s.includes(cible) ? {} : null) } }); zone.pointerup({ clientX: x1, clientY: 300 }); return actif; };
  assert.equal(geste('.ob-hold', 20, 240), null, 'le doigt glisse un peu sur le bouton : on reste');
  assert.equal(geste('.ob-hold', 240, 20), null, 'dans l’autre sens non plus');
  assert.equal(geste(null, 20, 240), 'retour', 'ailleurs, le balayage marche toujours');
  assert.equal(geste(null, 240, 20), 'suivant');
});
