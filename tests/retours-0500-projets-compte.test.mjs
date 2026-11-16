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
  assert.ok(app.includes("{compte:'Sur ton compte · sans description',lourd:'Plus de 2 Mo : pas sur ton compte'}[prjEtat(d.id)]||'Projet local · sans description'"));
  for (const k of ['Sur ton compte', 'Sur ton compte · sans description', 'Plus de 2 Mo : pas sur ton compte', '(copie)',
    'La base, ses tables, son brouillon et son historique seront supprimés de cet appareil et de ton compte.',
    'Ton pseudo, tes scores et ta place dans les classements, tes avis, ton vote et tes messages, tes projets enregistrés et ton compte.']) assert.ok(en.includes(JSON.stringify(k) + ':'), k);
  const moteurs = fs.readFileSync(path.join(ROOT, 'compte-moteurs.js'), 'utf8');
  assert.ok(moteurs.includes("validateProject:M['projects'].validateProject,decodeProjectDatabase:M['projects'].decodeProjectDatabase"));
});

/* 16 novembre, 5 h 37 (Elisa : « C’est traduit ? Tout ce qu’on a fait aujourd’hui ») : en anglais, la Console avec ses propres projets
   disait encore « 3 projets », « Delete la table commandes » (lu à voix haute), « Supprimer « Shop » ? », « Jointure clients → commandes ». */
test('la Console avec ses propres projets, en anglais', () => {
  const cles = ['{1} projet', '{1} projets', 'Renommer {x1}', 'Supprimer {x1}', 'Supprimer la table {x1}', 'Supprimer « {x1} » ?', 'Aperçu de la table : {x1}',
    'Jointure {x1} → {x2}', 'Jointure {x1} → {x2} : {x3}', 'Table {x1}, {1} lignes, {2} colonnes', 'Table {x1}, {1} ligne, {2} colonne'];
  for (const k of cles) assert.ok(en.includes(JSON.stringify(k) + ':'), k);
  assert.ok(en.includes('"Supprimer la table {x1}": "Delete the {x1} table"'), 'plus précise que « Supprimer {x1} »');
});

/* 16 novembre, 6 h 19 (Elisa : « synchroniser les points avec le nouveau pseudo du compte » ; « ok, et il reste dans les classements,
   remplacé par le pseudo totalement ») : sans compte puis connectée à un compte qui a déjà un joueur, les points de l’iPhone le
   rejoignent (compte_joueur_fusionner, essayée sur une copie du schéma : points, semaine, défis joués, pseudo, signalements). */
test('le joueur de l’iPhone sans compte rejoint celui du compte, ses points avec', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261116052517_compte_joueur_fusionner.sql'), 'utf8');
  for (const k of ["if not exists(select 1 from requete_private.compte_joueur where user_id=v_uid and cle=p_cle) then",
    "if exists(select 1 from requete_private.compte_joueur where cle=p_ancienne) then", 'on conflict (joueur,u) do nothing',
    'pts=pts+v_pts::integer, parties=parties+v_n, best=greatest(best,ja.best)', 'delete from public.jeu_joueur where id=ja.id;',
    'revoke all on function public.compte_joueur_fusionner(text,text) from public, anon;']) assert.ok(sql.includes(k), k);
  assert.ok(!/insert into public\.jeu_signalement/.test(sql), 'les signalements suivent sans nouvelle alerte');
  const r = fn('async function csJoueurReprendre(cle,ancienne,dUnCompte){');
  assert.ok(r.includes("fusion=await clsRpc('compte_joueur_fusionner',{p_ancienne:ancienne,p_cle:cle},{compte:true});"));
  assert.ok(r.includes("if(!(e&&(e.status===404||e.code==='PGRST202'))){CJ.fait='';return null;}"), 'sans réponse : rien n’est libéré, on recommence');
  assert.ok(r.includes("else if(!dUnCompte&&!fusion){"), 'l’ancienne façon seulement sans la fonction');
  assert.ok(en.includes('"Ton compte joue en {x1} : cet iPhone aussi, à la place de {x2}. Tes points et tes parties sans compte s’ajoutent à ceux du compte.":'));
});
