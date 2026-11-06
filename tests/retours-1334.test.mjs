/* Elisa, 6 novembre, 13 h 34 (capture de la Bibliothèque) : « mettre Entretien SQL en premier, ensuite Notes et Selon le SGBD ».
   Les cartes mémo, les stickers et tous les cours suivent, dans leur ordre d’avant. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('Bibliothèque : Entretien SQL, Mes notes, Selon le SGBD, puis Cartes mémo, Stickers et Tous les cours', () => {
  const hub = cut('function renderJourneyHub(tab){', "const hostId=tab==='practice'?'practice-tools':'library-tools';");
  const lib = hub.slice(hub.indexOf(']:['));
  const ordre = ["['interview','Entretien SQL'", "['notes','Mes notes'", "['sgbd','Selon le SGBD'", "['cards','Cartes mémo'", 'stkHubEntry(),', "['courses','Tous les cours'"]
    .map(k => { const i = lib.indexOf(k); assert.ok(i >= 0, k); return i; });
  assert.deepEqual([...ordre].sort((x, y) => x - y), ordre, 'dans cet ordre');
  assert.ok(hub.includes("['console','Console SQL'"), 'Pratiquer ne change pas');
});
