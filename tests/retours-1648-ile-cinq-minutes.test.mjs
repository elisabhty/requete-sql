/* Elisa, 24 novembre, 16 h 48 : « Tu peux pousser pour tout le monde de la fermer 5 min après avoir fermé complètement l’appli »,
   puis « c’est urgent » et « Retirer aujourd'hui + 5 min plus tard ». L’app balayée, iOS ne la prévient pas : l’île de la leçon ou
   de l’onboarding restait jusqu’à 8 heures. Les versions de l’app d’avant (sans la méthode ileServeur du pont) n’ont plus ces deux
   îles ; la nouvelle version les rend, et le serveur les ferme 5 minutes après qu’on a quitté l’app. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j + b.length); };

const lab = headers => {
  const appels = [];
  const js = entre(app, 'let ileEtat=null;', '\nfunction ileProgression(){').replace(/\nfunction ileProgression\(\)\{$/, '');
  const lecon = entre(app, 'function ileDebut(l){', '\n}\n');
  const ob = entre(app, 'let ileOb=null;', '\nfunction ileObFin(fini){').replace(/\nfunction ileObFin\(fini\)\{$/, '');
  const Capacitor = {isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget',
    nativePromise: (p, m, d) => { appels.push(m); return Promise.resolve(); }};
  if (headers) Capacitor.PluginHeaders = headers;
  const ctx = vm.createContext({window: {Capacitor}, natifT: x => x, natifSql: x => x, natifLangue: () => 'fr',
    LV: {id: 12, fin: false, video: {currentTime: 0, duration: 100}}, MODULES: [], moduleDeLecon: () => null,
    jourActif: () => false, dstr: () => '2026-11-24', auj: () => 0, lvSeuil: () => 0,
    OB_SLIDES: ['welcome', 'name'], obStep: 1, obApercu: false, obLegalMode: null, obFlowSteps: () => ['name'],
    draft: {name: ''}, state: {onboarded: false},
    document: {getElementById: () => ({classList: {contains: c => c === 'on'}}), addEventListener: () => {}}});
  vm.runInContext(js + '\nfunction ileProgression(){return 0;}\nfunction ileAllumee(){return false;}\nfunction ileMoments(){return null;}\nfunction ilePause(){return false;}\n'
    + lecon + '\n' + ob + '\nthis.ileDebut=ileDebut;this.ileObSync=ileObSync;this.ileFermetureOk=ileFermetureOk;', ctx);
  return {ctx, appels};
};

test('une version de l’app d’avant (sans ileServeur) : ni l’île de la leçon, ni celle de l’onboarding', () => {
  for (const h of [undefined, [], [{name: 'RequeteWidget', methods: [{name: 'leconDebut'}, {name: 'accueilDebut'}]}]]) {
    const {ctx, appels} = lab(h);
    assert.equal(ctx.ileFermetureOk(), false);
    ctx.ileDebut({id: 12, titre: 'WHERE'});
    ctx.ileObSync();
    assert.deepEqual(appels, [], 'rien n’est lancé');
  }
});

test('la nouvelle version (ileServeur dans la liste du pont) : les deux îles reviennent', () => {
  const {ctx, appels} = lab([{name: 'Autre', methods: []}, {name: 'RequeteWidget', methods: [{name: 'leconDebut'}, {name: 'ileServeur'}]}]);
  assert.equal(ctx.ileFermetureOk(), true);
  ctx.ileDebut({id: 12, titre: 'WHERE'});
  ctx.ileObSync();
  assert.deepEqual(appels, ['leconDebut', 'accueilDebut']);
});

test('la flamme du soir et les salles ne dépendent pas de ileServeur', () => {
  for (const f of ['function flammeProgrammer', 'function ileSalle']) {
    const i = app.indexOf(f);
    if (i < 0) continue;
    assert.ok(!app.slice(i, app.indexOf('\n}\n', i)).includes('ileFermetureOk'), f);
  }
});

test('la page donne une fois à l’app l’adresse de ile-fermer et la clé publique, avant la première île', () => {
  const appels = [];
  const js = entre(app, 'let ileEtat=null;', '\nfunction ileProgression(){').replace(/\nfunction ileProgression\(\)\{$/, '');
  const lecon = entre(app, 'function ileDebut(l){', '\n}\n');
  const Capacitor = {PluginHeaders: [{name: 'RequeteWidget', methods: [{name: 'ileServeur'}]}], isNativePlatform: () => true,
    isPluginAvailable: () => true, nativePromise: (p, m, d) => { appels.push([m, d]); return Promise.resolve(); }};
  const ctx = vm.createContext({window: {Capacitor}, natifT: x => x, JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_x',
    LV: {id: 1}, MODULES: [], moduleDeLecon: () => null, lvSeuil: () => 0});
  vm.runInContext(js + '\nfunction ileProgression(){return 0;}\nfunction ileAllumee(){return false;}\nfunction ileMoments(){return null;}\nfunction ilePause(){return false;}\n'
    + lecon + '\nthis.ileDebut=ileDebut;', ctx);
  ctx.ileDebut({id: 1, titre: 'A'});
  ctx.ileDebut({id: 2, titre: 'B'});
  assert.deepEqual(JSON.parse(JSON.stringify(appels.map(a => a[0]))), ['ileServeur', 'leconDebut', 'leconDebut']);
  assert.deepEqual(JSON.parse(JSON.stringify(appels[0][1])), {url: 'https://exemple.supabase.co/functions/v1/ile-fermer?forceFunctionRegion=eu-west-3', cle: 'sb_publishable_x'});
  assert.ok(entre(app, 'function ileObSync(){', '\n}\n').includes("if(!ileOb)ileServeurDonner();"), 'l’onboarding aussi');
});

const pont = fs.readFileSync(new URL('../resources/ios/widget/App/RequeteWidgetPlugin.swift', import.meta.url), 'utf8');
test('l’app : un jeton de push pour la leçon et l’onboarding ; on quitte, le serveur est prévenu ; on revient, c’est annulé', () => {
  assert.ok(pont.includes('CAPPluginMethod(name: "ileServeur", returnType: CAPPluginReturnPromise)\n    ]'), 'à la fin de la liste');
  const f = entre(pont, '@objc func ileServeur(_ call: CAPPluginCall) {', '\n    }\n');
  assert.ok(f.includes('guard url.hasPrefix("https://"), URL(string: url) != nil, !cle.isEmpty else {') && f.includes('RequeteIleFermeture.serveur(url: url, cle: cle)'));
  const load = entre(pont, 'override public func load() {', '\n    }\n');
  assert.ok(load.includes('UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in\n                RequeteIleFermeture.quitter()'));
  assert.ok(load.includes('UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in\n                RequeteIleFermeture.revenir()'));
  for (const t of ['RequeteLecon', 'RequeteAccueil']) {
    assert.ok(pont.includes(`_ = try Activity<${t}>.request(attributes: attributs, content: contenu, pushType: .token)`), t);
    assert.ok(pont.includes(`_ = try Activity<${t}>.request(attributes: attributs, content: contenu, pushType: nil)`), t + ' : sans jeton, quand même');
  }
  const E = entre(pont, 'enum RequeteIleFermeture {', '\n}\n');
  for (const k of ['static let delai: Int = 300', 'for a in Activity<RequeteLecon>.activities where !a.content.state.fini {',
    'for a in Activity<RequeteAccueil>.activities where !a.content.state.fini {', 'guard let j = a.pushToken, let e = try? codeur.encode(a.content.state) else { continue }',
    'corps["annuler"] = true', 'corps["dans"] = delai', 'demande.setValue(cle, forHTTPHeaderField: "apikey")', 'fond.debut()', 'fond.fin()'])
    assert.ok(E.includes(k), k);
  assert.ok(pont.indexOf('enum RequeteIleFermeture {') > 0 && pont.indexOf('@available(iOS 16.2, *)\nenum RequeteIleFermeture {') > 0);
});

const {createFermerHandler, etatPropre, chargeFin} = await import('../supabase/functions/ile-fermer/handler.mjs');
const J = 'ab'.repeat(40);
const demande = b => new Request('https://x/functions/v1/ile-fermer', {method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b)});
const banc = ({pret = true, dues = [], statut = () => 200} = {}) => {
  const rpcs = [], envois = [];
  const h = createFermerHandler({pret, maintenant: () => 1000,
    rpc: async (n, a) => { rpcs.push([n, a]); return n === 'ile_fermer_dues_v1' ? dues : null; },
    envoyer: async (hote, jeton, charge) => { envois.push([hote, jeton, charge]); const s = statut(hote); return {status: s, raison: s === 400 ? 'BadDeviceToken' : ''}; }});
  return {h, rpcs, envois};
};

test('le serveur : on quitte (dans 5 min, entre 1 et 15), on revient (annulé), rien d’autre', async () => {
  const {h, rpcs} = banc();
  let r = await h(demande({jeton: J, dans: 300, etat: {progression: 0.4, allumee: false, fini: false, reussis: 1, moments: 3, autre: 'x'}}));
  assert.equal(r.status, 200);
  assert.deepEqual(rpcs.at(-1), ['ile_fermer_v1', {p_jeton: J, p_dans: 300, p_etat: {progression: 0.4, reussis: 1, moments: 3, allumee: false, fini: false}}]);
  await h(demande({jeton: J, dans: 5, etat: {etape: 2, total: 18, titre: 'Ton niveau', bonjour: 'Bienvenue', minutes: 3, fini: false}}));
  assert.equal(rpcs.at(-1)[1].p_dans, 60);
  await h(demande({jeton: J, dans: 99999, etat: {fini: false}}));
  assert.equal(rpcs.at(-1)[1].p_dans, 900);
  r = await h(demande({jeton: J, annuler: true}));
  assert.deepEqual(rpcs.at(-1), ['ile_fermer_v1', {p_jeton: J, p_dans: null, p_etat: null}]);
  const n = rpcs.length;
  for (const b of [{jeton: 'XYZ', dans: 300, etat: {fini: false}}, {jeton: J, dans: '300', etat: {fini: false}}, {jeton: J, dans: 300},
    {jeton: J, dans: 300, etat: {fini: 'non'}}, {jeton: J, dans: 300, etat: {progression: 'a', fini: false}}, 'pas du json', [1]])
    assert.equal((await h(demande(b))).status, 400, JSON.stringify(b));
  assert.equal((await h(demande({jeton: J, dans: 300, etat: {fini: false, titre: 'x'.repeat(4000)}}))).status, 413);
  assert.equal(rpcs.length, n, 'rien d’écrit');
});

test('le serveur : chaque minute, les îles dues partent à Apple (fin, tout de suite) ; en veille sans la clé d’Apple', async () => {
  assert.deepEqual(chargeFin({fini: false}, 1000), {aps: {timestamp: 1000, event: 'end', 'dismissal-date': 1000, 'content-state': {fini: false}}});
  assert.equal(etatPropre({progression: 3, fini: true}).progression, 1);
  let b = banc({dues: [{jeton: J, etat: {progression: 0.5, allumee: true, fini: false}}, {jeton: 'mauvais', etat: {fini: false}}]});
  let r = await (await b.h(demande({envoyer: true}))).json();
  assert.deepEqual(r, {ok: true, ferme: 1});
  assert.deepEqual(b.envois, [['api.push.apple.com', J, {aps: {timestamp: 1000, event: 'end', 'dismissal-date': 1000, 'content-state': {progression: 0.5, allumee: true, fini: false}}}]]);
  b = banc({dues: [{jeton: J, etat: {fini: false}}], statut: h => (h === 'api.push.apple.com' ? 400 : 200)});
  r = await (await b.h(demande({envoyer: true}))).json();
  assert.equal(r.ferme, 1);
  assert.deepEqual(b.envois.map(e => e[0]), ['api.push.apple.com', 'api.sandbox.push.apple.com'], 'une version de développement : le bac à sable');
  b = banc({pret: false});
  r = await (await b.h(demande({envoyer: true}))).json();
  assert.deepEqual(r, {ok: true, ferme: 0, veille: true});
  assert.deepEqual(b.rpcs, [], 'en veille, rien n’est pris');
});

test('la base : la table, les deux fonctions réservées au serveur, l’appel chaque minute', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261124160500_ile_fermer.sql', import.meta.url), 'utf8');
  for (const k of ['create table if not exists requete_private.ile_fermer (', "revoke all on requete_private.ile_fermer from public, anon, authenticated;",
    'grant execute on function public.ile_fermer_v1(text, integer, jsonb) to service_role;', 'grant execute on function public.ile_fermer_dues_v1(integer) to service_role;',
    "revoke all on function public.ile_fermer_v1(text, integer, jsonb) from public, anon, authenticated;", "revoke all on function public.ile_fermer_dues_v1(integer) from public, anon, authenticated;",
    'make_interval(secs => least(900, greatest(60, p_dans)))', 'for update skip locked', "delete from requete_private.ile_fermer where cree < now() - interval '12 hours';",
    "url := 'https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/ile-fermer'", "select cron.schedule('ile-fermer', '* * * * *', 'select requete_private.ile_fermer_lancer()');"])
    assert.ok(sql.includes(k), k);
  assert.ok(!/grant[^;]*ile_fermer[^;]*to (anon|authenticated)/.test(sql), 'l’appli n’y touche pas');
  const index = fs.readFileSync(new URL('../supabase/functions/ile-fermer/index.ts', import.meta.url), 'utf8');
  assert.ok(index.includes("'apns-push-type': 'liveactivity'") && index.includes('Deno.serve(createFermerHandler({pret: !!(pem && kid && equipe), rpc, envoyer}));'));
  assert.equal(fs.readFileSync(new URL('../supabase/functions/ile-fermer/apns.mjs', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../supabase/functions/jeu-ile/apns.mjs', import.meta.url), 'utf8'), 'la même signature que jeu-ile');
});
