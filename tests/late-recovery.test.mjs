import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const ctx=vm.createContext({});
vm.runInContext(slice('function dureeCourte(','function decalerPlanning('),ctx);
vm.runInContext(slice('function lateRecommendation(','function lateRecoveryHTML('),ctx);

/* Durées affichées dans le choix « Tout faire aujourd’hui ». */
assert.equal(ctx.dureeCourte(18),'18 min');
assert.equal(ctx.dureeCourte(60),'1 h');
assert.equal(ctx.dureeCourte(126),'2 h 06');

/* Choix conseillé selon le retard : peu → aujourd’hui, quelques-unes → réparties, beaucoup → décaler. */
assert.deepEqual([1,3,4,9,10,36].map(n=>ctx.lateRecommendation(n)),['today','today','spread','spread','shift','shift']);

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
assert(html.includes("<em>Conseillé</em>") && html.includes('Rien n’est perdu. Choisis comment les rattraper'), 'choix conseillé mis en avant');
assert(!html.includes('Fais ton choix'), 'ancienne mention retirée');
assert(html.includes('class="lr-head" aria-expanded') && html.includes('<h2 class="lr-heading">'), 'en-tête pliable accessible (titre + bouton)');
assert(html.includes('class="journey-planning" onclick="openLateRecoveryFromHome(this)"'), 'carte de l’accueil entièrement cliquable');
console.log('Activités à replacer : durées, choix conseillé, décalage du planning et carte : OK.');
