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
const studio = html.slice(html.indexOf('function renderDateFunctionsStudio'), html.indexOf('let dfNowTick'));
const order = ['Comprendre les dates et les heures','Choisir la bonne information temporelle','6 opérations essentielles sur les dates','Retrouver le début ou la fin d’un mois','Filtrer un mois sans oublier les dernières heures','Une même heure ne désigne pas toujours le même moment','Les réflexes qui évitent les erreurs','Dates et heures selon le SGBD'];
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
assert(guides.includes("label:'Obtenir maintenant'") && !guides.includes("label:'Lire maintenant'"), 'obtenir plutôt que lire une date stockée');
assert(guides.includes("label:'Formater une date'") && guides.includes("label:'Calculer une durée'"), 'verbes SQL alignés sur les six opérations');
assert((guides.match(/why:'/g) || []).length === 6, 'chaque opération part d’une situation');
assert(guides.includes('EXTRACT()') && guides.includes('TO_CHAR()') && guides.includes('DATE_ADD()') && guides.includes('TIMESTAMPDIFF()'), 'fonctions multi-SGBD visibles sur les cartes');
assert(guides.includes('au moment où ta requête s’exécute') && guides.includes('Si tu relances la requête'), 'situation puis à retenir pour maintenant');
assert(guides.includes('Extraire une partie d’une date') && guides.includes('Garder uniquement une période'), 'titres d’opération alignés sur le besoin');
assert(studio.includes('2026-08-29T11:30:00Z'), 'instant ancré en UTC dans les fuseaux');
assert(orderOk && (studio.match(/<div class="concept-block">/g) || []).length === 8, 'huit cadres dans l’ordre pédagogique');
assert(!studio.includes('Et pour les fuseaux horaires ?') && !studio.includes('Convertir une valeur'), 'cadres hors fil retirés');
assert(studio.includes('df-memo-table') && studio.includes('PostgreSQL') && studio.includes('SQL Server') && studio.includes('Oracle'), 'mémo en tableau des cinq SGBD');
assert(!studio.includes('Pour une date présente'), 'note IS NOT NULL retirée du mémo');
assert(studio.includes('df-memo-scroll') && studio.includes('Glisse'), 'mémo large avec indicateur de glissement');
assert(html.includes('bindTableSwipe(page)'), 'indicateur de glissement activé sur le mémo');
assert(studio.includes("EXTRACT(YEAR FROM d)") && studio.includes('DATEADD(day, 7, d)') && studio.includes('FROM_TZ()'), 'équivalents année, décalage et fuseau renseignés');
assert(studio.includes('df-month-path') && studio.includes('2023-09-01') && studio.includes('+1 month'), 'chemin en quatre étapes pour la fin du mois');
assert(!studio.includes('Ne devine pas le dernier jour'), 'ouverture du cadre mois moins brutale');
const period = studio.slice(studio.indexOf('Filtrer un mois sans oublier les dernières heures'), studio.indexOf('Une même heure ne désigne pas toujours le même moment'));
const tz = studio.slice(studio.indexOf('Une même heure ne désigne pas toujours le même moment'), studio.indexOf('Les réflexes qui évitent les erreurs'));
assert(tz.includes('New York</small><b>14:00</b>') && tz.includes('df-tz-neq'), '14:00 à Paris n’est pas 14:00 à New York');
assert(html.includes('.df-tz-city small{display:block;font-size:13px') && html.includes('.df-unit small{font-size:11px'), 'libellés du cours moins écrasés');
assert(tz.indexOf('New York</small><b>14:00</b>') < tz.indexOf('12:00') && tz.indexOf('New York</small><b>08:00</b>') > tz.indexOf('12:00'), '08:00 à New York n’apparaît qu’avec l’instant UTC');
assert(tz.includes('>Z</code>') && tz.includes('+02:00') && tz.includes('Europe/Paris'), 'Z, décalage et fuseau expliqués après les schémas');
assert(tz.includes('Le bon réflexe dépend') && tz.includes('AT TIME ZONE') && tz.includes('CONVERT_TZ()'), 'stockage puis syntaxes de conversion');
assert(!period.includes('23:59:59') && period.includes('juste avant le 1er août'), 'fin de journée sans figer 23:59:59');
assert(period.includes("BETWEEN '2023-07-01'") && period.includes("'2023-07-31'"), 'piège BETWEEN illustré');
assert(period.includes('Pourquoi éviter BETWEEN') && period.includes('2023-07-31 10:30:00') && period.includes('2023-07-31 18:45:00'), 'BETWEEN montré avec les heures perdues du 31');
assert(period.includes('TOUT JUILLET') && period.includes('01/08 00:00'), 'tout juillet borné au 1er août');
assert(!period.includes('comparaison date-heure'), 'borne de fin expliquée sans jargon');
assert((studio.match(/<article class="df-trap">/g) || []).length === 4, 'quatre pièges pédagogiques');
assert(studio.includes('03/04/2026') && studio.includes('2026-04-03'), 'formats de date ambigus illustrés');
assert(!studio.includes('peut empêcher un index d’aider'), 'index relégué en bonus, pas en titre');
assert(!studio.includes('Avec <code>NULL</code>, utilise') && !studio.includes('Utilise un format de date clair'), 'notes de piège redondantes retirées');
assert(/function lessonRichFooter\(l\)\{\s*if\(l\.id===53\)return '';/.test(html), 'playground Teste retiré de la leçon 53');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
