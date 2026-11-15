/* Elisa, 15 novembre, 17 h 45 : « corrige stp », pour « l’alerte “@léa entre dans la salle” est en français pour tout le monde, et
   sur l’iPhone des autres, dans la Dynamic Island, le nom du défi s’affiche dans la langue de celui qui l’envoie ».
   Chaque téléphone donne sa langue avec le jeton de sa Live Activity (jeu_ile_jeton_v2, p_langue) ; jeu_ile_cibles_v2 la rend avec
   chaque jeton ; la fonction jeu-ile écrit l’alerte et le nom du défi dans la langue de chacun (les titres : titres.mjs, par
   scripts/build-ile-titres.mjs, pris dans le dépôt à un commit figé). Sans langue (une version d’avant), le français. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createIleHandler, etatLangue, alerteServeur } from '../supabase/functions/jeu-ile/handler.mjs';
import * as titres from '../supabase/functions/jeu-ile/titres.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const [FR, EN] = titres.TITRES.af1;   // « Quels vols sont retardés ? » (avec son espace insécable), « Which flights are delayed? »
const etat = {phase: 'partie', joueurs: [{p: 'PIDLEA01', n: '@lea', pts: 0, r: 0, ok: false}, {p: 'PIDSAM01', n: '@sam', pts: 0, r: 0, ok: false}],
  hote: 'PIDLEA01', manche: 1, nb: 3, defi: FR, fin: 0, nouveau: ''};

test('le nom du défi et l’alerte, dans la langue de chaque téléphone', async () => {
  assert.equal(EN, 'Which flights are delayed?');
  assert.equal(etatLangue(etat, 'af1', 'en', titres).defi, EN);
  assert.equal(etatLangue({...etat, defi: EN}, 'af1', 'fr', titres).defi, FR);
  assert.equal(etatLangue(etat, 'inconnu', 'en', titres), etat, 'un défi inconnu : le titre envoyé');
  assert.equal(etatLangue(etat, undefined, 'en', titres), etat, 'une version d’avant (sans defi_id) : le titre envoyé');
  assert.equal(etatLangue(etat, 'af1', 'de', titres).defi, FR, 'une langue inconnue : le français');
  const info = {ok: true, moi: 'PIDSAM01', noms: {PIDSAM01: '@sam', PIDLEA01: '@lea'}};
  const arrive = {...etat, phase: 'attente', nouveau: 'PIDSAM01'};
  assert.deepEqual(alerteServeur(arrive, {type: 'arrivee', texte: 'Salle K7P2QX · 2/4'}, 'K7P2QX', info, 'en'), {titre: '@sam joined the room', texte: 'Room K7P2QX · 2/4', son: 'miaou.wav'});
  assert.deepEqual(alerteServeur(arrive, {type: 'arrivee', texte: 'Salle K7P2QX · 2/4'}, 'K7P2QX', info), {titre: '@sam entre dans la salle', texte: 'Salle K7P2QX · 2/4', son: 'miaou.wav'});
  const fin = {...etat, phase: 'fin', joueurs: [{p: 'PIDLEA01', n: '@lea', pts: 460, r: 1, ok: true}]};
  assert.deepEqual(alerteServeur(fin, {type: 'fin'}, 'K7P2QX', info, 'en'), {titre: 'Game over', texte: '1st: @lea · 460 pts', son: 'default'});

  /* La fonction : une charge par langue, chacun la sienne */
  const envois = [];
  const rpc = async (f) => f === 'jeu_ile_cibles_v2' ? {pareil: false, cibles: [{jeton: 'aaaa1111', bac: false, langue: 'en'}, {jeton: 'bbbb2222', bac: false, langue: 'fr'}, {jeton: 'cccc3333', bac: false}]}
    : f === 'jeu_ile_alerte_v2' ? {ok: true, moi: 'PIDSAM01', noms: {PIDSAM01: '@sam', PIDLEA01: '@lea'}} : null;
  const envoyer = async (hote, jeton, charge) => { envois.push([jeton, charge]); return {status: 200}; };
  const h = createIleHandler({pret: true, rpc, envoyer, titres, maintenant: () => 1_800_000_000});
  const corps = {cle: 'A'.repeat(32), salle: 'K7P2QX', etat: arrive, alerte: {titre: '@sam entre dans la salle', texte: 'Salle K7P2QX · 2/6', son: 'miaou.wav'}, defi_id: 'af1'};
  const r = await h(new Request('https://x.test', {method: 'POST', body: JSON.stringify(corps)}));
  assert.equal(r.status, 200);
  const de = j => envois.find(e => e[0] === j)[1].aps;
  assert.equal(de('aaaa1111').alert.title, '@sam joined the room');
  assert.equal(de('aaaa1111')['content-state'].defi, EN);
  assert.equal(de('bbbb2222').alert.title, '@sam entre dans la salle');
  assert.equal(de('bbbb2222')['content-state'].defi, FR);
  assert.equal(de('cccc3333').alert.title, '@sam entre dans la salle', 'sans langue : le français');
});

test('les titres de la fonction suivent l’appli (titres.mjs à jour, et pris au bon commit)', async () => {
  const html = lire('index.html'), ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const CHALLENGES=['), html.indexOf('const NIV=')).replace('const CHALLENGES=', 'CHALLENGES='), ctx);
  const C = vm.runInContext('CHALLENGES', ctx);
  assert.equal(Object.keys(titres.TITRES).length, C.length, 'un titre par défi : node scripts/build-ile-titres.mjs');
  const { moteur } = await import(path.join(ROOT, 'tools/langue/commun.mjs'));
  const L = moteur('en', ['langue-en-defis.js']);
  for (const c of C.filter((x, i) => i % 23 === 0)) assert.deepEqual(titres.TITRES[c.id], [c.titre, L.t(c.titre)], c.id);
  const index = lire('supabase/functions/jeu-ile/index.ts');
  const m = /import \* as titres from 'https:\/\/raw\.githubusercontent\.com\/elisabhty\/requete-sql\/([0-9a-f]{40})\/supabase\/functions\/jeu-ile\/titres\.mjs';/.exec(index);
  assert.ok(m, 'index.ts prend les titres dans le dépôt, à un commit');
  let fige = '';
  try { fige = execFileSync('git', ['-C', ROOT, 'show', `${m[1]}:supabase/functions/jeu-ile/titres.mjs`], { encoding: 'utf8', maxBuffer: 16 << 20 }); }
  catch (e) { assert.fail(`le commit ${m[1].slice(0, 7)} est introuvable ici (git fetch)`); }
  assert.equal(fige, lire('supabase/functions/jeu-ile/titres.mjs'), 'titres.mjs a changé : pousser, mettre le commit dans index.ts, redéployer jeu-ile');
});

test('la base et l’appli : la langue avec le jeton, l’identifiant du défi avec l’état', () => {
  const sql = lire('supabase/migrations/20261115164831_ile_langue.sql');
  assert.ok(sql.includes("alter table requete_private.ile add column if not exists langue text check (langue is null or langue ~ '^[a-z]{2}$');"));
  assert.ok(sql.includes('drop function if exists public.jeu_ile_jeton_v2(text, text, text);'), 'une seule fonction, l’API sait laquelle appeler');
  assert.ok(sql.includes('create function public.jeu_ile_jeton_v2(p_cle text, p_salle text, p_jeton text, p_langue text default null) returns jsonb'));
  assert.ok(sql.includes('langue = coalesce(excluded.langue, requete_private.ile.langue);'));
  assert.ok(sql.includes("jsonb_build_object('jeton', i.jeton, 'bac', i.bac, 'langue', coalesce(i.langue, 'fr'))"));
  assert.ok(sql.includes('grant execute on function public.jeu_ile_jeton_v2(text, text, text, text) to anon, authenticated;'));
  const app = lire('index.html');
  assert.ok(app.includes("clsRpc('jeu_ile_jeton_v2',{p_cle:clsCle(),p_salle:ev.code,p_jeton:ev.jeton,p_langue:ileSalleLangue()})"));
  assert.ok(app.includes('body:JSON.stringify({cle:clsCle(),salle:J.code,etat,alerte,defi_id:ileSalleDefiId()})'));
});
