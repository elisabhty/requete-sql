/* Les boutons du bilan d’une leçon (Elisa, 26 octobre, 8 h 10, capture du bilan de la leçon 70 : « Ici l’UI/UX au niveau des boutons
   est pas top, on peut faire beaucoup mieux »).
   Avant : quatre cartes blanches empilées, de même poids (« Ta séance du jour », « Mon parcours » sans icône, « Relire le cours »,
   « Recommencer »), le titre de la séance coupé (« Sous-requête dans WHER… »), la confirmation dans la boîte du navigateur.
   Maintenant : une seule action principale, la suite du parcours, en carte violette comme celle de l’accueil, avec son bouton blanc
   « Continuer » et le titre en entier ; les autres actions en tuiles égales, chacune avec son icône (Mon planning, Revoir la vidéo
   ou Relire le cours, Recommencer) ; la carte mémo débloquée a sa propre ligne, avant la suite ; « Recommencer cette leçon ? » s’affiche
   en feuille, dans le style de l’app. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const premium = fs.readFileSync(path.join(root, 'design-premium.css'), 'utf8');
const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};

/* Le bas du bilan, construit dans un bac à sable : séance recommandée, plan, carte mémo et vidéo au choix. */
function bilan({session = null, plan = true, card = false, video = true} = {}) {
  const ctx = vm.createContext({
    state: {plan: plan ? {sessions: []} : null},
    CARTES: card ? {56: {k: 'Normalisation', t: 'Répartir les données'}} : {},
    recommendedSession: () => session,
    isDefiId: id => typeof id === 'string',
    itemMeta: id => ({titre: id === 'd1' ? 'Le meilleur client' : 'Sous-requête dans WHERE avec IN'}),
    lessonHasVideo: () => video,
    gradOf: () => 'linear-gradient(#7C5CFF,#5335E0)',
    esc: s => String(s), escAttr: s => String(s)
  });
  vm.runInContext(cut('function bravoCardHtml(l){', 'function bravoRevealCard(') + cut('function bravoNextHtml(l){', 'function renderBravoSlide(l){'), ctx);
  return ctx;
}
const SEANCE = {id: 45, label: 'Ta séance du jour', summary: '2 activités restantes · environ 12 min'};

test('la suite du parcours : une carte, son titre en entier et son bouton « Continuer »', () => {
  const next = bilan({session: SEANCE}).bravoNextHtml();
  assert.ok(next.startsWith('<button type="button" class="bravo-next-btn" onclick="openItem(45)">'), 'toute la carte ouvre la séance');
  /* Après une leçon, c’est la séance suivante (Elisa, 27 octobre, 10 h 11) ; prévue un autre jour, avec sa date. */
  assert.ok(next.includes('<span class="bravo-next-lab">Séance suivante</span>') && !next.includes('Ta séance du jour'));
  assert.ok(bilan({session: {...SEANCE, label: 'Prochaine séance · jeu. 28 oct.'}}).bravoNextHtml().includes('<span class="bravo-next-lab">Séance suivante · jeu. 28 oct.</span>'));
  assert.ok(next.includes('<span class="bn-copy"><b>Sous-requête dans WHERE avec IN</b><small>2 activités restantes · environ 12 min</small></span>'), 'titre et durée');
  assert.ok(/<span class="bn-cta"><span class="bn-num" aria-hidden="true"><svg[^>]*>.*<\/svg><\/span>Continuer<\/span>/.test(next), 'bouton « Continuer » avec le triangle de lecture');
  assert.ok(!next.includes('bn-arrow') && !next.includes('bravo-next-body'), 'plus de flèche qui bouge seule à droite');
  const defi = bilan({session: {...SEANCE, id: 'd1'}}).bravoNextHtml();
  assert.ok(defi.includes(`onclick="openItem('d1')"`) && defi.includes('<span class="bn-num defi" aria-hidden="true">⚑</span>Continuer'), 'un défi : le drapeau');
  assert.ok(bilan().bravoNextHtml().includes('<h2 id="bravo-fin-h">Bravo, tu as complété le parcours&nbsp;!</h2>'), 'parcours terminé : bravo');
  /* Le titre se lit en entier : deux lignes au plus, plus de coupure « … » sur une ligne. */
  assert.ok(lq.includes('html.lq #scr-lesson .bravo-next-btn .bn-copy b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:normal;'));
  assert.ok(!/\.bravo-next[^{]*\{[^}]*text-overflow:ellipsis/.test(html + lq + premium), 'plus de titre coupé');
});

test('la carte violette, comme celle de l’accueil : son bouton blanc s’enfonce sous le doigt ; juste sous Bravo, elle passe en blanc', () => {
  for (const part of [
    'html.lq #scr-lesson .bravo-next-btn:active{transform:none!important;box-shadow:0 6px 0 var(--accent-lip)!important}',
    'background:#fff;color:var(--accent-ink);font:700 18px/1 var(--display);box-shadow:0 5px 0 rgba(20,10,60,.24);',
    'html.lq #scr-lesson .bravo-next-btn:active .bn-cta{transform:translateY(5px);box-shadow:0 0 0 rgba(20,10,60,.24)}',
    'html.lq #scr-lesson .bravo-hero+.bravo-next-btn{background:#fff!important;border:2px solid var(--line)!important;box-shadow:0 5px 0 var(--lip)!important}',
    'html.lq #scr-lesson .bravo-hero+.bravo-next-btn .bn-cta{background:var(--accent);color:#fff;box-shadow:0 5px 0 var(--accent-lip)}'])
    assert.ok(lq.includes(part), part);
  assert.ok(!lq.includes('html.lq #scr-lesson .bravo-next-btn{background:#fff!important'), 'plus de carte blanche d’office');
});

test('les autres actions : des tuiles égales, chacune avec son icône', () => {
  const tiles = s => [...s.matchAll(/<button type="button" class="bravo-tool (\w+)" onclick="([^"]+)"><span class="bi"><svg[^>]*>.*?<\/svg><\/span><span class="bt">([^<]+)<\/span><\/button>/g)].map(m => [m[1], m[2], m[3]]);
  const video = bilan({session: SEANCE}).bravoActionsHtml({id: 70});
  assert.deepEqual(tiles(video), [['plan', "exitLessonToTab('planning')", 'Mon planning'], ['relire', 'setLessonStep(0)', 'Revoir la vidéo'], ['restart', 'recommencerLecon()', 'Recommencer']]);
  assert.ok(video.includes('<div class="bravo-tools" role="group" aria-label="Autres actions">') && !video.includes('bravo-go'), 'trois tuiles, pas de « Retour à l’accueil »');
  const ecrite = bilan({session: SEANCE, video: false}).bravoActionsHtml({id: 57});
  assert.deepEqual(tiles(ecrite).map(t => t[2]), ['Mon planning', 'Relire le cours', 'Recommencer'], 'leçon écrite : « Relire le cours »');
  assert.ok(ecrite.includes('<span class="bi"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A1.5'), 'avec le livre');
  assert.deepEqual(tiles(bilan({session: SEANCE, plan: false}).bravoActionsHtml({id: 70})).map(t => t[0]), ['relire', 'restart'], 'sans planning : deux tuiles');
  const fini = bilan({session: null}).bravoActionsHtml({id: 70});
  assert.ok(fini.indexOf('class="bravo-go" onclick="exitLessonToTab(\'learn\')">Retour à l’accueil</button>') < fini.indexOf('bravo-tools'), 'parcours terminé : « Retour à l’accueil » d’abord');
  /* Même icône que l’onglet Planning */
  assert.ok(html.includes('<rect x="7" y="12.5" width="4" height="3" rx="1" fill="currentColor"/></svg><span class="tab-label">Planning</span>') && cut('const BRAVO_ICO={', 'function bravoActionsHtml(l){').includes('<rect x="7" y="12.5" width="4" height="3" rx="1" fill="currentColor"/>'));
  /* Des colonnes égales, jamais plus étroites que « Recommencer » ; la tuile s’enfonce, son icône aussi */
  for (const part of [
    'html.lq #scr-lesson .bravo-tools{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(min-content,1fr);gap:8px}',
    'html.lq #scr-lesson .bravo-tool:active{transform:translateY(4px);box-shadow:0 0 0 var(--lip)}',
    'html.lq #scr-lesson .bravo-tool:active .bi{transform:scale(.9)}',
    'html.lq #scr-lesson .bravo-tool.restart:active .bi svg{transform:rotate(-50deg)}'])
    assert.ok(lq.includes(part), part);
  assert.ok(html.includes('.bravo-next-btn,.bravo-done-note,.bravo-recap,.bravo-spark,.bravo-unlock,.bravo-tool{animation:none!important;opacity:1;transform:none}'), 'mouvements réduits : elles arrivent sans glisser');
  /* Elisa, 26 octobre, 9 h 45 : « Il y a beaucoup d’espace en bas ». Le bilan n’a pas de barre du bas : plus de réserve de 96 px
     (celle de la barre des autres étapes) sous les tuiles, 16 px suffisent (plus les 9 px et la zone du bas de l’écran de la leçon). */
  assert.ok(html.includes('#lesson-body .ls-main.bravo-wrap{padding-bottom:16px}'), 'le bilan finit juste sous les tuiles');
  assert.ok(html.includes('.ls-main{padding-bottom:calc(var(--ls-nav-h) + 12px)}') && html.includes('#scr-lesson.screen{padding-bottom:calc(var(--safe-bottom) + 9px + var(--kbar-offset));'), 'les autres étapes gardent la place de leur barre');
  for (const [name, src] of [['index.html', html], ['ludique.css', lq], ['design-premium.css', premium]])
    assert.ok(!/bravo-sec|bravo-row|bn-arrow|bravoArrow|bravo-actions-stack|bravo-unlock-row|Mon parcours<\/button>/.test(src), `${name} : plus d’anciens boutons`);
});

test('la carte mémo débloquée : sa ligne, avant la suite du parcours ; son titre tient dans la carte', () => {
  const ctx = bilan({session: SEANCE, card: true});
  const row = ctx.bravoUnlockHtml({id: 56});
  assert.ok(row.startsWith('<div class="bravo-unlock">') && row.includes('class="bravo-gcard"') && row.includes('onclick="bravoRevealCard(56,event)"'));
  assert.ok(row.includes('<div class="bravo-unlock-copy"><small>Carte débloquée</small><b>Touche-la pour la retourner</b><p>L’essentiel de la leçon, rangé dans tes cartes mémo.</p></div>'));
  assert.equal(bilan({session: SEANCE}).bravoUnlockHtml({id: 70}), '', 'pas de carte, pas de ligne');
  assert.ok(!ctx.bravoActionsHtml({id: 56}).includes('bravo-gcard'), 'la carte n’est plus mêlée aux boutons');
  const slide = cut('function renderBravoSlide(l){', '/* ---------- Blocs de cours enrichis');
  const order = ['${bravoRecapHtml(l)}', '${bravoUnlockHtml(l)}', '${bravoNextHtml(l)}', '${bravoActionsHtml(l)}'].map(s => slide.indexOf(s));
  assert.ok(order.every((v, i) => v > 0 && (!i || v > order[i - 1])), 'récapitulatif, carte, suite du parcours, autres actions');
  /* « Normalisation » débordait de la carte : le titre rétrécit jusqu’à tenir dans sa largeur. */
  const fit = vm.createContext({getComputedStyle: e => ({fontSize: e.style.fontSize || '16.4px'})});
  vm.runInContext(cut('function bravoFitCard(card){', 'function revealBravoCard(){'), fit);
  const gk = {style: {fontSize: ''}, clientWidth: 110, get scrollWidth() { const f = parseFloat(this.style.fontSize || '16.4'); return Math.max(110, 13 * (0.6 * f - 0.6)); }};
  fit.bravoFitCard({querySelector: () => gk});
  const f = parseFloat(gk.style.fontSize);
  assert.ok(f <= 15.1 && f >= 14.5, `taille du titre : ${f}`);
  assert.ok(cut('function revealBravoCard(){', 'function bravoRecapHtml(l){').includes('bravoFitCard(card);\n  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>bravoFitCard(card));'), 'refait une fois les polices chargées');
});

test('« Recommencer cette leçon ? » : une feuille dans le style de l’app, plus la boîte du navigateur', async () => {
  const rec = cut('async function recommencerLecon(){', 'function bravoStatsHtml(');
  assert.ok(!rec.includes('confirm('), 'plus de confirm()');
  assert.ok(rec.includes("const oui=await lqAsk({ico:BRAVO_ICO.restart,titre:'Recommencer cette leçon\\u00a0?',") && rec.includes("texte:current.leconSeule?'La vidéo interactive sera à refaire.':'L’exercice et le quiz seront à refaire.',oui:'Recommencer',non:'Annuler'});"));
  assert.ok(rec.includes("if(!oui||!current||current.id!==id||mode!=='lesson')return;"), 'annulé, ou leçon quittée entre-temps : rien ne change');
  /* lqAsk joué avec un DOM simulé */
  const run = async act => {
    const btn = {}, cls = new Set();
    let key = null, focused = null, removed = false, html = '';
    const el = {
      set innerHTML(h) { html = h; for (const c of ['lq-ask-back', 'lq-ask-non', 'lq-ask-oui']) btn[c] = {onclick: null, focus() { focused = c; }}; },
      classList: {add: c => cls.add(c), remove: c => cls.delete(c)},
      querySelector: s => btn[s.slice(1)], querySelectorAll: () => [btn['lq-ask-oui'], btn['lq-ask-non']], remove() { removed = true; }
    };
    const ctx = vm.createContext({
      document: {getElementById: () => null, createElement: () => el, body: {appendChild() {}}, addEventListener: (t, f) => { key = f; }, removeEventListener() {}, activeElement: null},
      requestAnimationFrame: f => f(), setTimeout: f => f(), prefersReduceMotion: () => false, navigator: {},
      esc: s => String(s), escAttr: s => String(s)
    });
    vm.runInContext(cut('function lqAsk(o){', '/* ---------- Rendu : assistant'), ctx);
    const p = ctx.lqAsk({ico: '<svg></svg>', titre: 'Recommencer cette leçon ?', texte: 'La vidéo interactive sera à refaire.', oui: 'Recommencer', non: 'Annuler'});
    assert.ok(cls.has('on') && focused === 'lq-ask-non', 'la feuille monte, le doigt sur « Annuler »');
    act(btn, key);
    const v = await p;
    assert.ok(removed && cls.has('off'), 'puis elle redescend');
    return {v, html};
  };
  const oui = await run(b => b['lq-ask-oui'].onclick());
  assert.equal(oui.v, true, '« Recommencer » confirme');
  assert.ok(oui.html.includes('role="alertdialog" aria-modal="true" aria-labelledby="lq-ask-t" aria-describedby="lq-ask-p"'));
  assert.ok(oui.html.includes('<h2 id="lq-ask-t">Recommencer cette leçon ?</h2>') && oui.html.includes('<p id="lq-ask-p">La vidéo interactive sera à refaire.</p>'));
  assert.ok(oui.html.includes('<button type="button" class="lq-btn lq-ask-oui">Recommencer</button><button type="button" class="lq-btn-2 lq-ask-non">Annuler</button>'), 'les boutons de l’app');
  assert.equal((await run(b => b['lq-ask-non'].onclick())).v, false, '« Annuler »');
  assert.equal((await run(b => b['lq-ask-back'].onclick())).v, false, 'toucher le fond');
  assert.equal((await run((b, key) => key({key: 'Escape', preventDefault() {}, stopPropagation() {}}))).v, false, 'Échap');
  for (const part of ['html.lq .lq-ask{position:fixed;inset:0;z-index:2600;', 'margin:0 0 calc(8px + env(safe-area-inset-bottom,0px));',
    'html.lq .lq-ask.on .lq-ask-sheet{transform:none}', 'html[data-motion="reduce"] .lq-ask-back,html[data-motion="reduce"] .lq-ask-sheet{transition:none!important}'])
    assert.ok(lq.includes(part), part);
});

test('le tout dernier cours : le bilan mène à la pratique (Elisa, 27 octobre, 1 h 13 : « emmener voir la partie pratique »)', () => {
  const ctx = bilan({session: SEANCE});
  ctx.MODULES = [{lessons: [{id: 1}, {id: 2}]}, {lessons: [{id: 50}]}];
  ctx.CHALLENGES = Array.from({length: 25}, (_, i) => ({id: 'd' + i}));
  const fin = ctx.bravoNextHtml({id: 50});
  assert.ok(fin.startsWith('<button type="button" class="bravo-next-btn" onclick="exitLessonToTab(\'practice\')">'), 'toute la carte mène à l’onglet Pratiquer');
  assert.ok(fin.includes('<b>Place à la pratique</b>') && fin.includes('25 défis concrets et la console SQL t’attendent.') && fin.includes('</span>Pratiquer</span>'));
  assert.ok(ctx.bravoNextHtml({id: 2}).includes('onclick="openItem(45)"'), 'les autres cours : la suite du parcours, comme avant');
  assert.ok(html.includes('${bravoNextHtml(l)}'), 'le bilan passe la leçon');
  /* Le lecteur lit la fin du bouton « Ajouter à mes notes » sur la page de l’animation */
  assert.ok(html.includes('until=I&&I.notesUntil!=null?I.notesUntil:N.cfg.until'));
  assert.ok(fs.readFileSync(path.join(root, 'assets/anim/core.js'), 'utf8').includes('notesUntil: cfg.notesUntil != null ? unwarp(cfg.notesUntil) : null'));
});

/* Elisa, 27 octobre, 10 h 11 : « quand il n’y en a plus, mettre bravo tu as complété le parcours avec des animations et confettis ». */
test('plus rien à faire : « Bravo, tu as complété le parcours », avec ce que tu as fait, « Découvrir les défis », animations et confettis', () => {
  const ctx = bilan({session: null});
  ctx.MODULES = [{lessons: [{id: 1}, {id: 2}]}, {lessons: [{id: 50}]}];
  ctx.allLessons = [{id: 1}, {id: 2}, {id: 50}];
  ctx.itemDone = () => true;
  ctx.SQL_REQUETES = 210;
  const fin = ctx.bravoNextHtml({id: 50});
  assert.ok(fin.startsWith('<div class="bravo-fin" role="group" aria-labelledby="bravo-fin-h">'), 'la carte de fin, même après le tout dernier cours');
  assert.ok(fin.includes('<span class="bravo-fin-cup">🏆</span>') && (fin.match(/class="bf-s s\d"/g) || []).length === 4, 'la coupe et ses étincelles');
  assert.ok(fin.includes('<span class="bravo-fin-tag">🎓 Parcours terminé</span>') && fin.includes('<h2 id="bravo-fin-h">Bravo, tu as complété le parcours&nbsp;!</h2>'));
  assert.deepEqual([...fin.matchAll(/<span><b data-n="(\d+)">\d+<\/b>([^<]+)<\/span>/g)].map(m => [+m[1], m[2]]), [[2, 'modules'], [3, 'cours'], [210, 'requêtes']], 'ce que tu as fait');
  assert.ok(fin.includes('<button type="button" class="bravo-fin-go" onclick="exitLessonToTab(\'practice\')"><span class="fl" aria-hidden="true">⚑</span>Découvrir les défis</button>'));
  ctx.itemDone = id => id !== 50;
  assert.ok(!ctx.bravoNextHtml({id: 2}).includes('requêtes'), 'un parcours planifié sans tous les cours : pas les 210 requêtes de tous les cours');
  assert.ok(cut('function renderLessonFlow(){', '/* ---------- Requête à trous').includes('requestAnimationFrame(bravoFinWire);'), 'branchée à l’affichage du bilan');
  const wire = cut('function bravoFinWire(){', '/* Les autres actions');
  for (const part of ["el.classList.add('is-in');", "lvFinCount(el,'.bravo-fin-stats b',650);", 'lqConfetti({n:70})', 'lqConfetti({n:46})', "LvSfx.play('success',0,.6,0)", 'navigator.vibrate([12,40,12,40,24])', 'new IntersectionObserver('])
    assert.ok(wire.includes(part), part);
  assert.ok(wire.indexOf("if(prefersReduceMotion()){ el.classList.add('is-in'); return; }") < wire.indexOf('lqConfetti('), 'mouvement réduit : la carte est là, sans confettis');
  for (const part of ['.bravo-fin.is-in>.bravo-fin-medal{animation:bfPop', '.bravo-fin.is-in .bravo-fin-cup{animation:bfBob', '.bravo-fin.is-in .bf-s{animation:bfTwinkle', 'animation:bfSpin 16s linear infinite'])
    assert.ok(html.includes(part), part);
  assert.ok(!html.includes('bravo-done-note"><span'), 'plus l’ancienne note « Parcours terminé »');
});
