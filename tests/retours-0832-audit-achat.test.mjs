// 28 novembre, 8 h 32 (Elisa, après l'audit des abonnements iOS : « oui enregistre et corrige les erreurs ») : les trois anomalies
// du code d'achat. 1. Sans Capacitor, achat.js ne plante plus (C.getPlatform). 2. La feuille refermée se reconnaît à son code
// seulement, plus à un message qui contient « cancel ». 3. Un paiement en attente (code 20) et un achat passé que RevenueCat ne
// montre pas encore comme abonnement ont leur message à eux, et ne déclenchent jamais l'offre de bienvenue.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../achat.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const en = readFileSync(new URL('../langue-en.js', import.meta.url), 'utf8');

function monde({capacitor = true, plugin} = {}) {
  const store = {};
  const win = capacitor ? {Capacitor: {isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: plugin ? {Purchases: plugin} : {}}} : {};
  const ctx = {
    window: win,
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    document: {visibilityState: 'visible', addEventListener() {}},
    Promise, Error, Object, Number, String, Date, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout,
  };
  vm.runInNewContext(src, ctx);
  return win;
}

const info = a => ({customerInfo: {entitlements: {active: a ? {premium: {}} : {}}, requestDate: new Date().toISOString()}});
function plugin({achat, relecture = [false]} = {}) {
  const pq = (type, id) => ({identifier: '$rc_' + type.toLowerCase(), packageType: type, product: {identifier: id, price: 44.99, priceString: '44,99 €'}});
  let lu = 0;
  return {
    configure: () => Promise.resolve(),
    getCustomerInfo: () => { const a = lu === 0 ? false : relecture[Math.min(lu - 1, relecture.length - 1)]; lu++; return Promise.resolve(info(a)); },
    getOfferings: () => Promise.resolve({current: {availablePackages: [pq('ANNUAL', 'fr.requete.app.annuel'), pq('WEEKLY', 'fr.requete.app.hebdo')]}}),
    checkTrialOrIntroductoryPriceEligibility: () => Promise.resolve({'fr.requete.app.annuel': {status: 2}}),
    purchasePackage: () => achat(),
    restorePurchases: () => Promise.resolve(info(false)),
  };
}
const attendre = () => new Promise(r => setTimeout(r, 15));

test('sans Capacitor (hors de l’app), achat.js ne plante plus et ne branche rien', () => {
  let win;
  assert.doesNotThrow(() => { win = monde({capacitor: false}); });
  assert.equal(win.REQUETE_ACHAT, undefined);
  assert.ok(src.includes("var ANDROID = !!(C && typeof C.getPlatform === 'function' && C.getPlatform() === 'android');"));
});

test('la feuille refermée se reconnaît à son code (1), y compris sous data ; un message « cancel » seul n’en est pas une', async () => {
  const ferme = monde({plugin: plugin({achat: () => Promise.reject({code: '1', message: 'Purchase was cancelled.'})})});
  await attendre();
  assert.equal(await ferme.REQUETE_ACHAT.acheter('an'), false);
  const data = monde({plugin: plugin({achat: () => Promise.reject({data: {userCancelled: true, code: 1}})})});
  await attendre();
  assert.equal(await data.REQUETE_ACHAT.acheter('an'), false);
  const autre = monde({plugin: plugin({achat: () => Promise.reject({code: '2', message: 'The operation was cancelled by the store'})})});
  await attendre();
  await assert.rejects(autre.REQUETE_ACHAT.acheter('an'), e => e.code === '2' && autre.REQUETE_ACHAT.raison(e) === '');
  assert.ok(!/\/cancel\/i/.test(src), 'plus de reconnaissance par le message');
});

test('un paiement en attente (code 20) n’est ni une annulation ni un échec ordinaire', async () => {
  const w = monde({plugin: plugin({achat: () => Promise.reject({code: '20', message: 'The payment is pending.'})})});
  await attendre();
  await assert.rejects(w.REQUETE_ACHAT.acheter('an'), e => w.REQUETE_ACHAT.raison(e) === 'attente');
});

test('un achat passé sans abonnement visible : une relecture, puis une erreur à part (jamais false, donc jamais l’offre de bienvenue)', async () => {
  const rattrape = monde({plugin: plugin({achat: () => Promise.resolve(info(false)), relecture: [true]})});
  await attendre();
  assert.equal(await rattrape.REQUETE_ACHAT.acheter('an'), true, 'la relecture voit l’abonnement');
  const rien = monde({plugin: plugin({achat: () => Promise.resolve(info(false)), relecture: [false]})});
  await attendre();
  await assert.rejects(rien.REQUETE_ACHAT.acheter('an'), e => rien.REQUETE_ACHAT.raison(e) === 'non_confirme');
});

test('le paywall dit la bonne chose, en français et en anglais', () => {
  assert.ok(html.includes("if(r==='attente')return 'Ton paiement attend une validation. Requête se débloque dès qu’il est accepté.';"));
  assert.ok(html.includes("if(r==='non_confirme')return 'Ton achat est passé, mais sa confirmation tarde. Dans un instant, touche « Restaurer » en haut de l’écran.';"));
  assert.equal((html.match(/catch\(e\)\{obPwBusy=false;if\(live\)pwMessage\(pwEchecTexte\(e\)\);\}/g) || []).length, 2, 'les deux achats (offres et bienvenue)');
  assert.ok(en.includes('"Ton paiement attend une validation. Requête se débloque dès qu’il est accepté.": "Your payment is awaiting approval. Requête unlocks as soon as it’s accepted."'));
  assert.ok(en.includes('"Ton achat est passé, mais sa confirmation tarde. Dans un instant, touche « Restaurer » en haut de l’écran.": "Your purchase went through, but its confirmation is taking a while. In a moment, tap “Restore” at the top of the screen."'));
});
