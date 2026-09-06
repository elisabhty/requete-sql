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

/* Le bloc est délimité par le commentaire d'en-tête de l'onboarding et la
   première fonction qui le suit. Si l'un des deux repères bouge, la tranche
   devient vide et tout tombe d'un coup : la première assertion le signale
   explicitement plutôt que de laisser croire à vingt régressions. */
const start = html.indexOf('/* Onboarding production v2.');
const end = html.indexOf('\nfunction celebrate(){', start);
const onboarding = start >= 0 && end > start ? html.slice(start, end) : '';

console.log('\n=== Onboarding : parcours, pratique réelle et accessibilité ===');
assert(onboarding.length > 5000, 'bloc onboarding localisé (repères de découpe intacts)');

console.log('\n--- Le parcours ---');
assert(html.includes("const OB_SLIDES = ['welcome','proof','account','name','goal','level','practice','rhythm','ready']"), 'les neuf étapes du parcours sont déclarées dans l’ordre');
assert(onboarding.includes("if(slide==='welcome')obGoto('proof')") && onboarding.includes("else if(slide==='level')obGoto('practice')") && onboarding.includes("else if(slide==='rhythm')obGoto('ready')"), 'obNext enchaîne les étapes dans cet ordre');
assert(onboarding.includes("obEntry") && onboarding.includes('function obBack()'), 'chaque étape peut revenir en arrière');

console.log('\n--- La preuve avant les questions ---');
assert(onboarding.includes('ob-proof') && onboarding.includes('Tu pratiques sur SQLite'), 'l’étape de preuve annonce le vrai moteur SQL');
assert(onboarding.includes('function obRunPractice()') && onboarding.includes('db.exec('), 'l’étape de pratique exécute une vraie requête, pas une simulation');
assert(onboarding.includes('draft.practiceRows') && onboarding.includes('draft.practiceDone=draft.practiceRows.length>0'), 'la réussite dépend des lignes réellement renvoyées');
assert(/catch\(e\)\{\s*draft\.practiceRows=\[\];\s*draft\.practiceDone=false;/.test(onboarding), 'une erreur du moteur ne fait pas passer la pratique pour réussie');

console.log('\n--- Le compte ---');
assert(html.includes('window.REQUETE_AUTH'), 'l’authentification passe par un adaptateur externe, sans faux compte par défaut');
assert(onboarding.includes('Continuer sans compte') && onboarding.includes('Mode local et privé'), 'le mode sans compte reste le chemin immédiatement utilisable');
assert(onboarding.includes('function obChooseGuest()'), 'le choix « sans compte » est traité explicitement');

console.log('\n--- Le parcours produit à la fin ---');
assert(onboarding.includes('obRythmeMinutes(') && html.includes('state.plan=apercuPlan('), 'le rythme choisi alimente réellement le planning');
assert(onboarding.includes('Première leçon'), 'le récapitulatif final annonce la première leçon');
assert(html.includes('#onboarding.ob-ready-step'), 'la dernière étape a sa mise en page dédiée');

console.log('\n--- Accessibilité ---');
assert(html.includes('id="onboarding" role="dialog" aria-modal="true"') && html.includes('aria-hidden="true" inert'), 'la modale est masquée et inerte avant son ouverture');
assert(onboarding.includes("root.removeAttribute('aria-hidden')") && onboarding.includes("root.setAttribute('aria-hidden','true')"), 'la modale est rendue au lecteur d’écran à l’ouverture puis retirée à la fermeture');
assert(onboarding.includes('role="radiogroup"') && onboarding.includes('aria-checked='), 'les choix restent compréhensibles par les technologies d’assistance');
assert(onboarding.includes('aria-label="Retour"'), 'le bouton retour est nommé pour les technologies d’assistance');

console.log('\n--- L\'expérience dès la première seconde ---');
assert(onboarding.includes('function obRunWelcomeDemo()') && onboarding.includes('id="ob-demo-code"') && onboarding.includes("[\"'Paris';\",'s']"), 'l\'accueil tape une vraie requête du cours dans une console animée');
assert(onboarding.includes('4 clients habitent à Paris') && onboarding.includes('aria-hidden="true"><div class="ob-code"'), 'la console d\'accueil annonce le vrai résultat et reste décorative pour les lecteurs d\'écran');
assert(html.includes('#onboarding.ob-enter .ob-answer{animation:'), 'les réponses apparaissent en cascade à l\'entrée d\'une étape');
assert(onboarding.includes("classList.add('ob-selection-update')") && html.includes('.ob-selection-update .ob-answer.on'), 'choisir une réponse déclenche le pop de sélection');
assert(onboarding.includes('function obNamePreview()') && onboarding.includes('ob-name-preview'), 'le prénom saisi est renvoyé en aperçu immédiat');
assert(onboarding.includes('function obLevelHint()') && onboarding.includes('Tu commenceras par'), 'le niveau choisi révèle la vraie première leçon du plan');
assert(html.includes('.ob-practice-table span:not(.head){animation:'), 'les lignes du résultat SQL arrivent une par une');
assert(onboarding.includes('Ta séance type :') && html.includes('.ob-rhythm-summary'), 'le rythme choisi résume la séance type réelle');
assert(html.includes("if(obRoot&&obRoot.classList.contains('on')){"), 'l\'onboarding capte le clavier dès qu\'il est ouvert');
assert(html.includes("e.target.tagName==='INPUT'") && onboarding.includes('function brancherObSwipeV2()'), 'Entrée valide depuis le champ et le balayage tactile navigue entre les étapes');

console.log('\n--- Mouvement ---');
assert(html.includes('.ob-mini-progress i.on{animation:none}'), 'la réduction des mouvements couvre les animations de l’onboarding');
assert(!html.includes('.ob-foot{transform:translateY(-86px)}'), 'l’ancien décalage vertical fragile du pied de page a disparu');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
