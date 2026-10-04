/* Cours « guide » (format LAG et LEAD) : chaque requête à exécuter marche, la scène animée est cohérente,
   le HTML est équilibré et la typographie française est respectée (vérifications dans tests/helpers/guide-checks.mjs). */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';
const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx).filter(l => l.guided);
assert.ok(lessons.length >= 1, 'au moins un cours guide');
let runs = 0, testedTables = 0;
for (const l of lessons) { const r = checkGuideLesson(env, l); runs += r.runs; testedTables += r.testedTables; }
assert.ok(testedTables >= 1, 'au moins un tableau à tester (cours WHERE)');
/* Moteur des scènes : plusieurs animations par cours, grille de colonnes qui se referme, mise en forme « fiche ». */
for (const frag of ['function mountProbScene(cfg,slot,memo)', "if(s.cols)root.style.setProperty('--cols',s.cols)", 'if(s.order){', ".pr-slot[data-xscene]", '.pr-scene.has-cols .pr-cells{gap:4px;transition:grid-template-columns', '.pr-scene.is-form .pr-c.pr-th', '.pr-c.is-gone{max-width:0!important', '.ij-sms.is-flat .ij-sms-plane svg', 'cardText(a)===cardText(b)'])
  assert.ok(html.includes(frag), `moteur : « ${frag} » présent`);
console.log(`${lessons.length} cours guide, ${runs} requêtes exécutées, ${testedTables} tableau(x) à tester : OK`);
