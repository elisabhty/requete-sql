/* Elisa, 7 novembre, 7 h 48, sur la fiche de la carte mémo 12 (« Fonctions de texte ») : « Met juste un petit espace avant
   l’ampoule ». L’ampoule de « À retenir » touchait le bas du recto violet (0 à 1 px) : 12 px de plus sous le recto, dans la fiche
   seulement (au bilan, le verso est une carte à part, sans recto au-dessus). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), lq = read('ludique.css'), sw = read('sw.js');

test('la fiche : un petit espace entre le recto et l’ampoule', () => {
  assert.ok(lq.includes('html.lq .mc-verso{position:relative;margin:-22px 7px 0;padding:36px 16px 18px;'), 'le verso glisse toujours sous le recto (22 px)');
  assert.ok(lq.includes('html.lq .mc-fiche>.mc-verso{padding-top:48px}'), '36 → 48 px : l’ampoule à 12 px du recto');
  assert.ok(lq.includes('@media (max-width:360px){html.lq .mc-verso{margin:-22px 4px 0;padding:34px 12px 16px}html.lq .mc-fiche>.mc-verso{padding-top:46px}'), 'pareil sur les petits écrans');
  assert.ok(lq.indexOf('html.lq .mc-fiche>.mc-verso{padding-top:48px}') > lq.indexOf('html.lq .mc-verso{position:relative;'), 'après la règle commune');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=302">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-09-clair-v2800';") && app.includes("const SW_CACHE='requete-2026-11-09-clair-v2800';"));
});
