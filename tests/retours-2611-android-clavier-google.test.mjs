/* Elisa, 26 novembre, sur son Samsung (appli Google Play, version 33 à venir) ; « sur iPhone c’est ok, quand je te parle d’une
   correction là c’est que Android » : tout ce qui suit est pour Android seulement.
   - 11 h 40 : « Il y a aussi quelques sauts avec le clavier avant la partie « Tu vis où ? ». Et il y a le monde, l’emoji monde qui bug. »
   - 11 h 56 : « Pour la partie notification, le ne pas autoriser, il est à la limite du débordement du texte. » ; « On peut pas se
     connecter avec Google ? » ; « quand on passe d’un plan à un autre sur la page abonnement, il faut pas que ça saute. Tu vois,
     c’est comme si ça baissait quand on clique sur s’abonner à 5,99. » */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
const connexion = readFileSync(new URL('../connexion.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const cssDepuis = css.slice(css.indexOf('/* ---------- 26 novembre, 11 h 40 à 11 h 56'));

/* ---------- La connexion Google ---------- */
function connecter(plateforme) {
  const SL = {init: null, logins: [],
    initialize(o) { this.init = o; return Promise.resolve(); },
    login(o) { this.logins.push(o); return Promise.resolve({provider: o.provider, result: {idToken: 'jeton-google', profile: {givenName: 'Elisa'}}}); },
    logout() { return Promise.resolve(); }};
  const store = new Map();
  const ctx = {
    Capacitor: {isNativePlatform: () => true, getPlatform: () => plateforme, Plugins: {SocialLogin: SL}},
    localStorage: {getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
    fetch: () => Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({access_token: 'a', refresh_token: 'r', expires_in: 3600, user: {id: 'u', email: 'e@exemple.fr', user_metadata: {}}})}),
    crypto: webcrypto, TextEncoder, Uint8Array, Promise, JSON, Math, Date, Number, String, Array, Error,
    CustomEvent: class { constructor(t) { this.type = t; } }, dispatchEvent() {},
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_test'
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(connexion, ctx);
  return {A: ctx.REQUETE_AUTH, SL};
}

test('Google sur Android : pas de liste de scopes (le plugin la refuse sur une activité non modifiée), étape d’autorisation sautée', async () => {
  const {A, SL} = connecter('android');
  assert.deepEqual([...A.fournisseurs], ['google']);
  const r = await A.signIn('google');
  assert.equal(r.prenom, 'Elisa');
  assert.deepEqual(JSON.parse(JSON.stringify(SL.init.google)), {webClientId: '473682844926-k354pnsj3g2i3goj23ifmeetgpe93vf7.apps.googleusercontent.com', mode: 'online', skipAuthOnlyAuthorizationAfterSignIn: true});
  assert.equal(SL.init.apple, undefined);
  assert.equal(SL.logins.length, 1);
  assert.equal(SL.logins[0].provider, 'google');
  assert.equal(SL.logins[0].options.scopes, undefined, 'aucune liste : « You CANNOT use scopes without modifying the main activity »');
  assert.ok(!/MainActivity extends BridgeActivity implements/.test(readFileSync(new URL('../android/app/src/main/java/fr/requete/app/MainActivity.java', import.meta.url), 'utf8')), 'l’activité reste celle de Capacitor');
});

test('Google sur l’iPhone : inchangé (scopes e-mail et profil, client iOS, pas d’étape sautée)', async () => {
  const {A, SL} = connecter('ios');
  assert.deepEqual([...A.fournisseurs], ['apple', 'google']);
  await A.signIn('google');
  assert.deepEqual([...SL.logins[0].options.scopes], ['email', 'profile']);
  assert.equal(SL.init.google.skipAuthOnlyAuthorizationAfterSignIn, undefined);
  assert.equal(SL.init.google.iOSServerClientId, '473682844926-k354pnsj3g2i3goj23ifmeetgpe93vf7.apps.googleusercontent.com');
  assert.ok(app.includes('<script src="connexion.js?v=5"></script>'));
});

/* ---------- Le clavier du prénom ---------- */
const BLOC = cut("if(typeof window!=='undefined'&&typeof document!=='undefined'){\n  let obTailleH=-1,obClavierT=[];", '/* Même capture : dans la bulle');

function vue({android = true, h = 914} = {}) {
  const ecoute = {}, cls = new Set(['on']), M = {h, w: 411, lock: false};
  const ob = {classList: {add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c)}};
  const body = {contains: e => e === champ};
  const champ = {tagName: 'INPUT', type: 'text'};
  const doc = {activeElement: null, readyState: 'complete', getElementById: id => (id === 'onboarding' ? ob : id === 'ob-body' ? body : null),
    addEventListener: (n, f) => { (ecoute['d:' + n] ||= []).push(f); }};
  const win = {addEventListener: (n, f) => { (ecoute['w:' + n] ||= []).push(f); }, get innerHeight() { return M.h; }, get innerWidth() { return M.w; }};
  const ctx = vm.createContext({window: win, document: doc, obFit() {}, KB_ANIM_MS: 260, kbEnMouvement: () => false, obHPleine: 0, obHPleineL: 0,
    appAndroid: () => android, matchMedia: () => ({matches: true}), setTimeout: (f) => { f(); return 1; }, clearTimeout() {},
    get obLock() { return M.lock; }});
  vm.runInContext(BLOC, ctx);
  const tirer = (cle, e = {}) => (ecoute[cle] || []).forEach(f => f(e));
  return {cls, M, doc, champ, tirer,
    toucher: () => { doc.activeElement = champ; tirer('d:focusin', {target: champ}); },
    lacher: () => { doc.activeElement = null; tirer('d:focusout', {target: champ}); },
    clavier: (haut) => { M.h = haut; tirer('w:resize'); }};
}

test('Android : ob-clavier ne se pose pas au toucher du champ, mais dans l’image où la vue rétrécit, et part quand elle reprend sa hauteur', () => {
  const v = vue();
  v.toucher();
  assert.equal(v.cls.has('ob-clavier'), false, 'au toucher, rien ne bouge encore (avant : le bouton jaune descendait de 58 px)');
  v.clavier(531);
  assert.equal(v.cls.has('ob-clavier'), true, 'la vue a rétréci : la page se resserre dans la même image');
  v.tirer('w:keyboardWillShow'); v.tirer('w:keyboardDidShow');
  assert.equal(v.cls.has('ob-clavier'), true);
  /* Le champ perd la main (le bouton « Continuer » touché) : la classe reste tant que la vue est rétrécie */
  v.lacher(); v.tirer('w:keyboardWillHide');
  assert.equal(v.cls.has('ob-clavier'), true, 'ni focusout ni keyboardWillHide ne la retirent sur Android');
  v.clavier(914);
  assert.equal(v.cls.has('ob-clavier'), false, 'la vue a repris sa hauteur : la page aussi, dans la même image');
  /* Une vue qui rétrécit sans champ touché (fenêtre partagée…) ne pose rien */
  v.clavier(600); assert.equal(v.cls.has('ob-clavier'), false);
});

test('Android : pendant un changement de page, la classe reste (la page qui part reste figée, obGoto la retire en peignant la suivante)', () => {
  const v = vue();
  v.toucher(); v.clavier(531); v.lacher();
  v.M.lock = true; v.clavier(914);
  assert.equal(v.cls.has('ob-clavier'), true);
  v.M.lock = false; v.tirer('w:resize');
  assert.equal(v.cls.has('ob-clavier'), false);
});

test('iPhone : inchangé, ob-clavier au toucher du champ, retiré au départ du champ ou du clavier', () => {
  const v = vue({android: false});
  v.toucher(); assert.equal(v.cls.has('ob-clavier'), true);
  v.lacher(); assert.equal(v.cls.has('ob-clavier'), false);
  v.toucher(); v.tirer('w:keyboardWillHide'); assert.equal(v.cls.has('ob-clavier'), false);
  v.toucher(); v.clavier(500); v.clavier(914); assert.equal(v.cls.has('ob-clavier'), true, 'la taille de la vue ne décide de rien sur l’iPhone');
});

/* Le passage à « Tu vis où ? » : même mécanique que le 12 novembre (retours-2153), avec un champ qui a déjà perdu la main */
const SRC = cut('const OB_SORTIE_MS=110;', '/* 4 novembre, 2 h 13 : « quand on clique sur Voir mon parcours');
function passage({android = true, clavierOuvert = true} = {}) {
  const timers = [], journal = [], cls = new Set(['on']), M = {t: 0, hauteur: 531};
  if (clavierOuvert) cls.add('ob-clavier');
  const bouton = {tagName: 'BUTTON', blur: () => journal.push('blur')};
  const body = {offsetHeight: 430, style: {}, classList: {add: c => journal.push('classe ' + c)}, contains: () => false};
  const root = {dataset: {}, classList: {remove: c => { cls.delete(c); }, contains: c => cls.has(c)}, get clientHeight() { return M.hauteur; }};
  const ctx = vm.createContext({obLock: false, OB_SLIDES: ['name', 'pays'], OB_STEPS: 2, obStep: 0, obPseudoAvant: () => false, prefersReduceMotion: () => false,
    appAndroid: () => android,
    paintOb: () => journal.push(`peint à ${M.hauteur}, hauteur figée [${body.style.height || ''}], clavier ${cls.has('ob-clavier')}`),
    document: {activeElement: bouton, getElementById: id => (id === 'ob-body' ? body : root)},
    setTimeout: (f, d) => { timers.push({f, d}); return timers.length; }, Date: {now: () => M.t}});
  vm.runInContext(SRC + ';obHPleine=914;', ctx);
  const tour = () => { const x = timers.shift(); M.t += x.d; x.f(); };
  return {ctx, journal, body, M, tour, timers};
}

test('Android : « Continuer » touché, le champ a déjà perdu la main ; la vue encore rétrécie, la page suivante attend sa hauteur', () => {
  const p = passage();
  p.ctx.obGoto('pays');
  assert.deepEqual(p.journal, ['classe out'], 'la page d’avant reste figée (pas de blur : le champ l’a déjà perdue)');
  assert.equal(p.body.style.height, '430px');
  p.tour(); assert.equal(p.journal.length, 1, 'à la fin du fondu, la vue est encore rétrécie : on attend');
  p.M.hauteur = 914; p.tour();
  assert.deepEqual(p.journal.slice(1), ['peint à 914, hauteur figée [], clavier false'], '« Tu vis où ? » peinte une fois, à sa taille (avant : à 0,8 puis d’un bond à 1,046)');
  /* Sans clavier (toutes les autres pages), ou sur l’iPhone : tout de suite, comme avant */
  const sans = passage({clavierOuvert: false}); sans.ctx.obGoto('pays');
  assert.deepEqual(sans.journal, ['peint à 531, hauteur figée [], clavier false']); assert.equal(sans.timers.length, 0);
  const ios = passage({android: false}); ios.ctx.obGoto('pays');
  assert.equal(ios.journal.length, 1); assert.match(ios.journal[0], /^peint/);
});

test('CSS Android : la page et l’appli changent d’un seul coup avec la vue ; l’iPhone garde ses glissements', () => {
  /* 26 novembre, 21 h 34 : seulement quand la vue rétrécit (sans ClavierPlugin) ; le clavier par-dessus la vue suit l’iPhone */
  assert.ok(cssDepuis.includes('html.is-android:not(.clavier-dessus) #app{transition:none!important}'));
  assert.ok(cssDepuis.includes('html.is-android:not(.clavier-dessus) #onboarding.ob-vitrine :is(.ob-name,.ob-pseudo)>:is(.ob-lead,.ob-title,.ob-chat){transition:none!important}'));
  const lud = readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
  assert.ok(lud.includes('html.is-native:not([data-motion="reduce"]) #app{transition:height .26s cubic-bezier(.38,.7,.125,1),min-height .26s cubic-bezier(.38,.7,.125,1)}'), 'l’iPhone suit toujours son clavier');
  assert.ok(css.includes('html:not([data-motion="reduce"]) #onboarding.ob-vitrine :is(.ob-name,.ob-pseudo)>.ob-lead{max-height:9em;overflow:hidden;transition:max-height .26s'));
});

/* ---------- Le globe ---------- */
test('le globe d’Android ne clignote plus : chaque emoji reste entier jusqu’à ce que le suivant soit là', () => {
  const k = /@keyframes obvPaysGlobeA\{0%,(\d+(?:\.\d+)?)%\{opacity:1\}(\d+(?:\.\d+)?)%,100%\{opacity:0\}\}/.exec(css);
  assert.ok(k, 'les images-clés d’Android');
  const [plein, vide] = [+k[1], +k[2]];
  assert.ok(plein > 100 / 3, `visible au-delà du tiers (${plein} %) : pas d’image sans globe`);
  assert.ok(vide - plein <= 0.05, 'aucune image à demi effacée');
  assert.ok(cssDepuis.includes('html.is-android:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-pays-carte.is-cherche .ob-pays-globe i{animation-name:obvPaysGlobeA}'));
  /* les trois globes se relaient par tiers de 0,9 s, dans cet ordre (Europe, Amériques, Asie) ; l’iPhone garde les siens */
  assert.ok(app.includes('<span class="ob-pays-globe"><i style="--k:0">🌍</i><i style="--k:2">🌎</i><i style="--k:1">🌏</i></span>'));
  assert.ok(css.includes('.ob-pays-carte.is-cherche .ob-pays-globe i{animation:obvPaysGlobe .9s linear calc(var(--k) * -.3s) infinite}'));
  assert.ok(css.includes('@keyframes obvPaysGlobe{0%,32%{opacity:1}33%,100%{opacity:0}}'));
  /* à tout instant, au moins un globe entier (pas de 0,1 s) */
  const visible = (t, k) => { const p = (((t + k * 0.3) % 0.9) + 0.9) % 0.9 / 0.9 * 100; return p <= plein; };
  for (let t = 0; t < 1.8; t += 0.0005) assert.ok([0, 1, 2].some(k => visible(t, k)), `un globe à ${t.toFixed(4)} s`);
});

/* ---------- Le rappel ---------- */
test('le rappel d’Android : la fenêtre en aperçu plus large, « Ne pas autoriser » ne touche plus ses bords', () => {
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine .ob-rappel-step .ob-notif{width:min(304px,100%)}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine.ob-fit-3 .ob-rappel-step .ob-notif{width:min(284px,100%)}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine .ob-rappel-step .ob-notif-btns button{white-space:normal;text-wrap:balance}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-rappel-step .ob-notif{width:min(266px,100%)}'), 'l’iPhone garde sa largeur');
  assert.ok(app.includes('<b aria-hidden="true">Autoriser Requête à vous envoyer des notifications&nbsp;?</b>'));
});

/* ---------- L’abonnement ---------- */
const OFFRES = cut('const OB_OFFRES=', '\nfunction obFinSuivante(');
const FIN = cut('function obCompteVisible(){', '/* ---------- Le paywall');
function paywall(android) {
  const pied = [];
  const achat = {acheter: async () => false, prixEtat: () => 'oui', essaiConnu: () => true,
    prix: k => (k === 'an' ? {prix: 44.99, devise: 'EUR', texte: '44,99 €'} : {prix: 5.99, devise: 'EUR', texte: '5,99 €'}), essai: k => (k === 'an' ? {n: 3, unite: 'jour'} : null)};
  const ctx = vm.createContext({natifTexte: x => x, appAndroid: () => android, window: {REQUETE_ACHAT: achat}, draft: {name: 'Elisa', offre: 'an', finVoulue: 'home'}, state: {}, TOTAL: 71,
    CHALLENGES: {length: 477}, OB_COMMUNAUTE: 1000, esc: s => String(s), escAttr: s => String(s), legalUrl: k => k, mascotReduced: () => false,
    obPlanInfo: () => ({goal: 'Progresser en SQL', endLabel: '3 décembre', minutes: 20}), obBackButton: () => '',
    obSetFooter: (...a) => pied.push(a), buzz() {}, stat() {}, finishOnboard() {}, obGoto() {}, obConnexionMasquee: () => false,
    requestAnimationFrame() {}, document: {querySelectorAll: () => [], querySelector: () => null, getElementById: () => null}});
  vm.runInContext(FIN + OFFRES, ctx);
  return {ctx, pied};
}
const nb = x => x.replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ');

test('l’abonnement d’Android : sous le bouton, les phrases des deux offres occupent la même place ; la carte touchée ne s’enfonce plus', () => {
  const a = paywall(true);
  a.ctx.obPaywallPied();
  let n = nb(a.pied.at(-1)[4].html);
  const duo = /<span class="pw-note-duo"><span>([\s\S]*?)<\/span><span class="is-ombre" aria-hidden="true">([\s\S]*)<\/span><\/span>$/.exec(n);
  assert.ok(duo, 'l’offre choisie, puis l’autre en ombre');
  assert.ok(duo[1].startsWith('<b class="pw-sans">3 jours d’essai, puis 44,99 € par an à partir du ') && duo[1].includes('Conditions'));
  assert.ok(duo[2].startsWith('<b class="pw-sans">5,99 € aujourd’hui, puis chaque semaine.</b>') && duo[2].includes('<a tabindex="-1" class="ob-legal-link"'), 'l’ombre : ses liens hors du parcours au clavier');
  a.ctx.obPaywallChoisir('semaine');
  n = nb(a.pied.at(-1)[4].html);
  assert.ok(/<span class="pw-note-duo"><span><b class="pw-sans">5,99 € aujourd’hui, puis chaque semaine\.<\/b>[\s\S]*<span class="is-ombre" aria-hidden="true"><b class="pw-sans">3 jours d’essai/.test(n), 'les deux échangées');
  /* L’iPhone : la phrase seule, comme avant */
  const i = paywall(false); i.ctx.obPaywallPied();
  const ni = nb(i.pied.at(-1)[4].html);
  assert.ok(!ni.includes('pw-note-duo') && ni.includes('<b class="pw-sans">3 jours d’essai, puis 44,99 € par an') && !ni.includes('5,99'));
  /* Le CSS : la plus haute des deux donne la hauteur ; la carte touchée garde sa place et son ombre */
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine.ob-paywall-step .pw-note-duo{display:grid}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine.ob-paywall-step .pw-note-duo>span{grid-area:1/1;min-width:0}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine.ob-paywall-step .pw-note-duo>.is-ombre{visibility:hidden}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine .pw-offre:active{transform:none;box-shadow:0 4px 0 var(--v-shadow-lip)}'));
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine .pw-offre.is-on:active{box-shadow:0 4px 0 var(--v-sun-lip),0 0 0 4px rgba(255,200,61,.32),0 12px 28px rgba(27,22,64,.22)}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .pw-offre:active{transform:translateY(3px);box-shadow:0 1px 0 var(--v-shadow-lip)}'), 'l’iPhone garde son enfoncement');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=84">'));
});

/* ---------- 12 h 35 : « les petites notifications comme ça qui partent […] il faut que tu descendes automatiquement, comme si tu
   scrollais toi, pour que la personne elle le voit, parce que ça part direct » ; « regarde les captures pour voir si tu vois quelque
   chose d’anormal » (ses captures du paywall et de l’offre de bienvenue, achats d’essai refusés, « Restaurer ») ---------- */
const MSG = cut('let pwMessageT=0;', 'async function obPaywallRestaurer(){');
function message({android = true} = {}) {
  const timers = [], defile = [];
  const cadre = {scrollTop: 0, getBoundingClientRect: () => ({top: 28, bottom: 702}),
    scrollTo({top}) { defile.push(top); this.scrollTop = top; }};
  const live = {textContent: '', isConnected: true, getBoundingClientRect: () => ({top: 684 - cadre.scrollTop, bottom: 741 - cadre.scrollTop})};
  const ctx = vm.createContext({appAndroid: () => android, prefersReduceMotion: () => false, requestAnimationFrame: f => f(),
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout() {},
    document: {getElementById: id => (id === 'pw-live' ? live : id === 'ob-body' ? {parentElement: cadre} : null)}});
  vm.runInContext(MSG, ctx);
  return {ctx, timers, defile, cadre, live};
}

test('Android : le message sous les offres fait descendre la page jusqu’à lui, au-dessus du bouton ; elle remonte avant qu’il parte', () => {
  const m = message();
  m.ctx.pwMessage('Aucun abonnement à restaurer sur ce compte Google.', 6000);
  assert.equal(m.live.textContent, 'Aucun abonnement à restaurer sur ce compte Google.');
  assert.deepEqual(m.defile, [51], 'juste assez pour le voir en entier, 12 px au-dessus du bord du bouton (741 + 12 − 702)');
  const [part, ms] = m.timers.at(-1); assert.equal(ms, 6000);
  part();
  assert.deepEqual(m.defile, [51, 0], 'au bout de 6 s, la page remonte d’abord');
  assert.equal(m.live.textContent, 'Aucun abonnement à restaurer sur ce compte Google.', 'le message est encore là pendant qu’elle remonte');
  m.timers.at(-1)[0]();
  assert.equal(m.live.textContent, '', 'puis il part : rien ne saute');
  /* Un échec de paiement : la page descend, le message reste jusqu’au prochain essai */
  const p = message();
  p.ctx.pwMessage('Le paiement n’a pas abouti. Tu n’as pas été débité·e, réessaie.');
  assert.deepEqual(p.defile, [51]); assert.equal(p.timers.length, 0);
  /* Un message déjà en vue : la page ne bouge pas */
  const v = message(); v.live.getBoundingClientRect = () => ({top: 600, bottom: 640});
  v.ctx.pwMessage('Aucun abonnement à restaurer sur ce compte Google.', 6000); assert.deepEqual(v.defile, []);
  v.timers.at(-1)[0](); assert.equal(v.live.textContent, '');
});

test('iPhone : le message, puis son effacement au bout de 6 s, comme avant ; la page ne défile pas', () => {
  const m = message({android: false});
  m.ctx.pwMessage('Aucun abonnement à restaurer sur ce compte Apple.', 6000);
  assert.deepEqual(m.defile, []);
  m.timers.at(-1)[0](); assert.equal(m.live.textContent, '');
  assert.ok(app.includes("const dire=t=>{if(live)pwMessage(t,6000);};"));
  assert.equal((app.match(/if\(live\)pwMessage\(pwEchecTexte\(e\)\)/g) || []).length, 2, 'le paywall et l’offre de bienvenue (28 novembre : le texte est dans pwEchecTexte)');
  assert.ok(app.includes('return `Le paiement n’a pas abouti. Tu n’as pas été '));
});

test('Android : la page défilée s’estompe à son bord haut ; un peu de place sous le message ; les garanties toujours bien rangées', () => {
  assert.ok(cssDepuis.includes('html.is-android #onboarding.ob-vitrine:not(.ob-compte-feuille) .ob-slides.is-defilee{-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 24px);mask-image:linear-gradient(to bottom,transparent 0,#000 24px)}'));
  assert.ok(app.includes("document.addEventListener('scroll',e=>{const t=e.target;if(!t||!t.classList||!t.classList.contains('ob-slides')||!obAndroid())return;\n    t.classList.toggle('is-defilee',t.scrollTop>2);},{capture:true,passive:true});"));
  assert.ok(cssDepuis.includes("html.is-android #onboarding.ob-vitrine .ob-screen.ob-paywall:has(>.ob-compte-msg:not(:empty))::after{content:'';display:block;flex:none;height:12px}"));
  /* L’offre de bienvenue range ses garanties comme le paywall ; et de nouveau dès que leur bloc change de taille, ou que la page se met à sa taille */
  const pied = cut('function obSortiePied(){', '\nfunction obSortieRefuser(){');
  assert.ok(pied.includes("if(typeof appAndroid==='function'&&appAndroid()&&typeof requestAnimationFrame==='function')requestAnimationFrame(pwConfianceLignes);"));
  assert.ok(app.includes("if(typeof ResizeObserver==='function'&&!c._lignes){c._lignes=new ResizeObserver(()=>{if(c.isConnected)pwConfianceLignes();});c._lignes.observe(c);}"));
  assert.ok(app.includes("obFitChips();obChampEnVue();if(typeof appAndroid==='function'&&appAndroid()&&typeof pwConfianceLignes==='function')pwConfianceLignes();"));
});
