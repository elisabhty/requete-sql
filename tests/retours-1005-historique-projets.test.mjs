/* 19 novembre, 10 h 05 (Elisa : « quand on se déconnecte et on se reconnecte, on n’aura plus l’historique de base et tout » ; « oui,
   direct pour tout le monde ») :
   - l’historique des exécutions suit le projet sur le compte (ses 100 dernières), sans renvoyer la base à chaque exécution ;
   - la déconnexion ne vide l’iPhone que si chaque projet est sur le compte, tel quel (une base de plus de 2 Mo : on reste) ;
   - les bases de démo gardent leur Console sur l’iPhone, comme quand on change de compte. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, readdirSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const region = cut('const PRJ={pret', '\n/* Après un changement dans un projet');
const helpers = cut('function dedupeConsoleQueries(list,limit,car){', '\nfunction removeConsoleQuery(');
const json = x => JSON.parse(JSON.stringify(x));

/* La synchro des projets, avec un serveur imité (le sommaire, l’envoi, le téléchargement) */
const monde = ({distant = {}, local = {}, hist = {}, S = null, proprios = {}} = {}) => {
  const envois = [], ls = new Map();
  if (S) ls.set('requete-projets-compte:u1', JSON.stringify(S));
  if (Object.keys(proprios).length) ls.set('requete-projets-proprio', JSON.stringify(proprios));
  const ctx = vm.createContext({
    envois, Promise, JSON, Object, Array, Date, Math, Number, String, Set, Uint8Array, TextEncoder, setTimeout, clearTimeout,
    localStorage: {getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k)},
    window: {REQUETE_AUTH: {jeton: async () => 'j', connecte: () => true},
      REQUETE_MOTEURS: {validateProject: (k, p) => { if (!Array.isArray(p.hist) || p.hist.length > 100) throw new Error('invalid'); return json(p); }}},
    CS: {user: 'u1'}, HIST_MAX: 100, HIST_CAR_MAX: 120000, HIST_SQL_MAX: 20000,
    consoleSqlKey: s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(),
    dbCatalog: Object.keys(local).map(id => ({id, name: 'Base ' + id})), customDbs: Object.fromEntries(Object.keys(local).map(id => [id, {}])),
    projState: Object.fromEntries(Object.keys(local).map(id => [id, {draft: local[id], hist: hist[id] || [], pins: []}])),
    isDemoDb: id => id === 'cours', csStable: x => JSON.stringify(x), u8ToB64: b => 'B64:' + b.length,
    projOf: id => ctx.projState[id] || (ctx.projState[id] = {draft: '', hist: [], pins: []}), saveProjState() {},
    activeTab: 'accueil', consoleView: 'list', activeDbId: '', persistCustomDbs: async () => {}, renderConsoleHome() {}, renderConsoleSide() {}, prjEtiquettes() {},
  });
  vm.runInContext(helpers + region, ctx);
  vm.runInContext(`prjOctetsLocaux=async()=>{const o={};for(const id of Object.keys(customDbs))o[id]=new Uint8Array(${'local'.length});return o;};
    prjSigLocale=id=>prjSig(prjDonnees(id,new Uint8Array(5)));
    prjRecevoir=async(id,data)=>{const w=projOf(id);w.draft=data.draft;prjHistJoindre(id,data.hist,true);};`, ctx);
  ctx.prjAppel = async (jeton, chemin, corps) => {
    if (chemin.startsWith('/rest/v1/projets_etat')) return [{epoch: 0}];
    if (chemin === '/rest/v1/projets_element?select=cle,revision,generation,supprime,modifie_le')
      return Object.entries(distant).map(([id, d]) => ({cle: 'project:' + id, revision: d.rev, generation: 0, supprime: false, modifie_le: '2026-11-19'}));
    if (chemin.startsWith('/rest/v1/projets_element?select=donnees')) { const id = decodeURIComponent(chemin.split('cle=eq.')[1]).slice(8); const d = distant[id]; return [{donnees: d.data, revision: d.rev, generation: 0, supprime: false}]; }
    if (chemin === '/rest/v1/rpc/projets_enregistrer') { envois.push(json(corps)); const id = corps.p_cle.slice(8); distant[id] = {rev: corps.p_revision + 1, data: corps.p_data}; return {ok: true, element: {revision: corps.p_revision + 1, generation: 0}}; }
    return null;
  };
  return {ctx, envois, distant, ls, run: c => vm.runInContext(c, ctx), S: () => JSON.parse(ls.get('requete-projets-compte:u1') || 'null')};
};
const h = (sql, ts, extra = {}) => ({sql, ts, ok: true, n: 3, ms: 1.5, ...extra});

test('l’historique d’un projet, aux limites du compte : 100 au plus, propre (sans « coupe »), requêtes de 12 000 caractères', () => {
  const x = monde({local: {db_a: 'SELECT 1'}, hist: {db_a: [h('SELECT 1', 3, {coupe: true}), h('  ', 2), h('x'.repeat(13000), 1, {err: 'e'.repeat(2500), ok: false}),
    ...Array.from({length: 120}, (_, i) => h('SELECT ' + i, 100 + i))]}});
  const r = x.run("prjHist('db_a')");
  assert.equal(r.length, 100);
  assert.deepEqual(json(r[0]), {sql: 'SELECT 1', ts: 3, ok: true, n: 3, ms: 1.5}, 'sans coupe');
  assert.equal(r[1].sql.length, 12000);
  assert.equal(r[1].err.length, 2000);
  assert.ok(!r.some(q => q.sql === '  '));
});

test('une exécution seule ne renvoie pas le projet ; la déconnexion (hist) l’envoie, avec ses 100 dernières', async () => {
  const x = monde({local: {db_a: 'SELECT 1'}});
  await x.run("prjSyncFaire('u1',false)");
  assert.equal(x.envois.length, 1, 'un projet neuf part');
  assert.deepEqual(x.envois[0].p_data.hist, []);
  x.run("projState.db_a.hist=[{sql:'SELECT * FROM ventes',ts:5,ok:true,n:10,ms:2}]");
  await x.run("prjSyncFaire('u1',false)");
  assert.equal(x.envois.length, 1, 'l’historique seul a changé : la base ne repart pas');
  await x.run("prjSyncFaire('u1',true)");
  assert.equal(x.envois.length, 2, 'à la déconnexion, il part');
  assert.deepEqual(x.envois[1].p_data.hist, [{sql: 'SELECT * FROM ventes', ts: 5, ok: true, n: 10, ms: 2}]);
  assert.equal(x.S().el.db_a.hsig, x.run("prjSig(prjHist('db_a'))"));
  await x.run("prjSyncFaire('u1',true)");
  assert.equal(x.envois.length, 2, 'rien de neuf : rien ne repart');
  x.run("projState.db_a.draft='SELECT 2'");
  await x.run("prjSyncFaire('u1',false)");
  assert.equal(x.envois.length, 3);
  assert.equal(x.envois[2].p_data.hist.length, 1, 'le projet qui part emporte son historique');
});

test('reconnecté sur un iPhone vidé : le projet revient avec son historique ; un projet identique ne devient pas une copie', async () => {
  const data = {name: 'Base db_a', scope: 'complete', draft: 'SELECT 1', desc: '', tdesc: {}, pins: [], hist: [h('SELECT a', 9), h('SELECT b', 7)], database: {b64: 'B64:5'}, baselines: {}};
  const vide = monde({distant: {db_a: {rev: 3, data}}});
  vide.run('dbCatalog=[];customDbs={};projState={}');
  await vide.run("prjSyncFaire('u1',false)");
  assert.deepEqual(json(vide.run("projState.db_a.hist.map(q=>q.sql)")), ['SELECT a', 'SELECT b']);
  /* le même projet ici, sans historique : pas de copie, l’historique du compte le rejoint */
  const meme = monde({distant: {db_a: {rev: 3, data}}, local: {db_a: 'SELECT 1'}, hist: {db_a: [h('SELECT c', 12)]}});
  await meme.run("prjSyncFaire('u1',false)");
  assert.deepEqual(json(meme.run("projState.db_a.hist.map(q=>q.sql)")), ['SELECT c', 'SELECT a', 'SELECT b'], 'le plus récent d’abord');
  assert.equal(meme.run('dbCatalog.length'), 1, 'pas de « (copie) »');
});

test('la déconnexion ne vide l’iPhone que si chaque projet est sur le compte, tel quel, historique compris', async () => {
  const x = monde({local: {db_a: 'SELECT 1', cours: 'SELECT 0'}});
  x.run("dbCatalog.find(d=>d.id==='cours')");
  const sur = () => vm.runInContext(cut('async function deconnexionProjetsSurCompte(uid){', '\n/* La synchro de départ') + "\ndeconnexionProjetsSurCompte('u1')", x.ctx);
  assert.equal(await sur(), false, 'pas encore parti');
  await x.run("prjSyncFaire('u1',true)");
  assert.equal(await sur(), true, 'parti, tel quel (la base de démo ne compte pas)');
  x.run("projState.db_a.hist=[{sql:'SELECT 9',ts:9}]");
  assert.equal(await sur(), false, 'une exécution pas encore partie');
  await x.run("prjSyncFaire('u1',true)");
  assert.equal(await sur(), true);
  x.run("PRJ.lourds.add('db_a')");
  assert.equal(await sur(), false, 'une base de plus de 2 Mo reste sur l’iPhone : on ne vide rien');
  x.run("PRJ.lourds.clear();prjProprio('db_a','u2')");
  assert.equal(await sur(), false, 'le projet d’un autre compte');
  const d = cut('async function seDeconnecter(){', '\n/* Après la déconnexion');
  assert.ok(d.includes("if(envoi&&!envoi.erreur&&!(await deconnexionProjetsSurCompte(uidAvant)))envoi={erreur:'projets'};"));
  assert.ok(d.indexOf('deconnexionProjetsSurCompte(uidAvant)') < d.indexOf('REQUETE_AUTH.signOut()'), 'vérifié avant de quitter le compte');
});

test('les bases de démo gardent leur Console sur l’iPhone (brouillon, historique) ; les projets partent', async () => {
  const ls = new Map([['requete-sql-proj-v1', '{}'], ['requete-langue', 'fr']]);
  const ctx = vm.createContext({
    projState: {cours: {draft: 'SELECT 0', hist: [h('SELECT 0', 1)]}, db_a: {draft: 'x', hist: []}}, isDemoDb: id => id === 'cours', PROJ_KEY: 'requete-sql-proj-v1', KEY: 'k', memStore: {},
    localStorage: {get length() { return ls.size; }, key: i => [...ls.keys()][i], getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), clear: () => ls.clear()},
    sessionStorage: {clear() {}}, window: {}, dbsIdb: async () => { throw new Error('x'); },
  });
  vm.runInContext(cut('const DECONNEXION_GARDE=', '\n/* Après la déconnexion'), ctx);
  await vm.runInContext('deconnexionVider()', ctx);
  assert.deepEqual(JSON.parse(ls.get('requete-sql-proj-v1')), {cours: {draft: 'SELECT 0', hist: [h('SELECT 0', 1)]}});
  assert.equal(ls.get('requete-langue'), 'fr');
});

test('le serveur et l’appli acceptent 100 exécutions par projet', () => {
  const m = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(f => f.endsWith('_projets_historique_100.sql'));
  assert.ok(m && lire('supabase/migrations/' + m).includes("jsonb_array_length(p_data->'hist')>100"));
  assert.ok(lire('account/projects.mjs').includes('queryList(p.hist,100,false)') && lire('compte-moteurs.js').includes('100,!1') || lire('compte-moteurs.js').includes('p.hist,100'));
});
