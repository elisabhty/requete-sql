// Le widget de l’app iPhone (Elisa, 4 novembre, 3 h 54 : la série 🔥 et le chat sur l’écran d’accueil, comme Duolingo).
// Le dossier ios/ n’est pas dans Git : ce script y recopie la version gardée dans resources/ios/widget, puis, une seule fois,
// ajoute au projet Xcode la cible RequeteWidgetExtension (WidgetKit), le groupe d’apps group.fr.requete.app (app et widget)
// et le pont RequeteWidgetPlugin (enregistré par RequeteViewController, que crée le délégué de scène et que désigne Main.storyboard),
// qui sert aussi aux raccourcis de l’icône. Lancé par npm run ios,
// ios:add et ios:testflight, après « cap sync ». Relancé, il met les fichiers à jour et ne touche plus au projet.
// Rien n’est changé si le projet ne ressemble pas à celui de Capacitor : un avertissement le dit, et la fabrication de l’app
// continue sans widget (l’onboarding ne le propose alors pas : il n’apparaît qu’avec le pont natif).
import {cpSync, existsSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {join} from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const src = join(racine, 'resources/ios/widget');
const ios = join(racine, 'ios/App');
const projet = join(ios, 'App.xcodeproj/project.pbxproj');
const story = join(ios, 'App/Base.lproj/Main.storyboard');
const arret = m => { console.warn(`⚠️  Widget non ajouté : ${m} L’app se fabrique sans lui.`); process.exit(0); };
if (!existsSync(projet) || !existsSync(story)) arret('projet iOS introuvable (ios/App) ; lance d’abord npm run ios:add.');

/* 1. Les fichiers : le widget (dossier RequeteWidget), le pont et le contrôleur (dans App), les droits du groupe d’apps. */
cpSync(join(src, 'RequeteWidget'), join(ios, 'RequeteWidget'), {recursive: true});
for (const f of ['RequeteWidgetPlugin.swift', 'RequeteViewController.swift', 'App.entitlements']) copyFileSync(join(src, 'App', f), join(ios, 'App', f));
/* Le manifeste de confidentialité de l’app : le nôtre, sauf s’il y en a déjà un autre (ajouté à la main dans Xcode). */
const privApp = join(ios, 'App', 'PrivacyInfo.xcprivacy');
if (!existsSync(privApp) || readFileSync(privApp, 'utf8').includes('ITMS-91053')) copyFileSync(join(src, 'App', 'PrivacyInfo.xcprivacy'), privApp);
/* 1 bis. La Dynamic Island (Elisa, 4 novembre, 12 h 35) : iOS ne montre les Live Activities d’une app que si son Info.plist
   (ios/App/App/Info.plist, hors de Git) a NSSupportsLiveActivities. Ajouté une fois, avant la fin du dictionnaire principal. */
const infoApp = join(ios, 'App', 'Info.plist');
if (existsSync(infoApp)) {
  const t = readFileSync(infoApp, 'utf8'), k = t.lastIndexOf('</dict>');
  if (t.includes('<key>NSSupportsLiveActivities</key>')) {}
  else if (k > 0 && t.indexOf('</plist>', k) > k) writeFileSync(infoApp, t.slice(0, k) + '\t<key>NSSupportsLiveActivities</key>\n\t<true/>\n' + t.slice(k));
  else console.warn('⚠️  Info.plist inattendu : NSSupportsLiveActivities n’y est pas (la leçon n’apparaîtra pas dans la Dynamic Island).');
}
/* 1 ter. Les pièces jointes de « Contacte-nous » (anciennement « Nous contacter ») (Elisa, 4 novembre, 22 h 08 : « toutes les choses obligatoires pour passer la
   validation Apple ») : choisir une image propose « Prendre une photo » et la photothèque ; sans ces deux phrases, iOS ferme l’app
   à ce moment-là, et l’App Review le voit. Ajoutées une fois, avant la fin du dictionnaire principal. */
if (existsSync(infoApp)) {
  const t = readFileSync(infoApp, 'utf8'), k = t.lastIndexOf('</dict>');
  const ajout = [
    ['NSCameraUsageDescription', 'Pour joindre une photo à ton message dans « Contacte-nous ».'],
    ['NSPhotoLibraryUsageDescription', 'Pour joindre une capture d’écran à ton message dans « Contacte-nous ».'],
  ].filter(([cle]) => !t.includes(`<key>${cle}</key>`));
  if (ajout.length && k > 0 && t.indexOf('</plist>', k) > k)
    writeFileSync(infoApp, t.slice(0, k) + ajout.map(([cle, texte]) => `\t<key>${cle}</key>\n\t<string>${texte}</string>\n`).join('') + t.slice(k));
}
/* 1 quater. Le lien du widget La cheminée (Elisa, 7 novembre, « Cheminée + lunettes ») : le soir, « Allumer ma flamme » ouvre
   requete://seance, que le délégué de scène passe à la page (la séance du jour). Le schéma « requete » est déclaré une fois, avant
   la fin du dictionnaire principal ; un Info.plist qui a déjà ses schémas d’URL n’est pas touché (un avertissement le dit). */
if (existsSync(infoApp)) {
  const t = readFileSync(infoApp, 'utf8'), k = t.lastIndexOf('</dict>');
  const schema = '\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>fr.requete.app</string>\n'
    + '\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>requete</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n';
  if (t.includes('<string>requete</string>')) {}
  else if (t.includes('<key>CFBundleURLTypes</key>')) console.warn('⚠️  Info.plist a déjà des schémas d’URL : ajoute « requete » dans CFBundleURLSchemes (voir IOS.md), sinon « Allumer ma flamme » ouvre l’app sans la séance.');
  else if (k > 0 && t.indexOf('</plist>', k) > k) writeFileSync(infoApp, t.slice(0, k) + schema + t.slice(k));
}

/* 2. Main.storyboard : le contrôleur de l’app, qui enregistre le pont du widget. Seulement une fois le projet prêt (étape 3) :
   un storyboard qui désignerait un contrôleur absent du projet ouvrirait l’app sur un écran vide. */
const sb = readFileSync(story, 'utf8');
const sbAvant = 'customClass="CAPBridgeViewController" customModule="Capacitor"';
const sbApres = 'customClass="RequeteViewController" customModule="App" customModuleProvider="target"';
if (!sb.includes(sbAvant) && !sb.includes(sbApres)) arret('Main.storyboard ne désigne pas CAPBridgeViewController ; rien n’a été changé.');
/* 2 bis. Le délégué de scène (Elisa, 4 novembre, 9 h 02 : les raccourcis de l’icône, comme Duolingo). Le modèle de Capacitor 8.6
   crée lui-même un CAPBridgeViewController, sans passer par Main.storyboard : le pont du widget n’était donc jamais enregistré.
   Le nôtre (resources/ios/widget/App/SceneDelegate.swift) crée RequeteViewController et reçoit les raccourcis ; il remplace celui
   du modèle (gardé dans SceneDelegate.swift.avant-requete), ou le sien d’un envoi précédent. Un délégué modifié à la main n’est
   pas touché. Sans délégué de scène (modèles plus anciens) : le storyboard suffit au pont, et l’app reçoit les raccourcis. */
const scene = join(ios, 'App', 'SceneDelegate.swift'), appDel = join(ios, 'App', 'AppDelegate.swift');
const MODELE = ['window?.rootViewController = CAPBridgeViewController()', 'SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)'];
const RACC = `    // Raccourcis de l’icône (scripts/ios-widget.mjs) : passés à la page par RequeteWidgetPlugin (RequeteRaccourci).
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        RequeteRaccourci.recevoir(shortcutItem.type)
        completionHandler(true)
    }
`;
const brancherScene = () => {
  if (existsSync(scene)) {
    const s = readFileSync(scene, 'utf8');
    if (s.includes('RequeteRaccourci') || MODELE.every(m => s.includes(m))) {
      const garde = scene + '.avant-requete';
      if (!s.includes('RequeteRaccourci') && !existsSync(garde)) writeFileSync(garde, s);
      copyFileSync(join(src, 'App', 'SceneDelegate.swift'), scene);
    } else console.warn('⚠️  SceneDelegate.swift a été modifié à la main : ni le widget ni les raccourcis n’y sont branchés (voir IOS.md).');
  } else if (existsSync(appDel)) {
    const a = readFileSync(appDel, 'utf8');
    if (!a.includes('RequeteRaccourci') && !a.includes('performActionFor shortcutItem')) {
      const fin = a.lastIndexOf('}');
      if (fin > 0 && /class AppDelegate\b/.test(a)) writeFileSync(appDel, a.slice(0, fin) + '\n' + RACC + a.slice(fin));
      else console.warn('⚠️  AppDelegate.swift inattendu : les raccourcis de l’icône n’y sont pas branchés.');
    }
  }
};
const brancher = () => { if (sb.includes(sbAvant)) writeFileSync(story, sb.replace(sbAvant, sbApres)); brancherScene(); };

/* 3. Le projet Xcode, une seule fois. */
let p = readFileSync(projet, 'utf8');
/* 3 bis. iPhone seulement (Elisa, 4 novembre, 22 h 50 : « iPhone seulement », pour la validation Apple) : Capacitor crée la cible
   App pour l’iPhone et l’iPad (« 1,2 ») ; toutes les cibles passent à 1. Sur iPad, l’app tourne alors en mode iPhone, et App Store
   Connect ne demande pas de captures d’iPad. À chaque lancement, widget déjà là ou pas (« cap add ios » refait la cible App). */
if (p.includes('TARGETED_DEVICE_FAMILY = "1,2";')) {
  p = p.replace(/TARGETED_DEVICE_FAMILY = "1,2";/g, 'TARGETED_DEVICE_FAMILY = 1;');
  writeFileSync(projet, p);
  console.log('iPhone seulement : TARGETED_DEVICE_FAMILY = 1 dans toutes les cibles du projet Xcode.');
}
if (p.includes('RequeteWidgetExtension')) {
  if (!p.includes('RequeteViewController.swift in Sources')) arret('la cible du widget est là, mais pas RequeteViewController ; rien n’a été changé.');
  brancher();
  console.log('Widget à jour (fichiers recopiés ; la cible était déjà dans le projet).');
  process.exit(0);
}
const P = 'A7E1D00000000000000000';   // préfixe des identifiants ajoutés (24 chiffres hexadécimaux en tout)
const id = n => P + n;
const ID = {
  plugin: id('01'), bfPlugin: id('02'), vc: id('03'), bfVc: id('04'), appEnt: id('05'), appex: id('06'), bfAppex: id('07'),
  swift: id('08'), bfSwift: id('09'), assets: id('0A'), bfAssets: id('0B'), info: id('0C'), ent: id('0D'),
  wk: id('0E'), bfWk: id('0F'), sui: id('10'), bfSui: id('11'), groupe: id('12'), fw: id('13'),
  sources: id('14'), frameworks: id('15'), resources: id('16'), embed: id('17'), proxy: id('18'), dep: id('19'),
  cible: id('1A'), debug: id('1B'), release: id('1C'), liste: id('1D'),
  privApp: id('1E'), bfPrivApp: id('1F'), priv: id('20'), bfPriv: id('21')
};
if (Object.values(ID).some(x => p.includes(x))) arret('identifiants déjà pris dans le projet : rien n’a été changé.');

/* Repères du projet de Capacitor (cible App, ses phases, ses réglages, le projet). */
const trouve = (re, quoi) => { const m = p.match(re); if (!m) arret(`repère introuvable dans project.pbxproj (${quoi}) : rien n’a été changé.`); return m; };
const cibleApp = trouve(/\t\t([0-9A-F]{24}) \/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};\n/, 'cible App');
const appId = cibleApp[1], blocApp = cibleApp[0];
const listeApp = trouve(new RegExp(appId + '[\\s\\S]*?buildConfigurationList = ([0-9A-F]{24})'), 'réglages de la cible App')[1];
const confsApp = trouve(new RegExp('\\t\\t' + listeApp + ' \\/\\* [^*]+ \\*\\/ = \\{\\n\\t\\t\\tisa = XCConfigurationList;\\n\\t\\t\\tbuildConfigurations = \\(\\n([\\s\\S]*?)\\t\\t\\t\\);'), 'configurations de la cible App')[1]
  .match(/[0-9A-F]{24}/g) || [];
if (confsApp.length < 2) arret('la cible App n’a pas ses deux configurations : rien n’a été changé.');
const sourcesApp = trouve(/buildPhases = \(\n\t\t\t\t([0-9A-F]{24}) \/\* Sources \*\/,/, 'phase Sources de la cible App')[1];
const resourcesApp = trouve(new RegExp(appId + '[\\s\\S]*?\\n\\t\\t\\t\\t([0-9A-F]{24}) \\/\\* Resources \\*\\/,'), 'phase Resources de la cible App')[1];
/* Un manifeste de confidentialité déjà dans App (ajouté à la main) : celui du widget seul. */
const privDeja = p.includes('PrivacyInfo.xcprivacy');
const projetId = trouve(/rootObject = ([0-9A-F]{24})/, 'objet du projet')[1];
const groupeApp = trouve(/\t\t([0-9A-F]{24}) \/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;/, 'groupe App')[1];
const groupeProduits = trouve(/productRefGroup = ([0-9A-F]{24})/, 'groupe Products')[1];
const groupePrincipal = trouve(/mainGroup = ([0-9A-F]{24});/, 'groupe principal')[1];
const debutRelease = p.indexOf('\t\t' + confsApp[1] + ' /* Release */ = {');
if (debutRelease < 0) arret('configuration Release de App introuvable ; rien n’a été changé.');
const blocRelease = p.slice(debutRelease, p.indexOf('\n\t\t};', debutRelease));
const reglage = (k) => { const m = blocRelease.match(new RegExp('\\n\\t\\t\\t\\t' + k + ' = ([^;]+);')); return m ? m[1] : ''; };
const equipe = reglage('DEVELOPMENT_TEAM'), build = reglage('CURRENT_PROJECT_VERSION') || '1', version = reglage('MARKETING_VERSION') || '1.0';
const cibleIos = reglage('IPHONEOS_DEPLOYMENT_TARGET') || '15.0';

const avant = (marque, texte) => { if (!p.includes(marque)) arret(`section introuvable (${marque}) : rien n’a été changé.`); p = p.replace(marque, texte + marque); };
const dans = (bloc, liste, ajout) => {   // ajoute des lignes à une liste « liste = ( … ); » d’un objet
  const i = p.indexOf(bloc); if (i < 0) arret('objet introuvable : rien n’a été changé.');
  const j = p.indexOf(`${liste} = (\n`, i); const k = p.indexOf('\t\t\t);', j);
  if (j < 0 || k < 0 || p.indexOf('\n\t\t};', i) < j) arret(`liste ${liste} introuvable : rien n’a été changé.`);
  p = p.slice(0, k) + ajout + p.slice(k);
};

avant('/* End PBXBuildFile section */', [
  `\t\t${ID.bfPlugin} /* RequeteWidgetPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ID.plugin} /* RequeteWidgetPlugin.swift */; };`,
  `\t\t${ID.bfVc} /* RequeteViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ID.vc} /* RequeteViewController.swift */; };`,
  `\t\t${ID.bfAppex} /* RequeteWidgetExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = ${ID.appex} /* RequeteWidgetExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };`,
  `\t\t${ID.bfSwift} /* RequeteWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ID.swift} /* RequeteWidget.swift */; };`,
  `\t\t${ID.bfAssets} /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.assets} /* Assets.xcassets */; };`,
  `\t\t${ID.bfWk} /* WidgetKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = ${ID.wk} /* WidgetKit.framework */; };`,
  `\t\t${ID.bfSui} /* SwiftUI.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = ${ID.sui} /* SwiftUI.framework */; };`,
  ...(privDeja ? [] : [`\t\t${ID.bfPrivApp} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.privApp} /* PrivacyInfo.xcprivacy */; };`]),
  `\t\t${ID.bfPriv} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.priv} /* PrivacyInfo.xcprivacy */; };`, ''].join('\n'));

/* Nouvelles sections, à leur place (ordre alphabétique de Xcode) */
p = p.replace('/* End PBXBuildFile section */\n', `/* End PBXBuildFile section */

/* Begin PBXContainerItemProxy section */
\t\t${ID.proxy} /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = ${projetId} /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = ${ID.cible};
\t\t\tremoteInfo = RequeteWidgetExtension;
\t\t};
/* End PBXContainerItemProxy section */

/* Begin PBXCopyFilesBuildPhase section */
\t\t${ID.embed} /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t${ID.bfAppex} /* RequeteWidgetExtension.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXCopyFilesBuildPhase section */
`);

avant('/* End PBXFileReference section */', [
  `\t\t${ID.plugin} /* RequeteWidgetPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RequeteWidgetPlugin.swift; sourceTree = "<group>"; };`,
  `\t\t${ID.vc} /* RequeteViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RequeteViewController.swift; sourceTree = "<group>"; };`,
  `\t\t${ID.appEnt} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };`,
  `\t\t${ID.appex} /* RequeteWidgetExtension.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = RequeteWidgetExtension.appex; sourceTree = BUILT_PRODUCTS_DIR; };`,
  `\t\t${ID.swift} /* RequeteWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RequeteWidget.swift; sourceTree = "<group>"; };`,
  `\t\t${ID.assets} /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };`,
  `\t\t${ID.info} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };`,
  `\t\t${ID.ent} /* RequeteWidget.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = RequeteWidget.entitlements; sourceTree = "<group>"; };`,
  `\t\t${ID.wk} /* WidgetKit.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = WidgetKit.framework; path = System/Library/Frameworks/WidgetKit.framework; sourceTree = SDKROOT; };`,
  `\t\t${ID.sui} /* SwiftUI.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = SwiftUI.framework; path = System/Library/Frameworks/SwiftUI.framework; sourceTree = SDKROOT; };`,
  ...(privDeja ? [] : [`\t\t${ID.privApp} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`]),
  `\t\t${ID.priv} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`, ''].join('\n'));

avant('/* End PBXFrameworksBuildPhase section */', `\t\t${ID.frameworks} /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${ID.bfWk} /* WidgetKit.framework in Frameworks */,
\t\t\t\t${ID.bfSui} /* SwiftUI.framework in Frameworks */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
`);

/* Groupes : le dossier du widget et les frameworks à côté de App ; le widget dans Products ; le pont et les droits dans App. */
dans(`\t\t${groupePrincipal} = {`, 'children', `\t\t\t\t${ID.groupe} /* RequeteWidget */,\n\t\t\t\t${ID.fw} /* Frameworks */,\n`);
dans(`\t\t${groupeProduits} /* Products */ = {`, 'children', `\t\t\t\t${ID.appex} /* RequeteWidgetExtension.appex */,\n`);
dans(`\t\t${groupeApp} /* App */ = {\n\t\t\tisa = PBXGroup;`, 'children', `\t\t\t\t${ID.plugin} /* RequeteWidgetPlugin.swift */,\n\t\t\t\t${ID.vc} /* RequeteViewController.swift */,\n\t\t\t\t${ID.appEnt} /* App.entitlements */,\n` + (privDeja ? '' : `\t\t\t\t${ID.privApp} /* PrivacyInfo.xcprivacy */,\n`));
avant('/* End PBXGroup section */', `\t\t${ID.groupe} /* RequeteWidget */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t${ID.swift} /* RequeteWidget.swift */,
\t\t\t\t${ID.assets} /* Assets.xcassets */,
\t\t\t\t${ID.info} /* Info.plist */,
\t\t\t\t${ID.ent} /* RequeteWidget.entitlements */,
\t\t\t\t${ID.priv} /* PrivacyInfo.xcprivacy */,
\t\t\t);
\t\t\tpath = RequeteWidget;
\t\t\tsourceTree = "<group>";
\t\t};
\t\t${ID.fw} /* Frameworks */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t${ID.wk} /* WidgetKit.framework */,
\t\t\t\t${ID.sui} /* SwiftUI.framework */,
\t\t\t);
\t\t\tname = Frameworks;
\t\t\tsourceTree = "<group>";
\t\t};
`);

/* La cible App embarque le widget et en dépend ; la cible du widget */
dans(blocApp.slice(0, 60), 'buildPhases', `\t\t\t\t${ID.embed} /* Embed Foundation Extensions */,\n`);
dans(blocApp.slice(0, 60), 'dependencies', `\t\t\t\t${ID.dep} /* PBXTargetDependency */,\n`);
avant('/* End PBXNativeTarget section */', `\t\t${ID.cible} /* RequeteWidgetExtension */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = ${ID.liste} /* Build configuration list for PBXNativeTarget "RequeteWidgetExtension" */;
\t\t\tbuildPhases = (
\t\t\t\t${ID.sources} /* Sources */,
\t\t\t\t${ID.frameworks} /* Frameworks */,
\t\t\t\t${ID.resources} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = RequeteWidgetExtension;
\t\t\tproductName = RequeteWidgetExtension;
\t\t\tproductReference = ${ID.appex} /* RequeteWidgetExtension.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
`);

/* Le projet : la nouvelle cible, après App */
const ta = trouve(new RegExp('\\t\\t\\t\\tTargetAttributes = \\{\\n\\t\\t\\t\\t\\t' + appId + ' = \\{[\\s\\S]*?\\n\\t\\t\\t\\t\\t\\};\\n'), 'attributs de la cible App')[0];
p = p.replace(ta, ta + `\t\t\t\t\t${ID.cible} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;\n\t\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t};\n`);
dans(`\t\t${projetId} /* Project object */ = {`, 'targets', `\t\t\t\t${ID.cible} /* RequeteWidgetExtension */,\n`);

avant('/* End PBXResourcesBuildPhase section */', `\t\t${ID.resources} /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${ID.bfAssets} /* Assets.xcassets in Resources */,
\t\t\t\t${ID.bfPriv} /* PrivacyInfo.xcprivacy in Resources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
`);

if (!privDeja) dans(`\t\t${resourcesApp} /* Resources */ = {`, 'files', `\t\t\t\t${ID.bfPrivApp} /* PrivacyInfo.xcprivacy in Resources */,\n`);
dans(`\t\t${sourcesApp} /* Sources */ = {`, 'files', `\t\t\t\t${ID.bfPlugin} /* RequeteWidgetPlugin.swift in Sources */,\n\t\t\t\t${ID.bfVc} /* RequeteViewController.swift in Sources */,\n`);
avant('/* End PBXSourcesBuildPhase section */', `\t\t${ID.sources} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${ID.bfSwift} /* RequeteWidget.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
`);
p = p.replace('/* End PBXSourcesBuildPhase section */\n', `/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
\t\t${ID.dep} /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = ${ID.cible} /* RequeteWidgetExtension */;
\t\t\ttargetProxy = ${ID.proxy} /* PBXContainerItemProxy */;
\t\t};
/* End PBXTargetDependency section */
`);

/* Réglages : les droits du groupe d’apps pour App ; ceux du widget (même équipe, mêmes numéros de version que l’app) */
for (const c of confsApp.slice(0, 2)) {
  const bloc = trouve(new RegExp('\\t\\t' + c + ' \\/\\* \\w+ \\*\\/ = \\{\\n\\t\\t\\tisa = XCBuildConfiguration;[\\s\\S]*?buildSettings = \\{\\n'), 'réglages de App')[0];
  p = p.replace(bloc, bloc + '\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n');
}
const conf = (cid, nom, debug) => `\t\t${cid} /* ${nom} */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = RequeteWidget/RequeteWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = ${build};
${equipe ? `\t\t\t\tDEVELOPMENT_TEAM = ${equipe};\n` : ''}\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = RequeteWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${cibleIos};
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = ${version};
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = fr.requete.app.widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
${debug ? '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n' : ''}\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t};
\t\t\tname = ${nom};
\t\t};
`;
avant('/* End XCBuildConfiguration section */', conf(ID.debug, 'Debug', true) + conf(ID.release, 'Release', false));
avant('/* End XCConfigurationList section */', `\t\t${ID.liste} /* Build configuration list for PBXNativeTarget "RequeteWidgetExtension" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${ID.debug} /* Debug */,
\t\t\t\t${ID.release} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
`);

/* Contrôle : accolades et parenthèses équilibrées, chaque identifiant ajouté défini une fois. */
const compte = c => p.split(c).length - 1;
if (compte('{') !== compte('}') || compte('(') !== compte(')')) arret('le projet modifié serait mal formé : rien n’a été changé.');
for (const x of Object.values(ID)) if (!(privDeja && (x === ID.privApp || x === ID.bfPrivApp)) && !new RegExp('\\t\\t' + x + ' /\\* [^*]+ \\*/ = \\{').test(p)) arret(`objet ${x} manquant : rien n’a été changé.`);

const copie = projet + '.avant-widget';
if (!existsSync(copie)) copyFileSync(projet, copie);
writeFileSync(projet, p);
brancher();
console.log('Widget ajouté au projet Xcode : cible RequeteWidgetExtension, groupe d’apps group.fr.requete.app (copie de l’ancien projet : project.pbxproj.avant-widget).');
