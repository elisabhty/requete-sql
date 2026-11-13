/* Elisa, 13 novembre, 13 h 06, sur la première page de l’onboarding : « il n’y a pas le “Salut, moi c’est Requête…”, 2e bulle :
   “On explore le monde des données ensemble ?” », puis 13 h 09 : « non, l’une après l’autre ». Le chat se présente d’abord : une
   seule bulle, deux phrases l’une après l’autre. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), css = lire('onboarding-vitrine.css');

test('premier écran : la bulle dit « Salut, moi c’est Requête ! », puis « On explore le monde des données ensemble ? »', () => {
  const page = app.slice(app.indexOf("}else if(slide==='bonjour'){"), app.indexOf("}else if(slide==='questions'){"));
  assert.ok(page.includes("<p class=\"ob-bubble ob-bj-bulle ob-bj-suite\"><span class=\"ob-bj-dit ob-bj-dit-1\">${obTypo('Salut, moi c’est Requête !')}</span> <span class=\"ob-bj-dit ob-bj-dit-2\">${obTypo('On explore le monde des données ensemble ?')}</span></p>"), 'une seule bulle, les deux phrases dans l’ordre');
  assert.equal(page.split('class="ob-bubble').length - 1, 1, 'pas deux bulles');
  assert.ok(!page.includes("obTypo('Coucou !"), 'plus de « Coucou ! » dans la bulle');
  assert.ok(page.includes('setTimeout(obBjParler,0);'));
  /* la suite ne part qu’une fois l’écran de lancement parti */
  const f = app.slice(app.indexOf('function obBjParler(){'), app.indexOf('function langueLigneHTML(chevron){'));
  assert.ok(f.includes("l.classList.contains('is-sortie')") && f.includes("l.classList.contains('fade-out')") && f.includes("b.classList.add('is-parle')") && f.includes('if(!b.isConnected){clearInterval(t);return;}'));
  /* avec mouvement : les deux phrases à la même place, la seconde remplace la première ; sans : l’une sous l’autre */
  const mouvement = css.indexOf('@media (prefers-reduced-motion:no-preference){');
  /* (le réglage « Confort de lecture » de l’appli compte aussi : html[data-motion="reduce"]) */
  for (const regle of ['html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-bj-bulle.ob-bj-suite{display:grid!important;justify-items:center}',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-bj-suite>.ob-bj-dit{grid-area:1/1;align-self:center}',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-bj-suite>.ob-bj-dit-2{opacity:0}',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-bj-suite.is-parle>.ob-bj-dit-1{animation:obBjDit1 .3s ease-in 2.2s both}',
    'html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-bj-suite.is-parle>.ob-bj-dit-2{animation:obBjDit2 .4s cubic-bezier(.2,.9,.3,1.2) 2.5s both}']) {
    assert.ok(css.indexOf(regle) > mouvement && css.indexOf(regle) < css.indexOf('html #onboarding.ob-vitrine .ob-bj-dit{display:block}'), regle);
  }
  assert.ok(!css.includes('ob-bj-bulle-1') && !css.includes('ob-bj-bulle-2') && !app.includes('ob-bj-bulle-1'), 'plus rien des deux bulles empilées');
  /* en anglais aussi : la bulle entière se traduit d’un bloc */
  assert.ok(lire('langue-en.js').includes('"<1>Salut, moi c’est Requête !</1> <2>On explore le monde des données ensemble ?</2>": "<1>Hi, I’m Requête!</1> <2>Shall we explore the world of data together?</2>"'));
});
