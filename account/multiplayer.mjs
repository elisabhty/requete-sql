// Prepared adapter. No SDK, network, storage or room listeners at import.
function fail(code){throw Object.assign(new Error(code),{code});}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const room=code=>{if(typeof code!=='string'||!/^[A-Z0-9]{6}$/.test(code))fail('invalid_room');return code;};
const integer=(n,max)=>{if(!Number.isInteger(n)||n<0||n>max)fail('invalid_request');return n;};
export function createAccountMultiplayer({accountId,auth,url,apikey,fetcher=globalThis.fetch,enabled=false}={}){
 async function token(){
  if(!enabled)fail('multiplayer_disabled');
  if(!accountId||!auth||!url||!apikey)fail('multiplayer_not_configured');
  const session=await auth.getSession(),jwt=session.data?.session?.access_token;
  if(session.error||!jwt)fail('not_signed_in');
  const verified=await auth.getUser(jwt);
  if(verified.error||verified.data?.user?.id!==accountId||verified.data.user.is_anonymous)fail('wrong_account');
  return jwt;
 }
 async function request(path,body){
  const jwt=await token(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetcher(new URL(path,url),{method:'POST',headers:{apikey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   const data=await response.json();if(!response.ok)fail(data.code||'multiplayer_unavailable');return data;
  }finally{clearTimeout(timeout);}
 }
 const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,body);
 return Object.freeze({
  enabled:!!enabled,
  current:()=>enabled?rpc('jeu_compte_identite'):Promise.resolve({enabled:false,linked:false}),
  create:pseudo=>{if(typeof pseudo!=='string'||pseudo.length>100)fail('invalid_pseudo');return rpc('jeu_compte_creer',{p_pseudo:pseudo});},
  link:(deviceKey,confirmation)=>{
   if(confirmation!=='LIER')fail('confirmation_required');
   if(typeof deviceKey!=='string'||!/^[A-Za-z0-9]{24,64}$/.test(deviceKey))fail('invalid_device_key');
   return rpc('jeu_compte_lier',{p_cle:deviceKey,p_confirmation:confirmation});
  },
  send:(code,message)=>{
   if(!object(message)||Object.keys(message).some(k=>!['t','u','s','g','niv','n','solo','on','cid','e'].includes(k)))fail('invalid_message');
   // Server derives pid/name; existing v2 protocol checks room rights and payload.
   return rpc('jeu_compte_envoyer',{p_salle:room(code),p_m:message});
  },
  history:(code,after=0)=>rpc('jeu_compte_historique',{p_salle:room(code),p_apres:integer(after,2147483647)}),
  score:(code,generation)=>rpc('jeu_compte_score',{p_salle:room(code),p_g:integer(generation,2147483647)}),
  leaderboard:()=>rpc('jeu_compte_classement'),
  syncChallenges:()=>rpc('jeu_compte_defis'),
  verify:attempt=>{
   if(!object(attempt)||Object.keys(attempt).length!==5||Object.keys(attempt).some(k=>!['salle','g','n','id','sql'].includes(k))||typeof attempt.sql!=='string'||new TextEncoder().encode(attempt.sql).length>12000||typeof attempt.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(attempt.id))fail('invalid_attempt');
   room(attempt.salle);integer(attempt.g,2147483647);integer(attempt.n,4);
   // Caller retains the attempt ID for retries. No SQL or bearer token persisted here.
   return request('/functions/v1/jeu-compte-verifier',attempt);
  }
 });
}
