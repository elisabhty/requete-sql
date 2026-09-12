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
const guideEnd = html.indexOf('function conversionFunctionStageHtml', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';
const studioStart = html.indexOf('function renderConversionFunctionsStudio');
const studioEnd = html.indexOf('function initConversionFunctions', studioStart);
const studio = studioStart >= 0 && studioEnd > studioStart ? html.slice(studioStart, studioEnd) : '';

assert(Boolean(guides), 'guide de conversion interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 6, '6 conversions courantes dans le mini-laboratoire');
assert(guides.includes("k:'integer'") && guides.includes("CAST('34' AS INTEGER)"), 'texte vers entier');
assert(guides.includes("k:'decimal'") && guides.includes("DECIMAL(10,2)"), 'texte vers décimal');
assert(guides.includes("k:'text'") && guides.includes('CAST(34 AS VARCHAR(10))'), 'nombre vers texte');
assert(guides.includes("k:'date'") && guides.includes("SELECT CAST('2026-09-12' AS DATE)") && !guides.includes("date('2026-09-12')") && !guides.includes('12 septembre'), 'texte vers date montré avec CAST, sans date() SQLite');
assert(guides.includes("k:'datetime'") && guides.includes("CAST('2026-09-12 18:45:27' AS DATE)"), 'date + heure vers date avec CAST');
assert(guides.includes("k:'intdec'") && guides.includes('CAST(7 AS DECIMAL(10,2))'), 'entier vers décimal');
assert(!guides.includes('sqliteSql') && !guides.includes("k:'precision'") && !guides.includes("k:'invalid'"), 'CAST partout, sans variante SQLite dans le laboratoire');
assert(!html.includes('const CONVERSION_DECISIONS='), 'ancien laboratoire de décisions retiré');
assert(html.includes('function renderConversionFunctionsStudio'), 'rendu dédié à la leçon 54');
assert(html.includes('if(l.id===54)return renderConversionFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(studio.includes('La donnée n’a pas toujours le bon type') && studio.includes('cf-types') && studio.includes('<code>age</code>') && studio.includes("'34'"), 'situation recentrée sur le type reçu');
assert(studio.includes('Comment demander à SQL de transformer une valeur d’un type vers un autre ?'), 'question d’ouverture recentrée sur CAST');
assert(studio.includes('CAST(expression AS type)') && studio.includes('CAST(valeur AS type)') && studio.includes("SELECT CAST('34' AS INTEGER);"), 'CAST présenté comme cœur de la leçon, puis comme structure du laboratoire');
assert(html.includes('Ce qui se passe') && html.includes('function conversionMachineHtml'), 'chaque conversion montre le passage de type');
assert(studio.includes('Même principe, syntaxe parfois différente') && studio.includes('TRY_CAST()') && studio.includes('fonctions dédiées'), 'particularités SGBD seulement annoncées après CAST');
assert(studio.includes('Convertir ne veut pas dire formater') && studio.includes('TO_CHAR()') && studio.includes('DATE_FORMAT()'), 'conversion distinguée du formatage');
assert(studio.includes("CAST('29.956' AS DECIMAL(10,2))") && studio.includes('précision totale'), 'DECIMAL(10,2) expliqué');
assert(studio.includes('évite de compter inutilement sur une conversion automatique'), 'conversion explicite présentée sans règle absolue');
assert(studio.includes('TRY_CAST()') && studio.includes("'42'::INTEGER") && studio.includes('fonctions date()*'), 'variantes SGBD regroupées à part');
assert(studio.includes('CAST(ROUND(prix) AS INTEGER)') && studio.includes('de l’intérieur vers l’extérieur'), 'fonctions imbriquées');
assert(studio.includes('Les erreurs fréquentes avec CAST()') && studio.includes('cf-trap-list') && studio.includes("CAST('bonjour' AS INTEGER)") && studio.includes('CAST(NULL AS INTEGER)') && studio.includes('29,90') && studio.includes('ROUND(3.99)') && studio.includes("id = CAST('4' AS INTEGER)"), 'un seul cadre piège avec les erreurs courantes');
assert(!studio.includes('Une conversion n’est pas toujours possible') && !studio.includes('Attention dans WHERE et JOIN') && !studio.includes('Le point décimal') && !studio.includes('NULL reste un cas particulier') && !studio.includes('h2-txt">Convertir n’est pas arrondir'), 'anciens cadres piège complets retirés');
assert(studio.includes('Convertir change le type de la valeur. Formater change sa présentation.'), 'réflexe final conversion / formatage');
assert(!studio.includes('Trois vérifications avant CAST'), 'ancien piège documentaire retiré');
assert(html.includes('function initConversionFunctions'), 'micro-interactions initialisées');
assert(html.includes('aria-label="Conversions courantes entre types"') && html.includes('aria-live="polite"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('cfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('nf-machine-arrow') && html.includes('.conversion-functions-page .nf-machine{flex-direction:column'), 'schéma CAST empilé sur petit écran');
assert(html.includes('initConversionFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54"), 'récapitulatifs redondants retirés de cette page');
assert(html.includes('const hideLessonLab=l.id===52||l.id===54'), 'console Teste redondante masquée');
assert(!html.slice(html.indexOf('function conversionFunctionStageHtml'), html.indexOf('function renderConversionFunctionsStudio')).includes('g.note'), 'notes sous les requêtes du mini-laboratoire retirées');
assert(serviceWorker.includes('requete-2026-09-12-cf-trap-card-v666'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
