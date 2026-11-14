/* Elisa, 14 novembre, 20 h 37 (l’audit App Review, décision 10 : « Cache ») : les pages du site ouvertes depuis l’appli (pages
   légales, FAQ) montraient « Bientôt sur Google Play » et « Bientôt » à côté d’English et d’Español. Apple refuse qu’une appli
   parle d’une autre plateforme (règle 2.3.10). Ouvertes depuis l’appli (?depuis=appli), elles cachent le badge et le choix de
   langue ; le site, lui, ne change pas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('decouvrir/vitrine.css');
const PAGES = ['index', 'module', 'conditions', 'confidentialite', 'mentions-legales'];

test('l’appli ouvre les pages du site avec ?depuis=appli, avant l’ancre', () => {
  const code = app.slice(app.indexOf("const SITE_URL='https://requeteapp.com/';"), app.indexOf('/* La date d’inscription'));
  const ctx = vm.createContext({ appliNative: () => true, location: { href: 'capacitor://localhost/index.html' }, URL });
  vm.runInContext("const LEGAL_PAGES={privacy:'decouvrir/confidentialite.html',terms:'decouvrir/conditions.html',mentions:'decouvrir/mentions-legales.html'};" + code, ctx);
  assert.equal(ctx.legalUrl('terms'), 'https://requeteapp.com/decouvrir/conditions.html?depuis=appli');
  assert.equal(ctx.legalUrl('mentions'), 'https://requeteapp.com/decouvrir/mentions-legales.html?depuis=appli');
  assert.equal(ctx.siteUrl('decouvrir/#faq'), 'https://requeteapp.com/decouvrir/?depuis=appli#faq');
  assert.equal(ctx.siteUrl('decouvrir/confidentialite.html#suppression'), 'https://requeteapp.com/decouvrir/confidentialite.html?depuis=appli#suppression');
});

test('chaque page du site se marque avant d’être dessinée ; la marque tient le temps de la visite', () => {
  for (const f of PAGES) {
    const h = lire(`decouvrir/${f}.html`);
    const i = h.indexOf("sessionStorage.setItem('rq-depuis-appli','1')"), j = h.indexOf('<link rel="stylesheet" href="vitrine.css?v=');
    assert.ok(i > 0 && i < j, `${f} : le script avant la feuille de style`);
    assert.ok(h.includes('Bientôt sur Google Play'), `${f} : le site garde le badge`);
  }
  const marque = lire('decouvrir/conditions.html').match(/<script>\/\* 14 novembre \(l’audit App Review, décision 10\)[\s\S]*?\*\/\n(try\{[\s\S]*?\})<\/script>/)[1];
  const page = (search, stock = {}) => {
    const classes = new Set();
    const ctx = vm.createContext({ location: { search }, sessionStorage: { getItem: k => stock[k] ?? null, setItem: (k, v) => { stock[k] = v; } },
      document: { documentElement: { classList: { add: c => classes.add(c) } } } });
    vm.runInContext(marque, ctx);
    return { classes, stock };
  };
  assert.ok(page('?depuis=appli').classes.has('depuis-appli'));
  const visite = page('?depuis=appli').stock;
  assert.ok(page('', visite).classes.has('depuis-appli'), 'une autre page de la même visite (un lien de la FAQ)');
  assert.ok(!page('').classes.has('depuis-appli') && !page('?depuis=applis').classes.has('depuis-appli'), 'le site, ouvert ailleurs : rien ne change');
});

test('la feuille du site cache le badge Google Play et le choix de langue, seulement depuis l’appli', () => {
  assert.ok(css.includes('html.depuis-appli .store.soon,html.depuis-appli .lang,html.depuis-appli .lang-row{display:none!important}'));
  assert.ok(css.includes('.store.soon{background:#F3F0FF;'), 'ailleurs, le badge reste');
});
