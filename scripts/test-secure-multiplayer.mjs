// Explicit integration check against the connected backend. Creates only temporary
// audit identities and releases them in finally. No privileged credential needed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const url=html.match(/const JEU_SB='([^']+)'/)[1],apikey=html.match(/const JEU_SB_KEY='([^']+)'/)[1];
const catalog=JSON.parse(fs.readFileSync(new URL('../supabase/functions/jeu-verifier/catalog.json',import.meta.url)));
const clients=[];const code=crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();
async function rpc(name,body){const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();return {ok:r.ok,status:r.status,data};}
async function send(c,t,extras={}){return rpc('jeu_envoyer_v2',{p_cle:c.key,p_salle:code,p_m:{v:1,t,pid:c.pid,name:'forged name ignored',g:0,u:crypto.randomUUID().replace(/-/g,''),...extras}});}
async function verify(c,sql,extra={}){const body={cle:c.key,salle:code,g:0,n:0,id:crypto.randomUUID(),sql,...extra};const r=await fetch(url+'/functions/v1/jeu-verifier?forceFunctionRegion=eu-west-3',{method:'POST',headers:{apikey,'Content-Type':'application/json'},body:JSON.stringify(body)});return {ok:r.ok,data:await r.json(),body};}
try{
 for(let i=0;i<6;i++){
  const key=crypto.randomUUID().replace(/-/g,'');clients.push({key});
  const pseudo='@audit'+crypto.randomUUID().replace(/-/g,'').slice(0,8);
  const ps=await rpc('jeu_pseudo_prendre',{p_cle:key,p_pseudo:pseudo});assert.equal(ps.data.ok,true);
  const id=await rpc('jeu_identite_v2',{p_cle:key});assert.equal(id.ok,true);Object.assign(clients[i],id.data);
 }
 const [host,guest]=clients;
 assert.equal((await send(host,'cfg',{niv:'f',n:1,solo:false})).ok,true);
 for(const c of clients.slice(0,5))assert.equal((await send(c,'hello')).ok,true);
 assert.equal((await send(clients[5],'hello')).ok,false,'sixth player must be refused');
 for(const c of clients.slice(2,5))assert.equal((await send(c,'bye')).ok,true);
 assert.equal((await send(guest,'cfg',{niv:'f',n:5})).ok,false,'only host configures');
 assert.equal((await send(guest,'ready',{on:true,pid:host.pid})).ok,false,'cannot impersonate host');
 assert.equal((await send(guest,'ready',{on:true})).ok,true);
 assert.equal((await send(host,'round',{n:0,cid:'af1'})).ok,true);
 assert.equal((await send(host,'found',{n:0,ms:0,p1:1})).ok,false,'browser cannot report success');
 assert.equal((await rpc('jeu_valider_v2',{p_id:crypto.randomUUID(),p_juste:true})).ok,false,'verifier is private');
 assert.equal((await rpc('jeu_essai_v2',{p_cle:host.key,p_salle:code,p_g:0,p_n:0,p_id:crypto.randomUUID(),p_sql:'SELECT 1'})).ok,false,'attempt allocator is private');
 assert.equal((await rpc('jeu_historique_v2',{p_salle:code,p_apres:0,p_cle:clients[5].key})).ok,false,'non-member cannot read history');
 await delay(3500);
 const wrong=await verify(host,'SELECT 0');assert.equal(wrong.ok,true);assert.equal(wrong.data.ok,false);
 await delay(900);
 const sql=catalog.challenges.find(c=>c.id==='af1').sol;
 const solved=await verify(host,sql,{ms:0,p1:1,pts:999999});assert.equal(solved.ok,true);assert.equal(solved.data.ok,true);assert.ok(solved.data.ms>0);
 const retry=await verify(host,sql,{id:solved.body.id});assert.equal(retry.data.ok,true,'same attempt can be retried safely');
 const second=await verify(guest,sql);assert.equal(second.data.ok,true);
 const history=await rpc('jeu_historique_v2',{p_salle:code,p_apres:0,p_cle:host.key});assert.equal(history.ok,true);
 const found=history.data.filter(x=>x.m.t==='found');assert.equal(found.length,2);
 assert.equal(found.find(x=>x.m.pid===host.pid).m.p1,0,'wrong first attempt loses first-try bonus');
 assert.equal(found.find(x=>x.m.pid===guest.pid).m.p1,1);
 assert.equal(history.data.some(x=>x.m.name==='forged name ignored'),false,'server supplies reserved names');
 assert.equal((await send(host,'end')).ok,true);
 for(const [client,expected] of [[host,250],[guest,255]]){
  const params={p_cle:client.key,p_pseudo:client.pseudo,p_partie:{salle:code,g:0,pts:999999,n:5,ok:5,solo:1,niv:'d'}};
  const first=await rpc('jeu_score_v2',params);assert.equal(first.ok,true,JSON.stringify(first.data));assert.equal(first.data.pts,expected,'server recomputes all points');
  const duplicate=await rpc('jeu_score_v2',params);assert.equal(duplicate.data.pts,expected,'same game counted once');assert.equal(duplicate.data.parties,1);
  const progress=await rpc('jeu_defis_v2',{p_cle:client.key,p_defis:['FAKE'],p_niv:{f:[999,999]}});assert.equal(progress.data.n,1,'only verified challenge counted');
 }
 if(process.env.CHECK_LEGACY_REVOKED==='1'){
  assert.equal((await rpc('jeu_envoyer',{p_salle:code,p_m:{t:'found'}})).ok,false);
  assert.equal((await rpc('jeu_score',{p_cle:host.key,p_pseudo:host.pseudo,p_partie:{u:'FORGED1234',pts:275,n:1,ok:1,solo:0,niv:'f'}})).ok,false);
 }
 console.log('PASS: room membership, maximum 5, host rights, impersonation refused, direct success refused, private verification, SQL validation, first-try bonus, server timing, server scoring, idempotency, private history and verified progress.');
 console.log('Temporary room:',code);
}finally{
 for(const c of clients){if(c.pid)await send(c,'bye').catch(()=>{});await rpc('jeu_pseudo_liberer',{p_cle:c.key}).catch(()=>{});}
}
