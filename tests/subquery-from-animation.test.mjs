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

console.log('\n=== Animation sous-requête dans FROM ===');
const blockStart = html.indexOf("subquery_from:{kind:'er'");
const blockEnd = html.indexOf("\n  security:", blockStart);
const source = blockStart >= 0 && blockEnd > blockStart ? html.slice(blockStart, blockEnd) : '';
assert(Boolean(source), 'configuration localisée');
assert((source.match(/\{k:'/g) || []).length === 4, '4 étapes pédagogiques distinctes');
assert(source.includes("k:'Relier les données'"), 'la jointure commandes-produits est exécutée en premier');
assert(source.includes("k:'Calculer les 16 montants'"), 'le calcul par commande est une étape dédiée');
assert(source.includes("k:'Créer la table dérivée'"), 'la création de la table dérivée est visible');
assert(source.includes("k:'Calculer la moyenne'"), 'la requête principale est la dernière étape');
assert(source.includes('commandes.produit_id = produits.id'), 'la clé de jointure est matérialisée');
assert(source.includes('29,90 × 2') && source.includes('59,80'), 'prix × quantité est montré avec une donnée réelle');
assert(source.includes('16 lignes · 1 colonne'), 'la forme de la table dérivée est explicite');
assert(source.includes('AS commandes_montants') && source.includes('alias est obligatoire'), 'le rôle obligatoire de l’alias est expliqué');
assert(source.includes('747,50 ÷ 16') && source.includes('46,72'), 'le calcul final de la moyenne est explicite');
assert(source.includes("joinMore(13,'commandes')"), 'les commandes non affichées sont signalées par une ellipse');
assert(source.includes("joinMore(5,'produits')"), 'les produits non affichés sont signalés par une ellipse');
assert(source.includes("joinMore(13,'montants')"), 'les montants non affichés sont signalés par une ellipse');
assert(html.includes("subquery_from:'Résultat final · moyenne des 16 montants'"), 'le résultat final annonce son périmètre');
assert(html.includes('function syncSubqueryFromA11y'), 'les scènes masquées sont retirées de la navigation clavier');

console.log('\n=== Résultats SQL sous-requête dans FROM ===');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
const py = String.raw`
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
`;
const sql = spawnSync('python3', ['-c', py], { input: schema, encoding: 'utf8' });
assert(sql.status === 0, 'requête exécutable sur la base du cours');
const result = sql.status === 0 ? JSON.parse(sql.stdout) : {};
assert(result.amounts?.length === 16, 'la sous-requête produit exactement 16 montants');
assert(Math.abs(result.amounts?.[0]?.[1] - 59.8) < 1e-9, 'la commande #1 produit 59,80');
assert(Math.abs(result.amounts?.[11]?.[1] - 39.9) < 1e-9, 'la commande #12 produit 39,90');
assert(Math.abs(result.sum - 747.5) < 1e-9, 'les 16 montants totalisent 747,50');
assert(Math.abs(result.average - 46.71875) < 1e-9, 'AVG retourne exactement 46,71875');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
