/* Elisa, 13 novembre, 1 h 32, sur sa capture du premier écran (« Coucou ! On explore les données ensemble ? ») :
   « le monde des données ». La bulle dit « Coucou ! On explore le monde des données ensemble ? », toujours sur deux lignes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = lire('index.html');
const css = lire('onboarding-vitrine.css');

test('la bulle du premier écran : « le monde des données », sur deux lignes sans que la page rapetisse', () => {
  /* 13 novembre, 13 h 06 et 13 h 09 : la bulle dit d’abord « Salut, moi c’est Requête ! », puis cette phrase, sans son « Coucou ! » */
  assert.ok(html.includes("<span class=\"ob-bj-dit ob-bj-dit-2\">${obTypo('On explore le monde des données ensemble ?')}</span></p>"));
  assert.ok(!html.includes("obTypo('Coucou ! On explore les données ensemble ?')"));
  /* Plus longue, elle passait sur trois lignes : un peu plus large, un point de moins, les lignes équilibrées */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-bj-bulle{max-width:372px;padding-left:18px!important;padding-right:18px!important;font-size:20px!important;text-wrap:balance}'));
  /* Après la règle commune aux deux bulles (qu’elle précise), avant le palier des petits écrans (qui garde la main) */
  const commune = css.indexOf('html #onboarding.ob-vitrine :is(.ob-bj-bulle,.ob-qs-bulle){position:relative;'), elle = css.indexOf('html #onboarding.ob-vitrine .ob-bj-bulle{max-width:372px;'), palier = css.indexOf('html #onboarding.ob-vitrine.ob-fit-2 :is(.ob-bj-bulle,.ob-qs-bulle){font-size:19px!important;');
  assert.ok(commune > 0 && commune < elle && elle < palier);
});
