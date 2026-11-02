import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createProgressionSync,extractProgression,validateProgression,mergeProgression} from '../account/progression.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
function storage(){const map=new Map();let tail=Promise.resolve();return {map,fail:false,async get(key){return map.has(key)?copy(map.get(key)):null;},async set(key,value){if(this.fail)throw Error('disk unavailable');map.set(key,copy(value));},withLock(key,fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};}
function cloud(){
 const accounts=new Map(),requests=[];
 const api={accounts,requests,offline:false,loseAck:false,hook:null,state(id){if(!accounts.has(id))accounts.set(id,{epoch:0,elements:{}});return accounts.get(id);},async fetcher(url,opts){
  if(api.offline)throw Error('offline');
  const id=opts.headers.Authorization.replace('Bearer token:',''),s=api.state(id),args=JSON.parse(opts.body),name=url.pathname.split('/').pop();requests.push({id,name,args});if(api.hook){api.hook();api.hook=null;}
  const snapshot=()=>({schemaVersion:1,epoch:s.epoch,elements:copy(Object.values(s.elements))});let result;
  if(name==='progression_lire')result=snapshot();
  else if(args.p_epoch!==s.epoch)result={ok:false,reason:'epoch',epoch:s.epoch};
  else if(name==='progression_effacer'){s.epoch++;s.elements={};result={ok:true,epoch:s.epoch};}
  else{
   const old=s.elements[args.p_cle];
   if((old?.generation||0)!==args.p_generation)result={ok:false,reason:'generation',element:copy(old||null)};
   else if((old?.revision||0)!==args.p_revision)result={ok:false,reason:'revision',element:copy(old||null)};
   else if(name==='progression_reinitialiser'){
    for(const key of args.p_cle.startsWith('lesson:')?[args.p_cle,'video:'+args.p_cle.slice(7)]:[args.p_cle]){
     const before=s.elements[key];s.elements[key]={key,data:{},revision:(before?.revision||0)+1,generation:(before?.generation||0)+1,deleted:true};
    }result={ok:true,epoch:s.epoch};
   }else if(old&&!old.deleted&&args.p_cle.startsWith('video:')&&old.data.contentVersion!==args.p_data.contentVersion)result={ok:false,reason:'content_version',element:copy(old)};
   else{
    const element={key:args.p_cle,data:mergeProgression(args.p_cle,old&&!old.deleted?old.data:{},args.p_data),generation:old?.generation||0,revision:(old?.revision||0)+1,deleted:false};
    s.elements[args.p_cle]=element;result={ok:true,epoch:s.epoch,element:copy(element)};
    if(api.loseAck){api.loseAck=false;throw Error('lost acknowledgement');}
   }
  }
  return new Response(JSON.stringify(result),{status:200});
 }};return api;
}
function device(api,{id='A',store=storage()}={}){
 const auth={current:id,calls:0,async getSession(){auth.calls++;return {data:{session:{access_token:'token:'+auth.current,user:{id:'untrusted-cache'}}}};},async getUser(token){auth.calls++;return {data:{user:{id:token.replace('token:',''),is_anonymous:false}}};}};
 const options={enabled:true,accountId:id,auth,store,url:'https://project.supabase.co',apikey:'public-key',fetcher:api.fetcher};
 return {sync:createProgressionSync(options),options,auth,store};
}

test('la synchronisation préparée est inactive et sans effet à l’import',async()=>{
 const sync=createProgressionSync();assert.deepEqual(await sync.status(),{enabled:false,pending:0});await assert.rejects(sync.pull(),{code:'sync_disabled'});await assert.rejects(sync.enqueue('lesson:0',{done:true}),{code:'sync_disabled'});
 for(const name of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),/account\/progression\.mjs/);
});
test('l’export sélectionne uniquement la progression, sans notes, fichiers, SQL, clé ou scores',()=>{
 const state={lessons:{0:{done:true,at:100,draft:'PRIVATE-SQL',testeDraft:'PRIVATE-SQL',etapes:{exo:1,q0:1}}},defis:{af1:true},notes:[{txt:'PRIVATE-NOTE'}],salle:{cle:'PRIVATE-KEY',pts:999},entretien:{e1:'ok'},actDays:{'2026-11-02':4}};
 const records=extractProgression(state,{lessonIds:[0],challengeIds:['af1'],videoPositions:{0:30},videoAnswers:{0:{p0:{first:1,err:0},d1:{sql:'PRIVATE-DRAFT'}}},contentVersion:'v1'});
 assert.equal(records.length,5);assert.doesNotMatch(JSON.stringify(records),/PRIVATE|pts|draft|notes/);
 assert.deepEqual(records.find(r=>r.key.startsWith('activity')).data,{active:true});
});
test('les données inconnues ou trop larges sont refusées avant leur mise en attente',async()=>{
 const d=device(cloud());await d.sync.pull();
 await assert.rejects(d.sync.enqueue('lesson:0',{done:true,sql:'private'}),{code:'invalid_progression'});
 assert.throws(()=>validateProgression('video:0',{position:10}),{code:'invalid_progression'});
 assert.throws(()=>validateProgression('video:0',{contentVersion:'v1',answers:{d0:{sql:'private'}}}),{code:'invalid_progression'});
 assert.equal((await d.sync.status()).pending,0);
});
test('la mise en attente hors ligne survit au redémarrage, sans appel réseau',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();api.offline=true;const before=d.auth.calls;
 await d.sync.enqueue('lesson:0',{done:true});assert.equal(d.auth.calls,before);
 const restarted=createProgressionSync(d.options);await assert.rejects(restarted.flush());assert.equal((await restarted.status()).pending,1);
 api.offline=false;assert.equal((await restarted.flush()).pending,0);assert.equal(api.state('A').elements['lesson:0'].data.done,true);
});
test('deux appareils fusionnent les étapes validées sans perdre la réussite',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();
 await a.sync.enqueue('lesson:0',{done:true,etapes:{q0:1}});await b.sync.enqueue('lesson:0',{done:false,etapes:{q1:1}});
 await a.sync.flush();const result=await b.sync.flush();assert.deepEqual(result.conflicts,[]);assert.equal(result.pending,0);
 assert.deepEqual(api.state('A').elements['lesson:0'].data,{done:true,etapes:{q0:1,q1:1}});
});
test('une réponse perdue est reconnue sans deuxième écriture',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('challenge:af1',{done:true});api.loseAck=true;
 await assert.rejects(d.sync.flush());assert.equal((await d.sync.status()).pending,1);
 await d.sync.flush();assert.equal((await d.sync.status()).pending,0);assert.equal(api.requests.filter(r=>r.name==='progression_enregistrer').length,1);
});
test('un conflit de position vidéo attend un choix explicite ; revenir en arrière reste possible',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();
 await a.sync.enqueue('video:0',{contentVersion:'v1',position:80});await b.sync.enqueue('video:0',{contentVersion:'v1',position:10});await a.sync.flush();
 const conflict=await b.sync.flush();assert.deepEqual(conflict.conflicts,[{key:'video:0',reason:'revision'}]);assert.equal(api.state('A').elements['video:0'].data.position,80);
 await b.sync.resolve('video:0','local');assert.equal((await b.sync.flush()).pending,0);assert.equal(api.state('A').elements['video:0'].data.position,10);
});
test('recommencer une leçon empêche un ancien appareil de rétablir ses vidéos et validations',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();
 await a.sync.enqueue('lesson:0',{done:true});await a.sync.enqueue('video:0',{contentVersion:'v1',position:90});
 await b.sync.reset('lesson:0','RECOMMENCER');const result=await a.sync.flush();assert.equal(result.conflicts.length,2);assert.ok(result.conflicts.every(c=>c.reason==='generation'));
 await assert.rejects(a.sync.resolve('lesson:0','local'),{code:'reset_conflict'});assert.equal(api.state('A').elements['lesson:0'].deleted,true);
});
test('effacer la progression bloque les anciennes files hors ligne et exige une confirmation',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();await a.sync.enqueue('lesson:0',{done:true});
 await assert.rejects(b.sync.resetAll('oui'),{code:'confirmation_required'});await b.sync.resetAll('EFFACER');
 const result=await a.sync.flush();assert.deepEqual(result.conflicts,[{key:'lesson:0',reason:'epoch'}]);assert.deepEqual(api.state('A').elements,{});
 await a.sync.resolve('lesson:0','remote');assert.equal((await a.sync.status()).pending,0);
});
test('un compte B ne peut pas envoyer la file locale du compte A',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('lesson:0',{done:true});d.auth.current='B';const before=api.requests.length;
 await assert.rejects(d.sync.flush(),{code:'wrong_account'});assert.equal(api.requests.length,before);assert.equal((await d.sync.status()).pending,1);
});
test('un changement de compte pendant un envoi ne change pas le propriétaire du jeton capturé',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();await d.sync.enqueue('lesson:0',{done:true});api.hook=()=>{d.auth.current='B';};await d.sync.flush();
 assert.ok(api.requests.every(r=>r.id==='A'));assert.equal(api.accounts.has('B'),false);assert.doesNotMatch(JSON.stringify([...d.store.map]),/token:A/);
});
test('une panne du stockage local ne fait pas croire que la progression a été sauvegardée',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();d.store.fail=true;const before=api.requests.length;
 await assert.rejects(d.sync.enqueue('lesson:0',{done:true}),/disk unavailable/);assert.equal(api.requests.length,before);
});
test('une première récupération du compte est nécessaire avant de préparer des envois',async()=>{
 await assert.rejects(device(cloud()).sync.enqueue('lesson:0',{done:true}),{code:'initial_sync_required'});
});
test('les dates de révision ne sont pas fusionnées en prenant automatiquement la plus lointaine',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();
 await a.sync.enqueue('lesson:0',{done:true,level:4,due:1000});await b.sync.enqueue('lesson:0',{done:true,level:0,due:100});await a.sync.flush();
 assert.deepEqual((await b.sync.flush()).conflicts,[{key:'lesson:0',reason:'revision'}]);assert.equal(api.state('A').elements['lesson:0'].data.due,1000);
});

const samplePlan=()=>({niveau:'debutant',rythme:'regulier',freq:3,per:3,mix:true,timeZone:'Europe/Paris',sessions:[{d:'2026-11-02',lessons:[0,1]}],archive:[]});
test('deux plannings concurrents ne s’écrasent pas ; le déplacement requiert un choix explicite',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('planning:main',samplePlan());await a.sync.flush();await b.sync.pull();
 const pa=samplePlan(),pb=samplePlan();pa.sessions=[{d:'2026-11-04',lessons:[0,1]}];pb.sessions=[{d:'2026-11-05',lessons:[1,0]}];
 await a.sync.enqueue('planning:main',pa);await b.sync.enqueue('planning:main',pb);await a.sync.flush();
 assert.deepEqual((await b.sync.flush()).conflicts,[{key:'planning:main',reason:'revision'}]);assert.deepEqual(api.state('A').elements['planning:main'].data,pa);
 await b.sync.resolve('planning:main','local');await b.sync.flush();assert.deepEqual(api.state('A').elements['planning:main'].data,pb);
});
test('une suppression de planning empêche sa résurrection depuis un appareil hors ligne',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('planning:main',samplePlan());await a.sync.flush();await b.sync.pull();
 await b.sync.enqueue('planning:main',samplePlan());await a.sync.reset('planning:main','RECOMMENCER');
 assert.deepEqual((await b.sync.flush()).conflicts,[{key:'planning:main',reason:'generation'}]);
 await assert.rejects(b.sync.resolve('planning:main','local'),{code:'reset_conflict'});assert.equal(api.state('A').elements['planning:main'].deleted,true);
});
test('le planning survit à une panne réseau et un accusé perdu sans double écriture',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();api.offline=true;await d.sync.enqueue('planning:main',samplePlan());
 await assert.rejects(d.sync.flush());api.offline=false;api.loseAck=true;await assert.rejects(d.sync.flush());
 await createProgressionSync(d.options).flush();assert.equal(api.state('A').elements['planning:main'].revision,1);
});
test('une révision échouée conserve ensemble niveau zéro et prochaine échéance après résolution',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await b.sync.pull();
 await a.sync.enqueue('lesson:0',{done:true,level:4,due:1000});await b.sync.enqueue('lesson:0',{done:true,level:0,due:100});await a.sync.flush();await b.sync.flush();
 await b.sync.resolve('lesson:0','local');await b.sync.flush();
 assert.equal(api.state('A').elements['lesson:0'].data.level,0);assert.equal(api.state('A').elements['lesson:0'].data.due,100);
});
