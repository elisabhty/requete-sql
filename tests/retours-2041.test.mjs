/* 5 novembre, 20 h 41 (Elisa, capture du sur-titre de la page Pratiquer, « À ton rythme ») : « À toi de jouer plutôt (page pratiquer) ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'index.html'), 'utf8');

test('Pratiquer : « À toi de jouer » au-dessus du titre', () => {
  const page = app.slice(app.indexOf('<section id="scr-practice"'), app.indexOf('</section>', app.indexOf('<section id="scr-practice"')));
  assert.ok(page.includes('<div class="eyebrow">À toi de jouer</div><h1>Pratiquer</h1>'));
  assert.ok(!page.includes('À ton rythme'));
});
