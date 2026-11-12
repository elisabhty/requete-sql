/* compte-moteurs.js : FICHIER PRODUIT par scripts/compte-moteurs.mjs à partir de account/sync-engine.mjs, account/learning.mjs, account/progression.mjs, account/documents.mjs.
   Ne pas modifier à la main : changer account/*.mjs, puis npm run build:www (ou node scripts/compte-moteurs.mjs). */
(function(){
'use strict';
var M={};
M['sync-engine']=(function(){
// Internal shared CAS/queue engine. Protocols select separate storage, RPCs and validation.
const clone=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const stable=x=>JSON.stringify(x,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a,b)=>stable(a)===stable(b);
function fail(code){throw Object.assign(new Error(code),{code});}
function createPrivateSync({accountId,auth,url,apikey,store,fetcher=globalThis.fetch,enabled=false}={},protocol){
  const {storagePrefix,rpcPrefix,validate,merge,isMonotonic,relatedReset,checkResolution,resetConfirmation='RECOMMENCER'}=protocol;
  let chain=Promise.resolve();
  const storageKey=storagePrefix+accountId;
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
    pull:()=>serial(async()=>{const token=await session(),s=await load();const snapshot=await rpc(token,rpcPrefix+'lire');absorb(s,snapshot);await save(s);return {userId:accountId,...snapshot};}),
    enqueue:(key,data)=>serial(async()=>{
      const clean=validate(key,data),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const old=s.pending.find(p=>p.key===key),remote=s.elements[key];
      if(old){if(old.epoch!==s.epoch||old.generation!==(remote?.generation||0))fail('reset_conflict');old.data=merge(key,old.data,clean);}
      else s.pending.push({key,data:clean,epoch:s.epoch,revision:remote?.revision||0,generation:remote?.generation||0});
      await save(s);return {queued:true,pending:s.pending.length};
    }),
    flush:()=>serial(async()=>{
      const s=await load(),token=await session(),conflicts=[];
      absorb(s,await rpc(token,rpcPrefix+'lire'));await save(s);
      for(const pending of [...s.pending]){
        let attempts=0;
        for(;;){
          const remote=s.elements[pending.key];
          const reason=pending.epoch!==s.epoch?'epoch':pending.generation!==(remote?.generation||0)?'generation':null;
          if(reason){conflicts.push({key:pending.key,reason});break;}
          if(remote&&!remote.deleted&&same(merge(pending.key,remote.data,pending.data),remote.data)){
            s.pending=s.pending.filter(p=>p!==pending);await save(s);break; // Lost acknowledgement: already saved.
          }
          const result=await rpc(token,rpcPrefix+'enregistrer',params(s,pending.key,pending.data,pending.revision,pending.generation));
          if(result.ok){s.elements[pending.key]=result.element;s.pending=s.pending.filter(p=>p!==pending);await save(s);break;}
          if(result.element)s.elements[pending.key]=result.element;
          const monotonic=isMonotonic(pending);
          if(result.reason==='revision'&&result.element&&monotonic&&attempts++<2){pending.revision=result.element.revision;await save(s);continue;}
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
        checkResolution(key,remote,pending);
        pending.revision=remote?.revision||0;
      }
      await save(s);
    }),
    reset:(key,confirmation)=>serial(async()=>{
      if(confirmation!==resetConfirmation)fail('confirmation_required');
      const token=await session(),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const e=s.elements[key];const result=await rpc(token,rpcPrefix+'reinitialiser',params(s,key,null,e?.revision||0,e?.generation||0));
      if(!result.ok)return result;
      const related=relatedReset(key);
      s.pending=s.pending.filter(p=>p.key!==key&&p.key!==related);absorb(s,await rpc(token,rpcPrefix+'lire'));await save(s);return result;
    }),
    resetAll:confirmation=>serial(async()=>{
      if(confirmation!=='EFFACER')fail('confirmation_required');
      const token=await session(),s=await load();if(s.epoch===null)fail('initial_sync_required');
      const result=await rpc(token,rpcPrefix+'effacer',{p_epoch:s.epoch});if(!result.ok)return result;
      s.pending=[];absorb(s,await rpc(token,rpcPrefix+'lire'));await save(s);return result;
    })
  });
}
return {createPrivateSync};
})();
M['learning']=(function(){
// Prepared helpers only: no timer, storage, SDK or network on import.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
function fail(code){throw Object.assign(new Error(code),{code});}
const fields=['niveau','rythme','freq','per','mix','sessions','archive','timeZone'];
function day(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<='2100-12-31'&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validatePlan(plan){
 if(!object(plan)||Object.keys(plan).length!==fields.length||fields.some(k=>!Object.hasOwn(plan,k))||Object.keys(plan).some(k=>!fields.includes(k)))fail('invalid_plan');
 if(!['debutant','bases','inter'].includes(plan.niveau)||!['calme','regulier','intensif'].includes(plan.rythme)||![2,3,5,7].includes(plan.freq)||!Number.isInteger(plan.per)||plan.per<1||plan.per>100||typeof plan.mix!=='boolean')fail('invalid_plan');
 if(typeof plan.timeZone!=='string'||plan.timeZone.length>100||(!plan.timeZone.includes('/')&&plan.timeZone!=='UTC'))fail('invalid_plan');
 try{new Intl.DateTimeFormat('fr',{timeZone:plan.timeZone});}catch{fail('invalid_plan');}
 if(!Array.isArray(plan.sessions)||plan.sessions.length>512||!Array.isArray(plan.archive))fail('invalid_plan');
 const seen=new Set(),dates=new Set();
 const lesson=id=>{if(!Number.isInteger(id)||id<0||id>999999||seen.has(id)||seen.size>=1024)fail('invalid_plan');seen.add(id);};
 for(const session of plan.sessions){
  if(!object(session)||Object.keys(session).length!==2||!Object.hasOwn(session,'d')||!Object.hasOwn(session,'lessons')||!day(session.d)||dates.has(session.d)||!Array.isArray(session.lessons)||!session.lessons.length)fail('invalid_plan');
  dates.add(session.d);session.lessons.forEach(lesson);
 }
 plan.archive.forEach(lesson);
 if(new TextEncoder().encode(JSON.stringify(plan)).length>32768)fail('invalid_plan');
 return copy(plan);
}
// Explicit export for a future opt-in import. Legacy challenge IDs are excluded.
function extractPlan(state,{lessonIds,timeZone}={}){
 if(state.plan==null)return null;
 if(!Array.isArray(lessonIds))fail('catalog_required');
 const ids=new Set(lessonIds),p=state.plan;
 const clean=values=>(values||[]).filter(id=>typeof id==='number'&&ids.has(id));
 return validatePlan({niveau:p.niveau,rythme:p.rythme,freq:p.freq,per:p.per,mix:!!p.mix,timeZone,sessions:(p.sessions||[]).map(s=>({d:s.d,lessons:clean(s.lessons)})).filter(s=>s.lessons.length),archive:clean(p.archive)});
}
function movePlanLesson(plan,id,date,index){
 const next=validatePlan(plan);
 if(!day(date)||!Number.isInteger(id)||!next.sessions.some(s=>s.lessons.includes(id))&&!next.archive.includes(id))fail('invalid_move');
 next.sessions.forEach(s=>{s.lessons=s.lessons.filter(x=>x!==id);});next.archive=next.archive.filter(x=>x!==id);
 let target=next.sessions.find(s=>s.d===date);if(!target){target={d:date,lessons:[]};next.sessions.push(target);}
 if(index===undefined)index=target.lessons.length;
 if(!Number.isInteger(index)||index<0||index>target.lessons.length)fail('invalid_move');
 target.lessons.splice(index,0,id);next.sessions=next.sessions.filter(s=>s.lessons.length).sort((a,b)=>a.d.localeCompare(b.d));
 return validatePlan(next);
}
const intervals=[1,3,7,21,60],DAY=86400000;
// Same legacy lesson intervals as index.html. A failure MUST transmit level:0.
function reviewPatch(current,success,now){
 if(!current?.done||typeof success!=='boolean'||!Number.isInteger(current.level)||current.level<0||current.level>4||!Number.isSafeInteger(now)||now<0)fail('invalid_review');
 const level=success?Math.min(current.level+1,4):0,due=now+intervals[level]*DAY;
 if(due>4102444800000)fail('invalid_review');
 return {level,due};
}
function dueReviews(elements,{lessonIds,now}={}){
 if(!Array.isArray(lessonIds)||!Number.isSafeInteger(now)||now<0)fail('invalid_review');
 const ids=new Set(lessonIds.map(String));
 return Object.values(elements).filter(e=>!e.deleted&&e.key.startsWith('lesson:')&&ids.has(e.key.slice(7))&&e.data.done&&Number.isSafeInteger(e.data.due)&&e.data.due>0&&e.data.due<=now).sort((a,b)=>a.data.due-b.data.due||a.key.localeCompare(b.key)).map(copy);
}
return {validatePlan,extractPlan,movePlanLesson,reviewPatch,dueReviews};
})();
M['progression']=(function(){
const {createPrivateSync}=M['sync-engine'];
const {validatePlan}=M['learning'];
// Prepared sync engine. No SDK, storage, timer or network is initialized at import.
const clone=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function fail(code){throw Object.assign(new Error(code),{code});}
function validateProgression(key,data){
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
function mergeProgression(key,remote={},incoming={}){
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
function extractProgression(state,{lessonIds,challengeIds,videoPositions={},videoAnswers={},contentVersion}={}){
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

function createProgressionSync(options={}){
 return createPrivateSync(options,{
  storagePrefix:'requete-progress-sync-v1:',rpcPrefix:'progression_',validate:validateProgression,merge:mergeProgression,
  isMonotonic:p=>/^(lesson|challenge|activity):/.test(p.key)&&!own(p.data,'due')&&!own(p.data,'level'),
  relatedReset:key=>key.startsWith('lesson:')?'video:'+key.slice(7):null,
  checkResolution:(key,remote,pending)=>{if(key.startsWith('video:')&&remote&&!remote.deleted&&remote.data.contentVersion!==pending.data.contentVersion)fail('content_version_conflict');}
 });
}
return {validateProgression,mergeProgression,extractProgression,createProgressionSync};
})();
M['documents']=(function(){
const {createPrivateSync}=M['sync-engine'];
function fail(code){throw Object.assign(new Error(code),{code});}
function validateDocument(key,data){
 if(typeof key!=='string'||!/^note:[A-Za-z0-9_.-]{1,96}$/.test(key)||!data||typeof data!=='object'||Array.isArray(data))fail('invalid_document');
 const keys=['txt','sql','ctx','ts','pin'];
 if(Object.keys(data).length!==5||Object.keys(data).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(data,k)))fail('invalid_document');
 if(typeof data.txt!=='string'||[...data.txt].length>20000||typeof data.sql!=='string'||[...data.sql].length>12000||typeof data.ctx!=='string'||[...data.ctx].length>300||typeof data.pin!=='boolean'||!Number.isSafeInteger(data.ts)||data.ts<0||data.ts>4102444800000||!data.txt.trim()&&!data.sql.trim()||new TextEncoder().encode(JSON.stringify(data)).length>65536||[data.txt,data.sql,data.ctx].some(s=>s.includes('\0')))fail('invalid_document');
 return {txt:data.txt,sql:data.sql,ctx:data.ctx,ts:data.ts,pin:data.pin};
}
// Only caller-selected, saved notes. No scan of editor drafts, history or databases.
function extractSavedNotes(selectedNotes){
 if(!Array.isArray(selectedNotes))fail('invalid_document');const seen=new Set();
 return selectedNotes.map(note=>{
  if(!note||typeof note.id!=='string'||seen.has(note.id))fail('invalid_document');seen.add(note.id);
  const key='note:'+note.id;
  return {key,data:validateDocument(key,{txt:note.txt??'',sql:note.sql??'',ctx:note.ctx??'',ts:note.ts,pin:!!note.pin})};
 });
}
function notesFromSnapshot(snapshot,{accountId}={}){
 if(!accountId||snapshot?.userId!==accountId)fail('wrong_account');
 if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||!Array.isArray(snapshot.elements))fail('invalid_snapshot');
 const seen=new Set(),notes=[];
 for(const e of snapshot.elements){
  if(typeof e?.key!=='string'||seen.has(e.key)||typeof e.deleted!=='boolean')fail('invalid_snapshot');seen.add(e.key);
  if(e.deleted)continue;const data=validateDocument(e.key,e.data);notes.push({id:e.key.slice(5),...data});
 }
 return notes.sort((a,b)=>Number(b.pin)-Number(a.pin)||b.ts-a.ts||a.id.localeCompare(b.id));
}
function createDocumentsSync(options={}){
 return createPrivateSync(options,{
  storagePrefix:'requete-documents-sync-v1:',rpcPrefix:'documents_',validate:validateDocument,
  merge:(key,remote,incoming)=>validateDocument(key,incoming),isMonotonic:()=>false,
  relatedReset:()=>null,checkResolution:()=>{},resetConfirmation:'SUPPRIMER'
 });
}
return {validateDocument,extractSavedNotes,notesFromSnapshot,createDocumentsSync};
})();
window.REQUETE_MOTEURS=Object.freeze({
  createProgressionSync:M['progression'].createProgressionSync,extractProgression:M['progression'].extractProgression,
  mergeProgression:M['progression'].mergeProgression,validateProgression:M['progression'].validateProgression,
  extractPlan:M['learning'].extractPlan,validatePlan:M['learning'].validatePlan,
  createDocumentsSync:M['documents'].createDocumentsSync,extractSavedNotes:M['documents'].extractSavedNotes,
  notesFromSnapshot:M['documents'].notesFromSnapshot,validateDocument:M['documents'].validateDocument
});
})();
