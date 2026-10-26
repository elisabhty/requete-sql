/* Cours « guide » (format LAG et LEAD) : chaque requête à exécuter marche, la scène animée est cohérente,
   le HTML est équilibré et la typographie française est respectée (vérifications dans tests/helpers/guide-checks.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {guideEnv, checkGuideLesson} from './helpers/guide-checks.mjs';
const root = path.resolve(import.meta.dirname, '..');
const env = await guideEnv(root);
const {html, ctx} = env;
const allLessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx);
/* Cours en vidéo : la vidéo est le cours, sans texte de secours (ni situation, ni étapes, ni exemple…) ; il garde le réflexe à
   retenir (fin de la vidéo, bilan, note). Les vérifications du cours texte portent sur les autres cours. */
const videos = allLessons.filter(l => l.video);
assert.equal(videos.length, 62, 'les 62 cours en vidéo');
for (const l of videos) {
  assert.ok(!l.situation && !l.missionSql && !l.studio.problem && !l.studio.uses, `${l.titre} : pas de texte de secours`);
  for (const k of ['anatomie', 'exemple', 'attendu', 'retenir', 'learningCheck', 'testeVariants', 'joinRecap'])
    assert.equal(l[k], undefined, `${l.titre} : pas de « ${k} » (texte de secours)`);
  if (l.leconSeule) for (const k of ['consigne', 'solution', 'indice', 'petitDefi']) assert.equal(l[k], undefined, `${l.titre} : leçon seule, sans exercice (« ${k} »)`);
  assert.ok(l.studio.reflex.extra.includes('<ol class="fk-syn-map is-recap"'), `${l.titre} : le réflexe à retenir reste`);
}
/* Depuis le 26 octobre, tous les cours de l’app sont en vidéo (Sécurité et droits, le dernier cours texte, est devenu le chapitre 17) :
   le modèle « guide » des cours texte est vérifié sur les trois cours d’exemple (tests/fixtures : les anciennes leçons 50, 57 et 64). */
assert.equal(allLessons.filter(l => !l.video).length, 0, 'plus aucun cours texte dans l’app');
const lessons = ['guide-texte-droits.js', 'guide-texte-index.js', 'guide-texte-create-view.js']
  .map(f => vm.runInContext(fs.readFileSync(path.join(root, 'tests/fixtures', f), 'utf8'), ctx));
assert.ok(lessons.every(l => l.guided && !l.video), 'trois cours guide d’exemple');
/* Tous les cours suivent le modèle « guide » : situation, problème animé, mission, concept, étapes, carte « Mission accomplie », réflexe. */
const notGuided = allLessons.filter(l => !l.guided).map(l => l.id);
assert.equal(notGuided.length, 0, `tous les cours sont au format « guide » (à convertir : ${notGuided.join(', ')})`);
let runs = 0, testedTables = 0;
for (const l of lessons) { const r = checkGuideLesson(env, l); runs += r.runs; testedTables += r.testedTables; }
/* Plus aucun cours texte n’utilise le tableau « à tester » (WHERE, DISTINCT et DELETE sont devenus des vidéos) : si l’un d’eux en reçoit un, ses verdicts sont vérifiés
   ci-dessus ; le moteur du tableau reste testé dans row-test-animation.test.mjs, sur une maquette. */
/* Moteur des scènes : plusieurs animations par cours, grille de colonnes qui se referme, mise en forme « fiche ». */
for (const frag of ['function mountProbScene(cfg,slot,memo)', "if(s.cols)root.style.setProperty('--cols',s.cols)", 'if(s.order){', ".pr-slot[data-xscene]", '.pr-scene.has-cols .pr-cells{gap:4px;transition:grid-template-columns', '.pr-scene.is-form .pr-c.pr-th', '.pr-c.is-gone{max-width:0!important', 'cardText(a)===cardText(b)'])
  assert.ok(html.includes(frag), `moteur : « ${frag} » présent`);
console.log(`${lessons.length} cours guide, ${runs} requêtes exécutées, ${testedTables} tableau(x) à tester : OK`);
