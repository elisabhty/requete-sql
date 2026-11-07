/* Elisa, 7 novembre, 11 h 31 (son GIF fait avec ChatGPT) : « Bravo → fin de leçon (6), bilan (7), connexion (13) : il saute de joie,
   les bras en l’air. »
   - le GIF détouré et adouci au bord : assets/chat-bravo.webp (12 images de 420 ms) ; en mouvement réduit, son image la plus
     joyeuse (en plein saut, les bras en l’air) : chat-bravo-fixe.webp ;
   - la fin d’une leçon réussie (« Bravo ! », « Leçon terminée ! ») : le chat saute de joie ; « Encore un effort ! » garde
     l’autocollant ;
   - le bilan (« Bravo ! », la leçon validée) ;
   - la connexion, juste après la première requête réussie (étape 13 sur 14, « Bravo ! » et les confettis) ; ouverte sans réussite
     (depuis Mon compte), l’autocollant ;
   - le GIF porte la joie : l’autocollant ne se balance, ne danse ni ne flotte plus par-dessus ; à peu près sa hauteur.
   Vérifié dans un navigateur (393 × 852 et 320 × 680) : les trois écrans, et « Encore un effort ! ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ANIM = 'assets/chat-bravo.webp', FIXE = 'assets/chat-bravo-fixe.webp', STK = 'assets/mascotte-autocollant.webp';
const monde = (reduit = false) => {
  const ctx = vm.createContext({ window: { matchMedia: () => ({ matches: reduit }) }, matchMedia: () => ({ matches: reduit }), document: { documentElement: { dataset: {} } },
    esc: s => String(s), escAttr: s => String(s), Date });
  vm.runInContext(cut('const MASCOT_IMG=', '/* Coucou : l’autocollant se balance'), ctx);
  return ctx;
};

test('les deux images du « Bravo » : le GIF d’Elisa et son saut, les bras en l’air', () => {
  const anim = fs.readFileSync(path.join(ROOT, ANIM)), fixe = fs.readFileSync(path.join(ROOT, FIXE));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [325, 362]); assert.deepEqual(taille(fixe), [325, 362]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'), 'animé et transparent ; l’autre fixe');
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(420), 'les douze images du GIF, à son rythme');
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle, tant que l’écran est là');
  assert.ok(anim.length < 300000 && fixe.length < 60000, 'léger');
  assert.ok(sw.includes("  './assets/chat-bravo.webp',\n  './assets/chat-bravo-fixe.webp',\n"), 'hors ligne');
});

test('le chat qui saute de joie, et l’image fixe en mouvement réduit', () => {
  const ctx = monde();
  assert.equal(vm.runInContext("mascotBravoImg('lst-stk bv-stk')", ctx), `<img class="lst-stk bv-stk is-bravo" src="${ANIM}" width="325" height="362" alt="" draggable="false">`);
  assert.equal(vm.runInContext("mascotBravoImg('x')", monde(true)), `<img class="x is-bravo" src="${FIXE}" width="325" height="362" alt="" draggable="false">`);
  /* La fin d’une leçon : réussie, il saute ; « Encore un effort ! », l’autocollant revient */
  const cls = new Set(['mstk-cat']), attrs = { src: STK, width: '450', height: '674' };
  const img = { classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) }, setAttribute: (k, v) => { attrs[k] = String(v); } };
  Object.defineProperty(img, 'src', { get: () => attrs.src, set: v => { attrs.src = v; } });
  ctx.btn = { querySelector: s => (s === '.mstk-cat' ? img : null) };
  vm.runInContext('mascotBravo(btn,true)', ctx);
  assert.deepEqual([cls.has('is-bravo'), attrs.src, attrs.width, attrs.height], [true, ANIM, '325', '362']);
  vm.runInContext('mascotBravo(btn,false)', ctx);
  assert.deepEqual([cls.has('is-bravo'), attrs.src, attrs.width, attrs.height], [false, STK, '450', '674']);
  vm.runInContext('mascotBravo(btn,false);mascotBravo(null,true)', ctx);
  assert.equal(attrs.src, STK, 'rien à changer');
});

test('où il saute : la fin d’une leçon réussie, le bilan, la connexion après la première requête', () => {
  const show = cut('function lvEndShow(root,id,win){', '\nfunction lvWin(root){');
  assert.ok(show.includes("if(cat&&cat.classList)cat.classList.toggle('is-party',win);\n  if(typeof mascotBravo==='function')mascotBravo(cat,win);"), 'réussie, ou pas');
  assert.ok(cut('function lvEndHide(){', '\n/* « Revoir la vidéo »').includes("if(typeof mascotBravo==='function')mascotBravo(cat,false);"), 'l’écran quitté : l’autocollant (le GIF repartira du début)');
  assert.ok(cut('function bravoHeroHtml(l){', '\nfunction carteRetenirHtml(id){').includes("${typeof mascotBravoImg==='function'?mascotBravoImg('lst-stk bv-stk'):"), 'le bilan');
  /* La connexion : avec la réussite, le chat qui saute ; sans, l’autocollant */
  const ctx = monde();
  vm.runInContext(cut('function obCompteHautHTML(reussie){', '\nconst OB_ICO_NUAGE='), ctx);
  const oui = vm.runInContext('obCompteHautHTML(true)', ctx), non = vm.runInContext('obCompteHautHTML(false)', ctx);
  assert.ok(oui.includes(`<img class="ob-promise-stk ob-compte-stk is-bravo" src="${ANIM}" width="325" height="362" alt="" draggable="false">`) && oui.includes('ob-compte-bravo'));
  assert.ok(non.includes(`<img class="ob-promise-stk ob-compte-stk" src="${STK}" width="450" height="674" alt="" draggable="false">`) && !non.includes('is-bravo'));
  /* La fin du parcours (lvFinEndHtml) garde l’autocollant : ce n’était pas dans la liste */
  assert.ok(cut('function lvFinEndHtml(){', '</span>').includes('${mascotMedalHtml()}'));
});

test('le GIF porte la joie, à peu près à la hauteur de l’autocollant', () => {
  assert.ok(lq.includes('html.lq .mascot-stk .mstk-cat.is-bravo,html.lq .mascot-stk:is(.is-hello,.is-intro,.is-party) .mstk-cat.is-bravo,html.lq .mascot-stk.is-party.is-hello .mstk-cat.is-bravo{animation:none}'), 'ni balancement ni danse par-dessus');
  assert.ok(lq.includes('html.lq .lv.is-win.end-in .lv-end-cat:has(.mstk-cat.is-bravo){animation:none}'), 'pas de second saut');
  assert.ok(lq.includes('html.lq .lv-end-top .mascot-stk:has(.mstk-cat.is-bravo){width:128px;') && lq.includes('@media (max-height:700px){html.lq .lv-end-top .mascot-stk:has(.mstk-cat.is-bravo){width:100px}}'));
  assert.ok(lq.includes('html.lq #scr-lesson .bravo-hero.bv .bv-stk.is-bravo{right:-10px;bottom:-22px;width:122px;animation:none}'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-account .ob-compte-stk.is-bravo{width:calc(var(--stk) * 1.34);animation:none}'), 'il ne flotte plus par-dessus son saut');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-compte-haut:has(.ob-compte-stk.is-bravo) .ob-compte-bravo{right:calc(50% + var(--stk) * .6)}'), '« Bravo ! » à son pied');
  assert.ok(ob.indexOf('.ob-compte-stk.is-bravo{') > ob.indexOf('html #onboarding.ob-vitrine .ob-account .ob-compte-stk{position:relative;'), 'après la règle de l’autocollant');
});
