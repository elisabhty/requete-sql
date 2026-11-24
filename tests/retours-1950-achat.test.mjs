// Les abonnements branchés sur RevenueCat (Elisa, 10 novembre, 19 h 50 : « ouvre RevenueCat et App Store Connect et fais-le »).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../achat.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function monde({cle = 'appl_test', natif = true, plugin} = {}) {
  const store = {};
  const win = {
    Capacitor: {isNativePlatform: () => natif, Plugins: plugin ? {Purchases: plugin} : {}},
  };
  const ctx = {
    window: win,
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    document: {visibilityState: 'visible', addEventListener() {}},
    Promise, Error, Object, Number, String,
  };
  vm.runInNewContext(src.replace(/var RC_CLE_IOS = '[^']*';/, `var RC_CLE_IOS = ${JSON.stringify(cle)};`), ctx);
  return {win, store};
}

function faux({actif = false, annuleAchat = false, dejaEssai = false} = {}) {
  const info = a => ({customerInfo: {entitlements: {active: a ? {premium: {}} : {}}}});
  const pq = (type, id, price, priceString, pricePerWeekString) => ({identifier: '$rc_' + type.toLowerCase(), packageType: type,
    product: {identifier: id, price, priceString, pricePerWeekString, currencyCode: 'USD'}});
  const appels = [];
  return {appels, plugin: {
    configure: o => { appels.push(['configure', o.apiKey]); return Promise.resolve(); },
    getCustomerInfo: () => Promise.resolve(info(actif)),
    getOfferings: () => Promise.resolve({current: {availablePackages: [
      pq('ANNUAL', 'fr.requete.app.annuel', 39.99, '39,99 $', '0,76 $'),
      pq('WEEKLY', 'fr.requete.app.hebdo', 4.99, '4,99 $', '4,99 $')]}}),
    checkTrialOrIntroductoryPriceEligibility: () => Promise.resolve({'fr.requete.app.annuel': {status: dejaEssai ? 1 : 2}}),
    purchasePackage: ({aPackage}) => { appels.push(['achat', aPackage.product.identifier]);
      return annuleAchat ? Promise.reject({code: '1', userCancelled: true}) : Promise.resolve(info(true)); },
    restorePurchases: () => Promise.resolve(info(true)),
  }};
}
const attendre = () => new Promise(r => setTimeout(r, 10));

test('sans clé, ou hors de l’app iPhone, rien n’est branché : le paywall garde « Continuer »', () => {
  assert.equal(monde({cle: '', plugin: faux().plugin}).win.REQUETE_ACHAT, undefined);
  assert.equal(monde({natif: false, plugin: faux().plugin}).win.REQUETE_ACHAT, undefined);
  assert.equal(monde({plugin: undefined}).win.REQUETE_ACHAT, undefined);
  assert.match(src, /var RC_CLE_IOS = 'appl_[A-Za-z0-9]+';/, 'la clé publique iOS de RevenueCat (22 h 50)');
  assert.match(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), /"@revenuecat\/purchases-capacitor"/);
});

test('l’achat passe le bon produit et ouvre l’app, l’annulation de la feuille Apple n’est pas une erreur', async () => {
  const f = faux(), {win, store} = monde({plugin: f.plugin});
  await attendre();
  assert.deepEqual(f.appels[0], ['configure', 'appl_test']);
  assert.equal(win.REQUETE_ACHAT.actif(), false);
  assert.equal(await win.REQUETE_ACHAT.acheter('an'), true);
  assert.deepEqual(f.appels.at(-1), ['achat', 'fr.requete.app.annuel']);
  assert.equal(win.REQUETE_ACHAT.actif(), true);
  assert.equal(store['requete-premium'], '1', 'gardé pour sauter le paywall à la prochaine ouverture');
  const g = faux({annuleAchat: true}), b = monde({plugin: g.plugin});
  await attendre();
  assert.equal(await b.win.REQUETE_ACHAT.acheter('semaine'), false);
  assert.deepEqual(g.appels.at(-1), ['achat', 'fr.requete.app.hebdo']);
});

test('prix de la boutique du pays, essai caché pour qui l’a déjà eu, restauration', async () => {
  const {win} = monde({plugin: faux({dejaEssai: true}).plugin});
  await attendre();
  assert.deepEqual({...win.REQUETE_ACHAT.prix('an')}, {prix: 39.99, texte: '39,99 $', parSemaine: '0,76 $', devise: 'USD', intro: null});
  assert.equal(win.REQUETE_ACHAT.essaiDispo('an'), false);
  assert.equal(win.REQUETE_ACHAT.essaiDispo('semaine'), true);
  assert.equal(await win.REQUETE_ACHAT.restaurer(), true);
  const deja = monde({plugin: faux({actif: true}).plugin});
  await attendre();
  assert.equal(deja.win.REQUETE_ACHAT.actif(), true);
});

test('le paywall affiche les prix de la boutique quand ils sont là, et charge achat.js', () => {
  assert.match(html, /<script src="achat\.js\?v=8"><\/script>/);
  /* 13 novembre, 2 h 20 : le prix et la devise de la boutique, écrits par l’app (obPrixEcrit) ; son texte tout fait seulement sans devise */
  assert.match(html, /function obPrixTexte\(k\)\{const b=obPrixBoutique\(k\);return b\?obPrixEcrit\(b\.prix,b\.devise,b\.texte\):obEuros\(OB_OFFRES\[k\]\.prix\);\}/);
  assert.match(html, /function obPrixEcrit\(prix,devise,texte\)\{return obDevise\(prix,devise\)\|\|String\(texte\|\|''\)\.replace\(\/ \/g,'\\u00a0'\);\}/);
  assert.match(html, /<b>\$\{obPrixTexte\(k\)\}<\/b> \$\{obPh\(sur\(OB_OFFRES\[k\]\.par\)\)\}/);
  assert.match(html, /\$\{obPh\('Soit'\)\} <\/span><b>\$\{parSemaineTexte\}<\/b> \$\{obPh\('par semaine'\)\}/);
  /* 15 novembre : ces phrases passent par leur gabarit (obPh), traduit dans la langue de l’appli */
  assert.ok(html.includes("obPh('S’abonner pour {prix}',{prix})") && html.includes("obPh('{essai}, puis {prix} {par} à partir du {date}.'") && html.includes("obPh('{prix} aujourd’hui, puis {quand}.'"), 'le bouton et le pied suivent aussi');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /'\.\/achat\.js\?v=8',/);
});

/* 14 novembre, 19 h 12 (l’audit App Review, règle 3.1.2 ; Elisa : « On travaille sur essai 3 jours ») : l’essai vient de la boutique.
   Il ne s’affiche que si le produit a une offre de lancement gratuite et qu’Apple dit que ce compte y a droit (statut 2) ; sa durée
   est celle de la boutique. Un produit sans offre (3), un compte qui l’a déjà eue (1) ou une réponse inconnue (0) : pas d’essai. */
function boutique({statut = 2, intro = {price: 0, priceString: '0,00 €', cycles: 1, period: 'P3D', periodUnit: 'DAY', periodNumberOfUnits: 3}, eligibilite = true} = {}) {
  const info = {customerInfo: {entitlements: {active: {}}}};
  const pq = (type, id, price, introPrice) => ({identifier: '$rc_' + type.toLowerCase(), packageType: type,
    product: {identifier: id, price, priceString: price + ' €', pricePerWeekString: '', currencyCode: 'EUR', introPrice}});
  return {
    configure: () => Promise.resolve(), getCustomerInfo: () => Promise.resolve(info),
    getOfferings: () => Promise.resolve({current: {availablePackages: [pq('ANNUAL', 'fr.requete.app.annuel', 44.99, intro), pq('WEEKLY', 'fr.requete.app.hebdo', 5.99, null)]}}),
    checkTrialOrIntroductoryPriceEligibility: () => eligibilite ? Promise.resolve({'fr.requete.app.annuel': {status: statut}, 'fr.requete.app.hebdo': {status: 3}}) : Promise.reject(new Error('StoreKit')),
    purchasePackage: () => Promise.resolve(info), restorePurchases: () => Promise.resolve(info),
  };
}
test('l’essai vient de la boutique : offre gratuite et statut 2 seulement ; sa durée est celle d’Apple', async () => {
  const essai = async o => { const {win} = monde({plugin: boutique(o)}); await attendre(); const A = win.REQUETE_ACHAT; return [A.essai('an') && {...A.essai('an')}, A.essaiConnu('an'), A.essai('semaine'), A.essaiConnu('semaine')]; };
  assert.deepEqual(await essai({}), [{n: 3, unite: 'jour'}, true, null, true], 'offre gratuite de 3 jours, compte éligible');
  assert.deepEqual((await essai({statut: 3, intro: null}))[0], null, 'pas d’offre de lancement : pas d’essai');
  assert.deepEqual((await essai({statut: 1})).slice(0, 2), [null, true], 'déjà eu l’essai : pas d’essai, et c’est su');
  assert.deepEqual((await essai({statut: 0})).slice(0, 2), [null, false], 'Apple ne sait pas : pas d’essai promis, et on ne dit pas « aujourd’hui »');
  assert.deepEqual((await essai({eligibilite: false})).slice(0, 2), [null, false], 'pas de réponse : pareil');
  assert.deepEqual((await essai({intro: {price: 22.49, priceString: '22,49 €', cycles: 1, period: 'P1Y', periodUnit: 'YEAR', periodNumberOfUnits: 1}}))[0], null, 'une offre payante n’est pas un essai');
  assert.deepEqual((await essai({intro: {price: 0, priceString: '0 €', cycles: 1, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1}}))[0], {n: 1, unite: 'semaine'}, 'la durée de la boutique');
  assert.deepEqual((await essai({intro: {price: 0, priceString: '0 €', cycles: 1, period: 'P1M'}}))[0], {n: 1, unite: 'mois'}, 'lue dans la période ISO au besoin');
});

test('le paywall : l’essai, sa durée et la date du premier prélèvement viennent de la boutique ; sans réponse, ni « 0 € » ni « aujourd’hui »', () => {
  const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };
  const ctx = vm.createContext({natifTexte: x => x, appAndroid: () => false, window: {}, OB_OFFRES: {an: {essai: 3}, semaine: {}}});
  vm.runInContext(cut('function obLangue(){', 'function obEuros(x){'), ctx);
  vm.runInContext(cut('function obEssai(k){', '/* Les prix de la boutique Apple du pays de la personne'), ctx);
  vm.runInContext(cut('function obDateApresEssai(e){', '\n/* ---------- Le paywall, refonte'), ctx);
  assert.deepEqual({...ctx.obEssai('an')}, {n: 3, unite: 'jour'}, 'sans boutique (le site) : l’essai d’OB_OFFRES');
  assert.equal(ctx.obEssai('semaine'), null);
  ctx.window.REQUETE_ACHAT = {essai: k => k === 'an' ? {n: 1, unite: 'semaine'} : null, essaiConnu: () => true};
  assert.deepEqual({...ctx.obEssai('an')}, {n: 1, unite: 'semaine'}, 'dans l’app : la boutique décide');
  ctx.window.REQUETE_ACHAT = {essai: () => null, essaiConnu: () => false};
  assert.equal(ctx.obEssai('an'), null); assert.equal(ctx.obEssaiConnu('an'), false);
  assert.equal(ctx.obEssaiTexte({n: 3, unite: 'jour'}), '3 jours'); assert.equal(ctx.obEssaiTexte({n: 1, unite: 'semaine'}), '1 semaine');
  assert.equal(ctx.obEssaiTexte({n: 1, unite: 'mois'}), '1 mois'); assert.equal(ctx.obEssaiTexte(null), '');
  /* La date du premier prélèvement suit la durée */
  const dans = jours => { const d = new Date(); d.setDate(d.getDate() + jours); return d.toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'}).replace(/^1 /, '1er '); };
  assert.equal(ctx.obDateApresEssai({n: 1, unite: 'semaine'}), dans(7)); assert.equal(ctx.obDateApresEssai(3), dans(3));
  /* Le bouton, la pastille et le pied */
  assert.ok(html.includes("const libelle=essai?`Essayer gratuitement ${obEssaiTexte(essai)}`:obPh('S’abonner pour {prix}',{prix});"));
  assert.ok(html.includes('<i class="pw-essai">${obEssaiTexte(essaiAn)} d’essai</i>'));
  assert.ok(html.includes(':`<b class="pw-sans"${obNt()}>${prix} ${obPh(o.par)}.</b> Renouvellement automatique, sauf annulation 24&nbsp;h avant (réglages Apple). `);'), 'sans réponse : le prix et le renouvellement');
  assert.ok(!/jours d’essai/.test(html.replace(/\/\*[\s\S]*?\*\//g, '')), 'plus aucun « jours d’essai » écrit en dur');
});
