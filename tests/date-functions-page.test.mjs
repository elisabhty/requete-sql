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
const guideEnd = html.indexOf('function dateFunctionStageHtml', guideStart);
const guides = guideStart >= 0 && guideEnd > guideStart ? html.slice(guideStart, guideEnd) : '';

assert(Boolean(guides), 'guide temporel interactif localisé');
assert((guides.match(/\{k:'/g) || []).length === 6, '6 intentions plutôt que 13 longs chapitres');
assert(guides.includes("k:'now'") && guides.includes('CURRENT_TIMESTAMP'), 'date et heure actuelles disponibles');
assert(!guides.includes('AOÛT') && !guides.includes('13:30:00'), 'horloge du labo non figée dans le guide');
assert(html.includes('function dateNowVisualHtml') && html.includes("timeZone:'UTC'"), 'calendrier et horloge construits à l’instant UTC');
assert(html.includes('df-clock-time') && html.includes("page.querySelector('.df-stage .df-visual')") && html.includes('startDateNowTick') && html.includes('stopDateNowTick'), 'horloge du labo mise à jour chaque seconde');
assert(guides.includes("k:'extract'") && guides.includes('strftime'), 'extraction d’une partie disponible');
assert(guides.includes("k:'format'") && guides.includes('%d/%m/%Y'), 'formatage avant/après disponible');
assert(guides.includes("k:'shift'") && guides.includes("'+5 days'"), 'décalage sur une ligne du temps disponible');
assert(guides.includes("k:'duration'") && guides.includes('julianday'), 'durée entre deux dates disponible');
assert(guides.includes("k:'period'") && guides.includes("date_commande < '2023-08-01'"), 'période à borne droite exclue disponible');
assert(guides.includes('FROM commandes') && html.includes("piegeSqlRunBlock(g.sql)"), 'chaque opération temporelle est exécutable');
assert(html.includes('function renderDateFunctionsStudio'), 'rendu dédié à la leçon 53');
assert(html.includes('if(l.id===53)return renderDateFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(html.includes('df-anatomy') && html.includes('année</small>') && html.includes('seconde</small>'), 'date et heure décomposées visuellement');
assert(html.includes('Comprendre les dates et les heures') && html.includes('Une valeur, plusieurs parties'), 'introduction courte avant la décomposition');
assert(html.includes('Quand la commande a-t-elle été passée') && html.includes('df-pick-to') && html.includes('mois</small><b>08</b>'), 'questions concrètes puis extraction du mois');
assert(!html.includes('Mais manipuler le temps en SQL demande quelques précautions'), 'précautions avancées hors de l’intro');
assert(html.includes('function initDateFunctions'), 'micro-interactions initialisées');
assert(html.includes('df-stage-head" aria-live="polite"') && html.includes('Opérations essentielles sur les dates'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('dfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initDateFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54") && html.includes("compactFunctionLesson?'':reflexBlock(l)"), 'récapitulatifs redondants retirés de cette page');
const studio = html.slice(html.indexOf('function renderDateFunctionsStudio'), html.indexOf('let dfNowTick'));
const order = ['Comprendre les dates et les heures','Choisir la bonne information temporelle','6 opérations essentielles sur les dates','Retrouver le début ou la fin d’un mois','Filtrer sans perdre la fin de journée','Distinguer l’instant et l’heure affichée','Les réflexes qui évitent les erreurs','Retrouver rapidement la syntaxe'];
let prev = -1;
let orderOk = true;
for (const title of order) {
  const i = studio.indexOf(title);
  if (i <= prev) orderOk = false;
  prev = i;
}
assert(!studio.slice(0, studio.indexOf('Choisir la bonne information temporelle')).includes('sans ambiguïté'), 'formats ambigus hors de l’intro');
const vocab = studio.slice(studio.indexOf('Choisir la bonne information temporelle'), studio.indexOf('6 opérations essentielles sur les dates'));
assert(!vocab.includes('Instant') && !vocab.includes('instant exact'), 'instant réservé au chapitre fuseaux');
assert(vocab.includes('Date + heure') && vocab.includes('TIMESTAMP') && vocab.includes('DATETIME') && vocab.includes('df-reflex'), 'date + heure et réflexe mémorisable');
assert(guides.includes("label:'Obtenir maintenant'") && !guides.includes("label:'Lire maintenant'"), 'obtenir plutôt que lire une date stockée');
assert(guides.includes("label:'Formater une date'") && guides.includes("label:'Calculer une durée'"), 'verbes SQL alignés sur les six opérations');
assert(guides.includes('tu n’as pas besoin de les écrire') && guides.includes('Si tu relances la requête'), 'situation puis à retenir pour maintenant');
assert(studio.includes('2026-08-29T11:30:00Z'), 'instant ancré en UTC dans les fuseaux');
assert(orderOk && (studio.match(/<div class="concept-block">/g) || []).length === 8, 'huit cadres dans l’ordre pédagogique');
assert(!studio.includes('Et pour les fuseaux horaires ?') && !studio.includes('Convertir une valeur'), 'cadres hors fil retirés');
assert(studio.includes('concept-table vocab-table'), 'mémo de syntaxe repliable sur mobile');
assert(studio.includes('df-month-path') && studio.includes('2023-09-01') && studio.includes('+1 month'), 'chemin en quatre étapes pour la fin du mois');
assert(!studio.includes('Ne devine pas le dernier jour'), 'ouverture du cadre mois moins brutale');
assert((studio.match(/<article class="df-trap">/g) || []).length === 4, 'quatre pièges pédagogiques');
assert(studio.includes('03/04/2026') && studio.includes('2026-04-03'), 'formats de date ambigus illustrés');
assert(!studio.includes('peut empêcher un index d’aider'), 'index relégué en bonus, pas en titre');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
