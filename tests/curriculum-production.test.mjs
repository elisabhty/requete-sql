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
load('function normNoExecSql(','function markExoPassed(');
load('function paintTesteVariant(','function initTesteEditor(');
load('function initTesteEditor(','function lessonObservationHtml(');
const lessons=vm.runInContext('MODULES.flatMap(m=>m.lessons)',ctx),schema=vm.runInContext('SCHEMA_SQL',ctx),quizzes=vm.runInContext('QCM',ctx);
const SQL=await createRequire(import.meta.url)(path.join(root,'vendor/sqljs/sql-wasm.js'))({locateFile:f=>path.join(root,'vendor/sqljs',f)});
ctx.SQL=SQL;ctx.allLessons=lessons;ctx.stripNoteHtml=s=>String(s).replace(/<[^>]+>/g,'');
function query(sql,verify){const db=new SQL.Database();try{db.run(schema);ctx.attachDateFns(db);const result=db.exec(sql);return verify?db.exec(verify):result;}finally{db.close();}}
let solved=0,variants=0;
for(const l of lessons){
 /* Leçon seule (vidéo interactive) : ni exercice ni quiz. */
 if(l.leconSeule){assert.ok(l.video&&!l.consigne&&!l.solution,l.titre+' : leçon seule, sans exercice');continue;}
 assert.ok(l.consigne?.trim()&&l.solution?.trim(),l.titre);
 if(l.learningCheck){
  assert.equal(l.learningCheck.options.length,3,l.titre);
  assert.ok(l.learningCheck.answer>=0&&l.learningCheck.answer<3&&l.learningCheck.explanation,l.titre);
 }
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
/* Depuis le 28 octobre, chaque cours est une leçon seule (Elisa : « enlever la partie quiz et exercice ») : la comparaison des
   résultats reste prête pour un exercice, et se vérifie sur d’anciens exercices des cours (avec leur identifiant, qui porte
   les règles : l’alias du cours 2, l’ordre imposé des cours 11 et 12). */
const DEUX_COLONNES={id:-1,titre:'Deux colonnes',consigne:'Affiche le nom et le prix de chaque produit, dans cet ordre.',solution:'SELECT nom, prix FROM produits;'};
const ANCIEN={
 2:{id:2,titre:'Renommer avec AS',solution:'SELECT nom AS produit, stock AS en_stock FROM produits;'},
 6:{id:6,titre:'AND et OR',solution:"SELECT nom, prix FROM produits WHERE (categorie = 'Nutrition' OR categorie = 'Boisson') AND prix < 20;"},
 11:{id:11,titre:'ORDER BY',solution:'SELECT nom, categorie, stock FROM produits ORDER BY categorie, stock DESC;'},
 12:{id:12,titre:'LIMIT et OFFSET',solution:'SELECT id, nom, prix\nFROM produits\nORDER BY prix ASC, id ASC\nLIMIT 3 OFFSET 6;'}
};
assert.equal(lessons.length,64);
assert.equal(ctx.exerciseResultsMatch(query('SELECT nom,stock FROM produits'),query(ANCIEN[2].solution),ANCIEN[2]),false,'alias requis');
assert.equal(ctx.exerciseResultsMatch(query(DEUX_COLONNES.solution+' SELECT 99;'),query(DEUX_COLONNES.solution),DEUX_COLONNES),false,'résultats multiples');
assert.equal(ctx.exerciseResultsMatch(query("SELECT nom,prix FROM produits WHERE categorie='Nutrition' OR categorie='Boisson' AND prix<20"),query(ANCIEN[6].solution),ANCIEN[6]),false,'parenthèses requises avec AND et OR');
assert.equal(ctx.exerciseResultsMatch(query('SELECT nom,categorie,stock FROM produits ORDER BY categorie,stock'),query(ANCIEN[11].solution),ANCIEN[11]),false,'sens décroissant du second critère');
assert.equal(ctx.exerciseResultsMatch(query('SELECT id,nom,prix FROM produits ORDER BY prix,id LIMIT 3 OFFSET 3'),query(ANCIEN[12].solution),ANCIEN[12]),false,'troisième page seulement');
assert.equal(ctx.exerciseResultsMatch(query('SELECT nom,prix FROM produits ORDER BY prix DESC'),query(DEUX_COLONNES.solution),DEUX_COLONNES),true,'ordre libre sans demande de tri');
let state={lessons:{64:{etapes:{exo:1,q0:true,q1:'1',q2:0,unexpected:1},draft:'SELECT 1;',testeDraft:'SELECT 2;',testeVi:2}}};
for(let i=0;i<3;i++)state=JSON.parse(JSON.stringify(ctx.normalizeState(state)));
assert.deepEqual(state.lessons[64].etapes,{exo:1,q0:1,q1:1});assert.equal(state.lessons[64].draft,'SELECT 1;');assert.equal(state.lessons[64].testeVi,2);
assert.equal(ctx.checkExerciseConcept('SELECT 50; -- CAST(45 AS INTEGER)',lesson(54)).ok,false);
/* L’exercice non exécutable (REVOKE) de l’ancien cours texte Sécurité et droits, gardé en exemple (tests/fixtures/guide-texte-droits.js) : la leçon 50
   est devenue le chapitre 19 du projet, en vidéo, et l’app n’a plus de cours texte. */
const DROITS=vm.runInContext(fs.readFileSync(path.join(root,'tests/fixtures/guide-texte-droits.js'),'utf8'),ctx);
assert.ok(DROITS.noExec&&DROITS.serverConcept&&lesson(50).leconSeule&&lesson(50).video,'la leçon 50 en vidéo, son ancien exercice en exemple');
for(const sql of ['REVOKE SELECT ON produits FROM stagiaire; -- commandes','REVOKE SELECT ON commandes FROM autre;','REVOKE SELECT ON commandes FROM stagiaire; REVOKE UPDATE ON commandes FROM stagiaire;','GRANT SELECT ON commandes TO stagiaire;','REVOKE ALL PRIVILEGES ON commandes FROM stagiaire;'])assert.equal(ctx.checkNoExecExo(sql,DROITS).ok,false,'REVOKE exact');
assert.equal(ctx.checkNoExecExo('REVOKE SELECT ON "commandes" FROM "stagiaire";',DROITS).ok,true);
assert.equal(ctx.checkNoExecExo(DROITS.solution,DROITS).ok,true);
assert.match(ctx.checkNoExecExo('GRANT SELECT ON commandes TO stagiaire;',DROITS).diag,/GRANT accorde un droit/);
/* Le cours texte d’exemple (l’ancienne leçon 64, CREATE VIEW en texte : tests/fixtures/guide-texte-create-view.js) : les cours de l’app sont presque tous en vidéo. */
const VUE=vm.runInContext(fs.readFileSync(path.join(root,'tests/fixtures/guide-texte-create-view.js'),'utf8'),ctx);
for(const [l,wrong]of [[VUE,VUE.solution.replace("WHERE ville = 'Paris'","WHERE ville = 'Lyon'")]])assert.equal(ctx.exerciseResultsMatch(query(wrong,l.verif),query(l.solution,l.verif),l),false,'solution incomplète '+l.titre);
const frame={dataset:{},classList:{remove(){},add(){}},querySelectorAll:()=>[],querySelector:s=>s==='.xf-expect'?{remove(){}}:null};ctx.current=DROITS;
ctx.paintTesteVariant(frame,ctx.current.testeVariants,0);assert.equal(frame.dataset.noExec,'1');ctx.current=VUE;ctx.paintTesteVariant(frame,ctx.current.testeVariants,0);assert.equal(frame.dataset.noExec,'0');
console.log(`${lessons.length} cours (${lessons.filter(l=>l.leconSeule).length} leçons seules), ${solved} solutions SQLite, ${variants} variantes exécutables : OK.`);
console.log('Progression, ordre, alias, contraintes, transactions, trigger, GRANT et récursion : OK.');
