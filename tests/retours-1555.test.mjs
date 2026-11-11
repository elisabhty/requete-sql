/* Elisa, 11 novembre, 15 h 55 : « Ça peut pas être une notification push ? », sur « M’avertir au lancement » ; puis « Oui, en
   push ». Dans l’appli iPhone, activer l’alerte d’un parcours à venir demande l’autorisation des notifications et inscrit
   l’appareil (son jeton de push) à la base de l’appli ; le jour où le parcours ouvre, Elisa envoie la notification à tous les
   inscrits (fonction parcours-annoncer). Refusée, ou sur le site : le message dans l’appli, comme avant. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createAnnonceHandler, chargeAnnonce, egal, pousserUn, PROD, BAC } from '../supabase/functions/parcours-annoncer/handler.mjs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));
const sql = lire('supabase/migrations/20261111160000_parcours_alerte_push.sql');
const swift = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const widget = lire('scripts/ios-widget.mjs');
const attendre = () => new Promise(r => setTimeout(r, 0));
const J1 = 'ab'.repeat(32), J2 = 'cd'.repeat(32);

/* La page des parcours, dans un bac à sable : un iPhone (le pont RequeteWidget) qui répond à notifAutoriser / notifJeton */
function sandbox({ natif = true, reponse = { autorise: true, refuse: false, jeton: J1.toUpperCase() }, rpcKo = false, state = {} } = {}) {
  const calls = [], dits = [];
  const window = natif ? { Capacitor: { isNativePlatform: () => true, isPluginAvailable: n => n === 'RequeteWidget',
    nativePromise: (p, m, d) => { calls.push(['natif', p, m]); return Promise.resolve(typeof reponse === 'function' ? reponse(m) : reponse); } } } : {};
  const ctx = vm.createContext({
    window, state: { lessons: {}, ...state }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: () => '', esc: String, escAttr: String, DEF_CHEV_SVG: '',
    activeTab: 'parcours', switchTab() {}, returnToParent() {}, returnToHome() {}, buzz() {}, lqSay: m => dits.push(m), mascotReduced: () => false, Date,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    clsCle: () => 'cle', clsRpc: (fn, body) => { calls.push(['rpc', fn, JSON.parse(JSON.stringify(body))]); return rpcKo ? Promise.reject(new Error('réseau')) : Promise.resolve({ ok: true }); }
  });
  vm.runInContext(block, ctx);
  return { ctx, calls, dits };
}
const rpcs = (calls, fn = 'parcours_alerter') => calls.filter(c => c[0] === 'rpc' && c[1] === fn).map(c => c[2]);

test('iPhone : activer l’alerte demande l’autorisation, puis inscrit l’appareil avec son jeton ; la couper le désinscrit', async () => {
  const s = sandbox();
  s.ctx.parcoursAlerte('python', true);
  await attendre(); await attendre(); await attendre();
  assert.deepEqual(s.calls[0], ['natif', 'RequeteWidget', 'notifAutoriser']);
  assert.deepEqual(rpcs(s.calls), [{ p_cle: 'cle', p_parcours: 'python', p_jeton: J1, p_on: true }], 'le jeton en minuscules');
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.state.parcoursPush)), { jeton: J1, faits: ['python'] });
  assert.equal(s.dits.at(-1), 'C’est noté : tu recevras une notification le jour où il ouvre.');
  s.ctx.parcoursAlerte('python', false);
  await attendre(); await attendre();
  assert.deepEqual(rpcs(s.calls).at(-1), { p_cle: 'cle', p_parcours: 'python', p_jeton: null, p_on: false });
  assert.deepEqual([...s.ctx.state.parcoursPush.faits], []);
  assert.equal(s.dits.at(-1), 'Alerte retirée.');
});

test('notifications refusées ou sur le site : le message dans l’appli, rien ne part', async () => {
  const r = sandbox({ reponse: { autorise: false, refuse: true, jeton: '' } });
  r.ctx.parcoursAlerte('excel', true);
  await attendre(); await attendre();
  assert.deepEqual(rpcs(r.calls), []);
  assert.ok(r.dits.at(-1).startsWith('Les notifications de Requête sont coupées (Réglages › Notifications)'));
  assert.deepEqual([...r.ctx.state.parcoursAlertes], ['excel'], 'l’alerte reste sur l’appareil');
  const w = sandbox({ natif: false });
  w.ctx.parcoursAlerte('excel', true);
  await attendre();
  assert.deepEqual(w.calls, []);
  assert.equal(w.dits.at(-1), 'C’est noté : un message t’attendra dans l’appli le jour où il ouvre.');
});

test('hors ligne : l’inscription attend ; un nouveau jeton réinscrit tout ; à l’ouverture de l’appli, le jeton est relu sans rien demander', async () => {
  const s = sandbox({ rpcKo: true });
  s.ctx.parcoursAlerte('python', true);
  await attendre(); await attendre(); await attendre();
  assert.deepEqual([...s.ctx.state.parcoursPush.faits], [], 'pas encore inscrite');
  s.ctx.clsRpc = (fn, body) => { s.calls.push(['rpc', fn, JSON.parse(JSON.stringify(body))]); return Promise.resolve({ ok: true }); };
  assert.equal(await s.ctx.parcoursPushSync(), true);
  assert.deepEqual([...s.ctx.state.parcoursPush.faits], ['python']);
  assert.equal(await s.ctx.parcoursPushSync(), true);
  assert.equal(rpcs(s.calls).length, 2, 'déjà inscrite : rien ne repart');
  /* iOS a changé le jeton */
  const t = sandbox({ reponse: { autorise: true, jeton: J2 }, state: { parcoursAlertes: ['python', 'powerbi'], parcoursPush: { jeton: J1, faits: ['python', 'powerbi'] } } });
  const r = await t.ctx.parcoursPushJeton(false);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { autorise: true, refuse: false, jeton: J2 });
  assert.deepEqual(t.calls[0], ['natif', 'RequeteWidget', 'notifJeton'], 'sans demander l’autorisation');
  await t.ctx.parcoursPushSync();
  assert.deepEqual(rpcs(t.calls).map(b => [b.p_parcours, b.p_jeton]), [['python', J2], ['powerbi', J2]]);
  assert.ok(block.includes("if(parcoursAlertes().length&&parcoursPushPont())parcoursPushJeton(false).then(()=>parcoursPushSync());else parcoursPushSync();"));
  /* La progression garde le jeton et les inscriptions */
  assert.ok(app.includes("const parcoursPush={jeton:typeof pp.jeton==='string'&&/^[0-9a-f]{64,200}$/.test(pp.jeton)?pp.jeton:'',faits:Array.isArray(pp.faits)?[...new Set(pp.faits.filter(pcId))].slice(0,20):[]};"));
});

test('iPhone : le pont demande l’autorisation et rend le jeton reçu par l’AppDelegate', () => {
  assert.ok(swift.includes('import UserNotifications'));
  assert.ok(swift.includes('CAPPluginMethod(name: "notifAutoriser", returnType: CAPPluginReturnPromise)') && swift.includes('CAPPluginMethod(name: "notifJeton", returnType: CAPPluginReturnPromise)'));
  assert.ok(swift.includes('@objc func notifAutoriser(_ call: CAPPluginCall) { notif(call, demander: true) }') && swift.includes('@objc func notifJeton(_ call: CAPPluginCall) { notif(call, demander: false) }'));
  assert.ok(swift.includes('centre.requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in rendre(ok, !ok) }'));
  assert.ok(swift.includes('guard demander else { rendre(false, false); return }'), 'sans demander : jamais la fenêtre d’autorisation');
  assert.ok(swift.includes('NotificationCenter.default.addObserver(forName: .capacitorDidRegisterForRemoteNotifications, object: nil, queue: .main)')
    && swift.includes('dernier = d.map { String(format: "%02x", $0) }.joined()') && swift.includes('UIApplication.shared.registerForRemoteNotifications()'));
  assert.ok(swift.includes('DispatchQueue.main.asyncAfter(deadline: .now() + 10) { rendre() }'), 'pas de réponse d’Apple : on n’attend pas plus de 10 s');
  /* L’AppDelegate, branché par scripts/ios-widget.mjs */
  assert.ok(widget.includes('func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)'));
  assert.ok(widget.includes("if (a.includes('didRegisterForRemoteNotificationsWithDeviceToken')) return;"), 'une seule fois');
  assert.ok(widget.includes('brancherScene(); brancherPush(); };'));
  assert.ok(lire('resources/ios/widget/App/App.entitlements').includes('<key>aps-environment</key>'), 'le droit des push, déjà là (la salle dans l’île)');
});

test('base de l’appli : la table des inscrits, sans droit direct ; parcours_alerter ; Supprimer mon compte les efface', () => {
  assert.ok(sql.includes("parcours text not null check (parcours in ('python', 'excel', 'powerbi')),") && sql.includes("jeton text not null check (jeton ~ '^[0-9a-f]{64,200}$'),") && sql.includes('primary key (cle, parcours)'));
  assert.ok(sql.includes('alter table public.parcours_alerte enable row level security;') && sql.includes('revoke all on public.parcours_alerte from public, anon, authenticated;'));
  assert.ok(sql.includes('grant select, delete on public.parcours_alerte to service_role;'), 'la fonction d’envoi la lit et l’efface');
  assert.ok(sql.includes('create or replace function public.parcours_alerter(p_cle text, p_parcours text, p_jeton text, p_on boolean)') && sql.includes('v_cle text := public.jeu_cle(p_cle);'));
  assert.ok(sql.includes('delete from public.parcours_alerte where cle = v_cle and parcours = p_parcours;'), 'couper l’alerte efface la ligne');
  assert.ok(sql.includes('on conflict (cle, parcours) do update set jeton = excluded.jeton, inscrit_le = now();'));
  assert.ok(sql.includes('grant execute on function public.parcours_alerter(text, text, text, boolean) to anon, authenticated;'));
  assert.ok(sql.includes('  delete from public.parcours_vote where cle = v_cle;\n  delete from public.parcours_alerte where cle = v_cle;'), 'Supprimer mon compte');
  /* L’appel de l’appli a les paramètres de la fonction */
  assert.ok(block.includes("clsRpc('parcours_alerter',{p_cle:clsCle(),p_parcours:id,p_jeton:on?P.jeton:null,p_on:on})"));
  const conf = lire('decouvrir/confidentialite.html');
  assert.ok(conf.includes('<li><b>Alerte «&nbsp;M’avertir au lancement&nbsp;»</b> (facultatif, appli iPhone).') && conf.includes('ton vote, tes alertes de parcours, tes avis sur les leçons'));
});

/* ---------- La fonction d’envoi ---------- */
const lignes = (n, jeton = i => String(i % 10).repeat(64)) => Array.from({ length: n }, (_, i) => ({ cle: i.toString(16).padStart(64, '0'), jeton: jeton(i) }));
function fonction({ cibles = lignes(3), pret = true, reponses = () => ({ status: 200 }) } = {}) {
  const effaces = [], envois = [];
  const h = createAnnonceHandler({ cle: 'mot-de-passe-long', pret, lire: async () => cibles, effacer: async (id, c) => effaces.push([id, ...c]),
    envoyer: async (hote, jeton, charge) => { envois.push([hote, jeton, charge]); return reponses(hote, jeton); } });
  const appel = async (b, cle = 'mot-de-passe-long', methode = 'POST') => {
    const r = await h(new Request('https://x/', { method: methode, headers: cle ? { 'x-annonce': cle } : {}, body: methode === 'POST' ? JSON.stringify(b) : undefined }));
    return [r.status, await r.json()];
  };
  return { appel, effaces, envois };
}

test('parcours-annoncer : seulement avec la clé d’annonce ; l’essai n’envoie rien', async () => {
  const f = fonction();
  assert.deepEqual((await f.appel({ parcours: 'python' }, 'faux'))[0], 401);
  assert.deepEqual((await f.appel({ parcours: 'python' }, ''))[0], 401);
  assert.deepEqual((await f.appel({ parcours: 'sql' }))[0], 400, 'SQL n’est pas un parcours à annoncer');
  assert.deepEqual(await f.appel({ parcours: 'python', essai: true }), [200, { ok: true, essai: true, parcours: 'python', inscrits: 3, cleApple: true }]);
  assert.deepEqual(f.envois, []); assert.deepEqual(f.effaces, []);
  const sans = createAnnonceHandler({ cle: '', pret: true, lire: async () => [], effacer: async () => {}, envoyer: async () => ({}) });
  assert.equal((await sans(new Request('https://x/', { method: 'POST', headers: { 'x-annonce': '' }, body: '{}' }))).status, 401, 'sans secret, personne');
  const veille = fonction({ pret: false });
  assert.deepEqual(await veille.appel({ parcours: 'python' }), [200, { ok: false, veille: true, parcours: 'python', inscrits: 3 }]);
  assert.deepEqual(veille.effaces, [], 'en veille, rien n’est effacé');
  assert.ok(egal('abc', 'abc') && !egal('abc', 'abd') && !egal('abc', 'abcd') && !egal('', ''));
});

test('parcours-annoncer : la notification part à chacun, puis les inscrits servis s’effacent ; un iPhone de développement passe par le bac à sable', async () => {
  const f = fonction({ cibles: lignes(45), reponses: (hote, jeton) => (jeton.startsWith('1') ? (hote === PROD ? { status: 400, raison: 'BadDeviceToken' } : { status: 200 })
    : jeton.startsWith('2') ? { status: 410, raison: 'Unregistered' } : jeton.startsWith('3') ? { status: 503, raison: 'ServiceUnavailable' } : { status: 200 }) });
  const [status, r] = await f.appel({ parcours: 'excel' });
  assert.equal(status, 200);
  assert.deepEqual(r, { ok: true, parcours: 'excel', inscrits: 45, envoyees: 35, oubliees: 5, restantes: 5 });
  assert.ok(f.envois.some(e => e[0] === BAC && e[1].startsWith('1')), 'refusé en production : le bac à sable');
  assert.deepEqual(f.envois[0][2], chargeAnnonce('excel'));
  assert.equal(f.effaces.flatMap(e => e.slice(1)).length, 40, 'les envoyés et les oubliés ; Apple indisponible : gardés pour la prochaine fois');
  assert.ok(f.effaces.every(e => e[0] === 'excel'));
  assert.deepEqual(chargeAnnonce('python'), { aps: { alert: { title: 'Python pour la data est ouvert !', body: 'Le nouveau parcours t’attend dans Requête. Mets l’appli à jour si besoin.' }, sound: 'default' }, parcours: 'python' });
  assert.deepEqual(await pousserUn('9'.repeat(64), {}, async () => ({ status: 400, raison: 'DeviceTokenNotForTopic' })), { ok: false, oublier: true });
});

test('parcours-annoncer : déployée sans JWT, la clé d’Apple de la salle dans l’île, le secret de l’annonce ; la commande est dans IOS.md', () => {
  const idx = lire('supabase/functions/parcours-annoncer/index.ts');
  assert.ok(idx.includes("const cle = Deno.env.get('PARCOURS_ANNONCE_CLE') ?? '';") && idx.includes("'apns-push-type': 'alert', 'apns-topic': sujet"));
  assert.ok(idx.includes('Deno.serve(createAnnonceHandler({cle, pret: !!(pem && kid && equipe), lire, effacer, envoyer}));'));
  assert.equal(lire('supabase/functions/parcours-annoncer/apns.mjs'), lire('supabase/functions/jeu-ile/apns.mjs'), 'la même signature que la salle dans l’île');
  const ios = lire('IOS.md');
  assert.ok(ios.includes('### Le jour où un parcours ouvre : la notification (11 novembre, 15 h 55)'));
  assert.ok(ios.includes(`curl -sS -X POST "https://ynuenrxozcpkrjdbeftc.supabase.co/functions/v1/parcours-annoncer" -H "x-annonce: TA_CLE" -H "Content-Type: application/json" -d '{"parcours":"python","essai":true}'`));
  assert.ok(ios.includes('`PARCOURS_ANNONCE_CLE`, avec un mot de passe que tu choisis'));
  assert.ok(!/—/.test(ios.slice(ios.indexOf('    curl -sS'), ios.indexOf('La fonction (`supabase/functions/parcours-annoncer`)'))), 'pas de tiret long dans les commandes');
});
