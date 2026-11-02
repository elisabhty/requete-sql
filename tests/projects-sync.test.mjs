import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sqlite} from '../supabase/functions/jeu-verifier/verifier.mjs';
import {createProjectsSync,validateProject,extractPersonalProject,decodeProjectDatabase,projectsFromSnapshot} from '../account/projects.mjs';
const SQL=await sqlite(new Uint8Array(fs.readFileSync(new URL('../vendor/sqljs/sql-wasm.wasm',import.meta.url))));
const db=new SQL.Database();db.run('CREATE TABLE ventes(id INTEGER PRIMARY KEY, total REAL); INSERT INTO ventes VALUES(1,42.5)');const bytes=db.export();db.close();
const meta={id:'db_personal',name:'Mes ventes'};
const workspace=()=>({draft:'SELECT * FROM ventes;',desc:'Projet de vente',tdesc:{ventes:'Mes ventes'},pins:[{sql:'SELECT COUNT(*) FROM ventes;',ts:100}],hist:[{sql:'PRIVATE-HISTORY',ts:101,ok:false,err:'Erreur'}]});
const saved=(name='Mes ventes')=>extractPersonalProject({...meta,name},workspace());
const copy=x=>JSON.parse(JSON.stringify(x));
function localStore(){const map=new Map();let tail=Promise.resolve();return {map,async get(k){return map.has(k)?copy(map.get(k)):null;},async set(k,v){map.set(k,copy(v));},withLock(k,fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};}
function cloud(){
 const users=new Map(),calls=[];const api={calls,offline:false,loseAck:false,state(id){if(!users.has(id))users.set(id,{epoch:0,elements:{}});return users.get(id);},async fetcher(url,args){
  if(api.offline)throw Error('offline');const id=args.headers.Authorization.slice(7),s=api.state(id),b=JSON.parse(args.body),name=url.pathname.split('/').pop();calls.push({id,name,b});let result;
  if(name==='projets_lire')result={schemaVersion:1,epoch:s.epoch,elements:Object.values(s.elements)};
  else if(s.epoch!==b.p_epoch)result={ok:false,reason:'epoch',epoch:s.epoch};
  else if(name==='projets_effacer'){s.epoch++;s.elements={};result={ok:true,epoch:s.epoch};}
  else{const old=s.elements[b.p_cle];
   if((old?.generation||0)!==b.p_generation)result={ok:false,reason:'generation',element:old};
   else if((old?.revision||0)!==b.p_revision)result={ok:false,reason:'revision',element:old};
   else if(name==='projets_reinitialiser'){s.elements[b.p_cle]={key:b.p_cle,data:{},deleted:true,generation:(old?.generation||0)+1,revision:(old?.revision||0)+1};result={ok:true,epoch:s.epoch};}
   else if(old&&!old.deleted&&old.data.scope==='complete'&&b.p_data.scope==='workspace')result={ok:false,reason:'database_removal',element:old};
   else{s.elements[b.p_cle]={key:b.p_cle,data:copy(b.p_data),deleted:false,generation:old?.generation||0,revision:(old?.revision||0)+1};result={ok:true,epoch:s.epoch,element:s.elements[b.p_cle]};if(api.loseAck){api.loseAck=false;throw Error('lost ack');}}
  }
  return new Response(JSON.stringify(result));
 }};return api;
}
function device(api,id='A',store=localStore()){
 const auth={current:id,async getSession(){return {data:{session:{access_token:auth.current}}};},async getUser(token){return {data:{user:{id:token,is_anonymous:false}}};}};
 const options={accountId:id,auth,store,url:'https://example.supabase.co',apikey:'public',enabled:true,fetcher:api.fetcher};return {auth,store,options,sync:createProjectsSync(options)};
}
test('la préparation des projets est inactive et aucun écran ne la charge',async()=>{
 const sync=createProjectsSync();assert.deepEqual(await sync.status(),{enabled:false,pending:0});await assert.rejects(sync.pull(),{code:'sync_disabled'});
 for(const name of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),/account\/projects\.mjs/);
});
test('l’espace choisi garde le travail, sans base, historique ni champs de connexion implicites',()=>{
 const record=extractPersonalProject({...meta,password:'PRIVATE-PASSWORD'}, {...workspace(),credentials:'PRIVATE-KEY'}, {databaseBytes:bytes});
 assert.equal(record.data.scope,'workspace');assert.equal(record.data.database,null);assert.deepEqual(record.data.hist,[]);assert.equal(record.data.draft,'SELECT * FROM ventes;');assert.doesNotMatch(JSON.stringify(record),/PRIVATE/);
});
test('le choix complet préserve une vraie base SQLite et les états de restauration de tables',()=>{
 const record=extractPersonalProject(meta,workspace(),{includeDatabase:true,databaseBytes:bytes,baselines:{ventes:{name:'ventes',b64:Buffer.from(bytes).toString('base64')}},includeHistory:true});
 assert.equal(record.data.scope,'complete');assert.equal(record.data.hist.length,1);const restored=new SQL.Database(decodeProjectDatabase(record.key,record.data));
 try{assert.deepEqual(restored.exec('SELECT total FROM ventes')[0].values,[[42.5]]);}finally{restored.close();}
 assert.equal(record.data.baselines.ventes.b64,record.data.database.b64);
});
test('une sauvegarde complète exige les octets et distingue une base vide de l’absence de base',()=>{
 assert.throws(()=>extractPersonalProject(meta,workspace(),{includeDatabase:true}),{code:'project_database_required'});
 const empty=extractPersonalProject(meta,workspace(),{includeDatabase:true,databaseBytes:new Uint8Array()});assert.equal(decodeProjectDatabase(empty.key,empty.data).length,0);assert.equal(decodeProjectDatabase(saved().key,saved().data),null);
});
test('identifiants réservés, fichiers non SQLite et objets contenant des champs inconnus refusés',()=>{
 assert.throws(()=>extractPersonalProject({id:'cours',name:'Cours'},workspace()),{code:'invalid_project'});
 for(const p of [{...saved().data,secret:'private'},{...saved().data,scope:'complete',database:{b64:btoa('un fichier CSV')}},{...saved().data,pins:[{sql:'SELECT 1',ts:1,token:'private'}]}])assert.throws(()=>validateProject(saved().key,p),{code:'invalid_project'});
 assert.throws(()=>validateProject('project:cours',saved().data),{code:'invalid_project'});
});
test('une modification hors ligne survit au redémarrage dans l’espace projets distinct',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();api.offline=true;await d.sync.enqueue(saved().key,saved().data);await assert.rejects(d.sync.flush());api.offline=false;
 await createProjectsSync(d.options).flush();assert.equal(api.state('A').elements[saved().key].data.name,'Mes ventes');assert.ok(api.calls.every(c=>c.name.startsWith('projets_')));assert.deepEqual([...d.store.map.keys()],['requete-projects-sync-v1:A']);
});
test('deux versions concurrentes restent séparées sans fusion de base ou d’éditeur',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue(saved().key,saved().data);await a.sync.flush();await b.sync.pull();
 await a.sync.enqueue(saved().key,saved('Web').data);await b.sync.enqueue(saved().key,saved('iPhone').data);await a.sync.flush();const result=await b.sync.flush();assert.deepEqual(result.conflicts,[{key:saved().key,reason:'revision'}]);
 assert.equal(api.state('A').elements[saved().key].data.name,'Web');await b.sync.resolve(saved().key,'local');await b.sync.flush();assert.equal(api.state('A').elements[saved().key].data.name,'iPhone');
});
test('une réponse perdue ne crée ni copie ni seconde écriture',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue(saved().key,saved().data);api.loseAck=true;await assert.rejects(d.sync.flush());await d.sync.flush();assert.equal(api.state('A').elements[saved().key].revision,1);
});
test('supprimer un projet exige confirmation et bloque une ancienne sauvegarde',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue(saved().key,saved().data);await a.sync.flush();await b.sync.pull();await b.sync.enqueue(saved().key,saved('Ancien').data);
 await assert.rejects(a.sync.reset(saved().key,'oui'),{code:'confirmation_required'});await a.sync.reset(saved().key,'SUPPRIMER');assert.deepEqual(api.state('A').elements[saved().key].data,{});
 assert.deepEqual((await b.sync.flush()).conflicts,[{key:saved().key,reason:'generation'}]);await assert.rejects(b.sync.resolve(saved().key,'local'),{code:'reset_conflict'});
});
test('un autre compte ne reçoit ni la file ni la liste de projets',async()=>{
 const api=cloud(),a=device(api);await a.sync.pull();await a.sync.enqueue(saved().key,saved().data);a.auth.current='B';const before=api.calls.length;await assert.rejects(a.sync.flush(),{code:'wrong_account'});assert.equal(api.calls.length,before);
 assert.throws(()=>projectsFromSnapshot({userId:'B',schemaVersion:1,epoch:0,elements:[]},{accountId:'A'}),{code:'wrong_account'});
});
test('la projection conserve l’identifiant du projet et ignore le contenu supprimé',()=>{
 const p=saved();const records=projectsFromSnapshot({userId:'A',schemaVersion:1,epoch:0,elements:[{key:p.key,data:p.data,deleted:false,revision:1,generation:0},{key:'project:db_gone',data:{},deleted:true}]},{accountId:'A'});assert.equal(records.length,1);assert.equal(records[0].id,'db_personal');
});

test('un envoi d’espace de travail seul ne peut pas retirer un instantané complet existant',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();const full=extractPersonalProject(meta,workspace(),{includeDatabase:true,databaseBytes:bytes});
 await d.sync.enqueue(full.key,full.data);await d.sync.flush();await d.sync.enqueue(saved().key,saved().data);
 assert.deepEqual((await d.sync.flush()).conflicts,[{key:full.key,reason:'database_removal'}]);
 await assert.rejects(d.sync.resolve(full.key,'local'),{code:'project_database_removal'});assert.equal(api.state('A').elements[full.key].data.scope,'complete');
});
