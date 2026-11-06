/* Elisa, 6 novembre, 10 h 40 : « Tu n’as pas mis le bouton widget et évaluer l’application », avec la capture de référence
   (« Widgets de l’écran d’accueil », « Widgets de l’écran verrouillé », « Évaluer l’application »).
   Le groupe « Sur ton iPhone » n’existait que dans l’app iPhone ; dans Safari, il manquait tout entier.
   - sur un iPhone, le groupe se voit aussi dans Safari : les deux widgets, puis « Évaluer l’application » (une étoile) ;
   - dans Safari, les feuilles des widgets disent qu’ils viennent avec l’app, bientôt sur l’App Store ;
   - « Évaluer l’application » : dans l’app, la page « Écrire un avis » ; sur le web, tant que l’app n’est pas sortie, un mot
     « Bientôt sur l’App Store » (le jour de la sortie, appStoreEnLigne() renvoie true) ;
   - une app sans le widget n’affiche pas de mode d’emploi qui n’y marcherait pas ; un ordinateur n’a pas le groupe. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const compte = cut('function renderCompte(){', '\nfunction ');
const noter = cut("const APP_STORE_ID='", '\n/* Se déconnecter');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';

/* Les fonctions de « Évaluer l’application », exécutées : un iPhone ou non, l’app ou Safari, sortie ou pas. */
function monde({ ua = IPHONE, natif = false, pont = null, enLigne = false } = {}) {
  const vu = { info: [], ouvert: [], natif: [], href: null };
  const ctx = vm.createContext({
    navigator: ua == null ? undefined : { userAgent: ua },
    document: { documentElement: { classList: { contains: c => c === 'is-native' && natif } } },
    ilePont: () => pont && { nativePromise: (p, m, o) => { vu.natif.push([p, m, o.url]); return Promise.resolve(); } },
    lqInfo: (t, x, i) => vu.info.push([t, x, i]),
    window: { open: (u, c, f) => vu.ouvert.push([u, c, f]) },
    location: { set href(u) { vu.href = u; } },
  });
  vm.runInContext(enLigne ? noter.replace('function appStoreEnLigne(){return false;}', 'function appStoreEnLigne(){return true;}') : noter, ctx);
  return { ctx, vu };
}

test('Mon compte : le groupe « Sur ton iPhone » se voit aussi dans Safari sur iPhone, pas sur un ordinateur', () => {
  assert.ok(compte.includes("const widgetsIci=typeof obWidgetPossible==='function'&&obWidgetPossible();"), 'l’app et son widget');
  assert.ok(compte.includes('const widgetsVus=widgetsIci||(!appliNative()&&iphoneWeb());'), 'les widgets : l’app qui les a, ou Safari sur iPhone');
  assert.ok(compte.includes('const surIphone=widgetsVus||appliNative();'), 'le groupe : sur iPhone, l’app ou Safari');
  assert.ok(compte.includes('${surIphone?`<div class="account-settings-group">\n          <p class="account-settings-group-title">Sur ton iPhone</p>'), 'le groupe');
  assert.ok(compte.includes("${widgetsVus?`<button class=\"account-setting-row\" type=\"button\" onclick=\"openPlusDetails('plus-widget-accueil')\">"), 'les lignes des widgets');
  assert.ok(compte.includes('${widgetsVus?`<details class="plus-details plus-widget" id="plus-widget-accueil" ontoggle="wtuToggle(this)">'), 'leurs feuilles');
  assert.ok(!compte.includes('${widgetsIci||appliNative()?'), 'plus l’ancienne condition, qui cachait tout dans Safari');
  /* la décision, rejouée pour chaque appareil */
  const decide = (widgetsIci, natif, iphone) => { const widgetsVus = widgetsIci || (!natif && iphone); return { groupe: widgetsVus || natif, widgets: widgetsVus }; };
  assert.deepEqual(decide(false, false, true), { groupe: true, widgets: true }, 'Safari sur iPhone : tout');
  assert.deepEqual(decide(true, true, true), { groupe: true, widgets: true }, 'l’app avec son widget : tout');
  assert.deepEqual(decide(false, true, true), { groupe: true, widgets: false }, 'une app sans widget : seulement « Évaluer »');
  assert.deepEqual(decide(false, false, false), { groupe: false, widgets: false }, 'un ordinateur : rien');
});

test('« Évaluer l’application » : une étoile, toujours dans le groupe, et ce qu’elle fait selon l’endroit', () => {
  const g = compte.slice(compte.indexOf('Sur ton iPhone</p>'), compte.indexOf('Compte et assistance</p>'));
  const ligne = '<button class="account-setting-row" type="button" onclick="noterAppli()"><span class="plus-row-icon is-stk">${lqStkSvg(\'etoile\')}</span><span><b>Évaluer l’application</b><small>${appliNative()||appStoreEnLigne()?\'Ton avis sur l’App Store aide d’autres à nous trouver\':\'Bientôt sur l’App Store\'}</small></span>';
  assert.ok(g.includes(ligne), 'la ligne, avec son étoile et son sous-titre');
  assert.ok(g.indexOf("openPlusDetails('plus-widget-verrou')") < g.indexOf('onclick="noterAppli()"'), 'après les deux widgets');
  assert.ok(!app.includes('<b>Noter Requête</b>'), 'le nom de la capture de référence');
  assert.ok(app.includes("    etoile:['<path d=\"M24 4.6l5.7 11.5"), 'l’autocollant étoile, en deux couches comme les autres');
  assert.ok(app.includes("const LQ_ASK_STK={'⭐':'etoile',"), 'le mot « Bientôt » porte la même étoile');
  /* des fonctions, pas des constantes : Mon compte peut se dessiner avant que le script n’arrive à leur ligne */
  assert.ok(app.includes('function appStoreEnLigne(){return false;}') && app.includes('function iphoneWeb(){'), 'hissées');
  assert.ok(!/const (APP_STORE_EN_LIGNE|appStoreEnLigne|iphoneWeb)\b/.test(app));
});

test('iphoneWeb : un iPhone, et rien d’autre ; sans navigator, pas d’erreur', () => {
  const ok = ua => monde({ ua }).ctx.iphoneWeb();
  assert.equal(ok(IPHONE), true);
  assert.equal(ok(MAC), false, 'un Mac (et un iPad, qui se dit Mac dans Safari)');
  assert.equal(ok(ANDROID), false);
  assert.equal(ok(null), false, 'aucun navigateur');
});

test('noterAppli : l’app ouvre « Écrire un avis » ; Safari dit « Bientôt » ; après la sortie, la fiche de l’App Store', async () => {
  { const { ctx, vu } = monde({ natif: true, pont: true }); ctx.noterAppli(); await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(vu.natif, [['RequeteWidget', 'ouvrir', 'itms-apps://itunes.apple.com/app/id6830361256?action=write-review']], 'l’app : la page « Écrire un avis »');
    assert.equal(vu.info.length + vu.ouvert.length, 0); }
  { const { ctx, vu } = monde(); ctx.noterAppli();
    assert.equal(vu.info.length, 1, 'Safari, avant la sortie : un mot');
    const [t, x, i] = vu.info[0];
    assert.equal(t, 'Bientôt sur l’App Store'); assert.equal(i, '⭐');
    assert.ok(x.includes('Tu pourras l’évaluer dès sa sortie :'), 'une espace insécable avant les deux-points');
    assert.equal(vu.ouvert.length, 0, 'pas de page vide de l’App Store'); }
  { const { ctx, vu } = monde({ enLigne: true }); ctx.noterAppli();
    assert.deepEqual(vu.ouvert, [['https://apps.apple.com/app/id6830361256?action=write-review', '_blank', 'noopener']], 'après la sortie : la fiche');
    assert.equal(vu.info.length, 0); }
});

test('Les feuilles des widgets, dans Safari : un mot pour dire qu’ils viennent avec l’app', () => {
  const f = cut('function wtuFeuilleHTML(k){', '\n}\n');
  assert.ok(f.includes("const web=!(typeof appliNative==='function'&&appliNative());"), 'seulement hors de l’app');
  assert.ok(f.includes('<p class="wtu-web"><b>Avec l’app Requête pour iPhone</b>'), 'le titre du mot');
  assert.ok(f.includes('Les widgets viennent avec l’app, bientôt sur l’App Store. Voici comment les ajouter.'), 'avant la sortie');
  assert.ok(f.includes('Installe-la depuis l’App Store, puis suis ces étapes.'), 'après la sortie');
  assert.ok(f.indexOf('wtu-web') < f.indexOf("k==='verrou'?wtuVerrouHTML():wtuAccueilHTML()"), 'avant le tutoriel');
  assert.ok(/html\.lq \.wtu-web\{[^}]+\}/.test(lq) && /html\.lq \.wtu-web b\{[^}]+\}/.test(lq), 'son style');
});
