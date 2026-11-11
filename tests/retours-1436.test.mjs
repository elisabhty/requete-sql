/* Elisa, 11 novembre, 14 h 26 : « Est-ce possible de mettre le chat qui marche dessus ? Propose-moi un prompt pour que je
   génère » ; 14 h 36, ses deux GIF sur fond vert : le chat qui marche, et le chat qui s’arrête, s’assoit et tape deux fois de
   ses pattes. Dans l’ouverture pleine (la première du jour), une fois la touche construite, il saute dessus depuis la gauche,
   y marche jusqu’au milieu, s’assoit, tape : la touche s’enfonce, puis la seconde fois c’est la touche Entrée, on plonge.
   Coup léger quand il se pose, un cran par pas, coup moyen au premier coup de pattes, coup fort à la touche Entrée. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url));
const app = lire('index.html').toString();
const css = lire('ludique.css').toString();
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
const attendre = () => new Promise(r => setTimeout(r, 0));

/* Un bac à sable : des images qui se chargent (ou pas), une horloge à nous, l’haptique notée */
function lancer({ images = true, court = false } = {}) {
  const log = [], timers = [], frames = [], charges = [];
  let t = 0;
  const L = fauxLoader();
  class Img { set src(u) { charges.push(u); if (images) queueMicrotask(() => this.onload && this.onload()); } decode() { return Promise.resolve(); } }
  const x = new Date(), jour = x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate();
  const win = { Image: Img, performance: { now: () => t },
    AudioContext: class { decodeAudioData(b, ok) { ok({ son: b.u }); } createBufferSource() { return { connect() {}, start() { log.push([t, 'son ' + this.buffer.son]); } }; } close() {} },
    fetch: u => Promise.resolve({ arrayBuffer: () => Promise.resolve({ u }) }),
    Capacitor: { Plugins: { SplashScreen: { hide() {} }, Haptics: { impact: o => log.push([t, o.style]), selectionStart() {}, selectionChanged: () => log.push([t, 'cran']), selectionEnd() {} } } } };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: win, Array, Math, Date, Promise, matchMedia: () => ({ matches: false }), navigator: {},
    localStorage: { getItem: k => (k === 'rq-intro-jour' && court ? jour : null), setItem() {} },
    requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => timers.push([t + (ms || 0), f])
  });
  vm.runInContext(intro, ctx);
  const jouer = () => {
    win.__introJouer(); frames.splice(0).forEach(f => f()); frames.splice(0).forEach(f => f());
    for (;;) { timers.sort((a, b) => a[0] - b[0]); const q = timers.shift(); if (!q || q[0] > 4000) break; t = Math.max(t, q[0]); q[1](); }
    return log;
  };
  return { L, jouer, log, charges };
}

test('chat : ses images se chargent pendant le démarrage ; prêtes, l’ouverture pleine le fait entrer', async () => {
  const s = lancer();
  assert.deepEqual(s.charges, ['assets/ouverture-chat-marche.webp', 'assets/ouverture-chat-appui.webp']);
  await attendre(); await attendre(); await attendre();
  const log = s.jouer();
  assert.ok(s.L.cls.has('is-chat') && s.L.cls.has('is-play'));
  assert.ok(s.L.html.at(-1) === '<div class="in-chat" aria-hidden="true"><i class="in-chat-y"><i class="in-chat-p"><i class="in-chat-m"><b></b></i><i class="in-chat-a"><b></b></i></i></i></div>');
  for (const [k, v] of [['--t-fin', 1080], ['--t-chat', 1100], ['--d-saut', 280], ['--t-pose', 1380], ['--d-marche', 420], ['--t-arret', 1800],
    ['--t-patte0', 2085], ['--t-appui', 2340], ['--t-chat-fin', 2520], ['--t-sortie', 2830], ['--d-sortie', 360]]) assert.equal(s.L.style[k], v + 'ms', k);
  /* Les coups : la touche entière, il se pose, deux pas, son coup de pattes, la touche Entrée */
  assert.deepEqual(log.filter(c => !(c[1] === 'cran' && c[0] < 1380)).map(c => c.join(' ')),
    ['0 son assets/sons/ouverture-chat.m4a', '1080 HEAVY', '1380 LIGHT', '1560 cran', '1740 cran', '2150 MEDIUM', '2430 HEAVY']);
  assert.equal(s.L.style.display, 'none', 'rangée à 3,2 s');
});

test('chat : ses coups de pattes tombent sur ses images 5 et 9 (70 ms chacune), la touche Entrée au plus bas de l’appui', () => {
  const C = JSON.parse('{' + intro.match(/var CHAT=\{(soude:[^}]*?),k:PLEINE\.k,l:PLEINE\.l\};/)[1].replace(/(\w+):/g, '"$1":') + '}');
  assert.equal(C.patte, C.arret + 5 * 70);
  assert.equal(C.appui + Math.round(C.dPlonge * 0.14), C.arret + 9 * 70);
  assert.ok(C.pose - 1326 >= 25, 'il se pose après la dernière lettre');
  assert.ok(C.chat > C.fin, 'il saute une fois la touche entière');
});

test('chat : sans ses images à temps, l’ouverture pleine se joue sans lui ; jamais dans la version courte', async () => {
  const s = lancer({ images: false });
  await attendre(); await attendre(); await attendre();
  const log = s.jouer();
  assert.ok(!s.L.cls.has('is-chat') && s.L.cls.has('is-play'));
  assert.ok(!s.L.html.join('').includes('in-chat'));
  assert.deepEqual(log.filter(c => c[1] !== 'cran').map(c => c.join(' ')), ['0 son assets/sons/ouverture.m4a', '1080 HEAVY', '1530 MEDIUM']);
  const c = lancer({ court: true });
  assert.deepEqual(c.charges, [], 'la version courte ne charge pas le chat');
  await attendre();
  c.jouer();
  assert.ok(!c.L.cls.has('is-chat') && c.L.cls.has('is-court'));
});

test('chat : ses deux bandes de 12 images, détourées, et leur défilé par crans derrière la touche', () => {
  for (const n of ['marche', 'appui']) {
    const b = lire(`assets/ouverture-chat-${n}.webp`);
    assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.toString('latin1', 8, 16), 'WEBPVP8X');
    assert.ok(b[20] & 0x10, `${n} : avec transparence`);
    assert.deepEqual([b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1], [12 * 356, 357], `${n} : 12 images de 356 × 357`);
    assert.ok(b.length < 300000, `${n} : ${b.length} octets`);
  }
  for (const part of [
    'html.is-native.lq #loader.is-intro .in-chat{position:absolute;z-index:1;left:calc(50% - 210*var(--u));top:calc(50% - 653*var(--u));',
    'width:calc(420*var(--u));height:calc(420*var(--u));opacity:0;will-change:transform}',
    'background:url(assets/ouverture-chat-marche.webp) 0 0/100% 100% no-repeat;will-change:transform}',
    'html.is-native.lq #loader.is-intro .in-chat-a>b{background-image:url(assets/ouverture-chat-appui.webp)}',
    'html.is-native.lq #loader.is-intro.is-chat.is-play .in-chat-m>b{animation:introChatPas 720ms steps(12) var(--t-pose) infinite both}',
    'html.is-native.lq #loader.is-intro.is-chat.is-play .in-chat-a>b{animation:introChatAssis 770ms steps(11) var(--t-arret) both}',
    '@keyframes introChatPas{from{transform:none}to{transform:translateX(-100%)}}', '@keyframes introChatAssis{from{transform:none}to{transform:translateX(-91.6667%)}}',
    'introAtterrit 260ms linear var(--t-pose),introPatte 260ms linear var(--t-patte0),introPlonge var(--d-plonge) linear var(--t-appui) forwards}',
    'introChatEntree var(--d-plonge) linear var(--t-appui) forwards}',
    '@keyframes introSautX{from{transform:translateX(calc(-50vw - 230*var(--u)))}to{transform:translateX(calc(-130*var(--u)))}}',
    'introMarcheX var(--d-marche) cubic-bezier(.25,0,.6,1) var(--t-pose) forwards,introFade .18s linear var(--t-chat-fin) forwards}',
    'html.is-native.lq #loader.is-intro.fatal :is(.in-d,.in-k,.in-chat){display:none}'
  ]) assert.ok(bloc.includes(part), part);
  /* Ses pattes (en bas de l’image, ligne 334 sur 357) 10 unités sous le haut de la touche (-270), derrière elle (z-index 1 < 2) */
  assert.ok(Math.abs(-653 + 420 * 334 / 357 - (-270 + 10)) < 2);
  assert.ok(bloc.includes('.logo-badge{position:absolute;z-index:2;'));
  /* L’outil qui détoure les GIF */
  const py = lire('tools/chat-ouverture.py').toString();
  assert.ok(py.includes("alpha = np.clip((130 - (g - m)) / (130 - 45), 0, 1)") && py.includes("save(sortie, 'WEBP', quality=90, alpha_quality=100, method=6)"));
});

test('chat : son propre son, avec le miaou, plus long d’une seconde', () => {
  const b = lire('assets/sons/ouverture-chat.m4a');
  assert.equal(b.toString('latin1', 4, 8), 'ftyp');
  const i = b.indexOf('mvhd'), v = b[i + 4];
  const [echelle, duree] = v === 1 ? [b.readUInt32BE(i + 24), Number(b.readBigUInt64BE(i + 28))] : [b.readUInt32BE(i + 16), b.readUInt32BE(i + 20)];
  assert.ok(Math.abs(duree / echelle - 3.5) < 0.06, `${(duree / echelle).toFixed(3)} s`);
  const py = lire('tools/sons/ouverture.py').toString();
  for (const l of ['POSE = 1.380', 'PAS = [1.560, 1.740]', 'MIAOU = 2.010', 'PATTE = 2.150', 'APPUI_CHAT = 2.340 + 0.64 * 0.14', 'ARRIVEE_CHAT = 2.830',
    "os.path.join(RACINE, 'assets', 'sons', 'miaou.wav')", 'composer(False)\ncomposer(True)']) assert.ok(py.includes(l), l);
  assert.ok(intro.includes("charger('base','assets/sons/ouverture.m4a');") && intro.includes("if(window.Image)charger('chat','assets/sons/ouverture-chat.m4a');"));
});
