/* Appli : la mascotte devient un autocollant (retour d’Elisa du 30 octobre, « pas pro » le médaillon gris).
   - plus de vidéo à fond gris dans un rond : la mascotte est un autocollant découpé (contour blanc, ombre à rebord),
     comme les stickers de la vitrine, sur l’accueil, à la bienvenue, dans les bulles de l’onboarding, à l’écran final,
     en fin de leçon et en fin de parcours ;
   - sur la carte de la séance : un mot-clé SQL façon console, deux étincelles, une bulle « Coucou ! » posée au-dessus du
     chat (jamais sur le titre), l’arrivée collée une seule fois par séance, le coucou au toucher ;
   - bienvenue : la scène d’autocollants de la page de connexion (stickers « Comme un jeu » et « Cartes mémo », mots-clés) ;
   - « réduire les animations » : rien ne bouge ;
   - derniers écarts avec la vitrine : carte d’intro du planning en violet avec son calendrier en sticker, bouton
     « Tirer un défi » au violet à rebord. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html');
const lq = lire('ludique.css');
const ob = lire('onboarding-vitrine.css');
const sw = lire('sw.js');
const entre = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };

test('l’autocollant est une image WebP légère, avec transparence, rangée pour le hors-ligne', () => {
  const buf = fs.readFileSync(path.join(root, 'assets/mascotte-autocollant.webp'));
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buf.toString('ascii', 12, 16), 'VP8X', 'format étendu (canal alpha)');
  assert.ok(buf[20] & 0x10, 'canal alpha présent');
  const w = 1 + buf.readUIntLE(24, 3), h = 1 + buf.readUIntLE(27, 3);
  assert.deepEqual([w, h], [450, 674], 'dimensions annoncées dans les balises <img> (ombre à rebord comprise)');
  assert.ok(buf.length < 60 * 1024, `poids : ${buf.length} octets`);
  assert.ok(sw.includes("'./assets/mascotte-autocollant.webp'"), 'rangée par le service worker');
});

test('plus aucun médaillon gris ni vidéo de la mascotte', () => {
  for (const [nom, src] of [['index.html', html], ['ludique.css', lq], ['onboarding-vitrine.css', ob]]) {
    assert.ok(!src.includes('mascot-medal'), `${nom} : plus de .mascot-medal`);
    assert.ok(!src.includes('mascotte-coucou'), `${nom} : plus de vidéo ni d’affiche du coucou`);
    assert.ok(!src.includes('mascotte-onboarding.png'), `${nom} : plus d’avatar rond à fond blanc`);
  }
  assert.ok(!/<video class="mascot/.test(html), 'bienvenue sans vidéo');
});

test('mascotMedalHtml : un bouton avec l’autocollant, son mot-clé, ses étincelles et sa bulle', () => {
  const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  vm.runInContext(entre("const MASCOT_IMG=", 'function mascotReduced(){'), ctx);
  const plein = vm.runInContext("mascotMedalHtml({kw:'SELECT',hi:'Coucou !',intro:true})", ctx);
  assert.match(plein, /^<button type="button" class="mascot-stk is-intro" onclick="mascotWave\(this\)" aria-label="La mascotte Requête te fait coucou">/);
  assert.ok(plein.includes('<img class="mstk-cat" src="assets/mascotte-autocollant.webp" width="450" height="674" alt="" draggable="false">'));
  assert.ok(plein.includes('<span class="mstk-kw" aria-hidden="true">SELECT</span>') && plein.includes('<span class="mstk-bub" aria-hidden="true">Coucou !</span>'));
  assert.equal((plein.match(/class="mstk-sp /g) || []).length, 2, 'deux étincelles');
  assert.equal((plein.match(/<i><\/i>/g) || []).length, 6, 'six confettis');
  const seul = vm.runInContext('mascotMedalHtml()', ctx);
  assert.ok(seul.startsWith('<button type="button" class="mascot-stk" ') && !seul.includes('mstk-kw') && !seul.includes('mstk-bub') && !seul.includes('mstk-sp'), 'fin de leçon : l’autocollant seul');
});

test('accueil : arrivée collée une fois par séance, coucou au toucher, autocollant gardé d’un rendu à l’autre', () => {
  const hero = entre('function renderHomeHero(){', 'const HOME_STEP_OK=');
  assert.ok(hero.includes("const intro=typeof mascotWavedThisSession!=='undefined'&&!mascotWavedThisSession&&!mascotReduced()&&typeof host.querySelector==='function'&&!host.querySelector('.mascot-stk')&&!!document.querySelector('#scr-learn.active');"));
  assert.ok(hero.includes('if(intro){mascotWavedThisSession=true;'), 'une seule arrivée par séance');
  assert.ok(hero.includes("mascotMedalHtml({kw:nxt==null?'COMMIT;':'SELECT',hi:nxt==null?'Bravo\\u00a0!':'Coucou\\u00a0!',intro})"));
  assert.ok(hero.includes("for(const sel of ['.mstk-kw','.mstk-bub'])") && hero.includes('fresh.replaceWith(old);'), 'gardé, textes remis à jour');
  const wave = entre('function mascotWave(btn){', 'function mascotGreetOnce(){');
  assert.ok(wave.includes("btn.classList.add('is-hello');") && wave.includes('void btn.offsetWidth;') && wave.includes("setTimeout(()=>btn.classList.remove('is-hello'),2900)"));
  assert.ok(entre('function mascotGreetOnce(){', 'function renderHomeHero(){').includes("document.querySelector('#scr-learn.active .mascot-stk')"));
});

test('carte de la séance : autocollant à droite, bulle au-dessus du chat, mot-clé dans la carte', () => {
  assert.ok(lq.includes('html.lq .lq-hero .mascot-stk{width:84px;margin:0 -6px 0 -4px;align-self:center}'));
  assert.ok(lq.includes('html.lq .lq-hero .mstk-bub{right:-4px;bottom:calc(100% + 4px);'), 'bulle dans la colonne de l’autocollant, jamais sur le titre');
  assert.ok(lq.includes('  html.lq .lq-hero .mascot-stk{width:68px}'), 'petits écrans');
  assert.ok(!/\.mstk-cat\{[^}]*filter/.test(lq) && !/\.pl-intro-stk\{[^}]*filter/.test(lq) && lq.includes('rotate:var(--mr);'), 'ombre peinte dans l’image (aucun filtre, net sur iPhone), autocollant penché');
  for (const k of ['@keyframes mstkBob{', '@keyframes mstkHello{', '@keyframes mstkSlap{', '@keyframes mstkBurst{', '@keyframes mstkBub{', '@keyframes mstkDance{'])
    assert.ok(lq.includes(k), k);
});

test('« réduire les animations » : l’autocollant et la scène de bienvenue ne bougent pas', () => {
  assert.ok(lq.includes('@media (prefers-reduced-motion:reduce){\n  html.lq .mascot-stk *{animation:none!important}'));
  assert.ok(lq.includes('html.lq[data-motion="reduce"] .mascot-stk *{animation:none!important}'));
  assert.ok(lq.includes('html.lq[data-motion="reduce"] .mascot-stk.is-hello .mstk-bub{opacity:1;transform:rotate(-6deg)}'), 'la bulle s’affiche quand même');
  assert.ok(ob.includes('html #onboarding.ob-vitrine :is(.ob-chat img,.ob-hs,.ob-hk,.ob-hello-stage::before,.ob-hello-stage::after){animation:none!important}'));
  assert.ok(ob.includes('html[data-motion="reduce"] #onboarding.ob-vitrine .ob-hs{opacity:1;transform:rotate(var(--r,0deg))}'), 'stickers visibles sans animation');
});

test('onboarding : scène d’autocollants à la bienvenue, autocollant dans les bulles et à l’écran final', () => {
  const accueil = entre("}else if(slide==='welcome'){", "}else if(slide==='account'){");
  assert.ok(accueil.includes('<div class="ob-hello-stage">'));
  assert.ok(accueil.includes('<span class="ob-stk sun">Comme un jeu${OB_STK_JEU}</span>') && accueil.includes('<span class="ob-stk lav">Cartes mémo${OB_STK_MEMO}</span>'), 'les deux stickers de la vitrine');
  assert.ok(accueil.includes('>SELECT</span>') && accueil.includes('>JOIN</span>'), 'mots-clés qui flottent');
  assert.ok(accueil.includes("${mascotMedalHtml({hi:'Coucou\\u00a0!',intro:!mascotReduced()})}"));
  assert.ok(html.includes('return `<div class="ob-chat"><img class="ob-chat-stk" src="${MASCOT_IMG}" width="450" height="674" alt="La mascotte Requête" draggable="false">'), 'bulles : l’autocollant');
  assert.ok(entre("html=`<div class=\"ob-screen ready\">", 'obSetFooter(').includes("${mascotMedalHtml({hi:'C’est parti\\u00a0!',intro:!mascotReduced()})}"), 'écran final');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-chat img{width:72px!important;height:auto!important;aspect-ratio:450/674;border-radius:0!important;') && ob.includes('filter:none!important;rotate:-5deg;'), 'plus d’avatar rond, ombre dans l’image');
  assert.ok(ob.includes('@media (max-height:740px){\n  html #onboarding.ob-vitrine .ob-hello-stage{height:152px;'), 'scène plus basse sur les petits écrans');
  assert.ok(html.includes('<link rel="stylesheet" href="onboarding-vitrine.css?v=2">') && sw.includes("'./onboarding-vitrine.css?v=2'"), 'feuille rechargée');
});

test('fin de leçon et fin de parcours : l’autocollant, qui danse tant que la réussite est affichée', () => {
  assert.ok(html.includes('.lv-end-top .mascot-stk{width:56px;') && html.includes('.lv-fe .mascot-stk{width:112px;') && html.includes('.lv-fe .mascot-stk{width:86px}'));
  assert.ok(html.includes("const cat=LV.root.querySelector('.lv-end .mascot-stk'); if(cat&&cat.classList)cat.classList.remove('is-party','is-hello');"), 'écran quitté : la danse s’arrête');
});

test('planning et défis : plus de gris-noir ni d’ancien dégradé indigo', () => {
  assert.ok(html.includes('<div class="pl-intro">${PL_STK_CAL}<b>Ton planning personnalisé</b>') && html.includes("const PL_STK_CAL='<svg class=\"pl-intro-stk\""), 'calendrier en sticker');
  assert.ok(lq.includes('html.lq .pl-intro{position:relative;isolation:isolate;overflow:hidden;margin-bottom:18px;padding:20px;border-radius:24px;background:var(--deep);'), 'violet profond du héros');
  assert.ok(lq.includes('html.lq .room-go{min-height:56px!important;border-radius:18px!important;background:var(--accent)!important;'), '« Tirer un défi » au violet de la marque');
  assert.ok(lq.includes('box-shadow:0 5px 0 var(--accent-lip)!important;font:700 17px/1 var(--display)!important;'), 'rebord et police des titres');
});
