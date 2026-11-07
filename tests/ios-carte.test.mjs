/* Elisa, 7 novembre (« La carte mémo qui se retourne », d’après la planche : « Touche la carte, elle se retourne. Tu dis si tu
   savais : elle revient au bon moment. » ; « Je savais » l’éloigne, « À revoir » la ramène demain ; pour la flamme, son choix :
   « la séance seule »). Dans l’app iPhone, un petit widget (iOS 17, ses boutons) : la page range les cartes gagnées
   (widgetCartes), le pont les garde, le widget tient leur rythme de révision (CartesRangement) et répond par App Intents. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const ios = lire('IOS.md');
const FINE = '\\' + 'u{202F}', INS = '\\' + 'u{00A0}';
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ici = x => JSON.parse(JSON.stringify(x));

test('la page range les cartes gagnées, dans l’ordre du parcours, en texte simple', () => {
  const src = entre(app, 'function widgetCartes(){', 'if(typeof document!==');
  const ctx = vm.createContext({
    allLessons: [{ id: 0 }, { id: 4 }, { id: 2 }, { id: 5 }],
    CARTES: { 0: { k: 'Base relationnelle', t: 'Tables, clés et SELECT', points: ['Une table range un seul sujet : une colonne par caractéristique.'] },
      4: { k: 'WHERE', t: 'Filtrer les lignes', points: ['Il se place après <code>FROM</code>, suivi d’une <b>condition</b>.'] },
      5: { k: '= != > < >= <=', t: 'Comparer des valeurs', points: ['<code>&lt;</code> et <code>&gt;</code> excluent la limite.'] } },
    isUnlocked: id => id !== 5,
  });
  vm.runInContext(src, ctx);
  assert.deepEqual(ici(ctx.widgetCartes()), [
    { id: 0, k: 'Base relationnelle', t: 'Tables, clés et SELECT', p: 'Une table range un seul sujet : une colonne par caractéristique.' },
    { id: 4, k: 'WHERE', t: 'Filtrer les lignes', p: 'Il se place après FROM, suivi d’une condition.' }], 'les cartes débloquées seulement, sans balises, l’espace insécable gardée');
  ctx.isUnlocked = () => true;
  assert.equal(ici(ctx.widgetCartes())[2].p, '< et > excluent la limite.', 'les entités redeviennent des signes');
  /* Sans les données de l’app (le bac à sable de la série, retours-0354) : aucune carte, la série part quand même */
  assert.deepEqual(ici(vm.runInNewContext(src + ';widgetCartes()', {})), []);
  assert.ok(app.includes(',cartes:JSON.stringify(widgetCartes()),semaine:JSON.stringify(widgetSemaine())},k=JSON.stringify(data);'), 'avec la série (widgetMaj)');
  /* Les vraies cartes : un mot-clé, un titre, une idée, chacun court pour un petit widget */
  const C = vm.runInNewContext('(' + entre(app, 'const CARTES={', '\n};\n').slice('const CARTES='.length) + '\n})');
  for (const [id, c] of Object.entries(C)) {
    assert.ok(c.k && c.t && Array.isArray(c.points) && c.points[0], id);
    assert.ok(c.k.length <= 26 && c.t.length <= 42, `${id} : ${c.k} — ${c.t}`);
  }
});

test('« requete://cartes » ouvre l’album des cartes mémo ; pendant l’onboarding, un bandeau ; en séance, on y reste', () => {
  const page = ({ onboarded = true, enSeance = false } = {}) => {
    const vu = [];
    const ctx = vm.createContext({
      window: {}, document: { querySelector: sel => (sel === '#scr-lesson.active,#lesson-video' && enSeance ? {} : null) },
      state: { onboarded }, switchTab: t => vu.push(['onglet', t]), mascotRetrouveJusqua: 0, mascotDitRetrouve: () => {},
      setTimeout: (f, ms) => { vu.push(['attend', ms]); f(); }, toast: (t, s) => vu.push(['toast', t, s]),
    });
    vm.runInContext(entre(app, 'const RACCOURCIS=[', 'function obNext(){').replace('const RACCOURCIS=', 'var RACCOURCIS=').replace('let raccourcisBranches=', 'var raccourcisBranches='), ctx);
    ctx.obBandeau = t => vu.push(['bandeau', t]);
    ctx.raccourciOuvrir('fr.requete.app.cartes');
    return vu;
  };
  assert.deepEqual(page(), [['onglet', 'collection']]);
  assert.deepEqual(page({ onboarded: false }), [['bandeau', 'Termine ton parcours de bienvenue : tes cartes mémo t’attendent juste après !']]);
  assert.deepEqual(page({ enSeance: true }), [['toast', 'Tu es déjà en séance', 'Tes cartes mémo t’attendent juste après.']]);
  /* Le lien est construit par morceaux (pas de « // » dans le code) et passe par le même chemin que requete://seance */
  assert.ok(swift.includes('var c = URLComponents()\n    c.scheme = "requete"\n    c.host = "cartes"'));
  assert.ok(pont.includes('recevoir("fr.requete.app." + hote)'));
});

test('le rythme : « Je savais » l’éloigne (3, 7, 21, 60 jours, comme les révisions de l’app), « À revoir » la ramène demain', () => {
  const r = entre(swift, 'enum CartesRangement {', '\n}\n');
  const intervallesApp = JSON.parse(entre(app, 'const INTERVALS=', ';').slice('const INTERVALS='.length));
  assert.deepEqual(JSON.parse(entre(r, 'static let intervalles: [Int] = ', '\n').slice('static let intervalles: [Int] = '.length)), intervallesApp, 'les mêmes intervalles que l’app');
  for (const k of ['let niveau: Int = savais ? min(avant + 1, intervalles.count - 1) : 0', 'let jours: Int = savais ? intervalles[niveau] : 1',
    'r[String(id)] = RythmeCarte(niveau: niveau, jour: jourDans(jours, apres: maintenant))'])
    assert.ok(r.includes(k), k);
  /* La même règle, rejouée : une carte nouvelle, « Je savais » trois fois, puis « À revoir » */
  const noter = (niveau, savais) => { const n = savais ? Math.min(niveau + 1, intervallesApp.length - 1) : 0; return [n, savais ? intervallesApp[n] : 1]; };
  let n = 0; const vu = [];
  for (const s of [true, true, true, false]) { const [m, j] = noter(n, s); n = m; vu.push(j); }
  assert.deepEqual(vu, [3, 7, 21, 1], 'elle revient dans 3 jours, puis 7, puis 21 ; « À revoir » : demain');
  /* « Elle revient demain / dans 3 jours / dans 3 semaines / dans 2 mois », avec l’espace insécable */
  const d = entre(r, 'static func dans(_ jours: Int) -> String {', '\n    }');
  for (const k of ['if jours <= 1 { return "demain" }', `if jours < 14 { return "dans \\(jours)${INS}jours" }`,
    `if jours < 56 { return "dans \\(jours / 7)${INS}semaines" }`, `return "dans \\(jours / 30)${INS}mois"`])
    assert.ok(d.includes(k), k);
  /* La carte du moment : celles du jour d’abord (la plus en retard en premier), puis les nouvelles, dans l’ordre du parcours */
  const c = entre(r, 'static func courante(', '\n    }\n');
  assert.ok(c.includes('return x.jour <= aujourdhui') && c.includes('return liste.first { c in r[String(c.id)] == nil }'));
  /* Le widget n’écrit que ses clés : la flamme du jour n’est pas touchée (son choix : « la séance seule ») */
  const ecrit = [...r.matchAll(/forKey: "(\w+)"\)/g)].map(m => m[1]);
  for (const k of ecrit) assert.ok(['cartes', 'cartesRythme', 'carteRetournee', 'carteNotee'].includes(k), k);
});

test('le widget : petit, iOS 17, recto, verso, noté ; une entrée chaque minuit, quand une carte revient', () => {
  const w = entre(swift, 'struct RequeteCarte: Widget {', '\n}\n');
  for (const k of ['let kind = "RequeteCarte"', 'StaticConfiguration(kind: kind, provider: CarteFournisseur()) { entree in',
    '.containerBackground(for: .widget) { FondCarte(face: entree.face) }', '.configurationDisplayName("La carte mémo")', '.supportedFamilies([.systemSmall])', '.contentMarginsDisabled()'])
    assert.ok(w.includes(k), k);
  for (const k of ['@available(iOS 17.0, *)\nstruct RequeteCarte: Widget {', '@available(iOS 17.0, *)\nstruct CarteVue: View {',
    '        if #available(iOS 17.0, *) {\n            RequeteCarte()\n        }'])
    assert.ok(swift.includes(k), k);
  for (const n of ['RetournerCarte', 'NoterCarte', 'CarteSuivante']) {
    const i = entre(swift, `struct ${n}: AppIntent {`, '\n}\n');
    assert.ok(i.includes('static let isDiscoverable: Bool = false') && i.includes('return .result()'), n);
    assert.ok(swift.includes(`@available(iOS 17.0, *)\nstruct ${n}: AppIntent {`), n);
  }
  const v = entre(swift, 'struct CarteVue: View {', '\n}\n\n@available(iOS 17.0, *)\nstruct RequeteCarte');
  for (const k of ['Button(intent: RetournerCarte(carte: c.id)) {', 'Button(intent: NoterCarte(carte: c.id, savais: savais)) {', 'Button(intent: CarteSuivante()) {',
    'noter("Je savais", true, c, u)', 'noter("À revoir", false, c, u)', `Text("Tu t’en souviens${FINE}?")`, `Text("Noté${FINE}!")`,
    'let quand: String = "Elle revient " + CartesRangement.dans(entree.jours) + "."', `"Cartes à jour${FINE}!"`, 'lienCartes', 'lienSeance'])
    assert.ok(v.includes(k), k);
  const t = entre(swift, 'struct CarteFournisseur: TimelineProvider {', '\n}\n');
  assert.ok(t.includes('for j in 1...7 {') && t.includes('policy: .atEnd'), 'chaque minuit sur sept jours');
  assert.ok(fs.existsSync(path.join(ROOT, 'resources/ios/widget/RequeteWidget/Assets.xcassets/ChatCarte.imageset/Contents.json')), 'le chat qui retourne une carte');
  /* Ce que lit le widget est ce que range la page */
  const cw = entre(swift, 'struct CarteWidget: Codable, Hashable {', '\n}\n');
  for (const k of ['let id: Int', 'let k: String', 'let t: String', 'let p: String']) assert.ok(cw.includes(k), k);
  const maj = entre(pont, '@objc func maj(_ call: CAPPluginCall) {', '\n    }\n');
  assert.ok(maj.includes('d.set(call.getString("cartes") ?? "[]", forKey: "cartes")') && !maj.includes('forKey: "cartesRythme"'), 'le pont range les cartes sans toucher à leur rythme');
});

test('IOS.md : la carte mémo, pour la prochaine fois', () => {
  const s = entre(ios, '### La carte mémo qui se retourne (7 novembre)', '\n### ');
  for (const k of ['RequeteCarte', 'iOS 17', 'Je savais', 'À revoir', 'cartesRythme', 'flamme']) assert.ok(s.includes(k), k);
});
