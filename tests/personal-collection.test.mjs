import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCollectionCatalog,derivePersonalCollection,createPersonalCollection} from '../account/collection.mjs';
const modules=[{titre:'Bases',lessons:[{id:0,leconSeule:true},{id:1,consigne:'Question',solution:'SELECT 1'},{id:2,leconSeule:true}]},{titre:'Suite',lessons:[{id:3,leconSeule:true}]}];
const cards={0:{k:'SELECT',t:'Lire'},1:{k:'WHERE',t:'Filtrer'},3:{k:'JOIN',t:'Joindre'}};
const catalog=createCollectionCatalog(modules,cards);
const record=(id,data,deleted=false)=>({key:'lesson:'+id,data,deleted,revision:1,generation:0});
const snapshot=elements=>({userId:'A',schemaVersion:1,epoch:0,elements});
const derive=elements=>derivePersonalCollection(snapshot(elements),catalog,{accountId:'A',now:100});
test('la collection personnelle est inactive et aucun écran ne la charge',async()=>{
 let calls=0;const api=createPersonalCollection({sync:{pull:async()=>{calls++;}}});assert.deepEqual(await api.read(),{enabled:false,collection:null});assert.equal(calls,0);
 for(const name of ['index.html','sw.js','decouvrir/connexion.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),/account\/collection\.mjs/);
});
test('seules les cartes existantes se comptent, dans l’ordre du parcours',()=>{
 assert.deepEqual(catalog.map(c=>[c.lessonId,c.number]),[[0,1],[1,2],[3,3]]);
 const c=derive([record(0,{done:true}),record(2,{done:true}),record(999,{done:true})]);assert.equal(c.total,3);assert.equal(c.unlocked,1);assert.equal(c.locked,2);assert.equal(c.percent,33);assert.equal(c.nextLessonId,1);
});
test('le déblocage exige une validation, pas une étape, une échéance ou un record de carte',()=>{
 const c=derive([record(0,{etapes:{q0:1},due:1,level:4}),record(1,{done:false}),{key:'collection:3',data:{unlocked:true},deleted:false}]);assert.equal(c.unlocked,0);assert.ok(c.cards.every(c=>!c.mastered&&!c.due));
});
test('compteurs par module et dates de validation proviennent de la progression',()=>{
 const c=derive([record(0,{done:true,at:50}),record(1,{done:true,at:60,level:2,due:90})]);assert.equal(c.completedModules,1);assert.equal(c.modules[0].complete,true);assert.equal(c.modules[1].complete,false);assert.equal(c.cards[0].acquiredAt,50);assert.equal(c.cards[1].mastered,true);
});
test('les échéances respectent les leçons réellement révisables et l’instant fourni',()=>{
 const c=derive([record(0,{done:true,due:10}),record(1,{done:true,due:100}),record(3,{done:true,due:10})]);assert.deepEqual(c.dueLessonIds,[1]);assert.equal(c.nextReviewAt,100);assert.equal(c.cards[0].dueAt,null);
 const before=derivePersonalCollection(snapshot([record(1,{done:true,due:101})]),catalog,{accountId:'A',now:100});assert.deepEqual(before.dueLessonIds,[]);
});
test('une leçon réinitialisée ou un effacement global retire ses cartes sans liste parallèle',()=>{
 const initial=derive([record(0,{done:true})]);assert.equal(initial.unlocked,1);
 assert.equal(derive([record(0,{},true)]).unlocked,0);
 const cleared=derivePersonalCollection({...snapshot([]),epoch:1},catalog,{accountId:'A',now:100});assert.equal(cleared.unlocked,0);assert.equal(cleared.epoch,1);
});
test('deux appareils qui lisent la même progression obtiennent la même collection',async()=>{
 let cloud=snapshot([record(0,{done:true})]);const sync={pull:async()=>structuredClone(cloud)};
 const a=createPersonalCollection({accountId:'A',sync,catalog,enabled:true}),b=createPersonalCollection({accountId:'A',sync,catalog,enabled:true});
 assert.deepEqual(await a.read({now:100}),await b.read({now:100}));cloud=snapshot([record(0,{done:true}),record(1,{done:true})]);assert.equal((await b.read({now:100})).collection.unlocked,2);
});
test('un autre compte ou un snapshot ambigu est refusé',()=>{
 assert.throws(()=>derivePersonalCollection({...snapshot([]),userId:'B'},catalog,{accountId:'A',now:100}),{code:'wrong_collection_account'});
 assert.throws(()=>derive([record(0,{done:true}),record(0,{done:false})]),{code:'invalid_collection_snapshot'});
 assert.throws(()=>createCollectionCatalog([{titre:'X',lessons:[{id:0},{id:0}]}],cards),{code:'invalid_collection_catalog'});
});
test('aucune donnée étrangère à la collection ne ressort et une panne reste une erreur',async()=>{
 const c=derivePersonalCollection({...snapshot([record(0,{done:true})]),notes:'PRIVATE',token:'PRIVATE',score:999},catalog,{accountId:'A',now:100});assert.doesNotMatch(JSON.stringify(c),/PRIVATE|token|score/);
 const api=createPersonalCollection({accountId:'A',catalog,enabled:true,sync:{pull:async()=>{throw Error('offline');}}});await assert.rejects(api.read(),/offline/);
});
test('le catalogue réel se reconstruit sans modifier les textes ni inventer des exercices',()=>{
 const app=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const modulesStart=app.indexOf('const MODULES = [');const modulesEnd=app.indexOf('\n];',modulesStart)+3;
 const cardStart=app.indexOf('const CARTES={');const cardEnd=app.indexOf('\n};',cardStart)+3;
 const guideStart=app.indexOf('function guide(spec){'),guideEnd=app.indexOf('\n}',guideStart)+2;
 const data=vm.runInNewContext(app.slice(guideStart,guideEnd)+'\n'+app.slice(modulesStart,modulesEnd)+'\n'+app.slice(cardStart,cardEnd)+';JSON.stringify({modules:MODULES,cards:CARTES})',{GUIDE_CUR:0,GUIDE_XSCENES:{},guideBlocks:()=>''});
 const real=JSON.parse(data),entries=createCollectionCatalog(real.modules,real.cards);
 assert.ok(entries.length>=40);assert.equal(entries.length,real.modules.flatMap(m=>m.lessons).filter(l=>real.cards[l.id]).length);
 assert.equal(entries.some(e=>e.revisable),false);const c=derivePersonalCollection(snapshot([]),entries,{accountId:'A',now:100});assert.equal(c.total,entries.length);assert.equal(c.unlocked,0);
});
