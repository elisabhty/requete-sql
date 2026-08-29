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

console.log('\n=== Page Fonctions de dates et heures ===');
const guideStart = html.indexOf('const DATE_FUNCTION_GUIDES=');
const guideEnd = html.indexOf('const DATE_DIALECTS=', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';
const dialectStart = guideEnd;
const dialectEnd = html.indexOf('function dateFunctionStageHtml', dialectStart);
const dialects = dialectStart >= 0 && dialectEnd > dialectStart ? html.slice(dialectStart, dialectEnd) : '';

assert(Boolean(guides), 'guide temporel interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 6, '6 intentions plutôt que 13 longs chapitres');
assert(guides.includes("k:'now'") && guides.includes('CURRENT_TIMESTAMP'), 'date et heure actuelles disponibles');
assert(guides.includes("k:'extract'") && guides.includes('strftime'), 'extraction d’une partie disponible');
assert(guides.includes("k:'format'") && guides.includes('%d/%m/%Y'), 'formatage avant/après disponible');
assert(guides.includes("k:'shift'") && guides.includes("'+5 days'"), 'décalage sur une ligne du temps disponible');
assert(guides.includes("k:'duration'") && guides.includes('julianday'), 'durée entre deux dates disponible');
assert(guides.includes("k:'period'") && guides.includes("date_commande < '2023-08-01'"), 'période à borne droite exclue disponible');
assert((dialects.match(/\{k:'/g) || []).length === 4, '4 syntaxes SGBD comparables sans tableau dense');
assert(dialects.includes("k:'sqlite'") && dialects.includes("date(date_commande, '+7 days')"), 'SQLite présenté en premier car utilisé dans l’application');
assert(dialects.includes("k:'mysql'") && dialects.includes('DATE_ADD'), 'équivalent MySQL présent');
assert(dialects.includes("k:'postgres'") && dialects.includes("INTERVAL '7 days'"), 'équivalent PostgreSQL présent');
assert(dialects.includes("k:'sqlserver'") && dialects.includes('DATEADD'), 'équivalent SQL Server présent');
assert(html.includes('function renderDateFunctionsStudio'), 'rendu dédié à la leçon 53');
assert(html.includes('if(l.id===53)return renderDateFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(html.includes('df-anatomy') && html.includes('année</small>') && html.includes('seconde</small>'), 'date et heure décomposées visuellement');
assert(html.includes('function initDateFunctions'), 'micro-interactions initialisées');
assert(html.includes('aria-live="polite"') && html.includes('Actions possibles sur une date'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('dfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initDateFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54") && html.includes("compactFunctionLesson?'':reflexBlock(l)"), 'récapitulatifs redondants retirés de cette page');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
