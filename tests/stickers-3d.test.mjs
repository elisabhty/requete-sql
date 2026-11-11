/* Stickers en 3D et nouveaux accomplissements (Elisa, 11 novembre, 6 h 09 : « Met de nouveaux stickers : partage d’un code,
   premier défis réussis, 1er en multijoueur, 2 semaines de flamme de suite etc il faut vraiment que les stickers soit 3D et
   incroyable »). Chaque sticker a son rendu 3D (assets/stickers/<id>.webp) ; on vérifie les images, le dessin (image, silhouettes,
   attente, secours), les huit nouveaux accomplissements et ce qui les déclenche. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const fn = name => take(`function ${name}(`, '\n}\n') + '\n}\n';
const NEW = ['defi1', 'code', 'premier', 'difficile', 'amis5', 'serie14', 'champion', 'serie30'];

test('les 30 images : WebP carrés de 768 px, fond transparent, légères', () => {
  const ids = vm.runInContext(take('const STK_3D=', 'const STK_IMG_V=') + '[...STK_3D]', vm.createContext({}));
  assert.equal(ids.length, 30);
  for (const id of NEW) assert.ok(ids.includes(id), id);
  let total = 0;
  for (const id of ids) {
    const b = fs.readFileSync(new URL(`../assets/stickers/${id}.webp`, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF', id);
    assert.equal(b.toString('ascii', 8, 12), 'WEBP', id);
    assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${id} : format étendu (couche alpha)`);
    assert.ok(b[20] & 0x10, `${id} : avec transparence`);
    const w = 1 + b.readUIntLE(24, 3), h = 1 + b.readUIntLE(27, 3);
    assert.deepEqual([w, h], [768, 768], id);
    assert.ok(b.length < 120 * 1024, `${id} : ${b.length} octets`);
    total += b.length;
  }
  assert.ok(total < 2.2 * 1024 * 1024, `en tout ${total} octets`);
  assert.ok(html.includes('o.im.src=`assets/stickers/${id}.webp?v=${STK_IMG_V}`;'), 'chargées à la demande');
  assert.ok(!sw.includes('assets/stickers/'), 'pas dans le précache : rangées par le service worker à la première vue');
});

/* Un faux contexte 2D qui note les appels ; un faux Image qu’on « charge » à la main. */
function drawWorld() {
  const imgs = [];
  class FakeImage { constructor() { imgs.push(this); } set src(v) { this._src = v; } get src() { return this._src; } }
  const calls = [];
  const mk = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])), set: (t, k, v) => { t[k] = v; if (k === 'fillStyle') calls.push(['fill:' + v]); return true; } });
  const ctx = vm.createContext({
    Image: FakeImage, Path2D: class { constructor(d) { this.d = d; } },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => mk() }) },
    setTimeout: f => { f(); return 1; }, clearTimeout: () => {},
    painted: 0,
  });
  vm.runInContext(take('const STK_INK=', '/* Dans l’ordre de MODULES'), ctx);
  ctx.stkPaint = () => { ctx.painted++; };
  vm.runInContext('stkMasks={}', ctx);
  return { ctx, imgs, calls, mk, run: s => vm.runInContext(s, ctx) };
}

test('dessin : rien pendant le chargement, puis l’image 3D ; les silhouettes se tirent de l’image', () => {
  const w = drawWorld();
  w.ctx.c = w.mk();
  w.run("stkDraw(c,'premier',300,'art')");
  assert.equal(w.imgs.length, 1, 'chargement lancé');
  assert.equal(w.imgs[0].src, 'assets/stickers/premier.webp?v=1');
  assert.ok(!w.calls.some(c => c[0] === 'drawImage' || c[0] === 'fill' || c[0] === 'stroke'), 'rien dessiné en attendant');
  w.imgs[0].onload();
  assert.ok(w.ctx.painted > 0, 'repeint à l’arrivée');
  w.calls.length = 0;
  w.run("stkDraw(c,'premier',300,'art')");
  assert.deepEqual(w.calls.filter(c => c[0] === 'drawImage').map(c => c.slice(2)), [[0, 0, 300, 300]], 'l’image, à la taille du sticker');
  w.calls.length = 0;
  w.run("stkDraw(c,'premier',300,'lock')");
  assert.ok(w.calls.some(c => c[0] === 'fill:#DCD5F2'), 'à gagner : silhouette lavande');
  w.calls.length = 0;
  w.run("stkDraw(c,'premier',300,'spot')");
  assert.ok(w.calls.some(c => c[0] === 'fill:#CBC2EC') && w.calls.some(c => c[0] === 'fill:#EEEAFB'), 'emplacement vide : découpe en creux');
  assert.equal(w.imgs.length, 1, 'une seule image par sticker');
});

test('secours : si l’image ne vient pas, le dessin à plat reprend (pour les 21 qui en ont un)', () => {
  const w = drawWorld();
  w.ctx.c = w.mk();
  w.run("stkDraw(c,'serie7',300,'art')");
  assert.ok(!w.calls.some(c => c[0] === 'stroke'), 'en attente : rien');
  w.imgs[0].onerror();
  w.calls.length = 0;
  w.run("stkDraw(c,'serie7',300,'art')");
  assert.ok(w.calls.some(c => c[0] === 'stroke') && w.calls.some(c => c[0] === 'fill'), 'le dessin vectoriel');
  w.calls.length = 0;
  w.run("stkDraw(c,'champion',300,'art')");
  w.imgs[1].onerror();
  w.run("stkDraw(c,'champion',300,'art')");
  assert.ok(!w.calls.some(c => c[0] === 'drawImage' || c[0] === 'stroke'), 'né en 3D : pas de dessin à plat, rien plutôt qu’un trou mal dessiné');
});

/* Monde simulé pour les accomplissements : stats, record, parties, défis et gestes. */
function accWorld({ defis = 0, streak = 0, record = 0, salle, found = [], ev } = {}) {
  const ctx = vm.createContext({
    MODULES: [{ titre: 'Introduction', lessons: [{ id: 0 }] }],
    CHALLENGES: [{ id: 'a1', niv: 'f' }, { id: 'ad1', niv: 'd' }, { id: 'm1', niv: 'm' }],
    itemDone: () => false,
    state: { salle, defis: Object.fromEntries(found.map(id => [id, true])), stickers: ev ? { got: {}, fresh: {}, board: [], since: 1, ev } : undefined },
    Date: { now: () => 5000 },
  });
  ctx.compteStats = () => ({ lessons: 0, defis, streak });
  ctx.streakRecord = () => record;
  ctx.save = () => {};
  vm.runInContext(take('const STK_INK=', '/* ---------- Rendu à l’écran ---------- */'), ctx);
  const acc = JSON.parse(vm.runInContext('JSON.stringify(accomplissements())', ctx));
  return Object.fromEntries(acc.map(a => [a.id, a]));
}

test('les nouveaux accomplissements : premier défi, code partagé, 1ᵉʳ à plusieurs, Difficile, 5 parties, 14 et 30 jours, Champion', () => {
  let a = accWorld();
  for (const id of NEW) assert.equal(a[id].ok, false, `${id} : rien au départ`);
  a = accWorld({ defis: 1 });
  assert.equal(a.defi1.ok, true, '1 défi trouvé');
  a = accWorld({ ev: { code: 1 } });
  assert.equal(a.code.ok, true, 'le code d’une salle partagé');
  a = accWorld({ salle: { pl: [1, 0, 2], amis: 3 } });
  assert.equal(a.premier.ok, true, 'une 1re place à plusieurs');
  assert.equal(a.champion.ok, false);
  assert.deepEqual([a.champion.now, a.champion.goal, a.champion.unit], [1, 5, 'victoire']);
  assert.deepEqual([a.amis5.now, a.amis5.goal, a.amis5.unit, a.amis5.ok], [3, 5, 'partie', false]);
  a = accWorld({ salle: { pl: [5, 0, 0], amis: 9 } });
  assert.equal(a.champion.ok, true, '5 fois premier');
  assert.equal(a.amis5.ok, true, '5 parties à plusieurs');
  a = accWorld({ found: ['a1', 'm1'] });
  assert.equal(a.difficile.ok, false, 'ni Facile ni Moyen');
  a = accWorld({ found: ['ad1'] });
  assert.equal(a.difficile.ok, true, 'un défi de niveau Difficile');
  a = accWorld({ streak: 2, record: 14 });
  assert.equal(a.serie14.ok, true, 'le record suffit, même si la série s’est arrêtée');
  assert.deepEqual([a.serie14.now, a.serie14.goal], [2, 14]);
  assert.equal(a.serie30.ok, false);
  a = accWorld({ record: 30 });
  assert.equal(a.serie30.ok, true);
  a = accWorld({ salle: { pl: 'nimporte', amis: -4 } });
  assert.equal(a.premier.now, 0, 'parties mal formées : zéro');
  assert.equal(a.amis5.now, 0);
});

test('déclencheurs : partager ou copier le code d’une salle, finir une partie', () => {
  const share = fn('jeuShare');
  assert.ok(share.includes("const gagne=()=>{if(typeof stkMarquer==='function')stkMarquer('code');};"));
  assert.ok(share.includes("await navigator.share({title:'Défi SQL sur Requête',text,url});gagne();return;"), 'partagé');
  assert.ok(share.includes("if(typeof buzz==='function')buzz('light');gagne();"), 'ou copié');
  assert.ok(!/AbortError'\)return;[^}]*gagne/.test(share), 'partage annulé : rien');
  const credit = fn('jeuCreditGame');
  assert.ok(/save\(\);\s*\/\*[^*]*\*\/\s*if\(typeof stkAfterProgress==='function'\)try\{stkAfterProgress\(\);\}catch\(e\)\{\}/.test(credit), 'après la partie comptée');
  /* stkMarquer : noté une fois, sauvegardé, puis la planche suit */
  const ctx = vm.createContext({ state: {}, saves: 0, after: 0 });
  ctx.save = () => { ctx.saves++; };
  ctx.stkAfterProgress = () => { ctx.after++; };
  vm.runInContext(fn('stkState') + fn('stkMarquer'), ctx);
  vm.runInContext("stkMarquer('code');stkMarquer('code')", ctx);
  assert.deepEqual({ ...ctx.state.stickers.ev }, { code: 1 });
  assert.deepEqual([ctx.saves, ctx.after], [1, 1], 'une seule fois');
});

test('sauvegarde : les gestes notés (ev) sont gardés, nettoyés, et absents s’il n’y en a pas', () => {
  const ctx = vm.createContext({});
  vm.runInContext(take('function normalizeState(', 'function normalize('), ctx);
  const st = ctx.normalizeState({ stickers: { got: {}, fresh: {}, board: [], since: 1, ev: { code: 1, 'MAUVAIS!': 1, zz: 0 } } });
  assert.equal(JSON.stringify(st.stickers.ev), '{"code":1}');
  assert.equal(ctx.normalizeState({ stickers: { ev: [1] } }).stickers.ev, undefined);
});
