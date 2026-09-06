#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
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

console.log('\n=== Page Fonctions de conversion de types ===');
const guideStart = html.indexOf('const CONVERSION_FUNCTION_GUIDES=');
const guideEnd = html.indexOf('const CONVERSION_DECISIONS=', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';
const decisionStart = guideEnd;
const decisionEnd = html.indexOf('function conversionFunctionStageHtml', decisionStart);
const decisions = decisionStart >= 0 && decisionEnd > decisionStart ? html.slice(decisionStart, decisionEnd) : '';

assert(Boolean(guides), 'guide de conversion interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 6, '6 transformations plutôt que 16 longs chapitres');
assert(guides.includes("k:'integer'") && guides.includes("CAST('50' AS INTEGER) + 10"), 'texte vers entier calculable');
assert(guides.includes("k:'decimal'") && guides.includes("DECIMAL(10,2)"), 'prix décimal préservé');
assert(guides.includes("k:'text'") && guides.includes('CAST(123 AS TEXT)'), 'nombre vers texte disponible');
assert(guides.includes("k:'date'") && guides.includes("date('2025-03-14')"), 'date ISO adaptée à SQLite');
assert(guides.includes("k:'precision'") && guides.includes('CAST(19.90 AS INTEGER)'), 'perte de précision matérialisée');
assert(guides.includes("k:'invalid'") && guides.includes("TRY_CAST('bonjour' AS INTEGER)"), 'conversion invalide anticipée');
assert((decisions.match(/\{k:'/g) || []).length === 3, '3 décisions avant de convertir');
assert(decisions.includes("k:'calculate'") && decisions.includes("CAST('5' AS INTEGER)"), 'conversion explicite privilégiée pour calculer');
assert(decisions.includes("k:'display'") && decisions.includes("strftime('%d/%m/%Y'"), 'formatage distingué de la conversion');
assert(decisions.includes("k:'filter'") && decisions.includes('prix = 19.90'), 'comparaison directe privilégiée dans WHERE');
assert(html.includes('function renderConversionFunctionsStudio'), 'rendu dédié à la leçon 54');
assert(html.includes('if(l.id===54)return renderConversionFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(html.includes('cf-twins') && html.includes('Valeur ≠ type'), 'valeur et type distingués visuellement');
assert(html.includes('cf-cast-rail') && html.includes('45 + 5'), 'transformation CAST montrée pas à pas');
assert(html.includes('function initConversionFunctions'), 'micro-interactions initialisées');
assert(html.includes('Conversions possibles entre types') && html.includes('aria-live="polite"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('cfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initConversionFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54"), 'récapitulatifs redondants retirés de cette page');
assert(html.includes('Trois vérifications avant CAST'), 'piège final raccourci et actionnable');
assert(serviceWorker.includes("requete-2026-09-06-onglets-lies-filtrer-v338"), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
