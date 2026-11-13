/* Elisa, 10 novembre, 7 h 33 (capture de la Dynamic Island d’une autre app : son avatar à gauche, un anneau qui avance à droite) :
   « En plein onboarding, fais la même chose pour Requête avec les yeux du chat. » Une Live Activity suit l’onboarding : les lunettes
   du chat à gauche, l’anneau des étapes à droite. La page la lance et la tient à jour (ileObSync), le pont la démarre (accueilDebut),
   le widget la dessine (RequeteAccueilIle). Pas de compilateur Swift ici : les tests lisent le code ; la page tourne dans un bac à sable. */
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
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

test('le même type dans l’app et dans le widget', () => {
  const type = t => sansCommentaires(entre(t, 'struct RequeteAccueil: ActivityAttributes {', '\n}\n')).replace(/\s+/g, ' ').trim();
  assert.equal(type(swift), type(pont));
  assert.equal(type(swift), 'struct RequeteAccueil: ActivityAttributes { public struct ContentState: Codable, Hashable { var etape: Int var total: Int var titre: String var bonjour: String var minutes: Int var fini: Bool var clin: Bool? = nil } var app: String');   // clin : 13 novembre, 8 h 01, facultatif (une activité d’avant se lit encore)
  for (const t of [swift, pont]) assert.ok(t.includes('@available(iOS 16.1, *)\nstruct RequeteAccueil: ActivityAttributes {'));
});

test('le pont : accueilDebut, accueilMaj, accueilFin (iOS 16.2), et rien d’en cours à la relance', () => {
  const noms = [...pont.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: CAPPluginReturnPromise\)/g)].map(x => x[1]);
  assert.deepEqual(noms.slice(-8, -5), ['accueilDebut', 'accueilMaj', 'accueilFin'], 'puis les notifications (retours-1555), « Gérer mon abonnement » (retours-2106), la note de l’app (retours-0102) et les widgets posés (retours-2004)');
  for (const n of ['accueilDebut', 'accueilMaj', 'accueilFin']) {
    const f = entre(pont, `@objc func ${n}(_ call: CAPPluginCall) {`, '\n    }\n');
    assert.ok(f.includes('guard #available(iOS 16.2, *) else {') && f.includes('Task {') && f.includes('call.resolve('), n);
  }
  const P = entre(pont, 'enum RequeteAccueilPont {', '\n}\n');
  for (const k of ['let etape: Int = min(total, max(0, call.getInt("etape") ?? 0))', 'await toutArreter()', 'guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }',
    'attributes: RequeteAccueil(app: "Requête")', 'staleDate: Date().addingTimeInterval(3600)', 'if Activity<RequeteAccueil>.activities.isEmpty {\n            _ = await debut(etat)',
    'let politique: ActivityUIDismissalPolicy = fini ? .after(Date().addingTimeInterval(5 * 60)) : .immediate',
    'for a in Activity<RequeteAccueil>.activities where !a.content.state.fini {'])
    assert.ok(P.includes(k), k);
  assert.ok(entre(pont, 'override public func load() {', '\n    }\n').includes('Task { await RequeteAccueilPont.arreterEnCours() }'), 'à la relance de l’app');
});

test('le widget : les yeux du chat à gauche, l’anneau à droite, l’île ouverte, l’écran verrouillé, le paquet', () => {
  const act = entre(swift, 'struct RequeteAccueilIle: Widget {', '\n}\n');
  for (const k of ['ActivityConfiguration(for: RequeteAccueil.self) { context in', 'AccueilVerrouille(etat: context.state, perime: accueilPerime(context))',
    'DynamicIslandExpandedRegion(.leading) {\n                    Image("ChatNoir")', 'DynamicIslandExpandedRegion(.trailing) {\n                    AccueilAnneau(etat: context.state, taille: 30)',
    'DynamicIslandExpandedRegion(.center) {\n                    AccueilCentre(etat: context.state)', 'DynamicIslandExpandedRegion(.bottom) {\n                    AccueilBas(etat: context.state, perime: accueilPerime(context))',
    '} compactLeading: {\n                LunettesChat(regard: LectureAccueil.regard(context.state, perime: accueilPerime(context)), largeur: 30)',
    '} compactTrailing: {\n                AccueilAnneau(etat: context.state, taille: 20)',
    '} minimal: {\n                LunettesChat(regard: LectureAccueil.regard(context.state, perime: accueilPerime(context)), largeur: 24)', '.keylineTint(lilas)'])
    assert.ok(act.includes(k), k);
  assert.ok(swift.includes('            RequeteSalleIle()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteAccueilIle()\n        }\n'), 'le paquet');
  const L = entre(swift, 'enum LectureAccueil {', '\n}\n');
  for (const k of ['if e.fini { return .etoiles }\n        if perime { return .endormi }\n', 'if e.clin == true && e.etape <= 0 { return .rieur }\n        if e.clin == true { return .clin }\n        if e.etape <= 0 { return .clin }\n        if e.etape >= e.total && e.minutes <= 0 { return .rieur }\n        return .ouvert',
    'return Double(fait) / Double(total)', 'return "Étape \\(e.etape) sur \\(e.total) · " + duree', 'let duree: String = "≈\\u{00A0}\\(max(1, e.minutes))\\u{00A0}min"',
    'if e.fini { return "C’est parti\\u{202F}! Ta première leçon t’attend." }'])
    assert.ok(L.includes(k), k);
  const anneau = entre(swift, 'struct AccueilAnneau: View {', '\n}\n');
  assert.ok(anneau.includes('.trim(from: 0, to: bout)') && anneau.includes('.rotationEffect(.degrees(-90))') && anneau.includes('let teinte: Color = etat.fini ? menthe : lilas'));
  /* Les règles du fichier : pas de ternaire dans un Text, un seul par ligne */
  const code = sansCommentaires(entre(swift, '// MARK: - L’onboarding dans l’île', '// MARK: - La salle dans l’île'));
  assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code));
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});

test('la page : l’accueil, chaque étape, le parcours prêt, la fin ; rien pour l’aperçu ni un compte déjà inscrit', () => {
  const js = entre(app, 'let ileOb=null;', '\nfunction ileObFin(fini){') + '\n' + entre(app, 'function ileObFin(fini){', '\n}\n') + '\n}\n';
  const appels = [];
  const ctx = vm.createContext({
    OB_SLIDES: ['welcome', 'name', 'level', 'practice', 'source', 'ready', 'pseudo'], obStep: 0, obApercu: false, obLegalMode: null,
    obFlowSteps: () => ['name', 'level', 'practice', 'source'], draft: {name: ''}, state: {onboarded: false},
    ilePont: () => ({}), ileAppel: (m, d) => appels.push([m, d]),
    document: {getElementById: () => ({classList: {contains: c => c === 'on'}})}
  });
  vm.runInContext(js + ';this.ileObSync=ileObSync;this.ileObFin=ileObFin;', ctx);
  const va = (n, f) => { ctx.obStep = n; if (f) f(); ctx.ileObSync(); };
  va(0);
  assert.deepEqual(JSON.parse(JSON.stringify(appels.at(-1))), ['accueilDebut', {etape: 0, total: 4, titre: 'Bienvenue', bonjour: 'Bienvenue sur Requête', minutes: 1}], 'l’accueil : un clin d’œil, 0 sur 4');
  va(0); assert.equal(appels.length, 1, 'rien de neuf : rien d’envoyé');
  va(1, () => { ctx.draft.name = 'Elisa'; });
  assert.deepEqual(JSON.parse(JSON.stringify(appels.at(-1))), ['accueilMaj', {etape: 1, total: 4, titre: 'Ton prénom', bonjour: 'Bienvenue, Elisa', minutes: 1}]);
  va(3); assert.deepEqual(appels.at(-1)[1].etape, 3, 'étape 3 sur 4, comme l’en-tête');
  assert.equal(appels.at(-1)[1].titre, 'Ta première requête');
  va(4); assert.deepEqual([appels.at(-1)[1].etape, appels.at(-1)[1].minutes], [4, 1], 'la dernière question : 4 sur 4, encore une minute (le chat n’est pas encore rieur)');
  va(6); assert.deepEqual([appels.at(-1)[1].etape, appels.at(-1)[1].minutes], [4, 1], 'le pseudo, hors tunnel : l’étape d’avant');
  va(5); assert.deepEqual([appels.at(-1)[1].etape, appels.at(-1)[1].minutes, appels.at(-1)[1].titre], [4, 0, 'Ton parcours t’attend']);
  ctx.ileObFin(true);
  assert.deepEqual(JSON.parse(JSON.stringify(appels.at(-1))), ['accueilFin', {fini: true}]);
  const n = appels.length;
  ctx.ileObFin(true); assert.equal(appels.length, n, 'une seule fin');
  ctx.state.onboarded = true; va(1); assert.equal(appels.length, n, 'compte déjà inscrit (Personnalisation) : rien');
  ctx.state.onboarded = false; ctx.obApercu = true; va(1); assert.equal(appels.length, n, 'l’aperçu de Mon compte : rien');
  ctx.obApercu = false; ctx.ilePont = () => null; va(2); assert.equal(appels.length, n, 'dans un navigateur : rien');
  /* Branchée : la fin de chaque page, la fin de l’onboarding, sa fermeture */
  assert.ok(app.includes("  obJustEntered=false;\n  if(typeof ileObSync==='function')ileObSync();   // la Dynamic Island suit l’étape (10 novembre)\n}"));
  assert.ok(app.includes("function obTerminer(action){\n  OB_CHATS.length=0;   // les chats de l’onboarding n’ont plus à rester prêts\n  if(typeof ileObFin==='function')ileObFin(true);"));
  assert.ok(app.includes("function closeOnboardingAuth(){\n  if(typeof ileObFin==='function')ileObFin(false);"));
});
