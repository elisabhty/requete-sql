// Elisa, 11 novembre, 19 h 02 : « Est-ce que tu penses que ça fonctionne ? » (sa capture TestFlight du paywall : « 39,99 $US / an »,
// « Soit 0.76 $ par semaine », « 0 € aujourd’hui », et la feuille d’Apple à 44,99 € par an). Les prix en dollars viennent de
// TestFlight (StoreKit y renvoie souvent des prix en dollars, la feuille d’Apple garde la vraie devise) ; mais le prix par semaine
// s’écrivait à l’anglaise et le « 0 € » ne suivait pas la devise : les deux suivent maintenant la boutique, écrits à la française.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const code = cut('const OB_OFFRES=', '\nfunction obFinSuivante(');
const fin = cut('function obCompteVisible(){', '/* ---------- Le paywall');
const nb = x => x.replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ');

const monter = ({ achat = null, live = null } = {}) => {
  const vers = [], timers = [];
  const ctx = vm.createContext({ window: achat ? { REQUETE_ACHAT: achat } : {}, draft: { name: 'Elisa', finVoulue: 'home' }, state: {}, TOTAL: 71, CHALLENGES: { length: 477 },
    OB_COMMUNAUTE: 1000, esc: s => String(s), escAttr: s => String(s), legalUrl: k => k, mascotReduced: () => false,
    obPlanInfo: () => ({ goal: 'Progresser en SQL', endLabel: '14 décembre', minutes: 20 }), obBackButton: () => '',
    obSetFooter() {}, buzz() {}, stat() {}, finishOnboard: a => vers.push(a), obGoto() {}, obConnexionMasquee: () => false,
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout() {},
    document: { querySelectorAll: () => [], getElementById: id => (id === 'pw-live' ? live : null) } });
  vm.runInContext(fin + code, ctx);
  return { ctx, vers, timers };
};
/* Ce que RevenueCat renvoyait sur son iPhone en TestFlight */
const usd = k => k === 'an' ? { prix: 39.99, texte: '39,99 $US', parSemaine: '0.76 $', devise: 'USD' } : { prix: 4.99, texte: '4,99 $US', parSemaine: '4.99 $', devise: 'USD' };
const eur = k => k === 'an' ? { prix: 44.99, texte: '44,99 €', parSemaine: '0.86 €', devise: 'EUR' } : { prix: 5.99, texte: '5,99 €', parSemaine: '5.99 €', devise: 'EUR' };

test('le prix par semaine et le « 0 aujourd’hui » suivent la devise de la boutique, écrits à la française', () => {
  const h = nb(monter({ achat: { acheter: async () => true, prix: usd } }).ctx.obPaywallHTML());
  assert.ok(h.includes('<b>39,99 $US</b> / an'), 'le prix facturé, tel qu’Apple le donne');
  assert.ok(h.includes('<span class="pw-soit">Soit </span><b>0,76 $US</b> par semaine'), h.match(/Soit [^/]*/)?.[0]);
  assert.ok(!h.includes('0.76'), 'plus de point décimal');
  assert.ok(h.includes('<b>0 $US</b><br>aujourd’hui') && !h.includes('0 €'), 'pas d’euros au milieu des dollars');
  assert.ok(h.includes('Économise<br><b>219 $US</b>') && h.includes('−85 %'), '4,99 × 52 − 39,99 = 219,49, arrondi à l’unité du dessous ; 84,6 % arrondi à 85');
  const f = nb(monter({ achat: { acheter: async () => true, prix: eur } }).ctx.obPaywallHTML());
  assert.ok(f.includes('<b>44,99 €</b> / an') && f.includes('<b>0,86 €</b> par semaine') && f.includes('<b>0 €</b><br>aujourd’hui') && f.includes('Économise<br><b>266 €</b>') && f.includes('−86 %'), 'en France');
  const sansAchat = nb(monter().ctx.obPaywallHTML());
  assert.ok(sansAchat.includes('<b>0,86 €</b> par semaine') && sansAchat.includes('<b>0 €</b><br>aujourd’hui'), 'sur le site, sans boutique : les prix d’Elisa');
});

test('la réponse de « Restaurer » s’efface au bout de 6 secondes', async () => {
  const live = { textContent: '' };
  const { ctx, timers } = monter({ achat: { acheter: async () => true, restaurer: async () => false }, live });
  await ctx.obPaywallRestaurer();
  assert.equal(live.textContent, 'Aucun abonnement à restaurer sur ce compte Apple.');
  const [f, ms] = timers.at(-1);
  assert.equal(ms, 6000);
  f();
  assert.equal(live.textContent, '', 'effacée');
  const live2 = { textContent: '' };
  const err = monter({ achat: { acheter: async () => true, restaurer: async () => { throw new Error('x'); } }, live: live2 });
  await err.ctx.obPaywallRestaurer();
  assert.equal(live2.textContent, 'La restauration n’a pas abouti, réessaie.');
  live2.textContent = 'Le paiement n’a pas abouti. Tu n’as pas été débité·e, réessaie.';
  err.timers.at(-1)[0]();
  assert.ok(live2.textContent.startsWith('Le paiement'), 'un message plus récent n’est pas effacé');
});
