/* Elisa, 11 novembre, 12 h 46 : « étudie tout ce qui est haptique iOS / micro-interaction / lancement de l’application pour
   améliorer l’application ».
   1. Le toucher : le retour haptique part quand le toucher est confirmé (le doigt se lève sans avoir glissé), plus quand il se pose :
      faire défiler une liste en partant d’une carte vibrait à chaque fois. Un choix qui change donne le cran de sélection d’iOS.
   2. Le cran de sélection marche enfin : selectionChanged ne fait rien sans selectionStart.
   3. Chaque verdict a son retour : une mauvaise réponse ne vibre plus comme une bonne ; « Pas encore » avertit, une erreur SQL aussi.
   4. Les feuilles qui montent du bas se ferment en les tirant vers le bas (un cran au seuil, un rebond sinon).
   5. Le lancement : l’ouverture entière (son, haptique) une fois par jour ; ce qu’elle construit se crée au départ, plus pendant
      le chargement. Depuis 13 h 10 (« Le logo se construit », tests/retours-1310), les autres ouvertures du jour jouent une version
      courte, avec ses vibrations, au lieu d’un fondu muet. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

/* ---------- 1. Le toucher confirmé ---------- */
const toucher = () => {
  const src = cut(app, 'const LQ_CHOIX=', "function buzz(type='light'){");
  const ls = {}, log = [];
  let now = 1000;
  const win = {};
  const ctx = vm.createContext({ window: win, Date: { now: () => now }, Math, buzz: t => log.push(t),
    document: { addEventListener: (t, f) => { ls[t] = f; } } });
  vm.runInContext(src, ctx);
  const choix = vm.runInContext('LQ_CHOIX', ctx).split(',');
  /* Un élément : sa « sorte » (button, [role="switch"], label…) répond à closest et matches */
  const el = (sorte, { disabled = false, attrs = {}, case_ = false } = {}) => {
    const e = { tagName: sorte === 'label' ? 'LABEL' : 'BUTTON', disabled, isConnected: true,
      getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs,
      matches: sel => sel.split(',').includes(sorte) && sel.split(',').some(x => choix.includes(x)),
      querySelector: () => (case_ ? {} : null) };
    e.closest = sel => (sel.split(',').includes(sorte) ? e : null);
    return e;
  };
  const tape = (cible, { type = 'touch', glisse = 0, duree = 80, annule = false } = {}) => {
    ls.pointerdown({ pointerType: type, button: 0, target: cible, pointerId: 3, clientX: 100, clientY: 200 });
    if (glisse) ls.pointermove({ pointerId: 3, clientX: 100, clientY: 200 + glisse });
    if (annule) ls.pointercancel({});
    now += duree;
    ls.pointerup({ pointerId: 3 });
    return log.splice(0);
  };
  return { ls, log, win, el, tape };
};

test('toucher : la vibration part au doigt levé sur le bouton, pas quand il se pose ni quand il fait défiler', () => {
  const x = toucher();
  const b = x.el('button');
  x.ls.pointerdown({ pointerType: 'touch', button: 0, target: b, pointerId: 3, clientX: 100, clientY: 200 });
  assert.deepEqual(x.log, [], 'le doigt posé : rien encore');
  x.ls.pointerup({ pointerId: 3 });
  assert.deepEqual(x.log.splice(0), ['light'], 'levé sur le bouton : un petit impact');
  assert.equal(x.win.__toucheB, b, 'noté pour le pont : le clic qui suit ne revibre pas');
  assert.deepEqual(x.tape(b, { glisse: 30 }), [], 'le doigt a glissé (on fait défiler) : rien');
  assert.deepEqual(x.tape(b, { glisse: 6 }), ['light'], 'un doigt qui tremble un peu : toujours un toucher');
  assert.deepEqual(x.tape(b, { duree: 800 }), [], 'un appui long : il a son propre retour');
  assert.deepEqual(x.tape(b, { annule: true }), [], 'geste repris par iOS : rien');
  assert.deepEqual(x.tape(b, { type: 'mouse' }), [], 'à la souris : rien');
});

test('toucher : un choix donne le cran de sélection ; un bouton éteint ou une étiquette de champ, rien', () => {
  const x = toucher();
  for (const s of ['[role="switch"]', '[role="tab"]', '[role="radio"]', 'input[type="checkbox"]']) assert.deepEqual(x.tape(x.el(s)), ['selection'], s);
  assert.deepEqual(x.tape(x.el('label', { case_: true })), ['selection'], 'une case à cocher par son étiquette');
  assert.deepEqual(x.tape(x.el('label')), [], 'l’étiquette d’un champ de texte : rien');
  assert.deepEqual(x.tape(x.el('button', { disabled: true })), [], 'bouton éteint : rien');
  assert.deepEqual(x.tape(x.el('button', { attrs: { 'aria-disabled': 'true' } })), [], 'aria-disabled : rien');
  assert.deepEqual(x.tape(x.el('button', { attrs: { 'aria-disabled': 'true', 'data-jc-gate': '' } })), ['light'], 'le bouton verrouillé de la leçon (il ouvre la vidéo) vibre');
  assert.ok(!/pointerdown',e=>\{[^}]*buzz\(/.test(cut(app, 'const LQ_CHOIX=', "function buzz(type='light'){")), 'plus aucune vibration au doigt posé');
  assert.ok(!app.includes("LQ_PRESS)&&navigator.vibrate"), 'l’ancienne vibration de 5 ms au pointerdown est partie');
});

/* ---------- 2. Le cran de sélection ---------- */
const pont = (avecSelection = true) => {
  const H = [];
  const Haptics = { impact: o => H.push('impact ' + o.style), notification: o => H.push('notif ' + o.type) };
  if (avecSelection) Object.assign(Haptics, { selectionStart: () => H.push('début'), selectionChanged: () => H.push('cran') });
  const win = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Haptics } } };
  const ctx = vm.createContext({ window: win, navigator: {}, setTimeout: () => {},
    document: { documentElement: { classList: { add: () => {} } }, querySelector: () => null } });
  vm.runInContext(cut(app, '/* ---------- App iOS (Capacitor) ----------', '  window.nativeAppReady=') + '})();', ctx);
  return { H, win, vibre: p => vm.runInContext(`navigator.vibrate(${JSON.stringify(p)})`, ctx) };
};

test('cran de sélection : ouvert par selectionStart à chaque fois (sans lui, iOS ne fait rien) ; repli sur un impact léger', () => {
  const x = pont();
  x.vibre(5);
  assert.deepEqual(x.H.splice(0), ['début', 'cran']);
  x.vibre(8); x.vibre(15);
  assert.deepEqual(x.H.splice(0), ['impact LIGHT', 'impact MEDIUM'], 'les autres durées : des impacts, comme avant');
  assert.equal(typeof x.win.__cran, 'function');
  const y = pont(false);
  y.vibre(5);
  assert.deepEqual(y.H, ['impact LIGHT'], 'une extension sans sélection : un impact léger');
  /* buzz('selection') passe par le même cran */
  const f = cut(app, "function buzz(type='light'){", "document.addEventListener('touchstart',()=>{},{passive:true});");
  const H = [];
  const ctx = vm.createContext({ navigator: {}, window: { __cran: () => H.push('cran'), __toucheDoublon: () => false,
    Capacitor: { isNativePlatform: () => true, Plugins: { Haptics: { impact: o => H.push(o.style), notification: o => H.push(o.type) } } } } });
  vm.runInContext(f, ctx);
  vm.runInContext("buzz('selection');buzz('light');buzz('warning')", ctx);
  assert.deepEqual(H, ['cran', 'LIGHT', 'WARNING']);
});

/* ---------- 3. Chaque verdict a son retour ---------- */
test('verdicts : la bonne réponse réussit, la mauvaise échoue, « Pas encore » avertit', () => {
  assert.ok(cut(app, 'function initAskSlots(){', '\n}\n').includes("buzz(i===ok?'success':'error');"), 'question à trous : plus de « réussite » sur une mauvaise réponse');
  assert.ok(cut(app, 'function checkPetitDefi(i){', '\n}\n').includes("buzz(ok?'success':'error');"), 'petit défi : réussite ou erreur, plus deux impacts');
  const qcm = cut(app, 'function repondreQcm(i,choix){', '\n}\n');
  assert.ok(qcm.includes("buzz('success');") && qcm.includes("buzz('error');"), 'QCM');
  assert.ok(cut(app, 'function lvOpNudge(){', 'function lvOpClose(){').includes("buzz('warning');"), 'vidéo : la notification à toucher avertit');
  assert.ok(cut(app, 'function coachPaint(){', '\n}\n').includes("if(card&&COACH.fx==='is-new-ko'&&typeof buzz==='function')buzz('warning');"), 'défi : la carte du coach qui dit « pas encore »');
  /* setLessonOut : l’échec vibre (la réussite vibrait déjà avec la fête) */
  const src = cut(app, 'function setLessonOut(html){', "  const scr=document.getElementById('scr-lesson');");
  const run = h => { const log = []; const ctx = vm.createContext({ buzz: t => log.push(t), document: { getElementById: () => ({}) }, String });
    vm.runInContext(src + '}\nsetLessonOut(' + JSON.stringify(h) + ');', ctx); return log; };
  assert.deepEqual(run('<div class="feedback err"><b>Erreur</b></div>'), ['error'], 'une erreur SQL');
  assert.deepEqual(run('<div class="feedback warn"><div class="fi">≈</div><div><b>Pas encore</b></div></div>'), ['warning'], '« Pas encore »');
  assert.deepEqual(run('<div class="feedback warn console-lock">Non exécutable ici</div>'), [], 'un encadré d’information : rien');
  assert.deepEqual(run('<div class="ok-panel">✓ Correct</div>'), [], 'la réussite : déjà fêtée ailleurs');
  assert.deepEqual(run(''), []);
});

/* ---------- 4. Les feuilles tirées vers le bas ---------- */
const feuille = ({ hauteur = 600, defile = 0 } = {}) => {
  const src = cut(app, 'const LQ_FEUILLES=[', '/* Clavier ouvert (iPhone) : la feuille ouverte remonte');
  const docLs = {}, winLs = {}, log = [], timers = [];
  let empeche = 0;
  const croix = { clics: 0, click() { this.clics++; } };
  const fond = { classList: { contains: c => c === 'viz-back' }, style: {} };
  const p = { nodeType: 1, style: {}, getBoundingClientRect: () => ({ height: hauteur }), contains: () => false,
    querySelector: s => (s === ':scope>.viz-head>button:last-child' ? croix : null), previousElementSibling: fond, parentElement: {} };
  const liste = { nodeType: 1, parentElement: p, scrollTop: defile, scrollHeight: defile ? 2000 : 0, clientHeight: 400 };
  const cible = (sans = false, dans = p) => ({ nodeType: 1, parentElement: dans, closest: s => (s.includes('textarea') ? (sans ? {} : null) : s === '.viz.on' ? p : null) });
  const ctx = vm.createContext({
    document: { addEventListener: (t, f) => { docLs[t] = f; }, activeElement: null, querySelector: () => null, getElementById: () => null },
    window: { addEventListener: (t, f) => { winLs[t] = f; }, removeEventListener: (t, f) => { if (winLs[t] === f) delete winLs[t]; } },
    getComputedStyle: n => ({ overflowY: n === liste ? 'auto' : 'visible' }), prefersReduceMotion: () => false,
    buzz: t => log.push(t), setTimeout: (f, ms) => timers.push([ms, f]), Math, String
  });
  vm.runInContext(src, ctx);
  const vider = () => { while (timers.length) timers.splice(0).sort((a, b) => a[0] - b[0]).forEach(t => t[1]()); };
  const geste = (pas, { t = cible(), dt = 16, pause = 0, pendant = null } = {}) => {
    docLs.touchstart({ touches: [{ identifier: 1, clientX: 200, clientY: 100 }], target: t, timeStamp: 0 });
    let ts = 0;
    for (const dy of pas) { ts += dt; if (!winLs.touchmove) break;
      winLs.touchmove({ changedTouches: [{ identifier: 1, clientX: 200, clientY: 100 + dy }], timeStamp: ts, cancelable: true, preventDefault: () => empeche++ }); }
    if (pendant) pendant();
    if (winLs.touchend) winLs.touchend({ changedTouches: [{ identifier: 1 }], timeStamp: ts + 16 + pause });
  };
  return { p, fond, croix, log, winLs, geste, vider, cible, liste, empeche: () => empeche };
};

test('feuille : tirée au-delà du seuil, elle part et se ferme comme sa croix, avec un cran au passage du seuil', () => {
  const x = feuille();
  x.geste([10, 100, 200, 300], { dt: 100 });
  assert.deepEqual(x.log, ['selection'], 'un cran quand on passe le seuil (160 px au plus)');
  assert.equal(x.p.style.transform, 'translate3d(0,640px,0)', 'elle descend hors de l’écran');
  assert.equal(x.croix.clics, 0);
  x.vider();
  assert.equal(x.croix.clics, 1, 'puis se ferme par sa croix (ce que la croix fait, rien de plus)');
  assert.equal(x.p.style.transform, '', 'la feuille gardée dans la page retrouve sa place pour la prochaine fois');
  assert.deepEqual(Object.keys(x.winLs), [], 'les écouteurs du geste sont retirés');
});

test('feuille : lâchée trop tôt elle revient d’un rebond ; lancée vite, elle part ; un doigt immobile avant de se lever ne lance rien', () => {
  const lent = feuille();
  lent.geste([10, 20, 30, 40, 50, 60], { dt: 50 });
  assert.equal(lent.p.style.transform, '', 'revenue à sa place');
  assert.match(lent.p.style.transition, /cubic-bezier\(\.25,1\.35,\.45,1\)/, 'avec un rebond');
  lent.vider(); assert.equal(lent.croix.clics, 0, 'toujours ouverte');
  assert.deepEqual(lent.log, [], 'pas de cran sans seuil franchi');
  const vif = feuille();
  vif.geste([10, 40, 70, 100], { dt: 16 });
  vif.vider(); assert.equal(vif.croix.clics, 1, '90 px lancés en 50 ms : elle part');
  const arret = feuille();
  arret.geste([10, 40, 70, 100], { dt: 16, pause: 200 });
  arret.vider(); assert.equal(arret.croix.clics, 0, 'lancée, puis tenue 200 ms : elle revient');
  const court = feuille();
  court.geste([10, 20, 30, 40], { dt: 16 });
  court.vider(); assert.equal(court.croix.clics, 0, 'à peine tirée (moins de 40 px) : elle revient');
});

test('feuille : ni vers le haut, ni depuis un champ, ni quand son contenu a défilé ; six feuilles concernées', () => {
  const haut = feuille();
  haut.geste([-12, -40]);
  assert.deepEqual(Object.keys(haut.winLs), [], 'vers le haut : le geste est rendu au défilement');
  assert.equal(haut.empeche(), 0);
  const champ = feuille();
  champ.geste([10, 300], { t: champ.cible(true) });
  assert.equal(champ.p.style.transform, undefined, 'depuis un champ : la feuille ne bouge pas');
  const defilee = feuille({ defile: 50 });
  defilee.geste([10, 300], { t: defilee.cible(false, defilee.liste) });
  defilee.vider(); assert.equal(defilee.croix.clics, 0, 'contenu défilé : le doigt le fait remonter, la feuille reste');
  const tiree = feuille();
  tiree.geste([10, 130], { dt: 30 });
  assert.ok(tiree.empeche() >= 1, 'vers le bas, contenu en haut : iOS ne fait pas rebondir la feuille sous le doigt');
  const sel = cut(app, 'const LQ_FEUILLES=[', 'const LQ_FEUILLE_SANS=');
  for (const s of ["'.viz.on'", "'#scr-compte .plus-details[open]'", "'.pays-feuille.on .pays-boite'", "'.lq-ask.on .lq-ask-sheet'", "'.dx-feuille.on .dx-f-boite'", "'.imp-sheet.on'"])
    assert.ok(sel.includes('[' + s + ','), 'feuille : ' + s);
  assert.ok(app.includes("const LQ_FEUILLE_SANS='input,textarea,select,[contenteditable=\"true\"],.editor-area,.stk-board,.stk-cell,.lv-seek,[data-sans-glisse]';"), 'ni champ, ni éditeur, ni sticker, ni curseur de la vidéo');
});

test('feuille : pendant le geste, le fond s’éclaircit à mesure qu’elle descend', () => {
  const x = feuille();
  const src = cut(app, 'const poser=(y,anim)=>{', 'const bouge=e=>{');
  assert.ok(src.includes("g.fond.style.opacity=y>0?String(Math.max(0,1-y/(g.h*1.1))):'';"));
  let milieu = null;
  x.geste([10, 60, 110, 160], { dt: 120, pause: 150, pendant: () => { milieu = x.fond.style.opacity; } });
  assert.equal(milieu, String(1 - 152 / 660), 'à 152 px sur 600 : le fond pâlit d’un quart');
  /* relâchée sous le seuil (160 px), tenue avant de lâcher : elle revient, le fond aussi */
  assert.equal(x.fond.style.opacity, '');
  assert.equal(x.croix.clics, 0);
});

/* ---------- 5. Le lancement ---------- */
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const ajd = (() => { const x = new Date(); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); })();
function lancer(store = {}, { calme = false } = {}) {
  const log = [], timers = [], frames = [];
  const L = fauxLoader({ log }), cls = L.cls, html = L.html, nom = L.nom;
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: { AudioContext: class { decodeAudioData() {} close() {} }, fetch: u => { log.push('son ' + u); return new Promise(() => {}); } },
    Array, Promise, performance: { now: () => 1000 }, matchMedia: () => ({ matches: calme }),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { vibrate: ms => { log.push('vibre ' + ms); return true; } },
    requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => timers.push([ms, f])
  });
  ctx.window.Capacitor = { Plugins: { SplashScreen: { hide: () => log.push('écran retiré') } } };
  vm.runInContext(intro, ctx);
  const run = max => { const due = timers.filter(t => t[0] <= max); for (const t of due) timers.splice(timers.indexOf(t), 1); due.sort((a, b) => a[0] - b[0]).forEach(t => t[1]()); };
  const jouer = () => { ctx.window.__introJouer(); frames.splice(0).forEach(f => f()); frames.splice(0).forEach(f => f()); };
  return { log, cls, html, nom, L, run, jouer, store };
}

test('lancement : l’ouverture se joue en entier (son, haptique) ; les cases se créent au départ', () => {
  const s = lancer();
  assert.equal(s.html.length, 1, 'au chargement, rien que les points de l’écran de lancement');
  assert.ok(s.log.includes('son assets/sons/ouverture.m4a'), 'le son se charge');
  s.run(1000); assert.equal(s.html.length, 1, 'ni juste après');
  s.jouer();
  assert.equal(s.html.length, 2); assert.ok(s.html[1].includes('<i class="in-k" aria-hidden="true"'), 'les cases, au départ de l’ouverture');
  assert.ok(s.cls.has('is-play') && !s.cls.has('is-court'));
  assert.ok(!('rq-intro-jour' in s.store), '17 h 56 : plus de jour noté'); 
  assert.equal(s.L.style['--t-fin'], '1080ms');
  s.run(1080); assert.ok(s.log.includes('vibre 25'));
  s.run(1930); s.run(2300); assert.equal(s.L.style.display, 'none', 'la sortie à 1,93 s (l’appli prête), rangée 0,37 s plus tard');
});

/* Elisa, 11 novembre, 17 h 56 : « je n’aime pas l’animation d’arrivée courte, je préfère la longue » */
test('lancement : les ouvertures suivantes du même jour se jouent aussi en entier, avec le son', () => {
  const s = lancer({ 'rq-intro-jour': ajd });
  assert.ok(!('rq-intro-jour' in s.store), 'le jour noté avant est oublié');
  assert.equal((s.nom.innerHTML.match(/class="in-l"/g) || []).length, 7, 'les lettres se construisent');
  assert.ok(s.log.includes('son assets/sons/ouverture.m4a'), 'le son se charge');
  s.jouer();
  assert.ok(s.log.includes('écran retiré') && s.cls.has('is-play') && !s.cls.has('is-court'), 'l’ouverture entière');
  assert.equal(s.L.style['--t-fin'], '1080ms');
  s.run(2280); assert.notEqual(s.L.style.display, 'none'); s.run(2300); assert.equal(s.L.style.display, 'none', 'rangée après la plongée');
  const calme = lancer({}, { calme: true });
  calme.jouer(); assert.ok(calme.cls.has('fade-out') && !('rq-intro-jour' in calme.store), 'mouvement réduit : le fondu, comme avant');
});
