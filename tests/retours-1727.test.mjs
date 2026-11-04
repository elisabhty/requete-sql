/* 4 novembre, 17 h 27 (Elisa, neuf captures de l’iPhone, TestFlight 1.0 (6)) :
   « Découvrez ce que eux en pensent (UI/UX, DA du site internet), après Requête. Réf. 2 : centre le sous-texte du bas avec les
   conditions. Réf. 3 : trop collé, la partie notification, au cadre du haut. Réf. 4 : j’ai l’impression que les textes ne sont pas bien
   centrés, ils ont l’air de partir vers la gauche ; vérifie pour les autres pages. Pas de Plus tard pour Choisis ton pseudo
   (obligatoire). Réf. 5 : la Dynamic Island bugue, j’ai l’impression. Réf. 6 : regarde, il y a un bout qui reste (onboarding) quand on
   change de page. Demander si c’est une femme ou un homme, ou ne veut pas dire (dans l’écran de l’âge, peut-être). Réf. 7 : essayer de
   mettre l’objectif sur l’accueil, de manière UI/UX (DA du site internet). Réf. 8 et 9 : fusionner sur une page, car on s’en fout des
   activités sur un an, etc. : à enlever. »
   Vérifié dans un navigateur de 375 × 667 à 430 × 932 : chaque étape tient sans défiler ; centre de chaque ligne mesuré page par page. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), css = lire('onboarding-vitrine.css'), lq = lire('ludique.css');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); const j = app.indexOf(next, i); assert.ok(j > i, next); return app.slice(i, j); };
const slide = (name, next) => { const i = app.lastIndexOf(`}else if(slide==='${name}'){`); assert.ok(i > 0, name); const j = app.indexOf(next, i + 10); assert.ok(j > i, next); return app.slice(i, j); };
const section = css.slice(css.indexOf('/* ---------- 4 novembre, 17 h 27 (Elisa, captures de l’iPhone) ----------'));

test('réf. 4 et 2 : les phrases centrées le sont vraiment (la largeur maximale gardait la boîte collée à gauche)', () => {
  assert.ok(app.includes('  .ob-slides p{margin:0;') && app.includes('  .ob-lead{max-width:360px;margin:12px auto 0;') && app.includes('  .ob-legal-note{margin:20px auto 0;max-width:340px;'),
    'la cause : « .ob-slides p » écrasait les marges automatiques');
  assert.ok(section.includes('html #onboarding.ob-vitrine .ob-slides p.ob-lead,html #onboarding.ob-vitrine .ob-slides p.ob-legal-note{margin-left:auto!important;margin-right:auto!important}'));
  /* Plus spécifique que « .ob-slides p » (0,1,1) : un identifiant, des classes */
  assert.ok(lire('index.html').includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=23">'));
});

test('réf. 3 : le cadre de la notification s’écarte de la carte de l’heure (son anneau de 9 px compris)', () => {
  const marges = [...section.matchAll(/html #onboarding\.ob-vitrine(\.ob-fit-(\d))? \.ob-rappel-step \.ob-notif\{margin-top:(\d+)px\}/g)].map(m => [m[2] ? +m[2] : 0, +m[3]]);
  assert.deepEqual(marges, [[0, 32], [1, 30], [2, 26], [3, 22], [4, 20]]);
  for (const [, m] of marges) assert.ok(m - 9 >= 11, `au moins 11 px visibles (${m - 9})`);
  assert.ok(css.includes('box-shadow:0 0 0 3px #fff,0 0 0 9px rgba(255,216,107,.32)'), 'l’anneau de 9 px, qui touchait presque la carte à 12 px');
});

test('réf. 6 : la pastille cochée d’une tuile choisie s’efface dès que la page sort', () => {
  assert.ok(section.includes('html #onboarding.ob-vitrine .ob-slide.out :is(.ob-tile.on,.ob-answer.on,.ob-pays-carte.is-on)::before{opacity:0!important;visibility:hidden!important;animation:none!important}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-tile.on::before{content:\'\';position:absolute;z-index:1;right:-9px;top:-9px;'), 'elle dépasse du coin de la tuile');
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-slide.out .ob-screen>:not(.ob-flow-top){animation:obvOutFwd .17s'), 'la page qui sort');
});

test('réf. 1 : « Découvre ce qu’ils en pensent », un autocollant comme ceux de la vitrine, posé sur la carte des avis', () => {
  const i = app.indexOf('/* ---------- « Ils apprécient Requête » (Elisa, 4 novembre, 14 h 08) ----------'), j = app.indexOf('/* 14 h 08 (réf. 3) : « mettre une flèche animée', i);
  const bloc = app.slice(i, j);
  assert.ok(bloc.includes('const OB_STK_AVIS=\'<svg viewBox="0 0 48 48" aria-hidden="true">'), 'l’étoile, dans le bloc des avis');
  assert.ok(bloc.includes('<div class="ob-tv" id="ob-tv">\n      <span class="ob-stk lav ob-tv-stk">Découvre ce qu’ils en pensent${OB_STK_AVIS}</span>\n      <div class="ob-tv-ph">'));
  /* La même étoile que l’autocollant « Tes retours font l’appli » du site */
  const site = lire('decouvrir/index.html'), etoile = 'M24 4l5.6 11.8 12.9 1.6-9.5 8.9 2.4 12.8L24 32.8l-11.4 6.3 2.4-12.8-9.5-8.9 12.9-1.6z';
  assert.ok(site.includes('<span class="sticker lav avis-stk">Tes retours font l’appli<svg viewBox="0 0 48 48" aria-hidden="true"><path d="' + etoile) && bloc.includes(etoile));
  for (const k of ['html #onboarding.ob-vitrine .ob-tv-stk{position:relative;z-index:3;align-self:center;margin:0 0 -13px;transform:rotate(-2deg);',
    'html #onboarding.ob-vitrine .ob-tv-stk::before{left:-22px;top:-11px}', 'html #onboarding.ob-vitrine.ob-fit-4 .ob-tv-stk{display:none}',
    '@keyframes obvStkWobble{0%,100%{transform:rotate(-2deg)}30%{transform:rotate(3deg) scale(1.06)}60%{transform:rotate(-4deg)}}'])
    assert.ok(section.includes(k), k);
  /* Il se dandine une fois, seulement avec les mouvements autorisés (le média de retours-1732) */
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){'), css.indexOf('@media (prefers-reduced-motion:reduce){', css.indexOf('@media (prefers-reduced-motion:no-preference){')));
  assert.ok(media.includes('  html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .ob-tv-stk{animation:obvStkWobble .8s ease-in-out .55s both}'));
  assert.ok(css.includes('html #onboarding.ob-vitrine .ob-stk.lav{background:#DDD4FF}'), 'le lavande de la vitrine');
});

test('femme, homme ou ne pas dire : sur l’écran de l’âge, gardé sur l’appareil, et les mots s’accordent', () => {
  const age = slide('age', "}else if(slide==='job'){");
  assert.ok(age.indexOf('ob-age-grid') < age.indexOf('ob-genre-row'), 'sous les âges');
  assert.ok(age.includes("obSetFooter('Continuer',()=>obGoto('job'),'','','',!draft.ageRange||!draft.genre);"));
  for (const k of ['html #onboarding.ob-vitrine .ob-age-step .ob-age-grid{margin-bottom:0}', 'html #onboarding.ob-vitrine .ob-age-step .ob-genre{margin-top:18px;margin-bottom:auto}',
    'html #onboarding.ob-vitrine .ob-genre-row{grid-template-columns:repeat(3,minmax(0,1fr))}'])
    assert.ok(section.includes(k), k);
  /* Le profil, et sa reprise (Mon compte › Personnalisation) */
  assert.ok(fn('finishOnboard', 'function obTerminer(').includes("    genre:OB_GENRES.some(g=>g[0]===draft.genre)?draft.genre:'',"));
  assert.ok(fn('startOnboarding', 'function closeOnboardingAuth(').includes("    genre:profile.genre||'',"));
  /* Les accords, exécutés seuls */
  const ctx = vm.createContext({ draft: {}, state: { profile: {} } });
  vm.runInContext(app.match(/const OB_JOBS=\[[\s\S]*?\];\n/)[0].replace('const OB_JOBS', 'var OB_JOBS') + app.match(/const OB_GENRES=[^\n]+\n/)[0].replace('const OB_GENRES', 'var OB_GENRES') + fn('genreDe', 'function accord(') + fn('accord', 'function obJobNom('), ctx);
  const dire = (g, f, h, n) => { ctx.draft.genre = g; return vm.runInContext(`accord(${JSON.stringify(f)},${JSON.stringify(h)},${JSON.stringify(n)})`, ctx); };
  assert.deepEqual(['f', 'h', 'n', '', 'x'].map(g => dire(g, 'seule', 'seul', 'seul·e')), ['seule', 'seul', 'seul·e', 'seul·e', 'seul·e']);
  /* Les mots qui parlent de la personne */
  for (const k of ["${obMascotQuestion(accord('Étudiante','Étudiant','Étudiant·e')+', en poste ou en reconversion : tout le monde a sa place ici.')}",
    "accord('future','futur','futur·e')+' pro du SQL'", "Tu es ${typeof accord==='function'?accord('invitée','invité','invité·e'):'invité·e'} dans la salle",
    "tu joues ${typeof accord==='function'?accord('seule','seul','seul·e'):'seul·e'}.`;", '  const profileJob=obJobNom(profile.job);'])
    assert.ok(app.includes(k), k);
  /* Rien ne part : la page de confidentialité le dit avec le reste du profil */
  assert.ok(lire('decouvrir/confidentialite.html').includes('Ton prénom, ta tranche d’âge, ton genre et ta profession (si tu les indiques), ton pays (seul son drapeau accompagne ton pseudo dans les défis, voir plus bas), la liste de tes amis des défis, la façon dont tu as connu Requête'));
});

test('le pseudo, obligatoire pendant l’onboarding : pas de « Plus tard », et la page revient tant qu’il n’y en a pas', () => {
  const avant = fn('obPseudoAvant', '\n}\n');
  assert.ok(avant.includes('const s=clsSalle();if(s.psVoulu)return false;') && !avant.includes('if(s.psPage)return false;'), 'déjà montrée ne suffit plus ; gardé hors ligne, si');
  assert.ok(avant.includes('psPage({voulu:psAncien(),garder:true,obligatoire:true,suite:()=>{obEntry=entree;obGoto(\'ready\');}});'));
  const page = slide('pseudo', "}else if(slide==='pays'){");
  assert.ok(page.includes("    const pg=PS.page||{};\n    obSetFooter('C’est mon pseudo',obPseudoSuivant,pg.obligatoire?'':'Plus tard',pg.obligatoire?'':obPseudoPlusTard,'',!v);"));
  /* Sans réseau, le pseudo tapé est gardé et réservé au retour en ligne : l’onboarding ne reste pas bloqué */
  assert.ok(fn('obPseudoSuivant', 'function obPseudoPlusTard(').includes("const s=clsSalle();s.psVoulu=n;save();"));
});

test('réf. 8 et 9 : la page « 24 jours » rejoint celle des jours, sans le bilan sur un an', () => {
  const ob = vm.runInNewContext(app.match(/const OB_SLIDES = (\[[^\]]+\]);/)[1]);
  assert.ok(!ob.includes('promise') && ob.indexOf('build') + 1 === ob.indexOf('temoignages'));
  const j = slide('jours', "}else if(slide==='build'){");
  assert.ok(!j.includes('Voilà ce que ça t’apporte en un an') && !j.includes('OB_ICO_ACTIVITES') && !j.includes('OB_ICO_HEURES'));
  assert.ok(j.includes('<div class="ob-apport ob-proj"><p class="ob-apport-k">À ce rythme</p>'));
  assert.ok(fn('obRepriseLire', 'function obRepriseOublier(').includes("if(r&&r.slide==='promise')r.slide='temoignages';"), 'une reprise sur l’ancienne page repart des avis');
  for (const k of ['html #onboarding.ob-vitrine .ob-proj-row{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:16px;text-align:left}',
    'html #onboarding.ob-vitrine .ob-proj-big b{display:block;font:800 clamp(46px,13.5vw,58px)/.9 var(--v-display);'])
    assert.ok(section.includes(k), k);
  /* L’entonnoir : la migration qui retire l’étape (appliquée le 4 novembre à 18 h 30, avec l’accord d’Elisa) */
  const sql = lire('supabase/migrations/20261104173026_onboarding_entonnoir_sans_promesse.sql');
  assert.ok(sql.includes('create or replace view public.onboarding_entonnoir with (security_invoker = true) as') && !sql.includes("'promise'"));
  assert.ok(sql.includes('revoke all on public.onboarding_entonnoir from public, anon, authenticated;'));
});

test('réf. 7 : l’objectif sur l’accueil, sous la série, dans une carte comme celles de la vitrine', () => {
  const ctx = vm.createContext({
    state: { profile: { goal: 'work' }, lessons: {}, plan: { sessions: [{ d: '2026-11-05', lessons: [1] }, { d: '2026-11-27', lessons: [2] }, { d: '2026-11-28', lessons: [] }] } },
    MODULES: [], moduleProgressData: () => [{ done: 3, total: 50 }, { done: 0, total: 21 }],
    parseD: s => new Date(s + 'T12:00:00'), esc: s => String(s), escAttr: s => String(s).replace(/"/g, '&quot;'),
    obOptionIcon: t => `<span class="ob-answer-icon" data-t="${t}"></span>`
  });
  vm.runInContext(app.match(/const OB_GOALS=\[[\s\S]*?\];/)[0].replace('const OB_GOALS', 'var OB_GOALS') + app.match(/const LQ_OBJ_PHRASES=[^\n]+\n/)[0] + fn('objectifAccueilHTML', 'function objectifModifier('), ctx);
  const html = vm.runInContext('objectifAccueilHTML()', ctx);
  assert.ok(html.includes('<button type="button" class="lq-obj" data-goal="work" onclick="objectifModifier()"'));
  assert.ok(html.includes('<small class="lq-obj-k">Ton objectif</small><b>Être plus efficace au travail</b><small class="lq-obj-p">Analyse tes propres données avec SQL</small>'));
  assert.ok(html.includes('<span class="lq-obj-bar" style="--p:4%"><i></i></span><small class="lq-obj-meta">4 % fait · fin prévue le 27 novembre</small>'), '3 leçons sur 71, la dernière séance du planning');
  assert.ok(html.includes('aria-label="Ton objectif : Être plus efficace au travail. 3 leçons validées sur 71, fin prévue le 27 novembre. Modifier mon objectif."'));
  assert.ok(html.includes('<span class="ob-answer-icon" data-t="chart"></span>'), 'le pictogramme de l’objectif, comme à l’onboarding');
  ctx.moduleProgressData = () => [{ done: 71, total: 71 }];
  assert.ok(vm.runInContext('objectifAccueilHTML()', ctx).includes('class="lq-obj is-atteint"') && vm.runInContext('objectifAccueilHTML()', ctx).includes('Objectif atteint, bravo !'));
  ctx.state.profile = {};
  assert.equal(vm.runInContext('objectifAccueilHTML()', ctx), '', 'sans objectif, pas de carte');
  /* À sa place : sous la série (et le rattrapage s’il y en a), dans les deux cartes du cours */
  assert.equal((app.match(/\$\{streak\}\$\{extras\}\$\{objectifAccueilHTML\(\)\}`;/g) || []).length, 2);
  assert.ok(fn('objectifModifier', '/* Même HTML').includes("switchTab('compte');") && fn('objectifModifier', '/* Même HTML').includes("openPlusDetails('plus-profile-settings')"), 'un appui : Profil et objectif');
  /* La DA du site : carte blanche en relief, carré pastel de l’objectif (couleurs de la vitrine), trait devant l’étiquette */
  for (const k of ['html.lq #home-hero .lq-obj{display:flex;align-items:center;gap:12px;', 'border:2px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 4px 0 var(--lip);',
    'html.lq #home-hero .lq-obj[data-goal="work"] .ob-answer-icon{background:#E3F0FF;color:#2F7BEF}', 'html.lq #home-hero .lq-obj-k::before{content:"";flex:none;width:14px;height:3px;border-radius:3px;background:currentColor}'])
    assert.ok(lq.includes(k), k);
  assert.ok(lire('decouvrir/vitrine.css').includes('.i-e{background:#E3F0FF;color:#2F7BEF}'), 'les couleurs de la vitrine');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=140">'));
});

test('réf. 5 : dans la Dynamic Island, l’avancement en pour cent (plus d’anneau qui ressemblait à une roue qui charge)', () => {
  assert.ok(!swift.includes('LeconAnneau') && !swift.includes('.trim(from: 0'));
  const v = swift.slice(swift.indexOf('struct LeconPourcent: View {'), swift.indexOf('/// L’écran verrouillé'));
  for (const k of ['let part: Double = etat.fini ? 1 : min(1, max(0, etat.progression))', 'let pct: Int = Int((part * 100).rounded())',
    'let texte: String = etat.fini ? "✓" : "\\(pct)\\u{202F}%"', 'let teinte: Color = etat.fini ? dore : braise', 'return Text(texte)\n            .font(police)\n            .monospacedDigit()'])
    assert.ok(v.includes(k), k);
  assert.ok(swift.includes('@available(iOS 16.1, *)\nstruct LeconPourcent: View {'));
  assert.ok(swift.includes('} compactTrailing: {\n                LeconPourcent(etat: context.state)\n            } minimal: {'));
  assert.ok(lire('IOS.md').includes('pour cent à droite (« 12 % », une coche dorée une fois réussie ; 4 novembre, 17 h 27 :'));
  const code = swift.replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const [o, f] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(o).length, code.split(f).length, `${o}${f} équilibrées`);
});
