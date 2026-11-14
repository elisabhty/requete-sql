/* 14 novembre, 14 h 46 (Elisa : « il y a toujours la ligne en bas de pseudo. Dans la page de l’onboarding, la barre là qu’on a
   trouvée ») : la ligne venait du liseré de l’appli, #app{box-shadow:0 0 0 1px var(--line)} (pensé pour l’ordinateur, où l’appli est
   une colonne au milieu). Clavier en mode « none » (13 novembre), l’appli se cale au-dessus du clavier puis redescend avec lui :
   l’anneau du bas passait à l’écran, un trait lavande de 1 px qui suivait le bas de l’appli, visible à travers le clavier translucide
   (mesuré : au prénom comme au pseudo, à chaque image de la descente ; plus aucun sans l’anneau). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('plus d’anneau autour de l’appli sur l’iPhone ni sur un écran de téléphone', () => {
  assert.ok(app.includes('#app{box-shadow:0 0 0 1px var(--line)}'), 'l’anneau reste sur ordinateur');
  const i = css.indexOf('html.lq.is-native #app{box-shadow:none!important}');
  assert.ok(i > 0 && css.includes('@media (max-width:599px){html.lq #app{box-shadow:none}}'));
  /* à côté du clavier qui monte, avant la refonte des Défis (dont les règles ne visent que les Défis) */
  assert.ok(i > css.indexOf('html.lq.is-native.kb-ouvert:has(#onboarding.on) body{background:#4529CC!important}') && i < css.indexOf('Défis — la refonte du 7 novembre'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=383">') && sw.includes("const CACHE = 'requete-2026-11-14-nepasdire-v3033';"));
});
