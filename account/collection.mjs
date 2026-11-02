import {validateProgression} from './progression.mjs';
// Read-only personal collection, derived from shared progress. No duplicate unlock state.
function fail(code){throw Object.assign(new Error(code),{code});}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createCollectionCatalog(modules,cards){
 if(!Array.isArray(modules)||!object(cards))fail('invalid_collection_catalog');
 const catalog=[],seen=new Set();
 modules.forEach((module,index)=>{
  if(!object(module)||typeof module.titre!=='string'||!Array.isArray(module.lessons))fail('invalid_collection_catalog');
  for(const lesson of module.lessons){
   if(!Number.isInteger(lesson.id)||lesson.id<0||seen.has(lesson.id))fail('invalid_collection_catalog');seen.add(lesson.id);
   const card=cards[lesson.id];if(!card)continue;
   if(!object(card)||typeof card.k!=='string'||typeof card.t!=='string')fail('invalid_collection_catalog');
   catalog.push({lessonId:lesson.id,moduleId:'module:'+index,moduleTitle:module.titre,number:catalog.length+1,label:card.k,description:card.t,revisable:!!(!lesson.leconSeule&&lesson.consigne&&lesson.solution)});
  }
 });
 return catalog;
}
export function derivePersonalCollection(snapshot,catalog,{accountId,now}={}){
 if(!accountId||snapshot?.userId!==accountId)fail('wrong_collection_account');
 if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||!Array.isArray(snapshot.elements)||!Array.isArray(catalog)||!Number.isSafeInteger(now)||now<0)fail('invalid_collection_snapshot');
 const records=new Map();
 for(const element of snapshot.elements){
  if(!object(element)||typeof element.key!=='string')fail('invalid_collection_snapshot');
  if(!element.key.startsWith('lesson:'))continue;
  if(records.has(element.key)||typeof element.deleted!=='boolean')fail('invalid_collection_snapshot');
  records.set(element.key,element);
 }
 const ids=new Set(),cards=[],groups=new Map();
 for(const entry of catalog){
  if(!object(entry)||!Number.isInteger(entry.lessonId)||entry.lessonId<0||ids.has(entry.lessonId)||typeof entry.moduleId!=='string'||typeof entry.moduleTitle!=='string'||typeof entry.label!=='string'||typeof entry.description!=='string'||typeof entry.revisable!=='boolean')fail('invalid_collection_catalog');
  ids.add(entry.lessonId);
  const key='lesson:'+entry.lessonId,record=records.get(key),data=record&&!record.deleted?validateProgression(key,record.data):{};
  const unlocked=data.done===true,level=unlocked?(data.level||0):0;
  const dueAt=unlocked&&entry.revisable&&data.due>0?data.due:null;
  const card={lessonId:entry.lessonId,moduleId:entry.moduleId,moduleTitle:entry.moduleTitle,number:cards.length+1,label:entry.label,description:entry.description,unlocked,acquiredAt:unlocked&&data.at>0?data.at:null,level,mastered:unlocked&&level>=2,dueAt,due:dueAt!==null&&dueAt<=now};
  cards.push(card);
  if(!groups.has(entry.moduleId))groups.set(entry.moduleId,{id:entry.moduleId,title:entry.moduleTitle,total:0,unlocked:0});
  const group=groups.get(entry.moduleId);group.total++;if(unlocked)group.unlocked++;
 }
 const modules=[...groups.values()].map(m=>({...m,complete:m.total>0&&m.unlocked===m.total}));
 const unlocked=cards.filter(c=>c.unlocked).length,total=cards.length;
 const dueCards=cards.filter(c=>c.due).sort((a,b)=>a.dueAt-b.dueAt||a.number-b.number);
 return {userId:accountId,epoch:snapshot.epoch,total,unlocked,locked:total-unlocked,percent:total?Math.round(unlocked/total*100):0,completedModules:modules.filter(m=>m.complete).length,nextLessonId:cards.find(c=>!c.unlocked)?.lessonId??null,nextReviewAt:cards.reduce((n,c)=>c.dueAt!==null&&(n===null||c.dueAt<n)?c.dueAt:n,null),dueLessonIds:dueCards.map(c=>c.lessonId),cards,modules};
}
export function createPersonalCollection({accountId,sync,catalog,enabled=false}={}){
 // Freeze a copy of trusted local catalog metadata; no retained personal snapshot.
 const trusted=Array.isArray(catalog)?JSON.parse(JSON.stringify(catalog)):catalog;
 return Object.freeze({
  enabled:!!enabled,
  async read({now=Date.now()}={}){
   if(!enabled)return {enabled:false,collection:null};
   if(!accountId||!sync?.pull||!Array.isArray(trusted))fail('collection_not_configured');
   const snapshot=await sync.pull();
   return {enabled:true,collection:derivePersonalCollection(snapshot,trusted,{accountId,now})};
  }
 });
}
