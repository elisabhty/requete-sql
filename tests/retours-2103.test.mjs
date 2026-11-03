/* Retours de 21 h 03 (Elisa, 3 novembre), sur la feuille « Schéma · base Aéroport » : « met juste la croix en haut à droite,
   enlève la flèche et fait en sorte que la description soit pliable » ; puis « sur l’application, je veux une animation quand
   on appuie sur l’application » : l’ouverture animée de l’appli iOS, qui enchaîne sans saut sur l’écran de lancement fixe. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cap = JSON.parse(fs.readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

test('Schéma : seulement la croix en haut à droite, plus de flèche de retour', () => {
  const head = cut(app, '<div class="viz" id="schema-sheet"', '<div class="viz-body sch-sheet-body" id="schema-body">');
  assert.ok(head.includes('<b id="schema-head-title">Schéma · base du cours</b><button type="button" onclick="closeSchemaSheet()" aria-label="Fermer">✕</button>'));
  assert.ok(!head.includes('sch-back') && !head.includes('aria-label="Retour"') && !head.includes('M15 5l-7 7 7 7'), 'plus de flèche');
  assert.ok(!css.includes('.sch-back'), 'plus de style pour la flèche');
  assert.ok(css.includes('html.lq #schema-sheet .viz-cap-stk{display:none}'), 'pas d’autocollant : le titre tient sur une ligne');
  /* La croix prend le style des feuilles à l’en-tête violet (rond blanc, en haut à droite) */
  assert.ok(css.includes('html.lq .viz-head.viz-cap button{flex:none;align-self:flex-start;'));
  assert.ok(app.includes("if(document.getElementById('schema-sheet')?.classList.contains('on')){closeSchemaSheet();return;}"), 'Échap ferme toujours');
});

test('Schéma : la présentation de la base se plie, fermée d’abord', () => {
  const r = cut(app, 'function renderSchemaSheet(){', 'function openSchemaSheet(){');
  assert.ok(r.includes('const baseOuverte=!!schBaseOuverte[key];'));
  assert.ok(r.includes('<div class="sch-base${baseOuverte?\' open\':\'\'}"><button type="button" class="sch-base-h" aria-expanded="${baseOuverte}" aria-controls="sch-base-txt" onclick="schemaBaseToggle(this)"><b>Base ${esc(DEFI_BASES[dId].nom)}</b>'));
  assert.ok(r.includes('<div class="sch-base-body" id="sch-base-txt"><div><p>${esc(DEFI_BASES[dId].desc)}</p></div></div></div>'));
  assert.ok(!r.includes('<p class="sch-base">'), 'plus de paragraphe toujours ouvert');
  for (const part of [
    'html.lq #schema-sheet .sch-base-h{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;',
    'html.lq #schema-sheet .sch-base.open .sch-base-chev{transform:rotate(180deg)}',
    'html.lq #schema-sheet .sch-base-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s',
    'html.lq #schema-sheet .sch-base.open .sch-base-body{grid-template-rows:1fr}',
    'html.lq #schema-sheet .sch-base-body>div{min-height:0;overflow:hidden;visibility:hidden;',
    'html.lq #schema-sheet .sch-base-h:focus-visible{',
    'html[data-motion="reduce"].lq #schema-sheet :is(.sch-base-chev,.sch-base-body,.sch-base-body>div){transition:none}'
  ]) assert.ok(css.includes(part), part);
});

test('Schéma : déplier puis replier, la base garde son état pendant la visite', () => {
  const src = cut(app, 'const schTabSel={},schBaseOuverte={};', 'function schemaPickTab(btn){');
  const body = { dataset: { base: 'aeroport' } };
  const ctx = vm.createContext({ document: { getElementById: id => (id === 'schema-body' ? body : null) } });
  vm.runInContext(src.replace('const schTabSel={},schBaseOuverte={};', 'var schTabSel={},schBaseOuverte={};'), ctx);
  const cls = new Set(['sch-base']);
  const card = { classList: { contains: c => cls.has(c), toggle: (c, on) => { on ? cls.add(c) : cls.delete(c); } } };
  const attrs = {};
  const btn = { closest: s => (s === '.sch-base' ? card : null), setAttribute: (k, v) => { attrs[k] = v; } };
  ctx.schemaBaseToggle(btn);
  assert.ok(cls.has('open')); assert.equal(attrs['aria-expanded'], 'true'); assert.equal(ctx.schBaseOuverte.aeroport, true);
  ctx.schemaBaseToggle(btn);
  assert.ok(!cls.has('open')); assert.equal(attrs['aria-expanded'], 'false'); assert.equal(ctx.schBaseOuverte.aeroport, false);
});

/* Le petit script juste après #loader, joué dans un bac à sable */
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
function lancer({ natif = true, calme = false, stocke = '' } = {}) {
  const log = [], cls = new Set(), timers = [], frames = [];
  const L = { classList: { add: c => { cls.add(c); log.push('+' + c); }, contains: c => cls.has(c) } };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => natif && c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: {},
    performance: { now: () => 1000 },
    matchMedia: () => ({ matches: calme }),
    localStorage: { getItem: () => stocke },
    navigator: { vibrate: ms => { log.push('vibre ' + ms); return true; } },
    requestAnimationFrame: f => frames.push(f),
    setTimeout: (f, ms) => timers.push([ms, f])
  });
  ctx.window.Capacitor = { Plugins: { SplashScreen: { hide: o => log.push('écran retiré ' + o.fadeOutDuration) } } };
  vm.runInContext(intro, ctx);
  const tick = () => { const q = frames.splice(0); q.forEach(f => f()); };
  const run = max => { timers.sort((a, b) => a[0] - b[0]); for (let i = 0; i < timers.length; i++) if (timers[i][0] <= max) { const [, f] = timers.splice(i--, 1)[0]; f(); timers.sort((a, b) => a[0] - b[0]); } };
  return { log, cls, ctx, tick, run, frames };
}

test('appli iOS : l’écran de lancement part deux images après le premier dessin, puis la touche s’enfonce', () => {
  const s = lancer();
  assert.deepEqual(s.log, ['+is-intro'], 'tout de suite : la mise en page de l’écran de lancement');
  assert.equal(s.ctx.window.__introFin, 2500, 'filet : 1,5 s même si le dessin tarde');
  s.tick(); assert.ok(!s.log.includes('écran retiré 120'), 'pas après une seule image'); s.tick();
  assert.ok(s.log.includes('écran retiré 120'), 'retiré dès que la page s’est dessinée, en fondu de 120 ms');
  assert.equal(s.ctx.window.__introFin, 2180, 'en attendant l’animation : au plus tôt 1,18 s après');
  s.run(140); assert.ok(s.cls.has('is-play'));
  assert.ok(s.log.includes('vibre 10'), 'le petit retour haptique part avec l’animation (la touche est en bas 94 ms plus tard)');
  assert.deepEqual(s.log.slice(-2), ['+is-play', 'vibre 10']);
  assert.equal(s.ctx.window.__introFin, 1980, 'la fin se compte depuis le vrai départ de l’animation');
  assert.ok(!s.cls.has('is-long'));
  s.run(2600); assert.ok(s.cls.has('is-long'), 'l’anneau et la phrase si la base tarde');
});

test('appli iOS : mouvement réduit, l’image reste fixe ; sur le site, rien ne change', () => {
  for (const opts of [{ calme: true }, { stocke: '{"preferences":{"reduceMotion":true}}' }]) {
    const s = lancer(opts); s.tick(); s.tick(); s.run(5000);
    assert.ok(s.log.includes('écran retiré 120')); assert.ok(!s.cls.has('is-play')); assert.ok(!s.log.some(l => l.startsWith('vibre')));
    assert.equal(s.ctx.window.__introFin, 1250);
  }
  const web = lancer({ natif: false }); web.tick(); web.tick(); web.run(5000);
  assert.deepEqual(web.log, [], 'Safari : l’écran de chargement habituel');
});

test('appli iOS : l’écran se découvre après l’animation, et l’écran natif sert de filet', () => {
  const h = cut(app, 'function hideLoader(){', '\n}\n');
  assert.ok(h.includes("const intro=loader.classList.contains('is-intro');"));
  assert.ok(h.includes("const reste=()=>intro&&typeof window.__introFin==='number'?window.__introFin-performance.now():0;"));
  assert.ok(h.includes('if(reste()>16){setTimeout(sortir,reste());return;}'), 'revérifie : l’animation a pu démarrer en retard');
  assert.ok(h.includes('setTimeout(sortir,Math.max(0,LOADER_MIN_MS-t,reste()));') && h.includes("loader.style.display='none';}, intro?440:380);"));
  const sp = cap.plugins.SplashScreen;
  assert.equal(sp.launchAutoHide, true); assert.equal(sp.launchShowDuration, 4000, 'au plus 4 s si la page ne se dessine pas');
  assert.equal(sp.backgroundColor, '#F4F2FC');
  /* Le script vient juste après #loader et avant le reste : il agit dès le premier dessin */
  assert.ok(app.indexOf('/* Appli iOS : l’ouverture animée') > app.indexOf('<p>Préparation de ta base de données…</p></div>'));
  assert.ok(app.indexOf('/* Appli iOS : l’ouverture animée') < app.indexOf('<!-- Script à part : il tourne même si le gros JS a une erreur de syntaxe. -->'));
});

test('appli iOS : la première image reprend l’écran de lancement (resources/splash.png)', () => {
  const s = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
  for (const part of [
    'html.is-native.lq #loader.is-intro{position:fixed;inset:0;z-index:2147483000;display:block;padding:0;background:#F4F2FC!important;',
    '--u:calc(max(100vw,100vh) / 2732)',
    'width:calc(512*var(--u));height:calc(512*var(--u));',
    'margin:calc(-270*var(--u)) 0 0 calc(-256*var(--u));box-sizing:border-box;border:0;border-radius:calc(116*var(--u));rotate:0deg;animation:none;',
    'background:linear-gradient(135deg,#8060FF,#593CE7)!important;box-shadow:none!important;font-size:0;color:transparent;transform-origin:50% 60%}',
    /* L’épaisseur : un socle fixe 28 plus bas, de la même forme ; seule la touche bouge */
    'html.is-native.lq #loader.is-intro::after{content:"";position:absolute;z-index:0;left:50%;top:50%;width:calc(512*var(--u));height:calc(512*var(--u));',
    'margin:calc(-242*var(--u)) 0 0 calc(-256*var(--u));border-radius:calc(116*var(--u));background:#4B30CC}',
    'clip-path:polygon(29.1% 34.375%,46.68% 42.56%,46.68% 47.48%,29.1% 55.66%,29.1% 51.37%,42.75% 45.02%,29.1% 38.67%)',
    '.logo-badge::after{content:"";position:absolute;left:52.34%;top:59.18%;width:19.14%;height:4.49%;background:#fff}',
    /* Rien d’autre à la première image : le nom, les étincelles, l’anneau et la phrase sont invisibles */
    '.ld-name{position:absolute;z-index:1;left:0;right:0;top:calc(50% + 330*var(--u));', 'opacity:0;scale:.2;animation:none}',
    'html.is-native.lq #loader.is-intro.is-long :is(.spinner,p){opacity:1}',
    /* L’animation */
    'html.is-native.lq #loader.is-intro.is-play .logo-badge{animation:introKey .72s',
    '13%{transform:translateY(calc(24*var(--u))) scale(.975)}', '45%{transform:translateY(calc(-14*var(--u))) scale(1.045)}',
    'html.is-native.lq #loader.is-intro.is-play .logo-badge::after{animation:introCursor .5s linear .5s both}',
    '@keyframes introCursor{0%,30%{opacity:1}31%,70%{opacity:0}71%,100%{opacity:1}}',
    'html.is-native.lq #loader.is-intro.is-play .ld-spark{', 'html.is-native.lq #loader.is-intro.is-play .ld-name{animation:introName .45s',
    'html.is-native.lq #loader.is-intro.fade-out .logo-badge{animation:introBadgeOut .42s',
    'html.is-native.lq #loader.is-intro.fatal .logo-badge{position:static;width:88px;height:88px;'
  ]) assert.ok(s.includes(part), part);
  assert.ok(!/filter|box-shadow:0/.test(s.slice(s.indexOf('@keyframes introKey'), s.indexOf('@keyframes introCursor'))), 'la touche ne s’anime qu’en transform');
  assert.match(s, /@media \(prefers-reduced-motion:reduce\)\{[^}]*#loader\.is-intro\.is-play \.logo-badge,[^}]*\{animation:none!important\}/);
  assert.ok(s.includes('html[data-motion="reduce"].is-native.lq #loader.is-intro.is-play .logo-badge,'));
  /* Le site garde son écran de chargement violet (37) */
  assert.ok(css.includes('html.lq #loader{background:var(--deep)!important;'));
});
