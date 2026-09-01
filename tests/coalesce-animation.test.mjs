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

console.log('\n=== Animation COALESCE ===');
const blockStart = html.indexOf("coalesce:{kind:'er'");
const blockEnd = html.indexOf("\n  like:", blockStart);
const source = blockStart >= 0 && blockEnd > blockStart ? html.slice(blockStart, blockEnd) : '';
assert(Boolean(source), 'configuration localisée');
assert((source.match(/\{k:'/g) || []).length === 4, '4 étapes pédagogiques distinctes');
assert(source.includes("k:'Lire la colonne email'"), 'les valeurs stockées sont montrées en premier');
assert(source.includes("k:'Garder la première valeur'"), 'l’arrêt sur une valeur présente est expliqué');
assert(source.includes("k:'Passer à la suivante'"), 'le passage après NULL est expliqué');
assert(source.includes("k:'Afficher sans modifier'"), 'la différence entre affichage et UPDATE est visible');
assert(source.includes('sophie@mail.fr') && source.includes('is-picked'), 'le cas email présent est matérialisé');
assert(source.includes('Hugo') && source.includes('Inès') && source.includes('Non renseigné'), 'les deux emails NULL utilisent le texte de secours');
assert(source.includes('Première valeur non NULL trouvée'), 'la lecture s’arrête explicitement au premier résultat');
assert(source.includes("joinMore(6,'clients')"), 'les clients non affichés sont signalés par une ellipse');
assert(html.includes("coalesce:'Résultat final · 10 contacts'"), 'le résultat final annonce son cardinal');
assert(html.includes('function syncCoalesceA11y'), 'les scènes masquées sont retirées de l’arbre accessible');
assert(html.includes('viz:"coalesce"'), 'la visualisation est reliée à la leçon COALESCE');

console.log('\n=== Résultats SQL COALESCE ===');
const schema = html.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1] || '';
const py = String.raw`
import json, sqlite3, sys
conn = sqlite3.connect(':memory:')
conn.executescript(sys.stdin.read())
before = conn.execute('SELECT nom, email FROM clients ORDER BY id').fetchall()
rows = conn.execute('''
SELECT nom, COALESCE(email, 'Non renseigné') AS contact
FROM clients
ORDER BY id
''').fetchall()
after = conn.execute('SELECT nom, email FROM clients ORDER BY id').fetchall()
print(json.dumps({'before': before, 'rows': rows, 'after': after}, ensure_ascii=False))
`;
const sql = spawnSync('python3', ['-c', py], { input: schema, encoding: 'utf8' });
assert(sql.status === 0, 'requête exécutable sur la base du cours');
const result = sql.status === 0 ? JSON.parse(sql.stdout) : {};
assert(result.rows?.length === 10, 'COALESCE retourne exactement les 10 clients');
assert(result.rows?.[0]?.[1] === 'sophie@mail.fr', 'Sophie conserve son email');
assert(result.rows?.[5]?.[1]?.startsWith('Non renseign'), 'Hugo reçoit le texte de secours');
assert(result.rows?.[8]?.[1]?.startsWith('Non renseign'), 'Inès reçoit le texte de secours');
assert(result.before?.filter(row => row[1] === null).length === 2, 'la table contient bien 2 emails NULL');
assert(JSON.stringify(result.before) === JSON.stringify(result.after), 'le SELECT ne modifie aucune valeur stockée');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
