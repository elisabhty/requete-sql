/* Deux règles de cohérence dans les cours :
   - une requête n'est jamais affichée deux fois de suite : si un cadre surligné la montre et que le cadre « Exécuter »
     la reprend aussitôt après (même texte, rien entre les deux), elle ne reste que dans le cadre « Exécuter », avec son
     surlignage ; quand un repère ou un texte sépare les deux, chaque cadre garde sa requête (aucun cadre « Exécuter »
     sans requête) ;
   - l'écran de fin (« Ce que tu retiens · Le réflexe de cette leçon ») affiche la requête de la mission d'un cours texte,
     plus la solution de l'exercice (qui porte sur une autre table) ; pour un cours en vidéo, les trois idées à retenir. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const fnSrc = name => {
  const a = html.indexOf(`function ${name}(`);
  assert.ok(a >= 0, `function ${name}( présente`);
  return html.slice(a, html.indexOf('\nfunction ', a + 10));
};
/* Les cours de l’app, puis les trois cours texte d’exemple (tests/fixtures : les anciennes leçons 50, 57 et 64, identifiants 950, 957 et 964) :
   depuis le 26 octobre, tous les cours de l’app sont en vidéo, et le moteur des cours texte est testé sur ces exemples. */
const FIXTURES = ['guide-texte-droits.js', 'guide-texte-index.js', 'guide-texte-create-view.js'];
const lessons = (() => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
  vm.runInContext('var FIXTURES = [];', ctx);
  for (const f of FIXTURES) { ctx.__l = vm.runInContext(fs.readFileSync(path.join(root, 'tests/fixtures', f), 'utf8'), ctx); vm.runInContext('FIXTURES.push(__l);', ctx); }
  return JSON.parse(vm.runInContext('JSON.stringify(MODULES.flatMap(m=>m.lessons).concat(FIXTURES).map(l=>({id:l.id,video:!!l.video,missionSql:l.missionSql,solution:l.solution,body:(l.studio&&l.studio.uses&&l.studio.uses.body)||""})))', ctx));
})();

test('cadre surligné + cadre « Exécuter » qui se suivent : la requête ne s’affiche qu’une fois, dans le cadre « Exécuter »', () => {
  assert.ok(/function guideBlocks\(a\)\{return guideMergeRuns\(a\)\.map\(guideBlock\)/.test(html), 'étapes et concept');
  assert.ok(/\$\{guideMergeRuns\(m\.blocks\)\.map\(x=>guideBlock\(/.test(html), 'encadrés Attention / Bon à savoir');
  assert.ok(/\$\{b\.hit\?` data-hit=/.test(fnSrc('guideBlock')), 'emplacement marqué');
  assert.ok(/piegeSqlRunBlock\(el\.dataset\.runSql,el\.dataset\.sim,\{hit:el\.dataset\.hit\}\)/.test(fnSrc('initRunSqlSlots')));
  const run = fnSrc('piegeSqlRunBlock');
  assert.ok(/<div class="xf-head">/.test(run) && /<div class="ex-code">\$\{hit\?highlightHit\(hit\):highlight\(sql\)\}<\/div>/.test(run), 'le cadre montre toujours la requête');
  assert.ok(!/compact/.test(run), 'plus de cadre sans requête');
  assert.ok(!/is-compact/.test(css) && /html\.lq \.exframe \.ex-code \.fk-syn-hit\{/.test(css), 'partie mise en avant dans le cadre sombre');
  /* Aucun cadre « Exécuter » sans requête ; les requêtes fusionnées sont celles qui suivaient aussitôt leur cadre surligné. */
  assert.equal(lessons.reduce((n, l) => n + (l.body.match(/data-compact=/g) || []).length, 0), 0, 'plus de cadre compact');
  const merged = lessons.reduce((n, l) => n + (l.body.match(/ data-hit="/g) || []).length, 0);
  assert.equal(merged, 2, 'une requête montrée deux fois de suite, désormais une seule fois (les cours texte d’exemple : l’ancien cours 50, l’ancien cours 57)');
  assert.equal(lessons.find(l => l.id === 1), undefined, 'le cours SELECT a rejoint le cours 0');
});

test('requête surlignée dans le cadre « Exécuter » : mêmes couleurs que la requête simple, avec la partie mise en avant', () => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const KW'), html.indexOf('function highlightMark(')).replace(/const (KW|FN)\b/g, 'var $1'), ctx);
  const tokens = h => [...h.matchAll(/<span class="(t-[a-z]+)">([^<]*)<\/span>/g)].map(m => m[1] + ':' + m[2]).join('|');
  const marked = 'SELECT ⟦prenom,⟧ nom\nFROM clients;';
  const hit = vm.runInContext(`highlightHit(${JSON.stringify(marked)})`, ctx);
  const plain = vm.runInContext(`highlight(${JSON.stringify(marked.replace(/[⟦⟧]/g, ''))})`, ctx);
  assert.ok(hit.includes('<span class="fk-syn-hit">'), 'partie mise en avant');
  assert.equal(tokens(hit), tokens(plain), 'les mêmes mots-clés et fonctions colorés');
  assert.equal(hit.replace(/<[^>]+>/g, ''), plain.replace(/<[^>]+>/g, ''), 'le même texte');
  assert.equal((hit.match(/<span/g) || []).length, (hit.match(/<\/span>/g) || []).length, 'balises équilibrées');
});

test('écran de fin : « Le réflexe de cette leçon » = les trois idées (cours en vidéo) ou la requête de la mission (cours texte)', () => {
  const recap = fnSrc('bravoRecapHtml');
  assert.ok(recap.indexOf('lessonHasVideo(l)') > 0 && recap.indexOf('lessonHasVideo(l)') < recap.indexOf('l.missionSql'), 'cours en vidéo : les trois idées, comme à la fin de la vidéo');
  assert.ok(recap.indexOf('l.missionSql') > 0 && recap.indexOf('l.missionSql') < recap.indexOf('l.solution'), 'la mission passe avant la solution de l’exercice');
  for (const l of lessons) assert.ok(l.video ? !l.missionSql : l.missionSql && l.missionSql.trim(), `cours ${l.id} : ${l.video ? 'pas de mission (vidéo)' : 'requête de mission'}`);
  assert.equal(lessons.find(l => l.id === 950).missionSql, "GRANT SELECT\nON clients\nTO app_user;", 'l’ancien cours 50 (Sécurité et droits en texte, gardé en exemple)');
  assert.ok(lessons.filter(l => l.id < 900).every(l => l.video), 'tous les cours de l’app sont en vidéo (Sécurité et droits, le dernier cours texte, est devenu le chapitre 18)');
});
