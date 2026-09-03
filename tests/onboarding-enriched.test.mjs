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

const start = html.indexOf('/* Onboarding production v3.');
const end = html.indexOf('function celebrate(){', start);
const onboarding = html.slice(start, end);

console.log('\n=== Onboarding enrichi et personnalisé ===');
assert(html.includes("const OB_SLIDES = ['welcome','practice','account','name','goal','age','job','source','level','rhythm','frequency','ready']"), 'découverte et fréquence font partie du flux complet');
assert(onboarding.includes('Essaie ta première requête.') && onboarding.includes('Affiche le nom de chaque client.'), 'la promesse du produit est démontrée avant les questions');
assert(onboarding.includes("function obPickDemo(val)") && onboarding.includes("obDemoChoice==='nom'"), 'la mini-requête possède un vrai état interactif');
assert(onboarding.includes('Bien joué ! La requête renvoie les noms.') && onboarding.includes('… 6 autres clients'), 'la correction immédiate et le résultat incomplet sont explicites');
assert(onboarding.includes("const providers=authReady?") && onboarding.includes('Connexion multi-appareils'), 'la connexion réelle reste branchable sans afficher trois faux boutons actifs');
assert(onboarding.includes('Continuer sans compte') && onboarding.includes('Mode local et privé'), 'le mode sans compte reste le chemin immédiatement utilisable');
assert(onboarding.includes('OB_GOAL_DETAILS') && onboarding.includes('Fondations solides · vocabulaire métier · pratique régulière'), 'l’objectif sélectionné reçoit une explication concrète');
assert(onboarding.includes("else if(slide==='frequency')") && onboarding.includes('[2,3,5,7].map'), 'la fréquence hebdomadaire devient un vrai choix du planning');
assert(onboarding.includes('ob-week-days') && onboarding.includes('PATTERN[freq]'), 'le rythme choisi produit un aperçu des jours de séance');
assert(onboarding.includes("if(!draft.freq)draft.freq=3") && onboarding.includes('state.plan=apercuPlan(draft.niveau,draft.rythme,draft.freq)'), 'la fréquence choisie est réellement enregistrée dans le parcours');
assert(onboarding.includes('des défis séparés') && onboarding.includes('Première leçon'), 'le résumé final distingue les défis du contenu de cours');
assert(onboarding.includes('role="radiogroup"') && onboarding.includes('aria-checked='), 'les choix restent compréhensibles par les technologies d’assistance');
assert(html.includes('id="onboarding" role="dialog" aria-modal="true"') && html.includes('aria-hidden="true" inert'), 'la modale est masquée et inerte avant son ouverture');
assert(onboarding.includes("stage.inert=true") && onboarding.includes("stage.inert=false"), 'l’application en arrière-plan est neutralisée puis restaurée');
assert(onboarding.includes("title.focus({preventScroll:true})"), 'le focus suit le titre de chaque nouvelle étape');
assert(onboarding.includes("selected.focus({preventScroll:true})"), 'le focus reste sur le choix après une mise à jour interactive');
assert(html.includes('.ob-demo-result{') && html.includes('@keyframes obDemoReveal'), 'la réussite de la démo possède une micro-animation dédiée');
assert(onboarding.includes("paintOb(true)") && html.includes('#onboarding.ob-selection-update .ob-screen{animation:none}'), 'un changement de choix ne rejoue pas toute l’animation de page');
assert(html.includes('.ob-demo-result,.ob-selection-update .ob-answer.on,.ob-selection-update .ob-frequency-option.on{animation:none}'), 'la réduction des mouvements couvre les nouveaux effets');
assert(html.includes('#onboarding.ob-ready-step .ob-screen.ready{justify-content:center}') && onboarding.includes("slide==='ready'&&!obLegalMode"), 'le récapitulatif final répartit le vide plutôt que de créer un grand trou');
assert(!html.includes('.ob-foot{transform:translateY(-86px)}'), 'l’ancien décalage vertical fragile du pied de page a disparu');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
