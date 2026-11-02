// Dormant and pure: all privileged operations are injected by the server entry point.
export function createAccountGameVerifier({enabled=false,getUser,begin,finish,verify}){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers});
  if(!enabled)return reply({error:'Multijoueur par compte non activé.'},503);
  if(request.method!=='POST')return reply({error:'Méthode non autorisée.'},405);
  const jwt=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if(!jwt)return reply({error:'Connexion requise.'},401);
  try{
   if(Number(request.headers.get('content-length')||0)>18000)return reply({error:'Demande trop longue.'},413);
   const text=await request.text();if(new TextEncoder().encode(text).length>18000)return reply({error:'Demande trop longue.'},413);
   let b;try{b=JSON.parse(text);}catch{return reply({error:'Demande invalide.'},400);}
   if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==5||Object.keys(b).some(k=>!['salle','g','n','id','sql'].includes(k))||typeof b.salle!=='string'||!/^[A-Z0-9]{6}$/.test(b.salle)||!Number.isInteger(b.g)||b.g<0||b.g>2147483647||!Number.isInteger(b.n)||b.n<0||b.n>4||typeof b.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.id)||typeof b.sql!=='string'||new TextEncoder().encode(b.sql).length>12000)return reply({error:'Demande invalide.'},400);
   const user=await getUser(jwt);
   if(user.error||!user.data?.user?.id||user.data.user.is_anonymous)return reply({error:'Connexion requise.'},401);
   // The same verified token is forwarded to the RPC; never an identity from the body.
   const attempt=await begin(jwt,{p_salle:b.salle,p_g:b.g,p_n:b.n,p_id:b.id,p_sql:b.sql});
   if(attempt.fini)return reply({ok:attempt.juste===true});
   let correct=false;
   try{correct=await verify(attempt.defi,b.sql);}catch(e){if(e?.unavailable)throw e;}
   const result=await finish(attempt.id,correct===true);
   return reply({ok:result.ok===true,...(Number.isFinite(result.ms)?{ms:result.ms}:{})});
  }catch(e){
   const status=e?.code==='42501'?403:e?.code==='54000'?429:['22023','P0001'].includes(e?.code)?400:503;
   return reply({error:status===503?'La vérification est indisponible. Réessaie.':status===429?'Attends un instant avant de réessayer.':'Demande refusée.'},status);
  }
 };
}
