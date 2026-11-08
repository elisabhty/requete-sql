/* Elisa, 6 novembre, 10 h 31 (capture du bilan d’une partie seule, « Manche abandonnée », « Close par l’hôte ») : « on a une
   notification d’indice alors que la salle est fermée ». La pastille « Nouvel indice · le voir » ne surveillait que la case de
   l’indice ; quand la salle passait au bilan, l’écran entier était remplacé et la pastille restait jusqu’à 6 secondes, montrée par
   l’IntersectionObserver puisque la carte n’était plus à l’écran. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

function monde({ view = 'play0', closed = false } = {}) {
  const ios = [], mos = [], timers = [];
  let peek = null;
  const body = { appendChild: el => { peek = el; el.isConnected = true; el.remove = () => { el.isConnected = false; if (peek === el) peek = null; }; } };
  const c = vm.createContext({
    COACH: { kind: 'room', round: 0, diag: '' }, JEU: { view, rounds: [{ closed, done: false }] },
    document: { body, getElementById: id => (id === 'coach-peek' ? peek : null), createElement: () => ({ classList: { add() {} } }) },
    IntersectionObserver: class { constructor(f) { this.f = f; this.off = false; ios.push(this); } observe() {} disconnect() { this.off = true; } },
    MutationObserver: class { constructor(f) { this.f = f; this.off = false; mos.push(this); } observe() {} disconnect() { this.off = true; } },
    setTimeout: (f, ms) => timers.push([f, ms]), prefersReduceMotion: () => true,
  });
  vm.runInContext(cut('function coachEnJeu(){', 'function coachVoir(i){'), c);
  return { c, ios, mos, timers, peek: () => peek };
}

test('en jeu : la pastille arrive avec l’indice ; dès que la carte quitte la page (le bilan), elle part', () => {
  const m = monde(), card = { isConnected: true, scrollIntoView() {} };
  m.c.card = card; vm.runInContext('coachPeek(card,true)', m.c);
  const b = m.peek();
  /* 8 novembre, 19 h 18 : un indice qui arrive, même sans essai raté, se dit « Un coup de patte ? · voir l’indice » */
  assert.ok(b && b.id === 'coach-peek' && b.innerHTML.includes('Un coup de patte\u00a0? · voir l’indice'));
  m.ios[0].f([{ isIntersecting: false }]); assert.equal(b.hidden, false, 'la carte hors de l’écran : la pastille se montre');
  /* La salle passe au bilan : tout l’écran est remplacé, la carte n’est plus dans la page */
  card.isConnected = false; m.c.JEU.view = 'final';
  m.mos[0].f([]);
  assert.equal(m.peek(), null, 'plus de pastille sur le bilan');
  assert.ok(m.ios[0].off && m.mos[0].off, 'les observateurs sont arrêtés');
});

/* 8 novembre, 9 h 31 : le chrono à 0 ne ferme plus la salle, il termine la manche (on passe à ses résultats, « res0 ») */
test('la carte encore là, mais la manche close, finie au chrono ou la partie finie : la pastille part aussi', () => {
  for (const change of [J => { J.rounds[0].closed = true; }, J => { J.view = 'res0'; }, J => { J.view = 'final'; }]) {
    const m = monde(), card = { isConnected: true, scrollIntoView() {} };
    m.c.card = card; vm.runInContext('coachPeek(card,true)', m.c);
    change(m.c.JEU);
    m.ios[0].f([{ isIntersecting: false }]);
    assert.equal(m.peek(), null);
  }
});

test('pas de partie en cours : la pastille ne naît pas', () => {
  for (const o of [{ view: 'final' }, { view: 'res0' }, { closed: true }]) {
    const m = monde(o), card = { isConnected: true, scrollIntoView() {} };
    m.c.card = card; vm.runInContext('coachPeek(card,true)', m.c);
    assert.equal(m.peek(), null, JSON.stringify(o));
  }
  /* Un défi seul (hors salle) garde sa pastille tant que la carte est là */
  const m = monde({ view: 'final' }), card = { isConnected: true, scrollIntoView() {} };
  m.c.COACH.kind = 'solo'; m.c.card = card; vm.runInContext('coachPeek(card,false)', m.c);
  assert.ok(m.peek());
});

test('la salle qui change de vue hors jeu, ou qu’on quitte, retire la pastille ; la page entière est surveillée', () => {
  assert.ok(cut('function jeuRender(){', '\n  J.drawT.forEach(clearTimeout)').includes("if(!/^play/.test(v)&&typeof coachPeekOff==='function')coachPeekOff();"));
  assert.ok(cut('function jeuStop(){', '\n}').includes("if(typeof coachPeekOff==='function')coachPeekOff();"));
  const peek = cut('function coachPeek(card,hint){', '\n}');
  assert.ok(peek.includes('mo.observe(document.body,{childList:true,subtree:true});') && !peek.includes('mo.observe(sl,'));
});
