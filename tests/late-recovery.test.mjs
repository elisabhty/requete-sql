import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const ctx=vm.createContext({});
vm.runInContext(slice('function dureeCourte(','function decalerPlanning('),ctx);
vm.runInContext(slice('function lateRythme(','function lateRecoveryHTML('),ctx);

/* Durées affichées dans le choix « Tout faire aujourd’hui ». */
assert.equal(ctx.dureeCourte(18),'18 min');
assert.equal(ctx.dureeCourte(60),'1 h');
assert.equal(ctx.dureeCourte(126),'2 h 06');

/* Choix conseillé selon ce qui reste à rattraper, rapporté au rythme (Elisa, 6 novembre, 11 h 57 : « faire les recommandations par
   rapport aux nombres de cours restants ») : tout tient dans deux séances aujourd’hui (en activités et en minutes) → aujourd’hui ;
   sinon, sans plus que doubler les prochaines séances → réparties ; au-delà → décaler. */
const NB='\u00a0';
ctx.RYTHMES=[{k:'calme',per:2,min:12},{k:'regulier',per:3,min:18},{k:'intensif',per:5,min:30}];
ctx.plur=(n,mot)=>n+' '+(Math.abs(n)>1?mot+'s':mot);
const reco=(rythme,cas)=>{ctx.state={plan:{rythme,per:ctx.RYTHMES.find(r=>r.k===rythme).per}};return cas.map(([count,todayAfter,minutes])=>ctx.lateRecommendation({count,todayAfter,minutes}));};
assert.deepEqual(reco('calme',[[2,4,11],[3,5,20],[2,4,30],[6,8,40],[7,9,45]]),['today','spread','spread','spread','shift'],'10 minutes : 2 par séance');
assert.deepEqual(reco('regulier',[[2,5,30],[2,5,40],[3,6,36],[9,12,60],[10,13,70]]),['today','spread','today','spread','shift'],'20 minutes : 3 par séance');
assert.deepEqual(reco('intensif',[[6,9,50],[6,11,50],[15,20,90],[16,21,95]]),['today','spread','spread','shift'],'30 minutes : 5 par séance');
ctx.state={};
assert.deepEqual([[3,6,30],[9,12,60],[10,13,70]].map(([count,todayAfter,minutes])=>ctx.lateRecommendation({count,todayAfter,minutes})),['today','spread','shift'],'sans planning : le rythme de 20 minutes');
/* La phrase qui dit pourquoi, sous « Comment veux-tu reprendre ? » */
assert.equal(ctx.lateRaison('today',{count:2,todayCount:2,minutes:11}),`Rien n’est perdu${NB}: avec ta séance du jour, ça fait environ${NB}11${NB}min. Tu peux tout rattraper aujourd’hui.`);
assert.equal(ctx.lateRaison('today',{count:2,todayCount:0,minutes:0}),`Rien n’est perdu${NB}: tu peux tout rattraper aujourd’hui.`,'sans durée connue');
assert.equal(ctx.lateRaison('spread',{count:6},3,2),`Rien n’est perdu, pas besoin de tout faire d’un coup${NB}: sur tes 3${NB}prochaines séances, ça fait 2 activités de plus chacune.`);
assert.equal(ctx.lateRaison('spread',{count:1},1,1),`Rien n’est perdu${NB}: elle trouve sa place dans ta prochaine séance, sans alourdir aujourd’hui.`);
assert.equal(ctx.lateRaison('shift',{count:12}),`Rien n’est perdu, pas besoin de tout faire d’un coup${NB}: avec 12 activités en retard, décaler ton planning garde des séances à ton rythme.`);

/* Décaler : tout ce qui reste reprend aujourd’hui, au même rythme (séances de 3, 5 jours sur 7). */
ctx.state={plan:{per:3,freq:5}};
ctx.collectPlanItems=()=>({remaining:[1,2,3,4,5,6,7],done:[0]});
let asked=null;
ctx.datesMotif=(start,freq,n)=>{asked=[freq,n];return Array.from({length:n},(_,i)=>`2026-10-0${i+1}`);};
ctx.auj=()=>new Date('2026-10-01T00:00:00');
const preview=ctx.latePlanShiftPreview();
assert.deepEqual(asked,[5,3],'7 activités à 3 par séance : 3 séances au rythme habituel');
assert.equal(preview.count,7);
assert.equal(preview.end,'2026-10-03');
ctx.collectPlanItems=()=>({remaining:[],done:[0,1]});
assert.equal(ctx.latePlanShiftPreview(),null,'rien à décaler quand tout est fait');

/* La carte propose les trois choix, le conseillé en premier, sans l’ancienne mention. */
assert(html.includes("action:'decalerPlanning()'") && html.includes("action:'etalerRetard()'") && html.includes("action:'rattraper()'"), 'trois façons de rattraper');
/* Depuis le 5 novembre, 15 h 43 : « Comment veux-tu reprendre ? », le choix recommandé coché d’avance, « Confirmer mon choix » */
assert(html.includes("<em>Recommandé</em>") && html.includes('Comment veux-tu reprendre') && html.includes('Confirmer mon choix'), 'choix recommandé mis en avant');
assert(!html.includes('Fais ton choix'), 'ancienne mention retirée');
assert(html.includes('class="lr-head" aria-expanded') && html.includes('<h2 class="lr-heading">'), 'en-tête pliable accessible (titre + bouton)');
/* 7 novembre, 8 h 38 (Elisa : « Supprime la carte 1 séance à terminer ») : la carte a quitté l’accueil ; le planning garde le rattrapage. */
assert(!html.includes('onclick="openLateRecoveryFromHome(this)"'), 'plus de carte de rattrapage sur l’accueil');
assert(html.includes('const late=lateRecoveryHTML();'), 'le planning garde son rattrapage');
console.log('Activités à replacer : durées, choix conseillé, décalage du planning et carte : OK.');
