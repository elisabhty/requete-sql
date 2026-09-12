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

console.log('\n=== Page Fonctions numériques ===');
const guideStart = html.indexOf('const NUMERIC_FUNCTION_GUIDES=');
const guideEnd = html.indexOf('function numericFunctionStageHtml', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';
const stageStart = guideEnd;
const stageEnd = html.indexOf('function renderNumericFunctionsStudio', stageStart);
const stage = stageStart >= 0 && stageEnd > stageStart ? html.slice(stageStart, stageEnd) : '';
const studioStart = stageEnd;
const studioEnd = html.indexOf('function initNumericFunctions', studioStart);
const studio = studioStart >= 0 && studioEnd > studioStart ? html.slice(studioStart, studioEnd) : '';

assert(Boolean(guides), 'guide numérique interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 12, '12 intentions numériques consultables');
assert(guides.includes("k:'round'") && guides.includes('ROUND(prix) AS prix_arrondi'), 'arrondi disponible');
assert(guides.includes("k:'ceil'") && guides.includes('CEIL(prix)'), 'arrondi vers le haut disponible');
assert(guides.includes("k:'floor'") && guides.includes('FLOOR(prix)'), 'arrondi vers le bas disponible');
assert(guides.includes("k:'trunc'") && guides.includes('TRUNC(prix)'), 'troncature disponible');
assert(guides.includes("k:'abs'") && guides.includes('ABS(age - 40)'), 'valeur absolue disponible');
assert(guides.includes("k:'sign'") && guides.includes('SIGN(stock - 120)'), 'signe disponible');
assert(guides.includes("k:'modulo'") && guides.includes('stock % 50'), 'modulo présenté comme un reste');
assert(guides.includes("k:'power'") && guides.includes('POWER(quantite, 2)'), 'puissance disponible');
assert(guides.includes("k:'sqrt'") && guides.includes('SQRT(quantite)'), 'racine carrée disponible');
assert(guides.includes("k:'greatest'") && guides.includes('GREATEST(prix, stock)'), 'plus grande valeur sur une ligne disponible');
assert(guides.includes("k:'least'") && guides.includes('LEAST(prix, stock)'), 'plus petite valeur sur une ligne disponible');
assert(guides.includes("k:'random'") && guides.includes('ORDER BY RANDOM()'), 'tirage aléatoire conservé');
assert(html.includes('function renderNumericFunctionsStudio'), 'rendu dédié à la leçon 52');
assert(html.includes('if(l.id===52)return renderNumericFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(studio.includes('nf-machine') && studio.includes('ROUND()'), 'fonction montrée par un schéma plutôt qu’un bloc exécutable');
assert(stage.includes('nf-visual') && !stage.includes('piegeSqlRunBlock(g.sql)'), 'mini-laboratoire sans cadre SQL exécutable');
assert(studio && !studio.includes('piegeSqlRunBlock'), 'page numérique sans cadre SQL exécutable');
assert(html.includes('function initNumericFunctions'), 'micro-interactions initialisées');
assert(html.includes('aria-label="Fonctions numériques"') && html.includes('aria-live="polite"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('nfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initNumericFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54"), 'récapitulatifs redondants retirés de cette page');
assert(studio.includes('MAX n’est pas GREATEST'), 'piège MAX/GREATEST conservé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
