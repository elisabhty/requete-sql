/* Retours d’Elisa du 13 novembre, 9 h 56 (une capture de l’offre de bienvenue en dollars, et six points).
   1. « Pourquoi on a US ici et dollar (c’est pas homogène ?) » : la capture vient d’une version d’avant 2 h 41. Depuis, tous les
      montants s’écrivent de la même façon, à partir du prix et de la devise de la boutique (retours-0241-prix-accueil.test.mjs).
      Simulé avec les prix américains : « 19,99 $US au lieu de 39,99 $US », « Économise 20 $US ». Rien à changer.
   2. « Une personne qui vient sur l’appli après l’onboarding tombe bien sur l’accueil et pas sur le cours ? » : ce n’était pas le
      cas du nouvel inscrit, que « Commencer la première leçon » envoyait dans sa première leçon. La fin de l’onboarding mène
      maintenant à l’accueil pour tout le monde, et le bouton dit « Commencer ».
   3. 4. 5. « Restaurer », l’achat à −50 %, et la personne qui n’a pas payé : vérifiés en simulation (rien à restaurer : le message
      et le paywall reste ; l’achat de l’offre de bienvenue ouvre l’appli ; sans abonnement, le paywall reste devant l’appli).
      Déjà tenus par retours-0322-garde-compte, retours-1711-paywall et retours-0241-prix-accueil.
   6. « Mettre la vidéo data analyst […] juste après ce titre, de manière bien détourée, bien fondue ; quand on clique sur
      Commencer on tombe sur la vidéo et on a un bouton pour aller sur la partie appli » : sur le site, la vidéo (video.html?site,
      dans un cadre sans fond) suit le titre du héros ; « Commencer » y mène ; dessous, « Découvrir l’appli » descend à la
      section iPhone. Vérifié dans un navigateur, sur téléphone, tablette et ordinateur : l’affiche se fond dans le héros, la
      lecture, la pause hors de l’écran, la fin qui mène à la section iPhone, le doigt qui fait défiler la page depuis la vidéo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), site = lire('decouvrir/index.html'), video = lire('decouvrir/video.html'), css = lire('decouvrir/vitrine.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

/* ---------- 2. L’appli : la fin de l’onboarding mène à l’accueil ---------- */
test('la fin de l’onboarding mène à l’accueil, sans ouvrir de leçon ; le bouton dit « Commencer »', () => {
  const fin = cut(app, 'function obTerminer(action){', '\nfunction celebrate(){');
  const terminer = (action, inv = null) => {
    const appels = [], positions = {learn: 420};
    const el = {classList: {remove() {}}, setAttribute() {}};
    const ctx = vm.createContext({document: {getElementById: () => el}, obBarreEtat() {}, renderGreeting() {}, renderHomeHero() {}, renderProgress() {}, renderPlanning() {}, renderCompte() {},
      celebrate() {}, state: {plan: {sessions: [{lessons: [7]}]}}, isDefiId: () => false, tabScrollPositions: positions,
      switchTab: t => appels.push('onglet ' + t), openLesson: id => appels.push('leçon ' + id), closePlusDetails: () => appels.push('feuille fermée'), requestAnimationFrame: f => f(),
      jeuInvitation: () => inv, jeuFromUrl() {}, setTimeout() {}});
    vm.runInContext('var semaineOffset=0,jourSel=null,OB_CHATS=[];' + cut(app, 'function obVersAccueil(){', '\n}') + '\n}\n' + fin, ctx);
    ctx.obTerminer(action);
    return {appels, haut: positions.learn};
  };
  /* Le nouvel inscrit (« home ») comme celui qui retrouve son compte (« accueil ») : l’onglet Accueil, en haut, aucune leçon ouverte */
  for (const action of ['home', 'accueil', undefined]) {
    const r = terminer(action);
    assert.deepEqual(r.appels, ['feuille fermée', 'onglet learn'], String(action));
    assert.equal(r.haut, 0, 'en haut de l’accueil');
  }
  /* Les autres fins ne changent pas */
  assert.deepEqual(terminer('plan-ready').appels, ['onglet planning']);
  assert.deepEqual(terminer('compte').appels, ['onglet compte']);
  assert.deepEqual(terminer('home', {code: 'PRET02'}).appels, ['onglet defis'], 'une invitation en attente passe avant');
  assert.ok(!fin.includes('openLesson') && !fin.includes('firstId'), 'plus de première leçon ouverte d’office');
  /* Le bouton de « Ton parcours est prêt » */
  assert.ok(app.includes("    else if(typeof obApercu!=='undefined'&&obApercu)obSetFooter('Commencer',()=>finishOnboard('home'),'Voir mon parcours',()=>finishOnboard('plan-ready'),'');"));
  assert.ok(app.includes("    else obSetFooter('Commencer',()=>obApresPret('home'),'Voir mon parcours',()=>obApresPret('plan-ready'),"));
  assert.ok(!app.includes("'Commencer la première leçon'"), 'il ne promet plus la première leçon');
});

/* ---------- 6. Le site : la vidéo après le titre ---------- */
test('le site : la vidéo suit le titre du héros, dans un cadre sans fond ; dessous, le bouton vers la section iPhone', () => {
  const heros = cut(site, '<section class="hero">', '<div class="visual">');
  const titre = heros.indexOf('la compétence n°1 des data analysts.</h1>'), bloc = heros.indexOf('<div class="hv load l2" id="video">'), texte = heros.indexOf('<p class="lead load l2">');
  assert.ok(titre > 0 && bloc > titre && texte > bloc, 'le titre, la vidéo, puis le texte');
  assert.ok(!heros.slice(titre, bloc).includes('<p') && !heros.slice(titre, bloc).includes('<div'), 'rien entre le titre et la vidéo');
  const hv = cut(heros, '<div class="hv load l2" id="video">', '<p class="lead load l2">');
  assert.ok(hv.includes('<div class="hv-card"><iframe class="hv-f" src="video.html?site" title="Vidéo : le métier de data analyst, en 2 minutes"></iframe></div>'));
  assert.match(hv, /<a class="btn btn-g btn-lg hv-go" href="#mobile">Découvrir l’appli<svg [^>]*aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"\/><\/svg><\/a>/);
  assert.equal((site.match(/id="video"/g) || []).length, 1);
  /* « Commencer » et « Voir la vidéo » y mènent : la barre, le menu, l’affiche « +55 », « Comment ça marche », le dernier appel, le pied */
  assert.equal((site.match(/href="#video"/g) || []).length, 7);
  assert.ok(site.includes('<a class="how-vid rv d1" href="#video">'));
  assert.ok(!/href="video\.html"/.test(site), 'plus de lien vers la page seule');
  /* La feuille : la carte fait la largeur de la vidéo, sa hauteur (5/4) plus les 64 px de la barre ; le liseré, le halo et l’ombre sont ici */
  const feuille = css.slice(css.indexOf('/* ---------- La vidéo du héros (Elisa, 13 novembre, 9 h 56) ----------'));
  assert.ok(feuille.includes('.hv{margin:26px 0 0;max-width:470px}') && feuille.includes('.hv-card{position:relative;height:0;padding-bottom:calc(125% + 64px)}'));
  const carte = cut(feuille, '.hv-card::before{', '}');
  assert.ok(carte.includes('bottom:64px') && carte.includes('border-radius:20px'), 'le fond de la carte s’arrête au-dessus de la barre de lecture');
  assert.ok(carte.includes('background:linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%)') && css.includes('--deep:linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%);'), 'fondue : le dégradé du héros');
  assert.ok(video.includes('background:linear-gradient(170deg,#6E50F6 0%,#5538E6 48%,#4529CC 100%);transition:opacity .38s ease'), '… qui est aussi celui de l’affiche de la vidéo');
  assert.match(carte, /box-shadow:0 0 0 1\.5px rgba\(255,255,255,\.24\),0 0 84px -6px rgba\(186,168,255,\.6\),0 48px 72px -44px rgba\(10,4,60,\.9\)/, 'détourée : un liseré clair, un halo, une ombre');
  assert.ok(feuille.includes('.hv-f{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:transparent}'));
  /* Le halo de « Commencer » ne bat que si le mouvement est permis */
  assert.ok(feuille.includes('@media (prefers-reduced-motion:no-preference){\n  .hv.vu .hv-card::before{animation:hv-vu .9s var(--press) 2}\n}'));
  assert.equal((feuille.match(/animation:/g) || []).length, 1);
  /* Tablette et ordinateur : la vidéo à côté du texte, « Ton objectif » et la photo dessous */
  const tablette = cut(feuille, '@media (min-width:700px) and (max-width:959px){', '\n}'), ordi = cut(feuille, '@media (min-width:960px){', '\n}');
  assert.ok(tablette.includes('.hv{grid-column:1;grid-row:3 / span 4;') && tablette.includes('.hero .lead{grid-column:2;grid-row:4}') && tablette.includes('.visual{grid-row:7 / span 2}'));
  assert.ok(tablette.includes('.proof{grid-column:2;grid-row:5;flex-direction:column;align-items:flex-start;gap:10px}'), 'dans la colonne étroite, les visages au-dessus de leur texte (il sortait de l’écran à 700 px)');
  assert.ok(ordi.includes('.hero-grid>div:first-child{display:contents}') && ordi.includes('.hv{grid-column:2;grid-row:1 / span 6;justify-self:center;margin:0;width:min(100%,440px,max(300px,calc((100vh - 296px) * .8)))}'));
  assert.ok(ordi.includes('.pick{grid-column:1;grid-row:7;') && ordi.includes('.visual{grid-column:2;grid-row:7 / span 2}'));
  /* Chaque page du site charge la feuille à jour */
  const v = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'decouvrir/vitrine.css'))).digest('hex').slice(0, 8);
  for (const f of ['index.html', 'module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) assert.ok(lire('decouvrir/' + f).includes(`href="vitrine.css?v=${v}"`), f);
});

test('le site : « Commencer » signale la vidéo sans la lancer ; elle s’arrête hors de l’écran ; une seule voix à la fois', () => {
  const bloc = cut(site, '/* La vidéo du héros (Elisa, 13 novembre, 9 h 56).', '</script>');
  const monter = ({hash = ''} = {}) => {
    const appels = [], ecoutes = {}, charge = [];
    let observe = null;
    const classes = new Set();
    const audios = [{paused: false, pause() { this.paused = true; appels.push('avis coupé'); }}, {paused: true, pause() { appels.push('avis déjà arrêté'); }}];
    const carte = {}, cadre = {contentWindow: {requeteVideo: {pause: () => appels.push('vidéo en pause'), focus: () => appels.push('focus sur la vidéo')}}};
    const el = {classList: {add: c => classes.add(c), remove: c => classes.delete(c)}, offsetWidth: 0, querySelector: s => (s === 'iframe' ? cadre : s === '.hv-card' ? carte : null)};
    const mobile = {scrollIntoView: () => appels.push('descend à la section iPhone')};
    const IO = function (cb) { observe = cb; this.observe = c => { assert.equal(c, carte); }; };
    const window = {IntersectionObserver: IO};
    const ctx = vm.createContext({window, location: {hash},
      document: {getElementById: id => (id === 'video' ? el : id === 'mobile' ? mobile : null), addEventListener: (t, h) => { ecoutes[t] = h; }, querySelectorAll: s => (s === 'audio' ? audios : [])},
      addEventListener: (t, h) => { if (t === 'load') charge.push(h); },
      IntersectionObserver: IO});
    vm.runInContext(bloc, ctx);
    const clic = href => ecoutes.click({target: {closest: s => (s === 'a[href]' && href ? {getAttribute: () => href} : null)}});
    return {appels, classes, clic, ecoutes, charge, window, cadre, sortie: vu => observe([{isIntersecting: vu}])};
  };
  /* « Commencer » : le lien fait descendre la page (pas de preventDefault), la vidéo se signale et reçoit le focus ; elle ne démarre pas */
  const a = monter();
  a.clic('#video');
  assert.ok(a.classes.has('vu')); assert.deepEqual(a.appels, ['focus sur la vidéo']);
  assert.ok(!bloc.includes('preventDefault') && !/\.play\(\)/.test(bloc), 'la vidéo parle : c’est son affiche qui la lance');
  /* Vers la section iPhone (le bouton sous la vidéo, un objectif) : la vidéo s’arrête */
  a.appels.length = 0; a.clic('#mobile'); assert.deepEqual(a.appels, ['vidéo en pause']);
  a.appels.length = 0; a.clic('#faq'); a.clic(null); assert.deepEqual(a.appels, [], 'ailleurs : rien');
  /* Sortie de l’écran */
  a.sortie(true); assert.deepEqual(a.appels, []);
  a.sortie(false); assert.deepEqual(a.appels, ['vidéo en pause']);
  /* La fin de la vidéo demande à la page de descendre ; la vidéo qui démarre coupe l’avis en cours ; un avis lancé arrête la vidéo */
  a.appels.length = 0; a.window.requeteVersAppli(); assert.deepEqual(a.appels, ['descend à la section iPhone']);
  a.appels.length = 0; a.window.requeteVideoJoue(); assert.deepEqual(a.appels, ['avis coupé']);
  a.appels.length = 0; a.ecoutes.play({target: {tagName: 'AUDIO'}}); a.ecoutes.play({target: {tagName: 'VIDEO'}}); assert.deepEqual(a.appels, ['vidéo en pause']);
  /* Le cadre pas encore chargé : rien ne casse */
  const b = monter(); b.cadre.contentWindow = {}; b.clic('#video'); b.clic('#mobile'); b.sortie(false);
  assert.ok(b.classes.has('vu')); assert.deepEqual(b.appels, []);
  /* Arrivée par ./#video depuis une autre page : la vidéo se signale une fois la page chargée */
  const c = monter({hash: '#video'}); assert.equal(c.charge.length, 1); c.charge[0](); assert.ok(c.classes.has('vu'));
  assert.equal(monter().charge.length, 0);
  /* Les autres pages du site y mènent aussi */
  for (const f of ['module.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']) {
    const h = lire('decouvrir/' + f);
    assert.ok(h.includes('<a class="btn btn-p" href="./#video">Commencer</a>') && h.includes('href="./#video">Voir la vidéo</a>') && !/href="video\.html"/.test(h), f);
  }
});

test('video.html?site : repéré dès la première image, ni fond ni barre du haut, la taille du cadre ; seule, la page ne change pas', () => {
  const marque = "<script>if(/[?&]site\\b/.test(location.search)&&window.parent!==window)document.documentElement.classList.add('vd-site');</script>";
  assert.ok(video.includes(marque) && video.indexOf(marque) < video.indexOf('<style>'), 'dès la première image');
  for (const r of ['html.vd-site,html.vd-site body{background:transparent}', 'html.vd-site body{justify-content:flex-start}', 'html.vd-site .bar.top{display:none}',
    'html.vd-site #frame{--fw:100vw;border-radius:20px;box-shadow:none}', 'html.vd-site .bar.bottom{max-width:none;padding:12px 2px 6px;gap:10px}',
    'html.vd-site #seek .fill{background:var(--sun)}', 'html.vd-site #src-btn{background:rgba(255,255,255,.12);color:#fff;border:1.5px solid rgba(255,255,255,.35);box-shadow:none}'])
    assert.ok(video.includes(r), r);
  /* 12 + 46 (le bouton) + 6 = les 64 px que la page réserve sous l’image */
  assert.ok(video.includes('.ctl{flex:none;width:46px;height:46px;'));
  /* fit() : dans le héros, la largeur du cadre fait la taille ; seule, entre les deux barres comme avant */
  const fit = cut(video, 'function fit(){', '\nfit();');
  const mesurer = (site, w, h) => {
    const f = {style: {}}, st = {style: {}};
    const ctx = vm.createContext({innerWidth: w, innerHeight: h, Math,
      document: {getElementById: id => (id === 'frame' ? f : st), querySelectorAll: () => [{offsetHeight: 62}, {offsetHeight: 64}], documentElement: {classList: {contains: c => site && c === 'vd-site'}}}});
    vm.runInContext(fit + '\nfit();', ctx);
    return [f.style.width, f.style.height, f.style.borderRadius, st.style.transform];
  };
  assert.deepEqual(mesurer(true, 353, 505), ['353px', '441px', '20px', `scale(${353 / 1080})`]);
  assert.deepEqual(mesurer(true, 440, 614).slice(0, 3), ['440px', '550px', '20px']);
  const seule = mesurer(false, 393, 852), s = Math.min((393 - 24) / 1080, (852 - 126 - 8) / 1350);
  assert.deepEqual(seule, [Math.floor(1080 * s) + 'px', Math.floor(1350 * s) + 'px', Math.max(16, 48 * s) + 'px', `scale(${s})`]);
  /* Le bouton de départ ne prend pas le focus de la page autour */
  assert.ok(video.includes("const SITE = document.documentElement.classList.contains('vd-site');\nif (!SITE) GO.focus({preventScroll: true});"));
});

test('video.html?site : la fin dit « Découvrir l’appli », la page peut arrêter la vidéo ou lui donner le focus, et sait quand elle parle', () => {
  const bloc = cut(video, '/* Dans le héros du site (video.html?site, 13 novembre, 9 h 56). La fin de la vidéo dit où elle mène', '</script>');
  const monter = ({site = true, joue = false, affiche = true} = {}) => {
    const appels = [], texte = {nodeType: 3, nodeValue: 'Commencer'};
    const go = {hidden: !affiche, classList: {contains: () => false}, focus: () => appels.push('focus affiche')}, pp = {focus: () => appels.push('focus lecture')};
    const window = {};
    const ctx = vm.createContext({window, C: {paused: () => !joue}, pause: () => appels.push('pause'),
      document: {documentElement: {classList: {contains: c => site && c === 'vd-site'}}, querySelector: s => (s === '#end a' ? {firstChild: texte} : null), getElementById: id => (id === 'go' ? go : id === 'pp' ? pp : null)}});
    vm.runInContext(bloc, ctx);
    return {appels, texte, api: window.requeteVideo};
  };
  const a = monter({joue: true});
  assert.equal(a.texte.nodeValue, 'Découvrir l’appli');
  a.api.pause(); assert.deepEqual(a.appels, ['pause']);
  a.api.focus(); assert.deepEqual(a.appels, ['pause', 'focus affiche']);
  const b = monter({joue: false, affiche: false});
  b.api.pause(); assert.deepEqual(b.appels, [], 'déjà arrêtée : rien');
  b.api.focus(); assert.deepEqual(b.appels, ['focus lecture'], 'l’affiche partie : le bouton de lecture');
  /* Seule (requeteapp.com/video.html) : « Commencer », et rien d’exposé */
  const c = monter({site: false});
  assert.equal(c.texte.nodeValue, 'Commencer'); assert.equal(c.api, undefined);
  assert.ok(video.includes('<a href="./#mobile">Commencer<svg'), 'le libellé de la page seule');
  /* La lecture prévient la page (pour couper l’avis audio) */
  assert.ok(video.includes("C.play(); setPlaying(true); sonSync(); siteJoue(); }"));
  const joue = cut(video, 'function siteJoue(){', '\n');
  const prevenir = (site, parent) => { const appels = []; vm.runInContext(joue + '\nsiteJoue();', vm.createContext({document: {documentElement: {classList: {contains: c => site && c === 'vd-site'}}}, parent: parent ? {requeteVideoJoue: () => appels.push('prévenue')} : {}})); return appels; };
  assert.deepEqual(prevenir(true, true), ['prévenue']);
  assert.deepEqual(prevenir(false, true), [], 'seule : personne à prévenir');
  assert.deepEqual(prevenir(true, false), []);
  assert.ok(!video.includes('postMessage'));
});
