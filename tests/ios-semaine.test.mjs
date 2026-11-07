/* Elisa, 7 novembre (« Ta semaine, en résultat de requête », d’après la planche : « Le widget parle SQL : ta semaine sort comme
   un tableau de résultats. ») : un widget moyen, « SELECT jour, flamme FROM ma_semaine; » puis une colonne par jour, du lundi au
   dimanche. La page range les jours (widgetSemaine), le pont les garde, le widget en tire la semaine du jour (SemaineRangement) ;
   sombre façon terminal en mode sombre, clair façon tableau de résultats sinon. */
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
const INS = '\\' + 'u{00A0}';
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ici = x => JSON.parse(JSON.stringify(x));
const dstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addJ = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/* La page, dans un bac à sable : samedi 7 novembre ; le planning commence le lundi 26 octobre, sans séance le jeudi ni le dimanche */
const page = ({ actifs, debutPlan = '2026-10-26', actSince = '2026-10-27', jour = new Date(2026, 10, 7) }) => {
  const ctx = vm.createContext({ auj: () => jour, dstr, addJ, debutPlan: () => debutPlan, state: { actSince },
    jourActif: iso => actifs.includes(iso), jourRepos: (iso, start) => !!start && iso >= start && [0, 4].includes(new Date(iso + 'T12:00').getDay()) });
  vm.runInContext(entre(app, 'function widgetSemaine(){', 'if(typeof document!=='), ctx);
  return ici(ctx.widgetSemaine());
};

/* La règle du widget (SemaineRangement.etatDu et rang), rejouée ici : chaque ligne est vérifiée dans le Swift */
const REGLE = ['if s.actifs.contains(cle) { return .fait }', 'if s.repos.contains(cle) { return .repos }', 'if cle == aujourdhui { return .attente }',
  'if cle > aujourdhui { return .avenir }', 'if s.debut.isEmpty || cle < s.debut { return .avenir }', 'return .manque'];
const etatDu = (cle, aujourdhui, s) => {
  if (s.actifs.includes(cle)) return 'fait';
  if (s.repos.includes(cle)) return 'repos';
  if (cle === aujourdhui) return 'attente';
  if (cle > aujourdhui) return 'avenir';
  if (!s.debut || cle < s.debut) return 'avenir';
  return 'manque';
};
const semaine = (s, jour) => { const rang = (jour.getDay() + 1 + 5) % 7; return Array.from({ length: 7 }, (_, i) => etatDu(dstr(addJ(jour, i - rang)), dstr(jour), s)); };

test('la page range les jours : actifs (trois semaines), repos du planning (trois avant, deux après), le premier jour', () => {
  const s = page({ actifs: ['2026-10-14', '2026-10-27', '2026-11-02', '2026-11-03', '2026-11-06'] });
  assert.deepEqual(s.actifs, ['2026-10-27', '2026-11-02', '2026-11-03', '2026-11-06'], 'le 14 octobre est trop ancien (plus de trois semaines)');
  assert.equal(s.repos[0], '2026-10-29', 'rien avant le début du planning');
  assert.equal(s.repos.at(-1), '2026-11-19', 'deux semaines après (le 21, un samedi, a ses séances)');
  assert.ok(s.repos.includes('2026-11-08') && s.repos.includes('2026-11-05'));
  assert.equal(s.debut, '2026-10-26', 'le plus tôt du début du planning et de la première activité');
  assert.equal(page({ actifs: [], debutPlan: null, actSince: '2026-11-04' }).debut, '2026-11-04', 'sans planning : la première activité');
  /* Le bac à sable de la série (retours-0354) n’a pas l’état de l’app : la semaine reste vide, la série part quand même */
  assert.deepEqual(ici(vm.runInNewContext(entre(app, 'function widgetSemaine(){', 'if(typeof document!==') + ';widgetSemaine()', { auj: () => new Date(), dstr, addJ, debutPlan: () => null, jourActif: () => true, jourRepos: () => false })), { actifs: [], repos: [], debut: '' });
  assert.ok(app.includes(',semaine:JSON.stringify(widgetSemaine())},k=JSON.stringify(data);'), 'avec la série (widgetMaj)');
});

test('la semaine du widget, du lundi au dimanche : flamme, repos, en attente, NULL, à venir', () => {
  const r = entre(swift, 'static func etatDu(', '\n    }\n');
  for (const k of REGLE) assert.ok(r.includes(k), k);
  assert.ok(swift.includes('let jour: Int = Calendar.current.component(.weekday, from: date)\n        return (jour + 5) % 7'), 'lundi : 0 … dimanche : 6');
  const samedi = new Date(2026, 10, 7);
  /* La semaine de la planche : lundi, mardi, mercredi faits ; jeudi au repos ; vendredi fait ; samedi en attente ; dimanche au repos */
  let s = page({ actifs: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06'] });
  assert.deepEqual(semaine(s, samedi), ['fait', 'fait', 'fait', 'repos', 'fait', 'attente', 'repos']);
  /* Mercredi manqué : NULL ; samedi fait : la flamme ; un jour de repos fait compte comme fait */
  s = page({ actifs: ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-07'] });
  assert.deepEqual(semaine(s, samedi), ['fait', 'fait', 'manque', 'fait', 'manque', 'fait', 'repos']);
  /* Avant le premier jour, pas de NULL ; lundi, une nouvelle semaine commence (le widget pose une entrée chaque minuit) */
  s = page({ actifs: ['2026-11-05'], debutPlan: null, actSince: '2026-11-05' });
  assert.deepEqual(semaine(s, samedi), ['avenir', 'avenir', 'avenir', 'fait', 'manque', 'attente', 'avenir']);
  assert.deepEqual(semaine(s, new Date(2026, 10, 9)), ['attente', 'avenir', 'avenir', 'avenir', 'avenir', 'avenir', 'avenir'], 'lundi 9 : la semaine repart');
  const t = entre(swift, 'struct SemaineFournisseur: TimelineProvider {', '\n}\n');
  assert.ok(t.includes('for j in 1...7 {') && t.includes('policy: .atEnd'), 'chaque minuit sur sept jours');
});

test('le widget : moyen, « SELECT jour, flamme FROM ma_semaine; », sombre ou clair selon l’iPhone', () => {
  const w = entre(swift, 'struct RequeteSemaine: Widget {', '\n}\n');
  for (const k of ['let kind = "RequeteSemaine"', 'StaticConfiguration(kind: kind, provider: SemaineFournisseur()) { entree in', 'SemaineVue(entree: entree).fondSemaine()',
    '.configurationDisplayName("Ta semaine")', '.supportedFamilies([.systemMedium])', '.sansMarges()'])
    assert.ok(w.includes(k), k);
  assert.ok(swift.includes('        RequeteCheminee()\n        RequeteSemaine()\n'), 'dans le paquet, sans condition (pas de bouton : iOS 15 suffit)');
  const v = entre(swift, 'struct SemaineVue: View {', '\nstruct RequeteSemaine: Widget {');
  for (const k of ['mode == .dark ? PaletteSemaine.sombre : PaletteSemaine.claire', 'Text(verbatim: "SELECT").foregroundColor(p.motCle)', 'Text(verbatim: " jour, flamme ")',
    'Text(verbatim: "FROM")', 'Text(verbatim: " ma_semaine;")', 'Image(systemName: "flame.fill")', 'Image(systemName: "flame")', 'Image(systemName: "moon.fill")',
    'Text(verbatim: "NULL")', 'Text(verbatim: "·")', 'Text("repos")', 'return attend ? lienSeance : nil', '.widgetURL(lien)'])
    assert.ok(v.includes(k), k);
  assert.ok(swift.includes('if mode == .dark {\n            LinearGradient('), 'le fond sombre, façon terminal');
  /* Sous le tableau : « 7 lignes · 4 flammes » et où en est aujourd’hui, avec l’espace insécable */
  const r = entre(swift, 'enum SemaineRangement {', '\n}\n');
  for (const k of [`if n == 0 { return "7${INS}lignes" }`, `if n == 1 { return "7${INS}lignes · 1${INS}flamme" }`, `return "7${INS}lignes · \\(n)${INS}flammes"`,
    `case .fait: return nom + "${INS}: flamme allumée"`, `case .attente: return nom + "${INS}: en attente"`, `case .repos: return nom + "${INS}: repos"`,
    'static let noms: [String] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]'])
    assert.ok(r.includes(k), k);
  assert.ok(pont.includes('d.set(call.getString("semaine") ?? "", forKey: "semaine")'), 'le pont garde la semaine');
  const cles = [...r.matchAll(/forKey: "(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(cles, ['semaine'], 'le widget ne fait que lire');
});

test('IOS.md : ta semaine, pour la prochaine fois', () => {
  const s = entre(ios, '### Ta semaine, en résultat de requête (7 novembre)', '\n### ');
  for (const k of ['RequeteSemaine', 'SELECT jour, flamme FROM ma_semaine;', 'NULL', 'mode sombre', 'widgetSemaine']) assert.ok(s.includes(k), k);
});
