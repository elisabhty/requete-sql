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

console.log('\n=== Schéma animé CASE ===');
const drawStart = html.indexOf("if(kind==='casewalk')");
const drawEnd = html.indexOf("if(kind==='caseforms')", drawStart);
const draw = drawStart >= 0 && drawEnd > drawStart ? html.slice(drawStart, drawEnd) : '';
const initStart = html.indexOf('function initCaseWalk()');
const initEnd = html.indexOf('function initFnNest()', initStart);
const init = initStart >= 0 && initEnd > initStart ? html.slice(initStart, initEnd) : '';

assert(Boolean(draw) && Boolean(init), 'schéma CASE et interactions localisés');
assert(draw.includes('cw-machine') && draw.includes('cw-probe') && draw.includes('cw-case-lab') && draw.includes('cw-end'), 'CASE est montré comme une machine, pas seulement une liste');
assert(draw.includes("THEN 'Jeune'") && draw.includes("THEN 'Adulte'") && draw.includes("THEN 'Senior'"), 'chaque branche révèle son THEN');
assert(draw.includes('data-cw-say') && draw.includes('aria-live="polite"'), 'le résultat de l’évaluation est annoncé');
assert(draw.includes('dans l’ordre') && !draw.includes('viennent de la table <code>clients</code>'), 'la consigne insiste sur l’ordre des WHEN');
assert(init.includes("mode==='test'") && init.includes('is-test') && init.includes('320'), 'chaque WHEN est d’abord testé, puis tranché');
assert(init.includes('BETWEEN 30 AND 50') && init.includes('SQL s’arrête'), 'le verdict relie l’âge à l’arrêt de CASE');
assert(init.includes("prefersReduceMotion()") && init.includes("classList.add('is-set')"), 'mouvement réduit et colonne categorie restent couverts');

const forms = html.indexOf("if(kind==='caseforms')") >= 0
  ? html.slice(html.indexOf("if(kind==='caseforms')"), html.indexOf("if(kind==='selfcols')"))
  : '';
assert(forms.includes('cw-form-schema') && forms.includes("CASE") && forms.includes('ville') && forms.includes('age < 30'), 'les deux formes ont un schéma, pas seulement du SQL');
assert(html.includes('.cw-form .cw-syntax{display:none') || html.includes('.cw-form .pt-sql,.cw-form .cw-syntax{display:none'), 'le SQL des formes se révèle au toucher');

const lesson21 = html.slice(html.indexOf('{ id:21, titre:"CASE"'), html.indexOf('{ id:23, titre:"COALESCE"'));
assert(lesson21.includes('Structure de CASE') && lesson21.includes('condition_1') && lesson21.includes('SI') && lesson21.includes('ALORS'), 'la structure CASE est expliquée avec SI / ALORS');
assert(lesson21.includes('Le premier WHEN vrai est retenu') && !lesson21.includes('Premier WHEN gagnant'), 'le premier WHEN vrai est retenu, pas « gagnant »');
assert(lesson21.includes('cw-order') && lesson21.includes('non testé') && lesson21.includes('de haut en bas'), 'la lecture des WHEN va de haut en bas');
assert(lesson21.includes("ELSE 'Autre'") && lesson21.includes('cw-nullout'), 'ELSE optionnel montre la valeur de repli et NULL');
assert(lesson21.includes('Où utiliser CASE ?') && !lesson21.includes('CASE dans SELECT') && lesson21.includes('categorie_age'), 'la carte dit où utiliser CASE, pas seulement SELECT');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
