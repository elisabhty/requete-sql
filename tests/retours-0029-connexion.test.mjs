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
const rendre = ({ practiceDone = true, masquee = false, finVoulue } = {}) => {
  const ctx = vm.createContext({ slide: 'account', authReady: false, obAuthBusy: false, obAuthMessage: '', draft: { practiceDone, finVoulue }, MASCOT_IMG: 'mascotte.webp',
    obConnexionMasquee: () => masquee, obFlowHeader: () => '<header></header>', esc: s => String(s), escAttr: s => String(s), legalUrl: k => k,
    obSetFooter() {}, obPasserConnexion() {} });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS='), ctx);
  vm.runInContext("var html='';if(slide==='x'){" + page + '}', ctx);
  return ctx.html;
};

/* 10 novembre, 17 h 11 (« mettre la page de connexion et le paywall au bon moment », son choix : « À la fin ») : la page vient après
   « Ton parcours est prêt » ; le bravo de la première requête et sa carte s'effacent, les confettis sont sur la dernière page. */
test('après « Ton parcours est prêt » : la mascotte sur sa tache, « Sauvegarde ton parcours », les boutons ; plus de fête', () => {
  const h = rendre({ finVoulue: 'home' });
  assert.ok(h.includes('ob-acc-feuille') && h.includes('ob-acc-chat'), '12 novembre, 16 h 03 : la connexion en feuille, le chat à la clé sur son bord');
  /* 12 novembre, 18 h 12 (« J’aime pas le “Garde-le” : remplace par la réf. 4 ») : le même titre et la même phrase partout */
  assert.ok(h.includes('<h1 class="ob-title" id="ob-title">Ton parcours, <em>partout avec toi</em>.</h1>'));
  assert.ok(h.includes('<p class="ob-compte-sub">Connecte-toi pour retrouver tes cours, tes défis et tes réussites sur tous tes appareils.</p>'));
  assert.ok(h.includes('<b>Ton parcours est prêt.</b><small>Connecte-toi en un geste, et c’est parti.</small>'));
  assert.ok(!h.includes('Bravo') && !h.includes('ob-compte-confettis') && !h.includes('ob-compte-carte') && !h.includes('réussie'), 'plus de bravo de la requête');
  assert.ok(h.includes('ob-provider-list'), 'Apple, Google et l’e-mail');
  const ordre = ['ob-compte-fond', 'ob-compte-stk', 'ob-title', 'ob-compte-sub', 'ob-provider-list'].map(k => h.indexOf(k));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre);
});

test('ouverte depuis l’accueil (« J’ai déjà un compte ») ou Mon compte : « Garde ta progression » ; dans l’app sans connexion, elle est sautée', () => {
  const s = rendre({ practiceDone: false });
  /* 12 novembre, 13 h 33 : une phrase plus directe (« Tu pourras… » laissait croire que la sauvegarde n’était pas immédiate) */
  assert.ok(s.includes('<p class="ob-compte-sub">Connecte-toi pour retrouver tes cours, tes défis et tes réussites sur tous tes appareils.</p>') && !s.includes('ob-compte-confettis'));
  /* 18 h 12 : sans parcours construit (« J’ai déjà un compte »), le haut ne dit pas « Ton parcours est prêt » */
  assert.ok(s.includes('<b>Bon retour&nbsp;!</b><small>Connecte-toi en un geste, et c’est parti.</small>') && !s.includes('Ton parcours est prêt'));
  assert.ok(app.includes("function obApresPret(fin){draft.finVoulue=fin||'home';const connecte=(draft.accountMode||state.accountMode)==='connected';if(obCompteVisible()&&!connecte)obGoto('account');else obApresCompte();}"), 'sans connexion branchée (ou déjà connectée, 12 novembre), droit au paywall');
});

test('les styles : tout suit la taille de la mascotte, qui rapetisse palier par palier ; au dernier, le haut part', () => {
  for (const r of [
    'html #onboarding.ob-vitrine .ob-account{--stk0:76px;--stk-k:1;--stk:calc(var(--stk0) * var(--stk-k))}',
    'html #onboarding.ob-vitrine .ob-account.is-sans-connexion{--stk0:104px}',
    'html #onboarding.ob-vitrine .ob-compte-fond{fill:rgba(255,255,255,.13)}',
    'html #onboarding.ob-vitrine .ob-account .ob-compte-stk{position:relative;display:block;width:var(--stk);margin:0}',
    'background:var(--v-sun);color:var(--v-ink);font:800 clamp(14px,calc(var(--stk) * .245),21px)/1.1 var(--v-display);letter-spacing:-.02em;white-space:nowrap;rotate:-6deg;',
    '@media (max-width:359px){html #onboarding.ob-vitrine .ob-compte-rayons{display:none}}',
    'html #onboarding.ob-vitrine .ob-compte-lead span{display:block;text-wrap:balance}',
    'html #onboarding.ob-vitrine .ob-compte-carte{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:13px;margin:24px 0 0;padding:13px 15px 13px 13px;border-radius:22px;background:rgba(255,255,255,.13);text-align:left}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-account{--stk-k:.87}', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-account{--stk-k:.76}', 'html #onboarding.ob-vitrine.ob-fit-4 .ob-account{--stk-k:.66}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-account .ob-compte-stk{display:block}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-account{--stk-k:.58}'])
    assert.ok(css.includes(r), r);
  /* 11 novembre (6 h 54) : plus rien ne disparaît pour tenir, la page se met à l’échelle (obFit) : la mascotte et la petite ligne de la carte restent */
  assert.ok(!css.includes('.ob-fit-5 .ob-compte-haut{display:none}') && !css.includes('.ob-fit-5 .ob-compte-carte-txt small{display:none}'));
  assert.ok(!css.includes('.ob-fit-1 .ob-account .ob-compte-stk{width:64px}') && !css.includes('.ob-fit-2 .ob-account .ob-title{margin-top:auto!important}'), 'les anciennes règles sont parties');
  /* Les paliers de la mascotte viennent après la règle générale qui la cachait au palier 2 */
  assert.ok(css.indexOf('html #onboarding.ob-vitrine.ob-fit-2 .ob-account .ob-compte-stk{display:block}') > css.indexOf('html #onboarding.ob-vitrine.ob-fit-2 .ob-promise-stk{display:none}'));
  /* Rien de neuf ne bouge en arrivant : le haut apparaît en fondu avec la page (6 novembre, 23 h 16) */
  assert.ok(!/ob-compte-(haut|bravo|fond|confettis|carte)[^{]*\{[^}]*animation/.test(css));
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=57">') && sw.includes("'./onboarding-vitrine.css?v=57',"));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-12-fluidite-v2903';") && app.includes("const SW_CACHE='requete-2026-11-12-fluidite-v2903';"));
});
