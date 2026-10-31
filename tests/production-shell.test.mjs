#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';

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

assert((nav.match(/class="tab(?: active)?"/g) || []).length === 5, 'navigation principale à 5 onglets, Compte compris, libellés lisibles');
assert(!nav.includes('data-tab="jeu"') && !html.includes("['jeu','Duel entre amis'") && !html.includes('id="scr-jeu"') && html.includes('id="defis-join"') && html.includes('defi-how') && html.includes("['console','defis','jeu','practice'].includes(tab)"), 'Duel entre amis fusionné avec les Défis : même défi seul ou à plusieurs');
assert(nav.includes('data-tab="learn"') && nav.includes('<span class="tab-label">Accueil</span>'), 'Accueil reste la première destination');
assert(nav.includes('data-tab="planning"') && nav.includes('<span class="tab-label">Planning</span>') && html.includes('<h1>Planning</h1>'), 'Planning est accessible directement, sous un nom distinct de « Ton parcours »');
assert(nav.includes('data-tab="practice"') && nav.includes('>Pratiquer</span>'), 'Pratiquer est accessible directement');
assert(html.includes("['notes','Mes notes'") && !nav.includes('data-tab="notes"'), 'notes regroupées dans la bibliothèque');
assert(nav.includes('data-tab="library"') && nav.includes('>Bibliothèque</span>'), 'Bibliothèque est accessible directement');
assert(html.includes('id="coll-overview"') && html.includes('coll-overview-ring') && html.includes('aria-label="${pct}% des cartes débloquées"'), 'Cartes mémo présente la progression globale de la collection');
assert(html.includes('completedModules') && html.includes("module${completedModules>1?'s':''} complet") && html.includes('à obtenir</span>'), 'statistiques de collection calculées depuis les cartes réellement débloquées');
assert(html.includes('class="coll-grid"') && html.includes('class="coll-card') && html.includes('function startCardReview()') && html.includes('CARTES[l.id]&&isUnlocked(l.id)&&revisable(l)&&isDue(l.id)') && html.includes('À revoir aujourd’hui'), 'cartes en grille, état à revoir / acquise et révision du jour (pour une leçon à exercice : revisable)');
assert(html.includes("nextLesson=allLessons.find(l=>CARTES[l.id]&&!isUnlocked(l.id))") && html.includes('Prochaine carte') && html.includes('Voir la leçon'), 'prochaine carte reliée à sa leçon réelle');
assert(html.includes('class="coll-module ${complete?\'complete\':\'\'}"') && html.includes("const count=`${openN}/${avecCarte.length}`;"), 'modules de cartes compacts, avec leur avancement');
assert(html.includes("classList.add('collection-static')") && html.includes('.collection-static>.fbar'), 'filtres de cartes changés sans rejouer les animations de page');
assert(html.includes("['interview','Entretien SQL'") && !nav.includes('data-tab="entretien"'), 'entretien disponible dans la bibliothèque');
assert(html.includes('ent-readiness-stats') && html.includes('masteredTopics') && html.includes('À retravailler') && html.includes('Thèmes validés'), 'Entretien SQL présente une préparation calculée depuis les réponses réelles');
assert(html.includes('class="ent-group ent-topic${complete?\' complete\':\'\'}"') && html.includes("complete?'Validé'"), 'thèmes d’entretien compacts et explicitement validés');
assert(html.includes('class="ent-mastered-label">Maîtrisée</span>'), 'question maîtrisée porte un statut textuel explicite');
assert(html.includes("classList.add('entretien-static')") && html.includes('.entretien-static>.ent-status'), 'filtres d’entretien changés sans rejouer les animations de page');
assert(nav.includes('data-tab="compte"') && nav.includes('<span class="tab-label">Compte</span>') && nav.includes('class="tab-avatar" data-account-avatar') && html.includes("function openAccount(){switchTab('compte');}") && !html.includes('function closeAccount()') && !html.includes('class="learn-avatar') && !html.includes('lg-avatar" data-account-avatar'), 'Mon compte est le 5e onglet, avec l’initiale pour icône ; plus d’avatar en haut des écrans');
assert(!nav.includes('data-tab="console"'), 'Console reste accessible depuis l’accueil sans surcharger davantage le dock');
assert(nav.indexOf('data-tab="learn"') < nav.indexOf('data-tab="planning"') && nav.indexOf('data-tab="planning"') < nav.indexOf('data-tab="practice"'), 'ordre Accueil, Planning, Pratiquer conservé');
assert(html.includes('.tab{font-size:9.5px') && html.includes('.tab{font-size:9.1px'), 'libellés du dock agrandis aux deux tailles mobiles');
assert(html.includes('@media (min-width:481px)') && html.includes('.tab-label{height:21px;min-height:21px}'), 'libellés du dock alignés sur une zone commune en desktop');
const defisRoot = html.slice(html.indexOf('id="scr-defis"'), html.indexOf('id="scr-lesson"'));
const planningRoot = html.slice(html.indexOf('id="scr-planning"'), html.indexOf('id="scr-notes"'));
assert(defisRoot.includes('root-home-back') && planningRoot.includes('root-home-back'), 'Défis et Planning proposent un retour Accueil explicite');
assert((html.match(/class="home-back root-home-back"/g)||[]).length===6, 'retour cohérent sur les six pages concernées, « Selon le SGBD » et « Stickers » comprises (Mon compte est un onglet)');
assert(html.includes('function returnToHome()') && html.includes("title.focus({preventScroll:true})"), 'retour Accueil centralisé avec restitution accessible du focus');
assert(html.includes("function lessonBackLabel(){return ({planning:'Planning',defis:'Défis',practice:'Pratiquer',library:'Bibliothèque',jeu:'Défis'"), 'leçon renvoyée vers son écran d’origine avec un libellé clair');
assert(html.includes("label.textContent=focused?'Questions':'Bibliothèque'") && html.includes("focused?'Retour aux questions':'Retour à la bibliothèque'"), 'Entretien revient aux questions avant de revenir à la bibliothèque');
assert(html.includes('function returnToParent()') && html.includes("if(!parent||parent===activeTab||parent==='learn'){returnToHome();return;}"), 'les sous-pages reviennent à leur rubrique (Pratiquer, Bibliothèque)');
assert(html.includes('<link rel="stylesheet" href="design-premium.css') && serviceWorker.includes("'./design-premium.css'"), 'système de design chargé en dernier et disponible hors ligne');
assert(html.includes('<script src="design-premium.js') && serviceWorker.includes("'./design-premium.js'") && html.includes('window.pNavBack?.()'), 'barre de titre compacte et transitions de navigation chargées');
{
  /* Requête à trous : les cours « guide » la déclarent eux-mêmes (done.fill), les anciens cours la trouvent dans MISSION_FILLS. */
  const cfg=html.slice(html.indexOf('const MISSION_FILLS={'),html.indexOf('function lessonHasFill('));
  const legacy=(cfg.match(/^\s*(\d+):\{/gm)||[]).map(x=>+x.trim().replace(/:\{$/,''));
  const fctx=vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='),html.indexOf('let state=')),fctx);
  const allL=vm.runInContext('MODULES.flatMap(m=>m.lessons)',fctx),guideFills=vm.runInContext('GUIDE_FILLS',fctx);
  assert(allL.every(l=>l.video||guideFills[l.id]||legacy.includes(l.id)||l.gateFill), 'requête à trous de la mission sur tous les cours texte (cours en vidéo : la vidéo)');
  assert(allL.filter(l=>l.video).every(l=>!guideFills[l.id]), 'cours en vidéo : pas de requête à trous (pas de cours texte)');
  assert(html.includes('applyMissionFills();\n    initRunSqlSlots();') && html.includes('${missionFillBlock(l)}'), 'requête à trous générée avant les emplacements exécutables, ou ajoutée en fin de cours');
  assert(html.includes("return !!(l&&(l.gateJcQuiz||lessonHasFill(l)||lessonHasVideo(l))&&!etapesDe(l.id).exo&&!jcPassed(l.id));"), 'l’exercice reste verrouillé tant que la vidéo (ou la requête à trous du cours texte) n’est pas finie');
  assert(html.includes('swapped[g]=p.length===2') , 'chaque égalité a = b accepte les deux sens, même avec plusieurs égalités');
  assert(html.includes("const MASCOT_IMG='assets/mascotte-autocollant.webp'") && html.includes("mascotMedalHtml({kw:nxt==null?'COMMIT;':'SELECT'") && html.includes('<div class="ob-hello-stage">') && !html.includes('mascotte-coucou'), 'mascotte en autocollant sur l’accueil et l’écran de bienvenue (plus de vidéo à fond gris)');
  assert(serviceWorker.includes("url.pathname.endsWith('.mp4')") && serviceWorker.includes("'./assets/mascotte-autocollant.webp'"), 'vidéos laissées au navigateur (lecture par morceaux sur iOS), autocollant de la mascotte disponible hors ligne');
  assert(html.includes('.qf.is-won .qf-actions{visibility:hidden') && !html.includes('runWrap.scrollIntoView(') && html.includes('scr.scrollTo({top:anchor()'), 'résultat affiché à la place de l’éditeur, sans saut de mise en page');
}
assert(html.includes('id="scr-notes"') && html.includes('function renderNotesScreen('), 'Mes notes possède un écran racine dédié');
assert(html.includes('class="notes-overview"') && html.includes('data-notes-count') && html.includes('data-notes-pinned') && html.includes('data-notes-sql'), 'Mes notes présente un tableau de bord calculé depuis le carnet réel');
assert(html.includes("latest?`Dernière modification · ${fmtDate(latest.ts)}`") && html.includes('Prêt pour ta première note'), 'carnet adapte son prochain repère à son contenu');
/* Les trois amorces, sur l’écran des notes et dans la feuille (31 octobre : dans la feuille, elles gardent la leçon ou la requête en cours) */
assert(html.includes("${go}('Ce que je retiens : ')") && html.includes("${go}('Requête à revoir : ')") && html.includes("${go}('Question : ')") && html.includes("const go=isScreen?'startNotePrompt':'startNoteHere';"), 'carnet vide propose trois amorces pédagogiques');
assert(html.includes('function startNotePrompt(txt){ openNote(null,{txt:txt||\'\'}); }'), 'amorce ouvre directement une note préremplie');
assert(html.includes('.notes-hub.empty .searchbar{display:none}') && html.includes("classList.toggle('empty',!all.length)"), 'recherche masquée tant que le carnet est vide');
assert(!html.includes('function homeToolsHTML()') && !html.includes('class="journey-shortcuts"'), 'accueil sans raccourcis en double : Console et Cartes restent dans leurs onglets');
assert(html.includes("['console','Console SQL'") && html.includes("['cards','Cartes mémo'"), 'Console dans Pratiquer, Cartes mémo dans Bibliothèque');
assert(html.includes("switchTab('defis')") && html.includes("switchTab('entretien')"), 'Défis et Entretien restent accessibles depuis les outils');
assert(html.includes('function homePathPreviewHTML(') && html.includes('home-path-progress'), 'aperçu compact du parcours présent');
assert(html.includes('const session=recommendedSession();') && html.includes('session?.summary'), 'accueil fondé sur la séance et la durée communes');
assert(html.includes('class="module home-module ${complete') && html.includes('<summary class="home-module-summary">') && html.includes('Tous les cours'), 'long catalogue remplacé par des modules compacts consultables à la demande');
assert(html.includes('class="lesson-validation"') && html.includes('<em>Validé</em>'), 'chaque leçon terminée porte un libellé Validé explicite');
assert(html.includes("complete?'Toutes les leçons sont validées'") && html.includes('class="home-module-valid">Validé</em>'), 'un module porte Validé uniquement lorsque toutes ses leçons le sont');
/* Elisa, 31 octobre, 1 h 34 : « pour Défis : il n’y a pas de défis libres, d’entraînement libre, que la salle de défi (tirage au
   sort quand on rentre, parmi le niveau de difficulté) ». L’onglet ne garde que la salle, ses règles et rejoindre un ami. */
assert(html.includes('<div id="defis-room"></div>') && html.includes('<div id="defis-join" class="jeu"></div>') && html.includes('<div id="defis-rules"></div>'), 'Défis : la salle, rejoindre, les règles des points');
assert(!html.includes('function setDefisLevel(') && !html.includes('function defiListRow(') && !html.includes('id="defis-list"') && !html.includes('def-list-static'), 'plus d’entraînement libre ni de liste de défis dans l’onglet');
assert(html.includes('function renderDefis(){') && html.includes('renderDefisRoom();renderDefisJoin();renderDefisRules();'), 'l’onglet se dessine en trois blocs');
assert(html.includes('<li><b>🎯 Défi réussi</b><span>+${JEU_PTS_OK}</span></li>') && html.includes('<li><b>⚡ Rapidité</b><span>jusqu’à +${JEU_PTS_VITE}</span>'), 'règles des points écrites depuis les constantes de la salle');
assert(html.includes("function jeuChrono(ms){const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}"), 'chrono qui monte depuis 00:00');
assert(html.includes('<span class="room-stk" aria-hidden="true">${lqStkSvg(\'target\')}</span>') && html.includes('<h2 id="room-h">Entre dans la salle</h2>'), 'la salle, en tête de l’onglet, à la DA de l’appli');
assert(html.includes('function planOverviewHTML(st)') && html.includes('class="pgr-donut"') && html.includes('Avancement global') && html.includes('Prochain cap'), 'Parcours présente un résumé global, un pourcentage et la prochaine activité');
assert(html.includes('class="pgr-stats"') && html.includes('doneLessons') && html.includes('doneChallenges') && html.includes('class="pgr-bars"'), 'statistiques et graphique d’activité du parcours calculés depuis les leçons et défis réellement validés');
assert(html.includes('Les 7 prochains jours') && html.includes('pl-week-legend') && html.includes('weekComplete'), 'planning hebdomadaire annonce les séances prévues et validées');
assert(html.includes('class="pl-chip-valid"') && html.includes("<i aria-hidden=\"true\">✓</i>Validé"), 'activités terminées explicitement marquées Validé dans le planning');
assert(html.includes('Séance validée') && html.includes('dp-session-valid'), 'séance complète explicitement marquée validée');
assert(!html.includes('${planManageHTML(p)}'), 'réglage de rythme redondant retiré du bas du parcours');
assert(account.includes('acct-hero') && account.includes('class="acct-id"') && account.includes('Modifier mon profil') && account.includes('Mode local actif'), 'profil, niveau et mode de stockage explicites');
assert(account.includes('Ma progression') && account.includes('acct-stats') && account.includes('id="acct-progress"'), 'progression réelle regroupée dans une seule carte, atteignable depuis la série de l’accueil');
assert(html.includes('function accountLevel(percent)') && account.includes('acct-level-track') && account.includes('Prochain cap') && account.includes('Niveau ${level.rank}'), 'niveau SQL et prochain palier calculés depuis la progression réelle');
assert(account.includes('Tes 7 prochains jours') && account.includes('const date=addJ(auj(),i)') && !account.includes('const monday=') && account.includes('acct-week') && account.includes('weekComplete') && account.includes('LQ_MOON_SVG'), 'les 7 jours du planning à partir d’aujourd’hui (Elisa, 30 octobre : « c’est pas cette semaine, c’est aujourd’hui »), repos en lune comme à l’accueil');
assert(account.includes('Accomplissements') && account.includes('acct-badges') && account.includes('accomplissements()') && html.includes("label:'Première requête'") && !account.includes('<details class="account-subsection'), 'accomplissements visibles d’emblée, débloqués par des actions réelles (la même liste que les stickers)');
assert(account.includes('LQ_FLAME_SVG') && account.includes("accountStatIcon('lessons')") && account.includes("accountStatIcon('challenges')"), 'les trois chiffres utilisent des pictogrammes dédiés, la flamme de la série comme à l’accueil');
assert(!account.includes('🔥') && !account.includes("?'🔥':'○'"), 'aucun emoji dans Mon compte : pictogrammes SVG uniquement');
assert(!account.includes('account-goal-ring') && !account.includes('role="tablist"') && !html.includes('function setAccountSection('), 'une seule page : plus d’onglets internes ni d’anneau d’objectif en double avec l’accueil');
assert(account.includes('Apprentissage') && account.includes('Compte et assistance') && account.includes('Profil et objectif') && account.includes('Données et confidentialité') && account.includes('Aide et prise en main'), 'réglages essentiels regroupés en catégories explicites');
assert(html.includes('function closePlusDetails()') && account.includes('account-sheet-backdrop') && html.includes("querySelectorAll('#scr-compte .plus-details[open]')"), 'réglages détaillés ouverts dans un seul panneau focalisé et refermable');
assert(account.includes('Mode local actif') && account.includes('Connexion optionnelle') && account.includes("action:'exportProgress()'"), 'stockage local expliqué clairement, export de la progression en un appui');
assert(!account.includes('acc-premium') && !account.includes('4,99 €'), 'fausse offre Premium retirée du parcours de production');
assert(html.includes("const OB_PROFILE_SLIDES=['name','goal','level','rhythm','practice']") && html.includes("function obFlowSteps(){return obAuthReady()?[...OB_PROFILE_SLIDES,'account']:[...OB_PROFILE_SLIDES];}"), 'onboarding : 6 étapes, personnalisation d’abord puis sauvegarde du succès (compte sauté sans fournisseur branché)');
assert(html.includes("const OB_SLIDES = ['welcome','name','goal','level','rhythm','practice','account','ready']"), 'parcours cohérent : prouver, personnaliser, pratiquer, sauvegarder');
assert(html.includes('function obLevelPath()') && html.includes("const stages=['SELECT','Filtres & tris','Jointures','Analyses']") && onboarding.includes('${obLevelPath()}'), 'progression SQL illustrée par un chemin compact et accessible, réagissant au niveau choisi');
assert(onboarding.includes('ob-proof-stats') && onboarding.includes('<strong>${TOTAL}</strong><span>leçons courtes</span>') && onboarding.includes('<strong>${nDefis}</strong><span>défis SQL</span>'), 'preuves chiffrées reliées au contenu réel : nombre de leçons et de défis calculés, pas des chiffres fixes');
assert(onboarding.includes('Étape ${active+1} sur ${steps.length}') && onboarding.includes('const remaining='), 'étape et durée restante annoncées dynamiquement');
assert(onboarding.includes('Garde ta progression.') && onboarding.includes('Continuer sans compte'), 'choix du compte clair et mode invité prioritaire');
assert(onboarding.includes('authReady') && onboarding.includes('<small>Bientôt</small>'), 'fournisseurs indisponibles présentés honnêtement');
assert(onboarding.includes('Mode local et privé') && onboarding.includes('Progression sauvegardée sur cet appareil.'), 'bénéfice du mode local explicité');
assert(html.includes('function obRunPractice()') && onboarding.includes('Ta première requête.') && html.includes('db.exec("SELECT id, prenom, ville FROM clients WHERE ville = \'Paris\' ORDER BY id;")'), 'premier succès SQL exécuté sur la vraie base pendant l’onboarding');
assert(onboarding.includes('Tes 7 prochains jours') && onboarding.includes('Première leçon') && onboarding.includes('ob-ready-days'), 'écran final enrichi avec un plan de départ concret, calculé depuis le plan réellement généré');
assert(html.includes('@media (prefers-reduced-motion:reduce)') && html.includes('.plus-details-body'), 'nouvelles micro-interactions respectent la réduction des mouvements');
/* Les anciens cours « Clé primaire » et « Clé étrangère » sont fusionnés dans le cours 0 (vidéo et texte). */
assert(!html.includes('guide({ id:34,') && !html.includes('guide({ id:35,') && !html.includes('{ titre:"Clés et relations"'), 'les cours 34 et 35 et leur module ont disparu');
/* Le cours « SELECT » (choisir les colonnes, l’étoile, les virgules) a lui aussi rejoint le cours 0. */
assert(!html.includes('guide({ id:1,'), 'le cours 1 (SELECT) a disparu');
const introLesson = html.slice(html.indexOf('guide({ id:0, titre:"Les bases de données relationnelles"'), html.indexOf('guide({ id:2, titre:"Renommer avec AS"'));
/* Le cours 0 est une leçon seule (Elisa, 28 octobre : « mettre l’écran de fin de cours et enlever la partie quiz et exercice ») :
   ses cinq moments « À toi » le valident. */
assert(introLesson.includes('leconSeule:true') && !introLesson.includes('consigne:') && !introLesson.includes('solution:') && /moments:5,seuil:4\}/.test(introLesson), 'le cours 0 : leçon seule, validée par ses moments (un raté au plus)');
assert(html.includes("(4,'Nathan','Petit','5 rue Victor Hugo','Paris'") && html.includes("(10,'Nathan','Dupont','9 place du Marché','Paris'"), 'les deux Nathan de Paris existent dans les données SQLite');
assert(html.includes('{ id:12, titre:"LIMIT et OFFSET"') && html.includes('LIMIT 3 OFFSET 3'), 'pagination stable couverte par une leçon complète');
assert(html.includes('{ id:76, titre:"GROUP_CONCAT"') && html.includes('STRING_AGG'), 'agrégation de texte couverte avec ouverture multi-SGBD');
assert(html.includes('{ id:77, titre:"WITH RECURSIVE (CTE RECURSIVE)"') && html.includes('condition d’arrêt'), 'CTE récursives expliquées avec leur garde-fou');
assert(html.includes('{ id:78, titre:"LAG et LEAD"') && html.includes('PARTITION BY client_id'), 'comparaison aux lignes voisines couverte');
const glissantes = fs.readFileSync(path.join(ROOT, 'assets/anim/fenetres-glissantes.html'), 'utf8');
assert(html.includes('{ id:79, titre:"Fenêtres glissantes"') && ['UNBOUNDED PRECEDING', '2 PRECEDING', '2 FOLLOWING', 'CURRENT ROW'].every(c => glissantes.includes(c)) && html.includes('NTILE(4)'), 'cadres (dans la vidéo) et fonctions de fenêtre avancées (défi NTILE) couverts');
assert(html.includes("if(!compact&&learnScreen.scrollTop>72)") && html.includes("else if(compact&&learnScreen.scrollTop<=0)"), 'titre d’accueil stabilisé par deux seuils de défilement');
assert(serviceWorker.includes('requete-2026-10-31-defis-points-v2201') && html.includes('requete-2026-10-31-defis-points-v2201') && serviceWorker.includes("'./home-journey.css'"), 'cache et nouvelle feuille de style synchronisés');

console.log(`\n=== Résultat: ${passed} passés, ${failed} échoués ===\n`);
process.exit(failed ? 1 : 0);
