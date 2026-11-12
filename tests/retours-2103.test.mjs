/* Retours de 21 h 03 (Elisa, 3 novembre), sur la feuille « Schéma · base Aéroport » : « met juste la croix en haut à droite,
   enlève la flèche et fait en sorte que la description soit pliable » ; puis « sur l’application, je veux une animation quand
   on appuie sur l’application » : l’ouverture animée de l’appli iOS, qui enchaîne sans saut sur l’écran de lancement fixe ;
   21 h 56 : « j’aime pas trop, c’est pas waouh et ça a l’air de bug » : l’animation part quand l’appli est prête, d’un seul
   tenant, et devient une vraie ouverture (onde, confettis, nom lettre par lettre, plongée dans la touche). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

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
  const r = cut(app, 'function renderSchemaSheet(){', 'function openSchemaSheet(ctx,vue){');
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

/* Le petit script juste après #loader, joué dans un bac à sable (11 novembre, 13 h 10 : le logo se construit, tests/retours-1310) */
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
function lancer({ natif = true, calme = false, stocke = '' } = {}) {
  const log = [], timers = [], frames = [];
  const L = fauxLoader({ log }), cls = L.cls, nom = L.nom, html = L.html;
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => natif && c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: {}, Array, performance: { now: () => 1000 },
    matchMedia: () => ({ matches: calme }), localStorage: { getItem: () => stocke, setItem() {} },
    navigator: { vibrate: ms => { log.push('vibre ' + ms); return true; } },
    requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => timers.push([ms, f])
  });
  ctx.window.Capacitor = { Plugins: { SplashScreen: { hide: o => log.push('écran retiré ' + o.fadeOutDuration) } } };
  vm.runInContext(intro, ctx);
  const tick = () => { const q = frames.splice(0); q.forEach(f => f()); };
  const run = max => { const due = timers.filter(t => t[0] <= max); for (const t of due) timers.splice(timers.indexOf(t), 1); due.sort((a, b) => a[0] - b[0]).forEach(t => t[1]()); };
  return { log, cls, ctx, tick, run, frames, timers, L, nom, html };
}

test('appli iOS : derrière l’écran de lancement, la page se dessine à l’identique et attend que l’appli soit prête', () => {
  const s = lancer();
  assert.deepEqual(s.log, ['+is-intro']);
  s.tick(); s.tick();
  assert.ok(!s.log.some(l => l.startsWith('écran retiré')), 'l’écran natif reste tant que l’appli n’est pas prête');
  assert.equal(typeof s.ctx.window.__introJouer, 'function');
  /* Les 23 points de l’écran de lancement, tout de suite ; « Requête » en lettres ; les cases, seulement au départ */
  assert.equal(s.html.length, 1);
  assert.equal((s.html[0].match(/<i class="in-d" aria-hidden="true" style="left:[\d.]+%;top:[\d.]+%"><\/i>/g) || []).length, 23);
  assert.equal(s.nom.attrs['aria-label'], 'Requête');
  assert.equal((s.nom.innerHTML.match(/class="in-l"/g) || []).length, 7);
  assert.ok(s.nom.innerHTML.includes('<span class="in-l" aria-hidden="true" style="--i:4"><b>ê</b></span>'));
  s.run(2600); assert.ok(s.cls.has('is-long'), 'l’anneau et la phrase si l’appli tarde');
  s.ctx.window.__introJouer();
  assert.equal(s.html.length, 2); assert.equal((s.html[1].match(/<i class="in-k" /g) || []).length, 16, 'les seize cases de la touche, au départ');
});

test('appli iOS : prête, l’écran natif part d’un coup puis tout se joue d’une seule classe', () => {
  const s = lancer();
  s.run(2600);
  s.ctx.window.__introJouer();
  assert.deepEqual(s.log.slice(-2), ['-is-long', 'écran retiré 0'], 'retiré sans fondu : la page est identique');
  assert.ok(!s.cls.has('is-play'));
  s.tick(); assert.ok(!s.cls.has('is-play'), 'pas avant que la page ait fini de se dessiner'); s.tick();
  assert.ok(s.cls.has('is-play'));
  s.run(1080); assert.equal(s.log.at(-1), 'vibre 25', 'sans l’extension Haptics, une vibration quand la touche est entière (1,08 s)');
  assert.equal(s.L.style.display, undefined);
  s.run(2280); assert.equal(s.L.style.display, undefined, 'pas avant la fin du fondu');
  s.run(2300); assert.equal(s.L.style.display, 'none', 'rangé à la fin (1,93 + 0,36 s)');
  s.ctx.window.__introJouer(); assert.equal(s.log.filter(l => l.startsWith('écran retiré')).length, 1, 'une seule fois');
});

test('appli iOS : mouvement réduit, un simple fondu ; sur le site, rien ne change', () => {
  for (const opts of [{ calme: true }, { stocke: '{"preferences":{"reduceMotion":true}}' }]) {
    const s = lancer(opts);
    assert.equal(s.html.length, 1, 'les points de l’écran de lancement, seulement'); assert.equal(s.nom.innerHTML, '', 'ni lettres ni cases');
    s.ctx.window.__introJouer();
    assert.ok(s.log.includes('écran retiré 0') && s.cls.has('fade-out') && !s.cls.has('is-play'));
    assert.equal(s.html.length, 1);
    assert.ok(!s.log.some(l => l.startsWith('vibre')));
    s.run(340); assert.equal(s.L.style.display, 'none');
  }
  const web = lancer({ natif: false }); web.tick(); web.tick(); web.run(5000);
  assert.deepEqual(web.log, [], 'Safari : l’écran de chargement habituel');
  assert.equal(web.ctx.window.__introJouer, undefined);
});

test('appli iOS : hideLoader passe la main à l’ouverture ; l’écran natif sert de filet', () => {
  const h = cut(app, 'function hideLoader(){', '\n}\n');
  assert.ok(h.includes("if(loader&&loader.classList.contains('is-intro')&&typeof window.__introJouer==='function'){window.__introJouer();return;}"));
  assert.ok(h.indexOf('window.__introJouer();return;') < h.indexOf('if(window.nativeAppReady)window.nativeAppReady();'), 'pas de fondu natif de 250 ms pendant l’animation');
  assert.ok(h.includes('},Math.max(0,LOADER_MIN_MS-t));'), 'sur le site, inchangé');
  assert.ok(cut(app, 'function bootFatal(){', '\n}\n').includes('window.nativeAppReady&&window.nativeAppReady();'), 'une erreur fatale se lit tout de suite');
  const sp = cap.plugins.SplashScreen;
  assert.equal(sp.launchAutoHide, true); assert.equal(sp.launchShowDuration, 4000, 'au plus 4 s si l’appli tarde');
  assert.equal(sp.backgroundColor, '#F4F2FC');
  assert.ok(app.indexOf('/* Appli iOS : l’ouverture animée') > app.indexOf('<p>Préparation de ta base de données…</p></div>'));
  assert.ok(app.indexOf('/* Appli iOS : l’ouverture animée') < app.indexOf('<!-- Script à part : il tourne même si le gros JS a une erreur de syntaxe. -->'));
});

test('appli iOS : la première image reprend l’écran de lancement (les points seuls), la touche n’apparaît qu’une fois construite', () => {
  const s = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
  for (const part of [
    'html.is-native.lq #loader.is-intro{position:fixed;inset:0;z-index:2147483000;display:block;padding:0;background:#F4F2FC!important;',
    '--u:calc(max(100vw,100vh) / 2732);--cy:calc(50% - 14*var(--u));',
    'width:calc(512*var(--u));height:calc(512*var(--u));',
    'margin:calc(-270*var(--u)) 0 0 calc(-256*var(--u));box-sizing:border-box;border:0;border-radius:calc(116*var(--u));rotate:0deg;animation:none;opacity:0;',
    'background:linear-gradient(135deg,#8060FF,#593CE7)!important;box-shadow:none!important;font-size:0;color:transparent;will-change:transform}',
    'clip-path:polygon(29.1% 34.375%,46.68% 42.56%,46.68% 47.48%,29.1% 55.66%,29.1% 51.37%,42.75% 45.02%,29.1% 38.67%)',
    '.logo-badge::after{content:"";position:absolute;left:52.34%;top:59.18%;width:19.14%;height:4.49%;background:#fff;transform-origin:0 50%}',
    'margin:calc(-242*var(--u)) 0 0 calc(-256*var(--u));border-radius:calc(116*var(--u));background:#4B30CC;opacity:0}',
    /* Rien d’autre que les points à la première image */
    'html.is-native.lq #loader.is-intro .ld-spark{display:none}', 'font:700 30px/1 var(--display);letter-spacing:-.02em;color:#1B1640;opacity:0;animation:none}',
    'html.is-native.lq #loader.is-intro .in-d{position:absolute;z-index:0;width:calc(30*var(--u));height:calc(30*var(--u));',
    'margin:calc(-15*var(--u)) 0 0 calc(-15*var(--u));background:#D2C6F7}',
    /* Le déroulé */
    'html.is-native.lq #loader.is-intro.is-play .in-d{opacity:0}',
    'html.is-native.lq #loader.is-intro.is-play.is-sortie{animation:introOut var(--d-sortie) ease-out forwards}',   // 12 novembre : la sortie attend l’appli prête
    'html.is-native.lq #loader.is-intro.fade-out{animation:introOut .3s linear forwards}',
    'html.is-native.lq #loader.is-intro.fatal .logo-badge{position:static;width:88px;height:88px;margin:0;border-radius:26px;background:var(--danger)!important;opacity:1;',
    'html.is-native.lq #loader.is-intro.fatal :is(.in-d,.in-s,.in-k,.in-chat){display:none}'
  ]) assert.ok(s.includes(part), part);
  assert.ok(!s.includes('introCursor'), 'pas de curseur qui clignote (on aurait dit un bug)');
  assert.ok(css.includes('html.lq #loader{background:var(--deep)!important;'), 'le site garde son écran violet');
});

test('appli iOS : le « sauvetage » du service worker ne recharge jamais l’appli', () => {
  const r = cut(app, "var KEY='requete-sw-rescue';", '}, 12000);');
  assert.ok(r.includes("if(document.documentElement.classList.contains('is-native'))return;"), 'pas de rechargement qui rejouerait l’ouverture');
  assert.ok(r.indexOf("if(document.documentElement.classList.contains('is-native'))return;") < r.indexOf('setTimeout(function(){'));
});

/* 22 h 19 : « on peut avec TestFlight ? » — l’envoi en une commande, sans les menus d’Xcode */
test('TestFlight : npm run ios:testflight archive et envoie à App Store Connect', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  /* 23 h 02 : l’écran de lancement est recopié juste avant l’archive (tests/ios-ecran-lancement.test.mjs) */
  assert.equal(pkg.scripts['ios:testflight'], 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && bash scripts/ios-testflight.sh');
  const sh = fs.readFileSync(new URL('../scripts/ios-testflight.sh', import.meta.url), 'utf8');
  assert.ok(sh.startsWith('#!/bin/bash') && sh.includes('set -euo pipefail'));
  assert.ok(sh.includes("grep -q 'DEVELOPMENT_TEAM' App.xcodeproj/project.pbxproj"), 'prévient si aucune équipe n’est choisie');
  assert.ok(sh.includes("-destination 'generic/platform=iOS' -archivePath build/Requete.xcarchive") && sh.includes('-allowProvisioningUpdates archive'));
  assert.ok(sh.includes('-exportOptionsPlist ../../scripts/ios-export-options.plist -exportPath build/envoi'));
  const opts = fs.readFileSync(new URL('../scripts/ios-export-options.plist', import.meta.url), 'utf8');
  for (const part of ['<key>method</key>\n\t<string>app-store-connect</string>', '<key>destination</key>\n\t<string>upload</string>',
    '<key>signingStyle</key>\n\t<string>automatic</string>', '<key>manageAppVersionAndBuildNumber</key>\n\t<true/>']) assert.ok(opts.includes(part), part);
  const ios = fs.readFileSync(new URL('../IOS.md', import.meta.url), 'utf8');
  assert.ok(ios.includes('## TestFlight (l’appli sur un vrai iPhone)') && ios.includes('npm run ios:testflight 2>&1 | tee ios-envoi.log'));
  assert.ok(fs.statSync(new URL('../scripts/ios-testflight.sh', import.meta.url)).mode & 0o100, 'exécutable');
});
