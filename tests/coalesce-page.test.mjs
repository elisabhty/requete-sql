#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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

console.log('\n=== Page COALESCE ===');
const start = html.indexOf('{ id:23, titre:"COALESCE"');
const end = html.indexOf('\n{ id:45,', start);
const lesson = start >= 0 && end > start ? html.slice(start, end) : '';

assert(Boolean(lesson), 'leçon COALESCE localisée');
assert(lesson.includes('coal-data-summary'), 'résumé des données présent dès la situation');
assert(lesson.includes('8 adresses présentes') && lesson.includes('2 valeurs NULL'), 'cardinalités visibles sans compter le tableau');
assert(lesson.includes('première valeur qui n’est pas NULL'), 'règle centrale formulée dans le titre');
assert(lesson.includes('coal-route') && lesson.includes('1er choix') && lesson.includes('choix suivant'), 'lecture de gauche à droite matérialisée');
assert(lesson.includes('L’e-mail n’est pas NULL') && lesson.includes('L’e-mail est NULL'), 'les deux branches sont comparables');
assert((lesson.match(/class="coal-use-row"/g) || []).length === 4, '4 usages courts et structurés');
assert(lesson.includes('Afficher un remplacement'), 'usage affichage conservé');
assert(lesson.includes('Choisir le premier contact'), 'usage multi-colonnes conservé');
assert(lesson.includes('Sécuriser un calcul'), 'usage calcul conservé');
assert(lesson.includes('Garantir un résultat'), 'usage sous-requête conservé');
assert(lesson.includes('sans modifier la table'), 'différence affichage / écriture annoncée tôt');
assert(lesson.includes('Quel équivalent selon le moteur ?'), 'comparatif final renommé selon le besoin utilisateur');
assert(html.includes("concept-page${l.id===23?' coalesce-page':''}"), 'styles limités à la page COALESCE');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('coalUseIn'), 'micro-interactions compatibles avec la réduction des animations');
assert(!lesson.includes('coalesce-uses'), 'ancienne pile répétitive supprimée');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
