/* 11 novembre, 6 h 54 (Elisa, capture du paywall dans Safari sur son iPhone, l’offre hebdomadaire coupée sous le bouton) : « Il y a
   de la marge en bas, on peut tout faire tenir sur une page (iOS). Vérifie toutes les pages par rapport aux espaces à laisser, UI UX
   psychologique, pour que tout soit bien dans tous les iPhone (SE → 18 Pro Max) en zoomant et dézoomant par rapport à l’écran, mais
   tous les éléments doivent y être. »
   Plus rien ne disparaît pour faire de la place : la page (contenu et pied) se met à l’échelle de l’écran (--obz, la propriété zoom),
   agrandie jusqu’à 1,12 sur les grands iPhone, réduite d’un bloc jusqu’à 0,86, puis resserrée par paliers (marges, illustrations,
   cartes), puis réduite jusqu’à 0,8. Vérifié dans Chrome et dans WebKit (le moteur de l’iPhone), de l’iPhone SE au 18 Pro Max,
   dans l’app et dans Safari : les 21 pages tiennent sur un écran, rien n’est masqué. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'onboarding-vitrine.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

/* Les règles CSS (sélecteur → déclarations), hors commentaires */
const regles = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) || [];

test('rien ne disparaît pour tenir : aucun palier ne cache un élément', () => {
  const cachees = regles.filter(r => /\.ob-fit-[1-5]\b/.test(r.split('{')[0]) && /display:\s*none|visibility:\s*hidden/.test(r.split('{')[1]));
  assert.deepEqual(cachees, [], 'un palier cache encore quelque chose');
  /* Plus de règle d’écran (hauteur) qui cache le paywall ou l’accueil */
  assert.ok(!css.includes('@media (max-height:700px){html #onboarding.ob-vitrine .pw-chat{width:104px;') && !css.includes('.pw-ico{display:none}'));
  assert.ok(!/@media \(max-height:740px\)\{\s*html #onboarding\.ob-vitrine \.ob-hello-stage/.test(css));
});

test('la page et le pied se mettent à l’échelle de l’écran (--obz)', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine{--obz:1}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine #ob-body>*,html #onboarding.ob-vitrine .ob-foot>*{zoom:var(--obz)}'));
  /* Le bouton jaune reste à la même hauteur d’une page à l’autre (réf. 7, 4 novembre) ; Safari : pas deux fois la marge */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + max(12px,clamp(34px,6.6vh,58px) - max(0px,var(--safe-bottom,0px) - 34px)))!important}'));
  /* Les copies de mesure : invisibles et sans animation */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-mesure,html #onboarding.ob-vitrine .ob-mesure *{animation:none!important;transition:none!important}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-mesure{visibility:hidden!important;pointer-events:none!important;z-index:-1!important}'));
  /* Les tailles de l’onboarding en px (celles d’un écran de 393) : vw suit le zoom dans Chrome mais pas dans WebKit */
  for (const r of ['html #onboarding.ob-vitrine .ob-big b{font:800 156px/.9 var(--v-display);', 'html #onboarding.ob-vitrine .ob-proj-big b{display:block;font:800 53px/.9 var(--v-display);',
    'html #onboarding.ob-vitrine .ob-account.is-sans-connexion{--stk0:104px}', 'html #onboarding.ob-vitrine .ob-age-tile{min-height:100px}'])
    assert.ok(css.includes(r), r);
  /* Le bandeau de notification de l’étape du rappel suit l’échelle de la page */
  assert.ok(app.includes('if(Math.abs(dy)>2)z.style.transform=`translateY(${Math.round(dy/obZ())}px)`;'));
  /* La feuille est rechargée (cache du service worker) */
  assert.ok(app.includes('onboarding-vitrine.css?v=48') && fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('./onboarding-vitrine.css?v=48'));
});

test('« Ton parcours est prêt » et « On construit ton parcours » se resserrent aussi sur l’iPhone SE', () => {
  for (const r of ['html #onboarding.ob-vitrine.ob-fit-3 .ob-screen.ready>.ob-success{width:48px!important;height:48px!important}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-screen.ready .mascot-stk:has(.mstk-cat.is-parti){width:66px}',
    'html #onboarding.ob-vitrine.ob-fit-4 .ob-screen.ready .ob-ready-path small{line-height:1.25}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-build-list{gap:5px}', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-build-ico{width:30px;height:30px;border-radius:10px;font-size:14px}',
    'html #onboarding.ob-vitrine.ob-fit-4 .ob-build-path{gap:4px}', 'html #onboarding.ob-vitrine.ob-fit-5 .ob-build-path span{line-height:1.2}'])
    assert.ok(css.includes(r), r);
  /* Si la page doit défiler, la carte du parcours s’allonge au lieu de masquer un module */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-defile .ob-screen.ob-build{flex-shrink:0;height:auto;min-height:100%}')
    && css.includes('html #onboarding.ob-vitrine.ob-fit-defile .ob-build-path{flex-shrink:0}'));
});

test('l’accueil, le rappel et le paywall se resserrent par paliers (iPhone SE, Safari), sans rien retirer', () => {
  for (const r of ['html #onboarding.ob-vitrine.ob-fit-5 .ob-hello-stage{height:132px;margin-bottom:6px}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-rappel-step .ob-notif{width:min(262px,100%)}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-rappel-choix :is(.rp-slot,.rp-heure){min-height:32px}',
    'html #onboarding.ob-vitrine.ob-fit-3 .pw-ico{width:26px;height:26px}', 'html #onboarding.ob-vitrine.ob-fit-4 .pw-offre{padding-top:10px;padding-bottom:9px}',
    'html #onboarding.ob-vitrine.ob-fit-5 .pw-hero{padding-right:90px}', 'html #onboarding.ob-vitrine.ob-fit-5 .pw-chat{width:110px;top:-4px;right:-8px}'])
    assert.ok(css.includes(r), r);
  /* L’écart entre le choix de l’heure et la fenêtre d’iOS reste celui du 4 novembre */
  assert.ok(css.includes('.ob-screen>.ob-rappel-carte+.ob-notif{margin-top:24px!important}'));
});

/* obFit dans un écran factice : la hauteur de la page à l’échelle z est z × (son contenu au palier atteint), plus les marges fixes
   du cadre et du pied (zones sûres comprises). */
function essai({ contenu, pied = 90, H = 667, larg = 375 }) {
  const classes = new Set(), props = {}, dataset = { obSlide: 'essai' };
  const palier = () => [1, 2, 3, 4, 5].filter(k => classes.has('ob-fit-' + k)).length;
  const fauxStyle = () => ({ cssText: '', props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } });
  const echelleDe = st => { const m = [...st.cssText.matchAll(/zoom:([\d.]+)/g)].pop(); return m ? +m[1] : parseFloat(st.props['--obz']) || 1; };
  /* fixe : ce qui ne change pas d’échelle (les marges du pied) */
  const copie = (hauteur, fixe = 0) => {
    const c = { style: fauxStyle(), classList: { add() {} }, setAttribute() {}, remove() {}, querySelectorAll: s => (s === '*' ? [temoin] : []) };
    const temoin = { offsetWidth: 100, getBoundingClientRect: () => ({ width: 100 * echelleDe(c.style) }) };
    c.getBoundingClientRect = () => ({ height: fixe + echelleDe(c.style) * hauteur() });
    return c;
  };
  const screen = { childElementCount: 4, cloneNode: () => copie(() => contenu[palier()]) };
  const foot = { cloneNode: () => copie(() => pied, 12 + 44), getBoundingClientRect: () => ({ width: larg }) };
  /* 12 novembre, 12 h 24 : la page commence sous la barre d’état ; ici, la marge du haut du cadre (40) la contient, comme avant */
  const body = { firstElementChild: screen, clientWidth: larg, appendChild() {}, contains: () => false, getBoundingClientRect: () => ({ top: 0 }) };
  const rootEl = {
    getBoundingClientRect: () => ({ top: 0 }),
    clientHeight: H, clientWidth: larg, dataset, style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '' },
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c) },
    querySelector: s => (s === '.ob-foot' ? foot : null), appendChild() {}
  };
  const styles = new Map([[body, { paddingTop: '40px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }],
    [foot, { display: 'flex', paddingTop: '12px', paddingBottom: '44px' }]]);
  const ctx = vm.createContext({
    document: { getElementById: id => (id === 'ob-body' ? body : id === 'onboarding' ? rootEl : null), activeElement: null },
    getComputedStyle: el => styles.get(el), requestAnimationFrame: () => 0, obFitChips() {}, obChampEnVue() {}, obLegalMode: false
  });
  vm.runInContext(cut('const OB_Z_REF=', '/* 1 h 31 : les modules du parcours'), ctx);
  ctx.obFit();
  const z = parseFloat(props['--obz']);
  const h = 40 + 12 + 12 + 44 + z * (contenu[palier()] + pied);
  return { z, palier: palier(), defile: classes.has('ob-fit-defile'), tient: h <= H + 1 };
}

test('obFit : la plus grande échelle qui tient, puis les paliers, puis la plus petite échelle ; défiler en dernier recours', () => {
  /* Une page courte sur un iPhone de 393 pt : sa taille, sans palier */
  let r = essai({ contenu: [400, 400, 400, 400, 400, 400], larg: 393, H: 852 });
  assert.deepEqual([r.z, r.palier, r.defile], [1, 0, false]);
  /* Sur un 18 Pro Max (440 pt) : agrandie jusqu’à 1,12 */
  r = essai({ contenu: [400, 400, 400, 400, 400, 400], larg: 440, H: 956 });
  assert.deepEqual([r.z, r.palier, r.defile], [1.12, 0, false]);
  /* Un peu trop haute : elle rapetisse d’un bloc, au plus près de l’écran, sans se resserrer */
  r = essai({ contenu: [480, 470, 460, 450, 440, 430] });
  assert.ok(r.tient && r.palier === 0 && r.z < 1 && r.z > .97, JSON.stringify(r));
  /* Trop haute pour 0,86 : un palier, puis ce qu’elle peut d’échelle en plus */
  r = essai({ contenu: [640, 600, 560, 540, 520, 500] });
  assert.ok(r.tient && r.palier === 2 && r.z >= .86 && !r.defile, JSON.stringify(r));
  /* Les cinq paliers ne suffisent pas à 0,86 : l’échelle descend, jusqu’à 0,8 */
  r = essai({ contenu: [700, 680, 660, 640, 610, 580] });
  assert.ok(r.tient && r.palier === 5 && r.z > .82 && r.z < .86 && !r.defile, JSON.stringify(r));
  /* Même à 0,8 elle ne tient pas : elle défile plutôt que de couper */
  r = essai({ contenu: [900, 880, 860, 840, 820, 800] });
  assert.deepEqual([r.z, r.palier, r.defile], [0.8, 5, true]);
});
