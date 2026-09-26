import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const host={innerHTML:''};
const ctx=vm.createContext({
  state:{plan:null,lessons:{},defis:{}},allLessons:[{id:0},{id:1},{id:2}],TOTAL:3,MIN_PAR_ACTIVITE:6,
  dstr:()=> '2026-09-15',auj:()=>new Date(2026,8,15),parseD:d=>new Date(d+'T12:00:00'),
  isDefiId:id=>typeof id==='string',nbFaites:()=>0,itemMeta:id=>({titre:'Activité '+id,sous:'Détail'}),
  esc:String,escAttr:s=>String(s).replaceAll('"','&quot;'),
  document:{getElementById:id=>id==='home-hero'?host:null,querySelector:()=>null},
  majBadgePlanning(){},renderLearnAvatar(){},renderHomeStreak(){},renderGreeting(){},
  progressContinuer:()=>({percent:0,lessonTotal:3,challengeTotal:0}),
  infoJour:()=>({retard:[]}),homeToolsHTML:()=>'',homePathPreviewHTML:()=>'',moduleDeLecon:()=>null,
  plur:(n,s)=>`${n} ${s}`,journeyIcon:()=>'',DEF_CHEV_SVG:'',ENT_OK_SVG:'',latePlanDetails:()=>null,
  homeLessonSteps:()=>[{step:0,done:false,locked:false},{step:1,done:false,locked:false},{step:2,done:false,locked:true}]
});
ctx.itemDone=id=>!!ctx.state.lessons[id]?.done;
for(const [start,end] of [
 ['function nextScheduledSession(','function moduleProgressData('],
 ['function prochaineActiviteParcours(){','function progressContinuer('],
 ['function prochaineEtapeParcours(){','function homeToolIcon('],
 ['function renderHomeHero(){','function lessonListRow('],
 ['function bravoNextHtml(){','function bravoActionsHtml(']
])vm.runInContext(html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))),ctx);
function check(id,count,label){
 const before=JSON.stringify(ctx.state);
 const session=ctx.recommendedSession();
 assert.equal(session?.id??null,id);
 assert.equal(ctx.prochaineActiviteParcours(),id);
 assert.equal(ctx.prochaineEtapeParcours()?.id??null,id);
 ctx.renderHomeHero();
 const surfaces=[host.innerHTML,ctx.nextSessionHtml(),ctx.bravoNextHtml()];
 for(const surface of surfaces){
   if(id!==null){
     assert.ok(surface.includes('Activité '+id));
     assert.ok(surface.includes(session.summary),'même résumé sur les trois écrans');
     assert.ok(surface.includes('openItem('),'même action pour leçons et défis');
   }else assert.ok(/terminé|validé/.test(surface));
 }
 if(session){assert.equal(session.remaining.length,count);assert.equal(session.minutes,count*6);assert.ok(session.label.includes(label));}
 assert.equal(JSON.stringify(ctx.state),before,'aucune mutation du planning ni de la progression');
}
check(0,1,'jour'); // Sans plan : ne pas perdre l’id zéro.
ctx.state.plan={sessions:[{d:'2026-09-17',lessons:[2]},{d:'2026-09-14',lessons:[0]},{d:'2026-09-15',lessons:[1,'d1']}]};
check(1,2,'jour'); // Le retard ne remplace pas la séance prévue aujourd’hui.
ctx.state.lessons[1]={done:true};check('d1',1,'jour');assert.equal(ctx.recommendedSession().started,true);
ctx.state.lessons.d1={done:true};check(2,1,'Prochaine'); // Aujourd’hui terminé.
ctx.state.lessons[2]={done:true};check(0,1,'reprendre'); // Seulement du retard.
ctx.state.lessons[0]={done:true};check(null); // Pas de repli vers un autre cours.
ctx.state.plan={sessions:[{d:'2026-09-17',lessons:[2]}]};delete ctx.state.lessons[0];check(null); // Plan terminé, même si catalogue différent.
ctx.state.plan=null;ctx.state.lessons={};ctx.nbFaites=id=>id===0?1:0;
check(0,1,'jour');assert.equal(ctx.recommendedSession().started,true);
console.log('Séance commune : accueil, planning et bilan cohérents sur 8 scénarios.');
