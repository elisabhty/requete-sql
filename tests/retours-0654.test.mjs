/* 11 novembre, 6 h 54 (Elisa, capture du paywall dans Safari sur son iPhone, l’offre hebdomadaire coupée sous le bouton) : « Il y a
   de la marge en bas, on peut tout faire tenir sur une page (iOS). Vérifie toutes les pages par rapport aux espaces à laisser, UI UX
   psychologique, pour que tout soit bien dans tous les iPhone (SE → 18 Pro Max) en zoomant et dézoomant par rapport à l’écran, mais
   tous les éléments doivent y être. »
   12 novembre, 19 h 36 (« il n’est pas fluide, des flashs, des bugs ») : l’échelle n’est plus la propriété zoom (WebKit repeignait mal
   ce qui s’anime dedans) mais un transform sur la page ; le pied garde sa taille ; obFit mesure la page elle-même, sans copie.
   Plus rien ne disparaît pour faire de la place : la page se met à l’échelle de l’écran (--obz),
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

test('la page se met à l’échelle de l’écran (--obz), par un transform ; le pied garde sa taille', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine{--obz:1}'));
  /* 12 novembre, 19 h 36 : plus de zoom. Le cadre défile ; la page, 1/échelle fois plus grande, est ramenée par scale() ; ses marges,
     divisées par l’échelle, gardent leur taille à l’écran */
  assert.ok(!/[;{]\s*zoom\s*:/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-slides{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}'));
  assert.ok(css.includes(`html #onboarding.ob-vitrine #ob-body{inset:0 auto auto 0;width:calc(100% / var(--obz));height:calc(100% / var(--obz));overflow:visible;
  padding:calc(var(--ob-pt) / var(--obz)) calc(var(--ob-px) / var(--obz)) calc(var(--ob-pb) / var(--obz))!important;
  transform:scale(var(--obz));transform-origin:0 0}`));
  assert.ok(!regles.some(r => /\.ob-foot\b/.test(r.split('{')[0]) && /var\(--obz\)/.test(r.split('{')[1])), 'le pied ne suit plus l’échelle');
  /* Le bouton jaune reste à la même hauteur d’une page à l’autre (réf. 7, 4 novembre) ; Safari : pas deux fois la marge */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-foot{padding-bottom:calc(var(--safe-bottom,0px) + max(12px,clamp(34px,6.6vh,58px) - max(0px,var(--safe-bottom,0px) - 34px)))!important}'));
  /* Plus de copies de mesure : le temps d’une mesure (ob-jauge), la page et son écran perdent leurs hauteurs imposées */
  assert.ok(!css.includes('.ob-mesure') && !app.includes('ob-mesure') && !cut('function obFit(){', '/* 1 h 31').includes('cloneNode'));
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-jauge #ob-body{height:auto!important}')
    && css.includes('html #onboarding.ob-vitrine.ob-jauge #ob-body>*{height:auto!important;min-height:0!important;max-height:none!important}'));
  /* Les tailles de l’onboarding en px (celles d’un écran de 393) */
  for (const r of ['html #onboarding.ob-vitrine .ob-big b{font:800 156px/.9 var(--v-display);', 'html #onboarding.ob-vitrine .ob-proj-big b{display:block;font:800 53px/.9 var(--v-display);',
    'html #onboarding.ob-vitrine .ob-account.is-sans-connexion{--stk0:104px}', 'html #onboarding.ob-vitrine .ob-age-tile{min-height:100px}'])
    assert.ok(css.includes(r), r);
  /* Le bandeau de notification de l’étape du rappel suit l’échelle de la page */
  assert.ok(app.includes('if(Math.abs(dy)>2)z.style.transform=`translateY(${Math.round(dy/obZ())}px)`;'));
  /* La feuille est rechargée (cache du service worker) */
  assert.ok(app.includes('onboarding-vitrine.css?v=58') && fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('./onboarding-vitrine.css?v=58'));
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

/* obFit dans un écran factice. La page mesurée (ob-jauge) fait, à l’écran, ses marges (40 + 12, qui ne changent pas d’échelle) plus
   z × son contenu au palier atteint ; la place est la hauteur du cadre : l’écran moins le pied, qui garde sa taille. */
function essai({ contenu, pied = 90, H = 667, larg = 375, avant }) {
  const classes = new Set(), props = {}, dataset = { obSlide: 'essai' };
  const palier = () => [1, 2, 3, 4, 5].filter(k => classes.has('ob-fit-' + k)).length;
  const z = () => parseFloat(props['--obz']) || 1, MARGES = 40 + 12, PIED = 12 + pied + 44;
  let mesures = 0;
  const naturel = () => MARGES + z() * contenu[palier()];
  const cadre = { clientHeight: H - PIED, get scrollHeight() { return Math.max(H - PIED, Math.ceil(naturel() - .5)); }, scrollTop: 0 };
  const screen = { childElementCount: 4, className: 'ob-screen', get scrollHeight() { return contenu[palier()]; }, lastElementChild: { offsetTop: 0, get offsetHeight() { return contenu[palier()]; } } };
  const foot = { offsetHeight: PIED };
  const body = { firstElementChild: screen, parentElement: cadre, contains: () => false,
    getBoundingClientRect: () => { mesures++; assert.ok(classes.has('ob-jauge'), 'on ne mesure que la page sans ses hauteurs imposées'); return { height: naturel() }; } };
  const rootEl = {
    clientHeight: H, clientWidth: larg, dataset, style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: k => props[k] || '' },
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c) },
    querySelector: s => (s === '.ob-foot' ? foot : null)
  };
  const ctx = vm.createContext({
    document: { getElementById: id => (id === 'ob-body' ? body : id === 'onboarding' ? rootEl : null), activeElement: null },
    getComputedStyle: el => (el === body ? { paddingTop: 40 / z() + 'px', paddingBottom: 12 / z() + 'px' } : {}), requestAnimationFrame: () => 0, obFitChips() {}, obChampEnVue() {}, obLegalMode: false
  });
  vm.runInContext(cut('const OB_Z_REF=', '/* 1 h 31 : les modules du parcours'), ctx);
  ctx.obFit();
  const r = { z: z(), palier: palier(), defile: classes.has('ob-fit-defile'), tient: naturel() <= H - PIED + 1, mesures, jauge: classes.has('ob-jauge'), marge: H - PIED - naturel() };
  if (avant) { mesures = 0; avant({ contenu, dataset, classes, props, ctx }); ctx.obFit(); r.apres = { z: z(), palier: palier(), mesures, jauge: classes.has('ob-jauge'), tient: naturel() <= H - PIED + 1 }; }
  return r;
}

test('obFit : la plus grande échelle qui tient, puis les paliers, puis la plus petite échelle ; défiler en dernier recours', () => {
  /* Une page courte sur un iPhone de 393 pt : sa taille, sans palier, en une seule mesure */
  let r = essai({ contenu: [400, 400, 400, 400, 400, 400], larg: 393, H: 852 });
  assert.deepEqual([r.z, r.palier, r.defile, r.mesures, r.jauge], [1, 0, false, 1, false]);
  /* Sur un 18 Pro Max (440 pt) : agrandie jusqu’à 1,12 */
  r = essai({ contenu: [400, 400, 400, 400, 400, 400], larg: 440, H: 956 });
  assert.deepEqual([r.z, r.palier, r.defile], [1.12, 0, false]);
  /* Un peu trop haute (521 pt de place sur un SE, 532 de page) : elle rapetisse d’un bloc, à 12 px près, sans se resserrer */
  r = essai({ contenu: [480, 470, 460, 450, 440, 430] });
  assert.ok(r.tient && r.palier === 0 && r.z < 1 && r.z > .95 && r.marge < 12.5 && r.mesures <= 3 && !r.jauge, JSON.stringify(r));
  /* Trop haute pour 0,86 : un palier, puis ce qu’elle peut d’échelle en plus */
  r = essai({ contenu: [640, 600, 560, 540, 520, 500] });
  assert.ok(r.tient && r.palier === 3 && r.z >= .86 && !r.defile, JSON.stringify(r));
  /* Les cinq paliers ne suffisent pas à 0,86 : l’échelle descend, jusqu’à 0,8 */
  r = essai({ contenu: [700, 680, 660, 640, 610, 570] });
  assert.ok(r.tient && r.palier === 5 && r.z > .8 && r.z < .86 && !r.defile, JSON.stringify(r));
  /* Même à 0,8 elle ne tient pas : elle défile plutôt que de couper */
  r = essai({ contenu: [900, 880, 860, 840, 820, 800] });
  assert.deepEqual([r.z, r.palier, r.defile, r.jauge], [0.8, 5, true, false]);
});

test('obFit ne remesure que si quelque chose a bougé ; une page déjà vue reprend son échelle (12 novembre, 19 h 36)', () => {
  /* Repassage sans changement (polices, images, minuteurs) : aucune mesure, la page n’est pas touchée */
  let r = essai({ contenu: [480, 470, 460, 450, 440, 430], avant() {} });
  assert.deepEqual([r.apres.mesures, r.apres.z, r.apres.jauge], [0, r.z, false]);
  /* Le contenu a grandi et ne tient plus : nouvelle recherche, l’échelle baisse */
  r = essai({ contenu: [480, 470, 460, 450, 440, 430], avant({ contenu }) { contenu[0] = 520; } });
  assert.ok(r.apres.mesures >= 2 && r.apres.z < r.z && r.apres.tient && !r.apres.jauge, JSON.stringify(r));
  /* Le contenu a bougé d’un rien et tient toujours au plus près : une seule mesure, l’échelle reste */
  r = essai({ contenu: [480, 470, 460, 450, 440, 430], avant({ contenu }) { contenu[0] = 479; } });
  assert.deepEqual([r.apres.mesures, r.apres.z], [1, r.z], JSON.stringify(r));
  /* Retour sur une page déjà mesurée à cette taille (autre page entre-temps) : son échelle reprise sans recherche */
  r = essai({ contenu: [640, 600, 560, 540, 520, 500], avant({ dataset, classes, props }) { dataset.obzCle = 'autre|page'; ['ob-fit-1', 'ob-fit-2', 'ob-fit-3'].forEach(c => classes.delete(c)); props['--obz'] = '1'; } });
  assert.deepEqual([r.apres.mesures, r.apres.z, r.apres.palier], [0, r.z, r.palier], JSON.stringify(r));
  /* Le code : la mémoire par page, la signature, et deux repassages seulement */
  const f = cut('function obFit(){', '/* 1 h 31');
  assert.ok(f.includes("if(meme&&root.dataset.obzSigne===signe()&&tient()){apres();return;}") && f.includes('const su=obFitMemo[cle];'));
  assert.ok(app.includes('const OB_SORTIE_MS=110;') && app.includes("setTimeout(attendre,prefersReduceMotion()?0:OB_SORTIE_MS);"), 'la page d’avant s’efface en 110 ms (puis, clavier ouvert, la suivante attend la bonne hauteur : retours-2153)');
});
