/* Cours « Modéliser avec UML » (leçon 81, vidéo interactive : assets/anim/projet-uml.html, testée dans lesson-video.test.mjs) :
   le diagramme de classes des ateliers NutriBoost, traduit en tables. Placé dans le module Modéliser, après « Clés et relations »
   et avant CREATE TABLE. Leçon seule : ni cours texte, ni exercice. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const modules = vm.runInContext('MODULES', ctx);
const lessons = modules.flatMap(m => m.lessons);
const l81 = lessons.find(l => l.id === 81);

test('Modéliser avec UML : dans le module Modéliser, après Clés et relations et avant CREATE TABLE', () => {
  const m = modules.find(x => x.titre === 'Modéliser');
  assert.deepEqual([...m.lessons.map(l => l.id)], [56, 72, 81]);
  assert.equal(m.sous, 'Normalisation, cardinalités et UML');
  const ids = lessons.map(l => l.id);
  assert.equal(ids.indexOf(81), ids.indexOf(72) + 1);
  assert.equal(ids.indexOf(61), ids.indexOf(81) + 1, 'CREATE TABLE vient juste après');
  assert.equal(l81.titre, 'Modéliser avec UML');
  assert.equal(l81.résumé, 'Du diagramme de classes aux tables');
});

test('recherche, et leçon seule sans texte de secours ni exercice', () => {
  assert.ok(html.includes("81:'uml diagramme de classes"), 'trouvé par la recherche « uml » ou « diagramme de classes »');
  assert.ok(l81.leconSeule && l81.video && !l81.situation && !l81.consigne && !l81.solution && !l81.petitDefi && !l81.learningCheck, 'la vidéo est le cours');
});
