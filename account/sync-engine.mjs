// Internal shared CAS/queue engine. Protocols select separate storage, RPCs and validation.
const clone=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const stable=x=>JSON.stringify(x,(_,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a,b)=>stable(a)===stable(b);
function fail(code){throw Object.assign(new Error(code),{code});}
export function createPrivateSync({accountId,auth,url,apikey,store,fetcher=globalThis.fetch,enabled=false}={},protocol){
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
