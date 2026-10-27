import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const host={innerHTML:''};
const ctx=vm.createContext({
  state:{plan:null,lessons:{},defis:{}},allLessons:[{id:0},{id:1},{id:2}],TOTAL:3,MIN_PAR_ACTIVITE:6,
  dstr:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),auj:()=>new Date(2026,8,15),parseD:d=>new Date(d+'T12:00:00'),
  jour0:d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;},
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
vm.runInContext(html.slice(html.indexOf('function addJ(d,n){'),html.indexOf('function datesMotif(')),ctx);
for(const [start,end] of [
 ['function nextScheduledSession(','function moduleProgressData('],
 ['function prochaineActiviteParcours(){','function progressContinuer('],
 ['function prochaineEtapeParcours(){','function homeToolIcon('],
 ['function renderHomeHero(){','function lessonListRow('],
 ['function bravoNextHtml(l){','function bravoActionsHtml(']
])vm.runInContext(html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))),ctx);
function check(id,count,label){
 const before=JSON.stringify(ctx.state);
 const session=ctx.recommendedSession();
 assert.equal(session?.id??null,id);
 assert.equal(ctx.prochaineActiviteParcours(),id);
 assert.equal(ctx.prochaineEtapeParcours()?.id??null,id);
 ctx.renderHomeHero();
 /* Le planning n’affiche plus de carte « Prochaine séance » : l’accueil et le bilan la portent. */
 assert.equal(typeof ctx.nextSessionHtml,'undefined');
 const surfaces=[host.innerHTML,ctx.bravoNextHtml()];
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
/* Avec un planning, le résumé compte le jour même, et dit lequel (Elisa, 27 octobre, 10 h 31 : « finalement le nombre d’activités le jour
   même ») ; nous sommes le mardi 15 septembre. */
ctx.nbFaites=()=>0;
ctx.state.plan={sessions:[{d:'2026-09-10',lessons:[0]},{d:'2026-09-15',lessons:[1,'d1']},{d:'2026-09-16',lessons:[2]},{d:'2026-09-18',lessons:['d2','d4']},{d:'2026-09-30',lessons:['d3']}]};
assert.equal(ctx.recommendedSession().summary,'2 activités restantes aujourd’hui');
ctx.state.lessons={1:{done:true}};
assert.equal(ctx.recommendedSession().summary,'1 activité restante aujourd’hui');
ctx.state.lessons.d1={done:true};
assert.equal(ctx.recommendedSession().summary,'1 activité prévue demain');
ctx.state.lessons[2]={done:true};
assert.equal(ctx.recommendedSession().summary,'2 activités prévues vendredi');
assert.ok(ctx.bravoNextHtml().includes('<small>2 activités prévues vendredi</small>'),'le bilan l’affiche');
ctx.state.lessons.d2={done:true};ctx.state.lessons.d4={done:true};
assert.equal(ctx.recommendedSession().summary,'1 activité prévue le 30 septembre');
ctx.state.lessons.d3={done:true};
assert.equal(ctx.recommendedSession().summary,'1 activité à rattraper','il ne reste que le retard');
console.log('Séance commune : accueil et bilan cohérents sur 8 scénarios.');
