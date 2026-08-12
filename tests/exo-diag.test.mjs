#!/usr/bin/env node
/**
 * Tests diagnostics exercices (exoFailDiag) + validation SQL leçon HAVING.
 * Usage: node tests/exo-diag.test.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import vm from 'vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const blockStart = html.indexOf('function normalize');
const blockEnd = html.indexOf('/* ============================================================\n   6. BARRE DE TOUCHES SQL');
if (blockStart < 0 || blockEnd < 0) {
  console.error('Impossible de localiser exoFailDiag dans index.html');
  process.exit(1);
}

const ctx = { esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
vm.createContext(ctx);
vm.runInContext(
  `function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}\n` +
  html.slice(blockStart, blockEnd),
  ctx
);

const { exoFailDiag, parseHavingCount, normalize, fmtLignes } = ctx;
const mock = (cols, rows) => [{ columns: cols, values: rows }];

let passed = 0;
let failed = 0;

function assert(cond, name, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n    → ${detail}` : ''}`);
  }
}

function assertIncludes(msg, needle, name) {
  const dec = msg.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  assert(dec.includes(needle) || msg.includes(needle), name, `attendu "${needle}" dans:\n    ${msg}`);
}

function assertNotIncludes(msg, needle, name) {
  assert(!msg.includes(needle), name, `ne devait pas contenir "${needle}"`);
}

console.log('\n=== parseHavingCount ===');
assert(parseHavingCount('HAVING COUNT(*) >= 3')?.n === 3, '>= 3 parsé');
assert(parseHavingCount('HAVING COUNT(*) = 1')?.op === '=', '= 1 parsé');
assert(parseHavingCount('HAVING COUNT(DISTINCT produits.categorie) >= 2')?.n === 2, 'COUNT DISTINCT parsé');
assert(parseHavingCount('WHERE prix > 10') === null, 'pas de faux positif WHERE');

console.log('\n=== fmtLignes ===');
assert(fmtLignes(1) === '1 ligne', 'singulier');
assert(fmtLignes(2) === '2 lignes', 'pluriel');

console.log('\n=== exoFailDiag — HAVING leçon 17 ===');
const SOL_HAVING =
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 2;';

{
  const sql =
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 3;';
  const userRes = mock(['categorie', 'COUNT(*)'], [['Bien-être', 3]]);
  const solRes = mock(
    ['categorie', 'COUNT(*)'],
    [
      ['Bien-être', 3],
      ['Nutrition', 2],
    ]
  );
  const msg = exoFailDiag(sql, SOL_HAVING, userRes, solRes);
  assertIncludes(msg, 'HAVING COUNT(*)', 'seuil HAVING mentionné');
  assertIncludes(msg, '>= 3', 'seuil élève affiché');
  assertIncludes(msg, 'exclut', 'diagnostic orienté requête');
  assertNotIncludes(msg, 'produits', 'pas de mention « produits » hardcodée');
  assertNotIncludes(msg, 'ligne', 'pas de compte de lignes');
  assertNotIncludes(msg, 'essaie', 'ne donne pas la réponse');
  assert(!msg.includes('>= 2'), 'ne révèle pas le seuil attendu');
}

{
  const sql =
    'SELECT categorie, COUNT(*) FROM produits WHERE COUNT(*) >= 2 GROUP BY categorie;';
  const msg = exoFailDiag(sql, SOL_HAVING, mock(['categorie', 'COUNT(*)'], []), mock(['categorie', 'COUNT(*)'], [['a', 1]]));
  assertIncludes(msg, 'WHERE', 'COUNT dans WHERE détecté');
  assertIncludes(msg, 'HAVING', 'orienté vers HAVING');
}

{
  const sql = 'SELECT categorie, COUNT(*) FROM produits;';
  const userRes = mock(['categorie', 'COUNT(*)'], [['Bien-être', 8]]);
  const solRes = mock(
    ['categorie', 'COUNT(*)'],
    [
      ['Bien-être', 3],
      ['Nutrition', 2],
    ]
  );
  const msg = exoFailDiag(sql, SOL_HAVING, userRes, solRes);
  assertIncludes(msg, 'GROUP BY', 'GROUP BY manquant (agrégat sans regroupement)');
}

{
  const sql = 'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie;';
  const userRes = mock(['categorie', 'COUNT(*)'], [
    ['Bien-être', 3],
    ['Beauté', 1],
    ['Boisson', 1],
    ['Nutrition', 2],
    ['Accessoire', 1],
  ]);
  const solRes = mock(
    ['categorie', 'COUNT(*)'],
    [
      ['Bien-être', 3],
      ['Nutrition', 2],
    ]
  );
  const msg = exoFailDiag(sql, SOL_HAVING, userRes, solRes);
  assertIncludes(msg, 'HAVING', 'HAVING manquant (trop de lignes)');
}

console.log('\n=== exoFailDiag — cas génériques ===');
{
  const msg = exoFailDiag('SELECT 1', 'SELECT 1 WHERE id=99', mock(['x'], []), mock(['x'], [[1]]));
  assertIncludes(msg, 'Aucune ligne', '0 ligne');
}

{
  const msg = exoFailDiag(
    'SELECT nom FROM clients',
    'SELECT nom FROM clients WHERE ville = "Paris"',
    mock(['nom'], [['a'], ['b'], ['c']]),
    mock(['nom'], [['a'], ['b']])
  );
  assertIncludes(msg, 'WHERE', 'WHERE manquant');
}

{
  const msg = exoFailDiag(
    'SELECT nom, age FROM clients',
    'SELECT nom FROM clients',
    mock(['nom', 'age'], [['a', 1]]),
    mock(['nom'], [['a']])
  );
  assertIncludes(msg, 'correspond pas', 'cols différentes → message générique');
  assertNotIncludes(msg, 'on attend', 'ne révèle pas les colonnes attendues');
}

{
  const msg = exoFailDiag(
    'SELECT ville FROM clients GROUP BY ville',
    'SELECT ville, COUNT(*) FROM clients GROUP BY ville',
    mock(['ville'], [['Paris'], ['Lyon']]),
    mock(['ville', 'COUNT(*)'], [['Paris', 3], ['Lyon', 2]])
  );
  assertIncludes(msg, 'correspond pas', 'cols différentes → message générique');
  assertNotIncludes(msg, 'COUNT', 'ne révèle pas la colonne attendue');
}

console.log('\n=== exoFailDiag — diff de résultat (sans révéler les valeurs) ===');
{
  const sql =
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 1;';
  const userRes = mock(['categorie', 'COUNT(*)'], [
    ['Bien-être', 3],
    ['Beauté', 1],
    ['Boisson', 1],
    ['Nutrition', 2],
    ['Accessoire', 1],
  ]);
  const solRes = mock(
    ['categorie', 'COUNT(*)'],
    [
      ['Bien-être', 3],
      ['Nutrition', 2],
    ]
  );
  const msg = exoFailDiag(sql, SOL_HAVING, userRes, solRes, false);
  assertIncludes(msg, 'correspond pas', 'message générique');
  assertNotIncludes(msg, 'Beauté', 'ne révèle pas une ligne en trop');
  assertNotIncludes(msg, 'Nutrition', 'ne révèle pas une ligne manquante');
  assertNotIncludes(msg, 'en trop', 'pas d’indice sur les lignes');
  assertNotIncludes(msg, 'ligne', 'pas de compte de lignes');
}
{
  const sql =
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 4;';
  const userRes = mock(['categorie', 'COUNT(*)'], []);
  const solRes = mock(
    ['categorie', 'COUNT(*)'],
    [
      ['Bien-être', 3],
      ['Nutrition', 2],
    ]
  );
  const msg = exoFailDiag(sql, SOL_HAVING, userRes, solRes, false);
  assertIncludes(msg, 'Aucune ligne', '0 ligne → message dédié');
  assertNotIncludes(msg, 'restrictive', 'ne présume pas d’une condition trop restrictive');
}
{
  const solRes = mock(['nom'], [['Sophie'], ['Lucas'], ['Emma']]);
  const userRes = mock(['nom'], [['Sophie'], ['Emma'], ['Léa']]);
  const msg = exoFailDiag(
    'SELECT nom FROM clients ORDER BY nom;',
    'SELECT nom FROM clients ORDER BY nom;',
    userRes,
    solRes,
    true
  );
  assertIncludes(msg, 'correspond pas', 'ordered: message générique sans révéler');
  assertNotIncludes(msg, 'Lucas', 'ne révèle pas la valeur attendue');
  assertNotIncludes(msg, 'Léa', 'ne révèle pas la valeur en trop');
}

console.log('\n=== exoFailDiag — leçon villes (pas « produits ») ===');
const SOL_VILLES =
  'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville HAVING COUNT(*) >= 2;';
{
  const sql =
    'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville HAVING COUNT(*) >= 3;';
  const msg = exoFailDiag(
    sql,
    SOL_VILLES,
    mock(['ville', 'nb'], [['Paris', 3]]),
    mock(
      ['ville', 'nb'],
      [
        ['Paris', 3],
        ['Lyon', 2],
      ]
    )
  );
  assertIncludes(msg, 'exclut', 'seuil strict villes');
  assertNotIncludes(msg, 'produits', 'pas de « produits » sur leçon villes');
  assertNotIncludes(msg, 'ligne', 'pas de compte de lignes');
}

console.log('\n=== exoFailDiag — pas de formulation « manque » ===');
{
  const cases = [
    ['SELECT categorie, COUNT(*) FROM produits;', SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',8]]), mock(['categorie','COUNT(*)'],[['Bien-être',3],['Nutrition',2]])],
    ['SELECT categorie, COUNT(*) FROM produits GROUP BY categorie;', SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',3],['Beauté',1]]), mock(['categorie','COUNT(*)'],[['Bien-être',3],['Nutrition',2]])],
    ['SELECT nom FROM clients', 'SELECT nom FROM clients WHERE ville="Paris"', mock(['nom'],[['a'],['b'],['c']]), mock(['nom'],[['a'],['b']])],
    ['SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 1;', SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',3],['Beauté',1],['Nutrition',2]]), mock(['categorie','COUNT(*)'],[['Bien-être',3],['Nutrition',2]])],
  ];
  for (const [sql, sol, u, s] of cases) {
    const msg = exoFailDiag(sql, sol, u, s, false);
    assert(!/manque/i.test(msg), `pas de « manque » pour: ${sql.slice(0,40)}…`, msg);
  }
}

console.log('\n=== Intégration SQL (sqlite3) — leçon HAVING ===');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)[1];
const pyPath = path.join(ROOT, 'tests', '_sql_having_check.py');
fs.writeFileSync(
  pyPath,
  `import sqlite3, json, sys
schema = open(sys.argv[1]).read()
conn = sqlite3.connect(":memory:")
conn.executescript(schema)

def run(q):
    cur = conn.execute(q)
    cols = [d[0] for d in cur.description]
    return {"columns": cols, "values": [list(r) for r in cur.fetchall()]}

tests = [
  "SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 2;",
  "SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 3;",
  "SELECT categorie, COUNT(*) FROM produits GROUP BY categorie;",
]
out = [run(q) for q in tests]
print(json.dumps({"results": out, "counts": [len(r["values"]) for r in out]}))
`
);
const schemaPath = path.join(ROOT, 'tests', '_schema.sql');
fs.writeFileSync(schemaPath, schema);
const sqlOut = execSync(`python3 "${pyPath}" "${schemaPath}"`, { encoding: 'utf8' });
fs.unlinkSync(pyPath);
fs.unlinkSync(schemaPath);
const { results, counts } = JSON.parse(sqlOut);

assert(counts[0] === 2, 'SQL >= 2 → 2 lignes');
assert(counts[1] === 1, 'SQL >= 3 → 1 ligne');
assert(counts[2] === 5, 'SQL sans HAVING → 5 groupes');

const okCorrect =
  normalize([results[0]], false) === normalize([results[0]], false);
assert(okCorrect, 'normalize identique pour même résultat');

const okFail =
  normalize([results[1]], false) !== normalize([results[0]], false);
assert(okFail, 'normalize différencie >= 3 vs >= 2');

const diagReal = exoFailDiag(
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 3;',
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 2;',
  [results[1]],
  [results[0]]
);
assertIncludes(diagReal, 'exclut', 'diag cohérent avec résultats SQL réels');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
