/* 4 novembre, 14 h 48 (Elisa) : « Avec moi, tu n’oublieras pas ta séance, plutôt : enlève SQL ». La bulle de la mascotte, sur la page
   du rappel de l’onboarding. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('le rappel : « Avec moi, tu n’oublieras pas ta séance ! », sans « SQL »', () => {
  const i = app.lastIndexOf("}else if(slide==='rappel'){"), j = app.indexOf("}else if(slide==='widget'){", i);
  const r = app.slice(i, j);
  assert.ok(r.includes("${obMascotDit('Avec moi, tu n’oublieras pas ta séance !','reveil')}"), 'le réveil qui sonne (7 novembre, 14 h 27)');
  assert.ok(!app.includes('tu n’oublieras pas ta séance SQL'), 'plus nulle part');
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && Number((cache.match(/-v(\d+)$/) || [])[1]) >= 2502, 'la page est rechargée');
});
