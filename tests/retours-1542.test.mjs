/* 4 novembre, 15 h 42 (Elisa) : « Étudie les espacements pour que ça soit le plus UI/UX possible ». Mesures écran par écran (iPhone de
   874, 844, 812 et 667 pt de haut) : une échelle commune ; les pages courtes (le pays, l’âge) ne laissent plus 190 à 220 px de vide
   au-dessus du bouton ; sur les petits écrans, la mascotte se fait petite au lieu de disparaître pour quelques pixels. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'onboarding-vitrine.css'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const i = css.indexOf('/* ---------- Le rythme des espacements (4 novembre, 15 h 42');
const rythme = css.slice(i).replace(/\/\*[\s\S]*?\*\//g, '');

test('une échelle commune : 16 px sous la barre d’étapes, 10 px sous le titre, 16 px avant la bulle, 20 px après', () => {
  assert.ok(i > 0, 'la section existe, en fin de feuille (elle l’emporte)');
  for (const k of ['html #onboarding.ob-vitrine .ob-flow-top{margin-bottom:16px}', 'html #onboarding.ob-vitrine .ob-pact .ob-title{margin-top:0}',
    'html #onboarding.ob-vitrine .ob-build-hero{margin-top:0}', 'html #onboarding.ob-vitrine .ob-title+.ob-lead{margin-top:10px!important}',
    'html #onboarding.ob-vitrine .ob-chat{margin:16px 0 20px!important}', 'html #onboarding.ob-vitrine .ob-chat+.ob-field{margin-top:0!important}',
    'html #onboarding.ob-vitrine .ob-hello-stage{margin-bottom:12px}', 'html #onboarding.ob-vitrine .ob-tv-badge+.ob-tv{margin-top:14px}'])
    assert.ok(rythme.includes(k), k);
  /* Les paliers de resserrement gardent leurs écarts plus serrés : leur règle est plus précise, elle l’emporte toujours */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-1 .ob-chat{grid-template-columns:58px 1fr!important;margin:10px 0 12px!important}'));
});

test('les pages courtes : le pays et l’âge grandissent et se posent au tiers de la place qui reste', () => {
  for (const k of ['html #onboarding.ob-vitrine .ob-screen.ob-pays-step{min-height:100%}', 'html #onboarding.ob-vitrine .ob-pays-step .ob-pays-carte{margin-top:auto;min-height:116px;padding:18px 20px}',
    'html #onboarding.ob-vitrine .ob-pays-step .ob-pays-changer{margin-bottom:auto}', "html #onboarding.ob-vitrine .ob-screen.ob-pays-step::after{content:'';margin-top:auto}",
    'html #onboarding.ob-vitrine .ob-screen.ob-age-step{min-height:100%}', 'html #onboarding.ob-vitrine .ob-age-step .ob-age-grid{margin-top:auto;margin-bottom:auto}',
    "html #onboarding.ob-vitrine .ob-screen.ob-age-step::after{content:'';margin-top:auto}", 'html #onboarding.ob-vitrine .ob-age-tile{min-height:100px}'])
    assert.ok(rythme.includes(k), k);
  /* Trois marges automatiques (au-dessus, au-dessous, puis l’élément vide de la fin) : un tiers de la place au-dessus, deux tiers en dessous */
  assert.ok(app.includes('<div class="ob-screen ob-profile ob-pays-step">') && app.includes('<div class="ob-screen ob-profile ob-age-step">'));
});

test('les petits écrans : la mascotte se fait petite au palier 3, part au palier 4 ; le cadre du rappel part en dernier', () => {
  for (const k of ['html #onboarding.ob-vitrine.ob-fit-3 .ob-chat{display:grid!important;grid-template-columns:40px 1fr!important;align-items:center!important;gap:10px!important;margin:8px 0 10px!important}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-chat img{width:40px!important}',
    '@media (max-height:700px){html #onboarding.ob-vitrine .ob-tv-ph{min-height:200px}}', 'html #onboarding.ob-vitrine.ob-fit-2 .ob-account{--stk-k:.87}'])
    assert.ok(rythme.includes(k), k);
  /* 11 novembre (6 h 54) : plus rien ne disparaît pour tenir, la page se met à l’échelle (obFit) : la mascotte et sa bulle restent, petites, à tous les paliers ; le cadre du rappel aussi */
  for (const k of ['.ob-fit-3 .ob-chat{display:none', '.ob-fit-4 .ob-chat{display:none', '.ob-rappel-step .ob-notif{display:none}'])
    assert.ok(!css.includes(k), k);
  assert.ok(app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4','ob-fit-5'];"), 'cinq paliers, comme avant');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=43">') && sw.includes("'./onboarding-vitrine.css?v=43',"), 'feuille rechargée');
});
