/* Elisa, 8 novembre, 13 h 09 puis 13 h 15 : « Est-ce vraiment un défi le texte ? » ; « dans la situation il n’explique pas vraiment
   le contexte, du style on est dans un escape game ». La consigne s’ouvre sur « La situation » (la question, c’est le titre). ed2 est
   réécrit comme modèle, à valider avant les autres : le lieu et ce qu’on y fait, la donnée en jeu, qui veut quoi et pourquoi, puis
   « À toi de jouer ! ». 13 h 28 puis 13 h 31 : 70, puis 100 mots au plus, pour bien poser le lieu. Les solutions ne changent pas. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';({challenges:CHALLENGES})');

test('la consigne s’ouvre sur « La situation » ; l’ancien format (une question seule) garde « La question »', () => {
  const i = app.indexOf('function defiConsigneHTML(c){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes('<span class="tag">La situation</span>${c.situation?'));
  assert.ok(f.includes('<span class="tag">La question</span><p class="defi-ctx">${esc(c&&(c.contexte||c.q)||\'\')'));
});

test('ed2, le modèle : l’escape game, le maître du jeu, les avis, le besoin de Malik, puis le défi', () => {
  const c = data.challenges.find(x => x.id === 'ed2');
  assert.equal(c.situation, 'Au Cadran Fêlé, un escape game lyonnais, des équipes de 2 à 6 joueurs s’enferment dans l’une des six salles à thème (braquage, enquête, épouvante…). Elles ont 60 à 90 minutes pour résoudre les énigmes et sortir. Pendant la partie, un maître du jeu les suit et leur souffle des indices quand elles bloquent. À la sortie, l’équipe peut laisser un avis noté de 1 à 5. Malik, qui dirige les maîtres du jeu, veut les classer selon leur note moyenne avant leurs entretiens annuels. À toi de jouer !');
  assert.match(c.situation, / veut /, 'le besoin');
  assert.match(c.situation, /À toi de jouer\u00a0!$/, 'le défi');
  assert.ok(c.situation.split(/\s+/).length <= 100, '100 mots au plus (8 novembre, 13 h 31)');
  assert.ok(c.sol.includes('DENSE_RANK() OVER (ORDER BY AVG(a.note) DESC)'), 'la solution ne change pas');
});
