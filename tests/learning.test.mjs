import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,extractPlan,movePlanLesson,reviewPatch,dueReviews} from '../account/learning.mjs';
import {extractProgression} from '../account/progression.mjs';
const plan=()=>({niveau:'debutant',rythme:'regulier',freq:3,per:3,mix:true,timeZone:'Europe/Paris',sessions:[{d:'2026-11-02',lessons:[0,1]},{d:'2026-11-04',lessons:[2]}],archive:[3]});
test('export du planning limité aux leçons connues, sans données privées',()=>{
 const p=plan();p.sessions[0].lessons.push('af1',999);p.secret='private';
 const clean=extractPlan({plan:p},{lessonIds:[0,1,2,3],timeZone:'Europe/Paris'});
 assert.deepEqual(clean,plan());assert.equal(extractPlan({plan:null}),null);
 assert.throws(()=>extractPlan({plan:p},{lessonIds:[0,1,2,3]}),{code:'invalid_plan'});
});
test('une leçon déplacée conserve un seul emplacement et son ordre, sans modifier la source',()=>{
 const p=plan(),moved=movePlanLesson(p,0,'2026-11-04',0);
 assert.deepEqual(moved.sessions,[{d:'2026-11-02',lessons:[1]},{d:'2026-11-04',lessons:[0,2]}]);assert.deepEqual(p,plan());
 const archived=movePlanLesson(p,3,'2026-11-04',1);assert.deepEqual(archived.archive,[]);assert.deepEqual(archived.sessions[1].lessons,[2,3]);
});
test('doublons, dates impossibles, fuseaux inconnus et champs supplémentaires refusés',()=>{
 for(const mutate of [p=>p.sessions[1].lessons.push(0),p=>p.archive.push(2),p=>p.sessions.push({d:'2026-11-02',lessons:[4]}),p=>p.sessions[0].d='2026-02-30',p=>p.sessions[0].d='2026-99-99',p=>p.timeZone='Mars/Paris',p=>p.sessions[0].sql='private',p=>p.notes=[],p=>p.freq=4]){
  const p=plan();mutate(p);assert.throws(()=>validatePlan(p),{code:'invalid_plan'});
 }
 assert.throws(()=>movePlanLesson(plan(),100,'2026-11-04'),{code:'invalid_move'});
});
test('un changement de jour ne convertit pas la date du planning selon le fuseau de l’appareil',()=>{
 const p=plan();p.timeZone='America/New_York';assert.equal(validatePlan(p).sessions[0].d,'2026-11-02');
});
test('révisions : réussite, plafond, échec et export du niveau zéro',()=>{
 const now=1793610000000;
 assert.deepEqual(reviewPatch({done:true,level:0},true,now),{level:1,due:now+3*86400000});
 assert.deepEqual(reviewPatch({done:true,level:4},true,now),{level:4,due:now+60*86400000});
 const patch=reviewPatch({done:true,level:4},false,now);assert.deepEqual(patch,{level:0,due:now+86400000});
 const records=extractProgression({lessons:{0:{done:true,...patch}}},{lessonIds:[0],challengeIds:[]});assert.equal(records[0].data.level,0);
 assert.throws(()=>reviewPatch({done:false,level:0},true,now),{code:'invalid_review'});
});
test('révisions échues uniquement, dans l’ordre, selon le catalogue explicitement révisable',()=>{
 const e=(id,due,extra={})=>({key:'lesson:'+id,data:{done:true,due},...extra});
 const elements=[e(0,100),e(1,50),e(2,101),e(3,0),e(4,20,{deleted:true}),e(5,30,{data:{done:false,due:30}}),e(6,10)];
 assert.deepEqual(dueReviews(elements,{lessonIds:[0,1,2,3,4,5],now:100}).map(x=>x.key),['lesson:1','lesson:0']);
});
