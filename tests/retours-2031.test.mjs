/* Elisa, 1er novembre, 20 h 31 (accueil, parcours terminé) : « Continuer à pratiquer avec une flèche, et ça nous ramène vers les
   défis (animation flèche) ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };

test('le bouton du parcours terminé : une flèche, et les défis', () => {
  assert.ok(app.includes('<button class="journey-primary lq-hero-cta lq-hero-cta-defis" type="button" aria-label="Continuer à pratiquer : les défis" onclick="homeVersDefis(this)"><span>Continuer à pratiquer</span><span class="lq-fleche" aria-hidden="true"><svg viewBox="0 0 24 24"'));
  assert.ok(!app.includes(`onclick="switchTab('practice')"><span>Continuer à pratiquer</span>`), 'plus vers Pratiquer');
});

test('au toucher : la flèche file, puis les défis ; mouvement réduit : tout de suite', () => {
  const tabs = [], timers = [];
  const cls = new Set();
  const btn = { classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
  const c = vm.createContext({ btn, reduce: false, switchTab: t => tabs.push(t), buzz() {}, prefersReduceMotion() { return c.reduce; }, setTimeout: (f, ms) => timers.push({ f, ms }) });
  vm.runInContext(fn('homeVersDefis'), c);
  vm.runInContext('homeVersDefis(btn)', c);
  assert.ok(cls.has('is-go')); assert.deepEqual(tabs, []); assert.equal(timers[0].ms, 300);
  vm.runInContext('homeVersDefis(btn)', c); assert.equal(timers.length, 1, 'un double toucher ne relance rien');
  timers[0].f(); assert.deepEqual(tabs, ['defis']); assert.ok(!cls.has('is-go'));
  c.reduce = true; vm.runInContext('homeVersDefis(btn)', c); assert.deepEqual(tabs, ['defis', 'defis']); assert.equal(timers.length, 1);
});

test('l’animation : la flèche avance et revient, puis file à droite', () => {
  for (const part of ['html.lq .lq-hero .lq-hero-cta-defis .lq-fleche svg{display:block;width:22px;height:22px;animation:lqFlecheNudge 1.6s ease-in-out infinite}',
    'html.lq .lq-hero .lq-hero-cta-defis.is-go .lq-fleche svg{animation:lqFlecheFile .3s cubic-bezier(.5,0,.75,0) forwards}',
    '@keyframes lqFlecheFile{0%{transform:none;opacity:1}100%{transform:translateX(38px);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){html.lq .lq-hero .lq-hero-cta-defis .lq-fleche svg{animation:none}}'])
    assert.ok(css.includes(part), part);
});
