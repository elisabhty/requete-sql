/* Elisa, 30 octobre, 23 h 23 : « micro-interaction quand on appuie sur les boutons stp » (capture de l’entretien : « Comment évalues-tu
   ta réponse ? », « Je maîtrise », « À revoir », « Question suivante »). Partout, appli et vitrine : le bouton s’enfonce sous le doigt
   (CSS) puis rebondit au relâché (assets/curseur.js). Dans l’entretien : la coche qui saute et lâche des confettis, le signet qui
   tombe, l’anneau qui s’échappe, la flèche qui file, l’œil qui cligne, la réponse qui se déplie. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), cur = lire('assets/curseur.js');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i); assert.ok(j > i, b); return src.slice(i, j); };

const APPUI = cur.match(/var APPUI = '([^']+)';/)[1];
const SANS = cur.match(/var SANS_REBOND = '([^']+)';/)[1];

/* curseur.js exécuté dans un faux navigateur au doigt (sans souris) : on récupère l’écouteur du clic */
const lancer = ({ reduit = false, souris = false, drag = false } = {}) => {
  const ecoute = {}, ajoutes = [];
  class CSSAnimation { constructor(etat) { this.playState = etat; } }
  const win = {
    matchMedia: q => ({ matches: /reduced/.test(q) ? reduit : souris }),
    innerWidth: 390, innerHeight: 844,
    getComputedStyle: el => ({ scale: el.scaleCss || 'none' }),
    requestAnimationFrame: f => f(),
    addEventListener() {},
  };
  const ctx = vm.createContext({
    window: win,
    document: {
      documentElement: { style: { setProperty() {} }, classList: { add() {} }, getAttribute: () => null },
      head: { appendChild: n => ajoutes.push(n) },
      body: { classList: { contains: c => drag && c === 'dragging' } },
      createElement: () => ({ style: { setProperty() {} }, setAttribute() {}, classList: { add() {} } }),
      addEventListener: (type, fn, opt) => { (ecoute[type] = ecoute[type] || []).push({ fn, capture: opt === true }); },
    },
    CSSAnimation, encodeURIComponent, Image: function () {}, setTimeout() {}, Math, String,
  });
  ctx.window.CSS = { supports: () => false }; ctx.CSS = ctx.window.CSS;
  vm.runInContext(cur, ctx);
  const clic = ecoute.click && ecoute.click.find(x => x.capture);
  return { clic: clic && clic.fn, ajoutes, CSSAnimation };
};
const bouton = (o = {}) => {
  const el = {
    calls: [], attrs: o.attrs || {}, disabled: !!o.disabled, isConnected: o.connected !== false, scaleCss: o.scale,
    closest: sel => sel === APPUI ? (o.pressable === false ? null : el) : sel === SANS ? (o.exclu ? el : null) : null,
    getAttribute: k => (k in el.attrs ? el.attrs[k] : null), hasAttribute: k => k in el.attrs,
    getBoundingClientRect: () => ({ width: o.w ?? 48, height: o.h ?? 48 }),
    animate: (kf, opt) => { el.calls.push({ kf, opt }); return { cancel() {} }; },
    getAnimations: () => o.anims || [],
  };
  return el;
};

test('le rebond vit dans assets/curseur.js, chargé par l’appli et la vitrine, avant la porte « souris seulement » du curseur', () => {
  const iAppui = cur.indexOf("document.addEventListener('click', function (e) {"), iPorte = cur.indexOf('if (!mq || !mq.matches) return;');
  assert.ok(iAppui > 0 && iPorte > iAppui, 'au doigt comme à la souris');
  assert.equal(APPUI, 'button,summary,[role="button"],[role="tab"],.chip,a.btn,a.nav-cta,a.g,a.arrow');
  assert.equal(SANS, '.stk-item,.stk-cell,.qf-card,.hdl,[data-sans-rebond]', 'ce qui se glisse ne rebondit pas');
  assert.ok(cur.includes('if (!e.detail) return;'), 'ni au clavier ni pour un clic programmé');
  assert.ok(cur.includes("a instanceof CSSAnimation && a.playState === 'running'"), 'un bouton qui saute déjà de lui-même garde son animation');
  assert.ok(cur.includes('}, true);') && cur.includes('window.requestAnimationFrame(function () { rebondir(el, r); });'), 'après les gestionnaires du clic');
  assert.ok(!app.includes('lq-squish') && !app.includes('LQ_SQUISH'), 'une seule mécanique, pas de doublon dans l’appli');
  assert.ok(app.includes("const LQ_PRESS='.journey-primary,") && app.includes('navigator.vibrate(5);'), 'la petite vibration à l’appui reste');
});

test('au relâché, le bouton rebondit : d’autant plus qu’il est petit ; jamais une grande surface, un bouton éteint, remplacé ou déjà animé', () => {
  const { clic, ajoutes } = lancer();
  assert.equal(typeof clic, 'function', 'écouteur posé même sans souris');
  assert.equal(ajoutes.length, 0, 'au doigt : ni feuille de style ni curseur');
  const tape = (el, detail = 1) => { clic({ detail, target: el }); return el.calls; };
  const pic = calls => calls[0].kf.map(k => k.scale);

  let c = tape(bouton());
  assert.equal(c.length, 1);
  assert.deepEqual(Array.from(pic(c)), ['1', '1.06', '0.979', '1'], 'pastille de 48 px : + 6 %, puis un léger retour');
  assert.deepEqual(Array.from(c[0].kf.map(k => k.offset)), [undefined, 0.36, 0.7, undefined]);
  assert.equal(c[0].opt.duration, 420);
  assert.deepEqual(Array.from(pic(tape(bouton({ w: 150, h: 52 })))), ['1', '1.0533', '0.9813', '1'], '150 px : 8 px de plus au plus fort');
  assert.deepEqual(Array.from(pic(tape(bouton({ w: 340, h: 54 })))), ['1', '1.0235', '0.9918', '1'], 'bouton pleine largeur sur iPhone : 8 px aussi');
  assert.deepEqual(Array.from(pic(tape(bouton({ w: 860, h: 72 })))), ['1', '1.01', '0.9965', '1'], 'question de la FAQ sur ordinateur : + 1 %, pas davantage');

  assert.equal(tape(bouton({ w: 360, h: 400 })).length, 0, 'grande carte : pas de rebond');
  assert.equal(tape(bouton(), 0).length, 0, 'clavier');
  assert.equal(tape(bouton({ disabled: true })).length, 0, 'éteint');
  assert.equal(tape(bouton({ attrs: { 'aria-disabled': 'true' } })).length, 0, 'aria-disabled');
  assert.equal(tape(bouton({ attrs: { 'aria-disabled': 'true', 'data-jc-gate': '' } })).length, 1, 'la pastille de fin de leçon, elle, répond');
  assert.equal(tape(bouton({ exclu: true })).length, 0, 'sticker, carte du quiz, poignée');
  assert.equal(tape(bouton({ pressable: false })).length, 0, 'pas un bouton');
  assert.equal(tape(bouton({ connected: false })).length, 0, 'remplacé par le clic');
  assert.equal(tape(bouton({ scale: '1.1' })).length, 0, 'déjà agrandi par le CSS');
});

test('pas de double saut ni de rebond en mouvement réduit ou pendant un glisser', () => {
  const { clic, CSSAnimation } = lancer();
  const a = bouton({ anims: [new CSSAnimation('running')] }); clic({ detail: 1, target: a });
  assert.equal(a.calls.length, 0, 'onglet, jour, choix qui saute en se cochant : son animation suffit');
  const b = bouton({ anims: [new CSSAnimation('finished')] }); clic({ detail: 1, target: b });
  assert.equal(b.calls.length, 1, 'une entrée terminée ne bloque pas');
  const r = lancer({ reduit: true }); const c = bouton(); r.clic({ detail: 1, target: c });
  assert.equal(c.calls.length, 0, 'mouvement réduit');
  const d = lancer({ drag: true }); const e = bouton(); d.clic({ detail: 1, target: e });
  assert.equal(e.calls.length, 0, 'pendant un glisser');
  const s = lancer({ souris: true }); const f = bouton(); s.clic({ detail: 1, target: f });
  assert.equal(f.calls.length, 1, 'à la souris aussi');
});

test('entretien : la coche saute et lâche des confettis, le signet tombe, avec une vibration ; rien en mouvement réduit', () => {
  const src = cut(app, 'function setEntretienMark(id,mark){', 'host.appendChild(b); setTimeout(()=>b.remove(),760);\n}') + 'host.appendChild(b); setTimeout(()=>b.remove(),760);\n}';
  const fabrique = () => {
    const cls = new Set(), enfants = [];
    return { cls, enfants, classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) }, offsetWidth: 1, clientLeft: 2, clientTop: 2,
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 150, height: 50 }), appendChild: n => enfants.push(n),
      querySelector: () => ({ getBoundingClientRect: () => ({ left: 130, top: 216, width: 18, height: 18 }) }) };
  };
  const ok = fabrique(), rev = fabrique(), vibre = [];
  let reduit = false;
  const ctx = vm.createContext({
    state: {}, entRevealed: {}, entOpen: 'e1', save() {}, paintEntFoot() {}, renderEntretien() {},
    prefersReduceMotion: () => reduit, buzz: t => vibre.push(t), setTimeout() {}, clearTimeout() {}, Math,
    document: {
      querySelector: sel => sel.endsWith(' .efoot') ? {} : sel.endsWith('.estat.ok') ? ok : sel.endsWith('.estat.review') ? rev : null,
      createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
    },
  });
  vm.runInContext(src + ';this.mark=setEntretienMark;', ctx);
  ctx.mark('e1', 'ok');
  assert.equal(ctx.state.entretien.e1, 'ok');
  assert.ok(ok.cls.has('is-just'), 'la coche saute');
  assert.equal(ok.enfants.length, 1);
  assert.equal(ok.enfants[0].className, 'lq-burst');
  assert.deepEqual({ left: ok.enfants[0].style.left, top: ok.enfants[0].style.top }, { left: '37px', top: '23px' }, 'les confettis partent du centre de la coche');
  ctx.mark('e1', 'review');
  assert.ok(rev.cls.has('is-just') && rev.enfants.length === 0, 'le signet tombe, sans confettis');
  assert.deepEqual(vibre, ['success', 'light']);
  reduit = true; ok.cls.clear(); ctx.mark('e1', 'ok');
  assert.ok(!ok.cls.has('is-just') && ok.enfants.length === 1, 'mouvement réduit : rien ne bouge');
  /* Révéler : la réponse se déplie */
  const rv = cut(app, 'function revealEntretien(id){', 'function noteCardHtml(');
  assert.ok(rv.includes("if(f&&!prefersReduceMotion())f.classList.add('is-reveal');") && rv.includes("buzz('light');"));
});

test('la feuille de style : coche, signet, anneau, confettis, flèche, œil, réponse qui se déplie ; mouvement réduit', () => {
  const s38 = lq.slice(lq.indexOf('/* ---------- 38.'));
  assert.ok(s38.length > 100, 'section 38');
  for (const part of [
    'html.lq .ent-focus .ent-assessment .estat:active svg{scale:.78}',
    'html.lq .ent-focus .ent-assessment .estat.ok.is-just svg{animation:lqCheckPop',
    'html.lq .ent-focus .ent-assessment .estat.ok.is-just svg path{stroke-dasharray:23;animation:lqCheckDraw',
    'html.lq .ent-focus .ent-assessment .estat.review.is-just svg{transform-origin:50% 0;animation:lqMarkDrop',
    'html.lq .ent-focus .ent-assessment .estat.is-just::after{content:"";position:absolute;inset:-2px;',
    '.estat.ok.is-just::after{--lq-ring:98,214,160}', '.estat.review.is-just::after{--lq-ring:242,194,75}',
    'html.lq .lq-burst{position:absolute;', 'animation:lqBurst .66s', '@keyframes lqBurst{0%{scale:.2;opacity:1}',
    'html.lq .ent-focus .ent-next:active svg{transform:translateX(6px)}', 'html.lq .ent-reveal-primary:active svg{animation:lqBlink',
    'html.lq .ent-focus.is-reveal .ent-answer-card>.ent-answer-label{animation:lqLabelPop', 'html.lq .ent-focus.is-reveal .ent-assessment{animation:lqRevealIn',
    'html.lq .ent-focus.is-reveal .ent-next{animation:lqRevealIn'])
    assert.ok(s38.includes(part), part);
  assert.match(s38, /@media \(prefers-reduced-motion:reduce\)\{[^}]*html\.lq \.lq-burst,[^}]*\{animation:none!important\}/);
  assert.ok(s38.includes('html[data-motion="reduce"].lq .lq-burst'), 'réglage de l’appli');
  /* Le check fait 21,2 de long (5,12 → 10,17 → 20,7) : un tiret de 23 le cache entièrement avant de le dessiner */
  assert.ok(app.includes(`const ENT_OK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';`));
});
