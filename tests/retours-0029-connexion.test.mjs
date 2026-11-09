/* Elisa, 7 novembre, 0 h 29, avec une réf. de l’étape 13 sur 14 (la mascotte qui salue, des confettis, l’étiquette « Bravo ! »,
   « Ta première requête est réussie ! 🎉 », « Tu viens de franchir une première étape. Et ce n’est que le début ! », une carte
   « Sauvegarde ta progression » avec un nuage) : « Refonte du haut de la page de connexion ».
   - la mascotte, plus grande, sur une tache plus claire, entre des confettis et des rayons jaunes ; « Bravo ! » à son pied, penché ;
   - les deux phrases, une par ligne ;
   - la carte « Sauvegarde ta progression » à la place de la phrase « Tu pourras sauvegarder… » ; « badges » devient « stickers » ;
   - dans l’app iPhone sans connexion branchée, pas de carte (pas de promesse d’un compte qu’on ne peut pas créer, retours-2208) ;
   - sur les petits écrans, la mascotte rapetisse palier par palier ; au dernier, le haut part et la carte garde son titre. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('onboarding-vitrine.css'), sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const NB = ' ';

const fournisseurs = cut('const OB_PROVIDERS=', '/* 10 h 16 : pas encore de connexion.');
const page = cut("  }else if(slide==='account'){", "  }else if(slide==='name'){");
const rendre = ({ practiceDone = true, masquee = false } = {}) => {
  const ctx = vm.createContext({ slide: 'account', authReady: false, obAuthBusy: false, obAuthMessage: '', draft: { practiceDone }, MASCOT_IMG: 'mascotte.webp',
    obConnexionMasquee: () => masquee, obFlowHeader: () => '<header></header>', esc: s => String(s), escAttr: s => String(s), legalUrl: k => k,
    obSetFooter() {}, obPasserConnexion() {} });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS='), ctx);
  vm.runInContext("var html='';if(slide==='x'){" + page + '}', ctx);
  return ctx.html;
};

test('le haut de la page : la mascotte sur sa tache, les confettis, « Bravo ! », le titre, les deux phrases, la carte', () => {
  const h = rendre();
  const haut = h.slice(h.indexOf('<div class="ob-compte-haut">'), h.indexOf('<h1'));
  assert.ok(haut.includes('<svg class="ob-compte-fond" viewBox="0 0 330 150" width="330" height="150" aria-hidden="true" focusable="false">'), 'la tache, dessinée');
  assert.ok(haut.includes('<svg class="ob-compte-confettis" viewBox="0 0 330 150"') && haut.includes('<path class="ob-compte-rai"'), 'les confettis et les rayons, dans le même cadre');
  for (const c of ['#FFC83D', '#FFD86B', '#7CC7FF', '#FF8FB1', '#9FF0C6']) assert.ok(haut.includes(c), 'les couleurs des confettis de l’app : ' + c);
  assert.ok(haut.includes('<img class="ob-promise-stk ob-compte-stk" src="mascotte.webp" width="450" height="674" alt="" draggable="false">'), 'la mascotte qui salue');
  assert.ok(haut.endsWith(`<svg class="ob-compte-rayons" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true" focusable="false"><path d="M20 4 10 2M19 10 6 14M22 15l-6 9"/></svg>Bravo${NB}!</p></div>\n      `), '« Bravo ! », lu avant le titre, avec ses rayons');
  assert.ok(h.includes(`<p class="ob-compte-lead"><span>Tu viens de franchir une première étape.</span> <span>Et ce n’est que le début&nbsp;!</span></p>`), 'une phrase par ligne');
  const carte = h.slice(h.indexOf('<div class="ob-compte-carte">'), h.indexOf('<div class="ob-provider-list">'));
  assert.ok(carte.includes('<span class="ob-compte-carte-ico" aria-hidden="true"><svg viewBox="0 0 32 32"'), 'le nuage dans sa pastille');
  assert.ok(carte.includes('<b>Sauvegarde ta progression</b><small>Crée un compte pour retrouver tes cours, exercices, défis et ta collection sur tous tes appareils.</small>'));
  assert.ok(!/badges|[Bb]ientôt|[Pp]rochainement/.test(carte), 'les mots de l’app (1 h 05 : « cours, exercices, défis et ta collection ») ; jamais « bientôt »');
  assert.ok(!h.includes('ob-compte-sub'), 'la carte remplace la phrase');
  const ordre = ['ob-compte-fond', 'ob-compte-stk', 'ob-compte-bravo', 'ob-title', 'ob-compte-lead', 'ob-compte-carte', 'ob-provider-list'].map(k => h.indexOf(k));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'dans l’ordre de la réf.');
});

test('dans l’app sans connexion branchée : la fête, sans carte ni boutons ; sans première requête réussie : la mascotte, sans fête', () => {
  const m = rendre({ masquee: true });
  assert.ok(m.includes('ob-compte-bravo') && m.includes('ob-compte-confettis') && !m.includes('ob-compte-carte') && !m.includes('ob-provider-list'));
  const s = rendre({ practiceDone: false });
  assert.ok(s.includes('ob-compte-fond') && s.includes('ob-compte-stk') && !s.includes('Bravo') && !s.includes('ob-compte-confettis') && !s.includes('ob-compte-carte'));
  assert.ok(s.includes('<p class="ob-compte-sub">Tu pourras la sauvegarder et reprendre tes cours sur tous tes appareils.</p>'));
});

test('les styles : tout suit la taille de la mascotte, qui rapetisse palier par palier ; au dernier, le haut part', () => {
  for (const r of [
    'html #onboarding.ob-vitrine .ob-account{--stk0:76px;--stk-k:1;--stk:calc(var(--stk0) * var(--stk-k))}',
    'html #onboarding.ob-vitrine .ob-account.is-sans-connexion{--stk0:min(104px,calc((100vw - 48px) / 3.3))}',
    'html #onboarding.ob-vitrine .ob-compte-fond{fill:rgba(255,255,255,.13)}',
    'html #onboarding.ob-vitrine .ob-account .ob-compte-stk{position:relative;display:block;width:var(--stk);margin:0}',
    'background:var(--v-sun);color:var(--v-ink);font:800 clamp(14px,calc(var(--stk) * .245),21px)/1.1 var(--v-display);letter-spacing:-.02em;white-space:nowrap;rotate:-6deg;',
    '@media (max-width:359px){html #onboarding.ob-vitrine .ob-compte-rayons{display:none}}',
    'html #onboarding.ob-vitrine .ob-compte-lead span{display:block;text-wrap:balance}',
    'html #onboarding.ob-vitrine .ob-compte-carte{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:13px;margin:24px 0 0;padding:13px 15px 13px 13px;border-radius:22px;background:rgba(255,255,255,.13);text-align:left}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-account{--stk-k:.87}', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-account{--stk-k:.76}', 'html #onboarding.ob-vitrine.ob-fit-4 .ob-account{--stk-k:.66}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-account .ob-compte-stk{display:block}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-compte-haut{display:none}', 'html #onboarding.ob-vitrine.ob-fit-5 .ob-compte-carte-txt small{display:none}'])
    assert.ok(css.includes(r), r);
  assert.ok(!css.includes('.ob-fit-1 .ob-account .ob-compte-stk{width:64px}') && !css.includes('.ob-fit-2 .ob-account .ob-title{margin-top:auto!important}'), 'les anciennes règles sont parties');
  /* Les paliers de la mascotte viennent après la règle générale qui la cachait au palier 2 */
  assert.ok(css.indexOf('html #onboarding.ob-vitrine.ob-fit-2 .ob-account .ob-compte-stk{display:block}') > css.indexOf('html #onboarding.ob-vitrine.ob-fit-2 .ob-promise-stk{display:none}'));
  /* Rien de neuf ne bouge en arrivant : le haut apparaît en fondu avec la page (6 novembre, 23 h 16) */
  assert.ok(!/ob-compte-(haut|bravo|fond|confettis|carte)[^{]*\{[^}]*animation/.test(css));
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=39">') && sw.includes("'./onboarding-vitrine.css?v=39',"));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-niveau-v2729';") && app.includes("const SW_CACHE='requete-2026-11-09-niveau-v2729';"));
});
