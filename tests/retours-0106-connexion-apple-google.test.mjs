/* Elisa, 12 novembre, 1 h 04 à 1 h 06 : « Il faut brancher la connexion », avant la sortie, avec Google et Apple (Apple l’exige dès
   qu’on propose Google, règle 4.8). connexion.js définit REQUETE_AUTH : la feuille d’Apple ou de Google (plugin
   @capgo/capacitor-social-login) rend un jeton d’identité, que Supabase échange contre une session ; la session est gardée, renouvelée,
   oubliée quand le serveur ne la reconnaît plus. Tant que l’interrupteur ACTIVE est à false, rien n’est défini. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash, webcrypto} from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'connexion.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fn = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };

function monter({actif = true, google = false, login, reponses = []} = {}) {
  let code = src.replace(/var ACTIVE = (true|false);/, `var ACTIVE = ${actif};`)
    .replace(/var GOOGLE_IOS = '[^']*';/, google ? "var GOOGLE_IOS = '123-ios.apps.googleusercontent.com';" : "var GOOGLE_IOS = '';")
    .replace(/var GOOGLE_WEB = '[^']*';/, google ? "var GOOGLE_WEB = '123-web.apps.googleusercontent.com';" : "var GOOGLE_WEB = '';");
  const store = new Map(), appels = [], evenements = [];
  const SL = {
    init: null, logins: [], logouts: [],
    initialize(o) { this.init = o; return Promise.resolve(); },
    login(o) { this.logins.push(o); return login ? login(o) : Promise.resolve({provider: o.provider, result: {idToken: 'jeton-' + o.provider, profile: {givenName: ' Elisa '}}}); },
    logout(o) { this.logouts.push(o); return Promise.resolve(); }
  };
  const file = reponses.slice();
  const ctx = {
    Capacitor: {isNativePlatform: () => true, Plugins: {SocialLogin: SL}},
    localStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
    fetch: (url, o) => { appels.push({url, o, corps: JSON.parse(o.body)}); const r = file.shift() || {status: 200, json: {}}; return Promise.resolve({ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.json)}); },
    crypto: webcrypto, TextEncoder, Uint8Array, Promise, JSON, Math, Date, Number, String, Array, Error,
    CustomEvent: class { constructor(t) { this.type = t; } },
    dispatchEvent: e => evenements.push(e.type),
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_test'
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return {A: ctx.REQUETE_AUTH, SL, store, appels, evenements};
}
const session = (n = 3600) => ({access_token: 'acces', refresh_token: 'renouv', expires_in: n, user: {id: 'u-1', email: 'elisa@exemple.fr'}});

test('éteint (ACTIVE à false) : pas de REQUETE_AUTH, l’appli reste sans compte ; allumée le 12 novembre, avec les identifiants Google', () => {
  assert.equal(monter({actif: false}).A, undefined);
  assert.match(src, /var ACTIVE = true;/, '12 novembre, 7 h 40 : réglages Apple, Google et Supabase faits');
  assert.match(src, /var GOOGLE_IOS = '473682844926-[0-9a-z]+\.apps\.googleusercontent\.com';/);
  assert.match(src, /var GOOGLE_WEB = '473682844926-[0-9a-z]+\.apps\.googleusercontent\.com';/);
});

test('Apple seul tant que les identifiants Google sont vides ; Apple et Google quand ils sont posés', () => {
  assert.deepEqual([...monter().A.fournisseurs], ['apple']);
  assert.deepEqual([...monter({google: true}).A.fournisseurs], ['apple', 'google']);
});

test('Apple : le plugin reçoit l’empreinte du nonce, Supabase le nonce ; la session est gardée', async () => {
  const {A, SL, store, appels} = monter({reponses: [{status: 200, json: session()}]});
  const r = await A.signIn('apple');
  assert.deepEqual(JSON.parse(JSON.stringify(SL.init)), {apple: {clientId: 'fr.requete.app'}});
  const opt = SL.logins[0];
  assert.equal(opt.provider, 'apple'); assert.deepEqual([...opt.options.scopes], ['email', 'name']);
  const {url, o, corps} = appels[0];
  assert.equal(url, 'https://exemple.supabase.co/auth/v1/token?grant_type=id_token');
  assert.equal(o.headers.apikey, 'sb_publishable_test');
  assert.equal(corps.provider, 'apple'); assert.equal(corps.id_token, 'jeton-apple');
  assert.equal(createHash('sha256').update(corps.nonce).digest('hex'), opt.options.nonce, 'Apple signe l’empreinte, Supabase la recalcule');
  assert.deepEqual(JSON.parse(JSON.stringify(r)), {id: 'u-1', email: 'elisa@exemple.fr', prenom: 'Elisa', label: 'elisa@exemple.fr'});
  assert.equal(A.connecte(), true);
  assert.equal(JSON.parse(store.get('requete-session')).fournisseur, 'apple');
});

test('la feuille fermée (Apple 1001, Google -5) : null, rien d’envoyé ; une vraie erreur remonte', async () => {
  for (const e of [{code: '1001', message: 'The operation couldn’t be completed. (1001)'}, {message: 'The user canceled the sign-in flow. (-5)'}]) {
    const {A, appels} = monter({login: () => Promise.reject(e)});
    assert.equal(await A.signIn('apple'), null); assert.equal(appels.length, 0);
  }
  const {A} = monter({reponses: [{status: 400, json: {msg: 'Unacceptable audience in id_token'}}]});
  await assert.rejects(A.signIn('apple'), /Unacceptable audience/);
  assert.equal(A.connecte(), false);
  await assert.rejects(monter().A.signIn('google'), /indisponible/, 'Google non configuré : refusé avant toute feuille');
});

test('Google : les deux identifiants au plugin, pas de nonce (Skip nonce check côté Supabase)', async () => {
  const {A, SL, appels} = monter({google: true, reponses: [{status: 200, json: session()}]});
  await A.signIn('google');
  assert.equal(SL.init.google.iOSClientId, '123-ios.apps.googleusercontent.com');
  assert.equal(SL.init.google.iOSServerClientId, '123-web.apps.googleusercontent.com');
  assert.equal(appels[0].corps.provider, 'google'); assert.equal(appels[0].corps.nonce, undefined);
});

test('le jeton : valide, il sert tel quel ; près d’expirer, il est renouvelé une seule fois ; refusé, la session est oubliée', async () => {
  let m = monter({reponses: [{status: 200, json: session()}]});
  await m.A.signIn('apple');
  assert.equal(await m.A.jeton(), 'acces'); assert.equal(m.appels.length, 1);
  m = monter({reponses: [{status: 200, json: session(30)}, {status: 200, json: {...session(), access_token: 'neuf'}}]});
  await m.A.signIn('apple');
  const [a, b] = await Promise.all([m.A.jeton(), m.A.jeton()]);
  assert.equal(a, 'neuf'); assert.equal(b, 'neuf');
  assert.equal(m.appels.length, 2, 'un seul renouvellement pour deux demandes');
  assert.equal(m.appels[1].url, 'https://exemple.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.equal(m.appels[1].corps.refresh_token, 'renouv');
  m = monter({reponses: [{status: 200, json: session(30)}, {status: 400, json: {error_code: 'refresh_token_not_found'}}]});
  await m.A.signIn('apple');
  assert.equal(await m.A.jeton(), null); assert.equal(m.A.connecte(), false);
  assert.deepEqual(m.evenements, ['requete-session-perdue']);
});

test('se déconnecter : la session est oubliée tout de suite, fermée sur le serveur et chez Apple', async () => {
  const {A, SL, appels} = monter({reponses: [{status: 200, json: session()}, {status: 204, json: null}]});
  await A.signIn('apple');
  await A.signOut();
  assert.equal(A.connecte(), false);
  assert.equal(appels[1].url, 'https://exemple.supabase.co/auth/v1/logout');
  assert.equal(appels[1].o.headers.Authorization, 'Bearer acces');
  assert.equal(SL.logouts[0].provider, 'apple');
});

test('l’appli : la page ne montre que les fournisseurs du crochet ; le jeton du compte ne part qu’avec {compte:true}', async () => {
  const ctx = vm.createContext({window: {}});
  vm.runInContext(fn('obFournisseurOk'), ctx);
  assert.equal(ctx.obFournisseurOk('email'), true, 'sans crochet, rien ne change');
  ctx.window.REQUETE_AUTH = {fournisseurs: ['apple', 'google']};
  assert.equal(ctx.obFournisseurOk('google'), true); assert.equal(ctx.obFournisseurOk('email'), false);
  assert.match(app, /\$\{obFournisseurOk\('email'\)\?`<p class="ob-divider"/, 'le champ e-mail et son « ou » disparaissent');
  assert.match(app, /<script src="connexion\.js\?v=1"><\/script>/);
  const vus = [];
  const c2 = vm.createContext({window: {REQUETE_AUTH: {jeton: () => Promise.resolve('acces')}}, JEU_SB: 'https://x', JEU_SB_KEY: 'k', Promise, JSON, Object,
    fetch: (u, o) => { vus.push(o.headers); return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({ok: true})}); }});
  vm.runInContext(fn('clsRpc'), c2);
  await c2.clsRpc('jeu_pays', {p_cle: 'x'});
  await c2.clsRpc('compte_supprimer', {p_cle: 'x'}, {compte: true});
  assert.equal(vus[0].Authorization, undefined, 'les appels du jeu partent comme avant');
  assert.equal(vus[1].Authorization, 'Bearer acces');
  assert.match(fn('compteSupprimer'), /clsRpc\('compte_supprimer',\{p_cle:cle\},\{compte:connecte\}\)/);
});
