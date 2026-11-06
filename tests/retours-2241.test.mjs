/* Elisa, 6 novembre, 22 h 41, avec une capture du sélecteur d’applis : « L’application glisse quand je monte vers le haut pour changer
   d’appli genre et comme la barre de nav en bas est sensible mon appli part vers le haut (à l’intérieur de l’appli) ».
   La cause : depuis le 31 octobre (8 h 06), un glissement vertical commencé sur la barre d’onglets fait défiler l’écran ouvert
   (lqTabbarScroll). Le geste de l’iPhone pour changer d’appli part du bas de l’écran, sur la barre : l’écran montait avec le doigt,
   puis l’élan continuait quand l’iPhone reprenait le geste (touchcancel). Maintenant : un doigt posé sous les onglets, dans la bande
   de l’indicateur d’accueil (au moins les 14 derniers pixels), est laissé à l’iPhone ; si l’iPhone reprend un glissement déjà
   commencé, l’écran revient où il était, sans élan. Le glissement sur les onglets eux-mêmes fait toujours défiler l’écran. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\nfunction ', i + 10); return app.slice(i, j); };

/* Un iPhone : l’écran fait 844 px, les onglets finissent à 806 px (dessous, les 38 px de l’indicateur d’accueil). */
function iphone({ bas = 844, onglets = 806 } = {}) {
  let now = 0; const rafs = [], handlers = {}, screen = { scrollTop: 120 };
  const bar = { dataset: {}, addEventListener: (t, f, o) => { handlers[t] = { f, o }; },
    getBoundingClientRect: () => ({ top: onglets - 60, bottom: bas }), querySelectorAll: () => [1, 2, 3, 4, 5].map(() => ({ getBoundingClientRect: () => ({ bottom: onglets }) })) };
  const ctx = vm.createContext({
    document: { querySelector: sel => sel === '#app>.tabbar' ? bar : sel === '#app>.stage .screen.active' ? screen : null, addEventListener() {} },
    performance: { now: () => now }, Date: { now: () => now }, requestAnimationFrame: f => { rafs.push(f); return rafs.length; }, cancelAnimationFrame() {},
    prefersReduceMotion: () => false,
  });
  vm.runInContext(fn('lqTabbarScroll') + ';lqTabbarScroll();', ctx);
  const touch = (type, x, y) => { let prevented = false; handlers[type].f({ type, touches: y == null ? [] : [{ clientX: x, clientY: y }], cancelable: true, preventDefault: () => { prevented = true; } }); return prevented; };
  const glisse = (y0, pas = 8) => { touch('touchstart', 200, y0); let pris = false; for (let i = 1; i <= pas; i++) { now += 16; pris = touch('touchmove', 200, y0 - i * 25) || pris; } return pris; };
  return { screen, rafs, touch, glisse, tick: () => { for (let i = 0; i < 40 && rafs.length; i++) { now += 16; rafs.shift()(now); } } };
}

test('le geste de l’iPhone, depuis la bande de l’indicateur d’accueil : laissé à l’iPhone, l’écran ne bouge pas', () => {
  const t = iphone();
  assert.equal(t.glisse(830), false, 'aucun preventDefault : l’iPhone garde son geste');
  assert.equal(t.screen.scrollTop, 120, 'l’écran ne monte pas');
  t.touch('touchend', 0, null); t.tick();
  assert.equal(t.screen.scrollTop, 120, 'et pas d’élan');
  assert.equal(iphone().glisse(806), false, 'dès le bas des onglets');
});

test('l’iPhone reprend un glissement déjà commencé (touchcancel) : l’écran revient où il était, sans élan', () => {
  const t = iphone();
  assert.equal(t.glisse(800), true, 'sur les onglets, le glissement est pris');
  assert.equal(t.screen.scrollTop, 320, 'l’écran a suivi le doigt');
  t.touch('touchcancel', 0, null);
  assert.equal(t.screen.scrollTop, 120, 'il revient où il était');
  assert.equal(t.rafs.length, 0, 'sans élan');
});

test('le glissement sur les onglets fait toujours défiler l’écran, avec son élan (31 octobre)', () => {
  const t = iphone();
  t.glisse(790);
  assert.equal(t.screen.scrollTop, 320);
  t.touch('touchend', 0, null); t.tick();
  assert.ok(t.screen.scrollTop > 340, 'l’élan continue : ' + t.screen.scrollTop);
});

test('iPhone à bouton (pas d’indicateur d’accueil, 4 px sous les onglets) : les 14 derniers pixels restent à l’iPhone', () => {
  assert.equal(iphone({ bas: 667, onglets: 663 }).glisse(655), false, 'à 12 px du bord : le Centre de contrôle');
  assert.equal(iphone({ bas: 667, onglets: 663 }).glisse(650), true, 'plus haut, sur les onglets : l’écran défile');
});
