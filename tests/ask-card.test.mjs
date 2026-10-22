/* Question mise en évidence (bloc « ask » des cours guide) : le HTML produit pour chaque cours texte,
   et le petit « pop » qui se joue une seule fois quand la carte arrive à l'écran. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dataCtx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), dataCtx);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', dataCtx).filter(l => !l.video);
const concept = lessons.find(l => l.id === 26).studio.problem.extra;
const src = html.slice(html.indexOf('function initAskCards()'), html.indexOf('const RT_TIME='));
assert.ok(src.includes('function initAskCards()'), 'animation localisée');

test('chaque cours texte met sa question en évidence dans une seule carte avec un « ? » (INSERT : « À quelle colonne appartient cette valeur ? »)', () => {
  assert.match(concept, /<p class="gd-ask"><i aria-hidden="true">\?<\/i><span>À quelle colonne appartient cette valeur.\?<\/span><\/p>/);
  for (const l of lessons) assert.equal((l.studio.problem.extra.match(/gd-ask/g) || []).length, 1, `${l.titre} : une seule carte`);
});

function setup({ reduce = false, withIO = true } = {}) {
  const cards = [0, 1].map(() => { const s = new Set(); return { s, classList: { add: c => s.add(c), contains: c => s.has(c) } }; });
  const ios = [], unobserved = [];
  class IO { constructor(cb) { this.cb = cb; ios.push(this); } observe() {} unobserve(el) { unobserved.push(el); } disconnect() {} }
  const ctx = vm.createContext({ document: { getElementById: () => ({}), querySelectorAll: () => cards }, prefersReduceMotion: () => reduce, ...(withIO ? { IntersectionObserver: IO } : {}) });
  vm.runInContext(src, ctx); vm.runInContext('initAskCards()', ctx);
  return { cards, ios, unobserved, see: (card, ratio, on = true) => ios[0].cb([{ target: card, isIntersecting: on, intersectionRatio: ratio }]) };
}

test('la carte « pop » une seule fois, quand elle est presque entièrement visible', () => {
  const t = setup();
  assert.equal(t.ios.length, 1);
  t.see(t.cards[0], 0.5); assert.ok(!t.cards[0].classList.contains('is-in'), 'à moitié visible : rien');
  t.see(t.cards[0], 1, false); assert.ok(!t.cards[0].classList.contains('is-in'), 'hors écran : rien');
  t.see(t.cards[0], 0.95); assert.ok(t.cards[0].classList.contains('is-in'));
  assert.deepEqual(t.unobserved, [t.cards[0]], 'elle n’est plus surveillée : l’effet ne se rejoue pas');
  assert.ok(!t.cards[1].classList.contains('is-in'), 'l’autre carte attend son tour');
});

test('mouvement réduit ou navigateur sans observateur : carte statique, rien de surveillé', () => {
  const a = setup({ reduce: true }); assert.equal(a.ios.length, 0);
  const b = setup({ withIO: false }); assert.ok(b.cards.every(c => !c.classList.contains('is-in')));
});

test('mise en forme : carte violette, « ? » en pastille, effet désactivé en mouvement réduit', () => {
  for (const sel of ['.concept-block p.gd-ask', '.gd-ask i', '.gd-ask.is-in i', '@keyframes askPop', '@keyframes askRing', '@media (prefers-reduced-motion:reduce){.gd-ask.is-in', 'html[data-motion="reduce"] .gd-ask.is-in'])
    assert.ok(html.includes(sel), `règle CSS « ${sel} »`);
  const initList = html.slice(html.indexOf('buildSommaire();'), html.indexOf('initConversionFunctions();'));
  assert.ok(initList.includes('initAskCards();'), 'initAskCards est lancé au rendu du cours');
});
