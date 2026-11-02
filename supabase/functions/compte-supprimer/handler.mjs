// No privileged dependency here: pure handler, testable without deleting a real account.
export function createAccountDeletionHandler({enabled=false,getUser,revokeSessions,deleteUser}){
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{headers});
    if(!enabled)return reply({error:'La gestion des comptes n’est pas encore activée.'},503);
    if(request.method!=='POST')return reply({error:'Méthode non autorisée.'},405);
    const match=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i);
    if(!match)return reply({error:'Connexion requise.'},401);
    try{
      if(Number(request.headers.get('content-length')||0)>256)return reply({error:'Demande invalide.'},400);
      const text=await request.text();if(text.length>256)return reply({error:'Demande invalide.'},400);
      let body;try{body=JSON.parse(text);}catch{return reply({error:'Demande invalide.'},400);}
      if(!body||body.confirmation!=='SUPPRIMER'||Object.keys(body).some(k=>k!=='confirmation'))return reply({error:'Confirmation requise.'},400);
      const {data,error}=await getUser(match[1]);
      const user=data?.user;
      if(error||!user?.id||user.is_anonymous)return reply({error:'Connexion requise.'},401);
      // Apple token revocation must be added before enabling Apple account deletion.
      if(user.app_metadata?.providers?.includes('apple')||user.app_metadata?.provider==='apple')return reply({error:'La suppression des comptes Apple n’est pas encore configurée.'},501);
      const revoked=await revokeSessions(match[1]);
      if(revoked.error)return reply({error:'La déconnexion des appareils a échoué. Réessaie.'},503);
      // The ID comes exclusively from Auth, never from the caller or profile metadata.
      const deleted=await deleteUser(user.id);
      if(deleted.error)return reply({error:'La suppression a échoué. Reconnecte-toi pour réessayer.'},503);
      return reply({deleted:true});
    }catch{return reply({error:'La suppression est indisponible. Réessaie.'},503);}
  };
}
