/* Elisa, 13 novembre, 2 h 41 : « On est d’accord que pour chaque pays on a les bons prix sur le paywall (paramétré par rapport au pays
   et donc devise appropriée ?) car j’aurai plusieurs pays sur l’app ? […] quand on se connecte sur l’appli on va toujours pas sur
   l’accueil ».
   1. Les prix. Oui dès que la boutique a répondu : le prix et la devise viennent de l’App Store du pays de la personne (achat.js,
      prix()). Mais la garde ouvrait le paywall avant (au lancement, hors ligne), avec les prix en euros écrits dans index.html
      (OB_OFFRES), et rien ne le repeignait : hors de la zone euro, « 44,99 € » puis un autre prix sur la feuille d’Apple. Vu en
      simulation avec une boutique en dollars qui répond en 6 s. Le paywall attend maintenant la boutique (« On récupère les
      offres… »), se repeint à l’arrivée des prix, et propose « Réessayer » sans réponse. Vérifié en simulation : attente puis
      « 39,99 $US / an » ; hors ligne, « Les offres ne se chargent pas », puis les prix après « Réessayer ».
   2. La connexion. Toute connexion mène à l’accueil (déjà demandé le 30 octobre, 22 h 50) : reconnexion après une déconnexion (on
      restait sur Mon compte), connexion derrière le paywall de la garde, « J’ai déjà un compte » sur un iPhone neuf (c’était Mon
      compte depuis le 12 novembre, réf. 14). Vérifié en simulation sur ces trois chemins : l’onglet Accueil, en haut, sans leçon
      ouverte. Le nouvel inscrit garde ce que promet « Commencer la première leçon ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = lire('achat.js'), app = lire('index.html'), css = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const nb = x => String(x).replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ');

/* ---------- achat.js : les prix de la boutique, lus, attendus ou en échec ---------- */
function boutique({offres = 'ok', delai = 0, demarre = true} = {}) {
  const R = {offres, delai, lus: 0}, store = {}, doc = {}, fenetre = {};
  const pq = (type, id, price) => ({packageType: type, product: {identifier: id, price, priceString: '$' + price, currencyCode: 'USD'}});
  const reponse = () => R.offres === 'ok' ? {current: {availablePackages: [pq('ANNUAL', 'fr.requete.app.annuel', 39.99), pq('WEEKLY', 'fr.requete.app.hebdo', 4.99)]}}
    : R.offres === 'annuel' ? {current: {availablePackages: [pq('ANNUAL', 'fr.requete.app.annuel', 39.99)]}} : {current: {availablePackages: []}};
  const plugin = {
    configure: () => (demarre ? Promise.resolve() : Promise.reject(new Error('pas de clé'))),
    getCustomerInfo: () => Promise.resolve({customerInfo: {entitlements: {active: {}}, requestDate: '2026-11-13T01:00:00Z'}}),
    getOfferings: () => { R.lus++; const o = R.offres, d = R.delai;
      return new Promise((ok, non) => { const f = () => (o === 'muet' ? null : o === 'echec' ? non(new Error('hors ligne')) : ok(reponse())); d ? setTimeout(f, d) : f(); }); },
    checkTrialOrIntroductoryPriceEligibility: () => (R.essaiEchec ? Promise.reject(new Error('x')) : Promise.resolve({'fr.requete.app.annuel': {status: 2}})),
    restorePurchases: () => Promise.resolve({customerInfo: {entitlements: {active: {premium: {}}}, requestDate: '2026-11-13T01:05:00Z'}}),
  };
  const win = {Capacitor: {isNativePlatform: () => true, Plugins: {Purchases: plugin}}, addEventListener: (e, f) => { fenetre[e] = f; }};
  vm.runInNewContext(src.replace('DELAI_PRIX = 12000', 'DELAI_PRIX = 80'), {window: win, Promise, setTimeout, Error, Object, Number, String,
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    document: {visibilityState: 'visible', addEventListener: (e, f) => { doc[e] = f; }}});
  const dits = []; win.REQUETE_ACHAT.suivrePrix(e => dits.push(e));
  return {A: win.REQUETE_ACHAT, R, doc, fenetre, dits};
}

test('achat.js : « attente » tant que la boutique n’a pas répondu, puis ses prix, dans sa devise ; le paywall est prévenu', async () => {
  const b = boutique({delai: 30});
  assert.equal(b.A.prixEtat(), 'attente'); assert.equal(b.A.prixConnus(), false); assert.equal(b.A.prix('an'), null, 'aucun prix avant la boutique');
  await dormir(10); assert.equal(b.A.prixEtat(), 'attente'); assert.deepEqual(b.dits, []);
  await dormir(50);
  assert.equal(b.A.prixEtat(), 'oui'); assert.equal(b.A.prixConnus(), true); assert.deepEqual(b.dits, ['oui'], 'prévenu une fois');
  assert.deepEqual([b.A.prix('an').prix, b.A.prix('an').devise, b.A.prix('semaine').prix], [39.99, 'USD', 4.99], 'le prix et la devise de la boutique du pays');
  /* Une boutique qui répond tout de suite : pareil, sans attendre */
  const vite = boutique(); await dormir(10);
  assert.equal(vite.A.prixEtat(), 'oui'); assert.deepEqual(vite.dits, ['oui']);
  /* Sans réponse sur l’essai, les prix restent bons */
  const e = boutique(); e.R.essaiEchec = true; await dormir(10);
  assert.equal(e.A.prixEtat(), 'oui');
});

test('achat.js : hors ligne, offre vide, RevenueCat qui ne démarre pas ou qui ne répond pas : « echec », jamais un prix inventé', async () => {
  for (const [nom, o] of [['hors ligne', {offres: 'echec'}], ['offre vide', {offres: 'vide'}], ['l’hebdomadaire manque', {offres: 'annuel'}], ['RevenueCat ne démarre pas', {demarre: false}]]) {
    const b = boutique(o); await dormir(10);
    assert.equal(b.A.prixEtat(), 'echec', nom); assert.equal(b.A.prixConnus(), false, nom); assert.deepEqual(b.dits, ['echec'], nom);
  }
  /* Elle ne répond jamais : « echec » au bout du délai (12 s dans l’app), pas d’attente sans fin */
  const muet = boutique({offres: 'muet'}); await dormir(30);
  assert.equal(muet.A.prixEtat(), 'attente'); await dormir(90);
  assert.equal(muet.A.prixEtat(), 'echec'); assert.deepEqual(muet.dits, ['echec']);
  assert.match(src, /DELAI_PRIX = 12000/);
  /* Elle répond après le délai : ses prix sont pris quand même, et le paywall prévenu */
  const tard = boutique({delai: 140}); await dormir(110);
  assert.equal(tard.A.prixEtat(), 'echec'); await dormir(70);
  assert.equal(tard.A.prixEtat(), 'oui'); assert.deepEqual(tard.dits, ['echec', 'oui']);
});

test('achat.js : « Réessayer », le retour du réseau et le retour dans l’app redemandent les prix qui manquent', async () => {
  const b = boutique({offres: 'echec'}); await dormir(10);
  assert.equal(b.A.prixEtat(), 'echec'); assert.equal(b.R.lus, 1);
  b.R.offres = 'ok'; b.R.delai = 20;
  const p = b.A.rechargerPrix();
  assert.equal(b.A.prixEtat(), 'attente', 'tout de suite : le paywall peut dire « On récupère les offres… »');
  assert.equal(await p, 'oui'); await dormir(5);
  assert.deepEqual(b.dits, ['echec', 'oui']); assert.equal(b.R.lus, 2);
  assert.equal(await b.A.rechargerPrix(), 'oui'); assert.equal(b.R.lus, 2, 'les prix sont là : rien à redemander');
  /* Le réseau revient */
  const r = boutique({offres: 'echec'}); await dormir(10);
  r.R.offres = 'ok'; r.fenetre.online(); await dormir(10);
  assert.equal(r.A.prixEtat(), 'oui');
  /* De retour dans l’app */
  const v = boutique({offres: 'echec'}); await dormir(10);
  v.R.offres = 'ok'; v.doc.visibilitychange(); await dormir(10);
  assert.equal(v.A.prixEtat(), 'oui');
  /* Deux demandes en même temps : une seule lecture */
  const d = boutique({delai: 20}); d.A.rechargerPrix(); d.A.rechargerPrix(); await dormir(40);
  assert.equal(d.R.lus, 1);
});

test('achat.js : restaurer et vérifier n’attendent plus la lecture des prix', async () => {
  const b = boutique({delai: 300});
  const gagne = await Promise.race([b.A.verifier().then(() => 'vérifié'), dormir(100).then(() => 'trop long')]);
  assert.equal(gagne, 'vérifié');
  assert.equal(await Promise.race([b.A.restaurer(), dormir(100).then(() => 'trop long')]), true);
  assert.equal(b.A.prixEtat(), 'attente', 'les prix arrivent de leur côté');
  assert.match(src, /var demarre = P\.configure\(\{apiKey: RC_CLE_IOS\}\);/);
  assert.match(src, /demarre\.then\(chargerOffres, function\(\)\{ prixRate = true; direPrix\(\); \}\);/);
});

/* ---------- index.html : le paywall attend la boutique ---------- */
const code = cut('const OB_OFFRES=', '\nfunction obFinSuivante(');
const fin = cut('function obCompteVisible(){', '/* ---------- Le paywall');
function paywall({etatPrix, prix = null, ouvert = true, slide = 'paywall'} = {}) {
  const pieds = [], peints = [], suivis = [], R = {etatPrix, recharges: 0};
  const achat = {acheter: async () => true, etat: () => 'non', actif: () => false, suivre() {}, verifier: async () => 'non', prix: k => (prix ? prix(k) : null),
    essaiDispo: () => true, sortieDispo: () => false};
  if (etatPrix !== undefined) Object.assign(achat, {prixEtat: () => R.etatPrix, prixConnus: () => R.etatPrix === 'oui', suivrePrix: f => suivis.push(f),
    rechargerPrix: () => { R.recharges++; R.etatPrix = 'attente'; return Promise.resolve('attente'); }});
  const racine = {classList: {contains: c => c === 'on' && ouvert}, dataset: {}};
  const ctx = vm.createContext({window: {REQUETE_ACHAT: achat}, draft: {name: 'Elisa', finVoulue: 'home'}, state: {onboarded: true}, TOTAL: 71, CHALLENGES: {length: 477},
    OB_COMMUNAUTE: 1000, esc: s => String(s), escAttr: s => String(s), legalUrl: k => k, mascotReduced: () => false, obApercu: false,
    obPlanInfo: () => ({goal: 'Progresser en SQL', endLabel: '14 décembre', minutes: 20}), obBackButton: () => '',
    obSetFooter: (...a) => pieds.push(a), buzz() {}, stat() {}, finishOnboard() {}, obGoto() {}, obConnexionMasquee: () => false, startOnboarding() {},
    OB_SLIDES: [slide], obStep: 0, obLock: false, obJustEntered: true, paintOb: () => peints.push(ctx.obJustEntered),
    setTimeout: () => 0, clearTimeout() {}, Promise,
    document: {querySelectorAll: () => [], getElementById: id => (id === 'onboarding' ? racine : null)}});
  vm.runInContext(fin + code, ctx);
  return {ctx, pieds, peints, suivis, R};
}
const usd = k => (k === 'an' ? {prix: 39.99, texte: '$39.99', devise: 'USD'} : {prix: 4.99, texte: '$4.99', devise: 'USD'});

test('le paywall de l’app n’affiche jamais les prix écrits dans le code à la place de ceux de la boutique', () => {
  for (const [etat, titre, bouton] of [['attente', 'On récupère les offres…', 'Chargement des offres…'], ['echec', 'Les offres ne se chargent pas', 'Réessayer']]) {
    const p = paywall({etatPrix: etat}), h = nb(p.ctx.obPaywallHTML());
    assert.doesNotMatch(h.replace(/<svg[\s\S]*?<\/svg>/g, ''), /€|\$|\d,\d\d|pw-offre |par semaine|−\d+ %/, etat + ' : ni prix, ni devise, ni pourcentage');
    assert.ok(h.includes(`<div class="pw-attente${etat === 'echec' ? ' is-echec' : ''}" role="status" aria-live="polite">`) && h.includes(`<b>${titre}</b>`), etat);
    assert.equal(h.includes('pw-att-rond'), etat === 'attente', 'l’anneau tourne seulement pendant l’attente');
    assert.ok(h.includes('71 leçons vidéo') && h.includes('onclick="obPaywallRestaurer()">Restaurer</button>'), 'le reste de la page est là, « Restaurer » aussi');
    p.ctx.obPaywallPied();
    const [libelle, action, , , note, bloque] = p.pieds.at(-1);
    assert.equal(libelle, bouton); assert.equal(typeof action, etat === 'echec' ? 'function' : 'object'); assert.equal(bloque, etat === 'attente');
    assert.ok(note.html.includes('Conditions') && note.html.includes('Confidentialité') && !/€|\$\d/.test(note.html), 'les liens légaux, sans montant');
  }
  assert.ok(nb(paywall({etatPrix: 'attente'}).ctx.obPaywallHTML()).includes('Les prix sont ceux de l’App Store de ton pays.'));
  assert.ok(nb(paywall({etatPrix: 'echec'}).ctx.obPaywallHTML()).includes('Vérifie ta connexion à Internet, puis réessaie.'));
  /* Les prix arrivés : ceux de la boutique, dans sa devise */
  const ok = paywall({etatPrix: 'oui', prix: usd}), h = nb(ok.ctx.obPaywallHTML());
  assert.ok(h.includes('<b>39,99 $US</b> / an') && h.includes('<b>4,99 $US</b> / semaine') && !h.includes('pw-attente') && !h.includes('€'));
  ok.ctx.obPaywallPied(); assert.equal(nb(ok.pieds.at(-1)[0]), 'Essayer gratuitement 3 jours');
  /* Sans boutique branchée (le site, la mise au point) ou avec un ancien crochet : les prix d’Elisa en euros, comme avant */
  const site = paywall(), hs = nb(site.ctx.obPaywallHTML());
  assert.ok(hs.includes('<b>44,99 €</b> / an') && !hs.includes('pw-attente'));
  assert.equal(vm.runInContext('window.REQUETE_ACHAT=null;obPrixEtat()', site.ctx), 'oui');
});

test('les prix arrivent : le paywall ouvert se repeint, sans rejouer son entrée ; « Réessayer » redemande', async () => {
  const p = paywall({etatPrix: 'attente'});
  vm.runInContext('obGardePrete=true;obGardeDemarrer();obGardeDemarrer(true);', p.ctx);
  assert.equal(p.suivis.length, 1, 'les prix sont suivis, une seule fois');
  p.R.etatPrix = 'oui'; p.suivis[0]('oui');
  assert.deepEqual(p.peints, [false], 'repeint, sans l’animation d’entrée');
  /* Pas de repeinture ailleurs que sur le paywall ouvert, ni pendant un achat */
  for (const [nom, o, avant] of [['paywall fermé', {ouvert: false}, ''], ['une autre page', {slide: 'account'}, ''], ['achat en cours', {}, 'obPwBusy=true;'], ['page en train de changer', {}, 'obLock=true;']]) {
    const x = paywall({etatPrix: 'attente', ...o}); vm.runInContext(avant + 'obPaywallPrix()', x.ctx);
    assert.deepEqual(x.peints, [], nom);
  }
  /* « Réessayer » */
  const e = paywall({etatPrix: 'echec'});
  e.ctx.obPaywallRecharger();
  assert.equal(e.R.recharges, 1); assert.deepEqual(e.peints, [false], 'repeint tout de suite : « On récupère les offres… »');
  await dormir(5); assert.equal(e.peints.length, 2, 'et à la réponse');
  /* Sans les prix, ni choix d’offre ni achat */
  const a = paywall({etatPrix: 'attente'}); let achete = 0; a.ctx.window.REQUETE_ACHAT.acheter = async () => { achete++; return true; };
  await a.ctx.obPaywallAcheter(); a.ctx.obPaywallChoisir('semaine');
  assert.equal(achete, 0); assert.notEqual(a.ctx.draft.offre, 'semaine');
});

test('la carte d’attente a son style, son anneau ne tourne pas en mouvement réduit', () => {
  for (const r of ['html #onboarding.ob-vitrine .pw-attente{display:flex;align-items:center;gap:14px;margin-top:17px;padding:22px 18px;',
    'html #onboarding.ob-vitrine .pw-attente b{display:block;margin-bottom:3px;color:var(--v-ink);font:800 17px/1.15 var(--v-display);letter-spacing:-.01em}',
    'html #onboarding.ob-vitrine .pw-att-rond{flex:none;width:30px;height:30px;box-sizing:border-box;border:3.5px solid #CFC6F5;border-top-color:var(--v-accent-ink);border-radius:50%}'])
    assert.ok(css.includes(r), r);
  const i = css.indexOf('html:not([data-motion="reduce"]) #onboarding.ob-vitrine .pw-att-rond{animation:obvSpin .9s linear infinite}');
  assert.ok(i > css.indexOf('@media (prefers-reduced-motion:no-preference){') && i < css.indexOf('@keyframes obvSpin{'), 'dans le média « no-preference »');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=63">') && app.includes('<script src="achat.js?v=6"></script>'));
  const sw = lire('sw.js');
  assert.ok(sw.includes("'./onboarding-vitrine.css?v=63',") && sw.includes("'./achat.js?v=6',"));
});

/* ---------- La connexion mène à l’accueil ---------- */
test('toute connexion mène à l’accueil : reconnexion, connexion derrière le paywall, « J’ai déjà un compte »', async () => {
  const auth = cut('function obVersAccueil(){', '\n  }catch(e){');
  const monter = ({onboarded, bloque = false, connu = true, finVoulue} = {}) => {
    const appels = [], positions = {learn: 480, compte: 600};
    const ctx = vm.createContext({window: {REQUETE_AUTH: {signIn: async () => ({email: 'elisa@exemple.test', prenom: 'Elisa'})}}, state: {onboarded: !!onboarded}, draft: finVoulue ? {finVoulue} : {},
      obEntry: onboarded ? 'account' : 'welcome', obAuthBusy: false, obAuthMessage: '', obAuthQui: '', obAuthFait: false, obGarde: false, tabScrollPositions: positions,
      paintOb() {}, save() {}, stat() {}, buzz() {}, obTypo: x => x, obGoto: t => appels.push('page ' + t), obApresCompte: () => appels.push('suite'), obGardeBloque: () => bloque,
      closeOnboardingAuth: () => appels.push('ferme'), closePlusDetails: () => appels.push('feuille fermée'), switchTab: t => appels.push('onglet ' + t), renderCompte() {},
      toast: t => appels.push('bandeau ' + t), csSync: async () => ({distant: connu ? {plan: 1} : {}}), obCompteConnu: r => !!(r && r.distant && r.distant.plan), obDraftDepuisEtat() {},
      setTimeout, Promise, Date, String});
    vm.runInContext(auth + '\n  }catch(e){obAuthBusy=false;}\n}', ctx);
    return {ctx, appels, positions};
  };
  /* Reconnectée après une déconnexion (on restait sur Mon compte, là où l’on s’était déconnecté) */
  const a = monter({onboarded: true}); await a.ctx.obStartAuth('apple', null);
  assert.deepEqual(a.appels, ['ferme', 'feuille fermée', 'onglet learn', 'bandeau Compte connecté']);
  assert.equal(a.positions.learn, 0, 'en haut de l’accueil');
  /* Sans abonnement : l’accueil derrière le paywall, pour le jour où il se referme */
  const b = monter({onboarded: true, bloque: true}); await b.ctx.obStartAuth('google', null);
  assert.deepEqual(b.appels, ['feuille fermée', 'onglet learn', 'page paywall']);
  assert.equal(vm.runInContext('obGarde&&obEntry', b.ctx), 'paywall');
  /* « J’ai déjà un compte », iPhone neuf : le compte existe → la fin de l’onboarding mène à l’accueil ; un compte vide → les questions */
  const c = monter({}); await c.ctx.obStartAuth('apple', null);
  assert.deepEqual(c.appels, ['suite']); assert.equal(c.ctx.draft.finConnexion, 'accueil');
  const d = monter({connu: false}); await d.ctx.obStartAuth('apple', null);
  assert.deepEqual(d.appels, ['page questions']); assert.equal(d.ctx.draft.finConnexion, undefined);
  /* La nouvelle inscrite, à la fin de l’onboarding : ce que son bouton a promis, rien de changé */
  const e = monter({finVoulue: 'home'}); await e.ctx.obStartAuth('apple', null);
  assert.deepEqual(e.appels, ['suite']); assert.equal(e.ctx.draft.finConnexion, undefined);
  /* La fin de l’onboarding : « accueil » ouvre l’onglet sans ouvrir de leçon ; « home » ouvre toujours la première leçon */
  const terminer = cut('function obTerminer(action){', '\nfunction celebrate(){');
  assert.ok(terminer.includes("}else if(action==='accueil'){\n    obVersAccueil();"));
  const i = terminer.indexOf("action==='accueil'"), j = terminer.indexOf('requestAnimationFrame(()=>openLesson(firstId))');
  assert.ok(i > 0 && j > i && !terminer.slice(i, terminer.indexOf('}else{', i)).includes('openLesson'), 'pas de leçon ouverte d’office');
  assert.ok(app.includes("function obApresCompte(){if(obAbonne())finishOnboard(draft.finVoulue||draft.finConnexion||'home');else obGoto('paywall');}"));
  assert.ok(app.includes("  finishOnboard(draft.finVoulue||draft.finConnexion||'home');}"), 'après le paywall aussi');
  assert.ok(!app.includes("draft.finConnexion='compte'"));
  /* Derrière l’onboarding encore ouvert, rien ne s’affiche par-dessus l’accueil (la note d’iOS, la page du widget) */
  assert.ok(cut('function accueilOccupe(){', '\n}').includes("!!(root&&root.classList.contains('on'))"));
});
