/* Elisa, 12 novembre, 1 h 06 : la connexion Apple + Google, avant la sortie. Se connecter n’a de sens que si la progression suit :
   les moteurs préparés (account/*.mjs, réunis dans compte-moteurs.js) sont branchés sur l’appli (csSync). Deux iPhone et un faux
   serveur qui applique les mêmes règles que progression_* et documents_* : ce qui est fait sur l’un se retrouve sur l’autre. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {assembler} from '../scripts/compte-moteurs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const moteurs = fs.readFileSync(path.join(ROOT, 'compte-moteurs.js'), 'utf8');
const bloc = (() => { const i = app.indexOf('/* ---------- La progression synchronisée avec le compte'); const j = app.indexOf('function obFournisseurOk(f){', i); assert.ok(i > 0 && j > i); return app.slice(i, j); })();

/* Le faux serveur : une époque, des éléments versionnés (révision, génération), les mêmes refus que les vraies fonctions. */
function serveur() {
  const comptes = {};
  const compte = u => comptes[u] || (comptes[u] = {prog: {epoch: 0, el: {}}, docs: {epoch: 0, el: {}}});
  let fusion = (k, a, b) => ({...a, ...b});
  const rpc = (u, nom, b) => {
    const [dom, op] = nom.split('_'), c = compte(u)[dom === 'progression' ? 'prog' : 'docs'];
    const liste = () => Object.values(c.el).sort((x, y) => x.key < y.key ? -1 : 1);
    if (op === 'lire') return {schemaVersion: 1, epoch: c.epoch, elements: liste()};
    if (b.p_epoch !== c.epoch) return {ok: false, reason: 'epoch', epoch: c.epoch};
    if (op === 'effacer') { c.epoch++; c.el = {}; return {ok: true}; }
    const old = c.el[b.p_cle];
    if ((old?.generation || 0) !== b.p_generation) return {ok: false, reason: 'generation', element: old};
    if ((old?.revision || 0) !== b.p_revision) return {ok: false, reason: 'revision', element: old};
    if (op === 'reinitialiser') { c.el[b.p_cle] = {key: b.p_cle, data: {}, revision: (old?.revision || 0) + 1, generation: (old?.generation || 0) + 1, deleted: true}; return {ok: true}; }
    const data = dom === 'progression' ? fusion(b.p_cle, old && !old.deleted ? old.data : {}, b.p_data) : b.p_data;
    c.el[b.p_cle] = {key: b.p_cle, data, revision: (old?.revision || 0) + 1, generation: old?.generation || 0, deleted: false};
    return {ok: true, element: c.el[b.p_cle]};
  };
  return {comptes, rpc, setFusion: f => { fusion = f; }};
}

function appareil(srv, {connecte = true, user = 'u-1', state}) {
  const store = new Map(), rendus = [];
  const ctx = {
    console, JSON, Object, Array, Math, Number, String, Error, Promise, Date, Intl, TextEncoder, URL, AbortController, setTimeout, clearTimeout,
    localStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'k',
    allLessons: [{id: 0}, {id: 1}, {id: 2}], CHALLENGES: [{id: 'f1'}, {id: 'm2'}],
    state, save() { rendus.push('save'); }, stkSync() {}, renderModules() {}, renderDefis() {}, renderProgress() {}, renderCollection() {},
    renderNotes() { rendus.push('notes'); }, renderPlanning() {}, renderCompte() {}, renderGreeting() {},
    addEventListener() {},
    fetch: async (url, o) => {
      const u = String(url);
      if (u.endsWith('/auth/v1/user')) return {ok: true, status: 200, json: async () => ({id: user, is_anonymous: false})};
      const nom = u.split('/rpc/')[1];
      assert.equal(o.headers.Authorization, 'Bearer jeton-' + user, 'chaque appel part avec le jeton du compte');
      return {ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(srv.rpc(user, nom, JSON.parse(o.body))))};
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(moteurs, ctx);
  srv.setFusion(ctx.REQUETE_MOTEURS.mergeProgression);
  ctx.REQUETE_AUTH = {connecte: () => connecte, utilisateur: () => ({id: user}), jeton: async () => 'jeton-' + user};
  vm.runInContext(bloc, ctx);
  return {ctx, store, rendus, get state() { return ctx.state; }};
}

const J = x => JSON.parse(JSON.stringify(x));
const plan = {niveau: 'debutant', rythme: 'regulier', freq: 7, per: 3, mix: true, equilibre: 1, sessions: [{d: '2026-11-12', lessons: [0, 1]}, {d: '2026-11-13', lessons: [2]}], archive: []};

test('compte-moteurs.js est à jour avec account/*.mjs', () => {
  assert.equal(moteurs, assembler(), 'relancer node scripts/compte-moteurs.mjs');
  assert.match(app, /<script src="compte-moteurs\.js\?v=1"><\/script>\n<script src="connexion\.js\?v=1"><\/script>/);
});

test('sans compte connecté, rien ne part', async () => {
  const srv = serveur(), A = appareil(srv, {connecte: false, state: {lessons: {0: {done: true, level: 1}}}});
  assert.equal(await A.ctx.csSync(), null);
  assert.deepEqual(srv.comptes, {});
});

test('un iPhone envoie sa progression, un autre la retrouve en se connectant', async () => {
  const srv = serveur();
  const A = appareil(srv, {state: {
    lessons: {0: {done: true, at: 1762900000123.4, level: 2, due: 1763000000000, etapes: {exo: true, q1: true, bidon: true}}, 1: {level: 0}},
    defis: {f1: true}, entretien: {q7: 'ok', q8: 'nul'}, actDays: {'2026-11-11': 3, 'n’importe': 1},
    plan, notes: [{id: 'n1', txt: 'GROUP BY avant HAVING', sql: '', ctx: '', ts: 100, pin: true}, {id: 'vide', txt: '  ', sql: '', ts: 1}]
  }});
  const r = await A.ctx.csSync({premier: true});
  assert.deepEqual(JSON.parse(JSON.stringify(r)), {progression: 0, notes: 0}, 'tout est parti');
  const el = srv.comptes['u-1'].prog.el;
  assert.deepEqual(Object.keys(el).sort(), ['activity:2026-11-11', 'challenge:f1', 'interview:q7', 'lesson:0', 'lesson:1', 'planning:main']);
  assert.deepEqual(J(el['lesson:0'].data), {done: true, at: 1762900000123, due: 1763000000000, level: 2, etapes: {exo: 1, q1: 1}});
  assert.equal(el['planning:main'].data.sessions.length, 2);
  assert.deepEqual(Object.keys(srv.comptes['u-1'].docs.el), ['note:n1'], 'la note vide ne part pas');

  /* Le deuxième iPhone : son onboarding lui a fait un autre planning ; c’est sa première connexion à ce compte. */
  const B = appareil(srv, {state: {lessons: {2: {done: true, at: 5, level: 1}}, defis: {}, entretien: {}, actDays: {}, notes: [],
    plan: {...plan, sessions: [{d: '2026-11-20', lessons: [2]}]}}});
  await B.ctx.csSync({premier: true});
  assert.equal(B.state.lessons[0].done, true); assert.equal(B.state.lessons[0].at, 1762900000123);
  assert.deepEqual(J(B.state.lessons[0].etapes), {exo: true, q1: true});
  assert.equal(B.state.lessons[2].done, true, 'ce qui était déjà sur cet iPhone reste');
  assert.equal(B.state.defis.f1, true); assert.equal(B.state.entretien.q7, 'ok'); assert.equal(B.state.actDays['2026-11-11'], 1);
  assert.equal(B.state.plan.sessions[0].d, '2026-11-12', 'le planning du compte remplace celui d’un iPhone qui se connecte pour la première fois');
  assert.equal(B.state.notes[0].txt, 'GROUP BY avant HAVING');
  assert.ok(B.rendus.includes('save') && B.rendus.includes('notes'), 'l’appli est enregistrée et redessinée');
  assert.equal(srv.comptes['u-1'].prog.el['lesson:2'].data.done, true, 'et ce qu’il avait rejoint le compte');

  /* Retour sur le premier : il récupère la leçon 2, sans perdre son planning (ce n’est plus sa première fois). */
  A.state.plan = {...plan, sessions: [{d: '2026-11-14', lessons: [0, 1, 2]}]};
  await A.ctx.csSync();
  assert.equal(A.state.lessons[2].done, true);
  assert.equal(srv.comptes['u-1'].prog.el['planning:main'].data.sessions[0].d, '2026-11-14', 'son planning modifié part sur le compte');
});

test('une réussite n’est jamais perdue : un iPhone en retard ne défait pas une leçon réussie ailleurs', async () => {
  const srv = serveur();
  const A = appareil(srv, {state: {lessons: {1: {done: true, at: 9, level: 1}}, notes: []}});
  await A.ctx.csSync({premier: true});
  const B = appareil(srv, {state: {lessons: {1: {level: 0}}, notes: []}});
  await B.ctx.csSync({premier: true});
  assert.equal(srv.comptes['u-1'].prog.el['lesson:1'].data.done, true);
  assert.equal(B.state.lessons[1].done, true);
});

test('une note supprimée l’est aussi sur le compte ; tout effacer vide le compte', async () => {
  const srv = serveur();
  const A = appareil(srv, {state: {lessons: {0: {done: true, at: 1, level: 1}}, notes: [{id: 'n1', txt: 'a', sql: '', ctx: '', ts: 1, pin: false}, {id: 'n2', txt: 'b', sql: '', ctx: '', ts: 2, pin: false}]}});
  await A.ctx.csSync({premier: true});
  A.ctx.csNoteSupprimee('n1');
  await new Promise(r => setTimeout(r, 30));
  assert.equal(srv.comptes['u-1'].docs.el['note:n1'].deleted, true);
  const B = appareil(srv, {state: {lessons: {}, notes: []}});
  await B.ctx.csSync({premier: true});
  assert.deepEqual(J(B.state.notes.map(n => n.id)), ['n2'], 'la note supprimée ne revient pas');
  const CS = vm.runInContext('CS', A.ctx);
  await Promise.all([CS.prog.resetAll('EFFACER'), CS.docs.resetAll('EFFACER')]);
  assert.deepEqual(srv.comptes['u-1'].prog.el, {}); assert.deepEqual(srv.comptes['u-1'].docs.el, {});
  assert.match(app, /await Promise\.all\(\[CS\.prog\.resetAll\('EFFACER'\),CS\.docs\.resetAll\('EFFACER'\)\]\);/);
});

test('les crochets : après un enregistrement (5 s), à la connexion, au lancement, au retour du réseau', () => {
  assert.match(app, /function save\(\)\{[^\n]*if\(typeof csPlusTard==='function'\)csPlusTard\(\); \}/);
  assert.match(app, /save\(\);\n    if\(typeof csSync==='function'\)csSync\(\{premier:true\}\);/);
  assert.match(bloc, /addEventListener\('load',\(\)=>setTimeout\(\(\)=>\{csSync\(\);\},1500\)\)/);
  assert.match(bloc, /addEventListener\('online',\(\)=>\{csSync\(\);\}\)/);
  assert.match(app, /if\(gone&&typeof csNoteSupprimee==='function'\)csNoteSupprimee\(id\);/);
});
