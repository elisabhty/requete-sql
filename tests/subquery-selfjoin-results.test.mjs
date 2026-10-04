#!/usr/bin/env node
/* Résultats chiffrés annoncés dans les cours « sous-requêtes » et « auto-jointure » :
   chaque requête est rejouée sur la base du cours (schéma lu dans index.html). */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
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

/* Exécute un script Python (sqlite3) sur la base du cours et renvoie l'objet JSON qu'il affiche. */
function rejouer(py) {
  const run = spawnSync('python3', ['-c', py], { input: schema, encoding: 'utf8' });
  assert(run.status === 0, 'requêtes exécutables sur la base du cours');
  return run.status === 0 ? JSON.parse(run.stdout) : {};
}

console.log('\n=== SELF JOIN ===');
{
  const result = rejouer(String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
candidate = conn.execute('''
SELECT c1.id, c2.id, c1.prenom, c2.prenom, c1.ville
FROM clients c1 JOIN clients c2
ON c1.ville = c2.ville
''').fetchall()
final = conn.execute('''
SELECT c1.id, c2.id, c1.prenom, c2.prenom, c1.ville
FROM clients c1 JOIN clients c2
ON c1.ville = c2.ville AND c1.id < c2.id
''').fetchall()
print(json.dumps({'candidate': len(candidate), 'final': len(final), 'rows': final}, ensure_ascii=False))
`);
  assert(result.candidate === 24, 'ville seule → 24 associations');
  assert(result.final === 7, 'garde sur les identifiants → 7 paires');
  assert(result.rows?.some(row => row[2] === 'Sophie' && row[3] === 'Nathan'), 'Sophie / Nathan est conservée');
  assert(!result.rows?.some(row => row[0] === row[1]), 'aucune auto-paire dans le résultat');
}

console.log('\n=== Sous-requête dans FROM ===');
{
  const result = rejouer(String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
amounts = conn.execute('''
SELECT commandes.id, produits.prix * commandes.quantite AS montant
FROM commandes
JOIN produits ON commandes.produit_id = produits.id
ORDER BY commandes.id
''').fetchall()
average = conn.execute('''
SELECT AVG(montant)
FROM (
  SELECT produits.prix * commandes.quantite AS montant
  FROM commandes
  JOIN produits ON commandes.produit_id = produits.id
) AS commandes_montants
''').fetchone()[0]
print(json.dumps({'amounts': amounts, 'sum': sum(row[1] for row in amounts), 'average': average}, ensure_ascii=False))
`);
  assert(result.amounts?.length === 16, 'la sous-requête produit exactement 16 montants');
  assert(Math.abs(result.amounts?.[0]?.[1] - 59.8) < 1e-9, 'la commande #1 produit 59,80');
  assert(Math.abs(result.amounts?.[11]?.[1] - 39.9) < 1e-9, 'la commande #12 produit 39,90');
  assert(Math.abs(result.sum - 747.5) < 1e-9, 'les 16 montants totalisent 747,50');
  assert(Math.abs(result.average - 46.71875) < 1e-9, 'AVG retourne exactement 46,71875');
}

console.log('\n=== Sous-requête IN ===');
{
  const result = rejouer(String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
ids = [row[0] for row in conn.execute('''
SELECT commandes.client_id
FROM commandes
WHERE commandes.produit_id = 1
''')]
rows = conn.execute('''
SELECT clients.prenom
FROM clients
WHERE clients.id IN (
  SELECT commandes.client_id
  FROM commandes
  WHERE commandes.produit_id = 1
)
ORDER BY clients.id
''').fetchall()
print(json.dumps({'ids': ids, 'names': [row[0] for row in rows]}, ensure_ascii=False))
`);
  assert(JSON.stringify(result.ids) === JSON.stringify([1, 4, 7, 5]), 'la sous-requête produit 1, 4, 7, 5');
  assert(JSON.stringify(result.names) === JSON.stringify(['Sophie', 'Nathan', 'Chloé', 'Léa']), 'IN retourne exactement les 4 clients annoncés');
}

console.log('\n=== Sous-requête NOT IN ===');
{
  const result = rejouer(String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
ids = sorted({row[0] for row in conn.execute('''
SELECT commandes.client_id
FROM commandes
WHERE commandes.client_id IS NOT NULL
''')})
rows = conn.execute('''
SELECT clients.prenom
FROM clients
WHERE clients.id NOT IN (
  SELECT commandes.client_id
  FROM commandes
  WHERE commandes.client_id IS NOT NULL
)
ORDER BY clients.id
''').fetchall()
print(json.dumps({'ids': ids, 'names': [row[0] for row in rows]}, ensure_ascii=False))
`);
  assert(JSON.stringify(result.ids) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), 'la sous-requête produit 1 à 8');
  assert(JSON.stringify(result.names) === JSON.stringify(['Inès', 'Nathan']), 'NOT IN retourne Inès et Nathan');
}

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
