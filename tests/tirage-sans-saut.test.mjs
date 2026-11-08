/* Elisa, 8 novembre, 10 h 10 : « l’écran avec les cartes saute parfois ».
   - Au tirage, le paquet de cartes et le défi tiré sont dans la même pile (.jeu-pile) : le paquet s’efface sur place et le défi
     apparaît à sa place, au lieu de replier le paquet et d’ajouter le défi dessous ; la scène garde sa hauteur, le titre ne bouge plus.
   - Seul en ligne, la scène d’attente (le temps que le serveur réponde) devient le tirage sur place, sans être redessinée : les cartes
     continuent de se mélanger, la scène ne rejoue pas son entrée. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const line = name => cut(`function ${name}(`, '\n') + '\n';

test('le paquet et le défi tiré dans la même pile, dans le tirage comme dans la scène d’attente', () => {
  const r = fn('jeuRender');
  assert.ok(r.includes('<div class="jeu-pile"><div class="jeu-deck" aria-hidden="true"><i></i><i></i><i></i><b class="jeu-count" id="jeu-count">3</b></div>\n        ${jeuDrawnHTML(c)}</div>'));
  assert.ok(r.includes('<div class="jeu-pile"><div class="jeu-deck" aria-hidden="true"><i></i><i></i><i></i></div></div>'), 'la scène d’attente du joueur seul');
  for (const k of ['html.lq .jeu-pile{display:grid;place-items:center;width:100%}', 'html.lq .jeu-pile>*{grid-area:1/1}', 'html.lq .jeu-pile>.jeu-drawn{margin:0;max-width:100%}',
    'html.lq #scr-lesson .jeu-draw.is-reveal .jeu-pile>.jeu-deck{height:170px;margin:52px auto 40px;opacity:0;scale:1.05;overflow:visible;transition:opacity .25s ease,scale .3s ease}',
    '@media (prefers-reduced-motion:reduce){html.lq #scr-lesson .jeu-draw.is-reveal .jeu-pile>.jeu-deck{transition:none}}'])
    assert.ok(lq.includes(k), k);
});

test('seul en ligne : la scène d’attente devient le tirage sur place, sans être redessinée', () => {
  assert.ok(fn('jeuRender').includes("if(J.view==='lobby'&&J.solo&&v==='draw0'&&jeuDrawEnPlace(0)){J.view=v;J.sig=sig;J.keep=null;jeuAnnounce();return;}"));
  const ajouts = [], appels = [], cls = new Set(['jeu-draw', 'is-wait']);
  const el = nom => ({nom, insertAdjacentHTML: (ou, h) => ajouts.push([nom, ou, h]), removeAttribute: a => appels.push(['sans', nom, a]), textContent: ''});
  const pile = el('pile'), deck = el('deck'), note = el('note'), kicker = el('kicker');
  const box = {dataset: {}, classList: {contains: c => cls.has(c), remove: c => cls.delete(c)},
    querySelector: q => ({'.jeu-pile': pile, '.jeu-deck': deck, '.jeu-draw-note': note, '.l-kicker': kicker})[q] || null};
  const ctx = vm.createContext({
    JEU: {nb: 3, solo: true, rounds: [{cid: 'af1', t0: 0, t1: 3300}], drawT: []}, CHALLENGES: [{id: 'af1', niv: 'f', titre: 'Les vols <retardés>'}],
    JEU_NIVL: {f: 'Facile'}, esc: s => String(s).replace(/</g, '&lt;'), document: {getElementById: id => (id === 'jeu-draw' ? box : null)},
    jeuNivBars: k => `<i class="jeu-bars is-${k}"></i>`, jeuDrawNote: () => 'Un défi au hasard, au niveau choisi.',
    jeuDrawTimers: n => appels.push(['minuteurs', n]), jeuDrawStep: n => appels.push(['pas', n]),
  });
  vm.runInContext(fn('jeuDrawEnPlace') + line('jeuDrawnHTML'), ctx);
  assert.equal(ctx.jeuDrawEnPlace(0), true);
  assert.ok(!cls.has('is-wait') && box.dataset.step === '3', 'la scène devient le tirage');
  assert.equal(kicker.textContent, 'Manche 1/3 · Facile');
  assert.deepEqual(ajouts.map(a => a.slice(0, 2)), [['deck', 'beforeend'], ['pile', 'beforeend']]);
  assert.equal(ajouts[0][2], '<b class="jeu-count" id="jeu-count">3</b>', 'le compte à rebours dans le paquet');
  assert.ok(ajouts[1][2].startsWith('<div class="jeu-drawn" id="jeu-drawn" role="status" aria-live="polite" hidden>') && ajouts[1][2].includes('<b>Les vols &lt;retardés></b>'), 'le défi tiré dans la pile, échappé');
  assert.equal(note.textContent, 'Un défi au hasard, au niveau choisi.');
  assert.deepEqual(appels, [['sans', 'note', 'role'], ['minuteurs', 0], ['pas', 0]]);
  /* Pas de scène d’attente à l’écran : on redessine comme d’habitude */
  cls.delete('is-wait');
  assert.equal(ctx.jeuDrawEnPlace(0), false);
});
