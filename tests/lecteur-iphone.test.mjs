import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/* Le lecteur des cours vidéo sur tous les iPhone (10 novembre : « verrouiller tous les cours une fois pour toutes »).
   Vérifié dans Chrome en iPhone simulé, de 320 × 568 à 440 × 956, en paysage (844 × 390) et en grand texte : lecture, pause, moment
   « À toi », hauteur réduite de 300 px, écran de fin (raté et réussi), pincement, transitions image par image. Ce que ces tests gardent :
   - le double toucher ne zoome nulle part dans le lecteur, ni dans le cadre de la scène ; le pincement reste permis ;
   - le rebond d’iOS ne passe pas à la page derrière ;
   - en paysage, l’écran de fin (plus haut que la fenêtre) défile depuis son haut au lieu d’être coupé en haut et en bas ;
   - pendant la vidéo, sur téléphone, les animations en boucle de la page cachée sous le lecteur sont en pause, et repartent à la fermeture ;
   - le temps de la barre n’est réécrit que s’il change ; la caméra et le lien entre leçons ne réécrivent que ce qui change, et la caméra
     mesure ses cartes avant de les déplacer (pas de mise en page forcée par carte, à chaque image) ; l’image rendue est la même. */

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lud = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'assets/anim/core.js'), 'utf8');
const coreCss = fs.readFileSync(path.join(ROOT, 'assets/anim/core.css'), 'utf8');
const cut = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`); return src.slice(a, b); };
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('ludique.css, section 66 : après la 65, avant le bloc des Défis', () => {
  const s65 = lud.indexOf('/* ---------- 65. '), s66 = lud.indexOf('/* ---------- 66. Le lecteur des cours, sur tous les iPhone (');
  const defis = lud.indexOf('/* ==========================================================================\n   Défis — la refonte du 7 novembre');
  assert.ok(s65 > 0 && s66 > s65 && defis > s66, 'ordre 65, 66, Défis');
  assert.equal(lud.indexOf('/* ---------- 66.', s66 + 10), -1, 'une seule section 66');
});

test('double toucher et rebond : le lecteur entier en manipulation, sans rebond ; le voile de fin garde son geste', () => {
  const sec = noComments(cut(lud, '/* ---------- 66. ', '/* ======'));
  assert.ok(sec.includes('html.lq .lv{touch-action:manipulation;overscroll-behavior:none}'));
  assert.ok(sec.includes('html.lq .lv-end{overscroll-behavior:contain;'));
  /* Dans le cadre de la scène aussi (le lecteur le rend d’ordinaire transparent au doigt). */
  assert.ok(noComments(coreCss).includes('html.embed,html.embed body{touch-action:manipulation;overscroll-behavior:none}'));
  /* manipulation garde le pincement (pan-x pan-y pinch-zoom) : rien n’est en touch-action:none sur le lecteur lui-même. */
  assert.ok(!/html\.lq \.lv\{[^}]*touch-action:none/.test(sec));
});

test('la balise viewport du web laisse zoomer (accessibilité) ; seule l’app native, qui le faisait déjà, l’interdit', () => {
  const meta = html.match(/<meta name="viewport" content="([^"]+)">/)[1];
  assert.ok(meta.includes('width=device-width') && meta.includes('viewport-fit=cover'));
  assert.ok(!/user-scalable=no|maximum-scale=1/.test(meta), 'le web reste zoomable');
  assert.ok(html.includes("if(vp)vp.setAttribute('content','width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');"));
});

test('aucun champ texte dans le lecteur ni dans les moments « À toi » : pas de clavier, pas de zoom à l’entrée dans un champ', () => {
  const lv = cut(html, 'function openLessonVideo(fin){', 'function lessonStepMeta(){');
  assert.ok(!/<textarea|contenteditable|<input(?![^>]*type="range")/.test(lv), 'seules des glissières (type=range)');
});

test('écran de fin plus haut que la fenêtre (paysage) : centré quand il tient, sinon il part du haut et le voile défile', () => {
  const sec = noComments(cut(lud, '/* ---------- 66. ', '/* ======'));
  assert.ok(sec.includes('html.lq .lv:not(.is-fin-end) .lv-end{align-items:flex-start}'));
  assert.ok(sec.includes('html.lq .lv:not(.is-fin-end) .lv-end-card{flex:none;margin-top:auto;margin-bottom:auto}'));
  assert.ok(/html\.lq \.lv-end\{background:rgba\(22,12,70,\.6\);[^}]*overflow-y:auto\}/.test(lud), 'le voile défile (section 40)');
  /* Fenêtre très basse : le plateau « À toi » défile au lieu de dépasser le haut de l’écran. */
  assert.ok(/@media \(max-height:500px\)\{\s*html\.lq \.lv-pk-card\{max-height:calc\(100dvh - [^}]*overflow-y:auto;overscroll-behavior:contain\}/.test(sec));
});

test('lvSyncSeek ne réécrit le temps que quand il change', () => {
  const seg = cut(html, 'function lvFill(p){', 'function lvSyncPP(){');
  let writes = 0, text = '';
  const cur = { get textContent() { return text; }, set textContent(v) { writes++; text = v; } };
  const LV = { video: { duration: 200, currentTime: 50.1 }, seek: { value: '0' }, fill: { style: {} }, knob: { style: {} }, root: { querySelector: s => (s === '.lv-cur' ? cur : null) } };
  const ctx = vm.createContext({ LV, Math, String, lvFmt: t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` });
  vm.runInContext(seg, ctx);
  ctx.lvSyncSeek(); LV.video.currentTime = 50.4; ctx.lvSyncSeek(); LV.video.currentTime = 50.9; ctx.lvSyncSeek();
  assert.equal(writes, 1, 'même seconde : une seule écriture');
  LV.video.currentTime = 51.2; ctx.lvSyncSeek();
  assert.equal(writes, 2); assert.equal(text, '0:51');
});

/* lvFond, isolée : de fausses animations, un faux document. */
const fond = () => {
  const seg = cut(html, 'function lvFond(on){', '/* Vitesse de lecture choisie');
  const el = (where, inLv) => ({ closest: s => (s === '.screen' ? (where === 'screen' ? {} : null) : s === '#lesson-start' ? (where === 'start' ? {} : null) : null), where, inLv });
  const anim = (target, iterations, state = 'running') => ({ playState: state, effect: { target, getTiming: () => ({ iterations }) }, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } });
  const app = { contains: t => t.where === 'screen' || t.where === 'app' };
  const cls = new Set();
  const list = [anim(el('screen'), Infinity), anim(el('screen'), 1), anim(el('start'), Infinity), anim(el('app'), Infinity), anim(el('screen', true), Infinity), anim(el('screen'), Infinity, 'finished')];
  const ctx = vm.createContext({
    LV: { root: { contains: t => !!t.inLv } }, lvFige: [], window: { matchMedia: true }, matchMedia: q => ({ matches: q === '(max-width:599.98px)' && ctx.__phone }),
    document: { getAnimations: () => list, getElementById: id => (id === 'app' ? app : null), documentElement: { classList: { add: c => cls.add(c), remove: c => cls.delete(c) } } }, __phone: true
  });
  vm.runInContext(seg.replace('function lvFond(on){', 'var lvFond=function(on){'), ctx);
  return { ctx, list, cls };
};

test('sous le lecteur plein écran, seules les animations en boucle de la page cachée se figent, puis repartent', () => {
  const { ctx, list, cls } = fond();
  ctx.lvFond(true);
  assert.deepEqual(list.map(a => a.playState), ['paused', 'running', 'paused', 'running', 'running', 'finished'],
    'en boucle dans un écran de l’app ou la page « Commencer » : en pause ; une entrée (1 fois), hors écran, dans le lecteur, finie : intactes');
  assert.ok(cls.has('lv-couvre'));
  ctx.lvFond(true);   // deux fois de suite : rien d’oublié
  ctx.lvFond(false);
  assert.deepEqual(list.map(a => a.playState), ['running', 'running', 'running', 'running', 'running', 'finished']);
  assert.ok(!cls.has('lv-couvre'));
});

test('sur ordinateur et tablette (le fond se voit autour du lecteur), rien ne se fige', () => {
  const { ctx, list } = fond();
  ctx.__phone = false; ctx.lvFond(true);
  assert.ok(list.every(a => a.playState !== 'paused'));
});

test('openLessonVideo fige la page après le fondu d’ouverture ; closeLessonVideo la relance avant de découvrir la page', () => {
  const open = cut(html, 'function openLessonVideo(fin){', 'function lvPlay(){');
  assert.ok(open.includes("clearTimeout(lvCouvreT); lvCouvreT=setTimeout(()=>{ if(LV&&LV.root===root&&root.isConnected)lvFond(true); },fin||prefersReduceMotion()?0:420);"));
  const close = cut(html, 'function closeLessonVideo(instant){', 'function lessonStepMeta(){');
  assert.ok(close.indexOf('clearTimeout(lvCouvreT); lvFond(false);') >= 0 && close.indexOf('clearTimeout(lvCouvreT); lvFond(false);') < close.indexOf("root.classList.remove('on')"));
  assert.ok(/let lvCouvreT=0, lvFige=\[\];/.test(html));
});

test('caméra : mêmes valeurs qu’avant ; les scènes ne sont réécrites que si l’agrandissement change ; cartes mesurées avant d’être déplacées', () => {
  const seg = cut(core, 'function camApply(z, o){', 'function camAt(t){');
  const ops = [];
  const sec = n => ({ style: new Proxy({}, { set(o, k, v) { ops.push(`w ${n}.${k}=${v}`); o[k] = v; return true; } }) });
  const card = (n, x, y) => ({ get offsetLeft() { ops.push(`r ${n}`); return x; }, get offsetTop() { return y; }, style: new Proxy({}, { set(o, k, v) { ops.push(`w ${n}.${k}=${v}`); o[k] = v; return true; } }) });
  const CAM = { secs: [sec('s1'), sec('s2')], loose: [card('c1', 100, 200), card('c2', 300, 400)] };
  const ctx = vm.createContext({ CAM, getComputedStyle: () => ({ transformOrigin: '10px 20px' }), Math });
  vm.runInContext(seg, ctx);
  ctx.camApply(1.2, 300);
  assert.deepEqual(CAM.secs[0].style, { transformOrigin: '540px 300.0px', scale: '1.2000' });
  /* Les formules d’avant : décalage = (point − origine) × (1 − z). */
  assert.equal(CAM.loose[0].style.translate, `${((540 - 110) * (1 - 1.2)).toFixed(1)}px ${((300 - 220) * (1 - 1.2)).toFixed(1)}px`);
  assert.equal(CAM.loose[1].style.scale, '1.2000');
  const firstWrite = ops.findIndex(o => /^w c/.test(o)), lastRead = ops.map(o => /^r c/.test(o)).lastIndexOf(true);
  assert.ok(lastRead < firstWrite, 'toutes les cartes lues avant la première écriture');
  ops.length = 0; ctx.camApply(1.2, 300);
  assert.ok(!ops.some(o => /^w s/.test(o)), 'même agrandissement : les scènes ne sont pas réécrites');
  ctx.camApply(1, 240);
  assert.deepEqual(CAM.secs[1].style, { transformOrigin: '', scale: '' });
  assert.equal(CAM.loose[0].style.scale, '');
});

test('lien entre leçons : --pont-a, --pont-d et les classes ne sont réécrites que quand elles changent', () => {
  const seg = cut(core, 'function pontRender(T){', '\n/* ---------- Caméra');
  const props = {}; let sets = 0, clsOps = 0;
  const set = new Set();
  const body = { style: { getPropertyValue: k => props[k] || '', setProperty: (k, v) => { sets++; props[k] = String(v); } },
    classList: { contains: c => set.has(c), add: c => { clsOps++; set.add(c); }, remove: (...c) => { clsOps++; c.forEach(x => set.delete(x)); }, toggle: (c, f) => { clsOps++; if (f) set.add(c); else set.delete(c); } } };
  const pel = { classList: { s: new Set(), contains(c) { return this.s.has(c); }, toggle(c, f) { clsOps++; if (f) this.s.add(c); else this.s.delete(c); }, remove(c) { this.s.delete(c); } } };
  const ctx = vm.createContext({ document: { body }, PONTS: [{ k: 'avant', a: 5, b: 12, el: pel }], PONT_FADE: 0.5, pontUp: () => 0.12, Math });
  vm.runInContext(seg, ctx);
  ctx.pontRender(8);
  assert.equal(props['--pont-a'], '1.000'); assert.equal(props['--pont-d'], '0.12'); assert.ok(set.has('pont-on') && pel.classList.s.has('on'));
  sets = 0; clsOps = 0; ctx.pontRender(8.5); ctx.pontRender(9);
  assert.equal(sets, 0, 'au milieu de la phrase, rien à réécrire');
  assert.equal(clsOps, 0);
  ctx.pontRender(11.8);
  assert.equal(props['--pont-a'], '0.400', 'le fondu de sortie, lui, s’écrit');
  ctx.pontRender(20);
  assert.ok(!set.has('pont-on') && !pel.classList.s.has('on'), 'hors du lien : tout est retiré');
});

test('la scène n’est remise à l’échelle qu’au changement de taille du cadre, jamais pendant le rendu d’une image', () => {
  const ra = cut(core, '  function renderAt(T){', '  window.renderAt = renderAt;');
  assert.ok(!/getBoundingClientRect|offsetWidth|offsetHeight|innerWidth|innerHeight/.test(ra), 'renderAt ne lit aucune mesure');
  assert.ok(core.includes("addEventListener('resize', fit);"));
});

/* 10 novembre, relecture des cours : au dernier moment de tri (6 étiquettes de 23 à 36 signes), la feuille cachait les cases où les poser,
   sur tous les iPhone (et tout sur un SE). */
test('les étiquettes à ranger : deux par ligne pour une phrase courte, toute la ligne pour une longue ou du code ; la feuille laisse voir les cases', () => {
  const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const fn = app.slice(app.indexOf('function lvPkLarge(opts){'), app.indexOf('function lvPkShow(i,p){'));
  const ctx = vm.createContext({});
  vm.runInContext(fn, ctx);
  const L = (...l) => ctx.lvPkLarge(l.map(label => ({label})));
  assert.equal(L('Les avis d’un client qui ferme son compte'), ' is-wide', 'plus de 36 signes : toute la ligne');
  assert.equal(L('Démarrer une transaction', 'COMMIT'), ' is-mid', 'une phrase courte : deux par ligne');
  assert.equal(L('SELECT clients.ville, COUNT(*)'), ' is-wide', 'du code : toute la ligne (27 octobre, 17 h 47)');
  assert.equal(L('date de l’atelier', 'coach'), '', 'court : comme avant');
  assert.ok(app.includes('.lv-pk.is-sort.is-mid .lv-pk-opt{font-size:14px;line-height:1.2}') && app.includes('@media (max-height:900px){.lv-pk.is-sort.is-wide .lv-pk-opt{min-height:38px;'));
  assert.ok(app.includes("const lvPkZmin=()=>typeof innerHeight==='number'&&innerHeight<700?.55:LV_PK_ZMIN;") && app.includes('Math.max(lvPkZmin(),'));
  assert.ok(app.includes('.lv-pk-back::before{content:"";position:absolute;inset:-9px -4px}'), '« Revoir » : 44 px au toucher');
  assert.ok(app.includes('.lv-pk-lb{min-width:0;overflow-wrap:anywhere}'), 'un nom d’un seul tenant ne sort plus du bouton');
});
