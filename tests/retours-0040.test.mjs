/* Elisa, 6 novembre, 0 h 40 : « Dans compte mettre ça (widget) avec les animations de comment procéder », sur une capture
   « Widgets de l’écran d’accueil », « Widgets de l’écran verrouillé », « Évaluer l’application ».
   - Mon compte, dans l’app iPhone : le groupe « Sur ton iPhone » (les deux widgets, puis « Noter Requête ») ;
   - chaque ligne ouvre une feuille : un iPhone dessiné rejoue les gestes d’Apple, étape par étape, en boucle ; les étapes dessous ;
   - le widget de l’écran verrouillé existe vraiment (RequeteWidget.swift) : la flamme et la séance du jour, en rond ou en bandeau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const compte = cut('function renderCompte(){', '\nfunction ');

test('Mon compte : « Sur ton iPhone », les deux widgets puis « Noter Requête », seulement dans l’app iPhone', () => {
  assert.ok(compte.includes("const widgetsIci=typeof obWidgetPossible==='function'&&obWidgetPossible();"), 'le pont RequeteWidget de l’app iPhone');
  const g = compte.slice(compte.indexOf('<p class="account-settings-group-title">Sur ton iPhone</p>'), compte.indexOf('<p class="account-settings-group-title">Compte et assistance</p>'));
  assert.ok(g.length > 0 && compte.indexOf('Apprentissage</p>') < compte.indexOf('Sur ton iPhone</p>'), 'entre « Apprentissage » et « Compte et assistance »');
  const a = g.indexOf("openPlusDetails('plus-widget-accueil')"), v = g.indexOf("openPlusDetails('plus-widget-verrou')"), n = g.indexOf('onclick="noterAppli()"');
  assert.ok(a > 0 && v > a && n > v, 'accueil, verrouillé, puis noter');
  assert.ok(g.includes("${lqStkSvg('widgets')}") && g.includes("${lqStkSvg('verrou')}"), 'des autocollants, comme les autres lignes');
  assert.ok(compte.includes('${widgetsIci||appliNative()?`<div class="account-settings-group">'), 'pas de groupe vide sur le web');
  const assistance = compte.slice(compte.indexOf('Compte et assistance</p>'));
  assert.ok(!assistance.slice(0, assistance.indexOf('</section>')).includes('noterAppli()'), '« Noter Requête » a quitté « Compte et assistance »');
  for (const k of ['accueil', 'verrou'])
    assert.ok(compte.includes(`<details class="plus-details plus-widget" id="plus-widget-${k}" ontoggle="wtuToggle(this)">`), k + ' : une feuille qui lance et arrête son tutoriel');
});

/* Le module, exécuté : les dessins, les cibles du doigt, la boucle des étapes. */
function moteur() {
  const minuteurs = [];
  const ctx = vm.createContext({
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), FLAME_SVG: '<svg data-k="flamme"></svg>', MASCOT_IMG: 'chat.webp',
    jourActif: () => false, dstr: d => '2026-11-06', auj: () => new Date(2026, 10, 6), buzz: () => {}, Intl, requestAnimationFrame: f => f(),
    setTimeout: (f, ms) => { minuteurs.push({ f, ms }); return minuteurs.length; }, clearTimeout: () => {}, document: { body: { contains: () => true } }
  });
  vm.runInContext(cut('/* ---------- Les widgets, dans Mon compte ----------', '/* ---------- La Dynamic Island'), ctx);
  return { ctx, minuteurs, ev: x => vm.runInContext(x, ctx) };
}

test('les deux tutoriels : quatre étapes, les boutons d’Apple, le doigt qui vise des cibles mesurées', () => {
  const { ctx, ev } = moteur();
  const W = JSON.parse(JSON.stringify(ev('WTU')));
  assert.deepEqual(Object.keys(W), ['accueil', 'verrou']);
  assert.equal(W.accueil.titre, 'Widgets de l’écran d’accueil');
  assert.equal(W.verrou.titre, 'Widgets de l’écran verrouillé');
  const tout = k => W[k].etapes.join(' ');
  for (const b of ['Modifier', 'Ajouter un widget', 'Requête', 'Ajouter le widget', 'OK']) assert.ok(tout('accueil').includes(`« ${b} »`), 'accueil : ' + b);
  for (const b of ['Personnaliser', 'Ajouter des widgets', 'Requête', 'OK']) assert.ok(tout('verrou').includes(`« ${b} »`), 'verrouillé : ' + b);
  for (const k of ['accueil', 'verrou']) {
    assert.equal(W[k].etapes.length, 4); assert.equal(W[k].durees.length, 4);
    for (const t of W[k].etapes) assert.doesNotMatch(t, / [?!;:»]|« /, 'espaces insécables');
  }
  const a = ctx.wtuAccueilHTML();
  assert.equal((a.match(/class="wtu-app t\d+"/g) || []).length, 16, 'seize apps');
  assert.ok(a.includes('style="--i:5;grid-area:2/2"'), 'chaque app à sa case : le widget passe par-dessus sans pousser les autres');
  for (const c of ['mod', 'ok', 'ajout', 'valider']) assert.ok(a.includes(`data-cible="${c}"`), 'cible ' + c);
  assert.ok(a.includes('<b>0<small>/1</small></b>') && a.includes('src="chat.webp"'), 'le widget de l’iPhone : la flamme, « 0/1 », le chat');
  const v = ctx.wtuVerrouHTML();
  for (const c of ['perso', 'choix', 'zone', 'rq', 'rond', 'bande', 'ok']) assert.ok(v.includes(`data-cible="${c}"`), 'cible ' + c);
  assert.ok(v.includes('<span class="wtu-date">Vendredi 6 novembre</span>') || /<span class="wtu-date">[A-ZÀ-Ý][a-zà-ÿ]+ \d+ [a-zéû]+<\/span>/.test(v), 'la date du jour, comme sur l’écran verrouillé');
  assert.ok(v.includes('Séance du jour : 0/1') && v.includes('<b>0/1</b>'), 'le bandeau et le rond');
  const e = ctx.wtuEtapesHTML('accueil');
  assert.equal((e.match(/<button type="button" class="wtu-etape/g) || []).length, 4);
  assert.ok(e.includes('class="wtu-etape is-on" data-i="1" onclick="wtuAller(\'accueil\',1)" aria-current="step"'), 'la première éclairée');
  assert.ok(ctx.wtuFeuilleHTML('verrou').includes('<p class="acc-note wtu-note">'), 'une note sous les étapes');
});

test('la boucle : chaque étape relance son animation, la suivante vient après sa durée, et tout s’arrête à la fermeture', () => {
  const { ctx, minuteurs, ev } = moteur();
  const classes = () => { const s = new Set(); return { toggle: (c, on) => on ? s.add(c) : s.delete(c), has: c => s.has(c) }; };
  const boutons = [1, 2, 3, 4].map(i => ({ dataset: { i: String(i) }, classList: classes(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } }));
  const details = { open: true };
  const props = {};
  const box = { dataset: {}, offsetWidth: 1, style: { setProperty: (k, v) => { props[k] = v; } }, removeAttribute(k) { if (k === 'data-step') delete this.dataset.step; },
    querySelectorAll: s => s === '.wtu-etape' ? boutons : [], querySelector: () => null, closest: () => details };
  ctx.document.getElementById = id => id === 'wtu-accueil' ? box : null;
  ctx.wtuJouer('accueil', 1);
  assert.equal(box.dataset.step, '1'); assert.equal(props['--wtu-d'], '3200ms');
  assert.ok(boutons[0].classList.has('is-on') && boutons[0].attrs['aria-current'] === 'step');
  assert.equal(minuteurs.at(-1).ms, 3200);
  minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '2', 'étape suivante');
  assert.ok(boutons[0].classList.has('is-fait') && boutons[1].classList.has('is-on') && !boutons[0].attrs['aria-current']);
  minuteurs.at(-1).f(); minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '4');
  assert.equal(minuteurs.at(-1).ms, 3600 + 1400, 'un temps de pause à la fin');
  minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '1', 'en boucle');
  details.open = false;
  const n = minuteurs.length;
  minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '1', 'feuille fermée : plus rien ne bouge');
  assert.equal(minuteurs.length, n);
  assert.equal(ev('WTU_K'), '', 'arrêté');
  ctx.wtuToggle({ id: 'plus-widget-accueil', open: true });
  assert.equal(ev('WTU_K'), 'accueil', 'la feuille s’ouvre : le tutoriel repart');
  ctx.wtuToggle({ id: 'plus-widget-accueil', open: false });
  assert.equal(ev('WTU_K'), '');
});

test('les gestes : une animation par étape, le doigt sur les cibles mesurées, une image fixe si on réduit les animations', () => {
  for (const s of [1, 2, 3, 4]) {
    assert.ok(lq.includes(`html.lq .wtu[data-wtu="accueil"][data-step="${s}"] .wtu-doigt{animation:wtuA${s}Doigt`), 'accueil ' + s);
    assert.ok(lq.includes(`html.lq .wtu[data-wtu="verrou"][data-step="${s}"] .wtu-doigt{animation:wtuV${s}Doigt`), 'verrouillé ' + s);
  }
  for (const v of ['--mod-x', '--ajout-y', '--valider-x', '--ok-y', '--perso-x', '--choix-y', '--zone-x', '--rq-y', '--rond-x', '--bande-y']) assert.ok(lq.includes(`var(${v},`), v);
  assert.ok(lq.includes('animation:wtuBarre var(--wtu-d,3s) linear both'), 'la barre de l’étape se remplit pendant sa durée');
  assert.ok(lq.includes('html[data-motion="reduce"].lq .wtu *,html[data-motion="reduce"].lq .wtu *::after{animation-play-state:paused!important;animation-delay:calc(var(--wtu-d,3s) * -.62)!important}'));
  assert.ok(lq.includes('@media (prefers-reduced-motion:reduce){\n  html.lq .wtu *'));
  assert.ok(!/\.wtu-(ajout|perso)\{[^}]*translateX\(-50%\)/.test(lq), 'centrés sans transformation : offsetLeft donne leur vraie place');
  const stk = cut('function lqStkSvg(k){', '\n}');
  assert.ok(/\n    widgets:\['/.test(stk) && /\n    verrou:\['/.test(stk), 'deux autocollants');
});

test('le widget de l’écran verrouillé, dans l’extension : rond, bandeau, ligne de la date', () => {
  assert.ok(swift.includes('struct RequeteFlammeVerrou: Widget {\n    let kind = "RequeteSerieVerrou"'));
  assert.ok(swift.includes('.supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])'));
  assert.ok(swift.includes('StaticConfiguration(kind: kind, provider: SerieFournisseur()) { entree in\n            VerrouVue(entree: entree).fondVerrou()'), 'les mêmes données que le widget de l’écran d’accueil');
  assert.ok(swift.includes('.supportedFamilies([.systemSmall])'), 'le widget de l’écran d’accueil ne change pas');
  assert.ok(swift.includes('        if #available(iOS 16.1, *) {\n            RequeteFlammeVerrou()\n        }'), 'dans le paquet, à partir d’iOS 16.1');
  assert.ok(swift.includes('@available(iOS 16.1, *)\nstruct VerrouVue: View {') && swift.includes('@Environment(\\.widgetFamily) private var famille'));
  assert.ok(swift.includes('self.containerBackground(for: .widget) { Color.clear }'), 'iOS 17 : containerBackground, sinon « Adoptez l’API »');
  assert.ok(swift.includes('private var symbole: String { fait ? "flame.fill" : "flame" }'), 'pleine quand la séance est faite');
  /* La règle d’IOS.md (archive du 4 novembre) : les polices et mesures d’abord, typées. */
  for (const l of ['let flamme: Font = Font.system(size: 20, weight: .bold)', 'let titre: Font = Font.system(size: 15, weight: .heavy, design: .rounded)', 'let texte: String = texteLigne'])
    assert.ok(swift.includes(l), l);
  assert.ok(lire('IOS.md').includes('### Le widget de l’écran verrouillé (6 novembre)'));
});
