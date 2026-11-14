/* 5 novembre, 19 h 41 (Elisa, cinq captures : l’écran « Hold your finger on the button to confirm » d’une autre appli, au bouton
   vert à l’empreinte ; l’appui long sur l’icône de Requête ; la notification « C’est l’heure de ta séance SQL. » ; ses textes) :
   « Mettre plutôt un doigt, quelque chose comme ça, pour remplacer la signature ; de plus je n’ai pas de haptique dans
   l’application » ; « remplacer les messages réf. 2 : C’est un DELETE entre nous ? 💔 / Même pas un dernier SELECT ? — SELECT *
   FROM motivation 🚀 / Une petite requête et ça repart ! — et « Juge-nous (gentiment) 👀 » / Tes retours font évoluer Requête. » ;
   « pour la notification : remplace celle actuelle sur mon portable », par huit messages qui changent.
   - L’engagement : un bouton à l’empreinte, maintenu 1,5 s (anneau, crans haptiques, coche menthe, page suivante).
     21 h 19 : la page ne part plus toute seule ; « C’est noté : ton engagement est pris en compte. » reste à lire et « C’est parti ! »
     mène à la suite (retours-2119).
   - L’haptique : les touchers (6 à 8 ms) passaient par selectionChanged, qui ne fait rien hors d’une sélection commencée ; ce sont
     maintenant de vrais impacts, un seul par toucher, et buzz() parle directement au moteur haptique d’iOS.
   - Les raccourcis de l’icône : les textes d’Elisa ; le troisième ouvre « Contacte-nous » sur « Autre chose ».
   - Le rappel : une notification par séance à venir, chacune avec son message, reposées à chaque ouverture de l’appli. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const css = read('onboarding-vitrine.css');
const sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const PATTERN = vm.runInNewContext('(' + cut('const PATTERN=', 'const JOURS=').replace('const PATTERN=', '').trim().replace(/;$/, '') + ')');

/* ---------- Le bouton à l’empreinte ---------- */
const el = (cls = '') => {
  const classes = new Set(cls.split(' ').filter(Boolean)), on = {};
  const e = {
    classes, on, dataset: {}, attrs: {}, textContent: '', innerHTML: '', props: {},
    style: { setProperty: (k, v) => { e.props[k] = v; } },
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c) },
    setAttribute: (k, v) => { e.attrs[k] = String(v); },
    addEventListener: (t, f) => { (on[t] ||= []).push(f); },
    fire: (t, ev = {}) => { const x = { type: t, button: 0, pointerId: 1, detail: 1, preventDefault() { x.dp = true; }, stopPropagation() {}, ...ev }; (on[t] || []).forEach(f => f(x)); return x; },
    setPointerCapture: () => {}, querySelector: () => null, offsetWidth: 0,
  };
  return e;
};
const bouton = ({ natif = true, fait = false } = {}) => {
  const b = el('ob-hold' + (fait ? ' is-done' : '')), fill = el('ob-hold-fill'), hint = el('ob-hold-hint'), carte = el('ob-pact-card');
  b.querySelector = s => (s === '.ob-hold-fill' ? fill : null);
  const H = [], vu = [], timers = [], horloge = { t: 1000 }, images = new Map();
  let nRaf = 0;
  const haptics = { impact: o => H.push(['impact', o.style]), notification: o => H.push(['notification', o.type]),
    selectionStart: () => H.push(['start']), selectionChanged: () => H.push(['cran']), selectionEnd: () => H.push(['fin']) };
  const draft = {}, pied = [], reveils = [], suivant = el('ob-cta');
  const ctx = vm.createContext({
    window: { Capacitor: natif ? { isNativePlatform: () => true, Plugins: { Haptics: haptics } } : undefined },
    document: { getElementById: id => (id === 'ob-hold' ? b : id === 'ob-hold-hint' ? hint : id === 'ob-next' ? suivant : null), querySelector: s => (s === '#ob-body .ob-pact-card' ? carte : null) },
    navigator: { vibrate: ms => H.push(['vibre', ms]) },
    performance: { now: () => horloge.t },
    requestAnimationFrame: f => { images.set(++nRaf, f); return nRaf; }, cancelAnimationFrame: id => images.delete(id),
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; },
    prefersReduceMotion: () => false, buzz: t => H.push(['buzz', t]),
    draft, OB_SLIDES: ['pact', 'practice'], obStep: 0, obGoto: s => vu.push(s),
    obSetFooter: (...a) => pied.push(a), obCtaWake: btn => reveils.push(btn),
  });
  vm.runInContext(cut('const OB_TENIR=1500;', '/* « Pour l’onboarding, il faut que tout tienne sur une page'), ctx);
  /* Les images de l’animation, toutes les 16 ms, jusqu’à t */
  const jusqua = t => { while (horloge.t < t) { horloge.t = Math.min(t, horloge.t + 16); const f = [...images.entries()]; images.clear(); f.forEach(([, g]) => g()); } };
  return { b, fill, hint, carte, H, vu, timers, horloge, draft, ctx, jusqua, pied, reveils, suivant, init: () => vm.runInContext('obHoldInit()', ctx) };
};

test('l’engagement : la page, un bouton à l’empreinte et sa phrase, plus de signature à dessiner', () => {
  const p = cut("}else if(slide==='pact'){", "  }else{\n    const p=apercuPlan(");
  /* 21 h 19 : le certificat et le bouton viennent de pacteCarteHTML et holdZoneHTML, repris dans Mon compte (retours-2119) */
  assert.ok(p.includes("${holdZoneHTML('ob-hold',!!draft.pacte,typeof chatBonusHtml==='function'?chatBonusHtml('serment','ob-hold-chat'):'')}"));
  const z = cut('function holdZoneHTML(id,fait,chat){', '\n}\n');   // 7 novembre, 15 h 38 : le chat du serment, à côté du bouton (retours-1538)
  assert.ok(z.includes('<p class="ob-hold-hint" id="${id}-hint" aria-live="polite">${fait?PACTE_PRIS:\'Maintiens ton doigt sur le bouton pour t’engager\'}</p>'));
  assert.ok(z.includes('<button type="button" class="ob-hold${fait?\' is-done\':\'\'}" id="${id}" aria-describedby="${id}-hint" aria-label="${fait?\'Engagement pris\':\'Maintenir pour m’engager\'}">'));
  assert.ok(z.includes('<circle class="ob-hold-track" cx="50" cy="50" r="46"/><circle class="ob-hold-fill" cx="50" cy="50" r="46"/>'), 'l’anneau');
  assert.ok(z.includes('<span class="ob-hold-ico" aria-hidden="true">${OB_EMPREINTE_SVG}<span class="ob-hold-plein">${OB_EMPREINTE_SVG}</span></span>'), 'l’empreinte, et sa copie qui se colore');
  const c = cut('function pacteCarteHTML(o){', '\n}\n');
  assert.ok(c.includes('<span class="ob-pact-stamp" aria-hidden="true">Validé ✓</span>') && c.includes('<p class="ob-pact-date">${esc(pacteDate(o.ts))}</p>'));
  assert.ok(p.includes("    if(draft.pacte)obSetFooter(PACTE_GO,()=>obGoto('practice'),'','','');\n    else obSetFooter('',null,'Plus tard',()=>obGoto('practice'),'');\n    setTimeout(obHoldInit,0);"));
  assert.ok(!app.includes('ob-sign') && !app.includes('function obSignInit(') && !app.includes('OB_SIGNE_PAUSE'), 'la signature est partie');
  assert.ok(app.includes("e.target.closest('.ob-hold,.ob-tv-ph,input,textarea,[role=\"slider\"]')"), 'le doigt sur le bouton ne fait pas changer d’étape');
  const svg = vm.runInNewContext(cut('const OB_EMPREINTE_SVG=', ';\n/* Le bouton à l’empreinte, où qu’il soit').replace('const OB_EMPREINTE_SVG=', ''));
  assert.equal((svg.match(/<path /g) || []).length, 9, 'l’empreinte de Lucide, neuf crêtes');
});

test('maintenu 1,5 s : l’anneau se remplit, un cran de plus en plus serré, puis la coche et « C’est parti ! »', () => {
  const x = bouton();
  x.init(); x.init();
  assert.equal(x.b.on.pointerdown.length, 1, 'branché une seule fois');
  /* Lâché trop tôt : l’anneau se vide, rien n’est pris, la phrase le dit */
  const d = x.b.fire('pointerdown');
  assert.ok(d.dp && x.b.classes.has('is-holding'), 'il s’enfonce (sans loupe ni menu)');
  assert.deepEqual(x.H[0], ['start']);
  x.jusqua(1700);
  assert.equal(x.b.props['--p'], '0.4667');
  assert.ok(Math.abs(Number(x.fill.style.strokeDashoffset) - 2 * Math.PI * 46 * (1 - 0.7 / 1.5)) < 0.01, 'l’anneau, à 47 %');
  assert.ok(x.H.slice(1).length >= 4 && x.H.slice(1).every(h => h[0] === 'cran'), 'des crans légers');
  x.b.fire('pointerup');
  assert.ok(!x.b.classes.has('is-holding') && x.b.classes.has('is-lache') && x.b.props['--p'] === '0.0000');
  assert.deepEqual(x.H.at(-1), ['fin']);
  assert.equal(x.hint.textContent, 'Garde ton doigt appuyé jusqu’au bout du cercle');
  assert.ok(x.hint.classes.has('is-relance'));
  x.b.fire('pointerdown'); assert.ok(!x.hint.classes.has('is-relance'), 'il recommence : la phrase n’est plus en jaune'); x.b.fire('pointerup');
  x.horloge.t = 1720; x.b.fire('click');
  assert.equal(x.draft.pacte, undefined, 'le clic d’un toucher trop court ne compte pas');
  /* Gardé jusqu’au bout */
  x.horloge.t = 3000; x.H.length = 0;
  x.b.fire('pointerdown'); x.jusqua(4600);
  assert.deepEqual(x.H, [['start'], ...Array(9).fill(['cran']), ['impact', 'MEDIUM'], ['impact', 'MEDIUM'], ['impact', 'MEDIUM'], ['fin'], ['notification', 'SUCCESS']],
    'douze crans (les trois derniers plus forts), puis la réussite');
  assert.ok(x.b.classes.has('is-done') && !x.b.classes.has('is-holding') && x.b.props['--p'] === '1.0000');
  assert.equal(x.b.attrs['aria-label'], 'Engagement pris');
  assert.equal(x.draft.pacte, 'empreinte'); assert.equal(typeof x.draft.pacteAt, 'number');
  assert.ok(x.carte.classes.has('is-signed'), 'le tampon « Validé ✓ » se pose');
  assert.equal(x.hint.innerHTML, 'C’est noté&nbsp;: ton engagement est pris en compte.');
  x.b.fire('pointerup'); x.b.fire('click');
  assert.equal(x.H.length, 15, 'lâcher après coup ne redonne rien');
  assert.deepEqual(x.vu, [], 'pas le clic qui suit le doigt');
  /* 21 h 19 : la page reste (la phrase à lire) ; « C’est parti ! » arrive en bas, d’un petit rebond, et mène à la suite */
  assert.deepEqual(x.timers, [], 'plus de départ automatique');
  assert.equal(x.pied.length, 1);
  assert.deepEqual([x.pied[0][0], ...x.pied[0].slice(2)], ['C’est parti\u00a0!', '', '', '']);
  assert.deepEqual(x.reveils, [x.suivant], 'le bouton se réveille');
  x.pied[0][1]();
  assert.deepEqual(x.vu, ['practice']);
});

test('au clavier et avec VoiceOver : Entrée (ou un toucher sans maintien) valide ; l’Espace se maintient', () => {
  let x = bouton(); x.init();
  x.b.fire('click', { detail: 0 });
  assert.ok(x.b.classes.has('is-done') && x.draft.pacte === 'empreinte', 'un clic sans doigt juste avant');
  assert.deepEqual(x.H, [['fin'], ['notification', 'SUCCESS']]);
  x = bouton(); x.init();
  const k = x.b.fire('keydown', { key: ' ', code: 'Space' });
  assert.ok(k.dp && x.b.classes.has('is-holding'));
  x.b.fire('keydown', { key: ' ', code: 'Space', repeat: true }); x.jusqua(1500);
  x.b.fire('keyup', { key: ' ', code: 'Space' }); x.b.fire('click', { detail: 0 });
  assert.ok(!x.b.classes.has('is-done') && x.draft.pacte === undefined, 'l’Espace lâché trop tôt : le clic qui suit ne compte pas');
  x.b.fire('keydown', { key: ' ', code: 'Space' }); x.jusqua(3100);
  assert.ok(x.b.classes.has('is-done'), 'l’Espace maintenu 1,5 s');
  /* Déjà pris (revenu sur la page) : le bouton mène à la suite */
  x = bouton({ fait: true }); x.horloge.t = 9000; x.init();
  assert.equal(x.b.props['--p'], '1.0000');
  x.b.fire('click');
  assert.deepEqual(x.vu, ['practice']);
  /* Sur le web : la vibration du téléphone, s’il en a une */
  x = bouton({ natif: false }); x.init(); x.b.fire('pointerdown'); x.jusqua(2600);
  assert.deepEqual(x.H, [...Array(12).fill(['vibre', 6]), ['buzz', 'success']]);
});

test('le bouton : jaune soleil, anneau blanc, empreinte qui se colore, menthe une fois pris ; il tient sur le plus petit écran', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold{position:relative;display:grid;place-items:center;width:96px;height:96px;'));
  const h = css.slice(css.indexOf('html #onboarding.ob-vitrine .ob-hold{'), css.indexOf('}', css.indexOf('html #onboarding.ob-vitrine .ob-hold{')));
  for (const r of ['touch-action:none', '-webkit-touch-callout:none', '-webkit-user-select:none', 'user-select:none', 'background:var(--v-sun)'])
    assert.ok(h.includes(r), r);
  assert.ok(css.includes('stroke-dasharray:289.03;stroke-dashoffset:289.03') && Math.abs(2 * Math.PI * 46 - 289.03) < 0.01, 'un tour de cercle (r = 46)');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold-plein{position:absolute;inset:0;clip-path:inset(calc((1 - var(--p,0)) * 100%) 0 0 0)}'), 'de bas en haut');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold.is-done{background:var(--v-mint);'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold.is-lache .ob-hold-fill{transition:stroke-dashoffset .35s ease-out}'), 'lâché : l’anneau se vide en douceur');
  assert.ok(css.includes('html #onboarding.ob-vitrine:has(.ob-hold.is-done) .ob-skip{opacity:0;pointer-events:none;'), '« Plus tard » s’efface');
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-4 .ob-pact .ob-hold{width:82px;height:82px}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-pact-date{padding-left:2px;text-align:left}'), 'au plus petit écran, le tampon ne touche plus la date');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-hold-hint{display:flex;align-items:center;justify-content:center;min-height:2.7em;'), 'la phrase qui change ne fait rien bouger');
  /* Les animations : avec les mouvements autorisés seulement (retours-1732) ; au repos, l’état final (la coche tracée) */
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const r of ['.ob-hold:not(.is-holding):not(.is-done)::before{animation:obvHoldHalo 2.4s ease-out infinite}', '.ob-hold-hint.is-relance{animation:obvHoldHint .42s ease-out}',
    '.ob-hold.is-done{animation:obvHoldOk .5s var(--v-pop)}', '.ob-hold.is-done .ob-hold-ok svg{animation:obvHoldCoche .35s ease-out .12s backwards}'])
    assert.ok(media.includes('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine ' + r), r);
  assert.ok(css.includes('stroke-dasharray:24;stroke-dashoffset:0}') && css.includes('@keyframes obvHoldCoche{from{stroke-dashoffset:24}}'));
  assert.ok(!/\.ob-sign/.test(css) && !css.includes('.ob-pact-foot'), 'plus de cadre à signer');
  for (const [f, s] of [['index.html', app], ['sw.js', sw]]) assert.ok(s.includes('onboarding-vitrine.css?v=68'), f);
});

/* ---------- L’haptique dans l’appli ---------- */
const pont = () => {
  const H = [], timers = [];
  const win = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Haptics: {
    impact: o => H.push(['impact', o.style]), notification: o => H.push(['notification', o.type]),
    selectionStart: () => {}, selectionChanged: () => H.push(['selection', 'cran']) } } } };
  const ctx = vm.createContext({ window: win, navigator: {}, setTimeout: (f, ms) => timers.push([f, ms]),
    document: { documentElement: { classList: { add: () => {} } }, querySelector: () => null } });
  vm.runInContext(cut('/* ---------- App iOS (Capacitor) ----------', '  window.nativeAppReady=') + '})();', ctx);
  return { H, timers, win, vibre: p => vm.runInContext(`navigator.vibrate(${JSON.stringify(p)})`, ctx) };
};

test('l’haptique : chaque toucher est un vrai impact (avant, selectionChanged ne faisait rien), un seul par toucher', () => {
  const x = pont();
  for (const ms of [4, 6, 8, 10, 12, 15, 24, 30]) x.vibre(ms);
  /* 11 novembre (« étudie tout ce qui est haptique ») : les plus brefs (4 à 6 ms : un choix qui change) donnent le cran de sélection d’iOS */
  assert.deepEqual(x.H.map(h => h[1]), ['cran', 'cran', 'LIGHT', 'LIGHT', 'MEDIUM', 'MEDIUM', 'HEAVY', 'HEAVY']);
  x.H.length = 0;
  for (const p of [[10, 40, 15], [15, 60, 15], [20, 60, 20], [10, 60, 20], [12, 40, 12]]) x.vibre(p);
  assert.deepEqual(x.H, [['notification', 'SUCCESS'], ['notification', 'WARNING'], ['notification', 'ERROR'], ['notification', 'SUCCESS'], ['notification', 'SUCCESS']]);
  x.H.length = 0; x.vibre([20, 40, 20, 40, 25]); x.timers.forEach(([f]) => f());
  assert.deepEqual(x.timers.map(t => t[1]), [0, 60, 120]); assert.deepEqual(x.H.map(h => h[1]), ['MEDIUM', 'MEDIUM', 'HEAVY']);
  /* Le même appui : le coup léger d’un autre écouteur, ou du clic qui suit, est sauté ; un coup plus fort passe */
  x.H.length = 0;
  const appui = { type: 'pointerdown' }, cible = {}, ailleurs = {};
  Object.assign(x.win, { event: appui, __toucheEv: appui, __toucheB: { contains: n => n === cible }, __toucheA: Date.now() });
  x.vibre(5); x.vibre(15);
  x.win.event = { type: 'click', target: cible }; x.vibre(8);
  x.win.event = { type: 'click', target: ailleurs }; x.vibre(8);
  x.win.__toucheA = Date.now() - 2000; x.win.event = { type: 'click', target: cible }; x.vibre(8);
  x.win.event = undefined; x.vibre(6);
  assert.deepEqual(x.H.map(h => h[1]), ['MEDIUM', 'LIGHT', 'LIGHT', 'cran']);
  assert.equal(typeof x.win.__toucheDoublon, 'function');
  /* Le toucher d’un bouton le note, pour le pont */
  /* 13 novembre, 15 h 08 : dans l’onboarding, un vrai coup (léger pour un choix, moyen pour avancer) */
  assert.ok(app.includes("    if(obT)buzz(T.el.id==='ob-next'?'medium':'light');\n    else buzz(T.el.matches(LQ_CHOIX)||!!T.el.closest('.av-stars,[role=\"radiogroup\"],[role=\"tablist\"]')?'selection':'light');\n    try{window.__toucheEv=e;window.__toucheB=T.el;window.__toucheA=Date.now();}catch(x){}   // un seul coup par toucher (pont iOS)"));
});

test('buzz() parle directement au moteur haptique d’iOS : réussite, avertissement, erreur, impacts', () => {
  const f = cut("function buzz(type='light'){", "document.addEventListener('touchstart',()=>{},{passive:true});");
  const natif = (doublon = false) => {
    const H = [];
    const ctx = vm.createContext({ window: { __toucheDoublon: () => doublon, Capacitor: { isNativePlatform: () => true, Plugins: { Haptics: {
      impact: o => H.push(o.style), notification: o => H.push(o.type) } } } }, navigator: {} });
    vm.runInContext(f, ctx);
    return { H, ctx };
  };
  const x = natif();
  for (const t of ['success', 'warning', 'error', 'light', 'selection', 'medium', 'heavy']) vm.runInContext(`buzz('${t}')`, x.ctx);
  vm.runInContext('buzz()', x.ctx);
  assert.deepEqual(x.H, ['SUCCESS', 'WARNING', 'ERROR', 'LIGHT', 'LIGHT', 'MEDIUM', 'HEAVY', 'LIGHT']);
  const y = natif(true);
  for (const t of ['light', 'selection', 'medium', 'success']) vm.runInContext(`buzz('${t}')`, y.ctx);
  assert.deepEqual(y.H, ['MEDIUM', 'SUCCESS'], 'le même toucher : pas deux coups légers');
  /* Sur le web, rien ne change */
  const v = [], w = vm.createContext({ window: {}, navigator: { vibrate: p => v.push(p), userActivation: { hasBeenActive: true } } });
  vm.runInContext(f, w);
  for (const t of ["'light'", "'success'", '12']) vm.runInContext(`buzz(${t})`, w);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), [8, [10, 40, 15], 12]);
});

/* ---------- Les raccourcis de l’icône ---------- */
const page = ({ onboarded = true, enSeance = false, ct = { type: 'bug', msg: '' } } = {}) => {
  const vu = [];
  const ctx = vm.createContext({
    window: {}, document: { querySelector: sel => (sel === '#scr-lesson.active,#lesson-video' && enSeance ? {} : null) },
    state: { onboarded }, switchTab: t => vu.push(['onglet', t]), mascotRetrouveJusqua: 0, mascotDitRetrouve: () => vu.push(['bulle']),
    setTimeout: (f, ms) => { vu.push(['attend', ms]); f(); },
    CT: ct, ctType: k => { ct.type = k; vu.push(['sujet', k]); }, openPlusDetails: id => vu.push(['ouvre', id]),
  });
  vm.runInContext(cut('const RACCOURCIS=[', 'function obNext(){').replace('const RACCOURCIS=', 'var RACCOURCIS='), ctx);
  ctx.obBandeau = t => vu.push(['bandeau', t]); ctx.toast = t => vu.push(['toast', t]);
  return { ctx, vu, ct };
};

test('« Juge-nous (gentiment) 👀 » ouvre « Contacte-nous » sur « Autre chose » ; les textes d’Elisa', () => {
  let x = page();
  x.ctx.raccourciOuvrir('fr.requete.app.avis');
  assert.deepEqual(x.vu, [['onglet', 'compte'], ['attend', 350], ['ouvre', 'plus-contact'], ['sujet', 'autre']]);
  assert.equal(x.ct.type, 'autre');
  x = page({ ct: { type: 'idee', msg: 'Un mode sombre' } }); x.ctx.raccourciOuvrir('fr.requete.app.avis');
  assert.deepEqual(x.vu.at(-1), ['sujet', 'idee'], 'un message déjà commencé garde son sujet');
  x = page({ onboarded: false }); x.ctx.raccourciOuvrir('fr.requete.app.avis');
  assert.deepEqual(x.vu, [['bandeau', 'Termine ton parcours de bienvenue : tu pourras nous écrire juste après, dans Mon compte.']]);
  x = page({ enSeance: true }); x.ctx.raccourciOuvrir('fr.requete.app.avis');
  assert.deepEqual(x.vu, [], 'en séance, on y reste');
  x = page(); x.ctx.raccourciOuvrir('fr.requete.app.autre');
  assert.deepEqual(x.vu, [], 'un raccourci inconnu ne fait rien');
  assert.ok(app.includes("{k:'autre',t:'Autre chose',"), 'le sujet existe');
  const r = vm.runInNewContext('(' + cut('const RACCOURCIS=[', '];').replace('const RACCOURCIS=', '') + '])');
  assert.equal(r.length, 3, 'quatre au plus (iOS)');
  for (const i of r) assert.ok(!/'/.test(i.titre + i.sousTitre) && !/ [?!]/.test(i.titre + i.sousTitre), 'apostrophes et espaces insécables : ' + i.titre);
  assert.ok(app.includes("const MASCOT_RETROUVE='Ouf, pas de DELETE\\u00a0! Un petit SELECT\\u00a0?';"), 'le chat répond à « Même pas un dernier SELECT ? »');
});

/* ---------- Les rappels ---------- */
const rappel = cut('/* Les jours du rappel (Elisa, 4 novembre, 11 h 08, réf. 2)', '/* Le rappel dans Mon compte (Elisa, 5 novembre, 12 h 12');
const rctx = (freq = 7, extra = {}) => {
  const ctx = vm.createContext({ PATTERN, state: { plan: { freq } }, draft: {}, document: { getElementById: () => null },
    rappelOn: () => true, rappelHeure: () => '07:45', ...extra });
  vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS=').replace('const RAPPEL_MESSAGES=', 'var RAPPEL_MESSAGES='), ctx);
  return ctx;
};

test('le rappel : les messages d’Elisa (8, puis 16 de plus le 11 novembre), un par jour, au hasard, puis remélangés', () => {
  const ctx = rctx();
  const L = JSON.parse(JSON.stringify(ctx.RAPPEL_MESSAGES));
  assert.equal(L.length, 24);
  assert.deepEqual(L[0], ['👀 On te voit scroller…', 'Et si tu faisais un petit SELECT\u00a0?']);
  assert.deepEqual(L[8], ['🫣 On ne juge pas…', 'Mais ton dernier SELECT date un peu.'], '11 novembre, 22 h 11');
  assert.deepEqual(L[23], ['👀 On connaît ton préféré…', 'Spoiler\u00a0: ce n’est pas le SQL.']);
  assert.ok(!JSON.stringify(L).includes('TikTok') && !JSON.stringify(L).includes('Virement'), '22 h 24 : sans la banque ni TikTok');
  const msg = d => JSON.stringify(vm.runInContext(`rappelMessage(new Date(${d.getTime()}))`, ctx));
  /* Un tour : autant de jours que de messages, chacun une fois (le tour commence au jour n multiple de 24, depuis 1970) */
  const n0 = Math.ceil(Date.UTC(2026, 10, 5) / 864e5 / 24) * 24;
  const tour = k => Array.from({ length: 24 }, (_, i) => new Date((n0 + 24 * k + i) * 864e5 + 12 * 36e5)).map(msg);
  const t0 = tour(0), t1 = tour(1);
  assert.equal(new Set(t0).size, 24, 'un tour : les 24, une fois chacun');
  assert.equal(new Set(t1).size, 24);
  assert.notDeepEqual(t0, t1, 'puis l’ordre est remélangé');
  const suite = t0.concat(t1);
  for (let i = 0; i < suite.length; i++) for (let j = i + 1; j <= i + 7 && j < suite.length; j++) assert.notEqual(suite[i], suite[j], 'pas deux fois le même en une semaine');
  assert.equal(msg(new Date(2026, 10, 5, 23, 59)), msg(new Date(2026, 10, 5, 0, 1)), 'le message dépend du jour, pas de l’heure');
  assert.ok(app.includes("  try{ const [t,b]=rappelMessage(now); new Notification(t,{body:b,tag:'requete-daily'}); }catch(e){}"), 'sur le web aussi');
  const code = (rappel + cut('function tickRappel(){', 'function plusIcon(kind){')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!code.includes('l’heure de ta séance SQL'), 'plus « C’est l’heure de ta séance SQL. »');
});

test('le rappel sur l’iPhone : une notification par séance à venir, chacune avec son message, reposées à chaque ouverture', async () => {
  for (const freq of [7, 3]) {
    let notes = null;
    const ctx = rctx(freq, { window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: {
      cancel: async () => {}, requestPermissions: async () => ({ display: 'granted' }),
      schedule: async o => { notes = o.notifications; } } } } } });
    vm.runInContext('rappelNativeSync()', ctx);
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
    assert.equal(notes.length, 56, 'freq ' + freq);
    for (const n of notes) assert.deepEqual([n.title, n.body], [...vm.runInContext('rappelMessage', ctx)(n.schedule.at)], 'le message de son jour');
    assert.ok(notes.every((n, i) => i === 0 || n.title !== notes[i - 1].title), 'deux séances de suite : deux messages');
    if (freq === 7) assert.equal(new Set(notes.slice(0, 8).map(n => n.title)).size, 8, 'une semaine et un jour : huit messages différents');
  }
  /* 21 h 41 : d’après le planning, et seulement si ce qui est prévu a changé depuis la dernière fois (retours-2141) */
  assert.ok(app.includes("    setTimeout(()=>{try{if(state.onboarded)rappelAuto(0);}catch(e){}},2200);   // les rappels des semaines à venir, reposés d’après le planning (19 h 41, 21 h 41)"),
    'à l’ouverture de l’appli : les semaines suivantes, sans attendre d’avoir touché au rappel');
  assert.ok(sw.includes("requete-2026-11-14-historiques-v3002"), 'le cache de l’appli change');
});
