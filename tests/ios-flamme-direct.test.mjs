/* Elisa, 7 novembre, 19 h 26 (« Oui », pour la planche « Ta flamme, en direct jusqu’à minuit » : « À l’heure de ton planning, si ta
   flamme n’est pas encore allumée, une barre se vide toute seule jusqu’à minuit. Un tap : une leçon express. ») : une Live Activity,
   à activer dans Mon compte. La page demande les deux prochains soirs de séance (flammeDirectSync), le pont les programme
   (flammeProgrammer : iOS 26, Activity.request(…, start:)), le widget la dessine (RequeteFlammeDirecte). Pas de compilateur Swift
   ici : les tests lisent le code ; la page tourne dans un bac à sable. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const ios = lire('IOS.md');
const CATALOGUE = path.join(ROOT, 'resources/ios/widget/RequeteWidget/Assets.xcassets');
const FINE = '\\' + 'u{202F}';
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
const ici = x => JSON.parse(JSON.stringify(x));
const dimensions = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('le même type dans l’app et dans le widget : iOS relie la flamme programmée à son dessin par son nom', () => {
  const type = t => sansCommentaires(entre(t, 'struct RequeteFlammeDirect: ActivityAttributes {', '\n}\n')).replace(/\s+/g, ' ').trim();
  assert.equal(type(swift), type(pont));
  assert.equal(type(swift), 'struct RequeteFlammeDirect: ActivityAttributes { public struct ContentState: Codable, Hashable { var fait: Bool } var jour: String var debut: Date var minuit: Date var titre: String var action: String');
  for (const t of [swift, pont]) assert.ok(t.includes('@available(iOS 16.1, *)\nstruct RequeteFlammeDirect: ActivityAttributes {'), 'iOS 16.1 : l’app reste installable en iOS 15');
});

test('le widget : l’écran verrouillé, l’île (ouverte, compacte, minimale), le paquet', () => {
  const act = entre(swift, 'struct RequeteFlammeDirecte: Widget {', '/// Le widget de la flamme, et la Live Activity');
  for (const k of ['ActivityConfiguration(for: RequeteFlammeDirect.self) { context in',
    'DirectVerrouille(flamme: context.attributes, moment: momentDirect(context))\n                .activityBackgroundTint(fondDirect)',
    'DynamicIslandExpandedRegion(.leading) {\n                    Image(chatDirect(momentDirect(context)))',
    'DynamicIslandExpandedRegion(.trailing) {\n                    DirectFin(', 'DynamicIslandExpandedRegion(.center) {\n                    DirectCentre(',
    'DynamicIslandExpandedRegion(.bottom) {\n                    DirectBas(',
    '} compactLeading: {\n                LunettesChat(regard: regardDirect(momentDirect(context)), largeur: 30)',
    '} compactTrailing: {\n                DirectDroite(', '} minimal: {\n                DirectMinimal(flamme: context.attributes, moment: momentDirect(context))',
    '.widgetURL(lienDirect(momentDirect(context)))\n            .keylineTint(braise)'])
    assert.ok(act.includes(k), k);
  assert.equal(act.split('.widgetURL(lienDirect(momentDirect(context)))').length, 3, 'l’écran verrouillé et l’île mènent à la séance');
  /* Le paquet : après la flamme de l’écran verrouillé, iOS 16.1 comme la leçon */
  assert.ok(swift.includes('        if #available(iOS 16.1, *) {\n            RequeteFlammeVerrou()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteFlammeDirecte()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteSalleIle()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteAccueilIle()\n        }\n        if #available(iOS 17.0, *) {\n            RequetePoche()'), 'puis la salle dans l’île (ios-salle-ile)');
  assert.ok(swift.includes('@available(iOS 16.1, *)\nstruct RequeteFlammeDirecte: Widget {'));
});

test('les trois moments : elle attend, elle est allumée, minuit est passé (périmée)', () => {
  const m = entre(swift, 'func momentDirect(_ context: ActivityViewContext<RequeteFlammeDirect>) -> MomentDirect {', '\n}\n');
  assert.ok(m.includes('if context.state.fait { return .allumee }\n    if #available(iOSApplicationExtension 16.2, *) {\n        if context.isStale { return .passee }\n    }\n    if Date() >= context.attributes.minuit { return .passee }\n    return .attend'));
  assert.deepEqual([...entre(swift, 'enum MomentDirect {', '}').matchAll(/case (\w+)/g)].map(x => x[1]), ['attend', 'allumee', 'passee']);
  const cas = (fn, a, b, c) => { const f = entre(swift, `func ${fn}(`, '\n}\n'); for (const [k, v] of [['attend', a], ['allumee', b], ['passee', c]]) assert.ok(f.includes(`case .${k}:\n        return ${v}`), `${fn} ${k}`); };
  cas('regardDirect', '.ouvert', '.rieur', '.endormi');
  cas('chatDirect', '"ChatAllumette"', '"ChatBravo"', '"ChatDodo"');
  cas('titreDirect', `"Ta flamme t’attend${FINE}!"`, `"Flamme allumée${FINE}!"`, '"Minuit est passé"');
  cas('sousTitreDirect', 'titre', '"À demain."', `"À ta prochaine séance${FINE}!"`);
  assert.ok(swift.includes('func lienDirect(_ m: MomentDirect) -> URL? {\n    if m == .attend { return lienSeance }\n    return nil\n}'), 'un appui pendant le compte à rebours : la séance du jour');
});

test('le compte à rebours et la barre avancent seuls ; « Il te reste 3 h 12 min » ; la leçon express', () => {
  assert.ok(swift.includes('func periodeDirect(_ flamme: RequeteFlammeDirect) -> ClosedRange<Date> {\n    let debut: Date = min(flamme.debut, flamme.minuit)\n    return debut...flamme.minuit\n}'), 'jamais à l’envers');
  const compte = entre(swift, 'struct DirectCompte: View {', '\n}\n');
  assert.ok(compte.includes('return Text(timerInterval: periode, countsDown: true)') && compte.includes('.monospacedDigit()'));
  const barre = entre(swift, 'struct DirectBarre: View {', '\n}\n');
  assert.ok(barre.includes('return ProgressView(timerInterval: periode, countsDown: true) {\n            EmptyView()\n        } currentValueLabel: {\n            EmptyView()\n        }'), 'la barre se vide, sans texte');
  const sous = entre(swift, 'struct DirectSousTitre: View {', '\n}\n');
  assert.ok(sous.includes('(Text("Il te reste ") + Text(flamme.minuit, style: .relative))'), 'le temps qui reste, en français, défilé par iOS');
  assert.ok(sous.includes('Text("Ta prochaine séance rallumera ta flamme.")') && sous.includes('Text("À demain.")'));
  const verrou = entre(swift, 'struct DirectVerrouille: View {', '\n}\n');
  for (const k of ['Image(chat)', 'LunettesChat(regard: regardDirect(moment), largeur: 26)', 'DirectSousTitre(flamme: flamme, moment: moment)',
    'if moment == .attend {\n                    DirectBarre(flamme: flamme)', 'DirectBouton(texte: flamme.action)'])
    assert.ok(verrou.includes(k), k);
  assert.ok(entre(swift, 'struct DirectBas: View {', '\n}\n').includes('if moment == .attend {'), 'la barre et le bouton, seulement pendant le compte à rebours');
  const droite = entre(swift, 'struct DirectDroite: View {', '\n}\n');
  assert.ok(droite.includes('DirectCompte(flamme: flamme, taille: 14)') && droite.includes('"moon.fill"'), 'à droite de l’île : le chiffre ; minuit passé, la lune');
  /* Les règles du fichier (retours-1628, retours-1214) tiennent avec la nouvelle partie */
  const code = sansCommentaires(entre(swift, '// MARK: - Ta flamme en direct', '@main'));
  assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code));
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});

test('les images du chat qu’elle montre : en @2x et @3x, plus petites que la présentation (sinon iOS refuse de la démarrer)', () => {
  for (const n of ['ChatAllumette', 'ChatBravo', 'ChatDodo', 'ChatNoir']) {
    const dossier = path.join(CATALOGUE, n + '.imageset');
    const images = JSON.parse(fs.readFileSync(path.join(dossier, 'Contents.json'), 'utf8')).images.filter(i => i.filename);
    assert.deepEqual(images.map(i => i.scale).sort(), ['2x', '3x'], n);
    assert.deepEqual(fs.readdirSync(dossier).sort(), ['Contents.json', ...images.map(i => i.filename)].sort(), n + ' : pas de fichier en trop');
    const pts = {};
    for (const i of images) {
      const e = parseInt(i.scale, 10), [l, h] = dimensions(path.join(dossier, i.filename));
      assert.ok(l / e <= 160 && h / e <= 160, `${n} ${i.scale} : ${l / e} × ${h / e} points`);
      pts[i.scale] = [Math.round(l / e), Math.round(h / e)];
    }
    for (const k of [0, 1]) assert.ok(Math.abs(pts['2x'][k] - pts['3x'][k]) <= 1, n + ' : la même taille en points');
  }
});

test('le pont : programmer (iOS 26 à l’heure dite, sinon tout de suite), allumée, arrêter ; le soir passé retiré au lancement', () => {
  const noms = [...pont.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: CAPPluginReturnPromise\)/g)].map(x => x[1]);
  const i = noms.indexOf('flammeProgrammer');
  assert.deepEqual(noms.slice(i, i + 3), ['flammeProgrammer', 'flammeAllumee', 'flammeArreter']);
  for (const n of ['flammeProgrammer', 'flammeAllumee', 'flammeArreter']) {
    const f = entre(pont, `@objc func ${n}(_ call: CAPPluginCall) {`, '\n    }\n');
    assert.ok(f.includes('guard #available(iOS 16.2, *) else {') && f.includes('Task {') && f.includes('call.resolve('), n);
  }
  assert.ok(entre(pont, '@objc func flammeProgrammer(', '\n    }\n').includes('call.resolve(["ok": ok, "auto": RequeteFlammePont.auto, "jours": jours])'));
  const p = entre(pont, 'enum RequeteFlammePont {', '\n}\n');
  for (const k of ['if #available(iOS 26.0, *) {\n            return true\n        }\n        return false',
    'if a.activityState == .ended || a.activityState == .dismissed { continue }',
    'if let d = voulue, x.minuit > maintenant, garder(x, d.flamme, maintenant) {', 'await a.end(nil, dismissalPolicy: .immediate)',
    'guard ActivityAuthorizationInfo().areActivitiesEnabled else { return gardes.sorted() }',
    'let contenu = ActivityContent(state: RequeteFlammeDirect.ContentState(fait: false), staleDate: x.minuit)',
    'if x.debut <= maintenant {\n            guard d.nouvelle else { return false }',
    '_ = try Activity<RequeteFlammeDirect>.request(attributes: x, content: contenu, pushType: nil)',
    'guard #available(iOS 26.0, *) else { return false }',
    'let alerte = AlertConfiguration(title: titre, body: texte, sound: .default)',
    '_ = try Activity<RequeteFlammeDirect>.request(attributes: x, content: contenu, pushType: nil, style: .standard, alertConfiguration: alerte, start: x.debut)',
    'let fin = ActivityContent(state: RequeteFlammeDirect.ContentState(fait: true), staleDate: nil)',
    'await a.end(fin, dismissalPolicy: .after(maintenant.addingTimeInterval(15 * 60)))',
    'if discret || !commencee {',
    'for a in Activity<RequeteFlammeDirect>.activities where a.attributes.minuit <= maintenant {'])
    assert.ok(p.includes(k), k);
  assert.ok(p.indexOf('guard #available(iOS 26.0, *) else { return false }') < p.indexOf('start: x.debut'), 'programmée seulement à partir d’iOS 26');
  assert.ok(entre(p, 'static func garder(', '\n    }\n').includes('if x.debut <= maintenant { return true }\n        return x.debut == voulue.debut && x.titre == voulue.titre && x.action == voulue.action'));
  assert.ok(entre(pont, 'override public func load() {', '\n    }\n').includes('if #available(iOS 16.2, *) {\n            Task { await RequeteFlammePont.nettoyer() }\n        }'));
  const d = entre(pont, 'struct RequeteFlammeDemande {', '\n}\n');
  assert.ok(d.includes('flamme = RequeteFlammeDirect(jour: jour, debut: min(debut, minuit), minuit: minuit, titre: titre, action: action)'));
  assert.ok(d.includes('if let n = v as? NSNumber { return Date(timeIntervalSince1970: n.doubleValue / 1000) }'), 'les millisecondes de la page');
  const code = sansCommentaires(pont);
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées (pont)`);
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});

/* La page, dans un bac à sable : l’heure figée, un planning sans séance le jeudi ni le dimanche */
const ANNEE = 2026, MOIS = 10;   // novembre
const heure = (j, h, m = 0) => new Date(ANNEE, MOIS, j, h, m).getTime();
const page = ({ maintenant = heure(7, 12), actifs = [], rappel = '19:00', rappelOn = true, on = true, prochaine = 20, natif = true, auto = true, ok = true, stockage = {}, onboarded = true, ileEtat = null, rejet = false } = {}) => {
  const appels = [], minuteurs = [], vu = [], magasin = { ...stockage };
  if (on) magasin['requete-flamme-direct'] = '1';
  const C = {
    isNativePlatform: () => natif, getPlatform: () => 'ios', isPluginAvailable: n => n === 'RequeteWidget',
    nativePromise: (p, m, d) => {
      appels.push([m, ici(d)]);
      if (rejet) return Promise.reject(new Error('pas de méthode'));
      if (m === 'flammeProgrammer') return Promise.resolve({ ok, auto, jours: ok ? d.jours.filter(j => auto || j.debut <= x.maintenant).map(j => j.jour) : [] });
      return Promise.resolve(m === 'flammeArreter' ? { ok: true, auto, jours: [] } : undefined);
    },
  };
  const Fige = class extends Date { constructor(...a) { if (a.length) super(...a); else super(x.maintenant); } static now() { return x.maintenant; } };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ctx = vm.createContext({
    Date: Fige, JSON, Math, Promise, Set, Array, Number, String,
    localStorage: { getItem: k => (k in magasin ? magasin[k] : null), setItem: (k, v) => { magasin[k] = String(v); } },
    window: natif ? { Capacitor: C } : {}, navigator: {}, ileEtat,
    document: { visibilityState: 'visible', getElementById: () => ({ classList: { contains: () => false } }) },
    state: { onboarded },
    auj: () => { const d = new Fige(); d.setHours(0, 0, 0, 0); return d; },
    addJ: (d, n) => { const r = new Fige(d.getTime()); r.setDate(r.getDate() + n); r.setHours(0, 0, 0, 0); return r; },
    dstr: iso, debutPlan: () => '2026-10-26',
    jourRepos: (j, start) => !!start && j >= start && [0, 4].includes(new Date(j + 'T12:00').getDay()),
    jourActif: j => actifs.includes(j),
    rappelHeure: () => rappel, rappelOn: () => rappelOn, rappelMessage: d => ['🐛 Erreur 404', 'Motivation introuvable. On relance ? ' + d.getHours()],
    recommendedSession: () => (prochaine == null ? null : { id: prochaine }), minutesDe: ids => (ids[0] === 20 ? 3 : 6),
    isDefiId: id => typeof id === 'string', CHALLENGES: [{ id: 'af4', titre: 'Le meilleur client' }], allLessons: [{ id: 20, titre: 'LEFT JOIN' }], lessonNumAffiche: id => ({ 20: 4 })[id] ?? id,   // 13 novembre, 23 h 09 : le numéro du parcours, pas l’identifiant
    rappelAuto: ms => vu.push(['rappelAuto', ms]), renderCompte: () => vu.push(['renderCompte']), toast: (a, b, c) => vu.push(['toast', a, b, c || '']),
    setTimeout: (f, ms) => { minuteurs.push({ f, ms }); return minuteurs.length; }, clearTimeout: () => {},
  });
  vm.runInContext(entre(app, '/* ---------- Ta flamme en direct, jusqu’à minuit (la Live Activity de l’app iPhone) ----------', '/* ---------- Les widgets, dans Mon compte ----------'), ctx);
  const x = {
    ctx, appels, minuteurs, vu, magasin, maintenant,
    run: s => vm.runInContext(s, ctx),
    attendre: async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); },
  };
  return x;
};

test('les prochains soirs de séance : deux au plus, ni jour de repos ni flamme déjà allumée ; à l’heure du rappel, au plus tôt 18 h', () => {
  /* Samedi 7 novembre, midi : ce soir, puis lundi (dimanche est un jour de repos) */
  const x = page();
  const j = ici(x.run('flammeDirectJours()'));
  assert.deepEqual(j.map(e => e.jour), ['2026-11-07', '2026-11-09']);
  assert.deepEqual(j[0], { jour: '2026-11-07', debut: heure(7, 19), minuit: heure(8, 0), titre: 'Leçon 4 · LEFT JOIN', action: 'Leçon express · 3 min', nouvelle: true,
    alerteTitre: '🐛 Erreur 404', alerteTexte: 'Motivation introuvable. On relance ? 19' });
  assert.equal(j[1].debut, heure(9, 19));
  /* La flamme de ce soir déjà allumée : lundi et mardi */
  assert.deepEqual(ici(page({ actifs: ['2026-11-07'] }).run('flammeDirectJours()')).map(e => e.jour), ['2026-11-09', '2026-11-10']);
  /* Un rappel le matin : le compte à rebours à 18 h, avec son alerte à elle (le rappel du matin sonne, lui) */
  const m = ici(page({ rappel: '08:00' }).run('flammeDirectJours()'))[0];
  assert.equal(m.debut, heure(7, 18));
  assert.deepEqual([m.alerteTitre, m.alerteTexte], ['Ta flamme t’attend !', 'Il te reste jusqu’à minuit pour l’allumer.']);
  assert.equal(ici(page({ rappel: '21:30' }).run('flammeDirectJours()'))[0].debut, heure(7, 21, 30));
  /* Rappel coupé : son alerte à elle */
  assert.equal(ici(page({ rappelOn: false }).run('flammeDirectJours()'))[0].alerteTitre, 'Ta flamme t’attend !');
  /* Un défi ; tout est fait */
  assert.deepEqual(ici(page({ prochaine: 'af4' }).run('flammeDirectQuoi()')), { titre: 'Défi · Le meilleur client', action: 'Défi express · 6 min' });
  assert.deepEqual(ici(page({ prochaine: null }).run('flammeDirectQuoi()')), { titre: '', action: 'Allumer ma flamme' });
  /* Ce soir, l’heure passée : elle peut démarrer tout de suite, sauf si elle a déjà démarré ce soir (balayée) */
  assert.equal(ici(page({ maintenant: heure(7, 20) }).run('flammeDirectJours()'))[0].nouvelle, true);
  assert.equal(ici(page({ maintenant: heure(7, 20), stockage: { 'requete-flamme-lancees': '["2026-11-07"]' } }).run('flammeDirectJours()'))[0].nouvelle, false);
  assert.equal(ici(page({ stockage: { 'requete-flamme-lancees': '["2026-11-07"]' } }).run('flammeDirectJours()'))[0].nouvelle, true, 'programmée, pas encore commencée');
  /* Un jeudi (repos) à 21 h : rien ce soir */
  assert.deepEqual(ici(page({ maintenant: heure(12, 21) }).run('flammeDirectJours()')).map(e => e.jour), ['2026-11-13', '2026-11-14']);
});

test('la page la demande à l’iPhone, retient la réponse, et ne redemande que si quelque chose a changé', async () => {
  const x = page();
  x.run('flammeDirectSync()'); await x.attendre();
  assert.equal(x.appels.length, 1);
  assert.equal(x.appels[0][0], 'flammeProgrammer');
  assert.deepEqual(x.appels[0][1].jours.map(j => j.jour), ['2026-11-07', '2026-11-09']);
  assert.deepEqual(JSON.parse(x.magasin['requete-flamme-lancees']), ['2026-11-07', '2026-11-09']);
  assert.deepEqual(JSON.parse(x.magasin['requete-flamme-prevus']), [heure(7, 19), heure(9, 19)], 'les heures prises au rappel (iOS 26)');
  assert.deepEqual(JSON.parse(x.magasin['requete-flamme-etat']), { ok: true, auto: true });
  assert.deepEqual(x.vu, [['rappelAuto', 0]], 'le rappel de ces soirs se tait');
  assert.equal(x.run('flammeDirectCouvre(new Date(' + heure(7, 19) + '))'), true);
  assert.equal(x.run('flammeDirectCouvre(new Date(' + heure(8, 19) + '))'), false);
  /* Rien n’a changé : rien ne part */
  x.run('flammeDirectSync()'); await x.attendre();
  assert.equal(x.appels.length, 1);
  /* L’heure est venue (l’app ouverte ce soir) : on redemande ; la flamme déjà démarrée ce soir n’est pas relancée */
  x.maintenant = heure(7, 19, 5);
  x.run('flammeDirectSync()'); await x.attendre();
  assert.equal(x.appels.length, 2);
  assert.equal(x.appels[1][1].jours[0].nouvelle, false);
  /* Un rendez-vous à l’heure dite, l’app restée ouverte */
  const y = page();
  y.run('flammeDirectSync()');
  assert.ok(y.minuteurs.some(t => t.ms === heure(7, 19) - heure(7, 12) + 1000), 'à 19 h');
  /* Forcé (l’interrupteur) : même sans changement */
  x.run('flammeDirectSync(true)'); await x.attendre();
  assert.equal(x.appels.length, 3);
  /* Coupée : tout s’arrête, et le rappel reprend ces soirs-là */
  x.magasin['requete-flamme-direct'] = '0';
  x.run('flammeDirectSync()'); await x.attendre();
  assert.deepEqual(x.appels.at(-1), ['flammeArreter', {}]);
  assert.deepEqual(JSON.parse(x.magasin['requete-flamme-prevus']), []);
  assert.equal(x.run('flammeDirectCouvre(new Date(' + heure(9, 19) + '))'), false);
  /* Avant iOS 26 : rien de programmé d’avance, le rappel sonne */
  const z = page({ auto: false });
  z.run('flammeDirectSync()'); await z.attendre();
  assert.deepEqual(JSON.parse(z.magasin['requete-flamme-prevus']), []);
  /* Sur le web, ou sans le pont : rien */
  const w = page({ natif: false });
  w.run('flammeDirectSync(true)'); await w.attendre();
  assert.deepEqual(w.appels, []);
});

test('automatique : l’app à l’écran seulement, jamais pendant l’onboarding ; branchée sur rappelAuto, l’enregistrement du rappel', async () => {
  const x = page();
  x.run('flammeDirectAuto(400)');
  assert.equal(x.minuteurs.at(-1).ms, 500);
  x.ctx.document.visibilityState = 'hidden';
  x.minuteurs.at(-1).f(); await x.attendre();
  assert.deepEqual(x.appels, [], 'en arrière-plan, iOS refuserait');
  x.ctx.document.visibilityState = 'visible';
  x.minuteurs.at(-1).f(); await x.attendre();
  assert.equal(x.appels.length, 1);
  const o = page({ onboarded: false });
  o.run('flammeDirectAuto(0)'); o.minuteurs.at(-1).f(); await o.attendre();
  assert.deepEqual(o.appels, []);
  const auto = entre(app, 'function rappelAuto(ms){', '\n}\n');
  assert.ok(auto.includes("  try{\n    if(typeof flammeDirectAuto==='function')flammeDirectAuto(ms);"), 'à l’ouverture, au retour dans l’app, après chaque enregistrement');
  assert.ok(app.includes("  rappelNativeSync(true);\n  RP=null;\n  if(typeof flammeDirectAuto==='function')flammeDirectAuto(0);"), 'l’heure du rappel change');
});

test('la flamme allumée : « Flamme allumée ! » (discrète si la leçon est dans l’île), puis le reste est redemandé', async () => {
  const x = page();
  x.run("flammeDirectAllumee('2026-11-07')"); await x.attendre();
  assert.deepEqual(x.appels, [['flammeAllumee', { jour: '2026-11-07', discret: false }]]);
  assert.ok(x.minuteurs.length >= 1, 'puis les soirs suivants');
  const l = page({ ileEtat: { id: 12 } });
  l.run("flammeDirectAllumee('2026-11-07')"); await l.attendre();
  assert.deepEqual(l.appels, [['flammeAllumee', { jour: '2026-11-07', discret: true }]]);
  const c = page({ on: false });
  c.run("flammeDirectAllumee('2026-11-07')"); await c.attendre();
  assert.deepEqual(c.appels, [], 'coupée : rien');
  assert.ok(entre(app, 'function noteActivityDay(src){', '\n}\n').includes("if(first&&typeof flammeDirectAllumee==='function')flammeDirectAllumee(iso);"), 'la première activité du jour');
});

test('Mon compte : « Ta flamme en direct », un interrupteur dans « Sur ton iPhone », l’app seulement', async () => {
  const compte = entre(app, 'function renderCompte(){', '\nfunction ');
  const g = compte.slice(compte.indexOf('Sur ton iPhone</p>'), compte.indexOf('</section>', compte.indexOf('Sur ton iPhone</p>')));   // 13 novembre, 15 h 17 : le dernier groupe
  const ligne = '${widgetsIci?`<button class="account-setting-row acct-flamme-direct" type="button" role="switch" aria-checked="${flammeDirectOn()}" onclick="flammeDirectBasculer()"><span class="plus-row-icon is-stk">${lqStkSvg(\'flame\')}</span><span><b>Ta flamme en direct</b><small>${flammeDirectResume()}</small></span><span class="account-setting-end"><span class="acc-toggle${flammeDirectOn()?\' on\':\'\'}" aria-hidden="true"><i></i></span></span></button>`:\'\'}';
  assert.ok(g.includes(ligne), 'la ligne, avec son interrupteur');
  assert.ok(g.indexOf("openPlusDetails('plus-widget-verrou')") < g.indexOf('flammeDirectBasculer()'), 'après les widgets (« Évaluer » est partie le 11 novembre, 12 h 25)');
  /* Ce que dit la ligne */
  assert.equal(page({ on: false }).run('flammeDirectResume()'), 'Un compte à rebours jusqu’à minuit, les soirs de séance');
  assert.equal(page().run('flammeDirectResume()'), 'Activée · les soirs de séance, dès 19:00');
  assert.equal(page({ rappel: '08:00' }).run('flammeDirectResume()'), 'Activée · les soirs de séance, dès 18:00');
  assert.equal(page({ stockage: { 'requete-flamme-etat': '{"ok":false,"auto":true}' } }).run('flammeDirectResume()'), 'Activités en direct coupées dans les Réglages de l’iPhone');
  /* L’interrupteur : enregistré, demandé, et la bulle dit la suite */
  const x = page({ on: false });
  x.run('flammeDirectBasculer()'); await x.attendre();
  assert.equal(x.magasin['requete-flamme-direct'], '1');
  assert.equal(x.appels[0][0], 'flammeProgrammer');
  assert.deepEqual(x.vu.filter(v => v[0] === 'toast'), [['toast', 'Flamme en direct activée', 'Les soirs de séance, dès 19:00, si ta flamme n’est pas encore allumée.', '']]);
  x.run('flammeDirectBasculer()'); await x.attendre();
  assert.equal(x.magasin['requete-flamme-direct'], '0');
  assert.deepEqual(x.appels.at(-1), ['flammeArreter', {}]);
  assert.deepEqual(x.vu.filter(v => v[0] === 'toast').at(-1), ['toast', 'Flamme en direct désactivée', 'Tu pourras la réactiver ici.', '']);
  const k = page({ on: false, ok: false });
  k.run('flammeDirectBasculer()'); await k.attendre();
  assert.deepEqual(k.vu.filter(v => v[0] === 'toast'), [['toast', 'Activités en direct coupées', 'Autorise-les pour Requête dans les Réglages de l’iPhone.', 'info']]);
  const a = page({ on: false, auto: false });
  a.run('flammeDirectBasculer()'); await a.attendre();
  assert.equal(a.vu.filter(v => v[0] === 'toast')[0][2], 'Dès 19:00 les soirs de séance, quand tu ouvres l’app (toute seule avec iOS 26).');
  /* Une app d’avant, sans ce pont : l’interrupteur se remet sur « non » */
  const v = page({ on: false, rejet: true });
  v.run('flammeDirectBasculer()'); await v.attendre();
  assert.equal(v.magasin['requete-flamme-direct'], '0');
  assert.deepEqual(v.vu.filter(e => e[0] === 'toast'), [['toast', 'Flamme en direct indisponible', 'Mets l’app à jour pour l’activer.', 'info']]);
  /* Le compte supprimé : la flamme programmée part avec */
  assert.ok(entre(app, 'async function compteSupprimer(){', '\n}\n').includes("if(C)await C.nativePromise('RequeteWidget','flammeArreter',{});}catch(e){}"));
});

test('le rappel du même soir, à la même heure, ne sonne pas en plus : la Live Activity arrive avec son message', async () => {
  const rappel = entre(app, '/* Les jours du rappel (Elisa, 4 novembre, 11 h 08, réf. 2)', '/* Le rappel dans Mon compte (Elisa, 5 novembre, 12 h 12');
  const PATTERN = vm.runInNewContext('(' + entre(app, 'const PATTERN=', 'const JOURS=').replace('const PATTERN=', '').trim().replace(/;$/, '') + ')');
  const t = new Date(), J = n => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const pris = new Date(J(1).getFullYear(), J(1).getMonth(), J(1).getDate(), 19, 0).getTime();
  const poses = [];
  const ctx = vm.createContext({
    PATTERN, state: { onboarded: true, plan: { freq: 7, sessions: [1, 2, 3].map(n => ({ d: iso(J(n)), lessons: [n] })) } }, draft: {},
    document: { getElementById: () => null }, rappelOn: () => true, rappelHeure: () => '19:00', itemDone: () => false,
    window: { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: {
      cancel: async () => {}, checkPermissions: async () => ({ display: 'granted' }), schedule: async o => { poses.push(...o.notifications); } } } } },
    setTimeout, clearTimeout, flammeDirectCouvre: d => +d === pris, flammeDirectPrevus: () => [pris],
  });
  vm.runInContext(rappel.replace('const JOURS_NOMS=', 'var JOURS_NOMS='), ctx);
  vm.runInContext('rappelNativeSync()', ctx);
  for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r));
  assert.deepEqual(poses.map(n => iso(new Date(n.schedule.at))), [iso(J(2)), iso(J(3))], 'demain, la Live Activity programmée sonne à la place');
  assert.deepEqual(poses.map(n => n.id), [100, 101]);
  assert.ok(vm.runInContext('rappelSignature()', ctx).endsWith('|' + pris), 'la signature du rappel change avec les heures prises');
});

test('scripts/ios-widget.mjs : l’ancienne image sans échelle, restée dans ios/, s’en va', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'flamme-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), { recursive: true });
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), { recursive: true }); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
    fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'));
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), path.join(t, 'ios/App/App/Base.lproj/Main.storyboard'));
    const vieux = path.join(t, 'ios/App/RequeteWidget/Assets.xcassets/ChatAllumette.imageset');
    fs.mkdirSync(vieux, { recursive: true });
    fs.writeFileSync(path.join(vieux, 'chatAllumette.png'), 'avant');
    execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], { encoding: 'utf8' });
    assert.deepEqual(fs.readdirSync(vieux).sort(), ['Contents.json', 'chatAllumette@2x.png', 'chatAllumette@3x.png']);
    assert.ok(fs.existsSync(path.join(t, 'ios/App/RequeteWidget/Assets.xcassets/Mascotte.imageset/mascotte@3x.png')), 'le reste est là');
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
});

test('IOS.md : ta flamme en direct, pour la prochaine fois', () => {
  const c = entre(ios, '### Ta flamme en direct, jusqu’à minuit (7 novembre)', '\n### ');
  for (const k of ['RequeteFlammeDirecte', 'Mon compte › Sur ton iPhone › Ta flamme en direct', 'flammeProgrammer', 'À partir d’iOS 26', 'avant iOS 26',
    'start:', 'staleDate', 'isStale', 'rappelMessage', '@2x et @3x', 'Activités en direct', 'serveur'])
    assert.ok(c.includes(k), k);
  assert.ok(!/bientôt|prochainement/i.test(c));
});
