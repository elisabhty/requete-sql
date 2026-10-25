import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/* Stickers nets sur iPhone. Elisa, 25 octobre, 12 h 03, devant « Mon compte » → Accomplissements : « Les stickers sont un peu flou d’aperçu ».
   Sa capture, comparée pixel à pixel à notre rendu : même dessin, mais les bords sont plus larges d’environ un demi-pixel d’écran
   (un seul ré-échantillonnage). Cause : le canvas portait un filtre drop-shadow et un perspective() toujours actifs, deux choses qui le font
   passer par le compositeur de l’iPhone, qui le rééchantillonne dès que sa position ne tombe pas pile sur un pixel d’écran.
   Maintenant : au repos, ni filtre ni transformation sur le canvas ; l’ombre est peinte dans le canvas (qui déborde de STK_PAD de chaque côté) ;
   la 3D n’existe que pendant l’inclinaison (.is-tilt) et le soulèvement sur le tableau ; la taille du dessin suit la largeur fractionnaire. */

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');

const take = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};
const rule = selector => {
  const a = css.indexOf(selector + '{');
  assert.ok(a >= 0, `règle introuvable : ${selector}`);
  assert.equal(css.indexOf(selector + '{', a + 1), -1, `règle en double : ${selector}`);
  return css.slice(a, css.indexOf('}', a) + 1);
};

/* Un contexte 2D qui note ce qu’on lui demande, dans l’ordre (appels et réglages). */
function recorder() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { log.push([k, ...a]); }),
    set: (t, k, v) => { t[k] = v; log.push(['set:' + k, v]); return true; },
  });
  return { ctx, log };
}

test('au repos, le canvas d’un sticker n’a ni transformation ni filtre : rien qui le fasse ré-échantillonner', () => {
  const art = rule('html.lq .stk-art');
  assert.ok(!/transform|perspective/.test(art), 'la boîte du sticker : aucune transformation au repos (un perspective() neutre suffit à la composer à part)');
  const cv = rule('html.lq .stk-art>canvas');
  assert.ok(!/filter|transform/.test(cv), 'le canvas : ni filtre ni transformation');
  assert.ok(cv.includes('pointer-events:none'), 'le canvas déborde du sticker : il ne prend pas les touchers de ses voisins');
  /* Les seuls filtres restants accompagnent un geste : sticker soulevé, décollé sous le doigt, écrasé contre le tableau. */
  const withFilter = [...css.matchAll(/([^{}]+)\{([^{}]*drop-shadow\([^{}]*)\}/g)].map(m => m[1].trim().split('\n').pop().trim()).filter(sel => sel.startsWith('html.lq '));
  assert.deepEqual(withFilter, ['html.lq .stk-item.is-lift .stk-art>canvas', 'html.lq .stk-ghost .stk-art>canvas'], 'filtres de geste seulement (hors keyframes)');
  const press = css.slice(css.indexOf('@keyframes stkPress'), css.indexOf('/* Le reflet qui balaie'));
  assert.ok(/100%\{filter:none\}/.test(press), 'l’écrasement finit sans filtre : l’ombre au repos est dans le canvas');
  assert.ok(!css.includes('.stk-cell.is-lock .stk-art>canvas,html.lq .stk-cell.is-peeling .stk-art>canvas{filter:none}'), 'plus de filtre à neutraliser sur la planche');
});

test('la 3D n’existe que pendant le geste : .is-tilt (fiche du sticker) et .is-lift (sur le tableau)', () => {
  const tilt = rule('html.lq .stk-art.is-tilt,html.lq .stk-item.is-lift .stk-art');
  assert.ok(tilt.includes('transform:perspective(700px) rotateX(var(--tx)) rotateY(var(--ty)) scale(var(--k))'), 'même inclinaison qu’avant');
  assert.ok(css.includes('html.lq .stk-item .stk-art{transition:transform .25s var(--pop)}') && css.includes('html.lq .stk-item.is-lift .stk-art{--k:1.08}'), 'le soulèvement sur le tableau garde sa transition et son agrandissement');
  assert.ok(rule('html.lq .stk-art.is-holo').includes('isolation:isolate'), 'les voiles holo se mélangent dans la boîte du sticker, comme avant (sans transformation, il faut l’isoler)');
});

test('stkTilt : .is-tilt arrive avec le doigt ou la souris et repart avec eux', () => {
  const handlers = {}, classes = new Set(), props = new Map();
  const art = {
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    style: { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k) },
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 200 }),
  };
  const stage = { querySelector: s => (s === '.stk-art' ? art : null), addEventListener: (t, f) => { handlers[t] = f; } };
  const ctx = vm.createContext({ prefersReduceMotion: () => false, setTimeout: () => 0 });
  vm.runInContext(take('function stkTilt(stage){', 'function stkTogglePlace('), ctx);
  ctx.stkTilt(stage);
  assert.ok(!classes.has('is-tilt'), 'au repos : pas incliné');
  handlers.pointermove({ clientX: 250, clientY: 150 });
  assert.ok(classes.has('is-tilt'), 'sous le doigt : incliné');
  assert.equal(props.get('--ty'), '6.0deg');
  assert.equal(props.get('--tx'), '6.0deg');
  handlers.pointerup({ pointerType: 'mouse' });
  assert.ok(classes.has('is-tilt'), 'la souris reste au-dessus : toujours incliné');
  handlers.pointerleave();
  assert.ok(!classes.has('is-tilt') && !props.has('--tx') && !props.has('--ty'), 'la souris part : à plat, sans transformation');
  handlers.pointerdown({ clientX: 120, clientY: 280 });
  assert.ok(classes.has('is-tilt'));
  handlers.pointerup({ pointerType: 'touch' });
  assert.ok(!classes.has('is-tilt'), 'le doigt se lève : à plat');
});

test('le canvas déborde du sticker de STK_PAD, le CSS et le dessin sont d’accord, et l’ombre y tient', () => {
  const pad = Number(/const STK_PAD=(\d+);/.exec(html)[1]);
  const cv = rule('html.lq .stk-art>canvas');
  assert.ok(cv.includes(`left:-${pad}px;top:-${pad}px;`) && cv.includes(`width:calc(100% + ${2 * pad}px);height:calc(100% + ${2 * pad}px)`), 'le canvas déborde exactement de STK_PAD de chaque côté');
  const ctx = vm.createContext({});
  vm.runInContext(take('const STK_PAD=', 'const stkPathCache'), ctx);
  const shadows = vm.runInContext('STK_SHADOW', ctx);
  assert.equal(JSON.stringify(shadows), JSON.stringify([[3, 6, 'rgba(34,28,70,.12)'], [1, 1, 'rgba(34,28,70,.24)']]), 'les deux ombres du filtre d’avant : large puis serrée');
  for (const [dy, blur] of shadows) assert.ok(dy + blur <= pad, `l’ombre ${dy}/${blur} tient dans la marge (décalage + 2 écarts-types)`);
});

/* stkPaint avec un faux DOM : des canvas qui notent ce qu’on leur fait. */
function paintWorld(dpr = 3) {
  const work = recorder(), workCv = { width: 300, height: 150, getContext: () => work.ctx };
  const ctx = vm.createContext({
    Path2D: class { constructor(d) { this.d = d; } },
    window: { devicePixelRatio: dpr },
    document: { createElement: () => workCv },
    getComputedStyle: el => ({ width: el.cssWidth }),
    stkMask: () => '', stkGlitter: () => '', stkFontWatch: () => {}, STK_HOLO: {},
  });
  vm.runInContext(take('const STK_INK=', '/* Dans l’ordre de MODULES') + take('function stkPaint(root){', '/* ---------- Écran Stickers ---------- */'), ctx);
  const canvases = [];
  const sticker = ({ id = 'requete', mode, cssWidth = '105.328px', offsetWidth = 125, inCell = false } = {}) => {
    const rec = recorder();
    const cv = {
      width: 300, height: 150, offsetWidth, dataset: { stk: id, ...(mode ? { mode } : {}) },
      parentElement: { cssWidth }, closest: s => (s === '.stk-cell' && inCell ? {} : null), getContext: () => rec.ctx,
    };
    canvases.push(cv);
    return { cv, log: rec.log };
  };
  const paint = () => ctx.stkPaint({ querySelectorAll: s => (s === 'canvas[data-stk]' ? canvases : []) });
  return { sticker, paint, work };
}
const ops = (log, name) => log.filter(e => e[0] === name);
const first = (log, name) => log.findIndex(e => e[0] === name);

test('stkPaint : le dessin a la largeur du sticker à la fraction de pixel près, avec la marge de l’ombre autour', () => {
  const w = paintWorld(3);
  const { cv, log } = w.sticker({});
  w.paint();
  /* 105,328 px × 3 = 316 px d’écran ; l’ancien calcul (offsetWidth arrondi, 125 → 375) en perdait un. Marge : 10 px × 3 de chaque côté. */
  assert.equal(cv.width, 316 + 60);
  assert.equal(cv.height, 316 + 60, 'les deux côtés');
  assert.deepEqual(ops(log, 'clearRect')[0], ['clearRect', 0, 0, 376, 376]);
  assert.deepEqual(ops(log, 'translate').at(-1), ['translate', 30, 30], 'le sticker est posé dans la marge');
  const w2 = paintWorld(2);
  const two = w2.sticker({ cssWidth: '64px', offsetWidth: 84 });
  w2.paint();
  assert.equal(two.cv.width, 128 + 40, 'écran ×2 : 64 px → 128, marge 20 de chaque côté');
  const w5 = paintWorld(5);
  const five = w5.sticker({ cssWidth: '64px', offsetWidth: 84 });
  w5.paint();
  assert.equal(five.cv.width, 192 + 60, 'au-delà de ×3, on s’arrête à ×3 (mémoire)');
});

test('stkPaint : l’ombre est peinte dans le canvas, sous le sticker, à l’échelle de l’écran', () => {
  const w = paintWorld(3);
  const { log } = w.sticker({});
  w.paint();
  const sets = k => log.filter(e => e[0] === 'set:' + k).map(e => e[1]);
  assert.deepEqual(sets('shadowBlur'), [18, 3], 'flou 6 puis 1 px CSS, à ×3');
  assert.deepEqual(sets('shadowOffsetY'), [9, 3], 'décalage 3 puis 1 px CSS, à ×3');
  assert.deepEqual(sets('shadowOffsetX'), [0, 0]);
  assert.deepEqual(sets('shadowColor'), ['rgba(34,28,70,.12)', 'rgba(34,28,70,.24)']);
  const draws = ops(log, 'drawImage');
  assert.equal(draws.length, 2, 'une silhouette, deux ombres');
  assert.ok(draws.every(d => d[2] === 0 && d[3] === 0), 'posée sur le sticker, pas ailleurs');
  assert.ok(first(log, 'drawImage') < first(log, 'fill') && first(log, 'drawImage') < first(log, 'stroke'), 'les ombres d’abord, le sticker par-dessus');
  const back = log.map(e => e[0]);
  assert.ok(back.indexOf('restore') < back.indexOf('translate'), 'les ombres sont rangées (save/restore) avant de peindre le sticker : elles ne le suivent pas');
  /* Le calque de travail ne porte que la silhouette de découpe (bords ≥ 16 = 2 × 8), pas les couleurs du sticker. */
  const widths = w.work.log.filter(e => e[0] === 'set:lineWidth').map(e => e[1]);
  assert.ok(widths.length > 3 && widths.every(v => v >= 16), 'silhouette de découpe seule');
});

test('stkPaint : à plat (silhouettes de la planche, découpe vide) pas d’ombre ; ailleurs, les silhouettes à gagner gardent la leur', () => {
  const kinds = { art: { mode: undefined }, 'art sur la planche': { inCell: true }, 'à gagner (Mon compte, fiche)': { mode: 'lock' }, 'à gagner (planche)': { mode: 'lock', inCell: true }, 'découpe vide': { mode: 'spot', inCell: true } };
  const shadowed = {};
  for (const [name, opts] of Object.entries(kinds)) {
    const w = paintWorld(3);
    const { log } = w.sticker(opts);
    w.paint();
    shadowed[name] = ops(log, 'drawImage').length > 0;
  }
  assert.deepEqual(shadowed, { art: true, 'art sur la planche': true, 'à gagner (Mon compte, fiche)': true, 'à gagner (planche)': false, 'découpe vide': false });
});

test('stkPaint : un sticker masqué (display:none) n’est pas touché ; sa largeur nulle non plus', () => {
  const w = paintWorld(3);
  const hidden = w.sticker({ offsetWidth: 0 });
  const auto = w.sticker({ cssWidth: 'auto' });
  w.paint();
  assert.equal(hidden.cv.width, 300);
  assert.equal(auto.cv.width, 300);
  assert.equal(hidden.log.length + auto.log.length, 0);
});

test('stkDraw : la silhouette seule (cutOnly) est celle de la découpe ; le sticker complet la recouvre', () => {
  const lines = (id, cutOnly) => {
    const { ctx: c2, log } = recorder();
    const ctx = vm.createContext({ Path2D: class {} });
    vm.runInContext(take('const STK_INK=', '/* Dans l’ordre de MODULES'), ctx);
    ctx.c = c2; vm.runInContext(`stkDraw(c,${JSON.stringify(id)},400,'art'${cutOnly ? ',true' : ''})`, ctx);
    return log.filter(e => e[0] === 'set:lineWidth').map(e => e[1]);
  };
  for (const id of ['requete', 'serie3', 'defis10']) {
    const cut = lines(id, true), full = lines(id, false);
    assert.ok(cut.length > 0 && cut.every(v => v >= 16), `${id} : seulement les traits de découpe`);
    assert.ok(full.length > cut.length && full.slice(0, cut.length).join() === cut.join(), `${id} : le sticker complet commence par cette silhouette, puis ses couleurs`);
  }
});
