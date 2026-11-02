// Prepared helpers only: no timer, storage, SDK or network on import.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
function fail(code){throw Object.assign(new Error(code),{code});}
const fields=['niveau','rythme','freq','per','mix','sessions','archive','timeZone'];
function day(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2000-01-01'&&value<='2100-12-31'&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function validatePlan(plan){
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
export function extractPlan(state,{lessonIds,timeZone}={}){
 if(state.plan==null)return null;
 if(!Array.isArray(lessonIds))fail('catalog_required');
 const ids=new Set(lessonIds),p=state.plan;
 const clean=values=>(values||[]).filter(id=>typeof id==='number'&&ids.has(id));
 return validatePlan({niveau:p.niveau,rythme:p.rythme,freq:p.freq,per:p.per,mix:!!p.mix,timeZone,sessions:(p.sessions||[]).map(s=>({d:s.d,lessons:clean(s.lessons)})).filter(s=>s.lessons.length),archive:clean(p.archive)});
}
export function movePlanLesson(plan,id,date,index){
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
export function reviewPatch(current,success,now){
 if(!current?.done||typeof success!=='boolean'||!Number.isInteger(current.level)||current.level<0||current.level>4||!Number.isSafeInteger(now)||now<0)fail('invalid_review');
 const level=success?Math.min(current.level+1,4):0,due=now+intervals[level]*DAY;
 if(due>4102444800000)fail('invalid_review');
 return {level,due};
}
export function dueReviews(elements,{lessonIds,now}={}){
 if(!Array.isArray(lessonIds)||!Number.isSafeInteger(now)||now<0)fail('invalid_review');
 const ids=new Set(lessonIds.map(String));
 return Object.values(elements).filter(e=>!e.deleted&&e.key.startsWith('lesson:')&&ids.has(e.key.slice(7))&&e.data.done&&Number.isSafeInteger(e.data.due)&&e.data.due>0&&e.data.due<=now).sort((a,b)=>a.data.due-b.data.due||a.key.localeCompare(b.key)).map(copy);
}
