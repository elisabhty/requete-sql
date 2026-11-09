/* Elisa, 5 novembre, 7 h 30 (capture de Safari, Schéma · base Wok Chinois, défilé) : « Trou en haut ».
   La rangée des pastilles (sticky, top:0) collait à 16 px du haut de la feuille : le retrait du haut du corps défilant. Le schéma
   passait dans ce trou, entre l’en-tête violet et les pastilles. Le retrait passe au premier bloc : la rangée colle tout en haut,
   et la feuille ouverte (sans défiler) garde la même place qu’avant. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Schéma : plus de trou au-dessus des pastilles quand on défile', () => {
  assert.ok(css.includes('html.lq #schema-sheet .sch-sheet-body{padding-top:0}'), 'le corps défilant n’a plus de retrait en haut');
  assert.ok(!css.includes('html.lq #schema-sheet .sch-sheet-body{padding-top:16px}'), 'l’ancien retrait (le trou) est parti');
  assert.ok(css.includes('html.lq #schema-sheet .sch-sheet-body>:first-child{margin-top:16px}'), 'le premier bloc garde ses 16 px');
  assert.ok(css.includes('html.lq #schema-sheet .sch-tabs:first-child{margin-top:0}'), 'les pastilles en premier : plus de -16 px');
  assert.ok(!css.includes('html.lq #schema-sheet .sch-tabs:first-child{margin-top:-16px}'));
  assert.ok(css.includes('html.lq #schema-sheet .sch-tabs{position:sticky;top:0;z-index:2;'), 'la rangée colle au haut, sur son fond');
  /* La règle des pastilles en premier vient après celle du premier bloc (même poids) : c’est elle qui gagne */
  assert.ok(css.indexOf('.sch-tabs:first-child{margin-top:0}') > css.indexOf('.sch-sheet-body>:first-child{margin-top:16px}'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=293">'), 'la feuille de style est rechargée');
});
