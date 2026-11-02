import {createPrivateSync} from './sync-engine.mjs';
function fail(code){throw Object.assign(new Error(code),{code});}
export function validateDocument(key,data){
 if(typeof key!=='string'||!/^note:[A-Za-z0-9_.-]{1,96}$/.test(key)||!data||typeof data!=='object'||Array.isArray(data))fail('invalid_document');
 const keys=['txt','sql','ctx','ts','pin'];
 if(Object.keys(data).length!==5||Object.keys(data).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(data,k)))fail('invalid_document');
 if(typeof data.txt!=='string'||[...data.txt].length>20000||typeof data.sql!=='string'||[...data.sql].length>12000||typeof data.ctx!=='string'||[...data.ctx].length>300||typeof data.pin!=='boolean'||!Number.isSafeInteger(data.ts)||data.ts<0||data.ts>4102444800000||!data.txt.trim()&&!data.sql.trim()||new TextEncoder().encode(JSON.stringify(data)).length>65536||[data.txt,data.sql,data.ctx].some(s=>s.includes('\0')))fail('invalid_document');
 return {txt:data.txt,sql:data.sql,ctx:data.ctx,ts:data.ts,pin:data.pin};
}
// Only caller-selected, saved notes. No scan of editor drafts, history or databases.
export function extractSavedNotes(selectedNotes){
 if(!Array.isArray(selectedNotes))fail('invalid_document');const seen=new Set();
 return selectedNotes.map(note=>{
  if(!note||typeof note.id!=='string'||seen.has(note.id))fail('invalid_document');seen.add(note.id);
  const key='note:'+note.id;
  return {key,data:validateDocument(key,{txt:note.txt??'',sql:note.sql??'',ctx:note.ctx??'',ts:note.ts,pin:!!note.pin})};
 });
}
export function notesFromSnapshot(snapshot,{accountId}={}){
 if(!accountId||snapshot?.userId!==accountId)fail('wrong_account');
 if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||!Array.isArray(snapshot.elements))fail('invalid_snapshot');
 const seen=new Set(),notes=[];
 for(const e of snapshot.elements){
  if(typeof e?.key!=='string'||seen.has(e.key)||typeof e.deleted!=='boolean')fail('invalid_snapshot');seen.add(e.key);
  if(e.deleted)continue;const data=validateDocument(e.key,e.data);notes.push({id:e.key.slice(5),...data});
 }
 return notes.sort((a,b)=>Number(b.pin)-Number(a.pin)||b.ts-a.ts||a.id.localeCompare(b.id));
}
export function createDocumentsSync(options={}){
 return createPrivateSync(options,{
  storagePrefix:'requete-documents-sync-v1:',rpcPrefix:'documents_',validate:validateDocument,
  merge:(key,remote,incoming)=>validateDocument(key,incoming),isMonotonic:()=>false,
  relatedReset:()=>null,checkResolution:()=>{},resetConfirmation:'SUPPRIMER'
 });
}
