/* Elisa, 30 octobre, 22 h 58 : « Ravi de te revoir ! plutôt que coucou », « le bouton en bas ? pas homogène avec le reste »,
   « l’espace entre le fond violet du cours TABLE et le reste (fond violet clair), je ne sais pas si c’est OK », « mettre des
   micro-interactions, faire en sorte que le curseur sur l’appli soit UI/UX très jolie (quand on rentre sur le site / l’appli) »,
   « homogénéiser également la page de chargement ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js'), cur = lire('assets/curseur.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };

test('le curseur est chargé par l’appli et par chaque page de la vitrine, avec l’empreinte de son contenu, et gardé hors ligne', () => {
  const v = createHash('sha1').update(fs.readFileSync(path.join(root, 'assets/curseur.js'))).digest('hex').slice(0, 8);
  assert.ok(app.includes(`<script src="assets/curseur.js?v=${v}" defer></script>`), `appli : écrire assets/curseur.js?v=${v}`);
  const pages = fs.readdirSync(path.join(root, 'decouvrir')).filter(f => f.endsWith('.html'));
  assert.ok(pages.length >= 7);
  for (const p of pages) assert.ok(lire('decouvrir/' + p).includes(`<script src="../assets/curseur.js?v=${v}" defer></script>\n</head>`), `${p} : écrire ../assets/curseur.js?v=${v}`);
  assert.ok(sw.includes("'./assets/curseur.js',"), 'préchargé par le service worker');
});

test('le curseur : ordinateur seulement, flèche et main en autocollant, étincelles à l’arrivée, onde au clic ; rien au doigt ni en mouvement réduit', () => {
  assert.ok(cur.includes("window.matchMedia('(hover: hover) and (pointer: fine)')") && cur.includes('if (!mq || !mq.matches) return;'), 'souris ou pavé tactile seulement');
  assert.ok(cur.includes("matchMedia('(prefers-reduced-motion: reduce)').matches) || root.getAttribute('data-motion') === 'reduce'"), 'réglage du système ou de l’appli');
  assert.ok(cur.includes("var arrivee = function (x, y) { if (vu) return; vu = true; if (!reduit()) etincelles(x, y); };"), 'mouvement réduit : pas d’étincelles');
  assert.ok(cur.includes("if (!vrai(e) || reduit()) return;"), 'ni onde au clic');
  /* Elisa, 30 octobre, 23 h 42 : « pas ouf le rond du sélecteur » : plus de rond qui suit la souris (il couvrait le texte) */
  assert.ok(!cur.includes('rq-halo') && !cur.includes('requestAnimationFrame(anime)'), 'plus de halo qui suit la souris');
  assert.ok(!/cursor\s*:\s*none/.test(cur), 'le curseur du système reste : jamais caché');
  for (const part of ["'#6A4DF4'", '#6A4DF4" stroke="#1B1640" stroke-width="3.6"', 'stroke="#fff" stroke-width="1.6"', 'fill="#6A4DF4" stroke="#1B1640" stroke-width="1.7"'])
    assert.ok(cur.includes(part.replace(/'/g, '')) || cur.includes(part), part);
  assert.ok(cur.includes(":not(.stk-cell):not(.stk-item):not(.qf-card):not(.hdl)") && cur.includes('body:not(.dragging)'), 'les poignées à glisser gardent leur curseur');
  assert.ok(cur.includes("document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) vu = false; }"), 'la souris sort puis revient : nouvelles étincelles');
  assert.ok(cur.includes("o.className = 'rq-onde' + (touche(e.target) ? '' : ' v');"), 'onde jaune sur ce qui se touche, violette ailleurs');

  /* Exécuté : sans souris, rien ne change ; avec, la classe, la feuille de style et les deux curseurs */
  const lancer = souris => {
    const props = {}, cls = new Set(), ajoutes = [];
    const el = () => ({ style: { setProperty() {} }, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, remove() {} });
    const ctx = vm.createContext({
      window: { matchMedia: q => ({ matches: souris && !/reduced/.test(q) }), addEventListener() {} },
      document: { documentElement: { style: { setProperty: (k, v) => { props[k] = v; } }, classList: { add: c => cls.add(c) }, getAttribute: () => null },
        head: { appendChild: n => ajoutes.push(n) }, body: null, createElement: el, addEventListener() {} },
      encodeURIComponent, Image: function () {}, requestAnimationFrame() {}, setTimeout() {}, Math,
    });
    ctx.window.CSS = { supports: () => false };
    ctx.CSS = ctx.window.CSS; ctx.MutationObserver = undefined; ctx.matchMedia = ctx.window.matchMedia;
    vm.runInContext(cur, ctx);
    return { props, cls, ajoutes };
  };
  const sans = lancer(false);
  assert.equal(sans.cls.size, 0); assert.equal(sans.ajoutes.length, 0); assert.deepEqual(sans.props, {});
  const avec = lancer(true);
  assert.ok(avec.cls.has('rq-cur') && avec.ajoutes.length === 1 && avec.ajoutes[0].id === 'rq-curseur');
  assert.match(avec.props['--rq-cur-a'], /^url\("data:image\/svg\+xml;charset=utf-8,%3Csvg[^"]+"\) 6 4, auto$/, 'la flèche, pointe à 6 × 4');
  assert.match(avec.props['--rq-cur-h'], /^url\("data:image\/svg\+xml;charset=utf-8,%3Csvg[^"]+"\) 12 3, pointer$/, 'la main, bout du doigt à 12 × 3');
  const css = avec.ajoutes[0].textContent;
  assert.ok(css.startsWith('@media (hover:hover) and (pointer:fine){') && css.includes('html.rq-cur,html.rq-cur body{cursor:var(--rq-cur-a)}') && css.includes('{cursor:text!important}'));
  assert.ok(!css.includes('.rq-halo') && css.includes('@keyframes rqOnde') && css.includes('@keyframes rqEclat'), 'onde et étincelles, sans halo');
});

test('accueil : « Ravi de te revoir ! » à la place de « Coucou ! », en deux lignes au-dessus du chat ; le titre se coupe en français', () => {
  const hero = cut('function renderHomeHero(', 'function lqKeepMascot(');
  assert.ok(hero.includes("hi:nxt==null?'Bravo\\u00a0!':'Ravi de te revoir\\u00a0!'") && !hero.includes("'Coucou\\u00a0!'"));
  assert.ok(app.includes("${mascotMedalHtml({hi:'Coucou\\u00a0!',intro:!mascotReduced()})}"), 'le tout premier écran de bienvenue garde « Coucou ! »');
  assert.ok(lq.includes('html.lq .lq-hero .mstk-bub{white-space:normal;width:max-content;max-width:106px;'));
  assert.ok(lq.includes('html.lq .lq-hero-title{-webkit-hyphens:auto;hyphens:auto}') && app.includes('<html lang="fr" class="lq">'));
});

test('page du cours : l’affiche remplit la vignette, le bouton du bas en pastille jaune avec sa cible et sa flèche, des micro-interactions', () => {
  /* La vignette perd en largeur le dépassement fois son rapport largeur / hauteur */
  const props = {};
  const card = { getBoundingClientRect: () => ({ width: 260, height: 360 }) };
  const box = { style: { removeProperty: k => { delete props[k]; }, setProperty: (k, v) => { props[k] = v; } }, querySelector: () => card };
  const scr = { clientHeight: 700, scrollHeight: 750, querySelector: () => box };
  const ctx = vm.createContext({ document: { getElementById: () => scr } });
  vm.runInContext(cut('function lvCardFit(){', '/* Leçon seule validée') + ';this.fit=lvCardFit;', ctx);
  ctx.fit(); assert.equal(props['--lv-fit'], '223px', '50 px de trop sur une vignette de 260 × 360 : 36 px de largeur en moins');
  const s37 = lq.slice(lq.indexOf('/* ---------- 37.'));
  /* Le bouton du bas (refait le 30 octobre à 23 h 42, voir bulles-bouton.test.mjs) */
  for (const part of [
    'html.lq #lesson-body .ls-nav .ls-next[data-jc-gate]{position:relative;display:block;', 'background:linear-gradient(165deg,#7B5CFF 0%,#6146F2 55%,#5536E4 100%)!important;',
    'html.lq #lesson-body .ls-nav .ls-next[data-jc-gate]:has(br)::first-line{color:var(--sun-hi);', '.is-go::after{animation:lqGateGo', ':hover{translate:0 -2px;',
    'html.lq #scr-lesson .lv-hero .lv-card:hover{top:-3px;', 'html.lq #scr-lesson .lv-hero .lv-card:hover .lv-card-play{scale:1.1}'])
    assert.ok(s37.includes(part), part);
  assert.ok(!/\.lv-card:hover\{[^}]*transform/.test(s37), 'la vignette ne bouge que par sa position (Safari)');
  assert.match(s37, /@container \(max-width:249\.98px\)\{\s*html\.lq #scr-lesson \.lv-hero \.lv-card-meta\{display:none\}/, 'vignette étroite : la pastille s’efface, le ▶ reste dans la carte');
  /* Le texte et l’action du bouton ne changent pas */
  assert.ok(app.includes('class="ls-next" type="button" aria-disabled="true" data-jc-gate onclick="openLessonVideo()">'));
});

test('l’écran de chargement dans la DA : violet quadrillé, logo en autocollant, étincelles, nom, anneau qui tourne', () => {
  assert.ok(app.includes('<div id="loader"><i class="ld-spark s1" aria-hidden="true"></i><i class="ld-spark s2" aria-hidden="true"></i><i class="ld-spark s3" aria-hidden="true"></i>\n    <div class="logo-badge">&gt;_</div><b class="ld-name">Requête</b><div class="spinner"></div>'));
  const s37 = lq.slice(lq.indexOf('/* ---------- 37.'));
  for (const part of ['html.lq #loader{background:var(--deep)!important;', 'html.lq #loader .logo-badge{width:88px;height:88px;', 'border:4px solid #fff;',
    'animation:ldIn .42s', 'html.lq #loader .spinner::after{', 'animation:ldSpin 1.2s linear infinite}', 'html.lq #loader .ld-spark{', 'html.lq #loader.fade-out .logo-badge{animation:ldOut'])
    assert.ok(s37.includes(part), part);
  assert.match(s37, /@media \(prefers-reduced-motion:reduce\)\{[^}]*html\.lq #loader \.logo-badge,[^}]*\{animation:none!important\}/, 'mouvement réduit');
  /* L’erreur du moteur SQL reste lisible : texte blanc sur le violet */
  assert.ok(cut('function bootFatal(){', 'function hideLoader(){').includes('<p><b>Impossible de charger le moteur SQL.</b>'));
});
