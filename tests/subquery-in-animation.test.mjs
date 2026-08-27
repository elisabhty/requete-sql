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

console.log('\n=== Animation sous-requête IN ===');
const blockStart = html.indexOf("subquery_in:{kind:'er'");
const blockEnd = html.indexOf("\n  subquery_notin:", blockStart);
const source = blockStart >= 0 && blockEnd > blockStart ? html.slice(blockStart, blockEnd) : '';
assert(Boolean(source), 'configuration localisée');
assert((source.match(/\{k:'/g) || []).length === 4, '4 étapes pédagogiques distinctes');
assert(source.includes("k:'Filtrer les commandes'"), 'la requête interne est exécutée en premier');
assert(source.includes("k:'Fabriquer la liste'"), 'la transformation en liste est visible');
assert(source.includes("k:'Tester chaque client'"), 'IN est expliqué comme un test par client');
assert(source.includes("k:'Afficher les présents'"), 'le résultat final est une étape dédiée');
assert(source.includes('1 colonne') && source.toLowerCase().includes('une seule colonne'), 'la contrainte d’une colonne est explicite');
assert(source.includes('1, 4, 7, 5'), 'la liste respecte l’ordre produit par les commandes');
assert(source.includes("joinMore(11,'commandes')"), 'les commandes non affichées sont signalées par une ellipse');
assert(source.includes("joinMore(3,'clients')"), 'les clients non affichés sont signalés par une ellipse');
assert(html.includes("subquery_in:'Résultat final · 4 clients'"), 'le résultat final annonce son cardinal');
assert(html.includes('function syncSubqueryInA11y'), 'les étapes masquées sont retirées de la navigation clavier');

console.log('\n=== Résultats SQL sous-requête IN ===');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
const py = String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
ids = [row[0] for row in conn.execute('''
SELECT commandes.client_id
FROM commandes
WHERE commandes.produit_id = 1
''')]
rows = conn.execute('''
SELECT clients.nom
FROM clients
WHERE clients.id IN (
  SELECT commandes.client_id
  FROM commandes
  WHERE commandes.produit_id = 1
)
ORDER BY clients.id
''').fetchall()
print(json.dumps({'ids': ids, 'names': [row[0] for row in rows]}, ensure_ascii=False))
`;
const sql = spawnSync('python3', ['-c', py], { input: schema, encoding: 'utf8' });
assert(sql.status === 0, 'requête exécutable sur la base du cours');
const result = sql.status === 0 ? JSON.parse(sql.stdout) : {};
assert(JSON.stringify(result.ids) === JSON.stringify([1, 4, 7, 5]), 'la sous-requête produit 1, 4, 7, 5');
assert(JSON.stringify(result.names) === JSON.stringify(['Sophie', 'Nathan', 'Chloé', 'Léa']), 'IN retourne exactement les 4 clients annoncés');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
