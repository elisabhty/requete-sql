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

console.log('\n=== Page COALESCE ===');
const start = html.indexOf('{ id:23, titre:"COALESCE"');
/* Fin à la leçon suivante, quelle qu’elle soit : les leçons ne sont pas
   rangées par id dans le fichier, viser id:45 englobait d’autres leçons. */
const end = html.indexOf('\n{ id:', start + 10);
const lesson = start >= 0 && end > start ? html.slice(start, end) : '';

assert(Boolean(lesson), 'leçon COALESCE localisée');
assert(lesson.includes('coal-data-summary'), 'résumé des données présent dès la situation');
assert(lesson.includes('coal-sit') && lesson.includes('coal-mail') && lesson.includes('coal-null'), 'tableau et résumé forment un seul bloc, présent et NULL distincts');
assert(lesson.includes('<b>8</b><em>adresses renseignées</em>') && lesson.includes('<b>2</b><em>adresses absentes (NULL)</em>'), 'cardinalités visibles sans compter le tableau');
assert(html.includes('@container coalsit') && html.includes('grid-template-columns:1fr'), 'le résumé se superpose quand le tableau est étroit');
assert(lesson.includes('nf-hero-note is-ask') && lesson.includes('Non renseigné') && lesson.includes('sans modifier les données de la table'), 'la situation pose la question d’affichage, pas seulement un objectif');
assert(!lesson.includes('afficher un contact lisible'), 'l’ancien objectif est retiré');
assert(lesson.includes('garde la première valeur disponible'), 'règle centrale formulée dans le titre');
assert(lesson.includes('examine les valeurs de gauche à droite') && !lesson.includes('<strong>COALESCE examine'), 'la lecture de gauche à droite est dite sans emphase');
assert(lesson.includes('coal-route') && lesson.includes('1re valeur') && lesson.includes('2e valeur'), 'lecture de gauche à droite matérialisée');
assert(!lesson.includes('1er choix') && !lesson.includes('choix suivant'), 'le schéma parle de valeurs, pas de choix');
assert(lesson.includes('L’e-mail existe') && lesson.includes('s’arrête là') && lesson.includes('L’e-mail est NULL'), 'les deux branches sont comparables, avec un arrêt visible');
assert(lesson.includes('COALESCE(valeur1, valeur2, …)'), 'la syntaxe reste lisible pour un débutant');
assert(lesson.includes('Une valeur peut être une colonne, une expression ou une fonction'), 'valeur1 n’est pas limitée à un littéral');
assert(lesson.includes('4 usages courants de COALESCE'), 'titre des usages formulé comme un cours SQL');
assert((lesson.match(/class="coal-use-row"/g) || []).length === 4, '4 usages courts et structurés');
assert(lesson.includes('Afficher une valeur de remplacement') && lesson.includes('résultat affiché'), 'usage affichage : COALESCE ne réécrit pas la table');
assert(lesson.includes('Choisir la première information disponible') && lesson.includes("sinon 'Aucun contact'"), 'usage multi-valeurs aligné sur la lecture gauche-droite');
assert(lesson.includes('Éviter qu’un calcul retourne NULL') && lesson.includes('29,90 × NULL') && lesson.includes('29,90 × 0'), 'usage calcul montré avec et sans NULL');
assert(lesson.includes('Prévoir une valeur si aucun résultat n’est trouvé') && lesson.includes("WHERE categorie = 'Inconnue'"), 'usage agrégation : colonne produits.categorie, sans accent');
assert(!lesson.includes('4 façons de l’utiliser') && !lesson.includes('Sécuriser un calcul') && !lesson.includes('Garantir un résultat'), 'anciens titres d’usages retirés');
assert(lesson.includes('À ne pas confondre') && lesson.includes('COALESCE ne modifie pas la donnée'), 'confusion affichage / table, pas une erreur SQL');
assert(lesson.includes('valeur renvoyée par la requête') && lesson.includes('Hugo peut afficher'), 'la différence requête / table est montrée avec Hugo');
assert(!lesson.includes('peut afficher une valeur à la place de'), 'l’ancienne formulation abstraite est retirée');
assert(lesson.includes('sans modifier les données de la table'), 'différence affichage / écriture annoncée tôt');
assert(lesson.includes('COALESCE(a, b, c)') && lesson.includes('SQL cherche la première valeur disponible'), 'réflexe : syntaxe courte, puis la recherche de la première valeur');
assert(lesson.includes('coal-reflex-path') && lesson.includes('la renvoie et s’arrête'), 'le parcours a → b → c s’arrête à la première valeur disponible');
assert(!lesson.includes('À retenir') && !lesson.includes('première valeur non <code>NULL</code> = résultat'), 'le bandeau À retenir est retiré du réflexe');
assert(!lesson.includes('COALESCE(a, b, …)') && !lesson.includes('lit les valeurs de gauche à droite') && !lesson.includes('si toutes sont'), 'le cas tout-NULL et l’ancienne liste de règles sont hors du réflexe');
assert(!lesson.includes('modifie réellement la valeur dans la table'), 'UPDATE n’est plus dans le réflexe');
assert(lesson.includes('Les alternatives selon le SGBD') && lesson.includes('sgbd:1') && lesson.includes('h2:"SGBD"') && html.includes('is-sgbd2'), 'comparatif réduit à Fonction / SGBD');
assert(!lesson.includes('h2:"Principe"') && !lesson.includes('Parcourt plusieurs valeurs') && !lesson.includes('renvoie la 2e'), 'la colonne Principe est retirée');
assert(lesson.includes('coal-cmp-note') && !lesson.includes('fn-cmp-say coal-reflex-memo'), 'le bandeau sous le tableau n’est plus en gras');
assert(lesson.includes('plusieurs arguments') && lesson.includes('plus facilement portable') && !lesson.includes('autant d’arguments que nécessaire'), 'COALESCE est recommandé pour sa portabilité, sans promettre un nombre d’arguments illimité');
assert(!lesson.includes('Quel équivalent selon le moteur ?'), 'l’ancien titre d’équivalence est retiré');
assert(html.includes("concept-page${l.id===23?' coalesce-page':''}"), 'styles limités à la page COALESCE');
assert(lesson.includes('anatFollowTeste:true') && lesson.includes('k:"select"') && lesson.includes('k:"coalesce"') && lesson.includes('k:"rec_empty"'), 'l’explication suit les 3 onglets Teste');
assert(html.includes('lessonRichFooter(l,joinTesteAnat?anat:\'\')') && html.includes('has-anat'), 'Teste et la requête expliquée partagent le même cadre');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('coalUseIn'), 'micro-interactions compatibles avec la réduction des animations');
assert(!lesson.includes('coalesce-uses'), 'ancienne pile répétitive supprimée');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
