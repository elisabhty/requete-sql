/* Onboarding, 3 novembre, 17 h 32 (Elisa, captures d’iPhone à l’appui) :
   « Ne pas mettre ces textes en petit (il sert à te saluer…, 1 question facultative…), enlève les notions de facultatif.
   Enchantée Elisa ! J’ai hâte d’en savoir plus sur toi, de façon animée. Commencer toujours par la même leçon, car c’est le début.
   Améliorer la page « On construit ton parcours » pour l’effet waouh, animée, micro-animée. Réf. 5 : vérifie bien que la page
   s’adapte si on met autre chose que 30 min. Réf. 6 et 7 : la page s’élargit. Réf. 8 : c’est un mode avec compte, justement.
   Améliore la dernière page de manière animée. À la requête, mets une animation. Première page : attention aux barres en haut
   et en bas. »
   Vérifié dans un navigateur de 320 × 568 à 1 280 × 650, avec et sans animations réduites : chaque étape tient sans défiler ; la
   promesse dit 36, 24 ou 15 jours pour 10, 20 ou 30 minutes ; zones de Safari simulées (59 px en haut, 34 px en bas) : sous les deux
   barres, le fond est uni, sans marche. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), css = lire('onboarding-vitrine.css'), surf = lire('safari-surface.css');
/* La dernière définition d’une fonction (l’onboarding en garde d’anciennes plus haut dans le fichier). */
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };
const slide = (name, next) => { const i = app.lastIndexOf(`}else if(slide==='${name}'){`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i + 10)); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
/* L’appli sans ses commentaires (ils citent les demandes d’Elisa, donc les textes retirés) */
const code = sansCommentaires(app);

test('« enlève les notions de facultatif » : ni texte d’aide, ni « Passer », ni « Facultatif » au prénom, à l’âge et à la profession', () => {
  const name = sansCommentaires(slide('name', "}else if(slide==='pseudo'){"));
  for (const t of ['ob-helper', 'Il sert à te saluer', 'facultative', 'Passer pour le moment']) assert.ok(!name.includes(t), t);
  assert.ok(name.includes("obSetFooter('Continuer',obNameNext,'','','',!(draft.name||'').trim());"), '« Continuer » s’allume avec le prénom');
  for (const [s, next] of [['age', "}else if(slide==='job'){"], ['job', "}else if(slide==='goal'){"]]) {
    const h = sansCommentaires(slide(s, next));
    assert.ok(!h.includes('Facultatif') && !h.includes("'Passer'"), s);
  }
  assert.ok(!code.includes('Facultatif · reste sur cet appareil') && !code.includes('1 question facultative'), 'nulle part dans l’appli');
  /* « Continuer » se rallume (avec son rebond) dès qu’un prénom est tapé ; Entrée sur un champ vide fait vibrer le champ */
  const cta = fn('obNameCta', 'function obNameNext(');
  assert.ok(cta.includes("next.disabled=!(draft.name||'').trim();") && cta.includes('if(was&&!next.disabled)obCtaWake(next);'));
  const go = fn('obNameNext', 'let obCheerT');
  assert.ok(go.includes("if((draft.name||'').trim()){obGoto('age');return;}") && go.includes("f.classList.add('is-shake')"));
  assert.ok(css.includes('.ob-field.is-shake input{animation:obvShake .4s ease both}'));
});

test('« Enchantée, Elisa ! J’ai hâte d’en savoir plus sur toi. », en grand et en animation', () => {
  const name = slide('name', "}else if(slide==='pseudo'){");
  assert.ok(name.includes('<span class="ob-name-msg"><b id="ob-name-greet"></b><span class="ob-name-sub">J’ai hâte d’en savoir plus sur toi.</span></span>'));
  assert.ok(name.includes("obMascotQuestion('Salut ! Comment dois-je t’appeler ?')"), '« Enchantée » n’est dit qu’une fois');
  const prev = fn('obNamePreview', '/* L\'accueil tape');
  assert.ok(prev.includes("box.innerHTML=n?`Enchantée, <em>${esc(n)}</em>&nbsp;!`:'';"), 'le prénom échappé, surligné');
  /* Le texte est posé avant la mesure : la carte est mesurée à sa vraie hauteur (sinon, à 320 px, elle débordait de 15 px) */
  assert.ok(prev.indexOf('box.innerHTML=') < prev.indexOf('obFit()'));
  assert.ok(prev.includes("wrap.classList.add('is-in')") && prev.includes("root.classList.add('ob-cheer')"), 'une fois par apparition, la mascotte saute de joie');
  /* Pas de lettre « fantôme » : l’initiale prend le premier caractère entier (emoji compris) */
  const ctx = vm.createContext({ document: { getElementById: id => ctx.els[id] || null }, prefersReduceMotion: () => true, esc: s => String(s).replace(/</g, '&lt;'), draft: { name: '  <b>Élo' } });
  ctx.els = { 'ob-name-greet': { innerHTML: '' }, 'ob-name-initial': { textContent: '' }, 'ob-name-preview': { hidden: true, classList: { add() {}, remove() {} } } };
  vm.runInContext('let obCheerT=null;' + prev, ctx);
  vm.runInContext('obNamePreview()', ctx);
  assert.equal(ctx.els['ob-name-greet'].innerHTML, 'Enchantée, <em>&lt;b>Élo</em>&nbsp;!');
  assert.equal(ctx.els['ob-name-initial'].textContent, '<');
  assert.equal(ctx.els['ob-name-preview'].hidden, false);
  for (const k of ['.ob-name-preview.is-in{animation:obvNameIn .55s var(--v-pop) both!important}', '.ob-name-preview.is-in .ob-name-msg>b em{animation:obvSwoosh .5s ease-out .45s both}',
    '.ob-name-preview.is-in .ob-name-spark{animation:obvSpark .9s ease-out .38s both}', 'html #onboarding.ob-vitrine .ob-name-msg>b{color:#fff;font:800 19px/1.2 var(--v-display);',
    'html #onboarding.ob-vitrine .ob-name-sub{color:rgba(255,255,255,.9);font:600 15px/1.35 var(--v-ui)}'])
    assert.ok(css.includes(k), k);
});

test('« commencer toujours par la même leçon » : tout nouveau parcours part de la première leçon, quel que soit le niveau', () => {
  const pool = fn('buildMixPool', 'function apercuPlan(');
  const ctx = vm.createContext({ allLessons: [7, 8, 9, 10, 11].map(id => ({ id })) });
  vm.runInContext(fn('leconsDepuis', '/* 3 novembre, 17 h 32 (Elisa) : « commencer toujours') + pool, ctx);
  for (const niv of ['debutant', 'bases', 'inter', undefined]) assert.deepEqual(Array.from(vm.runInContext(`buildMixPool(${JSON.stringify(niv)})`, ctx)), [7, 8, 9, 10, 11], String(niv));
  /* Le chemin du niveau part de SELECT pour tous ; le niveau dit la difficulté des défis */
  const pathFn = fn('obLevelPath', '/* Ce que le plan');
  const run = niveau => { const c = vm.createContext({ draft: { niveau } }); vm.runInContext(pathFn, c); return vm.runInContext('obLevelPath()', c); };
  for (const niv of ['debutant', 'bases', 'inter']) {
    const h = run(niv);
    assert.equal((h.match(/ob-path-step start/g) || []).length, 1); assert.ok(h.includes('<div class="ob-path-step start"><i aria-hidden="true">▶</i><span>SELECT</span></div>'), niv);
    assert.ok(!h.includes('acquise') && !h.includes('ob-path-step done'), 'plus d’étape « acquise »');
  }
  /* 23 h 21 : « mets pas "comme tout le monde" ; défis recommandés en Moyen, et pareil, débutant niveau Facile » */
  assert.equal(run('debutant').match(/<small class="ob-path-note">([\s\S]*?)<\/small>/)[1], 'Défis recommandés : niveau <b>Facile</b>');
  assert.equal(run('bases').match(/<small class="ob-path-note">([\s\S]*?)<\/small>/)[1], 'Défis recommandés : niveau <b>Moyen</b>');
  assert.equal(run('inter').match(/<small class="ob-path-note">([\s\S]*?)<\/small>/)[1], 'Défis recommandés : niveau <b>Difficile</b>');
  for (const niv of ['debutant', 'bases', 'inter']) assert.ok(!run(niv).includes('comme tout le monde'), niv);
  assert.ok(app.includes("${obMascotQuestion('Dis-moi tout : tes défis suivront ton niveau.')}") && !code.includes('Je te ferai commencer au bon endroit.'));
  /* Le réglage du planning ne promet plus un départ « au tri » ou « aux sous-requêtes » */
  assert.ok(!code.includes('départ au tri') && !code.includes('départ aux sous-requêtes'));
  assert.ok(app.includes('d:"SELECT et les filtres me parlent · défis moyens",from:11') && app.includes('d:"Agrégations et jointures acquises · défis difficiles",from:45'));
  /* Le départ de l’écran « On construit » : la première leçon du plan, aucun module sauté */
  const info = fn('obPlanInfo', '/* La construction');
  assert.ok(info.includes('const startId=ids.length?ids[0]:(allLessons[0]||{}).id,startMod=moduleDeLecon(startId);') && !info.includes('NIVEAUX.find'));
});

test('Réf. 5 : la promesse suit le rythme — 36, 24 ou 15 jours pour 10, 20 ou 30 minutes (71 leçons, tous les jours)', () => {
  assert.ok(!code.includes('DUREE_PARCOURS_JOURS') && !code.includes('~30 jours'), 'plus de plancher de 30 jours');
  const ctx = vm.createContext({ allLessons: Array.from({ length: 71 }, (_, id) => ({ id })) });
  const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i > 0, a); return app.slice(i, app.indexOf(b, i)); };
  vm.runInContext([cut('const RYTHMES=[', 'const FREQS=['), cut('const PATTERN=', 'const JOURS='), cut('function jour0(d)', 'function lundiDe('),
    cut('function datesMotif(', '/* Jours de séance'), cut('function distribuerSessions(', 'function libelleJour('),
    fn('leconsDepuis', '/* 3 novembre, 17 h 32 (Elisa) : « commencer toujours'), fn('buildMixPool', 'function apercuPlan('), fn('apercuPlan', 'function validerPlan(')].join('\n')
    + '\nauj=()=>new Date(2026,10,3);', ctx);
  const plan = r => vm.runInContext(`apercuPlan('bases','${r}',7)`, ctx);
  for (const [r, n] of [['calme', 36], ['regulier', 24], ['intensif', 15]]) {
    const p = plan(r);
    assert.equal(p.sessions.length, n, r);
    assert.ok(p.sessions.every(s => s.lessons.length > 0), `${r} : pas de séance vide en fin de parcours`);
    assert.equal(p.sessions.reduce((a, s) => a + s.lessons.length, 0), 71);
    assert.equal(p.sessions[0].lessons[0], 0, 'la première leçon d’abord');
  }
  assert.equal(plan('intensif').sessions.at(-1).d, '2026-11-17');
  /* Les jours et la date de fin de la promesse viennent des séances qui ont des leçons */
  const info = fn('obPlanInfo', '/* La construction');
  assert.ok(info.includes('const pleines=p.sessions.filter(x=>(x.lessons||[]).length);') && info.includes('const last=pleines.length?pleines[pleines.length-1].d:dstr(auj());') && info.includes('sessions:pleines.length,'));
});

test('Réf. 6 et 7, « la page s’élargit » : l’en-tête de la promesse garde toute la largeur', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-promise>.ob-flow-top{align-self:stretch;width:100%;text-align:left}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-promise{align-items:center;text-align:center}'), 'le chiffre et la phrase restent centrés');
});

test('Réf. 8 et première page : plus de « Mode sans compte » ni de « Aucun compte n’est nécessaire »', () => {
  assert.ok(!code.includes('Mode sans compte · sauvegardé sur cet appareil') && !code.includes('Aucun compte n’est nécessaire'));
  assert.ok(app.includes("'Ta progression est enregistrée sur cet appareil.');"));
});

test('« On construit ton parcours » : l’effet waouh', () => {
  const b = slide('build', "}else if(slide==='promise'){");
  assert.ok(b.includes('<div class="ob-build-hero"><h1 class="ob-title" id="ob-title">On construit<br><em>ton parcours</em>…</h1><img class="ob-build-stk" src="${MASCOT_IMG}"'), 'la mascotte au travail');
  assert.ok(b.includes('<span class="ob-build-k" id="ob-build-k" role="status">Construction en cours…</span><b class="ob-build-pct" id="ob-build-pct" aria-hidden="true">0 %</b>'), 'un seul message pour les lecteurs d’écran, pas chaque pourcentage');
  assert.ok(b.includes('<span class="ob-build-burst">${[0,1,2,3,4,5,6,7].map(i=>`<i style="--a:${i*45+22}deg"></i>`).join(\'\')}</span>'));
  const run = fn('obRunBuild', 'function obRunBig(');
  assert.ok(run.includes("const reduce=prefersReduceMotion(),again=!!draft.buildDone,T=reduce||again?0:3000;"), '3 s ; tout de suite au retour ou en animations réduites');
  assert.ok(run.includes("li.classList.toggle('is-active',!ok&&k>=i/n);") && run.includes("buzz('selection')") && run.includes('f.style.clipPath=`inset(0 ${(100-k*100).toFixed(2)}% 0 0 round 99px)`;'));
  /* 4 novembre, 1 h 31 (Réf. 2) : « Ton parcours est prêt », plutôt que « construit » */
  assert.ok(run.includes("t.innerHTML='Ton parcours<br>est <em>prêt</em>&nbsp;!';") && run.includes("lbl.textContent='Parcours prêt';") && run.includes('draft.buildDone=true;'));
  assert.ok(fn('obPick', 'function obPseudoTape(').includes("if(champ==='niveau'||champ==='rythme'||champ==='goal'||champ==='freq')draft.buildDone=false;"), 'un autre choix reconstruit le parcours (les jours par semaine aussi, 4 novembre, 9 h 36)');
  for (const k of ['.ob-build:not(.is-built) .ob-build-bar i{animation:obvStripes .55s linear infinite}', '.ob-build.is-built .ob-build-burst i{animation:obvBurst 1s',
    '.ob-build.is-built .ob-build-card{animation:obvCardGlow 1s ease-out both}', '.ob-build-list li.is-active .ob-build-ok{animation:obvSpin .7s linear infinite}',
    '.ob-build.is-built .ob-build-stk{animation:obvJoy .8s var(--v-pop) both', '.ob-build-hero .ob-title.is-swap{animation:obvTitleSwap', '.ob-build.is-built .ob-build-pct{transform-origin:100% 60%;animation:obvPctPop'])
    assert.ok(css.includes(k), k);
  /* La mascotte n’ajoute pas de hauteur : à 390 × 844, la carte garde ses modules */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-build-stk{position:absolute;right:4px;bottom:-2px;height:calc(100% + 12px);width:auto;max-width:62px;'));
  assert.ok(css.includes('html #onboarding.ob-vitrine #ob-body{overflow-x:hidden}'), 'les étincelles ne font pas défiler l’étape sur le côté');
});

test('« À la requête, mets une animation » : la requête se tape, « Exécuter » palpite, tourne, puis le résultat se déplie', () => {
  const p = slide('practice', "}else if(slide==='rhythm'){");
  /* Chaque ligne se tape en autant de pas que de caractères */
  const lignes = [...p.matchAll(/<span class="ob-tl" style="--n:(\d+);--t:[\d.]+s;--dl:[\d.]+s">([\s\S]*?)<\/span>\n?(?=<span class="ob-tl"|<\/pre>)/g)];
  assert.equal(lignes.length, 3);
  for (const [, n, h] of lignes) assert.equal(h.replace(/<[^>]+>/g, '').length, Number(n), h);
  assert.ok(p.includes("const typing=!draft.practiceDone&&obJustEntered&&!prefersReduceMotion();") && p.includes('<div class="ob-practice-card${typing?\' is-typing\':\'\'}${fresh?\' is-flip-in\':\'\'}">'));
  assert.ok(p.includes('<button type="button" class="ob-practice-run" id="ob-practice-run" onclick="obRunPractice()"><span class="ob-practice-play" aria-hidden="true">▶</span><span class="ob-practice-lbl">Exécuter la requête</span></button>'));
  assert.ok(p.includes('<b class="ob-practice-n" data-n="${rowsN}">${rowsN}</b> ${rowsN>1?\'lignes\':\'ligne\'}') && p.includes("`<span${ci===2?' class=\"is-hit\"':''} style=\"--rd:${220+ri*120}ms\">"));
  /* Plus de « Passer l’essai » ; si le moteur SQL ne démarre pas, « Continuer » reste possible */
  assert.ok(!code.includes('Passer l’essai') && !code.includes('Aucune erreur possible : cet essai est guidé.'));
  assert.ok(p.includes("const canGo=!!(draft.practiceDone||draft.practiceFailed);") && p.includes("obSetFooter(canGo?'Continuer':'Lance la requête pour découvrir le résultat',()=>obGoto(obAfterPractice()),'','','',!canGo);"));
  const run = fn('obRunPractice', 'function obCanNext(');
  assert.ok(run.includes("if(draft.practiceDone||obPracticeBusy)return;") && run.includes("l.textContent='Exécution…'") && run.includes("btn.setAttribute('aria-busy','true')"));
  /* Après le balayage (760 ms), la console se retourne (1 h 31), puis la requête part ; rien si l’on a quitté l’étape */
  assert.ok(run.includes("if(obStep!==st||OB_SLIDES[obStep]!=='practice'){obPracticeBusy=false;return;}") && run.includes("if(card&&!reduce)card.classList.add('is-flip-out');"));
  assert.ok(run.includes("setTimeout(()=>{obPracticeBusy=false;if(obStep===st&&OB_SLIDES[obStep]==='practice')obPracticeRun();},reduce?0:210);") && run.includes('},reduce?0:760);'), 'la requête part après le balayage et le quart de tour');
  assert.ok(/catch\(e\)\{\s*draft\.practiceRows=\[\];\s*draft\.practiceDone=false;[\s\S]*?draft\.practiceFailed=true;/.test(run));
  for (const k of ['.ob-practice-card.is-typing .ob-tl{overflow:hidden;animation:obvType var(--t) steps(var(--n),end) var(--dl) backwards,obvCaret var(--t) linear var(--dl)}',
    '.ob-practice-run:not(:disabled)::after{animation:obvRing 1.8s ease-in-out .5s infinite}', '.ob-practice-card.is-running .ob-practice-code::after{animation:obvScan',
    '.ob-practice-result.is-new .ob-practice-table span.is-hit{animation:obResultIn', '.ob-practice-reward.is-new{animation:obvStampIn .55s var(--v-pop) 1s backwards}',
    'html #onboarding.ob-vitrine.ob-fit-2 .ob-practice .ob-practice-reward{display:block!important}'])
    assert.ok(css.includes(k), k);
  /* Le tampon arrive en grandissant : une animation qui partirait plus grand gonflerait la page mesurée par obFit */
  assert.ok(css.includes('@keyframes obvStampIn{0%{opacity:0;transform:scale(.4) rotate(-12deg)}'));
});

test('la dernière page s’anime : coche tracée, ondes, récapitulatif en cascade, sept jours remplis un à un, bouton réveillé', () => {
  const r = app.slice(app.lastIndexOf("html=`<div class=\"ob-screen ready\">"), app.lastIndexOf('if(obJustEntered&&!prefersReduceMotion())obDemoTimers.push('));
  assert.ok(r.includes('<path class="ob-success-tick" pathLength="1" d="m5 12.5 4.3 4.3L19 7.5"') && r.includes('</svg><i></i><i></i></div>'));
  assert.ok(r.includes('<div class="ob-ready-row" style="--i:2">') && r.includes('week.map((on,i)=>`<i class="${on?\'on\':\'rest\'}" style="--i:${i}" aria-hidden="true"></i>`)'));
  assert.ok(app.includes("if(obJustEntered&&!prefersReduceMotion())obDemoTimers.push(setTimeout(()=>{if(OB_SLIDES[obStep]==='ready')obCtaWake();},1650));"));
  for (const k of ['.ob-enter .ob-screen.ready .ob-success-tick{stroke-dasharray:1;animation:obvTick', '.ob-enter .ob-screen.ready .ob-success>i{animation:obvRipple',
    '.ob-enter .ob-screen.ready .ob-ready-row{animation:obvRise .45s cubic-bezier(.2,.85,.25,1) calc(.4s + var(--i,0) * .12s) both}',
    '.ob-enter .ob-screen.ready .ob-ready-days i{transform-origin:0 50%;animation:obvBarGrow', '.ob-enter .ob-screen.ready .ob-title em{animation:obvSwoosh'])
    assert.ok(css.includes(k), k);
});

test('les animations ne jouent qu’avec les mouvements autorisés ; au repos, tout est visible', () => {
  const debut = css.indexOf('/* ---------- 3 novembre, 17 h 32');
  assert.ok(debut > 0);
  const bloc = css.slice(debut);
  const media = bloc.slice(bloc.indexOf('@media (prefers-reduced-motion:no-preference){'), bloc.indexOf('@media (prefers-reduced-motion:reduce){'));
  assert.ok(media.length > 2000);
  /* Toute règle d’animation du bloc est dans le média « no-preference » et exclut html[data-motion="reduce"] */
  const horsMedia = bloc.replace(media, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  assert.ok(!/animation:(?!none)/.test(horsMedia.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucune animation hors du média');
  for (const regle of media.split('\n').filter(l => l.includes('{'))) assert.ok(regle.trim().startsWith('html:not([data-motion="reduce"]) #onboarding.ob-vitrine') || regle.startsWith('@media'), regle);
});

test('première page : sous les barres de Safari, le fond est uni (grille et halo n’arrivent qu’après la zone de l’heure)', () => {
  const s = sansCommentaires(surf);
  assert.ok(s.includes('html #onboarding.ob-vitrine::before{\n  -webkit-mask-image:linear-gradient(transparent calc(var(--safe-top,0px) + 6px),#000 calc(var(--safe-top,0px) + 150px),#000 calc(100% - var(--safe-bottom,0px) - 220px),transparent calc(100% - var(--safe-bottom,0px) - 80px));'));
  assert.ok(s.includes('html #onboarding.ob-vitrine::after{\n  top:calc(var(--safe-top,0px) - 150px);\n  -webkit-mask-image:linear-gradient(transparent 156px,#000 310px);'), 'le halo commence sous la zone de l’heure');
  assert.ok(s.includes('html.lq .lv::before{\n  -webkit-mask-image:linear-gradient(transparent,#000 72px,#000 calc(100% - 72px),transparent);'), 'le lecteur garde son fondu');
});

test('feuilles rechargées et cache renouvelé', () => {
  const sw = lire('sw.js');
  for (const f of ['safari-surface.css?v=13', 'onboarding-vitrine.css?v=17']) assert.ok(app.includes(`<link rel="stylesheet" href="${f}">`) && sw.includes(`'./${f}',`), f);
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`) && cache !== 'requete-2026-11-03-apercu-v2466');
});

test('22 h 24, « Regarde la barre » : l’écran de chargement aussi a un fond uni sous les barres de Safari', () => {
  /* Sa grille et ses halos touchaient les deux bords : sous la barre d’adresse, Safari posait une bande plus claire au bord net,
     et la grille commençait d’un coup sous l’heure. Même fondu que l’onboarding, croisé avec l’ellipse d’origine. */
  const s = sansCommentaires(surf);
  const fondu = 'linear-gradient(transparent calc(var(--safe-top,0px) + 6px),#000 calc(var(--safe-top,0px) + 150px),#000 calc(100% - var(--safe-bottom,0px) - 220px),transparent calc(100% - var(--safe-bottom,0px) - 80px))';
  const ellipse = 'radial-gradient(ellipse 85% 75% at 50% 40%,#000 30%,transparent 92%)';
  assert.ok(lire('ludique.css').includes(`-webkit-mask-image:${ellipse};`), 'l’ellipse reprise de ludique.css');
  assert.ok(s.includes(`html.lq #loader:not(.is-intro)::before{\n  -webkit-mask-image:${fondu},${ellipse};\n  -webkit-mask-composite:source-in;\n  mask-image:${fondu},${ellipse};\n  mask-composite:intersect;\n}`));
  assert.ok(s.includes(`html #onboarding.ob-vitrine::before{\n  -webkit-mask-image:${fondu};`), 'le même fondu sur l’onboarding');
  /* Avant que safari-surface.js ne tourne, la couleur du navigateur est déjà celle du premier écran (violet), plus le lavande clair */
  assert.ok(app.includes('<meta name="theme-color" content="#6E50F6">') && !app.includes('<meta name="theme-color" content="#F4F2FC">'));
});

test('22 h 44, « ça le fait pendant 1 s » : les repères de couleur des barres sont là dès la première image', () => {
  /* Créés par safari-surface.js (defer), ils n’existaient qu’une fois toute la page lue : pendant cette seconde, Safari teintait la
     barre du bas avec le fond de body (le violet du haut). Ils sont maintenant dans la page, en tête de <body>, et Safari 26 est
     reconnu dès le <head>. */
  assert.ok(app.includes('<body>\n<!-- Repères de couleur des barres de Safari 26 (safari-surface.css et .js) : présents dès la première image. -->\n<div id="browser-status-sample" aria-hidden="true"></div><div id="browser-bottom-sample" aria-hidden="true"></div>\n<div id="app">'));
  const s = sansCommentaires(surf);
  assert.ok(s.includes('#browser-status-sample,#browser-bottom-sample{display:none}'), 'invisibles ailleurs');
  assert.ok(s.includes('html.safari-glass #browser-status-sample{\n  display:block;position:fixed;inset:0 0 auto;') && s.includes('html.safari-glass #browser-bottom-sample{\n  display:block;position:fixed;inset:auto 0 0;'));
  /* Le script du <head> reconnaît Safari 26 comme safari-surface.js : iPhone, Version/26 et plus, ni appli installée ni appli iOS */
  const tete = app.slice(app.indexOf('<script>(function(){try{var u=navigator.userAgent,m=u.match('), app.indexOf('</script>', app.indexOf('<script>(function(){try{var u=navigator.userAgent,m=u.match('))).replace('<script>', '');
  const essai = (ua, { standalone = false, capacitor = false, touch = 5 } = {}) => {
    const classes = new Set();
    const g = { navigator: { userAgent: ua, maxTouchPoints: touch, standalone: false }, matchMedia: () => ({ matches: standalone }),
      document: { documentElement: { classList: { add: c => classes.add(c) } } } };
    if (capacitor) g.Capacitor = { isNativePlatform: () => true };
    g.window = g;
    vm.runInNewContext(tete, g);
    return classes.has('safari-glass');
  };
  const ios26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
  assert.equal(essai(ios26), true);
  assert.equal(essai(ios26.replace('Version/26.1', 'Version/18.6')), false, 'Safari 18 : pas de verre');
  assert.equal(essai(ios26, { standalone: true }), false, 'installée sur l’écran d’accueil');
  assert.equal(essai(ios26, { capacitor: true }), false, 'appli iOS');
  assert.equal(essai('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36'), false);
  /* safari-surface.js reprend les repères déjà présents, sans en ajouter */
  const js = lire('safari-surface.js');
  const nodes = [], existants = {};
  for (const id of ['browser-status-sample', 'browser-bottom-sample']) existants[id] = { id, style: {}, setAttribute() {} };
  const ctx = { navigator: { userAgent: ios26, maxTouchPoints: 5 }, screen: { width: 402, height: 874, orientation: { angle: 0 } }, innerWidth: 402, innerHeight: 714,
    document: { documentElement: { style: { setProperty() {} }, classList: { add() {} } }, body: { appendChild: n => nodes.push(n) }, createElement: () => ({ style: {}, setAttribute() {} }),
      getElementById: id => existants[id] || null, querySelector: () => ({ content: '#6E50F6' }), addEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: k => k === '--browser-bottom' ? '#4529CC' : '#6E50F6' }), matchMedia: () => ({ matches: false }),
    MutationObserver: class { observe() {} }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, addEventListener() {} };
  ctx.window = ctx;
  vm.runInNewContext(js, ctx);
  assert.equal(nodes.length, 0, 'aucun repère en double');
  assert.equal(existants['browser-bottom-sample'].style.backgroundColor, '#4529CC');
  assert.equal(existants['browser-status-sample'].style.backgroundColor, '#6E50F6');
});

test('22 h 55, « en entrant dans la page, ça saute trop avec l’animation d’écriture » : l’accueil garde sa taille du début à la fin', () => {
  /* La console grandissait ligne après ligne, puis son résultat apparaissait : vers 1,8 s, obFit réajustait la page et le titre
     sautait de 150 px. La requête et son résultat sont posés dès la première image ; l’écriture n’est plus qu’un dévoilement. */
  const w = slide('welcome', "}else if(slide==='account'){");
  assert.ok(w.includes('const demo=obDemoCode(),demoTyping=obJustEntered&&!prefersReduceMotion();'));
  assert.ok(w.includes('<pre class="oc-code" id="ob-demo-code">${demo.html}</pre><div class="oc-res" id="ob-demo-res" style="--res-dl:${demo.fin}s">'), 'la requête et le résultat dans la page dès le départ');
  assert.ok(!w.includes('id="ob-demo-res" hidden'), 'plus de résultat caché qui pousse la page en apparaissant');
  /* Chaque ligne se dévoile en autant de pas que de caractères, l’une après l’autre ; le résultat s’allume juste après */
  const code = fn('obDemoCode', 'function obRunWelcomeDemo(');
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') });
  vm.runInContext(app.match(/const OB_DEMO_TOKENS=[^\n]+\n/)[0] + app.match(/const OB_DEMO_T0=[^\n]+\n/)[0] + code + ';var out=obDemoCode();', ctx);
  const out = ctx.out, lignes = [...out.html.matchAll(/<span class="ob-tl" style="--n:(\d+);--t:([\d.]+)s;--dl:([\d.]+)s">([\s\S]*?)<\/span>(?=\n|$)/g)];
  assert.deepEqual(lignes.map(l => l[4].replace(/<[^>]+>/g, '')), ['SELECT prenom, ville', 'FROM clients', "WHERE ville = 'Paris';"]);
  for (const [, n, , , h] of lignes) assert.equal(h.replace(/<[^>]+>/g, '').length, Number(n));
  for (let i = 1; i < lignes.length; i++) assert.ok(Number(lignes[i][3]) >= Number(lignes[i - 1][3]) + Number(lignes[i - 1][2]), 'une ligne après l’autre');
  const derniere = lignes.at(-1);
  assert.ok(out.fin >= Number(derniere[3]) + Number(derniere[2]) && out.fin < 2.5, `le résultat à la fin de l’écriture (${out.fin} s)`);
  assert.ok(fn('obRunWelcomeDemo', '/* Balayage tactile').includes("if(!code||!code.closest('.is-typing'))return;"), 'la vibration seulement quand l’écriture joue');
  for (const k of ['.ob-welcome-demo.is-typing .ob-tl{overflow:hidden;animation:obvType var(--t) steps(var(--n),end) var(--dl) backwards,obvCaret var(--t) linear var(--dl)}',
    '.ob-welcome-demo.is-typing .oc-res{animation:obvResPop .45s var(--v-pop) var(--res-dl,2s) both}', '@keyframes obvResPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}'])
    assert.ok(css.includes(k), k);
});

test('23 h 03, « l’écran n’est pas centré » : l’accueil reste centré quand obFit retire son dernier bloc', () => {
  /* Le centrage tenait à la marge automatique du dernier bloc (les trois chiffres) ; retiré sur téléphone, il emportait sa marge
     et le contenu se tassait en bas, contre le bouton. Deux cales invisibles se partagent maintenant l’espace libre. */
  for (const k of ['html #onboarding.ob-vitrine .ob-screen.welcome>.ob-brand{margin-top:0}', 'html #onboarding.ob-vitrine .ob-screen.welcome>:last-child{margin-bottom:0}',
    "html #onboarding.ob-vitrine .ob-screen.welcome::before,html #onboarding.ob-vitrine .ob-screen.welcome::after{content:'';flex:none;width:100%;height:0}",
    'html #onboarding.ob-vitrine .ob-screen.welcome::before{margin-bottom:auto}', 'html #onboarding.ob-vitrine .ob-screen.welcome::after{margin-top:auto}'])
    assert.ok(css.includes(k), k);
  /* La cause : la règle d’origine centre avec la marge du dernier bloc, et ce bloc (les chiffres) part au palier 2 */
  assert.ok(app.includes('.ob-screen.welcome>:last-child{margin-bottom:auto}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-2 .ob-proof-stats{display:none!important}'));
  assert.ok(app.includes('<div class="ob-proof-stats" aria-label="L’apprentissage en bref">') && app.indexOf('<div class="ob-proof-stats"') > app.indexOf('<div class="ob-welcome-demo'), 'les chiffres sont le dernier bloc');
});

test('23 h 21 : le niveau sans « Tu commenceras par… », la première requête reformulée et son « Bravo », la construction plus animée', () => {
  /* Le niveau : seul le cadre du chemin, avec le niveau de défis recommandé */
  const lvl = slide('level', "}else if(slide==='practice'){");
  assert.ok(!lvl.includes('obLevelHint') && lvl.includes('${obLevelPath()}'));
  assert.ok(!code.includes('Tu commenceras par la leçon'), 'nulle part');
  /* La première requête : les textes retenus par Elisa */
  const p = slide('practice', "}else if(slide==='rhythm'){");
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">À toi de lancer ta première requête&nbsp;!</h1>'));
  assert.ok(p.includes('<p class="ob-lead">Une seule action suffit pour découvrir comment SQL retrouve les données.</p>'));
  assert.ok(p.includes("'Clique sur « Exécuter » pour afficher les clients qui habitent à Paris dans la table clients.'"));
  assert.ok(p.includes('<h1 class="ob-title" id="ob-title">Voilà le <em>résultat</em> de ta requête.</h1>'), 'le retour après l’exécution (en titre depuis 1 h 31 ; sans « Bravo » depuis 10 h 45, la connexion le fête)');
  assert.ok(p.includes("'Lance la requête pour découvrir le résultat'"));
  assert.ok(css.includes('html #onboarding.ob-vitrine[data-ob-slide="practice"] .ob-cta:disabled{font-size:15px!important;'), 'le bouton inactif tient sur une ligne dès 375 px');
  /* La construction : nombres qui montent, comète, étincelles, confettis, vague sur les modules */
  const b = slide('build', "}else if(slide==='promise'){");
  assert.ok(b.includes("const anim=!draft.buildDone&&!prefersReduceMotion(),nb=(n,txt)=>`<span class=\"ob-n\" data-n=\"${n}\">${anim?0:n}</span>${txt}`;"));
  assert.ok(b.includes("['≡',nb(b.lessons,' leçons'),'dans le bon ordre, pour toi']") && b.includes("['⚑','Tes défis',`niveau ${esc(b.defiNiv)} recommandé`]"));
  assert.ok(b.includes('<b class="ob-build-head"></b>') && (b.match(/<i class="ob-build-spark" aria-hidden="true"><\/i>/g) || []).length === 3);
  const run = fn('obRunBuild', 'function obBuildConfetti(');
  assert.ok(run.includes("style.setProperty('--k',k.toFixed(4))") && run.includes("li.querySelectorAll('.ob-n').forEach(e=>{e.textContent=String(Math.round((+e.dataset.n||0)*p));});"));
  assert.ok(run.includes('if(T)obBuildConfetti();'), 'confettis seulement quand la construction joue');
  const conf = fn('obBuildConfetti', 'function obRunBig(');
  assert.ok(conf.includes('if(prefersReduceMotion())return;') && conf.includes("layer.className='ob-build-confetti'") && conf.includes('setTimeout(()=>layer.remove(),2100);'));
  for (const k of ['html #onboarding.ob-vitrine>.ob-build-confetti{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}',
    '.ob-build:not(.is-built) .ob-build-head{animation:obvHeadPulse', '.ob-build-list li.is-done::before{animation:obvRowFlash .7s ease-out}',
    '.ob-build.is-built .ob-build-spark{animation:obvSpark 1s ease-out .12s both}', '.ob-build.is-built .ob-build-path span{animation:obvChipWave'])
    assert.ok(css.includes(k), k);
});

test('4 novembre, 1 h 31 : la première requête en deux pages, « Ton parcours est prêt », la flèche, et la place bien prise', () => {
  /* Réf. 1 : « tu n’as pas mis de message ici quand elle est lancée ; fais plutôt une deuxième page, comme si elle tournait, avec le
     résultat et le bravo » — sur son iPhone, la bulle du « Bravo » était retirée par obFit. */
  const p = slide('practice', "}else if(slide==='rhythm'){");
  assert.ok(p.includes("html=`<div class=\"ob-screen ob-profile ob-practice${done?' is-result':''}${fresh?' is-fresh':''}\">${obFlowHeader(slide)}${head}"));
  assert.ok(p.includes("<p class=\"ob-lead\">${rowsN>1?`Les <b>${rowsN}</b> clients qui habitent`:'Le client qui habite'} à Paris, trouvés dans la table clients.</p>"), 'la phrase qui explique le résultat');
  const avant = p.slice(p.indexOf(':`<h1 class="ob-title" id="ob-title">À toi de lancer'), p.indexOf('html=`<div class="ob-screen ob-profile ob-practice'));
  assert.ok(avant.includes('obMascotQuestion(') && !p.slice(p.indexOf('head=done?'), p.indexOf(':`<h1 class="ob-title" id="ob-title">À toi de lancer')).includes('obMascotQuestion('), 'la mascotte avant, le Bravo en titre après');
  /* La console se retourne : un quart de tour, puis revient de l’autre côté ; confettis depuis le résultat */
  for (const k of ['.ob-practice-card.is-flip-out{transform:rotateY(90deg);', '.ob-practice-card.is-flip-in{animation:obvFlipIn .55s', '@keyframes obvFlipIn{from{transform:rotateY(-90deg);',
    'html #onboarding.ob-vitrine .ob-screen.ob-practice{min-height:100%;perspective:1100px}'])
    assert.ok(css.includes(k), k);
  /* 10 h 45 : plus de confettis ici ; la page de connexion arrive d’elle-même et les lance (obFeteConnexion) */
  const run = fn('obPracticeRun', 'function obCanNext(');
  assert.ok(!run.includes('obConfettiAt(') && run.includes("if(draft.practiceDone)obDemoTimers.push(setTimeout(()=>{if(OB_SLIDES[obStep]==='practice'&&!obLock)obGoto(obAfterPractice());},reduce?1800:2400));"));
  /* Réf. 2 : la flèche animée du bouton */
  const b = slide('build', "}else if(slide==='promise'){");
  assert.ok(b.includes("obSetFooter('Découvre ce que tu vas apprendre',()=>obGoto('promise'),'','','',true);") && b.includes('<span class="ob-cta-arrow" aria-hidden="true"><svg'));
  assert.ok(css.includes('.ob-cta:not(:disabled) .ob-cta-arrow{animation:obvArrow 1.1s ease-in-out .4s infinite}'), 'elle avance une fois le parcours prêt');
  /* « Maîtrise de l’espace » : la carte de la construction remplit la hauteur, les modules prennent la place qui reste */
  for (const k of ['html #onboarding.ob-vitrine .ob-screen.ob-build{height:100%}', 'html #onboarding.ob-vitrine .ob-build-card{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    'html #onboarding.ob-vitrine .ob-build-path{position:relative;flex:0 1 auto;min-height:56px;overflow:hidden;align-content:flex-start}',
    'html #onboarding.ob-vitrine .ob-practice.is-result .ob-practice-table{flex:1 0 auto;grid-auto-rows:1fr;align-items:center}',
    'html #onboarding.ob-vitrine .ob-screen.ob-practice:not(.is-result)>.ob-title{margin-top:auto!important}'])
    assert.ok(css.includes(k), k);
  const chips = fn('obFitChips', "if(typeof window!=='undefined')window.addEventListener('resize'");
  const ctx = vm.createContext({});
  const spans = [0, 30, 60, 90].map(t => ({ offsetTop: t, offsetHeight: 24, cut: false, classList: { toggle(c, on) { this.o.cut = on; } } }));
  spans.forEach(sp => { sp.classList.o = sp; });
  ctx.document = { querySelector: () => ({ clientHeight: 80, querySelectorAll: () => spans }) };
  vm.runInContext(chips, ctx); vm.runInContext('obFitChips()', ctx);
  assert.deepEqual(spans.map(s => s.cut), [false, false, true, true], 'un module qui ne tient pas entier est masqué');
  assert.ok(fn('obFit', 'function obFitChips(').includes('obFitChips();'));
});
