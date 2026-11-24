/* Elisa, 24 novembre, 19 h 48 : « Maintenant pousser la version Android chez Android ». L’appli Android (Capacitor, android/) :
   la même page, qui parle de Google Play et du téléphone à la place d’Apple et de l’iPhone, Google seul pour se connecter, la
   boutique et l’abonnement chez Google Play, le bouton Retour d’Android ; fabriquée sur GitHub (.github/workflows/android.yml). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const outils = entre(app, 'function appAndroid(){', '\n/* Le bouton Retour d’Android');
const ctxPour = plateforme => {
  const ctx = vm.createContext({window: {Capacitor: plateforme ? {isNativePlatform: () => true, getPlatform: () => plateforme} : undefined}, location: {href: ''}});
  vm.runInContext(outils + '\nthis.appAndroid=appAndroid;this.natifTexte=natifTexte;this.playFiche=playFiche;this.androidOuvrir=androidOuvrir;', ctx);
  return ctx;
};

test('sur Android, Apple et l’iPhone deviennent Google Play et le téléphone ; sur iPhone, rien ne change', () => {
  const a = ctxPour('android'), i = ctxPour('ios'), w = ctxPour(null);
  assert.equal(a.appAndroid(), true); assert.equal(i.appAndroid(), false); assert.equal(w.appAndroid(), false);
  const cas = [
    ['Paiement Apple', 'Paiement Google Play'],
    ['<b>9 €.</b> Renouvellement automatique, sauf annulation 24&nbsp;h avant (réglages Apple). ', '<b>9 €.</b> Renouvellement automatique, annulable à tout moment dans Google Play. '],
    ['Les prix sont ceux de l’App Store de ton pays.', 'Les prix sont ceux de Google Play dans ton pays.'],
    ['Aucun abonnement à restaurer sur ce compte Apple.', 'Aucun abonnement à restaurer sur ce compte Google.'],
    ['Ta progression reste sur cet iPhone. Tu pourras te connecter plus tard, dans Mon compte.', 'Ta progression reste sur ce téléphone. Tu pourras te connecter plus tard, dans Mon compte.'],
    ['Tu te connectes avec Apple ou Google.', 'Tu te connectes avec Google.'],
    ['vendu par l’App Store.', 'vendu par Google Play.'],
    ['Sur ton iPhone', 'Sur ton téléphone'],
    ['Ton avis sur l’App Store aide d’autres à nous trouver', 'Ton avis sur Google Play aide d’autres à nous trouver'],
    ['Apple continue de le facturer tant que tu ne l’arrêtes pas, dans Mon compte › Gérer mon abonnement ou dans les réglages de ton identifiant Apple.',
      'Google Play continue de le facturer tant que tu ne l’arrêtes pas, dans Mon compte › Gérer mon abonnement ou dans Google Play.']];
  for (const [fr, android] of cas) { assert.equal(a.natifTexte(fr), android); assert.equal(i.natifTexte(fr), fr); assert.equal(w.natifTexte(fr), fr); }
  assert.equal(a.playFiche(), 'https://play.google.com/store/apps/details?id=fr.requete.app');
});

test('les textes passent par natifTexte ; la boutique, l’abonnement et la note mènent à Google Play', () => {
  for (const k of ["obPh(natifTexte('Paiement Apple'))", "natifTexte('Les prix sont ceux de l’App Store de ton pays.')", "dire(natifTexte('Aucun abonnement à restaurer sur ce compte Apple.'))",
    "['store',natifTexte('App Store'),'store']", "'<p class=\"ob-sans-compte-note\">'+natifTexte('Ta progression reste sur cet iPhone.", "${natifTexte('Sur ton iPhone')}",
    "${natifTexte('Ton avis sur l’App Store aide d’autres à nous trouver')}", "obAbonne()?natifTexte(`<p class=\"lq-del-abo\">", '<div class="legal-copy">${natifTexte(privacy',
    'privacy:natifTexte(`<div class="legal-copy">', 'terms:natifTexte(`<div class="legal-copy">', 'lqSay(natifTexte(dUnCompte?'])
    assert.ok(app.includes(k), k);
  assert.ok(entre(app, 'function noterAppli(){', '\n}\n').includes('if(appAndroid()){androidOuvrir(playFiche());return;}'));
  assert.ok(app.includes("function abonnementIci(){return obAchatPret()&&(appAndroid()||(typeof ilePont==='function'&&!!ilePont()));}"));
  assert.ok(entre(app, 'async function abonnementGerer(){', '\n}\n').includes('androidOuvrir(`https://play.google.com/store/account/subscriptions?package=${ANDROID_ID}`)'));
  assert.ok(app.includes("function appStoreFiche(){return appAndroid()?playFiche():'https://apps.apple.com/app/id6830361256';}"));
  assert.ok(app.includes('${appAndroid()?\'<b aria-hidden="true">Autoriser Requête à vous envoyer des notifications&nbsp;?</b>\''), 'la demande d’autorisation, à la manière d’Android');
});

test('le bouton Retour d’Android : la fenêtre, puis Échap, l’onboarding, l’accueil, l’arrière-plan', () => {
  const r = entre(app, 'function androidRetour(){', '\n}\n');
  assert.ok(r.indexOf(".lq-ask-non,.lq-ask-x") < r.indexOf("key:'Escape'") && r.indexOf("key:'Escape'") < r.indexOf("switchTab('learn')") && r.indexOf("switchTab('learn')") < r.indexOf('A.minimizeApp()'));
  assert.ok(r.includes("!['pseudo','paywall'].includes(OB_SLIDES[obStep])"), 'jamais en arrière depuis le pseudo ou le paywall');
  assert.ok(app.includes("A.addListener('backButton',()=>{try{androidRetour();}catch(e){}});"));
  assert.equal(JSON.parse(lire('package.json')).dependencies['@capacitor/app'], '8.1.2');
});

test('connexion : Google seul sur Android, avec le client web ; achats : la clé Android de RevenueCat', () => {
  const c = lire('connexion.js');
  assert.ok(c.includes("var fournisseurs = android ? (avecGoogle ? ['google'] : []) : (avecGoogle ? ['apple', 'google'] : ['apple']);"));
  assert.ok(c.includes("o.google = android ? {webClientId: GOOGLE_WEB, mode: 'online'} : {iOSClientId: GOOGLE_IOS, iOSServerClientId: GOOGLE_WEB, mode: 'online'};"));
  const a = lire('achat.js');
  assert.ok(a.includes("var CLE = typeof C.getPlatform === 'function' && C.getPlatform() === 'android' ? RC_CLE_ANDROID : RC_CLE_IOS;") && a.includes('P.configure({apiKey: CLE})'));
  assert.ok(app.includes('<script src="connexion.js?v=4"></script>') && app.includes('<script src="achat.js?v=8"></script>'));
  const sw = lire('sw.js');
  assert.ok(sw.includes("'./connexion.js?v=4',") && sw.includes("'./achat.js?v=8',"));
});

test('les marges du haut et du bas suivent Android (variables de Capacitor), et l’iPhone garde env()', () => {
  const css = lire('ludique.css');
  for (const t of [app, css]) {
    assert.ok(!/(?<!--safe-area-inset-(?:top|right|bottom|left),)env\(safe-area-inset/.test(t.replace(/var\(--safe-area-inset-(top|right|bottom|left),env\(safe-area-inset-\1(,0px)?\)\)/g, '')), 'chaque env() a sa variable devant');
  }
  assert.ok(app.includes('var(--safe-area-inset-top,env(safe-area-inset-top,0px))') && css.includes('var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=392">'));
});

test('le projet Android et sa fabrication sur GitHub', () => {
  const conf = JSON.parse(lire('capacitor.config.json'));
  assert.equal(conf.appId, 'fr.requete.app');
  assert.deepEqual(conf.android, {backgroundColor: '#F4F2FC', allowMixedContent: false, webContentsDebuggingEnabled: false});
  assert.deepEqual(conf.plugins.LocalNotifications, {smallIcon: 'ic_stat_requete', iconColor: '#6245ED'});
  const pkg = JSON.parse(lire('package.json'));
  assert.equal(pkg.dependencies['@capacitor/android'], pkg.dependencies['@capacitor/core']);
  assert.equal(pkg.scripts.android, 'npm run build:www && npx cap sync android');
  const g = lire('android/app/build.gradle');
  assert.ok(g.includes('applicationId "fr.requete.app"') && g.includes('System.getenv("ANDROID_VERSION_CODE")') && g.includes('if (System.getenv("ANDROID_KEYSTORE_PATH")) signingConfig signingConfigs.envoi'));
  assert.ok(g.includes('assetPacks = [":voix"]') && lire('android/settings.gradle').includes("include ':voix'"), 'les voix dans leur paquet');
  const pv = lire('android/voix/build.gradle');
  assert.ok(pv.includes("id 'com.android.asset-pack'") && pv.includes('packName = "voix"') && pv.includes('deliveryType = "install-time"'));
  const m = lire('android/app/src/main/AndroidManifest.xml');
  assert.ok(m.includes('<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />'));
  const s = lire('android/app/src/main/res/values/styles.xml');
  assert.ok(s.includes('parent="Theme.AppCompat.Light.NoActionBar"') && s.includes('<item name="android:forceDarkAllowed">false</item>') && s.includes('<item name="windowSplashScreenBackground">@color/requete_fond</item>'));
  assert.ok(lire('android/app/src/main/res/values/strings.xml').includes('<string name="app_name">Requête</string>'));
  assert.ok(fs.existsSync(new URL('../android/app/src/main/res/drawable/ic_stat_requete.xml', import.meta.url)));
  assert.ok(lire('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml').includes('@mipmap/ic_launcher_foreground'));
  const w = lire('.github/workflows/android.yml');
  for (const k of ['workflow_dispatch:', 'npm run build:www && npx cap sync android', './gradlew --no-daemon assembleDebug', './gradlew --no-daemon bundleRelease', 'mv app/src/main/assets/public/assets/voix voix/src/main/assets/public/assets/voix', 'ANDROID_VERSION_CODE: ${{ github.run_number }}',
    'secrets.ANDROID_KEYSTORE_BASE64', 'requete-test.apk', 'requete.aab', 'actions/upload-artifact@v4'])
    assert.ok(w.includes(k), k);
  assert.ok(!/\.jks|\.keystore/.test(fs.readdirSync(new URL('../android/app', import.meta.url)).join(' ')), 'aucune clé dans le dépôt');
});

test('l’anglais des textes Android', () => {
  const en = lire('langue-en.js');
  for (const k of ['"Paiement Google Play": "Paid via Google Play"', '"Renouvellement automatique, annulable à tout moment dans Google Play.": "Renews automatically; cancel anytime in Google Play."',
    '"Sur ton téléphone": "On your phone"', '"Aucun abonnement à restaurer sur ce compte Google.": "No subscription to restore on this Google account."'])
    assert.ok(en.includes(k), k);
});

test('Android : le clavier, la vue rétrécit d’elle-même (pas de double recul), réglages propres à iOS évités', () => {
  const h = lire('index.html');
  const f = h.slice(h.indexOf('function kbHauteurNative(e)'), h.indexOf('\n', h.indexOf('function kbHauteurNative(e)')));
  const android = vm.runInNewContext(f + ';kbHauteurNative', {appAndroid: () => true, Math});
  const ios = vm.runInNewContext(f + ';kbHauteurNative', {appAndroid: () => false, Math});
  assert.equal(android({keyboardHeight: 300}), 0);
  assert.equal(ios({keyboardHeight: 300.4}), 300);
  assert.ok(h.includes('const h=kbHauteurNative(e);') && h.includes('dxClavierApp=typeof kbHauteurNative===\'function\'?kbHauteurNative(e)'));
  assert.ok(h.includes('var kbScroll=!appAndroid()&&P.Keyboard') && h.includes('var kbMode=!appAndroid()&&P.Keyboard'));
  const conf = JSON.parse(lire('capacitor.config.json'));
  assert.deepEqual(conf.plugins.SystemBars, {style: 'LIGHT', initialViewportFitValueHint: 'cover'}, 'icônes foncées sur le fond clair, même téléphone en mode sombre');
});
