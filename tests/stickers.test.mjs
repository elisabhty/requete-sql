/* Stickers : gagnés en avançant (un par module terminé, un par accomplissement, la même liste que dans Mon compte),
   collés sur un tableau, téléchargés en PNG détouré. On vérifie la sauvegarde, les règles de gain, les dessins, le
   tableau (bords, rotation), le câblage de l’écran, le bilan d’une leçon, le toast et le téléchargement. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const premium = fs.readFileSync(new URL('../design-premium.js', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const block = take('   8bis. STICKERS', '   9. PLANNING');
const fn = name => take(`function ${name}(`, '\n}\n') + '\n}\n';

test('sauvegarde : state.stickers est gardé et nettoyé', () => {
  const ctx = vm.createContext({});
  vm.runInContext(take('function normalizeState(', 'function normalize('), ctx);
  const st = ctx.normalizeState({ stickers: {
    got: { jointures: 1700000000000, intro: 1, 'MAUVAIS!': 5, lire: -3, x: 9 },
    fresh: { jointures: 1, lire: 1 },
    board: [{ id: 'jointures', x: 1.4, y: -1, r: 400, s: 9 }, { id: 'jointures', x: .2 }, { id: 'lire', x: .5, y: .5 }, null, { id: 'intro', x: 'a', y: .3, r: -20, s: .7 }],
    since: 1700000000000
  } });
  assert.equal(JSON.stringify(st.stickers), JSON.stringify({
    got: { jointures: 1700000000000, intro: 1 },
    fresh: { jointures: 1 },
    board: [{ id: 'jointures', x: 1, y: 0, r: 180, s: 2 }, { id: 'intro', x: .5, y: .3, r: -20, s: .7 }],
    since: 1700000000000
  }), 'ids valides, dates positives, « nouveau » et tableau seulement pour les gagnés, sans doublon, valeurs bornées');
  assert.equal(JSON.stringify(ctx.normalizeState({}).stickers), '{"got":{},"fresh":{},"board":[],"since":0}');
});

/* Monde simulé : 3 modules, des leçons validées à la main, une série et des défis réglables. */
function world() {
  const done = new Set();
  const ctx = vm.createContext({
    MODULES: [{ titre: 'Introduction', lessons: [{ id: 0 }] }, { titre: 'Lire une table', lessons: [{ id: 2 }, { id: 13 }] }, { titre: 'Fonctions et expressions', lessons: [{ id: 51 }] }],
    itemDone: id => done.has(id),
    streak: 0, record: 0, defis: 0, saves: 0, clock: 5000,
    state: {},
    Date: { now: () => ctx.clock },
  });
  ctx.compteStats = () => ({ lessons: done.size, defis: ctx.defis, streak: ctx.streak });
  ctx.streakRecord = () => ctx.record;
  ctx.progressContinuer = () => ({ done: done.size });
  ctx.save = () => { ctx.saves++; };
  vm.runInContext(take('const STK_INK=', '/* ---------- Rendu à l’écran ---------- */'), ctx);
  return { ctx, done, run: src => vm.runInContext(src, ctx) };
}

test('gagner : un sticker par module terminé et par accomplissement ; une fois gagné, il le reste', () => {
  const w = world();
  assert.deepEqual([...w.run('stkSync()')], [], 'rien de mérité au départ');
  assert.equal(w.ctx.state.stickers.since, 5000, 'première mise en route datée');
  w.done.add(0); w.ctx.clock = 9000;
  assert.deepEqual([...w.run('stkSync()')], ['intro', 'requete'], 'premier module et première activité');
  assert.equal(w.ctx.state.stickers.got.intro, 9000, 'gagné maintenant : daté');
  assert.deepEqual(Object.keys(w.ctx.state.stickers.fresh), ['intro', 'requete'], 'marqués « Nouveau »');
  w.done.add(2);
  assert.deepEqual([...w.run('stkSync()')], [], 'module à moitié fait : pas encore');
  w.done.add(13);
  assert.deepEqual([...w.run('stkSync()')], ['lire']);
  w.ctx.streak = 1; w.ctx.record = 3;
  assert.deepEqual([...w.run('stkSync()')], ['serie3'], 'une série compte dès que le record l’atteint, même arrêtée');
  w.ctx.defis = 10;
  assert.deepEqual([...w.run('stkSync()')], ['defis10']);
  w.done.delete(0);
  assert.deepEqual([...w.run('stkSync()')], [], 'jamais repris');
  assert.ok(w.ctx.state.stickers.got.intro, 'toujours gagné');
  w.done.add(0); w.done.add(51);
  assert.deepEqual([...w.run('stkSync()')], ['fonctions', 'parcours'], 'tous les modules : parcours terminé');
});

test('première mise en route : ce qui était déjà mérité est gagné sans date (« gagné avant l’arrivée des stickers »)', () => {
  const w = world();
  w.done.add(0);
  assert.deepEqual([...w.run('stkSync()')], ['intro', 'requete']);
  assert.equal(w.ctx.state.stickers.got.intro, 1, 'sans date');
  assert.ok(block.includes("s.got>1?`Gagné le ${") && block.includes("'Module terminé':'Accomplissement atteint'"), 'la fiche n’invente pas de date');
});

test('accomplissements : une seule liste, pour Mon compte et pour les stickers', () => {
  const w = world();
  const acc = JSON.parse(w.run('JSON.stringify(accomplissements())'));
  assert.deepEqual(acc.map(a => a.label), ['Première requête', '10 leçons', 'Série de 3 jours', '10 défis', 'Série de 7 jours', 'Parcours terminé']);
  assert.deepEqual(acc.map(a => a.goal), [1, 10, 3, 10, 7, 3], 'parcours : tous les modules');
  const account = take('function renderCompte(){', 'function openLegal(');
  assert.ok(account.includes('accomplissements().map(') && account.includes("stkArtHtml(b.id,b.unlocked?'art':'lock')") && account.includes("onclick=\"openStickers('${b.id}')\""), 'Mon compte montre le sticker de chaque accomplissement et ouvre sa fiche');
  assert.ok(account.includes('!!stkGot[a.id]||a.ok'), 'un accomplissement gagné reste débloqué');
  assert.ok(account.includes(`<li class="acct-badges-more"><button type="button" onclick="switchTab('stickers')">Voir mes stickers\${CHEV}</button></li>`), 'un lien vers l’espace Stickers sous les accomplissements');
  assert.ok(!account.includes('BADGE_ICONS') && !css.includes('.acct-badge-ico'), 'plus d’anciens pictogrammes');
});

test('dessins : un par module, dans l’ordre de MODULES, et un par accomplissement ; les plus rares en holo', () => {
  const titles = [...take('const MODULES = [', 'let state=').matchAll(/^\{ titre:"([^"]+)"/gm)].map(m => m[1]);
  assert.deepEqual(titles, ['Introduction', 'Lire une table', 'Fonctions et expressions', 'Agrégats et regroupements', 'Jointures', 'Sous-requêtes et ensembles', 'Fonctions de fenêtre', 'Modéliser', 'Créer et faire évoluer les tables', 'Écrire et modifier les données', 'Contraintes et intégrité', 'Transactions', 'Triggers et concurrence', 'Vues, index et optimisation', 'Sécurité et droits'], 'un module ajouté ou déplacé demande son sticker');
  const ctx = vm.createContext({});
  vm.runInContext(take('const STK_INK=', 'const STK_B=') + take('const STK_MODULE_IDS=', 'function accomplissements('), ctx);
  const ids = vm.runInContext('STK_MODULE_IDS', ctx), art = vm.runInContext('Object.keys(STK_ART)', ctx);
  assert.equal(ids.length, 15);
  assert.equal(new Set(ids).size, 15);
  assert.deepEqual([...art].sort(), [...ids, 'requete', 'lecons10', 'serie3', 'defis10', 'serie7', 'parcours'].sort(), 'chaque sticker a son dessin, aucun en trop');
  assert.deepEqual(Object.keys(vm.runInContext('STK_HOLO', ctx)), ['defis10', 'serie7', 'parcours']);
});

test('rendu : chaque dessin se trace (silhouette de découpe, puis couleurs), le bord blanc suit la silhouette', () => {
  const calls = [];
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push(k)), set: (t, k, v) => { t[k] = v; if (k === 'lineWidth') calls.push('lw:' + v); return true; } });
  const ctx = vm.createContext({ Path2D: class { constructor(d) { this.d = d; } } });
  vm.runInContext(take('const STK_INK=', '/* Dans l’ordre de MODULES'), ctx);
  for (const id of vm.runInContext('Object.keys(STK_ART)', ctx)) {
    calls.length = 0;
    ctx.c = ctx2d; vm.runInContext(`stkDraw(c,${JSON.stringify(id)},400,'art')`, ctx);
    assert.ok(calls.includes('fill') && calls.includes('stroke'), `${id} : tracé`);
    assert.ok(calls.some(c => /^lw:1[6-9]|^lw:2\d/.test(c)), `${id} : bord de découpe (deux fois 8 de marge)`);
  }
  assert.ok(block.includes("if(mode==='lock')one('#DCD5F2',STK_B);") && block.includes("one('#CBC2EC',STK_B);one('#EEEAFB',STK_B-1.6)"), 'silhouette à gagner, découpe vide quand il est sur le tableau');
});

test('tableau : le sticker, même tourné, reste sur le tableau ; la rotation s’aimante à l’horizontale', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fn('stkClampPos') + fn('stkAngle'), ctx);
  const [x, y] = vm.runInContext('stkClampPos(0,1,1,{width:400,height:300})', ctx);
  assert.ok(Math.abs(x - .13) < 1e-9 && Math.abs(y - (1 - .13 * 4 / 3)) < 1e-9, 'droit : la moitié de sa largeur');
  const [x2] = vm.runInContext('stkClampPos(0,.5,1,{width:400,height:300},45)', ctx);
  assert.ok(Math.abs(x2 - .13 * Math.SQRT2) < 1e-9, 'tourné de 45° : la moitié de sa diagonale');
  const [x3, y3] = vm.runInContext('stkClampPos(.1,.9,2,{width:400,height:200},45)', ctx);
  assert.ok(Math.abs(x3 - .26 * Math.SQRT2) < 1e-9 && y3 === .5, 'plus haut que le tableau : centré en hauteur');
  assert.equal(vm.runInContext('stkAngle(3)', ctx), 0);
  assert.equal(vm.runInContext('stkAngle(-190)', ctx), 170);
  assert.equal(vm.runInContext('stkAngle(12.34)', ctx), 12.3);
});

test('écran : une rubrique de la Bibliothèque, avec son entrée, sa fiche et son retour', () => {
  assert.ok(html.includes('<section id="scr-stickers" class="screen">') && html.includes('<h1>Stickers</h1>') && html.includes('Gagne-les en avançant, colle-les où tu veux et imprime-les.'));
  assert.equal((html.match(/stickers:'scr-stickers'/g) || []).length, 2, 'connu de switchTab et de screenForTab');
  assert.ok(html.includes("if(['notes','collection','stickers','entretien','sgbd','library'].includes(tab))return 'library';"), 'onglet Bibliothèque allumé');
  assert.ok(html.includes("else if(tab==='stickers') renderStickers();"));
  assert.ok(html.includes('stkHubEntry(),') && html.includes("Colle-les, imprime-les.`,\"switchTab('stickers')\""), 'entrée de la Bibliothèque, après les cartes mémo');
  assert.ok(html.includes('<em class="journey-new">${fresh} nouveau${fresh>1?\'x\':\'\'}</em>'), 'les nouveaux pas encore vus');
  assert.ok(html.includes("if(activeTab==='stickers'&&name!=='stickers'){stkClose();stkSeen();}"), 'en quittant l’écran, les nouveaux ont été vus');
  assert.ok(html.includes('<div class="viz" id="stk-sheet" role="dialog" aria-modal="true" aria-labelledby="stk-name">'));
  assert.ok(html.includes("if(document.getElementById('stk-sheet')?.classList.contains('on')){stkClose();return;}"), 'Échap ferme la fiche');
  assert.ok(premium.includes("'scr-stickers':1"), 'arrive par la droite, comme les autres rubriques');
  assert.ok(html.includes("if(e.target.closest&&e.target.closest('.stk-board'))return;"), 'le retour par glissement du bord laisse le tableau au doigt');
  assert.ok(html.includes('aria-describedby="stk-kbd"') && block.includes("case '[':") && block.includes("case 'Delete':"), 'au clavier : déplacer, tourner, agrandir, décoller');
});

test('gestes : au doigt par les événements tactiles (le défilement est bloqué dès le premier mouvement), à la souris par les pointeurs', () => {
  assert.ok(block.includes("board.addEventListener('touchmove',e=>{\n    if(!stkG)return;\n    if(e.cancelable)e.preventDefault();"), 'déplacer un sticker ne fait pas défiler la page');
  assert.ok(block.includes('function stkGAdd(') && block.includes("kind:'pinch'"), 'pincer : tourner et agrandir');
  assert.ok(block.includes("P.timer=setTimeout(()=>{if(stkPeel===P&&!P.on){stkPeelStart(P);buzz('medium');}},320);"), 'sur la planche, un appui long décolle le sticker');
  assert.ok(block.includes("if(Math.hypot(P.x-P.x0,P.y-P.y0)>10){clearTimeout(P.timer);stkPeel=null;}"), 'un glisser franc reste un défilement');
  assert.ok(block.includes("if((STK_TACTILE&&e.pointerType!=='mouse')||e.button!==0)return;"), 'la souris passe par les pointeurs');
  assert.ok(css.includes('html.lq .stk-item{') && /\.stk-item\{[^}]*touch-action:none/.test(css) && /\.stk-board\{[^}]*touch-action:pan-y/.test(css), 'tableau vide : la page défile ; sur un sticker : non');
});

test('gagner pendant une leçon : son bilan le montre ; ailleurs, un toast', () => {
  assert.ok(take('function noteActivityDay(', '\n}\n').includes('stkAfterProgress();'), 'après chaque avancée');
  assert.ok(take('async function boot(', 'function initSpotlight(').includes('stkSync();'), 'au démarrage, ce qui est déjà mérité');
  assert.ok(take('function renderBravoSlide(', '\n}\n').includes('${stkBravoHtml()}'), 'bilan de la leçon');
  assert.ok(take('function openLesson(', '\n}\n').includes('stkLeaveLesson();') && take('function leaveLessonScreen(', '\n}\n').includes('stkLeaveLesson();'), 'en quittant la leçon avant son bilan, un toast');
  assert.ok(block.includes("if(mode==='lesson'&&document.body.classList.contains('in-lesson')){stkLessonNew.push(...won);return;}"));
  assert.ok(block.includes("if(t.classList.contains('on')&&tries<6)"), 'le toast attend que le précédent soit parti');
  assert.ok(block.includes("k.textContent='Nouveau sticker'") && block.includes("'Ajouté à ta planche','Voir',()=>openStickers(items[0].id)"));
});

test('télécharger : PNG détouré, partagé sur téléphone (Photos, Fichiers, imprimante), téléchargé sur ordinateur', () => {
  const save = take('async function saveFile(', '\n}\n');
  assert.ok(save.includes('navigator.canShare({files:[file]})') && save.includes("return 'share';") && save.includes("a.download=fileName;") && save.includes("return 'download';"));
  assert.ok(take('async function exportProgress(', '\n}\n').includes("await saveFile(new Blob("), 'la progression passe par le même chemin');
  const dl = take('async function stkDownload(', '\n}\n');
  assert.ok(dl.includes("stkDraw(cv.getContext('2d'),id,1200,'art')") && dl.includes('stkBlob(stkTrim(cv,12))') && dl.includes('`requete-sticker-${stkSlug(s.name)}.png`'));
  assert.ok(!dl.slice(0, dl.indexOf('await saveFile')).includes('await'), 'aucune attente avant la feuille de partage (Safari exige le geste)');
  assert.ok(take('function stkBlob(', '\n}\n').includes("cv.toDataURL('image/png')"), 'image produite sans attente');
  assert.ok(take('async function stkExportBoard(', '\n}\n').includes("'requete-stickers.png'"), 'le tableau entier, sans le fond');
  const ctx = vm.createContext({});
  vm.runInContext(fn('stkSlug'), ctx);
  assert.equal(vm.runInContext("stkSlug('Écrire et modifier les données')", ctx), 'ecrire-et-modifier-les-donnees');
});
