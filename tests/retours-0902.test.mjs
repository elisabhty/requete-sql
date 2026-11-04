/* 4 novembre, 9 h 02 (Elisa, capture de l’appui long sur l’icône de Duolingo : « 😱 Tu supprimes Duolingo ? Duo te retrouvera. »,
   « ⭐ Fais une petite leçon ! Ça prend juste 3 minutes. ») : « comment avoir ça ». Les raccourcis de l’icône de Requête : posés par
   la page (pont RequeteWidget), reçus par le délégué de scène, passés à la page en événement « raccourci ».
   En chemin : le modèle de Capacitor 8.6 crée lui-même un CAPBridgeViewController dans SceneDelegate.swift, sans passer par
   Main.storyboard ; le pont du widget (RequeteViewController) n’y était donc jamais enregistré. Le délégué de scène de Requête le crée. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

const page = ({ natif = true, plugin = true, onboarded = true, mode = 'learn', session = { id: 12 }, steps = [{ done: true }, { done: false }], faites = 0 } = {}) => {
  const appels = [], ecoute = {}, vu = [];
  const ctx = vm.createContext({
    window: { Capacitor: natif ? { isNativePlatform: () => true, isPluginAvailable: n => plugin && n === 'RequeteWidget',
      nativePromise: (p, m, o) => { appels.push([p, m, o]); return Promise.resolve(); }, addListener: (p, e, f) => { ecoute[p + ':' + e] = f; } } : undefined },
    state: { onboarded }, mode, recommendedSession: () => session, isDefiId: id => typeof id === 'string', homeLessonSteps: () => steps, nbFaites: () => faites,
    openItem: (id, step) => vu.push(['ouvre', id, step]), switchTab: t => vu.push(['onglet', t]), toast: (a, b) => vu.push(['toast', a, b]),
    setTimeout: f => f(),
  });
  vm.runInContext(cut('const RACCOURCIS=[', 'function obNext(){').replace('const RACCOURCIS=', 'var RACCOURCIS=').replace('let raccourcisBranches=', 'var raccourcisBranches='), ctx);
  return { ctx, appels, ecoute, vu };
};

test('les deux raccourcis de Duolingo, version Requête : posés au démarrage de l’app, quatre au plus, avec leur symbole', () => {
  const { ctx, appels, ecoute } = page();
  ctx.raccourcisBrancher(); ctx.raccourcisBrancher();
  assert.equal(appels.length, 1, 'une seule fois');
  const [p, m, o] = appels[0];
  assert.equal(p, 'RequeteWidget'); assert.equal(m, 'raccourcis');
  assert.deepEqual(JSON.parse(JSON.stringify(o.items)), [
    { type: 'fr.requete.app.adieu', titre: '😱 Tu supprimes Requête ?', sousTitre: 'Le chat te retrouvera.', icone: 'eyes' },
    { type: 'fr.requete.app.requete', titre: '⭐ Fais une petite requête !', sousTitre: 'Quelques minutes suffisent.', icone: 'terminal' }]);
  assert.equal(typeof ecoute['RequeteWidget:raccourci'], 'function', 'la page écoute le raccourci choisi');
  for (const v of [{ natif: false }, { plugin: false }]) { const x = page(v); x.ctx.raccourcisBrancher(); assert.equal(x.appels.length, 0, JSON.stringify(v)); }
  assert.ok(app.includes("    setTimeout(()=>{try{raccourcisBrancher();}catch(e){}},1300);   // les raccourcis de l’icône"), 'au démarrage');
});

test('« Fais une petite requête ! » ouvre la séance que propose l’accueil ; « Tu supprimes Requête ? », l’accueil et le chat', () => {
  let x = page(); x.ctx.raccourcisBrancher(); x.ecoute['RequeteWidget:raccourci']({ type: 'fr.requete.app.requete' });
  assert.deepEqual(x.vu, [['ouvre', 12, 0]], 'la leçon, comme le bouton de l’accueil');
  x = page({ faites: 2 }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [['ouvre', 12, 1]], 'exercice commencé : l’exercice');
  x = page({ steps: [{ done: true }, { done: true }] }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [['ouvre', 12, 2]], 'puis le quiz');
  x = page({ session: { id: 'd3' } }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [['ouvre', 'd3', 0]], 'un défi');
  x = page({ session: null }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [['onglet', 'learn']], 'parcours fini : l’accueil');
  x = page({ mode: 'lesson' }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [], 'déjà en séance : on y reste');
  x = page({ onboarded: false }); x.ctx.raccourciOuvrir('fr.requete.app.requete'); assert.deepEqual(x.vu, [], 'premier lancement : l’onboarding d’abord');
  x = page(); x.ctx.raccourciOuvrir('fr.requete.app.adieu');
  assert.deepEqual(x.vu, [['onglet', 'learn'], ['toast', 'Te revoilà !', 'Le chat savait qu’il te retrouverait. Une petite requête ?']]);
});

test('côté iPhone : le délégué de scène crée le contrôleur de Requête et reçoit les raccourcis ; le pont les passe à la page', () => {
  const scene = read('resources/ios/widget/App/SceneDelegate.swift'), pont = read('resources/ios/widget/App/RequeteWidgetPlugin.swift');
  assert.ok(scene.includes('window?.rootViewController = RequeteViewController()') && !scene.includes('= CAPBridgeViewController()'), 'le pont du widget enfin enregistré');
  assert.ok(scene.includes('if let raccourci = connectionOptions.shortcutItem {\n            RequeteRaccourci.recevoir(raccourci.type)\n        }'), 'app lancée par le raccourci');
  assert.ok(scene.includes('func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {\n        RequeteRaccourci.recevoir(shortcutItem.type)\n        completionHandler(true)'), 'app déjà ouverte');
  for (const k of ['SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)', 'SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)', 'SceneDelegateProxy.shared.scene(scene, continue: userActivity)'])
    assert.ok(scene.includes(k), `comme le modèle : ${k}`);
  assert.ok(pont.includes('CAPPluginMethod(name: "raccourcis", returnType: CAPPluginReturnPromise)'));
  assert.ok(pont.includes('notifyListeners("raccourci", data: ["type": type], retainUntilConsumed: true)'), 'gardé jusqu’à ce que la page écoute');
  assert.ok(pont.includes('UIApplication.shared.shortcutItems = items') && pont.includes('UIApplicationShortcutIcon(systemImageName: $0)') && pont.includes('.prefix(4)'));
  assert.ok(pont.includes('raccourciRecu()   // choisi avant que le pont n’existe'), 'reçu avant le pont : passé dès son chargement');
  for (const f of [scene, pont]) { const c = f.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""'); for (const [o, g] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(c.split(o).length, c.split(g).length, o + g); }
});

test('scripts/ios-widget.mjs : le délégué du modèle remplacé (et gardé), un délégué modifié à la main laissé tel quel', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'raccourcis-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), { recursive: true });
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), { recursive: true }); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
    fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), { recursive: true });
    const pbx = path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'), sc = path.join(t, 'ios/App/App/SceneDelegate.swift'), ad = path.join(t, 'ios/App/App/AppDelegate.swift');
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), pbx);
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), path.join(t, 'ios/App/App/Base.lproj/Main.storyboard'));
    const modele = read('tests/fixtures/ios-capacitor/SceneDelegate.swift');
    fs.writeFileSync(sc, modele); fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/AppDelegate.swift'), ad);
    const lancer = () => execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    lancer();
    assert.equal(fs.readFileSync(sc, 'utf8'), read('resources/ios/widget/App/SceneDelegate.swift'), 'le délégué de Requête');
    assert.equal(fs.readFileSync(sc + '.avant-requete', 'utf8'), modele, 'celui du modèle, gardé');
    assert.equal(fs.readFileSync(ad, 'utf8'), read('tests/fixtures/ios-capacitor/AppDelegate.swift'), 'avec un délégué de scène, AppDelegate.swift n’est pas touché');
    lancer(); assert.equal(fs.readFileSync(sc + '.avant-requete', 'utf8'), modele, 'relancé : la copie reste celle du modèle');
    /* Modifié à la main : rien n’est touché, un avertissement le dit, la fabrication continue */
    fs.writeFileSync(sc, modele.replace('CAPBridgeViewController()', 'MonControleur()'));
    let err = '';
    try { execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { err = String(e); }
    assert.equal(err, '', 'code 0');
    assert.ok(fs.readFileSync(sc, 'utf8').includes('MonControleur()'), 'délégué modifié : laissé tel quel');
    /* Sans délégué de scène (modèles plus anciens) : l’app reçoit les raccourcis, une seule fois */
    fs.rmSync(sc); fs.rmSync(sc + '.avant-requete');
    const vieux = 'import UIKit\nimport Capacitor\n\n@UIApplicationMain\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n\n    var window: UIWindow?\n}\n';
    fs.writeFileSync(ad, vieux); lancer(); lancer();
    const a = fs.readFileSync(ad, 'utf8');
    assert.equal(a.split('performActionFor shortcutItem').length - 1, 1, 'ajouté une fois');
    assert.ok(a.endsWith('        RequeteRaccourci.recevoir(shortcutItem.type)\n        completionHandler(true)\n    }\n}\n'), 'dans la classe');
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
});
