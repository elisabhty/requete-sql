/* 4 novembre, 10 h 16 (Elisa) : « mettre la page de connexion (il faut pas qu’elle marche encore) ». La page « Garde ta
   progression » n’apparaissait qu’avec un fournisseur de connexion branché (window.REQUETE_AUTH), donc jamais. Elle termine
   maintenant toujours le tunnel, comptée dans « Étape X sur N », habillée comme les autres étapes. Sans fournisseur, Apple, Google
   et l’e-mail portent « Bientôt » : les toucher ne connecte à rien, ne crée aucun faux compte, et la page le dit (la mascotte,
   un lecteur d’écran, le bouton qui hoche la tête) ; « Continuer sans compte » reste le chemin. */
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
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const fournisseurs = cut('const OB_PROVIDERS=', '/* 10 h 16 : pas encore de connexion.');
const connexion = cut('/* 10 h 16 : pas encore de connexion.', '/* Elisa, 31 octobre, 8 h 37 (Réf 6)');
const page = cut("  }else if(slide==='account'){", "  }else if(slide==='name'){");
const obTypo = cut('function obTypo(s){', 'function obInsecables(el){');

/* Un faux élément, juste ce que touchent les fonctions */
const element = (texte = '') => {
  const classes = new Set();
  return { textContent: texte, offsetWidth: 1, _nudgeT: 0,
    classList: { add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c)), contains: c => classes.has(c) }, classes };
};

const rendre = ({ authReady = false, obAuthBusy = false, obAuthMessage = '' } = {}) => {
  const pied = [];
  const ctx = vm.createContext({ slide: 'account', authReady, obAuthBusy, obAuthMessage,
    obFlowHeader: s => `<header data-etape="${s}"></header>`, obMascotQuestion: t => `<div class="ob-chat"><div class="ob-bubble">${t}</div></div>`,
    esc: s => String(s), escAttr: s => String(s), legalUrl: k => `decouvrir/${k}.html`, obSetFooter: (...a) => pied.push(a), obChooseGuest() {} });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS='), ctx);
  vm.runInContext("var html='';if(slide==='x'){" + page + '}', ctx);
  return { html: ctx.html, pied, ctx };
};

test('la page de connexion termine toujours le tunnel, avec ou sans fournisseur branché', () => {
  const fin = cut('const OB_FIN_SLIDES=', '/* « Me rappeler de m’entraîner »');
  for (const pret of [false, true]) {
    const ctx = vm.createContext({ OB_PROFILE_SLIDES: ['name', 'practice'], obAuthReady: () => pret, window: {} });
    vm.runInContext(fin, ctx);
    assert.deepEqual([...ctx.obFinFlux()], ['practice', 'source', 'account'], pret ? 'fournisseur branché' : 'sans fournisseur');
    assert.deepEqual([...ctx.obFlowSteps()], ['name', 'practice', 'source', 'account'], 'comptée dans « Étape X sur N »');
    assert.equal(ctx.obFinSuivante('source'), 'account');
    assert.equal(ctx.obFinSuivante('account'), 'ready');
    assert.equal(ctx.obFinPrecedente('account'), 'source', '« Retour » ramène à l’étape d’avant');
  }
  assert.ok(!fin.includes('if(obAuthReady())f.push'), 'plus sautée sans fournisseur');
  /* « Continuer sans compte » (et le glissé vers la suite) : le mode local, puis la mini-page du pseudo et la dernière page */
  assert.ok(app.includes("  else if(slide==='account')obChooseGuest();"));
  assert.ok(cut('function obChooseGuest(){', '/* Les fournisseurs,').includes("state.accountMode='guest';") && cut('function obChooseGuest(){', '/* Les fournisseurs,').includes("obGoto('ready');"));
});

test('la page, habillée comme les autres étapes : le titre, la mascotte, puis Apple, Google et l’e-mail', () => {
  const { html, pied } = rendre();
  assert.ok(html.startsWith('<div class="ob-screen ob-profile ob-account"><header data-etape="account"></header><h1 class="ob-title" id="ob-title">Garde ta <em>progression</em>.</h1>'),
    'l’en-tête des étapes (retour, « Étape X sur N »), puis le titre surligné');
  assert.ok(html.includes('<div class="ob-bubble">Ta première requête est réussie ! Bientôt, un compte te permettra de la retrouver sur tous tes appareils.</div>'));
  assert.ok(html.indexOf('ob-title') < html.indexOf('ob-chat') && html.indexOf('ob-chat') < html.indexOf('ob-provider-list'), 'dans l’ordre des autres étapes');
  const boutons = [...html.matchAll(/<button type="button" class="ob-provider is-(\w+) is-soon" data-provider="(\w+)" style="--i:(\d)" onclick="obStartAuth\('(\w+)',this\)" >(<span class="ob-provider-icon[^"]*" aria-hidden="true">[\s\S]*?<\/span>)<span>Continuer avec ([^<]+)<\/span><small>Bientôt<\/small><\/button>/g)];
  assert.deepEqual(boutons.map(b => [b[1], b[2], +b[3], b[4], b[6]]), [['apple', 'apple', 0, 'apple', 'Apple'], ['google', 'google', 1, 'google', 'Google'], ['email', 'email', 2, 'email', 'un e-mail']],
    'Apple en premier, chacun « Bientôt »');
  assert.ok(!/<button[^>]*class="ob-provider[^>]*disabled/.test(html), 'vifs : on peut les toucher (ils ne connectent à rien)');
  assert.ok(boutons[0][5].includes('<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.37 12.62') && !app.includes(''), 'la pomme est dessinée (le caractère U+F8FF ne s’affichait que sur les appareils Apple)');
  assert.ok(html.includes('<p class="ob-sr" id="ob-auth-live" role="status" aria-live="polite"></p>'), 'un lecteur d’écran entend la réponse');
  assert.ok(html.includes('<b>Mode local et privé</b><small>Progression sauvegardée sur cet appareil.</small>'));
  assert.ok(html.includes('En continuant, tu acceptes les <a class="ob-legal-link" href="decouvrir/terms.html" target="_blank" rel="noopener">Conditions d’utilisation</a>'));
  assert.ok(!html.includes('ob-divider') && !html.includes('ob-auth-availability') && !html.includes('ob-lead'), 'plus court : ni « ou », ni deux phrases qui disent la même chose');
  assert.deepEqual(pied.map(a => a[0]), ['Continuer sans compte']);
  /* Avec un fournisseur : les vrais boutons */
  const branche = rendre({ authReady: true }).html;
  assert.ok(branche.includes('Avec un compte, tu la retrouves sur tous tes appareils.') && !branche.includes('is-soon') && !branche.includes('Bientôt') && (branche.match(/ob-provider-chev/g) || []).length === 3);
  /* Pendant une vraie connexion : boutons occupés */
  assert.equal((rendre({ authReady: true, obAuthBusy: true }).html.match(/disabled aria-busy="true"/g) || []).length, 3);
});

test('sans fournisseur, toucher un bouton ne connecte à rien : la page le dit, sans se redessiner', () => {
  const bulle = element('Ta première requête est réussie !'), voix = element(), btn = element(), racine = element();
  racine.classList.add('ob-enter');
  const appels = [], minuteurs = [];
  const ctx = vm.createContext({
    window: {}, state: { accountMode: null }, draft: {}, OB_SLIDES: ['account'], obStep: 0, obAuthBusy: false, obAuthMessage: '',
    buzz: k => appels.push('buzz ' + k), prefersReduceMotion: () => false, obFitSoon: () => appels.push('ajuste'), obCtaWake: () => appels.push('réveil'),
    paintOb: () => appels.push('repeint'), save: () => appels.push('enregistre'),
    setTimeout: (f, ms) => { minuteurs.push([f, ms]); return minuteurs.length; }, clearTimeout() {},
    document: { querySelector: s => (s === '#ob-body .ob-account .ob-bubble' ? bulle : null), getElementById: id => ({ 'ob-auth-live': voix, onboarding: racine })[id] || null },
  });
  vm.runInContext(obTypo + fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS=') + connexion, ctx);
  vm.runInContext("obStartAuth('apple',btn)", Object.assign(ctx, { btn }));
  assert.equal(voix.textContent, 'Pas encore ! La connexion avec Apple arrive bientôt. En attendant, ta progression reste sur cet appareil.');
  assert.equal(bulle.textContent, 'Pas encore\u202f! La connexion avec Apple arrive bientôt. En attendant, ta progression reste sur cet appareil.', 'la mascotte répond, ponctuation insécable');
  assert.ok(bulle.classes.has('is-new') && btn.classes.has('is-nudge'), 'la bulle se rouvre, le bouton hoche la tête');
  assert.ok(!racine.classes.has('ob-enter'), 'l’arrivée sur l’étape ne prend plus le pas sur les animations du toucher');
  assert.deepEqual(appels, ['buzz light', 'ajuste']);
  assert.equal(state(ctx).accountMode, null, 'aucun faux compte');
  /* « Continuer sans compte » se réveille, puis le bouton se calme */
  minuteurs.forEach(([f]) => f());
  assert.ok(appels.includes('réveil') && !btn.classes.has('is-nudge'));
  assert.ok(!appels.includes('repeint'), 'pas redessinée : le focus reste sur le bouton touché');
  /* L’e-mail et Google */
  vm.runInContext("obStartAuth('email',null)", ctx);
  assert.equal(voix.textContent, 'Pas encore ! La connexion par e-mail arrive bientôt. En attendant, ta progression reste sur cet appareil.');
  vm.runInContext("obStartAuth('google',null)", ctx);
  assert.ok(voix.textContent.startsWith('Pas encore ! La connexion avec Google arrive bientôt.'));
  /* Mouvements réduits : le message, sans animation */
  const b2 = element();
  ctx.prefersReduceMotion = () => true; bulle.classList.remove('is-new');
  vm.runInContext("obStartAuth('apple',b2)", Object.assign(ctx, { b2 }));
  assert.ok(!bulle.classes.has('is-new') && !b2.classes.has('is-nudge') && voix.textContent.includes('Apple'));
});
const state = ctx => vm.runInContext('state', ctx);

test('avec un fournisseur branché, les mêmes boutons connectent pour de vrai', async () => {
  const vers = [];
  const ctx = vm.createContext({
    window: { REQUETE_AUTH: { signIn: async p => ({ email: `elisa@${p}.test` }) } }, state: {}, draft: {}, obEntry: 'welcome', obAuthBusy: false, obAuthMessage: '',
    paintOb() {}, save() {}, obGoto: t => vers.push(t), buzz() {}, closeOnboardingAuth() {}, renderCompte() {}, toast() {},
  });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS=') + connexion, ctx);
  await vm.runInContext("obStartAuth('apple',null)", ctx);
  assert.equal(state(ctx).accountMode, 'connected');
  assert.equal(state(ctx).accountLabel, 'elisa@apple.test');
  assert.deepEqual(vers, ['ready']);
});

test('l’habillage : Apple en noir à la police du système, « Bientôt » en coin sur les écrans étroits, animations en mouvements autorisés', () => {
  const s = sansCommentaires(css);
  for (const r of ['html #onboarding.ob-vitrine .ob-account .ob-title{text-align:center!important}',
    "html #onboarding.ob-vitrine .ob-provider{cursor:pointer;font:600 15.5px/1.15 -apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif!important;",
    'html #onboarding.ob-vitrine .ob-provider:not(:disabled):active{transform:translateY(4px)!important;box-shadow:0 0 0 var(--v-shadow-lip)!important}',
    'html #onboarding.ob-vitrine .ob-provider.is-apple{border-color:#000!important;background:#000!important;color:#fff!important;',
    'html #onboarding.ob-vitrine.ob-fit-4 .ob-account .ob-local-proof small{display:none}'])
    assert.ok(s.includes(r), r);
  const etroit = s.slice(s.indexOf('@media (max-width:359px){'));
  assert.ok(etroit.includes('html #onboarding.ob-vitrine .ob-provider small{position:absolute;top:-8px;right:12px;'), '« Bientôt » ne prend plus la place du texte');
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const k of ['.ob-enter .ob-provider{animation:obvTileIn .34s var(--v-pop) calc(.16s + var(--i,0) * 70ms) backwards}', ' .ob-provider.is-nudge{animation:obvShake .42s ease both}',
    ' .ob-provider.is-nudge small{animation:obvJoyIcon .5s var(--v-pop)}', ' .ob-bubble.is-new{transform-origin:0 50%;animation:obvBubbleIn'])
    assert.ok(media.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=15">') && sw.includes("'./onboarding-vitrine.css?v=15',"), 'feuille rechargée');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && cache.includes('connexion'));
});
