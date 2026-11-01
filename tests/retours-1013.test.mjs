/* Elisa, 1er novembre, 10 h 13 : le lot Moyen réécrit « avec beaucoup plus de contexte narratif », chaque situation lisible
   seule ; défi 10 : « abaisser le seuil à 3 % ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({});
vm.runInContext(cut('const CHALLENGES=[', '\n/* La consigne d’un défi').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
const D = id => ctx.CHALLENGES.find(c => c.id === id);

test('les contextes du lot Moyen définissent seuls le résultat et les règles de calcul', () => {
  for (const id of ['am1', 'am2', 'am3', 'am4', 'am5', 'am6', 'am7', 'am8', 'am9', 'af33']) {
    assert.ok(D(id).contexte.includes(D(id).q), `${id} : aucune consigne externe nécessaire`);
    assert.doesNotMatch(D(id).contexte, /voir la question|comme précédemment/i);
  }
  assert.ok(D('am1').contexte.includes('compteur à 0'), 'les vols sans réservation restent présents');
  assert.ok(D('am3').contexte.includes('plusieurs aéroports'), 'le regroupement est par ville');
  assert.ok(D('am4').contexte.includes('moyenne de cette classe'), 'la référence est la classe Économique');
  assert.ok(D('af33').contexte.includes('statut') && D('af33').niv === 'f');
  assert.match(D('am9').contexte, /non arrondi dépasse strictement 3 %/);
  assert.ok(!cut('function defiConsigneHTML(c){', '\n}').includes('indice'), 'pas d’indice au départ dans la consigne');
});
