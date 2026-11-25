/* Elisa, 25 novembre, 15 h 39-15 h 47 (capture de l’émulateur Android : « conflit », puis « je parlais du gif qui cache le texte ») :
   sur la feuille de connexion, le chat à la clé cachait la fin de « Connecte-toi en un geste, et c’est parti ». 16 h 15 : « sur
   iPhone c’est ok, quand je te parle d’une correction là c’est que Android ». Sur Android seulement, le haut garde sous son texte la
   place de ce qui dépasse du chat ; l’iPhone garde ses réglages. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const px = (re) => { const m = css.match(re); assert.ok(m, String(re)); return +m[1]; };

test('Android : le texte du haut reste au-dessus du chat, pour les trois tailles du chat', () => {
  /* le chat (309 × 302, dessiné à partir de la 12e ligne) dépasse de la feuille de : hauteur − haut vide − 26 px posés dans la feuille */
  const depasse = l => l * 302 / 309 - l * 12 / 309 - 26;
  const l1 = px(/\.ob-acc-chat\{position:absolute;z-index:2;right:18px;bottom:calc\(100% - 26px\);width:(\d+)px/);
  const l2 = px(/\.ob-fit-2 \.ob-acc-chat\{width:(\d+)px/), l3 = px(/:is\(\.ob-fit-3,\.ob-fit-4,\.ob-fit-5\) \.ob-acc-chat\{width:(\d+)px/);
  const p1 = px(/html\.is-android #onboarding\.ob-vitrine:not\(\.ob-fit-2\) \.ob-acc-fond\{padding-bottom:(\d+)px\}/);
  const p2 = px(/html #onboarding\.ob-vitrine \.ob-acc-fond\{flex:1 1 auto;[^}]*padding:8px 28px (\d+)px;/);
  const p3 = px(/:is\(\.ob-fit-3,\.ob-fit-4,\.ob-fit-5\) \.ob-acc-fond\{min-height:112px;padding-bottom:(\d+)px\}/);
  for (const [l, p] of [[l1, p1], [l2, p2], [l3, p3]]) assert.ok(p >= depasse(l) + 6, `chat ${l} px : ${p} px gardés pour ${depasse(l).toFixed(1)} px`);
  /* la mesure de la page compte le haut avec cette marge, sur Android ; l’iPhone garde 210 px */
  assert.equal(px(/html\.is-android #onboarding\.ob-vitrine:not\(\.ob-fit-2\)\{--ob-fond-ref:(\d+)px\}/), 228);
  assert.equal(px(/html #onboarding\.ob-vitrine\{--ob-fond-ref:(\d+)px\}/), 210);
  /* html.is-android : posé par l’appli native sur Android */
  assert.ok(app.includes("document.documentElement.classList.add('is-native','is-'+(C.getPlatform?C.getPlatform():'native'));"));
});

test('Android : un message sous les boutons agrandit la feuille, la page se remesure ; l’iPhone ne change pas', () => {
  const i = app.indexOf('function obFit(){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes("const feuille=typeof appAndroid==='function'&&appAndroid()&&typeof screen.querySelector==='function'?screen.querySelector(':scope>.ob-acc-feuille'):null;"));
  assert.ok(f.includes("foot?foot.offsetHeight:0,feuille?feuille.offsetHeight:0].join(',')"));
});
