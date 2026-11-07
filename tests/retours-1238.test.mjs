/* Elisa, 7 novembre, 12 h 38 (son GIF fait avec ChatGPT) : « Diplômé → fin du parcours (8) et accueil parcours terminé (2) : il lance
   sa toque ou brandit un diplôme. »
   - le GIF détouré et adouci au bord : assets/chat-diplome.webp (12 images de 420 ms, 5 s comme le coucou) ; sa dernière image, la
     toque sur la tête et le diplôme en main : chat-diplome-fixe.webp (repos et mouvement réduit) ;
   - la fin du parcours (lvFinEndHtml) : il fête en boucle, sous « Bravo ! » ; il arrive toujours d’un rebond (le chat et sa bulle y
     étaient devenus invisibles depuis le « Bravo » de 11 h 31 : la règle qui coupait les mouvements par-dessus le GIF coupait aussi
     leur arrivée, et l’écran gardait le chat du bravo) ;
   - l’accueil du parcours terminé : comme le coucou de la carte d’une leçon, il fête quand il dit bonjour (l’arrivée, le coucou de la
     séance, le toucher), puis se pose ; passer de la carte d’une leçon à celle du parcours terminé change l’image (lqKeepMascot) ;
   - à la hauteur de l’autocollant (plus large).
   Vérifié dans un navigateur (393 × 852 et 320 × 680). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-diplome.webp', FIXE = 'assets/chat-diplome-fixe.webp';

test('les deux images du diplômé : le GIF d’Elisa et sa dernière pose', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [304, 367]); assert.deepEqual(taille(fixe), [304, 367]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420), '5 s, comme le coucou (MASCOT_COUCOU_MS)');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-diplome.webp',\n  './assets/chat-diplome-fixe.webp',\n"), 'hors ligne');
});

const monde = (reduit = false) => {
  const timers = [], images = [];
  const ctx = vm.createContext({ window: { matchMedia: () => ({ matches: reduit }) }, matchMedia: () => ({ matches: reduit }), document: { documentElement: { dataset: {} } },
    esc: s => String(s), escAttr: s => String(s), Date, setTimeout: (f, d) => { timers.push({ f, d }); return timers.length; }, clearTimeout: () => {}, requestAnimationFrame: f => { images.push(f); return 1; } });
  vm.runInContext(cut('const MASCOT_IMG=', '/* Coucou : l’autocollant se balance'), ctx);
  return { ctx, timers, images };
};

test('les GIF de l’autocollant, d’une seule table : le diplômé, le coucou, « C’est parti ! »', () => {
  const { ctx } = monde();
  const h = o => vm.runInContext(`mascotChatHtml(${JSON.stringify(o)})`, ctx);
  assert.equal(h({ anim: 'diplome' }), `<img class="mstk-cat is-diplome" src="${ANIM}" width="304" height="367" alt="" draggable="false" data-anim="diplome">`, 'la fin du parcours : en boucle');
  assert.equal(h({ anim: 'diplome', uneFois: true }), `<img class="mstk-cat is-diplome" src="${FIXE}" width="304" height="367" alt="" draggable="false" data-anim="diplome" data-une-fois="">`, 'l’accueil, au repos');
  assert.equal(h({ anim: 'diplome', uneFois: true, joue: true }), `<img class="mstk-cat is-diplome" src="${ANIM}" width="304" height="367" alt="" draggable="false" data-anim="diplome" data-une-fois="">`, 'l’accueil, à l’arrivée');
  assert.ok(vm.runInContext(`mascotChatHtml({anim:'diplome'})`, monde(true).ctx).includes(`src="${FIXE}"`), 'mouvement réduit');
  assert.ok(h({ anim: 'coucou' }).startsWith('<img class="mstk-cat is-coucou" src="assets/chat-coucou.webp" width="289" height="352"') && h({ anim: 'parti' }).startsWith('<img class="mstk-cat is-parti" src="assets/chat-parti.webp" width="302" height="359"'));
  assert.equal(h({ anim: 'toString' }), '<img class="mstk-cat" src="assets/mascotte-autocollant.webp" width="450" height="674" alt="" draggable="false">', 'un nom inconnu : l’autocollant');
});

test('sur l’accueil, le diplômé fête une fois puis se pose, comme le coucou', () => {
  const { ctx, timers, images } = monde();
  const attrs = { src: FIXE, 'data-anim': 'diplome', 'data-une-fois': '' };
  const img = { complete: true, isConnected: true, getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs, addEventListener() {} };
  Object.defineProperty(img, 'src', { get: () => attrs.src, set: v => { attrs.src = v; } });
  ctx.img = img;
  vm.runInContext('mascotCoucouJoue(img)', ctx);
  assert.equal(attrs.src, ANIM); assert.deepEqual(timers.map(t => t.d), [4900]);
  timers.shift().f(); assert.equal(attrs.src, FIXE, 'sa dernière pose');
  attrs.src = ANIM; vm.runInContext('mascotCoucouJoue(img)', ctx);
  assert.equal(attrs.src, FIXE); images.shift()(); images.shift()(); assert.equal(attrs.src, ANIM, 'touché en pleine fête : il recommence au début');
  const hero = cut('function renderHomeHero(){', 'const LQ_VIDEO_SVG=');
  assert.ok(hero.includes("intro,anim:nxt==null?'diplome':'coucou',uneFois:true,joue:intro})"), 'le parcours terminé : le diplômé');
});

test('la fin du parcours : le diplômé, que le « Bravo » ne remplace plus ; visible dès son arrivée', () => {
  assert.ok(cut('function lvFinEndHtml(){', '</span>').includes("${mascotMedalHtml({anim:'diplome'})}<span class=\"lv-end-bravo\""));
  /* lvEndShow (appelé aussi pour la fin du parcours) : mascotBravo laisse un GIF choisi par l’écran */
  const { ctx } = monde();
  const attrs = { src: ANIM, 'data-anim': 'diplome', width: '304', height: '367' }, cls = new Set(['mstk-cat', 'is-diplome']);
  const img = { classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) }, setAttribute: (k, v) => { attrs[k] = v; }, hasAttribute: k => k in attrs };
  Object.defineProperty(img, 'src', { get: () => attrs.src, set: v => { attrs.src = v; } });
  ctx.btn = { querySelector: () => img };
  vm.runInContext('mascotBravo(btn,true)', ctx);
  assert.deepEqual([attrs.src, cls.has('is-bravo')], [ANIM, false], 'toujours le diplômé');
  assert.ok(lq.includes('html.lq .lv.end-in .lv-fe>.lv-end-cat:has(.mstk-cat.is-diplome){animation:lvFeIn .6s cubic-bezier(.2,.9,.3,1.3) .1s both}'), 'il arrive d’un rebond (sans, il restait invisible)');
  assert.ok(app.includes('.lv.end-in .lv-fe>.lv-end-cat{animation:lvFeIn .6s cubic-bezier(.2,.9,.3,1.3) .1s both,'), 'le même rebond que l’autocollant');
  assert.ok(lq.includes('html.lq .lv-fe .mascot-stk .mstk-cat.is-diplome,html.lq .lv-fe .mascot-stk:is(.is-hello,.is-party) .mstk-cat.is-diplome,html.lq .lv-fe .mascot-stk.is-party.is-hello .mstk-cat.is-diplome{animation:none}'), 'ni danse ni balancement par-dessus');
});

test('à la hauteur de l’autocollant', () => {
  assert.ok(lq.includes('html.lq .lq-hero.is-complete .mascot-stk:has(.mstk-cat.is-diplome){width:104px;margin-right:-12px}'), '84 px pour l’autocollant');
  assert.ok(lq.includes('@media (max-width:360px){html.lq .lq-hero.is-complete .mascot-stk:has(.mstk-cat.is-diplome){width:84px;margin-right:-8px}}'), '68 px pour l’autocollant');
  assert.ok(lq.includes('html.lq .lv-fe .mascot-stk:has(.mstk-cat.is-diplome){width:104px}'));
});
