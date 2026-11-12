/* Elisa, 12 novembre, sur l’écran de lancement de l’appli iOS (le lavande et ses points violets) : « Le départ est trop long ça reste
   trop longtemps sur ça ». L’ouverture animée attendait la fin du démarrage (boot) pour partir. Elle part maintenant dès que l’état est
   lu et que le chat et son son sont prêts : boot la lance à sa porte (bootPorte → __introPorte), attend la fin de la construction (les
   cases, la soudure et les lettres), puis reprend pendant la marche du chat sans lancer d’étape juste avant un retour haptique. La
   sortie (le violet qui s’efface) attend l’appli prête (hideLoader → __introJouer). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('ludique.css');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const vider = () => new Promise(r => setImmediate(r));

/* Le script de l’ouverture dans un bac à sable, avec une horloge à nous : les minuteurs partent à leur heure */
function lancer({ natif = true, calme = false, images = true, son = true, cache = false } = {}) {
  const log = [], file = [], frames = [], imgs = [];
  let horloge = 0;
  const L = fauxLoader({ log: [] }), cls = L.cls;
  const perf = { now: () => horloge };
  class Img { set src(u) { this.u = u; imgs.push(this); } decode() { return Promise.resolve(); } }
  class Contexte {
    constructor() { this.state = 'running'; this.destination = {}; }
    decodeAudioData(b, ok) { ok({ son: true }); }
    createBufferSource() { return { connect() {}, start() { log.push('son'); } }; }
    resume() {} close() {}
  }
  const window = { innerWidth: 430, innerHeight: 932, performance: perf };
  if (images) window.Image = Img;
  if (son) { window.AudioContext = Contexte; window.fetch = () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); }
  window.Capacitor = { Plugins: { SplashScreen: { hide: () => log.push('écran retiré') },
    Haptics: { impact: o => log.push('choc ' + o.style), selectionStart() {}, selectionChanged: () => log.push('cran'), selectionEnd() {} } } };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => natif && c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null),
      get visibilityState() { return cache ? 'hidden' : 'visible'; } },
    window, Array, Promise, matchMedia: () => ({ matches: calme }), localStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    navigator: {}, performance: perf, requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => file.push([horloge + (ms || 0), f])
  });
  vm.runInContext(intro, ctx);
  const images2 = () => { frames.splice(0).forEach(f => f()); frames.splice(0).forEach(f => f()); };
  /* Avance l’horloge jusqu’à t, minuteur après minuteur (et les promesses entre deux) */
  const jusqua = async t => {
    for (;;) {
      await vider();
      file.sort((a, b) => a[0] - b[0]);
      if (!file.length || file[0][0] > t) break;
      const [h, f] = file.shift(); horloge = Math.max(horloge, h); f();
    }
    horloge = Math.max(horloge, t); await vider();
  };
  const charger = async () => { imgs.forEach(i => i.onload()); await vider(); await vider(); };
  return { log, cls, L, ctx, w: ctx.window, imgs, frames, images2, jusqua, charger, get t() { return horloge; } };
}

test('la porte : pas encore prêts, le chat et son son se font attendre 250 ms au plus, puis le démarrage continue', async () => {
  const s = lancer();
  assert.equal(typeof s.w.__introPorte, 'function');
  let tenue = false;
  s.w.__introPorte().then(() => { tenue = true; });
  await s.jusqua(200); assert.ok(!tenue, 'le démarrage attend un peu');
  await s.jusqua(270); assert.ok(tenue, 'puis continue sans eux');
  assert.ok(!s.log.includes('écran retiré') && !s.cls.has('is-play'), 'l’ouverture n’est pas partie');
  let tenue2 = false;
  s.w.__introPorte().then(() => { tenue2 = true; });
  await s.jusqua(272); assert.ok(tenue2, 'l’attente est faite une fois pour toutes');
});

test('la porte lance l’ouverture avec le chat, puis retient le démarrage jusqu’à la fin de la construction', async () => {
  const s = lancer();
  await s.charger();
  let tenue = -1;
  s.w.__introPorte().then(() => { tenue = s.t; });
  assert.ok(s.log.includes('écran retiré'), 'l’écran de lancement part dès la porte');
  assert.ok(s.L.html.join('').includes('class="in-k"'), 'les cases se créent');
  s.images2();
  assert.ok(s.cls.has('is-play') && s.cls.has('is-chat'), 'l’ouverture avec le chat');
  const t0 = s.t;
  assert.ok(s.log.includes('son'), 'avec son son');
  await s.jusqua(t0 + 1480); assert.equal(tenue, -1, 'rien pendant les cases, la soudure et les lettres');
  /* La dernière lettre posée à 1 486 ms ; mais pas d’étape à moins de 130 ms d’un retour haptique : le premier pas du chat (1 560 ms) */
  await s.jusqua(t0 + 1600); assert.equal(tenue, t0 + 1568, 'la construction finie et le cran du premier pas passé, le démarrage reprend');
  let tenue2 = -1;
  s.w.__introPorte().then(() => { tenue2 = s.t; });
  await s.jusqua(t0 + 1600); assert.equal(tenue2, t0 + 1600, 'le pas suivant (1 740 ms) est loin : tout de suite');
  await s.jusqua(t0 + 1620);
  let tenue3 = -1;
  s.w.__introPorte().then(() => { tenue3 = s.t; });
  await s.jusqua(t0 + 1800); assert.equal(tenue3, t0 + 1748, 'trop près du pas suivant : après lui');
});

test('la sortie attend l’appli prête : à l’heure si elle l’est, sinon dès qu’elle l’est (la touche remplit l’écran en attendant)', async () => {
  const s = lancer();
  await s.charger();
  s.w.__introPorte(); s.images2();
  const t0 = s.t;
  await s.jusqua(t0 + 2000);
  s.w.__introJouer();                                                // hideLoader : l’appli est prête avant l’heure
  assert.ok(!s.cls.has('is-sortie'));
  await s.jusqua(t0 + 2829); assert.ok(!s.cls.has('is-sortie'));
  await s.jusqua(t0 + 2830); assert.ok(s.cls.has('is-sortie'), 'à son heure (2,83 s avec le chat)');
  await s.jusqua(t0 + 3199); assert.equal(s.L.style.display, undefined);
  await s.jusqua(t0 + 3200); assert.equal(s.L.style.display, 'none', 'rangée après le fondu');

  const r = lancer();
  await r.charger();
  r.w.__introPorte(); r.images2();
  const u0 = r.t;
  await r.jusqua(u0 + 3000); assert.ok(!r.cls.has('is-sortie'), 'pas prête : le violet reste');
  r.w.__introJouer();
  assert.ok(r.cls.has('is-sortie'), 'prête : la sortie part tout de suite');
  await r.jusqua(u0 + 3370); assert.equal(r.L.style.display, 'none');
  r.w.__introJouer(); assert.equal(r.log.filter(l => l === 'écran retiré').length, 1, 'une seule fois');
});

test('sans le chat (ses images manquent), l’ouverture pleine part quand même, et le démarrage attend sa construction', async () => {
  const s = lancer();
  s.imgs.forEach(i => i.onerror()); await s.jusqua(1);
  let tenue = -1;
  s.w.__introPorte().then(() => { tenue = s.t; });
  s.images2();
  const t0 = s.t;
  assert.ok(s.cls.has('is-play') && !s.cls.has('is-chat'));
  await s.jusqua(t0 + 1600);
  assert.equal(tenue, t0 + 1538, 'après la construction, puis l’appui (coup moyen à 1 530 ms)');
});

test('mouvement réduit, appli en arrière-plan : la porte est ouverte ; sur le site, pas de porte', () => {
  assert.equal(lancer({ calme: true }).w.__introPorte(), null);
  const c = lancer({ cache: true });
  assert.equal(c.w.__introPorte(), null); assert.ok(!c.log.includes('écran retiré'), 'l’ouverture attend qu’on la voie');
  assert.equal(lancer({ natif: false }).w.__introPorte, undefined);
  const p = lancer({ images: false, son: false });
  p.w.__introJouer();
  assert.equal(p.w.__introPorte(), null, 'l’appli prête : plus rien n’attend');
});

test('boot passe par la porte une fois l’état lu, entre ses étapes ; la sortie est une classe ; hideLoader passe toujours la main', () => {
  const boot = cut(app, 'async function boot(){', 'function initSpotlight(){');
  assert.equal(boot.split('await bootPorte();').length - 1, 7, 'sept portes');
  assert.ok(boot.indexOf('await bootPorte();') > boot.indexOf('stkSync();'), 'l’état est lu avant la première');
  assert.ok(boot.includes('    await bootPorte();\n    await loadCustomDbs();\n    ensureDemoDbs();'));
  assert.ok(boot.includes('    await bootPorte();\n    maybeOnboard();\n    restoreNav();'));
  assert.ok(boot.indexOf('await bootPorte();') < boot.indexOf('renderModules();') && boot.lastIndexOf('await bootPorte();') < boot.indexOf('hideLoader();'));
  const porte = cut(app, 'function bootPorte(){', '\n}\n');
  assert.ok(porte.includes("typeof window.__introPorte==='function'?window.__introPorte():null"));
  const h = cut(app, 'function hideLoader(){', '\n}\n');
  assert.ok(h.includes("if(loader&&loader.classList.contains('is-intro')&&typeof window.__introJouer==='function'){window.__introJouer();return;}"));
  assert.ok(css.includes('html.is-native.lq #loader.is-intro.is-play.is-sortie{animation:introOut var(--d-sortie) ease-out forwards}'));
  assert.ok(!css.includes('introOut var(--d-sortie) ease-out var(--t-sortie)'), 'plus de sortie à heure fixe en CSS');
});

/* Pendant la marche du chat, le démarrage occupe le fil principal : tout ce qui bouge alors doit pouvoir se jouer dans le
   compositeur (transform, opacité, sans steps(), que WebKit n’y joue jamais). Ses images défilent donc en paliers, à l’identique. */
test('après la construction, l’ouverture ne bouge qu’en transform et opacité, sans steps() : le compositeur la joue seul', () => {
  const regles = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
  const kf = n => {                                                   // le corps de @keyframes n{…}, accolades comptées
    const i = regles.indexOf('@keyframes ' + n + '{'); assert.ok(i >= 0, n);
    let j = regles.indexOf('{', i), p = 0;
    for (let k = j; k < regles.length; k++) { if (regles[k] === '{') p++; else if (regles[k] === '}' && --p === 0) return regles.slice(j + 1, k); }
    assert.fail(n);
  };
  for (const n of ['introChatPas', 'introChatAssis', 'introSautX', 'introSautY', 'introMarcheX', 'introAtterrit', 'introPatte', 'introChatEntree',
    'introPlonge', 'introPose', 'introChevron', 'introCurseur', 'introGlow', 'introFade', 'introOn', 'introOut', 'introApparait']) {
    const props = [...kf(n).matchAll(/[{;]\s*([a-z-]+)\s*:/g)].map(m => m[1]).filter(p => p !== 'animation-timing-function');
    assert.ok(props.length && props.every(p => p === 'transform' || p === 'opacity'), n + ' : ' + props.join(', '));
  }
  assert.ok(!/is-chat\.is-play[^{]*\{animation:[^}]*steps\(/.test(regles), 'plus de steps() dans l’ouverture avec le chat');
  /* Les paliers donnent les mêmes images que steps(12) et steps(11), à chaque instant */
  const points = n => [...kf(n).matchAll(/([\d.%,]+)\{transform:([^}]+)\}/g)].flatMap(r => r[1].split(',').map(o => [parseFloat(o), r[2] === 'none' ? 0 : -parseFloat(r[2].match(/-([\d.]+)%/)[1])])).sort((a, b) => a[0] - b[0]);
  const a = (pts, p) => { for (let i = 0; i < pts.length - 1; i++) { const [x, u] = pts[i], [y, v] = pts[i + 1]; if (p >= x && p <= y) return y === x ? v : u + (v - u) * (p - x) / (y - x); } return pts.at(-1)[1]; };
  for (const [n, pas, fin] of [['introChatPas', 12, -100], ['introChatAssis', 11, -91.6667]]) {
    const pts = points(n);
    for (let i = 0; i < 20000; i++) { const p = i / 200; assert.ok(Math.abs(a(pts, p) - Math.floor(p / 100 * pas) / pas * fin) < 0.001, n + ' à ' + p + ' %'); }
  }
  assert.equal(a(points('introChatAssis'), 100), -91.66667, 'assis, la dernière image reste');
});
