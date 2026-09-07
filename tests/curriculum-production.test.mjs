#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ctx=vm.createContext({});
function load(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);vm.runInContext(html.slice(a,b),ctx);}
load('const SCHEMA_SQL =','let state=');
load('function normalizeState(','function fmtLignes(');
load('function datePart(','function buildDb(');
load('const TESTE_KEYS=','function testeExpectHtml(');
load('function normNoExecSql(','function checkExplainExo(');
load('function paintTesteVariant(','function initTesteEditor(');
load('function initTesteEditor(','function lessonObservationHtml(');
const lessons=vm.runInContext('MODULES.flatMap(m=>m.lessons)',ctx),schema=vm.runInContext('SCHEMA_SQL',ctx),quizzes=vm.runInContext('QCM',ctx);
const SQL=await createRequire(import.meta.url)(path.join(root,'vendor/sqljs/sql-wasm.js'))({locateFile:f=>path.join(root,'vendor/sqljs',f)});
ctx.SQL=SQL;ctx.allLessons=lessons;ctx.stripNoteHtml=s=>String(s).replace(/<[^>]+>/g,'');
function query(sql,verify){const db=new SQL.Database();try{db.run(schema);ctx.attachDateFns(db);const result=db.exec(sql);return verify?db.exec(verify):result;}finally{db.close();}}
let solved=0,variants=0;
for(const l of lessons){
 assert.ok(l.consigne?.trim()&&l.solution?.trim(),l.titre);
 assert.equal(l.learningCheck.options.length,3,l.titre);
 assert.ok(l.learningCheck.answer>=0&&l.learningCheck.answer<3&&l.learningCheck.explanation,l.titre);
 assert.ok(quizzes[l.id]?.length>=2,l.titre);
 for(const q of quizzes[l.id])assert.ok(q.b>=0&&q.b<q.o.length&&q.e,l.titre);
 assert.equal(ctx.checkExerciseConcept(l.solution,l).ok,true,l.titre);
 if(l.noExec){assert.equal(ctx.checkNoExecExo(l.solution,l).ok,true,l.titre);continue;}
 const expected=query(l.solution,l.write?l.verif:undefined);
 assert.equal(ctx.exerciseResultsMatch(expected,expected,l),true,l.titre);solved++;
 if(ctx.exerciseRequiresOrder(l)&&expected[0]?.values.length>1){const reversed=structuredClone(expected);reversed[0].values.reverse();assert.equal(ctx.exerciseResultsMatch(reversed,expected,l),false,l.titre+' ordre');}
 const tabs=ctx.testeVariantsOf(l)||[];
 assert.equal(new Set(tabs.map(v=>v.label)).size,tabs.length,l.titre+' noms des variantes');
 for(const v of l.testeVariants||[]){
  if(v.exec===false)continue;
  let result;
  try{result=query(v.sql);}catch(e){assert.equal(v.tone,'bad',`${l.titre} / ${v.label}: ${e.message}`);continue;}
  if(v.expectRows!==undefined)assert.equal(result.at(-1)?.values.length||0,v.expectRows,l.titre+' / '+v.label);
  variants++;
 }
}
const lesson=id=>lessons.find(l=>l.id===id);
assert.equal(lessons.length,78);
assert.equal(ctx.exerciseResultsMatch(query('SELECT nom,prix FROM produits'),query(lesson(2).solution),lesson(2)),false,'alias requis');
assert.equal(ctx.exerciseResultsMatch(query(lesson(1).solution+' SELECT 99;'),query(lesson(1).solution),lesson(1)),false,'résultats multiples');
assert.equal(ctx.exerciseResultsMatch(query('SELECT nom,telephone FROM clients ORDER BY nom DESC'),query(lesson(1).solution),lesson(1)),true,'ordre libre sans demande de tri');
let state={lessons:{64:{etapes:{exo:1,q0:true,q1:'1',q2:0,unexpected:1},draft:'SELECT 1;',testeDraft:'SELECT 2;',testeVi:2}}};
for(let i=0;i<3;i++)state=JSON.parse(JSON.stringify(ctx.normalizeState(state)));
assert.deepEqual(state.lessons[64].etapes,{exo:1,q0:1,q1:1});assert.equal(state.lessons[64].draft,'SELECT 1;');assert.equal(state.lessons[64].testeVi,2);
for(const id of [62,63,71])assert.equal(ctx.checkExerciseConcept(lesson(id).solution.replace(/BEGIN[^;]*;|COMMIT;/g,''),lesson(id)).ok,false,'transaction absente '+id);
assert.equal(ctx.checkExerciseConcept('SELECT 50; -- CAST(45 AS INTEGER)',lesson(54)).ok,false);
assert.equal(ctx.checkExerciseConcept('BEGIN; UPDATE produits SET stock=stock+10 WHERE id=1; COMMIT;',lesson(63)).ok,false);
assert.equal(ctx.checkExerciseConcept('BEGIN IMMEDIATE; UPDATE produits SET stock=29 WHERE id=8; COMMIT;',lesson(71)).ok,false);
for(const sql of ['GRANT SELECT ON produits TO app_user; -- clients','GRANT SELECT ON clients TO autre;','GRANT SELECT ON clients TO app_user; GRANT UPDATE ON clients TO app_user;'])assert.equal(ctx.checkNoExecExo(sql,lesson(50)).ok,false,'GRANT exact');
assert.equal(ctx.checkNoExecExo('GRANT SELECT ON "clients" TO "app_user";',lesson(50)).ok,true);
assert.equal(ctx.checkNoExecExo(lesson(61).solution.replace('stock >= 0','stock > 0'),lesson(61)).ok,false,'stock zéro autorisé');
assert.equal(ctx.checkNoExecExo(lesson(56).solution.replace('REFERENCES clients(id)','REFERENCES produits(id)'),lesson(56)).ok,false,'cible de clé étrangère');
for(const [id,wrong]of [[72,lesson(72).solution.replace(/REFERENCES \w+\(id\)/g,'')],[70,lesson(70).solution.replace('NEW.produit_id','1')],[26,lesson(26).solution+' UPDATE produits SET stock=0 WHERE id=1;']])assert.equal(ctx.exerciseResultsMatch(query(wrong,lesson(id).verif),query(lesson(id).solution,lesson(id).verif),lesson(id)),false,'solution incomplète '+id);
const frame={dataset:{},classList:{remove(){},add(){}},querySelectorAll:()=>[],querySelector:s=>s==='.xf-expect'?{remove(){}}:null};ctx.current=lesson(77);
ctx.paintTesteVariant(frame,ctx.current.testeVariants,2);assert.equal(frame.dataset.noExec,'1');ctx.paintTesteVariant(frame,ctx.current.testeVariants,0);assert.equal(frame.dataset.noExec,'0');
console.log(`${lessons.length} cours, ${solved} solutions SQLite, ${variants} variantes exécutables : OK.`);
console.log('Progression, ordre, alias, contraintes, transactions, trigger, GRANT et récursion : OK.');
