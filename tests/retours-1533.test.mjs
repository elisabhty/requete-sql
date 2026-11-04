/* 4 novembre, 15 h 33 (Elisa : « Corrige », sur la capture d’une testeuse : « Ici signer ça laisse pas de temps non plus ? Genre j’ai
   dessiné c’est parti vite »). Sur « Ton engagement », un trait tiré de gauche à droite dans le cadre était pris pour le balayage de
   l’onboarding (la page repartait en arrière ; de droite à gauche, une fois signé : « Je m’engage »), et « Signé ✓ » tombait dès la fin
   du premier trait. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

/* Le cadre, le bouton et la carte, en petit : assez pour la signature */
const banc = () => {
  const cls = () => { const s = new Set(); return { s, add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) }; };
  const minuteurs = [];
  const box = { classList: cls(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 120 }) };
  const g = { scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {}, clearRect() {} };
  const cv = { parentElement: box, isConnected: true, width: 0, height: 0, getContext: () => g, getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 120 }),
    setPointerCapture() {}, toDataURL: () => 'data:image/png;base64,SIGNE' };
  const btn = { disabled: true }, carte = { classList: cls() }, reveils = [], vibrations = [];
  const ctx = vm.createContext({ draft: { pacte: null }, window: { devicePixelRatio: 2 }, Image: function () {}, Math,
    document: { getElementById: id => (id === 'ob-sign-cv' ? cv : id === 'ob-next' ? btn : null), querySelector: s => (s === '#ob-body .ob-pact-card' ? carte : null) },
    obCtaWake: b => reveils.push(b), buzz: k => vibrations.push(k),
    setTimeout: (f, ms) => { minuteurs.push({ f, ms, fait: false }); return minuteurs.length; }, clearTimeout: id => { if (minuteurs[id - 1]) minuteurs[id - 1].fait = true; } });
  vm.runInContext(cut('const OB_SIGNE_PAUSE=', 'function obSignClear(){') + ';this.OB_SIGNE_PAUSE=OB_SIGNE_PAUSE;', ctx);
  ctx.obSignInit();
  const ev = (x, y) => { const e = { clientX: x, clientY: y, pointerId: 1, arrete: false, stopPropagation() { e.arrete = true; }, preventDefault() {} }; return e; };
  const trait = (x0, x1, y = 60) => { const d = ev(x0, y); cv.onpointerdown(d); for (let x = x0; x <= x1; x += 10) cv.onpointermove(ev(x, y + (x % 20 ? 8 : -8))); const u = ev(x1, y); cv.onpointerup(u); return [d, u]; };
  const attente = () => minuteurs.filter(m => !m.fait);
  const finir = () => { for (const m of attente()) { m.fait = true; m.f(); } };
  return { ctx, cv, box, btn, carte, reveils, vibrations, trait, attente, finir, ev };
};

test('un trait dans le cadre ne fait plus changer d’étape', () => {
  const b = banc();
  const [bas, haut] = b.trait(20, 200);
  assert.ok(bas.arrete && haut.arrete, 'le geste reste dans le cadre (le balayage de l’onboarding ne le voit pas)');
  /* Et le balayage lui-même ne démarre pas d’un cadre où l’on dessine ou glisse */
  const sw = cut('function brancherObSwipeV2(){', '/* 3 novembre, 23 h 21');
  assert.ok(sw.includes("if(e.target&&e.target.closest&&e.target.closest('.ob-sign,.ob-tv-ph,input,textarea,[role=\"slider\"]')){actif=false;return;}\n    x0=e.clientX;y0=e.clientY;actif=true;"));
  let actif = null;
  const zone = { addEventListener: (t, f) => { zone[t] = f; } };
  const ctx = vm.createContext({ obSwipe2On: false, document: { querySelector: s => (s === '.ob-slides' ? zone : null), getElementById: () => ({ style: {}, disabled: false, click() { actif = 'suivant'; } }) }, obBack: () => { actif = 'retour'; } });
  vm.runInContext('var obSwipe2On=false;' + sw, ctx);
  ctx.brancherObSwipeV2();
  const geste = (cible, x0, x1) => { actif = null; zone.pointerdown({ pointerType: 'touch', clientX: x0, clientY: 300, target: { closest: s => (cible && s.includes(cible) ? {} : null) } }); zone.pointerup({ clientX: x1, clientY: 300 }); return actif; };
  assert.equal(geste('.ob-sign', 20, 240), null, 'signer de gauche à droite : on reste');
  assert.equal(geste('.ob-sign', 240, 20), null, 'de droite à gauche non plus');
  assert.equal(geste(null, 20, 240), 'retour', 'ailleurs, le balayage marche toujours');
  assert.equal(geste(null, 240, 20), 'suivant');
});

test('« Signé ✓ » attend la fin de la signature : une pause sans nouveau trait', () => {
  const b = banc();
  assert.equal(b.ctx.OB_SIGNE_PAUSE, 1200);
  b.trait(20, 120);
  assert.equal(b.ctx.draft.pacte, null, 'pas encore signé à la fin du premier trait');
  assert.ok(!b.box.classList.contains('is-signed') && b.btn.disabled && !b.carte.classList.contains('is-signed'));
  assert.deepEqual(b.attente().map(m => m.ms), [1200]);
  /* Un deuxième trait, avant la fin de la pause : la validation attend encore */
  b.trait(140, 260);
  assert.deepEqual(b.attente().map(m => m.ms), [1200], 'la pause repart du dernier trait');
  b.finir();
  assert.equal(b.ctx.draft.pacte, 'data:image/png;base64,SIGNE');
  assert.ok(b.box.classList.contains('is-signed') && b.carte.classList.contains('is-signed'), 'le tampon tombe');
  assert.equal(b.btn.disabled, false); assert.equal(b.reveils.length, 1, '« Je m’engage » se réveille');
  assert.deepEqual(b.vibrations, ['success']);
});

test('un point ne signe pas ; un trait commencé pendant la pause la remet à zéro', () => {
  const b = banc();
  b.cv.onpointerdown(b.ev(50, 60)); b.cv.onpointermove(b.ev(60, 62)); b.cv.onpointerup(b.ev(60, 62));
  assert.equal(b.attente().length, 0, 'moins de 40 px d’encre');
  b.trait(20, 200);
  b.cv.onpointerdown(b.ev(210, 60));
  assert.equal(b.attente().length, 0, 'le doigt est reposé : on attend la fin de ce trait');
  b.cv.onpointermove(b.ev(260, 70)); b.cv.onpointerup(b.ev(260, 70));
  b.finir();
  assert.ok(b.box.classList.contains('is-signed'));
});
