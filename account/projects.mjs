import {createPrivateSync} from './sync-engine.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const HEADER='SQLite format 3\0';
function fail(code='invalid_project'){throw Object.assign(new Error(code),{code});}
const text=(s,max)=>typeof s==='string'&&[...s].length<=max&&!s.includes('\0');
function sqliteBytes(b64){
 if(typeof b64!=='string'||b64.length>2796204||b64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))fail();
 let raw;try{raw=atob(b64);}catch{fail();}
 if(raw.length>2097152||raw.length!==0&&(raw.length<100||raw.slice(0,16)!==HEADER)||btoa(raw)!==b64)fail();
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function queryList(items,max,pins){
 if(!Array.isArray(items)||items.length>max)fail();
 for(const q of items){
  if(!object(q)||!Object.hasOwn(q,'sql')||!Object.hasOwn(q,'ts')||!text(q.sql,12000)||!q.sql.trim()||!Number.isSafeInteger(q.ts)||q.ts<0||q.ts>4102444800000||Object.keys(q).some(k=>!(pins?['sql','ts']:['sql','ts','ok','n','ms','err']).includes(k)))fail();
  if('ok' in q&&typeof q.ok!=='boolean'||'n' in q&&(!Number.isInteger(q.n)||q.n<0||q.n>1000000000)||'ms' in q&&(!Number.isFinite(q.ms)||q.ms<0||q.ms>86400000)||'err' in q&&!text(q.err,2000))fail();
 }
}
export function validateProject(key,p){
 const fields=['name','scope','draft','desc','tdesc','pins','hist','database','baselines'];
 if(typeof key!=='string'||!/^project:db_[A-Za-z0-9_.-]{1,93}$/.test(key)||!object(p)||Object.keys(p).length!==fields.length||fields.some(k=>!Object.hasOwn(p,k))||!text(p.name,80)||!p.name.trim()||!['workspace','complete'].includes(p.scope)||!text(p.draft,12000)||!text(p.desc,4000)||!object(p.tdesc)||Object.keys(p.tdesc).length>128||!object(p.baselines)||Object.keys(p.baselines).length>128)fail();
 for(const [name,desc] of Object.entries(p.tdesc))if(!text(name,128)||!name.length||!text(desc,4000))fail();
 queryList(p.pins,12,true);queryList(p.hist,24,false);
 if(p.scope==='workspace'){if(p.database!==null||Object.keys(p.baselines).length)fail();}
 else{if(!object(p.database)||Object.keys(p.database).length!==1||!Object.hasOwn(p.database,'b64'))fail();sqliteBytes(p.database.b64);}
 for(const [key,b] of Object.entries(p.baselines)){
  if(!text(key,128)||!key.length||!object(b)||Object.keys(b).length!==2||!text(b.name,128)||!b.name.length||!Object.hasOwn(b,'b64'))fail();sqliteBytes(b.b64);
 }
 if(new TextEncoder().encode(JSON.stringify(p)).length>4194304)fail();
 return clone(p);
}
// The caller selects one project and explicitly supplies any SQLite snapshot.
// No access to customDbs, localStorage, imported files or current editor is made here.
export function extractPersonalProject(meta,workspace,{includeDatabase=false,databaseBytes,baselines={},includeHistory=false}={}){
 if(!object(meta)||typeof meta.id!=='string'||!meta.id.startsWith('db_')||!object(workspace))fail();
 let database=null;
 if(includeDatabase){
  if(!(databaseBytes instanceof Uint8Array)||databaseBytes.length>2097152)fail('project_database_required');
  let raw='';for(const b of databaseBytes)raw+=String.fromCharCode(b);database={b64:btoa(raw)};
 }
 const query=(q,pinned)=>{const out={sql:q.sql,ts:q.ts};if(!pinned)for(const k of ['ok','n','ms','err'])if(q[k]!==undefined)out[k]=q[k];return out;};
 const key='project:'+meta.id;
 const data=validateProject(key,{name:meta.name,scope:includeDatabase?'complete':'workspace',draft:workspace.draft??'',desc:workspace.desc??'',tdesc:workspace.tdesc??{},pins:(workspace.pins||[]).map(q=>query(q,true)),hist:includeHistory?(workspace.hist||[]).map(q=>query(q,false)):[],database,baselines:includeDatabase?baselines:{}});
 return {key,data};
}
export function decodeProjectDatabase(key,data){const project=validateProject(key,data);return project.database===null?null:sqliteBytes(project.database.b64);}
export function projectsFromSnapshot(snapshot,{accountId}={}){
 if(!accountId||snapshot?.userId!==accountId)fail('wrong_account');
 if(snapshot.schemaVersion!==1||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||!Array.isArray(snapshot.elements))fail('invalid_snapshot');
 const seen=new Set(),out=[];
 for(const e of snapshot.elements){if(!e||typeof e.key!=='string'||seen.has(e.key)||typeof e.deleted!=='boolean')fail('invalid_snapshot');seen.add(e.key);if(!e.deleted)out.push({id:e.key.slice(8),...validateProject(e.key,e.data),revision:e.revision,generation:e.generation,updatedAt:e.updatedAt});}
 return out;
}
export function createProjectsSync(options={}){
 return createPrivateSync(options,{storagePrefix:'requete-projects-sync-v1:',rpcPrefix:'projets_',validate:validateProject,merge:(key,remote,data)=>validateProject(key,data),isMonotonic:()=>false,relatedReset:()=>null,checkResolution:(key,remote,pending)=>{if(remote&&!remote.deleted&&remote.data.scope==='complete'&&pending.data.scope==='workspace')fail('project_database_removal');},resetConfirmation:'SUPPRIMER'});
}
