/* Onboarding, 3 novembre, 13 h 25 (Elisa) : « Demander l’âge et la profession (sélection) de manière UI/UX, collé à la DA de
   l’onboarding ; centré à la verticale pour le cadre signature : Ton engagement. Chaque minute compte pour atteindre ton objectif.
   MON ENGAGEMENT PERSONNEL. Moi, Léa, je m’engage à consacrer 20 minutes par jour à mon apprentissage. À mon rythme, je développe
   mes compétences, je relève de nouveaux défis et j’avance chaque jour vers mon objectif. Ne mets pas : c’est assez pour les
   entretiens de data analyst. Et améliore les animations, les micro-interactions et l’onboarding de manière générale. »
   Vérifié dans un navigateur de 320 × 568 à 1 280 × 650, avec et sans animations réduites : chaque étape tient sans défiler, rien
   ne dépasse sur le côté. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), css = lire('onboarding-vitrine.css');
/* La dernière définition d’une fonction (l’onboarding en a d’anciennes, remplacées plus bas dans le fichier). */
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };
const slide = (name, next) => { const i = app.lastIndexOf(`}else if(slide==='${name}'){`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i + 10)); };

test('l’âge et la profession, juste après le prénom, dans le compte des étapes', () => {
  assert.ok(app.includes("const OB_SLIDES = ['welcome','name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice','account','source','rappel','widget','widgetTuto','pseudo','ready'];"));
  assert.ok(app.includes("const OB_PROFILE_SLIDES=['name','pays','age','job','goal','level','rhythm','jours','build','temoignages','pact','practice'];"), '« Étape 2 sur 10 », « Étape 3 sur 10 »');
  /* obNext, exécuté seul : prénom → pays (4 novembre, 13 h 18 : retours-1318) → âge → profession → objectif */
  const vers = [];
  const ctx = vm.createContext({ OB_SLIDES: vm.runInNewContext(app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]), obStep: 0,
    obGoto: t => vers.push(t), obAfterPractice: () => 'ready', obChooseGuest() {}, finishOnboard() {} });
  vm.runInContext(fn('obNext', 'function obBack(){') + ';var next=s=>{obStep=OB_SLIDES.indexOf(s);obNext();};', ctx);
  for (const s of ['name', 'pays', 'age', 'job']) vm.runInContext(`next('${s}')`, ctx);
  assert.deepEqual(vers, ['pays', 'age', 'job', 'goal']);
  /* Le prénom y mène par « Continuer » et par Entrée. 17 h 32 (« enlève les notions de facultatif ») : plus de « Passer pour le
     moment » ; « Continuer » attend le prénom (tests/retours-1732.test.mjs). */
  const name = slide('name', "}else if(slide==='pseudo'){");
  assert.ok(name.includes("obSetFooter('Continuer',obNameNext,'','','',!(draft.name||'').trim());") && !name.includes('Passer pour le moment'));
  assert.ok(name.includes(`onkeydown="if(event.key==='Enter'){event.preventDefault();obNameNext();}"`));
  assert.ok(fn('obNameNext', 'let obCheerT').includes("if((draft.name||'').trim()){obGoto('pays');return;}"));
});

test('âge : six tranches en tuiles, choix unique (obligatoire depuis 17 h 32)', () => {
  const ages = vm.runInNewContext(app.match(/const OB_AGES=(\[[\s\S]*?\]);\nconst OB_JOBS/)[1]);
  assert.deepEqual(Array.from(ages, a => a[0]), ['u18', '18-24', '25-34', '35-44', '45-54', '55+']);
  assert.deepEqual(Array.from(ages, a => a[2]), ['Moins de 18 ans', '18 à 24 ans', '25 à 34 ans', '35 à 44 ans', '45 à 54 ans', '55 ans et plus'], 'ce que lit un lecteur d’écran');
  const age = slide('age', "}else if(slide==='job'){");
  assert.ok(age.includes('<h1 class="ob-title" id="ob-title">Quel <em>âge</em> as-tu&nbsp;?</h1>'));
  assert.ok(age.includes("obMascotDit('Pour mieux te connaître. Il n’y a pas d’âge pour apprendre le SQL !',obMascotOui(draft.ageRange||draft.genre))"), 'la mascotte pose la question, comme aux autres étapes ; répondu, il hoche la tête (7 novembre, 15 h 38)');
  assert.ok(age.includes('role="radiogroup" aria-label="Ta tranche d’âge"') && age.includes('role="radio" aria-checked="${draft.ageRange===k?\'true\':\'false\'}" aria-label="${escAttr(label)}"'));
  assert.ok(age.includes("onclick=\"obPick('ageRange','${k}')\"") && age.includes('style="--d:${i*45}ms"'), 'les tuiles arrivent l’une après l’autre');
  assert.ok(age.includes("obSetFooter('Continuer',()=>obGoto('job'),'','','',!draft.ageRange||!draft.genre);"), '« Continuer » après les deux choix ; ni « Passer » ni « Facultatif » (17 h 32)');
  /* 4 novembre, 17 h 27 : « demander si c’est une femme ou un homme, ou ne veut pas dire (dans l’écran de l’âge, peut-être) » */
  const genres = vm.runInNewContext(app.match(/const OB_GENRES=(\[[^;]*\]);/)[1]);
  assert.deepEqual(Array.from(genres, g => g[1]), ['Une femme', 'Un homme', 'Ne pas dire']);
  assert.equal(genres[2][2], 'Je préfère ne pas le dire', 'ce que lit un lecteur d’écran');
  assert.ok(age.includes('<p class="ob-genre-q" id="ob-genre-q">Et tu es…</p><div class="ob-tiles ob-genre-row" role="radiogroup" aria-labelledby="ob-genre-q">'));
  assert.ok(age.includes("class=\"ob-tile ob-genre-c ${draft.genre===k?'on':''}\"") && age.includes("onclick=\"obPick('genre','${k}')\""));
});

test('profession : six situations en tuiles, avec leur pastille de couleur', () => {
  const jobs = vm.runInNewContext(app.match(/const OB_JOBS=(\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(Array.from(jobs, j => j[1]), ['Étudiant·e', 'Data ou développement', 'Produit, marketing ou vente', 'Finance ou opérations', 'En reconversion', 'Autre activité']);
  const job = slide('job', "}else if(slide==='goal'){");
  assert.ok(job.includes('<h1 class="ob-title" id="ob-title">Que fais-tu <em>dans la vie</em>&nbsp;?</h1>'));
  assert.ok(job.includes('role="radiogroup" aria-label="Ta situation"') && job.includes("onclick=\"obPick('job','${k}')\"") && job.includes('${obOptionIcon(icon)}<span>${esc(obJobNom(k)||label)}</span>'));
  assert.ok(job.includes("obSetFooter('Continuer',()=>obGoto('goal'),'','','',!draft.job);"));
  assert.ok(fn('obPick', 'function obPseudoTape(').includes("if(!['niveau','rythme','goal','ageRange','genre','job','source','freq'].includes(champ))return;"));
  assert.ok(fn('obPick', 'function obPseudoTape(').includes("if(champ==='genre'&&!OB_GENRES.some(g=>g[0]===val))return;"), 'seulement les trois réponses');
  /* Les réponses restent sur l’appareil, dans le profil, et l’onboarding les reprend (Mon compte › Personnalisation). */
  assert.ok(app.includes("    ageRange:draft.ageRange||'',\n    genre:OB_GENRES.some(g=>g[0]===draft.genre)?draft.genre:'',\n    job:draft.job||'',") && app.includes("    ageRange:profile.ageRange||'',\n    genre:profile.genre||'',\n    job:profile.job||'',"));
  /* « Étudiante » ou « Étudiant » selon la réponse ; sans réponse ou « Ne pas dire », « Étudiant·e » */
  const ctx = vm.createContext({ draft: {}, state: { profile: {} } });
  vm.runInContext(app.match(/const OB_JOBS=\[[\s\S]*?\];\n/)[0].replace('const OB_JOBS', 'var OB_JOBS') + fn('genreDe', 'function accord(') + fn('accord', 'function obJobNom(') + fn('obJobNom', 'const OB_SOURCES'), ctx);
  const nom = g => { ctx.draft.genre = g; return vm.runInContext("obJobNom('student')", ctx); };
  assert.deepEqual([nom('f'), nom('h'), nom('n'), nom(undefined)], ['Étudiante', 'Étudiant', 'Étudiant·e', 'Étudiant·e']);
  ctx.draft.genre = ''; ctx.state.profile.genre = 'f';
  assert.equal(vm.runInContext("obJobNom('student')", ctx), 'Étudiante', 'après l’onboarding, le profil');
  assert.equal(vm.runInContext("obJobNom('data')", ctx), 'Data ou développement');
  assert.ok(lire('decouvrir/confidentialite.html').includes('Ton prénom, ta tranche d’âge, ton genre et ta profession (si tu les indiques), ton pays (seul son drapeau accompagne ton pseudo dans les défis, voir plus bas), la liste de tes amis des défis, la façon dont tu as connu Requête, ton objectif,'), 'la page Confidentialité le dit');
});

test('les tuiles suivent la DA de l’onboarding : cartes blanches à rebord, coche jaune soleil', () => {
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-age-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-job-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'));
  assert.match(css, /html #onboarding\.ob-vitrine \.ob-tile\{position:relative;[^}]*border:2\.5px solid #fff;border-radius:18px;background:#fff;color:var\(--v-ink\);box-shadow:0 4px 0 var\(--v-shadow-lip\)/);
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-tile.on{border-color:var(--v-sun);background:#FFFBEB;box-shadow:0 4px 0 var(--v-sun-lip)}'));
  assert.ok(css.includes('background:var(--v-sun) var(--v-check) center/15px no-repeat;box-shadow:0 2px 0 var(--v-sun-lip),0 0 0 3px #fff;animation:obvPop'), 'la même coche que les réponses');
  /* Plus petit écran : la tuile reste en colonne (en ligne, « développement » sortait de la tuile) */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-4 .ob-job-tile{min-height:0;gap:4px;padding:7px 6px 8px}'));
});

test('l’engagement : le nouveau texte, et le certificat au milieu de l’écran', () => {
  const pact = slide('pact', '}else{');
  /* 5 novembre, 21 h 19 : « Un engagement envers toi-même », « 10 minutes par jour peuvent faire toute la différence » (les minutes et
     les jours choisis), « Mon engagement » ; le certificat vient de pacteCarteHTML (retours-2119) */
  assert.ok(pact.includes('<h1 class="ob-title" id="ob-title">Un <em>engagement</em> envers <span class="ob-nw">toi-même</span>.</h1>\n      <p class="ob-lead">${pacteLead(b.minutes,f)}</p>'));
  const carte = app.slice(app.indexOf('function pacteCarteHTML(o){'), app.indexOf('function holdZoneHTML('));
  assert.ok(carte.includes('<p class="ob-pact-k">Mon engagement</p>'));
  assert.ok(carte.includes("<p class=\"ob-pact-txt\">Moi, <b>${o.nom?esc(o.nom):accord('future','futur','futur·e')+' pro du SQL'}</b>, je m’engage à consacrer ${pacteDuree(o.m,f)} à mon apprentissage.</p>"));
  assert.ok(carte.includes("<p class=\"ob-pact-txt\">À mon rythme, je développe mes compétences, je relève de nouveaux défis et j’avance ${f>=5?'chaque jour':'à chaque séance'} vers mon objectif.</p>"));
  /* La durée dit le vrai rythme choisi : 20 minutes par jour (tous les jours), en semaine, ou n jours par semaine */
  const fn = app.match(/function pacteDuree\(m,f\)\{[^\n]+\}/)[0];
  const duree = (f, minutes = 20) => vm.runInNewContext(fn + `;pacteDuree(${minutes},${f})`);
  assert.equal(duree(7), '<b>20 minutes par jour</b>');
  assert.equal(duree(5), '<b>20 minutes par jour</b> en semaine');
  assert.equal(duree(3, 10), '<b>10 minutes</b>, <b>3 jours par semaine</b>,');
  assert.ok(!app.includes('Mon contrat d’apprentissage'), 'l’ancien titre du cadre');
  /* Centré : marges automatiques au-dessus et en dessous du cadre, dans un écran à pleine hauteur */
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-screen.ob-pact{min-height:100%}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-pact .ob-pact-card{margin-top:auto;margin-bottom:auto}'));
  /* La phrase sous le titre reste sur les téléphones courants ; elle ne part qu’au dernier palier (5), sur le plus petit écran */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-2 .ob-pact .ob-lead{display:block!important;'));
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-lead{display:none!important}'));
  assert.ok(app.includes("const C=['ob-fit-1','ob-fit-2','ob-fit-3','ob-fit-4','ob-fit-5'];"));
  /* 5 novembre, 19 h 41 : le doigt maintenu sur le bouton à l’empreinte remplace la signature (retours-1941) */
  assert.ok(pact.includes("${holdZoneHTML('ob-hold',!!draft.pacte,typeof chatBonusHtml==='function'?chatBonusHtml('serment','ob-hold-chat'):'')}") && app.includes('<button type="button" class="ob-hold${fait?\' is-done\':\'\'}" id="${id}"') && !pact.includes('ob-sign'));
});

test('la promesse ne dit plus « c’est assez pour les entretiens de data analyst » (ni aucune promesse de résultat)', () => {
  /* Le code de l’écran, sans ses commentaires (ils citent la demande d’Elisa) */
  /* 4 novembre, 17 h 27 (réf. 8 et 9) : la page « 24 jours » a rejoint celle des jours ; la phrase y est, toujours sans promesse */
  assert.ok(!app.includes("}else if(slide==='promise'){"), 'plus de page à part');
  const promise = slide('jours', "}else if(slide==='build'){").replace(/\/\*[\s\S]*?\*\//g, '');
  for (const t of ['premiers entretiens', 'c’est assez pour', 'goalLine', '<p class="ob-lead">']) assert.ok(!promise.includes(t), t);
  assert.ok(!app.includes('premiers entretiens de data analyst'), 'nulle part dans l’appli');
  assert.ok(promise.includes('tu termines tes <em>${b.lessons}&nbsp;leçons</em> d’ici le <b>${esc(b.endLabel)}</b>.</p>'));
});

test('micro-interactions : sens des transitions, entrées en cascade, bouton qui se réveille, mascotte qui saute de joie', () => {
  /* Le sens : en avant le contenu part à gauche et le suivant arrive de droite ; en arrière, l’inverse ; une nouvelle ouverture monte */
  assert.ok(fn('obGoto', 'function obCtaWake(').includes("if(root)root.dataset.obDir=cible>obStep?'fwd':'back';"));
  assert.ok(fn('startOnboarding', 'function closeOnboardingAuth(').includes('delete root.dataset.obDir;'));
  /* 6 novembre, 23 h 16 (« la page bouge ») : le sens reste, mais en fondu, sans glisser (tests/retours-2316.test.mjs) */
  for (const k of ['@keyframes obvOutFwd{to{opacity:0}}', '@keyframes obvInFwd{from{opacity:0}to{opacity:1}}',
    '@keyframes obvInBack{from{opacity:0}to{opacity:1}}', '@keyframes obvApparait{from{opacity:0}to{opacity:1}}'])
    assert.ok(css.includes(k), k);
  assert.ok(css.includes('html #onboarding.ob-vitrine[data-ob-dir="back"] .ob-slide.out .ob-screen>:not(.ob-flow-top){animation-name:obvOutBack!important}'), 'l’en-tête reste en place');
  /* Les cartes entrent sans garder de style d’animation : le premier appui les enfonce bien */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-enter :is(.ob-answer,.ob-tile){animation:obvApparait .24s ease-out backwards;'));
  assert.ok(app.includes("items.map(([key,label,icon],i)=>") && app.includes('class="ob-answer ${value===key?\'on\':\'\'}" style="--d:${i*45}ms"'), 'les réponses en cascade, à chaque étape');
  /* Le bouton se réveille quand il devient utilisable : choix, signature, parcours construit, première requête réussie */
  const wake = fn('obCtaWake', 'function obAuthReady(');
  assert.ok(wake.includes("if(!btn||btn.disabled||prefersReduceMotion())return;") && wake.includes("btn.classList.add('is-awake')"));
  assert.ok(fn('obSetFooter', 'function obRythmeMinutes(').includes('if(was&&!btn.disabled&&primary&&!obJustEntered)obCtaWake(btn);'));
  assert.ok(fn('obRunBuild', 'function obRunBig(').includes('if(btn&&btn.disabled){btn.disabled=false;obCtaWake(btn);}'));
  /* 10 h 45 : la première requête réussie ne saute plus de joie ici (sa mascotte n’est plus sur la page du résultat) : la mascotte
     de la connexion le fait, avec les confettis. */
  assert.ok(!fn('obRunPractice', 'function obCanNext(').includes("root.classList.add('ob-cheer')") && css.includes('.ob-enter .ob-account.is-fete .ob-compte-stk{animation:obvJoy .9s var(--v-pop) .22s both}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-cheer .ob-chat img{animation:obvJoy .8s var(--v-pop) both}'));
  /* La progression se remplit en jaune soleil en avançant */
  assert.ok(css.includes('html #onboarding.ob-vitrine.ob-enter[data-ob-dir="fwd"] .ob-mini-progress i.on::before{animation:obvSegFill .5s'));
  /* Le halo du coin ne fait plus défiler l’onboarding sur le côté */
  assert.ok(css.includes('@supports (overflow:clip){html #onboarding.ob-vitrine{overflow:clip}}'));
  /* Animations réduites : rien ne bouge */
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){\n  html #onboarding.ob-vitrine .ob-slide.out .ob-screen>*,html #onboarding.ob-vitrine.ob-enter .ob-screen>*,'));
  assert.ok(css.includes('html[data-motion="reduce"] #onboarding.ob-vitrine :is(.ob-screen>*,.ob-answer,.ob-tile,'));
});

test('feuille rechargée et cache renouvelé', () => {
  const sw = lire('sw.js');
  assert.ok(app.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=39">') && sw.includes("'./onboarding-vitrine.css?v=39',"));
  const cache = sw.match(/const CACHE = '([^']+)';/)[1];
  assert.ok(app.includes(`const SW_CACHE='${cache}';`), 'même cache dans la page et le service worker');
  assert.ok(cache !== 'requete-2026-11-03-responsive-v2464', 'renouvelé depuis la version d’avant l’onboarding');
});
