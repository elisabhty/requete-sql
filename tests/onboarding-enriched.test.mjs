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
assert(html.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','promise','pact','practice','account','source','rappel','widget','widgetTuto','pseudo','ready']"), 'les étapes du parcours sont déclarées dans l’ordre (la mini-page du pseudo avant la dernière page : 17 h 53, puis 4 novembre, 2 h 13) ; l’âge et la profession après le prénom (3 novembre, 13 h 25)');
assert(onboarding.includes("if(slide==='welcome')obGoto('name')") && onboarding.includes("else if(slide==='rhythm')obGoto('jours')") && onboarding.includes("else if(slide==='jours')obGoto('build')") && onboarding.includes("else if(slide==='pact')obGoto('practice')") && onboarding.includes("else if(slide==='practice')obGoto(obAfterPractice())"), 'obNext enchaîne les étapes dans cet ordre (compte sauté sans fournisseur, vers ready directement)');
assert(onboarding.includes("obEntry") && onboarding.includes('function obBack()'), 'chaque étape peut revenir en arrière');

console.log('\n--- La cohérence du tunnel ---');
/* L’âge et la profession étaient des étapes mortes (jamais atteintes), retirées ; Elisa les redemande le 3 novembre, 13 h 25 : ce sont
   maintenant de vraies étapes, atteintes après le prénom. « source » revient le 4 novembre, 3 h 54, à la fin du parcours. */
assert(onboarding.includes("else if(slide==='name')obGoto('pays')") && onboarding.includes("else if(slide==='pays')obGoto('age')") && onboarding.includes("else if(slide==='age')obGoto('job')") && onboarding.includes("else if(slide==='job')obGoto('goal')") && onboarding.includes("}else if(slide==='source'){") && onboarding.includes("const OB_FIN_SLIDES=['source','rappel'];") && onboarding.includes("const OB_WIDGET_SLIDES=['widget','widgetTuto'];"), 'l’âge et la profession sont de vraies étapes ; « source » revient, à la fin, après la première requête (4 novembre, 3 h 54 : « Comment as-tu connu Requête ? »)');
assert((()=>{const flow=(html.match(/const OB_SLIDES = \[([^\]]+)\]/)||[])[1]||'';return flow.indexOf('practice')<flow.indexOf('account')&&flow.indexOf('account')<flow.indexOf('ready');})(), 'le compte est proposé après le premier succès SQL et avant l’écran final');
assert(onboarding.indexOf('Garde ta <em>progression</em>.')>0&&onboarding.indexOf('Garde ta <em>progression</em>.')<onboarding.indexOf('Ton parcours est prêt'), 'la sauvegarde du succès précède l’écran final');
assert((onboarding.match(/obGoto\('ready'\)/g)||[]).length===1 && (onboarding.match(/obGoto\(obFinSuivante\('account'\)\)/g)||[]).length===2 && onboarding.includes("function obFinSuivante(slide){const f=obFinFlux(),i=f.indexOf(slide);return i>=0&&i<f.length-1?f[i+1]:'ready';}"), 'sans compte ou connecté, la connexion mène à la suite du tunnel, qui se termine sur l’écran final (après la mini-page du pseudo, 4 novembre, 2 h 13 ; la connexion juste après la première requête, 10 h 45)');
assert(onboarding.includes("obSetFooter('Continuer',()=>obGoto('jours'),'','','');") && onboarding.includes("obSetFooter('Construire mon parcours',()=>obGoto('build')"), 'le rythme mène aux jours par semaine (4 novembre, 9 h 36), puis à la construction du parcours (13 h 46) et à la pratique, pas directement au récapitulatif');
assert(onboarding.includes('function obLevelPath()') && onboarding.includes("const stages=['SELECT','Filtres & tris','Jointures','Analyses']"), 'l’échelle de progression éclaire le choix du niveau');

console.log('\n--- La preuve dès l’accueil ---');
assert(onboarding.includes('ob-proof-stats') && onboarding.includes('${TOTAL}') && onboarding.includes("db.exec(\"SELECT COUNT(*) FROM clients WHERE ville = 'Paris';\")"), 'l’accueil prouve le contenu réel : chiffres calculés depuis la base et le catalogue, jamais codés en dur');
assert(onboarding.includes('function obRunPractice()') && onboarding.includes('db.exec('), 'l’étape de pratique exécute une vraie requête, pas une simulation');
assert(onboarding.includes('draft.practiceRows') && onboarding.includes('draft.practiceDone=draft.practiceRows.length>0'), 'la réussite dépend des lignes réellement renvoyées');
assert(/catch\(e\)\{\s*draft\.practiceRows=\[\];\s*draft\.practiceDone=false;/.test(onboarding), 'une erreur du moteur ne fait pas passer la pratique pour réussie');

console.log('\n--- Le compte ---');
assert(html.includes('window.REQUETE_AUTH'), 'l’authentification passe par un adaptateur externe, sans faux compte par défaut');
/* Elisa, 4 novembre, 10 h 29 : « enlève le mode local, on ne va pas prendre cette option, car on a le paywall qui arrive après ». */
assert(!onboarding.includes('Continuer sans compte') && !onboarding.includes('Mode local et privé') && !onboarding.includes('function obChooseGuest()'), 'plus de mode sans compte : le paywall vient après');
assert(onboarding.includes('function obPasserConnexion(){\n  if(obAuthReady())return;'), 'tant que la connexion n’est pas branchée, « Continuer » passe la page ; ensuite, le compte est le seul chemin');

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
assert(onboarding.includes("${plur(nParis,'client')} à Paris") && onboarding.includes('aria-hidden="true"><div class="ob-code"'), 'la console d\'accueil annonce le vrai résultat et reste décorative pour les lecteurs d\'écran');
assert(html.includes('#onboarding.ob-enter .ob-answer{animation:'), 'les réponses apparaissent en cascade à l\'entrée d\'une étape');
assert(onboarding.includes("classList.add('ob-selection-update')") && html.includes('.ob-selection-update .ob-answer.on'), 'choisir une réponse déclenche le pop de sélection');
assert(onboarding.includes('function obNamePreview()') && onboarding.includes('ob-name-preview'), 'le prénom saisi est renvoyé en aperçu immédiat');
/* 3 novembre, 23 h 21 (Elisa) : « ne parle pas de commencer par Les bases de données relationnelles, mets juste le cadre du bas » */
assert(!onboarding.includes('function obLevelHint()') && !onboarding.includes('${obLevelHint()}') && onboarding.includes('${obLevelPath()}'), 'le niveau ne montre plus que le chemin, sans « Tu commenceras par la leçon… »');
assert(html.includes('.ob-practice-table span:not(.head){animation:'), 'les lignes du résultat SQL arrivent une par une');
assert(onboarding.includes('Ta séance type :') && html.includes('.ob-rhythm-summary'), 'le rythme choisi résume la séance type réelle');
assert(html.includes("if(obRoot&&obRoot.classList.contains('on')){"), 'l\'onboarding capte le clavier dès qu\'il est ouvert');
assert(html.includes("e.target.tagName==='INPUT'") && onboarding.includes('function brancherObSwipeV2()'), 'Entrée valide depuis le champ et le balayage tactile navigue entre les étapes');

console.log('\n--- Mouvement ---');
assert(html.includes('.ob-mini-progress i.on{animation:none}'), 'la réduction des mouvements couvre les animations de l’onboarding');
assert(!html.includes('.ob-foot{transform:translateY(-86px)}'), 'l’ancien décalage vertical fragile du pied de page a disparu');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
