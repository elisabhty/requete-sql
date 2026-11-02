import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountDeletionHandler} from '../supabase/functions/compte-supprimer/handler.mjs';
function fixture(options={}){
 const calls=[];
 const handler=createAccountDeletionHandler({enabled:true,
  getUser:async token=>{calls.push(['auth',token]);return {data:{user:{id:'owner',app_metadata:{providers:['email']}}},error:null};},
  revokeSessions:async token=>{calls.push(['revoke',token]);return {error:null};},
  deleteUser:async id=>{calls.push(['delete',id]);return {error:null};},...options});
 return {handler,calls};
}
const request=(body={confirmation:'SUPPRIMER'},token='valid-token')=>new Request('https://example.test/compte-supprimer',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
test('la suppression est inactive par défaut',async()=>{
 const {handler,calls}=fixture({enabled:false});assert.equal((await handler(request())).status,503);assert.deepEqual(calls,[]);
});
test('pas de suppression sans connexion ni confirmation',async()=>{
 const {handler,calls}=fixture();assert.equal((await handler(request({},null))).status,401);assert.equal((await handler(request({confirmation:'oui'}))).status,400);assert.deepEqual(calls,[]);
});
test('le serveur refuse un identifiant cible dans le corps et un jeton invalide',async()=>{
 const {handler,calls}=fixture();assert.equal((await handler(request({confirmation:'SUPPRIMER',user_id:'victim'}))).status,400);assert.deepEqual(calls,[]);
 const invalid=fixture({getUser:async()=>({data:{user:null},error:new Error('invalid')})});assert.equal((await invalid.handler(request())).status,401);assert.deepEqual(invalid.calls,[]);
});
test('les sessions sont révoquées avant de supprimer le seul compte authentifié',async()=>{
 const {handler,calls}=fixture();const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:true});assert.deepEqual(calls,[['auth','valid-token'],['revoke','valid-token'],['delete','owner']]);
});
test('une panne de révocation empêche la suppression',async()=>{
 const {handler,calls}=fixture({revokeSessions:async()=>({error:new Error('unavailable')})});assert.equal((await handler(request())).status,503);assert.equal(calls.some(c=>c[0]==='delete'),false);
});
test('Apple reste bloqué tant que la révocation de ses jetons n’est pas configurée',async()=>{
 const {handler,calls}=fixture({getUser:async()=>({data:{user:{id:'owner',app_metadata:{providers:['apple']}}}})});assert.equal((await handler(request())).status,501);assert.deepEqual(calls,[]);
});
test('aucune erreur technique ni clé serveur ne ressort dans une réponse',async()=>{
 const {handler}=fixture({deleteUser:async()=>{throw new Error('server-secret');}});const response=await handler(request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/server-secret/);
});
