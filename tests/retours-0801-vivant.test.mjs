/* Elisa, 13 novembre, 8 h 01 : « Améliore la dynamique Islande / widget » (la Dynamic Island et les widgets). Ses réponses : tout
   (la Dynamic Island, les widgets de l’accueil, le widget verrouillé, la page du widget), et « Plus vivant ».
   iOS ne laisse ni un widget ni une Live Activity tourner en boucle : ce qui bouge tout seul, ce sont ses minuteurs et ses barres
   (timerInterval, style .timer), et le passage d’un état à l’autre. Trois moyens, donc :
   1. la petite scène du retour : l’app recharge les widgets quand on la quitte ; le fournisseur pose trois entrées à la suite
      (Scene) et le widget joue une scène en arrivant sur l’écran d’accueil (Ta flamme, La cheminée, Ta semaine) ;
   2. le temps qui défile : sur l’écran verrouillé, le soir, un anneau se vide jusqu’à minuit et « 3:12:45 » défile ; dans l’île de
      « Ta flamme en direct », tout petit, un anneau se vide autour de la flamme ;
   3. l’arrivée de l’île : on quitte l’app en pleine leçon ou en plein onboarding, l’île apparaît, puis le chat fait un clin d’œil
      (et le compte roule, l’anneau avance) ; ses yeux clignent à chaque changement de regard.
   Et la page du widget, dans l’app : la tuile est dessinée comme le vrai widget (elle montrait encore un nombre de jours) et joue
   sa journée en boucle. Pas de compilateur Swift ici : les deux fichiers passent l’analyse de tree-sitter-swift ; la page est
   vérifiée en simulation (chaque moment capturé, petit iPhone, mouvements réduits). */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const widget = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift'), pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '');
const tous = (t, ks) => { for (const k of ks) assert.ok(t.includes(k), k); };

/* ---------- 1. La petite scène du retour ---------- */
test('la scène : trois temps à 1,3 s d’écart, à partir d’iOS 17 ; chaque fournisseur la pose avant son entrée posée', () => {
  const scene = entre(widget, 'enum Scene {', '\n}\n');
  tous(scene, ['static let plonge: Int = 0', 'static let bond: Int = 1', 'static let pose: Int = 2', 'static let ecart: TimeInterval = 1.3',
    'if #available(iOSApplicationExtension 17.0, *) {\n            return true\n        }\n        return false',
    'if joue { return maintenant.addingTimeInterval(2 * ecart) }\n        return maintenant']);
  /* Posé par défaut : la galerie, les entrées de minuit, 5 h, midi, 18 h */
  for (const k of ['    var temps: Int = Scene.pose\n', '    var temps: Int = Scene.pose  // la petite scène du retour', '    var temps: Int = Scene.pose   // la petite scène du retour'])
    assert.ok(widget.includes(k), k);
  const fournisseurs = [['struct SerieFournisseur: TimelineProvider {', 'SerieEntree', 'entree(pour: maintenant)'], ['struct ChemineeFournisseur: TimelineProvider {', 'ChemineeEntree', 'entree(pour: maintenant)'],
    ['struct SemaineFournisseur: TimelineProvider {', 'SemaineEntree', 'SemaineRangement.entree(maintenant)']];
  for (const [debut, type, premiere] of fournisseurs) {
    const t = entre(entre(widget, debut, '\n}\n') + '\n', 'func getTimeline(', '\n    }\n');
    tous(t, ['let depart: Date = Scene.arrivee(maintenant)', 'var dates = [depart]', `var entrees: [${type}] = []`, 'if Scene.joue {', `var plonge: ${type} = ${premiere}`,
      'plonge.temps = Scene.plonge', 'bond.temps = Scene.bond', 'entrees.append(plonge)\n            entrees.append(bond)', 'completion(Timeline(entries: entrees, policy: .atEnd))']);
    assert.ok(t.includes('maintenant.addingTimeInterval(Scene.ecart))'), 'le bond, 1,3 s après');
    assert.ok(/, d > depart/.test(t) && !/, d > maintenant/.test(t), 'les entrées suivantes viennent après l’entrée posée : toujours dans l’ordre');
    assert.ok(t.indexOf('entrees.append(bond)') < t.indexOf('entrees.append(contentsOf: dates.map'), 'la scène, puis la suite');
  }
});

test('Ta flamme : le chat plonge, ressort plus haut et penché, se pose ; la flamme gonfle, les étincelles suivent', () => {
  const vue = entre(widget, 'struct SerieVue: View {', '\n/// La bulle du matin : un rectangle arrondi');
  tous(vue, ['let souffle: CGFloat = entree.temps == Scene.bond ? 1.14 : 1', 'let base: CGFloat = humeur == .soir ? 1.25 : 0.88\n        return base * souffle',
    'if entree.temps == Scene.plonge { return 0.2 }\n        if entree.temps != Scene.bond { return 0 }\n        return humeur == .soir ? -0.03 : -0.06',
    'if entree.temps == Scene.bond { return 7 }\n        return humeur == .fete ? -8 : 0',
    'if entree.temps == Scene.plonge { return 0.6 }\n        return entree.temps == Scene.bond ? 1.3 : 1',
    'let centre: CGFloat = h * (hauteurChat + decalChat)', '.rotationEffect(.degrees(penche))', '.position(x: w / 2, y: centre)', '.scaleEffect(eclat)',
    '.animation(saut, value: entree.temps)   // la petite scène du retour']);
  /* Posé : rien ne change à ce qu’Elisa a réglé (les hauteurs du 4 novembre, la flamme, le chat penché de la fête) */
  const haut = Object.fromEntries([...entre(vue, 'private var hauteurChat: CGFloat {', '}\n\n').matchAll(/case \.(\w+): return ([\d.]+)/g)].map(m => [m[1], +m[2]]));
  assert.deepEqual(haut, {matin: 0.93, journee: 0.97, soir: 1.04, fete: 0.9});
});

test('La cheminée : le feu se tasse et reprend d’un souffle (jamais froide), le chat fait un petit bond', () => {
  tous(entre(widget, 'struct PieceVue: View {', '\nstruct ChemineeVue: View {'), ['let souffle: CGFloat = PieceVue.souffle(feu, entree.temps)', '.scaleEffect(souffle, anchor: .bottom)',
    '.animation(reprise, value: entree.temps)', 'static func souffle(_ feu: Feu, _ temps: Int) -> CGFloat {\n        if feu == .froid { return 1 }\n        if temps == Scene.plonge { return 0.94 }\n        return temps == Scene.bond ? 1.08 : 1\n    }']);
  tous(entre(widget, 'struct ChemineeVue: View {', '\nstruct RequeteCheminee: Widget {'), ['let bond: CGFloat = ChemineeVue.bond(entree.temps) * u', '.offset(y: bond)\n                .id(nomChat)',
    '.animation(ressort, value: entree.temps)', 'static func bond(_ temps: Int) -> CGFloat {\n        if temps == Scene.plonge { return 6 }\n        return temps == Scene.bond ? -8 : 0\n    }']);
});

test('Ta semaine : la case d’aujourd’hui bat (une flamme seulement), le compte des flammes roule', () => {
  const vue = entre(widget, 'struct SemaineVue: View {', '\nstruct RequeteSemaine: Widget {');
  tous(vue, ['let pouls: Animation = .spring(response: 0.45, dampingFraction: 0.5)', '.animation(pouls, value: entree.temps)',
    'private func battement(_ j: CaseSemaine) -> CGFloat {\n        if !j.aujourdhui { return 1 }\n        if j.etat != .fait && j.etat != .attente { return 1 }\n        if entree.temps == Scene.plonge { return 0.72 }\n        return entree.temps == Scene.bond ? 1.24 : 1\n    }',
    'valeur(j.etat, f, p)\n                .scaleEffect(battement(j))', 'let flammes: Int = entree.jours.filter { $0.etat == .fait }.count', '.chiffreQuiRoule(flammes)']);
});

test('La requête de poche : la question suivante pousse l’autre, le symbole du verdict se pose', () => {
  const vue = entre(widget, 'struct PocheVue: View {', '\nstruct RequetePoche: Widget {');
  tous(vue, ['colonne(m, q)\n                .id(q)', '.transition(.push(from: .trailing))', '.animation(ressort, value: repondu)',
    /* 13 novembre, 8 h 32 : le symbole est devenu une pastille sur le coin de la puce (le texte ne rétrécit plus) ; il se pose pareil */
    'Image(systemName: nom)\n                    .font(icone)', '.overlay(Circle().strokeBorder(Color.white, lineWidth: lisere))\n                    .transition(.scale(scale: 0.2).combined(with: .opacity))',
    '.overlay(pastille(style, u), alignment: .topTrailing)']);
  assert.ok(widget.includes('struct QuestionPoche: Codable, Hashable {'), 'la question sert d’identité');
});

/* ---------- 2. Le temps qui défile ---------- */
test('l’écran verrouillé, le soir d’un jour de séance : l’anneau se vide jusqu’à minuit, « 3:12:45 » défile dans le bandeau', () => {
  const vue = entre(widget, 'struct VerrouVue: View {', '\nextension View {');
  tous(vue, ['private var soirPresse: Bool {\n        if fait || entree.repos { return false }\n        return entree.humeur == .soir\n    }',
    'let dixHuit: Date = cal.date(bySettingHour: 18, minute: 0, second: 0, of: jour) ?? entree.date', 'let minuit: Date = cal.date(byAdding: .day, value: 1, to: jour) ?? secours', 'return debut...minuit',
    'if presse {\n                anneauDuSoir\n            }', 'return ProgressView(timerInterval: periode, countsDown: true) {\n            EmptyView()\n        } currentValueLabel: {\n            EmptyView()\n        }\n        .progressViewStyle(.circular)',
    'let lignes: Int = presse ? 1 : 2', '.lineLimit(lignes)', 'if presse {\n                    Text(minuit, style: .timer)\n                        .font(compteur)\n                        .monospacedDigit()']);
  /* « 0/1 » reste dans le rond, plus petit dans l’anneau */
  tous(vue, ['let tailleFlamme: CGFloat = presse ? 15 : 20', 'let tailleChiffre: CGFloat = presse ? 10 : 12', 'Text(compte)\n                        .font(chiffre)']);
});

test('Ta flamme en direct, tout petit dans l’île : l’anneau se vide autour de la flamme tant qu’elle attend', () => {
  const v = entre(widget, 'struct DirectMinimal: View {', '\n}\n');
  tous(v, ['let flamme: RequeteFlammeDirect', 'let attend: Bool = moment == .attend', 'let taille: CGFloat = attend ? 10 : 14', 'if attend {\n                anneau\n            }',
    'let periode: ClosedRange<Date> = periodeDirect(flamme)', '.progressViewStyle(.circular)\n        .tint(braise)\n        .frame(width: 22, height: 22)']);
  assert.ok(widget.includes('@available(iOS 16.1, *)\nstruct DirectMinimal: View {') && widget.includes('DirectMinimal(flamme: context.attributes, moment: momentDirect(context))'));
});

/* ---------- 3. L’arrivée de l’île ---------- */
test('les lunettes : le chat cligne quand son regard change (les yeux d’avant se ferment, ceux d’après s’ouvrent)', () => {
  tous(widget, ['struct Paupiere: ViewModifier {\n    let ouverture: CGFloat\n\n    func body(content: Content) -> some View {\n        content.scaleEffect(x: 1, y: ouverture, anchor: .center)\n    }\n}',
    'AnyTransition.modifier(active: Paupiere(ouverture: 0.08), identity: Paupiere(ouverture: 1))',
    'let ouvre: Animation = Animation.easeOut(duration: 0.18).delay(0.12)', 'let ferme: Animation = Animation.easeIn(duration: 0.12)',
    'insertion: AnyTransition.paupieres.animation(ouvre),\n            removal: AnyTransition.paupieres.animation(ferme)']);
  tous(entre(widget, 'struct LunettesChat: View {', '\n    @ViewBuilder'), ['yeux(e, paupiere)\n                .id(regard)', '.transition(AnyTransition.clignement)', '.animation(.easeInOut(duration: 0.3), value: regard)']);
});

test('le clin d’œil : le même champ facultatif dans l’app et dans le widget, pour la leçon et pour l’onboarding', () => {
  for (const nom of ['RequeteLecon', 'RequeteAccueil']) {
    const type = t => sansCommentaires(entre(t, `struct ${nom}: ActivityAttributes {`, '\n}\n')).replace(/\s+/g, ' ').trim();
    assert.equal(type(widget), type(pont), nom);
    assert.ok(type(widget).includes('var clin: Bool? = nil }'), `${nom} : facultatif, une activité d’avant se lit encore`);
  }
  tous(entre(widget, 'func leconRegard(', '\n}\n'), ['if e.fini { return .etoiles }\n    if perime { return .endormi }\n    if e.clin == true { return .clin }']);
  tous(entre(widget, 'static func regard(_ e: RequeteAccueil.ContentState, perime: Bool) -> Regard {', '\n    }\n'),
    ['if e.clin == true && e.etape <= 0 { return .rieur }\n        if e.clin == true { return .clin }\n        if e.etape <= 0 { return .clin }']);
  /* La jauge, la barre et l’anneau avancent sous les yeux (iOS 17) */
  tous(widget, ['.animation(.easeOut(duration: 0.6), value: progression)', '.animation(.spring(response: 0.45, dampingFraction: 0.55), value: pleine)', '.animation(.spring(response: 0.6, dampingFraction: 0.72), value: part)']);
});

test('le pont : l’île apparaît, une seconde, le clin d’œil, huit dixièmes, puis l’état ; une mise à jour plus récente arrête la précédente', () => {
  for (const [nom, signature, attente] of [['RequeteLeconPont', 'static func maj(_ etat: RequeteLecon.ContentState, anime: Bool) async {', 'attente.reussis = a.content.state.reussis ?? etat.reussis'],
    ['RequeteAccueilPont', 'static func maj(_ etat: RequeteAccueil.ContentState, anime: Bool, avant: Int?) async {', 'attente.etape = min(etat.etape, max(0, avant ?? etat.etape))']]) {
    const e = entre(pont, `enum ${nom} {`, '\n}\n');
    assert.ok(e.includes('    static var tour: Int = 0\n'), nom);
    const m = entre(e, signature, '\n    }\n');
    tous(m, ['tour += 1\n        let mien: Int = tour', 'if anime { fond.debut() }', attente, 'try? await Task.sleep(nanoseconds: 1_100_000_000)\n                if mien != tour { break }',
      'salut.clin = true', 'try? await Task.sleep(nanoseconds: 800_000_000)\n                if mien != tour { break }', 'await a.update(ActivityContent(state: etat, staleDate: perime))', 'if anime { fond.fin() }']);
    const ordre = [attente, '1_100_000_000', 'salut.clin = true', '800_000_000', 'await a.update(ActivityContent(state: etat, staleDate: perime))'].map(k => m.indexOf(k));
    assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), `${nom} : dans l’ordre`);
    assert.ok(!/\?[^\n]*\?[^\n]*:/.test(sansCommentaires(m).replace(/\?\?/g, '')), 'un seul choix par ligne');
  }
  const f = entre(pont, '@objc func accueilMaj(_ call: CAPPluginCall) {', '\n    }\n');
  tous(f, ['let anime: Bool = call.getBool("anime") ?? false', 'let avant: Int? = call.getInt("avant")', 'await RequeteAccueilPont.maj(etat, anime: anime, avant: avant)']);
  assert.ok(!/\bvar /.test(f), 'rien de modifiable n’entre dans la tâche');
});

test('la page : quitter l’app en pleine leçon anime toujours l’île ; en plein onboarding, l’anneau repart de l’étape montrée la dernière fois', () => {
  assert.ok(entre(app, 'function ileMaj(force){', '\n}\n').includes("  if(force)data.anime=true;\n  ileAppel('leconMaj',data);"));
  assert.ok(app.includes("function lvHidden(){ if(!LV)return; if(document.hidden){ LV.video.pause(); ileMaj(true); }"), 'force : seulement quand on quitte l’app');
  const js = entre(app, 'let ileOb=null;', '\nfunction ileObFin(fini){');
  const appels = [], ecoutes = {};
  const ctx = vm.createContext({
    OB_SLIDES: ['welcome', 'name', 'level', 'practice', 'source', 'ready'], obStep: 0, obApercu: false, obLegalMode: null,
    obFlowSteps: () => ['name', 'level', 'practice', 'source'], draft: {name: 'Elisa'}, state: {onboarded: false},
    ilePont: () => ({}), ileAppel: (m, d) => appels.push([m, JSON.parse(JSON.stringify(d))]),
    document: {visibilityState: 'visible', getElementById: () => ({classList: {contains: c => c === 'on'}}), addEventListener: (n, f) => { ecoutes[n] = f; }}
  });
  vm.runInContext(js + ';this.ileObSync=ileObSync;this.ileObSalut=ileObSalut;', ctx);
  const va = n => { ctx.obStep = n; ctx.ileObSync(); };
  ctx.ileObSalut(); assert.equal(appels.length, 0, 'pas d’activité : rien');
  va(0); va(1); va(2); va(3);
  assert.deepEqual(appels.map(a => a[0]), ['accueilDebut', 'accueilMaj', 'accueilMaj', 'accueilMaj']);
  assert.ok(appels.every(a => !('anime' in a[1])), 'dans l’app, l’île n’est pas à l’écran : rien à animer');
  /* On quitte l’app à l’étape 3 : l’île montrait l’accueil (0), l’anneau avancera de 0 à 3 */
  ctx.document.visibilityState = 'hidden'; ecoutes.visibilitychange();
  assert.deepEqual(appels.at(-1), ['accueilMaj', {etape: 3, total: 4, titre: 'Ta première requête', bonjour: 'Bienvenue, Elisa', minutes: 1, anime: true, avant: 0}]);
  /* On revient, une étape de plus, on repart : de 3 à 4 */
  ctx.document.visibilityState = 'visible'; ecoutes.visibilitychange(); const n = appels.length;
  va(4); ctx.ileObSalut();
  assert.deepEqual([appels.at(-1)[1].etape, appels.at(-1)[1].avant, appels.at(-1)[1].anime], [4, 3, true]);
  assert.equal(appels.length, n + 2);
  ctx.ileObSalut(); assert.deepEqual([appels.at(-1)[1].etape, appels.at(-1)[1].avant], [4, 4], 'rien de neuf : le clin d’œil seul');
  ctx.state.onboarded = true; const k = appels.length; ctx.ileObSalut(); assert.equal(appels.length, k, 'onboarding fini : rien');
});

test('la salle et le défi en solo : la place, la manche, les points et les joueurs roulent', () => {
  tous(entre(widget, 'struct SalleGauche: View {', '\n}\n'), ['let points: Int = LectureSalle.moi(etat, salle)?.pts ?? 0', 'let soloValeur: Int = fin ? points : etat.manche', '.chiffreQuiRoule(soloValeur)', '.chiffreQuiRoule(-place)']);
  assert.ok(entre(widget, 'struct SalleTemps: View {', '\n}\n').includes('.chiffreQuiRoule(etat.joueurs.count)'));
});

/* ---------- La forme du Swift (pas de compilateur ici) ---------- */
test('les deux fichiers Swift : accolades, parenthèses et crochets équilibrés ; un seul choix par ligne ; pas de choix passé à Text', () => {
  for (const [nom, t] of [['RequeteWidget.swift', widget], ['RequeteWidgetPlugin.swift', pont]]) {
    const code = sansCommentaires(t).replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const [o, f] of ['{}', '()', '[]']) assert.equal(code.split(o).length, code.split(f).length, `${nom} : ${o}${f}`);
    for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, `${nom} : un seul choix par ligne : ${l.trim()}`);
    assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code), `${nom} : Text reçoit une constante typée`);
  }
  /* Ce que le nouveau code appelle existe, avec la bonne disponibilité */
  tous(widget, ['func chiffreQuiRoule(_ valeur: Int) -> some View {', 'func periodeDirect(_ flamme: RequeteFlammeDirect) -> ClosedRange<Date> {', 'private var saut: Animation { .spring(response: 0.5, dampingFraction: 0.5) }',
    '@available(iOS 16.1, *)\nstruct VerrouVue: View {', '@available(iOS 17.0, *)\nstruct PocheVue: View {', 'enum Feu {\n    case froid']);
});

/* ---------- La page du widget, dans l’app ---------- */
test('la tuile est dessinée comme le vrai widget : la flamme et « 0/1 », la coche, la bulle, la phrase du soir, les étincelles, le chat', () => {
  const ctx = vm.createContext({FLAME_SVG: '<svg class="f"/>', MASCOT_IMG: 'chat.webp'});
  vm.runInContext(entre(app, "const OB_WG_ETOILE=", '\nconst OB_WT_TEXTES=') + ';this.tuile=obWidgetTuile;', ctx);
  const t = ctx.tuile('fete');
  assert.ok(t.startsWith('<span class="ob-wg" data-m="fete"><span class="ob-wg-top"><span class="ob-wg-flw"><span class="ob-wg-fl"><svg class="f"/></span><i class="ob-wg-ok">'));
  for (const k of ['<b class="ob-wg-obj"><span class="ob-wg-ch"><i>0</i><i>1</i></span><small>/1</small></b>', '<span class="ob-wg-bulle">Une petite requête ?</span>', '<span class="ob-wg-leg">Ta flamme t’attend !</span>',
    '<span class="ob-wg-etin">', '<img class="ob-wg-cat" src="chat.webp" alt="" draggable="false"></span>']) assert.ok(t.includes(k), k);
  assert.equal(t.split('M12 1.5 14.4 9.6').length, 4, 'trois étincelles');
  assert.ok(ctx.tuile().includes('data-m="jour"') && ctx.tuile('n’importe quoi').includes('data-m="jour"') && ctx.tuile('soir').includes('data-m="soir"'));
  /* Plus de nombre de jours : le vrai widget n’en affiche plus depuis le 4 novembre */
  assert.ok(!app.includes('ob-wg-n') && !obv.includes('ob-wg-n') && !app.includes('obWidgetSerie'));
  /* 13 novembre, 9 h 19 : la tuile est le premier exemple de la galerie (avant, dans un iPhone dessiné) */
  assert.ok(app.includes("${ob?obWidgetTuile('jour'):wtuTuile()}") && app.split("${obWidgetTuile('fete')}").length === 3, 'la page part du jour ; le tutoriel reste sur la fête');
  /* Les phrases sont celles du widget */
  assert.ok(widget.includes('"Une petite requête\\u{202F}?"') && widget.includes('"Ta flamme t’attend\\u{202F}!"'));
});

test('la page du widget joue la journée en boucle : matin, soir, fête ; entre deux, le chat plonge ; sans mouvement, la fête posée', () => {
  const jouer = reduit => {
    const timers = [], journal = [], classes = new Set(), wg = {dataset: {m: 'jour'}, classList: {add: (...c) => { c.forEach(x => classes.add(x)); journal.push('+' + c.join(',')); }, remove: c => { classes.delete(c); journal.push('-' + c); }}};
    const ctx = vm.createContext({OB_SLIDES: ['widget'], obStep: 0, obDemoTimers: [], prefersReduceMotion: () => reduit, buzz: f => journal.push('buzz'),
      document: {querySelector: s => (s === '#ob-body .wgx .ob-wg' ? wg : null), body: {contains: () => true}}, setTimeout: (f, d) => { timers.push({f, d}); return timers.length; }});
    vm.runInContext(entre(app, 'const OB_WG_MOMENTS=', '\n/* Les trois étapes du tutoriel, en boucle') + ';this.jouer=obWidgetPromoJouer;', ctx);
    ctx.jouer();
    return {timers, journal, wg, classes, ctx};
  };
  const calme = jouer(true);
  assert.equal(calme.wg.dataset.m, 'fete'); assert.equal(calme.timers.length, 0);
  const j = jouer(false);
  assert.deepEqual(j.timers.map(t => t.d), [1500], 'la page s’installe d’abord');
  const vus = [];
  for (let tour = 0; tour < 4; tour++) {
    j.timers.shift().f();                                            // le moment suivant : le chat plonge…
    assert.ok(j.classes.has('is-vie') && j.classes.has('is-plonge'));
    const [pose, suite] = j.timers.splice(0, 2);
    assert.equal(pose.d, 230); pose.f();                             // … et ressort dans sa nouvelle pose
    assert.ok(!j.classes.has('is-plonge'));
    vus.push([j.wg.dataset.m, suite.d]); j.timers.push(suite);
  }
  assert.deepEqual(vus, [['matin', 2700], ['soir', 2700], ['fete', 3600], ['matin', 2700]], 'en boucle');
  assert.equal(j.journal.filter(x => x === 'buzz').length, 1, 'un seul petit choc, à la première fête');
  assert.equal(j.ctx.obDemoTimers.length, 9, 'les minuteurs sont rendus à la page, qui les arrête en partant');
  /* Une autre page : la boucle s’arrête */
  j.ctx.obStep = 1; const n = j.timers.length; j.timers.shift().f(); assert.equal(j.timers.length, n - 1);
});

test('les moments de la tuile sont des états, les passages des transitions ; l’arrivée du chat ne le tient plus une fois la boucle lancée', () => {
  const P = 'html #onboarding.ob-vitrine .ob-wg';
  tous(obv, [`${P}[data-m="matin"] .ob-wg-top{transform:translate(-28%,-2%) scale(.55)}`, `${P}[data-m="matin"] .ob-wg-bulle{transform:none;opacity:1}`,
    `${P}[data-m="soir"] .ob-wg-flw{transform:scale(1.22)}`, `${P}[data-m="soir"] .ob-wg-leg{opacity:1;transform:none}`,
    `${P}[data-m="fete"] .ob-wg-ch i{transform:translateY(-100%)}`, `${P}[data-m="fete"] .ob-wg-ok{transform:scale(1)}`, `${P}[data-m="fete"] .ob-wg-etin{opacity:1;transform:none}`,
    `${P}[data-m="fete"] .ob-wg-cat{transform:translate(-50%,-7%) rotate(-8deg)}`, `${P}.is-plonge .ob-wg-cat{transform:translate(-50%,28%);transition:transform .2s ease-in}`,
    `${P}-cat{transition:transform .55s var(--v-pop)}`]);
  const media = obv.slice(obv.indexOf('@media (prefers-reduced-motion:no-preference){'), obv.indexOf('@media (prefers-reduced-motion:reduce){', obv.indexOf('@media (prefers-reduced-motion:no-preference){')));
  assert.ok(media.includes('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine .wgx-petit .ob-wg.is-vie .ob-wg-cat{animation:none}'));
  /* Le nouveau bloc n’a pas d’animation à lui : des transitions seulement */
  const bloc = obv.slice(obv.indexOf('le widget dessiné vit ----------'));
  assert.ok(bloc.length > 500 && !/animation:/.test(bloc));
});

test('la feuille de style et le cache changent de version', () => {
  assert.ok(app.includes('onboarding-vitrine.css?v=68'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-13-salle-v2959';"));
});
