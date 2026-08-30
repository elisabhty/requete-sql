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
const plus = html.slice(accountStart, accountEnd);
const onboardingStart = html.indexOf('function obFlowHeader(');
const onboardingEnd = html.indexOf('function finishOnboard(', onboardingStart);
const onboarding = html.slice(onboardingStart, onboardingEnd);

assert((nav.match(/class="tab(?: active)?"/g) || []).length === 5, 'navigation principale limitée à 5 destinations');
assert(nav.includes('data-tab="learn"') && nav.includes('>Accueil</button>'), 'Accueil remplace le libellé Apprendre');
assert(nav.includes('data-tab="defis"') && nav.includes('data-tab="planning"'), 'Défis et Parcours restent deux espaces distincts');
assert(nav.includes('data-tab="console"') && nav.includes('data-tab="compte"'), 'Console et Plus sont accessibles directement');
assert(!nav.includes('data-tab="collection"') && !nav.includes('data-tab="entretien"'), 'outils secondaires retirés de la barre surchargée');
assert(html.includes('function homeToolsHTML()') && html.includes('Console SQL') && html.includes('Cartes mémo'), 'raccourcis pratiques ajoutés à l’accueil');
assert(html.includes("switchTab('defis')") && html.includes("switchTab('entretien')"), 'Défis et Entretien restent accessibles depuis les outils');
assert(html.includes('function homePathPreviewHTML(') && html.includes('home-path-progress'), 'aperçu compact du parcours présent');
assert(plus.includes('Apprendre autrement') && plus.includes('Entretien SQL') && plus.includes('Mes notes'), 'hub Plus réunit les modes d’apprentissage complémentaires');
assert(plus.includes('Mon espace') && plus.includes('Exporter mes données') && plus.includes('Confidentialité'), 'hub Plus réunit les réglages essentiels');
assert(plus.includes('plus-local-proof') && plus.includes('Tes données t’appartiennent'), 'stockage local expliqué clairement');
assert(!plus.includes('acc-premium') && !plus.includes('4,99 €'), 'fausse offre Premium retirée du parcours de production');
assert(onboarding.includes("const steps=['account',...OB_PROFILE_SLIDES]"), 'progression onboarding inclut les 8 étapes réelles');
assert(onboarding.includes('Étape ${active+1} sur ${steps.length}') && onboarding.includes('≈ 1 min'), 'étape et durée restante annoncées');
assert(onboarding.includes('Garde ta progression.') && onboarding.includes('Continuer sans compte'), 'choix du compte clair et mode invité prioritaire');
assert(onboarding.includes('authReady') && onboarding.includes('<small>Bientôt</small>'), 'fournisseurs indisponibles présentés honnêtement');
assert(onboarding.includes('Mode local et privé') && onboarding.includes('Progression sauvegardée sur cet appareil.'), 'bénéfice du mode local explicité');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('.plus-details-body'), 'nouvelles micro-interactions respectent la réduction des mouvements');
assert(serviceWorker.includes('requete-2026-08-30-prod-shell-v209'), 'cache de production renouvelé');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
