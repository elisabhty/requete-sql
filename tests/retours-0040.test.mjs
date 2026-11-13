/* Elisa, 6 novembre, 0 h 40 : « Dans compte mettre ça (widget) avec les animations de comment procéder », sur une capture
   « Widgets de l’écran d’accueil », « Widgets de l’écran verrouillé », « Évaluer l’application ».
   - Mon compte, dans l’app iPhone : le groupe « Sur ton iPhone » (les deux widgets, puis « Évaluer l’application ») ; depuis 10 h 40,
     aussi dans Safari sur iPhone (retours-1040) ;
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

test('Mon compte : « Sur ton iPhone », les deux widgets (plus d’« Évaluer l’application » depuis le 11 novembre, 12 h 25), sur iPhone', () => {
  assert.ok(compte.includes("const widgetsIci=typeof obWidgetPossible==='function'&&obWidgetPossible();"), 'le pont RequeteWidget de l’app iPhone');
  const g = compte.slice(compte.indexOf('<p class="account-settings-group-title">Sur ton iPhone</p>'), compte.indexOf('<p class="account-settings-group-title">Compte et assistance</p>'));
  assert.ok(g.length > 0 && compte.indexOf('Apprentissage</p>') < compte.indexOf('Sur ton iPhone</p>'), 'entre « Apprentissage » et « Compte et assistance »');
  const a = g.indexOf("openPlusDetails('plus-widget-accueil')"), v = g.indexOf("openPlusDetails('plus-widget-verrou')");
  assert.ok(a > 0 && v > a && !g.includes('noterAppli()'), 'accueil puis verrouillé, sans « Évaluer »');
  assert.ok(g.includes("${lqStkSvg('widgets')}") && g.includes("${lqStkSvg('verrou')}"), 'des autocollants, comme les autres lignes');
  assert.ok(compte.includes('const widgetsVus=widgetsIci||(!appliNative()&&iphoneWeb());') && compte.includes('const surIphone=widgetsVus;'), 'l’app, ou Safari sur iPhone');
  assert.ok(compte.includes('${surIphone?`<div class="account-settings-group">'), 'pas de groupe sur un ordinateur');
  const assistance = compte.slice(compte.indexOf('Compte et assistance</p>'));
  assert.ok(!assistance.slice(0, assistance.indexOf('</section>')).includes('noterAppli()'), '« Évaluer l’application » a quitté « Compte et assistance »');
  for (const k of ['accueil', 'verrou'])
    assert.ok(compte.includes(`<details class="plus-details plus-widget" id="plus-widget-${k}" ontoggle="wtuToggle(this)">`), k + ' : une feuille qui lance et arrête son tutoriel');
  assert.ok(compte.includes('${widgetsVus?`<details class="plus-details plus-widget" id="plus-widget-accueil"'), 'les feuilles, avec leurs lignes');
});

/* Le module, exécuté : les dessins, les cibles du doigt, le pas-à-pas.
   6 novembre, 11 h 12 (les captures de l’iPhone d’Elisa : « + » en haut à gauche, « OK », le menu « Ajouter un widget »,
   « Personnaliser », « Modifier le fond d’écran », « Modifier les pages ») : « t’es sûr pour la mise en place des widgets ? »,
   « améliore les pages pour que ça soit plus clair ». Cinq étapes, une action chacune, une à la fois. */
const NB = ' ';
function moteur() {
  const minuteurs = [];
  const ctx = vm.createContext({
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), FLAME_SVG: '<svg data-k="flamme"></svg>', MASCOT_IMG: 'chat.webp',
    jourActif: () => false, dstr: d => '2026-11-06', auj: () => new Date(2026, 10, 6), buzz: () => {}, Intl, requestAnimationFrame: f => f(),
    appStoreFiche: () => 'https://apps.apple.com/app/id6830361256',
    setTimeout: (f, ms) => { minuteurs.push({ f, ms }); return minuteurs.length; }, clearTimeout: () => {}, document: { body: { contains: () => true } }
  });
  vm.runInContext(cut('/* ---------- Les widgets, dans Mon compte ----------', '/* ---------- La Dynamic Island'), ctx);
  return { ctx, minuteurs, ev: x => vm.runInContext(x, ctx) };
}

test('les deux pas-à-pas : cinq étapes, une action chacune, les boutons de l’iPhone, le doigt qui vise des cibles mesurées', () => {
  const { ctx, ev } = moteur();
  const W = JSON.parse(JSON.stringify(ev('WTU')));
  assert.deepEqual(Object.keys(W), ['accueil', 'verrou']);
  assert.equal(W.accueil.titre, 'Widgets de l’écran d’accueil');
  assert.equal(W.verrou.titre, 'Widgets de l’écran verrouillé');
  const g = b => `«${NB}${b}${NB}»`;
  const attendus = { accueil: ['+', 'Ajouter un widget', 'Rechercher des widgets', 'Requête', 'Ajouter le widget', 'OK'], verrou: ['Personnaliser', 'Écran verrouillé', 'Ajouter des widgets', 'Requête', 'OK'] };
  for (const k of ['accueil', 'verrou']) {
    const tout = W[k].etapes.join(' ');
    for (const b of attendus[k]) assert.ok(tout.includes(g(b)), k + ' : ' + b);
    for (const champ of ['etapes', 'astuces', 'durees', 'cles']) assert.equal(W[k][champ].length, 5, k + ' : ' + champ);
    for (const t of [...W[k].etapes, ...W[k].astuces]) assert.doesNotMatch(t, / [?!;:»]|« /, 'espaces insécables');
    for (const c of W[k].cles) assert.ok(c > 0 && c < 1, 'le moment de l’image fixe');
  }
  assert.ok(!W.accueil.etapes.join(' ').includes(g('Modifier')), 'le bouton de son iPhone : « + »');
  assert.ok(W.accueil.astuces[1].includes(g('Modifier')), '« Modifier » sur d’autres versions d’iOS : dans l’astuce');
  assert.ok(W.verrou.astuces[2].includes('en bas de l’écran'), 'iOS 26 : la zone des widgets peut être en bas');
  const a = ctx.wtuAccueilHTML();
  assert.equal((a.match(/class="wtu-app t\d+"/g) || []).length, 20, 'vingt apps, comme un écran d’accueil');
  assert.ok(a.includes('style="--i:5;grid-area:2/2"'), 'chaque app à sa case : le widget passe par-dessus sans pousser les autres');
  for (const c of ['plus', 'ok', 'ajout', 'cherche', 'res', 'valider']) assert.ok(a.includes(`data-cible="${c}"`), 'cible ' + c);
  assert.ok(a.includes('<span class="wtu-pill wtu-pplus" data-cible="plus">+</span>'), 'le « + » en haut à gauche');
  const menu = [...a.matchAll(/<span class="wtu-mi"(?: data-cible="ajout")?><svg[^]*?<\/svg>([^<]+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(menu, ['Ajouter un widget', 'Personnaliser', 'Modifier le fond d’écran', 'Modifier les pages'], 'le menu de son iPhone');
  assert.ok(a.includes('<span class="wtu-ph">Rechercher des widgets</span><b class="wtu-tape">Requête</b>') && a.includes('<b class="wtu-fiche-t">Ta flamme</b>'), 'la galerie');
  assert.ok(a.includes('<b>0<small>/1</small></b>') && a.includes('src="chat.webp"'), 'le widget de l’iPhone : la flamme, « 0/1 », le chat');
  const v = ctx.wtuVerrouHTML();
  for (const c of ['perso', 'choix', 'zone', 'rq', 'rond', 'bande', 'ok']) assert.ok(v.includes(`data-cible="${c}"`), 'cible ' + c);
  assert.ok(v.includes('<span class="wtu-date">Vendredi 6 novembre</span>') || /<span class="wtu-date">[A-ZÀ-Ý][a-zà-ÿ]+ \d+ [a-zéû]+<\/span>/.test(v), 'la date du jour, comme sur l’écran verrouillé');
  assert.ok(v.includes(`Séance du jour${NB}: 0/1`) && v.includes('<b>0/1</b>'), 'le bandeau et le rond');
  const e = ctx.wtuGuideHTML('accueil');
  assert.equal((e.match(/<button type="button" class="wtu-etape/g) || []).length, 5, 'la barre des étapes');
  assert.ok(e.includes('class="wtu-etape is-on" data-i="1" onclick="wtuAller(\'accueil\',1)" aria-label="Étape 1 sur 5" aria-current="step"'), 'la première éclairée');
  assert.equal((e.match(/<div class="wtu-pas/g) || []).length, 5);
  assert.ok(e.includes('<div class="wtu-pas is-on" data-i="1"><span class="wtu-num">Étape 1 sur 5</span>') && e.includes('<div class="wtu-pas" data-i="2" aria-hidden="true">'), 'une étape à la fois');
  assert.ok(e.includes(`Touche <b>«${NB}+${NB}»</b>, en haut à gauche, puis <b>«${NB}Ajouter un widget${NB}»</b>.`), 'les mots des boutons en gras');
  assert.ok(e.includes(`<p class="wtu-astuce">Pas de <b>«${NB}+${NB}»</b>${NB}? Selon ta version d’iOS, le bouton s’appelle <b>«${NB}Modifier${NB}»</b>.</p>`), 'l’astuce sous l’étape 2');
  /* 7 novembre, 0 h 03 : « ne pas mettre les suivant précédent » ; les étapes s’enchaînent seules (retours-0003). */
  assert.ok(!/wtu-(nav|prec|suiv)|Précédent|Suivant/.test(e), 'ni « Précédent » ni « Suivant »');
  assert.equal((e.match(/<button /g) || []).length, 5, 'pas d’autre bouton que les cinq barres');
  assert.ok(e.includes('<div class="wtu-guide" aria-live="off">'), 'l’enchaînement n’est pas annoncé à chaque étape');
  /* « ne pas mettre les cadres violets, supprimer la dernière phrase pour iPhone dans les deux » : l’iPhone dessiné et ses étapes, rien d’autre. */
  const f = ctx.wtuFeuilleHTML('verrou');
  assert.equal(f, ctx.wtuVerrouHTML(), 'la feuille : le pas-à-pas seul');
  assert.ok(!/acc-note|wtu-note|wtu-web|pour iPhone|App Store/.test(f), 'ni cadre violet ni ligne sur l’app pour iPhone');
  assert.doesNotMatch(f, /[Bb]ientôt|[Pp]rochainement/, 'jamais « bientôt » (11 h 12)');
  ctx.appliNative = () => true;
  assert.equal(ctx.wtuFeuilleHTML('accueil'), ctx.wtuAccueilHTML(), 'pareil dans l’app');
});

test('le pas-à-pas : les étapes s’enchaînent seules, 1 → 2 → … → 5 → 1 ; une barre touchée y mène ; tout s’arrête à la fermeture', () => {
  const { ctx, minuteurs, ev } = moteur();
  const classes = () => { const s = new Set(); return { toggle: (c, on) => on ? s.add(c) : s.delete(c), has: c => s.has(c) }; };
  const el = i => ({ dataset: { i: String(i) }, classList: classes(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });
  const boutons = [1, 2, 3, 4, 5].map(el), pas = [1, 2, 3, 4, 5].map(el);
  const guide = { attrs: { 'aria-live': 'off' }, setAttribute(k, v) { this.attrs[k] = v; } };
  const details = { open: true }, props = {};
  const box = { dataset: {}, offsetWidth: 1, style: { setProperty: (k, v) => { props[k] = v; } }, removeAttribute(k) { if (k === 'data-step') delete this.dataset.step; },
    querySelectorAll: s => s === '.wtu-etape' ? boutons : s === '.wtu-pas' ? pas : [], querySelector: s => s === '.wtu-guide' ? guide : null, closest: () => details };
  ctx.document.getElementById = id => id === 'wtu-accueil' ? box : null;
  const W = JSON.parse(JSON.stringify(ev('WTU.accueil')));
  ctx.wtuJouer('accueil', 1);
  assert.equal(box.dataset.step, '1'); assert.equal(props['--wtu-d'], '3400ms'); assert.equal(props['--wtu-cle'], '0.62');
  assert.ok(boutons[0].classList.has('is-on') && boutons[0].attrs['aria-current'] === 'step');
  assert.ok(pas[0].classList.has('is-on') && !('aria-hidden' in pas[0].attrs) && pas[1].attrs['aria-hidden'] === 'true', 'le texte de l’étape 1, seul');
  const vus = [box.dataset.step];
  for (let i = 1; i <= 5; i++) {
    assert.equal(minuteurs.at(-1).ms, W.durees[i - 1] + (i === 5 ? 1800 : 1200), `étape ${i} : son geste, puis un temps de pause`);
    minuteurs.at(-1).f();
    vus.push(box.dataset.step);
    if (i === 5) break;
    assert.ok(boutons[i - 1].classList.has('is-fait') && boutons[i].classList.has('is-on') && !boutons[i - 1].attrs['aria-current'], `étape ${i + 1} : la barre d’avant reste pleine`);
    assert.ok(pas[i].classList.has('is-on') && !pas[i - 1].classList.has('is-on') && pas[i - 1].attrs['aria-hidden'] === 'true', `le texte de l’étape ${i + 1}, seul`);
    assert.equal(props['--wtu-d'], W.durees[i] + 'ms');
  }
  assert.deepEqual(vus, ['1', '2', '3', '4', '5', '1'], 'étape 1 → étape 2 tout seul ; après la cinquième, la première');
  assert.ok(boutons[0].classList.has('is-on') && boutons.every(b => !b.classList.has('is-fait')), 'les barres repartent de zéro');
  assert.equal(guide.attrs['aria-live'], 'off', 'l’enchaînement ne parle pas tout seul');
  ctx.wtuAller('accueil', 3);
  assert.equal(box.dataset.step, '3', 'une barre touchée : son étape tout de suite');
  assert.equal(guide.attrs['aria-live'], 'polite', 'annoncée au lecteur d’écran');
  assert.equal(props['--wtu-cle'], String(W.cles[2]));
  minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '4', 'l’enchaînement repart de là');
  ctx.wtuRejouer('accueil');
  assert.equal(box.dataset.step, '4', 'un toucher sur l’iPhone rejoue l’étape');
  details.open = false;
  const n = minuteurs.length;
  minuteurs.at(-1).f();
  assert.equal(box.dataset.step, '4', 'feuille fermée : plus rien ne bouge');
  assert.equal(minuteurs.length, n);
  assert.equal(ev('WTU_K'), '', 'arrêté');
  ctx.wtuToggle({ id: 'plus-widget-accueil', open: true });
  assert.equal(ev('WTU_K'), 'accueil', 'la feuille s’ouvre : le pas-à-pas repart');
  assert.equal(box.dataset.step, '1', 'de la première étape');
  assert.equal(guide.attrs['aria-live'], 'off', 'et se tait de nouveau');
  ctx.wtuToggle({ id: 'plus-widget-accueil', open: false });
  assert.equal(ev('WTU_K'), '');
});

test('les gestes : une animation par étape, le doigt sur les cibles mesurées, un iPhone plus grand, une image fixe si on réduit les animations', () => {
  for (const s of [1, 2, 3, 4, 5]) {
    assert.ok(lq.includes(`html.lq .wtu[data-wtu="accueil"][data-step="${s}"] .wtu-doigt{animation:wtuA${s}Doigt`), 'accueil ' + s);
    assert.ok(lq.includes(`html.lq .wtu[data-wtu="verrou"][data-step="${s}"] .wtu-doigt{animation:wtuV${s}Doigt`), 'verrouillé ' + s);
    assert.equal(lq.split(`@keyframes wtuA${s}Doigt{`).length - 1, 1, `wtuA${s}Doigt : une seule définition`);
    assert.equal(lq.split(`@keyframes wtuV${s}Doigt{`).length - 1, 1, `wtuV${s}Doigt : une seule définition`);
  }
  for (const v of ['--plus-x', '--ajout-y', '--cherche-x', '--res-y', '--valider-x', '--ok-y', '--perso-x', '--choix-y', '--zone-x', '--rq-y', '--rond-x', '--bande-y']) assert.ok(lq.includes(`var(${v},`), v);
  assert.ok(lq.includes('html.lq .wtu-tel{position:relative;display:block;width:min(212px,56vw);'), 'un iPhone plus grand');
  assert.ok(/html\.lq \.wtu-ecran\{[^}]*container-type:inline-size/.test(lq), 'des libellés à l’échelle de l’écran dessiné (cqw)');
  assert.ok(lq.includes('html.lq .wtu-pas{grid-area:1/1;') && lq.includes('html.lq .wtu-pas.is-on{visibility:visible;'), 'les étapes au même endroit : la feuille ne saute pas d’une étape à l’autre');
  assert.ok(lq.includes('animation:wtuBarre var(--wtu-d,3s) linear both'), 'la barre de l’étape se remplit pendant son geste');
  assert.ok(lq.includes('html[data-motion="reduce"].lq .wtu *,html[data-motion="reduce"].lq .wtu *::after{animation-play-state:paused!important;animation-delay:calc(var(--wtu-d,3s) * var(--wtu-cle,.62) * -1)!important}'));
  assert.ok(lq.includes('@media (prefers-reduced-motion:reduce){\n  html.lq .wtu *'));
  assert.ok(!/\.wtu-(ajout|perso)\{[^}]*translateX\(-50%\)/.test(lq), 'centrés sans transformation : offsetLeft donne leur vraie place');
  assert.ok(!/@keyframes wtuA[1-4](Mod|Ok)\{/.test(lq), 'plus d’animation du bouton « Modifier »');
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
  for (const l of ['let tailleFlamme: CGFloat = presse ? 15 : 20', 'let flamme: Font = Font.system(size: tailleFlamme, weight: .bold)', 'let titre: Font = Font.system(size: 15, weight: .heavy, design: .rounded)', 'let texte: String = texteLigne'])
    assert.ok(swift.includes(l), l);
  assert.ok(lire('IOS.md').includes('### Le widget de l’écran verrouillé (6 novembre)'));
});
