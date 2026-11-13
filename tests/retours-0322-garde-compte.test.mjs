/* Elisa, 13 novembre, 3 h 22, six captures de TestFlight :
   « Réf : Sous-titre : Des premiers pas aux plus grands défis. Au lieu de apprends en pratiquant
     Réf 2 : il y a un vrai souci je suis déconnectée mais j’ai quand même accès à ça mon compte et quand je fais retour alors que je
             suis déconnectée j’y suis aussi
     Réf 3 : il y a un voile qu’on voit au début
     Réf 4 : les cadenas sont pas alignés
     Réf 5 : il reste un petit bug encore de flash la mascotte disparaît apparaît etc
     Réf 6 : je pense qu’on est sur le mauvais prix »
   1. Le sous-titre de la première page.
   2. La garde du compte : dans l’appli où la connexion est branchée, sans compte connecté, la page de connexion reste devant
      l’appli, sans « Retour » (au lancement, après une déconnexion, au retour au premier plan, session perdue), avant le paywall.
      Vérifié en simulation sur six situations (lancement sans compte, déconnexion puis relance, sans abonnement, session perdue,
      iPhone neuf, connexion pas branchée).
   3. Le voile : la feuille de connexion apparaissait sur place, à demi transparente (le fondu commun des pages passait devant sa
      montée), et l’ombre de la barre d’état grandissait de 0 à sa hauteur. Filmé au ralenti avant et après.
   4. Les cadenas du planning : 4 px de marge à droite aujourd’hui, 14 px « Demain ». Mesuré : centres à 357 et 347, puis 345 et 345.
   5. La mascotte du prénom : son saut de joie remplaçait l’animation d’arrivée, qui repartait de zéro (invisible) 0,9 s après.
      Suivi image par image : l’opacité reste à 1.
   6. Le prix : une réponse, pas de changement dans l’appli (voir IOS.md). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css'), lud = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const media = obv.slice(obv.indexOf('@media (prefers-reduced-motion:no-preference){'), obv.indexOf('@media (prefers-reduced-motion:reduce){', obv.indexOf('@media (prefers-reduced-motion:no-preference){')));

/* ---------- Réf. 1 : le sous-titre ---------- */
test('réf. 1 : « Des premiers pas aux plus grands défis. » sous le nom de l’appli', () => {
  const b = cut("}else if(slide==='bonjour'){", "}else if(slide==='questions'){");
  assert.ok(b.includes("<p class=\"ob-bj-lead\">${obTypo('Des premiers pas aux plus grands défis.')}</p>${invite}"));
  assert.ok(!app.includes('Apprends en pratiquant, progresse en t’amusant.'), 'l’ancien sous-titre n’est plus écrit nulle part');
});

/* ---------- Réf. 2 : la garde du compte ---------- */
function appli({onboarded = true, mode = 'guest', auth = true, apercu = false, ouvert = false, page = 'bonjour', garde = false, jeu = null, prete = true} = {}) {
  const appels = [], timers = [], cls = new Set(ouvert ? ['on'] : []);
  const R = {session: mode === 'connected'};
  const win = auth ? {REQUETE_AUTH: {signIn() {}, connecte: () => R.session}} : {};
  const ctx = vm.createContext({appels, state: {onboarded, accountMode: mode, accountProvider: 'apple', accountLabel: 'elisa@exemple.test'}, obApercu: apercu, JEU: jeu, window: win,
    OB_SLIDES: ['bonjour', 'account', 'paywall', 'widget'], Promise,
    document: {getElementById: id => (id === 'onboarding' ? {classList: {contains: c => cls.has(c)}} : null)},
    setTimeout: (f, d) => { timers.push({f, d}); return timers.length; }, clearTimeout() {}, jeuFromUrl() {}, closePlusDetails: () => appels.push('feuilles fermées'),
    save: () => appels.push('enregistre'), renderCompte() {}});
  vm.runInContext(`let obPwSortie=false,obPwBusy=false,obStep=${['bonjour', 'account', 'paywall', 'widget'].indexOf(page)};`
    + cut('function obAuthReady(){', '\n') + '\n' + cut('function obAchatPret(){', '\n') + '\n'
    + cut('function compteSessionVerifier(){', '\nif(typeof window') + '\n'
    + cut('let obGarde=false,obGardePrete=false', '/* Ce que le compte a rapporté')
    + ';function startOnboarding(k){appels.push(k);obStep=OB_SLIDES.indexOf(k);obGarde=k==="paywall"&&!!state.onboarded;ouvrir();}'
    + 'function closeOnboardingAuth(){appels.push("ferme");fermer();obGarde=false;obGardeVoir();}'
    + `obGarde=${garde};obCompteGardePrete=${prete};`, Object.assign(ctx, {ouvrir: () => cls.add('on'), fermer: () => cls.delete('on')}));
  return {ctx, appels, timers, cls, R};
}

test('réf. 2 : sans compte connecté, la page de connexion s’ouvre devant l’appli ; seulement une fois l’onboarding fait, la connexion branchée', () => {
  const m = appli();
  assert.equal(m.ctx.obCompteBloque(), true);
  assert.equal(m.ctx.obCompteGardeVoir(), true); assert.deepEqual(m.appels, ['feuilles fermées', 'account']); assert.ok(m.cls.has('on'));
  assert.equal(m.ctx.obCompteGardeVoir(), true); assert.deepEqual(m.appels, ['feuilles fermées', 'account'], 'déjà ouverte : pas une deuxième fois');
  for (const [nom, o] of [['connectée', {mode: 'connected'}], ['onboarding pas fini : c’est lui qui mène au compte', {onboarded: false}], ['aperçu de l’onboarding', {apercu: true}],
    ['connexion pas branchée (mise au point)', {auth: false}]]) {
    const x = appli(o);
    assert.equal(x.ctx.obCompteBloque(), false, nom); assert.equal(x.ctx.obCompteGardeVoir(), false, nom); assert.deepEqual(x.appels, [], nom);
  }
  const tot = appli({prete: false});
  assert.equal(tot.ctx.obCompteGardeVoir(), false, 'avant la fin du démarrage de l’appli : rien'); assert.deepEqual(tot.appels, []);
  assert.equal(tot.ctx.obCompteGardeDemarrer(), true, 'le démarrage la lance'); assert.deepEqual(tot.appels, ['feuilles fermées', 'account']);
});

test('réf. 2 : refermée par un autre chemin, elle revient ; elle passe avant le paywall ; elle attend la fin d’une partie ou d’une autre page', () => {
  const m = appli();
  m.ctx.obCompteGardeVoir(); m.ctx.closeOnboardingAuth();
  assert.deepEqual(m.appels, ['feuilles fermées', 'account', 'ferme', 'feuilles fermées', 'account'], 'refermée : elle revient aussitôt');
  /* Sans abonnement non plus : la connexion d’abord (le paywall suit la connexion, obStartAuth) */
  const sansAbo = appli(); sansAbo.ctx.window.REQUETE_ACHAT = {acheter() {}, actif: () => false, etat: () => 'non'};
  assert.equal(sansAbo.ctx.obGardeVoir(), false, 'la garde de l’abonnement laisse passer celle du compte');
  assert.deepEqual(sansAbo.appels, ['feuilles fermées', 'account']);
  const paywall = appli({ouvert: true, page: 'paywall', garde: true});
  assert.equal(paywall.ctx.obCompteGardeVoir(), true); assert.deepEqual(paywall.appels, ['feuilles fermées', 'account'], 'le paywall de la garde laisse la place');
  const widget = appli({ouvert: true, page: 'widget'});
  assert.equal(widget.ctx.obCompteGardeVoir(), false); assert.deepEqual(widget.appels, [], 'une autre page de l’onboarding : à sa fermeture');
  widget.ctx.closeOnboardingAuth(); assert.deepEqual(widget.appels, ['ferme', 'feuilles fermées', 'account']);
  const partie = appli({jeu: {code: 'ABC234'}});
  assert.equal(partie.ctx.obCompteGardeVoir(), false); assert.deepEqual(partie.appels, []);
  assert.deepEqual(partie.timers.map(t => t.d), [20000], 'en pleine partie : dans 20 s');
  partie.ctx.JEU = null; partie.timers[0].f(); assert.deepEqual(partie.appels, ['feuilles fermées', 'account']);
});

test('réf. 2 : une session perdue (compte supprimé ailleurs) ramène à la page de connexion', () => {
  const m = appli({mode: 'connected'});
  assert.equal(m.ctx.compteGardeVerifier(), false); assert.deepEqual(m.appels, []);
  m.R.session = false;
  assert.equal(m.ctx.compteGardeVerifier(), true);
  assert.equal(m.ctx.state.accountMode, 'guest'); assert.deepEqual(m.appels, ['enregistre', 'feuilles fermées', 'account']);
  /* Branchée aux trois moments où la session a pu changer, et au lancement juste avant la garde de l’abonnement */
  const b = cut("  window.addEventListener('requete-session-perdue',compteSessionVerifier);", '\n}');
  assert.ok(b.includes("const garde=()=>{try{if(typeof compteGardeVerifier==='function')compteGardeVerifier();}catch(e){}};"));
  for (const k of ["window.addEventListener('requete-session-perdue',garde);", "window.addEventListener('load',garde);", "document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')garde();});"]) assert.ok(b.includes(k), k);
  const i = app.indexOf('    try{obCompteGardeDemarrer();}catch(e){}'), j = app.indexOf('    try{obGardeDemarrer(true);}catch(e){}');
  assert.ok(i > 0 && j > i && j - i < 260, 'au lancement : le compte, puis l’abonnement');
});

test('réf. 2 : rien ne sort de la page gardée (ni « Retour », ni le haut de la page, ni le glissé, ni Échap)', () => {
  /* obBack : le glissé, Échap, le bouton et le haut de la page passent tous par lui */
  const debut = app.lastIndexOf('function obBack(){'), retour = app.slice(debut, app.indexOf('\nfunction obPick(', debut));   // la version en service (une ancienne la précède)
  const i = retour.indexOf("if(OB_SLIDES[obStep]==='account'&&typeof obCompteBloque==='function'&&obCompteBloque())return;");
  const j = retour.indexOf("if(state.onboarded&&OB_SLIDES[obStep]===obEntry&&obEntry!=='welcome'){closeOnboardingAuth();return;}");
  assert.ok(i > 0 && j > i, 'avant la ligne qui refermait la page sur l’appli');
  const essai = (bloque, onboarded = true) => {
    const appels = [];
    const ctx = vm.createContext({appels, state: {onboarded}, OB_SLIDES: ['bonjour', 'account'], OB_FIN_SLIDES: [], obStep: 1, obEntry: onboarded ? 'account' : 'welcome', obLegalMode: null, obGarde: false, obPwSortie: false,
      draft: {}, obCompteBloque: () => bloque, closeOnboardingAuth: () => appels.push('ferme'), obGoto: p => appels.push('page ' + p), paintOb() {}, obCompteVisible: () => true});
    vm.runInContext(retour + '\nobBack();', ctx);
    return appels;
  };
  assert.deepEqual(essai(true), [], 'gardée : rien');
  assert.deepEqual(essai(false), ['ferme'], 'connexion pas branchée : comme avant');
  assert.deepEqual(essai(false, false), ['page bonjour'], 'iPhone neuf, « J’ai déjà un compte » : retour à la première page');
  /* L’en-tête sans « Retour », le haut qui n’est plus un bouton */
  const tete = cut('function obFlowHeader(slide){', '\n/* Autocollants');
  const ctx = vm.createContext({state: {onboarded: true}, obEntry: 'account', obFlowSteps: () => [], obBackButton: () => '<button class="ob-back"></button>', bloque: true});
  vm.runInContext('function obCompteBloque(){return bloque;}' + tete, ctx);
  assert.equal(ctx.obFlowHeader('account'), '<div class="ob-flow-top ob-flow-solo"></div>');
  ctx.bloque = false; assert.equal(ctx.obFlowHeader('account'), '<div class="ob-flow-top ob-flow-solo"><button class="ob-back"></button></div>');
  const page = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
  assert.ok(page.includes("const fige=typeof obCompteBloque==='function'&&obCompteBloque();"));
  assert.ok(page.includes("${fige?'<div class=\"ob-acc-fond is-fige\">':`<button type=\"button\" class=\"ob-acc-fond\" onclick=\"obBack()\" aria-label=\"${finale?'Revenir à mon parcours':'Revenir en arrière'}\">`}"));
  assert.ok(page.includes("<b>${haut}</b><small>Connecte-toi en un geste, et c’est parti.</small>${fige?'</div>':'</button>'}"));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-acc-fond.is-fige{cursor:default}'));
});

test('réf. 2 : « Se déconnecter » sans compte, connexion branchée : la page de connexion, plus de fenêtre « sans compte »', async () => {
  const deco = auth => {
    const appels = [];
    const ctx = vm.createContext({state: {accountMode: 'guest'}, lqAsk: async o => { appels.push(['demande', o.titre, o.oui, o.non]); return true; }, save() {}, obAuthReady: () => auth,
      closePlusDetails: () => appels.push(['ferme']), startOnboarding: k => appels.push(['onboarding', k]), window: {}});
    vm.runInContext(cut('async function seDeconnecter(){', '\n/* Après la déconnexion'), ctx);
    return vm.runInContext('seDeconnecter()', ctx).then(() => appels);
  };
  assert.deepEqual(await deco(true), [['ferme'], ['onboarding', 'account']]);
  assert.deepEqual(await deco(false), [['demande', 'Aucun compte connecté', 'OK', null]], 'mise au point, sans connexion : la fenêtre, un simple « OK »');
  assert.ok(!cut('async function seDeconnecter(){', '\n/* Après la déconnexion').includes('Plus tard'), 'plus de « Plus tard » : on ne reste pas sans compte dans l’appli');
});

test('réf. 2 : une invitation à une salle attend derrière la page de connexion, et reprend une fois connectée', () => {
  assert.ok(app.includes("  if(!state.onboarded||(typeof obCompteBloque==='function'&&obCompteBloque())||(typeof obGardeBloque==='function'&&obGardeBloque())){try{sessionStorage.setItem(JEU_INV,inv.code);"));
  const auth = cut('async function obStartAuth(provider,btn){', '\n  }catch(e){');
  assert.ok(auth.includes("toast('Compte connecté','Ta progression peut maintenant être synchronisée.');\n      if(typeof jeuFromUrl==='function')setTimeout(jeuFromUrl,350);}"));
});

/* ---------- Réf. 3 : la page de connexion s’ouvre sans voile ---------- */
test('réf. 3 : la feuille monte, opaque, d’un seul bloc ; le haut vient à sa teinte ; l’ombre de la barre d’état ne change que de teinte', () => {
  const P = '  html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter ';
  for (const r of [P + '.ob-screen.ob-account.is-feuille>.ob-acc-feuille{animation:obvFeuilleMonte .5s cubic-bezier(.2,.9,.25,1) both!important}',
    P + '.ob-screen.ob-account.is-feuille>.ob-acc-fond{animation:obvFondVient .3s ease both!important}',
    P + '.ob-account.is-feuille .ob-provider{animation:none}']) assert.ok(media.includes(r), r);
  /* Le fondu commun des pages, plus précis (neuf « :not »), passait devant les règles du 12 novembre : d’où le « !important » */
  assert.ok(obv.includes('html #onboarding.ob-vitrine.ob-enter[data-ob-dir="fwd"] .ob-screen>:not(.ob-flow-top):not(.ob-promise-stk)'));
  assert.ok(obv.includes('@keyframes obvFeuilleMonte{from{transform:translateY(64vh)}to{transform:none}}') && obv.includes('@keyframes obvFondVient{from{opacity:0}to{opacity:.82}}'));
  /* La feuille qui monte ne dépasse pas de la page : ni défilement, ni mesure faussée (obFit) */
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-screen.ob-account.is-feuille{overflow:clip}'));
  /* L’ombre : même place, transparente puis teintée (elle grandissait de 0 à la hauteur de la barre d’état) */
  const i = obv.indexOf('html #onboarding.ob-vitrine .ob-slides{box-shadow:0 calc(-1 * var(--safe-top,0px) - 1px) 0 0 rgba(22,12,70,0)}');
  const j = obv.indexOf('html #onboarding.ob-vitrine.ob-compte-feuille .ob-slides{box-shadow:0 calc(-1 * var(--safe-top,0px) - 1px) 0 0 rgba(22,12,70,.4)}');
  assert.ok(i > 0 && j > i);
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-slides{transition:background-color .3s ease,box-shadow .3s ease}'));
});

/* ---------- Réf. 4 : les cadenas du planning ---------- */
test('réf. 4 : les lignes d’aujourd’hui et celles des jours suivants ont les mêmes marges : cadenas et numéros alignés', () => {
  assert.ok(lud.includes('html.lq .pl-chip{\n  gap:12px!important;padding:10px 16px!important;'));
  assert.ok(lud.includes('html.lq .pl-next-row{display:flex;align-items:center;gap:12px;width:100%;min-height:62px;box-sizing:border-box;padding:10px 16px;'));
  assert.ok(!lud.includes('padding:10px 4px 10px 16px'), 'plus de marge de 4 px à droite (l’ancien bouton du calendrier)');
  const etroit = lud.slice(lud.indexOf('@media (max-width:374px){', lud.indexOf('html.lq .pl-next-row{')));
  assert.ok(etroit.includes('  html.lq .pl-chip{gap:10px!important;padding-left:14px!important;padding-right:14px!important}\n  html.lq .pl-next-row{gap:10px;padding-left:14px;padding-right:14px}\n'), 'petit écran : 14 px des deux côtés, les deux listes');
  /* La pastille du cadenas : la même dans les deux listes */
  const jour = cut('  const chips=sess?sess.lessons.map((id,i)=>{', "  }).join(''):'';"), suite = cut('    const rows=sess.lessons.map((id,i)=>{', "    }).join('');");
  assert.ok(jour.includes("ferme?PL_VERROU:''") && suite.includes("ferme?PL_VERROU:''"));
});

/* ---------- Réf. 5 : la mascotte du prénom ne disparaît plus ---------- */
test('réf. 5 : pendant le saut de joie, l’animation d’arrivée reste dans la liste : elle ne se rejoue pas à la fin du saut', () => {
  assert.ok(media.includes('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter.ob-cheer .ob-chat img:is(.is-gif,.is-question){animation:obvApparait .24s ease-out both,obvJoy .8s var(--v-pop) both}'));
  /* Les règles en cause : l’arrivée (tant que la page vient d’arriver), le saut, qui la remplaçait */
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-chat img.is-gif{animation:obvApparait .24s ease-out both}'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine.ob-cheer .ob-chat img.is-gif{animation:obvJoy .8s var(--v-pop) both}'));
  assert.ok(obv.includes('@keyframes obvApparait{from{opacity:0}to{opacity:1}}'));
  /* Le saut : posé à la première lettre du prénom, retiré 0,9 s après, la page gardant ob-enter */
  assert.ok(cut('function obNamePreview(){', '\n}').includes("root.classList.add('ob-cheer');clearTimeout(obCheerT);obCheerT=setTimeout(()=>root.classList.remove('ob-cheer'),900);"));
  assert.ok(app.includes("  root.classList.toggle('ob-enter',obJustEntered);"));
});

test('les feuilles de style et le cache changent de version', () => {
  assert.ok(app.includes('ludique.css?v=330') && app.includes('onboarding-vitrine.css?v=67'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-13-maj-v2937';"));
});
