import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'decouvrir', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('<ol class="how-list hw">');
const end = html.indexOf('</ol>', start);
const steps = html.slice(start, end);

 test('« Comment ça marche » présente les étapes du cours vidéo et de la pratique', () => {
  assert.ok(start >= 0 && end > start);
  assert.match(steps, /<span class="hw-l">Étape 1 sur 3<\/span>/);
  assert.match(steps, /<h3>Regarde le cours<\/h3>/);
  assert.match(steps, /Avance à ton rythme et mets la vidéo en pause quand tu veux\./);
  assert.match(steps, /<span class="hw-l">Étape 2 sur 3<\/span>/);
  assert.match(steps, /<h3>Réponds aux moments « À toi »<\/h3>/);
  assert.match(steps, /La vidéo s’arrête à chaque moment : réponds à la consigne pour continuer\./);
  assert.match(steps, /<h3>Passe aux vrais cas<\/h3>/, 'la troisième étape de pratique reste présente');
  assert.doesNotMatch(app, /class="lv-steps"/, 'les consignes ne sont pas ajoutées à chaque fiche de cours');
});
