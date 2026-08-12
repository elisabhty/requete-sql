#!/usr/bin/env node
/**
 * Tests diagnostics exercices (exoFailDiag, errBox) + validation SQL leçon HAVING.
 * Usage: node tests/exo-diag.test.mjs
 *
 * Règle clé : le feedback ne doit JAMAIS révéler la solution ni orienter vers elle
 * (pas de seuil attendu, pas de nom de ligne/colonne attendu, pas de clause à ajouter).
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

const errStart = html.indexOf('function errBox');
const errEnd = html.indexOf('const RUN_ICO');
if (errStart < 0 || errEnd < 0) {
  console.error('Impossible de localiser errBox dans index.html');
  process.exit(1);
}

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  `function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}\n` +
  html.slice(blockStart, blockEnd),
  ctx
);
vm.runInContext(
  `let db=null; const listTables=()=>[]; const activeDb=()=>null;\n` +
  html.slice(errStart, errEnd),
  ctx
);

const { exoFailDiag, errBox, normalize, fmtLignes } = ctx;
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

console.log('\n=== fmtLignes ===');
assert(fmtLignes(1) === '1 ligne', 'singulier');
assert(fmtLignes(2) === '2 lignes', 'pluriel');

console.log('\n=== exoFailDiag — neutre, sans indice ===');
const SOL_HAVING =
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 2;';
const solRes2 = mock(
  ['categorie', 'COUNT(*)'],
  [
    ['Bien-être', 3],
    ['Nutrition', 2],
  ]
);

const diagCases = [
  ['seuil trop strict',
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 3;',
    SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',3]]), solRes2],
  ['seuil trop large',
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 1;',
    SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',3],['Beauté',1],['Nutrition',2]]), solRes2],
  ['GROUP BY absent',
    'SELECT categorie, COUNT(*) FROM produits;',
    SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',8]]), solRes2],
  ['HAVING absent',
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie;',
    SOL_HAVING, mock(['categorie','COUNT(*)'],[['Bien-être',3],['Beauté',1],['Boisson',1],['Nutrition',2],['Accessoire',1]]), solRes2],
  ['WHERE absent',
    'SELECT nom FROM clients',
    'SELECT nom FROM clients WHERE ville = "Paris";',
    mock(['nom'],[['a'],['b'],['c']]), mock(['nom'],[['a'],['b']])],
  ['colonnes différentes',
    'SELECT nom, age FROM clients',
    'SELECT nom FROM clients;',
    mock(['nom','age'],[['a',1]]), mock(['nom'],[['a']])],
  ['mauvais ordre (ordered)',
    'SELECT nom FROM clients ORDER BY nom;',
    'SELECT nom FROM clients ORDER BY nom;',
    mock(['nom'],[['Sophie'],['Emma'],['Léa']]), mock(['nom'],[['Sophie'],['Lucas'],['Emma']])],
];

for (const [name, sql, sol, u, s] of diagCases) {
  const msg = exoFailDiag(sql, sol, u, s);
  assertIncludes(msg, 'correspond pas', `${name} → message générique`);
  assertNotIncludes(msg, 'GROUP BY', `${name} → ne nomme pas la clause`);
  assertNotIncludes(msg, 'HAVING', `${name} → ne nomme pas la clause`);
  assertNotIncludes(msg, 'WHERE', `${name} → ne nomme pas la clause`);
  assertNotIncludes(msg, 'essaie', `${name} → pas d'instruction`);
  assertNotIncludes(msg, 'Bien-être', `${name} → pas de valeur`);
  assertNotIncludes(msg, 'Nutrition', `${name} → pas de valeur`);
  assertNotIncludes(msg, 'Lucas', `${name} → pas de valeur`);
  assert(!/manque/i.test(msg), `${name} → pas de « manque »`);
}

console.log('\n=== exoFailDiag — 0 ligne ===');
{
  const msg = exoFailDiag(
    'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 4;',
    SOL_HAVING,
    mock(['categorie', 'COUNT(*)'], []),
    solRes2
  );
  assertIncludes(msg, 'Aucune ligne', '0 ligne → message dédié');
  assertNotIncludes(msg, 'restrictive', 'ne présume pas d’une condition trop restrictive');
  assertNotIncludes(msg, 'HAVING', 'ne nomme pas la clause');
}

console.log('\n=== errBox — aides sans indice ===');
{
  const msg = errBox('no such column: villee');
  assertIncludes(msg, 'Erreur SQL', 'colonne inconnue → Erreur SQL');
  assertIncludes(msg, "'texte'", 'exemple de texte neutre');
  assertNotIncludes(msg, 'Paris', 'pas de valeur des données');
}
{
  const msg = errBox('syntax error near "SELCT"');
  assertIncludes(msg, 'Erreur SQL', 'syntax error → Erreur SQL');
  assert(!/manque/i.test(msg), 'pas de « il manque »');
}
{
  const msg = errBox('misuse of aggregate: COUNT()');
  assertIncludes(msg, 'Erreur SQL', 'misuse aggregate → Erreur SQL');
  assertIncludes(msg, 'agrégation', 'explique la règle');
  assertNotIncludes(msg, 'HAVING', 'ne nomme pas HAVING');
}
{
  const msg = errBox('ambiguous column name: nom');
  assertIncludes(msg, 'Erreur SQL', 'ambiguous → Erreur SQL');
  assertNotIncludes(msg, 'clients.nom', 'pas de préfixe précis');
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

const okFail =
  normalize([results[1]], false) !== normalize([results[0]], false);
assert(okFail, 'normalize différencie >= 3 vs >= 2');

const okOrdered =
  normalize([{ columns: ['a'], values: [[1], [2]] }], true) !==
  normalize([{ columns: ['a'], values: [[2], [1]] }], true);
assert(okOrdered, 'normalize ordered est sensible à l’ordre');

const okUnordered =
  normalize([{ columns: ['a'], values: [[1], [2]] }], false) ===
  normalize([{ columns: ['a'], values: [[2], [1]] }], false);
assert(okUnordered, 'normalize unordered ignore l’ordre');

const diagReal = exoFailDiag(
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 3;',
  'SELECT categorie, COUNT(*) FROM produits GROUP BY categorie HAVING COUNT(*) >= 2;',
  [results[1]],
  [results[0]]
);
assertIncludes(diagReal, 'correspond pas', 'diag générique avec résultats SQL réels');
assertNotIncludes(diagReal, 'Nutrition', 'ne révèle pas la valeur réelle');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
