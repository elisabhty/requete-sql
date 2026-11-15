/* Elisa, 15 novembre, 16 h 43 : « vasy » (à « Pour que le serveur vérifie directement en anglais, il faudrait modifier la
   vérification sur Supabase : je ne le fais qu’avec ton accord. »).
   Le serveur des salles (supabase/functions/jeu-verifier) a un catalogue par langue : catalog.json (le français) et catalog-en.json
   (les 15 bases et les 477 solutions récrites comme l’appli les récrit en anglais, scripts/build-secure-catalog.cjs). L’appli en
   anglais envoie la requête telle que le joueur l’a écrite, avec langue:'en' (multiplayer-security.js, defiLangueServeur) ; sans
   langue, le français, comme avant (les appareils pas encore à jour). Les règles que le serveur répond en français sont dites en
   anglais dans l’appli (defiErreurSalle, langue-en.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { sqlite, verify } from '../supabase/functions/jeu-verifier/verifier.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fr = JSON.parse(lire('supabase/functions/jeu-verifier/catalog.json'));
const en = JSON.parse(lire('supabase/functions/jeu-verifier/catalog-en.json'));
await sqlite(new Uint8Array(fs.readFileSync(path.join(ROOT, 'vendor/sqljs/sql-wasm.wasm'))));

test('chaque solution anglaise est acceptée sur sa base anglaise ; elle ne passe pas sur la base française', async () => {
  assert.equal(en.challenges.length, fr.challenges.length, 'les 477 défis');
  for (const c of en.challenges) assert.equal(await verify(en, c.id, c.sol), true, c.id);
  for (const id of ['af2', 'kf3', 'ef10', 'gf10', 'rd6']) {
    const e = en.challenges.find(c => c.id === id), f = fr.challenges.find(c => c.id === id);
    await assert.rejects(verify(fr, id, e.sol), /no such/, `${id} : la requête anglaise sur la base française`);
    assert.equal(await verify(fr, id, f.sol), true, `${id} : le français, comme avant`);
  }
  /* un joueur libre : alias, colonnes dans un autre ordre, tri sans la casse */
  assert.equal(await verify(en, 'af2', "SELECT email AS mail, last_name, first_name FROM passengers WHERE nationality='French' ORDER BY last_name,first_name"), true);
  assert.equal(await verify(en, 'af2', "SELECT first_name, last_name, email FROM passengers WHERE nationality='Française' ORDER BY last_name,first_name"), false, 'la valeur française ne compte pas sur la base anglaise');
});

test('index.ts : un catalogue par langue, la langue vérifiée avant toute requête, le français sans langue', () => {
  const idx = lire('supabase/functions/jeu-verifier/index.ts');
  assert.ok(idx.includes('const CATALOGUES:Record<string,unknown>={fr:catalog,en:catalogEn};'));
  assert.ok(idx.includes("||(b.langue!==undefined&&(typeof b.langue!=='string'||!Object.hasOwn(CATALOGUES,b.langue))))return json({error:'Demande invalide.'},400);"), 'une langue inconnue (ou « toString ») : refusée');
  assert.ok(idx.includes("const langue=b.langue===undefined?'fr':b.langue;"));
  assert.ok(idx.includes('ok=await verify(CATALOGUES[langue],attempt.defi,b.sql);'));
  assert.ok(idx.indexOf("const langue=") < idx.indexOf("rpc('jeu_essai_v2'"), 'avant l’essai compté');
});

test('l’appli : la requête telle quelle, avec la langue de la base du défi', () => {
  const ms = lire('multiplayer-security.js'), app = lire('index.html');
  assert.ok(ms.includes('body:JSON.stringify({cle:clsCle(),salle:game.code,g:game.g,n,id,sql,...(langue?{langue}:{})}), signal:controller.signal'));
  assert.ok(ms.includes("const langue = typeof defiLangueServeur === 'function' && typeof CHALLENGES !== 'undefined' ? defiLangueServeur(CHALLENGES.find(x => x.id === round.cid)) : null;"));
  assert.ok(!ms.includes('defiSqlServeur') && !app.includes('defiSqlServeur'), 'plus de requête récrite en français');
  const d = app.indexOf('function defiLangueServeur(c){'), f = app.indexOf('\n', d);
  const ctx = {window: {}};
  vm.runInNewContext(app.slice(d, f) + ';this.f=defiLangueServeur;', ctx);
  assert.equal(ctx.f({base: 'ski'}), null, 'sans le moteur : le français');
  ctx.window.REQUETE_LANGUE = {code: 'en', baseTraduite: id => id === 'ski'};
  assert.equal(ctx.f({base: 'ski'}), 'en');
  assert.equal(ctx.f({base: 'autre'}), null, 'une base pas traduite : le français');
  assert.equal(ctx.f(null), null);
  ctx.window.REQUETE_LANGUE = {code: 'fr', baseTraduite: () => true};
  assert.equal(ctx.f({base: 'ski'}), null, 'en français : rien ne change');
});

test('ce que le serveur répond en français est dit en anglais', async () => {
  const { moteur } = await import(path.join(ROOT, 'tools/langue/commun.mjs'));
  const L = moteur('en');
  const textes = [lire('supabase/functions/jeu-verifier/verifier.mjs'), lire('supabase/functions/jeu-verifier/index.ts')].join('\n');
  const regles = new Set([...textes.matchAll(/(?:Error\(|error:|\|\|)'([A-ZÀ-Ý][^']*\.)'/g)].map(m => m[1]));
  assert.ok(regles.size >= 8, [...regles].join(' / '));
  for (const r of regles) assert.notEqual(L.t(r), r, `pas de traduction : ${r}`);
  for (const r of ['La vérification prend du temps. Réessaie : tes points ne seront pas comptés deux fois.', 'Vérification indisponible. Réessaie.']) assert.notEqual(L.t(r), r, r);
  /* la boîte d’un essai raté en salle : la règle du serveur, dans la langue de l’appli */
  const app = lire('index.html'), d = app.indexOf('function defiErreurSalle(c,sql,brut){'), f = app.indexOf('function errBox(', d);
  const ctx = {window: {REQUETE_LANGUE: {code: 'en', t: x => L.t(x)}}, defiSandbox: () => ({prepare: () => ({free() {}}), close() {}}), sqlCompat: s => s, defiErreurSql: m => m};
  vm.runInNewContext(app.slice(d, f) + ';this.f=defiErreurSalle;', ctx);
  assert.equal(ctx.f({}, 'UPDATE x SET y = 1', 'Utilise une seule requête de lecture SELECT pour ce défi.'), 'Use a single read-only SELECT query for this challenge.');
  ctx.window.REQUETE_LANGUE = {code: 'fr', t: () => 'jamais'};
  assert.equal(ctx.f({}, 'UPDATE x SET y = 1', 'Utilise une seule requête de lecture SELECT pour ce défi.'), 'Utilise une seule requête de lecture SELECT pour ce défi.');
});
