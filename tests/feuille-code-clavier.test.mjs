/* Elisa, 8 novembre, la feuille « Rejoindre une partie · Entre ton code ! » et le clavier de l’iPhone :
   - 14 h 59 : « Cette page saute avec le clavier » : posée en bas, elle suivait le clavier ; au toucher du champ, Safari faisait d’abord
     défiler la page pour montrer le champ, puis la feuille remontait au-dessus du clavier : deux sauts. Elle est passée en haut.
   - 15 h 27 : « Pourquoi c’est en haut ? Ça va être sur l’application, est-ce que ça va faire bien ? » : un vide voilé entre elle et le
     clavier. Elle est devenue pleine hauteur, le champ en haut.
   - 16 h 18 (capture, clavier fermé) : « Ça fait trop long ».
   Maintenant : une carte posée en bas, comme les autres feuilles, qui monte avec le clavier d’un seul mouvement (--dx-clavier). Dans
   l’app, l’iPhone annonce le clavier et sa hauteur quand il commence à monter (keyboardWillShow) : la carte monte avec lui ; la page ne
   rétrécit qu’une fois le clavier arrivé (Keyboard « native ») et le cadre garde alors sa hauteur : rien ne bouge. Dans Safari, le champ
   touché, la carte monte de la hauteur du clavier de la fois d’avant (sinon environ 45 % de l’écran), corrigée quand Safari donne la
   vraie ; au focus, le champ est un instant placé tout en haut pour que Safari ne fasse rien défiler (comme React Aria). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), cap = JSON.parse(lire('capacitor.config.json'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}';

function bac({ natif = false, vv = { offsetTop: 0, height: 852 }, h = 852, stock = null } = {}) {
  const store = stock === null ? {} : { 'rq-clavier': String(stock) };
  const el = { dataset: { k: 'code' }, style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, classList: { on: new Set(), toggle(c, b) { if (b) this.on.add(c); else this.on.delete(c); } } };
  const minuteurs = [];
  const ctx = vm.createContext({
    window: { innerHeight: h, visualViewport: vv, Capacitor: natif ? { isNativePlatform: () => true } : undefined, addEventListener() {} },
    document: { getElementById: id => id === 'dx-feuille' ? el : null }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    requestAnimationFrame: f => f(), setTimeout: (f, ms) => { minuteurs.push([f, ms]); return minuteurs.length; }, clearTimeout() {}, Date, Math,
  });
  vm.runInContext('let dxClavierApp=0;' + fn('dxNatif') + fn('dxFeuilleCaler') + fn('dxClavierPrevu'), ctx);
  return { ctx, el, store, minuteurs, k: () => el.style.props['--dx-clavier'] };
}

test('une carte posée en bas qui monte avec le clavier ; plus de feuille pleine hauteur ni en haut', () => {
  assert.ok(lq.includes('html.lq .dx-feuille[data-k="code"] .dx-f-boite{translate:0 calc(-1 * var(--dx-clavier,0px));max-height:calc(100% - var(--dx-clavier,0px) - var(--safe-top,0px) - 16px);'));
  assert.ok(lq.includes('margin-bottom:calc(8px + max(0px, env(safe-area-inset-bottom,0px) - var(--dx-clavier,0px)));transition:transform .36s cubic-bezier(.32,.72,0,1),translate .3s cubic-bezier(.2,.8,.2,1)}'), 'au-dessus du clavier, plus de marge pour la barre d’accueil');
  assert.ok(lq.includes('html.lq .dx-feuille[data-k="code"]{transition:none}'), 'le cadre ne glisse plus : seule la carte monte');
  for (const k of ['height:calc(100% - var(--safe-top,0px) - 12px)', '.dx-feuille.on[data-k="code"]::after', '.dx-feuille[data-k="code"]{align-items:flex-start}', 'translateY(calc(-100% - 40px))'])
    assert.ok(!lq.includes(k), `ni pleine hauteur ni en haut : ${k}`);
  assert.ok(lq.includes('.dx-feuille{position:fixed;inset:0;z-index:2600;display:flex;align-items:flex-end;'), 'toutes posées en bas');
  assert.ok(fn('defisFeuilleOuvrir').includes('el.dataset.k=k;'));
});

test('Safari : la vraie hauteur du clavier (visualViewport), retenue pour la fois d’après ; sans clavier, rien', () => {
  const b = bac();
  b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.top, b.el.style.height, b.k(), b.el.classList.on.has('is-clavier')], ['0px', '852px', '0px', false]);
  Object.assign(b.ctx.window.visualViewport, { height: 516 });
  b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k(), b.el.classList.on.has('is-clavier'), b.store['rq-clavier']], ['852px', '336px', true, '336']);
  /* Safari a tout de même fait défiler la page de quelques points : la carte reste posée sur le clavier */
  Object.assign(b.ctx.window.visualViewport, { offsetTop: 10, height: 506 });
  b.ctx.dxFeuilleCaler();
  assert.equal(b.k(), '336px');
  b.el.dataset.k = 'creer';
  b.ctx.dxFeuilleCaler();
  assert.equal(b.k(), '0px', 'les autres feuilles ne suivent pas le clavier');
});

test('Safari : le champ touché, la carte monte tout de suite (la hauteur de la fois d’avant, sinon 45 %) ; pas de clavier : elle redescend', () => {
  const b = bac({ stock: 300 });
  b.ctx.dxClavierPrevu(b.el);
  assert.equal(b.k(), '300px', 'la hauteur de la fois d’avant');
  const [redescendre, ms] = b.minuteurs.at(-1);
  assert.equal(ms, 900);
  Object.assign(b.ctx.window.visualViewport, { height: 520 });   // le vrai clavier arrive
  b.ctx.dxFeuilleCaler();
  assert.equal(b.k(), '332px', 'corrigée par la vraie');
  redescendre();
  assert.equal(b.k(), '332px', 'le clavier est là : rien ne redescend');
  const c = bac();
  c.ctx.dxClavierPrevu(c.el);
  assert.equal(c.k(), Math.round(852 * .45) + 'px', 'la première fois : 45 % de l’écran');
  c.minuteurs.at(-1)[0]();
  assert.equal(c.k(), '0px', 'pas de clavier après tout : elle redescend');
});

test('dans l’app : la carte monte avec le clavier annoncé ; la page rétrécie ensuite, le cadre garde sa hauteur ; le clavier parti, elle redescend', () => {
  const b = bac({ natif: true });
  b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k()], ['852px', '0px']);
  b.ctx.dxClavierPrevu(b.el);
  assert.equal(b.k(), '0px', 'pas d’estimation : l’app annonce le clavier');
  vm.runInContext('dxClavierApp=336', b.ctx); b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k()], ['852px', '336px'], 'keyboardWillShow : la carte monte avec le clavier');
  b.ctx.window.innerHeight = 516; b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k()], ['852px', '336px'], 'la page a rétréci : le cadre garde sa hauteur, rien ne bouge');
  vm.runInContext('dxClavierApp=0', b.ctx); b.el._ferme = Date.now(); b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k()], ['852px', '0px'], 'keyboardWillHide : elle redescend, le cadre attend que la page reprenne sa hauteur');
  b.ctx.window.innerHeight = 852; b.ctx.dxFeuilleCaler();
  assert.deepEqual([b.el.style.height, b.k()], ['852px', '0px']);
  assert.equal(cap.plugins.Keyboard.resize, 'native');
  const ecoute = cut("window.addEventListener('keyboardWillShow',e=>{dxClavierApp=", '\n}\n');
  assert.ok(ecoute.includes("dxClavierApp=Math.max(0,Math.round(+(e&&e.keyboardHeight)||0));dxFeuilleCaler();") && ecoute.includes("window.addEventListener('keyboardWillHide',()=>{dxClavierApp=0;") && ecoute.includes("window.addEventListener('resize',"));
});

test('le focus : un instant tout en haut (Safari ne fait rien défiler), la carte monte ; le clavier part, elle redescend ; refermée, plus de clavier', () => {
  const o = fn('defisFeuilleOuvrir');
  assert.ok(o.includes("inp.addEventListener('focus',()=>{if(!dxTactile())return;inp.style.transform='translateY(-2000px)';requestAnimationFrame(()=>{inp.style.transform='';});if(!el._auto)dxClavierPrevu(el);});"));
  assert.ok(o.includes("inp.addEventListener('blur',()=>{el._prevu=0;clearTimeout(el._prevuT);setTimeout(dxFeuilleCaler,80);});"));
  /* Sur téléphone, le clavier monte avec la feuille : le focus pendant le toucher même, après les écouteurs */
  /* (à l’ouverture, pas d’estimation : si l’iPhone n’ouvrait pas le clavier, la carte monterait pour rien ; elle monte quand il est là) */
  const tactile = o.indexOf("if(inp&&(!inp.value||ko)&&dxTactile()){el._auto=true;try{inp.focus({preventScroll:true});}catch(e){}el._auto=false;}");
  assert.ok(tactile > o.indexOf("inp.addEventListener('focus'") && tactile > o.indexOf('if(neuf)document.body.appendChild(el);') && tactile < o.indexOf('if(neuf)requestAnimationFrame(()=>requestAnimationFrame(montrer));else montrer();'));
  assert.ok(o.includes('if(inp&&(!inp.value||ko))setTimeout(()=>{try{if(inp.isConnected&&document.activeElement!==inp){inp.focus({preventScroll:true});const n=inp.value.length;inp.setSelectionRange(n,n);}}catch(e){}},'), 'à la souris, le focus une fois arrivée');
  assert.ok(!o.includes('inp.select()'));
  assert.ok(fn('defisFeuilleFermer').includes("el.style.setProperty('--dx-clavier','0px');"));
  /* Les mesures du bandeau ne bougent pas quand la page de l’app rétrécit ; le pied ne couvre plus le champ ; petit écran : sans la phrase */
  for (const k of ['html.lq :is(#scr-defis,.dx-feuille)[data-k="code"] .room-head.dx-f-tete{padding-bottom:26px}',
    'html.lq :is(#scr-defis,.dx-feuille)[data-k="code"] .room-head.dx-f-tete>.room-sub{margin-top:10px}',
    'html.lq .dx-feuille[data-k="code"] .dx-f-pied{position:static}',
    'html.lq :is(#scr-defis,.dx-feuille).is-court[data-k="code"] .room-head.dx-f-tete>.room-sub{display:none}'])
    assert.ok(lq.includes(k), k);
  assert.ok(o.includes("el.classList.toggle('is-court',k==='code'&&window.innerHeight<=700);"));
});
