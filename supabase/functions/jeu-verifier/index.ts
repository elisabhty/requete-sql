import catalog from './catalog.json' with {type:'json'};
import {verify} from './verifier.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function rpc(name:string,args:unknown){
  const url=Deno.env.get('SUPABASE_URL')!;
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message||'Vérification indisponible.'),{code:data.code});return data;
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405);
  let attempt;
  try{
    if(Number(req.headers.get('content-length')||0)>18000)return json({error:'Requête trop longue.'},413);
    const text=await req.text();if(text.length>18000)return json({error:'Requête trop longue.'},413);
    const b=JSON.parse(text);
    if(typeof b.cle!=='string'||!/^[A-Za-z0-9]{24,64}$/.test(b.cle)||typeof b.salle!=='string'||!/^[A-Z0-9]{6}$/.test(b.salle)||!Number.isInteger(b.g)||!Number.isInteger(b.n)||typeof b.sql!=='string'||b.sql.length>12000||typeof b.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.id))return json({error:'Demande invalide.'},400);
    // This RPC authenticates the device, its membership and its assigned round
    // before any SQL runs. It also allocates a rate-limited, idempotent attempt.
    attempt=await rpc('jeu_essai_v2',{p_cle:b.cle,p_salle:b.salle,p_g:b.g,p_n:b.n,p_id:b.id,p_sql:b.sql});
    if(attempt.fini)return json({ok:attempt.juste});
    let ok=false,error='Le résultat ne correspond pas à la consigne.';
    try{ok=await verify(catalog,attempt.defi,b.sql);}catch(e){if((e as {unavailable?:boolean}).unavailable)throw e;error=e instanceof Error?e.message:'Requête SQL invalide.';}
    const result=await rpc('jeu_valider_v2',{p_id:attempt.id,p_juste:ok});
    return json({...result,...(!result.ok?{error}:{} )});
  }catch(e){
    const code=(e as {code?:string}).code;
    const status=code==='42501'?403:code==='54000'?429:code==='22023'||code==='P0001'?400:503;
    return json({error:status===503?'La vérification est indisponible. Réessaie.':e instanceof Error?e.message:'Demande refusée.'},status);
  }
});
