/* Elisa, 7 novembre, 0 h 03, sur les captures des deux feuilles « Widgets de l’écran d’accueil » et « Widgets de l’écran verrouillé » :
   « Pour les deux widgets -> ne pas mettre les suivants précédent ne pas mettre les cadres violets supprimer la dernieee phrase pour
   iPhone dans les deux et il faut que du coup ça fasse étape 1 -> étape 2 tout seul ».
   - plus de « Précédent » ni de « Suivant » ;
   - plus de note dans un cadre violet (acc-note) sous le pas-à-pas ;
   - plus de ligne « Les widgets viennent avec l’app Requête pour iPhone. Voir sur l’App Store » ;
   - les étapes s’enchaînent seules, comme des stories : 1 → 2 → 3 → 4 → 5 → 1. Une barre touchée y mène, et l’enchaînement repart
     de là. Le lecteur d’écran n’annonce une étape que quand on la touche. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('les deux feuilles : ni « Précédent » ni « Suivant », ni cadre violet, ni ligne pour iPhone', () => {
  const wtu = cut('const WTU={', '\n};\n');
  assert.ok(!/\bnote:/.test(wtu), 'plus de note pour les cadres violets');
  const guide = cut('function wtuGuideHTML(k){', '\n}\n');
  assert.ok(!/wtu-nav|wtu-prec|wtu-suiv|wtuPas|Précédent|Suivant/.test(guide), 'plus de boutons');
  assert.ok(guide.includes('<div class="wtu-guide" aria-live="off">${pas}</div>`;'), 'les étapes, juste sous les barres');
  assert.ok(app.includes("function wtuFeuilleHTML(k){\n  return k==='verrou'?wtuVerrouHTML():wtuAccueilHTML();\n}"), 'le pas-à-pas seul, dans l’app comme dans Safari');
  assert.ok(!app.includes('function wtuPas(') && !app.includes('wtu-web') && !app.includes('wtu-note'), 'le code des boutons et des lignes est parti');
  assert.ok(!/\.wtu-(nav|prec|note|web)\b/.test(lq), 'leurs styles aussi');
});

test('étape 1 → étape 2 tout seul : après la cinquième, la première ; une barre touchée y mène', () => {
  const jouer = cut('function wtuJouer(k,i){', '\n}\n');
  assert.ok(jouer.includes('const suite=i===n?1:i+1;'), 'l’étape suivante, puis la première');
  assert.ok(jouer.includes("wtuJouer(k,suite); },W.durees[i-1]+(i===n?1800:1200));"), 'le geste, une pause, puis la suite (un peu plus longue avant de repartir)');
  assert.ok(jouer.includes("if(!d||!d.open||!document.body.contains(box)){wtuStop();return;}"), 'feuille fermée : tout s’arrête');
  const aller = cut('function wtuAller(k,i){', '\n}\n');
  assert.ok(aller.includes("g.setAttribute('aria-live','polite')") && aller.includes('wtuJouer(k,i);'), 'touchée : annoncée, et l’enchaînement repart de là');
  assert.ok(cut('function wtuToggle(el){', '\n}\n').includes("g.setAttribute('aria-live','off')"), 'à l’ouverture, l’enchaînement se tait de nouveau');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=273">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-trente-v2745';") && app.includes("const SW_CACHE='requete-2026-11-09-trente-v2745';"));
});
