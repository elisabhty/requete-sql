/* 25 novembre, le parcours de l'appli Android sur les émulateurs de GitHub : sur le paywall, « Paiement Google Play » (plus long
   que « Paiement Apple ») faisait passer les trois garanties sur deux lignes, la 2e commençant par un trait. Sur Android : un peu
   plus serrées (une ligne de 360 à 412 de large), et pas de trait en début de ligne si elles passent quand même à la ligne. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');

test('Android seulement : les garanties plus serrées, sans trait en début de ligne', () => {
  assert.ok(css.includes('html.is-android #onboarding.ob-vitrine.ob-paywall-step #ob-foot-note .pw-confiance{font-size:min(11.4px,2.62vw)!important}'));
  assert.ok(css.includes('html.is-android #onboarding.ob-vitrine .pw-confiance>span{padding:0 4px}'));
  /* 26 novembre : le trait reste, invisible (sa largeur ne fait plus changer la ligne quand il part) */
  assert.ok(css.includes('html.is-android #onboarding.ob-vitrine .pw-confiance>span.is-debut{border-left-color:transparent}'));
  assert.ok(app.includes("if(typeof appAndroid==='function'&&appAndroid()&&typeof requestAnimationFrame==='function')requestAnimationFrame(pwConfianceLignes);"));
});

test('pwConfianceLignes : seule la garantie qui commence une nouvelle ligne perd son trait', () => {
  const debut = app.indexOf('function pwConfianceLignes(){');
  const fin = app.indexOf('\n}\n', debut) + 2;
  const run = tops => {
    const enfants = tops.map(t => ({offsetTop: t, cls: new Set(), classList: {toggle(c, on) { on ? this.o.add(c) : this.o.delete(c); }}}));
    enfants.forEach(e => { e.classList.o = e.cls; });
    const ctx = vm.createContext({document: {querySelector: () => ({children: enfants})}});
    vm.runInContext(app.slice(debut, fin) + '\npwConfianceLignes();', ctx);
    return enfants.map(e => e.cls.has('is-debut'));
  };
  assert.deepEqual(run([0, 0, 0]), [false, false, false]);
  assert.deepEqual(run([0, 0, 14]), [false, false, true]);
  assert.deepEqual(run([0, 14, 14]), [false, true, false]);
});
