// La garde de l’abonnement (Elisa, 12 novembre, 21 h 04 : « est-ce que le paywall est attaché à l’iPhone ? car j’ai changé de compte
// et j’ai pas eu le paywall, tu peux vérifier ? » ; 21 h 06 : « ok pour le 1 »).
// Le paywall n’était contrôlé qu’à la fin de l’onboarding : l’onboarding fait, plus rien ne regardait l’abonnement (se reconnecter
// avec un autre compte ramenait droit dans l’appli ; un essai annulé gardait l’appli). Son choix : l’abonnement reste celui du
// compte Apple de l’iPhone, vérifié à chaque ouverture, à chaque retour au premier plan et après chaque connexion ; sans abonnement
// actif, le paywall. Une abonnée hors ligne n’est jamais bloquée.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = lire('achat.js'), app = lire('index.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const attendre = () => new Promise(r => setTimeout(r, 10));

/* ---------- achat.js : ce qu’on sait de l’abonnement ---------- */
function monde({stock = {}, reponse, demarrer} = {}) {
  const store = {...stock}, R = {reponse, ecoute: null, appels: []};
  const lireReponse = () => (R.reponse === 'echec' ? Promise.reject(new Error('hors ligne')) : Promise.resolve({customerInfo: R.reponse}));
  const plugin = {
    configure: () => { R.appels.push('configure'); return Promise.resolve(); },
    addCustomerInfoUpdateListener: (o, f) => { R.appels.push(['ecoute', typeof o, typeof f]); R.ecoute = f; return 'cb'; },
    getCustomerInfo: () => { R.appels.push('info'); return lireReponse(); },
    getOfferings: () => Promise.resolve({current: {availablePackages: [{packageType: 'ANNUAL', product: {identifier: 'fr.requete.app.annuel', price: 44.99, priceString: '44,99 €'}}]}}),
    purchasePackage: () => Promise.resolve({customerInfo: info(true, '2026-11-12T21:10:00Z')}),
    restorePurchases: () => lireReponse(),
  };
  const win = {Capacitor: {isNativePlatform: () => true, Plugins: {Purchases: plugin}}};
  if (demarrer) win.obGardeDemarrer = demarrer;
  const ecoutes = {};
  vm.runInNewContext(src, {window: win, Promise, setTimeout,
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    document: {visibilityState: 'visible', addEventListener: (e, f) => { ecoutes[e] = f; }}});
  return {A: win.REQUETE_ACHAT, store, R, ecoutes};
}
const info = (actif, date) => ({entitlements: {active: actif ? {premium: {isActive: true}} : {}}, ...(date ? {requestDate: date} : {})});
const J1 = '2026-11-05T10:00:00Z', J2 = '2026-11-12T21:00:00Z';

test('achat.js : trois états, « inconnu » tant que RevenueCat n’a jamais répondu', async () => {
  const rien = monde({reponse: 'echec'});
  assert.equal(rien.A.etat(), 'inconnu'); await attendre();
  assert.equal(rien.A.etat(), 'inconnu', 'hors ligne à la première ouverture : on ne sait pas, et on ne garde rien');
  assert.equal(rien.A.actif(), false); assert.deepEqual(rien.store, {});
  const non = monde({reponse: info(false, J2)}); await attendre();
  assert.equal(non.A.etat(), 'non'); assert.deepEqual(non.store, {'requete-premium': '0', 'requete-premium-vu': J2});
  const oui = monde({reponse: info(true, J2)}); await attendre();
  assert.equal(oui.A.etat(), 'oui'); assert.equal(oui.A.actif(), true); assert.deepEqual(oui.store, {'requete-premium': '1', 'requete-premium-vu': J2});
  /* Ce qu’on savait à la dernière ouverture est là tout de suite, avant toute réponse */
  assert.equal(monde({stock: {'requete-premium': '1'}, reponse: 'echec'}).A.etat(), 'oui');
  assert.equal(monde({stock: {'requete-premium': '0'}, reponse: 'echec'}).A.etat(), 'non');
});

test('achat.js : une abonnée hors ligne n’est jamais bloquée ; un « non » ne remplace un « oui » que s’il vient d’une réponse plus récente', async () => {
  /* Hors ligne, sans rien en mémoire chez RevenueCat : on garde le « oui » */
  const a = monde({stock: {'requete-premium': '1', 'requete-premium-vu': J1}, reponse: 'echec'}); await attendre();
  assert.equal(a.A.etat(), 'oui'); assert.equal(a.store['requete-premium'], '1');
  /* Hors ligne, RevenueCat rend sa vieille réponse (la même date), qui dit maintenant « expiré » : pas sûr, on garde le « oui » */
  const b = monde({stock: {'requete-premium': '1', 'requete-premium-vu': J1}, reponse: info(false, J1)}); await attendre();
  assert.equal(b.A.etat(), 'oui'); assert.deepEqual(b.store, {'requete-premium': '1', 'requete-premium-vu': J1});
  /* Le serveur répond (date plus récente) : cette fois c’est sûr */
  const dits = []; b.A.suivre(e => dits.push(e));
  b.R.ecoute(info(false, J2)); await attendre();
  assert.equal(b.A.etat(), 'non'); assert.deepEqual(b.store, {'requete-premium': '0', 'requete-premium-vu': J2}); assert.deepEqual(dits, ['non']);
  /* Un « oui » gardé par une version d’avant, sans date : la première réponse sert de repère, la suivante (plus récente) décide */
  const c = monde({stock: {'requete-premium': '1'}, reponse: info(false, J1)}); await attendre();
  assert.equal(c.A.etat(), 'oui'); assert.equal(c.store['requete-premium-vu'], J1);
  c.R.ecoute(info(false, J1)); assert.equal(c.A.etat(), 'oui');
  c.R.ecoute(info(false, J2)); assert.equal(c.A.etat(), 'non');
  /* Une réponse illisible ne change rien */
  const d = monde({stock: {'requete-premium': '1', 'requete-premium-vu': J1}, reponse: {}}); await attendre();
  d.R.ecoute(null); d.R.ecoute({}); assert.equal(d.A.etat(), 'oui');
  /* Connue non abonnée et hors ligne : le paywall reste (elle n’a jamais payé) */
  const e = monde({stock: {'requete-premium': '0', 'requete-premium-vu': J1}, reponse: 'echec'}); await attendre();
  assert.equal(e.A.etat(), 'non');
});

test('achat.js : l’écouteur de RevenueCat, verifier(), suivre() et le retour au premier plan', async () => {
  const lances = [], m = monde({reponse: info(false, J1), demarrer: () => lances.push(1)});
  assert.deepEqual(lances, [1], 'la garde de l’appli est lancée dès que le crochet existe');
  await attendre();
  assert.deepEqual(m.R.appels.slice(0, 3), ['configure', ['ecoute', 'object', 'function'], 'info'], 'l’écouteur est posé après configure, avec (options, fonction) comme l’attend le pont de Capacitor');
  const dits = []; m.A.suivre(e => dits.push(e)); m.A.suivre('pas une fonction');
  assert.equal(await m.A.verifier(), 'non'); await attendre();
  assert.deepEqual(dits, [], 'rien n’a changé : personne n’est prévenu');
  m.R.reponse = info(true, J2);
  assert.equal(await m.A.verifier(), 'oui'); await attendre();
  assert.deepEqual(dits, ['oui']);
  /* De retour dans l’app, abonnement terminé depuis (réponse plus récente) */
  m.R.reponse = info(false, '2026-11-20T08:00:00Z');
  m.ecoutes.visibilitychange(); await attendre();
  assert.deepEqual(dits, ['oui', 'non']); assert.equal(m.A.etat(), 'non');
  /* L’achat : « oui », et les suiveurs ne sont prévenus qu’après la fin de l’achat (au tour suivant) : le paywall ouvre l’app lui-même */
  let avant = null;
  const p = m.A.acheter('an').then(ok => { avant = dits.length; return ok; });
  assert.equal(await p, true); assert.equal(avant, 2, 'pas encore prévenus quand acheter() rend la main');
  await attendre(); assert.deepEqual(dits, ['oui', 'non', 'oui']);
  /* verifier() ne rejette jamais */
  m.R.reponse = 'echec'; assert.equal(await m.A.verifier(), 'oui');
});

/* ---------- index.html : le paywall devant l’appli ---------- */
function appli({etat = 'non', onboarded = true, apercu = false, branche = true, ouvert = false, jeu = null} = {}) {
  const appels = [], timers = [], cls = new Set(ouvert ? ['on'] : []), R = {etat, suivis: [], verifs: 0};
  const A = {acheter() {}, actif: () => R.etat === 'oui', etat: () => R.etat, suivre: f => R.suivis.push(f), verifier: () => { R.verifs++; return Promise.resolve(R.etat); }};
  const ctx = vm.createContext({appels, state: {onboarded}, obApercu: apercu, JEU: jeu, window: branche ? {REQUETE_ACHAT: A} : {}, Promise,
    document: {getElementById: id => (id === 'onboarding' ? {classList: {contains: c => cls.has(c)}} : null)},
    setTimeout: (f, d) => { timers.push({f, d}); return timers.length; }, clearTimeout() {}, jeuFromUrl() {}});
  vm.runInContext('let obPwSortie=false,obPwBusy=false;' + cut('function obAchatPret(){', '\n') + '\n' + cut('let obGarde=false,obGardePrete=false', '/* Ce que le compte a rapporté')
    + ';function startOnboarding(k){appels.push(k);obGarde=k==="paywall"&&!!state.onboarded;ouvrir();}'
    + 'function closeOnboardingAuth(){appels.push("ferme");fermer();obGarde=false;obGardeVoir();}'
    + 'function gardeOuverte(){return obGarde;}', Object.assign(ctx, {ouvrir: () => cls.add('on'), fermer: () => cls.delete('on')}));
  return {ctx, appels, timers, cls, R};
}

test('sans abonnement actif, le paywall s’ouvre devant l’appli ; seulement sur un « non » sûr, seulement dans l’app iPhone', () => {
  const m = appli();
  assert.equal(m.ctx.obGardeVoir(), true); assert.deepEqual(m.appels, ['paywall']); assert.ok(m.ctx.gardeOuverte() && m.cls.has('on'));
  assert.equal(m.ctx.obGardeVoir(), true); assert.deepEqual(m.appels, ['paywall'], 'déjà ouvert : pas une deuxième fois');
  assert.equal(m.ctx.obGardeBloque(), true);
  for (const [nom, o] of [['on ne sait pas (hors ligne)', {etat: 'inconnu'}], ['abonnée', {etat: 'oui'}], ['onboarding pas fini : son paywall vient à la fin', {onboarded: false}],
    ['aperçu de l’onboarding', {apercu: true}], ['le site, ou l’app sans le plugin d’achat', {branche: false}]]) {
    const x = appli(o);
    assert.equal(x.ctx.obGardeVoir(), false, nom); assert.deepEqual(x.appels, [], nom); assert.equal(x.ctx.obGardeBloque(), false, nom);
  }
  assert.equal(appli({branche: false}).ctx.obGardeEtat(), 'oui', 'sans achat branché, rien à garder');
});

test('il attend : une autre page de l’onboarding ouverte, une partie entre amis en cours', () => {
  const page = appli({ouvert: true});
  assert.equal(page.ctx.obGardeVoir(), false); assert.deepEqual(page.appels, [], 'la page de connexion ouverte : à sa fermeture');
  page.ctx.closeOnboardingAuth();
  assert.deepEqual(page.appels, ['ferme', 'paywall'], 'refermée : le paywall prend la suite aussitôt');
  const partie = appli({jeu: {code: 'ABC234'}});
  assert.equal(partie.ctx.obGardeVoir(), false); assert.deepEqual(partie.appels, []);
  assert.deepEqual(partie.timers.map(t => t.d), [20000], 'on regarde de nouveau dans 20 s');
  partie.ctx.JEU = null; partie.timers[0].f(); assert.deepEqual(partie.appels, ['paywall']);
});

test('l’abonnement arrive (achat, « Restaurer », réponse de RevenueCat) : le paywall se referme, l’invitation qui attendait reprend', () => {
  const m = appli(); m.ctx.obGardeVoir();
  m.R.etat = 'oui';
  assert.equal(m.ctx.obGardeVoir(), false); assert.deepEqual(m.appels, ['paywall', 'ferme']); assert.ok(!m.cls.has('on') && !m.ctx.gardeOuverte());
  assert.deepEqual(m.timers.map(t => t.d), [350], 'jeuFromUrl, comme à la fin de l’onboarding');
  m.ctx.obGardeFermer(); assert.deepEqual(m.appels, ['paywall', 'ferme'], 'déjà fermé : rien');
  /* Refermé par un autre chemin, sans abonnement : il revient */
  const n = appli(); n.ctx.obGardeVoir(); n.ctx.closeOnboardingAuth();
  assert.deepEqual(n.appels, ['paywall', 'ferme', 'paywall']); assert.ok(n.cls.has('on') && n.ctx.gardeOuverte());
  /* Une invitation à une salle attend derrière lui, comme pendant l’onboarding */
  assert.ok(app.includes("  if(!state.onboarded||(typeof obGardeBloque==='function'&&obGardeBloque())){try{sessionStorage.setItem(JEU_INV,inv.code);"));
});

test('la garde démarre quand l’appli ET achat.js sont là, une seule fois ; elle suit les changements', async () => {
  const m = appli({etat: 'inconnu'});
  m.ctx.obGardeDemarrer(); assert.deepEqual([m.R.suivis.length, m.R.verifs], [0, 0], 'achat.js chargé avant l’appli : on attend le démarrage');
  m.ctx.obGardeDemarrer(true); assert.deepEqual([m.R.suivis.length, m.R.verifs], [1, 1]);
  m.ctx.obGardeDemarrer(true); m.ctx.obGardeDemarrer(); assert.deepEqual([m.R.suivis.length, m.R.verifs], [1, 1], 'une seule fois');
  assert.deepEqual(m.appels, []);
  m.R.etat = 'non'; m.R.suivis[0](); assert.deepEqual(m.appels, ['paywall'], 'RevenueCat a répondu « non » : le paywall');
  const sans = appli({branche: false}); sans.ctx.obGardeDemarrer(true); assert.equal(sans.R.suivis.length, 0, 'le site : rien');
  /* Dans boot, après les autres étapes du démarrage (l’aperçu est alors connu), avant que l’écran de lancement parte */
  assert.ok(app.includes('    resetLeconFromUrl();\n    apercuFromUrl();\n    try{obGardeDemarrer(true);}catch(e){}'));
  assert.ok(src.includes("try { if (typeof window.obGardeDemarrer === 'function') window.obGardeDemarrer(); } catch (e) {}"));
});

test('aucune sortie : ni « Retour », ni glissé, ni Échap ; la page n’a pas de « Retour » et dit « Ton parcours t’attend »', () => {
  const back = cut('function obBack(){\n  if(obLegalMode)', '\nfunction obPick(');
  const i = back.indexOf("if(typeof obGarde!=='undefined'&&obGarde&&OB_SLIDES[obStep]==='paywall'){if(obPwSortie)obSortieRefuser();return;}");
  assert.ok(i > 0 && i < back.indexOf('closeOnboardingAuth();return;}'), 'avant la ligne qui referme une page ouverte depuis l’appli');
  const essai = (garde, sortie) => {
    const appels = [];
    const ctx = vm.createContext({obLegalMode: null, obStep: 1, OB_SLIDES: ['bonjour', 'paywall'], obEntry: 'paywall', state: {onboarded: true}, obGarde: garde, obPwSortie: sortie,
      obSortieRefuser: () => appels.push('offres'), closeOnboardingAuth: () => appels.push('ferme'), obGoto: k => appels.push(k), obCompteVisible: () => true, draft: {}, OB_FIN_SLIDES: []});
    vm.runInContext(back + ';obBack();', ctx);
    return appels;
  };
  assert.deepEqual(essai(true, false), [], 'la garde : rien');
  assert.deepEqual(essai(true, true), ['offres'], 'de l’offre de bienvenue : retour aux offres');
  assert.deepEqual(essai(false, false), ['ferme'], 'sans la garde, une page ouverte depuis l’appli se referme comme avant');
  const page = cut('function obPaywallHTML(){', '\nfunction obPaywallPied(){');
  assert.ok(page.includes("const garde=typeof obGarde!=='undefined'&&obGarde;"));
  assert.ok(page.includes(`\${garde?'<button type="button" class="pw-lien pw-compte" onclick="obGardeCompte()">Mon compte</button>':obBackButton()}\${droite}</div>`), 'à la place du « Retour » : « Mon compte »');
  assert.ok(page.includes("<span class=\"pw-tag\">${garde?'Ton parcours t’attend':'Ton parcours est prêt'}&nbsp;🚀</span>"));
  assert.ok(app.includes("  root.classList.toggle('ob-garde',slide==='paywall'&&typeof obGarde!=='undefined'&&!!obGarde);"));
  /* Ouvert droit sur le paywall, onboarding déjà fait : c’est la garde ; refermé, elle est levée puis revue */
  assert.ok(app.includes("  obGarde=obEntry==='paywall'&&!!state.onboarded;"));
  assert.ok(cut('function closeOnboardingAuth(){', '\nconst OB_SORTIE_MS').includes("  obGarde=false;\n  if(typeof obGardeVoir==='function')obGardeVoir();\n}"));
});

test('payer ou restaurer depuis la garde referme le paywall sans refaire l’onboarding (le planning n’est pas recalculé)', () => {
  const entrer = cut('function obPaywallEntrer(){', '\nasync function obPaywallAcheter(){');
  const essai = (entry, onboarded) => {
    const appels = [];
    vm.runInNewContext('let obPwSortie=true;' + entrer + ';obPaywallEntrer();', {obEntry: entry, state: {onboarded}, draft: {finVoulue: 'lecon'},
      buzz: () => {}, obGardeFermer: () => appels.push('garde'), finishOnboard: a => appels.push(['fin', a])});
    return appels;
  };
  assert.deepEqual(essai('paywall', true), ['garde']);
  assert.deepEqual(essai('welcome', false), [['fin', 'lecon']], 'à la fin de l’onboarding : comme avant');
  assert.deepEqual(essai('welcome', true), [['fin', 'lecon']]);
});

test('après une connexion depuis l’appli (ou une reconnexion) : le paywall si l’abonnement manque, sans refermer la page entre les deux', () => {
  const auth = cut('async function obStartAuth(provider,btn){', '\n  }catch(e){');
  const i = auth.indexOf("if(obEntry==='account'&&state.onboarded&&typeof obGardeBloque==='function'&&obGardeBloque()){obGarde=true;obEntry='paywall';obGoto('paywall');}");
  const j = auth.indexOf("else if(obEntry==='account'&&state.onboarded){closeOnboardingAuth();renderCompte();toast('Compte connecté'");
  assert.ok(i > 0 && j > i, 'le paywall d’abord ; sinon, comme avant, « Compte connecté »');
  /* Le paywall de la fin de l’onboarding ne change pas */
  assert.ok(app.includes("function obApresCompte(){if(obAbonne())finishOnboard(draft.finVoulue||draft.finConnexion||'home');else obGoto('paywall');}"));
});

/* 21 h 31 (« Tu veux que j’ajoute un lien discret “Mon compte” en haut à gauche du paywall ? » : « oui ») : sans abonnement, on
   n’atteint plus Mon compte dans l’appli ; se déconnecter et supprimer son compte restent possibles depuis le paywall (Apple,
   règle 5.1.1(v) : la suppression du compte se fait dans l’appli). */
test('« Mon compte » sur le paywall de la garde : se déconnecter, supprimer son compte, ou se connecter', async () => {
  const fn = cut('async function obGardeCompte(){', '\n}\n') + '\n}';
  const essai = async (st, reponse, busy = false) => {
    const appels = [], demandes = [];
    const ctx = vm.createContext({state: st, obPwBusy: busy, lqAsk: async o => { demandes.push(o); return reponse; }, chatBonusHtml: k => `<img data-k="${k}">`,
      seDeconnecter: () => appels.push('deconnexion'), compteSupprimer: () => appels.push('suppression'), startOnboarding: k => appels.push(['onboarding', k])});
    await vm.runInContext(fn + ';obGardeCompte()', ctx);
    return {appels, o: demandes[0]};
  };
  const lea = {accountMode: 'connected', accountProvider: 'apple', accountLabel: 'lea@exemple.fr'};
  const a = await essai(lea, false);
  assert.deepEqual({...a.o}, {chat: '<img data-k="salut">', titre: 'Mon compte', texte: 'Compte connecté avec lea@exemple.fr.', oui: 'Me déconnecter', trois: 'Supprimer mon compte', troisDanger: true, non: 'Fermer'});
  assert.deepEqual(a.appels, [], '« Fermer » : rien');
  assert.deepEqual((await essai(lea, true)).appels, ['deconnexion'], 'la déconnexion de l’appli, avec sa confirmation et son « À bientôt ! »');
  assert.deepEqual((await essai(lea, 'trois')).appels, ['suppression'], 'la suppression de l’appli, avec ses deux confirmations');
  assert.equal((await essai({accountMode: 'connected', accountProvider: 'google', accountLabel: 'google'}, false)).o.texte, 'Compte connecté avec Google.');
  assert.equal((await essai({accountMode: 'connected'}, false)).o.texte, 'Ton compte est connecté.');
  /* Sans compte connecté : on peut retrouver son compte (et le supprimer ensuite), ou effacer ce qui est sur l’appareil */
  const g = await essai({accountMode: 'guest'}, true);
  assert.equal(g.o.texte, 'Aucun compte n’est connecté sur cet appareil.'); assert.equal(g.o.oui, 'Me connecter'); assert.equal(g.o.trois, 'Supprimer mon compte');
  assert.deepEqual(g.appels, [['onboarding', 'account']], 'la page de connexion ; refermée ou connectée, le paywall revient (closeOnboardingAuth, obStartAuth)');
  assert.deepEqual((await essai({accountMode: 'guest'}, 'trois')).appels, ['suppression']);
  /* Pendant un paiement : rien */
  const p = await essai(lea, true, true); assert.equal(p.o, undefined); assert.deepEqual(p.appels, []);
  /* Le lien a le style discret de « Restaurer » */
  assert.ok(lire('onboarding-vitrine.css').includes('html #onboarding.ob-vitrine .pw-lien{min-height:44px;padding:0 4px;border:0;background:none;color:rgba(255,255,255,.85);font:600 14px/1 var(--v-ui);'));
});

/* 21 h 42 (« Je peux aussi ajouter “Gérer mon abonnement” dans Mon compte, utile aux vrais abonnés » : « oui ») : la feuille
   d’Apple, dans l’app. Le seul moyen, aussi, d’annuler un abonnement de test pris dans TestFlight. */
test('« Gérer mon abonnement » dans Mon compte : la feuille d’Apple par le pont natif, seulement dans l’app avec l’achat branché', async () => {
  const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
  assert.ok(pont.includes('import StoreKit\n'));
  assert.ok(pont.includes('        CAPPluginMethod(name: "notifJeton", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "abonnementGerer", returnType: CAPPluginReturnPromise)\n    ]'));
  const m = pont.slice(pont.indexOf('    @objc func abonnementGerer(_ call: CAPPluginCall) {'), pont.indexOf('// MARK: - La leçon en cours'));
  assert.ok(m.includes('guard #available(iOS 15.0, *) else {') && m.includes('guard let scene = self.bridge?.viewController?.view.window?.windowScene else {'));
  assert.ok(m.includes('Task { @MainActor in') && m.includes('try await AppStore.showManageSubscriptions(in: scene)') && m.includes('call.resolve(["ok": true])'));
  assert.ok(!m.includes('call.reject('), 'jamais rejeté : ok vaut faux, et la page ouvre les abonnements de l’App Store');
  assert.equal(m.split('}').length, m.split('{').length + 1, 'la méthode se ferme, puis la classe (une accolade fermante de plus)');
  /* La ligne de Mon compte, après « Compte connecté » */
  assert.ok(app.includes("${typeof abonnementIci==='function'&&abonnementIci()?`<button class=\"account-setting-row\" type=\"button\" onclick=\"abonnementGerer()\"><span class=\"plus-row-icon is-stk\">${lqStkSvg('etoile')}</span><span><b>Gérer mon abonnement</b><small>Changer d’offre ou annuler</small></span>"));
  const src = cut('function abonnementIci(){', '\n/* « Mon compte », en haut à gauche');
  const essai = async ({pret = true, natif = true, feuille = true} = {}) => {
    const appels = [];
    const C = {nativePromise: (p, k, d) => { appels.push([p, k, d && d.url].filter(Boolean).join(' ')); return k === 'abonnementGerer' ? (feuille === 'erreur' ? Promise.reject(new Error('x')) : Promise.resolve({ok: feuille})) : Promise.resolve({}); }};
    const ctx = vm.createContext({obAchatPret: () => pret, ilePont: () => (natif ? C : null), obGardeVoir: () => appels.push('garde'),
      window: {REQUETE_ACHAT: {verifier: () => { appels.push('relu'); return Promise.resolve('oui'); }}}});
    const ici = vm.runInContext(src + ';abonnementIci()', ctx);
    await vm.runInContext('abonnementGerer()', ctx);
    return {ici, appels};
  };
  assert.deepEqual(await essai(), {ici: true, appels: ['RequeteWidget abonnementGerer', 'relu', 'garde']}, 'la feuille refermée : l’abonnement est relu, la garde suit');
  assert.deepEqual((await essai({feuille: false})).appels, ['RequeteWidget abonnementGerer', 'RequeteWidget ouvrir https://apps.apple.com/account/subscriptions']);
  assert.deepEqual((await essai({feuille: 'erreur'})).appels, ['RequeteWidget abonnementGerer', 'RequeteWidget ouvrir https://apps.apple.com/account/subscriptions']);
  assert.deepEqual(await essai({natif: false}), {ici: false, appels: []}, 'le site : pas de ligne, rien');
  assert.equal((await essai({pret: false})).ici, false, 'l’app sans l’achat branché : pas de ligne');
});
