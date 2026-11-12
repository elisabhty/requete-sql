/* Elisa, 6 novembre, 15 h 20 : les cartes mémo, direction A du designer, « Scène à collectionner ». Une carte, deux faces, la même
   partout : l’album (Bibliothèque › Cartes mémo), la fiche, le bilan de la leçon (on la retourne pour lire son verso) et la récompense
   collée dans le coin du cours. Le numéro de collection (01 à 53) est le même partout, jusque dans l’annonce de déblocage. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const consts = app.slice(app.indexOf('const MEMO_LOCK_STK='), app.indexOf('/* Le numéro de collection (01 à 71)'));
/* 11 novembre, 17 h 20 : la liste des cartes (une leçon peut en donner deux), lue par le numéro, le recto, l’album et « Noter » */
const aide = app.slice(app.indexOf('let memoListeCache=null;'), app.indexOf('\n', app.indexOf('function memoArg(')) + 1);

function bac(extra = {}) {
  const CARTES = {4: {k: 'WHERE', t: 'Filtrer les lignes', points: ['Un.', 'Deux.', 'Trois.'], s: 'SELECT 1;', piege: 'Piège.'},
    5: {k: 'GROUP BY', t: 'Regrouper', points: ['Un.', 'Deux.', 'Trois.'], s: 'SELECT 2;', piege: 'Piège.'},
    9: {k: 'Ordre d’exécution', t: 'Dans quel ordre', points: ['Un.', 'Deux.', 'Trois.'], s: 'SELECT 3;', piege: 'Piège.'}};
  const ctx = vm.createContext(Object.assign({
    CARTES, CARTES_PLUS: {}, allLessons: [{id: 1, titre: 'Sans carte'}, {id: 4, titre: 'Filtrer avec WHERE'}, {id: 5, titre: 'Regrouper'}, {id: 9, titre: 'L’ordre d’exécution'}],
    MODULES: [{titre: 'Lire une table'}], moduleOf: () => 0, lastUnlockedId: null, state: {lessons: {}},
    unlocked: new Set([4, 5]), isUnlocked(id) { return this.unlocked.has(id); }, revisable: () => true, due: new Set(), isDue(id) { return this.due.has(id); },
    esc: s => String(s), escAttr: s => String(s), highlight: s => s, lqStkSvg: k => `<svg data-k="${k}"></svg>`, cardMemoPoints: () => []
  }, extra));
  vm.runInContext(consts + aide + ['memoSerial', 'memoKn', 'memoKw', 'memoFace', 'memoEtat', 'memoAlbumCard'].map(fn).join('\n'), ctx);
  vm.runInContext('isUnlocked=this.isUnlocked.bind(this);isDue=this.isDue.bind(this);', ctx);
  return ctx;
}

test('le numéro de collection : 01, 02, 03… dans l’ordre des leçons qui ont une carte', () => {
  const ctx = bac();
  assert.deepEqual([4, 5, 9].map(id => ctx.memoSerial(id)), ['01', '02', '03']);
  /* 11 novembre, 21 h 33 : plus d’annonce de déblocage, la carte arrive dans le bilan, avec son numéro */
  assert.ok(fn('bravoUnlockCarte').includes('n=memoSerial(e.cid)'), 'le bilan porte le même numéro');
  assert.ok(app.includes('<b id="card-sheet-title">Carte mémo</b>') && fn('closeCard').includes("t.textContent='Carte mémo';"), 'la fiche s’appelle « Carte mémo »');
});

test('l’album : à débloquer (le dos, son cadenas, la leçon), débloquée, nouvelle, à revoir, acquise', () => {
  const ctx = bac();
  const lock = ctx.memoAlbumCard({id: 9, titre: 'L’ordre d’exécution'});
  assert.ok(lock.startsWith('<button type="button" class="mc mc--album is-lock" onclick="openLesson(9)" aria-label="Carte 03 à débloquer avec la leçon L’ordre d’exécution. Ouvrir la leçon">'));
  assert.ok(lock.includes('<span class="mc-back"><span class="mc-top"><b class="mc-num">03</b></span><span class="mc-lock"><svg') && lock.includes('</span><span class="mc-lesson" style="--kn:11">L’ordre d’exécution</span></span></button>') && !lock.includes('mc-go'), '10 novembre : plus de « Voir la leçon » sur la carte');
  const open = ctx.memoAlbumCard({id: 4});
  assert.ok(open.startsWith('<button type="button" class="mc mc--album" onclick="openCard(4)" aria-label="Carte 01, WHERE : Filtrer les lignes">'));
  assert.ok(open.includes('<span class="mc-face"><span class="mc-top"><b class="mc-num">01</b></span><b class="mc-k" style="--kn:5">WHERE</b><span class="mc-t">Filtrer les lignes</span></span>'));
  ctx.lastUnlockedId = 4;
  const neuve = ctx.memoAlbumCard({id: 4});
  assert.ok(neuve.includes('class="mc mc--album is-new"') && neuve.includes('<span class="mc-flag is-new" aria-hidden="true">Nouvelle</span>') && neuve.includes('<i class="mc-shine" aria-hidden="true"></i>') && neuve.includes('. Nouvelle">'));
  ctx.lastUnlockedId = null; ctx.due.add(5);
  const due = ctx.memoAlbumCard({id: 5});
  assert.ok(due.includes('class="mc mc--album is-due"') && due.includes('À revoir</span>') && due.includes('. À revoir">'));
  ctx.due.clear(); ctx.state.lessons[5] = {level: 2};
  const ok = ctx.memoAlbumCard({id: 5});
  assert.ok(ok.includes('class="mc mc--album is-ok"') && ok.includes('<span class="mc-ok" aria-hidden="true"><svg') && ok.includes('. Acquise">'));
  assert.ok(ok.includes('<b class="mc-k" style="--kn:8">GROUP BY</b>'), 'GROUP BY ne se coupe pas');
  const coll = fn('renderCollection');
  assert.ok(coll.includes('const cards=items.map(x=>memoAlbumCard(x.l,x.cid)).join(\'\');') && app.includes('coll-grid mc-grid'), 'l’album pose les nouvelles cartes (chaque carte de la leçon, 11 novembre)');
});

test('le bilan : la carte gagnée se retourne sur place ; la face cachée est inerte, le focus suit, sans animation si on le demande', () => {
  const flip = fn('memoFlip');
  for (const part of ["root.classList.toggle('is-flipped',toVerso);", "r.toggleAttribute('inert',toVerso); r.setAttribute('aria-hidden',String(toVerso));",
    "v.toggleAttribute('inert',!toVerso); v.setAttribute('aria-hidden',String(!toVerso));", "const f=toVerso?v.querySelector('[data-focus]'):r;", 'setTimeout(go,still?40:420);'])
    assert.ok(flip.includes(part), part);
  assert.ok(fn('memoFlipFit').includes("box.style.setProperty('--mc-h',face.offsetHeight+'px');"), 'la boîte prend la hauteur de la face visible');
  const reveal = fn('revealBravoUne');   // 11 novembre : chaque carte du bilan arrive à son tour (revealBravoCard)
  assert.ok(reveal.includes("if(!root.classList.contains('is-new')||prefersReduceMotion()){root.classList.add('is-in');return;}"), 'l’arrivée, une seule fois, et pas en mouvement réduit');
  assert.ok(reveal.includes('new IntersectionObserver('), 'quand le bloc entre à l’écran');
  assert.ok(fn('renderBravoSlide').includes("${typeof CARTES!=='undefined'&&CARTES[l.id]?'':bravoRecapHtml(l)}"), 'le verso tient lieu de « Ce que tu retiens »');
  for (const part of ['html.lq .mc-flip>.mc-side{grid-area:1/1;-webkit-backface-visibility:hidden;backface-visibility:hidden;', 'html.lq .mc-flip.is-flipped>.is-verso{transform:none;visibility:visible}',
    'html.lq .mc-reveal.is-in .mc-flip{animation:mcDeal .8s var(--pop) both}', 'html.lq .is-flipped .mc-seal{opacity:0;scale:.6}'])
    assert.ok(css.includes(part), part);
});

test('la récompense dans le cours, et « Noter » : le numéro et le mot-clé de la carte, sa syntaxe, ses trois points', () => {
  assert.ok(app.includes('<div class="lesson-rich lv-lesson lv-hero${prize?\' has-prize\':\'\'}">${prize}'));
  const ctx = bac({document: {createElement: () => { const d = {set innerHTML(v) { this.textContent = v.replace(/<[^>]+>/g, ''); }}; return d; }}, noteTextFromHtml: () => ''});
  vm.runInContext(fn('cardNotePre'), ctx);
  ctx.CARTES[4].points = ['<code>WHERE</code> filtre.', 'Deux.', 'Trois.'];
  const pre = ctx.cardNotePre(4);
  assert.equal(pre.ctx, 'Carte 01 · WHERE');
  assert.equal(pre.sql, 'SELECT 1;');
  assert.equal(pre.txt, '• WHERE filtre.\n• Deux.\n• Trois.');
});

test('Texte plus grand, petits écrans : le mot-clé s’ajuste à la carte, la syntaxe ne défile pas', () => {
  assert.ok(css.includes('html.lq[data-reading="large"]{--mc-fs:1.15}'));
  /* 7 novembre, 8 h 17 : la taille suit l’écran (vw) et non plus la carte (cqi), que Safari mesurait trop tôt (retours-0817) */
  assert.ok(css.includes('@media (max-width:350px){html.lq .mc--album{--mc-w:calc(50vw - 44px)}}') && !css.includes('.mc-go'), '10 novembre : l’album suit l’écran (retours-0850-cartes), plus de « Voir la leçon »');
  assert.ok(css.includes('container-type:inline-size') && css.includes('font-size:min(calc(14px * var(--mc-fs)),calc((100cqi - 30px) / 18.3))'), 'la syntaxe : 30 signes par ligne, sans défilement');
});
