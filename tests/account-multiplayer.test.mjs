import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAccountMultiplayer} from '../account/multiplayer.mjs';
import {createAccountGameVerifier} from '../supabase/functions/jeu-compte-verifier/handler.mjs';
function setup(){
 const calls=[];
 const auth={current:'A',async getSession(){return {data:{session:{access_token:'jwt:'+auth.current,user:{id:'UNTRUSTED'}}}};},async getUser(jwt){return {data:{user:{id:jwt.slice(4),is_anonymous:false}}};}};
 const options={enabled:true,accountId:'A',auth,url:'https://example.supabase.co',apikey:'public',fetcher:async(url,args)=>{calls.push({path:url.pathname,...args,body:JSON.parse(args.body)});return new Response(JSON.stringify({linked:true,pid:'public-id'}));}};
 return {api:createAccountMultiplayer(options),options,calls,auth};
}
const key='a'.repeat(48);
const attempt=()=>({salle:'ABC123',g:0,n:0,id:'11111111-2222-3333-4444-555555555555',sql:'SELECT 1'});
test('multijoueur par compte inactif et absent des écrans',async()=>{
 const api=createAccountMultiplayer();assert.deepEqual(await api.current(),{enabled:false,linked:false});await assert.rejects(api.leaderboard(),{code:'multiplayer_disabled'});
 for(const f of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),/account\/multiplayer\.mjs/);
});
test('la liaison exige une confirmation et ne transmet que la preuve attendue',async()=>{
 const d=setup();assert.throws(()=>d.api.link(key,'oui'),{code:'confirmation_required'});assert.equal(d.calls.length,0);
 await d.api.link(key,'LIER');assert.deepEqual(d.calls[0].body,{p_cle:key,p_confirmation:'LIER'});assert.doesNotMatch(JSON.stringify(d.api),/aaaaaa/);
});
test('les commandes ne contiennent ni identifiant de compte, ni score déclaré, ni clé',async()=>{
 const d=setup();await d.api.send('ABC123',{t:'ping',u:'uniquePing'});await d.api.score('ABC123',0);await d.api.history('ABC123',4);await d.api.verify(attempt());
 assert.deepEqual(d.calls[1].body,{p_salle:'ABC123',p_g:0});assert.deepEqual(d.calls[2].body,{p_salle:'ABC123',p_apres:4});assert.equal(d.calls[3].path,'/functions/v1/jeu-compte-verifier');
 assert.doesNotMatch(JSON.stringify(d.calls.map(c=>c.body)),/user_id|p_cle|pts|pseudo/);
 assert.throws(()=>d.api.send('ABC123',{t:'ping',pid:'someone'}),{code:'invalid_message'});
});
test('un changement de compte bloque les commandes du compte précédent',async()=>{
 const d=setup();d.auth.current='B';await assert.rejects(d.api.leaderboard(),{code:'wrong_account'});assert.equal(d.calls.length,0);
});
test('une commande en cours conserve le jeton du compte vérifié',async()=>{
 const d=setup();d.options.fetcher=async(url,args)=>{d.auth.current='B';d.calls.push(args);return new Response('{}');};
 await createAccountMultiplayer(d.options).leaderboard();assert.equal(d.calls[0].headers.Authorization,'Bearer jwt:A');
});
test('les essais invalides sont refusés et une panne réseau ne simule pas un résultat',async()=>{
 const d=setup();assert.throws(()=>d.api.verify({...attempt(),pts:999}),{code:'invalid_attempt'});assert.throws(()=>d.api.score('ABC123',-1),{code:'invalid_request'});
 d.options.fetcher=async()=>{throw Error('offline');};await assert.rejects(createAccountMultiplayer(d.options).score('ABC123',0),/offline/);
});
function verifier(options={}){
 const calls=[];
 const handler=createAccountGameVerifier({enabled:true,getUser:async token=>{calls.push(['auth',token]);return {data:{user:{id:'A',is_anonymous:false}}};},begin:async(token,body)=>{calls.push(['begin',token,body]);return {id:attempt().id,defi:'af1',fini:false};},verify:async(id,sql)=>{calls.push(['verify',id,sql]);return true;},finish:async(id,ok)=>{calls.push(['finish',id,ok]);return {ok,ms:10000};},...options});
 return {calls,handler,request:(body=attempt(),jwt='valid')=>handler(new Request('https://example.test',{method:'POST',headers:jwt?{Authorization:'Bearer '+jwt}:{},body:JSON.stringify(body)}))};
}
test('le vérificateur serveur préparé reste désactivé par défaut',async()=>{
 const handler=createAccountGameVerifier({});assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,503);
});
test('le vérificateur contrôle Auth et les droits de salle avant de vérifier le SQL',async()=>{
 const v=verifier();const response=await v.request();assert.deepEqual(await response.json(),{ok:true,ms:10000});
 assert.deepEqual(v.calls.map(c=>c[0]),['auth','begin','verify','finish']);assert.equal(v.calls[1][1],'valid');assert.deepEqual(v.calls[1][2],{p_salle:'ABC123',p_g:0,p_n:0,p_id:attempt().id,p_sql:'SELECT 1'});
});
test('ni pseudo, compte, verdict, points ni clé ne sont acceptés dans une soumission',async()=>{
 for(const extra of [{user_id:'B'},{cle:key},{ok:true},{pts:999},{pseudo:'other'}]){
  const v=verifier();assert.equal((await v.request({...attempt(),...extra})).status,400);assert.equal(v.calls.length,0);
 }
});
test('une session absente ou anonyme ne démarre pas d’essai',async()=>{
 const no=verifier();assert.equal((await no.request(attempt(),null)).status,401);assert.equal(no.calls.length,0);
 const guest=verifier({getUser:async()=>({data:{user:{id:'A',is_anonymous:true}}})});assert.equal((await guest.request()).status,401);assert.equal(guest.calls.length,0);
});
test('un refus de salle ne lance pas le moteur SQL et ne divulgue aucune erreur interne',async()=>{
 const v=verifier({begin:async()=>{throw Object.assign(Error('PRIVATE-SERVICE-KEY'),{code:'42501'});}});const response=await v.request();assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/PRIVATE/);assert.deepEqual(v.calls.map(c=>c[0]),['auth']);
});
test('un essai déjà terminé ne revalide pas et une panne du moteur ne produit aucun verdict',async()=>{
 const done=verifier({begin:async()=>({fini:true,juste:true})});assert.deepEqual(await (await done.request()).json(),{ok:true});assert.equal(done.calls.length,1);
 const broken=verifier({verify:async()=>{throw Object.assign(Error('unavailable'),{unavailable:true});}});assert.equal((await broken.request()).status,503);assert.equal(broken.calls.some(c=>c[0]==='finish'),false);
});
test('le verdict envoyé au service privilégié vient exclusivement de la vérification',async()=>{
 const v=verifier({verify:async()=>false});assert.deepEqual(await (await v.request()).json(),{ok:false,ms:10000});assert.deepEqual(v.calls.at(-1),['finish',attempt().id,false]);
});
