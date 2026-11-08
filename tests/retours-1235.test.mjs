/* 4 novembre, 12 h 35 (Elisa, sur l’aperçu du widget) : « Pourquoi 12 ? Non, je veux que la flamme du jour ! À chaque fin de leçon,
   mettre une partie “Donne ton avis sur la leçon” avec des étoiles animées, et tu peux faire une Dynamic Island. »
   1. Le widget : la flamme du jour seule, sans nombre de jours.
   2. Le bilan de la leçon : « Donne ton avis sur la leçon », cinq étoiles animées ; la note part à la base de l’appli (lecon_noter).
   3. La Dynamic Island : la leçon en cours, en Live Activity (ActivityKit), lancée, suivie et arrêtée par la page. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), css = read('ludique.css');
const widget = read('resources/ios/widget/RequeteWidget/RequeteWidget.swift'), pont = read('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const cut = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const ESPACE = '\\' + 'u{202F}';   // l’espace fine insécable de Swift, avant « ! » et « % »
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

test('le widget : la flamme du jour seule, plus de nombre de jours', () => {
  const vue = cut(widget, 'struct SerieVue: View {', 'struct Bulle: Shape {');
  assert.ok(!/Text\("\\\(entree\.serie\)"\)/.test(widget), 'plus de nombre de jours (13 h 11 : la séance du jour, 0/1, à sa place ; retours-1311)');
  for (const k of ['private func flammeVue(_ w: CGFloat) -> some View {\n        ZStack(alignment: .bottomTrailing) {\n            Image(systemName: "flame.fill")',
    '.font(.system(size: w * 0.3, weight: .bold))', 'compteurVue(w)\n                .scaleEffect(humeur == .matin ? 0.55 : 1, anchor: .topLeading)'])
    assert.ok(vue.includes(k), k);
  assert.ok(widget.includes('.configurationDisplayName("Ta flamme")'), 'son nom dans la galerie');
  assert.ok(!vue.includes('entree.serie)') || vue.includes('entree.serie > 0 ?'), 'la série ne sert plus qu’à choisir la phrase du soir');
});

test('la Live Activity : le même type dans l’app et dans le widget, iOS les relie par son nom', () => {
  const type = t => sansCommentaires(cut(t, 'struct RequeteLecon: ActivityAttributes {', '\n}\n')).replace(/\s+/g, ' ').trim();
  assert.equal(type(widget), type(pont));
  /* 5 novembre, 6 h 45 : les moments réussis (« 2/4 »), facultatifs (une activité d’avant les ignore) ; retours-0645 */
  assert.ok(type(widget).includes('public struct ContentState: Codable, Hashable { var progression: Double var allumee: Bool var fini: Bool var reussis: Int? = nil var moments: Int? = nil var objectif: Int? = nil } var titre: String var module: String'));
  for (const t of [widget, pont]) {
    assert.ok(t.includes('import ActivityKit\n'));
    assert.ok(t.includes('@available(iOS 16.1, *)\nstruct RequeteLecon: ActivityAttributes {'), 'iOS 16.1 : l’app reste installable en iOS 15');
  }
});

test('la Live Activity dans le widget : l’écran verrouillé, la Dynamic Island (étendue, compacte, minimale), le paquet', () => {
  const act = cut(widget, 'struct RequeteLeconActivite: Widget {', '/// Le widget de la flamme, et la Live Activity');
  for (const k of ['ActivityConfiguration(for: RequeteLecon.self) { context in', 'LeconVerrouille(lecon: context.attributes, etat: context.state)',
    '.activityBackgroundTint(violetTexte)', '} dynamicIsland: { context in', 'DynamicIsland {',
    'DynamicIslandExpandedRegion(.leading) {', 'DynamicIslandExpandedRegion(.trailing) {', 'DynamicIslandExpandedRegion(.center) {', 'DynamicIslandExpandedRegion(.bottom) {',
    /* 7 novembre (« Cheminée + lunettes ») : à gauche et en tout petit, les lunettes du chat ; appui long, le chat qui sort du noir
       (ios-cheminee.test.mjs) */
    '} compactLeading: {\n                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 30)', '} compactTrailing: {\n                LeconMoments(etat: context.state)', '} minimal: {\n                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 24)',
    '.keylineTint(braise)', 'Image("ChatNoir")'])
    assert.ok(act.includes(k), k);
  for (const k of ['@available(iOS 16.1, *)\nstruct RequeteLeconActivite: Widget {', '@available(iOS 16.1, *)\nstruct LeconVerrouille: View {',
    '@available(iOS 16.1, *)\nstruct LeconFlamme: View {', '@available(iOS 16.1, *)\nfunc leconPhrase(_ e: RequeteLecon.ContentState) -> String {',
    '@main\nstruct RequeteWidgets: WidgetBundle {\n    var body: some Widget {\n        RequeteWidget()\n        RequeteCheminee()\n        RequeteSemaine()\n        if #available(iOS 16.1, *) {\n            RequeteLeconActivite()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteFlammeVerrou()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteFlammeDirecte()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteSalleIle()\n        }\n        if #available(iOS 17.0, *) {\n            RequetePoche()\n        }\n        if #available(iOS 17.0, *) {\n            RequeteCarte()\n        }\n    }\n}'])   // 6 novembre, 0 h 40 : la flamme de l’écran verrouillé rejoint le paquet (retours-0040)
    assert.ok(widget.includes(k), k);
  /* Les phrases : l’espace fine avant « ! » et « % » */
  const phrase = cut(widget, 'func leconPhrase(', '\n}\n');
  assert.ok(phrase.includes(`"Leçon terminée${ESPACE}! Ta flamme du jour est allumée."`));
  assert.ok(phrase.includes(`"\\(pct)${ESPACE}% de la leçon" : "\\(pct)${ESPACE}% · termine-la pour allumer ta flamme"`));
  /* La flamme : dorée allumée, braise sinon ; l’anneau et la barre dorés à la fin */
  assert.ok(widget.includes('.foregroundColor(etat.fini || etat.allumee ? dore : braise)'));
  assert.ok(widget.includes('let teinte: Color = etat.fini ? dore : braise') && widget.includes('.fill(fini ? dore : Color.white)'), 'le pour cent braise, la coche dorée (17 h 27) ; la barre dorée à la fin');
  const code = sansCommentaires(widget);
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées (widget)`);
});

test('le pont : leconDebut, leconMaj, leconFin (iOS 16.2), et rien de resté à la relance de l’app', () => {
  const noms = [...pont.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: CAPPluginReturnPromise\)/g)].map(m => m[1]);
  assert.deepEqual(noms, ['maj', 'raccourcis', 'fond', 'leconDebut', 'leconMaj', 'leconFin', 'partager', 'ouvrir', 'flammeProgrammer', 'flammeAllumee', 'flammeArreter',
    'salleDebut', 'salleMaj', 'salleFin', 'partagerTexte'],
    'partager et ouvrir : la sauvegarde et « Noter Requête » (4 novembre, 22 h 08) ; puis ta flamme en direct (7 novembre, ios-flamme-direct) et la salle dans l’île (ios-salle-ile)');
  const classe = cut(pont, 'public class RequeteWidgetPlugin: CAPPlugin, CAPBridgedPlugin {', '\n}\n');
  for (const n of noms) assert.ok(classe.includes(`@objc func ${n}(_ call: CAPPluginCall) {`), `${n} dans la classe`);
  for (const n of ['leconDebut', 'leconMaj', 'leconFin']) {
    const f = cut(pont, `@objc func ${n}(_ call: CAPPluginCall) {`, '\n    }\n');
    assert.ok(f.includes('guard #available(iOS 16.2, *) else {') && f.includes('Task {') && f.includes('call.resolve('), n);
  }
  const p = cut(pont, 'enum RequeteLeconPont {', '\n}\n');
  for (const k of ['guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }', 'try Activity<RequeteLecon>.request(',
    'content: ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600))', 'pushType: nil',
    'await a.update(ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)))',
    'let politique: ActivityUIDismissalPolicy = reussie ? .after(Date().addingTimeInterval(15 * 60)) : .immediate',
    'await a.end(dernier, dismissalPolicy: politique)',
    'await a.end(nil, dismissalPolicy: .immediate)', 'await toutArreter()'])
    assert.ok(p.includes(k), k);
  assert.ok(pont.includes('@available(iOS 16.2, *)\nenum RequeteLeconPont {'));
  assert.ok(cut(pont, 'override public func load() {', '\n    }\n').includes('if #available(iOS 16.2, *) {\n            Task { await RequeteLeconPont.arreterEnCours() }\n        }'));
  assert.ok(p.includes('for a in Activity<RequeteLecon>.activities where !a.content.state.fini {'), 'la relance garde la carte d’une leçon réussie');
  const code = sansCommentaires(pont);
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées (pont)`);
});

test('scripts/ios-widget.mjs : NSSupportsLiveActivities ajouté une fois à l’Info.plist de l’app', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'ile-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts')); fs.mkdirSync(path.join(t, 'resources/ios'), {recursive: true});
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), {recursive: true}); fs.mkdirSync(path.join(t, 'ios/App/App/Base.lproj'), {recursive: true});
    fs.copyFileSync(path.join(ROOT, 'scripts/ios-widget.mjs'), path.join(t, 'scripts/ios-widget.mjs'));
    fs.cpSync(path.join(ROOT, 'resources/ios/widget'), path.join(t, 'resources/ios/widget'), {recursive: true});
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/project.pbxproj'), path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'));
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/ios-capacitor/Main.storyboard'), path.join(t, 'ios/App/App/Base.lproj/Main.storyboard'));
    const info = path.join(t, 'ios/App/App/Info.plist');
    const avant = '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>\n\t<key>UISupportedInterfaceOrientations</key>\n\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>\n\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<false/>\n\t</dict>\n</dict>\n</plist>\n';
    fs.writeFileSync(info, avant);
    execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8'});
    const apres = fs.readFileSync(info, 'utf8');
    assert.equal(apres, avant.replace('\t</dict>\n</dict>\n</plist>\n', '\t</dict>\n\t<key>NSSupportsLiveActivities</key>\n\t<true/>\n\t<key>NSCameraUsageDescription</key>\n\t<string>Pour joindre une photo à ton message dans « Contacte-nous ».</string>\n\t<key>NSPhotoLibraryUsageDescription</key>\n\t<string>Pour joindre une capture d’écran à ton message dans « Contacte-nous ».</string>\n'
      + '\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>fr.requete.app</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>requete</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n'),
      'dans le dictionnaire principal, pas dans le dernier sous-dictionnaire ; puis l’appareil photo et les photos (4 novembre, 22 h 08), puis le schéma « requete » du widget La cheminée (7 novembre)');
    execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8'});
    assert.equal(fs.readFileSync(info, 'utf8'), apres, 'relancé : une seule fois');
    /* Une Info.plist illisible n’est pas touchée */
    fs.writeFileSync(info, 'pas un plist');
    const r = execFileSync('node', [path.join(t, 'scripts/ios-widget.mjs')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    assert.equal(fs.readFileSync(info, 'utf8'), 'pas un plist');
    assert.equal(typeof r, 'string');
  } finally { fs.rmSync(t, {recursive: true, force: true}); }
});

/* La page : la Dynamic Island suit la leçon */
const ileLab = ({natif = true, allumee = true} = {}) => {
  const appels = [];
  const ctx = vm.createContext({
    window: natif ? {Capacitor: {isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget', nativePromise: (p, m, d) => { appels.push([p, m, JSON.parse(JSON.stringify(d))]); return Promise.resolve(); }}} : {},
    LV: {id: 12, fin: false, video: {currentTime: 0, duration: 100}},
    MODULES: [{titre: 'Bases'}, {titre: 'Les jointures'}], moduleDeLecon: () => null,
    jourActif: () => allumee, dstr: () => '2026-11-04', auj: () => 0
  });
  ctx.moduleDeLecon = () => ctx.MODULES[1];
  vm.runInContext(cut(html, '/* ---------- La Dynamic Island : la leçon en cours ----------', '/* ---------- Les raccourcis de l’icône de l’app iPhone ----------'), ctx);
  return {ctx, appels};
};

test('la page lance la Live Activity à l’ouverture de la leçon, la suit par dixièmes, l’arrête à la fin', () => {
  const {ctx, appels} = ileLab({allumee: false});
  ctx.ileDebut({id: 12, titre: 'INNER JOIN'});
  assert.deepEqual(appels.shift(), ['RequeteWidget', 'leconDebut', {titre: 'INNER JOIN', module: 'Module 2 · Les jointures', progression: 0, allumee: false}]);
  ctx.LV.video.currentTime = 5; ctx.ileMaj(false);
  assert.deepEqual(appels.shift(), ['RequeteWidget', 'leconMaj', {progression: 0.05, allumee: false}], 'le premier dixième');
  ctx.LV.video.currentTime = 8; ctx.ileMaj(false);
  assert.equal(appels.length, 0, 'même dixième : rien');
  ctx.LV.video.currentTime = 12; ctx.ileMaj(false);
  assert.deepEqual(appels.shift(), ['RequeteWidget', 'leconMaj', {progression: 0.12, allumee: false}]);
  ctx.LV.video.currentTime = 13; ctx.ileMaj(true);
  assert.deepEqual(appels.shift(), ['RequeteWidget', 'leconMaj', {progression: 0.13, allumee: false}], 'on quitte l’app : tout de suite');
  ctx.LV.id = 99; ctx.ileMaj(true);
  assert.equal(appels.length, 0, 'une autre leçon : rien');
  ctx.LV.id = 12; ctx.LV.fin = true; ctx.ileMaj(true);
  assert.equal(appels.length, 0, 'la vidéo de fin du parcours : rien');
  ctx.ileFin(true);
  assert.deepEqual(appels.shift(), ['RequeteWidget', 'leconFin', {fini: true, allumee: true}], 'réussie : la flamme s’allume');
  ctx.ileFin(false); ctx.ileMaj(true);
  assert.equal(appels.length, 0, 'une seule fin');
  /* Fermée avant la fin */
  ctx.LV.fin = false; ctx.ileDebut({id: 12, titre: 'INNER JOIN'}); appels.length = 0;
  ctx.ileFin(false);
  assert.deepEqual(appels, [['RequeteWidget', 'leconFin', {fini: false, allumee: false}]]);
  /* Vidéo sans durée connue : 0 */
  ctx.LV.video = {currentTime: 3, duration: NaN}; assert.equal(ctx.ileProgression(), 0);
});

test('sans le pont natif (Safari, ancienne app) : rien', () => {
  const {ctx, appels} = ileLab({natif: false});
  ctx.ileDebut({id: 12, titre: 'INNER JOIN'}); ctx.ileMaj(true); ctx.ileFin(true);
  assert.equal(appels.length, 0);
});

test('les branchements dans le lecteur de la leçon', () => {
  assert.ok(html.includes("  if(typeof obBarreEtat==='function')obBarreEtat(true);\n  /* La leçon dans la Dynamic Island (pas la vidéo de fin du parcours) */\n  if(!fin)ileDebut(l);"));
  assert.ok(html.includes('    lvNoteSync(); lvCapSync(); ileMaj(false);'), 'à chaque avancée de la vidéo (par dixièmes)');
  assert.ok(html.includes('function lvHidden(){ if(!LV)return; if(document.hidden){ LV.video.pause(); ileMaj(true); }'), 'on quitte l’app');
  const fin = cut(html, 'function lvEnded(){', '\n}\n');
  assert.ok(fin.indexOf('if(win)ileFin(true);') > fin.indexOf('const win=') && fin.indexOf('if(win)ileFin(true);') < fin.indexOf('if(win&&current.video&&current.video.finale){'), 'avant la vidéo de fin');
  assert.ok(html.includes('function closeLessonVideo(instant){\n  if(!LV)return;\n  ileFin(false);'));
});

/* La page : l’avis sur la leçon */
const avisLab = ({reduit = false, rpc} = {}) => {
  const buzz = [], envois = [];
  const ctx = vm.createContext({
    state: {avis: {}}, saves: 0, setTimeout, Promise,
    esc: s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]),
    buzz: t => buzz.push(t), prefersReduceMotion: () => reduit, clsCle: () => 'K'.repeat(32),
    allLessons: [{id: 12, titre: 'Les jointures'}, {id: 7, titre: 'SELECT'}],
    document: {createElement: () => ({className: '', style: {}, setAttribute() {}, remove() {}})},
    clsRpc: (fn, body) => { envois.push([fn, JSON.parse(JSON.stringify(body))]); return rpc ? rpc(body) : Promise.resolve({ok: true}); }
  });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(cut(html, '/* ---------- L’avis sur la leçon ----------', '/* ---------- Blocs de cours enrichis (réutilisables) ---------- */'), ctx);
  return {ctx, buzz, envois};
};
const faux = () => {
  const classes = () => { const s = new Set(); return {add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, on) => { if (on) s.add(c); else s.delete(c); }, contains: c => s.has(c)}; };
  const stars = [1, 2, 3, 4, 5].map(i => ({i, classList: classes(), offsetWidth: 54, enfants: [], appendChild(x) { this.enfants.push(x); }}));
  const mot = {textContent: '', classList: classes()}, sub = {textContent: ''};
  const box = {dataset: {lecon: '12'}, classList: classes(), querySelectorAll: s => s === '.av-star' ? stars : [], querySelector: s => s === '.av-mot' ? mot : s === '.av-sub' ? sub : null};
  const radio = n => ({type: 'radio', value: String(n), closest: s => s === '.bravo-avis' ? box : s === '.av-star' ? stars[n - 1] : null});
  return {stars, mot, sub, box, radio};
};

test('le bilan : « Donne ton avis sur la leçon », cinq étoiles en boutons radio, avant la séance suivante', () => {
  assert.ok(html.includes('      ${bravoUnlockHtml(l)}\n      ${bravoAvisHtml(l)}\n      ${bravoNextHtml(l)}\n      ${bravoActionsHtml(l)}'));
  const {ctx} = avisLab();
  const h = ctx.bravoAvisHtml({id: 12, titre: 'Les jointures'});
  assert.ok(h.includes('<h2 class="av-h" id="av-h-12">Donne ton avis sur la leçon</h2>'));
  assert.ok(h.includes('<p class="av-sub">Elle t’a plu&nbsp;? Touche une étoile.</p>'));
  assert.ok(h.includes('<div class="av-stars" role="radiogroup" aria-labelledby="av-h-12" onchange="avisNoter(event)">'));
  assert.equal(h.match(/<input type="radio" name="av-12" value="\d"/g).length, 5);
  assert.ok(h.includes('aria-label="1 étoile sur 5"') && h.includes('aria-label="5 étoiles sur 5"'));
  assert.ok(!h.includes(' checked') && !h.includes('av-star on') && !h.includes('is-rated'));
  assert.ok(h.includes('<p class="av-mot is-hint" aria-live="polite">Ton avis reste anonyme.</p>'), 'la place du mot, sans trou : l’avis est anonyme');
  /* Déjà noté : ses étoiles, son mot, et le merci */
  ctx.state.avis = {12: {n: 4, le: 1, envoye: true}};
  const n = ctx.bravoAvisHtml({id: 12, titre: 'Les jointures'});
  assert.equal((n.match(/class="av-star on"/g) || []).length, 4);
  assert.ok(n.includes('value="4" checked') && n.includes('class="bravo-avis is-rated"') && n.includes('<p class="av-mot" aria-live="polite">😀 Très bien</p>'));
  assert.ok(n.includes('Merci ! On est ravis qu’elle t’ait plu.'));
});

test('toucher une étoile : la note gardée, les étoiles remplies une à une, les étincelles, le mot, puis l’envoi', async () => {
  const {ctx, buzz, envois} = avisLab();
  const f = faux();
  f.mot.classList.add('is-hint');
  ctx.avisNoter({target: f.radio(4)});
  assert.equal(ctx.state.avis[12].n, 4);
  assert.deepEqual(f.stars.map(s => s.classList.contains('on')), [true, true, true, true, false]);
  assert.deepEqual(f.stars.map(s => s.classList.contains('pop')), [true, true, true, true, false], 'le rebond, relancé');
  assert.equal(f.stars[3].enfants.length, 8, 'les étincelles de l’étoile touchée');
  assert.equal(f.mot.textContent, '😀 Très bien'); assert.ok(f.mot.classList.contains('in') && !f.mot.classList.contains('is-hint'), 'le mot prend la place de « anonyme »');
  assert.equal(f.sub.textContent, 'Merci ! On est ravis qu’elle t’ait plu.');
  assert.ok(f.box.classList.contains('is-rated')); assert.deepEqual(buzz, ['success']);
  assert.deepEqual(envois[0], ['lecon_noter', {p_cle: 'K'.repeat(32), p_lecon: 12, p_note: 4, p_titre: 'Les jointures', p_commentaire: null}]);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(ctx.state.avis[12].envoye, true, 'parti');
  /* Changer d’avis : 2 étoiles */
  ctx.avisNoter({target: f.radio(2)});
  assert.deepEqual(f.stars.map(s => s.classList.contains('on')), [true, true, false, false, false]);
  assert.equal(f.sub.textContent, 'Merci ! Ton avis nous aide à améliorer les cours.');
  assert.equal(f.mot.textContent, '😐 Bof'); assert.deepEqual(buzz, ['success', 'light']);
  assert.equal(ctx.state.avis[12].envoye, false); assert.equal(envois[1][1].p_note, 2);
  /* Une valeur qui n’est pas une note : rien */
  ctx.avisNoter({target: {...f.radio(2), value: '9'}}); ctx.avisNoter({target: {type: 'checkbox'}});
  assert.equal(envois.length, 2);
});

test('mouvement réduit : pas d’étincelles ; hors ligne : la note attend, puis repart avec les autres', async () => {
  const r = avisLab({reduit: true});
  const f = faux();
  r.ctx.avisNoter({target: f.radio(5)});
  assert.equal(f.stars[4].enfants.length, 0);
  let enLigne = false;
  const {ctx, envois} = avisLab({rpc: () => enLigne ? Promise.resolve({ok: true}) : Promise.reject(new Error('hors ligne'))});
  ctx.state.avis = {12: {n: 3, le: 1, envoye: false}, 7: {n: 5, le: 2, envoye: false}};
  assert.equal(await ctx.avisEnvoyer(), false);
  assert.equal(ctx.state.avis[12].envoye, false);
  enLigne = true;
  assert.equal(await ctx.avisEnvoyer(), true);
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  assert.equal(ctx.state.avis[12].envoye, true); assert.equal(ctx.state.avis[7].envoye, true, 'les deux, l’une après l’autre');
  assert.deepEqual(envois.map(e => e[1].p_lecon), [7, 7, 12], 'l’essai hors ligne, puis l’une après l’autre (les clés numériques dans l’ordre)');
  assert.ok(html.includes("window.addEventListener('online',()=>{try{avisEnvoyer();}catch(e){}});"), 'au retour du réseau');
});

test('la note se garde dans la progression (normalizeState), sans rien d’autre', () => {
  const ctx = vm.createContext({psForme: s => s});
  vm.runInContext(cut(html, 'function normalizeState(raw){', '/* Un nombre écrit en texte'), ctx);
  const s = ctx.normalizeState({avis: {12: {n: 4, le: 1730000000000, envoye: false}, 7: {n: 5, le: 'x'}, 3: {n: 9}, abc: {n: 3}, 8: 'mauvais', 9: {n: 2.7, envoye: true}}});
  assert.deepEqual(JSON.parse(JSON.stringify(s.avis)), {7: {n: 5, le: 0, envoye: true}, 9: {n: 2, le: 0, envoye: true}, 12: {n: 4, le: 1730000000000, envoye: false}});
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.normalizeState({}).avis)), {});
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.normalizeState({avis: [1, 2]}).avis)), {});
});

test('les étoiles en CSS : la fiche du bilan, leur arrivée, leur ondulation, le rebond, les étincelles, et le mouvement réduit', () => {
  assert.ok(html.includes('<link rel="stylesheet" href="ludique.css?v=243">'));
  for (const k of ['html.lq #scr-lesson .bravo-avis{', 'html.lq #scr-lesson .bravo-avis .av-star.on path{fill:var(--sun);stroke:var(--sun-lip)}',
    'html.lq #scr-lesson .bravo-avis .av-star input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    'html.lq #scr-lesson .bravo-avis .av-star{animation:avStarIn .5s var(--pop) calc(.42s + var(--i) * .07s) backwards}',
    'html.lq #scr-lesson .bravo-avis:not(.is-rated) .av-star svg{animation:avWave', 'html.lq #scr-lesson .bravo-avis .av-star.pop svg{animation:avPop',
    '@keyframes avSpark{', '@media (prefers-reduced-motion:reduce){html.lq #scr-lesson .bravo-avis :is(.av-star,.av-star svg,.av-mot,.av-spark,.av-com-champ,.av-com-merci),html.lq #scr-lesson .bravo-avis{animation:none!important}}',
    'html[data-motion="reduce"].lq #scr-lesson .bravo-avis :is(.av-star,.av-star svg,.av-mot,.av-spark,.av-com-champ,.av-com-merci)'])
    assert.ok(css.includes(k), k);
  for (const k of ['avStarIn', 'avWave', 'avPop', 'avMotIn', 'avSpark']) assert.ok(css.includes(`@keyframes ${k}{`), k);
});

test('la base de l’appli : lecon_noter, un avis par appareil et par leçon, rien de lisible pour l’appli', () => {
  const sql = read('supabase/migrations/20261104160655_avis_lecon.sql');
  for (const k of ['create table if not exists public.avis_lecon (', 'primary key (cle, lecon)', 'note smallint not null check (note between 1 and 5)',
    'alter table public.avis_lecon enable row level security;', 'revoke all on public.avis_lecon from public, anon, authenticated;',
    'create or replace function public.lecon_noter(p_cle text, p_lecon integer, p_note integer, p_titre text default null, p_commentaire text default null)', 'security definer', "set search_path = ''",
    'v_cle text := public.jeu_cle(p_cle);', "if (select count(*) from public.avis_lecon where note_le > now() - interval '1 hour') >= 5000 then",
    'on conflict (cle, lecon) do update set note = excluded.note', 'grant execute on function public.lecon_noter(text, integer, integer, text, text) to anon, authenticated;',
    'create or replace view public.avis_lecons with (security_invoker = true) as', 'revoke all on public.avis_lecons from public, anon, authenticated;'])
    assert.ok(sql.includes(k), k);
  /* La page appelle la fonction par ces noms */
  assert.ok(html.includes("clsRpc('lecon_noter',{p_cle:clsCle(),p_lecon:+id,p_note:n,p_titre:l?String(l.titre||'').slice(0,120):null,p_commentaire:c||null})"));
});

test('le guide iOS : la flamme seule, la Dynamic Island', () => {
  const ios = read('IOS.md');
  assert.ok(ios.includes('### La leçon dans la Dynamic Island (4 novembre, 12 h 35)') && ios.includes('`NSSupportsLiveActivities`'));
  assert.ok(ios.includes('le widget n’affiche plus de nombre de jours, seulement la flamme'));
});
