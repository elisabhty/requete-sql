/* Elisa, 4 novembre, 3 h 54 (six captures de l’onboarding de Duolingo) : « ce que j’ai oublié, c’est une animation à la fin ».
   Elle choisit les trois : « Comment as-tu connu Requête ? », le rappel avec la flèche animée, le tutoriel animé du widget.
   Après la première requête réussie : la question des sources, le rappel du jour (la fenêtre d’iOS en aperçu, au centre de l’écran,
   une flèche vers « Autoriser », puis la vraie demande), et dans l’app iPhone qui l’embarque, le widget de la série (écran d’accueil,
   puis le tutoriel en trois temps). Le widget est natif (WidgetKit) : scripts/ios-widget.mjs l’ajoute au projet Xcode.
   Vérifié dans un navigateur de la taille d’un iPhone (mode app) : chaque page, la fenêtre centrée à l’écran près, la permission
   demandée puis le rappel programmé à 19 h, les trois temps du tutoriel, la série envoyée au widget en passant en arrière-plan ;
   le projet Xcode modifié relu par l’analyseur de Cordova (xcode), toutes ses références résolues. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), css = read('onboarding-vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const slide = (name, next) => cut(`}else if(slide==='${name}'){`, next);
/* La dernière définition (quelques fonctions de l’onboarding ont une ancienne version plus haut dans la page) */
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };
const fin = cut('const OB_FIN_SLIDES=', '/* « Me rappeler de m’entraîner »');
const flux = (globals = {}) => {
  const ctx = vm.createContext({OB_PROFILE_SLIDES: ['name', 'practice'], obAuthReady: () => false, window: {}, ...globals});
  vm.runInContext(fin, ctx);
  return ctx;
};

test('le tunnel de fin : sources, rappel (s’il peut être demandé), puis le compte ; le widget après la première leçon (13 h 48)', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice','account','source','rappel','widget','widgetTuto','pseudo','ready'];"));
  /* 4 novembre, 10 h 16 (« mettre la page de connexion, il faut pas qu’elle marche encore ») : le compte est toujours là ; 10 h 45
     (« passer directement à la connexion ») : juste après la première requête. */
  assert.deepEqual([...flux().obFinFlux()], ['practice', 'account', 'source'], 'navigateur sans notifications : le compte, puis la question');
  assert.deepEqual([...flux({Notification: {permission: 'default'}}).obFinFlux()], ['practice', 'account', 'source', 'rappel']);
  assert.deepEqual([...flux({Notification: {permission: 'granted'}}).obFinFlux()], ['practice', 'account', 'source'], 'déjà décidé : rien à demander');
  const natif = (plugins = ['RequeteWidget', 'LocalNotifications'], plateforme = 'ios') => ({window: {Capacitor: {isNativePlatform: () => true, getPlatform: () => plateforme,
    isPluginAvailable: n => plugins.includes(n), Plugins: plugins.includes('LocalNotifications') ? {LocalNotifications: {}} : {}}}});
  const c = flux(natif());
  assert.deepEqual([...c.obFinFlux()], ['practice', 'account', 'source', 'rappel'], 'app iPhone : le widget n’est plus dans le tunnel');
  assert.equal(c.obAfterPractice(), 'account');
  assert.equal(c.obFinSuivante('rappel'), 'ready'); assert.equal(c.obFinSuivante('account'), 'source'); assert.equal(c.obFinPrecedente('ready'), 'rappel');
  assert.equal(c.obFinPrecedente('account'), 'practice'); assert.equal(c.obFinPrecedente('source'), 'account');
  assert.deepEqual([...c.obFlowSteps()], ['name', 'practice', 'account', 'source', 'rappel'], 'deux étapes de moins');
  assert.deepEqual([...flux(natif(['LocalNotifications'])).obFinFlux()], ['practice', 'account', 'source', 'rappel']);
  assert.deepEqual([...flux({...natif(), obAuthReady: () => true}).obFinFlux()], ['practice', 'account', 'source', 'rappel']);
  /* 4 novembre, 22 h 50 (« Oui, masque-la ») : l’app iPhone sans connexion branchée garde le bravo d’une première requête réussie,
     sans les boutons « Bientôt » ; sans réussite, la page est sautée ; avec un fournisseur branché, elle revient. */
  assert.deepEqual([...flux({...natif(), appliNative: () => true}).obFinFlux()], ['practice', 'source', 'rappel'], 'app iPhone, sans première requête réussie');
  assert.deepEqual([...flux({...natif(), appliNative: () => true, draft: {practiceDone: true}}).obFinFlux()], ['practice', 'account', 'source', 'rappel'], 'le bravo reste');
  assert.deepEqual([...flux({...natif(), appliNative: () => true, obAuthReady: () => true}).obFinFlux()], ['practice', 'account', 'source', 'rappel'], 'connexion branchée');
  /* Retenu pour tout l’onboarding : une permission accordée en route ne retire pas l’étape (ni ne fausse « Suivant »). */
  const w = flux({Notification: {permission: 'default'}}); w.obFinFlux(); w.Notification.permission = 'granted';
  assert.deepEqual([...w.obFinFlux()], ['practice', 'account', 'source', 'rappel']);
  assert.ok(app.includes('obVideoMontree=false;obFinRappel=obFinWidget=null;'), 'oublié à chaque nouvel onboarding');
  /* Suivant, Précédent */
  assert.ok(fn('obNext', 'function obBack(){').includes("else if(OB_FIN_SLIDES.includes(slide))obGoto(obFinSuivante(slide));"));
  assert.ok(fn('obBack', 'function obPick(').includes("if(OB_SLIDES[obStep]==='ready'||OB_SLIDES[obStep]==='account'||OB_FIN_SLIDES.includes(OB_SLIDES[obStep])){obGoto(obFinPrecedente(OB_SLIDES[obStep]));return;}"));
  assert.ok(app.includes("root.classList.toggle('ob-profile-step',(OB_PROFILE_SLIDES.includes(slide)||OB_FIN_SLIDES.includes(slide)||OB_WIDGET_SLIDES.includes(slide)||slide==='pseudo')&&!obLegalMode);"));
});

test('« Comment as-tu connu Requête ? » : dix réponses en tuiles, « Continuer » au choix, gardée dans le profil', () => {
  const sources = vm.runInNewContext(app.match(/const OB_SOURCES=(\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(Array.from(sources, s => s[1]), ['TikTok', 'Instagram', 'YouTube', 'LinkedIn', 'Famille ou amis', 'App Store', 'Recherche Google', 'Article ou blog', 'École ou formation', 'Autre']);
  const s = slide('source', "}else if(slide==='rappel'){");
  assert.ok(s.includes('<h1 class="ob-title" id="ob-title">Comment as-tu <em>connu</em> Requête&nbsp;?</h1>'));
  assert.ok(s.includes("obMascotQuestion('Dis-moi tout : ça m’aide à faire connaître Requête !')"));
  assert.ok(s.includes(`class="ob-tile ob-source-tile \${draft.source===k?'on':''}"`) && s.includes(`onclick="obPick('source','\${k}')"`));
  assert.ok(s.includes("obSetFooter('Continuer',()=>obGoto(obFinSuivante('source')),'','','',!draft.source);"));
  assert.ok(app.includes("if(!['niveau','rythme','goal','ageRange','genre','job','source','freq'].includes(champ))return;") && app.includes("    source:draft.source||'',"));
  for (const k of ['note', 'camera', 'play', 'article']) assert.ok(cut('function obOptionIcon(type){', 'function obAnswers(').includes(`    ${k}:'`), `icône ${k}`);
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-source-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}'));
});

test('le rappel : la fenêtre d’iOS en aperçu au centre de l’écran, la flèche vers « Autoriser », puis la vraie demande', async () => {
  const s = slide('rappel', "}else if(slide==='widget'){");
  assert.ok(s.includes("obMascotDit('Avec moi, tu n’oublieras pas ta séance !','reveil')"), '14 h 48 : sans « SQL » ; 7 novembre, 14 h 27 : le réveil qui sonne');
  /* 6 novembre, 23 h 08 : les deux boutons de l’aperçu se touchent pour de vrai (tests/retours-2308.test.mjs) */
  assert.ok(s.includes('<b aria-hidden="true">«&nbsp;Requête&nbsp;» souhaite vous envoyer des notifications</b>') && s.includes('<span class="ob-notif-btns"><button type="button" onclick="obRappelRefuser()" aria-label="Ne pas autoriser les rappels">Ne pas autoriser</button><button type="button" class="is-ok" onclick="obRappelDemander()" aria-label="Autoriser les rappels">Autoriser</button></span>'));
  assert.ok(s.includes('<svg class="ob-notif-arrow"') && s.includes("obSetFooter(`Me rappeler à ${obHeureTexte(draft.rappelHeure)}`,obRappelDemander,'','','');"), 'à l’heure choisie (11 h 08)');
  assert.ok(app.includes("  if(slide==='rappel')obNotifCaler();"));
  const caler = cut('function obNotifCaler(){', '/* Le widget, tel qu’il est sur l’iPhone');
  assert.ok(caler.includes('let dy=innerHeight/2-(r.top+r.height/2);'), 'centrée sur l’écran, là où iOS ouvre sa fenêtre');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-notif-arrow{align-self:flex-end;width:34px;height:58px;margin:12px calc(25% - 17px) 0 0;'), 'sous le bouton de droite');
  /* La demande, exécutée seule */
  const demande = cut('async function obRappelDemander(){', '/* La fenêtre en aperçu au centre');
  const essai = async ({reponse = 'granted', apercu = false} = {}) => {
    const appels = [], store = {};
    const ctx = vm.createContext({obLock: false, obApercu: apercu, document: {getElementById: () => ({disabled: false})},
      window: {Capacitor: {isNativePlatform: () => true, Plugins: {LocalNotifications: {requestPermissions: async () => { appels.push('demande'); return {display: reponse}; }}}}},
      localStorage: {setItem: (k, v) => { store[k] = v; }}, rappelNativeSync: () => appels.push('programme'), buzz: () => {},
      obGoto: t => appels.push('vers ' + t), obFinSuivante: () => 'widget', draft: {rappelHeure: '08:00'}, rappelHeure: () => '19:00'});
    vm.runInContext(demande, ctx);
    await ctx.obRappelDemander();
    return {appels, store};
  };
  assert.deepEqual(await essai(), {appels: ['demande', 'programme', 'vers widget'], store: {'requete-rappel-heure': '08:00', 'requete-rappel': '1'}}, 'l’heure choisie (11 h 08), puis le rappel');
  assert.deepEqual(await essai({reponse: 'denied'}), {appels: ['demande', 'vers widget'], store: {'requete-rappel-heure': '08:00', 'requete-rappel': '0'}}, 'refusé : pas de rappel (l’heure reste pour Mon compte)');
  assert.deepEqual(await essai({apercu: true}), {appels: ['vers widget'], store: {}}, 'aperçu : rien demandé, rien gardé');
});

test('le widget : l’écran d’accueil avec la série, puis le tutoriel en trois temps qui tournent avec la bulle', () => {
  const w = slide('widget', "}else if(slide==='widgetTuto'){");
  assert.ok(w.includes("obMascotDit('Je t’encouragerai directement depuis ton écran d’accueil !','parti')") && w.includes('${obTelPromo()}'));
  assert.ok(w.includes("obSetFooter('Continuer',()=>obGoto('widgetTuto'),'Pas maintenant',obWidgetFin,'');"), '« Pas maintenant » rend la main à l’app (13 h 48 : après la première leçon)');
  const t = slide('widgetTuto', "}else if(slide==='rhythm'){");
  assert.ok(t.includes('<h1 class="ob-title ob-sr" id="ob-title">Ajouter le widget Requête</h1>') && t.includes('<div class="ob-ph ob-ph-tuto" id="ob-wt" data-phase="1" aria-hidden="true">${obTelTuto()}</div>'));
  assert.ok(t.includes('<ol class="ob-sr-steps">'), 'les trois étapes, lues par VoiceOver');
  const textes = vm.runInNewContext(app.match(/const OB_WT_TEXTES=(\[[^\]]+\]);/)[1]);
  assert.deepEqual(Array.from(textes), ['D’abord, maintiens appuyé sur ton écran d’accueil…', 'Appuie ensuite sur « + », en haut à gauche, puis sur « Ajouter un widget ».', 'Cherche « Requête » et ajoute mon widget !']);
  /* 6 novembre, 11 h 12 (les captures de l’iPhone d’Elisa) : le bouton est « + », et son menu a ses quatre lignes */
  assert.ok(app.includes('<span class="ob-ph-edit">+</span><span class="ob-ph-ok">OK</span>') && app.includes('<span class="ob-ph-menu"><span>Ajouter un widget</span><span>Personnaliser</span><span>Modifier le fond d’écran</span><span>Modifier les pages</span></span>'));
  /* La boucle, exécutée seule avec des minuteries factices */
  const timers = [], box = {dataset: {}}, bulle = {textContent: ''};
  const ctx = vm.createContext({OB_SLIDES: ['widgetTuto'], obStep: 0, obDemoTimers: [], OB_WT_TEXTES: textes,
    document: {getElementById: id => id === 'ob-wt' ? box : bulle, body: {contains: () => true}}, setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }});
  vm.runInContext(cut('function obTypo(s){', '\n'), ctx);   // 8 h 19 : la ponctuation ne part pas seule à la ligne
  vm.runInContext(cut('function obWidgetTutoJouer(){', '/* ---------- Le widget de l’app iPhone'), ctx);
  ctx.obWidgetTutoJouer();
  const vu = [];
  for (let i = 0; i < 4; i++) { vu.push([box.dataset.phase, bulle.textContent.slice(0, 12), timers.at(-1)[1]]); timers.at(-1)[0](); }
  assert.deepEqual(vu, [['1', 'D’abord, mai', 3400], ['2', 'Appuie ensui', 3600], ['3', 'Cherche «\u00A0Re', 5200], ['1', 'D’abord, mai', 3400]]);
  assert.equal(ctx.obDemoTimers.length, 5, 'chaque temps dans obDemoTimers : arrêtée en quittant l’étape (paintOb les vide)');
  /* Chaque app à sa case ; le widget posé passe par-dessus les quatre premières */
  assert.ok(app.includes('style="--i:${i};grid-area:${Math.floor(i/3)+1}/${i%3+1}"'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-ph-tuto[data-phase="2"] .ob-ph-menu{display:flex}') && css.includes('html #onboarding.ob-vitrine .ob-ph-tuto[data-phase="3"] .ob-ph-sheet{transform:none}'), 'au repos, chaque temps montre son état');
  assert.ok(css.includes('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine .ob-ph-tuto[data-phase="1"] .ob-ph-grid .ob-ph-app{animation:obvWiggle'), 'les apps tremblent, quand les animations sont permises');
  for (const k of ['obvArrow', 'obvFadeIn']) assert.equal(css.split(`@keyframes ${k}{`).length - 1, 1, `${k} : une seule définition`);
});

test('la série part vers le widget : au démarrage et en passant en arrière-plan, sans le pont natif rien ne se passe', () => {
  const src = cut('let widgetDernier=', 'if(typeof document!==');
  const essai = ({plugin = true, actif = true} = {}) => {
    const appels = [];
    const ctx = vm.createContext({window: {Capacitor: {isNativePlatform: () => true, isPluginAvailable: n => plugin && n === 'RequeteWidget',
      nativePromise: (p, m, o) => { appels.push([p, m, JSON.stringify(o)]); return Promise.resolve(); }}},
      auj: () => new Date(2026, 10, 7), dstr: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      addJ: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
      jourActif: () => actif, streakJours: () => 12, debutPlan: () => '2026-11-01', jourRepos: iso => iso === '2026-11-08'});
    vm.runInContext(src, ctx);
    ctx.widgetMaj(); ctx.widgetMaj();
    return appels;
  };
  /* Fait le samedi 7 ; dimanche 8 est un jour de repos : la série tient jusqu’au lundi 9 */
  /* 7 novembre : la pièce de la cheminée suit (widgetCheminee, à zéro ici : le bac à sable n’a ni stickers ni parcours) */
  const piece = {stickers: 0, trophees: 0, diplomes: 0, prochaine: '', cle: '', defi: false, carte: '', poche: '[]'};   // et la requête de poche, vide
  assert.deepEqual(essai(), [['RequeteWidget', 'maj', JSON.stringify({serie: 12, jour: '2026-11-07', fait: true, limite: '2026-11-09', ...piece})]], 'une fois : le même état n’est pas renvoyé');
  assert.equal(JSON.parse(essai({actif: false})[0][2]).limite, '2026-11-07', 'pas encore fait : aujourd’hui');
  assert.deepEqual(essai({plugin: false}), [], 'ancienne app : rien');
  assert.ok(app.includes("document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden')widgetMaj(); });") && app.includes("addEventListener('pagehide',widgetMaj);"));
  assert.ok(app.includes('    setTimeout(()=>{try{widgetMaj();}catch(e){}},1200);   // le widget de l’app iPhone reprend la série du jour'));
});

test('le widget natif : WidgetKit, le groupe d’apps partagé, le pont « RequeteWidget.maj », la mascotte', () => {
  const swift = read('resources/ios/widget/RequeteWidget/RequeteWidget.swift'), plugin = read('resources/ios/widget/App/RequeteWidgetPlugin.swift');
  const vc = read('resources/ios/widget/App/RequeteViewController.swift'), info = read('resources/ios/widget/RequeteWidget/Info.plist');
  const groupe = 'group.fr.requete.app';
  for (const [f, t] of [['widget', swift], ['pont', plugin], ['droits du widget', read('resources/ios/widget/RequeteWidget/RequeteWidget.entitlements')], ['droits de l’app', read('resources/ios/widget/App/App.entitlements')]])
    assert.ok(t.includes(groupe), `${f} : ${groupe}`);
  /* 12 h 35 : le widget et la Live Activity de la leçon (Dynamic Island) dans un même paquet, le seul @main */
  assert.ok(swift.includes('@main\nstruct RequeteWidgets: WidgetBundle {') && swift.includes('\nstruct RequeteWidget: Widget {') && swift.split('@main').length === 2);
  assert.ok(swift.includes('.supportedFamilies([.systemSmall])') && swift.includes('Image(systemName: "flame.fill")') && swift.includes('Image("Mascotte")'));
  assert.ok(swift.includes('self.containerBackground(for: .widget) { violet }') && swift.includes('return self.contentMarginsDisabled()'), 'iOS 17 : fond et marges du widget');
  for (const k of ['serie', 'jour', 'fait', 'limite']) assert.ok(swift.includes(`forKey: "${k}"`) && plugin.includes(`forKey: "${k}"`), k);
  assert.ok(plugin.includes('public let jsName = "RequeteWidget"') && plugin.includes('CAPPluginMethod(name: "maj", returnType: CAPPluginReturnPromise)') && plugin.includes('WidgetCenter.shared.reloadAllTimelines()'));
  assert.ok(app.includes("C.nativePromise('RequeteWidget','maj',data)"), 'l’app appelle le pont par son nom');
  assert.ok(vc.includes('class RequeteViewController: CAPBridgeViewController {') && vc.includes('bridge?.registerPluginInstance(RequeteWidgetPlugin())'));
  assert.ok(info.includes('<string>com.apple.widgetkit-extension</string>') && info.includes('<string>$(CURRENT_PROJECT_VERSION)</string>'));
  const img = JSON.parse(read('resources/ios/widget/RequeteWidget/Assets.xcassets/Mascotte.imageset/Contents.json')).images.filter(i => i.filename);
  assert.deepEqual(img.map(i => i.scale), ['2x', '3x']);
  for (const i of img) assert.ok(fs.statSync(path.join(ROOT, 'resources/ios/widget/RequeteWidget/Assets.xcassets/Mascotte.imageset', i.filename)).size > 50000, i.filename);
  /* App Store Connect refuse le code qui lit UserDefaults sans manifeste de confidentialité (ITMS-91053) : un par cible */
  for (const f of ['resources/ios/widget/App/PrivacyInfo.xcprivacy', 'resources/ios/widget/RequeteWidget/PrivacyInfo.xcprivacy']) {
    const m = read(f);
    assert.ok(m.includes('<string>NSPrivacyAccessedAPICategoryUserDefaults</string>') && m.includes('<string>1C8F.1</string>') && m.includes('<key>NSPrivacyTracking</key>\n\t<false/>'), f);
  }
  const pkg = JSON.parse(read('package.json')).scripts;
  for (const k of ['ios', 'ios:add', 'ios:testflight']) assert.ok(pkg[k].includes('bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs'), k);
});

test('scripts/ios-widget.mjs : la cible du widget ajoutée une fois au projet de Capacitor, le contrôleur branché ensuite', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), {recursive: true});
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), {recursive: true}); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), {recursive: true});
    fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
    fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), {recursive: true});
    const pbx = path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'), sb = path.join(t, 'ios/App/App/Base.lproj/Main.storyboard');
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), pbx);
    /* Un storyboard inattendu : rien n’est changé, et la fabrication continue (code 0) */
    fs.writeFileSync(sb, '<document><viewController customClass="AutreChose"/></document>');
    const refus = execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    assert.equal(fs.readFileSync(pbx, 'utf8'), read('tests/fixtures/ios-capacitor/project.pbxproj'), 'projet intact');
    assert.equal(refus, '');
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), sb);
    const out = execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8'});
    assert.ok(out.includes('Widget ajouté au projet Xcode'), out);
    const p = fs.readFileSync(pbx, 'utf8');
    /* Bien formé : accolades et parenthèses, chaque identifiant cité est défini */
    const n = c => p.split(c).length - 1;
    assert.equal(n('{'), n('}')); assert.equal(n('('), n(')'));
    const defs = new Set([...p.matchAll(/^\t\t([0-9A-F]{24}) (?:\/\*[^*]*\*\/ )?= \{/gm)].map(m => m[1]));
    for (const id of new Set(p.match(/\b[0-9A-F]{24}\b/g))) assert.ok(defs.has(id), `${id} défini`);
    assert.ok(p.includes('productType = "com.apple.product-type.app-extension";') && p.includes('dstSubfolderSpec = 13;') && p.includes('remoteInfo = RequeteWidgetExtension;'));
    assert.equal(n('PRODUCT_BUNDLE_IDENTIFIER = fr.requete.app.widget;'), 2);
    assert.equal(n('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;'), 2);
    assert.equal(n('CODE_SIGN_ENTITLEMENTS = RequeteWidget/RequeteWidget.entitlements;'), 2);
    assert.equal(n('DEVELOPMENT_TEAM = ABCDE12345;'), 4, 'la même équipe que l’app');
    assert.equal(n('TARGETED_DEVICE_FAMILY = 1;'), 4, 'iPhone seulement (4 novembre, 22 h 50) : l’app et le widget, en Debug et en Release');
    assert.equal(n('TARGETED_DEVICE_FAMILY = "1,2";'), 0);
    assert.equal(n('/* PrivacyInfo.xcprivacy in Resources */,'), 2, 'un manifeste de confidentialité dans chaque cible');
    assert.ok(/buildPhases = \(\n\t\t\t\t504EC3001FED79650016851F \/\* Sources \*\/,\n\t\t\t\t504EC3011FED79650016851F \/\* Frameworks \*\/,\n\t\t\t\t504EC3021FED79650016851F \/\* Resources \*\/,\n\t\t\t\tA7E1D0000000000000000017 \/\* Embed Foundation Extensions \*\/,/.test(p), 'l’app embarque le widget');
    assert.ok(p.includes('RequeteWidgetPlugin.swift in Sources */,\n\t\t\t\tA7E1D0000000000000000004 /* RequeteViewController.swift in Sources */,'));
    assert.ok(fs.readFileSync(sb, 'utf8').includes('customClass="RequeteViewController" customModule="App" customModuleProvider="target"'));
    for (const f of ['RequeteWidget/RequeteWidget.swift', 'RequeteWidget/Info.plist', 'RequeteWidget/PrivacyInfo.xcprivacy', 'RequeteWidget/Assets.xcassets/Mascotte.imageset/mascotte@3x.png', 'App/RequeteWidgetPlugin.swift', 'App/RequeteViewController.swift', 'App/App.entitlements', 'App/PrivacyInfo.xcprivacy'])
      assert.ok(fs.existsSync(path.join(t, 'ios/App', f)), f);
    assert.ok(fs.existsSync(pbx + '.avant-widget'), 'copie de l’ancien projet');
    /* Relancé (chaque envoi) : fichiers recopiés, projet inchangé */
    const encore = execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8'});
    assert.ok(encore.includes('Widget à jour'));
    assert.equal(fs.readFileSync(pbx, 'utf8'), p);
    /* Un projet déjà muni du widget mais encore pour l’iPad (le Mac d’Elisa, 4 novembre) : il passe à l’iPhone seul au lancement suivant */
    fs.writeFileSync(pbx, p.replaceAll('TARGETED_DEVICE_FAMILY = 1;', 'TARGETED_DEVICE_FAMILY = "1,2";'));
    const ipad = execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8'});
    assert.ok(ipad.includes('iPhone seulement') && ipad.includes('Widget à jour'), ipad);
    assert.equal(fs.readFileSync(pbx, 'utf8'), p);
  } finally { fs.rmSync(t, {recursive: true, force: true}); }
});
