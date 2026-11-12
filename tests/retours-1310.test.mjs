/* Elisa, 11 novembre, 13 h 10 : « en fait justement je veux qu’on retravaille l’animation de lancement et j’adore les
   haptiques ». Entre trois idées, elle choisit « Le logo se construit » : des cases de données arrivent de partout et forment
   la touche >_ et le mot « Requête », un cran par case posée, un coup net quand le logo est complet. Et pour les autres
   ouvertures du jour : « Courte avec vibrations » plutôt qu’un fondu muet.
   L’écran de lancement d’iOS montre 23 points (tests/ios-ecran-lancement.test.mjs) ; la page les reprend au pixel près ; seize
   s’envolent et se posent en diagonale dans la touche, les cases se soudent, la touche tombe sur son socle, les sept autres
   points deviennent les lettres ; on appuie, on plonge. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fauxLoader } from './aide-ouverture.mjs';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
const POINTS = JSON.parse(intro.match(/var POINTS=(\[\[[\d.,[\]\s]+\]\]);/)[1].replace(/\s+/g, ''));
const ORDRE = [];
for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) ORDRE.push([c, r]);
ORDRE.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);

function lancer({ court = false, largeur = 430, hauteur = 932, haptique = true } = {}) {
  const log = [], timers = [], frames = [];
  const L = fauxLoader({ largeur, hauteur });
  const x = new Date(), jour = x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate();
  let t = 0;
  const win = { Capacitor: { Plugins: { SplashScreen: { hide() {} } } }, performance: { now: () => t } };
  if (haptique) win.Capacitor.Plugins.Haptics = { impact: o => log.push([t, o.style]), selectionStart() {}, selectionChanged: () => log.push([t, 'cran']), selectionEnd() {} };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: win, Array, Math, Date, performance: { now: () => t }, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: k => (k === 'rq-intro-jour' && court ? jour : null), setItem() {}, removeItem() {} },
    navigator: { vibrate: ms => log.push([t, 'vibre ' + ms]) },
    requestAnimationFrame: f => frames.push(f), setTimeout: (f, ms) => timers.push([t + (ms || 0), f])
  });
  vm.runInContext(intro, ctx);
  const jouer = () => {
    win.__introJouer(); frames.splice(0).forEach(f => f()); frames.splice(0).forEach(f => f());
    for (;;) { timers.sort((a, b) => a[0] - b[0]); const q = timers.shift(); if (!q || q[0] > 3000) break; t = Math.max(t, q[0]); q[1](); }
    return log;
  };
  return { L, jouer, log };
}

test('le logo se construit : chaque case part de son point (place, taille, couleur), dans l’ordre diagonal, et se pose aux 82 % de son vol', () => {
  const s = lancer(); s.jouer();
  const pts = s.L.querySelectorAll('.in-d'), cases = s.L.querySelectorAll('.in-k');
  assert.equal(pts.length, 23); assert.equal(cases.length, 16);
  const ins = [...s.L.html[1].matchAll(/<i class="in-k" aria-hidden="true" style="--c:(\d);--r:(\d);--a:(\d+)ms;--v:(\d+)ms;--rf:([^;"]+)(;--ombre:rgba\(75,48,204,0\))?"><b>(\d\d)<\/b><\/i>/g)];
  assert.equal(ins.length, 16, 'seize cases, chacune avec son nombre');
  ins.forEach((m, i) => {
    assert.deepEqual([+m[1], +m[2]], ORDRE[i], 'en diagonale, du coin haut gauche au coin bas droit');
    const [a, v] = [+m[3], +m[4]];
    assert.equal(a, 22 * i, 'elles partent toutes les 22 ms');
    assert.ok(Math.abs(a + 0.82 * v - (380 + 32 * i)) <= 1, `case ${i + 1} posée à ${380 + 32 * i} ms`);
    assert.ok(a + v <= 980, 'toutes posées (rebond compris) avant la soudure');
    const coin = ORDRE[i][0] % 3 === 0 && ORDRE[i][1] % 3 === 0;
    assert.equal(m[5] !== '0', coin, 'seuls les quatre coins restent arrondis');
    assert.equal(!!m[6], ORDRE[i][1] < 3, 'seule la rangée du bas garde son épaisseur');
    /* Le départ : le centre du point, et sa taille (30 / 112) */
    const p = pts[i].rect, c = cases[i].rect;
    assert.equal(cases[i].style['--dx'], (p.left + p.width / 2 - c.left - c.width / 2).toFixed(1) + 'px');
    assert.equal(cases[i].style['--dy'], (p.top + p.height / 2 - c.top - c.height / 2).toFixed(1) + 'px');
    assert.equal(cases[i].style['--k'], (30 / 112).toFixed(4));
  });
  /* Les lettres partent des sept derniers points */
  const lettres = s.L.querySelectorAll('.in-l');
  assert.equal(lettres.length, 7);
  lettres.forEach((l, j) => {
    const p = pts[16 + j].rect;
    assert.equal(l.style['--dx'], (p.left + p.width / 2 - l.rect.left - l.rect.width / 2).toFixed(1) + 'px');
    assert.equal(l.style['--a'], 560 + 28 * j + 'ms');
    assert.ok(Math.abs(560 + 28 * j + 0.8 * parseInt(l.style['--v']) - (1110 + 36 * j)) <= 1, `lettre ${j + 1} posée à ${1110 + 36 * j} ms`);
  });
  for (const [k, v] of [['--t-soude', 980], ['--d-soude', 100], ['--t-fin', 1080], ['--t-appui', 1440], ['--d-plonge', 640], ['--t-sortie', 1930], ['--d-sortie', 360]])
    assert.equal(s.L.style[k], v + 'ms', k);
});

test('le logo se construit : aucun trajet n’en croise un autre, sur un grand iPhone comme sur un petit', () => {
  const coupe = (p1, p2, p3, p4) => { const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0; };
  for (const [W, H] of [[430, 932], [393, 852], [375, 667]]) {
    const u = H / 2732, cy = H / 2 - 14 * u;
    const traj = ORDRE.map(([c, r], i) => [[POINTS[i][0] * W, POINTS[i][1] * H], [W / 2 + (-192 + 128 * c) * u, cy + (-192 + 128 * r) * u]]);
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) assert.ok(!coupe(...traj[i], ...traj[j]), `${W} × ${H} : cases ${i + 1} et ${j + 1}`);
  }
});

test('haptique : un cran par case et par lettre, un coup fort pour la touche, un moyen à l’appui', () => {
  const pleine = lancer().jouer();
  assert.deepEqual(pleine.filter(c => c[1] !== 'cran').map(c => c.join(' ')), ['1080 HEAVY', '1530 MEDIUM']);
  assert.equal(pleine.filter(c => c[1] === 'cran').length, 23, 'seize cases, sept lettres');
  assert.deepEqual(lancer({ haptique: false }).jouer().map(c => c.join(' ')), ['1080 vibre 25'], 'sans l’extension : une vibration, la touche entière');
});

/* Elisa, 11 novembre, 17 h 56 : « je n’aime pas l’animation d’arrivée courte, je préfère la longue » */
test('plus de version courte : une ouverture déjà jouée aujourd’hui se rejoue en entier', () => {
  const s = lancer({ court: true }); const log = s.jouer();
  assert.ok(!s.L.cls.has('is-court'));
  assert.equal(log.filter(c => c[1] === 'cran').length, 23, 'toutes les cases et les lettres');
  assert.equal(+parseInt(s.L.style['--t-sortie']) + parseInt(s.L.style['--d-sortie']), 2290, 'l’appli à 2,29 s, comme la première fois');
  assert.ok(!intro.includes('COURTE') && intro.includes("try{localStorage.removeItem('rq-intro-jour');}catch(e){}"));
});

test('styles : les cases recomposent la touche, qui se pose, s’écrit, s’enfonce et plonge ; les lettres sortent de leur point', () => {
  for (const part of [
    /* Une case : à sa place dans la touche, son morceau du dégradé, une épaisseur, un nombre */
    'html.is-native.lq #loader.is-intro .in-k{position:absolute;z-index:1;left:calc(50% + (var(--c)*128 - 248)*var(--u));top:calc(var(--cy) + (var(--r)*128 - 248)*var(--u));',
    'background:linear-gradient(135deg,#8060FF,#593CE7);background-size:calc(448*var(--u)) calc(448*var(--u));',
    'background-position:calc(var(--c)*-112*var(--u)) calc(var(--r)*-112*var(--u));box-shadow:0 calc(8*var(--u)) 0 #4B30CC;',
    /* 12 novembre, 17 h 51 : le voile déborde un peu de la case et couvre son épaisseur, à angle droit comme le point */
    'html.is-native.lq #loader.is-intro .in-k::after{content:"";position:absolute;inset:calc(-2*var(--u)) calc(-2*var(--u)) calc(-10*var(--u)) calc(-2*var(--u));background:#D2C6F7;opacity:0}',
    /* Le vol, la soudure, la touche */
    'html.is-native.lq #loader.is-intro.is-play .in-k{animation:introCase var(--v) linear var(--a) both,introSoude var(--d-soude) cubic-bezier(.5,0,.8,.4) var(--t-soude) forwards,\n  introCoins 1ms linear var(--t-soude) forwards,introFade 1ms linear var(--t-fin) forwards}',
    /* 12 novembre, 17 h 51 (« ça bug au début ») : le vol et la soudure n’animent que transform et opacity (le compositeur les joue seul) */
    '0%{opacity:1;transform:translate(var(--dx),var(--dy)) scale(var(--k));animation-timing-function:cubic-bezier(.5,0,.2,1)}',
    '82%{opacity:1;transform:scale(1.07);animation-timing-function:cubic-bezier(.3,0,.3,1)}',
    '@keyframes introSoude{from{transform:none}to{transform:scale(1.152)}}',
    '@keyframes introVoile{0%{opacity:1}40%,100%{opacity:0}}',
    '@keyframes introCoins{to{border-radius:var(--rf);box-shadow:0 calc(8*var(--u)) 0 var(--ombre,#4B30CC)}}',
    'html.is-native.lq #loader.is-intro.is-play .in-k>b{animation:introNombre var(--v) linear var(--a) both,introFade 90ms linear var(--t-soude) forwards}',
    'html.is-native.lq #loader.is-intro.is-play .logo-badge{animation:introApparait 34ms linear calc(var(--t-fin) - 34ms) forwards,introPose .34s linear var(--t-fin) forwards,introPlonge var(--d-plonge) linear var(--t-appui) forwards}',
    'html.is-native.lq #loader.is-intro.is-play::after{animation:introOn 1ms linear var(--t-fin) forwards,introFade .16s linear calc(var(--t-appui) + 100ms) forwards}',
    'html.is-native.lq #loader.is-intro.is-play::before{animation:introGlow 1.2s cubic-bezier(.2,.7,.3,1) var(--t-fin) forwards}',
    'introChevron .3s cubic-bezier(.3,1.4,.5,1) calc(var(--t-fin) + 40ms) both', 'introCurseur .26s cubic-bezier(.3,.8,.3,1) calc(var(--t-fin) + 130ms) both',
    '14%{transform:translateY(calc(22*var(--u)));', '100%{transform:translateY(calc(14*var(--u))) scale(9)}}',
    /* Les lettres */
    'html.is-native.lq #loader.is-intro .in-l::before{content:"";position:absolute;left:50%;top:50%;width:calc(30*var(--u));height:calc(30*var(--u));',
    'html.is-native.lq #loader.is-intro.is-play .in-l{animation:introLettre var(--v) linear var(--a) both}',
    '0%{transform:translate(var(--dx),var(--dy));animation-timing-function:cubic-bezier(.5,0,.2,1)}',
    '80%{transform:translateY(calc(-10*var(--u))) scale(1.18);animation-timing-function:cubic-bezier(.3,0,.3,1)}',
    'html.is-native.lq #loader.is-intro.is-play .in-l>b{animation:introLettreTxt var(--v) linear var(--a) both}',
    '@keyframes introLettreTxt{0%,55%{opacity:0}80%,100%{opacity:1}}'
  ]) assert.ok(bloc.includes(part), part);
  /* 112 × 1,152 dépasse à peine 128 : les cases se chevauchent d’un fil, la touche (512) les recouvre */
  assert.ok(112 * 1.152 > 128 && 112 * 1.152 < 130);
  assert.ok(Math.abs(448 * 128 / 112 - 512) < 1e-9, 'le dégradé de 448, agrandi de 128/112, fait la touche');
  /* Le press (14 % de la plongée) tombe sur le coup moyen */
  assert.ok(intro.includes("else H.push([T.appui+Math.round(T.dPlonge*0.14),'MEDIUM']);"));
});
