/* Elisa, 31 octobre, 9 h 24 : six retours.
   « Le scroll est très compliqué sur mobile -> enquête sur le pb car ça fait plusieurs fois que je te le dis et ça fait comme avant » ;
   Réf 1 « De ta base de donnée » (le chargement) ; Réf 2 « améliorer le tu es ici et l’animation » ; Réf 3 « fait attention à la
   responsivité » (Défis) ; Réf 4 « mettre aussi le lien avec les personnes qu’on a joué, par exemple un podium animé » ;
   Réf 5 « est-ce qu’on peut améliorer l’espace du bas ? En bas de la barre de nav je trouve ça fait bizarre ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s48 = css.slice(css.indexOf('48. Retours de 9 h 24'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const plain = v => JSON.parse(JSON.stringify(v));

/* Tous les addEventListener tactiles (touchstart, touchmove, wheel) : leur cible et s’ils bloquent le défilement. */
function touchCalls() {
  const out = [], re = /([\w$]+)?(\.)?addEventListener\('(touchmove|touchstart|wheel)'/g;
  let m;
  while ((m = re.exec(app))) {
    let i = m.index + m[0].length, depth = 1, q = null;
    for (; i < app.length && depth; i++) {
      const c = app[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') q = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    const call = app.slice(m.index, i);
    out.push({ target: m[2] ? m[1] : 'window', type: m[3], blocking: /\{passive:false\}\)$/.test(call), head: call.split('\n')[0].trim() });
  }
  return out;
}

test('défilement : aucun écouteur tactile bloquant sur un parent des écrans (la scène, #app, la page)', () => {
  const ptr = cut('(function pullToRefresh(){', '/* #app et la scène ne défilent jamais');
  /* La cause du défilement « très compliqué » : l’écouteur non passif de « Tirer pour actualiser », posé sur la scène,
     l’ancêtre de tous les écrans. Safari attendait le script avant chaque défilement. */
  assert.ok(!ptr.includes('passive:false') && !ptr.includes('preventDefault'), 'tirer pour actualiser : rien ne bloque ni n’annule le geste');
  assert.equal((ptr.match(/stage\.addEventListener\('touch(start|move|end|cancel)',[\s\S]*?\{passive:true\}\);/g) || []).length, 4, 'ses quatre écouteurs sont passifs');
  assert.ok(!/scr\.style\.transform/.test(ptr), 'l’écran n’est plus déplacé par le script : il garde le rebond natif');
  const blocking = touchCalls().filter(c => c.blocking);
  /* Les seuls écouteurs bloquants : sur de petits éléments (barres, stickers, étiquettes à glisser), ou le temps d’un geste. */
  const allowed = new Set(['bar', 'L', 'el', 'board', 'sheet', 'window', 'document']);
  assert.deepEqual(blocking.filter(c => !allowed.has(c.target)).map(c => c.head), [], 'aucun écouteur bloquant ailleurs');
  assert.ok(!blocking.some(c => /^(stage|app|body|scr|screen)$/.test(c.target)), 'rien sur la scène, #app, le corps de page ou un écran');
  assert.deepEqual(blocking.filter(c => c.target === 'window' || c.target === 'document').map(c => c.head), [
    "addEventListener('touchmove',move,{passive:false})",
    "document.addEventListener('touchmove',bloquerScrollTactile,{passive:false})"
  ], 'sur la page entière, seulement le temps d’un geste (retour par le bord, glisser du planning)');
});

test('défilement : la barre d’onglets fait défiler l’écran une seule fois, et l’élan s’arrête dès qu’un doigt se pose', () => {
  const old = cut("/* Sur mobile, un glissement vertical qui commence sur la barre d’outils du clavier (.kbar)", 'function lqTabbarScroll(){');
  assert.ok(old.includes("const BARS='.kbar';"), 'l’ancien geste ne se pose plus sur la barre d’onglets (deux distances, deux élans)');
  assert.ok(old.includes("document.querySelectorAll('#app>.tabbar').forEach(bar=>bar.addEventListener('wheel',wheel,{passive:false}));"), 'la barre d’onglets garde la molette');
  assert.ok(old.includes("document.addEventListener('touchstart',()=>{seq++;},{capture:true,passive:true});") && old.includes('if(seq!==my||Math.abs(v)<.5)return;'), 'barre du clavier : un doigt arrête l’élan');
  /* lqTabbarScroll : l’élan s’arrête quand un doigt se pose n’importe où */
  const docLs = [], handlers = {}; let raf = 0; const cancelled = [];
  const bar = { dataset: {}, addEventListener: (t, f, o) => { handlers[t] = { f, o }; } };
  const ctx = vm.createContext({
    document: { querySelector: sel => sel === '#app>.tabbar' ? bar : null, addEventListener: (t, f, o) => docLs.push({ t, f, o }) },
    performance: { now: () => 0 }, Date: { now: () => 0 }, requestAnimationFrame: () => ++raf, cancelAnimationFrame: id => cancelled.push(id), prefersReduceMotion: () => false,
  });
  vm.runInContext(fn('lqTabbarScroll') + ';lqTabbarScroll();', ctx);
  assert.equal(docLs.length, 1);
  assert.deepEqual(plain(docLs[0].o), { capture: true, passive: true }, 'passif, en capture : il n’attend rien');
  docLs[0].f(); assert.equal(cancelled.length, 1, 'un doigt posé arrête l’élan');
});

test('défilement : l’écran défile nativement ; #app et la scène ne restent jamais décalés', () => {
  assert.ok(/\.screen\{position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;padding-bottom:/.test(app), 'écran : défilement natif');
  assert.ok(!/\.screen\{[^}]*-webkit-overflow-scrolling/.test(app), 'plus de -webkit-overflow-scrolling sur les écrans');
  const sync = fn('syncTabUI');
  assert.ok(sync.includes('requestAnimationFrame(()=>lqTabIntoView(t))') && !sync.includes('scrollIntoView'), 'l’onglet ouvert : seule la barre défile');
  const into = fn('lqTabIntoView');
  assert.ok(into.includes('bar.scrollLeft=l') && !into.includes('scrollIntoView'));
  const lock = cut('(function lockShell(){', '})();');
  assert.ok(lock.includes("['#app','#app>.stage']") && lock.includes('el.scrollTop=0; el.scrollLeft=0;') && lock.includes("document.addEventListener('focusout'"), 'remis à zéro hors saisie');
  /* Une animation sans fin de box-shadow sur l’accueil redessinait la page à chaque image (le fil principal ne s’arrêtait jamais) */
  assert.ok(css.includes('@keyframes lqPing{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(3);opacity:0}}'), 'l’onde du point vert : transform et opacity');
  assert.ok(!/@keyframes lqPing\{[^}]*box-shadow/.test(css));
});

test('défilement : tirer pour actualiser, tout en passif — seuil, haut de l’écran, rechargement', () => {
  const src = cut('(function pullToRefresh(){', '/* #app et la scène ne défilent jamais');
  const mk = () => {
    const ls = {}, reloads = [];
    const el = cls => ({ className: cls, style: {}, classList: { add() {}, remove() {}, contains: () => false }, setAttribute() {}, set innerHTML(v) {}, firstChild: { style: {} }, querySelectorAll: () => Array.from({ length: 8 }, () => ({ style: {} })) });
    const ptr = el('ptr');
    const screen = { scrollTop: 0, parentElement: null };
    const target = { closest: sel => sel === '.screen.active' ? screen : null, parentElement: screen, scrollTop: 0 };
    const stage = { appendChild() {}, addEventListener: (t, f, o) => { ls[t] = { f, o }; } };
    let timers = [];
    const ctx = vm.createContext({
      document: { querySelector: () => stage, createElement: () => ptr }, navigator: {}, location: { reload: () => reloads.push(1) },
      setTimeout: (f, ms) => { timers.push(f); return timers.length; }, Promise, Date, Math, Array, String,
    });
    vm.runInContext(src, ctx);
    let prevented = 0;
    const ev = (y, x = 100) => ({ target, touches: y == null ? [] : [{ clientX: x, clientY: y }], cancelable: true, defaultPrevented: false, preventDefault: () => { prevented++; } });
    const run = () => { const t = timers; timers = []; t.forEach(f => f()); };
    return { ls, reloads, ptr, screen, ev, run, prevented: () => prevented };
  };
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.equal(mk().ls[t].o.passive, true, t + ' passif');
  /* Un grand tirer en haut de l’écran : la pastille apparaît, et l’app se recharge */
  let k = mk();
  k.ls.touchstart.f(k.ev(200));
  for (let i = 1; i <= 16; i++) k.ls.touchmove.f(k.ev(200 + i * 14));
  assert.equal(k.ptr.style.opacity, '1', 'la pastille est là');
  k.ls.touchend.f(k.ev(null)); k.run(); k.run();
  assert.equal(k.reloads.length, 1, 'rechargement');
  assert.equal(k.prevented(), 0, 'le geste n’est jamais annulé');
  /* Un petit tirer : la pastille repart, rien ne se recharge */
  k = mk();
  k.ls.touchstart.f(k.ev(200));
  for (let i = 1; i <= 4; i++) k.ls.touchmove.f(k.ev(200 + i * 10));
  k.ls.touchend.f(k.ev(null)); k.run(); k.run();
  assert.equal(k.reloads.length, 0); assert.equal(k.ptr.style.opacity, '0', 'la pastille repart');
  /* L’écran déjà défilé : rien ne se passe */
  k = mk(); k.screen.scrollTop = 40;
  k.ls.touchstart.f(k.ev(200));
  for (let i = 1; i <= 16; i++) k.ls.touchmove.f(k.ev(200 + i * 14));
  k.ls.touchend.f(k.ev(null)); k.run();
  assert.equal(k.reloads.length, 0); assert.equal(k.ptr.style.opacity, undefined, 'la pastille ne s’est pas montrée');
  /* Le doigt redescend la page (vers le haut) après avoir tiré : ce n’est plus un « tirer » */
  k = mk();
  k.ls.touchstart.f(k.ev(200));
  for (let i = 1; i <= 10; i++) k.ls.touchmove.f(k.ev(200 + i * 14));
  k.ls.touchmove.f(k.ev(150));
  k.ls.touchend.f(k.ev(null)); k.run(); k.run();
  assert.equal(k.reloads.length, 0, 'remonter annule');
  /* La pastille passe au-dessus des écrans, sous la barre d’onglets, et tient compte de l’encoche */
  assert.ok(/\.ptr\{position:absolute;left:50%;top:calc\(var\(--safe-top\) \+ 6px\);z-index:27;/.test(app));
  assert.ok(!app.includes('.stage>.screen.ptr-pull') && !app.includes('ptr-back'), 'plus de déplacement de l’écran');
});

test('réf 1 — le chargement : « Préparation de ta base de données… »', () => {
  assert.ok(app.includes('<p>Préparation de ta base de données…</p></div>'));
  assert.ok(!app.includes('base de données SQLite…'));
});

test('réf 5 — sous la barre d’onglets, le bas de l’écran est blanc comme elle (Safari d’iOS 26)', () => {
  assert.ok(s48.includes('html.lq{background:#fff}\nhtml.lq body{background:var(--bg)}'), 'le document blanc, la page lavande');
  assert.ok(s48.includes('html.lq:has(body.in-lesson),html.lq:has(#onboarding.on){background:var(--bg)}'), 'sans barre d’onglets : la couleur de la page');
  assert.ok(s48.includes('html.lq:has(#lesson-video.on){background:#4529CC}') && s48.includes('html.lq:has(#loader:not(.fade-out)){background:#4528CA}'), 'cours en vidéo, chargement : leur violet');
  /* Ces règles passent après l’ancienne (html.lq,html.lq body{background:var(--bg)}) */
  assert.ok(css.indexOf('html.lq{background:#fff}') > css.indexOf('html.lq,html.lq body{background:var(--bg)}'));
});

test('réf 2 — « Tu es ici » : une bulle accrochée à la pastille jaune, deux ondes, et le repère qui arrive après une validation', () => {
  for (const part of [
    'html.lq #scr-learn #modules .home-module .row.current .lz-num{\n  --lipc:var(--m-lip);width:66px!important;height:66px!important;',
    'background:var(--sun)!important;border:4px solid #fff!important;color:#1B1640!important;',
    '@keyframes lqSonar{0%{transform:scale(.9);opacity:.6}75%,100%{transform:scale(1.6);opacity:0}}',
    'html.lq #scr-learn #modules .home-module .row.current .lz-num::after{animation-delay:1.4s}',
    '@keyframes lqHereBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    'html.lq #scr-learn #modules .home-module>.list>.row.current.lq-arrive .catalog-lesson-state.next{',
  ]) assert.ok(s48.includes(part), part);
  /* Rien n’est redessiné à chaque image : les animations ne touchent que transform et opacity */
  for (const k of ['lqSonar', 'lqHereBob', 'lqHerePop']) {
    const kf = s48.slice(s48.indexOf(`@keyframes ${k}{`)).split('\n')[0];
    assert.ok(!/box-shadow|background|width|height|top|left/.test(kf), k);
  }
  assert.ok(s48.includes('html[data-motion="reduce"] #scr-learn #modules .home-module .row.current .catalog-lesson-state.next'), 'Réduire les animations');
  assert.ok(fn('renderModules').includes("if(host.querySelector('.row.lq-just-done'))host.querySelector('.row.current')?.classList.add('lq-arrive');"), 'le repère arrive sur la leçon suivante');
});

test('réf 3 — toutes les cartes de Défis ont la même largeur (« Un code reçu ? » gardait une marge en trop)', () => {
  assert.ok(s48.includes('html.lq #defis-join>.def-join{margin:0!important}'));
  assert.ok(css.includes('html.lq #defis-join{margin:14px 14px 0}') && css.includes('html.lq #defis-perf{margin:14px 14px 0}'), 'les blocs gardent le même écart');
});

test('réf 4 — la sauvegarde garde les joueurs de chaque partie entre amis et les amis affrontés, propres', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function normalizeState(', 'function normalize('), ctx);
  const st = ctx.normalizeState({ salle: { pts: 30, parties: 1, manches: 1, trouves: 1,
    hist: [{ at: 20, pts: 9, n: 1, ok: 1, niv: 'm', place: 2, players: 3, ppl: [{ n: '  Léa\u200b ', pts: 12, place: 1 }, 'x', { n: '<b>Tom</b>', pts: -3, place: 3 }, { n: 'Elisa', pts: 9, place: 2, me: true }] },
      { at: 10, pts: 5, n: 1, ok: 1, niv: 'f', solo: 1, ppl: [{ n: 'Léa', pts: 1, place: 1 }, { n: 'Moi', pts: 1, place: 2, me: 1 }] }],
    mates: { 'léa': { n: 'Léa', g: 3, w: 5, l: 4, at: 50 }, bad: 'x', vide: { n: '', g: 0 }, 'TOM ': { g: 2, w: 1, l: 0, at: 60 } } } }).salle;
  assert.deepEqual(plain(st.hist[0].ppl), [{ n: 'Léa', pts: 12, place: 1 }, { n: 'Elisa', pts: 9, place: 2, me: 1 }, { n: 'bTom/b', pts: 0, place: 3 }], 'pseudos nettoyés, triés par place');
  assert.ok(!('ppl' in st.hist[1]), 'une partie seul n’a pas de podium');
  assert.deepEqual(plain(st.mates), { 'léa': { n: 'Léa', g: 3, w: 3, l: 0, at: 50 }, 'tom': { n: 'TOM', g: 2, w: 1, l: 0, at: 60 } }, 'les comptes restent cohérents (devant + derrière ≤ parties)');
  const many = {}; for (let i = 0; i < 40; i++) many['a' + i] = { n: 'A' + i, g: 1, at: i };
  assert.equal(Object.keys(ctx.normalizeState({ salle: { mates: many } }).salle.mates).length, 30, 'les 30 derniers amis');
  const credit = fn('jeuCreditGame');
  assert.ok(credit.includes("const ppl=vs?sc.slice(0,8).map(x=>Object.assign({n:jeuNom(x.name)||'Joueur',pts:x.pts,place:x.place},x.pid===J.me?{me:1}:{})):null;"));
  assert.ok(credit.includes('m.n=n;m.g=(m.g||0)+1;if(me.place<x.place)m.w=(m.w||0)+1;else if(me.place>x.place)m.l=(m.l||0)+1;m.at=Date.now();mates[key]=m;'));
});

function perfCtx(salle) {
  const host = { innerHTML: '', get firstElementChild() { return null; } };
  const ctx = vm.createContext({
    document: { getElementById: id => id === 'defis-perf' ? host : null }, state: { salle },
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, lqStkSvg: k => `<svg data-k="${k}"></svg>`, perfReveal() {}, Date, Math,
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    jeuInitial: n => String(n || '?').trim().charAt(0).toUpperCase(), JEU_FRIENDS_SVG: '<svg data-k="friends"></svg>', DEF_CHEV_SVG: '<svg data-k="chev"></svg>',
    /* Le Top 5 de tous les joueurs a ses propres tests (classement.test.mjs) */
    clsTopHTML: () => '<p data-k="top5"></p>', clsFlush() {}, clsCharger() {},
  });
  vm.runInContext(['jeuChrono', 'perfDay', 'perfWith', 'perfGame', 'perfBadge', 'perfColor', 'perfPodiumHTML', 'perfMateHTML', 'perfCapHTML', 'perfTeintes', 'renderDefisPerf'].map(fn).join('') + ';renderDefisPerf();', ctx);
  return host.innerHTML;
}

test('réf 4 — « Entre amis » : le podium de la dernière partie, les adversaires et le score, « Les redéfier »', () => {
  const now = Date.now();
  const salle = { pts: 900, parties: 3, best: 412, manches: 7, trouves: 6, tms: 6 * 80000, fast: 30000, amis: 2, pl: [1, 1, 0], lv: { f: [3, 3], m: [4, 3], d: [0, 0] },
    hist: [{ at: now - 3600e3, pts: 412, n: 3, ok: 3, ms: 200000, niv: 'm', solo: 0, place: 1, players: 3, ppl: [{ n: 'Elisa', pts: 412, place: 1, me: 1 }, { n: 'Léa', pts: 388, place: 2 }, { n: 'Tom', pts: 140, place: 3 }] },
      { at: now - 864e5, pts: 230, n: 3, ok: 2, ms: 190000, niv: 'f', solo: 0, place: 2, players: 2, ppl: [{ n: 'Léa', pts: 300, place: 1 }, { n: 'Elisa', pts: 230, place: 2, me: 1 }] },
      { at: now - 2 * 864e5, pts: 258, n: 1, ok: 1, ms: 60000, niv: 'f', solo: 1, place: 0, players: 1 }],
    mates: { 'léa': { n: 'Léa', g: 2, w: 1, l: 1, at: now - 3600e3 }, 'tom': { n: 'Tom', g: 1, w: 1, l: 0, at: now - 3600e3 }, 'zoé': { n: 'Zoé', g: 3, w: 0, l: 2, at: now - 3 * 864e5 } } };
  const h = perfCtx(salle);
  assert.match(h, /<div class="perf-block perf-friends"><h3>Entre amis<\/h3>/);
  assert.ok(h.includes('<b>Ta dernière partie</b> · Aujourd’hui · Moyen · avec Léa et Tom'), 'quand, à quel niveau, avec qui');
  assert.ok(h.includes('<div class="jeu-podium perf-podium">'), 'le podium de la fin de partie');
  const steps = h.match(/<div class="jeu-step is-\d[^"]*" style="--i:\d">/g);
  assert.deepEqual(steps, ['<div class="jeu-step is-2" style="--i:0">', '<div class="jeu-step is-1 is-me" style="--i:1">', '<div class="jeu-step is-3" style="--i:2">'], '2e, 1er (toi), 3e');
  assert.ok(h.includes('<span class="jeu-step-n">Elisa <small>(toi)</small></span><small>412 pts</small>'));
  assert.ok(h.includes('<span class="jeu-medal perf-medal"><svg data-k="medal1"></svg></span>'), 'médailles autocollantes');
  /* Elisa, 31 octobre, 15 h 16 : « voir les 3 dernières personnes avec qui on a joué » */
  assert.ok(h.includes('<h4>Tes 3 derniers adversaires</h4><ul class="perf-mates">'));
  assert.ok(h.includes('<div class="perf-block perf-top" id="perf-top"><p data-k="top5"></p></div>'), 'le Top 5 de tous les joueurs, sous les chiffres');
  const mates = [...h.matchAll(/<li class="(is-\w+)" style="--i:\d"><b class="jeu-av" data-c="\d" aria-hidden="true">(.)<\/b><span class="perf-mate"><b>([^<]+)<\/b><small>([^<]+)<\/small><\/span><span class="perf-h2h" role="img" aria-label="([^"]+)"><em>(\d)<i>–<\/i>(\d)<\/em><small>([^<]+)<\/small>/g)]
    .map(m => [m[1], m[3], m[4], m[5], m[6] + '–' + m[7], m[8]]);
  assert.deepEqual(mates, [
    ['is-eq', 'Léa', '2 parties ensemble · aujourd’hui', '1 fois devant, 1 fois derrière', '1–1', 'à égalité'],
    ['is-up', 'Tom', '1 partie ensemble · aujourd’hui', '1 fois devant, 0 fois derrière', '1–0', 'tu mènes'],
    ['is-down', 'Zoé', '3 parties ensemble · ' + mates[2][2].split(' · ')[1], '0 fois devant, 2 fois derrière, 1 ex æquo', '0–2', 'à rattraper'],
  ], 'les plus récents d’abord (à égalité, les plus affrontés), et le score entre vous');
  assert.ok(h.includes(`<button type="button" class="perf-rematch" onclick="perfRematch('m')"><svg data-k="friends"></svg><span>Les redéfier</span>`), 'les redéfier, au niveau de la dernière partie');
  assert.ok(h.includes('<span class="perf-g"><b>Entre amis · Moyen · avec Léa et Tom</b>'), 'l’historique dit avec qui');
  /* Quatrième : sous le podium, sa place et ses points ; deux ex æquo partagent une marche ; une marche vide attend */
  const f = perfCtx({ ...salle, hist: [{ at: now, pts: 120, n: 3, ok: 2, ms: 1, niv: 'f', solo: 0, place: 4, players: 5,
    ppl: [{ n: 'Léa', pts: 412, place: 1 }, { n: 'Tom', pts: 300, place: 2 }, { n: 'Ana', pts: 300, place: 2 }, { n: 'Elisa', pts: 120, place: 4, me: 1 }, { n: 'Zoé', pts: 50, place: 5 }] }] });
  assert.ok(f.includes('<p class="perf-pod-me">Toi : 4e · 120 points</p>'));
  assert.ok(f.includes('<span class="jeu-step-n">Tom<br>Ana</span>'), 'ex æquo sur la même marche');
  assert.ok(f.includes('<div class="jeu-step is-3 is-empty" style="--i:2">') && f.includes('<b class="jeu-av is-empty" aria-hidden="true">?</b>'));
  assert.ok(f.includes('avec Léa, Tom +2'));
  /* Seulement seul jusqu’ici : le podium vide qui attend, et de quoi jouer entre amis */
  const s = perfCtx({ pts: 300, parties: 1, best: 300, manches: 3, trouves: 3, amis: 0, pl: [0, 0, 0], lv: { f: [3, 3] }, hist: [{ at: now, pts: 300, n: 3, ok: 3, ms: 1, niv: 'f', solo: 1, place: 0, players: 1 }] });
  assert.ok(s.includes('Ton prochain podium entre amis s’affichera ici.') && s.includes('<div class="jeu-podium perf-podium is-ghost">'));
  assert.ok(s.includes("onclick=\"perfRematch('')\"") && s.includes('<span>Jouer entre amis</span>') && !s.includes('<ul class="perf-mates">'));
  assert.ok(s.includes('<h4>Tes derniers adversaires</h4><p class="perf-note">Tes 3 derniers adversaires s’afficheront ici, avec le score entre vous.</p>'));
});

test('réf 4 — le podium s’anime quand il arrive à l’écran ; « Les redéfier » prépare la salle', () => {
  const rv = fn('perfReveal');
  assert.ok(rv.includes("perfPodObs=new IntersectionObserver(") && rv.includes("fr.classList.add('is-in');"), 'son propre repère d’arrivée');
  assert.ok(rv.includes("card.classList.add('is-in','is-static');actCountUp(card,true);if(fr)fr.classList.add('is-in');return;"), 'mouvement réduit : tout est là d’emblée');
  assert.ok(s48.includes('html.lq .perf-friends:not(.is-in) .perf-podium :is(.jeu-step>i,.jeu-medal,.jeu-step-av,.jeu-step-n,.jeu-step>small){animation-play-state:paused!important}'));
  const calls = [];
  const card = { getBoundingClientRect: () => ({ top: 500 }), closest: () => scr, querySelector: () => go };
  const go = { classList: { remove() {}, add: c => calls.push(['nudge', c]) }, offsetWidth: 1 };
  const scr = { scrollTop: 900, getBoundingClientRect: () => ({ top: 0 }), scrollTo: o => calls.push(['scroll', o.top]) };
  const ctx = vm.createContext({ document: { getElementById: () => card }, jeuRoomSet: (k, v) => calls.push([k, v]), JEU_NIVL: { f: 1, m: 1, d: 1 }, prefersReduceMotion: () => true, buzz() {}, setTimeout() {} });
  vm.runInContext(fn('perfRematch') + ";perfRematch('m');", ctx);
  assert.deepEqual(calls, [['mode', 'friends'], ['niv', 'm'], ['scroll', 1336], ['nudge', 'is-nudge']], 'entre amis, même niveau, la salle à l’écran, le bouton qui fait signe');
  /* Le podium de fin de partie a les mêmes médailles */
  assert.ok(app.includes("<span class=\"jeu-medal\">${lqStkSvg('medal'+pl)}</span>"));
  assert.ok(fn('lqStkSvg').includes("const MED={medal1:'#FFC83D',medal2:'#DCE0EE',medal3:'#F4A86A'};"));
});
