/* Elisa, 10 novembre, 8 h 36 (captures du bilan) : « Cette page est top niveau design, mais elle fait très bizarre : on dirait des briques
   empilées, pas vraiment de cohérence. » Le bilan en chapitres de même allure : Ta récompense, Ton avis, Et maintenant. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}', a) + 2); };

test('trois chapitres, chacun son étiquette et son titre', () => {
  assert.ok(fn('bravoUnlockHtml').includes('<p class="bv-sec-k">Ta récompense</p>\n    <h2 class="mc-reveal-h" id="mc-reveal-h">'));
  const avis = fn('bravoAvisHtml');
  assert.ok(avis.includes('<p class="bv-sec-k">Ton avis</p>') && !avis.includes('av-lab'), 'plus d’autocollant « Ton avis »');
  assert.ok(avis.includes('<div class="av-carte">'), 'les étoiles dans une carte simple, le titre dehors');
  const page = fn('renderBravoSlide');
  assert.ok(page.includes('<section class="bravo-suite" aria-labelledby="bv-suite-h">\n        <p class="bv-sec-k">Et maintenant</p>'));
  assert.ok(page.indexOf('bravoNextHtml(l)') < page.indexOf('bravoActionsHtml(l)') && page.indexOf('bravo-suite') < page.indexOf('bravoNextHtml(l)'), 'les autres actions collées à la séance suivante');
});

test('la même allure : étiquette, titre à gauche, le même pas', () => {
  const s = css.slice(css.indexOf('/* ---------- 63. Le bilan, en chapitres'));
  for (const k of ['html.lq #scr-lesson .bravo-wrap{--bv-pas:34px}', 'html.lq #scr-lesson .bravo-wrap :is(.mc-reveal-h,.av-h,.bv-sec-h){margin:0 0 14px!important;color:var(--ink);font:800 23px/1.15 var(--display)!important;',
    'html.lq #scr-lesson .bravo-wrap .bravo-unlock.mc-reveal{margin:var(--bv-pas) 0 0!important', 'html.lq #scr-lesson .bravo-wrap .bravo-avis{margin:var(--bv-pas) 0 0!important;padding:0!important;border:0!important',
    'html.lq #scr-lesson .bravo-wrap .bravo-suite{margin:var(--bv-pas) 0 8px}', 'html.lq #scr-lesson .bravo-wrap .bravo-suite .bravo-next-btn .bn-cta{background:var(--sun)'])
    assert.ok(s.includes(k), k);
});
