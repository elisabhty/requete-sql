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
const guideEnd = html.indexOf('const NUMERIC_ORDER_CASES=', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';
const orderStart = guideEnd;
const orderEnd = html.indexOf('function numericFunctionStageHtml', orderStart);
const order = orderStart >= 0 && orderEnd > orderStart ? html.slice(orderStart, orderEnd) : '';

assert(Boolean(guides), 'guide numérique interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 7, '7 intentions plutôt que 9 longs chapitres');
assert(guides.includes("k:'calculate'") && guides.includes('prix * quantite AS montant'), 'calcul entre colonnes disponible');
assert(guides.includes("k:'round'") && guides.includes('ROUND(29.987, 2)'), 'arrondi à deux décimales disponible');
assert(guides.includes("k:'divide'") && guides.includes('10 / 3.0'), 'division décimale expliquée');
assert(guides.includes("k:'gap'") && guides.includes('ABS(stock - 50)'), 'écart sans signe disponible');
assert(guides.includes("k:'modulo'") && guides.includes('11 % 2'), 'modulo présenté comme un reste');
assert(guides.includes("k:'safe'") && guides.includes('NULLIF(quantite, 0)'), 'division par zéro sécurisée');
assert(guides.includes("k:'random'") && guides.includes('ORDER BY RANDOM()'), 'tirage aléatoire conservé');
assert((order.match(/\{k:'/g) || []).length === 2, 'deux ordres d’opérations comparables');
assert(order.includes("k:'priority'") && order.includes('5 × 2 = 10'), 'priorité naturelle expliquée');
assert(order.includes("k:'parentheses'") && order.includes('10 + 5 = 15'), 'effet des parenthèses expliqué');
assert(html.includes('function renderNumericFunctionsStudio'), 'rendu dédié à la leçon 52');
assert(html.includes('if(l.id===52)return renderNumericFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(html.includes('nf-hero') && html.includes('59,80'), 'prix × quantité montré visuellement');
assert(html.includes('function initNumericFunctions'), 'micro-interactions initialisées');
assert(html.includes('Actions possibles sur un nombre') && html.includes('aria-live="polite"'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('nfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initNumericFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54"), 'récapitulatifs redondants retirés de cette page');
assert(html.includes('Confondre résultat et valeur stockée'), 'piège affichage / modification raccourci');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
