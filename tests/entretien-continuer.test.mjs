#!/usr/bin/env node
/* « Continuer la préparation » ne passe que par les questions pas encore maîtrisées (Elisa, 2 novembre, 23 h 22). */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`); }
}
const fn = name => {
  const i = html.indexOf(`\nfunction ${name}(`);
  const j = html.indexOf('\nfunction ', i + 1);
  return html.slice(i, j);
};

console.log('\n=== Continuer la préparation ===');
const ctx = vm.createContext({});
vm.runInContext(`
  var ENTRETIEN=[1,2,3,4,5,6].map(n=>({id:'q'+n,cat:'SELECT'}));
  var state={entretien:{q1:'ok',q4:'ok',q5:'ok',q3:'review'}};
  var entFilter='all', entSearch='', entStatus='all', entOpen=null, entRun=false, opened=[];
  function entInFilter(){return true;}
  function syncEntSearchChrome(){}
  function entId(q,i){return q.id;}
  function entOk(id){return state.entretien[id]==='ok';}
  function entAllItems(){return ENTRETIEN.map((q,i)=>({q,id:q.id,i}));}
  function openEntretienQuestion(id,run){entRun=!!run;entOpen=id;opened.push(id);}
  ${fn('startEntretien')}${fn('entInTab')}${fn('entFile')}${fn('entNextTarget')}${fn('entPrevTarget')}
`, ctx);
const chain = status => vm.runInContext(`
  entStatus='${status}';opened=[];startEntretien();
  for(let k=0;k<5;k++){const t=entNextTarget(entOpen);if(!t)break;openEntretienQuestion(t.id,entRun);}
  opened.join(',')`, ctx);
for (const st of ['review', 'all', 'ok']) {
  const seq = chain(st).split(',');
  assert(seq[0] === 'q2' && seq.every(id => !['q1', 'q4', 'q5'].includes(id)), `onglet « ${st} » : jamais une question maîtrisée (${seq.join(' → ')})`);
}
assert(vm.runInContext("entStatus='all';startEntretien();entPrevTarget(entOpen).id", ctx) === 'q6', '« Question précédente » aussi');
assert(vm.runInContext("entStatus='ok';openEntretienQuestion('q1');entNextTarget('q1').id", ctx) === 'q4', 'une question ouverte depuis la liste suit l’onglet');
vm.runInContext("state.entretien={q1:'ok',q2:'ok',q3:'ok',q4:'ok',q5:'ok',q6:'ok'};", ctx);
assert(vm.runInContext("startEntretien();entOpen+(entRun?'run':'')", ctx) === 'q1', 'tout maîtrisé : « Revoir une question » repart de la première');
assert(html.includes('let entOpen=null;\nlet entRun=false;'), 'drapeau déclaré avec la question ouverte');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
