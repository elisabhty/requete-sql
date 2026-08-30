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

assert((nav.match(/class="tab(?: active)?"/g) || []).length === 5, 'navigation principale limitée à 5 destinations');
assert(nav.includes('data-tab="learn"') && nav.includes('<span class="tab-label">Accueil</span>'), 'Accueil reste la première destination');
assert(nav.includes('data-tab="notes"') && nav.includes('<span class="tab-label">Mes notes</span>'), 'Mes notes devient un onglet permanent');
assert(nav.includes('data-tab="collection"') && nav.includes('<span class="tab-label">Cartes mémo</span>'), 'Cartes mémo devient un onglet permanent');
assert(nav.includes('data-tab="entretien"') && nav.includes('<span class="tab-label">Entretien SQL</span>'), 'Entretien SQL devient un onglet permanent');
assert(nav.includes('data-tab="compte"') && nav.includes('<span class="tab-label">Mon compte</span>'), 'Mon compte remplace le menu Plus');
assert(!nav.includes('data-tab="defis"') && !nav.includes('data-tab="planning"') && !nav.includes('data-tab="console"'), 'Défis, Parcours et Console quittent la barre du bas');
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
assert(serviceWorker.includes('requete-2026-08-30-prod-shell-v213'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
