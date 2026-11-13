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
  assert.ok(h.includes('<b>39,99 $US</b> / an'), 'le prix facturé (le prix et la devise d’Apple, écrits par l’app depuis le 13 novembre)');
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

/* Elisa, 13 novembre, 2 h 20 (sa capture TestFlight de l’offre de bienvenue : « $19.99, 0,38 $US et 20 $US se mélangent. Utilise les
   prix localisés fournis par l’App Store ») : le texte tout fait de la boutique suit les réglages de l’iPhone (« $39.99 » sur le
   sien ce jour-là, « 39,99 $US » le 11 novembre). Le prix facturé s’écrit maintenant comme le reste : le prix et la devise que
   donne l’App Store, par obDevise. Et sur la carte annuelle, « 3 jours d’essai » et « Soit 0,76 $US par semaine » se touchaient
   (6 px de recouvrement à 393 px) : rangées ensemble, un peu resserrées quand le montant est long, la seconde passe dessous si la
   place manque encore. Mesuré sur 7 tailles d’iPhone (375 à 440 px), en dollars et en euros : côte à côte partout, 6 px d’écart au
   moins ; en euros, rien ne bouge. */
test('13 novembre, 2 h 20 : un seul format de prix, quel que soit le texte de la boutique ; les deux pastilles de l’annuelle ne se touchent plus', () => {
  const anglais = k => k === 'an' ? { prix: 39.99, texte: '$39.99', parSemaine: '$0.76', devise: 'USD' } : { prix: 4.99, texte: '$4.99', parSemaine: '$4.99', devise: 'USD' };
  const m = monter({ achat: { acheter: async () => true, prix: anglais } }), h = nb(m.ctx.obPaywallHTML());
  assert.ok(h.includes('<b>39,99 $US</b> / an') && h.includes('<b>4,99 $US</b> / semaine') && h.includes('<b>0,76 $US</b> par semaine') && h.includes('<b>219 $US</b>') && h.includes('<b>0 $US</b>'));
  assert.doesNotMatch(h.replace(/<[^>]+>/g, ' '), /\$\d|\d\.\d\d/, 'plus un seul « $39.99 » à l’anglaise (dans le texte, hors dessins)');
  assert.equal(nb(m.ctx.obPrixTexte('an')), nb(monter({ achat: { acheter: async () => true, prix: usd } }).ctx.obPrixTexte('an')), 'le même prix, que la boutique écrive « $39.99 » ou « 39,99 $US »');
  /* Les décimales sont celles de la devise ; entier : sans décimales ; sans devise : rien (et le texte de la boutique pour le prix) */
  const d = m.ctx.obDevise;
  assert.deepEqual([nb(d(0.76, 'USD')), nb(d(22.5, 'EUR')), nb(d(266, 'EUR', true)), nb(d(3000, 'JPY')), d(1, '')], ['0,76 $US', '22,50 €', '266 €', '3 000 JPY', '']);
  assert.equal(nb(m.ctx.obPrixEcrit(39.99, '', '39,99 $')), '39,99 $');
  assert.ok(!/ /.test(m.ctx.obPrixTexte('an')), 'un prix ne se coupe pas entre le nombre et la devise');
  /* Les deux pastilles, rangées ensemble */
  assert.ok(h.includes('<span class="pw-o-l is-long"><span class="pw-o-e"><i class="pw-essai">3 jours d’essai</i></span><span class="pw-o-s"><span class="pw-soit">Soit </span><b>0,76 $US</b> par semaine</span></span>'), 'un montant long : resserrées');
  const f = nb(monter({ achat: { acheter: async () => true, prix: eur } }).ctx.obPaywallHTML());
  assert.ok(f.includes('<span class="pw-o-l"><span class="pw-o-e"><i class="pw-essai">3 jours d’essai</i></span><span class="pw-o-s"><span class="pw-soit">Soit </span><b>0,86 €</b> par semaine</span></span>'), 'en euros : comme avant');
  const deja = nb(monter({ achat: { acheter: async () => true, prix: anglais, essaiDispo: () => false } }).ctx.obPaywallHTML());
  assert.ok(deja.includes('<span class="pw-o-l"><span class="pw-o-s">'), 'sans essai : une seule pastille, rien à resserrer');
  const css = readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  for (const r of ['html #onboarding.ob-vitrine .pw-o-l{grid-row:e-start/e-end;grid-column:e-start/s-end;display:flex;flex-wrap:wrap;align-items:center;gap:5px 8px;min-width:0}',
    'html #onboarding.ob-vitrine .pw-o-l .pw-o-s{margin-left:auto}', 'html #onboarding.ob-vitrine .pw-o-l.is-long{column-gap:5px}',
    'html #onboarding.ob-vitrine .pw-o-l.is-long :is(.pw-o-s,.pw-essai){padding-left:7px;padding-right:7px}', 'html #onboarding.ob-vitrine .pw-o-l.is-long .pw-o-s{font-size:12px}'])
    assert.ok(css.includes(r), r);
  assert.ok(!css.includes('.pw-soit{display:none}'), '« Soit » reste écrit');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=65">') && readFileSync(new URL('../sw.js', import.meta.url), 'utf8').includes("'./onboarding-vitrine.css?v=65',"));
});
