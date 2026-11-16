/* 16 novembre, 5 h (Elisa : « Ok go », pour que les projets de la Console suivent le compte, avec 2 Mo au plus par base).
   Le compte les gardait déjà (projets_element, préparé le 2 novembre, jamais branché) : l’appli les y envoie et les en reçoit.
   Les parcours de bout en bout (deux iPhone simulés, faux serveur) ont vérifié : l’envoi, l’arrivée sur un autre iPhone, la retouche
   qui revient, le projet ouvert à l’écran qui n’est pas remplacé, le conflit (copie gardée), la suppression partout (même faite hors
   connexion), la base trop lourde qui reste ici, et le changement de compte (Elisa → Paul → Elisa). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {validateProject} from '../account/projects.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const en = fs.readFileSync(path.join(ROOT, 'langue-en.js'), 'utf8');
const fn = nom => { const i = app.indexOf(nom); assert.ok(i > 0, nom); return app.slice(i, app.indexOf('\n}\n', i) + 2); };
const ligne = debut => { const i = app.indexOf(debut); assert.ok(i > 0, debut); return app.slice(i, app.indexOf('\n', i) + 1); };

function bac() {
  const ctx = {dbCatalog: [], projState: {}, btoa: s => Buffer.from(s, 'binary').toString('base64'), Uint8Array, Math, Number, Object, Array, String, JSON};
  vm.createContext(ctx);
  vm.runInContext(fn('function u8ToB64(u8){') + ligne('const csStable=') + ligne('const prjCoupe=') + fn('function prjEmpreinte(t){') + ligne('const prjSig=') + fn('function prjDonnees(id,octets){') + 'this.prjSig=prjSig;', ctx);
  return ctx;
}
const SQLITE = () => { const b = new Uint8Array(4096); b.set(Buffer.from('SQLite format 3\0', 'binary')); return b; };

test('un projet part aux limites du compte : sa base, son brouillon, ses descriptions, ses épingles ; sans historique ni copies', () => {
  const c = bac();
  c.dbCatalog.push({id: 'db_m1', name: 'Analyse des ventes'});
  c.projState.db_m1 = {draft: 'SELECT 1', desc: 'Mes ventes', tdesc: {ventes: 'Une ligne par vente', 'x\0': 'non'}, hist: [{sql: 'SELECT 2', ts: 1}],
    pins: [{sql: '  ', ts: 1}, {sql: 'SELECT SUM(m) FROM ventes', ts: 1763264000000.4, n: 3}, ...Array.from({length: 14}, (_, i) => ({sql: 'SELECT ' + i, ts: i}))]};
  const d = c.prjDonnees('db_m1', SQLITE());
  const ok = validateProject('project:db_m1', JSON.parse(JSON.stringify(d)));
  assert.equal(ok.scope, 'complete');
  assert.deepEqual(ok.hist, []); assert.deepEqual(ok.baselines, {});
  assert.equal(ok.pins.length, 12); assert.deepEqual(ok.pins[0], {sql: 'SELECT SUM(m) FROM ventes', ts: 1763264000000});
  assert.deepEqual(ok.tdesc, {ventes: 'Une ligne par vente'});
  /* trop long : coupé aux limites du compte, sans casser un caractère */
  c.projState.db_m1.draft = '😀'.repeat(13000);
  c.dbCatalog[0].name = ' '.repeat(5);
  const long = validateProject('project:db_m1', JSON.parse(JSON.stringify(c.prjDonnees('db_m1', SQLITE()))));
  assert.equal([...long.draft].length, 12000); assert.equal(long.name, 'Mon projet');
});

test('l’empreinte ne dépend pas de l’ordre des clés (le compte les renvoie triées à sa façon)', () => {
  const c = bac();
  const a = {name: 'x', scope: 'complete', tdesc: {b: '1', a: '2'}}, b = {tdesc: {a: '2', b: '1'}, scope: 'complete', name: 'x'};
  assert.equal(c.prjSig(a), c.prjSig(b));
  assert.notEqual(c.prjSig(a), c.prjSig({...a, name: 'y'}));
});

test('la synchro : sommaire d’abord, puis seulement ce qui a changé ; ouvert à l’écran, jamais remplacé', () => {
  const f = fn('async function prjSyncFaire(uid){');
  assert.ok(f.includes("'/rest/v1/projets_element?select=cle,revision,generation,supprime,modifie_le'"), 'le sommaire, sans les données');
  assert.ok(f.includes("'/rest/v1/projets_element?select=donnees,revision,generation,supprime&cle=eq.'"), 'un projet à la fois');
  assert.ok(f.includes("'/rest/v1/rpc/projets_enregistrer'") && f.includes("'/rest/v1/rpc/projets_reinitialiser'"));
  assert.ok(f.includes('if(oct.length>PRJ_MAX){PRJ.lourds.add(id);continue;}') && app.includes('const PRJ_MAX=2097152'), '2 Mo au plus');
  assert.ok(f.includes('if(proprios[id]&&proprios[id]!==uid)continue;'), 'le projet d’un autre compte ne part pas');
  assert.ok(f.includes('if(prjOuvert(id))continue;'), 'le projet ouvert attend');
  assert.ok(f.includes('if(!m||m.sig!==sig){prjCopier(id,uid);bilan.copies++;}'), 'changé des deux côtés : la version d’ici en copie');
  assert.ok(fn('function prjOuvert(id){').includes("activeTab==='console'&&consoleView==='work'&&activeDbId===id"));
  /* branchée sur la synchro du compte, après un changement de projet, et au départ */
  assert.ok(fn('function csSync(o){').includes('rj=await prjSync({force:!!(o&&(o.premier||o.force))})'));
  assert.ok(fn('async function persistCustomDbs(seul){').includes('try{prjPlanifier();}catch(e){}'));
  assert.ok(fn('function saveProjState(){').includes('try{prjPlanifier();}catch(e){}'));
  assert.ok(app.includes('    loadProjState();\n    PRJ.pret=true;'), 'pas avant que les projets soient chargés');
  assert.ok(fn('async function seDeconnecter(){').includes('csSync({force:true})'));
});

test('supprimer : partout, même hors connexion ; un autre compte : ceux du compte d’avant quittent l’appareil', () => {
  assert.ok(fn('function deleteDbFin(id){').includes('try{prjSupprime(id);}catch(e){}'));
  const s = fn('function prjSupprime(id){');
  assert.ok(s.includes('const S=prjLire(pr);if(S.el[id]){S.el[id].del=true;S.el[id].delAt=Date.now();prjEcrire(pr,S);}'), 'marqué pour le compte qui l’avait');
  assert.ok(fn('function deleteDb(id){').includes("prjEtat(id)==='compte'?'La base, ses tables, son brouillon et son historique seront supprimés de cet appareil et de ton compte.'"));
  const v = fn('function prjViderPourAutre(avant){');
  assert.ok(v.includes('if(sig&&sig===m.sig)deleteDbFin(id);'), 'seulement ceux qui sont bien sur le compte d’avant');
  /* supprimer son compte : les bases enregistrées (IndexedDB) partent aussi, comme la fenêtre le promettait */
  const c = fn('async function compteSupprimer(){');
  assert.ok(c.indexOf('tx.objectStore(DBS_STORE).clear()') > 0 && c.indexOf('tx.objectStore(DBS_STORE).clear()') < c.indexOf('localStorage.clear()'));
  assert.ok(app.includes("tes avis, ton vote et tes messages${compte?', tes projets enregistrés et ton compte':''}."));
});

test('ce que la Console en dit, en français et en anglais', () => {
  assert.ok(fn('function prjEtiquette(id){').includes("prjEtat(id)==='compte'?'Sur ton compte':'Projet local'"), 'en tête : court (iPhone SE)');
  assert.ok(app.includes("{compte:'Sur ton compte · sans description',lourd:'Plus de 2 Mo : reste sur cet appareil'}[prjEtat(d.id)]||'Projet local · sans description'"));
  for (const k of ['Sur ton compte', 'Sur ton compte · sans description', 'Plus de 2 Mo : reste sur cet appareil', '(copie)',
    'La base, ses tables, son brouillon et son historique seront supprimés de cet appareil et de ton compte.',
    'Ton pseudo, tes scores et ta place dans les classements, tes avis, ton vote et tes messages, tes projets enregistrés et ton compte.']) assert.ok(en.includes(JSON.stringify(k) + ':'), k);
  const moteurs = fs.readFileSync(path.join(ROOT, 'compte-moteurs.js'), 'utf8');
  assert.ok(moteurs.includes("validateProject:M['projects'].validateProject,decodeProjectDatabase:M['projects'].decodeProjectDatabase"));
});
