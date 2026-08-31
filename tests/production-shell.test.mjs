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

console.log('\n=== Socle de mise en production ===');
const navStart = html.indexOf('<nav class="tabbar"');
const navEnd = html.indexOf('</nav>', navStart);
const nav = html.slice(navStart, navEnd);
const accountStart = html.indexOf("function renderCompte(){");
const accountEnd = html.indexOf('function openLegal(', accountStart);
const account = html.slice(accountStart, accountEnd);
const onboardingStart = html.indexOf('function obFlowHeader(');
const onboardingEnd = html.indexOf('function finishOnboard(', onboardingStart);
const onboarding = html.slice(onboardingStart, onboardingEnd);

assert((nav.match(/class="tab(?: active)?"/g) || []).length === 7, 'navigation principale contient les 7 destinations demandées');
assert(nav.includes('data-tab="learn"') && nav.includes('<span class="tab-label">Accueil</span>'), 'Accueil reste la première destination');
assert(nav.includes('data-tab="planning"') && nav.includes('<span class="tab-label">Parcours</span>'), 'Parcours est accessible directement');
assert(nav.includes('data-tab="defis"') && nav.includes('<span class="tab-label">Défis</span>'), 'Défis est accessible directement');
assert(nav.includes('data-tab="notes"') && nav.includes('<span class="tab-label tab-label-stack"><span>Mes</span><span>notes</span></span>'), 'Mes notes devient un onglet permanent sur deux lignes');
assert(nav.includes('data-tab="collection"') && nav.includes('<span class="tab-label tab-label-stack"><span>Cartes</span><span>mémo</span></span>'), 'Cartes mémo reste lisible sur deux lignes');
assert(nav.includes('data-tab="entretien"') && nav.includes('<span class="tab-label tab-label-stack"><span>Entretien</span><span>SQL</span></span>'), 'Entretien SQL devient un onglet permanent sur deux lignes');
assert(nav.includes('data-tab="compte"') && nav.includes('<span class="tab-label tab-label-stack"><span>Mon</span><span>compte</span></span>'), 'Mon compte remplace le menu Plus sur deux lignes');
assert(!nav.includes('data-tab="console"'), 'Console reste accessible depuis l’accueil sans surcharger davantage le dock');
assert(nav.indexOf('data-tab="learn"') < nav.indexOf('data-tab="planning"') && nav.indexOf('data-tab="planning"') < nav.indexOf('data-tab="defis"'), 'ordre Accueil, Parcours, Défis conservé');
assert(html.includes('.tab{font-size:9.5px') && html.includes('.tab{font-size:9.1px'), 'libellés du dock agrandis aux deux tailles mobiles');
assert(html.includes('@media (min-width:481px)') && html.includes('.tab-label{height:21px;min-height:21px}'), 'libellés du dock alignés sur une zone commune en desktop');
const defisRoot = html.slice(html.indexOf('id="scr-defis"'), html.indexOf('id="scr-lesson"'));
const planningRoot = html.slice(html.indexOf('id="scr-planning"'), html.indexOf('id="scr-notes"'));
assert(defisRoot.includes('root-home-back') && planningRoot.includes('root-home-back'), 'Défis et Parcours proposent un retour Accueil explicite');
assert((html.match(/class="home-back root-home-back"/g)||[]).length===5, 'retour Accueil cohérent sur les cinq grandes pages concernées');
assert(html.includes('function returnToHome()') && html.includes("title.focus({preventScroll:true})"), 'retour Accueil centralisé avec restitution accessible du focus');
assert(html.includes("function lessonBackLabel(){return activeTab==='planning'?'Parcours':activeTab==='defis'?'Défis':'Accueil';}"), 'leçon renvoyée vers son écran d’origine avec un libellé clair');
assert(html.includes("label.textContent=focused?'Questions':'Accueil'") && html.includes("focused?'Retour aux questions':'Retour à l’accueil'"), 'Entretien revient aux questions avant de revenir à l’accueil');
assert(html.includes('id="scr-notes"') && html.includes('function renderNotesScreen('), 'Mes notes possède un écran racine dédié');
assert(html.includes('function homeToolsHTML()') && html.includes('Console SQL') && html.includes('Cartes mémo'), 'raccourcis pratiques ajoutés à l’accueil');
assert(html.includes("switchTab('defis')") && html.includes("switchTab('entretien')"), 'Défis et Entretien restent accessibles depuis les outils');
assert(html.includes('function homePathPreviewHTML(') && html.includes('home-path-progress'), 'aperçu compact du parcours présent');
assert(account.includes('account-identity') && account.includes('Mode sans compte'), 'identité et mode invité sont explicites');
assert(account.includes('Ma progression') && account.includes('account-stats-grid'), 'progression réelle structurée comme un tableau de bord');
assert(account.includes('Objectif du jour') && account.includes('account-goal-ring'), 'objectif du jour utilise les données du planning');
assert(account.includes('Profil et préférences') && account.includes('Données et confidentialité') && account.includes('Aide'), 'réglages essentiels regroupés dans Mon compte');
assert(account.includes('Mode local actif') && account.includes('Connexion optionnelle'), 'stockage local expliqué clairement');
assert(!account.includes('acc-premium') && !account.includes('4,99 €'), 'fausse offre Premium retirée du parcours de production');
assert(onboarding.includes("const steps=['account',...OB_PROFILE_SLIDES]"), 'progression onboarding inclut les 8 étapes réelles');
assert(onboarding.includes('Étape ${active+1} sur ${steps.length}') && onboarding.includes('≈ 1 min'), 'étape et durée restante annoncées');
assert(onboarding.includes('Garde ta progression.') && onboarding.includes('Continuer sans compte'), 'choix du compte clair et mode invité prioritaire');
assert(onboarding.includes('authReady') && onboarding.includes('<small>Bientôt</small>'), 'fournisseurs indisponibles présentés honnêtement');
assert(onboarding.includes('Mode local et privé') && onboarding.includes('Progression sauvegardée sur cet appareil.'), 'bénéfice du mode local explicité');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('.plus-details-body'), 'nouvelles micro-interactions respectent la réduction des mouvements');
assert(serviceWorker.includes('requete-2026-08-31-prod-shell-v220'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
