/* 19 novembre, 10 h 30 (Elisa : « pareil pour les bases, il y a plusieurs pages quand il y en a beaucoup ») : « Tes projets » et
   « Bases d’entraînement » de la Console en pages de 5, comme l’historique. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), en = readFileSync(new URL('../langue-en.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('5 par page ; la page se recale quand une liste raccourcit', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('const CONSOLE_PROJ_PAR=5;', '\nlet consoleCreateOpen=false;'), ctx);
  const page = (n, p) => JSON.parse(JSON.stringify(vm.runInContext(`consoleListePage(Array.from({length:${n}},(_,i)=>i+1),${p})`, ctx)));
  assert.deepEqual(page(12, 0), {pg: 0, nb: 3, lignes: [1, 2, 3, 4, 5]});
  assert.deepEqual(page(12, 2), {pg: 2, nb: 3, lignes: [11, 12]});
  assert.deepEqual(page(7, 2), {pg: 1, nb: 2, lignes: [6, 7]}, 'des bases supprimées : la dernière vraie page');
  assert.deepEqual(page(3, 0), {pg: 0, nb: 1, lignes: [1, 2, 3]});
  assert.deepEqual(page(0, 4), {pg: 0, nb: 1, lignes: []});
});

test('les deux listes, leurs numéros et « 1 à 5 sur 12 projets » ; pas de numéros pour une seule page', () => {
  const h = cut('function renderConsoleHome(){', '\n/* Ouvrir une base');
  assert.ok(h.includes('<div class="console-project-list" id="console-projets">${pm.lignes.map(row).join(\'\')}</div>'));
  assert.ok(h.includes('${pm.nb>1?`<div class="lq-pages-pied" id="console-projets-pages">${pages(pm,\'consoleProjetsAller\',\'des projets\',mine.length,\'projets\')}</div>`:\'\'}'));
  assert.ok(h.includes('<div class="console-project-list is-demo" id="console-demos">${pd.lignes.map(row).join(\'\')}</div>'));
  assert.ok(h.includes("pages(pd,'consoleDemosAller','des bases d’entraînement',demos.length,'bases')"));
  assert.ok(h.includes('<span>${plur(mine.length,\'projet\')}</span>') && h.includes('<span>${plur(demos.length,\'base\')}</span>'), 'le total en tête, toutes pages');
  for (const k of ['"{1} à {2} sur {3} projets": "{1} to {2} of {3} projects"', '"{1} à {2} sur {3} bases": "{1} to {2} of {3} databases"']) assert.ok(en.includes(k), k);
});
