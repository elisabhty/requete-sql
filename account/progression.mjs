import {createPrivateSync} from './sync-engine.mjs';
import {validatePlan} from './learning.mjs';
// Prepared sync engine. No SDK, storage, timer or network is initialized at import.
const clone=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
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

export function createProgressionSync(options={}){
 return createPrivateSync(options,{
  storagePrefix:'requete-progress-sync-v1:',rpcPrefix:'progression_',validate:validateProgression,merge:mergeProgression,
  isMonotonic:p=>/^(lesson|challenge|activity):/.test(p.key)&&!own(p.data,'due')&&!own(p.data,'level'),
  relatedReset:key=>key.startsWith('lesson:')?'video:'+key.slice(7):null,
  checkResolution:(key,remote,pending)=>{if(key.startsWith('video:')&&remote&&!remote.deleted&&remote.data.contentVersion!==pending.data.contentVersion)fail('content_version_conflict');}
 });
}
