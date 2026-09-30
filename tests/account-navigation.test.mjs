import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
/* Niveau de Mon compte : palier, prochain cap et avancée dans le palier. */
const lvCtx=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const ACCOUNT_LEVELS=['),html.indexOf('const ACCT_OK_SVG=')),lvCtx);
let lv=lvCtx.accountLevel(0);
assert.deepEqual([lv.rank,lv.label,lv.next,lv.pct],[1,'Explorateur SQL','Filtres et tris',0]);
lv=lvCtx.accountLevel(10);assert.deepEqual([lv.rank,lv.pct],[1,67],'10 % du parcours = deux tiers du premier palier');
lv=lvCtx.accountLevel(15);assert.deepEqual([lv.rank,lv.pct],[1,100]);
lv=lvCtx.accountLevel(16);assert.deepEqual([lv.rank,lv.label,lv.pct],[2,'Constructeur de requêtes',4]);
lv=lvCtx.accountLevel(100);assert.deepEqual([lv.rank,lv.label,lv.pct],[5,'Parcours maîtrisé',100]);
lv=lvCtx.accountLevel(250);assert.equal(lv.rank,5,'au-delà de 100 %, le dernier palier');
lv=lvCtx.accountLevel('abc');assert.deepEqual([lv.rank,lv.pct],[1,0],'valeur illisible : premier palier');
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
