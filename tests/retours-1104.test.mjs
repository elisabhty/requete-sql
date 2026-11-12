/* Elisa, 7 novembre, 11 h 04 (son GIF fait avec ChatGPT) : « Coucou → accueil (1) et bienvenue (9) : il agite la patte, sourit,
   cligne des yeux. »
   - le GIF détouré et adouci au bord : assets/chat-coucou.webp (12 images de 420 ms) ; sa dernière image, le chat au repos :
     chat-coucou-fixe.webp ;
   - la bienvenue (« Coucou ! ») : il salue en boucle ;
   - l’accueil, carte de la leçon (« Ravi de te revoir ! ») : il fait coucou quand il dit bonjour (l’arrivée, le coucou de la séance,
     le toucher, les retrouvailles), puis se pose ; la carte du parcours terminé garde l’autocollant ;
   - le coucou de la séance attend que l’accueil soit vraiment à l’écran : plus derrière l’écran de lancement, l’onboarding, la
     première leçon qui s’ouvre au bout de l’onboarding ou la page « Bravo » ;
   - mouvement réduit : l’image fixe.
   Vérifié dans un navigateur (393 et 320 px de large) : bienvenue, accueil à l’arrivée, au repos, au toucher. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-coucou.webp', FIXE = 'assets/chat-coucou-fixe.webp';

/* Une fausse image : getAttribute('src') rend ce qu’on a écrit, comme le vrai DOM */
const fausseImg = (src, uneFois = true) => {
  const a = { src, 'data-anim': 'coucou' }; if (uneFois) a['data-une-fois'] = '';
  const img = { complete: true, isConnected: true, charges: [], getAttribute: k => (k in a ? a[k] : null), hasAttribute: k => k in a,
    addEventListener: (e, f) => { if (e === 'load') img.charges.push(f); } };
  Object.defineProperty(img, 'src', { get: () => a.src, set: v => { a.src = v; } });
  return img;
};
const monde = (o = {}) => {
  const timers = [], images = [], store = new Map(o.store || []);
  const el = { onboarding: o.onboarding ? { classList: { contains: c => c === 'on' } } : { classList: { contains: () => false } },
    loader: o.loader ? { classList: { contains: c => (o.loader.classes || []).includes(c) }, getClientRects: () => (o.loader.visible ? [1] : []) } : null,
    'lq-flamme': o.flamme ? {} : null };
  const doc = { documentElement: { dataset: {} }, getElementById: id => el[id] ?? null,
    querySelector: s => (s === '#scr-learn.active' ? (o.accueil === false ? null : {}) : s === '#scr-learn.active .mascot-stk' ? (o.btn || null) : null) };
  const ctx = vm.createContext({ document: doc, window: { matchMedia: () => ({ matches: !!o.reduit }) }, matchMedia: () => ({ matches: !!o.reduit }),
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    setTimeout: (f, d) => { timers.push({ f, d }); return timers.length; }, clearTimeout: () => {},
    requestAnimationFrame: f => { images.push(f); return images.length; },
    dstr: d => d, auj: () => '2026-11-07', esc: s => String(s), escAttr: s => String(s), Date });
  vm.runInContext(cut('const MASCOT_IMG=', 'function renderHomeHero(){'), ctx);
  return { ctx, timers, images, el, o };
};

test('les deux images du coucou : le GIF d’Elisa et son chat au repos', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  /* 12 novembre, 20 h 24 (« la première page est floue ») : deux fois plus de pixels (tools/chats-nets.py) ; la balise dit toujours 289 × 352 */
  assert.deepEqual(taille(anim), [578, 704]); assert.deepEqual(taille(fixe), [578, 704], 'la même toile : on passe de l’un à l’autre sans saut');
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'), 'animé et transparent ; l’autre fixe');
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420), 'les douze images du GIF, au rythme du GIF');
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle (la bienvenue)');
  assert.ok(anim.length < 350000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-coucou.webp',\n  './assets/chat-coucou-fixe.webp',\n"), 'hors ligne');
  assert.ok(app.includes("const MASCOT_COUCOU='assets/chat-coucou.webp',MASCOT_COUCOU_FIXE='assets/chat-coucou-fixe.webp',MASCOT_COUCOU_MS=5040;"), '12 × 420 ms');
});

test('l’image du chat : le coucou à la bienvenue et sur la carte de la leçon, l’autocollant ailleurs', () => {
  const { ctx } = monde();
  const h = o => vm.runInContext(`mascotChatHtml(${JSON.stringify(o)})`, ctx);
  assert.equal(h({}), '<img class="mstk-cat" src="assets/mascotte-autocollant.webp" width="450" height="674" alt="" draggable="false">', 'inchangé ailleurs');
  assert.equal(h({ anim: 'coucou' }), `<img class="mstk-cat is-coucou" src="${ANIM}" width="289" height="352" alt="" draggable="false" data-anim="coucou">`, 'la bienvenue : en boucle');
  assert.equal(h({ anim: 'coucou', uneFois: true, joue: true }), `<img class="mstk-cat is-coucou" src="${ANIM}" width="289" height="352" alt="" draggable="false" data-anim="coucou" data-une-fois="">`, 'l’accueil, à l’arrivée');
  assert.equal(h({ anim: 'coucou', uneFois: true }), `<img class="mstk-cat is-coucou" src="${FIXE}" width="289" height="352" alt="" draggable="false" data-anim="coucou" data-une-fois="">`, 'l’accueil, au repos');
  const reduit = monde({ reduit: true }).ctx;
  assert.ok(vm.runInContext(`mascotChatHtml({anim:'coucou'})`, reduit).includes(`src="${FIXE}"`), 'mouvement réduit : l’image fixe');
  assert.ok(vm.runInContext(`mascotMedalHtml({hi:'Coucou !',anim:'coucou'})`, ctx).includes(`<img class="mstk-cat is-coucou" src="${ANIM}"`), 'dans l’autocollant');
  /* Où */
  const hero = cut('function renderHomeHero(){', 'const LQ_VIDEO_SVG=');
  assert.ok(hero.includes("hi:nxt==null?'Bravo\\u00a0!':'Ravi de te revoir\\u00a0!',intro,anim:nxt==null?'diplome':'poisson',repos:nxt==null?'':'rire',uneFois:true,joue:intro})"), 'la carte de la leçon ; le parcours terminé a le diplômé (12 h 38)');
  assert.ok(app.includes("${mascotMedalHtml({hi:'Coucou\\u00a0!',intro:!mascotReduced(),anim:'coucou'})}"), 'la bienvenue');
});

test('sur l’accueil, il fait coucou une fois, se pose, et recommence au toucher', () => {
  const { ctx, timers, images } = monde();
  ctx.img = fausseImg(FIXE);
  vm.runInContext('mascotCoucouJoue(img)', ctx);
  assert.equal(ctx.img.src, ANIM, 'il salue');
  assert.deepEqual(timers.map(t => t.d), [4900], 'jusqu’à sa dernière image');
  timers.shift().f();
  assert.equal(ctx.img.src, FIXE, 'puis il se pose');
  /* En plein coucou : un passage par l’image fixe (l’animation repart à zéro), puis le coucou depuis le début */
  ctx.img.src = ANIM;
  vm.runInContext('mascotCoucouJoue(img)', ctx);
  assert.equal(ctx.img.src, FIXE); assert.equal(images.length, 1);
  images.shift()(); assert.equal(images.length, 1, 'deux images d’écran'); images.shift()();
  assert.equal(ctx.img.src, ANIM); assert.deepEqual(timers.map(t => t.d), [4900]);
  timers.length = 0;
  /* Image pas encore chargée : le repos se compte depuis son chargement */
  ctx.img = fausseImg(FIXE); ctx.img.complete = false;
  vm.runInContext('mascotCoucouJoue(img)', ctx);
  assert.equal(timers.length, 0); assert.equal(ctx.img.charges.length, 1);
  ctx.img.charges[0](); assert.deepEqual(timers.map(t => t.d), [4900]);
  timers.length = 0;
  /* La bienvenue (en boucle) et le mouvement réduit : rien ne change */
  ctx.img = fausseImg(ANIM, false); vm.runInContext('mascotCoucouJoue(img)', ctx); assert.equal(ctx.img.src, ANIM); assert.equal(timers.length, 0);
  const r = monde({ reduit: true }); r.ctx.img = fausseImg(FIXE); vm.runInContext('mascotCoucouJoue(img)', r.ctx); assert.equal(r.ctx.img.src, FIXE);
  /* Le toucher (mascotWave) relance le coucou */
  const wave = cut('function mascotWave(btn){', '\nfunction mascotDitRetrouve(){');
  assert.ok(wave.includes("if(btn.querySelector)mascotCoucouJoue(btn.querySelector('.mstk-cat[data-une-fois]'));"));
  const cls = new Set(); const btn = { classList: { add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)) }, offsetWidth: 1, querySelector: s => (s === '.mstk-cat[data-une-fois]' ? ctx.img : null) };
  ctx.img = fausseImg(FIXE); ctx.btn = btn;
  vm.runInContext('mascotWave(btn)', ctx);
  assert.equal(ctx.img.src, ANIM); assert.ok(cls.has('is-hello'), 'avec les confettis et la bulle');
  /* L’arrivée : l’image animée est dans la carte ; le repos est programmé après le rendu */
  assert.ok(app.includes("{const img=host.querySelector&&host.querySelector('.mstk-cat[data-une-fois]');if(img&&!img._coucouVu&&img.getAttribute('src')===mascotAnimDe(img).src){img._coucouVu=true;mascotCoucouPose(img);}}"), 'l’image animée de la carte : le coucou, ou le diplômé du parcours terminé (12 h 38)');
});

test('le coucou de la séance attend que l’accueil soit vraiment à l’écran', () => {
  const vague = () => { const cls = new Set(); return { cls, isConnected: true, classList: { add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)) }, offsetWidth: 1, querySelector: () => null }; };
  const vu = ctx => vm.runInContext('mascotWavedThisSession', ctx);
  /* L’écran de lancement : il attend qu’il parte, sans compter le coucou */
  let m = monde({ btn: vague(), loader: { visible: true } });
  vm.runInContext('mascotGreetOnce()', m.ctx);
  assert.equal(vu(m.ctx), false); assert.deepEqual(m.timers.map(t => t.d), [300], 'il repasse dans un instant');
  m.o.loader.classes = ['fade-out']; m.timers.shift().f();
  assert.equal(vu(m.ctx), true, 'l’écran de lancement s’efface : le coucou');
  m.timers.shift().f(); assert.ok(m.o.btn.cls.has('is-hello'));
  /* L’onboarding, la page « Bravo » ouverte ou qui va s’ouvrir : rien, le coucou reste à faire */
  for (const o of [{ onboarding: true }, { flamme: true }, { store: [['rq-flamme-bravo', '2026-11-07']] }]) {
    m = monde({ btn: vague(), ...o });
    vm.runInContext('mascotGreetOnce()', m.ctx);
    assert.equal(vu(m.ctx), false, JSON.stringify(o)); assert.equal(m.timers.length, 0);
  }
  m = monde({ btn: vague(), store: [['rq-flamme-bravo', '2026-11-06']] });
  vm.runInContext('mascotGreetOnce()', m.ctx); assert.equal(vu(m.ctx), true, 'la page « Bravo » d’hier ne s’ouvrira plus');
  /* La première leçon s’ouvre au bout de l’onboarding : le coucou attend le retour sur l’accueil */
  m = monde({ btn: vague() });
  vm.runInContext('mascotGreetOnce()', m.ctx);
  assert.equal(vu(m.ctx), true); m.o.accueil = false; m.timers.shift().f();
  assert.equal(vu(m.ctx), false, 'à refaire'); assert.ok(!m.o.btn.cls.has('is-hello'));
  /* L’arrivée (l’autocollant qui se colle) aussi */
  assert.ok(cut('function renderHomeHero(){', 'const LQ_VIDEO_SVG=').includes("&&!host.querySelector('.mascot-stk')&&mascotAccueilLibre();"));
  /* La page « Bravo » refermée : le chat dit bonjour s’il ne l’a pas encore fait */
  assert.ok(cut('function lqFlammeFermer(){', '\nfunction openAccountProgress(){').includes("if(typeof mascotGreetOnce==='function')mascotGreetOnce();"));
});

test('l’autocollant gardé d’un rendu à l’autre change d’image quand la carte change', () => {
  const keep = cut('function lqKeepMascot(host,old){', '\n/* La vidéo d’une leçon pas encore commencée');
  assert.ok(keep.includes("{const a=old.querySelector('.mstk-cat'),b=fresh.querySelector('.mstk-cat');if(a&&b&&a.getAttribute('data-anim')!==b.getAttribute('data-anim'))a.replaceWith(b.cloneNode(true));}"), 'le coucou ↔ l’autocollant du parcours terminé');
  assert.ok(keep.indexOf('data-anim') < keep.indexOf('fresh.replaceWith(old);'));
});

test('à la même hauteur que l’autocollant (le GIF est plus large, la patte qui salue)', () => {
  assert.ok(lq.includes('html.lq .lq-hero.is-lecon .mascot-stk:has(.mstk-cat.is-coucou){width:92px;margin-right:-8px}'));
  assert.ok(lq.includes('@media (max-width:360px){html.lq .lq-hero.is-lecon .mascot-stk:has(.mstk-cat.is-coucou){width:80px}}'), 'petits écrans');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-hello-stage .mascot-stk:has(.mstk-cat.is-coucou){width:156px;margin-left:-78px}'));
  assert.ok(ob.includes('  html #onboarding.ob-vitrine .ob-hello-stage .mascot-stk:has(.mstk-cat.is-coucou){width:136px;margin-left:-68px}'));
  /* 11 novembre : la scène un peu moins haute partout (136), plus basse au palier 2 (114) */
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-hello-stage .mascot-stk:has(.mstk-cat.is-coucou){width:136px;margin-left:-68px}') && ob.includes('html #onboarding.ob-vitrine.ob-fit-2 .ob-hello-stage .mascot-stk:has(.mstk-cat.is-coucou){width:114px;margin-left:-57px}'));
  assert.ok(lq.indexOf('html.lq .lq-hero.is-lecon .mascot-stk:has(') > lq.indexOf('html.lq .lq-hero.is-lecon .mascot-stk{width:78px'), 'après la règle de l’autocollant');
});
