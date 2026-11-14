/* Elisa, 14 novembre, 12 h 03 (« Comment sécuriser cette partie au maximum », après le compte facultatif) : dans l’app iPhone, le
   paywall ne s’ouvre plus jamais tout seul. Avant, sans module d’achat (RevenueCat absent ou achat.js en panne), il
   montrait « Continuer » et son bouton jaune laissait entrer sans payer.
   - App iPhone sans module d’achat : « Les offres ne se chargent pas », « Réessayer » ; ni « Continuer », ni entrée gratuite.
   - Hors de l’app iPhone (mise au point, tests ; le site renvoie vers decouvrir/) : « Continuer », comme avant.
   - Une abonnée déjà entrée n’est pas bloquée par une panne du module (la garde ne change pas). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

const monter = ({ natif, achat }) => {
  const appels = [];
  const window = {};
  if (natif) window.Capacitor = { isNativePlatform: () => true };
  if (achat) window.REQUETE_ACHAT = { acheter: async () => { appels.push('achat'); return true; }, prixEtat: () => 'oui', actif: () => false };
  const ctx = vm.createContext({ window, appels, draft: { offre: 'an' }, obPwBusy: false, document: { getElementById: () => null },
    stat() {}, buzz() {}, obEssai: () => 3, obSortieProposer: () => false, obPaywallPied() {}, obPaywallPrix: () => appels.push('repeint'),
    obPaywallEntrer: () => appels.push('entre'), location: { reload: () => appels.push('relance') } });
  vm.runInContext(cut('function obAchatPret(){', '\nfunction obApresPret(') + '\n' + cut('function obPrixEtat(){', '\n') + '\n'
    + cut('function obPaywallRecharger(){', '\nfunction obPaywallChoisir(') + '\n' + cut('function obPaywallPasser(){', '\nfunction obPaywallEntrer(') + '\n'
    + cut('async function obPaywallAcheter(){', '\n/* ---------- L’offre de bienvenue'), ctx);
  return { ctx, appels };
};

test('app iPhone sans module d’achat : pas d’entrée gratuite, « Les offres ne se chargent pas »', async () => {
  const { ctx, appels } = monter({ natif: true, achat: false });
  assert.equal(ctx.obAppIphone(), true);
  assert.equal(ctx.obPaywallOuvert(), false);
  assert.equal(ctx.obPrixEtat(), 'echec', '« Les offres ne se chargent pas » et « Réessayer »');
  ctx.obPaywallPasser();
  await ctx.obPaywallAcheter();
  assert.deepEqual(appels, [], 'ni « Continuer » ni le bouton jaune ne font entrer');
  ctx.obPaywallRecharger();
  assert.deepEqual(appels, ['repeint'], '« Réessayer » regarde à nouveau, sans relancer l’appli (les réponses de l’onboarding restent)');
});

test('app iPhone avec le module d’achat : seul le paiement fait entrer', async () => {
  const { ctx, appels } = monter({ natif: true, achat: true });
  assert.equal(ctx.obPaywallOuvert(), false);
  assert.equal(ctx.obPrixEtat(), 'oui');
  ctx.obPaywallPasser();
  assert.deepEqual(appels, []);
  await ctx.obPaywallAcheter();
  assert.deepEqual(appels, ['achat', 'entre']);
});

test('hors de l’app iPhone (mise au point, tests) : « Continuer », comme avant', async () => {
  const { ctx, appels } = monter({ natif: false, achat: false });
  assert.equal(ctx.obPaywallOuvert(), true);
  assert.equal(ctx.obPrixEtat(), 'oui');
  ctx.obPaywallPasser();
  await ctx.obPaywallAcheter();
  assert.deepEqual(appels, ['entre', 'entre']);
});

test('le paywall : « Continuer » seulement hors de l’app iPhone ; le bouton suivant passe par obPaywallOuvert ; la garde ne change pas', () => {
  assert.ok(app.includes(":obPaywallOuvert()?'<button type=\"button\" class=\"pw-lien pw-passer\" onclick=\"obPaywallPasser()\">Continuer</button>':'';"));
  assert.ok(app.includes("else if(slide==='paywall'){if(obPaywallOuvert())obPaywallPasser();}"));
  assert.ok(!app.includes("if(!obAchatPret())obPaywallPasser()"));
  assert.ok(cut('function obGardeEtat(){', '\n}').includes("if(!obAchatPret())return 'oui';"), 'une abonnée déjà entrée n’est pas bloquée par une panne du module');
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-14-audit-v3007';"), 'le cache de l’appli change');
});
