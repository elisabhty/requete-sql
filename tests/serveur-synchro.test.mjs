/* Le serveur (supabase/functions/jeu-verifier) doit vérifier avec le même code que l’appli : sql-compat.mjs et matcher.mjs sont
   générés depuis index.html par scripts/build-secure-catalog.cjs. Ce test échoue si on oublie de le relancer (4 novembre : la règle
   DATETRUNC(iso_week) du 3 novembre manquait au serveur jusqu’à la régénération de 22 h 11). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = process.env.RACINE || path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
test('les fichiers du serveur suivent index.html', () => {
  const html = lire('index.html'), build = lire('scripts/build-secure-catalog.cjs');
  const exp = /matcher\+'\\nexport \{([^}]*)\};\\n'/.exec(build)[1];
  const compat = html.slice(html.indexOf('const SQLX='), html.indexOf('function buildDb()')) + '\nexport {attachDateFns,sqlCompat};\n';
  const matcher = html.slice(html.indexOf('function normCell('), html.indexOf('function fmtLignes(')) + `\nexport {${exp}};\n`;
  assert.equal(lire('supabase/functions/jeu-verifier/sql-compat.mjs'), compat, 'sql-compat.mjs n’est plus à jour : node scripts/build-secure-catalog.cjs');
  assert.equal(lire('supabase/functions/jeu-verifier/matcher.mjs'), matcher, 'matcher.mjs n’est plus à jour : node scripts/build-secure-catalog.cjs');
});

/* Et le catalogue : chaque défi de l’appli a sur le serveur la même solution, le même ordre exigé et la même base (4 novembre : les
   huit défis refaits à 22 h 08 n’ont été vérifiés en salle qu’après le redéploiement). */
test('le catalogue du serveur a les solutions de l’appli', async () => {
  const vm = await import('node:vm');
  const html = lire('index.html'), cat = JSON.parse(lire('supabase/functions/jeu-verifier/catalog.json'));
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const CHALLENGES=['), html.indexOf('const NIV=')).replace('const CHALLENGES=', 'CHALLENGES='), ctx);
  const appli = vm.runInContext('CHALLENGES', ctx), serveur = new Map(cat.challenges.map(c => [c.id, c]));
  assert.equal(cat.challenges.length, appli.length, 'autant de défis');
  for (const c of appli) {
    const s = serveur.get(c.id);
    assert.ok(s, `${c.id} : absent du serveur`);
    assert.equal(s.sol, c.sol, `${c.id} : solution différente — node scripts/build-secure-catalog.cjs, puis redéployer jeu-verifier`);
    assert.equal(!!s.ordered, !!c.ordered, `${c.id} : ordre exigé différent`);
    assert.equal(s.base, c.base, `${c.id} : base différente`);
  }
});
