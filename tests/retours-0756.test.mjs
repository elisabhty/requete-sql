/* Elisa, 7 novembre, 7 h 56 : « Ta collection au lieu de tes récompenses » (le surtitre de l’écran Stickers) et « Quand on
   télécharge un stickers avec halo il perd ses paillettes j’avais envie d’un effet waouh ».
   Un sticker holographique (rare ou légendaire) se télécharge avec les voiles de l’écran peints dans le PNG — irisation, arc-en-ciel,
   paillettes du légendaire, reflet —, figés sous une lumière venue d’en haut à gauche, plus un éclat en diagonale, des scintillements
   sur le film et des étoiles d’autocollant qui débordent (deux pour un rare, trois pour un légendaire). Le fond reste transparent ; un
   sticker ordinaire se télécharge comme avant. La planche téléchargée garde aussi les voiles de ses holographiques. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), lq = read('ludique.css'), sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('le surtitre de l’écran Stickers : « Ta collection »', () => {
  assert.ok(app.includes('<div class="lgtitle"><div class="eyebrow">Ta collection</div><h1>Stickers</h1>'));
  assert.ok(!app.includes('Tes récompenses'));
  assert.ok(app.includes('<h2 id="stk-sheet-t">Tous tes stickers</h2>') && !app.includes('<h2 id="stk-sheet-t">Ta collection</h2>'), 'pas deux fois « Ta collection » : la grille devient « Tous tes stickers » (choix d’Elisa)');
});

/* Un contexte 2D qui note ce qu’on lui demande (node n’a pas de canvas) */
class Ctx {
  constructor(nom, journal) { Object.assign(this, { nom, journal, pile: [], globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, shadowBlur: 0, shadowColor: 'transparent', lineJoin: 'miter' }); }
  save() { this.pile.push(['globalCompositeOperation', 'globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'shadowBlur', 'shadowColor', 'lineJoin'].map(k => [k, this[k]])); }
  restore() { for (const [k, v] of this.pile.pop() || []) this[k] = v; }
  drawImage(src) { this.journal.push({ ctx: this.nom, f: 'drawImage', src: src.nom, op: this.globalCompositeOperation, a: this.globalAlpha, ombre: this.shadowBlur }); }
  fill() { this.journal.push({ ctx: this.nom, f: 'fill', c: this.fillStyle, op: this.globalCompositeOperation }); }
  stroke() { this.journal.push({ ctx: this.nom, f: 'stroke', c: this.strokeStyle }); }
  createLinearGradient() { const g = { stops: [], addColorStop: (o, c) => g.stops.push([o, c]) }; this.journal.push({ ctx: this.nom, f: 'lin', g }); return g; }
  createRadialGradient() { const g = { stops: [], addColorStop: (o, c) => g.stops.push([o, c]) }; return g; }
  translate() {} clearRect() {} fillRect() {} beginPath() {} arc() {} moveTo() {} lineTo() {}
}
function monde() {
  const journal = [];
  let n = 0;
  const document = { createElement: () => { const c = { nom: 'c' + (n++), width: 300, height: 150 }; c.getContext = () => (c.ctx ||= new Ctx(c.nom, journal)); return c; } };
  const ctx = vm.createContext({ document, Path2D: class { constructor(d) { this.d = d; } }, Math, journal,
    stkDraw: (c, id, px, mode) => journal.push({ ctx: c.nom, f: 'stkDraw', id, px, mode }) });
  vm.runInContext(cut('const STK_P={', '\n};\n') + '\n};\n' + "const STK_INK='#221C46';\nconst STK_HOLO={defis10:1,serie7:2,parcours:2};\n" + cut('const STK_EXP_LUMIERE=', 'function stkSlug(s){'), ctx);
  return { ctx, journal };
}

test('télécharger un holographique : ses quatre voiles de l’écran, un éclat, des scintillements, des étoiles qui débordent', () => {
  const { ctx, journal } = monde();
  const cv = vm.runInContext("stkCanvasExport('serie7',1200,STK_EXP_MARGE)", ctx);
  assert.equal(cv.width, 1440, 'une marge de 10 % autour, pour les étoiles');
  const principal = cv.nom;
  assert.deepEqual(journal.filter(j => j.f === 'stkDraw').map(j => [j.ctx === principal ? 'sticker' : 'silhouette', j.mode, j.px]), [['sticker', 'art', 1200], ['silhouette', 'lock', 1200]], 'le dessin, puis la silhouette de découpe qui masque les voiles');
  const voiles = journal.filter(j => j.ctx === principal && j.f === 'drawImage').map(j => [j.op, j.a]);
  assert.deepEqual(voiles, [['multiply', .55], ['color-dodge', .32], ['screen', .85], ['soft-light', 1], ['screen', .55], ['screen', 1]], 'irisation, arc-en-ciel, paillettes, reflet, éclat, scintillements');
  assert.ok(journal.filter(j => j.f === 'drawImage' && j.ctx !== principal).every(j => j.op === 'destination-in' && j.ombre === 0), 'chaque voile est découpé à la silhouette, sans ombre');
  const etoiles = journal.filter(j => j.ctx === principal && j.f === 'fill' && j.c === '#FFD23F');
  assert.equal(etoiles.length, 3, 'trois étoiles d’autocollant pour un légendaire');
  const traits = journal.filter(j => j.ctx === principal && j.f === 'stroke').map(j => j.c);
  assert.deepEqual(traits, ['#fff', '#221C46', '#fff', '#221C46', '#fff', '#221C46'], 'bord blanc et trait encre, comme les étoiles de l’étiquette « Légendaire »');
});

test('un rare : pas de paillettes, deux étoiles ; un ordinaire : le dessin seul, comme avant', () => {
  let { ctx, journal } = monde();
  let cv = vm.runInContext("stkCanvasExport('defis10',1200,STK_EXP_MARGE)", ctx);
  assert.deepEqual(journal.filter(j => j.ctx === cv.nom && j.f === 'drawImage').map(j => j.op), ['multiply', 'color-dodge', 'soft-light', 'screen', 'screen']);
  assert.equal(journal.filter(j => j.ctx === cv.nom && j.f === 'fill' && j.c === '#FFD23F').length, 2);
  ({ ctx, journal } = monde());
  cv = vm.runInContext("stkCanvasExport('intro',1200,0)", ctx);
  assert.equal(cv.width, 1200);
  assert.deepEqual(journal.map(j => j.f), ['stkDraw'], 'ni voile ni étoile');
});

test('les voiles du PNG sont ceux de l’écran (mêmes couleurs, mêmes mélanges, mêmes opacités)', () => {
  const v1 = lq.match(/html\.lq \.stk-v1\{background:linear-gradient\(115deg,([^)]*)\)[^;]*;mix-blend-mode:(\w[\w-]*);opacity:([\d.]+)\}/);
  const v2 = lq.match(/html\.lq \.stk-v2\{background:repeating-linear-gradient\(115deg,([^)]*)\)[^;]*;mix-blend-mode:(\w[\w-]*);opacity:([\d.]+)\}/);
  const v3 = lq.match(/html\.lq \.stk-v3\{[^}]*mix-blend-mode:(\w+);opacity:([\d.]+)\}/);
  assert.ok(v1 && v2 && v3);
  const js = cut('function stkHoloVoiles(ctx,id,px){', '\n}\n');
  const couleurs = l => l.split(',').map(x => x.trim().split(' ')[0]);
  for (const c of couleurs(v1[1])) assert.ok(js.includes(`'${c}'`), 'irisation : ' + c);
  assert.ok(js.includes(`voile('${v1[2]}',${v1[3]},`) && js.includes(`voile('${v2[2]}',${v2[3]},`) && js.includes(`voile('${v3[1]}',${v3[2]},`));
  assert.deepEqual(couleurs(v2[1]).slice(0, 5), ['#FF4FA3', '#FFC94F', '#4FFFA0', '#4FC8FF', '#A34FFF']);
  assert.ok(js.includes("const arc=['#FF4FA3','#FFC94F','#4FFFA0','#4FC8FF','#A34FFF']"), 'l’arc-en-ciel, tous les 30 %');
});

test('le téléchargement et la planche passent par le même dessin', () => {
  assert.ok(cut('async function stkDownload(id){', '\n}\n').includes('const cv=stkCanvasExport(id,1200,STK_HOLO[id]?STK_EXP_MARGE:0);blob=stkBlob(stkTrim(cv,12));'));
  const board = cut('async function stkExportBoard(){', '\n}\n');
  assert.ok(board.includes('m=STK_HOLO[b.id]?STK_EXP_MARGE:0,half=size*(1+2*m)/2*'), 'la planche réserve la place des étoiles');
  assert.ok(board.includes('const sc=stkCanvasExport(b.id,Math.round(size),m),e=sc.width;'));
  assert.ok(!cut('async function stkDownload(id){', 'await saveFile').includes('await'), 'aucune attente avant la feuille de partage (Safari exige le geste)');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-08-confidentialite-compte-v2659';") && app.includes("const SW_CACHE='requete-2026-11-08-confidentialite-compte-v2659';"));
});
