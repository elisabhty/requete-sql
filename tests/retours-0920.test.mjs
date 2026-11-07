/* Elisa, 7 novembre, 9 h 20 (devant la carte « Ta semaine est en feu 🔥 ») : « Il y a trop d’icônes feu je trouve ; est-ce qu’on peut
   faire une animation avec le chat qui enflamme chaque flamme ? »
   - le titre perd son 🔥 et, la semaine faite, le chat prend la place de la flamme de la carte ;
   - une fois par ouverture de l’appli, quand l’accueil se montre, les flammes de la semaine sont éteintes, le chat saute sur chacune
     (rapetissé, debout sur le haut du rond) et elle s’allume quand il s’y pose, d’un bond et d’une onde ; puis il revient à sa place
     et se dandine ; les jours de repos gardent leur lune ;
   - mouvement réduit : tout est déjà allumé, rien ne bouge.
   Vérifié dans un navigateur (dimanche 8 novembre, sept jours faits : une capture toutes les 70 ms).
   10 h 30 : l’animation part de la carte ; la flamme du jour a sa page « Bravo », avec le GIF du chat (retours-1030). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la carte de la semaine faite : le chat à la place de la flamme, le titre sans 🔥', () => {
  const h = cut('function homeStreakHTML(', '\nfunction openAccountProgress(');
  assert.ok(h.includes("const title=semaineFaite?'Ta semaine est en feu':n?"));
  assert.ok(h.includes('<img class="lq-streak-chat" src="${typeof MASCOT_IMG!==\'undefined\'?MASCOT_IMG:\'assets/mascotte-autocollant.webp\'}" width="450" height="674" alt="" draggable="false">'));
  assert.ok(h.includes('<span class="lq-streak-flame" aria-hidden="true">${chat||LQ_FLAME_SVG}</span>') && h.includes("${semaineFaite?' is-semaine':''}"));
});

test('10 h 30 : plus d’animation sur la carte de la série (« on ne met pas d’animation au niveau de la série du haut »)', () => {
  /* La fête de la flamme du jour est passée sur une page « Bravo » (retours-1030) ; le chat reste sur la carte, immobile */
  for (const k of ['function lqSemaineFeu(', 'function lqChatAllume(', 'lqFeuJoue']) assert.ok(!app.includes(k), k);
  for (const k of ['is-allumage', 'is-feu', 'lqFeuPop', 'lqFeuOnde', 'lqChatFier', '.lq-streak-chat.is-fier']) assert.ok(!lq.includes(k), k);
  assert.ok(lq.includes('html.lq .lq-streak.is-semaine .lq-streak-flame{position:relative;z-index:3;width:40px;height:40px;background:none!important;'));
  assert.ok(lq.includes('html.lq .lq-streak-chat{display:block;width:34px;height:auto;margin:-12px auto -3px;pointer-events:none;'));
});
