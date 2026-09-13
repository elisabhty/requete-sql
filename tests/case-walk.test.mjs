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
assert(draw.includes("THEN 'Jeune'") && draw.includes("THEN 'Adulte'") && draw.includes("ELSE") && draw.includes("'Senior'") && !draw.includes("THEN 'Senior'"), 'ELSE n’a pas de THEN');
assert(draw.includes('data-cw-say') && draw.includes('aria-live="polite"'), 'le résultat de l’évaluation est annoncé');
assert(draw.includes('s’arrête au premier qui est vrai') && !draw.includes('puis s’arrête'), 'la consigne dit que CASE s’arrête au premier WHEN vrai');
assert(init.includes("mode==='test'") && init.includes('is-test') && init.includes('320'), 'chaque WHEN est d’abord testé, puis tranché');
assert(init.includes('est entre 30 et 50') && init.includes('Résultat') && init.includes('n’est pas utilisé'), 'le verdict relie chaque âge à la décision de CASE');
assert(init.includes("prefersReduceMotion()") && init.includes("classList.add('is-set')"), 'mouvement réduit et colonne categorie restent couverts');

const forms = html.indexOf("if(kind==='caseforms')") >= 0
  ? html.slice(html.indexOf("if(kind==='caseforms')"), html.indexOf("if(kind==='selfcols')"))
  : '';
assert(forms.includes('cw-form-schema') && forms.includes("CASE") && forms.includes('ville') && forms.includes('age < 30'), 'les deux formes ont un schéma, pas seulement du SQL');
assert(forms.includes('cw-form-emoji') && forms.includes('🏷️') && forms.includes('🔎'), 'chaque forme a un emoji et un titre aéré');
assert(html.includes('.cw-form .cw-syntax{display:none') || html.includes('.cw-form .pt-sql,.cw-form .cw-syntax{display:none'), 'le SQL des formes se révèle au toucher');

const lesson21 = html.slice(html.indexOf('{ id:21, titre:"CASE"'), html.indexOf('{ id:23, titre:"COALESCE"'));
assert(lesson21.includes('Structure de CASE') && lesson21.includes('condition_1') && lesson21.includes('SI') && lesson21.includes('ALORS'), 'la structure CASE est expliquée avec SI / ALORS');
assert(lesson21.includes('Le premier WHEN vrai est retenu') && !lesson21.includes('Premier WHEN gagnant'), 'le premier WHEN vrai est retenu, pas « gagnant »');
assert(lesson21.includes('cw-order') && lesson21.includes('non testé') && lesson21.includes('de haut en bas'), 'la lecture des WHEN va de haut en bas');
assert(lesson21.includes("ELSE 'Autre'") && lesson21.includes('cw-nullout'), 'ELSE optionnel montre la valeur de repli et NULL');
assert(lesson21.includes('Où utiliser CASE ?') && !lesson21.includes('CASE dans SELECT') && lesson21.includes('categorie_age'), 'la carte dit où utiliser CASE, pas seulement SELECT');
assert(html.includes('Comment CASE prend sa décision'), 'le schéma explique la décision de CASE');
assert(lesson21.includes('logique conditionnelle') && lesson21.includes('SINON SI') && lesson21.includes('cw-if'), 'l’intro présente CASE comme SI / SINON SI / SINON');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
