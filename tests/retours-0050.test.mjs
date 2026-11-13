/* Elisa, 7 novembre, 0 h 50, sur une capture de l’écran Stickers :
   1. « Débloque des stickers au fil de tes progrès. Collectionne-les, amuse-toi à les placer et imprime tes créations ! » ;
   2. « Le grand carré violet est joli, mais il occupe beaucoup d’espace alors qu’il est vide » : « À toi de créer ! ✨ », « Choisis un
      sticker dans ta collection et place-le ici. », et un bouton « Ajouter un sticker + » qui permet de sélectionner un sticker
      débloqué sans devoir faire défiler la page ;
   3. « Ta planche » devient « Ta collection », et « 7 sur 21 » devient « 7/21 débloqués ».
   Vide, le tableau est moins haut (16/9, 3/2 sur les écrans étroits) ; il reprend sa taille (4/3) au premier sticker. Le bouton reste
   sous le tableau tant qu’il reste des stickers à coller ; les compteurs des groupes passent aussi en « 1/15 ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), lq = read('ludique.css'), sw = read('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const NB = ' ';

test('1. le texte d’accroche', () => {
  assert.ok(app.includes('<p class="sub">Débloque des stickers au fil de tes progrès. Collectionne-les, amuse-toi à les placer et imprime tes créations&nbsp;!</p></div>'));
  assert.ok(!app.includes('Gagne-les en avançant'));
});

test('2. le tableau vide : « À toi de créer ! ✨ », sa phrase et « Ajouter un sticker + » ; le même bouton sous le tableau', () => {
  const r = cut('function renderStickers(){', '\n/* En quittant l’écran');
  assert.ok(r.includes("const ajout=won.some(s=>!onBoard.has(s.id))?`<button type=\"button\" class=\"stk-ajout\" onclick=\"stkChoisir()\">Ajouter un sticker${STK_PLUS_SVG}</button>`:'';"), 'tant qu’il reste un sticker débloqué à coller');
  /* 7 novembre, 15 h 38 : le chat y colle un sticker (son GIF), à gauche du texte ; sans le GIF, le texte seul */
  assert.ok(r.includes(":!S.board.length?vide('À toi de créer&nbsp;! ✨','Choisis un sticker dans ta collection et place-le ici.',ajout):'';"));
  assert.ok(r.includes('`<div class="stk-empty is-chat">${chatVide}<div class="stk-empty-t"><b>${t}</b><span>${p}</span>${x}</div></div>`:`<div class="stk-empty"><b>${t}</b><span>${p}</span>${x}</div>`'));
  assert.ok(r.includes("<p>${STK_TACTILE?'Glisse pour déplacer, pince ou tire la poignée pour tourner et agrandir.':'Glisse pour déplacer, tire la poignée pour tourner et agrandir.'}</p>\n        ${ajout}\n        <div class=\"stk-board-actions\">"), 'avec des stickers collés : sous le tableau');
  assert.ok(r.includes("?vide('Ton tableau t’attend','Ton premier sticker arrive avec ta première activité validée.','')"), 'sans sticker gagné : pas de bouton, le tableau attend');
  assert.ok(app.includes(`const STK_PLUS_SVG='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';`));
  for (const k of ['html.lq .stk-board.is-empty{aspect-ratio:16/9}', '@media (max-width:359px){html.lq .stk-board.is-empty{aspect-ratio:3/2}}', 'html.lq .stk-empty span{text-wrap:balance}',
    'background:var(--sun);color:#1B1640;font:800 15.5px/1.1 var(--display);letter-spacing:-.01em;cursor:pointer;box-shadow:0 4px 0 var(--sun-lip);',
    'html.lq .stk-ajout:active{transform:translateY(4px);box-shadow:0 0 0 var(--sun-lip)}', 'html.lq .stk-empty .stk-ajout{margin-top:10px;pointer-events:auto}',
    'html.lq .stk-board-bar>.stk-ajout{width:100%;min-height:52px}', 'html.lq .stk-choix .stk-cell{cursor:pointer}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!/\.stk-board\.is-empty\{[^}]*min-height/.test(lq), 'pas de hauteur minimale : avec le ratio, elle élargirait le tableau au-delà de l’écran');
});

test('« Ajouter un sticker + » : la feuille liste les stickers débloqués pas encore collés ; en toucher un le colle', () => {
  const fn = cut('function stkTitreFeuille(t){', '\n') + '\n' + cut('/* « Ajouter un sticker + » (7 novembre, 0 h 50)', '/* « Coller sur le tableau » depuis la planche');
  const el = () => ({ classList: { on: new Set(), add(c) { this.on.add(c); } }, innerHTML: '', scrollTop: 9, textContent: 'Sticker', focus() {} });
  const body = el(), back = el(), sheet = el(), titre = el(), fab = el();
  const S = { got: { a: 1, b: 1, c: 1 }, board: [{ id: 'b' }] };
  const vus = [];
  const ctx = vm.createContext({
    document: { getElementById: id => ({ 'stk-sheet-body': body, 'stk-back': back, 'stk-sheet': sheet, fab })[id] || null, querySelector: s => (s === '#stk-sheet .viz-head b' ? titre : null), activeElement: 'bouton' },
    stkState: () => S, stkList: () => [{ id: 'a', got: 1, name: 'A', cap: 'Module 1' }, { id: 'b', got: 1, name: 'B', cap: '' }, { id: 'c', got: 1, name: 'C', cap: '' }, { id: 'd', got: 0, name: 'D' }],
    stkArtHtml: id => `<i data-art="${id}"></i>`, stkRarHtml: id => (id === 'c' ? '<span class="stk-rar">Rare</span>' : ''), stkRarete: id => (id === 'c' ? 'Rare' : ''),
    esc: s => s, escAttr: s => s, buzz: k => vus.push('buzz ' + k), stkPaint: r => vus.push(r === body ? 'peint' : '?'), requestAnimationFrame: f => f(),
    stkOpenId: 'x', stkReturn: null,
  });
  vm.runInContext('var stkOpenId,stkReturn;' + fn, ctx);
  vm.runInContext('stkChoisir()', ctx);
  assert.equal(titre.textContent, 'Ajouter un sticker', 'le titre de la feuille');
  assert.ok(back.classList.on.has('on') && sheet.classList.on.has('on') && fab.classList.on.has('hide'), 'la feuille s’ouvre');
  const ids = [...body.innerHTML.matchAll(/data-id="(\w)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['a', 'c'], 'débloqués et pas encore sur le tableau');
  assert.ok(body.innerHTML.includes('<h2 class="acct-sr" id="stk-name">Ajouter un sticker</h2>'), 'le nom de la feuille pour le lecteur d’écran (aria-labelledby="stk-name")');
  assert.ok(body.innerHTML.includes(`onclick="stkTogglePlace('a')"`) && body.innerHTML.includes('aria-label="C, rare, le coller sur le tableau"'));
  assert.ok(body.innerHTML.includes('<small class="stk-cap">Module 1</small>'));
  assert.equal(body.scrollTop, 0);
  assert.deepEqual(vus, ['buzz selection', 'peint']);
  assert.ok(cut('function stkOpen(id){', 'const S=stkState(),placed=').includes("stkTitreFeuille('Sticker');"), 'la fiche d’un sticker garde son titre');
  /* Tout est collé : la feuille ne s’ouvre pas (et le bouton n’est pas là) */
  S.board = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; body.innerHTML = ''; titre.textContent = 'Sticker';
  vm.runInContext('stkChoisir()', ctx);
  assert.equal(body.innerHTML, ''); assert.equal(titre.textContent, 'Sticker');
});

test('le tableau vide, moins haut : un sticker posé garde sa place à l’écran quand le tableau reprend sa taille', () => {
  const fn = cut('function stkClampPos(', 'function stkAngle(') + cut('function stkFreeSpot(R){', 'function stkRemove(id){');
  const S = { got: { a: 1 }, fresh: {}, board: [] };
  const board = { classList: { contains: c => c === 'is-empty' }, getBoundingClientRect: () => ({ width: 345, height: 194 }) };
  const ctx = vm.createContext({ Math: Object.assign(Object.create(Math), { random: () => .5 }), document: { getElementById: () => board, querySelector: () => null },
    stkState: () => S, save() {}, renderStickers() {}, buzz() {}, stkStick() {}, stkJust: null, stkSel: null });
  vm.runInContext('var stkJust,stkSel;' + fn, ctx);
  vm.runInContext("stkPlace('a',.5,.5)", ctx);
  const b = S.board[0];
  assert.equal(b.x, .5);
  assert.ok(Math.abs(b.y * 345 * .75 - .5 * 194) < .5, 'à la même hauteur sur l’écran, dans le tableau en 4/3');
});

test('3. « Ta collection » et « 7/21 débloqués » ; les autres textes parlent aussi de la collection', () => {
  const r = cut('function renderStickers(){', '\n/* En quittant l’écran');
  const ligne = r.match(/  const compte=\(n,t,mot\)=>.*;\n/)[0];
  const compte = vm.runInNewContext(ligne.replace('  const compte=', '(') .replace(/;\n$/, ')'));
  assert.equal(compte(7, 21, 'débloqué'), '<span><b aria-hidden="true">7/21 débloqués</b><b class="acct-sr">7 sur 21 débloqués</b></span>', 'le lecteur d’écran entend « 7 sur 21 »');
  assert.equal(compte(1, 21, 'débloqué'), '<span><b aria-hidden="true">1/21 débloqué</b><b class="acct-sr">1 sur 21 débloqué</b></span>');
  assert.equal(compte(3, 15), '<span><b aria-hidden="true">3/15</b><b class="acct-sr">3 sur 15</b></span>', 'les groupes aussi');
  assert.ok(r.includes(`<div class="acct-head"><h2 id="stk-sheet-t">Tous tes stickers</h2>\${compte(won.length,list.length,'débloqué')}</div>`), '7 h 56 : « Ta collection » passe en surtitre, la grille devient « Tous tes stickers »');
  assert.ok(r.includes('<div class="stk-group"><h3>${title}</h3>${compte(items.filter(s=>s.got).length,items.length)}</div>'));
  /* 11 novembre, 21 h 33 : plus de bandeaux (« Nouveau sticker », « Sticker décollé », « Tableau vidé ») ; la page et ce qu’entend le lecteur d’écran */
  for (const t of ["Voici ton sticker&nbsp;!", '`${s.name}\\u00a0: revenu dans ta collection`', "'Tableau vidé\\u00a0: tes stickers sont revenus dans ta collection.'",
    '<span>Ta collection</span><b class="mu-album-n">', "'Ton sticker est dans ta collection&nbsp;!'", "'Sticker ajouté à ta collection.'"])
    assert.ok(app.includes(t), t);
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/[Tt]a planche/.test(code), 'plus de « ta planche » à l’écran');
  assert.doesNotMatch(r, /[Bb]ientôt|[Pp]rochainement/);
  for (const t of ['À toi de créer&nbsp;! ✨', 'imprime tes créations&nbsp;!']) assert.ok(app.includes(t), 'espace insécable : ' + t);
  assert.ok(!code.includes('À toi de créer ! ') && !code.includes(`À toi de créer${NB}!${NB}✨`), 'à l’écran : l’insécable avant « ! », une espace normale avant ✨');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=329">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-13-accueil-v2932';") && app.includes("const SW_CACHE='requete-2026-11-13-accueil-v2932';"));
});
