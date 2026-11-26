/* Elisa, 26 novembre, 14 h 05, sur son Samsung (appli Google Play) ; « sur iPhone c’est ok, quand je te parle d’une correction là
   c’est que Android » : tout ce qui suit est pour Android seulement.
   - « je crois qu’il y a eu un bug […] Ça a fait comme un flash » (sa photo : le logo rond d’Android par-dessus les cases de l’ouverture)
   - « Ça a fait un flash au début quand j’ai écrit une note, quand j’ai ouvert le clavier. Ouais, ça saute quand on écrit pour la
     première fois sur le clavier de notes. Et quand on veut enregistrer la note, il faut cliquer 2 fois. »
   - sa photo du bilan : « Recommence / r » */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html');
const ludique = lire('ludique.css');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j + b.length); };

/* ---------- L’ouverture : le logo d’Android, puis les cases ---------- */
const ouverture = entre(app, "(function(){\n  var d=document.documentElement,L=document.getElementById('loader'),C=window.Capacitor;", '\n})();\n  </script>').replace(/\n  <\/script>$/, '');

function faux(nom) {
  const cls = new Set(), st = {};
  return {nom, classList: {add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c), toggle: (c, on) => (on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)},
    style: {setProperty: (k, v) => { st[k] = v; }, st}, setAttribute() {}, getBoundingClientRect: () => ({left: 10, top: 10, width: 12, height: 12}), cls};
}
function lancer(plateforme, {calme = false} = {}) {
  const T = [];   // minuteurs et images, joués à la main
  let maintenant = 0;
  const L = faux('loader'), html = [], logo = Object.assign(faux('in-and'), {complete: true, naturalWidth: 776, decode: () => Promise.resolve(), addEventListener() {}});
  const nom = Object.assign(faux('ld-name'), {textContent: 'Requête', innerHTML: ''});
  L.insertAdjacentHTML = (ou, h) => html.push(h);
  L.querySelector = s => s === '.in-and' ? (html.join('').includes('class="in-and"') ? logo : null) : s === '.ld-name' ? nom : null;
  L.querySelectorAll = s => s === '.in-d' ? Array.from({length: 23}, () => faux('d')) : s === '.in-k' ? Array.from({length: 16}, () => faux('k')) : s === '.in-l' ? Array.from({length: 7}, () => faux('l')) : [];
  const racine = faux('html');
  racine.classList.add('is-native', 'is-' + plateforme);
  const caches = [];
  const ctx = {
    document: {documentElement: racine, getElementById: id => id === 'loader' ? L : null, visibilityState: 'visible'},
    sessionStorage: {getItem: () => null, removeItem() {}}, localStorage: {getItem: () => (calme ? '{"reduceMotion":true}' : null), removeItem() {}},
    matchMedia: () => ({matches: false}), navigator: {vibrate() {}},
    performance: {now: () => maintenant}, Date: {now: () => maintenant},
    setTimeout: (f, ms) => { T.push({t: maintenant + (ms || 0), f}); return T.length; }, clearTimeout() {},
    requestAnimationFrame: f => { T.push({t: maintenant + 16, f}); return T.length; },
    Promise, Math, String, Array, Object, JSON
  };
  ctx.window = ctx;
  ctx.Capacitor = {isNativePlatform: () => true, getPlatform: () => plateforme, Plugins: {SplashScreen: {hide: o => { caches.push([maintenant, o]); return Promise.resolve(); }}}};
  vm.createContext(ctx);
  vm.runInContext(ouverture, ctx);
  const avancer = jusque => { for (;;) { T.sort((a, b) => a.t - b.t); const x = T[0]; if (!x || x.t > jusque) break; T.shift(); maintenant = x.t; x.f(); } maintenant = jusque; };
  return {ctx, L, html: () => html.join(''), caches, avancer, maintenant: () => maintenant};
}

test('Android : la page commence par le logo d’Android (même image, même place), sans points ni emplacements', () => {
  const o = lancer('android');
  assert.ok(o.html().includes('<img class="in-and" src="assets/lancement-android.webp" width="194" height="194" alt="" aria-hidden="true" draggable="false">'));
  assert.ok(o.L.classList.contains('is-and'));
  assert.ok(o.L.classList.contains('is-intro'));
  // Le logo, tiré de splash_icone (xxxhdpi, 1 152 px pour 288 dp) : les 776 px du centre, soit 194 dp autour du cercle de 192 dp.
  const w = readFileSync(new URL('../assets/lancement-android.webp', import.meta.url));
  assert.equal(w.toString('latin1', 0, 4), 'RIFF'); assert.equal(w.toString('latin1', 8, 16), 'WEBPVP8L');
  const v = w.readUInt32LE(21);
  assert.deepEqual([(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1], [776, 776]);
  assert.ok(existsSync(new URL('../android/app/src/main/res/drawable-xxxhdpi/splash_icone.png', import.meta.url)));
  assert.ok(lire('scripts/build-www.mjs').includes("for (const dir of ['assets', 'vendor']) cpSync(join(root, dir), join(out, dir), {recursive: true"), 'assets/ part dans l’appli');
});

test('Android : l’ouverture attend la fin du fondu d’Android, puis le logo s’efface pendant que les points arrivent', () => {
  const o = lancer('android');
  o.ctx.__introJouer();
  assert.equal(o.caches.length, 1, 'l’écran de lancement d’Android est retiré');
  assert.deepEqual(JSON.parse(JSON.stringify(o.caches[0][1])), {fadeOutDuration: 0});
  o.avancer(300);
  assert.ok(!o.L.classList.contains('is-and-part') && !o.L.classList.contains('is-play'), 'rien ne bouge pendant les 250 ms de son fondu');
  o.avancer(330);
  assert.ok(o.L.classList.contains('is-and-part') && !o.L.classList.contains('is-play'), 'le logo part, les points arrivent');
  o.avancer(560);
  assert.ok(o.L.classList.contains('is-play'), 'puis l’ouverture de l’iPhone');
});

test('L’iPhone : rien ne change (pas de logo d’Android, l’ouverture part tout de suite)', () => {
  const o = lancer('ios');
  assert.ok(!o.html().includes('in-and'));
  assert.ok(!o.L.classList.contains('is-and'));
  o.ctx.__introJouer();
  o.avancer(40);
  assert.ok(o.L.classList.contains('is-play'));
  assert.ok(!o.L.classList.contains('is-and-part'));
});

test('Android en mouvement réduit : le logo reste, puis la page s’efface d’un seul fondu', () => {
  const o = lancer('android', {calme: true});
  o.ctx.__introJouer();
  o.avancer(300);
  assert.ok(!o.L.classList.contains('fade-out'));
  o.avancer(330);
  assert.ok(o.L.classList.contains('fade-out'));
  assert.ok(!o.L.classList.contains('is-play'));
});

test('Le style : le logo n’existe que sur Android ; points et emplacements cachés jusqu’au départ', () => {
  const bloc = entre(ludique, 'html.is-native.lq #loader.is-intro .in-and{display:none}', '@keyframes introAndPoints{from{opacity:0}}');
  for (const r of ['html.is-native.is-android.lq #loader.is-intro.is-and .in-and{display:block;position:absolute;z-index:3;left:50%;top:50%;width:194px;height:194px;margin:-97px 0 0 -97px;',
    'html.is-native.is-android.lq #loader.is-intro.is-and:not(.is-and-part) :is(.in-d,.in-s){opacity:0}',
    'html.is-native.is-android.lq #loader.is-intro.is-and.is-and-part .in-and{animation:introAndLogo .28s cubic-bezier(.35,0,.65,1) both}',
    'html.is-native.is-android.lq #loader.is-intro.is-and.is-and-part:not(.is-play) :is(.in-d,.in-s){animation:introAndPoints .2s ease-out both}',
    '@keyframes introAndLogo{to{opacity:0;transform:scale(.6)}}'])
    assert.ok(bloc.includes(r), r);
  // L’ouverture de l’iPhone garde ses règles
  assert.ok(ludique.includes('html.is-native.lq #loader.is-intro.is-play .in-d{opacity:0}'));
  assert.ok(ludique.includes('html.is-native.lq #loader.is-intro.is-play .in-s{animation:introFade 90ms linear var(--t-soude) forwards}'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=394">'));
});

/* ---------- Le clavier d’Android : kb-ouvert ---------- */
const ajuste = entre(app, "(function(){\n  const vv=window.visualViewport;if(!vv)return;", '\n})();');

function clavier(android) {
  const ecoute = {};
  const racine = faux('html');
  const ctx = {
    innerHeight: 854, innerWidth: 384,
    document: {documentElement: racine, activeElement: {tagName: 'TEXTAREA'}},
    kbNatH: 0, kbNatBase: 854, IOS_KB_OVERLAY: 0, kbAnimFin: 0,
    kbNatif: () => 0, dxNatif: () => true, kbEnMouvement: () => false, paysVueRendre: () => {}, appAndroid: () => android,
    requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, Math, Date
  };
  ctx.window = ctx;
  ctx.visualViewport = {height: 854, offsetTop: 0, addEventListener() {}};
  ctx.addEventListener = (n, f) => (ecoute[n] = ecoute[n] || []).push(f);
  // Comme dans la page (plus haut que l’ajustement) : sans clavier de l’app (kbNatH), la hauteur de la vue sert de base
  ctx.addEventListener('resize', () => { if (!ctx.kbNatH) ctx.kbNatBase = ctx.innerHeight; });
  vm.createContext(ctx);
  vm.runInContext(ajuste, ctx);
  const ev = n => (ecoute[n] || []).forEach(f => f({keyboardHeight: 330}));
  const vue = h => { ctx.innerHeight = h; ctx.visualViewport.height = h; ev('resize'); };
  return {ctx, ev, vue, ouvert: () => racine.cls.has('kb-ouvert')};
}

test('Android : kb-ouvert suit le clavier (plugin Keyboard, ou la vue qui rétrécit avec un champ actif)', () => {
  const k = clavier(true);
  assert.equal(k.ouvert(), false);
  k.ev('keyboardWillShow');
  assert.equal(k.ouvert(), true, 'dès que le clavier s’annonce');
  k.vue(524);
  assert.equal(k.ouvert(), true);
  k.ev('keyboardWillHide');
  assert.equal(k.ouvert(), false, 'dès qu’il s’en va');
  k.vue(854);
  assert.equal(k.ouvert(), false);
  // Sans les annonces du plugin : la vue qui rétrécit de plus de 120 px, un champ actif
  k.vue(530);
  assert.equal(k.ouvert(), true);
  k.vue(854);
  assert.equal(k.ouvert(), false);
  // La vue qui rétrécit sans champ actif (pas un clavier) : rien
  k.ctx.document.activeElement = {tagName: 'BODY'};
  k.vue(530);
  assert.equal(k.ouvert(), false);
});

test('L’iPhone : kb-ouvert ne dépend toujours que de --kb, kbNatH et du mouvement du clavier', () => {
  const k = clavier(false);
  k.ev('keyboardWillShow');
  assert.equal(k.ouvert(), false, 'kbNatH vient de son propre écouteur (ici 0)');
  k.ctx.kbNatH = 336; k.ev('keyboardDidShow');
  assert.equal(k.ouvert(), true);
  assert.ok(app.includes("document.documentElement.classList.toggle('kb-ouvert',kb>60||kbNatH>0||serre||part||kbAnd);"));
});

test('Dans une note, « Enregistrer » se colle au-dessus du clavier (kb-ouvert) et ne retire pas le clavier sous le doigt', () => {
  assert.ok(ludique.includes('html.lq.kb-ouvert body:not(.kbar-on) #note-body .ne-act{position:sticky;bottom:0;z-index:3;'));
  const ouvrir = entre(app, 'function openNote(id,pre){', '\n}\n');
  assert.ok(ouvrir.includes("if(typeof appAndroid==='function'&&appAndroid()){\n    const nb=document.getElementById('note-body'),prim=nb&&nb.querySelector('.ne-act .prim');\n    if(prim)prim.addEventListener('mousedown',ev=>{const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)&&nb.contains(a))ev.preventDefault();});\n  }"));
  assert.ok(ouvrir.indexOf("prim.addEventListener('mousedown'") < ouvrir.indexOf('if(!n)setTimeout(()=>ta.focus(),260);'));
});

/* ---------- Le bilan : « Recommencer » entier ---------- */
const ajusterTuiles = entre(app, 'function bravoTuilesAjuster(){', '\n}\n');

function tuiles(largeurs, place, {android = true, etroit = false} = {}) {
  const st = {};
  const g = {style: {setProperty: (k, v) => { st[k] = v; }, removeProperty: k => { delete st[k]; }}};
  const taille = () => parseFloat(st['--bt-taille'] || (etroit ? 12.5 : 13));
  const bts = largeurs.map(l => ({get clientWidth() { return Math.min(place, Math.round(l * taille() / 13)); }, get scrollWidth() { return Math.round(l * taille() / 13); }}));
  g.querySelectorAll = () => bts;
  const ctx = {document: {querySelector: () => g}, appAndroid: () => android, matchMedia: () => ({matches: etroit})};
  vm.createContext(ctx);
  vm.runInContext(ajusterTuiles + '\nthis.f=bravoTuilesAjuster;', ctx);
  ctx.f();
  return st['--bt-taille'];
}

test('Android : les noms des tuiles rapetissent ensemble jusqu’à ce que le plus long mot tienne, sans se couper', () => {
  assert.equal(tuiles([86, 92, 92], 97), undefined, 'tout tient : rien ne change');
  assert.equal(tuiles([86, 92, 106], 97), '11.5px', '« Recommencer » agrandi par le téléphone : 13 px → 11,5 px');
  assert.equal(tuiles([200, 200, 200], 97), '10.5px', 'jamais sous 10,5 px');
  assert.equal(tuiles([86, 92, 106], 97, {android: false}), undefined, 'l’iPhone ne change pas');
  assert.equal(tuiles([83, 88, 95], 89, {etroit: true}), '12px', 'petit écran : de 12,5 px');
  const r = entre(ludique, 'html.lq.is-android #scr-lesson .bravo-wrap .bravo-suite .bravo-tool .bt{', '}');
  assert.ok(r.includes('overflow-wrap:normal;word-break:normal;hyphens:manual;font-size:var(--bt-taille,13px)!important'));
  assert.ok(ludique.includes('@media (max-width:360px){html.lq.is-android #scr-lesson .bravo-wrap .bravo-suite .bravo-tool .bt{font-size:var(--bt-taille,12.5px)!important}}'));
  assert.ok(app.includes('if(lessonStep===3){ bravoTuilesAjuster(); requestAnimationFrame(bravoTuilesAjuster);'));
});
