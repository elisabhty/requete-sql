// L’offre de bienvenue à −50 % (Elisa, 12 novembre, 16 h 03 : « est-ce qu’on peut avoir une offre à −50 ? » ; 16 h 34 : « fais-le
// pour le −50 »). Un deuxième abonnement annuel avec une offre de lancement Apple « payée d’avance, 1 an » ; le paywall la propose
// une fois à qui referme la feuille de paiement, sans compte à rebours ni prix écrit en dur.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = lire('achat.js'), html = lire('index.html'), css = lire('onboarding-vitrine.css');

function monde(plugin) {
  const store = {};
  const win = {Capacitor: {isNativePlatform: () => true, Plugins: {Purchases: plugin}}};
  vm.runInNewContext(src, {window: win, document: {visibilityState: 'visible', addEventListener() {}},
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }}, Promise, Error, Object, Number, String});
  return win.REQUETE_ACHAT;
}
const INTRO_AN = {price: 22.49, priceString: '22,49 €', cycles: 1, period: 'P1Y', periodUnit: 'YEAR', periodNumberOfUnits: 1};
function faux({statut = 2, intro = INTRO_AN, avec = true, typeBienvenue = 'CUSTOM'} = {}) {
  const info = a => ({customerInfo: {entitlements: {active: a ? {premium: {}} : {}}}});
  const pq = (type, id, price, priceString, introPrice) => ({identifier: type, packageType: type, product: {identifier: id, price, priceString, currencyCode: 'EUR', introPrice: introPrice || null}});
  const liste = [pq('ANNUAL', 'fr.requete.app.annuel', 44.99, '44,99 €', {price: 0, priceString: '0 €', cycles: 1, period: 'P3D', periodUnit: 'DAY', periodNumberOfUnits: 3}),
    pq('WEEKLY', 'fr.requete.app.hebdo', 5.99, '5,99 €')];
  if (avec) liste.push(pq(typeBienvenue, 'fr.requete.app.annuel.bienvenue', 44.99, '44,99 €', intro));
  const achats = [];
  return {achats, plugin: {
    configure: () => Promise.resolve(), getCustomerInfo: () => Promise.resolve(info(false)),
    getOfferings: () => Promise.resolve({current: {availablePackages: liste}}),
    checkTrialOrIntroductoryPriceEligibility: ({productIdentifiers}) => Promise.resolve(Object.fromEntries(productIdentifiers.map(id => [id, {status: /bienvenue$/.test(id) ? statut : 2}]))),
    purchasePackage: ({aPackage}) => { achats.push(aPackage.product.identifier); return Promise.resolve(info(true)); },
    restorePurchases: () => Promise.resolve(info(false)),
  }};
}
const attendre = () => new Promise(r => setTimeout(r, 10));

test('achat.js : le produit de bienvenue est une troisième offre, avec son prix de lancement', async () => {
  assert.match(src, /bienvenue:'fr\.requete\.app\.annuel\.bienvenue'/);
  const f = faux(), a = monde(f.plugin);
  await attendre();
  assert.equal(a.sortieDispo(), true);
  const p = a.prix('bienvenue');
  assert.equal(p.prix, 44.99); assert.equal(p.texte, '44,99 €');
  assert.deepEqual({...p.intro}, {prix: 22.49, texte: '22,49 €'});
  assert.equal(a.prix('an').intro, null, 'l’essai gratuit de l’annuel n’est pas un prix de lancement payant');
  assert.equal(a.prix('an').prix, 44.99, 'le paquet « an » reste l’annuel d’origine');
  assert.equal(await a.acheter('bienvenue'), true);
  assert.deepEqual(f.achats, ['fr.requete.app.annuel.bienvenue']);
  assert.equal(await a.acheter('an'), true);
  assert.equal(f.achats.at(-1), 'fr.requete.app.annuel');
});

test('achat.js : classé « annuel » dans RevenueCat, le produit de bienvenue ne prend jamais la place de l’annuel', async () => {
  const f = faux({typeBienvenue: 'ANNUAL'}), a = monde(f.plugin);
  await attendre();
  await a.acheter('an');
  assert.deepEqual(f.achats, ['fr.requete.app.annuel']);
  assert.equal(a.sortieDispo(), true);
});

test('achat.js : dans le doute, pas d’offre (personne ne lit « −50 % » pour payer le plein tarif)', async () => {
  for (const statut of [0, 1, 3]) {
    const a = monde(faux({statut}).plugin); await attendre();
    assert.equal(a.sortieDispo(), false, `statut ${statut} : Apple ne dit pas « éligible »`);
  }
  const sans = monde(faux({avec: false}).plugin); await attendre();
  assert.equal(sans.sortieDispo(), false, 'le produit n’est pas (encore) dans la boutique');
  assert.equal(sans.prix('bienvenue'), null);
  const cas = [null, {...INTRO_AN, price: 0, priceString: '0 €'}, {...INTRO_AN, period: 'P1M', periodUnit: 'MONTH'}, {...INTRO_AN, cycles: 3},
    {...INTRO_AN, price: 44.99, priceString: '44,99 €'}, {...INTRO_AN, price: 59.99, priceString: '59,99 €'}];
  for (const intro of cas) {
    const a = monde(faux({intro}).plugin); await attendre();
    assert.equal(a.sortieDispo(), false, JSON.stringify(intro));
  }
});

// ---------- le paywall (index.html) ----------
const bloc = html.slice(html.indexOf("const OB_SORTIE_VUE='requete-offre-bienvenue';"), html.indexOf('async function obPaywallRestaurer'));
/* Les espaces insécables (et fines) d’un montant, ramenées à une espace pour comparer ; les « &nbsp; » du HTML restent tels quels */
const nb = s => String(s).replace(/[\u00a0\u202f]/g, ' ');
const ecrit = html.slice(html.indexOf('function obPrixEcrit(prix,devise,texte){'), html.indexOf('function obPrixTexte(k){')) + html.slice(html.indexOf('function obDevise(x,devise,entier){'), html.indexOf('function obOffreInfo(){'));
function page({dispo = true, prix = {prix: 44.99, texte: '44,99 €', devise: 'EUR', intro: {prix: 22.49, texte: '22,49 €'}}, vue = false} = {}) {
  const store = vue ? {'requete-offre-bienvenue': '1'} : {}, stats = [], pieds = [], vues = [];
  const ctx = {window: {REQUETE_ACHAT: {sortieDispo: () => dispo, prix: k => (k === 'bienvenue' ? prix : null), acheter: () => Promise.resolve(false)}},
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    document: {getElementById: () => null}, obLock: false, obJustEntered: false, obPwBusy: false, paintOb: () => vues.push(ctx.estSortie()),
    prefersReduceMotion: () => true, stat: (t, v, d) => stats.push([t, d]), buzz() {}, esc: s => String(s), escAttr: s => String(s),
    legalUrl: k => 'https://requeteapp.com/' + k, obBackButton: () => '<button>Retour</button>', obAchatPret: () => true, obPaywallEntrer() {},
    obSetFooter: (...a) => pieds.push(a), mascotReduced: () => false, TOTAL: 71, CHALLENGES: {length: 477},
    PW_ICO: new Proxy({}, {get: () => '<svg></svg>'}), OB_OFFRES: {an: {semaines: 52}},
    Intl, Math, Number, String, Object, Promise, setTimeout};
  /* obDevise et obPrixEcrit : ceux de l’app (13 novembre, 2 h 20 : tous les montants de la même main) */
  vm.runInNewContext(ecrit + bloc + '\nthis.estSortie=()=>obPwSortie;this.api={obSortieInfo,obSortieProposer,obSortieHTML,obSortiePied,obPaywallVue,obSortieVue,obSortieRefuser};', ctx);
  return {...ctx.api, store, stats, pieds, vues};
}

test('le pourcentage et les montants viennent de la boutique, jamais du code', () => {
  const x = page().obSortieInfo();
  assert.equal(x.pct, 50);
  assert.equal(nb(x.intro), '22,49 €'); assert.equal(nb(x.plein), '44,99 €');
  assert.equal(nb(x.economie), '22,50 €');
  assert.ok(!('parSemaine' in x), '13 novembre, 2 h 20 : sa carte ne reprend pas le prix par semaine');
  const us = page({prix: {prix: 39.99, texte: '$39.99', devise: 'USD', intro: {prix: 27.99, texte: '$27.99'}}}).obSortieInfo();
  assert.equal(us.pct, 30, 'un autre prix dans un autre pays : le pourcentage suit');
  assert.equal(page({dispo: false}).obSortieInfo(), null);
  assert.equal(page({prix: null}).obSortieInfo(), null);
  assert.equal(page({prix: {prix: 44.99, texte: '44,99 €', devise: 'EUR', intro: null}}).obSortieInfo(), null);
  assert.doesNotMatch(bloc, /22[,.]49|44[,.]99|−50|-50\s*%/, 'ni prix ni pourcentage en dur dans le code de l’offre');
});

/* Elisa, 13 novembre, 2 h 20 (sa capture TestFlight de l’offre) : « Afficher un format monétaire cohérent : actuellement, $19.99,
   0,38 $US et 20 $US se mélangent. Utilise les prix localisés fournis par l’App Store. » Le texte tout fait de la boutique suivait
   les réglages de l’iPhone (« $19.99 »), l’app écrivait le reste à la française. Tout s’écrit maintenant de la même main : le prix
   et la devise de l’App Store, par obDevise. */
test('un seul format pour tous les montants, quel que soit le texte de la boutique', () => {
  const capture = {prix: 39.99, texte: '$39.99', devise: 'USD', intro: {prix: 19.99, texte: '$19.99'}};
  const p = page({prix: capture}), x = p.obSortieInfo();
  assert.deepEqual([nb(x.intro), nb(x.plein), nb(x.economie), x.pct], ['19,99 $US', '39,99 $US', '20 $US', 50]);
  const h = nb(p.obSortieHTML());
  p.obSortiePied();
  const pied = nb(p.pieds.at(-1)[4].html);
  for (const t of [h, pied]) assert.doesNotMatch(t, /\$\d|\d\.\d\d/, 'plus de « $19.99 » à l’anglaise');
  assert.ok(pied.includes('<b class="pw-sans">19,99 $US aujourd’hui pour la première année, puis 39,99 $US par an.</b>'));
  /* Le même iPhone réglé autrement donnait « 19,99 $US » tout fait : même résultat */
  const fr = page({prix: {...capture, texte: '39,99 $US', intro: {prix: 19.99, texte: '19,99 $US'}}}).obSortieInfo();
  assert.deepEqual([nb(fr.intro), nb(fr.plein), nb(fr.economie)], [nb(x.intro), nb(x.plein), nb(x.economie)]);
  /* Un prix ne se coupe jamais entre le nombre et la devise */
  assert.ok(!/ /.test(x.intro) && !/ /.test(x.plein) && !/ /.test(x.economie), 'des espaces insécables seulement');
  /* Une devise sans centimes s’écrit sans centimes ; sans devise connue, le texte de la boutique sert encore */
  const jp = page({prix: {prix: 6000, texte: '¥6,000', devise: 'JPY', intro: {prix: 3000, texte: '¥3,000'}}}).obSortieInfo();
  assert.deepEqual([nb(jp.intro), nb(jp.plein), nb(jp.economie)], ['3 000 JPY', '6 000 JPY', '3 000 JPY']);
  const sans = page({prix: {prix: 39.99, texte: '39,99 $', intro: {prix: 19.99, texte: '19,99 $'}}}).obSortieInfo();
  assert.deepEqual([nb(sans.intro), nb(sans.plein), sans.economie], ['19,99 $', '39,99 $', '']);
  assert.ok(!nb(page({prix: {prix: 39.99, texte: '39,99 $', intro: {prix: 19.99, texte: '19,99 $'}}}).obSortieHTML()).includes('Économise'), 'pas de montant inventé');
  /* Le paywall des offres passe par la même écriture */
  assert.match(html, /function obPrixTexte\(k\)\{const b=obPrixBoutique\(k\);return b\?obPrixEcrit\(b\.prix,b\.devise,b\.texte\):/);
});

test('proposée une seule fois d’elle-même, à la feuille d’Apple refermée', () => {
  assert.match(html, /if\(ok\)\{if\(typeof stat==='function'\)stat\(essai\?'essai':'achat',null,\{o\}\);obPaywallEntrer\(\);return;\}\s*\/\*[^*]*\*\/\s*if\(obSortieProposer\(\)\)return;\}/);
  const p = page();
  assert.equal(p.obSortieProposer(), true);
  assert.equal(p.store['requete-offre-bienvenue'], '1');
  assert.equal(JSON.stringify(p.stats), JSON.stringify([['offre', {o: 'bienvenue'}]]), 'compté avec un type que le serveur accepte déjà');
  assert.deepEqual(p.vues, [true]);
  p.obSortieRefuser();
  assert.deepEqual(p.vues, [true, false], '« Non merci » ramène aux offres');
  assert.equal(p.obSortieProposer(), false, 'elle ne revient pas d’elle-même');
  assert.equal(page({dispo: false}).obSortieProposer(), false);
  assert.match(html, /if\(OB_SLIDES\[obStep\]==='paywall'&&obPwSortie\)\{obSortieRefuser\(\);return;\}/, '« Retour » aussi');
  assert.match(html, /const sortie=obSortieVue\(\)\?obSortieInfo\(\):null;/, 'une fois vue, elle reste dans la barre du haut des offres');
  assert.match(html, /class="pw-lien pw-rappel" onclick="obPaywallVue\(true\)">Offre −\$\{sortie\.pct\}/);
});

/* 13 novembre, 2 h 20, son texte : « Débloque tout Requête pendant un an. » ; dans la carte « Ton accès annuel », « 19,99 $US au
   lieu de 39,99 $US » (barré), « pour la première année, puis 39,99 $US/an. » ; « Résiliable à tout moment » à la place de « Payé
   aujourd’hui » ; le bouton « J’en profite à −50 % », « Non merci » dessous. Ce qui est payé aujourd’hui reste dit sous le bouton. */
test('la page dit ce qui est facturé aujourd’hui, ensuite, et qu’il n’y a pas d’essai', () => {
  const p = page(), h = nb(p.obSortieHTML());
  assert.match(h, /<span class="pw-tag">Offre de bienvenue&nbsp;🎁<\/span>/);
  assert.match(h, /<em>−50&nbsp;%<\/em> sur ta première année/);
  assert.match(h, /<p class="pw-but">Débloque tout Requête pendant un&nbsp;an\.<\/p>/);
  assert.match(h, /<span class="pw-s-t" aria-hidden="true">Ton accès annuel<\/span>/);
  assert.match(h, /<b>22,49 €<\/b><span class="pw-s-au">au lieu de <s>44,99 €<\/s><\/span>/);
  assert.match(h, /<span class="pw-s-puis">pour la première année, puis 44,99 €\/an\.<\/span>/);
  assert.match(h, /Économise<br><b>22,50 €<\/b>/); assert.match(h, /Accès<br><b>illimité<\/b>/);
  assert.match(h, /Résiliable à<br><b>tout moment<\/b>/);
  assert.doesNotMatch(h, /Payé<br>|par semaine|Annuel, la première année|Tout Requête pendant un an&nbsp;:/, 'l’ancien texte est parti');
  assert.match(h, /aria-label="Ton accès annuel : 22,49 € au lieu de 44,99 € pour la première année, puis 44,99 € par an\. Résiliable à tout moment\."/, 'lu d’une traite par VoiceOver');
  p.obSortiePied();
  const [cta, , non, , note] = p.pieds.at(-1);
  assert.equal(nb(cta), 'J’en profite à −50 %'); assert.equal(non, 'Non merci');
  assert.match(nb(note.html), /<b class="pw-sans">22,49 € aujourd’hui pour la première année, puis 44,99 € par an\.<\/b> Pas d’essai gratuit sur cette offre\. Renouvellement automatique/);
  assert.match(note.html, /Conditions<\/a> · <a[^>]*>Confidentialité/);
  assert.doesNotMatch(bloc, /offre limitée|dernière chance|plus que|expire|minuteur|compte à rebours.*setInterval/i, 'aucune pression');
  assert.doesNotMatch(bloc, /prochainement|bientôt/i);
  assert.equal(page({dispo: false}).obSortieHTML(), '');
});

test('l’achat de l’offre passe le produit de bienvenue, et la vue ne survit pas hors du paywall', () => {
  assert.match(bloc, /await window\.REQUETE_ACHAT\.acheter\('bienvenue'\)/);
  assert.match(bloc, /stat\('achat',null,\{o:'bienvenue'\}\)/);
  assert.match(html, /if\(obPwSortie&&\(slide!=='paywall'\|\|!obSortieInfo\(\)\)\)obPwSortie=false;/);
  assert.match(html, /if\(obPwSortie\)\{html=obSortieHTML\(\);obSortiePied\(\);\}\s*else\{html=obPaywallHTML\(\);obPaywallPied\(\);\}/);
  assert.match(html, /function obPaywallEntrer\(\)\{obPwSortie=false;/);
  assert.match(html, /classList\.toggle\('ob-sortie-step',slide==='paywall'&&!obLegalMode&&obPwSortie\)/);
});

test('sa carte et son rappel ont leur style', () => {
  for (const sel of ['.pw-sortie{', '.pw-s-p b{', '.pw-s-p s{', '.pw-s-puis{', '.pw-s-au{', '.pw-rappel{', '.pw-top-d{', '.ob-sortie-step #ob-skip{'])
    assert.ok(css.includes('html #onboarding.ob-vitrine' + (sel.startsWith('.ob-sortie') ? sel : ' ' + sel)), sel);
  /* 13 novembre, 2 h 20 : « au lieu de » et le plein tarif barré restent ensemble ; les repères prennent la place de leur texte */
  assert.ok(css.includes('html #onboarding.ob-vitrine .pw-s-au{color:var(--v-ink-2);font:600 14.5px/1 var(--v-ui);white-space:nowrap}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .pw-sortie .pw-o-plus{grid-template-columns:auto auto auto}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-paywall.is-sortie .pw-but{text-wrap:balance}'));
  assert.match(css, /#onboarding\.ob-vitrine\.ob-enter \.pw-sortie\{animation:pwMonte/);
});
