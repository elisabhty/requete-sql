/* Démarrage des animations (scènes du Problème et du cours, cartes d'envoi) : elles ne se lancent que lorsqu'elles sont
   entièrement visibles (hors en-tête et barre du bas) et que l'écran ne bouge plus depuis un court instant — on voit
   donc toujours leur début, même en faisant défiler vite. Avant : elles partaient dès que leur bord haut entrait dans l'écran. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const a = html.indexOf('/* ---------- Démarrage des animations ----------');
const b = html.indexOf('function initProbScenes(){');
assert.ok(a > 0 && b > a, 'bloc « Démarrage des animations » présent');
const src = html.slice(a, b);

test('les scènes et les cartes d’envoi passent par playWhenSettled (plus de départ au simple passage)', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  assert.ok(/root\.querySelector\('\.pr-replay'\)\.addEventListener\('click',play\);\s*playWhenSettled\(root,play\);/.test(mount), 'moteur des scènes');
  assert.ok(!mount.includes('IntersectionObserver'), 'plus d’observateur dans le moteur des scènes');
  const sms = html.slice(html.indexOf('function initQueryFill('), html.indexOf('const reduce=window.matchMedia', html.indexOf('function initQueryFill(')));
  assert.ok(/cancel=playWhenSettled\(el,\(\)=>\{cancel=null;play\(\);\}\)/.test(sms), 'cartes d’envoi');
  assert.ok(/el\._actRearm=/.test(sms), 'la carte « Mission accomplie » réarme l’attente quand elle s’ouvre');
  assert.ok(!html.includes("rootMargin:'0px 0px -30% 0px'"), 'ancien départ (haut du bloc au tiers inférieur de l’écran) retiré');
});

/* Environnement simulé : écran de 800 px, en-tête collant jusqu'à 60 px, barre du bas à partir de 720 px. */
function env() {
  let now = 1000;
  const timers = [];
  const listeners = [];
  const screen = { getBoundingClientRect: () => ({ top: 0, bottom: 800 }) };
  const ctx = vm.createContext({
    window: { innerHeight: 800, addEventListener: (t, f) => listeners.push(['w', t, f]), removeEventListener: (t, f) => { const i = listeners.findIndex(l => l[0] === 'w' && l[1] === t && l[2] === f); if (i >= 0) listeners.splice(i, 1); } },
    document: {
      addEventListener: (t, f) => listeners.push(['d', t, f]),
      removeEventListener: (t, f) => { const i = listeners.findIndex(l => l[0] === 'd' && l[1] === t && l[2] === f); if (i >= 0) listeners.splice(i, 1); },
      querySelector: sel => sel.endsWith('.navbar') ? { getBoundingClientRect: () => ({ top: 0, bottom: 60, height: 60 }) } : sel.endsWith('.ls-nav') ? { getBoundingClientRect: () => ({ top: 720, bottom: 794, height: 74 }) } : null,
    },
    performance: { now: () => now },
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    clearTimeout: () => {},
  });
  vm.runInContext(src, ctx);
  const call = code => vm.runInContext(code, ctx);
  const fakeEl = (top, height, connected = true) => ({ isConnected: connected, closest: () => screen, getBoundingClientRect: () => ({ top, bottom: top + height, width: 300, height }) });
  return { ctx, call, listeners, timers, fakeEl, advance: ms => { now += ms; } };
}

test('visible en entier et écran arrêté : l’animation démarre, puis l’attente et les écouteurs disparaissent', () => {
  const e = env();
  let started = 0;
  e.ctx.el = e.fakeEl(100, 285);
  e.ctx.start = () => { started++; };
  e.call('playWhenSettled(el,start)');
  assert.equal(e.listeners.length, 2, 'écoute du défilement et du redimensionnement');
  e.advance(600);
  e.call('playCheck()');
  assert.equal(started, 1, 'démarrée');
  assert.equal(e.call('PLAY_WAIT.size'), 0, 'plus en attente');
  assert.equal(e.listeners.length, 0, 'plus d’écouteur quand plus rien n’attend');
});

test('on ne démarre pas pendant que l’écran bouge : il faut 550 ms sans défilement', () => {
  const e = env();
  let started = 0;
  e.ctx.el = e.fakeEl(100, 285);
  e.ctx.start = () => { started++; };
  e.call('playWhenSettled(el,start)');
  e.advance(300); e.call('playCheck()');
  assert.equal(started, 0, '300 ms après l’enregistrement : trop tôt');
  e.advance(300); e.call('playNote()');            /* un défilement */
  e.advance(300); e.call('playCheck()');
  assert.equal(started, 0, '300 ms après le dernier défilement : trop tôt');
  e.advance(300); e.call('playCheck()');
  assert.equal(started, 1, '600 ms après le dernier défilement : elle démarre');
});

test('coupée en haut (sous l’en-tête) ou en bas (sous la barre), elle attend d’être entièrement visible', () => {
  const e = env();
  let started = 0;
  e.ctx.top = e.fakeEl(30, 285);                    /* sous l'en-tête (60 px) */
  e.ctx.bot = e.fakeEl(600, 285);                   /* dépasse la barre du bas (720 px) */
  e.ctx.ok = e.fakeEl(300, 285);
  e.ctx.start = () => { started++; };
  e.call('playWhenSettled(top,start); playWhenSettled(bot,start)');
  e.advance(2000); e.call('playCheck()');
  assert.equal(started, 0, 'ni l’une ni l’autre');
  assert.equal(e.call('PLAY_WAIT.size'), 2, 'elles attendent toujours');
  assert.equal(e.call('playVisible(ok)'), true);
  assert.equal(e.call('playVisible(top)'), false);
  assert.equal(e.call('playVisible(bot)'), false);
  assert.equal(e.call('playVisible(Object.assign({},ok,{getBoundingClientRect:()=>({top:64,bottom:349,width:300,height:285})}))'), true, 'juste sous l’en-tête : visible');
  assert.equal(e.call('playVisible(Object.assign({},ok,{getBoundingClientRect:()=>({top:60,bottom:345,width:300,height:0})}))'), false, 'bloc masqué (hauteur nulle)');
});

test('une animation haute (carte d’envoi) démarre dès que son haut est à l’écran et qu’on en voit 70 %, sans pixel près', () => {
  const e = env();                                   /* zone visible : de 60 à 720 px = 660 px */
  e.ctx.tall = e.fakeEl(300, 609);                   /* 609 px : plus de 60 % de la zone, 420 px visibles ≥ 70 % de 609 ? non : 420 < 426 */
  e.ctx.tall2 = e.fakeEl(250, 609);                  /* 470 px visibles : oui */
  e.ctx.high = e.fakeEl(20, 609);                    /* le haut passe sous l'en-tête : pas encore */
  e.ctx.huge = e.fakeEl(100, 1500);                  /* très haute : 620 px visibles ≥ 70 % de la zone (462) */
  assert.equal(e.call('playVisible(tall)'), false, '420 px visibles sur 609 : pas assez');
  assert.equal(e.call('playVisible(tall2)'), true, '470 px visibles sur 609 : on voit le début');
  assert.equal(e.call('playVisible(high)'), false, 'le haut est caché sous l’en-tête');
  assert.equal(e.call('playVisible(huge)'), true, 'une animation plus haute que l’écran : on voit son début');
  e.ctx.mid = e.fakeEl(100, 380);                    /* 380 px ≤ 60 % de 660 : entière exigée */
  e.ctx.mid2 = e.fakeEl(400, 380);
  assert.equal(e.call('playVisible(mid)'), true);
  assert.equal(e.call('playVisible(mid2)'), false, 'dépasse la barre du bas');
});

test('un bloc retiré de la page (on a quitté le cours) n’attend plus', () => {
  const e = env();
  e.ctx.gone = e.fakeEl(100, 285, false);
  e.ctx.start = () => { throw new Error('ne doit pas démarrer'); };
  e.call('playWhenSettled(gone,start)');
  e.advance(2000); e.call('playCheck()');
  assert.equal(e.call('PLAY_WAIT.size'), 0);
  assert.equal(e.listeners.length, 0);
});

test('annuler l’attente (carte « Mission accomplie » réarmée) ne laisse pas de doublon', () => {
  const e = env();
  let started = 0;
  e.ctx.el = e.fakeEl(100, 285);
  e.ctx.start = () => { started++; };
  e.ctx.cancel = e.call('playWhenSettled(el,start)');
  e.call('cancel()');
  assert.equal(e.call('PLAY_WAIT.size'), 0);
  e.call('playWhenSettled(el,start); playWhenSettled(el,start)');
  assert.equal(e.call('PLAY_WAIT.size'), 1, 'un seul départ par élément');
  e.advance(600); e.call('playCheck()');
  assert.equal(started, 1);
});
