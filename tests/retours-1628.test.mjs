/* 4 novembre, 16 h 28 (Elisa) : « mon TestFlight s’est arrêté à 5 ». L’archive échouait (ios-envoi.log : « ** ARCHIVE FAILED ** »)
   sur RequeteWidget.swift:294 : « the compiler is unable to type-check this expression in reasonable time ». C’était la bulle du matin
   du widget : une phrase au choix (entree.repos ? "…" : "…") passée à Text, suivie de onze modificateurs aux mesures calculées
   (w * 0.035…). Xcode essaie toutes les combinaisons de types possibles (la phrase : String, LocalizedStringKey… ; chaque modificateur :
   celui de Text ou celui de View ; chaque nombre : CGFloat, Double…) et abandonne. La règle : la phrase, la police, les couleurs et les
   mesures posées d’abord dans des constantes typées, puis les modificateurs sur ces constantes. Pas de compilateur Swift ici : ces tests
   vérifient la forme du code. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const ios = lire('IOS.md');
const ESPACE = '\\' + 'u{202F}';
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '');
/* Les lignes de modificateurs (« .padding(…) ») d’un bout de code */
const modificateurs = t => sansCommentaires(t).split('\n').map(l => l.trim()).filter(l => l.startsWith('.'));

test('la bulle du matin : la phrase, la police et les mesures typées d’abord, la chaîne coupée en deux', () => {
  const b = entre(swift, 'private func bulle(_ w: CGFloat) -> some View {', '    /// Les étincelles de la fête');
  for (const k of ['let pointe: CGFloat = w * 0.055',
    `let phrase: String = entree.repos ? "Jour de repos${ESPACE}!" : "Une petite requête${ESPACE}?"`,
    'let police: Font = Font.system(size: w * 0.075, weight: .bold, design: .rounded)',
    'let margeH: CGFloat = w * 0.035', 'let margeV: CGFloat = w * 0.03', 'let largeur: CGFloat = w * 0.53',
    'let flou: CGFloat = w * 0.025', 'let chute: CGFloat = w * 0.012', 'let ombre: Color = Color.black.opacity(0.15)',
    'let fond = Bulle(pointe: pointe).fill(Color.white)',
    'let texte: Text = Text(phrase).font(police).foregroundColor(violetTexte)',
    'let cadre = texte\n            .multilineTextAlignment(.center)\n            .lineLimit(3)\n            .minimumScaleFactor(0.7)\n            .padding(.horizontal, margeH)\n            .padding(.vertical, margeV)\n            .frame(width: largeur)',
    'return cadre\n            .padding(.bottom, pointe)\n            .background(fond)\n            .shadow(color: ombre, radius: flou, x: 0, y: chute)'])
    assert.ok(b.includes(k), k);
  const m = modificateurs(b);
  assert.equal(m.length, 9, m.join(' | '));
  for (const l of m) {
    assert.ok(!/[wh] \*/.test(l), `pas de calcul dans « ${l} »`);
    assert.ok(!l.includes(' ? '), `pas de choix dans « ${l} »`);
  }
});

test('la même règle pour la phrase du soir, « 0/1 » et l’écart du compteur', () => {
  const l = entre(swift, 'private func legende(_ w: CGFloat, _ h: CGFloat) -> some View {', '    /// L’écart entre la flamme');
  for (const k of [`let phrase: String = entree.serie > 0 ? "Ta flamme t’attend${ESPACE}!" : "Allume ta flamme${ESPACE}!"`,
    'let police: Font = Font.system(size: w * 0.072, weight: .bold, design: .rounded)', 'let couleur: Color = Color.white.opacity(0.92)',
    'let largeur: CGFloat = w * 0.9', 'let marge: CGFloat = w * 0.05', 'let haut: CGFloat = h * 0.425', 'return Text(phrase)'])
    assert.ok(l.includes(k), k);
  const o = entre(swift, 'private func objectifVue(_ w: CGFloat) -> some View {', '    /// La coche « validé »');
  for (const bout of [l, o]) for (const m of modificateurs(bout)) {
    assert.ok(!/[wh] \*/.test(m), `pas de calcul dans « ${m} »`);
    assert.ok(!m.includes(' ? '), `pas de choix dans « ${m} »`);
  }
  const c = entre(swift, 'private func compteurVue(_ w: CGFloat) -> some View {', '    /// La flamme du jour : éteinte');
  assert.ok(c.includes('let ecart: CGFloat = w * ecartCompteur') && !c.includes(' ? '), 'l’écart est choisi à part');
});

test('dans tout le widget : plus de choix passé à Text, plus de choix dans un choix', () => {
  const code = sansCommentaires(swift);
  assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code), 'Text reçoit une constante typée, pas « a ? "…" : "…" »');
  for (const ligne of code.split('\n')) assert.ok(ligne.split(' ? ').length <= 2, `un seul choix par ligne : ${ligne.trim()}`);
  /* Le reste a passé la vérification d’Xcode le 4 novembre (seule la bulle a échoué) : la forme est gardée */
  for (const k of ['.frame(width: w * 0.84, alignment: humeur == .matin ? .leading : .center)', '.rotationEffect(.degrees(humeur == .fete ? -8 : 0))'])
    assert.ok(swift.includes(k), k);
});

test('le pont : la couleur de la fenêtre et la fin de la leçon, une valeur par ligne', () => {
  const c = entre(pont, 'convenience init?(requeteHex hex: String) {', '\n    }\n');
  assert.ok(c.includes('guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }\n        let rouge: CGFloat'));
  assert.ok(c.includes('self.init(red: rouge, green: vert, blue: bleu, alpha: 1)'));
  /* 5 novembre, 6 h 45 : la carte d’une leçon finie garde ses moments réussis (retours-0645) : le bilan part de l’état d’avant */
  const f = entre(pont, 'static func fin(reussie: Bool, allumee: Bool, reussis: Int?) async {', '\n    }\n');
  for (const k of ['let p: Double = reussie ? 1 : a.content.state.progression',
    'var bilan: RequeteLecon.ContentState = a.content.state\n            bilan.progression = p\n            bilan.allumee = allumee\n            bilan.fini = reussie',
    'let dernier = ActivityContent(state: bilan, staleDate: nil)', 'await a.end(dernier, dismissalPolicy: politique)'])
    assert.ok(f.includes(k), k);
  const e = entre(pont, 'static func etat(progression: Double?, allumee: Bool?, fini: Bool) -> RequeteLecon.ContentState {', '\n    }\n');
  assert.ok(e.includes('let brute: Double = progression ?? 0\n        let p: Double = min(1, max(0, brute))\n        return RequeteLecon.ContentState(progression: p, allumee: allumee ?? false, fini: fini)'));
  /* Même comportement : l’avancement reste entre 0 et 1 */
  const borne = x => Math.min(1, Math.max(0, x ?? 0));
  assert.deepEqual([borne(undefined), borne(-0.2), borne(0.4), borne(3)], [0, 0, 0.4, 1]);
});

test('le guide iOS dit quoi faire si l’archive s’arrête là', () => {
  assert.ok(ios.includes('« the compiler is unable to type-check this expression in reasonable\ntime »'));
  assert.ok(ios.includes('(4 novembre, 16 h 28 : « mon TestFlight s’est arrêté à 5 », rien n’était parti)'));
  assert.ok(ios.includes('poser d’abord la phrase, la police, les couleurs et les mesures dans des constantes typées (`let largeur: CGFloat = w * 0.53`)'));
});
