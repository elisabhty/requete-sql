/* Elisa, 11 novembre, 15 h 55 : « Ça peut pas être une notification push ? », sur « M’avertir au lancement » ; puis « Oui, en
   push ». 16 novembre, 17 h 45 (« tu peux supprimer à distance les autres learning path, j’aurais pas besoin ») : les parcours à
   venir sont retirés de l’appli, avec leur alerte. Restent, sans plus rien qui les appelle depuis la page : le pont natif de la 1.0
   (RequetePush, l’AppDelegate), la table des inscrits et la fonction parcours-annoncer dans Supabase. Ces tests les gardent tels
   qu’ils sont en ligne ; l’appli, elle, ne s’inscrit plus. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createAnnonceHandler, chargeAnnonce, egal, pousserUn, PROD, BAC } from '../supabase/functions/parcours-annoncer/handler.mjs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const sql = lire('supabase/migrations/20261111160000_parcours_alerte_push.sql');
const swift = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const widget = lire('scripts/ios-widget.mjs');
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
  assert.ok(widget.includes('brancherScene(); brancherPush(); langues(); icones(); };'));   // 16 novembre : l’anglais et les icônes (retours-0704)
  assert.ok(lire('resources/ios/widget/App/App.entitlements').includes('<key>aps-environment</key>'), 'le droit des push, déjà là (la salle dans l’île)');
});

test('base de l’appli : la table des inscrits, sans droit direct ; parcours_alerter ; Supprimer mon compte les efface ; l’appli ne l’appelle plus', () => {
  assert.ok(sql.includes("parcours text not null check (parcours in ('python', 'excel', 'powerbi')),") && sql.includes("jeton text not null check (jeton ~ '^[0-9a-f]{64,200}$'),") && sql.includes('primary key (cle, parcours)'));
  assert.ok(sql.includes('alter table public.parcours_alerte enable row level security;') && sql.includes('revoke all on public.parcours_alerte from public, anon, authenticated;'));
  assert.ok(sql.includes('grant select, delete on public.parcours_alerte to service_role;'), 'la fonction d’envoi la lit et l’efface');
  assert.ok(sql.includes('create or replace function public.parcours_alerter(p_cle text, p_parcours text, p_jeton text, p_on boolean)') && sql.includes('v_cle text := public.jeu_cle(p_cle);'));
  assert.ok(sql.includes('delete from public.parcours_alerte where cle = v_cle and parcours = p_parcours;'), 'couper l’alerte efface la ligne');
  assert.ok(sql.includes('on conflict (cle, parcours) do update set jeton = excluded.jeton, inscrit_le = now();'));
  assert.ok(sql.includes('grant execute on function public.parcours_alerter(text, text, text, boolean) to anon, authenticated;'));
  assert.ok(sql.includes('  delete from public.parcours_vote where cle = v_cle;\n  delete from public.parcours_alerte where cle = v_cle;'), 'Supprimer mon compte');
  /* 16 novembre : l’appli ne s’inscrit plus (l’alerte est retirée) et la confidentialité n’en parle plus */
  assert.ok(!app.includes("clsRpc('parcours_alerter'") && !app.includes('notifAutoriser') && !app.includes('notifJeton'));
  const conf = lire('decouvrir/confidentialite.html');
  assert.ok(!conf.includes('M’avertir au lancement') && !conf.includes('tes alertes de parcours') && conf.includes('tes avis sur les leçons'));
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

test('parcours-annoncer : déployée sans JWT, la clé d’Apple de la salle dans l’île, le secret de l’annonce ; IOS.md dit qu’elle ne sert plus', () => {
  const idx = lire('supabase/functions/parcours-annoncer/index.ts');
  assert.ok(idx.includes("const cle = Deno.env.get('PARCOURS_ANNONCE_CLE') ?? '';") && idx.includes("'apns-push-type': 'alert', 'apns-topic': sujet"));
  assert.ok(idx.includes('Deno.serve(createAnnonceHandler({cle, pret: !!(pem && kid && equipe), lire, effacer, envoyer}));'));
  assert.equal(lire('supabase/functions/parcours-annoncer/apns.mjs'), lire('supabase/functions/jeu-ile/apns.mjs'), 'la même signature que la salle dans l’île');
  const ios = lire('IOS.md');
  assert.ok(ios.includes('### Le jour où un parcours ouvre : la notification (11 novembre ; retirée le 16 novembre)'));
  assert.ok(ios.includes('la fonction `parcours-annoncer` et le secret `PARCOURS_ANNONCE_CLE`. Les retirer\ntouche la base en ligne : seulement quand Elisa le demande.'));
});
