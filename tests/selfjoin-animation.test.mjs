#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
  }
}

console.log('\n=== Animation SELF JOIN ===');
const blockStart = html.indexOf("selfjoin:{kind:'er'");
const blockEnd = html.indexOf("\n  joingroupby:", blockStart);
const source = blockStart >= 0 && blockEnd > blockStart ? html.slice(blockStart, blockEnd) : '';
assert(Boolean(source), 'configuration localisée');
assert((source.match(/\{k:'/g) || []).length === 4, '4 étapes pédagogiques');
assert(source.includes("sql:'FROM clients'"), 'étape table source');
assert(source.includes('JOIN clients c2'), 'étape des deux alias');
assert(source.includes('ON c1.ville = c2.ville'), 'étape de correspondance par ville');
assert(source.includes('AND c1.id < c2.id'), 'étape de suppression des doublons');
assert(source.includes('24 associations candidates'), 'erreurs intermédiaires expliquées');
assert(source.includes('21 autres associations candidates'), 'échantillon incomplet signalé par une ellipse');
assert(source.includes('rôle · premier client') && source.includes('rôle · second client'), 'rôle de chaque alias explicite');
assert(source.includes('Résultat final · 7 paires uniques') || html.includes("selfjoin:'Résultat final · 7 paires uniques'"), 'résultat final annoncé');
assert(html.includes('function syncSelfJoinA11y'), 'étapes masquées retirées de la navigation clavier');

console.log('\n=== Résultats SQL SELF JOIN ===');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
const py = String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
candidate = conn.execute('''
SELECT c1.id, c2.id, c1.nom, c2.nom, c1.ville
FROM clients c1 JOIN clients c2
ON c1.ville = c2.ville
''').fetchall()
final = conn.execute('''
SELECT c1.id, c2.id, c1.nom, c2.nom, c1.ville
FROM clients c1 JOIN clients c2
ON c1.ville = c2.ville AND c1.id < c2.id
''').fetchall()
print(json.dumps({'candidate': len(candidate), 'final': len(final), 'rows': final}, ensure_ascii=False))
`;
const sql = spawnSync('python3', ['-c', py], { input: schema, encoding: 'utf8' });
assert(sql.status === 0, 'requêtes exécutables sur la base du cours');
const result = sql.status === 0 ? JSON.parse(sql.stdout) : {};
assert(result.candidate === 24, 'ville seule → 24 associations');
assert(result.final === 7, 'garde sur les identifiants → 7 paires');
assert(result.rows?.some(row => row[2] === 'Sophie' && row[3] === 'Nathan'), 'Sophie / Nathan est conservée');
assert(!result.rows?.some(row => row[0] === row[1]), 'aucune auto-paire dans le résultat');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
