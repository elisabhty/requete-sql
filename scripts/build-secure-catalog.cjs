const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('const CHALLENGES=['),html.indexOf('const NIV='))+';globalThis.data={challenges:CHALLENGES.map(({id,niv,base,sol,ordered,noExec})=>({id,niv,base,sol,ordered:!!ordered,noExec:!!noExec})),bases:DEFI_BASES};',ctx);
const schema=html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)[1];
const catalog={challenges:ctx.data.challenges.filter(c=>!c.noExec&&!/^\s*EXPLAIN/i.test(c.sol)),bases:Object.fromEntries(Object.entries(ctx.data.bases).map(([k,v])=>[k,v.sql])),schema};
fs.writeFileSync('supabase/functions/jeu-verifier/catalog.json',JSON.stringify(catalog));
let sqljs=fs.readFileSync('vendor/sqljs/sql-wasm.js','utf8');
sqljs='let module;\n'+sqljs.replace('Da="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node','Da=false')+'\nexport default initSqlJs;\n';
fs.writeFileSync('supabase/functions/jeu-verifier/sqlite.mjs',sqljs);
const compat=html.slice(html.indexOf('const SQLX='),html.indexOf('function buildDb()'));
fs.writeFileSync('supabase/functions/jeu-verifier/sql-compat.mjs',compat+'\nexport {attachDateFns,sqlCompat};\n');
const matcher=html.slice(html.indexOf('function normCell('),html.indexOf('function fmtLignes('));
fs.writeFileSync('supabase/functions/jeu-verifier/matcher.mjs',matcher+'\nexport {exerciseResultsMatch,execChallengeResult,resultatsDefiEgaux};\n');
console.log('Catalog:',catalog.challenges.length,'challenges');
/* 15 novembre (Elisa : « vasy », le serveur des salles vérifie en anglais) : un catalogue par langue dont les bases des défis sont
   traduites (langue-<code>-defis.js), récrit comme l’appli récrit les siennes (defisLangue, dans index.html) : la base de chaque
   défi et sa solution. Le serveur vérifie la requête d’un joueur sur le catalogue de sa langue (le champ « langue » de la demande,
   multiplayer-security.js) ; sans ce champ, le français, comme avant. */
const LANGUES_DEFIS=['en'];
module.exports=import('../tools/langue/commun.mjs').then(({moteur})=>{
  for(const code of LANGUES_DEFIS){
    const L=moteur(code,[`langue-${code}-defis.js`]),bases={};
    for(const id in catalog.bases)if(L.baseTraduite(id))bases[id]=L.sql(catalog.bases[id],null,id);
    const challenges=catalog.challenges.filter(c=>bases[c.base]).map(c=>({...c,sol:(L.solution&&L.solution(c.base,c.id))||L.sql(c.sol,null,c.base)}));
    fs.writeFileSync(`supabase/functions/jeu-verifier/catalog-${code}.json`,JSON.stringify({challenges,bases,schema}));
    console.log(`Catalog ${code}:`,challenges.length,'challenges');
  }
});
