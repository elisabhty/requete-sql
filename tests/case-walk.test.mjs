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
assert(forms.includes('cw-form-sql') && forms.includes('SELECT') && forms.includes('CASE ville') && forms.includes('age BETWEEN 30 AND 50') && forms.includes('FROM clients'), 'les deux formes montrent la structure dans une requête SQL');
assert(forms.includes('cw-form-emoji') && forms.includes('🏷️') && forms.includes('🔎'), 'chaque forme a un emoji et un titre aéré');
assert(!forms.includes('cw-form-schema') && !forms.includes('cw-fs-out'), 'le schéma à flèches est remplacé par du SQL');

const lesson21 = html.slice(html.indexOf('{ id:21, titre:"CASE"'), html.indexOf('{ id:23, titre:"COALESCE"'));
assert(!lesson21.includes('Structure de CASE'), 'la carte Structure de CASE est retirée');
assert(lesson21.indexOf('logique conditionnelle') < lesson21.indexOf('WHEN condition_1') && lesson21.indexOf('WHEN condition_1') < lesson21.indexOf('Elle fonctionne comme une logique'), 'la requête CASE est collée juste après la phrase d’intro');
assert(lesson21.includes('Le premier WHEN vrai est retenu') && !lesson21.includes('Premier WHEN gagnant'), 'le premier WHEN vrai est retenu, pas « gagnant »');
assert(lesson21.includes('cw-order') && lesson21.includes('non testé') && lesson21.includes('de haut en bas'), 'la lecture des WHEN va de haut en bas');
assert(lesson21.includes("ELSE 'Autre'") && lesson21.includes('cw-nullout'), 'ELSE optionnel montre la valeur de repli et NULL');
assert(lesson21.includes('Où utiliser CASE ?') && lesson21.includes('différents endroits') && lesson21.includes('fonctions d’agrégation') && lesson21.includes('COUNT(CASE WHEN') && !lesson21.includes('surtout dans') && !lesson21.includes('souvent utilisé'), 'la carte liste les emplacements de CASE');
assert(html.includes('.pt-card-b .fn-reflex-list li{background:#fff'), 'les emplacements de CASE ont un fond blanc');
assert(!lesson21.includes('Ordre trop large') && !lesson21.includes('rec_first'), 'l’onglet Ordre trop large n’apparaît plus dans Teste ni dans la requête expliquée');
assert(html.includes('Comment CASE prend sa décision'), 'le schéma explique la décision de CASE');
assert(lesson21.includes('logique conditionnelle') && lesson21.includes('SINON SI') && lesson21.includes('cw-if'), 'l’intro présente CASE comme SI / SINON SI / SINON');
assert(lesson21.includes('une valeur comparée à plusieurs valeurs') && lesson21.includes('plusieurs conditions à tester') && !lesson21.includes('Idéal quand tu veux dire') && !lesson21.includes('une même colonne → plusieurs valeurs possibles'), 'le réflexe oppose CASE simple et CASE recherché, sans le texte du bas');
const card21=html.slice(html.indexOf('21:{k:"CASE"'), html.indexOf('23:{k:"COALESCE"'));
assert(card21.includes('CASE expression') && card21.includes('WHEN condition') && card21.includes('CASE simple') && card21.includes('CASE recherché') && card21.includes('ss:['), 'la carte mémo montre les deux formes de CASE');
assert(lesson21.includes("On indique la valeur que CASE va tester") && lesson21.includes("END termine le CASE et AS region") && lesson21.includes("le CASE de tri retourne 1") && lesson21.includes("On ne conserve que les lignes dont le CASE a retourné") && lesson21.includes("CASE attribue à chaque client une catégorie selon son âge") && lesson21.includes("On regroupe les clients qui appartiennent à la même catégorie"), 'la requête expliquée dit ce que chaque morceau de CASE retourne');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
