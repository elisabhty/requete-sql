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
assert(!guides.includes('sqliteSql') && !guides.includes("k:'precision'") && !guides.includes("k:'invalid'") && !guides.includes('live:false') && html.includes('function sqliteRunnableSql'), 'CAST partout, tous les onglets exécutables');
assert(!html.includes('const CONVERSION_DECISIONS='), 'ancien laboratoire de décisions retiré');
assert(html.includes('function renderConversionFunctionsStudio'), 'rendu dédié à la leçon 54');
assert(html.includes('if(l.id===54)return renderConversionFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(studio.includes('La donnée n’a pas toujours le bon type') && studio.includes('cf-types') && studio.includes('<code>age</code>') && studio.includes("'34'"), 'situation recentrée sur le type reçu');
assert(studio.includes('Comment demander à SQL de transformer une valeur d’un type vers un autre ?'), 'question d’ouverture recentrée sur CAST');
assert(studio.includes('CAST(expression AS type)') && studio.includes('CAST(valeur AS type)') && studio.includes("SELECT CAST('34' AS INTEGER);"), 'CAST présenté comme cœur de la leçon, puis comme structure du laboratoire');
assert(html.includes('Ce qui se passe') && html.includes('function conversionMachineHtml'), 'chaque conversion montre le passage de type');
assert(studio.includes('TRY_CAST()') && studio.includes('strftime()') && !studio.includes('Même principe, syntaxe parfois différente') && !studio.includes('C’est notamment utile lorsque des nombres provenant d’un import'), 'encadrés redondants du mini-laboratoire retirés');
assert(studio.includes('À ne pas confondre') && studio.includes('Convertir ne veut pas dire formater') && studio.includes('cf-vs-type') && studio.includes('La valeur passe du texte à un nombre décimal.') && studio.includes('sans que l’objectif soit de changer la nature de l’information') && studio.includes('présentation adaptée à l’affichage') && studio.includes('Convertir = changer le type.') && studio.includes('Formater = changer l’affichage.') && !studio.includes('type métier') && !studio.includes('Convertir agit sur le type'), 'conversion distinguée du formatage');
assert(studio.includes("CAST('29.956' AS DECIMAL(10,2))") && studio.includes('nombre maximal de chiffres au total') && studio.includes('8 chiffres avant la virgule') && studio.includes('cf-dec-map') && !studio.includes('cf-dec-tree') && !studio.includes('└──') && !studio.includes('les deux nombres ont un rôle') && !studio.includes('précision totale'), 'DECIMAL(10,2) expliqué');
assert(studio.includes('Tu demandes la conversion') && studio.includes("42 = '42'") && studio.includes('Pourquoi faut-il faire attention') && studio.includes('préfère une conversion explicite') && !studio.includes('Le SGBD convertit tout seul') && !studio.includes('évite de compter inutilement sur une conversion automatique') && !studio.includes('SQLite peut conserver 29.956'), 'conversion explicite et implicite montrées avec un exemple');
assert(studio.includes('La même opération, une écriture par SGBD') && studio.includes('cf-sgbd-table') && studio.includes('cf-sgbd-fns') && studio.includes('Conversion générale') && studio.includes('Autres syntaxes / fonctions') && studio.includes('date()') && studio.includes('datetime()') && studio.includes('strftime()') && studio.includes('DATE_FORMAT()') && studio.includes('TRY_CONVERT()') && studio.includes('PARSE()') && studio.includes('Pas toutes des équivalents de CAST()') && studio.includes('interpréter ou à formater') && !studio.includes('df-memo-table') && !studio.includes('Des fonctions spécifiques existent aussi') && !studio.includes('fonctions dédiées') && !studio.includes('Dans ce cours, les exercices utilisent SQLite'), 'tableau nommé, fonctions concrètes, et précision conversion / formatage');
assert(studio.includes('CAST(ROUND(prix) AS INTEGER)') && studio.includes('de l’intérieur vers l’extérieur'), 'fonctions imbriquées');
assert(studio.includes('Pièges à éviter') && studio.includes('Les erreurs fréquentes avec CAST()') && studio.includes('cf-traps') && (studio.match(/<article class="cf-trap">/g) || []).length === 5, 'un cadre scannable avec cinq mini-blocs');
assert(studio.includes('Valeur incompatible') && studio.includes("CAST('bonjour' AS INTEGER)") && studio.includes('NULL reste NULL') && studio.includes('CAST(NULL AS INTEGER)') && studio.includes('Le séparateur décimal') && studio.includes("REPLACE('29,90'") && studio.includes('Convertir ≠ arrondir') && studio.includes('ROUND(3.99)') && studio.includes('WHERE et JOIN') && studio.includes("id = CAST('4' AS INTEGER)"), 'les cinq pièges CAST restent couverts');
assert(!studio.includes('Une conversion n’est pas toujours possible') && !studio.includes('Attention dans WHERE et JOIN') && !studio.includes('Le point décimal') && !studio.includes('NULL reste un cas particulier') && !studio.includes('h2-txt">Convertir n’est pas arrondir'), 'anciens cadres piège complets retirés');
assert(studio.includes('L’essentiel sur les conversions de types') && !studio.includes('CAST d’abord, puis ton SGBD') && studio.includes('Convertir change le type de la valeur. Formater change sa présentation.'), 'récapitulatif final recentré sur l’essentiel');
assert(!studio.includes('Trois vérifications avant CAST'), 'ancien piège documentaire retiré');
assert(html.includes('function initConversionFunctions'), 'micro-interactions initialisées');
assert(html.includes('aria-label="Conversions courantes entre types"') && html.includes('aria-live="polite"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('cfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('nf-machine-arrow') && html.includes('.conversion-functions-page .nf-machine{flex-direction:column'), 'schéma CAST empilé sur petit écran');
assert(html.includes('initConversionFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54"), 'récapitulatifs redondants retirés de cette page');
assert(html.includes('const hideLessonLab=l.id===52||l.id===54'), 'console Teste redondante masquée');
assert(!html.slice(html.indexOf('function conversionFunctionStageHtml'), html.indexOf('function renderConversionFunctionsStudio')).includes('g.note'), 'notes sous les requêtes du mini-laboratoire retirées');
assert(serviceWorker.includes('requete-2026-09-13-cf-cast-chip-v681'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
