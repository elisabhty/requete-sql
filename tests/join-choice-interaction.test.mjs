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

console.log('\n=== Cours Quel JOIN choisir\u00a0? ===');
const guideStart = html.indexOf('<div class="jc-guide"');
const guide = guideStart >= 0 ? html.slice(guideStart, guideStart + 4000) : '';
const initStart = html.indexOf('function initJoinChooser()');
const initEnd = html.indexOf('\nfunction ', initStart + 10);
const init = initStart >= 0 && initEnd > initStart ? html.slice(initStart, initEnd) : '';

assert(html.includes('{ id:44, titre:"Quel JOIN choisir\u00a0?"'), 'le cours 44 reste identifié');
assert(Boolean(guide) && Boolean(init), 'guide visuel et interactions du choix de JOIN localisés');
assert(!init.includes('setTimeout(()=>setBranch(branches[0])'), 'aucun JOIN n’est choisi automatiquement');
assert(!init.includes('setNode(nodes[0])'), 'la table A n’est plus choisie automatiquement');
assert(serviceWorker.includes('requete-2026-10-04-ludique-v1605'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
