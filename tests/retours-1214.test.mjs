/* 4 novembre, 12 h 14 (Elisa, après « on peut pas animer le widget en mode vidéo ? ») : « Un chat qui change dans la journée : une bulle
   le matin, la flamme le soir, un saut de joie quand la séance du jour est faite, avec une transition à chaque changement. »
   Le widget (resources/ios/widget/RequeteWidget/RequeteWidget.swift) lit le moment à l’heure de chaque entrée, que le fournisseur pose
   à minuit, 5 h, midi et 18 h. Pas de compilateur Swift ici : les tests lisent le code. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const swift = fs.readFileSync(path.join(ROOT, 'resources/ios/widget/RequeteWidget/RequeteWidget.swift'), 'utf8');
const ios = fs.readFileSync(path.join(ROOT, 'IOS.md'), 'utf8');
const ESPACE = '\\' + 'u{202F}';   // l’espace fine insécable de Swift, avant « ? » et « ! »
const entre = (a, b) => { const i = swift.indexOf(a); assert.ok(i >= 0, a); const j = swift.indexOf(b, i + a.length); assert.ok(j > i, b); return swift.slice(i, j); };

/* Le moment du chat, recopié du code Swift (les plages d’heures de SerieEntree.humeur), pour le lire comme un tableau */
const humeurDuSwift = () => {
  const src = entre('var humeur: Humeur {', 'struct SerieFournisseur');
  assert.ok(src.includes('if faitAujourdhui { return .fete }'), 'la séance faite passe avant l’heure');
  const plages = [...src.matchAll(/case (\d+)\.\.<(\d+): return (?:repos \? \.(\w+) : \.(\w+)|\.(\w+))/g)]
    .map(m => ({ de: +m[1], a: +m[2], repos: m[3] || m[5], sinon: m[4] || m[5] }));
  const defaut = /default: return \.(\w+)/.exec(src)[1];
  return ({ heure, fait = false, repos = false }) => {
    if (fait) return 'fete';
    const p = plages.find(x => heure >= x.de && heure < x.a);
    return p ? (repos ? p.repos : p.sinon) : defaut;
  };
};

test('le moment du chat : la bulle de 5 h à midi, la flamme de 18 h à minuit (pas un jour de repos), le saut de joie dès que c’est fait', () => {
  const h = humeurDuSwift();
  const jour = Array.from({ length: 24 }, (_, heure) => h({ heure }));
  assert.deepEqual(jour, [...Array(5).fill('journee'), ...Array(7).fill('matin'), ...Array(6).fill('journee'), ...Array(6).fill('soir')]);
  assert.deepEqual(Array.from({ length: 24 }, (_, heure) => h({ heure, fait: true })), Array(24).fill('fete'), 'fait : la fête toute la journée');
  assert.equal(h({ heure: 20, repos: true }), 'journee', 'un jour de repos, le soir ne presse pas');
  assert.equal(h({ heure: 8, repos: true }), 'matin', 'mais la bulle du matin reste (« Jour de repos ! »)');
  /* Les quatre poses, et rien d’autre */
  const cas = [...entre('enum Humeur: String {', '}').matchAll(/case (\w+)/g)].map(m => m[1]);
  assert.deepEqual(cas, ['matin', 'journee', 'soir', 'fete']);
  for (const m of swift.matchAll(/\.(matin|journee|soir|fete|nuit|midi)\b/g)) assert.ok(cas.includes(m[1]), m[1]);
});

test('le fournisseur : une entrée maintenant, puis à minuit, 5 h, midi et 18 h sur sept jours ; le jour de repos vient de « limite »', () => {
  const t = entre('func getTimeline(in context: Context', 'private func cle(');
  for (const k of ['var dates = [maintenant]', 'for j in 0...7 {', 'for heure in [0, 5, 12, 18] {',
    'guard let d = cal.date(bySettingHour: heure, minute: 0, second: 0, of: jour), d > maintenant else { continue }',
    'completion(Timeline(entries: dates.map { entree(pour: $0) }, policy: .atEnd))'])
    assert.ok(t.includes(k), k);
  /* Les heures des entrées sont celles où le chat change */
  const h = humeurDuSwift();
  for (const heure of [0, 5, 12, 18]) assert.notEqual(h({ heure: heure === 0 ? 23 : heure - 1 }), h({ heure }), `${heure} h : un changement`);
  const e = entre('private func entree(pour date: Date) -> SerieEntree {', 'private let violet');
  for (const k of ['let repos = !limite.isEmpty && k < limite', 'SerieEntree(date: date, serie: serie, faitAujourdhui: fait, repos: !fait && repos)',
    'SerieEntree(date: date, serie: serie, faitAujourdhui: false, repos: repos)', 'return SerieEntree(date: date, serie: 0, faitAujourdhui: false)'])
    assert.ok(e.includes(k), k);
  assert.ok(swift.includes('    var repos: Bool = false\n'), 'un paramètre facultatif : les autres entrées (aperçu, galerie) restent les mêmes');
  /* La limite, en clés « AAAA-MM-JJ » : avant elle, la série tient sans séance (jours de repos du planning) */
  const repos = (k, limite) => limite !== '' && k < limite;
  assert.equal(repos('2026-11-04', '2026-11-05'), true);
  assert.equal(repos('2026-11-05', '2026-11-05'), false, 'le dernier jour qui garde la série : un jour de séance');
  assert.equal(repos('2026-11-04', ''), false, 'rien de rangé : pas de repos');
});

test('chaque pose : la bulle du matin, la flamme du soir, le saut de joie, et une transition à chaque changement', () => {
  const vue = entre('struct SerieVue: View {', 'struct Bulle: Shape {');
  for (const k of [
    /* le matin : le compteur se range dans le coin, la bulle sort de la bouche du chat */
    `Text(entree.repos ? "Jour de repos${ESPACE}!" : "Une petite requête${ESPACE}?")`,
    '.scaleEffect(humeur == .matin ? 0.6 : 1, anchor: .topLeading)', '.frame(width: w * 0.84, alignment: humeur == .matin ? .leading : .center)',
    '.transition(.scale(scale: 0.3, anchor: .bottomLeading).combined(with: .opacity))',
    /* le soir : la flamme grandit et rougeoie */
    `Text(entree.serie > 0 ? "Ta flamme t’attend${ESPACE}!" : "Allume ta flamme${ESPACE}!")`, 'return humeur == .soir ? 1.3 : 0.88',
    'case .soir: return Color(red: 1.0, green: 0.541, blue: 0.239).opacity(0.9)', '.shadow(color: lueur, radius: w * 0.05)',
    '.transition(.opacity.combined(with: .offset(y: h * 0.05)))',
    /* la fête : la flamme dorée, le chat en l’air et penché, les étincelles */
    'if entree.faitAujourdhui { return dore }', '.rotationEffect(.degrees(humeur == .fete ? -8 : 0))   // le saut de joie', 'Image(systemName: "sparkle")',
    '.transition(.scale(scale: 0.2).combined(with: .opacity))   // elles jaillissent de derrière le chat',
    'private var saut: Animation { .spring(response: 0.5, dampingFraction: 0.5) }',
    /* le chat plonge vite, et ressort un peu après : d’un bond, s’il fête la séance */
    'insertion: AnyTransition.move(edge: .bottom).animation((humeur == .fete ? saut : ressort).delay(0.15))',
    'removal: AnyTransition.move(edge: .bottom).animation(.easeIn(duration: 0.2))',
    '.animation(ressort, value: humeur)', '.accessibilityLabel(Text(libelle))'])
    assert.ok(vue.includes(k), k);
  /* Le chat : réveillé le matin, plus bas le soir, en l’air quand c’est fait */
  const haut = Object.fromEntries([...entre('private var hauteurChat: CGFloat {', '}\n\n').matchAll(/case \.(\w+): return ([\d.]+)/g)].map(m => [m[1], +m[2]]));
  assert.deepEqual(haut, { matin: 0.93, journee: 0.97, soir: 1.02, fete: 0.9 });
  assert.ok(haut.fete < haut.matin && haut.matin < haut.journee && haut.journee < haut.soir);
  /* Chaque « switch humeur » couvre les quatre poses (sinon, Swift refuse de compiler) */
  const sw = [...swift.matchAll(/switch humeur \{([\s\S]*?)\n {8}\}/g)].map(m => m[1]);
  assert.equal(sw.length, 3);
  for (const s of sw) for (const c of ['matin', 'journee', 'soir', 'fete']) assert.ok(s.includes(`.${c}`) || s.includes('default:'), `${c} : ${s}`);
  /* Tout ce que la vue appelle existe */
  for (const k of ['private func compteur(_ w: CGFloat) -> some View {', 'private func bulle(_ w: CGFloat) -> some View {',
    'private func etincelles(_ w: CGFloat, _ h: CGFloat) -> some View {', 'private func chatVue(_ w: CGFloat, _ h: CGFloat) -> some View {',
    'private func legende(_ w: CGFloat, _ h: CGFloat) -> some View {', 'private func etincelle(_ taille: CGFloat) -> some View {',
    'private var tailleFlamme: CGFloat {', 'private var lueur: Color {', 'private var hautCompteur: CGFloat {', 'private var libelle: String {',
    'private let dore = Color(', 'private let doreClair = Color(', 'private let violetTexte = Color('])
    assert.ok(swift.includes(k), k);
  for (const k of ['compteur(w)', 'bulle(w)', 'etincelles(w, h)', 'chatVue(w, h)\n                .id(chat)', 'legende(w, h)\n                    .transition', 'etincelle(w * 0.1)', 'Bulle(pointe: pointe)']) assert.ok(vue.includes(k), k);
  const bulle = entre('struct Bulle: Shape {', 'extension View {');
  assert.ok(bulle.includes('var pointe: CGFloat') && bulle.includes('func path(in r: CGRect) -> Path {') && bulle.includes('p.closeSubpath()\n        return p'));
});

test('la bulle du matin commence après le compteur réduit, même à trois chiffres', () => {
  const b = entre('private func bulle(_ w: CGFloat) -> some View {', 'return Text(');
  assert.ok(b.includes('let finCompteur = 0.08 + 0.6 * (0.2 + 0.175 * chiffres)') && b.includes('let debut = max(0.42, finCompteur + 0.03)'));
  assert.ok(swift.includes('.frame(width: w * (0.95 - debut))') && swift.includes('.padding(.trailing, w * 0.05)'), 'jusqu’au bord droit, moins la marge');
  /* Le compteur réduit : 0,6 (le même que .scaleEffect), depuis 0,08 ; la flamme et l’espace (0,2), puis environ 0,175 par chiffre */
  for (const [chiffres, large] of [[1, 0.53], [2, 0.51], [3, 0.405]]) {
    const fin = 0.08 + 0.6 * (0.2 + 0.175 * chiffres), debut = Math.max(0.42, fin + 0.03);
    assert.ok(debut > fin, `${chiffres} chiffre(s) : pas de chevauchement`);
    assert.ok(Math.abs((0.95 - debut) - large) < 0.006, `${chiffres} chiffre(s) : ${(0.95 - debut).toFixed(3)}`);
  }
});

test('la galerie et le guide iOS', () => {
  assert.ok(swift.includes('.description("Ta série de jours sur Requête, et le chat qui change avec la journée.")'));
  assert.ok(swift.includes('completion(SerieEntree(date: Date(), serie: 5, faitAujourdhui: true))'), 'la galerie montre la fête');
  assert.ok(ios.includes('### Le chat change dans la journée (4 novembre, 12 h 14)'));
});
