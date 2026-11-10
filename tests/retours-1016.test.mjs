/* 4 novembre, 10 h 16 (Elisa) : « mettre la page de connexion (il faut pas qu’elle marche encore) ». La page n’apparaissait qu’avec
   un fournisseur de connexion branché (window.REQUETE_AUTH), donc jamais. Elle est maintenant toujours dans le tunnel, comptée dans
   « Étape X sur N », habillée comme les autres étapes. Sans fournisseur, ses boutons portent « Bientôt » : les toucher ne connecte
   à rien, ne crée aucun faux compte, et la page le dit (le message sous les boutons, lu aussi par un lecteur d’écran ; le bouton
   qui hoche la tête) ; « Continuer » passe la page.
   10 h 29 : « enlève le mode local, on ne va pas prendre cette option, car on a le paywall qui arrive après » : plus de
   « Continuer sans compte » ni de « Mode local et privé ». Une fois la connexion branchée, le compte est le seul chemin.
   10 h 45 (son texte, Apple et l’e-mail, juste après la première requête, avec des confettis) : tests/retours-1045.test.mjs. */
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
  return { textContent: texte, offsetWidth: 1,
    classList: { add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c)), contains: c => classes.has(c) }, classes };
};
const state = ctx => vm.runInContext('state', ctx);

const rendreCompte = ({ authReady = false, obAuthBusy = false, obAuthMessage = '', practiceDone = true } = {}) => {
  const pied = [];
  const ctx = vm.createContext({ slide: 'account', authReady, obAuthBusy, obAuthMessage, draft: { practiceDone }, MASCOT_IMG: 'mascotte.png',
    obFlowHeader: s => `<header data-etape="${s}"></header>`, esc: s => String(s), escAttr: s => String(s), legalUrl: k => `decouvrir/${k}.html`,
    obSetFooter: (...a) => pied.push(a), obPasserConnexion() {} });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS='), ctx);
  vm.runInContext("var html='';if(slide==='x'){" + page + '}', ctx);
  return { html: ctx.html, pied, ctx };
};

test('la page de connexion est toujours là, après « Ton parcours est prêt » (10 novembre), avec ou sans fournisseur branché', () => {
  const fin = cut('const OB_FIN_SLIDES=', '/* « Me rappeler de m’entraîner »');
  for (const pret of [false, true]) {
    const ctx = vm.createContext({ OB_PROFILE_SLIDES: ['name', 'practice'], obAuthReady: () => pret, window: {} });
    vm.runInContext(fin, ctx);
    assert.deepEqual([...ctx.obFinFlux()], ['practice', 'source'], pret ? 'fournisseur branché' : 'sans fournisseur');
    assert.deepEqual([...ctx.obFlowSteps()], ['name', 'practice', 'source'], 'hors du compte des étapes : elle vient après la dernière page');
  }
  assert.ok(!fin.includes('if(obAuthReady())f.push'), 'plus sautée sans fournisseur');
  /* « Continuer » (et le glissé, et « Suivant ») : la suite du tunnel, tant que la connexion n’est pas branchée ; une fois branchée,
     rien ne passe la page (10 h 29 : pas de mode local, le paywall vient après). */
  assert.ok(app.includes("  else if(slide==='account')obPasserConnexion();") && !app.includes('function obChooseGuest('));
  for (const pret of [false, true]) {
    const vers = [];
    const ctx = vm.createContext({ obAuthReady: () => pret, buzz() {}, state: {}, obEntry: 'welcome', obApresCompte: () => vers.push('paywall') });
    vm.runInContext(cut('function obPasserConnexion(){', '/* Les fournisseurs,'), ctx);
    vm.runInContext('obPasserConnexion()', ctx);
    assert.deepEqual(vers, pret ? [] : ['paywall'], pret ? 'connexion branchée : le compte seul' : 'pas encore de connexion : on passe, vers le paywall');
  }
  /* Ouverte depuis Mon compte (déjà inscrite), ce n’est pas une étape : retour seul, sans « Étape X sur N » */
  assert.ok(app.includes("  if(active<0||(state.onboarded&&slide===obEntry&&obEntry!=='welcome'))return `<div class=\"ob-flow-top ob-flow-solo\">${obBackButton()}</div>`;"));
});

test('les boutons : « Bientôt » et vifs sans fournisseur, de vrais boutons avec, jamais de mode local', () => {
  const { html, pied } = rendreCompte();
  const boutons = [...html.matchAll(/<button type="button" class="ob-provider is-(\w+) is-soon" data-provider="(\w+)" style="--i:(\d)" onclick="obStartAuth\('(\w+)',this\)" >(<span class="ob-provider-icon[^"]*" aria-hidden="true">[\s\S]*?<\/span>)<span>Continuer avec ([^<]+)<\/span><small>Bientôt<\/small><\/button>/g)];
  assert.deepEqual(boutons.map(b => [b[1], b[2], +b[3], b[4], b[6]]), [['apple', 'apple', 0, 'apple', 'Apple'], ['google', 'google', 1, 'google', 'Google']], 'Apple en premier, puis Google (14 h 08), chacun « Bientôt »');
  /* 9 novembre, 2 h 11 (« le trait avec l’e-mail dessous (ou) ») : le trait « ou », puis l’adresse e-mail en champ, « Bientôt » aussi */
  assert.ok(html.includes('<p class="ob-divider" aria-hidden="true">ou</p><button type="button" class="ob-provider is-email is-champ is-soon" data-provider="email" style="--i:2" onclick="obStartAuth(\'email\',this)" aria-label="Continuer avec une adresse e-mail, bientôt" >'));
  assert.ok(html.includes('<span class="ob-champ-ph">Ton adresse e-mail</span><small>Bientôt</small></button>') && !html.includes('Continuer avec un e-mail'));
  assert.ok(!/<button[^>]*class="ob-provider[^>]*disabled/.test(html), 'vifs : on peut les toucher (ils ne connectent à rien)');
  assert.ok(boutons[0][5].includes('<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.37 12.62') && !app.includes(''), 'la pomme est dessinée (le caractère U+F8FF ne s’affichait que sur les appareils Apple)');
  assert.ok(html.includes('<p class="ob-compte-msg" id="ob-auth-live" role="status" aria-live="polite"></p>'), 'le message des boutons, qu’un lecteur d’écran entend aussi');
  assert.ok(!html.includes('ob-local-proof') && !html.includes('Mode local') && !html.includes('sans compte'), 'plus de mode local (10 h 29)');
  /* 6 novembre, 23 h 16 : la phrase des conditions est sous le bouton jaune, dans le pied de page */
  assert.ok(!html.includes('En continuant') && pied[0][4].html.startsWith('En continuant, tu acceptes les <a class="ob-legal-link" href="decouvrir/terms.html" target="_blank" rel="noopener">Conditions d’utilisation</a>'));
  assert.ok(!html.includes('ob-auth-availability'));
  assert.deepEqual(pied.map(a => a[0]), ['Continuer'], 'tant que la connexion n’est pas branchée');
  /* Avec un fournisseur : les vrais boutons, et le compte seul */
  const { html: branche, pied: piedBranche } = rendreCompte({ authReady: true });
  assert.deepEqual(piedBranche.map(a => [a[0], a[1]]), [['', null]], 'connexion branchée : pas de bouton pour passer, le compte est le seul chemin');
  assert.ok(!branche.includes('is-soon') && !branche.includes('Bientôt') && (branche.match(/ob-provider-chev/g) || []).length === 3, 'Apple, Google et l’e-mail');
  /* Pendant une vraie connexion : boutons occupés */
  assert.equal((rendreCompte({ authReady: true, obAuthBusy: true }).html.match(/disabled aria-busy="true"/g) || []).length, 3);
});

test('sans fournisseur, toucher un bouton ne connecte à rien : la page le dit, sans se redessiner', () => {
  const msg = element(), btn = element(), stk = element(), racine = element();
  racine.classList.add('ob-enter');
  const appels = [], minuteurs = [];
  const ctx = vm.createContext({
    window: {}, state: { accountMode: null }, draft: {}, OB_SLIDES: ['account'], obStep: 0, obAuthBusy: false, obAuthMessage: '',
    buzz: k => appels.push('buzz ' + k), prefersReduceMotion: () => false, obFitSoon: () => appels.push('ajuste'), obCtaWake: () => appels.push('réveil'),
    paintOb: () => appels.push('repeint'), save: () => appels.push('enregistre'),
    setTimeout: (f, ms) => { minuteurs.push([f, ms]); return minuteurs.length; }, clearTimeout() {},
    document: { querySelector: s => (s === '#ob-body .ob-account .ob-compte-stk' ? stk : null), getElementById: id => ({ 'ob-auth-live': msg, onboarding: racine })[id] || null },
  });
  vm.runInContext(obTypo + fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS=') + connexion, ctx);
  vm.runInContext("obStartAuth('apple',btn)", Object.assign(ctx, { btn }));
  assert.equal(msg.textContent, 'Pas encore ! La connexion avec Apple arrive bientôt. En attendant, touche « Continuer ».', 'le message, ponctuation insécable');
  assert.ok(msg.classes.has('is-new') && btn.classes.has('is-nudge') && stk.classes.has('is-oups'), 'le message s’ouvre, le bouton hoche la tête, la mascotte sautille');
  assert.ok(!racine.classes.has('ob-enter'), 'l’arrivée sur l’étape ne prend plus le pas sur les animations du toucher');
  assert.deepEqual(appels, ['buzz light', 'ajuste']);
  assert.equal(state(ctx).accountMode, null, 'aucun faux compte');
  /* « Continuer » se réveille, puis tout se calme */
  minuteurs.forEach(([f]) => f());
  assert.ok(appels.includes('réveil') && !btn.classes.has('is-nudge') && !stk.classes.has('is-oups') && !msg.classes.has('is-new'));
  assert.ok(!appels.includes('repeint'), 'pas redessinée : le focus reste sur le bouton touché');
  vm.runInContext("obStartAuth('email',null)", ctx);
  assert.ok(msg.textContent.startsWith('Pas encore ! La connexion par e-mail arrive bientôt.'));
  /* Mouvements réduits : le message, sans animation */
  const b2 = element();
  ctx.prefersReduceMotion = () => true; msg.classList.remove('is-new');
  vm.runInContext("obStartAuth('apple',b2)", Object.assign(ctx, { b2 }));
  assert.ok(!msg.classes.has('is-new') && !b2.classes.has('is-nudge') && msg.textContent.includes('Apple'));
});

test('avec un fournisseur branché, les mêmes boutons connectent pour de vrai, puis le paywall (10 novembre)', async () => {
  const vers = [];
  const ctx = vm.createContext({
    window: { REQUETE_AUTH: { signIn: async p => ({ email: `elisa@${p}.test` }) } }, state: {}, draft: {}, obEntry: 'welcome', obAuthBusy: false, obAuthMessage: '',
    paintOb() {}, save() {}, obGoto: t => vers.push(t), obApresCompte: () => vers.push('paywall'), buzz() {}, closeOnboardingAuth() {}, renderCompte() {}, toast() {},
  });
  vm.runInContext(fournisseurs.replace('const OB_PROVIDERS=', 'var OB_PROVIDERS=') + connexion, ctx);
  await vm.runInContext("obStartAuth('apple',null)", ctx);
  assert.equal(state(ctx).accountMode, 'connected');
  assert.equal(state(ctx).accountLabel, 'elisa@apple.test');
  assert.deepEqual(vers, ['paywall']);
  assert.ok(connexion.includes("'Connexion impossible pour le moment. Réessaie dans un instant.'") && !connexion.includes('continue sans compte'), 'un échec propose de réessayer');
});

test('l’habillage : Apple en noir à la police du système, « Bientôt » en coin sur les écrans étroits, animations en mouvements autorisés', () => {
  const s = sansCommentaires(css);
  for (const r of ['html #onboarding.ob-vitrine .ob-account .ob-title{text-align:center!important}',
    "html #onboarding.ob-vitrine .ob-provider{cursor:pointer;font:600 15.5px/1.15 -apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif!important;",
    'html #onboarding.ob-vitrine .ob-provider:not(:disabled):active{transform:translateY(4px)!important;box-shadow:0 0 0 var(--v-shadow-lip)!important}',
    'html #onboarding.ob-vitrine .ob-provider.is-apple{border-color:#000!important;background:#000!important;color:#fff!important;'])
    assert.ok(s.includes(r), r);
  const etroit = s.slice(s.indexOf('@media (max-width:359px){'));
  assert.ok(etroit.includes('html #onboarding.ob-vitrine .ob-provider small{position:absolute;top:-8px;right:12px;'), '« Bientôt » ne prend plus la place du texte');
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  for (const k of ['.ob-enter .ob-provider{animation:obvTileIn .34s var(--v-pop) calc(.16s + var(--i,0) * 70ms) backwards}', ' .ob-provider.is-nudge{animation:obvShake .42s ease both}',
    ' .ob-provider.is-nudge small{animation:obvJoyIcon .5s var(--v-pop)}'])
    assert.ok(media.includes(k), k);
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && /^requete-2026-11-[0-3]\d-[a-z-]+-v\d+$/.test(cache));
});
