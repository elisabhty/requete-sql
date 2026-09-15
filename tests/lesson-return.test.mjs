import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const screens=new Map();
function screen(){return {classList:{add(){},remove(){},contains:()=>true}};}
for(const tab of ['learn','planning','defis'])screens.set(tab,screen());
let saved,refreshed,closed,cancelled;
const context=vm.createContext({
  document:{getElementById:()=>screen(),querySelectorAll:()=>[...screens.values()],body:screen()},
  screenForTab:tab=>screens.get(tab),annulerBilanAuto:()=>cancelled++,closeSchemaSheet:()=>closed++,
  showKbar(){},syncTabUI(){},refreshTabScreen:tab=>refreshed=tab,saveNav:nav=>saved=nav,
  prefersReduceMotion:()=>true,restoringNav:false,
  setLessonStep(){throw new Error('Le retour annoncé ne doit pas changer l’étape');}
});
vm.runInContext(html.slice(html.indexOf('function leaveLessonScreen('),html.indexOf('const SQL_COPY_SVG=')),context);
for(const origin of ['learn','planning','defis']){
 for(const step of [0,1,2,3]){
  context.activeTab=origin;context.mode='lesson';context.lessonStep=step;
  const progress={lessons:{1:{done:false,exo:true}}};context.state=progress;
  const before=JSON.stringify(progress);closed=0;cancelled=0;
  context.goBack();
  assert.equal(saved.view,'tab');assert.equal(saved.tab,origin);assert.equal(refreshed,origin);
  assert.equal(context.lessonStep,step);assert.equal(JSON.stringify(context.state),before);
  assert.equal(closed,1);assert.equal(cancelled,1);
 }
}
console.log('Retour direct vers les 3 écrans d’origine depuis les 4 étapes : OK.');
