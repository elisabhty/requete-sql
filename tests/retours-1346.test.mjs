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
  assert.ok(lecon.includes('#cap .cap-stk{background:url(formatrice.webp) 50% 6px/150px auto no-repeat,'));
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
  assert.ok(open.includes("<button type=\"button\" class=\"lst-go\"><span>${done?'Revoir le cours':started?'Continuer':'Commencer'}</span>${DEF_CHEV_SVG}</button>"));
  assert.ok(open.includes("<p class=\"lst-kicker\">${m?`Module ${mi+1} · ${esc(m.titre)}`:'Cours'}</p>"));
  assert.ok(open.includes('<ol class="lst-plan">'), 'ce que tu vas faire, dans l’ordre');
  assert.ok(css.includes('.lst-card{position:relative;isolation:isolate;overflow:visible;padding:26px 22px 30px;border-radius:30px;background:var(--deep);'));
  assert.ok(css.includes('.lst-go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:62px;'));
});

test('onboarding : le parcours qui se construit, la promesse en grand chiffre, l’engagement signé ; tout tient sur un écran', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','goal','level','rhythm','build','promise','pact','practice','account','ready','pseudo'];"));
  const ob = cut('function obPlanInfo(){', 'function obRhythmSummary(){');
  assert.ok(ob.includes("const days=Math.max(1,Math.round((parseD(last)-auj())/864e5)+1);"), 'le nombre de jours vient du plan réellement généré');
  assert.ok(ob.includes("if(ink>40){"), 'une vraie signature, pas un point');
  assert.ok(ob.includes("for(const c of C){") && app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4'];"), 'se resserre par paliers tant que ça déborde');
  assert.ok(app.includes('<div class="ob-big" aria-hidden="true"><b id="ob-big-n" data-n="${b.days}">${b.days}</b><span>jours</span></div>'));
  assert.ok(app.includes('<p class="ob-pact-k">Mon contrat d’apprentissage</p>'));
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
  assert.ok(app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4'];"));
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
  assert.ok(cles.includes("a += sqlCard('sq-pk', SQL.pk, 64, 952, 'Tu apprendras à écrire ces tables dans le prochain module.');"));
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
