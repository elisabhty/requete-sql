/* 14 novembre, 14 h 13 (Elisa, sa capture de la page de connexion, « Ton parcours est prêt, Uuu. ») : « Ok, sur cette page, parfois ça
   grandit, ça redescend. C’est jamais à la même longueur. »
   Mesuré (iPhone 15, 393 × 852) : la page était mise à l’échelle d’après toute sa hauteur, le haut violet compris ; selon le prénom
   (une ou deux lignes) et l’endroit d’où l’on venait (fin de l’onboarding, Mon compte), la même feuille sortait à 0,95 ou 1 (530 ou
   549 px) ; sur l’iPhone SE à 0,86, 0,84 ou 0,92, avec ou sans paliers. Et l’échelle retenue pour une page resservait à la suivante
   (obFitMemo) tant qu’elle tenait : la longueur dépendait de l’ordre des visites.
   - Pendant la mesure (ob-jauge), le haut compte pour une place fixe (un titre sur deux lignes : 210 px, 187 px aux paliers 3 à 5) ;
   - le haut ne pousse plus la feuille (flex 1 1 0) ;
   - le cadre ne défile plus sous le doigt sur cette page (sauf ob-fit-defile). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'onboarding-vitrine.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('la feuille a la même taille quel que soit le texte au-dessus', () => {
  const bloc = css.slice(css.indexOf('/* ---------- 14 novembre, 14 h 13'));
  assert.ok(bloc.length > 0);
  for (const r of [
    'html #onboarding.ob-vitrine{--ob-fond-ref:210px}',
    'html #onboarding.ob-vitrine:is(.ob-fit-3,.ob-fit-4,.ob-fit-5){--ob-fond-ref:187px}',
    'html #onboarding.ob-vitrine.ob-jauge .ob-screen.ob-account.is-feuille>.ob-acc-fond{flex:none!important;height:var(--ob-fond-ref)!important;min-height:0!important}',
    'html #onboarding.ob-vitrine:not(.ob-fit-defile):not(.ob-jauge) .ob-screen.ob-account.is-feuille>.ob-acc-fond{flex:1 1 0;min-height:0}',
  ]) assert.ok(bloc.includes(r), r);
  /* La mesure retire les hauteurs imposées de la page (ob-jauge) : la règle du haut doit passer après, et l’emporter */
  assert.ok(css.indexOf('html #onboarding.ob-vitrine.ob-jauge #ob-body>*{height:auto!important;min-height:0!important;max-height:none!important}') < css.indexOf('.ob-jauge .ob-screen.ob-account.is-feuille>.ob-acc-fond'));
  /* La feuille elle-même ne change pas : rien dans ce bloc ne la touche */
  assert.ok(!/\.ob-acc-feuille\{/.test(bloc));
});

test('plus d’élastique sous le doigt, sauf si la page ne tient vraiment pas', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-feuille-seule:not(.ob-fit-defile) .ob-slides{overflow-y:hidden;overscroll-behavior:none}'));
  assert.ok(app.includes("root.classList.toggle('ob-feuille-seule',slide==='account'&&!obLegalMode&&authReady&&"), 'la classe de la page de connexion');
});

test('la nouvelle feuille de style arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=73">'));
  assert.ok(sw.includes("'./onboarding-vitrine.css?v=73',") && sw.includes("const CACHE = 'requete-2026-11-24-module-v3138';"));
});
