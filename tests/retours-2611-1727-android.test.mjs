/* Elisa, 26 novembre, 17 h 27, sur son Samsung (appli Google Play, version 37) ; Android seulement (« sur iPhone c’est ok, quand je
   te parle d’une correction là c’est que Android ») :
   - « quand on fait commencer la leçon qu’on avait fait auparavant, ben c’est comme si ça met une page avec la note et tout, et
     après ça met la leçon » ;
   - « il n’a pas reconnu l’abonnement que j’avais sur mon compte. Je me suis connectée avec Google, il n’a pas reconnu. Et quand
     j’ai fait restaurer, il a trouvé. Mais normalement, ça doit reconnaître, non ? Directement. » ;
   - « quand on est sur la feuille du bilan et qu’on veut continuer la leçon, tu sais, tout en bas, bah, c’est comme s’il y avait une
     feuille qui apparaissait, mais 2 secondes » ;
   - « quand on se déconnecte, on revoit un peu comme la page du compte après quand il part. […] Essaye d’enlever cette page de
     2 secondes là. » */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html');
const ludique = lire('ludique.css');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j + b.length); };
const tour = () => new Promise(r => setTimeout(r, 15));

/* ---------- La déconnexion : plus de Mon compte sous le chat qui part ---------- */
const couvrir = entre(app, 'function deconnexionCouvrir(){', '\n}\n');
function deconnexion(android) {
  const ajoutes = [], loader = {classList: {remove() {}}, style: {}};
  const ctx = {appAndroid: () => android, document: {
    getElementById: id => id === 'deco-voile' ? ajoutes.find(e => e.id === 'deco-voile') || null : id === 'loader' ? loader : null,
    createElement: () => ({setAttribute(k, v) { this[k] = v; }}), body: {appendChild: e => ajoutes.push(e)}}};
  vm.runInNewContext(couvrir + '\ndeconnexionCouvrir();deconnexionCouvrir();', ctx);
  return {ajoutes, loader};
}
test('déconnexion, Android : un voile sous le chat, la première image de la page qui revient (fond clair, logo rond)', () => {
  const {ajoutes, loader} = deconnexion(true);
  assert.equal(ajoutes.length, 1, 'un seul voile');
  assert.equal(ajoutes[0].id, 'deco-voile');
  assert.equal(ajoutes[0]['aria-hidden'], 'true');
  assert.equal(ajoutes[0].innerHTML, '<img src="assets/lancement-android.webp" width="178" height="178" alt="" draggable="false">');
  assert.equal(loader.style.zIndex, undefined, 'l’écran de chargement (qui s’efface tout seul après l’ouverture) n’est plus remontré');
  // Le voile : sous « À bientôt ! » (9985), au-dessus de Mon compte ; le logo à la place et à la taille de celui de l’ouverture
  assert.ok(ludique.includes('html.is-android #deco-voile{position:fixed;inset:0;z-index:9980;background:#F4F2FC;pointer-events:none}'));
  assert.ok(ludique.includes('html.is-android #deco-voile img{position:absolute;left:50%;top:50%;width:178px;height:178px;margin:-89px 0 0 -89px;'));
  assert.ok(ludique.includes('html.is-native.is-android.lq #loader.is-intro.is-and .in-and{display:block;position:absolute;z-index:3;left:50%;top:50%;width:178px;height:178px;margin:-89px 0 0 -89px;'));
  assert.ok(ludique.includes('html.lq .lq-flamme{position:fixed;inset:0;z-index:9985;'));
  assert.ok(/#F4F2FC/.test(lire('android/app/src/main/res/values/requete_couleurs.xml')), 'le même fond que la fenêtre d’Android');
});
test('déconnexion, iPhone : rien ne change (l’écran de chargement remis sous le chat)', () => {
  const {ajoutes, loader} = deconnexion(false);
  assert.equal(ajoutes.length, 0);
  assert.equal(loader.style.zIndex, '9980');
  assert.equal(loader.style.display, '');
  // Et le chemin de la déconnexion : le voile est posé avant d’attendre la fin du chat, puis la page se recharge
  const sortie = entre(app, '  if(deconnexionToutParti(envoi)){', '    return;\n  }');
  assert.ok(sortie.indexOf('deconnexionCouvrir();') < sortie.indexOf('await auRevoirFini;') && sortie.indexOf('await auRevoirFini;') < sortie.indexOf('location.reload();'));
});

test('suppression du compte, Android : le même voile pendant le rechargement (Mon compte, vidé, ne reste pas 2 s)', () => {
  const f = entre(app, 'async function compteSupprimer(){', '\n}\n');
  assert.ok(f.includes("try{sessionStorage.clear();}catch(e){}\n  /* Android") && f.includes("if(typeof appAndroid==='function'&&appAndroid())deconnexionCouvrir();\n  location.reload();\n}"));
});

/* ---------- La page de départ d’un cours : rien de l’écran du dessous pendant son arrivée ---------- */
test('page de départ, Android : elle couvre l’écran dès sa première image ; seul son contenu arrive', () => {
  assert.ok(ludique.includes('.lst{position:fixed;inset:0;z-index:120;'), 'plein écran');
  assert.ok(/\.lst\{position:fixed;inset:0;z-index:120;[^}]*background:var\(--bg,#F4F1FF\);animation:lstIn \.32s/.test(ludique), 'opaque, et le fondu de l’iPhone gardé');
  assert.ok(ludique.includes('html.is-android .lst{animation:none}'));
  assert.ok(ludique.includes('html.is-android .lst>*{animation:lstIn .32s cubic-bezier(.2,.8,.3,1.15) backwards}'), 'backwards : rien de figé après (le bouton s’enfonce encore)');
  assert.ok(ludique.includes('html.is-android .lst.is-out{animation:lstOut .22s ease both}'), 'la sortie (« Voir le bilan », la croix) reste');
  assert.ok(ludique.includes('@media (prefers-reduced-motion:reduce){html.is-android .lst.is-out,html.is-android .lst>*{animation:none}}'));
  assert.ok(ludique.includes('html.is-android[data-motion="reduce"] .lst.is-out,html.is-android[data-motion="reduce"] .lst>*{animation:none!important}'));
  // Les règles d’Android viennent après celles de tout le monde (même poids : l’ordre décide pour le mouvement réduit)
  assert.ok(ludique.indexOf('html.is-android .lst{animation:none}') > ludique.indexOf('.lst.is-out{animation:lstOut .22s ease both}'));
  assert.ok(ludique.indexOf('html.is-android[data-motion="reduce"] .lst.is-out') > ludique.indexOf('html.is-android .lst.is-out{animation:lstOut'));
  // Elle s’ouvre bien par-dessus l’écran du cours déjà dessiné : le bilan d’une leçon validée, ou la leçon suivante (« Continuer »)
  const ouvrir = entre(app, 'function openLesson(id, restoreStep){', '\n}\n');
  assert.ok(ouvrir.indexOf('renderLessonFlow(); showScreen();') < ouvrir.indexOf('lessonStartShow(l,'));
  assert.ok(ouvrir.includes('}else if(done) lessonStep=3;'));
  assert.ok(app.includes('onclick="openItem(${arg})">'));
});

/* ---------- L’abonnement de Google Play reconnu sans « Restaurer » ---------- */
function achat({plateforme = 'android', actifServeur = false, actifRestaure = true} = {}) {
  const src = lire('achat.js').replace(/var RC_CLE_ANDROID = '[^']*';/, "var RC_CLE_ANDROID = 'goog_essai';");
  const store = {}, appels = {restaurer: 0, info: 0}, ecoute = {};
  let t = 1_000_000;
  const info = a => ({customerInfo: {entitlements: {active: a ? {premium: {}} : {}}, requestDate: new Date(t).toISOString()}});
  const plugin = {
    configure: () => Promise.resolve(),
    getCustomerInfo: () => { appels.info++; return Promise.resolve(info(actifServeur)); },
    getOfferings: () => Promise.resolve({current: {availablePackages: []}}),
    restorePurchases: () => { appels.restaurer++; return Promise.resolve(info(actifRestaure)); },
  };
  const win = {Capacitor: {isNativePlatform: () => true, getPlatform: () => plateforme, Plugins: {Purchases: plugin}}};
  vm.runInNewContext(src, {window: win, document: {visibilityState: 'visible', addEventListener: (n, f) => { ecoute[n] = f; }},
    localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
    Promise, Error, Object, Number, String, isNaN, isFinite, Date: {now: () => t, parse: Date.parse}});
  return {a: win.REQUETE_ACHAT, appels, ecoute, store, avancer: ms => { t += ms; }};
}
test('abonnement, Android : RevenueCat ne le voit pas, l’appli lui envoie d’elle-même ce que sait Google Play (comme « Restaurer »)', async () => {
  const o = achat();
  await tour();
  assert.equal(o.appels.restaurer, 1, 'au démarrage');
  assert.equal(o.a.etat(), 'oui');
  assert.equal(o.a.actif(), true);
  assert.equal(o.store['requete-premium'], '1');
  assert.equal(await o.a.verifier(), 'oui', 'après la connexion : abonnée');
  assert.equal(o.appels.restaurer, 1, 'abonnée : plus rien à envoyer');
});
test('abonnement, Android : rien sur le compte Google, « non », et pas plus d’une fois par minute', async () => {
  const o = achat({actifRestaure: false});
  await tour();
  assert.equal(o.appels.restaurer, 1);
  assert.equal(o.a.etat(), 'non');
  assert.equal(await o.a.verifier(), 'non');
  assert.equal(o.appels.restaurer, 1, 'moins d’une minute après');
  o.avancer(61_000);
  assert.equal(await o.a.verifier(), 'non', 'après une connexion, une minute plus tard');
  assert.equal(o.appels.restaurer, 2);
  o.avancer(61_000);
  o.ecoute.visibilitychange();
  await tour();
  assert.equal(o.appels.restaurer, 3, 'de retour dans l’appli');
});
test('abonnement : déjà vu par RevenueCat, rien à envoyer ; sur l’iPhone, jamais sans le bouton « Restaurer »', async () => {
  const o = achat({actifServeur: true});
  await tour();
  assert.equal(o.appels.restaurer, 0);
  assert.equal(await o.a.verifier(), 'oui');
  const i = achat({plateforme: 'ios', actifRestaure: true});
  await tour();
  assert.equal(await i.a.verifier(), 'non');
  i.avancer(61_000); i.ecoute.visibilitychange(); await tour();
  assert.equal(i.appels.restaurer, 0);
  assert.equal(await i.a.restaurer(), true, 'le bouton, lui, restaure');
});
test('abonnement, Android : retrouvé pendant le paywall de l’onboarding, on entre (une fois)', () => {
  const f = entre(app, 'let obPwEntreeA=0;\nfunction obPaywallAbonneEntrer(){', '\n}\n');
  const ctx = {etat: 'oui', on: true, slide: 'paywall', busy: false, garde: false, t: 50_000};
  vm.createContext(ctx);
  vm.runInContext(`var OB_SLIDES=['bonjour','paywall'];var entrees=0;
    var document={getElementById:id=>id==='onboarding'?{classList:{contains:c=>c==='on'&&on}}:null};
    var Date={now:()=>t};
    function obGardeEtat(){return etat;}
    ${f}
    function obPaywallEntrer(){obPwEntreeA=Date.now();entrees++;}
    var obStep=1,obPwBusy=false,obGarde=false;
    function essai(){obStep=slide==='paywall'?1:0;obPwBusy=busy;obGarde=garde;return obPaywallAbonneEntrer();}`, ctx);
  assert.equal(ctx.essai(), true); assert.equal(ctx.entrees, 1);
  assert.equal(ctx.essai(), false, 'pas deux fois'); assert.equal(ctx.entrees, 1);
  ctx.t += 6000;
  ctx.busy = true; assert.equal(ctx.essai(), false, 'achat en cours : il entre de lui-même');
  ctx.busy = false; ctx.garde = true; assert.equal(ctx.essai(), false, 'la garde se referme d’elle-même');
  ctx.garde = false; ctx.slide = 'bonjour'; assert.equal(ctx.essai(), false, 'pas sur une autre page');
  ctx.slide = 'paywall'; ctx.etat = 'non'; assert.equal(ctx.essai(), false);
  ctx.etat = 'oui'; ctx.on = false; assert.equal(ctx.essai(), false, 'onboarding fermé');
  ctx.on = true; assert.equal(ctx.essai(), true); assert.equal(ctx.entrees, 2);
  // Branché sur Android seulement, et « Restaurer » ou un achat comptent comme une entrée
  assert.ok(app.includes("try{if(typeof a.suivre==='function'&&typeof appAndroid==='function'&&appAndroid())a.suivre(e=>{if(e==='oui')obPaywallAbonneEntrer();});}catch(e){}"));
  assert.ok(app.includes("function obPaywallEntrer(){obPwEntreeA=Date.now();obPwSortie=false;"));
  // achat.js : le démarrage, la vérification (après chaque connexion) et le retour dans l’appli passent par la même porte
  const a = lire('achat.js');
  assert.ok(a.includes('pret.then(relierSiBesoin);'));
  assert.ok(a.includes('verifier: function(){ return pret.then(function(){ return P.getCustomerInfo(); }).then(noterClient).catch(function(){}).then(relierSiBesoin); },'));
  assert.ok(a.includes('.then(noterClient).catch(function(){}).then(relierSiBesoin);\n    if (!prixConnus() && prixRate) rechargerPrix();'));
});

/* ---------- La note : plus de saut quand le clavier arrive (« Quand on clique sur le carré, le cadre pour écrire, ça saute au
   début ») ; filmé sur un émulateur Android (tools/android/clavier.mjs) ---------- */
test('notes, Android : « Enregistrer » collé en permanence (rien ne change de forme quand le clavier arrive), ombre clavier ouvert', () => {
  assert.ok(ludique.includes('html.lq.is-android body:not(.kbar-on) #note-body .ne-act{position:sticky;bottom:0;z-index:3;margin:8px -18px 0;padding:12px 18px;background:var(--bg)}'));
  assert.ok(ludique.includes('html.lq.is-android:not(.kb-ouvert) body:not(.kbar-on) #note-body .ne-act{box-shadow:none}'));
  // La même forme que celle du clavier ouvert (iPhone et Android), qui garde son ombre
  assert.ok(ludique.includes('html.lq.kb-ouvert body:not(.kbar-on) #note-body .ne-act{position:sticky;bottom:0;z-index:3;margin:8px -18px 0;padding:12px 18px;background:var(--bg);box-shadow:0 -12px 18px -14px rgba(27,22,64,.28)}'));
  assert.ok(ludique.indexOf('html.lq.is-android:not(.kb-ouvert)') > ludique.indexOf('html.lq.kb-ouvert body:not(.kbar-on) #note-body .ne-act{'));
});
test('notes, Android : quand la vue change de hauteur avec le clavier, « Enregistrer » glisse au lieu de sauter', () => {
  const debut = "(function(){\n  if(typeof window==='undefined'||typeof document==='undefined'||typeof appAndroid!=='function'||!appAndroid())return;\n  let place=null";
  const src = entre(app, debut, '\n})();\n');
  assert.ok(app.indexOf(debut) > app.indexOf("['keyboardWillShow','keyboardDidShow','keyboardWillHide','keyboardDidHide','resize'].forEach(n=>window.addEventListener(n,fit));"), 'après fit : la mise en page du clavier est déjà faite');
  let barTop = 541, ih = 914, android = true;
  const style = {}, ecoute = {}, ecouteDoc = {}, raf = [], minuteurs = [];
  const bar = {style, getBoundingClientRect: () => ({top: barTop}), get offsetHeight() { return 78; }};
  const feuille = {classList: {contains: c => c === 'on'}, querySelector: () => bar, getBoundingClientRect: () => ({top: 48})};
  const lancer = () => vm.runInNewContext(src, {appAndroid: () => android, prefersReduceMotion: () => false, Math,
    window: {get innerHeight() { return ih; }, innerWidth: 411, addEventListener: (n, f) => { ecoute[n] = f; }},
    document: {getElementById: id => id === 'note-sheet' ? feuille : null, addEventListener: (n, f) => { ecouteDoc[n] = f; }},
    requestAnimationFrame: f => raf.push(f), setTimeout: f => minuteurs.push(f)});
  lancer();
  ecouteDoc.focusin({target: {closest: s => s === '#note-body' ? {} : null}});   // le doigt sur le cadre : la place est notée
  ih = 584; barTop = 506; ecoute.resize();                                         // la vue rétrécit d’un coup, la barre est collée plus haut
  assert.equal(style.transform, 'translateY(35px)', 'elle reste d’abord où elle était');
  assert.equal(style.transition, 'none');
  raf.shift()();
  assert.equal(style.transform, ''); assert.equal(style.transition, 'transform .26s cubic-bezier(.38,.7,.125,1)');
  minuteurs.shift()(); assert.equal(style.transition, '');
  ih = 914; barTop = 541; ecoute.resize();                                         // le clavier repart
  assert.equal(style.transform, 'translateY(-35px)');
  raf.shift()(); minuteurs.shift()();
  ih = 900; barTop = 541; ecoute.resize();                                         // un petit changement de hauteur : rien
  assert.equal(style.transform, ''); assert.equal(raf.length, 0);
  // Sur l’iPhone : rien de tout ça
  android = false; for (const k in ecoute) delete ecoute[k]; lancer();
  assert.equal(ecoute.resize, undefined);
});
