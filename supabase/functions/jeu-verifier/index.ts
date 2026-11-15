// Le catalogue (défis, solutions, bases) et le moteur de vérification sont pris dans le dépôt, figés à un commit (GitHub sert
// le dépôt public tel qu’il était à ce commit, sans changement possible) : le déploiement n’envoie que ce fichier et deno.json.
// Après un changement de catalog.json ou d’un module (node scripts/build-secure-catalog.cjs), pousser, mettre ici le nouveau
// commit et redéployer ; tests/serveur-synchro.test.mjs vérifie que ce commit a les mêmes fichiers que le dépôt.
import catalog from 'https://raw.githubusercontent.com/elisabhty/requete-sql/eb15c7e8ce352545db3f853046fa6b9cb56e7284/supabase/functions/jeu-verifier/catalog.json' with {type:'json'};
import catalogEn from 'https://raw.githubusercontent.com/elisabhty/requete-sql/eb15c7e8ce352545db3f853046fa6b9cb56e7284/supabase/functions/jeu-verifier/catalog-en.json' with {type:'json'};
import {verify} from 'https://raw.githubusercontent.com/elisabhty/requete-sql/eb15c7e8ce352545db3f853046fa6b9cb56e7284/supabase/functions/jeu-verifier/verifier.mjs';
// 15 novembre (Elisa : « vasy ») : un catalogue par langue. L’appli en anglais envoie langue:'en' et la requête telle que le joueur
// l’a écrite ; elle est vérifiée sur la base anglaise du défi (catalog-en.json). Sans langue, le français, comme avant.
const CATALOGUES:Record<string,unknown>={fr:catalog,en:catalogEn};
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
    if(typeof b.cle!=='string'||!/^[A-Za-z0-9]{24,64}$/.test(b.cle)||typeof b.salle!=='string'||!/^[A-Z0-9]{6}$/.test(b.salle)||!Number.isInteger(b.g)||!Number.isInteger(b.n)||typeof b.sql!=='string'||b.sql.length>12000||typeof b.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.id)||(b.langue!==undefined&&(typeof b.langue!=='string'||!Object.hasOwn(CATALOGUES,b.langue))))return json({error:'Demande invalide.'},400);
    const langue=b.langue===undefined?'fr':b.langue;
    // This RPC authenticates the device, its membership and its assigned round
    // before any SQL runs. It also allocates a rate-limited, idempotent attempt.
    attempt=await rpc('jeu_essai_v2',{p_cle:b.cle,p_salle:b.salle,p_g:b.g,p_n:b.n,p_id:b.id,p_sql:b.sql});
    if(attempt.fini)return json({ok:attempt.juste});
    let ok=false,error='Le résultat ne correspond pas à la consigne.';
    try{ok=await verify(CATALOGUES[langue],attempt.defi,b.sql);}catch(e){if((e as {unavailable?:boolean}).unavailable)throw e;error=e instanceof Error?e.message:'Requête SQL invalide.';}
    const result=await rpc('jeu_valider_v2',{p_id:attempt.id,p_juste:ok});
    return json({...result,...(!result.ok?{error}:{} )});
  }catch(e){
    const code=(e as {code?:string}).code;
    const status=code==='42501'?403:code==='54000'?429:code==='22023'||code==='P0001'?400:503;
    return json({error:status===503?'La vérification est indisponible. Réessaie.':e instanceof Error?e.message:'Demande refusée.'},status);
  }
});
