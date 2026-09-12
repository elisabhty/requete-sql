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
assert(!guides.includes('AOÛT') && !guides.includes('13:30:00'), 'horloge décorative retirée du laboratoire');
assert(!html.includes('dateNowVisualHtml') && !html.includes('df-clock-time') && !html.includes('Exemple de résultat'), 'calendrier, horloge et exemple de résultat retirés');
assert(guides.includes("k:'extract'") && guides.includes('strftime'), 'extraction d’une partie disponible');
assert(guides.includes("k:'format'") && guides.includes('%d/%m/%Y'), 'formatage disponible');
assert(!guides.includes('visual:'), 'schémas décoratifs du laboratoire retirés');
assert(guides.includes("k:'shift'") && guides.includes("'+5 days'"), 'décalage sur une ligne du temps disponible');
assert(guides.includes("k:'duration'") && guides.includes('julianday'), 'durée entre deux dates disponible');
assert(guides.includes("k:'period'") && guides.includes("date_commande < '2023-08-01'"), 'période à borne droite exclue disponible');
assert(guides.includes('FROM commandes') && html.includes("piegeSqlRunBlock(g.sql)"), 'chaque opération temporelle est exécutable');
assert(html.includes('function renderDateFunctionsStudio'), 'rendu dédié à la leçon 53');
assert(html.includes('if(l.id===53)return renderDateFunctionsStudio(l)'), 'ancienne pile de texte remplacée');
assert(html.includes('df-anatomy') && html.includes('année</small>') && html.includes('seconde</small>'), 'date et heure décomposées visuellement');
assert(html.includes('Comprendre les dates et les heures') && html.includes('Une valeur, plusieurs parties'), 'introduction courte avant la décomposition');
assert(html.includes('Quand la commande a-t-elle été passée') && html.includes('df-pick-to') && html.includes('mois</small><b>08</b>'), 'questions concrètes puis extraction du mois');
assert(html.includes('Le format') && html.includes('suit toujours le même ordre'), 'à retenir centré sur l’ordre du format');
assert(!html.includes('Mais manipuler le temps en SQL demande quelques précautions'), 'précautions avancées hors de l’intro');
assert(html.includes('function initDateFunctions'), 'micro-interactions initialisées');
assert(html.includes('df-stage-head" aria-live="polite"') && html.includes('Opérations essentielles sur les dates'), 'états interactifs accessibles');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('dfStageSwap'), 'animations compatibles avec la réduction des mouvements');
assert(html.includes('initDateFunctions();'), 'laboratoire activé au rendu du cours');
assert(html.includes("const compactFunctionLesson=l.id===52||l.id===53||l.id===54") && html.includes("compactFunctionLesson?'':reflexBlock(l)"), 'récapitulatifs redondants retirés de cette page');
const studio = html.slice(html.indexOf('function renderDateFunctionsStudio'), html.indexOf('const NUMERIC_FUNCTION_GUIDES'));
const order = ['Comprendre les dates et les heures','Choisir la bonne information temporelle','6 opérations essentielles sur les dates','Retrouver le début ou la fin d’un mois','Filtrer un mois entier','Une même heure ne désigne pas toujours le même moment','Les réflexes qui évitent les erreurs','Dates et heures selon le SGBD'];
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
assert(vocab.includes('df-reflex-ico') && !vocab.includes('📅') && !vocab.includes('🕐') && !vocab.includes('⏱️'), 'réflexe en pictogrammes plutôt qu’emojis');
assert(studio.includes('h2-emo') && studio.includes('📅') && studio.includes('🧭') && studio.includes('🧪') && studio.includes('📆') && studio.includes('⏳') && studio.includes('🌍') && studio.includes('⚠️') && studio.includes('📝'), 'un emoji en tête de chaque cadre');
assert(guides.includes("label:'Obtenir maintenant'") && !guides.includes("label:'Lire maintenant'"), 'obtenir plutôt que lire une date stockée');
assert(guides.includes("label:'Formater une date'") && guides.includes("label:'Calculer une durée'"), 'verbes SQL alignés sur les six opérations');
assert((guides.match(/why:'/g) || []).length === 6, 'chaque opération part d’une situation');
assert(guides.includes('EXTRACT()') && guides.includes('TO_CHAR()') && guides.includes('DATE_ADD()') && guides.includes('TIMESTAMPDIFF()'), 'fonctions multi-SGBD visibles sur les cartes');
assert(guides.includes('au moment où ta requête s’exécute') && !guides.includes('Si tu relances la requête'), 'situation de maintenant sans note d’horloge');
assert(guides.includes('Extraire une partie d’une date') && guides.includes('Garder uniquement une période'), 'titres d’opération alignés sur le besoin');
assert(studio.includes('2026-08-29T11:30:00Z'), 'instant ancré en UTC dans les fuseaux');
assert(orderOk && (studio.match(/<div class="concept-block">/g) || []).length === 8, 'huit cadres dans l’ordre pédagogique');
assert(!studio.includes('Et pour les fuseaux horaires ?') && !studio.includes('Convertir une valeur'), 'cadres hors fil retirés');
assert(studio.includes('df-memo-table') && studio.includes('PostgreSQL') && studio.includes('SQL Server') && studio.includes('Oracle'), 'mémo en tableau des cinq SGBD');
const memo = studio.slice(studio.indexOf('Dates et heures selon le SGBD'));
assert(memo.includes('df-keep') && memo.includes('À retenir') && memo.indexOf('df-keep') < memo.indexOf('df-memo-table'), 'à retenir de toute la leçon avant le tableau');
assert(memo.includes('TIMESTAMP') && memo.includes('préfère souvent') && memo.includes('Europe/Paris') && memo.includes('date seule'), 'grands réflexes dates et heures, pas seulement les fuseaux');
assert(!studio.includes('Pour une date présente'), 'note IS NOT NULL retirée du mémo');
assert(studio.includes('df-memo-scroll') && studio.includes('Glisse'), 'mémo large avec indicateur de glissement');
assert(html.includes('bindTableSwipe(page)'), 'indicateur de glissement activé sur le mémo');
assert(studio.includes("EXTRACT(YEAR FROM d)") && studio.includes('DATEADD(day, 7, d)') && studio.includes('FROM_TZ()'), 'équivalents année, décalage et fuseau renseignés');
assert(studio.includes('df-month-path') && studio.includes('2023-09-01') && studio.includes('+1 month'), 'chemin en quatre étapes pour la fin du mois');
assert(!studio.includes('Ne devine pas le dernier jour'), 'ouverture du cadre mois moins brutale');
const period = studio.slice(studio.indexOf('Filtrer un mois entier'), studio.indexOf('Une même heure ne désigne pas toujours le même moment'));
const tz = studio.slice(studio.indexOf('Une même heure ne désigne pas toujours le même moment'), studio.indexOf('Les réflexes qui évitent les erreurs'));
assert(tz.includes('New York</small><b>13:30</b>') && tz.includes('df-tz-neq'), '13:30 à Paris n’est pas 13:30 à New York');
assert(html.includes('.df-tz-city small{display:block;font-size:13px') && html.includes('.df-unit small{font-size:11px'), 'libellés du cours moins écrasés');
assert(html.includes('@media (max-width:520px)') && html.includes('.df-anatomy-split{grid-template-columns:1fr') && html.includes('.df-ideas{grid-template-columns:1fr}'), 'date, heure et types empilés sur téléphone');
assert(tz.indexOf('New York</small><b>13:30</b>') < tz.indexOf('UTC : l’heure de référence') && tz.indexOf('UTC : l’heure de référence') < tz.indexOf('2026-08-29T11:30:00Z'), 'UTC arrive après le trou de la date + heure, avant le Z');
assert(tz.indexOf('2026-08-29T11:30:00Z') < tz.indexOf('Décalage et fuseau') && tz.indexOf('Le décalage') < tz.indexOf('Le fuseau horaire') && tz.includes('29 décembre 2026'), 'Z, puis décalage, puis fuseau avec le changement d’heure');
assert(!tz.includes('Si UTC') && !tz.includes('+ 2 heures'), 'exemple UTC 11:30 redondant retiré');
assert(tz.includes('>Z</code>') && tz.includes('+02:00') && tz.includes('Europe/Paris') && tz.includes('df-tz-season'), 'Z, décalage et fuseau expliqués après UTC');
assert(tz.includes('La différence à retenir') && tz.includes('2 heures d’avance'), 'écart UTC / décalage / fuseau résumé à la fin');
assert(tz.includes('👉 Pour pouvoir comparer') && tz.includes('👉 On connaît maintenant') && tz.includes('👉 Pourquoi avons-nous besoin') && tz.includes('👉 Le système utilise donc') && tz.includes('👉 Pour un événement précis') && tz.includes('👉 Pour une date de naissance'), 'repères du chapitre fuseaux signalés par un doigt');
assert(tz.includes('Le bon réflexe dépend') && tz.includes('AT TIME ZONE') && tz.includes('CONVERT_TZ()'), 'stockage puis syntaxes de conversion');
assert(!period.includes('23:59:59') && period.includes('avant le 1er août'), 'fin de journée sans figer 23:59:59');
assert(period.includes("BETWEEN '2023-07-01'") && period.includes("'2023-07-31'"), 'piège BETWEEN illustré');
assert(period.includes('date_commande') && !period.includes('date_heure'), 'période sur la colonne réelle date_commande');
const afterBetween = period.slice(period.indexOf('BETWEEN'));
assert(afterBetween.includes("'2023-07-31'") && afterBetween.includes('peut être interprétée comme') && afterBetween.includes('2023-07-31 00:00:00') && afterBetween.includes('2023-07-31 22:45:00'), 'la borne date est d’abord lue comme minuit');
assert(period.includes('TOUT JUILLET') && period.includes('01/08 00:00'), 'tout juillet borné au 1er août');
assert(!period.includes('comparaison date-heure') && !period.includes('La borne de fin s’arrête'), 'borne de fin expliquée sans jargon');
assert(period.includes('utilise <code>&gt;=</code>') && !period.includes('utilise souvent'), 'réflexe de période sans souvent');
assert((studio.match(/<article class="df-trap">/g) || []).length === 4, 'quatre pièges pédagogiques');
assert(studio.includes('03/04/2026') && studio.includes('2026-04-03'), 'formats de date ambigus illustrés');
assert(!studio.includes('peut empêcher un index d’aider'), 'index relégué en bonus, pas en titre');
assert(!studio.includes('Avec <code>NULL</code>, utilise') && !studio.includes('Utilise un format de date clair'), 'notes de piège redondantes retirées');
assert(/function lessonRichFooter\(l\)\{\s*if\(l\.id===53\)return '';/.test(html), 'playground Teste retiré de la leçon 53');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
