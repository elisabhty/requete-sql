/* Elisa, 7 novembre, 14 h 27 : six GIF de plus (16 images de 380 ms), aux places de la liste :
   - la clé ouvre la porte : la page de connexion ouverte sans première requête (« Garde ta progression », depuis Mon compte ou après
     une déconnexion) ; juste après la première requête, le chat garde son « Bravo » ;
   - le réveil sonne : la bulle du rappel de l’onboarding ;
   - le trophée levé sous les confettis : un défi tout trouvé, un nouveau record, une partie gagnée entre amis (à droite du titre, qui
     perd sa coupe 🏆) ;
   - l’avion en papier : « Message envoyé ! » (Mon compte, Contacte-nous), une fois, à la place de la fusée ;
   - le téléphone levé qui cherche le réseau : les feuilles « Pas de réseau » (le picto 📶) ;
   - le fou rire : son choix (« Toucher le chat ») : on touche le chat de l’accueil, il éclate de rire comme si on le chatouillait,
     avec sa bulle « Hi hi, ça chatouille ! », puis reprend sa pose ; ailleurs, le toucher garde le coucou.
   L’avion avait gardé des plaques de fond blanc autour du chat : retirées avant la conversion. Mouvement réduit : l’image fixe.
   Vérifié dans un navigateur (393 et 320 px) : le rappel, la connexion, le fou rire, « Pas de réseau », « Message envoyé ! », la fin
   d’un défi tout trouvé. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), ob = lire('onboarding-vitrine.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const NOUVEAUX = { cle: [309, 302, 0], avion: [313, 311, 1], reveil: [272, 311, 0], trophee: [290, 311, 0], reseau: [300, 310, 0], rire: [315, 305, 1] };

/* Les dimensions et le nombre de tours d’un WebP animé, lus dans ses blocs VP8X, ANIM et ANMF */
function webp(f) {
  const b = fs.readFileSync(path.join(ROOT, f));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.toString('latin1', 8, 12), 'WEBP');
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

test('les six GIF : animés (16 images de 380 ms), leur image fixe, rangés pour le hors ligne', () => {
  for (const [k, [w, h, tours]] of Object.entries(NOUVEAUX)) {
    const a = webp(`assets/chat-${k}.webp`);
    assert.deepEqual([a.w, a.h, a.images, a.ms, a.tours], [w, h, 16, 380, tours], `chat-${k}.webp (${tours ? 'une fois' : 'en boucle'})`);
    const f = webp(`assets/chat-${k}-fixe.webp`);
    assert.deepEqual([f.w, f.h, f.images], [w, h, 0], `chat-${k}-fixe.webp : une image, la même taille`);
    for (const x of ['', '-fixe']) assert.ok(sw.includes(`  './assets/chat-${k}${x}.webp',\n`), `sw.js : chat-${k}${x}.webp`);
  }
});

test('chatBonusHtml : les six nouveaux, à leur taille ; l’image fixe en mouvement réduit', () => {
  for (const reduit of [false, true]) {
    const ctx = vm.createContext({ mascotReduced: () => reduit });
    vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){'), ctx);
    for (const [k, [w, h]] of Object.entries(NOUVEAUX))
      assert.equal(ctx.chatBonusHtml(k, 'x'), `<img class="chat-bonus is-${k} x" src="assets/chat-${k}${reduit ? '-fixe' : ''}.webp" width="${w}" height="${h}" alt="" draggable="false">`, k);
    assert.equal(ctx.chatBonusHtml('loupe'), `<img class="chat-bonus is-loupe" src="assets/chat-loupe${reduit ? '-fixe' : ''}.webp" width="307" height="356" alt="" draggable="false">`, 'les anciens ne bougent pas');
    assert.equal(ctx.chatBonusHtml('valueOf'), '', 'un nom inconnu : rien');
  }
});

test('le rappel de l’onboarding : le réveil qui sonne, dans sa bulle', () => {
  assert.ok(app.includes("${obMascotDit('Avec moi, tu n’oublieras pas ta séance !','reveil')}\n      ${obRappelCarte()}"));
  const ctx = vm.createContext({ esc: s => String(s), mascotReduced: () => false });
  vm.runInContext(cut('const MASCOT_QUESTION=', 'function obMascotQuestion(text){') + cut('function obMascotQuestion(text){', '\n}') + '\n}', ctx);
  assert.equal(ctx.obMascotDit('Avec moi', 'reveil'), '<div class="ob-chat"><img class="ob-chat-stk is-gif is-reveil" src="assets/chat-reveil.webp" width="272" height="311" alt="La mascotte Requête" draggable="false"><div class="ob-bubble">Avec moi</div></div>');
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-chat img.is-reveil{aspect-ratio:272/311}'));
  assert.ok(ob.indexOf('.ob-chat img.is-reveil{') < ob.indexOf('html #onboarding.ob-vitrine .ob-chat img.is-gif{animation:obvApparait'), 'avec les autres chats des bulles');
});

test('la connexion ouverte sans première requête : la clé ouvre la porte ; après la première requête, le « Bravo »', () => {
  const ctx = vm.createContext({ MASCOT_IMG: 'assets/mascotte-autocollant.webp', mascotBravoImg: c => `<img class="${c} is-bravo">`, chatBonusHtml: (k, c) => `<img class="chat-bonus is-${k} ${c}">` });
  vm.runInContext(cut('function obCompteHautHTML(reussie){', '\nconst OB_ICO_NUAGE='), ctx);
  const sans = ctx.obCompteHautHTML(false), avec = ctx.obCompteHautHTML(true);
  assert.ok(sans.includes('<img class="chat-bonus is-cle ob-promise-stk ob-compte-stk">') && !sans.includes('is-bravo') && !sans.includes('Bravo'), 'sans réussite : la porte, sans fête');
  assert.ok(avec.includes('<img class="ob-promise-stk ob-compte-stk is-bravo">') && !avec.includes('is-cle'), 'après la première requête : le saut de joie');
  /* Sans le GIF (chatBonusHtml absent), l’autocollant d’avant */
  const c2 = vm.createContext({ MASCOT_IMG: 'm.webp', mascotBravoImg: c => `<img class="${c} is-bravo">` });
  vm.runInContext(cut('function obCompteHautHTML(reussie){', '\nconst OB_ICO_NUAGE='), c2);
  assert.ok(c2.obCompteHautHTML(false).includes('<img class="ob-promise-stk ob-compte-stk" src="m.webp" width="450" height="674" alt="" draggable="false">'));
  assert.ok(ob.includes('html #onboarding.ob-vitrine .ob-account .ob-compte-stk.is-cle{width:calc(var(--stk) * 1.5);animation:none}'));
  assert.ok(ob.indexOf('.ob-compte-stk.is-cle{') > ob.indexOf('html #onboarding.ob-vitrine .ob-account .ob-compte-stk{position:relative;display:block;width:var(--stk);margin:0}'), 'après la taille de l’autocollant');
});

test('« Pas de réseau » : le chat lève son téléphone à la place du picto 📶 ; les autres feuilles gardent le leur', () => {
  const ligne = cut('const lqInfo=(titre,texte,ico)=>', '\n');
  assert.equal(ligne, "const lqInfo=(titre,texte,ico)=>lqAsk({ico:ico||'ℹ️',chat:ico==='📶'&&typeof chatBonusHtml==='function'?chatBonusHtml('reseau'):'',titre,texte,oui:'OK',non:null});");
  const vus = [];
  const ctx = vm.createContext({ lqAsk: o => vus.push(o), chatBonusHtml: k => `<img chat="${k}">` });
  vm.runInContext(ligne + '\nthis.lqInfo=lqInfo;', ctx);
  ctx.lqInfo('Pas de réseau', 'Il faut une connexion internet.', '📶');
  ctx.lqInfo('Projet trop lourd', '…', '💾');
  assert.deepEqual([vus[0].chat, vus[0].ico, vus[0].titre, vus[0].oui, vus[0].non], ['<img chat="reseau">', '📶', 'Pas de réseau', 'OK', null]);
  assert.equal(vus[1].chat, '', 'un autre picto : pas de chat');
  assert.ok(app.includes("${o.ico||o.chat?'':' is-nostk'}\">${o.chat?`<span class=\"lq-ask-stk is-chat\" aria-hidden=\"true\">${o.chat}</span>`:o.ico?lqAskStk(o.ico):''}"), 'lqAsk montre le chat');
  assert.equal((app.match(/lqInfo\('Pas de réseau',/g) || []).length, 3, 'les trois feuilles « Pas de réseau » passent par lqInfo et le picto 📶');
  assert.ok(lq.includes('html.lq .lq-ask-stk.is-chat{width:96px;height:auto;margin-bottom:8px;rotate:0deg}'));
});

test('« Message envoyé ! » : l’avion en papier, une fois, à la place de la fusée', () => {
  const ct = cut('function ctHTML(){', '\n  const t=CT_TYPES.find');
  assert.ok(ct.includes("${typeof chatBonusHtml==='function'?`<span class=\"ct-merci-stk is-chat\" aria-hidden=\"true\">${chatBonusHtml('avion')}</span>`:`<span class=\"ct-merci-stk is-stk\" aria-hidden=\"true\">${lqStkSvg('rocket')}</span>`}\n        <b>Message envoyé&nbsp;!</b>"));
  assert.ok(lq.includes('html.lq #scr-compte .ct-merci-stk.is-chat{width:128px;height:auto;margin:-10px 0 -2px;rotate:0deg;animation:none!important}') && lq.includes('html.lq #scr-compte .ct-merci-stk.is-chat .chat-bonus{width:100%}'));
  assert.ok(lq.indexOf('.ct-merci-stk.is-chat{') > lq.indexOf('html.lq #scr-compte .ct-merci-stk{animation:ctDecolle'), 'ni décollage ni flottement par-dessus son lancer');
});

test('la fin d’un défi : le trophée pour tout trouvé, un nouveau record ou une partie gagnée ; le titre perd sa coupe', () => {
  assert.ok(app.includes("const trophee=(all||J.record)&&typeof chatBonusHtml==='function'?`<div class=\"jeu-fin-chat\" aria-hidden=\"true\">${chatBonusHtml('trophee')}</div>`\n        :!nOk&&nT>0&&typeof chatBonusHtml==='function'?`<div class=\"jeu-fin-chat is-effort\" aria-hidden=\"true\">${chatBonusHtml('effort')}</div>`:'';   // rien trouvé : « Encore un effort ! » (15 h 38)\n") && app.includes("const titre=all?(trophee?'Tout résolu\\u00a0!':'Tout résolu ! 🏆'):nOk?'Bien joué\\u00a0!':'On retente\\u00a0?';") && app.includes("html=trophee+head('Fin de la partie',titre,`Niveau ${JEU_NIVL[J.niv].toLowerCase()}`)+"), 'seul (« Tout résolu ! », 9 novembre, 10 h 01 ; « Bien joué ! », « On retente ? », 10 h 37)');
  assert.ok(app.includes("const trophee=winner&&typeof chatBonusHtml==='function'?`<div class=\"jeu-fin-chat\" aria-hidden=\"true\">${chatBonusHtml('trophee')}</div>`:'';\n      html=trophee+head('Salle de défi · Fin de partie',winner?(trophee?'Tu as gagné\\u00a0!':'Tu as gagné ! 🏆'):'Le podium',"), 'entre amis');
  /* 8 novembre, 10 h 24 (« Le chat est coupé ») : posé au haut du contenu, plus au-dessus ; la marge de la phrase passe en !important */
  for (const r of ['html.lq #jeu-root>.jeu-fin-chat{position:absolute;top:0;right:-10px;z-index:1;width:116px;pointer-events:none}', 'html.lq #jeu-root>.jeu-fin-chat .chat-bonus{width:100%}',
    'html.lq #jeu-root:has(>.jeu-fin-chat)>:is(h1,.l-sub){margin-right:100px!important}', '@media (max-width:360px){html.lq #jeu-root>.jeu-fin-chat{width:96px}html.lq #jeu-root:has(>.jeu-fin-chat)>:is(h1,.l-sub){margin-right:82px!important}}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.includes('.jeu{position:relative}'), 'posé dans la page du défi');
});

/* Un petit monde pour le toucher : un bouton, son image, des minuteurs */
function monde({ reduit = false, accueil = true } = {}) {
  const timers = [], vagues = [], vibre = [];
  const img = {
    _src: 'assets/chat-coucou-fixe.webp', style: {}, isConnected: true, cls: new Set(['mstk-cat', 'is-coucou']),
    get src() { return this._src; }, set src(v) { this._src = v; this.vus.push(v); }, vus: [],
    getAttribute(k) { return k === 'src' ? this._src : k === 'data-anim' ? 'coucou' : null; },
    hasAttribute: k => k === 'data-une-fois', closest: () => btn
  };
  img.classList = { add: c => img.cls.add(c), remove: (...c) => c.forEach(x => img.cls.delete(x)), contains: c => img.cls.has(c) };
  const enfants = [];
  const btn = {
    cls: new Set(['mascot-stk', 'is-intro']), offsetWidth: 1, enfants,
    querySelector: s => s === '.mstk-cat[data-une-fois]' ? (accueil ? img : null) : s === '.mstk-bub.is-chatouille' ? enfants.find(e => e.className === 'mstk-bub is-chatouille') || null : null,
    appendChild: e => { enfants.push(e); e.remove = () => enfants.splice(enfants.indexOf(e), 1); }
  };
  btn.classList = { add: c => btn.cls.add(c), remove: (...c) => c.forEach(x => btn.cls.delete(x)), contains: c => btn.cls.has(c) };
  const ctx = vm.createContext({
    mascotReduced: () => reduit, buzz: t => vibre.push(t), mascotWave: b => vagues.push(b),
    setTimeout: (f, d) => { timers.push({ f, d }); return timers.length; }, clearTimeout: () => {}, requestAnimationFrame: f => f(),
    document: { createElement: () => ({ className: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, textContent: '' }) }
  });
  vm.runInContext(cut("const MASCOT_COUCOU='assets/chat-coucou.webp'", 'function mascotChatHtml(o){') + cut('function mascotToucher(btn){', '\n/* La phrase des retrouvailles'), ctx);
  return { ctx, img, btn, timers, vagues, vibre };
}

test('toucher le chat de l’accueil : il éclate de rire, avec sa bulle, puis reprend sa pose ; ailleurs, le coucou', () => {
  assert.ok(app.includes(`class="mascot-stk\${o.intro?' is-intro':''}" onclick="mascotToucher(this)" aria-label=`), 'le bouton de l’autocollant');
  assert.ok(app.includes("const MASCOT_RIRE='assets/chat-rire.webp',MASCOT_RIRE_FIXE='assets/chat-rire-fixe.webp',MASCOT_RIRE_MS=6080;"));
  const m = monde();
  m.ctx.btn = m.btn; vm.runInContext('mascotToucher(btn)', m.ctx);
  assert.equal(m.img.src, 'assets/chat-rire.webp', 'le fou rire');
  assert.ok(m.img.cls.has('is-rire') && m.img.style.aspectRatio === '289 / 352', 'dans le cadre de l’autocollant, qui ne bouge pas');
  assert.ok(m.btn.cls.has('is-rire') && !m.btn.cls.has('is-intro') && !m.btn.cls.has('is-hello'), 'ni coucou ni arrivée par-dessus');
  const bulle = m.btn.enfants[0];
  assert.equal(bulle.className, 'mstk-bub is-chatouille'); assert.equal(bulle.textContent, 'Hi hi, ça chatouille !'); assert.equal(bulle.attrs['aria-hidden'], 'true');
  assert.deepEqual(m.vibre, ['light']);
  assert.deepEqual(m.timers.map(t => t.d), [5940], 'le GIF en entier (16 × 380 ms)');
  /* Retouché en plein rire : il recommence au début (l’image fixe, le temps d’une image), une seule bulle */
  vm.runInContext('mascotToucher(btn)', m.ctx);
  assert.deepEqual(m.img.vus.slice(-2), ['assets/chat-coucou-fixe.webp', 'assets/chat-rire.webp']);
  assert.equal(m.btn.enfants.length, 1);
  m.timers.at(-1).f();
  assert.equal(m.img.src, 'assets/chat-coucou-fixe.webp', 'sa pose de repos');
  assert.ok(!m.img.cls.has('is-rire') && m.img.style.aspectRatio === '' && !m.btn.cls.has('is-rire') && m.btn.enfants.length === 0, 'plus de rire ni de bulle');
  /* Ailleurs (la bienvenue, la fin d’une leçon) : le coucou d’avant */
  const a = monde({ accueil: false }); a.ctx.btn = a.btn; vm.runInContext('mascotToucher(btn)', a.ctx);
  assert.deepEqual(a.vagues, [a.btn]); assert.equal(a.img.vus.length, 0);
  /* Mouvement réduit : l’image où il rit, un instant */
  const r = monde({ reduit: true }); r.ctx.btn = r.btn; vm.runInContext('mascotToucher(btn)', r.ctx);
  assert.equal(r.img.src, 'assets/chat-rire-fixe.webp'); assert.deepEqual(r.timers.map(t => t.d), [2400]);
});

test('un coucou demandé en plein rire (les retrouvailles) : le rire s’arrête d’abord ; ses styles', () => {
  assert.ok(cut('function mascotCoucouJoue(img){', '\n}').includes("if(img._rireT&&typeof mascotRireFin==='function')mascotRireFin(img.closest?img.closest('.mascot-stk'):null,img);"));
  assert.ok(cut('function mascotCoucouJoue(img){', '\n}').indexOf('mascotRireFin') < cut('function mascotCoucouJoue(img){', '\n}').indexOf('mascotReduced()'), 'même en mouvement réduit');
  for (const r of ['html.lq .mascot-stk .mstk-cat.is-rire{object-fit:contain;object-position:50% 100%;scale:1.25;transform-origin:50% 100%;animation:none!important}',
    'html.lq .mascot-stk.is-rire .mstk-bub.is-chatouille{animation:mstkBub 3.4s ease-out .3s both}',
    '@media (prefers-reduced-motion:reduce){html.lq .mascot-stk.is-rire .mstk-bub.is-chatouille{opacity:1;transform:rotate(-6deg)}}',
    'html.lq[data-motion="reduce"] .mascot-stk.is-rire .mstk-bub.is-chatouille{opacity:1;transform:rotate(-6deg)}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('.mstk-bub.is-chatouille{opacity:1') > lq.indexOf('html.lq[data-motion="reduce"] .mascot-stk *{animation:none!important}'), 'la bulle reste lisible en mouvement réduit');
});
