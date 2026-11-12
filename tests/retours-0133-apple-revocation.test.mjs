/* Elisa, 12 novembre, 1 h 33 : « oui » à la révocation d’Apple. Apple demande aux apps qui proposent « Se connecter avec Apple » de
   révoquer le jeton d’Apple quand la personne supprime son compte (règle 5.1.1(v)). La fonction apple-jeton garde ce jeton à la
   connexion (code d’autorisation échangé chez Apple) et le révoque avant la suppression ; connexion.js et compteSupprimer l’appellent. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {createAppleJetonHandler, secretClient, APPLE} from '../supabase/functions/apple-jeton/handler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cx = fs.readFileSync(path.join(ROOT, 'connexion.js'), 'utf8');
const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261112013500_apple_jeton.sql'), 'utf8');
const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function cleTest() {
  const paire = await webcrypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const der = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', paire.privateKey)).toString('base64');
  return {paire, pem: `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`};
}

test('le secret client d’Apple : un JWT ES256 au nom de l’équipe, pour fr.requete.app, vérifiable avec la clé', async () => {
  const {paire, pem} = await cleTest();
  const jwt = await secretClient({pem, kid: 'ABC123DEFG', equipe: 'TEAM123456', client: 'fr.requete.app', maintenant: 1000});
  const [t, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(b64(t)), {alg: 'ES256', kid: 'ABC123DEFG'});
  assert.deepEqual(JSON.parse(b64(c)), {iss: 'TEAM123456', iat: 1000, exp: 1300, aud: 'https://appleid.apple.com', sub: 'fr.requete.app'});
  assert.ok(await webcrypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, paire.publicKey, b64(s), new TextEncoder().encode(`${t}.${c}`)));
});

function monter({pret = true, apple = {}} = {}) {
  const coffre = new Map(), envois = [];
  const h = createAppleJetonHandler({
    pret, client: 'fr.requete.app',
    utilisateur: async jwt => jwt === 'jwt-ok' ? {id: 'u-1', is_anonymous: false} : null,
    garder: async (id, j) => { coffre.set(id, j); },
    prendre: async id => { const j = coffre.get(id) || null; coffre.delete(id); return j; },
    secret: async () => 'secret-client',
    fetcher: async (url, o) => {
      const champs = Object.fromEntries(new URLSearchParams(o.body));
      envois.push({url, champs});
      const r = apple[url.replace(APPLE, '')] || {status: 200, json: {}};
      return {ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.json)};
    }
  });
  const appel = (corps, jwt = 'jwt-ok') => h(new Request('https://x/apple-jeton', {method: 'POST', headers: jwt ? {authorization: 'Bearer ' + jwt} : {}, body: JSON.stringify(corps)}))
    .then(async r => ({status: r.status, json: await r.json()}));
  return {appel, coffre, envois};
}

test('garder : le code part chez Apple, le jeton de renouvellement est gardé ; révoquer : il part chez Apple puis est oublié', async () => {
  const m = monter({apple: {'/auth/token': {status: 200, json: {refresh_token: 'rt-apple', access_token: 'at'}}}});
  assert.deepEqual(await m.appel({action: 'garder', code: 'c.0abc123def.456'}), {status: 200, json: {ok: true}});
  assert.equal(m.envois[0].url, 'https://appleid.apple.com/auth/token');
  assert.deepEqual(m.envois[0].champs, {client_id: 'fr.requete.app', client_secret: 'secret-client', code: 'c.0abc123def.456', grant_type: 'authorization_code'});
  assert.equal(m.coffre.get('u-1'), 'rt-apple');
  assert.deepEqual(await m.appel({action: 'revoquer'}), {status: 200, json: {ok: true, revoque: true}});
  assert.equal(m.envois[1].url, 'https://appleid.apple.com/auth/revoke');
  assert.deepEqual(m.envois[1].champs, {client_id: 'fr.requete.app', client_secret: 'secret-client', token: 'rt-apple', token_type_hint: 'refresh_token'});
  assert.equal(m.coffre.has('u-1'), false);
  assert.deepEqual(await m.appel({action: 'revoquer'}), {status: 200, json: {ok: true, revoque: false}}, 'plus rien à révoquer');
});

test('les refus : sans compte (401), demande inconnue ou code bizarre (400), sans les secrets (veille) ; Apple qui refuse garde le jeton', async () => {
  const m = monter();
  assert.equal((await m.appel({action: 'garder', code: 'abcdefghijk'}, null)).status, 401);
  assert.equal((await m.appel({action: 'garder', code: 'abcdefghijk'}, 'jwt-faux')).status, 401);
  assert.equal((await m.appel({action: 'voler'})).status, 400);
  assert.equal((await m.appel({action: 'garder', code: 'a b'})).status, 400);
  assert.deepEqual((await monter({pret: false}).appel({action: 'revoquer'})).json, {ok: false, raison: 'veille'});
  const k = monter({apple: {'/auth/revoke': {status: 400, json: {error: 'invalid_client'}}}});
  k.coffre.set('u-1', 'rt');
  assert.deepEqual(await k.appel({action: 'revoquer'}), {status: 502, json: {ok: false, raison: 'apple', detail: 'invalid_client'}});
  assert.equal(k.coffre.get('u-1'), 'rt', 'gardé pour un nouvel essai');
});

test('la base : une table privée, deux fonctions pour la seule fonction serveur, la ligne part avec le compte', () => {
  assert.match(sql, /user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /enable row level security/);
  for (const f of ['apple_jeton_garder\\(uuid, text\\)', 'apple_jeton_prendre\\(uuid\\)']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f} from public, anon, authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${f} to service_role;`));
  }
});

test('l’app : le code d’Apple part à la connexion ; la révocation passe avant compte_supprimer', async () => {
  const appels = [];
  const store = new Map();
  const ctx = {
    Capacitor: {isNativePlatform: () => true, Plugins: {SocialLogin: {initialize: async () => {}, logout: async () => {},
      login: async () => ({result: {idToken: 'jeton-apple', accessToken: {token: 'c.code-apple-123'}, profile: {}}})}}},
    localStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
    fetch: async (url, o) => { appels.push({url, corps: JSON.parse(o.body), auth: o.headers.Authorization});
      const j = url.includes('/auth/v1/token') ? {access_token: 'acces', refresh_token: 'r', expires_in: 3600, user: {id: 'u-1'}} : {ok: true, revoque: true};
      return {ok: true, status: 200, json: async () => j}; },
    crypto: webcrypto, TextEncoder, Uint8Array, Promise, JSON, Math, Date, Number, String, Error,
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'k'
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cx.replace(/var ACTIVE = (true|false);/, 'var ACTIVE = true;'), ctx);
  await ctx.REQUETE_AUTH.signIn('apple');
  await new Promise(r => setTimeout(r, 10));
  const g = appels.find(a => a.url.includes('/functions/v1/apple-jeton'));
  assert.equal(g.url, 'https://exemple.supabase.co/functions/v1/apple-jeton?forceFunctionRegion=eu-west-3');
  assert.deepEqual(g.corps, {action: 'garder', code: 'c.code-apple-123'}); assert.equal(g.auth, 'Bearer acces');
  assert.equal(await ctx.REQUETE_AUTH.revoquerApple(), true);
  assert.deepEqual(appels.at(-1).corps, {action: 'revoquer'});
  const f = app.slice(app.indexOf('async function compteSupprimer('), app.indexOf('\n}\n', app.indexOf('async function compteSupprimer(')));
  assert.ok(f.indexOf('window.REQUETE_AUTH.revoquerApple()') > 0 && f.indexOf('window.REQUETE_AUTH.revoquerApple()') < f.indexOf("clsRpc('compte_supprimer'"),
    'Apple d’abord, tant que le compte existe');
});
