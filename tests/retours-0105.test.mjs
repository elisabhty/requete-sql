/* Elisa, 7 novembre, 1 h 05, sur la capture de la connexion (Safari, avec les boutons) : « cours, exercices, défis et ta collection »,
   puis « Regarde si au niveau espacement ui ux on est bon ».
   - la carte : « Crée un compte pour retrouver tes cours, exercices, défis et ta collection sur tous tes appareils. » ;
   - les écarts suivent l’échelle de 4 px du 4 novembre : le titre et ses phrases à 10 px (un groupe), la carte et les boutons à 16 px
     puis 10 px entre les boutons (un autre groupe), 24 px entre les deux groupes ; les paliers les resserrent dans le même ordre, sans
     coller les boutons (8 px au plus serré : leur rebord fait 4 px) ;
   - au dernier palier, la mascotte reste (plus petite) : elle partait et laissait près de 100 px vides sous les boutons ; elle ne part
     que sur les écrans les plus bas (moins de 620 px). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('onboarding-vitrine.css'), sw = read('sw.js');

test('la carte dit « tes cours, exercices, défis et ta collection »', () => {
  assert.ok(app.includes('<small>Crée un compte pour retrouver tes cours, exercices, défis et ta collection sur tous tes appareils.</small>'));
  assert.ok(!app.includes('tes exercices et tes stickers'));
});

test('les écarts : deux groupes, l’échelle de 4 px, resserrés palier par palier sans coller les boutons', () => {
  for (const r of [
    'html #onboarding.ob-vitrine .ob-compte-lead{margin:10px auto 0;',
    'align-items:center;gap:13px;margin:24px 0 0;padding:13px 15px 13px 13px;',
    'html #onboarding.ob-vitrine .ob-compte-carte+.ob-provider-list{margin-top:16px!important}',
    'html #onboarding.ob-vitrine .ob-account .ob-provider{min-height:52px!important}',
    'html #onboarding.ob-vitrine.ob-fit-1 .ob-account .ob-provider-list{margin-top:14px!important;gap:10px!important}',
    'html #onboarding.ob-vitrine.ob-fit-1 .ob-account .ob-provider{min-height:48px!important}',
    'html #onboarding.ob-vitrine.ob-fit-1 .ob-compte-carte{margin-top:20px;padding:12px 14px 12px 12px}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-account .ob-provider-list{margin-top:12px!important}',
    'html #onboarding.ob-vitrine.ob-fit-3 .ob-compte-carte{gap:12px;margin-top:16px;',
    'html #onboarding.ob-vitrine.ob-fit-4 .ob-account .ob-provider-list{margin-top:10px!important;gap:8px!important}',
    'html #onboarding.ob-vitrine.ob-fit-4 .ob-compte-carte{margin-top:12px}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-account .ob-provider-list{margin-top:10px!important;gap:8px!important}'])
    assert.ok(css.includes(r), r);
  /* Jamais moins de 8 px entre deux boutons de connexion */
  const gaps = [...css.matchAll(/\.ob-account \.ob-provider-list\{[^}]*gap:(\d+)px/g)].map(m => +m[1]);
  assert.ok(gaps.length >= 4 && gaps.every(g => g >= 8), gaps.join());
});

test('au dernier palier, la mascotte reste ; elle ne part que sur les écrans les plus bas', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-5 .ob-account{--stk-k:.58}'));
  assert.ok(css.includes('@media (max-height:620px){\n  html #onboarding.ob-vitrine.ob-fit-5 .ob-compte-haut{display:none}\n  html #onboarding.ob-vitrine.ob-fit-5 .ob-account .ob-compte-haut+.ob-title{margin-top:auto!important}\n}'));
  const hors = css.replace(/@media \(max-height:620px\)\{[\s\S]*?\n\}/, '');
  assert.ok(!hors.includes('ob-fit-5 .ob-compte-haut{display:none}'), 'pas ailleurs');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=39">') && sw.includes("'./onboarding-vitrine.css?v=39',"));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-trente-v2745';") && app.includes("const SW_CACHE='requete-2026-11-09-trente-v2745';"));
});
