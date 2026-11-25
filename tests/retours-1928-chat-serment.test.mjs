/* Elisa, 25 novembre, 19 h 28 (Galaxy S23) : « peut-être ici il y a un souci ? » : le chat du serment collait l'anneau du bouton à
   l'empreinte. Sur Android seulement, il s'écarte de 12 px à chaque taille ; l'iPhone garde ses réglages. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');

test('Android : le chat du serment s’écarte du bouton ; iPhone inchangé', () => {
  for (const [ios, android] of [
    ['html #onboarding.ob-vitrine .ob-hold-chat{position:absolute;bottom:0;left:calc(50% + 66px);width:92px;pointer-events:none}', 'html.is-android #onboarding.ob-vitrine .ob-hold-chat{left:calc(50% + 78px)}'],
    ['html #onboarding.ob-vitrine.ob-fit-4 .ob-pact .ob-hold-chat{left:calc(50% + 56px);width:80px}', 'html.is-android #onboarding.ob-vitrine.ob-fit-4 .ob-pact .ob-hold-chat{left:calc(50% + 68px)}'],
    ['html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold-chat{left:calc(50% + 44px);width:64px}', 'html.is-android #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold-chat{left:calc(50% + 54px)}'],
  ]) {
    assert.ok(css.includes(ios), ios);
    assert.ok(css.includes(android), android);
    assert.ok(css.indexOf(android) > css.indexOf(ios), 'la règle Android passe après');
  }
});

test('partout : l’engagement pris, plus de fil violet entre le rond et son halo', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold.is-done .ob-hold-ring{opacity:0}'));
  const r = 'html #onboarding.ob-vitrine .ob-pact .ob-hold.is-done,html #onboarding.ob-vitrine .ob-hold.is-done{box-shadow:0 0 0 9px rgba(159,240,198,.55),0 6px 0 #5FCB97,0 16px 30px -12px rgba(27,22,64,.6)}';
  assert.ok(css.includes(r));
  /* elle passe après la règle d'origine, qu'elle remplace */
  assert.ok(css.indexOf(r) > css.indexOf('html #onboarding.ob-vitrine .ob-hold.is-done{background:var(--v-mint);box-shadow:0 6px 0 #5FCB97,0 16px 30px -12px rgba(27,22,64,.6)}'));
  assert.ok(!css.includes('html.is-android #onboarding.ob-vitrine .ob-hold.is-done'));
});
