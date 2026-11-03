/* 3 novembre, 10 h 38 : « Vérifie stp les bugs et il faut que l’outil soit plus fluide dans la navigation ».
   Mesuré dans Chromium à la taille d’un iPhone : revenir sur l’accueil figeait l’écran ~200 ms (le chemin des modules relisait
   la page après chaque pastille), et les premières secondes de chaque vidéo saccadaient (le relevé de la caméra). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../assets/anim/core.js', import.meta.url), 'utf8');
const where = fs.readFileSync(new URL('../assets/anim/where.html', import.meta.url), 'utf8');
const fn = (src, name) => { const a = src.indexOf(`function ${name}(`); assert.ok(a >= 0, name); const b = src.indexOf('\n}\n', a); return src.slice(a, b + 2); };

test('chemin des modules : les --k sont posés avant de lire les positions, et un tracé identique n’est pas réécrit', () => {
  const prep = fn(app, 'lqPathPrep'), read = fn(app, 'lqPathRead'), paint = fn(app, 'lqPathPaint');
  assert.ok(prep.includes("r.style.setProperty('--k',v)"), 'écriture des --k dans la première étape');
  assert.ok(!/setProperty|style\.|setAttribute|innerHTML/.test(read), 'la lecture n’écrit rien');
  assert.ok(read.includes('getBoundingClientRect'));
  assert.ok(paint.includes('if(!animate&&svg.__lqKey===key)return svg;'), 'même tracé : rien n’est réécrit');
  assert.ok(fn(app, 'lqDrawPaths').includes('.map(lqPathPrep).filter(Boolean).filter(lqPathRead)'), 'tous les modules lus avant de dessiner');
  assert.ok(fn(app, 'lqAfterModules').includes('lqDrawPaths(host.querySelectorAll(\'.home-module[open]\'))'));
});

test('accueil : un rendu identique garde les éléments en place (carte du cours et liste des modules)', () => {
  const hero = fn(app, 'renderHomeHero'), mods = fn(app, 'renderModules');
  assert.equal((hero.match(/if\(!lqSameHtml\(host,html\)\)\{const keep=lqKeepMascot\(host\);host\.innerHTML=html;lqKeepMascot\(host,keep\);\}/g) || []).length, 2, 'les deux cartes (parcours en cours, parcours terminé)');
  assert.ok(!/host\.innerHTML=`/.test(hero), 'plus de remplacement direct');
  assert.ok(mods.includes('if(host.__lqHtml!==html||!host.firstElementChild){'), 'liste des modules');
  assert.ok(mods.includes("host.querySelectorAll('.home-module[open]').forEach(d=>{d.__lqParsed=true;});"), 'module rendu ouvert : repéré');
  const same = fn(app, 'lqSameHtml');
  const ctx = vm.createContext({});
  vm.runInContext(same, ctx);
  const host = { firstElementChild: null };
  assert.equal(ctx.lqSameHtml(host, '<b>1</b>'), false, 'premier rendu');
  host.firstElementChild = {};
  assert.equal(ctx.lqSameHtml(host, '<b>1</b>'), true, 'même HTML : rien à faire');
  assert.equal(ctx.lqSameHtml(host, '<b>2</b>'), false, 'HTML changé : rendu');
  host.firstElementChild = null;
  assert.equal(ctx.lqSameHtml(host, '<b>2</b>'), false, 'conteneur vidé : rendu');
});

test('module rendu ouvert : ses pastilles arrivent en cascade, le tracé ne repart pas de zéro', () => {
  const toggle = fn(app, 'lqModuleToggle'), draw = fn(app, 'lqDrawPath');
  assert.ok(toggle.includes("lqDrawPath(det,parsed?'cascade':true);"));
  assert.ok(draw.includes("if(animate==='cascade')return;"));
  assert.ok(draw.indexOf("list.classList.add('lq-in')") < draw.indexOf("if(animate==='cascade')return;"), 'la cascade reste');
});

test('vidéo WHERE : la dernière bulle n’a plus de sortie à 999 s (la timeline durait 1 007 s)', () => {
  assert.ok(where.includes("    if (b < DURATION) tl.to(el, {autoAlpha: 0, y: -18, duration: 0.25, ease: 'power2.in'}, b - 0.2);"));
  assert.ok(core.includes("    if (b < duration) tl.to(el, {autoAlpha: 0, y: -18, duration: 0.25, ease: 'power2.in'}, b - 0.2);"), 'même règle que le moteur commun');
});

test('caméra : le relevé attend que l’image soit immobile, même code dans core.js et where.html', () => {
  const plan = s => s.slice(s.indexOf('const CAM_CHUNK = 30;'), s.indexOf('/* Le zoom et le point fixe de chaque instant'));
  assert.ok(plan(core).length > 1000);
  assert.equal(plan(where), plan(core), 'copie identique dans where.html');
  const p = plan(core);
  assert.ok(p.includes('if (q < 90 && t0 - born < 10000) { later(); return; }'), 'pas pendant que l’image bouge');
  assert.ok(p.includes("if (CAM.pause || document.body.classList.contains('lv-pk-open')) { setTimeout(later, 250); return; }"), 'pas pendant un moment « À toi »');
  assert.ok(p.includes('const rt = CAM.rt; window.renderAt(CAM.lastT); CAM.rt = rt;'), 'l’image revient à l’instant affiché');
  assert.ok(!p.includes('setTimeout(chunk, 12)'), 'plus de lots pendant la lecture');
  assert.ok(core.includes('CAM.lastT = T; CAM.rt = performance.now(); camRender(t);'));
  assert.ok(where.includes('CAM.lastT = T; CAM.rt = performance.now(); camRender(warp(T));'));
  // camQuiet : arrêtée → longtemps ; dans une pause → le temps qui reste ; en mouvement → 0.
  const ctx = vm.createContext({ performance: { now: () => 10000 }, CAM: { rt: 9990, lastT: 0 }, HOLDS: [[2, 1.5], [5, -1], [8, 2]] });
  vm.runInContext(fn(core, 'camQuiet'), ctx);
  ctx.CAM.lastT = 1; assert.equal(ctx.camQuiet(), 0, 'avant la première pause');
  ctx.CAM.lastT = 2.5; assert.equal(Math.round(ctx.camQuiet()), 1000, 'dans la pause [2 ; 3,5]');
  ctx.CAM.lastT = 3.6; assert.equal(ctx.camQuiet(), 0, 'après');
  ctx.CAM.lastT = 8.6; assert.equal(Math.round(ctx.camQuiet()), 1900, 'pause [8 ; 10] décalée de +1,5 puis −1 : [8,5 ; 10,5]');
  ctx.CAM.rt = 9000; assert.equal(ctx.camQuiet(), 1e9, 'la lecture ne demande plus d’image');
});

test('page de départ d’un cours : pas de retour par glissement dessous, et elle s’en va avec l’écran du cours', () => {
  assert.ok(app.includes("const blocked=()=>!!document.querySelector('#lesson-start:not(.is-out),#onboarding.on,"), 'glissement bloqué tant qu’elle est ouverte');
  const leave = fn(app, 'leaveLessonScreen');
  assert.ok(leave.includes("{const ls=document.getElementById('lesson-start');if(ls&&!ls.classList.contains('is-out')){ls.classList.add('is-out');setTimeout(()=>ls.remove(),prefersReduceMotion()?0:220);}}"), 'même fondu que sa croix');
});

test('leçon seule : une étape 1 ou 2 gardée d’une ancienne visite n’ouvre plus une consigne « undefined »', () => {
  const open = fn(app, 'openLesson');
  assert.ok(open.includes('&&!(restoreStep>0&&l.leconSeule)) lessonStep=restoreStep;'));
});
