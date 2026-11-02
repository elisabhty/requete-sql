// Prepared private profile client. No storage, SDK or requests initialized here.
function fail(code){throw Object.assign(new Error(code),{code});}
export function validatePrivateProfile(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!['prenom','objectif','fuseau_horaire'].includes(k)))fail('invalid_profile');
 const clean={...patch};
 if('prenom' in clean){if(typeof clean.prenom!=='string')fail('invalid_profile');clean.prenom=clean.prenom.trim();if([...clean.prenom].length>80||/[\u0000-\u001f\u007f-\u009f]/.test(clean.prenom))fail('invalid_profile');}
 if('objectif' in clean&&!['','career','interview','work','advanced','curious'].includes(clean.objectif))fail('invalid_profile');
 if('fuseau_horaire' in clean){
  const zone=clean.fuseau_horaire;if(typeof zone!=='string'||zone.length>100||zone!=='UTC'&&!zone.includes('/'))fail('invalid_profile');
  try{new Intl.DateTimeFormat('fr',{timeZone:zone});}catch{fail('invalid_profile');}
 }
 return clean;
}
export function extractPrivateProfile(state,{timeZone}={}){
 // Explicit opt-in preview only. Excludes age, job, referral, signatures, SQL and scores.
 return validatePrivateProfile({prenom:state.name||'',objectif:state.profile?.goal||'',...(timeZone?{fuseau_horaire:timeZone}:{})});
}
export function createPrivateProfile({accountId,auth,url,apikey,fetcher=globalThis.fetch,enabled=false}={}){
 async function rpc(name,args={}){
  if(!enabled)fail('profile_disabled');
  if(!accountId||!auth||!url||!apikey)fail('profile_not_configured');
  const cached=await auth.getSession(),jwt=cached.data?.session?.access_token;if(cached.error||!jwt)fail('not_signed_in');
  const checked=await auth.getUser(jwt);if(checked.error||checked.data?.user?.id!==accountId||checked.data.user.is_anonymous)fail('wrong_account');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetcher(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
   const result=await response.json();if(!response.ok)fail(result.code||'profile_unavailable');return result;
  }finally{clearTimeout(timer);}
 }
 return Object.freeze({
  enabled:!!enabled,
  current:()=>enabled?rpc('compte_profil_lire'):Promise.resolve({enabled:false,profile:null}),
  create:patch=>rpc('compte_profil_creer',{p_donnees:validatePrivateProfile(patch)}),
  update:(patch,{revision}={})=>{
   if(!Number.isSafeInteger(revision)||revision<1)fail('revision_required');
   return rpc('compte_profil_enregistrer',{p_revision:revision,p_donnees:validatePrivateProfile(patch),p_compte_attendu:accountId});
  }
 });
}
