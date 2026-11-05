/* Elisa, 5 novembre, 6 h 45 (capture de la Dynamic Island : la flamme et « 7 % ») : « Dans la Dynamic Island, est-ce que tu peux
   animer, mettre le nombre de moments réussis 2/4 etc. »
   - À droite de la Dynamic Island : les moments « À toi » réussis du premier coup sur ceux de la leçon (« 2/4 »), comme l’écran de
     fin de la vidéo ; braise, puis menthe une fois l’objectif de la leçon atteint. Le pour cent reste avant que la vidéo ait donné ses
     moments, et la coche dorée à la fin.
   - Appui long et écran verrouillé : une case par moment (menthe et sa coche une fois réussi, le contour doré sur celle qui valide
     la leçon), « Moments réussis : 2/4 · encore 2 pour valider ».
   - L’animation : le compte n’avance dans la Dynamic Island que quand on quitte l’app ; elle apparaît avec l’ancien, et le nouveau
     arrive une seconde après (anime) : le chiffre roule (iOS 17), la case se remplit et sa coche se pose. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const widget = read('resources/ios/widget/RequeteWidget/RequeteWidget.swift'), pont = read('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const cut = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

test('le widget : « 2/4 » à droite de la Dynamic Island, le chiffre qui roule, braise puis menthe', () => {
  const v = cut(widget, 'struct LeconMoments: View {', '/// Une case de la jauge des moments');
  for (const k of ['let n: Int = etat.moments ?? 0', 'let r: Int = min(n, max(0, etat.reussis ?? 0))', 'let but: Int = min(n, max(1, etat.objectif ?? n))',
    'let teinte: Color = r >= but ? menthe : braise', 'if etat.fini || n <= 0 {\n                LeconPourcent(etat: etat)',
    'Text("\\(r)")\n                        .font(grand)\n                        .monospacedDigit()\n                        .chiffreQuiRoule(r)', 'Text("/\\(n)")\n                        .font(petit)'])
    assert.ok(v.includes(k), k);
  assert.ok(widget.includes('@available(iOS 16.1, *)\nstruct LeconMoments: View {'));
  assert.ok(widget.includes('} compactTrailing: {\n                LeconMoments(etat: context.state)\n            } minimal: {'));
  assert.ok(widget.includes('func chiffreQuiRoule(_ valeur: Int) -> some View {\n        if #available(iOSApplicationExtension 17.0, *) {\n            self.contentTransition(.numericText(value: Double(valeur)))'),
    'le chiffre roule (iOS 17), comme « 0/1 » dans le widget');
});

test('le widget : une case par moment, la coche qui se pose, le contour doré sur celle qui valide la leçon', () => {
  const c = cut(widget, 'struct LeconCase: View {', '/// Les moments de la leçon, une case par moment');
  for (const k of ['let fond: Color = pleine ? menthe : Color.white.opacity(0.22)', 'let contour: Color = objectif ? dore : Color.clear',
    'Image(systemName: "checkmark")', '.transition(.scale(scale: 0.2).combined(with: .opacity))', '.stroke(contour, lineWidth: 2)'])
    assert.ok(c.includes(k), k);
  const j = cut(widget, 'struct LeconJauge: View {', '/// L’avancement : la jauge des moments');
  assert.ok(j.includes('ForEach(0..<n, id: \\.self) { i in\n                LeconCase(pleine: i < r, objectif: i == but - 1)'));
  assert.ok(j.includes('let n: Int = min(12, max(0, etat.moments ?? 0))'), 'douze cases au plus');
  const a = cut(widget, 'struct LeconAvance: View {', '/// L’écran verrouillé');
  assert.ok(a.includes('if (etat.moments ?? 0) > 0 {\n            LeconJauge(etat: etat)\n        } else {\n            LeconBarre(progression: etat.fini ? 1 : etat.progression, fini: etat.fini)'));
  const act = cut(widget, 'struct RequeteLeconActivite: Widget {', '/// Le widget de la flamme, et la Live Activity');
  assert.ok(act.includes('VStack(spacing: 7) {\n                        LeconAvance(etat: context.state)'), 'appui long : la jauge');
  assert.ok(cut(widget, 'struct LeconVerrouille: View {', 'struct RequeteLeconActivite').includes('LeconAvance(etat: etat)\n                    .padding(.top, 2)'), 'écran verrouillé : la jauge');
  /* Les phrases, avec l’espace fine avant « : » et « ! » */
  const phrase = cut(widget, 'func leconPhrase(', '\n}\n');
  assert.ok(phrase.includes('return "Moments réussis\\u{202F}: \\(r)/\\(n) · encore \\(reste) pour valider"'));
  assert.ok(phrase.includes('if reste <= 0 { return "Moments réussis\\u{202F}: \\(r)/\\(n) · objectif atteint\\u{202F}!" }'));
  assert.ok(phrase.indexOf('if e.fini {') < phrase.indexOf('if n > 0 {'), 'la leçon réussie garde sa phrase');
});

test('le type de la Live Activity : trois champs de plus, facultatifs, les mêmes dans l’app et dans le widget', () => {
  const type = t => sansCommentaires(cut(t, 'struct RequeteLecon: ActivityAttributes {', '\n}\n')).replace(/\s+/g, ' ').trim();
  assert.equal(type(widget), type(pont));
  assert.ok(type(pont).includes('var fini: Bool var reussis: Int? = nil var moments: Int? = nil var objectif: Int? = nil }'),
    'facultatifs : une activité lancée par une version d’avant se lit encore');
});

test('le pont : les moments de la page, puis le nouveau compte une seconde après qu’on a quitté l’app', () => {
  const m = cut(pont, 'static func moments(_ etat: RequeteLecon.ContentState, _ call: CAPPluginCall) -> RequeteLecon.ContentState {', '\n    }\n');
  for (const k of ['guard let n = call.getInt("moments"), n > 0 else { return etat }', 'e.reussis = min(n, max(0, r))', 'e.objectif = min(n, max(1, but))'])
    assert.ok(m.includes(k), k);
  for (const n of ['leconDebut', 'leconMaj']) {
    const f = cut(pont, `@objc func ${n}(_ call: CAPPluginCall) {`, '\n    }\n');
    assert.ok(f.includes('let etat: RequeteLecon.ContentState = RequeteLeconPont.moments(base, call)'), n);
    assert.ok(!/\bvar /.test(f), `${n} : rien de modifiable n’entre dans la tâche`);
  }
  assert.ok(cut(pont, '@objc func leconMaj(_ call: CAPPluginCall) {', '\n    }\n').includes('let anime: Bool = call.getBool("anime") ?? false'));
  const maj = cut(pont, 'static func maj(_ etat: RequeteLecon.ContentState, anime: Bool) async {', '\n    }\n');
  for (const k of ['let fond = RequeteTacheDeFond()', 'if anime { fond.debut() }', 'let avant: Int? = a.content.state.reussis',
    'if anime, let ancien = avant, ancien != etat.reussis {', 'attente.reussis = ancien', 'try? await Task.sleep(nanoseconds: 1_100_000_000)',
    'await a.update(ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)))', 'if anime { fond.fin() }'])
    assert.ok(maj.includes(k), k);
  assert.ok(maj.indexOf('attente.reussis = ancien') < maj.indexOf('Task.sleep') && maj.indexOf('Task.sleep') < maj.lastIndexOf('state: etat,'), 'l’ancien compte, une seconde, puis le nouveau');
  const fond = cut(pont, 'final class RequeteTacheDeFond {', '\n}\n');
  for (const k of ['private var id: UIBackgroundTaskIdentifier = .invalid', 'self.id = UIApplication.shared.beginBackgroundTask(withName: "RequeteLecon") { [weak self] in',
    'UIApplication.shared.endBackgroundTask(self.id)', 'DispatchQueue.main.async {'])
    assert.ok(fond.includes(k), k);
  const fin = cut(pont, 'static func fin(reussie: Bool, allumee: Bool, reussis: Int?) async {', '\n    }\n');
  assert.ok(fin.includes('var bilan: RequeteLecon.ContentState = a.content.state') && fin.includes('if let r = reussis, let n = bilan.moments { bilan.reussis = min(n, max(0, r)) }'),
    'réussie : la carte garde ses moments');
  for (const t of [widget, pont]) {
    const code = sansCommentaires(t);
    for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées`);
  }
});

/* La page : la même suite que dans l’app, sur une leçon de quatre moments, validée avec trois */
const lab = () => {
  const appels = [], etat = {ok: 0};
  const ctx = vm.createContext({
    window: {Capacitor: {isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget', nativePromise: (p, m, d) => { appels.push([m, JSON.parse(JSON.stringify(d))]); return Promise.resolve(); }}},
    LV: {id: 12, fin: false, video: {currentTime: 0, duration: 100}},
    MODULES: [{titre: 'Bases'}, {titre: 'Les jointures'}], moduleDeLecon: () => null,
    jourActif: () => false, dstr: () => '2026-11-05', auj: () => 0,
    lvPkScore: (id, n) => Math.min(n, etat.ok), lvSeuil: l => (l && l.video && l.video.seuil) || 0
  });
  ctx.moduleDeLecon = () => ctx.MODULES[1];
  vm.runInContext(cut(html, '/* ---------- La Dynamic Island : la leçon en cours ----------', '/* ---------- Les raccourcis de l’icône de l’app iPhone ----------'), ctx);
  return {ctx, appels, etat};
};
const lecon = {id: 12, titre: 'INNER JOIN', video: {moments: 4, seuil: 3}};

test('la page : les moments partent dès que la vidéo les donne ; un moment réussi de plus, seulement quand on quitte l’app (anime)', () => {
  const {ctx, appels, etat} = lab();
  ctx.ileDebut(lecon);
  assert.deepEqual(appels.shift(), ['leconDebut', {titre: 'INNER JOIN', module: 'Module 2 · Les jointures', progression: 0, allumee: false}], 'la vidéo n’a pas encore donné ses moments');
  ctx.LV.video.picks = [{}, {}, {}, {}];
  ctx.ileMaj(false);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0, allumee: false, reussis: 0, moments: 4, objectif: 3}], 'les moments arrivent : tout de suite, même au même dixième');
  ctx.ileMaj(false);
  assert.equal(appels.length, 0, 'ensuite, par dixièmes, comme avant');
  /* Deux moments réussis dans l’app : la Dynamic Island n’est pas à l’écran, le compte attend */
  etat.ok = 2; ctx.LV.video.currentTime = 31; ctx.ileMaj(false);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0.31, allumee: false, reussis: 0, moments: 4, objectif: 3}], 'dans l’app : l’ancien compte');
  /* On quitte l’app : le nouveau compte, à animer */
  ctx.LV.video.currentTime = 33; ctx.ileMaj(true);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0.33, allumee: false, reussis: 2, moments: 4, objectif: 3, anime: true}]);
  ctx.ileMaj(true);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0.33, allumee: false, reussis: 2, moments: 4, objectif: 3}], 'rien de neuf : pas d’animation');
  ctx.LV.video.currentTime = 52; ctx.ileMaj(false);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0.52, allumee: false, reussis: 2, moments: 4, objectif: 3}], 'de retour dans l’app : le compte montré');
  /* Leçon réussie : la carte garde ses moments */
  etat.ok = 3; ctx.ileFin(true);
  assert.deepEqual(appels.shift(), ['leconFin', {fini: true, allumee: true, reussis: 3}]);
  assert.equal(appels.length, 0);
});

test('la page : une leçon reprise, ses moments déjà réussis montrés dès l’ouverture ; sans seuil, tous les moments', () => {
  const {ctx, appels, etat} = lab();
  ctx.LV.video.picks = [{}, {}, {}];
  etat.ok = 1;
  ctx.ileDebut({id: 12, titre: 'WHERE', video: {moments: 3}});
  assert.deepEqual(appels.shift(), ['leconDebut', {titre: 'WHERE', module: 'Module 2 · Les jointures', progression: 0, allumee: false, reussis: 1, moments: 3, objectif: 3}]);
  ctx.ileMaj(true);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0, allumee: false, reussis: 1, moments: 3, objectif: 3}], 'déjà montré : pas d’animation');
  /* Tout recommencer : le compte redescend, en roulant aussi */
  etat.ok = 0; ctx.ileMaj(true);
  assert.deepEqual(appels.shift(), ['leconMaj', {progression: 0, allumee: false, reussis: 0, moments: 3, objectif: 3, anime: true}]);
});

test('IOS.md décrit la Dynamic Island des moments et son animation', () => {
  const ios = read('IOS.md');
  assert.ok(ios.includes('« À toi » réussis à droite (« 2/4 », le « /4 » plus petit, braise puis menthe une fois l’objectif de la leçon atteint ; 5 novembre,'));
  assert.ok(ios.includes('- **l’animation** : le compte n’avance dans la Dynamic Island que quand on quitte l’app.'));
});
