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

console.log('\n=== En-tête des questions d’entretien ===');
const start = html.indexOf('#scr-entretien.ent-focus-mode>.home-back{');
const end = html.indexOf('\n  }', start);
const css = start >= 0 && end > start ? html.slice(start, end) : '';
assert(Boolean(css), 'règle du mode focalisé localisée');
assert(css.includes('position:sticky') && css.includes('top:0'), 'barre Questions maintenue en haut');
assert(css.includes('width:100%') && css.includes('box-sizing:border-box'), 'surface couvrant toute la largeur');
assert(css.includes('background:#F5F6FA'), 'fond opaque masquant le contenu défilé');
assert(!css.includes('background:rgba(245,246,250,.88)'), 'ancienne transparence supprimée');
assert(css.includes('border-bottom') && css.includes('box-shadow'), 'séparation iOS conservée sans chevauchement');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
