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

/* 4 novembre, 20 h 33 : la consigne point par point (situation, Affiche, Garde, Trie, À savoir) remplace le contexte. */
const T = c => [c.titre, c.situation, ...(c.affiche || []), ...(c.garde || []), c.tri || '', ...(c.precis || [])].join(' ').replace(/\u00a0/g, ' ');
test('les contextes du lot Moyen définissent seuls le résultat et les règles de calcul', () => {
  for (const id of ['am1', 'am2', 'am3', 'am4', 'am5', 'am6', 'am7', 'am8', 'am9', 'af33']) {
    assert.ok(D(id).situation && D(id).affiche.length, `${id} : aucune consigne externe nécessaire`);
    assert.doesNotMatch(T(D(id)), /voir la question|comme précédemment/i);
  }
  assert.ok(T(D('am1')).includes('0 s’il n’en a aucune') && T(D('am1')).includes('y compris ceux sans réservation'), 'les vols sans réservation restent présents');
  assert.ok(T(D('am3')).includes('tous vols vers cette ville confondus'), 'le regroupement est par ville');
  assert.ok(T(D('am4')).includes('le prix moyen des billets « Économique »'), 'la référence est la classe Économique');
  assert.ok(T(D('af33')).includes('statut') && D('af33').niv === 'f');
  assert.match(T(D('am9')), /avant arrondi, dépasse strictement 3 %/);
  assert.ok(!cut('function defiConsigneHTML(c,o){', '\n}').includes('indice'), 'pas d’indice au départ dans la consigne');
});
