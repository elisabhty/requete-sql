import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
/* Niveau de Mon compte : palier, prochain cap et avancée dans le palier. */
const lvCtx=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const ACCOUNT_LEVELS=['),html.indexOf('const ACCT_OK_SVG=')),lvCtx);
/* Les paliers suivent les étapes de l’onboarding : 0, 11, 23, 33 leçons acquises sur 65 (1er novembre, 9 h 43). */
const B=[11,23,33],T=65;
let lv=lvCtx.accountLevel(0,B,T);
assert.deepEqual([lv.rank,lv.label,lv.next,lv.pct,lv.etape],[1,'Explorateur SQL','Filtres et tris',0,'SELECT']);
lv=lvCtx.accountLevel(10,B,T);assert.deepEqual([lv.rank,lv.pct],[1,91],'10 leçons sur les 11 du premier palier');
lv=lvCtx.accountLevel(11,B,T);assert.deepEqual([lv.rank,lv.label,lv.next,lv.pct],[2,'Constructeur de requêtes','Jointures',0]);
lv=lvCtx.accountLevel(23,B,T);assert.deepEqual([lv.rank,lv.label,lv.next],[3,'Analyste relationnel','Analyses']);
lv=lvCtx.accountLevel(33,B,T);assert.deepEqual([lv.rank,lv.label,lv.next],[4,'Analyste SQL','Parcours maîtrisé']);
lv=lvCtx.accountLevel(65,B,T);assert.deepEqual([lv.rank,lv.label,lv.pct],[5,'Parcours maîtrisé',100]);
lv=lvCtx.accountLevel(250,B,T);assert.equal(lv.rank,5,'au-delà du parcours, le dernier palier');
lv=lvCtx.accountLevel('abc',B,T);assert.deepEqual([lv.rank,lv.pct],[1,0],'valeur illisible : premier palier');
/* Accès : l’onglet Compte, et la carte de série de l’accueil qui descend jusqu’à « Ma progression ». */
const calls=[],scrolled=[];
const nav=vm.createContext({
  switchTab:name=>calls.push(name),
  requestAnimationFrame:fn=>fn(),
  document:{getElementById:id=>id==='acct-progress'?{scrollIntoView(o){scrolled.push(o&&o.block);}}:null}
});
const openLine=html.indexOf('function openAccount(){');
vm.runInContext(html.slice(openLine,html.indexOf('\n',openLine)),nav);
vm.runInContext(html.slice(html.indexOf('function openAccountProgress(){'),html.indexOf('const FLAME_SVG=')),nav);
nav.openAccount();assert.deepEqual(calls,['compte']);
nav.openAccountProgress();assert.deepEqual(calls,['compte','compte']);assert.deepEqual(scrolled,['start']);
/* Retour à aujourd’hui dans le planning et accès au rythme depuis le compte. */
let renderCount=0;
const pl=vm.createContext({document:{querySelector:()=>({scrollIntoView(){},focus(){}})}});
pl.semaineOffset=3;pl.jourSel='future';pl.auj=()=>new Date('2026-09-14');pl.dstr=d=>d.toISOString().slice(0,10);
pl.renderPlanning=()=>renderCount++;
vm.runInContext(html.slice(html.indexOf('function focusPlanningToday(){'),html.indexOf('function chipTap(')),pl);
pl.focusPlanningToday();
assert.equal(pl.semaineOffset,0);assert.equal(pl.jourSel,'2026-09-14');assert.equal(renderCount,1);
const steps=[];pl.switchTab=name=>steps.push(name);pl.openPlanAdjust=()=>steps.push('dialog');pl.state={plan:null};
pl.openAccountPlanSettings();assert.deepEqual(steps,['planning']);
pl.state.plan={};pl.openAccountPlanSettings();assert.deepEqual(steps,['planning','planning','dialog']);
console.log('Compte : niveaux, onglet, accès depuis la série, retour à aujourd’hui et accès au rythme : OK.');
