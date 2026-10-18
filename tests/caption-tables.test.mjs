/* Une légende qui nomme plusieurs tables les met toutes en gras, ou aucune :
   « la table clients, la table commandes et la table produits » ne garde pas une seule table en gras. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const DIR = new URL('../assets/anim/', import.meta.url);

test('légendes des vidéos : plusieurs tables nommées, même mise en forme pour toutes', () => {
  const bad = [];
  for (const f of fs.readdirSync(DIR).filter(n => n.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(DIR.pathname, f), 'utf8');
    for (const m of src.matchAll(/\[\s*[\d.]+,\s*[\d.]+,\s*"((?:[^"\\]|\\.)*)"\s*\]/g)) {
      const tables = [...m[1].matchAll(/(<b>)?table (\w+)(<\/b>)?/g)].map(t => !!(t[1] && t[3]));
      if (tables.length >= 2 && tables.some(Boolean) && !tables.every(Boolean)) bad.push(`${f} : ${m[1].replace(/<br>/g, ' / ')}`);
    }
  }
  assert.deepEqual(bad, [], 'tables en gras pour certaines seulement');
});
