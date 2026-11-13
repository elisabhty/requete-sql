/* Elisa, 13 novembre, 9 h 19 : « dans la première page que tu vas afficher là des widgets et les deux pages dans compte […] sur
   l’écran verrouillé et widget sur l’iPhone, tu vas mettre des exemples en première page et pareil pour la page que tu vas afficher
   après [la leçon]. Tu vas afficher des exemples. Et pour la page que tu vas afficher, tu vas mettre d’abord le widget normal et
   après le widget [verrouillé], mais à la suite […] avec un suivant, ou je sais pas, fais comme tu veux, comme tu le sens. »
   1. Une galerie d’exemples (wgxHTML), la même partout : les quatre widgets de l’écran d’accueil, l’écran verrouillé à trois moments.
   2. Les deux feuilles de Mon compte s’ouvrent sur leurs exemples ; « Comment l’ajouter » mène au pas-à-pas.
   3. Après la leçon, quatre pages à la suite : l’écran d’accueil (exemples, puis comment), l’écran verrouillé (exemples, puis comment). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), obv = lire('onboarding-vitrine.css'), sw = lire('sw.js'), ios = lire('IOS.md');
const swift = lire('resources/ios/widget/RequeteWidget/RequeteWidget.swift');
const entre = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };
const tous = (t, l) => { for (const k of l) assert.ok(t.includes(k), k); };
const ici = x => JSON.parse(JSON.stringify(x));
const NB = ' ', FINE = ' ';
const bloc = entre(app, '/* ---------- Les exemples de widgets ----------', '/* ---------- La Dynamic Island : la leçon en cours');

/* Le bloc, exécuté seul : une page factice, des minuteries qu’on déclenche à la main */
function moteur({ calme = false } = {}) {
  const minuteurs = [];
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), FLAME_SVG: '<svg data-k="creuse"></svg>', Intl,
    wtuTuile: () => '<span class="wtu-wg"></span>', obWidgetTuile: m => `<span class="ob-wg" data-m="${m}"></span>`, prefersReduceMotion: () => calme, buzz: () => {},
    setTimeout: (f, ms) => { minuteurs.push({ f, ms }); return minuteurs.length; }, clearTimeout: () => {}, document: { body: { contains: () => true } } });
  vm.runInContext(bloc, ctx);
  return { ctx, minuteurs, ev: x => vm.runInContext(x, ctx) };
}

/* ---------- 1. Les exemples ---------- */
test('les exemples sont les vrais widgets de l’app : quatre sur l’écran d’accueil, l’écran verrouillé à trois moments', () => {
  const W = ici(moteur().ev('WGX'));
  assert.deepEqual(W.accueil.map(x => x.k), ['flamme', 'poche', 'semaine', 'cheminee']);
  assert.deepEqual(W.accueil.map(x => x.f), ['Petit', 'Moyen', 'Moyen', 'Grand'], 'leur taille, comme dans la galerie d’iOS');
  assert.deepEqual(W.verrou.map(x => x.k), ['jour', 'soir', 'fait']);
  /* Les noms sont ceux que la galerie de l’iPhone affiche (configurationDisplayName) */
  for (const x of W.accueil) assert.ok(swift.includes(`.configurationDisplayName("${x.t}")`), x.t);
  tous(swift, ['.supportedFamilies([.systemSmall])', 'return [.systemLarge]', '.supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])']);
  assert.equal((swift.match(/\.supportedFamilies\(\[\.systemMedium\]\)/g) || []).length, 2, 'La requête de poche et Ta semaine : moyens');
  for (const x of W.accueil.concat(W.verrou)) {
    assert.ok(x.t.length <= 22 && x.d.length >= 20 && x.d.length <= 72, x.t + ' : une ligne ou deux sous le dessin');
    assert.doesNotMatch(x.t + x.d, / [?!:;»]|« |'/, x.t + ' : la typographie de l’app');
    assert.doesNotMatch(x.t + x.d, /bientôt|prochainement/i);
  }
});

test('les dessins : la galerie, ses points, et chaque widget tel que l’iPhone le montre', () => {
  const { ctx } = moteur();
  const a = ctx.wgxHTML('accueil', false), v = ctx.wgxHTML('verrou', false);
  assert.ok(a.startsWith('<div class="wgx" data-wgx="accueil" data-i="0"><div class="wgx-piste" tabindex="0" role="group" aria-label="Exemples de widgets" onscroll="wgxDefile(this.parentNode)" onpointerdown="wgxMain(this.parentNode)" ontouchstart="wgxMain(this.parentNode)">'));
  assert.equal((a.match(/<figure class="wgx-ex/g) || []).length, 4); assert.equal((v.match(/<figure class="wgx-ex/g) || []).length, 3);
  assert.equal((a.match(/<button type="button" class="(is-on)?" onclick="wgxAller\(this,\d\)" aria-label="Exemple \d sur 4/g) || []).length, 4, 'un point par exemple, qu’on peut toucher');
  assert.ok(a.includes('<figure class="wgx-ex is-on" data-ex="flamme"><span class="wgx-scene" aria-hidden="true"><span class="wgx-w wgx-petit"><span class="wtu-wg"></span></span></span><figcaption class="wgx-leg"><b>Ta flamme<i>Petit</i></b>'), 'le dessin est décoratif, la légende se lit');
  /* Dans la page d’après la leçon, la tuile de Ta flamme est celle qui vit (obWidgetTuile) ; dans Mon compte, celle de la feuille */
  assert.ok(ctx.wgxHTML('accueil', true).includes('<span class="wgx-w wgx-petit"><span class="ob-wg" data-m="jour"></span></span>'));
  /* La requête de poche : une vraie question d’entretien de la banque, avec sa bonne réponse et son pourquoi */
  const ENT = ici(vm.runInNewContext(entre(app, 'const POCHE_ENTRETIEN=[', '\n];\n') + '\n];POCHE_ENTRETIEN'));
  const q = ENT.find(p => p.e === `Comment tester qu’une valeur est NULL${NB}?`);
  assert.ok(q && q.c[q.b] === 'IS NULL' && q.oui === '`IS NULL`, jamais `= NULL`.', 'la question existe dans POCHE_ENTRETIEN');
  const po = ctx.wgxPocheHTML();
  tous(po, ['<span class="wgx-po-etq">Entretien · Lire une table</span>', `<span class="wgx-po-q">Comment tester qu’une valeur est NULL${NB}?</span>`, '<i>= NULL</i><i>== NULL</i><i class="is-bon">IS NULL<u>',
    '<em class="wgx-po-cons">Touche la bonne réponse</em>', `<b>Bien vu${FINE}!</b> <code>IS NULL</code>, jamais <code>= NULL</code>.`, 'src="assets/chat-question-fixe.webp"', 'src="assets/chat-oui-fixe.webp"']);
  assert.deepEqual(q.c.slice().sort(), ['= NULL', '== NULL', 'IS NULL'].sort());
  /* Ta semaine : sept colonnes, et le pied compte les flammes du dessin */
  const se = ctx.wgxSemaineHTML();
  assert.deepEqual([...se.matchAll(/<span class="wgx-se-col is-(\w+)( is-jour)?"><em>(\w+)<\/em>/g)].map(m => m[3] + ':' + m[1] + (m[2] ? '*' : '')), ['lun:fait', 'mar:fait', 'mer:repos', 'jeu:fait', 'ven:fait*', 'sam:avenir', 'dim:avenir']);
  tous(se, ['<b>SELECT</b> jour, flamme <b>FROM</b> ma_semaine;', `<span>7${NB}lignes · 4${NB}flammes</span><b>vendredi${NB}: flamme allumée</b>`, '<small>repos</small>']);
  tous(swift, ['Text(verbatim: " jour, flamme ")', 'Text(verbatim: " ma_semaine;")', 'return "7\\u{00A0}lignes · \\(n)\\u{00A0}flammes"', 'case .fait: return nom + "\\u{00A0}: flamme allumée"', 'Text("repos")']);
  /* La cheminée : la pièce en image (composée avec les éléments du widget), le titre et la séance écrits par-dessus */
  const ch = ctx.wgxChemineeHTML();
  tous(ch, ['<img src="assets/widget-cheminee.webp" width="676" height="708" alt="" draggable="false">', `<b>Flamme allumée${FINE}!</b><small>Bien joué, à demain.</small>`, '</i>1/1</span>']);
  tous(swift, ['if fait { return "Flamme allumée\\u{202F}!" }', '"Bien joué, à demain."']);
  const image = fs.statSync(path.join(ROOT, 'assets/widget-cheminee.webp'));
  assert.ok(image.size > 8000 && image.size < 90000, 'une image légère');
  assert.ok(sw.includes("  './assets/widget-cheminee.webp',"), 'gardée hors ligne avec les autres');
});

test('l’écran verrouillé : la ligne de la date, le rond et le bandeau, avec les phrases du vrai widget', () => {
  const { ctx } = moteur();
  const jour = ctx.wgxVerrouHTML('jour'), soir = ctx.wgxVerrouHTML('soir'), fait = ctx.wgxVerrouHTML('fait');
  tous(jour, ['<span class="wgx-w wgx-verrou is-jour">', '<b>Séance du jour 0/1</b>', '<span class="wgx-vr-heure">9:41</span>', '<svg data-k="creuse"></svg><b>0/1</b>', `<b>Requête</b><small>Séance du jour${NB}: 0/1</small>`]);
  assert.ok(!jour.includes('wgx-vr-anneau') && !jour.includes('<em>'));
  tous(soir, ['is-soir', '<svg class="wgx-vr-anneau"', `<small>Ta flamme t’attend${FINE}!</small><em>3:12:45</em>`, '<span class="wgx-vr-heure">20:47</span>'], 'le soir : l’anneau qui se vide et le temps qui reste');
  tous(fait, ['is-fait', '<b>Séance du jour validée</b>', '<b>1/1</b>', '<small>Séance du jour validée</small>']);
  assert.ok(!fait.includes('data-k="creuse"'), 'la flamme pleine');
  assert.match(jour, /<span class="wgx-vr-ligne"><span>[a-zéû]{3}\. \d{1,2}<\/span>/, 'le jour en court devant, comme iOS l’écrit');
  tous(swift, ['if fait { return "Séance du jour validée" }', 'return entree.serie > 0 ? "Ta flamme t’attend\\u{202F}!" : "Allume ta flamme\\u{202F}!"', 'return "Séance du jour\\u{00A0}: 0/1"',
    'return entree.repos ? "Jour de repos" : "Séance du jour 0/1"', 'private var compte: String { fait ? "1/1" : "0/1" }', 'Text(minuit, style: .timer)']);
});

/* ---------- La galerie avance seule, jusqu’à ce qu’on la touche ---------- */
function galerie(n) {
  const classes = () => { const s = new Set(); return { toggle: (c, on) => on ? s.add(c) : s.delete(c), add: c => s.add(c), remove: c => s.delete(c), has: c => s.has(c) }; };
  const poche = { classList: classes() };
  const exs = Array.from({ length: n }, (_, i) => ({ classList: classes(), querySelector: s => (s === '.wgx-poche' && i === 1 ? poche : null) }));
  const points = Array.from({ length: n }, () => ({ classList: classes(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } }));
  const piste = { clientWidth: 300, scrollLeft: 0, children: exs, appels: [], scrollTo(o) { this.appels.push(o.behavior); this.scrollLeft = o.left; } };
  const box = { dataset: {}, querySelectorAll: s => s === '.wgx-ex' ? exs : s === '.wgx-points button' ? points : [], querySelector: s => s === '.wgx-piste' ? piste : null };
  return { box, piste, exs, points, poche };
}

test('la galerie : elle part du premier exemple, avance seule toutes les 4,2 s, revient au début ; touchée, elle attend', () => {
  const { ctx, minuteurs, ev } = moteur(), g = galerie(4);
  assert.deepEqual([ev('WGX_DUREE'), ev('WGX_REPONSE')], [4200, 1500]);
  ctx.wgxJouer(g.box);
  assert.equal(g.box.dataset.i, '0'); assert.ok(g.exs[0].classList.has('is-on') && g.points[0].classList.has('is-on') && g.points[0].attrs['aria-current'] === 'true');
  assert.deepEqual(g.piste.appels, ['auto'], 'posée sans glisser');
  const vus = [];
  for (let k = 0; k < 5; k++) { const m = minuteurs.filter(x => x.ms === 4200).at(-1); m.f(); vus.push(g.box.dataset.i + '@' + g.piste.scrollLeft); }
  assert.deepEqual(vus, ['1@300', '2@600', '3@900', '0@0', '1@300'], 'un exemple après l’autre, puis de nouveau le premier');
  assert.equal(g.piste.appels.at(-1), 'smooth');
  /* Sur le trajet, les positions intermédiaires ne changent rien : seul l’exemple visé compte */
  assert.equal(g.box.dataset.cible, '1');
  g.piste.scrollLeft = 120; ctx.wgxDefile(g.box); assert.equal(g.box.dataset.i, '1', 'pas de retour au précédent en chemin');
  g.piste.scrollLeft = 300; ctx.wgxDefile(g.box); assert.equal(g.box.dataset.cible, undefined, 'arrivée');
  /* La requête de poche reçoit sa réponse une seconde et demie après son arrivée, et se remet à zéro quand on la quitte */
  const rep = minuteurs.filter(x => x.ms === 1500).at(-1); assert.ok(rep, 'sa minuterie'); rep.f();
  assert.ok(g.poche.classList.has('is-rep'));
  const avant = minuteurs.length;
  ctx.wgxMain(g.box); assert.equal(g.box.dataset.main, '1');
  minuteurs.filter(x => x.ms === 4200).at(-1).f();
  assert.equal(g.box.dataset.i, '1', 'touchée : elle n’avance plus seule'); assert.equal(minuteurs.length, avant);
  /* Le doigt la fait glisser : l’exemple au centre devient celui du moment */
  g.piste.scrollLeft = 880; ctx.wgxDefile(g.box);
  assert.equal(g.box.dataset.i, '3'); assert.ok(g.points[3].classList.has('is-on') && !g.points[1].classList.has('is-on') && !g.poche.classList.has('is-rep'));
  /* Un point touché y mène */
  ctx.wgxAller({ closest: () => g.box }, 2); assert.equal(g.box.dataset.i, '2'); assert.equal(g.piste.scrollLeft, 600);
  /* Hors de l’écran (feuille fermée, autre page) : elle s’arrête d’elle-même */
  const h = galerie(3); ctx.wgxJouer(h.box); h.piste.clientWidth = 0; const n = minuteurs.length; minuteurs.at(-1).f(); assert.equal(minuteurs.length, n);
  assert.doesNotThrow(() => { ctx.wgxJouer(null); ctx.wgxDefile(null); ctx.wgxMain(null); ctx.wgxMarquer(null, 0); });
});

test('moins d’animations : la galerie n’avance pas seule et ne glisse pas ; la requête de poche montre tout de suite sa réponse', () => {
  const { ctx, minuteurs } = moteur({ calme: true }), g = galerie(4);
  ctx.wgxJouer(g.box);
  assert.equal(minuteurs.filter(x => x.ms === 4200).length, 0);
  ctx.wgxAller({ closest: () => g.box }, 1);
  assert.equal(g.piste.appels.at(-1), 'auto'); assert.equal(g.box.dataset.cible, undefined);
  assert.equal(minuteurs.at(-1).ms, 0);
});

/* ---------- 2. Mon compte ---------- */
test('Mon compte : chaque feuille s’ouvre sur ses exemples ; « Comment l’ajouter » mène au pas-à-pas, « Voir les exemples » en revient', () => {
  tous(app, ["return `<div class=\"wtu\" id=\"wtu-accueil\" data-wtu=\"accueil\" data-step=\"1\" data-page=\"exemples\">\n        ${wtuExemplesHTML('accueil')}",
    "return `<div class=\"wtu-ex\">${wgxHTML(k,false)}<button type=\"button\" class=\"lq-btn wtu-go\" onclick=\"wtuPage('${k}','etapes')\">Comment l’ajouter</button></div>`;"]);
  const bascule = entre(app, 'function wtuToggle(el){', '\n}\n');
  tous(bascule, ["if(box){box.dataset.page='exemples';requestAnimationFrame(()=>wgxJouer(box.querySelector('.wgx')));}", 'wgxStop();']);
  assert.ok(!bascule.includes('wtuJouer('), 'le pas-à-pas ne part plus à l’ouverture');
  const page = entre(app, 'function wtuPage(k,page){', '\n}\n');
  tous(page, ["box.dataset.page=page==='etapes'?'etapes':'exemples';", 'requestAnimationFrame(()=>wtuJouer(k,1));', "requestAnimationFrame(()=>wgxJouer(box.querySelector('.wgx')));", 'wgxStop();', 'wtuStop();']);
  /* Les deux pages ne se montrent jamais ensemble */
  tous(lq, ['html.lq .wtu[data-page="exemples"]>:is(.wtu-scene,.wtu-etapes,.wtu-guide,.wtu-revoir){display:none}', 'html.lq .wtu[data-page="etapes"]>.wtu-ex{display:none}']);
});

/* ---------- 3. Après la leçon ---------- */
test('après la leçon : l’écran d’accueil d’abord, puis l’écran verrouillé, chacun ses exemples puis son tutoriel ; « Suivant » entre les deux', () => {
  assert.ok(app.includes("'rappel','widget','widgetTuto','widgetVerrou','widgetVerrouTuto','pseudo',"), 'quatre pages, dans cet ordre');
  const peint = entre(app, "  }else if(slide==='widget'){", "  }else if(slide==='rhythm'){");
  const pages = peint.split(/  \}else if\(slide==='(widgetTuto|widgetVerrou|widgetVerrouTuto)'\)\{/);
  assert.equal(pages.length, 7);
  const [accueil, , tuto, , verrou, , verrouTuto] = pages;
  tous(accueil, ['<h1 class="ob-title" id="ob-title">Requête sur ton<br><em>écran d’accueil</em></h1>', "${wgxHTML('accueil',true)}", "obSetFooter('Continuer',()=>obGoto('widgetTuto'),'Pas maintenant',obWidgetFin,'');"]);
  tous(tuto, ['${obTelTuto()}', "obSetFooter('Suivant',()=>obGoto('widgetVerrou'),'','','');"]);
  tous(verrou, ['<h1 class="ob-title" id="ob-title">Et sur ton<br><em>écran verrouillé</em></h1>', "obMascotDit('Ta séance du jour, sans déverrouiller ton iPhone !','reveil')", "${wgxHTML('verrou',true)}",
    "obSetFooter('Continuer',()=>obGoto('widgetVerrouTuto'),'Pas maintenant',obWidgetFin,'');"]);
  tous(verrouTuto, ['<h1 class="ob-title ob-sr" id="ob-title">Ajouter le widget de l’écran verrouillé</h1>', '<div class="ob-wv-carte">${wtuVerrouHTML(true)}</div>', "obSetFooter('C’est fait\\u00a0!',obWidgetFait,'','','');"]);
  /* La page démarre ce qui bouge : la galerie, la tuile qui vit, le pas-à-pas */
  tous(app, ["  if(slide==='widget'||slide==='widgetVerrou'){wgxJouer(document.querySelector('#ob-body .wgx'));if(slide==='widget')obWidgetPromoJouer();}\n  else if(OB_WIDGET_SLIDES.includes(slide))wgxStop();",
    "  if(slide==='widgetVerrouTuto')requestAnimationFrame(()=>wtuJouer('verrou',1));", "const wg=document.querySelector('#ob-body .wgx .ob-wg');if(!wg)return;"]);
  /* En sortant, tout s’arrête */
  assert.ok(entre(app, 'function obWidgetFin(){', '\n}\n').includes("try{wgxStop();if(document.getElementById('wtu-ob-verrou'))wtuStop();}catch(e){}"));
  /* Les quatre pages sont hors du tunnel : ni reprise au milieu, ni compte des étapes */
  assert.ok(app.includes("||OB_WIDGET_SLIDES.includes(r.slide))return null;"));
});

test('le pas-à-pas de l’écran verrouillé sert deux fois : dans Mon compte et après la leçon, sans se mélanger', () => {
  const lab = ({ ouvert = true, slide = 'widgetVerrouTuto', ob = true } = {}) => {
    const boites = { 'wtu-verrou': { nom: 'compte' } }; if (ob) boites['wtu-ob-verrou'] = { nom: 'leçon' };
    const ctx = vm.createContext({ OB_SLIDES: [slide], obStep: 0, document: { getElementById: id => id === 'onboarding' ? { classList: { contains: () => ouvert } } : boites[id] || null } });
    vm.runInContext(entre(app, 'function wtuBoite(k){', '\n}\n') + '\n}', ctx);
    return ctx.wtuBoite('verrou').nom;
  };
  assert.equal(lab(), 'leçon', 'sur la page d’après la leçon : le sien');
  assert.equal(lab({ ouvert: false }), 'compte', 'l’onboarding fermé (sa page reste dans le document) : celui de Mon compte');
  assert.equal(lab({ slide: 'widgetVerrou' }), 'compte');
  assert.equal(lab({ ob: false }), 'compte');
});

/* ---------- Les styles ---------- */
test('les styles : la galerie dans ludique.css (avant la section des défis, sans animation), ses couleurs sur fond violet dans onboarding-vitrine.css', () => {
  const debut = lq.indexOf('   Les exemples de widgets (Elisa, 13 novembre, 9 h 19'), fin = lq.indexOf('Défis — la refonte du 7 novembre');
  assert.ok(debut > 0 && fin > debut, 'avant la section des défis');
  const css = lq.slice(debut, fin);
  assert.ok(!css.includes('drop-shadow(') && !/animation\s*:/.test(css), 'des transitions seulement');
  tous(css, ['html.lq .wgx-piste{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;', 'html.lq .wgx-ex{flex:none;box-sizing:border-box;width:100%;margin:0;scroll-snap-align:center;scroll-snap-stop:always;',
    'html.lq .wgx-w{position:relative;display:block;overflow:hidden;container-type:inline-size;--u:calc(100cqw / 364);', 'html.lq .wgx-moyen{width:min(330px,calc(100% - 20px));aspect-ratio:364/170;',
    'html.lq .wgx-grand{width:212px;aspect-ratio:338/354;', 'html.lq .wgx-poche.is-rep .wgx-po-rep i.is-bon{opacity:1;background:#9FF0C6;', '@media (prefers-reduced-motion:reduce){',
    'html[data-motion="reduce"].lq :is(.wgx-points button,.wgx-po-chat,.wgx-po-rep i,.wgx-po-rep u){transition:none!important}']);
  /* Les mesures de la requête de poche sont celles du widget (MesurePoche : la colonne commence à 109,4 et fait 240,6 de large) */
  assert.ok(css.includes('html.lq .wgx-po-col{position:absolute;left:calc(var(--u) * 109.4);top:calc(var(--u) * 10);bottom:calc(var(--u) * 8);width:calc(var(--u) * 240.6);'));
  const ob = obv.slice(obv.indexOf('/* ---------- 13 novembre, 9 h 19 (Elisa : « tu vas afficher des exemples'));
  assert.ok(ob.length > 200 && !/animation\s*:/.test(ob));
  tous(ob, ['html #onboarding.ob-vitrine .ob-wgx-step .wgx-leg b{color:#fff}', 'html #onboarding.ob-vitrine .ob-wgx-step .wgx-points button.is-on{background:var(--v-sun)}', 'html #onboarding.ob-vitrine .ob-wv-carte{']);
  /* L’iPhone dessiné de l’ancienne page est parti, la tuile garde son arrivée */
  assert.ok(!app.includes('obTelPromo') && !app.includes('ob-ph-promo') && !obv.includes('ob-ph-promo') && !obv.includes('ob-ph-home'));
  tous(obv, ['#onboarding.ob-vitrine .wgx-petit .ob-wg{animation:obvWgPop .6s var(--v-pop) .3s both}', '#onboarding.ob-vitrine .wgx-petit .ob-wg-cat{animation:obvCatUp .6s var(--v-pop) .7s both}']);
});

test('la nouvelle version arrive sur les iPhone, et IOS.md raconte les exemples', () => {
  tous(app, ['<link rel="stylesheet" href="ludique.css?v=335">', '<link rel="stylesheet" href="onboarding-vitrine.css?v=67">']);
  assert.match(app, /const SW_CACHE='requete-2026-11-13-[a-z]+-v29\d\d';/);
  const s = entre(ios, '### Les exemples de widgets (13 novembre, 9 h 19)', '\n### ');
  tous(s, ['wgxHTML', 'widget-cheminee.webp', 'widgetVerrou', 'Comment l’ajouter', 'Ce qui n’a pas été fait']);
});
