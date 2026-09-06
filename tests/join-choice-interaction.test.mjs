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

console.log('\n=== Cours Choisir le bon JOIN ===');
const drawStart = html.indexOf("if(kind==='jointree')");
const drawEnd = html.indexOf("if(kind==='casewalk')", drawStart);
const draw = drawStart >= 0 && drawEnd > drawStart ? html.slice(drawStart, drawEnd) : '';
const initStart = html.indexOf('function initJoinTree()');
const initEnd = html.indexOf('function initCaseWalk()', initStart);
const init = initStart >= 0 && initEnd > initStart ? html.slice(initStart, initEnd) : '';

assert(html.includes('{ id:44, titre:"Quel JOIN choisir"'), 'le cours 44 reste identifié');
assert(Boolean(draw) && Boolean(init), 'rendu et interactions du mini-jeu localisés');
assert(draw.includes('jd-coach') && draw.includes('À toi · étape 1 sur 2'), 'guide visuel affiché avant le premier choix');
assert(draw.includes('role="status" aria-live="polite" aria-atomic="true"'), 'consignes annoncées de façon accessible');
assert(draw.includes('Toucher pour choisir') && draw.includes('Toucher pour continuer'), 'affordances tactiles explicites sur les cartes');
assert(draw.includes('🤝') && draw.includes('🛟') && draw.includes('⬅️') && draw.includes('➡️') && draw.includes('↔️'), 'emojis donnent un repère à chaque décision');
assert(draw.includes('jd-special') && draw.includes('CROSS JOIN et SELF JOIN'), 'cas particuliers repliés dans une interaction secondaire');
assert(draw.includes('jd-result-head') && draw.includes('Ton choix'), 'résultat confirmé dans une carte dédiée');
assert(draw.includes('jd-memory') && draw.includes('🧠'), 'mémo visuel présent pour chaque JOIN');
assert(draw.includes('jd-reset') && draw.includes('Essayer une autre situation'), 'nouvel essai disponible sans quitter la leçon');
assert(init.includes("guider('step2')") && init.includes("guider('done',k)"), 'guide synchronisé avec les deux étapes et le résultat');
assert(init.includes("navigator.vibrate([5,30,5])"), 'micro-retour haptique distinct au redémarrage');
assert(!init.includes('setTimeout(()=>setBranch(branches[0])'), 'aucun JOIN n’est choisi automatiquement');
assert(!init.includes('setNode(nodes[0])'), 'la table A n’est plus choisie automatiquement');
assert(html.includes('.jd-coach-emoji') && html.includes('@keyframes jdCoachTap'), 'micro-animation de toucher disponible');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('.jd-result-check'), 'animations compatibles avec la réduction des mouvements');
assert(serviceWorker.includes('requete-2026-09-06-distinct-lignes-v329'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
