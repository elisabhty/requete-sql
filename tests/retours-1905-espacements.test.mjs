// Les espacements de l’onboarding, sur tous les iPhone (Elisa, 12 novembre, 19 h 05, sa capture de la page du pays : « Regarde au
// niveau des espacements de l’onboarding, c’est très bizarre, corrige l’onboarding entier sur tout type d’iPhone »).
// Mesuré page par page sur sept iPhone (375 × 667 à 440 × 956) : le titre était collé à la barre d’étapes (8 px), « Retour » à trois
// hauteurs selon la page, le pays flottait au milieu loin de son titre, le pseudo commençait tout en haut.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css');
const debut = obv.indexOf('/* ---------- 12 novembre, 19 h 05 (Elisa, sa capture de la page du pays');
const bloc = obv.slice(debut).replace(/\/\*[\s\S]*?\*\//g, ''), P = 'html #onboarding.ob-vitrine ';
/* clamp(mini, a·vh − b, maxi), pour une hauteur d’écran donnée */
const sousBarre = h => { const m = bloc.match(/--ob-sous-barre:clamp\((\d+)px,calc\(([\d.]+)vh - ([\d.]+)px\),(\d+)px\)/); assert.ok(m); return Math.min(+m[4], Math.max(+m[1], +m[2] * h / 100 - +m[3])); };

test('le bloc est le dernier de la feuille : il l’emporte sur les échelles du 4 et du 9 novembre', () => {
  assert.ok(debut > 0);
  assert.ok(debut > obv.indexOf('/* ---------- Le rythme des espacements (4 novembre, 15 h 42') && debut > obv.indexOf('/* ===== 9 novembre, 20 h 49'));
  assert.ok(debut > obv.indexOf('/* ---------- 12 novembre, 18 h 36'), 'après les autocollants de « bonjour »');
});

test('l’en-tête : « Retour » à la même hauteur sur toutes les pages qui en ont un', () => {
  assert.ok(bloc.includes(P + '#ob-body:has(>.ob-screen>.ob-flow-top:first-child){padding-top:6px}'));
  /* Les marges d’avant (20, 12 et 10 px selon la page) restent celles des pages sans en-tête ; la règle d’ici est plus précise */
  assert.ok(app.includes('#onboarding #ob-body{width:100%;height:100%;padding:20px 24px 12px;') && app.includes('#onboarding.ob-profile-step #ob-body{padding-top:12px}') && app.includes('#onboarding.ob-account-step #ob-body{padding-top:10px}'));
  /* Toutes les pages à en-tête le posent en premier dans la page */
  const pages = app.match(/<div class="ob-screen[^"]*">\$\{obFlowHeader\(slide\)\}/g) || [];
  assert.ok(pages.length >= 10, 'les étapes du profil commencent par obFlowHeader : ' + pages.length);
  for (const k of ['<div class="ob-screen ob-questions"><div class="ob-flow-top ob-flow-solo">${obBackButton()}</div>', '<div class="ob-screen ob-paywall"><div class="ob-flow-top ob-flow-solo pw-top">'])
    assert.ok(app.includes(k), k);
});

test('sous la barre d’étapes, le titre respire : 22 px sur un iPhone courant, 16 sur un SE ; la hauteur de l’écran décide', () => {
  assert.ok(bloc.includes(P + '.ob-screen>.ob-flow-top:not(.ob-flow-solo)+*,' + P + '.ob-screen>.ob-flow-top:not(.ob-flow-solo)+.ob-title{margin-top:var(--ob-sous-barre)!important}'));
  assert.ok(Math.abs(sousBarre(667) - 15.7) < .2, 'iPhone SE : ' + sousBarre(667));
  for (const h of [812, 844]) assert.ok(sousBarre(h) > 20 && sousBarre(h) <= 22, h + ' : ' + sousBarre(h));
  for (const h of [852, 874, 932, 956]) assert.equal(sousBarre(h), 22, 'h = ' + h);
  assert.equal(sousBarre(480), 12, 'jamais sous 12 px');
  /* Aucun palier ob-fit ne touche à cette marge : le titre reste sur la même ligne d’une page à l’autre */
  assert.ok(!/\.ob-fit-\d[^{]*\.ob-flow-top\+[^{]*\{[^}]*margin-top/.test(obv));
  /* Les règles d’avant (8 et 16 px), que celle-ci remplace : même précision ou moindre, et plus haut dans la feuille */
  for (const k of [P + '.ob-screen>.ob-flow-top+*{margin-top:16px!important}', P + '.ob-screen>.ob-flow-top+.ob-title{margin-top:8px!important}']) {
    const i = obv.indexOf(k); assert.ok(i > 0 && i < debut, k);
  }
  /* « Retour » seul (le rappel) : pas de barre, le titre à 14 px */
  assert.ok(bloc.includes(P + '.ob-screen>.ob-flow-solo+.ob-title{margin-top:14px!important}'));
});

test('toutes les pages posent leur contenu sous leur titre : ni le pays ni la première requête ne flottent', () => {
  assert.ok(obv.includes(P + '.ob-pays-step .ob-pays-carte.is-v2{flex-direction:column;align-items:stretch;gap:0;min-height:0;padding:18px 20px 16px}'));
  assert.ok(obv.includes(P + '.ob-screen.ob-pays-step>.ob-title:has(+.ob-pays-carte.is-v2){margin-bottom:84px!important}'), 'la place du chat assis sur la carte, et 16 px d’air');
  assert.ok(!/\.ob-pays-(step|carte|changer)[^{]*\{[^}]*margin-(top|bottom):auto/.test(obv) && !obv.includes('.ob-screen.ob-pays-step::after'));
  assert.ok(!obv.includes('.ob-practice:not(.is-result)>.ob-title{margin-top:auto'));
});

test('le pseudo, sans « Retour », garde la place de l’en-tête ; clavier ouvert, le titre remonte', () => {
  assert.ok(app.includes('<div class="ob-screen ob-profile ob-pseudo"><div class="ob-flow-top ob-flow-solo"></div><h1 class="ob-title" id="ob-title">'), 'un en-tête vide, sans espace dedans (:empty)');
  assert.ok(bloc.includes(P + '.ob-screen.ob-pseudo>.ob-flow-solo:empty+.ob-title{margin-top:calc(59px + var(--ob-sous-barre))!important}'));
  /* 59 px : la hauteur de l’en-tête complet (le bouton de 44 px, 7 px, la barre de 8 px) */
  const m = bloc.match(/html #onboarding\.ob-vitrine\.ob-clavier \.ob-screen:is\(\.ob-name,\.ob-pseudo\)>\.ob-flow-top\+\.ob-title\{margin-top:8px!important\}/);
  assert.ok(m, 'clavier ouvert : 8 px, comme avant');
  assert.ok(bloc.indexOf(m[0]) > bloc.indexOf('.ob-flow-solo:empty+.ob-title'), 'écrite après : elle l’emporte');
});
