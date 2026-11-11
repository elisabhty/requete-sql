import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {STICKER_IDS,validatePersonalisation,mergePersonalisation,extractStickers,extractPreferences,extractLegacyStudy,createPersonalisationSync} from '../account/personalisation.mjs';
import {createStudySegment,summariseStudy} from '../account/study.mjs';
const at=Date.parse('2026-11-02T12:00:00Z');
const id=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const record=(key,data)=>({key,data,deleted:false,revision:1,generation:0});
const snapshot=elements=>({userId:'A',schemaVersion:1,epoch:0,elements});
const segment=(i,start,end,activity='l0')=>{const r=createStudySegment(id(i),{start,end,activity});return record(r.key,r.data);};
const stickers=()=>({got:{intro:at},fresh:{intro:1},board:[{id:'intro',x:.3,y:.5,r:0,s:1}],since:at});
const prefs=()=>extractPreferences({});
const copy=x=>JSON.parse(JSON.stringify(x));
function store(){const m=new Map();let chain=Promise.resolve();return {m,async get(k){return m.has(k)?copy(m.get(k)):null;},async set(k,v){m.set(k,copy(v));},withLock(k,fn){const r=chain.then(fn);chain=r.catch(()=>{});return r;}};}
function cloud(){const accounts=new Map(),calls=[];const api={calls,offline:false,loseAck:false,state(id){if(!accounts.has(id))accounts.set(id,{epoch:0,elements:{}});return accounts.get(id);},async fetcher(url,args){
 if(api.offline)throw Error('offline');const user=args.headers.Authorization.slice(7),s=api.state(user),p=JSON.parse(args.body),name=url.pathname.split('/').pop();calls.push({user,name,p});let result;
 if(name==='personnalisation_lire')result={schemaVersion:1,epoch:s.epoch,elements:Object.values(s.elements)};
 else if(p.p_epoch!==s.epoch)result={ok:false,reason:'epoch',epoch:s.epoch};
 else if(name==='personnalisation_effacer'){s.epoch++;s.elements={};result={ok:true,epoch:s.epoch};}
 else{const old=s.elements[p.p_cle];
  if((old?.generation||0)!==p.p_generation)result={ok:false,reason:'generation',element:old};
  else if((old?.revision||0)!==p.p_revision)result={ok:false,reason:'revision',element:old};
  else if(name==='personnalisation_reinitialiser'){s.elements[p.p_cle]={key:p.p_cle,data:{},deleted:true,revision:(old?.revision||0)+1,generation:(old?.generation||0)+1};result={ok:true,epoch:s.epoch};}
  else if(p.p_cle.startsWith('study:')&&old&&!old.deleted&&JSON.stringify(old.data)!==JSON.stringify(p.p_data))result={ok:false,reason:'immutable_study',element:old};
  else{const element={key:p.p_cle,data:mergePersonalisation(p.p_cle,old&&!old.deleted?old.data:{},p.p_data),deleted:false,revision:(old?.revision||0)+1,generation:old?.generation||0};s.elements[p.p_cle]=element;result={ok:true,epoch:s.epoch,element};if(api.loseAck){api.loseAck=false;throw Error('lost ack');}}
 }
 return new Response(JSON.stringify(result));
}};return api;}
function device(api,user='A'){
 const auth={current:user,async getSession(){return {data:{session:{access_token:auth.current}}};},async getUser(token){return {data:{user:{id:token,is_anonymous:false}}};}};
 const options={enabled:true,accountId:user,auth,store:store(),url:'https://example.supabase.co',apikey:'public',fetcher:api.fetcher};return {auth,options,sync:createPersonalisationSync(options)};
}
test('les trois préparations sont inactives et absentes des écrans',async()=>{
 const sync=createPersonalisationSync();assert.deepEqual(await sync.status(),{enabled:false,pending:0});await assert.rejects(sync.pull(),{code:'sync_disabled'});
 for(const f of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),/account\/(personalisation|study)\.mjs/);
});
test('le catalogue de stickers correspond aux 15 modules et 14 accomplissements actuels',()=>{
 const app=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const m=app.match(/const STK_MODULE_IDS=(\[[^;]+\]);/);assert.ok(m);const modules=vm.runInNewContext(m[1]);
 const start=app.indexOf('function accomplissements()'),end=app.indexOf('\n}',start);const acc=[...app.slice(start,end).matchAll(/\{id:'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual([...STICKER_IDS],[...modules,...acc]);
});
test('le tableau conserve positions, ordre et rotation sans champs étrangers',()=>{
 const s=stickers();s.board[0].r=720;s.board[0].token='PRIVATE';const out=extractStickers({stickers:s});assert.equal(out.board[0].r,0);assert.doesNotMatch(JSON.stringify(out),/PRIVATE/);
 const merged=mergePersonalisation('stickers:board',{...stickers(),got:{intro:1,lire:at-1000},since:at-2000},stickers());assert.equal(merged.got.intro,at);assert.equal(merged.got.lire,at-1000);assert.equal(merged.since,at-2000);
});
test('un sticker inconnu, non gagné, en double ou hors du tableau est refusé',()=>{
 for(const alter of [s=>s.got.unknown=1,s=>s.board[0].id='lire',s=>s.board.push({...s.board[0]}),s=>s.board[0].x=2,s=>s.fresh.lire=1]){const s=stickers();alter(s);assert.throws(()=>validatePersonalisation('stickers:board',s),{code:'invalid_personalisation'});}
});
test('les préférences sélectionnent lecture, vidéo, défis et souhait de rappel uniquement',()=>{
 const p=extractPreferences({preferences:{largeText:true,reduceMotion:true,token:'PRIVATE'}},{videoRate:1.5,challenge:{niv:'m',nb:3,mode:'friends',nivUser:true},reminder:{enabled:true,time:'08:00'}});
 assert.equal(p.largeText,true);assert.equal(p.videoRate,1.5);assert.doesNotMatch(JSON.stringify(p),/PRIVATE|permission|deviceToken/);
 assert.throws(()=>validatePersonalisation('preferences:main',{...p,videoRate:3}),{code:'invalid_personalisation'});assert.throws(()=>validatePersonalisation('preferences:main',{...p,reminder:{enabled:true,time:'25:00'}}),{code:'invalid_personalisation'});
});
test('les périodes d’étude ont des identifiants stables et une durée bornée',()=>{
 assert.equal(createStudySegment(id(1),{start:at,end:at+1000,activity:'console'}).data.end,at+1000);
 for(const data of [{start:at,end:at,activity:'l0'},{start:at,end:at+3600001,activity:'l0'},{start:at,end:at+1,activity:'SELECT secret'}])assert.throws(()=>createStudySegment(id(1),data),{code:'invalid_personalisation'});
});
test('des périodes superposées sur deux appareils ne doublent pas le temps total',()=>{
 const s=summariseStudy(snapshot([segment(1,at,at+60000,'l0'),segment(2,at+30000,at+90000,'console'),segment(3,at,at+60000,'l0')]),{accountId:'A'});
 assert.equal(s.totalSeconds,90);assert.equal(s.items.l0,60);assert.equal(s.items.console,30);assert.equal(s.days['2026-11-02'],90);
});
test('minuit et le changement d’heure découpent les jours sans gonfler la durée réelle',()=>{
 const midnight=Date.parse('2026-11-01T23:59:30Z');const s=summariseStudy(snapshot([segment(1,midnight,midnight+60000)]),{accountId:'A',timeZone:'UTC'});assert.equal(s.days['2026-11-01'],30);assert.equal(s.days['2026-11-02'],30);
 const spring=Date.parse('2026-03-29T00:30:00Z');assert.equal(summariseStudy(snapshot([segment(1,spring,spring+3600000)]),{accountId:'A',timeZone:'Europe/Paris'}).totalSeconds,3600);
});
test('la reprise historique vient d’une seule source et coupe les nouveaux relevés à sa borne',()=>{
 const legacy=extractLegacyStudy({study:{days:{'2026-11-02':60},items:{l0:60}},token:'PRIVATE'},{cutoff:at,timeZone:'UTC'});
 const s=summariseStudy(snapshot([record('study:legacy',legacy),segment(1,at-30000,at+30000)]),{accountId:'A'});assert.equal(s.totalSeconds,90);assert.equal(s.legacyImported,true);
 assert.throws(()=>extractLegacyStudy({study:{days:{'2026-11-03':60},items:{l0:60}}},{cutoff:at,timeZone:'UTC'}),{code:'invalid_personalisation'});
 assert.throws(()=>extractLegacyStudy({study:{days:{'2026-11-02':60},items:{l0:30}}},{cutoff:at,timeZone:'UTC'}),{code:'invalid_personalisation'});
});
test('deux dispositions concurrentes restent en conflit jusqu’à un choix explicite',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('stickers:board',stickers());await a.sync.flush();await b.sync.pull();
 const s1=stickers(),s2=stickers();s1.board[0].x=.1;s2.board[0].x=.8;await a.sync.enqueue('stickers:board',s1);await b.sync.enqueue('stickers:board',s2);await a.sync.flush();assert.deepEqual((await b.sync.flush()).conflicts,[{key:'stickers:board',reason:'revision'}]);
 await b.sync.resolve('stickers:board','local');await b.sync.flush();assert.equal(api.state('A').elements['stickers:board'].data.board[0].x,.8);
});
test('une période ou une reprise historique enregistrée ne peut pas être réécrite',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();const r=createStudySegment(id(1),{start:at,end:at+1000,activity:'l0'});await d.sync.enqueue(r.key,r.data);await d.sync.flush();
 await d.sync.enqueue(r.key,{...r.data,end:at+2000});assert.deepEqual((await d.sync.flush()).conflicts,[{key:r.key,reason:'immutable_study'}]);await assert.rejects(d.sync.resolve(r.key,'local'),{code:'immutable_study'});
});
test('les préférences mises en file survivent hors ligne et un accusé perdu ne double pas l’écriture',async()=>{
 const api=cloud(),d=device(api);await d.sync.pull();api.offline=true;await d.sync.enqueue('preferences:main',prefs());await assert.rejects(d.sync.flush());api.offline=false;api.loseAck=true;await assert.rejects(createPersonalisationSync(d.options).flush());await d.sync.flush();assert.equal(api.state('A').elements['preferences:main'].revision,1);
});
test('une suppression bloque les anciennes files et un changement de compte ne transmet rien',async()=>{
 const api=cloud(),a=device(api),b=device(api);await a.sync.pull();await a.sync.enqueue('stickers:board',stickers());await a.sync.flush();await b.sync.pull();await b.sync.enqueue('stickers:board',stickers());await a.sync.reset('stickers:board','SUPPRIMER');assert.equal((await b.sync.flush()).conflicts[0].reason,'generation');
 b.auth.current='B';const before=api.calls.length;await assert.rejects(b.sync.flush(),{code:'wrong_account'});assert.equal(api.calls.length,before);
 assert.throws(()=>summariseStudy(snapshot([]),{accountId:'B'}),{code:'wrong_account'});
});
