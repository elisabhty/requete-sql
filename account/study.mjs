import {validatePersonalisation} from './personalisation.mjs';
function fail(code){throw Object.assign(new Error(code),{code});}
export function createStudySegment(id,{activity,start,end}){const key='study:'+id;return {key,data:validatePersonalisation(key,{activity,start,end})};}
export function summariseStudy(snapshot,{accountId,timeZone='UTC'}={}){
 if(!accountId||snapshot?.userId!==accountId)fail('wrong_account');
 if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||!Array.isArray(snapshot.elements))fail('invalid_snapshot');
 let formatter;try{formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{fail('invalid_time_zone');}
 const day=at=>{const p=Object.fromEntries(formatter.formatToParts(at).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;};
 const seen=new Set(),segments=[];let legacy=null;
 for(const e of snapshot.elements){
  if(typeof e?.key!=='string'||seen.has(e.key)||typeof e.deleted!=='boolean')fail('invalid_snapshot');seen.add(e.key);
  if(e.deleted||!e.key.startsWith('study:'))continue;
  const data=validatePersonalisation(e.key,e.data);if(e.key==='study:legacy')legacy=data;else segments.push({id:e.key,...data});
 }
 const days={...(legacy?.days||{})},items={...(legacy?.items||{})};let totalSeconds=Object.values(days).reduce((a,n)=>a+n,0),covered=legacy?.cutoff||0;
 const addDays=(start,end)=>{
  while(start<end){const label=day(start);let limit=end;
   if(day(end-1)!==label){let lo=start+1,hi=end;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(day(mid)===label)lo=mid+1;else hi=mid;}limit=lo;}
   days[label]=(days[label]||0)+(limit-start)/1000;start=limit;
  }
 };
 for(const s of segments.sort((a,b)=>a.start-b.start||(a.id<b.id?-1:a.id>b.id?1:0))){
  const start=Math.max(s.start,covered);if(s.end<=start)continue;
  const seconds=(s.end-start)/1000;totalSeconds+=seconds;items[s.activity]=(items[s.activity]||0)+seconds;addDays(start,s.end);covered=s.end;
 }
 return {userId:accountId,epoch:snapshot.epoch,totalSeconds,days,items,legacyImported:!!legacy};
}
