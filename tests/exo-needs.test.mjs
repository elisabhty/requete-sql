/* exoNeeds : un exercice peut exiger des notions dans la réponse (ex. un EXISTS, un CROSS JOIN, un LEFT JOIN … IS NULL).
   checkExerciseConcept (index.html) accepte la solution et refuse, avec le message de l’exercice, une réponse qui contourne la notion.
   Depuis le 28 octobre (Elisa : « mettre l’écran de fin de cours et enlever la partie quiz et exercice »), aucun cours n’a plus
   d’exercice : le contrôle reste prêt pour un exercice qui en aurait besoin, et se vérifie sur quatre anciens exercices des cours. */
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

/* Les anciens exercices des cours INNER JOIN, LEFT JOIN, CROSS JOIN et EXISTS, tels qu’ils étaient avant le 28 octobre. */
const EXERCICES = [
  {id: 18, titre: 'INNER JOIN', solution: 'SELECT commandes.id, produits.nom, commandes.quantite FROM commandes INNER JOIN produits ON commandes.produit_id = produits.id WHERE commandes.quantite > 2;',
    exoNeeds: [{re: '\\bJOIN\\b', msg: 'Relie les deux tables avec INNER JOIN … ON …'}]},
  {id: 20, titre: 'LEFT JOIN', solution: 'SELECT clients.prenom, clients.nom, clients.email FROM clients LEFT JOIN commandes ON clients.id = commandes.client_id WHERE commandes.id IS NULL AND clients.email IS NOT NULL;',
    exoNeeds: [{re: '\\b(?:LEFT|RIGHT)\\s+(?:OUTER\\s+)?JOIN\\b', msg: 'Garde tous les clients avec un LEFT JOIN, même ceux qui n’ont aucune commande.'},
      {re: '\\bIS\\s+NULL\\b', msg: 'Repère les clients sans commande avec IS NULL.'}]},
  {id: 40, titre: 'CROSS JOIN', solution: 'SELECT DISTINCT commandes.statut, produits.nom FROM commandes CROSS JOIN produits;',
    exoNeeds: [{re: '\\bCROSS\\s+JOIN\\b', msg: 'Utilise CROSS JOIN pour associer chaque statut à chaque produit.'}]},
  {id: 55, titre: 'EXISTS et NOT EXISTS', solution: 'SELECT prenom FROM clients WHERE NOT EXISTS (SELECT 1 FROM fidelite WHERE fidelite.client_id = clients.id);',
    exoNeeds: [{re: '\\bNOT\\s+EXISTS\\b', msg: 'Utilise NOT EXISTS : garde les clients pour lesquels la recherche dans fidelite ne trouve aucune ligne.'}]}
];

test('plus aucun cours ne déclare d’exercice ni de notion obligatoire : chaque cours est une leçon seule', () => {
  const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', ctx);
  assert.equal(lessons.length, 64);
  assert.equal(lessons.filter(l => l.exoNeeds || l.consigne || l.solution || !l.leconSeule).map(l => l.titre).join(', '), '');
});

test('la solution satisfait ses propres exigences', () => {
  for (const l of EXERCICES) {
    const r = check(l.solution, l);
    assert.equal(r.ok, true, `${l.titre} : la solution est refusée (${r.diag})`);
  }
});

test('une réponse qui contourne la notion est refusée avec le message de l’exercice', () => {
  for (const l of EXERCICES) {
    const r = check('SELECT 1;', l);
    assert.equal(r.ok, false, `${l.titre} : « SELECT 1 » ne devrait pas passer`);
    assert.ok(l.exoNeeds.some(n => n.msg === r.diag), `${l.titre} : le message affiché est celui d'une exigence de l’exercice`);
  }
});

test('commentaires et chaînes ne comptent pas comme une notion employée', () => {
  for (const l of EXERCICES) {
    const first = l.exoNeeds[0];
    const word = /[A-Z][A-Z ]{2,}/.exec(first.re.replace(/\\[bsS]|[()?+*|\[\]]/g, ' '));
    if (!word) continue;
    const sneaky = `SELECT 1; -- ${word[0].trim()}\nSELECT '${word[0].trim()}';`;
    const r = check(sneaky, l);
    assert.equal(r.ok, false, `${l.titre} : un commentaire ou une chaîne ne doit pas valider « ${first.re} »`);
  }
});
