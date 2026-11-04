/* Elisa, 4 novembre, 21 h 27 (trois captures de l’iPhone). Réf. 1 : « il devrait y avoir un espace entre les deux cadres plus
   prononcé » (le rappel : la carte de l’heure et le cadre de la notification). Réf. 2 : « un bug de 2 s, écran plat à ce moment »
   (le tirage au sort d’une manche). Réf. 3 (« tu joues en tant que… mettre le drapeau ») est déjà là depuis les défis en trois onglets. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const ob = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('réf. 1 : le centrage du cadre de la notification ne le remonte plus au-dessus de sa marge', () => {
  const f = cut('function obNotifCaler(){', '\n}\n');
  assert.ok(f.includes('const marge=parseFloat(getComputedStyle(z).marginTop)||0;'));
  assert.ok(f.includes('prev.getBoundingClientRect().bottom+marge') && !f.includes('bottom+10'), 'plus de 10 px fixes : la marge du palier en cours');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-rappel-step .ob-notif{margin-top:32px}'), 'la marge de 17 h 27 (32 px, anneau de 9 px compris)');
});

test('réf. 2 : le tirage au sort remplit l’écran, son contenu au centre', () => {
  assert.ok(css.includes('html.lq #scr-lesson .jeu-draw{justify-content:center;min-height:max(420px,calc(100svh - var(--safe-top,0px) - var(--safe-bottom,0px) - 104px))!important}'));
  assert.ok(css.includes('html.lq #scr-lesson .jeu-draw .jeu-deck{scale:1.22;margin:52px auto 40px}'));
  assert.ok(css.includes('html.lq #scr-lesson .jeu-draw.is-reveal .jeu-deck{margin:0}'), 'au dévoilement, les cartes s’effacent sans laisser de vide');
});

test('réf. 3 : « Tu joues en tant que » porte le drapeau du joueur', () => {
  assert.ok(cut('<div class="jeu-me" data-nom="${id}">', '</div>').includes("${typeof jeuFlag==='function'?jeuFlag(nom):''}"));
});
