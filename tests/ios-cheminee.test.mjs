/* Elisa, 7 novembre (16 h 03 : « des supers widgets et live activity et dynamique island créatifs, à un niveau plus qu’élevé » ; de
   17 h 01 à 17 h 38, les images qu’elle a générées pour la planche : la pièce, les trois feux, le trophée, la plante, le diplôme ; son
   choix : « Cheminée + lunettes »). Dans l’app iPhone :
   - le widget La cheminée (RequeteWidget.swift, RequeteCheminee) : grand, et très grand en portrait avec iOS 27. Le feu raconte la
     séance du jour, le ciel suit l’heure, la pièce se décore de ce qu’on a gagné ; le soir, « Allumer ma flamme » ouvre la séance du
     jour (requete://seance : SceneDelegate.swift, RequeteRaccourci.ouvrir, puis la page, raccourciOuvrir) ;
   - les lunettes du chat dans la Dynamic Island, pendant la leçon : ses yeux suivent la leçon ; appui long, le chat sort du noir.
   Pas de compilateur Swift ici : les tests lisent le code, et la page passe dans un bac à sable. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const scene = lire('resources/ios/widget/App/SceneDelegate.swift');
const script = lire('scripts/ios-widget.mjs');
const app = lire('index.html');
const ios = lire('IOS.md');
const CATALOGUE = path.join(ROOT, 'resources/ios/widget/RequeteWidget/Assets.xcassets');
const FINE = '\\' + 'u{202F}';   // l’espace fine insécable de Swift, avant « ? » et « ! »
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const cut = (a, b) => entre(app, a, b);

/* Largeur et hauteur d’une image PNG ou JPEG, lues dans son en-tête */
const dimensions = f => {
  const b = fs.readFileSync(f);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], n = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + n;
  }
  throw new Error('format inconnu : ' + f);
};

test('le widget La cheminée : grand, très grand avec iOS 27 (et Xcode 27), dans le paquet, la pièce en fond', () => {
  const w = entre(swift, 'struct RequeteCheminee: Widget {', '\n}\n');
  for (const k of ['let kind = "RequeteCheminee"', 'StaticConfiguration(kind: kind, provider: ChemineeFournisseur()) { entree in',
    'ChemineeVue(entree: entree)\n                .fondCheminee(PieceVue(entree: entree))', '.configurationDisplayName("La cheminée")',
    '.supportedFamilies(famillesCheminee)', '.sansMarges()'])
    assert.ok(w.includes(k), k);
  /* Le très grand n’existe qu’à partir d’iOS 27 : derrière le compilateur de Xcode 27 (Swift 6.4), puis derrière iOS 27 */
  const f = entre(swift, 'private var famillesCheminee: [WidgetFamily] {', '\n}\n');
  assert.ok(f.includes('#if compiler(>=6.4)\n    if #available(iOSApplicationExtension 27.0, *) {\n        return [.systemLarge, .systemExtraLargePortrait]\n    }\n    #endif\n    return [.systemLarge]'));
  assert.equal(swift.split('.systemExtraLargePortrait').length - 1, 1, 'nulle part ailleurs (sans garde, Xcode 26 ne compilerait pas)');
  assert.ok(swift.includes('        RequeteWidget()\n        RequeteCheminee()\n'), 'dans le paquet, avec la flamme');
  /* La pièce passe par containerBackground (iOS l’enlève quand il teinte l’écran d’accueil) */
  const fond = entre(swift, 'func fondCheminee<Fond: View>(_ fond: Fond) -> some View {', '\n    }\n}');
  assert.ok(fond.includes('if #available(iOSApplicationExtension 17.0, *) {\n            self.containerBackground(for: .widget) { fond }\n        } else {\n            self.background(fond)'));
  assert.ok(swift.includes('static func pour(_ taille: CGSize) -> Agencement {\n        taille.height > taille.width * 1.25 ? portrait : grand'), 'le très grand, en portrait');
});

test('le fournisseur : la séance du jour avec les règles de la flamme, ce que l’app range, une entrée à 0 h, 5 h, 12 h, 18 h et 21 h', () => {
  const p = entre(swift, 'struct ChemineeFournisseur: TimelineProvider {', '\nprivate let lavande');
  for (const k of ['for heure in [0, 5, 12, 18, 21] {', 'completion(Timeline(entries: dates.map { entree(pour: $0) }, policy: .atEnd))',
    'let flamme: SerieEntree = SerieFournisseur().flammeDu(date)', 'if context.isPreview && e.flamme.serie == 0 && !e.fait {'])
    assert.ok(p.includes(k), k);
  assert.ok(swift.includes('extension SerieFournisseur {\n    /// Le jour de la flamme pour la cheminée : les mêmes règles que le widget de la flamme (entree(pour:)).\n    func flammeDu(_ date: Date) -> SerieEntree {\n        entree(pour: date)\n    }\n}'));
  /* Chaque valeur rangée par le pont est relue par le widget, sous la même clé */
  const cles = ['stickers', 'trophees', 'diplomes', 'prochaine', 'cle', 'defi', 'carte'];
  const maj = entre(pont, '@objc func maj(_ call: CAPPluginCall) {', '\n    }\n');
  for (const k of cles) {
    assert.ok(p.includes(`forKey: "${k}"`), 'widget : ' + k);
    assert.ok(maj.includes(`forKey: "${k}")`), 'pont : ' + k);
  }
  for (const k of ['d.set(max(0, call.getInt("stickers") ?? 0), forKey: "stickers")', 'd.set(call.getBool("defi") ?? false, forKey: "defi")', 'd.set(call.getString("carte") ?? "", forKey: "carte")'])
    assert.ok(maj.includes(k), k);
  assert.ok(maj.indexOf('forKey: "carte"') < maj.indexOf('WidgetCenter.shared.reloadAllTimelines()'), 'rangé avant de recharger les widgets');
});

test('la journée de la pièce : le ciel suit l’heure, le feu la séance, le chat les deux ; les phrases, avec leurs espaces fines', () => {
  const l = entre(swift, 'enum Lumiere {', '\n}\n');
  for (const k of ['case 5..<12: self = .aurore', 'case 12..<18: self = .jour', 'case 18..<21: self = .crepuscule', 'default: self = .nocturne',
    'case .aurore: return "Matin"', 'case .jour: return "Jour"', 'case .crepuscule: return "Soir"', 'case .nocturne: return "Nuit"'])
    assert.ok(l.includes(k), k);
  const e = entre(swift, 'struct ChemineeEntree: TimelineEntry {', '\nextension SerieFournisseur {');
  for (const k of ['if fait { return .vif }\n        if repos { return .froid }\n        return heure >= 18 ? .braises : .froid',
    'var attendLeSoir: Bool { !fait && !repos && heure >= 18 }',
    `if fait { return "Flamme allumée${FINE}!" }`, `if repos { return "Jour de repos${FINE}!" }`, 'if heure < 5 { return "Chut, le chat dort…" }',
    `if heure < 18 { return "Une petite requête${FINE}?" }`, `return flamme.serie > 0 ? "Ta flamme t’attend${FINE}!" : "Allume ta flamme${FINE}!"`,
    'if fait { return lumiere == .nocturne ? "Bonne nuit." : "Bien joué, à demain." }', 'if heure < 12 { return "La cheminée est froide." }',
    'return "Quelques minutes suffisent."',
    'if fait { return dort ? "ChatDodo" : "ChatBravo" }', 'if repos { return dort ? "ChatDodo" : "ChatSalut" }',
    'if heure < 5 { return "ChatDodo" }', 'if heure < 12 { return "ChatReveil" }', 'if heure < 18 { return "ChatOrdi" }', 'return "ChatAllumette"'])
    assert.ok(e.includes(k), k);
  /* Le soir, le temps qui reste avant minuit défile tout seul, en français */
  const v = entre(swift, 'struct ChemineeVue: View {', '\nextension View {');
  assert.ok(v.includes('return Text("Encore ") + Text(minuit, style: .relative) + Text(" avant minuit.")'));
  assert.ok(v.includes('let fr = Locale(identifier: "fr_FR")') && v.includes('.environment(\\.locale, fr)'));
  /* « 0/1 », puis la coche et « 1/1 » sur l’or ; un jour de repos, pas de puce ; le bouton, le soir seulement */
  for (const k of ['let compte: String = fait ? "1/1" : "0/1"', 'if !entree.repos {\n                puce(u)', 'if entree.attendLeSoir {\n                bouton(u)',
    'return Link(destination: lienSeance) {', 'Text("Allumer ma flamme")', '.chiffreQuiRoule(valeur)'])
    assert.ok(v.includes(k), k);
});

test('la pièce : les objets gagnés, le liège et l’écran du très grand, aux places de la planche', () => {
  const pv = entre(swift, 'struct PieceVue: View {', '\nstruct ChemineeVue: View {');
  for (const k of ['if entree.stickers >= 1 {\n                Image("Autocollant")', 'if entree.stickers >= 2 {\n                EtoileAutocollant()',
    'if entree.stickers >= 3 {\n                etiquetteSQL(k)', 'if entree.trophees > 0 {\n                objet("Trophee", ag.trophee, p, k)',
    'objet("Plante", ag.plante, p, k)', 'if entree.diplomes > 0 {\n                objet("Diplome", ag.diplome, p, k)',
    'if ag.tresGrand {\n                liege(ag, p)\n                ecran(ag, p)', 'if !entree.carte.isEmpty {\n                carteMemo(k)',
    '.clipShape(Arche())', 'let nom: String = ag.piece + entree.lumiere.nom'])
    assert.ok(pv.includes(k), k);
  /* Les places, relevées sur la planche (en pixels de l’image d’origine) : le feu dans l’arche de la cheminée */
  const ag = entre(swift, 'struct Agencement {', '\n}\n');
  const rect = (bloc, nom) => { const m = new RegExp(nom + ': CGRect\\(x: ([\\d.]+), y: ([\\d.]+), width: ([\\d.]+), height: ([\\d.]+)\\)').exec(bloc); assert.ok(m, nom); return m.slice(1).map(Number); };
  for (const [debut, fin, image] of [['static let grand', 'static let portrait', [1254, 1254]], ['static let portrait', 'static func pour', [1024, 1536]]]) {
    const b = entre(ag, debut, fin);
    const [fx, fy, fw] = rect(b, 'foyer'), [ex, ey, ew, eh] = rect(b, 'feu');
    assert.ok(ex < fx && ex + ew > fx + fw && ey > fy, debut + ' : le feu remplit l’arche, sous sa voûte');
    for (const n of ['foyer', 'feu', 'autocollant', 'etoile', 'sql', 'trophee', 'plante', 'diplome']) {
      const [x, y, l, h] = rect(b, n);
      assert.ok(x >= 0 && y >= 0 && x + l <= image[0] && y + h <= image[1], `${debut} : ${n} dans l’image`);
    }
    assert.ok(b.includes(`image: CGSize(width: ${image[0]}, height: ${image[1]})`));
  }
  /* Le lien du bouton, sans « // » dans le code (les tests lisent le Swift sans ses commentaires) */
  assert.ok(swift.includes('var c = URLComponents()\n    c.scheme = "requete"\n    c.host = "seance"\n    return c.url ?? URL(fileURLWithPath: "/")'));
  assert.ok(!swift.replace(/\/\/.*$/gm, '').includes('requete:'), 'pas de requete:// écrit en clair');
  /* Le post-it du chat : une phrase par jour, courte, avec ses espaces fines */
  const notes = [...entre(swift, 'private let notesDuChat: [String] = [', ']').matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.equal(notes.length, 7);
  for (const n of notes) { assert.ok(n.replace(/\\u\{[0-9A-F]+\}/g, ' ').length <= 24, 'tient sur le post-it : ' + n); assert.ok(!/ [?!:;]/.test(n), 'espace fine : ' + n); }
});

test('les images du widget : chacune a son catalogue et ses fichiers, et reste sous la surface que WidgetKit accepte', () => {
  const noms = new Set([...swift.matchAll(/(?:Image|objet)\("([A-Za-z]+)"/g)].map(m => m[1]));
  for (const m of swift.matchAll(/"((?:Chat|Feu)[A-Z][A-Za-z]+)"/g)) noms.add(m[1]);
  for (const l of ['Matin', 'Jour', 'Soir', 'Nuit']) for (const f of ['PieceGrand', 'PieceTresGrand']) noms.add(f + l);
  for (const n of ['Trophee', 'Plante', 'Diplome', 'Autocollant', 'ChatNoir', 'FeuFroid', 'FeuBraises', 'FeuVif', 'ChatReveil', 'ChatOrdi', 'ChatAllumette', 'ChatDodo', 'ChatBravo', 'ChatSalut'])
    assert.ok(noms.has(n), n);
  for (const n of noms) {
    const dossier = path.join(CATALOGUE, n + '.imageset');
    assert.ok(fs.existsSync(path.join(dossier, 'Contents.json')), n);
    const images = JSON.parse(fs.readFileSync(path.join(dossier, 'Contents.json'), 'utf8')).images.filter(i => i.filename);
    assert.ok(images.length >= 1, n);
    for (const i of images) {
      const [l, h] = dimensions(path.join(dossier, i.filename));
      /* « Widget archival failed due to image being too large » : la pièce reste sous la surface d’un grand widget de l’iPhone le
         plus petit de son échelle (2x : l’iPhone SE ; 3x : le mini), le reste bien en dessous */
      const max = n.startsWith('Piece') ? (i.scale === '2x' ? 500000 : 1060000) : (n === 'Mascotte' ? 170000 : 200000);
      assert.ok(l * h <= max, `${n} ${i.filename} : ${l} × ${h}`);
      if (n.startsWith('Piece')) assert.ok(i.scale === '2x' || i.scale === '3x', n + ' : en 2x et en 3x');
    }
  }
  /* La pièce garde les proportions de l’image d’origine (les places sont relevées dessus) */
  for (const [n, r] of [['PieceGrandNuit', 1], ['PieceTresGrandMatin', 1.5]]) {
    const i = JSON.parse(fs.readFileSync(path.join(CATALOGUE, n + '.imageset', 'Contents.json'), 'utf8')).images;
    for (const x of i) { const [l, h] = dimensions(path.join(CATALOGUE, n + '.imageset', x.filename)); assert.ok(Math.abs(h / l - r) < 0.01, n); }
  }
});

test('les lunettes du chat dans la Dynamic Island : il regarde, sourit, s’endort, a des étoiles plein les yeux', () => {
  /* 7 novembre, 20 h 16 : le clin d’œil, quand un ami entre dans la salle (la salle dans l’île, ios-salle-ile) */
  assert.deepEqual([...entre(swift, 'enum Regard {', '}').matchAll(/case (\w+)/g)].map(m => m[1]), ['ouvert', 'rieur', 'endormi', 'etoiles', 'clin']);
  const r = entre(swift, 'func leconRegard(_ e: RequeteLecon.ContentState, perime: Bool) -> Regard {', '\n}\n');
  for (const k of ['if e.fini { return .etoiles }\n    if perime { return .endormi }', 'if n > 0 && r >= but { return .rieur }\n    return .ouvert'])
    assert.ok(r.includes(k), k);
  assert.ok(r.indexOf('.etoiles') < r.indexOf('.endormi'), 'réussie passe avant la pause');
  /* Périmée (une heure sans nouvelles, staleDate du pont) : iOS 16.2 et plus */
  assert.ok(swift.includes('func leconPerimee(_ context: ActivityViewContext<RequeteLecon>) -> Bool {\n    if #available(iOSApplicationExtension 16.2, *) {\n        return context.isStale\n    }\n    return false\n}'));
  assert.ok(pont.includes('staleDate: Date().addingTimeInterval(3600)'), 'la Live Activity devient périmée au bout d’une heure');
  /* Les yeux du moment, sur les montures */
  const y = entre(swift, 'private func yeux(_ e: CGFloat, _ paupiere: StrokeStyle) -> some View {', '\n    }\n}');
  for (const c of ['ouvert', 'rieur', 'endormi', 'etoiles', 'clin']) assert.ok(y.includes(`case .${c}:`), c);
  for (const k of ['case .yeuxFermes:', 'case .grandZ:', 'case .petitZ:', 'case .montures:', 'case .pont:']) assert.ok(swift.includes(k), k);
  /* Dans l’île : les lunettes à gauche et en tout petit ; appui long, le chat qui sort du noir ; à droite, les moments, comme avant */
  const act = entre(swift, 'struct RequeteLeconActivite: Widget {', '/// Le widget de la flamme, et la Live Activity');
  for (const k of ['DynamicIslandExpandedRegion(.leading) {\n                    Image("ChatNoir")',
    '} compactLeading: {\n                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 30)',
    '} minimal: {\n                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 24)',
    '} compactTrailing: {\n                LeconMoments(etat: context.state)', '.keylineTint(braise)'])
    assert.ok(act.includes(k), k);
  assert.ok(!act.includes('LeconFlamme(etat: context.state, taille: 15)'), 'la flamme de gauche laisse sa place aux lunettes');
});

test('le lien requete://seance : le délégué de scène le reçoit (app ouverte ou lancée par lui), le pont en fait un raccourci', () => {
  assert.ok(scene.includes('if let lien = connectionOptions.urlContexts.first?.url {\n            RequeteRaccourci.ouvrir(lien)\n        }'), 'app lancée par le lien');
  assert.ok(scene.includes('for contexte in URLContexts {\n            RequeteRaccourci.ouvrir(contexte.url)\n        }\n        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)'), 'app ouverte ; Capacitor reçoit toujours ses liens');
  const o = entre(pont, 'static func ouvrir(_ lien: URL) {', '\n    }\n');
  assert.ok(o.includes('guard lien.scheme == "requete", let hote = lien.host, !hote.isEmpty else { return }\n        recevoir("fr.requete.app." + hote)'));
  for (const f of [scene, pont]) { const c = f.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""'); for (const [a, b] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(c.split(a).length, c.split(b).length, a + b); }
  assert.ok(script.includes("<string>requete</string>") && script.includes('CFBundleURLTypes'));
});

test('scripts/ios-widget.mjs : le schéma « requete » déclaré une fois ; des schémas déjà là ne sont pas touchés', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'cheminee-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), { recursive: true });
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), { recursive: true }); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
    fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'));
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), path.join(t, 'ios/App/App/Base.lproj/Main.storyboard'));
    const info = path.join(t, 'ios/App/App/Info.plist');
    const lancer = () => execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fs.writeFileSync(info, '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>\n</dict>\n</plist>\n');
    lancer(); lancer();
    const p = fs.readFileSync(info, 'utf8');
    assert.equal(p.split('<key>CFBundleURLTypes</key>').length - 1, 1, 'une seule fois');
    assert.ok(p.includes('\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>requete</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n'), 'dans le dictionnaire principal');
    /* Des schémas d’URL déjà là (ajoutés dans Xcode) : laissés tels quels */
    const autre = '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>autre</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n';
    fs.writeFileSync(info, autre);
    lancer();
    assert.ok(!fs.readFileSync(info, 'utf8').includes('<string>requete</string>'), 'pas de second CFBundleURLTypes');
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
});

test('la page range la pièce : stickers gagnés, défis réussis, modules finis, prochaine activité, dernière carte mémo', () => {
  const src = cut('function widgetCheminee(){', 'if(typeof document!==');
  const essai = ({ prochaine = 20, stickers = { a: 1, b: 2, c: 0, d: 5 } } = {}) => {
    const lecons = [{ id: 0, titre: 'Les bases de données relationnelles' }, { id: 4, titre: 'WHERE' }, { id: 20, titre: 'LEFT JOIN' }, { id: 22, titre: 'NOT' }];
    const ctx = vm.createContext({
      state: { defis: { af1: true, af2: true, af3: false }, lessons: { 0: { done: true, at: 100 }, 4: { done: true, at: 300 }, 22: { done: true, at: 900 } } },
      MODULES: [{ lessons: [lecons[0], lecons[1]] }, { lessons: [lecons[2], lecons[3]] }, { lessons: [] }],
      allLessons: lecons, CARTES: { 0: { k: 'Base relationnelle' }, 4: { k: 'WHERE' }, 20: { k: 'LEFT JOIN' } },
      CHALLENGES: [{ id: 'af4', titre: 'Quels vols sont retardés ?' }],
      itemDone: id => typeof id === 'string' ? false : [0, 4, 22].includes(id), isDefiId: id => typeof id === 'string',
      recommendedSession: () => prochaine == null ? null : { id: prochaine },
      stkList: () => Object.entries(stickers).map(([id, got]) => ({ id, got })),
    });
    vm.runInContext(src, ctx);
    return JSON.parse(JSON.stringify(ctx.widgetCheminee()));
  };
  /* Trois stickers gagnés sur quatre ; deux défis réussis ; le premier module fini (le second attend LEFT JOIN, le dernier est vide) ;
     la leçon 22 a été validée en dernier, mais sans carte mémo : la dernière carte gagnée est celle de WHERE */
  assert.deepEqual(essai(), { stickers: 3, trophees: 2, diplomes: 1, prochaine: 'LEFT JOIN', cle: 'LEFT JOIN', defi: false, carte: 'WHERE' });
  assert.deepEqual(essai({ prochaine: 'af4' }), { stickers: 3, trophees: 2, diplomes: 1, prochaine: 'Quels vols sont retardés ?', cle: '', defi: true, carte: 'WHERE' }, 'un défi : son titre, sans mot-clé');
  assert.equal(essai({ prochaine: null }).prochaine, '', 'parcours fini : rien sur l’écran');
  /* Ce qui manque laisse sa valeur à zéro, ou vide (la page plus ancienne, un état incomplet) : la mise à jour de la série part quand même */
  const vide = vm.createContext({});
  vm.runInContext(src, vide);
  assert.deepEqual(JSON.parse(JSON.stringify(vide.widgetCheminee())), { stickers: 0, trophees: 0, diplomes: 0, prochaine: '', cle: '', defi: false, carte: '' });
  assert.ok(app.includes('const data={serie,jour,fait,limite:dstr(d),...widgetCheminee(),poche:JSON.stringify(widgetPoche()),cartes:JSON.stringify(widgetCartes()),semaine:JSON.stringify(widgetSemaine())},k=JSON.stringify(data);'), 'avec la série, en une fois (et la requête de poche)');
});

test('« Allumer ma flamme » ouvre la séance du jour ; pendant l’onboarding, un bandeau le dit ; en séance, on y reste', () => {
  const page = ({ onboarded = true, enSeance = false, prochaine = 20 } = {}) => {
    const vu = [];
    const ctx = vm.createContext({
      window: {}, document: { querySelector: sel => (sel === '#scr-lesson.active,#lesson-video' && enSeance ? {} : null) },
      state: { onboarded }, switchTab: t => vu.push(['onglet', t]), mascotRetrouveJusqua: 0, mascotDitRetrouve: () => {},
      setTimeout: (f, ms) => { vu.push(['attend', ms]); f(); }, recommendedSession: () => prochaine == null ? null : { id: prochaine },
      openItem: (id, etape) => vu.push(['ouvre', id, etape]), toast: (t, s) => vu.push(['toast', t, s]),
    });
    vm.runInContext(cut('const RACCOURCIS=[', 'function obNext(){').replace('const RACCOURCIS=', 'var RACCOURCIS=').replace('let raccourcisBranches=', 'var raccourcisBranches='), ctx);
    ctx.obBandeau = t => vu.push(['bandeau', t]);
    ctx.raccourciOuvrir('fr.requete.app.seance');
    return vu;
  };
  assert.deepEqual(page(), [['onglet', 'learn'], ['attend', 350], ['ouvre', 20, 0]], 'l’accueil, puis la séance recommandée, comme sa carte');
  assert.deepEqual(page({ prochaine: 'af4' }), [['onglet', 'learn'], ['attend', 350], ['ouvre', 'af4', 0]], 'un défi aussi');
  assert.deepEqual(page({ prochaine: null }), [['onglet', 'learn']], 'tout est fait : l’accueil');
  assert.deepEqual(page({ onboarded: false }), [['bandeau', 'Termine ton parcours de bienvenue : ta flamme t’attend juste après !']]);
  assert.deepEqual(page({ enSeance: true }), [['toast', 'Tu es déjà en séance', 'Termine-la : ta flamme s’allume à la fin.']]);
});

test('IOS.md : la cheminée et les lunettes, pour la prochaine fois', () => {
  const c = entre(ios, '### La cheminée (7 novembre)', '\n### ');
  for (const k of ['RequeteCheminee', 'systemExtraLargePortrait', 'Xcode 27', 'requete://seance', 'CFBundleURLTypes', 'containerBackground', 'too large'])
    assert.ok(c.includes(k), k);
  const l = entre(ios, '### Les lunettes du chat dans la Dynamic Island (7 novembre)', '\n### ');
  for (const k of ['LunettesChat', 'isStale', 'ChatNoir']) assert.ok(l.includes(k), k);
});
