import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sqlite,verify,safeSelect} from '../supabase/functions/jeu-verifier/verifier.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../supabase/functions/jeu-verifier/catalog.json',import.meta.url)));
await sqlite(new Uint8Array(fs.readFileSync(new URL('../vendor/sqljs/sql-wasm.wasm',import.meta.url))));
test('le vérificateur accepte toutes les solutions du catalogue et les écritures équivalentes',async()=>{
 const app=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const challenges=vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['),app.indexOf('const NIV='))+";CHALLENGES.filter(c=>!c.noExec&&!/^\\s*EXPLAIN/i.test(c.sol)).map(({id,niv,base,sol,ordered,noExec})=>({id,niv,base,sol,ordered:!!ordered,noExec:!!noExec}))");
 assert.deepEqual(catalog.challenges,JSON.parse(JSON.stringify(challenges)), 'solutions et règles identiques dans l’appli et le serveur');
 for(const c of catalog.challenges)assert.equal(await verify(catalog,c.id,c.sol),true,c.id);
 assert.equal(await verify(catalog,'af2',"SELECT email AS courriel, nom, prenom FROM passagers WHERE nationalite='Française' ORDER BY nom,prenom"),true);
});
test('un faux résultat, une ligne en moins ou le mauvais ordre ne valident rien',async()=>{
 assert.equal(await verify(catalog,'af2','SELECT 0,0,0'),false);
 assert.equal(await verify(catalog,'af2',catalog.challenges.find(c=>c.id==='af2').sol.replace(';',' LIMIT 1;')),false);
 assert.equal(await verify(catalog,'af14','SELECT DISTINCT nationalite FROM passagers ORDER BY nationalite DESC'),false);
 await assert.rejects(verify(catalog,'inconnu','SELECT 1'),/inconnu/);
});
test('les écritures, instructions multiples et primitives coûteuses sont refusées',async()=>{
 for(const q of ["DELETE FROM vols","SELECT 1; DROP TABLE vols", "WITH x AS (SELECT 1) DELETE FROM vols",'PRAGMA query_only=OFF','ATTACH DATABASE \'x\' AS evil','SELECT randomblob(999999999)','WITH RECURSIVE x AS (SELECT 1) SELECT * FROM x'])assert.throws(()=>safeSelect(q),/lecture/);
 await assert.rejects(verify(catalog,'af1','SELECT 1; SELECT 2'),/lecture/);
 assert.doesNotThrow(()=>safeSelect("SELECT '; DELETE' AS texte -- ; DROP\n"));
 assert.throws(()=>safeSelect('SELECT '+ 'a'.repeat(12001)),/longue/);
});
