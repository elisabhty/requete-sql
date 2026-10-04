/* exoNeeds : un cours peut exiger des notions dans la réponse de l'exercice (ex. un EXISTS, un IN (SELECT …), un CROSS JOIN).
   checkExerciseConcept (index.html) accepte la solution du cours et refuse, avec le message du cours, une réponse qui contourne la notion. */
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const {html, ctx} = await guideEnv(root);
const a = html.indexOf('function exerciseSqlStructure(sql){'), b = html.indexOf('function checkSchemaExercise(');
assert.ok(a > 0 && b > a, 'checkExerciseConcept localisée dans index.html');
const fnCtx = vm.createContext({});
vm.runInContext(html.slice(a, b), fnCtx);
const check = (sql, l) => vm.runInContext(`checkExerciseConcept(${JSON.stringify(sql)}, ${JSON.stringify({id: l.id, exoNeeds: l.exoNeeds})})`, fnCtx);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx).filter(l => l.exoNeeds && l.exoNeeds.length);

test('les cours à notion obligatoire sont déclarés', () => {
  assert.ok(lessons.length >= 20, `20 cours au moins déclarent exoNeeds (trouvés : ${lessons.length})`);
});

test('la solution du cours satisfait ses propres exigences', () => {
  for (const l of lessons) {
    const r = check(l.solution, l);
    assert.equal(r.ok, true, `${l.titre} : la solution est refusée (${r.diag})`);
  }
});

test('une réponse qui contourne la notion est refusée avec le message du cours', () => {
  for (const l of lessons) {
    const r = check('SELECT 1;', l);
    assert.equal(r.ok, false, `${l.titre} : « SELECT 1 » ne devrait pas passer`);
    assert.ok(l.exoNeeds.some(n => n.msg === r.diag), `${l.titre} : le message affiché est celui d'une exigence du cours`);
  }
});

test('commentaires et chaînes ne comptent pas comme une notion employée', () => {
  for (const l of lessons) {
    const first = l.exoNeeds[0];
    const word = /[A-Z][A-Z ]{2,}/.exec(first.re.replace(/\\[bsS]|[()?+*|\[\]]/g, ' '));
    if (!word) continue;
    const sneaky = `SELECT 1; -- ${word[0].trim()}\nSELECT '${word[0].trim()}';`;
    const r = check(sneaky, l);
    assert.equal(r.ok, false, `${l.titre} : un commentaire ou une chaîne ne doit pas valider « ${first.re} »`);
  }
});
