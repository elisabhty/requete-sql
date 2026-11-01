import initSqlJs from './sqlite.mjs';
import {attachDateFns,sqlCompat} from './sql-compat.mjs';
import {exerciseResultsMatch,execChallengeResult} from './matcher.mjs';
let engine;
export async function sqlite(testBinary){
  if(!engine)engine=(async()=>{
    if(testBinary)return initSqlJs({wasmBinary:testBinary});
    const r=await fetch('https://elisabhty.github.io/requete-sql/vendor/sqljs/sql-wasm.wasm');
    if(!r.ok)throw Error('Moteur SQL indisponible.');
    const bytes=await r.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!=='d7e61b828523001f26ce0b3f88dabcf6c12e5e6edf80eb4f08b26ac7b946ff88')throw Error('Moteur SQL non reconnu.');
    return initSqlJs({wasmBinary:new Uint8Array(bytes)});
  })().catch(e=>{engine=null;e.unavailable=true;throw e;});
  return engine;
}
// The lexer preserves identifiers/literals for SQLite, but excludes instructions,
// comments and expensive primitives before preparing the single read-only statement.
export function safeSelect(sql){
  if(typeof sql!=='string'||sql.length>12000)throw Error('Requête trop longue.');
  const tokens=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\//g,token => token.startsWith("'") || token.startsWith('--') || token.startsWith('/*') ? ' ' : ' '+token.slice(1,-1)+' ');
  const body=tokens.trim().replace(/;\s*$/,'');
  if(!/^(SELECT|WITH)\b/i.test(body)||body.includes(';')||/\b(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|LOAD_EXTENSION|RECURSIVE|RANDOMBLOB|ZEROBLOB|PRINTF|FORMAT|REPEAT|REPLICATE|SPACE|LPAD|RPAD|READFILE|WRITEFILE|SQLITE_SCHEMA|SQLITE_MASTER)\b/i.test(body))
    throw Error('Utilise une seule requête de lecture SELECT pour ce défi.');
  return sqlCompat(sql);
}
export async function verify(catalog,id,sql){
  const c=catalog.challenges.find(c=>c.id===id);if(!c)throw Error('Défi inconnu.');
  const query=safeSelect(sql),SQL=await sqlite(),db=attachDateFns(new SQL.Database());
  try{
    db.run(catalog.bases[c.base]||catalog.schema);
    const expected=execChallengeResult(db,c.sol);
    // These limits are applied before any user statement and cannot be changed by it.
    db.run('PRAGMA query_only=ON; PRAGMA hard_heap_limit=33554432; PRAGMA temp_store=MEMORY;');
    const st=db.prepare(query),columns=st.getColumnNames(),values=[];
    try{while(st.step()){if(values.length>=2000)throw Error('Résultat trop volumineux.');const row=st.get();if(row.some(v=>typeof v==='string'&&v.length>10000))throw Error('Valeur trop volumineuse.');values.push(row);}}finally{st.free();}
    return exerciseResultsMatch(columns.length?[{columns,values}]:[],expected,c,true);
  }finally{db.close();}
}
