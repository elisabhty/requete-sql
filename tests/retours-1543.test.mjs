/* Elisa, 5 novembre, 15 h 43 (quatre captures) :
   - Réf. 1 pour la réf. 2 : « 6 activités à rattraper » (plus « à replacer »), « 3 séances non terminées », « Comment veux-tu
     reprendre ? », les trois façons en boutons radio — la recommandée cochée d’avance —, « Confirmer mon choix » et « Je déciderai
     plus tard » ; « Reprendre à mon rythme », « Tout rattraper aujourd’hui », « environ 48 min ».
   - Réf. 3 : « quand on clique sur Relever un défi, le niveau recommandé est sélectionné ».
   - Au passage : « Fin le 1 décembre » devient « Fin le 1er décembre ».
   Vérifié dans un navigateur (402 et 320 px ; au clavier : les flèches changent le choix). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const N = ' ';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 10 novembre, 0 h 53 : la carte « activités à rattraper » et ses trois façons sont parties ; le planning se décale tout seul
   (planning-decalage-auto). */
test('« 1er décembre » : le premier du mois a son « er », partout où le planning dit une date', () => {
  assert.equal((app.match(/toLocaleDateString\('fr-FR',\{day:'numeric',month:'long'(?:,year:'numeric')?\}\)\.replace\(\/\^1 \/,'1er '\)/g) || []).length, 6, 'depuis le 10 novembre, sans la date de fin du décalage (la carte de rattrapage est partie)');
  assert.equal((app.match(/toLocaleDateString\('fr-FR',\{day:'numeric',month:'long'(?:,year:'numeric')?\}\)(?!\.replace)/g) || []).length, 0, 'aucune date sans son « 1er »');
});

test('réf. 3 : « Relever un défi » sélectionne le niveau recommandé, même après un autre choix ; « Mes défis » n’y touche pas', () => {
  const vus = [], prefs = [];
  const ctx = vm.createContext({ DEFIS: { onglet: 'jouer' }, switchTab: t => vus.push(t), jeuNivAuto: () => 'm', jeuSavePrefs: () => prefs.push(vm.runInContext('[jeuNiv,jeuNivUser].join()', ctx)) });
  vm.runInContext("var jeuNiv='d',jeuNivUser=true;" + cut('let defisVersStats=false;', '/* L’entrée Stickers'), ctx);
  ctx.pratiquerDefis('stats');
  assert.deepEqual([vm.runInContext('jeuNiv', ctx), vm.runInContext('jeuNivUser', ctx)], ['d', true], 'Mes stats : le niveau reste');
  ctx.pratiquerDefis('jouer');
  assert.deepEqual([vm.runInContext('jeuNiv', ctx), vm.runInContext('jeuNivUser', ctx), ctx.DEFIS.onglet], ['m', false, 'jouer']);
  assert.deepEqual(prefs, ['m,false'], 'retenu pour la salle');
  assert.deepEqual(vus, ['defis', 'defis']);
  /* La salle garde le recommandé tant qu’on n’en choisit pas un autre, et le dit */
  assert.ok(app.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Niveau recommandé</em>':''}") && app.includes('if(!jeuNivUser)jeuNiv=jeuNivAuto();'));
});
