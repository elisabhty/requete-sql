// La fluidité de l’onboarding (Elisa, 12 novembre, 19 h 36 : « Sur l’onboarding, il n’est pas fluide. Des fois, quand on touche sur
// les boutons, ça met du temps, c’est pas fluide et il y a des flashs. Il y a des bugs » ; sa capture de la page du parcours : des
// rectangles lavande posés sur « 100 % » et sur la première ligne, que rien dans la feuille ne dessine).
// Mesuré (processeur ralenti quatre fois) : 170 à 560 ms de calcul à chaque page, puis quatre à neuf tâches longues pendant
// l’animation d’entrée (obFit repassait cinq fois, sur des copies de la page) ; l’accueil de l’appli s’animait derrière.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css'), sansCom = obv.replace(/\/\*[\s\S]*?\*\//g, '');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const P = 'html #onboarding.ob-vitrine ';

test('l’échelle de la page est un transform : plus aucune propriété zoom, plus de rattrapage', () => {
  for (const f of ['onboarding-vitrine.css', 'ludique.css', 'safari-surface.css'])
    assert.ok(!/#onboarding[^{}]*\{[^}]*[;{]\s*zoom\s*:/.test(lire(f).replace(/\/\*[\s\S]*?\*\//g, '')), f);
  assert.ok(!/\.style\.zoom|zoom:\$\{/.test(cut('const OB_Z_REF=393', 'function obFitChips(){')), 'obFit ne pose plus de zoom');
  assert.ok(sansCom.includes(P + '#ob-body{inset:0 auto auto 0;width:calc(100% / var(--obz));height:calc(100% / var(--obz));overflow:visible;'));
  assert.ok(sansCom.includes('transform:scale(var(--obz));transform-origin:0 0}'));
  /* Le cadre défile, pas la page mise à l’échelle : elle n’a pas son propre calque, son texte reste net à toute échelle */
  assert.ok(sansCom.includes(P + '.ob-slides{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}'));
  assert.ok(app.includes('<div class="ob-slides">\n      <div class="ob-slide on" id="ob-body"></div>'), 'le cadre est le parent direct de la page');
  assert.ok(!app.includes('obRepeindre(') && !obv.includes('--ob-rp'));
});

test('les marges de la page gardent leur taille à l’écran : le contenu reste aligné sur le bouton jaune', () => {
  assert.ok(sansCom.includes('padding:calc(var(--ob-pt) / var(--obz)) calc(var(--ob-px) / var(--obz)) calc(var(--ob-pb) / var(--obz))!important;'));
  /* Une variable par marge d’avant (index.html) : 20/24/12, le profil à 12, le compte à 10, l’en-tête à 6, le pied caché, la feuille */
  for (const r of [P + '#ob-body{--ob-pt:20px;--ob-px:24px;--ob-pb:12px}', 'html #onboarding.ob-vitrine.ob-profile-step #ob-body{--ob-pt:12px}',
    'html #onboarding.ob-vitrine.ob-account-step #ob-body{--ob-pt:10px}', P + '#ob-body:has(>.ob-screen>.ob-flow-top:first-child){--ob-pt:6px}',
    'html #onboarding.ob-vitrine:has(.ob-foot-hidden) #ob-body{--ob-pb:calc(var(--safe-bottom,0px) + 28px)}', 'html #onboarding.ob-vitrine.ob-compte-feuille #ob-body{--ob-px:0px;--ob-pb:0px}'])
    assert.ok(sansCom.includes(r), r);
  for (const r of ['#onboarding #ob-body{width:100%;height:100%;padding:20px 24px 12px;', '#onboarding.ob-profile-step #ob-body{padding-top:12px}', '#onboarding.ob-account-step #ob-body{padding-top:10px}',
    '#onboarding:has(.ob-foot-hidden) #ob-body{padding-bottom:calc(var(--safe-bottom) + 28px)}'])
    assert.ok(app.includes(r), 'la marge d’origine : ' + r);
  assert.ok(obv.includes(P + '#ob-body{padding-left:0!important;padding-right:0!important;padding-bottom:0!important}') || obv.includes('.ob-compte-feuille #ob-body{padding-left:0!important;padding-right:0!important;padding-bottom:0!important}'));
});

test('le pied garde sa taille : le bouton jaune ne change plus de taille d’une page à l’autre', () => {
  const regles = sansCom.match(/[^{}]+\{[^{}]*\}/g) || [];
  assert.deepEqual(regles.filter(r => /\.ob-foot|#ob-next|#ob-skip|ob-cta/.test(r.split('{')[0]) && /--obz/.test(r.split('{')[1])), []);
  /* Le pied du paywall, que le zoom rapetissait avec la page : ses garanties et sa ligne de prix suivent la largeur de l’écran */
  assert.ok(sansCom.includes(P.trim() + '.ob-paywall-step #ob-foot-note.is-legal,' + P.trim() + '.ob-paywall-step #ob-foot-note .pw-confiance{font-size:min(12px,2.76vw)!important}'));
  assert.ok(Math.abs(2.76 * 393 / 100 - 10.85) < .05 && 2.76 * 440 / 100 > 12, '10,8 px à 393 pt (ce qu’on voyait), 12 px au plus');
  assert.ok(sansCom.includes(P.trim() + '.ob-paywall-step #ob-foot-note .pw-confiance svg{width:1.25em;height:1.25em}'));
});

test('obFit mesure la page elle-même, sans copie, et le champ revient en vue dans le cadre qui défile', () => {
  const f = cut('function obFit(){', 'function obFitChips(){');
  assert.ok(!/cloneNode|appendChild|ob-mesure/.test(f));
  assert.ok(f.includes("root.classList.add('ob-jauge');") && (f.match(/root\.classList\.remove\('ob-jauge'\)/g) || []).length === 2 && f.includes("root.classList.remove(...C,'ob-fit-defile','ob-jauge');"), 'la jauge est toujours retirée');
  assert.ok(f.includes("const hauteur=z=>{root.style.setProperty('--obz',String(z));const h=body.getBoundingClientRect().height;H=cadre.clientHeight;return h;};"));
  assert.ok(sansCom.includes(P.trim() + '.ob-jauge #ob-body{height:auto!important}') && sansCom.includes(P.trim() + '.ob-jauge #ob-body>*{height:auto!important;min-height:0!important;max-height:none!important}'));
  /* obChampEnVue : les bords et le défilement sont ceux du cadre */
  const champ = cut('function obChampEnVue(){', '\n}\n');
  assert.ok(champ.includes('const cadre=body.parentElement||body,b=cadre.getBoundingClientRect(),') && champ.includes('if(Math.abs(d)>1)cadre.scrollTop+=d;') && !champ.includes('body.scrollTop'));
  assert.ok(app.includes('  if(body.parentElement)body.parentElement.scrollTop=0;\n  obFitSoon();'), 'à chaque page, le cadre remonte');
  /* Deux repassages au lieu de trois, et seulement pour des polices pas encore là */
  const bientot = cut('function obFitSoon(){', '\n}\n');
  assert.ok(bientot.includes("if(typeof document!=='undefined'&&document.fonts&&document.fonts.status!=='loaded'&&document.fonts.ready)document.fonts.ready.then(again);") && bientot.includes('[400,1500].forEach(t=>setTimeout(again,t));'));
});

test('la page d’avant s’efface plus vite : 110 ms avant la suivante, un fondu de 0,1 s', () => {
  const ctx = vm.createContext({ obLock: false, OB_SLIDES: ['a', 'b'], OB_STEPS: 2, obStep: 0, obPseudoAvant: () => false, prefersReduceMotion: () => false, paintOb() { ctx.peint = true; },
    document: { getElementById: id => (id === 'ob-body' ? { classList: { add(c) { ctx.sorti = c; } } } : { dataset: {} }) }, setTimeout: (f, t) => { ctx.delai = t; ctx.apres = f; } });
  vm.runInContext(cut('const OB_SORTIE_MS=110;', '/* 4 novembre, 2 h 13 : « quand on clique sur Voir mon parcours'), ctx);
  ctx.obGoto('b');
  assert.deepEqual([ctx.sorti, ctx.delai, ctx.peint], ['out', 110, undefined]);
  ctx.apres(); assert.equal(ctx.peint, true);
  assert.ok(sansCom.includes(P + '.ob-slide.out .ob-screen>:not(.ob-flow-top){animation:obvOutFwd .1s ease-in both!important}'), 'le fondu de sortie tient dans les 110 ms');
});

test('derrière l’onboarding ouvert, l’appli est en veille : ni peinte ni animée', () => {
  assert.ok(sansCom.includes('#app:has(>#onboarding.on)>.stage,#app:has(>#onboarding.on)>#tabbar{visibility:hidden;content-visibility:hidden}'));
  /* L’onboarding s’ouvre et se ferme d’un coup (display), sans fondu au travers duquel on verrait l’appli */
  assert.ok(app.includes('#onboarding{position:absolute;inset:0;z-index:180;background:var(--bg);display:none;flex-direction:column;overflow:hidden}') && app.includes('#onboarding.on{display:flex}'));
  /* Il est bien l’enfant direct de #app, à côté de la scène et de la barre d’onglets ; les confettis (#burst) et les messages restent visibles */
  const i = app.indexOf('<div id="app"'), s = app.slice(i);
  assert.ok(i > 0 && /<div class="stage"/.test(s) && /id="onboarding"/.test(s) && /id="tabbar"/.test(s));
});
