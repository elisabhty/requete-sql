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
  assert.ok(run('debutant').includes('Tu pars du début : chaque notion arrive dans l’ordre.'));
  assert.ok(run('bases').includes('tes défis seront de niveau <b>Moyen</b>') && run('inter').includes('tes défis seront de niveau <b>Difficile</b>'));
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
  assert.ok(run.includes("t.innerHTML='Ton parcours<br>est <em>construit</em>&nbsp;!';") && run.includes("lbl.textContent='Parcours construit';") && run.includes('draft.buildDone=true;'));
  assert.ok(fn('obPick', 'function obPseudoTape(').includes("if(champ==='niveau'||champ==='rythme'||champ==='goal')draft.buildDone=false;"), 'un autre choix reconstruit le parcours');
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
  assert.ok(p.includes("const typing=!draft.practiceDone&&obJustEntered&&!prefersReduceMotion();") && p.includes('<div class="ob-practice-card${typing?\' is-typing\':\'\'}">'));
  assert.ok(p.includes('<button type="button" class="ob-practice-run" id="ob-practice-run" onclick="obRunPractice()"><span class="ob-practice-play" aria-hidden="true">▶</span><span class="ob-practice-lbl">Exécuter la requête</span></button>'));
  assert.ok(p.includes('<b class="ob-practice-n" data-n="${rowsN}">${rowsN}</b> ${rowsN>1?\'lignes\':\'ligne\'}') && p.includes("`<span${ci===2?' class=\"is-hit\"':''} style=\"--rd:${220+ri*120}ms\">"));
  /* Plus de « Passer l’essai » ; si le moteur SQL ne démarre pas, « Continuer » reste possible */
  assert.ok(!code.includes('Passer l’essai') && !code.includes('Aucune erreur possible : cet essai est guidé.'));
  assert.ok(p.includes("const canGo=!!(draft.practiceDone||draft.practiceFailed);") && p.includes("obSetFooter(canGo?'Continuer':'Exécute la requête pour continuer',()=>obGoto(obAfterPractice()),'','','',!canGo);"));
  const run = fn('obRunPractice', 'function obCanNext(');
  assert.ok(run.includes("if(draft.practiceDone||obPracticeBusy)return;") && run.includes("l.textContent='Exécution…'") && run.includes("btn.setAttribute('aria-busy','true')"));
  assert.ok(run.includes('setTimeout(()=>{obPracticeBusy=false;if(obStep===st&&OB_SLIDES[obStep]===\'practice\')obPracticeRun();},reduce?0:760);'), 'la requête part après le balayage, sauf si l’on a quitté l’étape');
  assert.ok(/catch\(e\)\{\s*draft\.practiceRows=\[\];\s*draft\.practiceDone=false;[\s\S]*?draft\.practiceFailed=true;/.test(run));
  for (const k of ['.ob-practice-card.is-typing .ob-tl{overflow:hidden;animation:obvType var(--t) steps(var(--n),end) var(--dl) backwards,obvCaret var(--t) linear var(--dl)}',
    '.ob-practice-run:not(:disabled)::after{animation:obvRing 1.8s ease-in-out .5s infinite}', '.ob-practice-card.is-running .ob-practice-code::after{animation:obvScan',
    '.ob-practice-result.is-new .ob-practice-table span.is-hit{animation:obResultIn', '.ob-practice-reward.is-new{animation:obvStampIn .55s var(--v-pop) 1s both}',
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
  for (const f of ['safari-surface.css?v=11', 'onboarding-vitrine.css?v=6']) assert.ok(app.includes(`<link rel="stylesheet" href="${f}">`) && sw.includes(`'./${f}',`), f);
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
