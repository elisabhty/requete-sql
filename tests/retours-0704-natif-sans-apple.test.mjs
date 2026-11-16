/* 16 novembre, 7 h 04 (Elisa : « Qu’est-ce qu’on peut préparer pour pas qu’on ait à faire de nouvelles soumissions à Apple ? »,
   puis « ok » pour cinq ponts de l’app iPhone) :
   1. l’anglais dans l’app iPhone elle-même : les phrases qu’iOS montre (appareil photo, photothèque) ont leur version anglaise, et
      l’app se déclare en français et en anglais ;
   2. une notification push touchée ouvre le bon écran, choisi par le serveur (« lien », ou « parcours » pour une annonce) ;
   3. de vrais fichiers partagés (une image, un CSV, une base), par la feuille de partage d’iOS ;
   4. les widgets prennent leurs images dans l’app (une nouvelle pose de Requête, un décor de saison) ;
   5. les icônes de l’app au choix, rangées dans l’app (resources/ios/icones), que la page peut proposer sans nouvelle version. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), en = lire('langue-en.js'), script = lire('scripts/ios-widget.mjs');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift'), widget = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const cut = (debut, fin) => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); const j = app.indexOf(fin, i + debut.length); assert.ok(j > i, fin); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

test('1. l’anglais de l’app iPhone : InfoPlist.strings en français et en anglais', () => {
  const anglais = lire('resources/ios/widget/App/en.lproj/InfoPlist.strings'), francais = lire('resources/ios/widget/App/fr.lproj/InfoPlist.strings');
  assert.ok(anglais.includes('"NSCameraUsageDescription" = "To attach a photo to your message in “Contact us”.";'));
  assert.ok(anglais.includes('"NSPhotoLibraryUsageDescription" = "To attach a screenshot to your message in “Contact us”.";'));
  /* Le français : les mêmes phrases que celles que le script met dans Info.plist (étape 1 ter) */
  for (const [cle, texte] of [['NSCameraUsageDescription', 'Pour joindre une photo à ton message dans « Contacte-nous ».'],
    ['NSPhotoLibraryUsageDescription', 'Pour joindre une capture d’écran à ton message dans « Contacte-nous ».']]) {
    assert.ok(francais.includes(`"${cle}" = "${texte}";`), cle);
    assert.ok(script.includes(`['${cle}', '${texte}']`), cle + ' (Info.plist)');
  }
  assert.ok(en.includes('"Contacte-nous": "Contact us"'), 'le même nom que dans l’appli en anglais');
});

/* Le projet de Capacitor (tests/fixtures/ios-capacitor), puis le script, deux fois */
const projetEssai = (info) => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-'));
  fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), {recursive: true});
  fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), {recursive: true}); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), {recursive: true});
  fs.mkdirSync(path.join(t, 'ios/App/App/Assets.xcassets/AppIcon.appiconset'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
  fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), {recursive: true});
  fs.cpSync(path.join(ROOT, 'resources/ios/icones'), path.join(t, 'resources/ios/icones'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'));
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), path.join(t, 'ios/App/App/Base.lproj/Main.storyboard'));
  fs.writeFileSync(path.join(t, 'ios/App/App/Info.plist'), info);
  return t;
};
const lancer = t => execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const PLIST = '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>\n</dict>\n</plist>\n';

test('1. scripts/ios-widget.mjs : les deux langues dans le projet Xcode, une seule fois, avec une copie de l’ancien projet', () => {
  const t = projetEssai(PLIST);
  try {
    /* Une icône au choix, rangée dans resources/ios/icones */
    fs.mkdirSync(path.join(t, 'resources/ios/icones/IconeEssai.appiconset'), {recursive: true});
    fs.writeFileSync(path.join(t, 'resources/ios/icones/IconeEssai.appiconset/Contents.json'), '{"images":[]}');
    lancer(t); lancer(t);
    const p = fs.readFileSync(path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
    for (const l of ['fr', 'en']) {
      assert.ok(fs.readFileSync(path.join(t, `ios/App/App/${l}.lproj/InfoPlist.strings`), 'utf8').includes('NSCameraUsageDescription'), l);
      assert.equal(p.split(`path = ${l}.lproj/InfoPlist.strings;`).length - 1, 1, l + ' : une seule fois');
    }
    assert.equal(p.split('/* InfoPlist.strings in Resources */ = {isa = PBXBuildFile;').length - 1, 1);
    assert.ok(/\t\t[0-9A-F]{24} \/\* InfoPlist\.strings \*\/ = \{\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = \(\n\t\t\t\t[0-9A-F]{24} \/\* fr \*\/,\n\t\t\t\t[0-9A-F]{24} \/\* en \*\/,/.test(p), 'le groupe des deux langues');
    /* Dans les ressources de la cible App (pas du widget) */
    const appId = p.match(/\t\t([0-9A-F]{24}) \/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;/)[1];
    const blocApp = p.slice(p.indexOf(`\t\t${appId} /* App */ = {`), p.indexOf('\n\t\t};', p.indexOf(`\t\t${appId} /* App */ = {`)));
    const res = blocApp.match(/\n\t\t\t\t([0-9A-F]{24}) \/\* Resources \*\/,/)[1];
    const phase = p.slice(p.indexOf(`\t\t${res} /* Resources */ = {`), p.indexOf('\n\t\t};', p.indexOf(`\t\t${res} /* Resources */ = {`)));
    assert.ok(phase.includes('/* InfoPlist.strings in Resources */,'), 'les ressources de l’app');
    assert.ok(/knownRegions = \(\n\t\t\t\tfr,\n/.test(p), 'la région fr');
    const compte = c => p.split(c).length - 1;
    assert.equal(compte('{'), compte('}')); assert.equal(compte('('), compte(')'));
    assert.ok(fs.existsSync(path.join(t, 'ios/App/App.xcodeproj/project.pbxproj.avant-langues')));
    /* 5. Les icônes : recopiées dans le catalogue de l’app, toutes déclarées, une seule fois par configuration */
    assert.ok(fs.existsSync(path.join(t, 'ios/App/App/Assets.xcassets/IconeEssai.appiconset/Contents.json')));
    assert.equal(compte('ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;'), compte('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;'));
    assert.ok(compte('ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;') >= 2);
    /* L’Info.plist : le français et l’anglais, à côté de la langue de développement */
    const info = fs.readFileSync(path.join(t, 'ios/App/App/Info.plist'), 'utf8');
    assert.ok(info.includes('\t<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>\n\t<key>CFBundleLocalizations</key>\n\t<array>\n\t\t<string>fr</string>\n\t\t<string>en</string>\n\t</array>\n'));
    assert.equal(info.split('<key>CFBundleLocalizations</key>').length - 1, 1);
  } finally { fs.rmSync(t, {recursive: true, force: true}); }
});

test('1. l’Info.plist d’Elisa (le français seul, réglé à la main le 3 novembre) reçoit l’anglais à la suite', () => {
  const t = projetEssai('<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>\n'
    + '\t<key>CFBundleLocalizations</key>\n\t<array>\n\t\t<string>fr</string>\n\t</array>\n\t<key>CFBundleName</key>\n\t<string>Requête</string>\n</dict>\n</plist>\n');
  try {
    lancer(t); lancer(t);
    const info = fs.readFileSync(path.join(t, 'ios/App/App/Info.plist'), 'utf8');
    assert.ok(info.includes('\t<key>CFBundleLocalizations</key>\n\t<array>\n\t\t<string>fr</string>\n\t\t<string>en</string>\n\t</array>\n\t<key>CFBundleName</key>'));
    assert.equal(info.split('<string>en</string>').length - 1, 1, 'une seule fois');
  } finally { fs.rmSync(t, {recursive: true, force: true}); }
});

test('2. le pont reçoit les notifications push touchées ; leur lien devient un raccourci', () => {
  const load = pont.slice(pont.indexOf('override public func load() {'), pont.indexOf('\n    }\n', pont.indexOf('override public func load() {')));
  assert.ok(load.includes('bridge?.notificationRouter.pushNotificationHandler = self'));
  assert.ok(pont.includes('extension RequeteWidgetPlugin: NotificationHandlerProtocol {'));
  assert.ok(pont.includes('return [.banner, .list, .sound]'), 'l’app ouverte, elle s’affiche quand même');
  assert.ok(pont.includes('guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }\n        RequetePushLien.ouvrir(response.notification.request.content.userInfo)'));
  const l = pont.slice(pont.indexOf('enum RequetePushLien {'), pont.indexOf('enum RequeteImagesWidget {'));
  assert.ok(l.includes('if schema == "requete" || schema == "https" {'), 'seulement nos liens (une invitation passe par RequeteRaccourci.invitation, qui vérifie l’hôte)');
  assert.ok(l.includes('id.range(of: "^[a-z]{1,20}$", options: .regularExpression) != nil') && l.includes('c.host = "parcours." + id'), 'l’annonce d’un parcours');
  assert.ok(l.includes('DispatchQueue.main.async { RequeteRaccourci.ouvrir(url) }'));
  /* L’annonce envoyée par le serveur porte déjà le parcours */
  assert.ok(lire('supabase/functions/parcours-annoncer/handler.mjs').includes("sound: 'default'}, parcours: id};"));
});

test('2. la page : « onglet.X » ouvre un onglet connu, « parcours.X » plus rien (16 novembre) ; l’onboarding, le paywall et la séance d’abord', () => {
  const src = cut('const RACC_ONGLETS=', '\nfunction raccourciOuvrir(') + '\n' + fn('raccourciOuvrir');
  const essai = ({onboarded = true, bloque = false, seance = false} = {}) => {
    const j = {tabs: [], parcours: [], bandeau: [], toast: []};
    const ctx = vm.createContext({state: {onboarded}, stat: () => {}, sessionStorage: {setItem() {}, removeItem() {}},
      obBandeau: t => j.bandeau.push(t), obGardeBloque: () => bloque, toast: (a, b) => j.toast.push(b),
      document: {querySelector: q => (seance && q.includes('#scr-lesson.active')) ? {} : null},
      switchTab: t => j.tabs.push(t), setTimeout: () => {}});
    vm.runInContext(src, ctx);
    return {j, ouvrir: t => ctx.raccourciOuvrir(t)};
  };
  let e = essai();
  e.ouvrir('fr.requete.app.parcours.python'); e.ouvrir('fr.requete.app.onglet.planning'); e.ouvrir('fr.requete.app.onglet.console');
  e.ouvrir('fr.requete.app.onglet.inconnu'); e.ouvrir('fr.requete.app.onglet.cartes');
  assert.deepEqual(e.j.tabs, ['planning', 'console'], 'un onglet inconnu ne fait rien ; un parcours non plus : les parcours à venir sont retirés');
  e = essai(); e.ouvrir('fr.requete.app.planning'); e.ouvrir('fr.requete.app.cartes');
  assert.deepEqual(e.j.tabs, ['planning', 'collection'], 'les raccourcis d’avant, inchangés');
  e = essai({onboarded: false}); e.ouvrir('fr.requete.app.parcours.excel'); e.ouvrir('fr.requete.app.onglet.compte');
  assert.deepEqual(e.j.tabs, []); assert.deepEqual(e.j.bandeau, ['Termine ton parcours de bienvenue : tout le reste t’attend juste après !']);
  e = essai({bloque: true}); e.ouvrir('fr.requete.app.onglet.compte');
  assert.deepEqual(e.j.tabs, [], 'le paywall garde l’appli');
  e = essai({seance: true}); e.ouvrir('fr.requete.app.onglet.compte');
  assert.deepEqual(e.j.tabs, []); assert.deepEqual(e.j.toast, ['Termine-la, puis tu pourras y aller.']);
  for (const k of ['Termine ton parcours de bienvenue : tout le reste t’attend juste après !', 'Termine-la, puis tu pourras y aller.']) assert.ok(en.includes(`"${k}":`), k);
  /* Les onglets permis sont ceux de switchTab */
  const map = fn('switchTab').match(/const map=\{([^}]+)\}/)[1];
  for (const o of vm.runInNewContext(cut('const RACC_ONGLETS=', ';\n') + ';RACC_ONGLETS')) assert.ok(map.includes(o + ':'), o);
});

test('3. de vrais fichiers : partagerFichiers (dix au plus, 50 Mo), et saveFile passe par lui dans l’app', async () => {
  const m = pont.slice(pont.indexOf('@objc func partagerFichiers('), pont.indexOf('@objc func widgetImages('));
  assert.ok(m.includes('for r in brutes.prefix(10) {') && m.includes('if total > 50_000_000 { break }'));
  assert.ok(m.includes('fm.temporaryDirectory.appendingPathComponent("Partage-" + UUID().uuidString, isDirectory: true)'), 'un dossier à part par partage');
  assert.ok(m.includes('.replacingOccurrences(of: "/", with: "-")'), 'pas de chemin dans le nom');
  assert.ok(m.includes('UIActivityViewController(activityItems: urls, applicationActivities: nil)') && m.includes('call.resolve(["ok": fait, "type": type?.rawValue ?? ""])'));
  /* La page : le pont d’abord ; une version de l’app d’avant (méthode inconnue) repasse par le chemin d’avant */
  const src = fn('blobBase64') + 'async ' + fn('saveFileNatif') + 'async ' + fn('saveFile');
  const essai = (natif) => {
    const appels = [];
    const ctx = vm.createContext({appels, ilePont: () => natif && {nativePromise: async (p, m, d) => { appels.push([p, m, d.fichiers[0].nom, d.fichiers[0].base64]); return natif(); }},
      FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,QUJD'; this.onload(); } },
      document: {documentElement: {classList: {contains: () => false}}, createElement: () => ({click() {}, remove() {}}), body: {appendChild() {}}},
      URL: {createObjectURL: () => 'blob:x', revokeObjectURL() {}}, navigator: {}, setTimeout: () => {}, window: {}});
    vm.runInContext(src, ctx);
    return {appels, ctx};
  };
  let e = essai(async () => ({ok: true}));
  assert.equal(await e.ctx.saveFile({type: 'image/png'}, 'requete-stickers.png', 'Mes stickers'), 'share');
  assert.deepEqual(e.appels, [['RequeteWidget', 'partagerFichiers', 'requete-stickers.png', 'QUJD']]);
  e = essai(async () => ({ok: false}));
  assert.equal(await e.ctx.saveFile({type: 'image/png'}, 'a.png', 'x'), null, 'la feuille fermée sans rien faire');
  e = essai(async () => { throw new Error('UNIMPLEMENTED'); });
  assert.equal(await e.ctx.saveFile({type: 'image/png'}, 'a.png', 'x'), 'download', 'une version de l’app d’avant');
  e = essai(null);
  assert.equal(await e.ctx.saveFile({type: 'image/png'}, 'a.png', 'x'), 'download', 'hors de l’app');
});

test('4. les widgets prennent leurs images dans l’app, les Live Activities gardent les leurs', () => {
  const m = pont.slice(pont.indexOf('enum RequeteImagesWidget {'), pont.indexOf('enum RequeteIcone {'));
  assert.ok(m.includes('containerURL(forSecurityApplicationGroupIdentifier: "group.fr.requete.app")') && m.includes('appendingPathComponent("Images", isDirectory: true)'));
  assert.ok(m.includes('nom.range(of: "^[A-Za-z0-9_-]{1,40}$", options: .regularExpression) != nil'), 'un nom d’image, jamais un chemin');
  assert.ok(m.includes('static let cote: CGFloat = 700') && m.includes('if plus > cote {'), 'réduite pour la mémoire d’un widget');
  assert.ok(m.includes('try png.write(to: dos.appendingPathComponent(nom + ".png"), options: .atomic)'));
  const w = pont.slice(pont.indexOf('@objc func widgetImages('), pont.indexOf('@objc func icones('));
  assert.ok(w.includes('RequeteImagesWidget.toutEffacer()') && w.includes('.prefix(40)') && w.includes('WidgetCenter.shared.reloadAllTimelines()'));
  /* Le widget */
  const ia = widget.slice(widget.indexOf('enum ImageApp {'), widget.indexOf('enum Humeur: String {'));
  assert.ok(ia.includes('if let ui = charger(nom) {\n            return Image(uiImage: ui)\n        }\n        return Image(nom)'), 'l’image du catalogue si l’app n’en a pas envoyé');
  assert.ok(ia.includes('containerURL(forSecurityApplicationGroupIdentifier: groupe)') && ia.includes('appendingPathComponent("Images", isDirectory: true).appendingPathComponent(nom + ".png")'));
  const fin = widget.indexOf('// MARK: - La leçon en cours, dans la Dynamic Island');
  const tete = widget.slice(0, fin).replace(ia, ''), queue = widget.slice(fin);
  assert.equal((tete.match(/ImageApp\.image\(/g) || []).length, 8, 'les huit images des widgets de l’écran d’accueil');
  assert.equal((tete.match(/(?<![A-Za-z.])Image\("|(?<![A-Za-z.])Image\((nom|nomChat|feu\.image)\)/g) || []).length, 0, 'plus une seule en dur');
  assert.ok(!queue.includes('ImageApp.'), 'les Live Activities gardent les leurs (une image trop grande ne s’y affiche pas)');
  /* La page */
  const f = fn('widgetImagesEnvoyer');
  assert.ok(f.includes("C.nativePromise('RequeteWidget','widgetImages',{images,tout:!!(o&&o.tout),effacer:(o&&o.effacer)||[]})") && f.includes('.slice(0,40)'));
});

test('5. les icônes au choix : la liste vient de l’app, le changement d’un geste de la personne', () => {
  const l = pont.slice(pont.indexOf('enum RequeteIcone {'), pont.indexOf('@objc(RequeteWidgetPlugin)'));
  assert.ok(l.includes('Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons")') && l.includes('icones["CFBundleAlternateIcons"] as? [String: Any]'));
  const c = pont.slice(pont.indexOf('@objc func iconeChoisir('), pont.indexOf('/// « Gérer mon abonnement »'));
  assert.ok(c.includes('if !nom.isEmpty && !RequeteIcone.liste().contains(nom) {\n            call.reject("Icône inconnue")'), 'seulement une icône de cette version');
  assert.ok(c.includes('UIApplication.shared.setAlternateIconName(voulue)') && c.includes('let voulue: String? = nom.isEmpty ? nil : nom'), 'vide : l’icône de base');
  assert.ok(pont.includes('call.resolve(["possible": possible, "actuelle": actuelle, "liste": RequeteIcone.liste()])'));
  assert.ok(lire('resources/ios/icones/LISEZMOI.md').includes('ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS'));
  assert.ok(fn('iconesNatif').includes("C.nativePromise('RequeteWidget','icones',{})") && fn('iconeChoisir').includes("C.nativePromise('RequeteWidget','iconeChoisir',{nom:nom||''})"));
});

test('les nouvelles méthodes du pont, à la fin de sa liste ; le Swift reste lisible par les tests', () => {
  assert.ok(pont.includes('        CAPPluginMethod(name: "fichierFini", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "partagerFichiers", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "widgetImages", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "icones", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "iconeChoisir", returnType: CAPPluginReturnPromise)\n    ]'));
  for (const f of [pont, widget]) {
    const c = f.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const [a, b] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(c.split(a).length, c.split(b).length, a + b);
    for (const ligne of c.split('\n')) assert.ok((ligne.match(/ \? /g) || []).length <= 1, 'un seul choix par ligne : ' + ligne);
  }
});
