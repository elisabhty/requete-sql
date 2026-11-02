import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDocumentsSync,validateDocument,extractSavedNotes,notesFromSnapshot} from '../account/documents.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const note=(txt='Texte',sql='SELECT 1;')=>({txt,sql,ctx:'Leçon 0',ts:100,pin:false});
function store(){const map=new Map();let chain=Promise.resolve();return {map,async get(k){return map.has(k)?copy(map.get(k)):null;},async set(k,v){map.set(k,copy(v));},withLock(k,fn){const next=chain.then(fn);chain=next.catch(()=>{});return next;}};}
function cloud(){
 const users=new Map(),calls=[];const api={calls,offline:false,loseAck:false,state(id){if(!users.has(id))users.set(id,{epoch:0,elements:{}});return users.get(id);},async fetcher(url,args){
  if(api.offline)throw Error('offline');const id=args.headers.Authorization.slice(7),s=api.state(id),b=JSON.parse(args.body),name=url.pathname.split('/').pop();calls.push({id,name,b});let result;
  if(name==='documents_lire')result={schemaVersion:1,epoch:s.epoch,elements:Object.values(s.elements)};
  else if(b.p_epoch!==s.epoch)result={ok:false,reason:'epoch',epoch:s.epoch};
  else if(name==='documents_effacer'){s.epoch++;s.elements={};result={ok:true,epoch:s.epoch};}
  else{
   const old=s.elements[b.p_cle];
   if((old?.generation||0)!==b.p_generation)result={ok:false,reason:'generation',element:old};
   else if((old?.revision||0)!==b.p_revision)result={ok:false,reason:'revision',element:old};
   else if(name==='documents_reinitialiser'){s.elements[b.p_cle]={key:b.p_cle,data:{},generation:(old?.generation||0)+1,revision:(old?.revision||0)+1,deleted:true};result={ok:true,epoch:s.epoch};}
   else{s.elements[b.p_cle]={key:b.p_cle,data:copy(b.p_data),generation:old?.generation||0,revision:(old?.revision||0)+1,deleted:false};result={ok:true,epoch:s.epoch,element:s.elements[b.p_cle]};if(api.loseAck){api.loseAck=false;throw Error('lost ack');}}
  }
  return new Response(JSON.stringify(result));
 }};return api;
}
function device(api,id='A',local=store()){
 const auth={current:id,async getSession(){return {data:{session:{access_token:auth.current}}};},async getUser(token){return {data:{user:{id:token,is_anonymous:false}}};}};
 const options={accountId:id,auth,store:local,url:'https://example.supabase.co',apikey:'public',enabled:true,fetcher:api.fetcher};
 return {sync:createDocumentsSync(options),options,auth,local};
}
test('les notes restent inactives et aucun écran ne charge leur synchronisation',async()=>{
 const sync=createDocumentsSync();assert.deepEqual(await sync.status(),{enabled:false,pending:0});await assert.rejects(sync.pull(),{code:'sync_disabled'});
 for(const file of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/account\/documents\.mjs/);
});
test('seules les notes choisies sont extraites, avec leur requête sauvegardée exacte',()=>{
 const sql="SELECT 'un secret choisi';\n-- ne pas exécuter\nDROP TABLE exemple;";
 const records=extractSavedNotes([{id:'n123',...note('Texte',sql),draft:'PRIVATE-DRAFT',database:'PRIVATE-DATABASE',token:'PRIVATE-TOKEN'}]);
 assert.deepEqual(records,[{key:'note:n123',data:note('Texte',sql)}]);assert.doesNotMatch(JSON.stringify(records),/PRIVATE-/);
 assert.throws(()=>extractSavedNotes({notes:[]}),{code:'invalid_document'});
});
test('les champs incomplets, identifiants ambigus et contenus hors limites sont refusés',()=>{
 for(const [key,data] of [['note:n',{}],['note:n',{...note(),token:'x'}],['lesson:0',note()],['note:n',note('','')],['note:n',{...note(),sql:'x'.repeat(12001)}],['note:n',{...note(),txt:'x\0y'}]])assert.throws(()=>validateDocument(key,data),{code:'invalid_document'});
 assert.throws(()=>extractSavedNotes([{id:'n',...note()},{id:'n',...note()}]),{code:'invalid_document'});
});
test('une modification hors ligne survit au redémarrage et n’utilise que les RPC de documents',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();api.offline=true;await d.sync.enqueue('note:n1',note());await assert.rejects(d.sync.flush(),/offline/);
 api.offline=false;const restarted=createDocumentsSync(d.options);await restarted.flush();assert.equal((await restarted.status()).pending,0);assert.equal(api.state('A').elements['note:n1'].data.sql,'SELECT 1;');assert.ok(api.calls.every(c=>c.name.startsWith('documents_')));
 assert.ok([...d.local.map.keys()].every(k=>k==='requete-documents-sync-v1:A'));
});
test('deux modifications concurrentes gardent les deux versions jusqu’au choix explicite',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('note:n1',note());await a.sync.flush();await b.sync.pull();
 await a.sync.enqueue('note:n1',note('Depuis le web'));await b.sync.enqueue('note:n1',{...note('Depuis iPhone'),pin:true});await a.sync.flush();
 const r=await b.sync.flush();assert.deepEqual(r.conflicts,[{key:'note:n1',reason:'revision'}]);assert.equal(r.pending,1);assert.equal(api.state('A').elements['note:n1'].data.txt,'Depuis le web');
 await b.sync.resolve('note:n1','local');await b.sync.flush();assert.equal(api.state('A').elements['note:n1'].data.txt,'Depuis iPhone');assert.equal(api.state('A').elements['note:n1'].data.pin,true);
});
test('le SQL peut être vidé et les champs ne sont pas fusionnés entre versions',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('note:n1',note());await d.sync.flush();await d.sync.enqueue('note:n1',note('Texte seul',''));await d.sync.flush();assert.equal(api.state('A').elements['note:n1'].data.sql,'');
});
test('un accusé perdu n’enregistre pas deux fois une note',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('note:n1',note());api.loseAck=true;await assert.rejects(d.sync.flush());await d.sync.flush();assert.equal(api.state('A').elements['note:n1'].revision,1);
});
test('la suppression exige confirmation et bloque une ancienne édition hors ligne',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('note:n1',note());await a.sync.flush();await b.sync.pull();await b.sync.enqueue('note:n1',note('Ancien'));
 await assert.rejects(a.sync.reset('note:n1','oui'),{code:'confirmation_required'});await a.sync.reset('note:n1','SUPPRIMER');assert.deepEqual(api.state('A').elements['note:n1'].data,{});
 assert.deepEqual((await b.sync.flush()).conflicts,[{key:'note:n1',reason:'generation'}]);await assert.rejects(b.sync.resolve('note:n1','local'),{code:'reset_conflict'});
});
test('effacer les documents change leur époque et ne touche aucun autre compte',async()=>{
 const api=cloud(),a=device(api),b=device(api,'B');await a.sync.pull();await b.sync.pull();await b.sync.enqueue('note:n1',note('B'));await b.sync.flush();await a.sync.enqueue('note:n1',note('Ancien A'));await a.sync.resetAll('EFFACER');
 assert.equal(api.state('B').elements['note:n1'].data.txt,'B');assert.equal(api.state('A').epoch,1);assert.equal((await a.sync.status()).pending,0);
});
test('changer de compte ne transmet jamais les notes de la session précédente',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('note:n1',note());d.auth.current='B';const before=api.calls.length;await assert.rejects(d.sync.flush(),{code:'wrong_account'});assert.equal(api.calls.length,before);assert.equal((await d.sync.status()).pending,1);
});
test('la projection restitue les identifiants et épingles, sans exposer les marqueurs supprimés',()=>{
 const s={userId:'A',schemaVersion:1,epoch:0,elements:[{key:'note:n1',data:note('A'),deleted:false},{key:'note:n2',data:{...note('B'),pin:true},deleted:false},{key:'note:gone',data:{},deleted:true}]};
 assert.deepEqual(notesFromSnapshot(s,{accountId:'A'}).map(n=>n.id),['n2','n1']);assert.throws(()=>notesFromSnapshot(s,{accountId:'B'}),{code:'wrong_account'});
});
