/* Elisa, 7 novembre, 15 h 38 : huit GIF de plus, chacun à la place de la liste (« 1 - pied, 2 - serment, 3 - hoche la tête,
   4 - pseudo, 5 - encore un effort, 6 - stickers, 7 - carte mémo, 8 - eurêka ») :
   - il attend en tapotant du pied : « Tu rejoins la salle… » et la salle d’attente d’un ami (l’hôte garde sa cible : « Invite tes
     amis » attend son GIF du ticket) ;
   - il hoche la tête : les questions de l’onboarding (âge, métier, pays, rythme, jours) ; en arrivant, le chat se pose la question,
     une fois répondu (la page redessinée par un choix), il hoche la tête. Le GIF « serment » hochait la tête et celui « hoche la tête »
     levait la patte : chacun va là où va son geste ;
   - il lève la patte pour un serment : la page de l’engagement, à droite du bouton à l’empreinte ;
   - il écrit son pseudo sur un badge : la page du pseudo (un peu plus grand, pour que le badge se lise) ;
   - « Encore un effort ! » (déçu, puis le poing levé, une fois) : la fin d’une leçon à refaire, et un défi sans rien trouvé ;
   - il colle un sticker : le tableau de stickers vide, à gauche du texte ;
   - il retourne une carte (une fois, il s’arrête sur l’étoile) : « Nouvelle carte mémo ! », au coin bas droit de la carte ;
   - eurêka (l’ampoule s’allume, une fois) : la ligne de l’indice des défis (sauf sur les plus petits écrans) et « Ce que tu retiens ».
   Les GIF de la carte et de l’ampoule gardaient des traits fins au bord de l’image : retirés avant la conversion.
   Vérifié dans un navigateur (393 et 320 px) : chaque endroit. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const lastCut = (a, b) => { const i = app.lastIndexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
/* 8 novembre, 10 h 53 (« le chat était vraiment coupé, remplace par celui-ci ») : « Encore un effort ! » devient son nouveau GIF (triste,
   puis le poing levé, les étincelles, le sourire), détouré de son faux damier, l’autocollant entier dans son cadre : 9 images de
   560 ms, une fois. */
const GIF = { pied: [319, 362, 12, 420, 0], oui: [294, 351, 12, 330, 0], serment: [302, 362, 12, 420, 0], pseudo: [298, 305, 16, 380, 0],
  effort: [340, 365, 9, 560, 1], stickers: [309, 291, 16, 380, 0], carte: [270, 311, 13, 310, 1], eureka: [294, 311, 10, 310, 1] };

function webp(f) {
  const b = fs.readFileSync(path.join(ROOT, f));
  const o = { images: 0 };
  for (let i = 12; i + 8 <= b.length;) {
    const id = b.toString('latin1', i, i + 4), n = b.readUInt32LE(i + 4), d = i + 8;
    if (id === 'VP8X') { o.w = 1 + b.readUIntLE(d + 4, 3); o.h = 1 + b.readUIntLE(d + 7, 3); }
    if (id === 'ANIM') o.tours = b.readUInt16LE(d + 4);
    if (id === 'ANMF') { o.images++; o.ms = b.readUIntLE(d + 12, 3); }
    i = d + n + (n & 1);
  }
  return o;
}

test('les huit GIF : leur taille, leurs images, une fois ou en boucle ; l’image fixe ; rangés pour le hors ligne', () => {
  for (const [k, [w, h, n, ms, tours]] of Object.entries(GIF)) {
    const a = webp(`assets/chat-${k}.webp`), f = webp(`assets/chat-${k}-fixe.webp`);
    assert.deepEqual([a.w, a.h, a.images, a.ms, a.tours], [w, h, n, ms, tours], k);
    assert.deepEqual([f.w, f.h, f.images], [w, h, 0], k + ' fixe');
    for (const x of ['', '-fixe']) assert.ok(sw.includes(`  './assets/chat-${k}${x}.webp',\n`), `sw.js : chat-${k}${x}`);
  }
});

test('chatBonusHtml et obMascotDit les connaissent', () => {
  const ctx = vm.createContext({ mascotReduced: () => false, esc: s => String(s), obJustEntered: false });
  vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){'), ctx);
  for (const [k, [w, h]] of Object.entries(GIF)) assert.equal(ctx.chatBonusHtml(k), `<img class="chat-bonus is-${k}" src="assets/chat-${k}.webp" width="${w}" height="${h}" alt="" draggable="false">`);
  vm.runInContext(cut('const MASCOT_QUESTION=', 'function obMascotQuestion(text){') + cut('function obMascotQuestion(text){', '\n}') + '\n}', ctx);
  assert.equal(ctx.obMascotDit('Oui', 'oui'), '<div class="ob-chat"><img class="ob-chat-stk is-gif is-oui" src="assets/chat-oui.webp" width="294" height="351" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Oui</div></div>');
  assert.equal(ctx.obMascotDit('Pseudo', 'pseudo'), '<div class="ob-chat"><img class="ob-chat-stk is-gif is-pseudo" src="assets/chat-pseudo.webp" width="298" height="305" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Pseudo</div></div>');
  assert.equal(ctx.obMascotDit('?', ''), ctx.obMascotQuestion('?'), 'sans GIF : la question');
});

test('les questions de l’onboarding : la question en arrivant, il hoche la tête une fois répondu', () => {
  const oui = (entree, rep) => { const c = vm.createContext({ obJustEntered: entree }); vm.runInContext(cut('function obMascotOui(rep){', '\n'), c); return c.obMascotOui(rep); };
  assert.equal(oui(true, '25-34'), '', 'en arrivant (même déjà répondu)');
  assert.equal(oui(false, '25-34'), 'oui');
  assert.equal(oui(false, ''), '');
  assert.equal(oui(false, undefined), '');
  assert.equal(oui(false, 7), 'oui', 'les jours (un nombre)');
  for (const s of ["${obMascotDit('Pour mieux te connaître. Il n’y a pas d’âge pour apprendre le SQL !',obMascotOui(draft.ageRange||draft.genre))}",
    "${obMascotDit(accord('Étudiante','Étudiant','Étudiant·e')+', en poste ou en reconversion : tout le monde a sa place ici.',obMascotOui(draft.job))}",
    /* 12 novembre, 12 h 24 : le pays n’a plus de bulle ; son chat, assis sur la carte, hoche la tête une fois le pays posé */
    "src=\"assets/${oui?'chat-oui':'chat-question'}${fixe?'-fixe':''}.webp\"",
    "${obMascotDit('Même dix minutes suffisent pour avancer.',obMascotOui(draft.rythme))}",
    "${obMascotDit('Même deux jours par semaine, ça fait avancer !',obMascotOui(draft.freq))}",
    "${obMascotDit('Comment tes adversaires vont-ils t’appeler ?','pseudo')}"])
    assert.ok(app.includes(s), s);
  for (const r of ['html #onboarding.ob-vitrine .ob-chat img.is-oui{aspect-ratio:294/351}', 'html #onboarding.ob-vitrine .ob-chat img.is-pseudo{aspect-ratio:298/305}',
    'html #onboarding.ob-vitrine .ob-pseudo .ob-chat:has(img.is-pseudo){grid-template-columns:90px 1fr!important}', 'html #onboarding.ob-vitrine .ob-pseudo .ob-chat img.is-pseudo{width:90px!important}'])
    assert.ok(ob.includes(r), r);
});

test('l’engagement : le serment, à droite du bouton à l’empreinte', () => {
  const ctx = vm.createContext({ PACTE_PRIS: 'Pris', OB_EMPREINTE_SVG: '<svg/>' });
  vm.runInContext(cut('function holdZoneHTML(id,fait,chat){', '\n}') + '\n}', ctx);
  assert.ok(ctx.holdZoneHTML('ob-hold', false, '<img x>').startsWith('<div class="ob-hold-zone has-chat"><img x>'));
  assert.ok(ctx.holdZoneHTML('plus-hold', false).startsWith('<div class="ob-hold-zone">\n'), 'dans Mon compte : sans le chat');
  assert.ok(app.includes("${holdZoneHTML('ob-hold',!!draft.pacte,typeof chatBonusHtml==='function'?chatBonusHtml('serment','ob-hold-chat'):'')}</div>`;"));
  for (const r of ['html #onboarding.ob-vitrine .ob-hold-zone.has-chat{position:relative}', 'html #onboarding.ob-vitrine .ob-hold-chat{position:absolute;bottom:0;left:calc(50% + 66px);width:92px;pointer-events:none}',
    'html #onboarding.ob-vitrine.ob-fit-5 .ob-pact .ob-hold-chat{left:calc(50% + 44px);width:64px}'])
    assert.ok(ob.includes(r), r);
});

test('la salle : il attend en tapotant du pied quand on rejoint un ami ; l’hôte garde sa cible', () => {
  assert.ok(app.includes("html=etat('chat:pied','Tu rejoins la salle…',"));
  assert.ok(app.includes("const frame=etat(host?'target':'chat:pied',host?(J.pub?'Ta salle de défi'"));
  assert.ok(app.includes("<span class=\"room-stk\" aria-hidden=\"true\">${lqStkSvg(String(stk).startsWith('chat:')?'help':stk)}</span>"), 'sans le GIF : un autocollant connu');
});

test('« Encore un effort ! » : la leçon à refaire (une fois), puis l’autocollant ; le défi sans rien trouvé', () => {
  const monde = reduit => {
    const cls = new Set(['mstk-cat']), attrs = { width: '450', height: '674' };
    const img = { src: 'assets/mascotte-autocollant.webp', classList: { add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c) }, setAttribute: (k, v) => { attrs[k] = v; }, hasAttribute: () => false, cls, attrs };
    const ctx = vm.createContext({ MASCOT_IMG: 'assets/mascotte-autocollant.webp', mascotReduced: () => reduit, img, btn: { querySelector: () => img } });
    vm.runInContext(cut('const MASCOT_BRAVO=', 'function mascotBravoImg(cls){') + cut('function mascotBravo(btn,on){', '\n/*'), ctx);
    return ctx;
  };
  const m = monde(false);
  vm.runInContext("mascotBravo(btn,'effort')", m);
  assert.deepEqual([m.img.src, m.img.cls.has('is-effort'), m.img.attrs.width, m.img.attrs.height], ['assets/chat-effort.webp', true, '340', '365']);
  vm.runInContext('mascotBravo(btn,false)', m);
  assert.deepEqual([m.img.src, m.img.cls.has('is-effort'), m.img.attrs.width], ['assets/mascotte-autocollant.webp', false, '450'], 'l’écran quitté : l’autocollant (le GIF repartira du début)');
  vm.runInContext("mascotBravo(btn,'effort')", m); vm.runInContext('mascotBravo(btn,true)', m);
  assert.ok(m.img.cls.has('is-bravo') && !m.img.cls.has('is-effort') && /chat-bravo/.test(m.img.src), 'réussie ensuite : le saut de joie');
  const r = monde(true); vm.runInContext("mascotBravo(btn,'effort')", r); assert.equal(r.img.src, 'assets/chat-effort-fixe.webp');
  assert.ok(cut('function lvEndShow(root,id,win){', '\n}').includes("mascotBravo(cat,win?true:LV.retry?'effort':false);"));
  assert.ok(app.includes("const chatS=all||J.record?'trophee':nOk?'oui':'effort'"), 'un défi sans rien trouvé : l’effort, dans le cadre violet (14 novembre, 6 h 12)');
  for (const r of ['html.lq .mascot-stk .mstk-cat.is-effort,html.lq .mascot-stk:is(.is-hello,.is-intro,.is-party) .mstk-cat.is-effort{animation:none}',
    'html.lq .lv-end-top .mascot-stk:has(.mstk-cat.is-effort){width:120px;margin:-8px -8px -6px -6px}'])
    assert.ok(lq.includes(r), r);
});

test('le tableau de stickers vide : il colle un sticker, à gauche du texte', () => {
  const r = cut('function renderStickers(){', '\n/* En quittant l’écran');
  assert.ok(r.includes("const chatVide=typeof chatBonusHtml==='function'?chatBonusHtml('stickers','stk-empty-chat'):'';"));
  assert.ok(r.includes('`<div class="stk-empty is-chat">${chatVide}<div class="stk-empty-t"><b>${t}</b><span>${p}</span>${x}</div></div>`'));
  for (const s of ['html.lq .stk-empty.is-chat{flex-direction:row;gap:14px;padding:14px 18px;text-align:left}', 'html.lq .stk-empty.is-chat .stk-empty-chat{flex:none;width:clamp(78px,26%,112px)}',
    'html.lq .stk-empty-t{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}'])
    assert.ok(lq.includes(s), s);
});

test('« Nouvelle carte mémo ! » : il retourne la sienne, seulement pour une carte toute neuve', () => {
  const b = cut('function bravoUnlockHtml(l){', '\n}');
  /* 11 novembre, 17 h 20 : une fois par leçon (une leçon peut donner deux cartes) ; 12 novembre, 17 h 05 : à côté de la main */
  assert.ok(b.includes("const chat=neuve&&typeof chatBonusHtml==='function'?`<span class=\"mc-reveal-chat\" aria-hidden=\"true\">${chatBonusHtml('carte')}</span>`:'';"));
  assert.ok(b.includes("${MEMO_MAIN_SVG}${chat}</div>"));
  assert.ok(lq.includes('html.lq .mc-reveal-chat{position:absolute;z-index:3;right:-14px;bottom:-10px;width:calc(86px * var(--mc-fs,1));pointer-events:none}') && lq.includes('html.lq .is-flipped .mc-reveal-chat{opacity:0;'), 'au coin bas droit ; la carte retournée, il s’efface');
});

test('eurêka : la ligne de l’indice d’un défi, et « Ce que tu retiens »', () => {
  const ctx = vm.createContext({ esc: s => String(s), escCode: s => String(s), highlight: s => s, defiSquelette: s => s, defiTables: () => ['vols'], jeuChrono: () => '', chatBonusHtml: k => `<img k="${k}">` });
  vm.runInContext(cut('function defiIndices(c){', '\n}') + '\n}' + cut('function defiIndicesHTML(c,n,view,diag,next,kind){', '\nfunction coachNext(){'), ctx);
  const c = { sol: 'SELECT 1', indice: 'Une piste' };
  const un = ctx.defiIndicesHTML(c, 1, 1, '', null, 'solo'), zero = ctx.defiIndicesHTML(c, 0, 0, '', null, 'solo');
  assert.ok(/<div class="coach-h">.*<span class="coach-chat" aria-hidden="true"><img k="eureka"><\/span><\/div>/s.test(un) && un.includes('has-chat'), 'un indice : l’ampoule, au bout de la ligne');
  assert.ok(!zero.includes('coach-chat') && !zero.includes('has-chat'), '« À toi de jouer » : pas encore');
  assert.ok(lq.includes('html.lq .coach-chat{flex:none;width:50px;margin:-16px -6px -14px -2px;pointer-events:none}') && lq.includes('@media (max-width:360px){html.lq .coach-chat{display:none}}'));
  assert.ok(app.includes("<span class=\"bv-bulb${typeof chatBonusHtml==='function'?' is-chat':''}\" aria-hidden=\"true\">${typeof chatBonusHtml==='function'?chatBonusHtml('eureka'):typeof lqStkSvg==='function'?lqStkSvg('bulb'):''}</span>"));
  assert.ok(lq.includes('html.lq #scr-lesson .bv-bulb.is-chat{width:60px;height:auto;margin:-14px 0 0 -6px;rotate:0deg;animation:none}'));
});
