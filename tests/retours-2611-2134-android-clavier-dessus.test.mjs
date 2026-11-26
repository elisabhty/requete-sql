/* Elisa, 26 novembre, 21 h 34, sur son Samsung (après « Il y a encore le saut quand on commence à mettre la sélection sur la note,
   quand on écrit sur le cadre fait pour ça, ça saute, ça saute, ça saute. J’en peux plus. Pour les nouvelles notes en tout cas. ») :
   « ça flash encore ». Android seulement (« sur iPhone c’est ok, quand je te parle d’une correction là c’est que Android »).
   Le clavier passe maintenant par-dessus la vue (ClavierPlugin), comme sur l’iPhone depuis le 13 novembre : la WebView garde sa
   taille, l’appli se cale sur le clavier et suit son mouvement. Et l’iPhone retrouve ses deux réglages du clavier, perdus le
   24 novembre (appAndroid appelée avant d’exister). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html');
const ludique = lire('ludique.css');
const vitrine = lire('onboarding-vitrine.css');
const plugin = lire('android/app/src/main/java/fr/requete/app/ClavierPlugin.java');
const activite = lire('android/app/src/main/java/fr/requete/app/MainActivity.java');
const mesure = lire('tools/android/clavier.mjs');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j + b.length); };

/* ---------- Le début de la page : la plateforme, le mode du clavier ---------- */
const TETE = entre(app, "(function(){\n  var C=window.Capacitor;\n  if(!C||!C.isNativePlatform||!C.isNativePlatform())return;", '\n})();\n</script>').slice(0, -'\n</script>'.length);
function demarrer(plateforme, module) {
  const appels = [], cls = new Set();
  const P = {Keyboard: {setScroll: o => { appels.push('setScroll ' + JSON.stringify(o)); return Promise.resolve(); },
    setResizeMode: o => { appels.push('setResizeMode ' + JSON.stringify(o)); return Promise.resolve(); }}, StatusBar: {setStyle: () => Promise.resolve()}};
  if (module) P.RequeteClavier = {regler: o => { appels.push('regler ' + JSON.stringify(o)); return Promise.resolve({}); }};
  const win = {addEventListener() {}, Capacitor: {isNativePlatform: () => true, getPlatform: () => plateforme, Plugins: P,
    isPluginAvailable: n => Object.prototype.hasOwnProperty.call(P, n)}};
  const ctx = vm.createContext({window: win, navigator: {userAgent: ''}, setTimeout, console,
    document: {documentElement: {classList: {add: (...c) => c.forEach(x => cls.add(x))}}, querySelector: () => null, addEventListener() {}}});
  vm.runInContext(TETE, ctx);   // appAndroid n’existe pas encore à cet endroit de la page : rien ne doit l’appeler
  return {appels, cls};
}
test('iPhone : les deux réglages du clavier reviennent (la vue garde sa taille, elle ne défile pas)', () => {
  const {appels, cls} = demarrer('ios', false);
  assert.deepEqual(appels, ['setScroll {"isDisabled":true}', 'setResizeMode {"mode":"none"}']);
  assert.equal(cls.has('clavier-dessus'), false);
  assert.ok(!/var kb(Scroll|Mode)=!appAndroid\(\)/.test(TETE), 'la plateforme est lue sur place (appAndroid ne sert plus qu’après le démarrage : barresSombres)');
  assert.ok(TETE.includes("var android=(C.getPlatform?C.getPlatform():'')==='android';"));
});
test('Android : le clavier par-dessus la vue quand l’appli a le module, rien sinon', () => {
  const avec = demarrer('android', true);
  assert.deepEqual(avec.appels, ['regler {"dessus":true}'], 'la page le demande au module ; aucun réglage de l’iPhone');
  assert.ok(avec.cls.has('clavier-dessus') && avec.cls.has('is-android'));
  const sans = demarrer('android', false);
  assert.deepEqual(sans.appels, [], 'appli plus ancienne : rien ne change');
  assert.equal(sans.cls.has('clavier-dessus'), false);
  assert.ok(TETE.includes('var CLAVIER_DESSUS=true;'), 'le retour en arrière par une simple mise à jour de la page');
});

/* ---------- Les deux repères ---------- */
const REPERES = entre(app, 'function clavierDessus(){', 'function androidVueRetrecit(){return appAndroid()&&!clavierDessus();}');
function reperes(android, dessus) {
  return vm.runInNewContext(REPERES + ';({d:clavierDessus(),r:androidVueRetrecit()})', {appAndroid: () => android,
    document: {documentElement: {classList: {contains: c => c === 'clavier-dessus' && dessus}}}});
}
test('clavierDessus et androidVueRetrecit', () => {
  assert.deepEqual({...reperes(true, true)}, {d: true, r: false});
  assert.deepEqual({...reperes(true, false)}, {d: false, r: true}, 'appli plus ancienne : la vue rétrécit');
  assert.deepEqual({...reperes(false, false)}, {d: false, r: false}, 'iPhone');
  assert.ok(app.indexOf('function clavierDessus(){') > app.indexOf('function appAndroid(){'));
});

/* ---------- La hauteur du clavier ---------- */
const HAUTEUR = app.slice(app.indexOf('function kbHauteurNative(e)'), app.indexOf('\n', app.indexOf('function kbHauteurNative(e)')));
test('la hauteur du clavier comptée sur Android quand il passe par-dessus la vue', () => {
  const h = (android, retrecit) => vm.runInNewContext(HAUTEUR + ';kbHauteurNative({keyboardHeight:331.4})', {appAndroid: () => android, androidVueRetrecit: () => retrecit, Math});
  assert.equal(h(true, false), 331, 'par-dessus la vue : comme sur l’iPhone');
  assert.equal(h(true, true), 0, 'la vue rétrécit : déjà retirée par la vue');
  assert.equal(h(false, false), 331, 'iPhone');
  assert.equal(vm.runInNewContext(HAUTEUR + ';kbHauteurNative({keyboardHeight:300})', {appAndroid: () => true, Math}), 0, 'sans le repère : comme avant');
});
test('kb-ouvert, --kb, --app-h : Android par-dessus la vue suit le chemin de l’iPhone', () => {
  assert.ok(app.includes("const kbAndroid=typeof androidVueRetrecit==='function'?androidVueRetrecit():(typeof appAndroid==='function'&&appAndroid());"));
});

/* ---------- L’onboarding ---------- */
const BLOC = entre(app, "if(typeof window!=='undefined'&&typeof document!=='undefined'){\n  let obTailleH=-1,obClavierT=[];", '/* Même capture : dans la bulle').slice(0, -'/* Même capture : dans la bulle'.length);
function vue({retrecit}) {
  const ecoute = {}, cls = new Set(['on']), M = {h: 914, w: 411};
  const ob = {classList: {add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c)}};
  const champ = {tagName: 'INPUT', type: 'text'}, body = {contains: e => e === champ}, minuteurs = [];
  const doc = {activeElement: null, readyState: 'complete', getElementById: id => (id === 'onboarding' ? ob : id === 'ob-body' ? body : null),
    addEventListener: (n, f) => { (ecoute['d:' + n] ||= []).push(f); }};
  const win = {addEventListener: (n, f) => { (ecoute['w:' + n] ||= []).push(f); }, get innerHeight() { return M.h; }, get innerWidth() { return M.w; }};
  vm.runInContext(BLOC, vm.createContext({window: win, document: doc, obFit() {}, KB_ANIM_MS: 260, kbEnMouvement: () => false, obHPleine: 0, obHPleineL: 0,
    appAndroid: () => true, androidVueRetrecit: () => retrecit, matchMedia: () => ({matches: true}),
    setTimeout: f => { minuteurs.push(f); return minuteurs.length; }, clearTimeout() {}, obLock: false}));
  const tirer = (cle, e = {}) => (ecoute[cle] || []).forEach(f => f(e));
  return {cls, tirer, minuteurs, M,
    toucher: () => { doc.activeElement = champ; tirer('d:focusin', {target: champ}); },
    lacher: () => { doc.activeElement = null; tirer('d:focusout', {target: champ}); }};
}
test('onboarding, Android, clavier par-dessus la vue : ob-clavier au toucher du champ, comme sur l’iPhone', () => {
  const v = vue({retrecit: false});
  v.toucher();
  assert.equal(v.cls.has('ob-clavier'), true, 'la vue ne rétrécira pas : la page se resserre tout de suite');
  v.lacher(); v.minuteurs.splice(0).forEach(f => f());
  assert.equal(v.cls.has('ob-clavier'), false, 'le champ quitté : la classe part (60 ms après)');
  v.toucher(); v.tirer('w:keyboardWillHide'); v.minuteurs.splice(0).forEach(f => f());
  assert.equal(v.cls.has('ob-clavier'), false, 'le clavier qui part : aussi');
  /* Une vue qui ne bouge pas ne retire rien */
  v.toucher(); v.tirer('w:resize'); v.tirer('w:keyboardWillShow');
  assert.equal(v.cls.has('ob-clavier'), true);
});
test('onboarding, Android sans le module : inchangé (ob-clavier suit la vue)', () => {
  const v = vue({retrecit: true});
  v.toucher();
  assert.equal(v.cls.has('ob-clavier'), false);
  v.M.h = 531; v.tirer('w:resize');
  assert.equal(v.cls.has('ob-clavier'), true);
  assert.ok(app.includes("document.addEventListener('scroll',e=>{const t=e.target;if(!t||!t.classList||!t.classList.contains('ob-slides')||!obAndroid())return;"),
    'le fondu du haut d’une page qui défile reste à tout Android');
});
test('onboarding : « Continuer » le clavier encore là, la page suivante attend que l’appli ait repris sa hauteur', () => {
  const g = entre(app, '  const vueClavier=!clavier&&', '\n  const figer=clavier||vueClavier;');
  assert.ok(g.includes("(typeof clavierDessus==='function'&&clavierDessus()&&((typeof kbNatH!=='undefined'&&kbNatH>0)||(typeof kbEnMouvement==='function'&&kbEnMouvement())))"));
  assert.ok(app.includes('if(root&&obHPleine>0&&root.clientHeight<obHPleine-60&&Date.now()-t0<OB_CLAVIER_MS){setTimeout(attendre,30);return;}'));
});
test('onboarding et appli : les glissements de l’iPhone rendus à Android quand le clavier passe par-dessus la vue', () => {
  assert.ok(vitrine.includes('html.is-android:not(.clavier-dessus) #app{transition:none!important}'));
  assert.ok(vitrine.includes('html.is-android:not(.clavier-dessus) #onboarding.ob-vitrine :is(.ob-name,.ob-pseudo)>:is(.ob-lead,.ob-title,.ob-chat){transition:none!important}'));
  assert.ok(!/html\.is-android #app\{transition:none/.test(vitrine));
  assert.ok(ludique.includes('html.is-android.clavier-dessus:not([data-motion="reduce"]) #app{transition:height .285s cubic-bezier(.2,0,0,1),min-height .285s cubic-bezier(.2,0,0,1)}'),
    'le mouvement du clavier d’Android : 0,285 s, sa courbe');
  assert.ok(ludique.includes('html.is-native.kb-ouvert #app{height:var(--app-h,100dvh);min-height:var(--app-h,100dvh)}'));
});

/* ---------- La note ---------- */
const ouvrirNote = entre(app, 'function openNote(id,pre){', '\n}\n');
const CORPS = entre(ouvrirNote, '  const neBas=()=>{', 'if(neCorps&&neCorps.scrollTop!==defile)neCorps.scrollTop=defile;\n  };');
function cadre({dessus = true, appBas = 914, kb = 331, contenu = 400} = {}) {
  const style = {};
  const corps = {scrollTop: 0, getBoundingClientRect: () => ({bottom: appBas - 4}), querySelector: () => ({offsetHeight: 78})};
  const ta = {style, getBoundingClientRect: () => ({top: 234}), get scrollHeight() { return contenu; }};
  vm.runInNewContext(CORPS + '\n  grow();', {ta, neCorps: corps, neAndroid: true, Math, window: {innerHeight: 914},
    clavierDessus: () => dessus, kbNatif: () => kb,
    document: {documentElement: {classList: {contains: c => c === 'kb-ouvert'}}, getElementById: id => (id === 'app' ? {getBoundingClientRect: () => ({bottom: appBas})} : null)}});
  return style;
}
test('note, clavier par-dessus la vue : le cadre se règle dès l’annonce du clavier, sur la place qu’aura la note', () => {
  // L’appli encore à sa hauteur (914) : la note finira 331 px plus haut. 910 − 331 − 78 − 12 − 234 = 255
  assert.equal(cadre({appBas: 914}).height, '255px');
  // L’appli déjà calée (914 − 331 = 583) : la même hauteur, rien ne bouge à la fin du mouvement
  assert.equal(cadre({appBas: 583}).height, '255px');
  // Le clavier qui part (kbNatif 0) : la place entière, même si l’appli est encore calée
  assert.equal(cadre({appBas: 583, kb: 0}).height, '320px');
  // La vue qui rétrécit (appli plus ancienne) : comme avant, le bas de la note tel qu’il est
  assert.equal(cadre({dessus: false, appBas: 583}).height, '255px');
  assert.equal(cadre({dessus: false, appBas: 914}).height, '320px');
});
const REGLER = entre(app, "(function(){\n  if(typeof window==='undefined'||typeof document==='undefined'||typeof appAndroid!=='function'||!appAndroid()||typeof clavierDessus!=='function'||!clavierDessus())return;", '\n})();');
test('note, clavier par-dessus la vue : le cadre se règle dans l’image qui suit l’annonce du clavier, et à la fin de son mouvement', () => {
  const ecoute = {}, minuteurs = [], images = [];
  let n = 0;
  const lancer = dessus => vm.runInNewContext(REGLER, {window: {addEventListener: (e, f) => { (ecoute[e] ||= []).push(f); }}, document: {getElementById: () => ({_cadre: () => n++})},
    appAndroid: () => true, clavierDessus: () => dessus, KB_ANIM_MS: 260, setTimeout: (f, t) => { minuteurs.push([f, t]); return minuteurs.length; }, clearTimeout() {},
    requestAnimationFrame: f => { images.push(f); return images.length; }});
  lancer(false);
  assert.deepEqual(Object.keys(ecoute), [], 'la vue qui rétrécit : rien (la note suit la vue, plus bas)');
  lancer(true);
  ecoute.keyboardWillShow.forEach(f => f());
  assert.equal(n, 0, 'rien de mesuré au moment même où le clavier s’annonce');
  assert.equal(images.length, 1); assert.equal(minuteurs[0][1], 320);
  ecoute.keyboardDidShow.forEach(f => f());
  assert.equal(images.length, 1, 'une seule mesure par image');
  images.shift()(); assert.equal(n, 1);
  minuteurs[0][0](); assert.equal(n, 2, 'et une fois le mouvement fini');
  ecoute.keyboardWillHide.forEach(f => f()); images.shift()(); assert.equal(n, 3);
});
test('note : « Enregistrer » ne glisse plus de lui-même quand le clavier passe par-dessus la vue (il monte avec la feuille)', () => {
  const glisse = entre(app, "  let place=null,vueH=window.innerHeight,vueL=window.innerWidth;", 'const avant=place,apres=mesure(b);');
  assert.ok(app.includes("  if(typeof clavierDessus==='function'&&clavierDessus())return;\n  let place=null,vueH=window.innerHeight,vueL=window.innerWidth;"));
  assert.ok(glisse.includes('cadre._cadre()'));
  assert.ok(ludique.includes('html.lq.is-android body:not(.kbar-on) #note-body .ne-act{position:sticky;bottom:0;'), 'toujours collé en bas de la note');
});

/* ---------- Le module natif ---------- */
test('ClavierPlugin : la WebView garde sa taille, ne voit plus le clavier ; la page le demande', () => {
  assert.ok(plugin.includes('@CapacitorPlugin(name = "RequeteClavier")'));
  assert.ok(plugin.includes('private volatile boolean dessus = false;'), 'sans demande de la page : SystemBars tel quel');
  assert.ok(plugin.includes('@PluginMethod\n    public void regler(final PluginCall call) {'));
  assert.ok(plugin.includes('ViewCompat.setOnApplyWindowInsetsListener(fenetre, this::appliquer);'));
  assert.ok(plugin.includes('b.setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE);') && plugin.includes('b.setVisible(WindowInsetsCompat.Type.ime(), false);'));
  // Par-dessus : jamais la place du clavier sous la vue ; les barres comptées comme SystemBars
  const dessus = entre(plugin, '        if (dessus) {', '        } else if (recente) {');
  assert.ok(dessus.includes('v.setPadding(0, 0, 0, 0);') && dessus.includes('v.setPadding(barres.left, barres.top, barres.right, 0);'));
  assert.ok(!dessus.includes('clavier.bottom'));
  assert.ok(dessus.includes('bas = barres.bottom;'), 'la barre du bas comptée dans --safe-area-inset-bottom, clavier ou pas (comme l’iPhone)');
  // Sinon : SystemBars à l’identique
  assert.ok(plugin.includes('v.setPadding(0, 0, 0, clavierLa ? clavier.bottom : 0);'));
  assert.ok(plugin.includes('v.setPadding(barres.left, barres.top, barres.right, clavierLa ? clavier.bottom : barres.bottom);'));
  assert.ok(plugin.includes("s.setProperty('--safe-area-inset-bottom','%dpx')"));
  assert.ok(plugin.includes('WebView.getCurrentWebViewPackage()') && !plugin.includes('androidx.webkit'), 'rien qui manque au module de l’appli');
});
test('MainActivity : le module inscrit avant le démarrage du pont, à partir d’Android 11', () => {
  assert.ok(activite.includes('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) registerPlugin(ClavierPlugin.class);\n        super.onCreate(savedInstanceState);'));
  assert.ok(activite.includes('vue.getSettings().setTextZoom(100);'), 'le texte à sa taille, comme avant');
});
test('la mesure sur émulateur sait attendre un clavier qui ne fait plus rétrécir la vue', () => {
  assert.ok(mesure.includes('async function attendreClavier(la, base, ms) {') && !mesure.includes('attendreVue('));
  assert.ok(mesure.includes("kn: typeof kbNatH !== 'undefined' ? kbNatH : -1"));
});
