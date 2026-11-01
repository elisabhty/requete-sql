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

test('les situations du lot Moyen, plus riches, ajustées à la base', () => {
  for (const id of ['am1', 'am2', 'am3', 'am4', 'am5', 'am6', 'am7', 'am8', 'am9', 'af33']) assert.ok(D(id).contexte.length > 300, `${id} : une situation complète`);
  assert.ok(D('am1').contexte.startsWith('Nous sommes lundi matin, et la compagnie aérienne doit rendre son rapport d’activité hebdomadaire'));
  assert.ok(!/complet/.test(D('am1').contexte), 'aucun vol n’est complet dans la base');
  assert.ok(!/plusieurs réservations sur le même vol/.test(D('am5').contexte), 'jamais deux réservations d’un passager sur un même vol');
  assert.ok(D('am4').contexte.includes('plus cher que le prix moyen de cette classe'), 'la sous-requête, pas le prix moyen par classe (déjà af21)');
  assert.ok(D('af33').contexte.startsWith('Le service qualité de l’aéroport effectue son audit mensuel.') && D('af33').niv === 'f');
  assert.ok(D('am9').contexte.includes('dépasse 3 %') && D('am9').q.includes('dépasse 3 %'));
  assert.ok(!cut('function defiConsigneHTML(c){', '\n}').includes('indice'), 'pas d’indice au départ dans la consigne');
});
