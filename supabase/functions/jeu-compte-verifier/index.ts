import {createAccountGameVerifier} from './handler.mjs';
import catalog from '../jeu-verifier/catalog.json' with {type:'json'};
import {verify} from '../jeu-verifier/verifier.mjs';
const base=Deno.env.get('SUPABASE_URL')!;
const publishable=Deno.env.get('SUPABASE_ANON_KEY')!;
async function rpc(name:string,args:unknown,jwt:string,apikey:string){
 const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey,Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const result=await response.json();if(!response.ok)throw Object.assign(new Error('RPC refusé'),{code:result.code});return result;
}
Deno.serve(createAccountGameVerifier({
 enabled:Deno.env.get('REQUETE_MULTIPLAYER_ACCOUNTS_ENABLED')==='true',
 getUser:async(jwt:string)=>{
  const response=await fetch(`${base}/auth/v1/user`,{headers:{apikey:publishable,Authorization:`Bearer ${jwt}`}});
  const user=await response.json();return response.ok?{data:{user}}:{error:true};
 },
 begin:(jwt:string,args:unknown)=>rpc('jeu_compte_essai',args,jwt,publishable),
 finish:(id:string,ok:boolean)=>{
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return rpc('jeu_valider_v2',{p_id:id,p_juste:ok},service,service);
 },
 verify:(id:string,sql:string)=>verify(catalog,id,sql)
}));
