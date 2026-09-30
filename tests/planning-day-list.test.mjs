import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../ludique.css',import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const ctx=vm.createContext({});
vm.runInContext(slice('const PL_DAY_PREVIEW=','function togglePlanDayList('),ctx);
const vis=flags=>{const s=ctx.planDayVisible(flags);return s?[...s].sort((a,b)=>a-b):null;};

/* Journée normale : tout est affiché. */
assert.equal(vis([false,false,false]),null,'3 activités : pas de repli');
assert.equal(vis(Array(8).fill(false)),null,'8 activités : pas de repli');

/* Longue journée : les 6 prochaines à faire, même si des validées sont intercalées. */
assert.deepEqual(vis(Array(39).fill(false)),[0,1,2,3,4,5]);
const mixed=Array(39).fill(false);[0,1,2,4].forEach(i=>{mixed[i]=true;});
assert.deepEqual(vis(mixed),[3,5,6,7,8,9],'les validées sont masquées au profit des suivantes');
assert.deepEqual(vis(Array(12).fill(true)),[0,1,2,3,4,5],'tout validé : les 6 premières');

/* Libellé du bouton */
assert.match(ctx.planDayMoreLabel(false,33),/Voir les 33 autres activités/);
assert.match(ctx.planDayMoreLabel(true,33),/Réduire la liste/);

/* Carte du jour : une seule liste, bouton en relief, avancement seulement une fois commencé. */
const sem=slice('function renderSemaine(','const PL_OK_SVG=');
assert(!sem.includes('class="cgo"'),'plus de chevron redondant dans les lignes');
assert(sem.includes('class="nx"'),'le calendrier pour déplacer reste');
assert(sem.includes('id="pl-day-list"') && sem.includes('class="pl-chips-more"') && sem.includes('aria-controls="pl-day-list"'),'bouton Voir plus relié à la liste');
assert(sem.indexOf('class="dp-prog"')<sem.indexOf('class="dp-go"'),'avancement au-dessus du bouton');
assert(/started\?`<div class="dp-prog"/.test(sem),'barre affichée seulement une fois la séance commencée');
assert(html.includes("if(cn&&!chip.classList.contains('ok'))"),'une activité validée garde sa coche pendant le glisser');
assert(css.includes('html.lq .pl-chips.is-collapsed>.pl-chip.is-extra{display:none!important}'),'lignes masquées en CSS, gardées dans la page');
assert(/html\.lq \.dp-go,\nhtml\.lq \.lq-btn\{/.test(css),'Démarrer la séance : bouton principal en relief');
assert(css.includes('html.lq .pl-week-heading>div:first-child{display:contents}'),'titre de la semaine sur toute la largeur');
assert(css.includes('html.lq .wk-chrome{padding:12px 10px 14px!important}'),'jours décollés du bord de la carte');
console.log('Planning : liste du jour repliable, carte compacte et en-têtes alignés : OK.');
