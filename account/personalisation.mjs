import {createPrivateSync} from './sync-engine.mjs';
export const STICKER_IDS=Object.freeze(['intro','lire','fonctions','agregats','jointures','sousreq','fenetre','modeliser','creer','ecrire','contraintes','transactions','triggers','index','securite','requete','lecons10','serie3','defis10','serie7','parcours']);
const ids=new Set(STICKER_IDS),object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k),clone=x=>JSON.parse(JSON.stringify(x));
const date=n=>Number.isSafeInteger(n)&&n>=0&&n<=4102444800000;
const activity=k=>/^(l\d{1,6}|d[A-Za-z0-9_-]{1,24}|jeu|console|entretien)$/.test(k);
function fail(code='invalid_personalisation'){throw Object.assign(new Error(code),{code});}
function shape(x,keys){return object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));}
function zone(z){try{return typeof z==='string'&&z.length<=100&&(z==='UTC'||z.includes('/'))&&!!new Intl.DateTimeFormat('fr',{timeZone:z});}catch{return false;}}
export function validatePersonalisation(key,data){
 if(!object(data)||new TextEncoder().encode(JSON.stringify(data)).length>65536)fail();
 if(key==='preferences:main'){
  if(!shape(data,['largeText','reduceMotion','videoRate','challenge','reminder'])||typeof data.largeText!=='boolean'||typeof data.reduceMotion!=='boolean'||![.5,.75,1,1.5,2].includes(data.videoRate)||!shape(data.challenge,['niv','nb','mode','nivUser'])||!['f','m','d'].includes(data.challenge.niv)||![1,3,5].includes(data.challenge.nb)||!['solo','friends'].includes(data.challenge.mode)||typeof data.challenge.nivUser!=='boolean'||!shape(data.reminder,['enabled','time'])||typeof data.reminder.enabled!=='boolean'||typeof data.reminder.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.reminder.time))fail();
 }else if(key==='stickers:board'){
  if(!shape(data,['got','fresh','board','since'])||!object(data.got)||!object(data.fresh)||!Array.isArray(data.board)||data.board.length>21||!date(data.since))fail();
  for(const [id,at] of Object.entries(data.got))if(!ids.has(id)||!date(at)||at<1)fail();
  for(const [id,value] of Object.entries(data.fresh))if(!own(data.got,id)||value!==1)fail();
  const placed=new Set();for(const b of data.board){
   if(!shape(b,['id','x','y','r','s'])||!own(data.got,b.id)||placed.has(b.id)||!['x','y','r','s'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k]))||b.x<0||b.x>1||b.y<0||b.y>1||b.r< -180||b.r>180||b.s<.5||b.s>2)fail();placed.add(b.id);
  }
 }else if(key==='study:legacy'){
  if(!shape(data,['cutoff','days','items','timeZone'])||!date(data.cutoff)||data.cutoff<946684800000||!object(data.days)||!object(data.items)||Object.keys(data.days).length>4096||Object.keys(data.items).length>1024||!zone(data.timeZone))fail();
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(data.cutoff).map(p=>[p.type,p.value]));
  const cutoffDay=`${parts.year}-${parts.month}-${parts.day}`;
  let days=0,items=0;for(const [day,n] of Object.entries(data.days)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'2000-01-01'||day>'2100-01-01'||day>cutoffDay||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||!Number.isInteger(n)||n<0||n>86400)fail();days+=n;
  }
  for(const [k,n] of Object.entries(data.items)){if(!activity(k)||!Number.isInteger(n)||n<0||n>3155760000)fail();items+=n;}
  if(days!==items)fail();
 }else if(typeof key==='string'&&/^study:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key)){
  if(!shape(data,['activity','start','end'])||typeof data.activity!=='string'||!activity(data.activity)||!date(data.start)||data.start<946684800000||!date(data.end)||data.end<=data.start||data.end-data.start>3600000)fail();
 }else fail();
 return clone(data);
}
export function mergePersonalisation(key,remote,incoming){
 const data=validatePersonalisation(key,incoming);
 if(key==='stickers:board'){
  if(remote.since>0)data.since=data.since>0?Math.min(remote.since,data.since):remote.since;
  for(const [id,at] of Object.entries(remote.got||{})){
   const next=data.got[id];data.got[id]=next===undefined?at:at===1?next:next===1?at:Math.min(at,next);
  }
 }
 return data;
}
export function extractStickers(state){
 const s=state.stickers||{got:{},fresh:{},board:[],since:0};
 return validatePersonalisation('stickers:board',{got:s.got||{},fresh:Object.fromEntries(Object.entries(s.fresh||{}).map(([k])=>[k,1])),board:(s.board||[]).map(b=>({id:b.id,x:b.x,y:b.y,r:((b.r+180)%360+360)%360-180,s:b.s})),since:s.since||0});
}
export function extractPreferences(state,{videoRate=1,challenge={niv:'f',nb:1,mode:'solo',nivUser:false},reminder={enabled:false,time:'19:00'}}={}){
 return validatePersonalisation('preferences:main',{largeText:state.preferences?.largeText===true,reduceMotion:state.preferences?.reduceMotion===true,videoRate,challenge:{niv:challenge.niv,nb:challenge.nb,mode:challenge.mode,nivUser:challenge.nivUser},reminder:{enabled:reminder.enabled,time:reminder.time}});
}
export function extractLegacyStudy(state,{cutoff,timeZone}={}){
 return validatePersonalisation('study:legacy',{cutoff,timeZone,days:state.study?.days||{},items:state.study?.items||{}});
}
export function createPersonalisationSync(options={}){
 return createPrivateSync(options,{storagePrefix:'requete-personalisation-sync-v1:',rpcPrefix:'personnalisation_',validate:validatePersonalisation,merge:mergePersonalisation,isMonotonic:()=>false,relatedReset:()=>null,
 checkResolution:(key,remote,pending)=>{if(key.startsWith('study:')&&remote&&!remote.deleted&&JSON.stringify(remote.data,(_,v)=>object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v)!==JSON.stringify(pending.data,(_,v)=>object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v))fail('immutable_study');},resetConfirmation:'SUPPRIMER'});
}
