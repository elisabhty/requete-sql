/* Deux corrections de cohérence dans les cours :
   - une requête déjà montrée dans un cadre surligné n'est pas réécrite dans le cadre « Exécuter » qui suit :
     ce cadre ne garde que le bouton et le résultat (82 cas dans les 66 cours, 5 dans SELECT) ;
   - l'écran de fin (« Ce que tu retiens · Le réflexe de cette leçon ») affiche la requête de la mission,
     plus la solution de l'exercice (qui porte sur une autre table). */
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
const lessons = (() => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
  return JSON.parse(vm.runInContext('JSON.stringify(MODULES.flatMap(m=>m.lessons).map(l=>({id:l.id,missionSql:l.missionSql,solution:l.solution,body:(l.studio&&l.studio.uses&&l.studio.uses.body)||""})))', ctx));
})();

test('cadre « Exécuter » compact quand la même requête vient d’être montrée', () => {
  assert.ok(/function guideBlocks\(a\)\{return guideMarkCompact\(a\)\.map\(guideBlock\)/.test(html), 'étapes et concept');
  assert.ok(/\$\{guideMarkCompact\(m\.blocks\)\.map\(x=>guideBlock\(/.test(html), 'encadrés Attention / Bon à savoir');
  assert.ok(/\$\{b\.compact\?' data-compact="1"':''\}/.test(fnSrc('guideBlock')), 'emplacement marqué');
  assert.ok(/piegeSqlRunBlock\(el\.dataset\.runSql,el\.dataset\.sim,\{compact:el\.dataset\.compact==='1'\}\)/.test(fnSrc('initRunSqlSlots')));
  const run = fnSrc('piegeSqlRunBlock');
  assert.ok(/\$\{compact\?'':`<div class="xf-head">/.test(run), 'ni en-tête ni code en mode compact');
  assert.ok(/la requête ci-dessus/.test(run), 'nom accessible du bouton');
  assert.ok(/html\.lq \.exframe\.is-compact \.xf-actions\{border-top:0!important;padding:12px!important\}/.test(css));
  const total = lessons.reduce((n, l) => n + (l.body.match(/data-compact="1"/g) || []).length, 0);
  assert.equal(total, 82, 'les 82 requêtes montrées deux fois');
  const select = lessons.find(l => l.id === 1);
  assert.equal((select.body.match(/data-compact="1"/g) || []).length, 5, 'cours SELECT : les 5 exemples');
});

test('écran de fin : « Le réflexe de cette leçon » = la requête de la mission', () => {
  const recap = fnSrc('bravoRecapHtml');
  assert.ok(recap.indexOf('l.missionSql') > 0 && recap.indexOf('l.missionSql') < recap.indexOf('l.solution'), 'la mission passe avant la solution de l’exercice');
  for (const l of lessons) assert.ok(l.missionSql && l.missionSql.trim(), `cours ${l.id} : requête de mission`);
  assert.equal(lessons.find(l => l.id === 1).missionSql, 'SELECT prenom, nom, adresse, ville, telephone\nFROM clients;');
});
