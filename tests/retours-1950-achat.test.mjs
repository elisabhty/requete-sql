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
  vm.runInNewContext(src.replace("var RC_CLE_IOS = '';", `var RC_CLE_IOS = ${JSON.stringify(cle)};`), ctx);
  return {win, store};
}

function faux({actif = false, annuleAchat = false, dejaEssai = false} = {}) {
  const info = a => ({customerInfo: {entitlements: {active: a ? {premium: {}} : {}}}});
  const pq = (type, id, price, priceString, pricePerWeekString) => ({identifier: '$rc_' + type.toLowerCase(), packageType: type,
    product: {identifier: id, price, priceString, pricePerWeekString}});
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
  assert.match(src, /var RC_CLE_IOS = '';/, 'la clé reste vide dans le dépôt tant qu’Elisa ne l’a pas donnée');
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
  assert.deepEqual({...win.REQUETE_ACHAT.prix('an')}, {prix: 39.99, texte: '39,99 $', parSemaine: '0,76 $'});
  assert.equal(win.REQUETE_ACHAT.essaiDispo('an'), false);
  assert.equal(win.REQUETE_ACHAT.essaiDispo('semaine'), true);
  assert.equal(await win.REQUETE_ACHAT.restaurer(), true);
  const deja = monde({plugin: faux({actif: true}).plugin});
  await attendre();
  assert.equal(deja.win.REQUETE_ACHAT.actif(), true);
});

test('le paywall affiche les prix de la boutique quand ils sont là, et charge achat.js', () => {
  assert.match(html, /<script src="achat\.js\?v=1"><\/script>/);
  assert.match(html, /function obPrixTexte\(k\)\{const b=obPrixBoutique\(k\);return b\?b\.texte:obEuros\(OB_OFFRES\[k\]\.prix\);\}/);
  assert.match(html, /<b>\$\{obPrixTexte\(k\)\}<\/b> \$\{x\.par\}/);
  assert.match(html, /soit \$\{parSemaineTexte\} par semaine/);
  assert.equal((html.match(/\$\{prix\} \$\{o\.par\}/g) || []).length, 2, 'le pied (essai et sans essai) suit aussi');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /'\.\/achat\.js\?v=1',/);
});
