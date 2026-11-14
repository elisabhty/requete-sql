/* Elisa, 14 novembre, 11 h 32 (après la recherche sur la revue d’Apple : la règle 5.1.1(v) refuse une appli qui exige un compte pour
   des fonctions qui n’en dépendent pas) : « tu peux avoir une version sans compte si tu veux, mais la personne doit quand même passer
   par le paywall, par l’onboarding, vérifier son pseudo ».
   - La page du compte, à la fin de l’onboarding : « Continuer sans compte » mène au paywall ; la progression reste sur l’iPhone.
   - Plus de page de connexion devant l’appli (ni au lancement, ni après une déconnexion, ni quand la session est perdue).
   - Le pseudo reste obligatoire pendant l’onboarding ; le paywall reste obligatoire (la garde de l’abonnement ne change pas).
   - Mon compte, sans compte : « Mode local actif · Se connecter » (la ligne « Se déconnecter » reste, comme avant). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la garde du compte ne bloque plus : obCompteBloque est toujours faux', () => {
  assert.ok(app.includes('function obCompteBloque(){return false;}'));
  assert.ok(cut('let obCompteGardePrete=false,obCompteGardeT=0;', '\n').length > 0);
});

test('« Continuer sans compte » : pendant l’onboarding, le paywall ; depuis Mon compte, « Plus tard » referme la page', () => {
  const src = cut('function obSansCompte(){', '\nfunction obPasserConnexion(){');
  const run = (onboarded, entree) => {
    const appels = [];
    const ctx = vm.createContext({appels, state: {onboarded}, obEntry: entree, draft: {}, obAuthBusy: false, buzz() {},
      closeOnboardingAuth: () => appels.push('ferme'), obApresCompte: () => appels.push('paywall')});
    vm.runInContext(src + ';this.f=obSansCompte;this.h=obSansCompteHTML;', ctx);
    return {ctx, appels};
  };
  const ob = run(false, 'welcome');
  ob.ctx.f();
  assert.deepEqual(ob.appels, ['paywall'], 'l’onboarding : le paywall, obligatoire');
  assert.equal(ob.ctx.draft.accountMode, 'guest');
  const h = ob.ctx.h();
  assert.ok(h.includes('<button type="button" class="ob-sans-compte-btn" onclick="obSansCompte()">Continuer sans compte</button>'));
  assert.ok(h.includes('<p class="ob-sans-compte-note">Ta progression reste sur cet iPhone. Tu pourras te connecter plus tard, dans Mon compte.</p>'));
  const mc = run(true, 'account');
  mc.ctx.f();
  assert.deepEqual(mc.appels, ['ferme'], 'depuis Mon compte : la page se referme');
  assert.ok(mc.ctx.h().includes('>Plus tard</button>') && !mc.ctx.h().includes('ob-sans-compte-note'));
  const occupe = run(false, 'welcome'); occupe.ctx.obAuthBusy = true; occupe.ctx.f();
  assert.deepEqual(occupe.appels, [], 'pendant une connexion en cours : rien');
  /* sur la feuille du compte, sous Apple et Google, avant la phrase des conditions */
  const page = cut("}else if(slide==='account'){", "}else if(slide==='paywall'){");
  assert.ok(page.includes("${authReady?obSansCompteHTML():''}\n      ${authReady?`<p class=\"ob-acc-legal\">${legalHtml}</p>`:''}"));
  for (const r of ['html #onboarding.ob-vitrine .ob-sans-compte{margin:12px 0 0;text-align:center}', 'html #onboarding.ob-vitrine .ob-sans-compte-btn{display:inline-flex;',
    'html #onboarding.ob-vitrine .ob-sans-compte-note{max-width:300px;'])
    assert.ok(obv.includes(r), r);
});

test('le pseudo reste obligatoire pendant l’onboarding, puis le compte (facultatif), puis le paywall (obligatoire)', () => {
  const avant = cut('function obPseudoAvant(){', '\n/* Le bouton principal');
  assert.ok(avant.includes('psPage({voulu:psAncien(),garder:true,obligatoire:true,'));
  assert.ok(app.includes("obSetFooter('C’est mon pseudo',obPseudoSuivant,pg.obligatoire?'':'Plus tard',pg.obligatoire?'':obPseudoPlusTard,'',!v);"), 'pas de « Plus tard » pendant l’onboarding');
  assert.ok(app.includes("function obApresPret(fin){draft.finVoulue=fin||'home';const connecte=(draft.accountMode||state.accountMode)==='connected';if(obCompteVisible()&&!connecte)obGoto('account');else obApresCompte();}"));
  assert.ok(app.includes("function obApresCompte(){if(obAbonne())finishOnboard(draft.finVoulue||draft.finConnexion||'home');else obGoto('paywall');}"));
  /* la garde de l’abonnement, inchangée : sans abonnement, le paywall devant l’appli */
  assert.ok(app.includes("function obGardeBloque(){return !!state.onboarded&&!obApercu&&obGardeEtat()==='non';}"));
  assert.ok(cut('function obGardeVoir(){', '\nfunction obGardeFermer(){').includes("startOnboarding('paywall');"));
});

test('se déconnecter : on reste dans l’appli, sans compte (plus de page de connexion qui s’ouvre)', async () => {
  const appels = [];
  const ctx = vm.createContext({state: {accountMode: 'connected', accountProvider: 'apple', accountLabel: 'x'}, lqAsk: async () => true, save: () => appels.push('enregistre'),
    obAuthReady: () => true, closePlusDetails: () => appels.push('feuilles'), startOnboarding: k => appels.push('onboarding ' + k), renderCompte: () => appels.push('mon compte'),
    lqAuRevoir: () => appels.push('au revoir'), chatBonusHtml: () => '', window: {REQUETE_AUTH: {signOut: async () => appels.push('signOut')}}});
  vm.runInContext(cut('async function seDeconnecter(){', '\n/* Après la déconnexion'), ctx);
  await vm.runInContext('seDeconnecter()', ctx);
  assert.deepEqual(appels, ['signOut', 'enregistre', 'feuilles', 'mon compte', 'au revoir']);
  assert.equal(ctx.state.accountMode, 'guest');
});

test('Mon compte sans compte : « Mode local actif » et « Se connecter » dans la carte du haut', () => {
  assert.ok(app.includes("?{title:'Mode local actif',copy:'Connecte-toi pour retrouver ta progression sur tous tes appareils. Connexion optionnelle.',btn:'Se connecter',action:\"startOnboarding('account')\"}"));
  /* la ligne « Se déconnecter » reste toujours là (12 novembre, 22 h 14 ; tests/retours-2214.test.mjs) : sans compte, elle ouvre la connexion */
});
