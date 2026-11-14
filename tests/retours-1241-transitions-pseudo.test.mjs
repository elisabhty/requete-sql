/* Elisa, 14 novembre, 12 h 41 (une image de son enregistrement d’écran) : « Au niveau de l’onboarding, il y a deux soucis. Il y a des
   traces violettes quand on va de l’un à l’autre. Et au niveau du pseudo, ça saute. »
   1. Les traces violettes : la page qui partait s’effaçait bloc par bloc (un fondu de 110 ms par bloc). Sur l’iPhone, WebKit crée un
      calque par bloc, et ce qui y était déjà animé restait non repeint, violet (sur son image : le haut de la page du parcours prêt,
      « 100 % », la première ligne). Plus de fondu de sortie : la suivante est peinte tout de suite, en fondu d’entrée. Un double
      toucher ne saute pas de page pour autant (280 ms de garde sur le pied).
   2. Le pseudo qui saute : le champ glissait de 4 à 6 px juste après l’arrivée (transitions de marges pendant la mise à l’échelle) ;
      clavier ouvert, le bouton remontait avec la vue puis redescendait (transition du pied) ; et sur un petit iPhone, « Disponible »,
      « déjà pris » et les pseudos libres passaient sous le bouton. Pas de transition tant que la page se pose, plus de glissé du pied,
      et clavier ouvert, le chat du pseudo se replie avec la phrase. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ob = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('d’une page à l’autre : la suivante tout de suite, sans classe out ; un double toucher ne saute pas de page', () => {
  const journal = [];
  let maintenant = 1000;
  const body = {offsetHeight: 600, style: {}, classList: {add: c => journal.push('classe ' + c)}, contains: () => false};
  const root = {dataset: {}, classList: {remove() {}, contains: () => false}, clientHeight: 852};
  const ctx = vm.createContext({obLock: false, OB_SLIDES: ['a', 'b', 'c'], OB_STEPS: 3, obStep: 0, obPseudoAvant: () => false, prefersReduceMotion: () => false,
    paintOb: () => journal.push('peinte ' + ctx.obStep), document: {activeElement: {tagName: 'BUTTON'}, getElementById: id => (id === 'ob-body' ? body : root)},
    setTimeout: () => journal.push('attente'), Date: {now: () => maintenant}});
  vm.runInContext(cut('const OB_SORTIE_MS=110;', '/* 4 novembre, 2 h 13 : « quand on clique sur Voir mon parcours') + cut('function obGarderToucher(', '\nfunction obSetFooter('), ctx);
  ctx.obGoto('b');
  assert.deepEqual(journal, ['peinte 1'], 'ni classe out, ni attente');
  const suivant = ctx.obGarderToucher(() => ctx.obGoto('c'));
  maintenant += 70; suivant();
  assert.deepEqual(journal, ['peinte 1'], 'le second toucher d’un double toucher ne compte pas');
  maintenant += 300; suivant();
  assert.deepEqual(journal, ['peinte 1', 'peinte 2'], 'un vrai toucher, ensuite, passe');
  assert.equal(ctx.obGarderToucher(null), null);
});

test('le pseudo (déjà ouvert) et le paywall (offres ↔ bienvenue) : la vue suivante tout de suite, en fondu d’entrée', () => {
  const ps = cut('function psPage(o){', '\n}\n');
  assert.ok(ps.includes("if(deja){obJustEntered=true;if(typeof obPeinteLe!=='undefined')obPeinteLe=Date.now();}\n  paintOb();") && !ps.includes("classList.add('out')"));
  const pw = cut('function obPaywallVue(sortie){', '\n}\n');
  assert.ok(pw.includes('peindre();') && !pw.includes("classList.add('out')") && !pw.includes('setTimeout(peindre'));
  assert.ok(!/body\.classList\.add\('out'\);setTimeout/.test(app), 'plus aucun fondu de sortie minuté');
});

test('CSS : plus de fondu de sortie ; pas de transition tant que la page se pose ; le pied ne glisse plus ; le chat du pseudo se replie', () => {
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-slide.out .ob-screen>:not(.ob-flow-top){animation:none!important}'));
  assert.ok(!ob.includes('animation:obvOutFwd'), 'le fondu de sortie n’est plus posé nulle part');
  assert.ok(ob.includes('html #onboarding.ob-vitrine.ob-se-pose :is(.ob-screen>*,.ob-foot,.ob-foot *){transition:none!important}'));
  assert.ok(app.includes("if(obJustEntered){root.classList.add('ob-se-pose');requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.remove('ob-se-pose')));}"));
  assert.ok(!ob.includes('.ob-foot{transition:padding'));
  assert.ok(ob.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-clavier .ob-pseudo>.ob-chat{max-height:0;opacity:0;margin-top:0!important;margin-bottom:0!important}'));
  assert.ok(ob.includes('html[data-motion="reduce"] #onboarding.ob-vitrine.ob-clavier .ob-pseudo>.ob-chat{display:none!important}'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine.ob-clavier .ob-pseudo .ps-etat{margin-top:8px!important}') && ob.includes('html #onboarding.ob-vitrine.ob-clavier .ob-pseudo .ps-idees{margin-top:6px!important}'), 'clavier ouvert, les pseudos libres tiennent au-dessus du bouton');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=73">') && sw.includes("'./onboarding-vitrine.css?v=73',"));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-14-medailles-v3038';"), 'le cache de l’appli change');
});

test('13 h 04 (« un trait en bas quand je soumets mon prénom, clavier ») : dans l’app, sous l’onboarding, le fond reste le violet du bas', () => {
  const lq = readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(lq.includes('html.lq.is-native:has(#onboarding.on) body{background:#4529CC!important}'));
  assert.ok(lq.indexOf('html.lq.is-native:has(#onboarding.on) body{background:#4529CC!important}') > lq.indexOf('html.lq:has(#onboarding.on) body{background:#6E50F6!important}'), 'après la règle du violet clair, qu’elle remplace dans l’app');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=384">'), 'la feuille change d’adresse (le cache de l’appli la reprend)');
});
