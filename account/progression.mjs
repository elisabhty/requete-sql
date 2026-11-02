import {validatePlan} from './learning.mjs';
// Prepared sync engine. No SDK, storage, timer or network is initialized at import.
const clone=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const stable=x=>JSON.stringify(x,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a,b)=>stable(a)===stable(b);
function fail(code){throw Object.assign(new Error(code),{code});}
export function validateProgression(key,data){
  if(key==='planning:main')return validatePlan(data);
  if(!/^(lesson|challenge|video|interview|activity):[A-Za-z0-9_.-]{1,96}$/.test(key)||!object(data)||new TextEncoder().encode(JSON.stringify(data)).length>32768)fail('invalid_progression');
  const kind=key.split(':')[0],allowed={lesson:['done','etapes','at','due','level'],challenge:['done'],video:['position','answers','contentVersion'],interview:['mark'],activity:['active']}[kind];
  for(const [k,v] of Object.entries(data)){
    if(!allowed.includes(k))fail('invalid_progression');
    if(k==='done'&&typeof v!=='boolean')fail('invalid_progression');
    if(['at','due','level'].includes(k)&&(!Number.isSafeInteger(v)||v<0||v>(k==='level'?4:4102444800000)))fail('invalid_progression');
    if(k==='etapes'&&(!object(v)||Object.entries(v).some(([s,n])=>!/^(exo|q\d{1,3})$/.test(s)||![1,true].includes(n))))fail('invalid_progression');
    if(k==='position'&&(!Number.isFinite(v)||v<0||v>86400))fail('invalid_progression');
    if(k==='contentVersion'&&(typeof v!=='string'||!v.length||v.length>128))fail('invalid_progression');
    if(k==='answers'){
      if(!object(v))fail('invalid_progression');
      for(const [i,a] of Object.entries(v)){
        if(!object(a))fail('invalid_progression');
        if(/^p\d{1,3}$/.test(i)){
          if(Object.keys(a).some(k=>!['first','err'].includes(k))||![0,1].includes(a.first)||!Number.isInteger(a.err)||a.err<0||a.err>9999)fail('invalid_progression');
        }else if(/^\d{1,3}$/.test(i)){
          if(Object.keys(a).some(k=>!['k','q'].includes(k))||!Number.isInteger(a.k)||a.k<0||a.k>999||typeof a.q!=='string'||a.q.length>2000)fail('invalid_progression');
        }else fail('invalid_progression');
      }
    }
    if(k==='mark'&&!['ok','review'].includes(v))fail('invalid_progression');
    if(k==='active'&&(v!==true||!/^activity:\d{4}-\d{2}-\d{2}$/.test(key)))fail('invalid_progression');
  }
  if(kind==='video'&&!own(data,'contentVersion'))fail('invalid_progression');
  return clone(data);
}
export function mergeProgression(key,remote={},incoming={}){
  const data={...remote,...incoming};
  if(/^(lesson|challenge):/.test(key))data.done=!!(remote.done||incoming.done);
  if(key.startsWith('lesson:')){
    data.etapes={...remote.etapes,...incoming.etapes};
    if(remote.at!=null&&incoming.at!=null)data.at=Math.min(remote.at,incoming.at);
  }
  if(key.startsWith('video:')&&remote.contentVersion===incoming.contentVersion){
    data.answers={...remote.answers,...incoming.answers};
    for(const [k,v] of Object.entries(remote.answers||{}))if(/^p\d+$/.test(k))data.answers[k]=v;
  }
  return data;
}
// Whitelist only learning progress. Never upload state wholesale, SQL drafts,
// multiplayer secrets/points, imported databases, notes, files or auth tokens.
export function extractProgression(state,{lessonIds,challengeIds,videoPositions={},videoAnswers={},contentVersion}={}){
  if(!Array.isArray(lessonIds)||!Array.isArray(challengeIds))fail('catalog_required');
  const out=[];
  const add=(key,data)=>out.push({key,data:validateProgression(key,data)});
  for(const id of lessonIds){
    const lesson=state.lessons?.[id],data={};
    if(lesson?.done)data.done=true;
    if(object(lesson?.etapes)){const etapes=Object.fromEntries(Object.entries(lesson.etapes).filter(([k,v])=>/^(exo|q\d{1,3})$/.test(k)&&[true,1,'1'].includes(v)).map(([k])=>[k,1]));if(Object.keys(etapes).length)data.etapes=etapes;}
    for(const k of ['at','due','level'])if(Number.isSafeInteger(lesson?.[k]))data[k]=lesson[k];
    if(Object.keys(data).length)add('lesson:'+id,data);
    const answers={};
    for(const [k,v] of Object.entries(videoAnswers[id]||{}))if(/^p?\d{1,3}$/.test(k)&&object(v))answers[k]=k.startsWith('p')?{first:v.first,err:v.err}:{k:v.k,q:v.q};
    const position=videoPositions[id];
    if(position!=null||Object.keys(answers).length){
      const version=object(contentVersion)?contentVersion[id]:contentVersion;
      add('video:'+id,{contentVersion:version,...(position!=null?{position}:{}),...(Object.keys(answers).length?{answers}:{})});
    }
  }
  for(const id of challengeIds)if(state.defis?.[id])add('challenge:'+id,{done:true});
  for(const [id,mark] of Object.entries(state.entretien||{}))if(['ok','review'].includes(mark))add('interview:'+id,{mark});
  for(const [day,n] of Object.entries(state.actDays||{}))if(n>0)add('activity:'+day,{active:true});
  return out;
}

export function createProgressionSync({accountId,auth,url,apikey,store,fetcher=globalThis.fetch,enabled=false}={}){
  let chain=Promise.resolve();
  const storageKey='requete-progress-sync-v1:'+accountId;
  const active=()=>{if(!enabled)fail('sync_disabled');if(!accountId||!auth||!store?.withLock||!store?.get||!store?.set)fail('sync_not_configured');};
  const serial=task=>{try{active();}catch(e){return Promise.reject(e);}const next=chain.then(()=>store.withLock(storageKey,task));chain=next.catch(()=>{});return next;};
  const load=async()=>{
    const saved=await store.get(storageKey);
    if(saved&&(saved.userId!==accountId||saved.schemaVersion!==1))fail('wrong_account_store');
    return saved?clone(saved):{schemaVersion:1,userId:accountId,epoch:null,elements:{},pending:[]};
  };
  const save=state=>store.set(storageKey,clone(state));
  async function session(){
    const local=await auth.getSession(),token=local.data?.session?.access_token;
    if(local.error||!token)fail('not_signed_in');
    const verified=await auth.getUser(token);
    if(verified.error||verified.data?.user?.id!==accountId||verified.data.user.is_anonymous)fail('wrong_account');
    return token; // Captured token binds every request to this user, even during an account switch.
  }
  async function rpc(token,name,body={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetcher(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();if(!response.ok)fail(data?.code||'sync_unavailable');return data;
    }finally{clearTimeout(timeout);}
  }
  function absorb(state,snapshot){
    if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||!Array.isArray(snapshot.elements))fail('invalid_snapshot');
    state.epoch=snapshot.epoch;
    state.elements=Object.fromEntries(snapshot.elements.map(e=>[e.key,e]));
    // Pending operations keep their original epoch/generation: no silent resurrection after a reset.
  }
  const params=(state,key,data,revision,generation)=>({p_epoch:state.epoch,p_cle:key,p_revision:revision,p_generation:generation,...(data?{p_data:data}:{})});
  return Object.freeze({
    enabled:!!enabled,
    async status(){if(!enabled)return {enabled:false,pending:0};return serial(async()=>{const s=await load();return {enabled:true,userId:accountId,pending:s.pending.length,initialized:s.epoch!==null};});},
    pull:()=>serial(async()=>{const token=await session(),s=await load();const snapshot=await rpc(token,'progression_lire');absorb(s,snapshot);await save(s);return {userId:accountId,...snapshot};}),
    enqueue:(key,data)=>serial(async()=>{
      const clean=validateProgression(key,data),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const old=s.pending.find(p=>p.key===key),remote=s.elements[key];
      if(old){if(old.epoch!==s.epoch||old.generation!==(remote?.generation||0))fail('reset_conflict');old.data=mergeProgression(key,old.data,clean);}
      else s.pending.push({key,data:clean,epoch:s.epoch,revision:remote?.revision||0,generation:remote?.generation||0});
      await save(s);return {queued:true,pending:s.pending.length};
    }),
    flush:()=>serial(async()=>{
      const s=await load(),token=await session(),conflicts=[];
      absorb(s,await rpc(token,'progression_lire'));await save(s);
      for(const pending of [...s.pending]){
        let attempts=0;
        for(;;){
          const remote=s.elements[pending.key];
          const reason=pending.epoch!==s.epoch?'epoch':pending.generation!==(remote?.generation||0)?'generation':null;
          if(reason){conflicts.push({key:pending.key,reason});break;}
          if(remote&&!remote.deleted&&same(mergeProgression(pending.key,remote.data,pending.data),remote.data)){
            s.pending=s.pending.filter(p=>p!==pending);await save(s);break; // Lost acknowledgement: already saved.
          }
          const result=await rpc(token,'progression_enregistrer',params(s,pending.key,pending.data,pending.revision,pending.generation));
          if(result.ok){s.elements[pending.key]=result.element;s.pending=s.pending.filter(p=>p!==pending);await save(s);break;}
          if(result.element)s.elements[pending.key]=result.element;
          const monotonic=/^(lesson|challenge|activity):/.test(pending.key)&&!own(pending.data,'due')&&!own(pending.data,'level');
          if(result.reason==='revision'&&monotonic&&attempts++<2){pending.revision=result.element.revision;await save(s);continue;}
          conflicts.push({key:pending.key,reason:result.reason});await save(s);break;
        }
      }
      return {userId:accountId,pending:s.pending.length,conflicts,elements:clone(s.elements),epoch:s.epoch};
    }),
    resolve:(key,choice)=>serial(async()=>{
      if(!['remote','local'].includes(choice))fail('invalid_resolution');
      const s=await load(),pending=s.pending.find(p=>p.key===key);if(!pending)return;
      const remote=s.elements[key];
      if(choice==='remote')s.pending=s.pending.filter(p=>p!==pending);
      else{
        if(pending.epoch!==s.epoch||pending.generation!==(remote?.generation||0))fail('reset_conflict');
        if(key.startsWith('video:')&&remote&&!remote.deleted&&remote.data.contentVersion!==pending.data.contentVersion)fail('content_version_conflict');
        pending.revision=remote?.revision||0;
      }
      await save(s);
    }),
    reset:(key,confirmation)=>serial(async()=>{
      if(confirmation!=='RECOMMENCER')fail('confirmation_required');
      const token=await session(),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const e=s.elements[key];const result=await rpc(token,'progression_reinitialiser',params(s,key,null,e?.revision||0,e?.generation||0));
      if(!result.ok)return result;
      const related=key.startsWith('lesson:')?'video:'+key.slice(7):null;
      s.pending=s.pending.filter(p=>p.key!==key&&p.key!==related);absorb(s,await rpc(token,'progression_lire'));await save(s);return result;
    }),
    resetAll:confirmation=>serial(async()=>{
      if(confirmation!=='EFFACER')fail('confirmation_required');
      const token=await session(),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const result=await rpc(token,'progression_effacer',{p_epoch:s.epoch});if(!result.ok)return result;
      s.pending=[];absorb(s,await rpc(token,'progression_lire'));await save(s);return result;
    })
  });
}
