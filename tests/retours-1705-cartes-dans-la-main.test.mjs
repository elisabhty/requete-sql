// Le bilan de la leçon (Elisa, 12 novembre, 17 h 05, sa capture : « Est-ce possible de les mettre dans des mains (style emoji) car là
// ça fait trop redondant titre + carte (animation / 2 cartes dans une main ou deux mains à retourner) ») : un seul bloc, un seul
// titre, les cartes en éventail dans une main jaune ; on en tire une pour la retourner, « Recto » la remet dans la main.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), css = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

function bilan({cartes, neuve = true}) {
  const ctx = vm.createContext({lastUnlockedId: neuve ? 1 : 0, TOTAL_CARTES: 72, MEMO_TURN_SVG: '<svg></svg>',
    memoDeLecon: () => cartes.map((c, i) => ({cid: 'c' + i, lid: 1, c})), memoCartes: () => cartes.map((c, i) => ({cid: 'c' + i, lid: 1, c})),
    isUnlocked: () => true, memoSerial: id => '0' + (+id.slice(1) + 1), memoFace: id => `<span class="mc-face">${id}</span>`, memoVerso: id => `<h3 data-focus>${id}</h3>`,
    escAttr: s => String(s), chatBonusHtml: k => `<img data-chat="${k}">`});
  vm.runInContext(cut('function bravoUnlockHtml(l){', '/* Retourner : la face cachée') + ';this.html=bravoUnlockHtml({id:1});', ctx);
  return ctx.html;
}
const A = {k: 'Base relationnelle', t: 'Tables, clés et SELECT'}, B = {k: 'Types de données', t: 'Ce qu’une colonne peut contenir'};

test('deux cartes : une seule section, un seul titre, une seule main', () => {
  const h = bilan({cartes: [A, B]});
  assert.equal((h.match(/<section /g) || []).length, 1);
  assert.equal((h.match(/<h2 /g) || []).length, 1, 'plus de « Ta deuxième carte mémo » au-dessus de la seconde');
  assert.ok(h.includes('<p class="bv-sec-k">Ta récompense</p>') && h.includes('Deux nouvelles cartes <em>mémo</em>&nbsp;!'));
  assert.ok(h.includes('<div class="mc-main a-2">'), 'l’éventail de deux cartes');
  assert.equal((h.match(/class="mc-flip" data-k="/g) || []).length, 2);
  assert.ok(h.indexOf('data-k="0"') < h.indexOf('data-k="1"') && h.indexOf('data-k="1"') < h.indexOf('class="mc-main-main"'), 'les cartes, puis la main posée dessus');
  assert.equal((h.match(/class="mc-main-main"/g) || []).length, 1);
  assert.equal((h.match(/class="mc-hint"/g) || []).length, 1);
  assert.ok(h.includes('<span class="when-recto">Touche une carte pour la retourner</span>'));
  assert.ok(h.includes('<b>1</b><small>sur 72</small>') && h.includes('<b>2</b><small>sur 72</small>'));
  assert.equal((h.match(/data-chat="carte"/g) || []).length, 1, 'le chat retourne sa carte une fois, à côté de la main');
  assert.ok(bilan({cartes: [A, B], neuve: false}).includes('Tes cartes <em>mémo</em>') && !bilan({cartes: [A, B], neuve: false}).includes('data-chat'));
});

test('une carte : la même main, « Touche la carte »', () => {
  const h = bilan({cartes: [A]});
  assert.ok(h.includes('<div class="mc-main a-1">') && h.includes('Nouvelle carte <em>mémo</em>&nbsp;!'));
  assert.ok(h.includes('<span class="when-recto">Touche la carte pour la retourner</span>'));
  assert.ok(h.includes('aria-label="Carte 01, Base relationnelle : Tables, clés et SELECT. Retourner la carte"'));
  assert.equal(bilan({cartes: []}), '');
  assert.ok(cut('function bravoUnlockCarte(l,e,k,nb){', '\n}').includes('${c.k}\\u00a0: ${c.t}'), 'l’espace insécable reste écrite en échappement dans le code');
});

test('la main : un dessin maison en décor, son ombre dans le dessin', () => {
  const svg = cut('const MEMO_MAIN_SVG=', '/* Retourner : la face cachée');
  assert.ok(svg.includes('<svg class="mc-main-main" viewBox="0 0 200 130" aria-hidden="true" focusable="false">'));
  assert.ok(svg.includes('transform="translate(0 6)"') && svg.includes('fill="url(#mcMainG)"'));
  const regle = css.slice(css.indexOf('html.lq .mc-main-main{'), css.indexOf('}', css.indexOf('html.lq .mc-main-main{')));
  assert.ok(regle.includes('pointer-events:none') && !/filter|drop-shadow/.test(regle), 'elle ne prend pas les touchers et n’a pas de filtre');
});

test('tirer une carte : elle seule se retourne, les autres sont hors d’atteinte, « Recto » la rend à la main', () => {
  const faire = (k, {cls = new Set()} = {}) => {
    const mk = () => { const c = new Set(), a = new Map();
      return {classList: {toggle: (n, on) => (on ? c.add(n) : c.delete(n)), contains: n => c.has(n)}, toggleAttribute: (n, on) => (on ? a.set(n, '') : a.delete(n)), setAttribute: (n, v) => a.set(n, v),
        hasAttribute: n => a.has(n), getAttribute: n => a.get(n), style: {setProperty() {}}, offsetHeight: 250, c, a}; };
    const root = mk(), boxes = [0, 1].map(() => { const b = mk(); b.r = mk(); b.v = mk(); b.v.querySelector = () => null; b.querySelector = s => (s === '.is-recto' ? b.r : b.v); b.closest = () => root; return b; });
    root.querySelectorAll = () => boxes;
    const ctx = vm.createContext({prefersReduceMotion: () => true, setTimeout: () => 0, navigator: {}});
    vm.runInContext(cut('function memoFlip(el,toVerso){', "addEventListener('resize'"), ctx);
    return {root, boxes, flip: (i, on) => ctx.memoFlip({closest: s => (s === '.mc-flip' ? boxes[i] : null)}, on)};
  };
  const m = faire();
  m.flip(1, true);
  assert.ok(m.boxes[1].c.has('is-flipped') && !m.boxes[0].c.has('is-flipped') && m.root.c.has('is-flipped'));
  assert.ok(m.boxes[0].a.has('inert') && !m.boxes[1].a.has('inert'), 'l’autre carte est inerte tant que celle-ci est ouverte');
  assert.ok(m.boxes[1].r.a.has('inert') && !m.boxes[1].v.a.has('inert') && m.boxes[1].v.a.get('aria-hidden') === 'false');
  m.flip(1, false);
  assert.ok(!m.boxes[1].c.has('is-flipped') && !m.root.c.has('is-flipped') && !m.boxes[0].a.has('inert') && m.boxes[1].v.a.has('inert'));
  assert.ok(cut('function memoFlipFit(root){', '\n}').includes("root.querySelectorAll('.mc-flip').forEach(box=>{"), 'chaque carte a sa hauteur');
});

test('le style : éventail dans la main, carte tirée redressée, mouvement réduit respecté', () => {
  for (const r of ['html.lq .mc-main{position:relative;display:grid;max-width:360px;', 'html.lq .mc-main.a-1>.mc-flip{--rz:-3deg;--sc:.86}', 'html.lq .mc-main.a-2>.mc-flip{--sc:.72}',
    'html.lq .mc-main.a-2>.mc-flip[data-k="0"]{--rz:-9deg;--tx:-7%;--dy:-12px}', 'html.lq .mc-main.a-2>.mc-flip[data-k="1"]{--rz:7deg;--tx:6%;z-index:2}',
    'html.lq .mc-reveal .mc-main>.mc-flip.is-flipped{z-index:5;--rz:0deg;--tx:0;--ty:0;--dy:0px;--sc:1;cursor:auto}', 'html.lq .mc-main.a-2>.mc-flip[data-k="0"] .mc-seal{display:none}',
    'html.lq .mc-reveal.is-flipped .mc-main>.mc-flip:not(.is-flipped){opacity:0;--ty:26px;pointer-events:none}', 'html.lq .mc-reveal.is-flipped .mc-main-main{opacity:0;translate:-50% 44px}',
    'html.lq .mc-main>.mc-flip.is-flipped .mc-seal{visibility:hidden}', 'html.lq .mc-flip.is-flipped>.is-recto{transform:rotateY(-180deg);visibility:hidden}',
    'html.lq .mc-reveal.is-new.is-in .mc-main>.mc-flip{animation:mcDeal .8s var(--pop) .2s backwards,mcPioche .7s ease-in-out 2s 1}',
    'html[data-motion="reduce"].lq :is(.mc-main,.mc-main>.mc-flip,.mc-main-main){animation:none!important;transition:none!important}'])
    assert.ok(css.includes(r), r);
  /* L’éventail penche avec rotate / translate / scale, pas avec transform : l’arrivée mcDeal (qui anime transform) s’y ajoute */
  const flip = css.slice(css.indexOf('html.lq .mc-main>.mc-flip{'), css.indexOf('}', css.indexOf('html.lq .mc-main>.mc-flip{')));
  assert.ok(flip.includes('translate:var(--tx,0) calc(var(--dy,0px) + var(--ty,0px));rotate:var(--rz,0deg);scale:var(--sc,1)') && !/[^-]transform:/.test(flip.replace('transform-origin', '')));
  assert.ok(css.indexOf('html.lq .mc-main{position:relative') < css.indexOf('Défis — la refonte du 7 novembre'), 'avant la section des défis');
  assert.ok(!css.includes('html.lq .is-flipped .mc-flip>.is-recto'), 'l’ancienne règle retournait toutes les cartes du bloc');
});
