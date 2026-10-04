/* Cours WHERE : le tableau « La condition est-elle vraie ? » est testé ligne par ligne.
   Le vrai HTML du cours est lu dans un mini-DOM, puis initRowTest (index.html) tourne
   avec une horloge virtuelle : balayage automatique, cartes vraie / fausse, toucher une
   ligne pour la retester, « Rejouer », mouvement réduit. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dataCtx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), dataCtx);
const lesson = vm.runInContext('MODULES.flatMap(m=>m.lessons).find(l=>l.id===4)', dataCtx);
const markup = lesson.studio.problem.extra;
const src = html.slice(html.indexOf('const RT_TIME='), html.indexOf('/* ---------- Sommaire interactif du cours'));
assert.ok(src.includes('function initRowTest()') && markup.includes('class="rt-wrap"'), 'animation et tableau localisés');

/* ---------- Mini-DOM : ce qu’initRowTest utilise, rien de plus ---------- */
class El {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.listeners = {};
    this.cls = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    this.style = {}; this.offsetTop = 0; this.offsetHeight = 40; this.offsetWidth = 100;
    const s = this.cls;
    this.classList = {
      add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c),
      toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; },
    };
  }
  add(k) { k.parentElement = this; this.children.push(k); return k; }
  get nextElementSibling() { const p = this.parentElement; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  matches(sel) { return sel[0] === '.' && this.cls.has(sel.slice(1)); }
  /* « .pk-mini > span » : la cellule qui contient la cible (ou la cible elle-même). */
  closest() { for (let e = this; e; e = e.parentElement) if (e.tagName === 'SPAN' && e.parentElement && e.parentElement.cls.has('pk-mini')) return e; return null; }
  find(cls) { for (const c of this.children) { if (c.cls.has(cls)) return c; const d = c.find(cls); if (d) return d; } return null; }
  querySelector(sel) { return this.find(sel.slice(1)); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  click() { const e = { target: this }; for (let n = this; n; n = n.parentElement) (n.listeners.click || []).forEach(f => f(e)); }
}
function parse(text) {
  const root = new El('root'); let cur = root;
  for (const m of text.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\s*>/g)) {
    const [, close, tag, rest] = m;
    if (close) { for (let e = cur; e && e !== root; e = e.parentElement) if (e.tagName === tag.toUpperCase()) { cur = e.parentElement; break; } continue; }
    const attrs = {}; for (const a of rest.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    const el = cur.add(new El(tag, attrs)); if (!['br', 'img', 'hr', 'input'].includes(tag)) cur = el;
  }
  return root;
}

/* En-têtes de 30 px, lignes de 40 px, pied de 30 px : la barre doit viser la bonne ligne. */
function layout(wrap) {
  const n = +wrap.dataset.rtN, grid = wrap.find('pk-mini'), cells = grid.children.filter(c => c.tagName === 'SPAN');
  cells.forEach((c, i) => { const r = Math.floor(i / n); c.offsetTop = r ? 30 + (r - 1) * 40 : 0; c.offsetHeight = r ? 40 : 30; });
  grid.offsetHeight = 30 + (cells.length / n - 1) * 40; wrap.find('ij-tmore').offsetHeight = 30;
}

function setup({ reduce = false, val } = {}) {
  const root = parse(val ? markup.replace(/data-rt-val="[\d,]+"/, `data-rt-val="${val}"`) : markup), wrap = root.find('rt-wrap'); layout(wrap);
  let now = 0, seq = 0, q = [];
  const clock = {
    setT: (f, ms) => { const id = ++seq; q.push({ id, t: now + (ms || 0), f }); return id; },
    clearT: id => { q = q.filter(x => x.id !== id); },
    tick(ms) { const end = now + ms; for (;;) { q.sort((a, b) => a.t - b.t || a.id - b.id); const n = q[0]; if (!n || n.t > end) break; q.shift(); now = n.t; n.f(); } now = end; },
    pending: () => q.length,
  };
  const ios = [], buzz = [];
  class IO { constructor(cb) { this.cb = cb; this.off = false; ios.push(this); } observe() {} disconnect() { this.off = true; } }
  const ctx = vm.createContext({ document: { getElementById: () => ({}), querySelectorAll: () => [wrap] }, IntersectionObserver: IO, setTimeout: clock.setT, clearTimeout: clock.clearT, prefersReduceMotion: () => reduce, navigator: { vibrate: ms => buzz.push(ms) } });
  vm.runInContext(src, ctx); vm.runInContext('initRowTest()', ctx);
  const grid = wrap.find('pk-mini'), cells = grid.children.filter(c => c.tagName === 'SPAN'), n = +wrap.dataset.rtN;
  const rows = []; for (let i = n; i < cells.length; i += n) rows.push(cells.slice(i, i + n));
  const legend = wrap.nextElementSibling, bar = grid.find('rt-bar');
  const state = r => { const v = rows[r][n - 1].cls; return v.has('is-testing') ? 'testing' : v.has('is-pending') ? 'pending' : 'shown'; };
  return {
    wrap, grid, cells, rows, bar, legend, ios, buzz, clock, n, state, more: wrap.find('ij-tmore'), replay: wrap.find('rt-replay'),
    states: () => rows.map((_, r) => state(r)),
    dim: r => rows[r].every(c => c.cls.has('is-dim')), lit: () => legend.children.map(li => li.cls.has('is-lit')),
    /* Un observateur déconnecté ne rappelle plus personne. */
    visible: () => { if (!ios[0].off) ios[0].cb([{ isIntersecting: true, intersectionRatio: 1 }]); },
    tap: (r, c = 1) => rows[r][c].click(),
  };
}

test('le tableau du cours WHERE est branché : colonnes, 4 lignes, cartes vraie / fausse', () => {
  const t = setup();
  assert.equal(t.n, 4, 'prénom, nom, ville, verdict'); assert.equal(+t.wrap.dataset.rtVal, 2, 'la condition porte sur la colonne ville'); assert.equal(t.rows.length, 4);
  assert.deepEqual(t.rows.map(r => r[t.n - 1].cls.has('is-hit')), [true, false, false, true], 'Sophie et Nathan (Paris) sont vraies');
  assert.ok(t.legend.cls.has('win-look') && t.legend.cls.has('rt-legend') && t.legend.children[0].cls.has('is-yes') && t.legend.children[1].cls.has('is-no'));
});

test('avant le balayage : un « ? » à la place de chaque verdict, rien de révélé', () => {
  const t = setup();
  assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'pending']);
  assert.ok(t.wrap.cls.has('is-armed') && !t.wrap.cls.has('is-done'));
  assert.equal(t.ios.length, 1, 'le tableau est surveillé');
  t.clock.tick(60_000); assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'pending'], 'rien ne démarre tant que le tableau n’est pas visible');
});

test('visible : le balayage teste une ligne après l’autre, la barre et la carte suivent le verdict', () => {
  const t = setup(); t.visible();
  t.clock.tick(399); assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'pending']);
  t.clock.tick(1 + 300);                                  // ligne 1 : en cours de test
  assert.deepEqual(t.states(), ['testing', 'pending', 'pending', 'pending']);
  assert.ok(t.bar.cls.has('is-on')); assert.equal(t.bar.style.transform, 'translateY(30px)'); assert.equal(t.bar.style.height, '40px');
  assert.ok(t.rows[0][+t.wrap.dataset.rtVal].cls.has('is-cmp'), 'la ville comparée est mise en avant');
  assert.deepEqual(t.lit(), [false, false]);
  t.clock.tick(480);                                      // verdict de la ligne 1 : vraie
  assert.deepEqual(t.states(), ['shown', 'pending', 'pending', 'pending']);
  assert.ok(t.bar.cls.has('is-ok') && !t.bar.cls.has('is-ko')); assert.deepEqual(t.lit(), [true, false]);
  assert.ok(!t.dim(0), 'une ligne vraie n’est pas estompée');
  t.clock.tick(520);                                      // ligne 2 : la barre glisse, la carte s’éteint
  assert.deepEqual(t.states(), ['shown', 'testing', 'pending', 'pending']);
  assert.equal(t.bar.style.transform, 'translateY(70px)'); assert.deepEqual(t.lit(), [false, false]); assert.ok(!t.bar.cls.has('is-ok'));
  t.clock.tick(480);                                      // ligne 2 : fausse
  assert.ok(t.bar.cls.has('is-ko')); assert.deepEqual(t.lit(), [false, true]); assert.ok(t.dim(1), 'une ligne fausse est estompée');
});

test('plusieurs colonnes comparées (ex. ville et âge) : toutes sont mises en avant pendant le test, puis relâchées', () => {
  const t = setup({ val: '0,2' }); t.visible();
  t.clock.tick(400 + 300);
  assert.ok(t.rows[0][0].cls.has('is-cmp') && t.rows[0][2].cls.has('is-cmp') && !t.rows[0][1].cls.has('is-cmp'), 'les colonnes 0 et 2 sont comparées, pas la colonne 1');
  t.clock.tick(480);
  assert.ok(!t.rows[0][0].cls.has('is-cmp') && !t.rows[0][2].cls.has('is-cmp'), 'une fois le verdict affiché, plus rien n’est mis en avant');
});

test('fin du balayage : la barre passe sur « … et 6 autres clients », puis tout se calme et « Rejouer » apparaît', () => {
  const t = setup(); t.visible();
  t.clock.tick(400 + 300 + 4 * 1000);                     // les 4 lignes sont passées : la barre vise le pied du tableau
  assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown']);
  assert.ok(t.more.cls.has('is-scan') && t.bar.cls.has('is-on')); assert.equal(t.bar.style.transform, 'translateY(190px)'); assert.equal(t.bar.style.height, '30px');
  assert.deepEqual(t.lit(), [false, false]); assert.ok(!t.wrap.cls.has('is-done'));
  t.clock.tick(700);
  assert.ok(t.wrap.cls.has('is-done'), 'le bouton Rejouer est affiché');
  assert.ok(!t.bar.cls.has('is-on') && !t.more.cls.has('is-scan'));
  assert.deepEqual([0, 1, 2, 3].map(t.dim), [false, true, true, false], 'seules les lignes fausses sont estompées');
  assert.equal(t.clock.pending(), 0, 'plus aucune minuterie en cours');
});

test('retour haptique léger seulement quand l’apprenant touche une ligne (jamais pendant le balayage automatique)', () => {
  const t = setup(); t.visible(); t.clock.tick(60_000);
  assert.deepEqual(t.buzz, [], 'le balayage automatique reste silencieux');
  t.tap(0); assert.deepEqual(t.buzz, [6], 'un tick au toucher'); t.clock.tick(480); assert.deepEqual(t.buzz, [6, 8], 'un tick de plus quand le verdict est « vraie »');
  t.clock.tick(520); t.tap(1); t.clock.tick(480); assert.deepEqual(t.buzz, [6, 8, 6], 'verdict « fausse » : pas de vibration d’erreur');
});

test('toucher une ligne la teste à nouveau, sans toucher aux autres', () => {
  const t = setup(); t.visible(); t.clock.tick(60_000);
  t.tap(1);                                               // Lucas / Lyon
  assert.deepEqual(t.states(), ['shown', 'testing', 'shown', 'shown']);
  assert.ok(!t.dim(1), 'la ligne retestée n’est plus estompée pendant le test');
  assert.ok(t.bar.cls.has('is-on')); assert.equal(t.bar.style.transform, 'translateY(70px)');
  t.clock.tick(480);
  assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown']); assert.deepEqual(t.lit(), [false, true]); assert.ok(t.dim(1) && !t.dim(0));
  t.clock.tick(520);
  assert.ok(!t.bar.cls.has('is-on') && t.wrap.cls.has('is-done')); assert.deepEqual(t.lit(), [false, false]); assert.equal(t.clock.pending(), 0);
});

test('toucher une ligne avant même le balayage : seule cette ligne est testée, le balayage automatique est annulé', () => {
  const t = setup(); t.tap(3, 0);                         // on touche le prénom (n’importe quelle cellule de la ligne)
  assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'testing']);
  assert.ok(t.ios[0].off, 'le tableau n’est plus surveillé');
  t.clock.tick(1000); assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'shown']);
  assert.ok(t.wrap.cls.has('is-done'));
  t.visible(); t.clock.tick(60_000); assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'shown'], 'plus de balayage automatique');
});

test('toucher une ligne juste après l’apparition du tableau, avant le départ du balayage : le balayage ne repart pas par-dessus', () => {
  const t = setup(); t.visible(); t.clock.tick(200);      // le départ automatique est programmé (400 ms) mais pas encore parti
  t.tap(2);
  t.clock.tick(60_000);
  assert.deepEqual(t.states(), ['pending', 'pending', 'shown', 'pending'], 'seule la ligne touchée est testée');
  assert.ok(t.wrap.cls.has('is-done'));
  t.replay.click(); t.clock.tick(5000);
  assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown'], '« Rejouer » reste disponible');
});

test('toucher une ligne pendant le balayage : il s’arrête proprement, la ligne en cours de test redevient « ? »', () => {
  const t = setup(); t.visible(); t.clock.tick(1800);
  assert.deepEqual(t.states(), ['shown', 'testing', 'pending', 'pending']);
  t.tap(3);
  assert.deepEqual(t.states(), ['shown', 'pending', 'pending', 'testing']);
  t.clock.tick(1000);
  assert.deepEqual(t.states(), ['shown', 'pending', 'pending', 'shown']);
  assert.ok(t.wrap.cls.has('is-done') && !t.bar.cls.has('is-on'));
  t.clock.tick(60_000); assert.deepEqual(t.states(), ['shown', 'pending', 'pending', 'shown'], 'le balayage interrompu ne reprend pas tout seul');
  assert.equal(t.clock.pending(), 0);
});

test('Rejouer relance le balayage complet', () => {
  const t = setup(); t.visible(); t.clock.tick(60_000);
  t.replay.click();
  assert.deepEqual(t.states(), ['pending', 'pending', 'pending', 'pending']); assert.ok(!t.wrap.cls.has('is-done')); assert.ok(![0, 1, 2, 3].some(t.dim));
  t.clock.tick(300); assert.deepEqual(t.states(), ['testing', 'pending', 'pending', 'pending']);
  t.clock.tick(5000); assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown']); assert.ok(t.wrap.cls.has('is-done'));
  assert.deepEqual([0, 1, 2, 3].map(t.dim), [false, true, true, false]);
});

test('un en-tête ne déclenche aucun test', () => {
  const t = setup(); t.visible(); t.clock.tick(60_000);
  t.cells[0].click(); t.cells[1].click();
  assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown']); assert.equal(t.clock.pending(), 0);
});

test('mouvement réduit : tout est révélé d’emblée, sans balayage ; toucher une ligne la reteste', () => {
  const t = setup({ reduce: true });
  assert.deepEqual(t.states(), ['shown', 'shown', 'shown', 'shown']); assert.ok(t.wrap.cls.has('is-done'));
  assert.deepEqual([0, 1, 2, 3].map(t.dim), [false, true, true, false]);
  assert.equal(t.ios.length, 0, 'pas de surveillance'); assert.equal(t.clock.pending(), 0); assert.ok(!t.bar.cls.has('is-on'));
  t.tap(1); assert.equal(t.state(1), 'testing'); t.clock.tick(480); assert.equal(t.state(1), 'shown');
});

test('mise en forme : le CSS gère l’état « ? », le balayage, les cartes et le mouvement réduit', () => {
  for (const sel of ['.rt-bar', '.rt .pk-mini span.rt-v.is-pending::after', '.rt .pk-mini span.rt-v.is-testing::after', '.win-look.rt-legend li.is-yes.is-lit', '.win-look.rt-legend li.is-no.is-lit', '.rt-wrap.is-done .rt-replay', '.rt-b:focus-visible'])
    assert.ok(html.includes(sel), `règle CSS « ${sel} »`);
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce){.rt-bar'), 'mouvement réduit du système');
  assert.ok(html.includes('html[data-motion="reduce"] .rt-bar'), 'mouvement réduit choisi dans l’app');
  const initList = html.slice(html.indexOf('buildSommaire();'), html.indexOf('initConversionFunctions();'));
  assert.ok(initList.includes('initRowTest();'), 'initRowTest est lancé au rendu du cours');
});
