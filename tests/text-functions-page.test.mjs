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

console.log('\n=== Page Fonctions de texte ===');
const guideStart = html.indexOf('const TEXT_FUNCTION_GUIDES=');
const guideEnd = html.indexOf('const TEXT_PIPE_STEPS=', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';

assert(Boolean(guides), 'guides interactifs localisés');
assert((guides.match(/\{k:'/g) || []).length === 6, '6 intentions plutôt qu’une longue liste de fonctions');
assert(guides.includes("k:'format'") && guides.includes('UPPER · LOWER'), 'mise en forme disponible');
assert(guides.includes("k:'clean'") && guides.includes('TRIM'), 'nettoyage disponible');
assert(guides.includes("k:'measure'") && guides.includes('LENGTH'), 'mesure disponible');
assert(guides.includes("k:'extract'") && guides.includes('INSTR · SUBSTR'), 'extraction disponible');
assert(guides.includes("k:'replace'") && guides.includes('REPLACE'), 'remplacement disponible');
assert(guides.includes("k:'join'") && guides.includes("LOWER(nom) || '-' || LOWER(ville)"), 'assemblage et exercice reliés');
assert(html.includes('function renderTextFunctionsStudio'), 'rendu dédié à la leçon 51');
assert(html.includes("if(l.id===51)return renderTextFunctionsStudio(l)"), 'ancienne pile de texte remplacée dans la page');
assert(html.includes('Une valeur entre, une nouvelle valeur sort.'), 'principe montré avant la syntaxe');
assert(html.includes('txt-demo') && html.includes('txt-transform'), 'avant/après visuels présents');
assert(html.includes('const TEXT_PIPE_STEPS=') && html.includes('de l’intérieur vers l’extérieur'), 'combinaison des fonctions expliquée par étapes');
assert(html.includes('function initTextFunctions'), 'micro-interactions initialisées');
assert(html.includes('aria-live="polite"') && html.includes('role="tablist"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('txtStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initTextFunctions();'), 'laboratoire activé au rendu du cours');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
