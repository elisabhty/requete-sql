import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {extractSeed, replaceSeed, describeSeed, sha} from '../scripts/db-snapshot.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const dir = path.join(root, 'db-snapshots');
const snaps = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];

test('la base du cours s’extrait de index.html et se remet à l’identique', () => {
  const seed = extractSeed(html);
  assert.match(seed, /CREATE TABLE clients/);
  assert.equal(replaceSeed(html, seed), html);
});

test('replaceSeed refuse un texte qui casserait la chaîne JavaScript', () => {
  assert.throws(() => replaceSeed(html, 'SELECT `x`;'), /chaîne JavaScript/);
});

test('au moins une photo de la base existe et chaque photo est cohérente avec sa fiche', async () => {
  assert.ok(snaps.length >= 1, 'db-snapshots/ doit contenir au moins une photo');
  for (const f of snaps) {
    const base = f.replace(/\.sql$/, '');
    const sql = readFileSync(path.join(dir, f), 'utf8');
    const meta = JSON.parse(readFileSync(path.join(dir, base + '.json'), 'utf8'));
    assert.equal(meta.sha256, sha(sql), `${f} : empreinte différente de la fiche`);
    if (meta.invalid) continue;
    const info = await describeSeed(sql);
    assert.deepEqual(info.tables, meta.tables, `${f} : tables ou effectifs différents de la fiche`);
    assert.ok(existsSync(path.join(dir, base + '.sqlite')), `${f} : fichier .sqlite manquant`);
  }
});

test('la base actuelle de l’appli s’exécute (une colonne ajoutée sans compléter les INSERT est détectée ici)', async () => {
  const info = await describeSeed(extractSeed(html));
  for (const t of ['clients', 'produits', 'commandes', 'fidelite']) assert.ok(info.tables[t], `table ${t} manquante`);
});
