/* Elisa, 7 novembre, 9 h 20 (devant la carte « Ta semaine est en feu 🔥 ») : « Il y a trop d’icônes feu je trouve ; est-ce qu’on peut
   faire une animation avec le chat qui enflamme chaque flamme ? »
   - le titre perd son 🔥 et, la semaine faite, le chat prend la place de la flamme de la carte ;
   - une fois par ouverture de l’appli, quand l’accueil se montre, les flammes de la semaine sont éteintes, le chat saute sur chacune
     (rapetissé, debout sur le haut du rond) et elle s’allume quand il s’y pose, d’un bond et d’une onde ; puis il revient à sa place
     et se dandine ; les jours de repos gardent leur lune ;
   - mouvement réduit : tout est déjà allumé, rien ne bouge.
   Vérifié dans un navigateur (dimanche 8 novembre, sept jours faits : une capture toutes les 70 ms). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la carte de la semaine faite : le chat à la place de la flamme, le titre sans 🔥', () => {
  const h = cut('function homeStreakHTML(', '\nfunction openAccountProgress(');
  assert.ok(h.includes("const title=semaineFaite?'Ta semaine est en feu':n?"));
  assert.ok(h.includes('<img class="lq-streak-chat" src="${typeof MASCOT_IMG!==\'undefined\'?MASCOT_IMG:\'assets/mascotte-autocollant.webp\'}" width="450" height="674" alt="" draggable="false">'));
  assert.ok(h.includes('<span class="lq-streak-flame" aria-hidden="true">${chat||LQ_FLAME_SVG}</span>') && h.includes("${semaineFaite?' is-semaine':''}"));
});

test('le chat saute de flamme en flamme, chacune s’allume quand il s’y pose, puis il revient', () => {
  const minuteries = [];
  let images = null;
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const classes = () => { const s = new Set(); return { s, add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) }; };
  const jours = [0, 1, 2].map(i => ({ classList: classes(), querySelector: () => ({ getBoundingClientRect: () => rect(20 + i * 50, 100, 30, 30) }) }));
  const chat = { classList: classes(), getBoundingClientRect: () => rect(14, 20, 34, 51), animate: (k, o) => { images = { k, o }; } };
  const carte = { classList: classes(), querySelector: s => (s === '.lq-streak-chat' ? chat : null), querySelectorAll: s => (s === '.lq-day.is-done' ? jours : []) };
  const ctx = vm.createContext({ setTimeout: (f, t) => minuteries.push([t, f]) });
  vm.runInContext(cut('function lqChatAllume(carte){', '\nfunction openAccountProgress('), ctx);
  ctx.lqChatAllume(carte);
  assert.ok(carte.classList.s.has('is-allumage'), 'les flammes éteintes pendant le saut');
  assert.equal(images.k.length, 1 + 3 * jours.length + 2, 'un départ, puis pour chaque flamme : le saut, l’atterrissage, la pose ; puis le retour');
  assert.equal(images.k[0].transform, 'translate(0px,0px) scale(1,1)');
  assert.equal(images.k.at(-1).transform, 'translate(0px,0px) scale(1,1)', 'il revient à sa place');
  assert.equal(images.k.at(-1).offset, 1);
  /* Premier rond : son centre à 35 px, le chat centré à 31 px ; son haut à 100 px + 5, le bas du chat à 71 px */
  assert.equal(images.k[3].transform, 'translate(4px,34px) scale(0.85,0.85)', 'debout sur le haut du premier rond, rapetissé');
  assert.ok(images.k.slice(1).every((x, i, a) => i === 0 || x.offset >= a[i - 1].offset), 'des étapes dans l’ordre');
  const feux = minuteries.filter(([t]) => t < images.o.duration).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(feux.map(([t]) => t), [440, 840, 1240], 'chaque flamme s’allume à l’atterrissage du chat');
  feux.forEach(([, f]) => f());
  assert.ok(jours.every(j => j.classList.s.has('is-feu')));
  const fin = minuteries.find(([t]) => t > images.o.duration);
  fin[1]();
  assert.ok(!carte.classList.s.has('is-allumage') && jours.every(j => !j.classList.s.has('is-feu')) && chat.classList.s.has('is-fier'), 'tout allumé, le chat se dandine');
});

test('une fois par ouverture de l’appli, quand l’accueil se montre ; mouvement réduit : rien ne bouge', () => {
  const f = cut('let lqFeuJoue=false;', 'function lqChatAllume(carte){');
  assert.ok(f.includes("if(!c0||(typeof mascotReduced==='function'&&mascotReduced()))return;"), 'mouvement réduit');
  assert.ok(f.includes("if(!document.querySelector('#scr-learn.active')){carte.classList.remove('is-allumage');return;}"), 'accueil caché : les flammes restent allumées, on réessaiera');
  assert.ok(f.includes('lqFeuJoue=true;\n    lqChatAllume(carte);'), 'une seule fois');
  assert.equal((app.match(/if\(typeof lqSemaineFeu==='function'\)lqSemaineFeu\(host\);/g) || []).length, 2, 'après les deux rendus de la carte');
  for (const k of ['html.lq .lq-streak.is-semaine .lq-streak-flame{position:relative;z-index:3;width:40px;height:40px;background:none!important;',
    'html.lq .lq-streak-chat{display:block;width:34px;height:auto;margin:-12px auto -3px;pointer-events:none;',
    'html.lq .lq-streak.is-allumage .lq-day.is-done:not(.is-feu) i{background:transparent;',
    'html.lq .lq-day.is-feu i{animation:lqFeuPop .46s cubic-bezier(.34,1.56,.64,1) both}', '@keyframes lqFeuOnde{',
    'html.lq .lq-streak.is-semaine.is-up .lq-day.is-now svg{animation:lqDance 1.9s ease-in-out infinite;',
    '@media (prefers-reduced-motion:reduce){html.lq .lq-streak-chat.is-fier,html.lq .lq-day.is-feu i,html.lq .lq-day.is-feu i::after{animation:none}}'])
    assert.ok(lq.includes(k), k);
});
