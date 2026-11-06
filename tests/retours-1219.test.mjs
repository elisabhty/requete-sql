/* Elisa, 6 novembre, 12 h 19 (sur « Comment veux-tu reprendre ? ») : « on peut mettre le recommandé ailleurs ? ça gêne pas ? ».
   L’autocollant « Recommandé » coupait le titre de son détail et rendait la carte plus haute que les autres : il se pose maintenant
   sur le bord de la carte recommandée, en haut à droite (la carte, toujours la première, laisse sa place au-dessus). Le texte ne
   bouge pas : VoiceOver lit toujours « Tout rattraper aujourd’hui, Recommandé ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');

test('« Recommandé » sur le bord de la carte, plus entre le titre et son détail', () => {
  assert.ok(lq.includes('html.lq .late-recovery .lr-option.is-reco .lr-option-title em{position:absolute;top:-13px;right:18px;z-index:2;rotate:4deg}'), 'en haut à droite, sur le bord');
  assert.ok(lq.includes('html.lq .late-recovery .lr-option.is-reco{margin-top:12px}'), 'la place de l’autocollant au-dessus de la carte');
  assert.ok(/html\.lq \.late-recovery \.lr-option\{\s*position:relative;/.test(lq), 'la carte porte l’autocollant');
  assert.ok(lq.indexOf('html.lq .late-recovery .lr-option-title em{padding:4px 9px 3px;') < lq.indexOf('.lr-option.is-reco .lr-option-title em{position:absolute'), 'après son style jaune');
  assert.ok(app.includes("<span class=\"lr-option-title\"><b>${o.title}</b>${reco?'<em>Recommandé</em>':''}</span>"), 'le même texte, lu avec le titre');
  assert.ok(app.includes("const order=[rec,...['shift','spread','today'].filter(k=>k!==rec)].filter(k=>options[k]);"), 'la carte recommandée, toujours la première');
});
