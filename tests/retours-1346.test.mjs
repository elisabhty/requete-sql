/* Elisa, 1er novembre, 13 h 46 : défis filtrés d’abord selon le niveau de la personne (sans rien enlever) ; la photo détourée dans
   la bulle de la première leçon ; « Voir » animé ; la barre Schéma dans le premier cadre de la Console. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const lecon = fs.readFileSync(new URL('../assets/anim/bases-relationnelles.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la salle de défi se place au niveau de la personne, les trois niveaux restent choisissables', () => {
  const ctx = vm.createContext({ rank: 1, niveauCompte: () => ({ rank: ctx.rank }), jeuChallenges: () => [1] });
  vm.runInContext(cut('function jeuNivAuto(){', '\n}') + '\n}', ctx);
  const auto = r => { ctx.rank = r; return vm.runInContext('jeuNivAuto()', ctx); };
  assert.deepEqual([1, 2, 3, 4, 5].map(auto), ['f', 'm', 'm', 'd', 'd']);
  assert.ok(app.includes('  if(!jeuNivUser)jeuNiv=jeuNivAuto();'), 'tant qu’on n’a pas choisi soi-même');
  assert.ok(app.includes("if(k==='niv'){jeuNiv=v;jeuNivUser=true;}"), 'un niveau touché est retenu');
  assert.ok(app.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Niveau recommandé</em>':''}"));
  assert.ok(css.includes('html.lq .room-level .room-lv-auto{position:absolute;'));
});

test('la bulle de la première leçon porte le portrait détouré', () => {
  assert.ok(fs.existsSync(new URL('../assets/anim/formatrice.webp', import.meta.url)));
  assert.ok(lecon.includes('#cap .cap-stk{background:url(formatrice.webp) 50% 0/134px 134px no-repeat,'));
  assert.ok(sw.includes("'./assets/anim/formatrice.webp',"), 'hors ligne aussi');
});

test('Console : la barre Schéma dans la carte du projet, « Voir » qui s’anime', () => {
  assert.ok(app.includes("if(inWork&&sum.parentElement!==hero)hero.appendChild(sum);"));
  assert.ok(app.includes("if(consoleSchemaOpen&&consoleProjectPanel!=='editor'&&typeof setConsoleProjectPanel==='function')setConsoleProjectPanel('editor');"));
  assert.ok(css.includes('html.lq #scr-console .console-schema-summary:not(.open) .console-schema-action{animation:voirNudge 2.8s'));
  assert.ok(css.includes('html.lq #scr-console .console-title-row.is-project .console-schema-summary.in-hero{width:100%;'));
});

test('avant un cours, sa page de départ dans la DA du site, avec un seul bouton « Commencer »', () => {
  const open = cut('function openLesson(id, restoreStep){', '/* « Quel JOIN choisir ? »');
  assert.ok(open.includes("if(!restoringNav&&typeof lessonStartShow==='function'){"), 'pas lors d’une reprise automatique');
  assert.ok(open.includes('lessonStartShow(l,()=>{if(current===l&&lessonStep===0&&lessonVideoOn(l))openLessonVideo();});'), 'la vidéo démarre au « Commencer »');
  /* 2 novembre, 1 h 06 : une leçon validée s’ouvre sur « Voir le bilan », coché */
  assert.ok(open.includes("<button type=\"button\" class=\"lst-go${done?' is-done':''}\">${done?'<i class=\"lst-ok\" aria-hidden=\"true\">✓</i>':''}<span>${done?'Voir le bilan':started?'Continuer':'Commencer'}</span>${DEF_CHEV_SVG}</button>"));
  assert.ok(open.includes("<p class=\"lst-kicker\">${m?`Module ${mi+1} · ${esc(m.titre)}`:'Cours'}</p>"));
  assert.ok(open.includes('<ol class="lst-plan">'), 'ce que tu vas faire, dans l’ordre');
  assert.ok(css.includes('.lst-card{position:relative;isolation:isolate;overflow:visible;padding:26px 22px 30px;border-radius:30px;background:var(--deep);'));
  assert.ok(css.includes('.lst-go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:62px;'));
});

test('onboarding : le parcours qui se construit, la promesse en grand chiffre, l’engagement signé ; tout tient sur un écran', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','promise','pact','practice','account','source','rappel','widget','widgetTuto','pseudo','ready'];"));
  const ob = cut('function obPlanInfo(){', 'function obRhythmSummary(){');
  assert.ok(ob.includes("const days=Math.max(1,Math.round((parseD(last)-auj())/864e5)+1);"), 'le nombre de jours vient du plan réellement généré');
  assert.ok(ob.includes("if(ink>40){"), 'une vraie signature, pas un point');
  assert.ok(ob.includes("for(const c of C){") && app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4','ob-fit-5'];"), 'se resserre par paliers tant que ça déborde');
  assert.ok(app.includes('<div class="ob-big" aria-hidden="true"><b id="ob-big-n" data-n="${b.days}">${b.days}</b><span>jours</span></div>'));
  /* 3 novembre, 13 h 25 : « Mon engagement personnel » à la place de « Mon contrat d’apprentissage » (tests/onboarding-age-profession.test.mjs) */
  assert.ok(app.includes('<p class="ob-pact-k">Mon engagement personnel</p>'));
  assert.ok(app.includes("obSetFooter('Je m’engage',()=>{draft.pacteAt=Date.now();obGoto('practice');},'Plus tard',()=>obGoto('practice'),'',!draft.pacte);"), '« Je m’engage » s’allume une fois signé');
  assert.ok(app.includes("...(draft.pacte?{pacte:{at:draft.pacteAt||Date.now(),sig:draft.pacte}}:{})"), 'la signature reste sur l’appareil, dans le profil');
  const v = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  for (const part of ['html #onboarding.ob-vitrine .ob-big b{font:800 clamp(120px,40vw,168px)/.9 var(--v-display);', 'html #onboarding.ob-vitrine .ob-pact-card{position:relative;',
    'html #onboarding.ob-vitrine .ob-build-path span.is-start{background:var(--v-sun);', 'html #onboarding.ob-vitrine.ob-fit-3 .ob-chat{display:none!important}'])
    assert.ok(v.includes(part), part);
});

test('14 h 33 : un seul cadre pour « Pas encore » et l’indice ; en salle, les indices à la même minute pour tous ; la base dans la barre', () => {
  assert.ok(app.includes("${coach?'<div id=\"hint-slot\"></div>':''}"), 'la carte des indices');
  assert.ok(app.includes("if(isDefi&&COACH&&COACH.c===current){setLessonOut(table);COACH.diag=diag;COACH.fx='is-new-ko';}"), 'défi seul');
  assert.ok(app.includes('const due=JEU_IND_T.filter(t=>Date.now()-r.t1>=t).length;'), 'en salle : le temps de la manche, le même pour tous');
  assert.ok(app.includes("pour tout le monde dans <b id=\"coach-cd\">${jeuChrono(next)}</b>"));
  assert.ok(app.includes("<span class=\"l-kicker\">Manche ${n+1}/${J.nb} · ${JEU_NIVL[c.niv]}${defiBaseId(c)?` · Base ${esc(DEFI_BASES[defiBaseId(c)].nom)}`:''}</span>"));
  for (const part of ['html.lq .coach.is-new-ko .coach-st{animation:coachKo .45s ease}', 'html.lq .coach-dot.is-cur{transform:scale(1.3);', 'html.lq .coach-tag{flex:none;padding:4px 10px;border-radius:99px;background:var(--sun);'])
    assert.ok(css.includes(part), part);
});

test('14 h 43 : la croix de la page de départ ramène à l’accueil ; « Gagne des stickers et des cartes mémo »', () => {
  const open = cut('function lessonStartShow(l,go){', '\n}\n');
  assert.ok(open.includes("if(!ok)leaveLessonScreen('learn',true);"));
  assert.ok(open.includes("plan.push(['Gagne des stickers et des cartes mémo','À collectionner : chaque cours terminé en débloque de nouveaux.']);"));
});

test('14 h 56 : l’étape 1 dit, pour tous les cours, « Avance à ton rythme et mets la vidéo en pause quand tu veux. »', () => {
  assert.ok(app.includes("plan.push(['Regarde le cours','Avance à ton rythme et mets la vidéo en pause quand tu veux.']);"));
});

test('15 h 12 : la page de départ tient sur un écran, sans défilement ; elle se resserre par paliers comme l’onboarding', () => {
  const open = cut('function lessonStartShow(l,go){', '\n}\n');
  assert.ok(open.includes('lstFit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(lstFit);'));
  assert.ok(app.includes("const C=['lst-fit-1','lst-fit-2','lst-fit-3','lst-fit-4','lst-fit-5'];"));
  assert.ok(app.includes("window.addEventListener('resize',()=>{if(document.getElementById('lesson-start'))lstFit();});"));
  const i = css.indexOf('/* 55b'); assert.ok(i > 0);
  assert.ok(css.slice(i).includes('.lst{overflow:hidden}'), 'plus de barre de défilement');
  for (const lv of ['.lst.lst-fit-1 ', '.lst.lst-fit-2 ', '.lst.lst-fit-3 ', '.lst.lst-fit-4 ', '.lst.lst-fit-5 ']) assert.ok(css.includes(lv), lv);
});

test('15 h 12 : l’onboarding repasse son ajustement une fois polices, images et démo posées ; 4e palier ; « Bientôt » ne couvre plus le texte', () => {
  assert.ok(app.includes('  body.scrollTop=0;\n  obFitSoon();'));
  assert.ok(app.includes("[350,900,1800].forEach(t=>setTimeout(again,t));"));
  assert.ok(app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4','ob-fit-5'];"), '4e palier, puis un 5e pour l’engagement (3 novembre)');
  const ob = fs.readFileSync(new URL('../onboarding-vitrine.css', import.meta.url), 'utf8');
  assert.ok(ob.includes('html #onboarding.ob-vitrine.ob-fit-4 .ob-sign{height:78px;margin-top:10px}'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-provider{grid-template-columns:28px minmax(0,1fr) auto!important;'));
});

test('15 h 36 : page de départ pour tous les cours, la croix va droit à l’accueil, espacements réguliers', () => {
  assert.ok(app.includes("  if(!restoringNav&&typeof lessonStartShow==='function'){"), 'aussi quand on arrive par une étape précise');
  const open = cut('function lessonStartShow(l,go){', '\n}\n');
  assert.ok(open.includes("if(!ok)leaveLessonScreen('learn',true);"), 'l’accueil se met en place sans la glissade du cours');
  assert.ok(app.includes("if(!scr||!target||prefersReduceMotion()||restoringNav||instant){ finish(); return; }"));
  assert.ok(app.includes("root.classList.toggle('lst-scroll',need()>root.clientHeight);"), 'filet : défiler plutôt que couper');
  const i = css.indexOf('/* 55d'); assert.ok(i > 0);
  assert.ok(css.slice(i).includes('.lst{justify-content:center;gap:18px}'));
});

test('15 h 36 : la carte des indices dans la DA, juste après la question ; « À toi de jouer » qui se retourne en indice', () => {
  const eb = cut('const editorBlock=(withViz,fname=', '\n};');
  assert.ok(eb.indexOf("${coach?'<div id=\"hint-slot\"></div>':''}") < eb.indexOf('<div class="editor-shell">'), 'la carte au-dessus de l’éditeur');
  assert.ok(!app.includes('La syntaxe reste à construire par toi.'), 'la phrase d’aide passe dans la carte');
  const f = cut('function defiIndicesHTML(c,n,view,diag,next,kind){', '\n}\n');
  assert.ok(f.includes('<span class="coach-tag is-go">À toi de jouer<i class="coach-caret" aria-hidden="true"></i></span>'));
  assert.ok(f.includes('<span class="coach-tag is-hint">Indice ${v}/3</span>'));
  assert.ok(f.includes("room?'':' Un nom de colonne te manque&nbsp;? Touche <b>Schéma</b>."), 'en salle, pas de promesse d’indice par essai');
  assert.ok(app.includes("coachPeek(card,COACH.fx==='is-new-hint');"), 'une pastille ramène à la carte si elle est hors de l’écran');
  for (const part of ['html.lq .coach.is-new-hint .coach-tag.is-hint{animation:coachFlip .6s var(--pop) both}', 'html.lq .coach-caret{', 'html.lq .coach-st-k{flex:none;padding:3px 9px;border-radius:99px;background:#E0457B;'])
    assert.ok(css.includes(part), part);
});

test('15 h 57 : « Commencer » à la première ouverture d’un cours, « Continuer » ensuite', () => {
  const ctx = vm.createContext({ state: {}, saved: 0, save() { ctx.saved++; }, lecCompletee: () => false, nbFaites: () => 0 });
  const open = cut('function lessonStartShow(l,go){', '  const chips=[];');
  vm.runInContext(open.replace('function lessonStartShow(l,go){', 'function t(l){').replace(/document\.getElementById\('lesson-start'\)\?\.remove\(\);/, '').replace(/const m=moduleDeLecon[^\n]*\n/, '') + 'return started;}', ctx);
  assert.equal(vm.runInContext('t({id:7})', ctx), false, 'première fois : Commencer');
  assert.equal(vm.runInContext('t({id:7})', ctx), true, 'ensuite : Continuer');
  assert.equal(vm.runInContext('t({id:8})', ctx), false);
  assert.equal(ctx.saved, 2, 'retenu sur l’appareil');
});

test('16 h : une feuille versionnée n’est servie du cache que sous sa version exacte ; cartes de niveau resserrées', () => {
  assert.ok(sw.includes('const versionne = /[?&]v=/.test(url.search);') && sw.includes('const hit = await cache.match(req, { ignoreSearch: !versionne });'));
  assert.ok(sw.includes("return (versionne && await cache.match(req, { ignoreSearch: true })) || Response.error();"), 'hors ligne, l’ancienne copie dépanne');
  assert.ok(css.includes('html.lq .room-level{min-height:0!important;justify-content:center;gap:6px;padding:13px 6px 13px!important}'));
});

test('16 h 03 : le clavier « Insérer » ne pose plus d’espace en trop', () => {
  const src = cut('function insertKey(k,schemaKind){', '\nlet kbarOpenH');
  const ctx = vm.createContext({ activeTA: null, kbarTokenAt: () => null, kbarKeyNorm: k => k.replace(/\(\*\)/g, '').replace(/[()';%]/g, '').trim().toUpperCase(), kbarClauseContext: () => ({ kind: 'column' }), Event: class { constructor(t) { this.type = t; } } });
  vm.runInContext(src, ctx);
  const tape = (v, k, at = v.length, kind = '') => {
    const ta = { value: v, selectionStart: at, selectionEnd: at, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; }, dispatchEvent() {}, focus() {} };
    ctx.activeTA = ta; vm.runInContext(`insertKey(${JSON.stringify(k)},${JSON.stringify(kind)})`, ctx);
    return ta.value.slice(0, ta.selectionStart) + '|' + ta.value.slice(ta.selectionStart);
  };
  assert.equal(tape('SELECT ', 'COUNT(*)'), 'SELECT COUNT(*)|', 'pas d’espace après une fonction');
  assert.equal(tape('SELECT COUNT(*)', ','), 'SELECT COUNT(*), |');
  assert.equal(tape('SELECT nom ', ','), 'SELECT nom, |', 'la virgule efface l’espace laissé avant elle');
  assert.equal(tape('SELECT *', 'FROM'), 'SELECT * FROM |', 'un mot-clé garde son espace après');
  assert.equal(tape('SELECT * ', 'FROM'), 'SELECT * FROM |');
  assert.equal(tape('SELECT  nom', 'FROM', 7), 'SELECT FROM| nom', 'pas de second espace si un espace suit déjà');
  assert.equal(tape('SELECT ', 'SUM()'), 'SELECT SUM(|)');
  assert.equal(tape('SELECT COUNT(', 'nom', 13, 'column'), 'SELECT COUNT(nom|', 'dans une parenthèse, ni avant ni après');
  assert.equal(tape('SELECT COUNT(nom ', ')'), 'SELECT COUNT(nom)|');
});

test('16 h 26 : dans « Clés et relations », le premier CREATE TABLE annonce qu’on apprendra à l’écrire au module suivant', () => {
  const cles = fs.readFileSync(new URL('../assets/anim/projet-cles.html', import.meta.url), 'utf8');
  assert.ok(cles.includes("a += sqlCard('sq-pk', SQL.pk, 64, 952, 'Tu apprendras à créer ces tables dans le prochain module.');"));
  assert.ok(cles.includes('${note ? `<div class="sq-note"><span class="emo">✍️</span>${note}</div>` : \'\'}'));
});

test('16 h 31 : recharger pendant un défi ne fait plus perdre l’avancée', () => {
  assert.ok(app.includes("const DEFI_SES_KEY='rq-defi-en-cours';"));
  const open = cut('function openChallenge(cid){', '\nfunction startReview(');
  assert.ok(open.includes('const ses=restoringNav?defiSesRead():null;'), 'seulement au rechargement');
  assert.ok(open.includes('Date.now()-ses.t0<JEU_ROUND_MS'), 'tant qu’il reste du temps');
  assert.ok(open.includes('defiChronoStart(c,reprise?reprise.t0:0);'), 'le chrono reprend à son heure de départ');
  assert.ok(app.includes("else if(taId==='ed-lesson'&&current&&mode==='defi'){defiSesSave();}"), 'la requête est gardée à la frappe');
  assert.ok(app.includes("if(COACH.kind==='solo'&&typeof defiSesSave==='function')defiSesSave();"), 'les indices et le « Pas encore » aussi');
  assert.ok(app.includes("el.classList.add('is-ok');defiChronoStop();defiSesClear();return;"), 'un défi réussi repart de zéro');
});

test('16 h 48 : la révision et la question d’entretien ouverte survivent aussi au rechargement', () => {
  const rev = cut('function openReview(id){', '\nlet defiDernierKo');
  assert.ok(rev.includes('let ses=restoringNav?revSesRead():null;'));
  assert.ok(rev.includes('if(ses.done){if(q.length){id=q[0];}ses=null;}'), 'une leçon déjà révisée passe à la suivante');
  assert.ok(rev.includes('exoFails=Math.max(0,Math.floor(+ses.fails||0));'), 'l’aide déjà débloquée revient');
  assert.ok(app.includes("else if(taId==='ed-lesson'&&current&&mode==='review'){revSesSave();}"), 'la requête est gardée à la frappe');
  assert.equal(app.split('reviewQueue.shift();revSesSave(true);').length - 1, 2, 'les deux réussites de révision');
  assert.ok(app.includes("if(nav.view==='tab'&&nav.tab==='entretien'){\n      switchTab('entretien');entSesRestore();"));
  assert.ok(app.includes('  if(!restoringNav)entSesSave();'));
});

test('18 h 20 : sous le bouton retour, le titre de la page descend, le même écart partout', () => {
  assert.ok(css.includes('html.lq #app .screen>.home-back{margin-bottom:12px}'));
});

test('18 h 38 : entretien — familles de notions, « Voir selon le SGBD », précédente et suivante côte à côte, réponse JSONB', () => {
  assert.ok(app.includes("fbar.innerHTML=ENT_FAMILLES.map(([k,l])=>{"));
  assert.ok(app.includes(`onclick="entVoirSgbd('\${x.id}','\${entSgbdTheme(x.q)}')"`));
  assert.ok(app.includes("entOpen=parent==='entretien'&&activeTab==='sgbd'&&entSgbdRetour?entSgbdRetour:null;"), 'le retour ramène à la question');
  assert.ok(app.includes('<div class="ent-nav">${entPrevTarget(x.id)?`<button type="button" class="ent-prev" onclick="prevEntretien('));
  assert.ok(app.includes('J’utilise <code>-&gt;</code> pour extraire une valeur JSON, <code>-&gt;&gt;</code> pour la récupérer sous forme de texte, et <code>@&gt;</code> pour vérifier qu’un document contient une structure ou des valeurs précises.'), 'réponse JSONB (3 novembre, 6 h 50 : reprise d’Elisa, avec l’exemple de Sophie et l’index GIN)');
  assert.ok(css.includes('html.lq .ent-focus .ent-nav{display:flex;gap:10px;margin-top:14px}'));
});

test('18 h 42 : « Base NutriBoost » ; les bases d’entraînement en lecture seule (ni import, ni bouton qui modifie, ni requête qui écrit)', () => {
  assert.ok(app.includes("function demoLabel(id){return id==='cours'?'Base NutriBoost':'Base '+DEFI_BASES[id].nom;}"));
  assert.ok(app.includes("if(verrou)try{database.run('PRAGMA query_only=ON');}catch(e){}") && app.includes("if(verrou)try{database.run('PRAGMA query_only=OFF');}catch(e){}"));
  assert.ok(app.includes("if(verrou&&/\\b(?:ATTACH|DETACH|VACUUM|REINDEX|PRAGMA)\\b/i.test("), 'on ne peut pas rouvrir l’écriture par PRAGMA');
  assert.ok(app.includes('<span>Base d’entraînement · lecture seule</span>'));
  assert.ok(app.includes("async function dropTable(name){\n  if(isDemoDb(activeDbId))return;") && app.includes("async function resetTable(name){\n  if(isDemoDb(activeDbId))return;"));
});

test('18 h 48 : questions d’entretien en entier, notions qui ont un sens, nouvelle photo de la formatrice avec sa pastille', () => {
  assert.ok(app.includes('#scr-entretien .ecard .eq{display:block;overflow:visible}') && !app.includes('#scr-entretien .ecard .eq{display:-webkit-box;-webkit-line-clamp:2;'));
  assert.ok(app.includes("const ENTRETIEN_CATS=[['all','Toutes les notions'],['Bases du SQL','Bases du SQL'],['SELECT','SELECT'],"), 'les bases du langage avant SELECT (2 novembre, 22 h 08)');
  const lecon = fs.readFileSync(new URL('../assets/anim/bases-relationnelles.html', import.meta.url), 'utf8');
  assert.ok(lecon.includes('#cap .cap-stk::after{content:"Votre formatrice";'));
  assert.ok(lecon.includes('#cap .cap-stk{background:url(formatrice.webp) 50% 0/134px 134px no-repeat,'));
});

test('18 h 56 : un ✓ quand l’écriture marche dans l’app, la légende dans le cadre du haut ; flèche animée dans « Continuer la préparation »', () => {
  /* 2 novembre, 0 h 51 : plus de « Notre moteur » dans la légende, et le « ! » rouge des écritures qui ne marchent pas dans l’app */
  assert.ok(app.includes('<p class="sg-legende"><span><i class="sg-check" aria-hidden="true">✓</i> marche dans l’app</span><span><i class="sg-bang" aria-hidden="true">!</i> pas dans l’app</span></p>'));
  assert.ok(!app.includes('Toutes ces écritures marchent dans l’app'));
  assert.ok(css.includes('html.lq .ent-hero .ent-hero-cta>svg:last-child{display:block!important;width:20px;height:20px;flex:none;animation:lstArrow 1.6s ease-in-out infinite}'));
});

test('19 h 00 : la ligne de notre moteur n’est plus surlignée en jaune (et, depuis le 2 novembre, 0 h 51, n’a plus « Notre moteur »)', () => {
  assert.ok(css.includes('html.lq .sg-row.is-moteur{margin:0;padding:8px 2px;border-radius:0;background:none;box-shadow:none;'));
  assert.ok(!app.includes('<em class="sg-tag">Notre moteur</em>'));
});

test('19 h 02 : sur la planche, sous chaque sticker, en petit, ce qui le fait gagner', () => {
  assert.ok(app.includes("{id:'requete',label:'Première requête',cap:'1ʳᵉ requête'"));
  assert.ok(app.includes("cap:`Module ${i+1} terminé`"));
  assert.ok(app.includes("${s.cap?`<small class=\"stk-cap\">${esc(s.cap)}</small>`:''}</li>`;"));
});

test('19 h 04 : les polices du site dans l’app (Inter, JetBrains Mono, Bricolage), plus de polices Google ; note du classement retirée', () => {
  assert.ok(css.includes("@font-face{font-family:'Inter';src:url(assets/fonts/inter-medium.woff2)") && css.includes("  --ui:'Inter',-apple-system,") && css.includes("  --mono:'JBM','JetBrains Mono',"));
  assert.ok(!app.includes('fonts.googleapis.com') && !app.includes('Plus Jakarta'));
  assert.ok(sw.includes("'./assets/fonts/inter-medium.woff2'"));
  assert.ok(!app.includes('Le classement en ligne compte les parties vérifiées.'));
});

test('19 h 08 : l’en-tête de l’accueil se resserre', () => {
  assert.ok(css.includes('html.lq #scr-learn #home-hero>.journey-heading{margin-top:6px!important;margin-bottom:10px!important}'));
});

test('19 h 22 : l’icône de chargement (tirer pour recharger) descend moins bas', () => {
  assert.ok(app.includes('const SEUIL=64, TENU=8, LIM=150;') && app.includes('translate3d(0,${Math.round(Math.min(o*.5-22,TENU+6))}px,0)'));
});

test('19 h 25 : le bonjour, le niveau et la séance fusionnés en haut de la carte du cours ; la série dessous', () => {
  assert.ok(app.includes('const html=`<section class="lq-hero journey-session has-hi" data-mc="${mc}" aria-label="${defi?\'Prochain défi\':\'Ta prochaine leçon\'}">${heading}${chip}'));
  assert.ok(app.includes('<span>${esc(ctaLabel)}</span></button></section>${streak}${extras}`;'));
  assert.ok(css.includes('html.lq .lq-hero.has-hi .lq-hero-hi{position:relative;z-index:1;margin:0 0 14px;padding:0 0 14px;border-bottom:1.5px solid rgba(255,255,255,.18)}'));
});

test('19 h 32 : une sous-page (Console, Selon le SGBD…) ouverte depuis une carte s’ouvre en haut', () => {
  assert.ok(app.includes('  if(primaryTabFor(name)!==name&&!tabBackNav)tabScrollPositions[name]=0;\n  activeTab=name;'));
});

test('19 h 36 – 19 h 39 : le haut de la carte sur une ligne (bonjour + séance du jour), le niveau collé sur le chat', () => {
  assert.ok(app.includes("const sessionLine=sesEtat==='end'?'Parcours terminé'"), 'parcours terminé');
  /* 19 h 48 : « Ta session » à la place d’« Aujourd’hui » */
  assert.ok(app.includes(":sesEtat==='run'?`Ta session · ${session.minutes} min`") && app.includes(":sesEtat==='done'?'Ta session · Faite':'Ta session · Pause';"), 'Ta session · 12 min / Faite / Pause');
  assert.ok(!app.includes('`Aujourd’hui · ${session.minutes} min`'), 'plus d’« Aujourd’hui »');
  assert.ok(app.includes("{const a=old.querySelector('.mstk-niv'),b=fresh.querySelector('.mstk-niv');if(a&&b&&a.outerHTML!==b.outerHTML)a.replaceWith(b.cloneNode(true));}"), 'étiquette remise à jour quand la mascotte est gardée');
  assert.ok(css.includes('html.lq .mstk-niv{left:auto;right:-2px;translate:none;max-width:118px}'), 'reste dans la carte à 360 px');
  assert.ok(css.includes('html.lq .lq-hero.has-hi::after{display:none}'), 'l’étoile ne chevauche plus la séance');
});

test('19 h 48 : « Ta session » a son animation (sablier qui coule et se retourne, somnole en pause, coche qui se trace ; minutes qui défilent)', () => {
  assert.ok(app.includes('<span class="lq-ses is-${sesEtat}"') && app.includes('<i class="lq-ses-ic" aria-hidden="true">${sesIc}</i>'));
  assert.ok(app.includes('<g class="lq-sab">') && app.includes('<g class="lq-sab is-couche">') && app.includes('<path class="lq-chk"'), 'les trois icônes');
  assert.ok(app.includes("replace(/(\\d+) min$/,'<b class=\"lq-ses-n\" data-n=\"$1\">$1</b>\\u00a0min')"), 'le nombre de minutes balisé');
  assert.ok(app.includes("if(!n||lqSesCounted||!document.querySelector('#scr-learn.active'))return;") && app.includes("if(typeof mascotReduced==='function'&&mascotReduced())return;"), 'une fois, accueil visible, mouvement non réduit');
  assert.equal((app.match(/lqSesCount\(host\);/g) || []).length, 2, 'les deux rendus de la carte');
  for (const k of ['@keyframes lqSabFlip{0%,80%{rotate:0deg}100%{rotate:180deg}}', '@keyframes lqSabHaut{0%{scale:1 1}78%,100%{scale:0 0}}', '@keyframes lqSabDort{0%,100%{rotate:-9deg}50%{rotate:9deg}}', '@keyframes lqChk{to{stroke-dashoffset:0}}', 'html.lq[data-motion="reduce"] .lq-ses-ic *{animation:none!important}'])
    assert.ok(css.includes(k), k);
});

test('19 h 53 : moins d’espace entre la série et « Ton parcours »', () => {
  assert.ok(css.includes('html.lq #scr-learn #modules{margin-top:6px;padding-top:16px}'));
});

test('19 h 55 : parcours terminé, plus de « Tu es ici »', () => {
  assert.ok(app.includes('try{const s=recommendedSession();if(s&&!isDefiId(s.id))id=s.id;fini=!s;}catch(e){}'));
  assert.ok(app.includes('if(fini){lqPathCurrent=null;setTimeout(()=>{lqPathCurrent=undefined;},0);return null;}'));
});
