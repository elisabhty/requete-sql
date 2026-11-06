/* 5 novembre, 20 h 41 (Elisa, capture du sur-titre de la page Pratiquer, « À ton rythme ») : « À toi de jouer plutôt (page pratiquer) ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'index.html'), 'utf8');

test('Pratiquer : un sur-titre au-dessus du titre (« Entraîne-toi » depuis le 6 novembre)', () => {
  const page = app.slice(app.indexOf('<section id="scr-practice"'), app.indexOf('</section>', app.indexOf('<section id="scr-practice"')));
  /* 6 novembre, 16 h : la carte du haut dit désormais « À toi de jouer » ; Elisa choisit « Entraîne-toi » pour la page
     (retours-1520-pratiquer) */
  assert.ok(page.includes('<div class="eyebrow">Entraîne-toi</div><h1>Pratiquer</h1>'));
  assert.ok(!page.includes('À ton rythme'));
});
