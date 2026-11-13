/* Elisa, 7 novembre, 20 h 16 (« Oui », pour la planche « Ta salle vit dans l’île » : « Une seule activité, du code de la salle
   jusqu’au podium. Tu pars envoyer le code sur WhatsApp : tu vois tes amis arriver. ») : une Live Activity par salle entre amis.
   La page la lance et la tient à jour (ileSalle…), le pont la dessine et demande son jeton de push (salleDebut), le serveur la
   met à jour l’app fermée (migration salle_dans_l_ile, fonction jeu-ile vers Apple). Pas de compilateur Swift ici : les tests
   lisent le code ; la page et la fonction tournent dans un bac à sable. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {etatPropre, alertePropre, chargeApns, pousserUn, createIleHandler, PROD, BAC} from '../supabase/functions/jeu-ile/handler.mjs';
import {jetonApns} from '../supabase/functions/jeu-ile/apns.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const ios = lire('IOS.md');
const migration = lire('supabase/migrations/20261107193840_salle_dans_l_ile.sql');
const FINE = '\\' + 'u{202F}';
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const sansCommentaires = t => t.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
const ici = x => JSON.parse(JSON.stringify(x));

test('les mêmes types dans l’app et dans le widget, et l’état que le serveur reconstruit a les mêmes clés', () => {
  const type = (t, d) => sansCommentaires(entre(t, d, '\n}\n')).replace(/\s+/g, ' ').trim();
  for (const d of ['struct RequeteSalle: ActivityAttributes {', 'struct JoueurSalle: Codable, Hashable {']) assert.equal(type(swift, d), type(pont, d), d);
  const s = type(swift, 'struct RequeteSalle: ActivityAttributes {');
  assert.equal(s, 'struct RequeteSalle: ActivityAttributes { public struct ContentState: Codable, Hashable { var phase: String var joueurs: [JoueurSalle] var hote: String var manche: Int var nb: Int var defi: String var fin: Double var nouveau: String } var code: String var moi: String var max: Int');
  assert.equal(type(swift, 'struct JoueurSalle: Codable, Hashable {'), 'struct JoueurSalle: Codable, Hashable { var p: String var n: String var pts: Int var r: Int var ok: Bool');
  /* Le JSON du serveur : exactement ces clés, dans cet ordre (sinon iOS ne décode pas la mise à jour) */
  const e = etatPropre({phase: 'partie', joueurs: [{p: 'abcd1234', n: '@lea', pts: 240, r: 1, ok: true}], hote: 'abcd1234', manche: 1, nb: 3, defi: 'Le meilleur client', fin: 1000, nouveau: ''}, 1000);
  assert.deepEqual(Object.keys(e), ['phase', 'joueurs', 'hote', 'manche', 'nb', 'defi', 'fin', 'nouveau']);
  assert.deepEqual(Object.keys(e.joueurs[0]), ['p', 'n', 'pts', 'r', 'ok']);
  for (const t of [swift, pont]) assert.ok(t.includes('@available(iOS 16.1, *)\nstruct RequeteSalle: ActivityAttributes {'));
});

test('le widget : l’île (ouverte, compacte, minimale), l’écran verrouillé, les boutons de l’hôte, le paquet', () => {
  const act = entre(swift, 'struct RequeteSalleIle: Widget {', '/// Le widget de la flamme, et la Live Activity');
  for (const k of ['ActivityConfiguration(for: RequeteSalle.self) { context in', 'SalleVerrouille(salle: context.attributes, etat: context.state)',
    'DynamicIslandExpandedRegion(.leading) {\n                    SalleGauche(', 'DynamicIslandExpandedRegion(.trailing) {\n                    SalleTemps(',
    'DynamicIslandExpandedRegion(.center) {\n                    SalleCentre(', 'DynamicIslandExpandedRegion(.bottom) {\n                    SalleBas(',
    '} compactLeading: {\n                LunettesChat(regard: LectureSalle.regard(context.state, context.attributes), largeur: 30)',
    '} compactTrailing: {\n                SalleDroite(', '} minimal: {\n                SalleMinimale(', '.keylineTint(braise)'])
    assert.ok(act.includes(k), k);
  assert.ok(swift.includes('        if #available(iOS 16.1, *) {\n            RequeteFlammeDirecte()\n        }\n        if #available(iOS 16.1, *) {\n            RequeteSalleIle()\n        }'), 'le paquet');
  /* Les boutons : des liens vers la salle, construits par morceaux ; pour l’hôte seulement */
  assert.ok(swift.includes('func lienSalle(_ action: String) -> URL {\n    var c = URLComponents()\n    c.scheme = "requete"\n    c.host = action'));
  assert.ok(entre(swift, 'struct BoutonSalle: View {', '\n}\n').includes('return Link(destination: lienSalle(action)) {'));
  const bas = entre(swift, 'struct SalleBas: View {', '\n}\n');
  for (const k of ['if etat.phase == "attente" && hote {', 'BoutonSalle(texte: "Partager", action: "salle-partager", plein: false)',
    'BoutonSalle(texte: "Lancer", action: "salle-lancer", plein: true)', 'BoutonSalle(texte: LectureSalle.rejouer(etat, salle), action: "salle-rejouer", plein: true)'])
    assert.ok(bas.includes(k), k);
  const verrou = entre(swift, 'struct SalleVerrouille: View {', '\n}\n\n@available');
  assert.ok(verrou.includes('if hote && etat.phase == "attente" {') && verrou.includes('if hote && etat.phase == "fin" {'));
  /* Le chrono descend tout seul : Text(timerInterval:) jusqu’à la fin de la manche (en secondes depuis 1970) */
  assert.ok(swift.includes('let fin: Date = Date(timeIntervalSince1970: e.fin)\n        let debut: Date = min(Date(), fin)\n        return debut...fin'));
  assert.ok(swift.includes('return e.phase == "partie" && e.fin > Date().timeIntervalSince1970'));
  assert.equal(swift.split('Text(timerInterval: LectureSalle.chrono(etat), countsDown: true)').length - 1, 3, 'à droite de l’île, ouverte, et sur l’écran verrouillé');
  /* Les règles du fichier tiennent avec la nouvelle partie */
  const code = sansCommentaires(entre(swift, '// MARK: - La salle dans l’île', '@main'));
  assert.ok(!/Text\([^)\n]*\?[^)\n]*:/.test(code));
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});

test('ce que l’île lit de l’état : moi, ma place, « Victoire ! », qui arrive (un clin d’œil), Rejouer ou Revanche', () => {
  const L = entre(swift, 'enum LectureSalle {', '\n}\n');
  for (const k of ['if n == 1 { return "1er" }\n        return "\\(n)e"', 'if j.p == a.moi { return "Toi" }',
    'if e.nouveau.isEmpty || e.nouveau == a.moi { return "" }', `if e.joueurs.count < 2 { return "Partie terminée${FINE}!" }`,
    `if p == 1 { return "Victoire${FINE}!" }`, 'if gagne(e, a) { return "Rejouer" }\n        return "Revanche"',
    `if personneNaMarque(e) { return "Match nul${FINE}!" }`, 'let p: Int = moi(e, a)?.pts ?? 0\n        return p > 0 && place(e, a) == 1',
    'if e.phase == "fin" {\n            if gagne(e, a) { return .etoiles }\n            return .rieur\n        }\n        if e.phase == "attente" && !arrivee(e, a).isEmpty { return .clin }\n        return .ouvert',
    'if voyelles.contains(initiale) { return "qu’" + n }', 'return "on attend \\(qui) lance"', 'if attendus.isEmpty { return "tout le monde est prêt" }',
    'if e.phase == "pause" { return texte + " terminée" }'])
    assert.ok(L.includes(k), k);
  /* Le clin d’œil : un œil fermé (comme rieur), l’autre ouvert */
  const y = entre(swift, 'private func yeux(_ e: CGFloat, _ paupiere: StrokeStyle) -> some View {', '\n    }\n}');
  assert.ok(y.includes('case .clin:\n            ZStack {\n                MorceauLunettes(quoi: .clinFerme).stroke(lilasClair, style: paupiere)'));
  for (const k of ['case .clinFerme:', 'case .irisDroit:', 'case .pupilleDroite:', 'case .refletDroit:']) assert.ok(swift.includes(k), k);
  /* Les chats de l’écran verrouillé : sous la taille de la présentation (en @2x et @3x) */
  for (const n of ['ChatSalut', 'ChatOrdi', 'ChatBravo']) {
    const c = JSON.parse(lire(`resources/ios/widget/RequeteWidget/Assets.xcassets/${n}.imageset/Contents.json`)).images.filter(i => i.filename);
    assert.deepEqual(c.map(i => i.scale).sort(), ['2x', '3x'], n);
  }
});

test('le pont : salleDebut (un jeton de push, sinon sans), salleMaj, salleFin (le podium un quart d’heure), partagerTexte, le miaou', () => {
  const noms = [...pont.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: CAPPluginReturnPromise\)/g)].map(x => x[1]);
  assert.deepEqual(noms.slice(-12, -8), ['salleDebut', 'salleMaj', 'salleFin', 'partagerTexte'], 'puis l’onboarding dans l’île (ios-accueil-ile), les notifications (retours-1555), « Gérer mon abonnement » (retours-2106), la note de l’app (retours-0102) et les widgets posés (retours-2004)');
  for (const n of ['salleDebut', 'salleMaj', 'salleFin']) {
    const f = entre(pont, `@objc func ${n}(_ call: CAPPluginCall) {`, '\n    }\n');
    assert.ok(f.includes('guard #available(iOS 16.2, *) else {') && f.includes('Task {') && f.includes('call.resolve('), n);
  }
  assert.ok(entre(pont, '@objc func salleDebut(', '\n    }\n').includes('self?.notifyListeners("salleJeton", data: ["code": code, "jeton": jeton], retainUntilConsumed: true)'));
  const p = entre(pont, 'enum RequeteSallePont {', '\n}\n');
  for (const k of ['return try? JSONDecoder().decode(RequeteSalle.ContentState.self, from: donnees)',
    'activite = try Activity<RequeteSalle>.request(attributes: salle, content: contenu, pushType: .token)',
    'activite = try Activity<RequeteSalle>.request(attributes: salle, content: contenu, pushType: nil)',
    'for await jeton in activite.pushTokenUpdates {', 'let hex: String = jeton.map { String(format: "%02x", $0) }.joined()',
    'let politique: ActivityUIDismissalPolicy = garder ? .after(Date().addingTimeInterval(15 * 60)) : .immediate',
    'for a in Activity<RequeteSalle>.activities where a.activityState == .active || a.activityState == .stale {'])
    assert.ok(p.includes(k), k);
  const charge = entre(pont, 'override public func load() {', '\n    }\n');
  assert.ok(charge.includes('Task { await RequeteSallePont.arreterEnCours() }') && charge.includes('RequeteSon.installer()'));
  const son = entre(pont, 'enum RequeteSon {', '\n}\n');
  assert.ok(son.includes('Bundle.main.url(forResource: "miaou", withExtension: "wav", subdirectory: "public/assets/sons")') && son.includes('appendingPathComponent("Sounds", isDirectory: true)'));
  /* Le droit des push d’Apple */
  assert.ok(lire('resources/ios/widget/App/App.entitlements').includes('<key>aps-environment</key>\n\t<string>development</string>'));
  const code = sansCommentaires(pont);
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées (pont)`);
  for (const l of code.split('\n')) assert.ok(l.split(' ? ').length <= 2, l.trim());
});

test('le petit miaou : un WAV court (moins de 30 s), synthétisé par tools/sons/miaou.py, copié avec la page', () => {
  const b = fs.readFileSync(path.join(ROOT, 'assets/sons/miaou.wav'));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.readUInt16LE(22), 1, 'mono');
  assert.equal(b.readUInt32LE(24), 44100);
  assert.equal(b.readUInt16LE(34), 16);
  const secondes = b.readUInt32LE(40) / (44100 * 2);
  assert.ok(secondes > 0.3 && secondes < 2, String(secondes));
  assert.ok(lire('tools/sons/miaou.py').includes("SORTIE = os.path.join(RACINE, 'assets', 'sons', 'miaou.wav')"));
});

/* La page, dans un bac à sable : une salle de trois joueurs, vue de chez Léa (L), l’hôte est Max (M) */
const page = ({vue = 'lobby', moi = 'L', hote = 'M', joueurs = ['M', 'L'], prets = ['M'], trouves = [], pts = {}, natif = true, over = false, rejet = false} = {}) => {
  const appels = [], posts = [], rpc = [], minuteurs = [], ecoute = [];
  const J = {code: 'K7P2QX', me: moi, nom: '@' + moi.toLowerCase(), solo: false, synced: true, full: false, hostPid: hote, max: 6, nb: 3, over,
    players: Object.fromEntries(['M', 'L', 'X'].map(p => [p, {name: '@' + p.toLowerCase()}])), rounds: [{cid: 'af4', t1: 1_700_000_000_000, found: {}}]};
  const C = {isNativePlatform: () => natif, addListener: (p, e, f) => ecoute.push([p, e, f]),
    nativePromise: (p, m, d) => { appels.push([m, ici(d)]); return Promise.resolve({ok: true}); }};
  const ctx = vm.createContext({
    JEU: J, JEU_MAX: 6, jeuDureeMs: k => ({f: 600000, m: 900000, d: 1200000})[k] || 600000, JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_x', JSON, Math, Promise, Object, String, Array,
    CHALLENGES: [{id: 'af4', titre: 'Le meilleur client'}],
    jeuView: () => x.vue, jeuCur: () => (x.vue === 'lobby' ? -1 : 0), jeuLive: () => x.joueurs, jeuIsReady: p => p === x.J.hostPid || x.prets.includes(p),
    jeuNom: v => String(v || '').slice(0, 16), jeuScores: () => x.joueurs.map(p => ({pid: p, name: '@' + p.toLowerCase(), pts: x.pts[p] || 0, ms: 0})).sort((a, b) => b.pts - a.pts),
    jeuPlaces: sc => sc.map((s, i) => Object.assign(s, {place: i + 1})),
    ilePont: () => (natif ? C : null), ileAppel: (m, d) => C.nativePromise('RequeteWidget', m, d),
    clsCle: () => 'cle'.repeat(10), clsRpc: (f, b) => { rpc.push([f, ici(b)]); return rejet ? Promise.reject(new Error('non')) : Promise.resolve({ok: true}); },
    fetch: (u, o) => { posts.push([u, JSON.parse(o.body), o.keepalive]); return Promise.resolve({ok: true}); },
    jeuIsHost: () => x.J.hostPid === x.J.me && !x.relit, jeuNextRound: () => appels.push(['jeuNextRound']), jeuPeutLancer: () => true, jeuLancer: () => appels.push(['jeuNextRound']), jeuAgain: () => appels.push(['jeuAgain']),
    jeuTexteInvitation: () => 'Rejoins-moi', jeuLienInvitation: () => 'https://exemple/?partie=K7P2QX',
    setTimeout: (f, ms) => { minuteurs.push({f, ms}); return minuteurs.length; }, clearTimeout: () => {},
    document: {addEventListener: () => {}},
  });
  ctx.JEU.rounds[0].found = Object.fromEntries(trouves.map(p => [p, 30000]));
  const x = {ctx, J, appels, posts, rpc, minuteurs, ecoute, vue, joueurs, prets, pts, relit: false,
    run: s => vm.runInContext(s, ctx), attendre: async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); }};
  vm.runInContext(entre(app, '/* ---------- La salle dans l’île (la Live Activity d’une salle entre amis, app iPhone) ----------', '/* ---------- Ta flamme en direct'), ctx);
  return x;
};

test('l’état de la salle pour l’île : attente, partie, pause entre deux manches, podium ; rien en entrant', () => {
  const x = page();
  assert.deepEqual(ici(x.run('ileSalleEtat()')), {phase: 'attente', joueurs: [{p: 'M', n: '@m', pts: 0, r: 0, ok: true}, {p: 'L', n: '@l', pts: 0, r: 0, ok: false}],
    hote: 'M', manche: 0, nb: 3, defi: '', fin: 0, nouveau: ''});
  x.vue = 'play0'; x.pts.L = 240; x.J.rounds[0].found = {L: 42000};
  assert.deepEqual(ici(x.run('ileSalleEtat()')), {phase: 'partie', joueurs: [{p: 'L', n: '@l', pts: 240, r: 1, ok: true}, {p: 'M', n: '@m', pts: 0, r: 2, ok: false}],
    hote: 'M', manche: 1, nb: 3, defi: 'Le meilleur client', fin: 1_700_000_600, nouveau: ''}, 'la fin du chrono (10 min après le départ), en secondes depuis 1970');
  x.vue = 'draw0'; assert.equal(x.run('ileSalleEtat()').phase, 'partie', 'le tirage au sort aussi');
  x.vue = 'res0'; assert.deepEqual([x.run('ileSalleEtat()').phase, x.run('ileSalleEtat()').fin], ['pause', 0]);
  x.vue = 'final'; assert.equal(x.run('ileSalleEtat()').phase, 'fin');
  for (const v of ['join', 'full', 'lost']) { x.vue = v; assert.equal(x.run('ileSalleEtat()'), null, v); }
  /* 10 novembre, 7 h 47 (« ok pour solo et multijoueur avec le 1/2 etc. pour les manches ») : une partie seule a son île aussi */
  x.vue = 'res0'; x.J.solo = true; assert.equal(x.run('ileSalleEtat()').phase, 'pause', 'seul : l’île aussi');
});

test('l’activité démarre avec la salle, suit ses changements, garde le podium ; quitter la salle l’arrête et oublie le jeton', async () => {
  const x = page();
  x.run('ileSalleMaintenant()');
  assert.equal(x.appels[0][0], 'salleDebut');
  assert.deepEqual([x.appels[0][1].code, x.appels[0][1].moi, x.appels[0][1].max], ['K7P2QX', 'L', 6]);   // six places (22 h 27)
  assert.equal(JSON.parse(x.appels[0][1].etat).phase, 'attente', 'l’état part en JSON (le même que celui du serveur)');
  assert.deepEqual(x.ecoute.map(e => e.slice(0, 2)), [['RequeteWidget', 'salleJeton']]);
  x.run('ileSalleMaintenant()');
  assert.equal(x.appels.length, 1, 'rien n’a changé : rien ne part');
  x.prets.push('L'); x.run('ileSalleMaintenant()');
  assert.equal(x.appels.at(-1)[0], 'salleMaj');
  x.vue = 'final'; x.run('ileSalleMaintenant()');
  assert.deepEqual([x.appels.at(-1)[0], x.appels.at(-1)[1].garder], ['salleFin', true], 'le podium : un quart d’heure sur l’écran verrouillé');
  /* « Rejouer » : la même salle repart en attente, une nouvelle activité */
  x.vue = 'lobby'; x.run('ileSalleMaintenant()');
  assert.equal(x.appels.at(-1)[0], 'salleDebut');
  /* Le jeton de push : confié au serveur, retenté si le téléphone n’est pas encore membre */
  x.run("ileSalleJeton({code:'K7P2QX',jeton:'ab12'.repeat(8)})"); await x.attendre();
  assert.deepEqual(x.rpc.at(-1), ['jeu_ile_jeton_v2', {p_cle: 'cle'.repeat(10), p_salle: 'K7P2QX', p_jeton: 'ab12'.repeat(8)}]);
  const r = page({rejet: true}); r.run('ileSalleMaintenant()'); r.run("ileSalleJeton({code:'K7P2QX',jeton:'ab12'.repeat(8)})"); await r.attendre();
  assert.equal(r.minuteurs.at(-1).ms, 3000, 'refusé : retenté dans 3 s');
  x.run("ileSalleJeton({code:'AUTRE1',jeton:'ab12'.repeat(8)})"); x.run("ileSalleJeton({code:'K7P2QX',jeton:'pas du hex'})");
  assert.equal(x.rpc.length, 1, 'une autre salle, un jeton mal formé : rien');
  /* Quitter avant le podium : l’activité s’en va, le jeton est oublié ; après le podium, le podium reste */
  x.run('ileSalleQuitter()');
  assert.deepEqual([x.appels.at(-1)[0], x.appels.at(-1)[1].garder], ['salleFin', false]);
  assert.deepEqual(x.rpc.at(-1), ['jeu_ile_jeton_v2', {p_cle: 'cle'.repeat(10), p_salle: 'K7P2QX', p_jeton: null}]);
  const f = page({vue: 'final'}); f.run('ileSalleMaintenant()'); f.vue = 'final'; const n = f.appels.length; f.run('ileSalleQuitter()');
  assert.equal(f.appels.length, n, 'sur le podium : rien n’est arrêté');
  /* Sur le web : rien */
  const w = page({natif: false}); w.run('ileSalleSuivre()'); w.run('ileSalleMaintenant()'); assert.deepEqual(w.appels, []);
});

test('le serveur, pour les autres : mon arrivée (avec un clin d’œil et un miaou), mes changements, une nouvelle manche ou phase ; jamais deux fois', () => {
  const x = page();
  x.run('ileSalleMaintenant()');
  assert.equal(x.posts.length, 1, 'j’arrive');
  const [url, corps, keepalive] = x.posts[0];
  assert.equal(url, 'https://exemple.supabase.co/functions/v1/jeu-ile?forceFunctionRegion=eu-west-3');
  assert.equal(keepalive, true);
  assert.deepEqual([corps.cle, corps.salle, corps.etat.nouveau], ['cle'.repeat(10), 'K7P2QX', 'L']);
  assert.deepEqual(corps.alerte, {titre: '@l entre dans la salle', texte: 'Salle K7P2QX · 2/6', son: 'miaou.wav'});
  x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 1);
  /* Un autre arrive : je ne suis pas l’hôte, ce n’est pas à moi de l’envoyer (lui le fait) */
  x.joueurs.push('X'); x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 1);
  /* Je me dis prête : à moi */
  x.prets.push('L'); x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 2);
  assert.deepEqual([x.posts[1][1].etat.nouveau, x.posts[1][1].alerte], ['', null]);
  /* La manche commence : tout le monde l’envoie (le serveur ne pousse pas deux fois le même état) */
  x.vue = 'play0'; x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 3);
  assert.equal(x.posts[2][1].etat.phase, 'partie');
  /* Je trouve : à moi */
  x.J.rounds[0].found = {L: 30000}; x.pts.L = 225; x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 4);
  /* Max trouve : à lui */
  x.J.rounds[0].found.M = 50000; x.pts.M = 175; x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 4);
  /* Le podium : l’alerte de fin */
  x.vue = 'final'; x.run('ileSalleMaintenant()'); assert.equal(x.posts.length, 5);
  assert.deepEqual(x.posts[4][1].alerte, {titre: 'Fin de la partie', texte: '1er : @l · 225 pts', son: 'default'});
  /* L’hôte envoie qui arrive ou part */
  const h = page({moi: 'M'}); h.run('ileSalleMaintenant()');
  assert.equal(h.posts.length, 1, 'la salle s’ouvre');
  assert.equal(h.posts[0][1].alerte, null, 'l’hôte n’« arrive » pas');
  h.joueurs.pop(); h.run('ileSalleMaintenant()'); assert.equal(h.posts.length, 2, 'Léa part : l’hôte le dit');
});

test('les boutons de l’île : Partager (la feuille d’iOS), Lancer et Rejouer (pour l’hôte, une fois la salle relue)', async () => {
  const x = page({moi: 'M'});
  x.run("ileSalleAction('partager')"); await x.attendre();
  assert.deepEqual(x.appels.at(-1), ['partagerTexte', {texte: 'Rejoins-moi', url: 'https://exemple/?partie=K7P2QX'}]);
  x.relit = true;
  x.run("ileSalleAction('lancer')");
  assert.ok(!x.appels.some(a => a[0] === 'jeuNextRound'), 'la salle se relit encore : on attend');
  x.relit = false; x.minuteurs.at(-1).f();
  assert.ok(x.appels.some(a => a[0] === 'jeuNextRound'), 'puis on lance');
  x.J.over = true; x.run("ileSalleAction('rejouer')");
  assert.ok(x.appels.some(a => a[0] === 'jeuAgain'));
  const g = page(); g.run("ileSalleAction('lancer')");
  for (let i = 0; i < 20 && g.minuteurs.length; i++) g.minuteurs.shift().f();
  assert.ok(!g.appels.some(a => a[0] === 'jeuNextRound'), 'pas l’hôte : rien');
  /* Le lien profond : requete://salle-lancer → fr.requete.app.salle-lancer → ileSalleAction('lancer') */
  const r = entre(app, 'function raccourciOuvrir(type){', '\n  const requete=');
  assert.ok(r.includes("const salle=/\\.salle-(partager|lancer|rejouer)$/.exec(type);\n  if(salle){if(typeof ileSalleAction==='function')ileSalleAction(salle[1]);return;}"));
  /* Branchée sur la salle : chaque dessin, et en partant */
  assert.ok(entre(app, 'function jeuRender(){', '\n  const v=jeuView();').includes("if(typeof ileSalleSuivre==='function')ileSalleSuivre();"));
  assert.ok(entre(app, 'function jeuStop(){', '\n}\n').includes("if(typeof ileSalleQuitter==='function')ileSalleQuitter();   // la salle dans l’île s’en va (sauf le podium)\n  JEU=null;"));
});

test('la fonction jeu-ile : l’état reconstruit, l’alerte, ce que reçoit Apple', () => {
  const t = 1_800_000_000;
  const ok = {phase: 'attente', joueurs: [{p: 'M2k3m4n5', n: '@max', pts: 0, r: 0, ok: true}], hote: 'M2k3m4n5', manche: 0, nb: 3, defi: '', fin: 0, nouveau: ''};
  assert.deepEqual(etatPropre(ok, t), ok);
  assert.equal(etatPropre({...ok, joueurs: Array(6).fill(ok.joueurs[0])}, t).joueurs.length, 6, 'six joueurs par salle (8 novembre, 22 h 27) ; le 7e est refusé plus bas');
  assert.deepEqual(etatPropre({...ok, en: 'trop', joueurs: [{...ok.joueurs[0], n: '  @max<\u200b>  ', x: 1}]}, t).joueurs[0], {p: 'M2k3m4n5', n: '@max', pts: 0, r: 0, ok: true}, 'nettoyé, clés en trop retirées');
  for (const mauvais of [{...ok, phase: 'autre'}, {...ok, joueurs: []}, {...ok, joueurs: Array(7).fill(ok.joueurs[0])}, {...ok, fin: t + 90000}, {...ok, fin: 1.5},
    {...ok, manche: 9}, {...ok, joueurs: [{...ok.joueurs[0], pts: -1}]}, {...ok, joueurs: [{...ok.joueurs[0], p: 'a b'}]}, {...ok, nouveau: 'x'}, null, []])
    assert.equal(etatPropre(mauvais, t), null, JSON.stringify(mauvais));
  assert.deepEqual(alertePropre({titre: 'Léa entre', texte: 'Salle K7P2QX', son: 'miaou.wav'}), {titre: 'Léa entre', texte: 'Salle K7P2QX', son: 'miaou.wav'});
  assert.equal(alertePropre({titre: 'x', texte: 'y', son: 'bip.caf'}).son, 'default');
  assert.equal(alertePropre(null), null);
  assert.equal(alertePropre({texte: 'sans titre'}), undefined);
  assert.deepEqual(chargeApns(ok, null, t), {aps: {timestamp: t, event: 'update', 'content-state': ok}});
  const fin = chargeApns({...ok, phase: 'fin'}, {titre: 'Fin de la partie', texte: '1er : @max', son: 'default'}, t);
  assert.deepEqual(fin.aps, {timestamp: t, event: 'end', 'content-state': {...ok, phase: 'fin'}, 'dismissal-date': t + 900, alert: {title: 'Fin de la partie', body: '1er : @max', sound: 'default'}});
});

test('la fonction jeu-ile : la production d’abord, le bac à sable pour une version de développement, les jetons refusés oubliés', async () => {
  const essais = [];
  const apple = reponses => async (hote, jeton) => { essais.push([hote, jeton]); return reponses.shift(); };
  assert.deepEqual(await pousserUn({jeton: 'aa', bac: false}, {}, apple([{status: 200}])), {ok: true});
  assert.deepEqual(await pousserUn({jeton: 'bb', bac: false}, {}, apple([{status: 400, raison: 'BadDeviceToken'}, {status: 200}])), {ok: true, bac: true});
  assert.deepEqual(essais.slice(-2).map(e => e[0]), [PROD, BAC]);
  assert.deepEqual(await pousserUn({jeton: 'cc', bac: true}, {}, apple([{status: 200}])), {ok: true});
  assert.equal(essais.at(-1)[0], BAC, 'déjà connu du bac à sable');
  assert.deepEqual(await pousserUn({jeton: 'dd', bac: false}, {}, apple([{status: 410, raison: 'Unregistered'}])), {ok: false, oublier: true});
  assert.deepEqual(await pousserUn({jeton: 'ee', bac: false}, {}, apple([{status: 400, raison: 'BadDeviceToken'}, {status: 400, raison: 'BadDeviceToken'}])), {ok: false, oublier: true});
  assert.deepEqual(await pousserUn({jeton: 'ff', bac: false}, {}, apple([{status: 429, raison: 'TooManyRequests'}])), {ok: false, oublier: false}, 'trop de demandes : on le garde');
});

test('la fonction jeu-ile : en veille sans la clé d’Apple ; membre de la salle seulement ; un état déjà poussé ne repart pas', async () => {
  const corps = {cle: 'c'.repeat(32), salle: 'K7P2QX', etat: {phase: 'attente', joueurs: [{p: 'L1234567', n: '@lea', pts: 0, r: 0, ok: false}], hote: 'M1234567', manche: 0, nb: 3, defi: '', fin: 0, nouveau: 'L1234567'},
    alerte: {titre: '@lea entre dans la salle', texte: 'Salle K7P2QX · 2/6', son: 'miaou.wav'}};
  const demande = b => new Request('https://x/functions/v1/jeu-ile', {method: 'POST', body: JSON.stringify(b)});
  const appels = [], envois = [];
  const rpc = reponse => async (f, a) => { appels.push([f, a]); if (reponse instanceof Error) throw reponse; return typeof reponse === 'function' ? reponse(f, a) : reponse; };
  const envoyer = async (hote, jeton, charge) => { envois.push([hote, jeton, charge]); return jeton === 'mort' ? {status: 410, raison: 'Unregistered'} : {status: 200}; };
  const lire = async r => [r.status, await r.json()];
  /* En veille */
  assert.deepEqual(await lire(await createIleHandler({pret: false, rpc: rpc({}), envoyer})(demande(corps))), [200, {ok: true, pousse: 0, veille: true}]);
  assert.equal(appels.length, 0);
  /* Mal formée */
  for (const b of [{...corps, salle: 'k7p2'}, {...corps, cle: 'court'}, {...corps, etat: {}}, {...corps, alerte: 'oui'}])
    assert.equal((await createIleHandler({pret: true, rpc: rpc({}), envoyer})(demande(b))).status, 400);
  /* Pas dans la salle */
  assert.equal((await createIleHandler({pret: true, rpc: rpc(Object.assign(new Error('non'), {code: '42501'})), envoyer})(demande(corps))).status, 403);
  /* Déjà poussé */
  assert.deepEqual(await lire(await createIleHandler({pret: true, rpc: rpc({pareil: true, cibles: []}), envoyer})(demande(corps))), [200, {ok: true, pousse: 0}]);
  /* Deux autres joueurs, dont un jeton mort */
  appels.length = 0;
  const h = createIleHandler({pret: true, envoyer, maintenant: () => 1_800_000_000,
    rpc: rpc(f => (f === 'jeu_ile_cibles_v2' ? {pareil: false, cibles: [{jeton: 'vivant', bac: false}, {jeton: 'mort', bac: false}]}
      : f === 'jeu_ile_alerte_v2' ? {ok: true, moi: 'L1234567', noms: {L1234567: '@lea', M1234567: '@max'}} : null))});
  assert.deepEqual(await lire(await h(demande(corps))), [200, {ok: true, pousse: 1}]);
  assert.deepEqual(appels[0], ['jeu_ile_cibles_v2', {p_cle: corps.cle, p_salle: 'K7P2QX', p_etat: corps.etat}]);
  assert.deepEqual(appels[1], ['jeu_ile_alerte_v2', {p_cle: corps.cle, p_salle: 'K7P2QX'}], '11 novembre : le serveur dit si l’alerte peut partir, avec les pseudos');
  assert.deepEqual(appels[2], ['jeu_ile_suivi_v2', {p_salle: 'K7P2QX', p_retirer: ['mort'], p_bac: []}]);
  assert.deepEqual(envois.find(e => e[1] === 'vivant')[2].aps.alert, {title: '@lea entre dans la salle', body: 'Salle K7P2QX · 1/6', sound: 'miaou.wav'}, 'réécrite par le serveur');
  /* Le point d’entrée : les en-têtes d’une Live Activity, verify_jwt désactivé (l’appareil est authentifié par sa clé) */
  const index = fs.readFileSync(path.join(ROOT, 'supabase/functions/jeu-ile/index.ts'), 'utf8');
  for (const k of ["'apns-push-type': 'liveactivity'", "'apns-topic': `${sujet}.push-type.liveactivity`", "'apns-priority': '10'", 'https://${hote}/3/device/${jeton}',
    "const sujet = Deno.env.get('APNS_TOPIC') ?? 'fr.requete.app';", 'Deno.serve(createIleHandler({pret: !!(pem && kid && equipe), rpc, envoyer}));', 'maintenant - autorisation.depuis > 2400'])
    assert.ok(index.includes(k), k);
});

test('la fonction jeu-ile : le jeton d’autorisation d’Apple (ES256), vérifiable avec la clé publique', async () => {
  const paire = await webcrypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', paire.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
  const jwt = await jetonApns({pem, kid: 'ABC123DEFG', equipe: 'TEAM123456', maintenant: 1_800_000_000, subtle: webcrypto.subtle});
  const [tete, charge, signature] = jwt.split('.');
  const json = s => JSON.parse(Buffer.from(s, 'base64url').toString());
  assert.deepEqual(json(tete), {alg: 'ES256', kid: 'ABC123DEFG'});
  assert.deepEqual(json(charge), {iss: 'TEAM123456', iat: 1_800_000_000});
  assert.equal(Buffer.from(signature, 'base64url').length, 64, 'r puis s');
  assert.ok(await webcrypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, paire.publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${tete}.${charge}`)));
});

test('la migration : deux tables privées qui partent avec la salle, trois fonctions, les bons droits', () => {
  for (const k of ['create table requete_private.ile (', 'references requete_private.salle(code) on delete cascade',
    'foreign key (code, pid) references requete_private.membre(code, pid) on delete cascade', "check (jeton ~ '^[0-9a-f]{16,400}$')",
    'create table requete_private.ile_etat (', 'alter table requete_private.ile enable row level security;', 'alter table requete_private.ile_etat enable row level security;',
    'revoke all on table requete_private.ile, requete_private.ile_etat from public, anon, authenticated;',
    "v_pid text := (public.jeu_identite_v2(p_cle))->>'pid';", 'if v_avant is not null and v_avant = p_etat then',
    'where i.code = p_salle and i.pid <> v_pid and not m.parti;', "raise exception 'pas dans cette salle' using errcode = '42501';",
    'grant execute on function public.jeu_ile_jeton_v2(text, text, text) to anon, authenticated;',
    'grant execute on function public.jeu_ile_cibles_v2(text, text, jsonb) to service_role;',
    'grant execute on function public.jeu_ile_suivi_v2(text, text[], text[]) to service_role;'])
    assert.ok(migration.includes(k), k);
  assert.equal((migration.match(/security definer set search_path = ''/g) || []).length, 3);
  assert.ok(!/grant execute on function public\.jeu_ile_(cibles|suivi)_v2[^;]*anon/.test(migration), 'les jetons ne sont lisibles que par la fonction');
});

test('IOS.md : la salle dans l’île, et la clé d’Apple pas à pas', () => {
  const c = entre(ios, '### La salle dans l’île (7 novembre)', '\n### ');
  for (const k of ['RequeteSalleIle', 'jeu-ile', 'jeu_ile_jeton_v2', 'Keys', 'Apple Push Notifications service (APNs)', '.p8', 'APNS_KEY', 'APNS_KEY_ID', 'APNS_TEAM_ID',
    'Edge Functions', 'aps-environment', 'Push Notifications', 'miaou', 'veille'])
    assert.ok(c.includes(k), k);
  assert.ok(!/bientôt|prochainement/i.test(c));
});

test('11 novembre, 23 h 38 (audit) : l’alerte de l’île est réécrite par le serveur ; un texte inventé ou trop d’alertes ne passent pas', async () => {
  const {alerteVoulue, alerteServeur} = await import('../supabase/functions/jeu-ile/handler.mjs');
  const etat = {phase: 'attente', joueurs: [{p: 'L1234567', n: '@lea', pts: 0, r: 0, ok: false}, {p: 'M1234567', n: '@max', pts: 0, r: 0, ok: false}], nouveau: 'L1234567'};
  const info = {ok: true, moi: 'L1234567', noms: {L1234567: '@lea', M1234567: '@max'}};
  const arrive = {titre: '@lea entre dans la salle', texte: 'Salle K7P2QX · 2/4', son: 'miaou.wav'};
  assert.deepEqual(alerteServeur(etat, alerteVoulue(etat, arrive), 'K7P2QX', info), {titre: '@lea entre dans la salle', texte: 'Salle K7P2QX · 2/4', son: 'miaou.wav'});
  /* Un texte inventé : ignoré (l’état part sans alerte) */
  for (const a of [{titre: 'Paie-moi un café', texte: 'Ou sinon…', son: 'default'}, {titre: 'Fin de la partie', texte: 'Tu as perdu, nul', son: 'default'}])
    assert.equal(alerteServeur(etat, alerteVoulue(etat, a), 'K7P2QX', info), null, a.titre);
  /* Le nom dans l’alerte est celui du serveur, pas celui envoyé */
  const faux = {titre: 'Le patron entre dans la salle', texte: 'Salle K7P2QX · 2/6', son: 'miaou.wav'};
  assert.equal(alerteServeur(etat, alerteVoulue(etat, faux), 'K7P2QX', info).titre, '@lea entre dans la salle');
  /* « X entre dans la salle » seulement par celui qui arrive */
  assert.equal(alerteServeur(etat, alerteVoulue(etat, arrive), 'K7P2QX', {...info, moi: 'M1234567'}), null);
  /* Une alerte toutes les 8 secondes au plus par salle (le serveur répond ok: false) */
  assert.equal(alerteServeur(etat, alerteVoulue(etat, arrive), 'K7P2QX', {...info, ok: false}), null);
  assert.equal(alerteServeur(etat, alerteVoulue(etat, arrive), 'K7P2QX', null), null, 'serveur muet : pas d’alerte');
  /* La fin : le premier, avec son pseudo du serveur */
  const fin = {phase: 'fin', joueurs: [{p: 'M1234567', n: 'nimporte', pts: 225, r: 1, ok: true}], nouveau: ''};
  assert.deepEqual(alerteServeur(fin, alerteVoulue(fin, {titre: 'Fin de la partie', texte: '1er : x · 1 pts', son: 'default'}), 'K7P2QX', info),
    {titre: 'Fin de la partie', texte: '1er : @max · 225 pts', son: 'default'});
  const mig = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261111234500_securite_avant_lancement.sql'), 'utf8');
  for (const k of ["where e.code = p_salle and (e.alerte_le is null or e.alerte_le < clock_timestamp() - interval '8 seconds');",
    'grant execute on function public.jeu_ile_alerte_v2(text, text) to service_role;', 'revoke all on function public.jeu_ile_alerte_v2(text, text) from public, anon, authenticated;',
    "j.cree < now() - interval '1 day' and j.parties >= 1) >= 3 then", "o.vue_le < now() - interval '1 day')"])
    assert.ok(mig.includes(k), k);
});
