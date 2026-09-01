#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
const executions = 10_001;

if (!schema) {
  console.error('Impossible de localiser SCHEMA_SQL.');
  process.exit(1);
}

const script = `
import sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
query = "SELECT id, nom, ville FROM clients WHERE ville = 'Paris' ORDER BY id;"
for _ in range(${executions}):
  rows = conn.execute(query).fetchall()
  if [row[0] for row in rows] != [1, 4, 7, 10] or any(row[2] != 'Paris' for row in rows):
        raise SystemExit('résultat SQL instable')
print(${executions})
`;
const result = spawnSync('python', ['-c', script], {
  input: schema,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024,
});

console.log('\n=== Preuve de robustesse onboarding ===');
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'Le test SQL a échoué.');
  process.exit(1);
}
if (result.stdout.trim() !== String(executions)) {
  console.error(`Nombre d’exécutions inattendu : ${result.stdout.trim()}`);
  process.exit(1);
}
console.log(`  ✓ ${executions.toLocaleString('fr-FR')} exécutions stables de la requête guidée`);
console.log('\n=== Résultat: 1 passé, 0 échoué ===\n');
