/* Elisa, 8 novembre, 14 h 59 (capture de « Rejoindre une partie · Entre ton code ! », clavier ouvert, Safari d’iOS) : « Cette page
   saute avec le clavier ». La feuille était posée en bas et suivait le clavier : au toucher du champ, Safari faisait d’abord défiler la
   page pour montrer le champ, puis la feuille remontait au-dessus du clavier : deux sauts. Elle est alors passée en haut de l’écran.
   15 h 27 : « Pourquoi c’est en haut ? Ça va être sur l’application, est-ce que ça va faire bien ? » : seule en haut, elle laissait un
   vide voilé entre elle et le clavier. Sur téléphone, c’est maintenant une feuille pleine hauteur, comme « Utiliser un code » de l’App
   Store : elle monte du bas comme les autres, couvre ce qui reste visible au-dessus du clavier, le champ en haut. Le clavier s’ouvre :
   le champ ne bouge pas, seul le bas de la feuille le suit. Dans l’app (Keyboard « native »), la page rétrécit au-dessus du clavier :
   la feuille aussi, son haut ne bouge pas. Les autres feuilles (créer, seul, la fiche d’un joueur) restent des cartes posées en bas. */
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

test('sur téléphone, la feuille du code monte du bas et va jusqu’au clavier ; plus rien ne descend du haut', () => {
  assert.ok(lq.includes('@media (pointer:coarse){\n  html.lq .dx-feuille[data-k="code"] .dx-f-boite{width:100%;max-width:520px;height:calc(100% - var(--safe-top,0px) - 12px);max-height:none;margin:0;border-radius:var(--dx-r-feuille,28px) var(--dx-r-feuille,28px) 0 0}'));
  assert.ok(lq.includes('html.lq .dx-feuille.on[data-k="code"]::after{content:"";position:absolute;z-index:1;left:50%;bottom:-120px;'), 'sous le bord du clavier, le blanc de la feuille continue');
  for (const k of ['.dx-feuille[data-k="code"]{align-items:flex-start}', 'translateY(calc(-100% - 40px))'])
    assert.ok(!lq.includes(k), `plus de feuille en haut : ${k}`);
  assert.ok(lq.includes('.dx-feuille{position:fixed;inset:0;z-index:2600;display:flex;align-items:flex-end;'), 'toutes montent du bas');
  assert.ok(lq.includes('html.lq .dx-feuille.off .dx-f-boite{transform:translateY(calc(100% + 40px));'), 'et y repartent');
  assert.ok(fn('defisFeuilleOuvrir').includes('el.dataset.k=k;'), 'la feuille dit laquelle elle est');
  /* Dans l’app, la page passe sous 720 px de haut quand le clavier s’ouvre : le bandeau garde ses mesures d’écran bas dès l’ouverture
     (le champ ne remonte pas de 4 px). Le pied ne colle plus en bas (il couvrait le champ sur un petit écran) ; petit écran, mesuré
     avant le clavier : le bandeau sans sa phrase. */
  for (const k of ['html.lq :is(#scr-defis,.dx-feuille)[data-k="code"] .room-head.dx-f-tete{padding-bottom:26px}',
    'html.lq :is(#scr-defis,.dx-feuille)[data-k="code"] .room-head.dx-f-tete>.room-sub{margin-top:10px}',
    'html.lq .dx-feuille[data-k="code"] .dx-f-pied{position:static}',
    'html.lq :is(#scr-defis,.dx-feuille).is-court[data-k="code"] .room-head.dx-f-tete>.room-sub{display:none}'])
    assert.ok(lq.includes(k), k);
  assert.ok(fn('defisFeuilleOuvrir').includes("el.classList.toggle('is-court',k==='code'&&window.innerHeight<=700);"));
});

test('elle couvre ce qui reste visible au-dessus du clavier ; les autres feuilles, l’écran', () => {
  const ctx = vm.createContext({ window: { innerHeight: 852, visualViewport: { offsetTop: 0, height: 852 } }, requestAnimationFrame: f => f() });
  const el = { dataset: { k: 'code' }, style: {} };
  ctx.document = { getElementById: id => id === 'dx-feuille' ? el : null };
  vm.runInContext(fn('dxFeuilleCaler'), ctx);
  ctx.dxFeuilleCaler();
  assert.deepEqual([el.style.top, el.style.height], ['0px', '852px'], 'clavier fermé : tout l’écran');
  /* Safari : le clavier (et sa barre) prend le bas ; s’il a fait défiler la page de quelques points, la feuille les rattrape */
  Object.assign(ctx.window.visualViewport, { offsetTop: 10, height: 472 });
  ctx.dxFeuilleCaler();
  assert.deepEqual([el.style.top, el.style.height], ['10px', '472px']);
  el.dataset.k = 'creer';
  ctx.dxFeuilleCaler();
  assert.deepEqual([el.style.top, el.style.height], ['0px', '852px'], 'les autres feuilles ne suivent pas le clavier');
  assert.ok(lq.includes('.dx-feuille.on{transition:top .3s cubic-bezier(.25,.8,.25,1),height .3s cubic-bezier(.25,.8,.25,1)}'), 'le bas de la feuille glisse avec le clavier');
  assert.ok(fn('defisFeuilleOuvrir').includes("vv.addEventListener('resize',dxFeuilleCaler);vv.addEventListener('scroll',dxFeuilleCaler);"));
  assert.equal(cap.plugins.Keyboard.resize, 'native', 'dans l’app, la page rétrécit au-dessus du clavier : la feuille aussi');
});

test('le champ prend le focus une fois la feuille arrivée, le code gardé tel quel (rien n’est sélectionné)', () => {
  const o = fn('defisFeuilleOuvrir');
  assert.ok(o.includes('if(inp&&(!inp.value||ko))setTimeout(()=>{try{if(inp.isConnected&&document.activeElement!==inp){inp.focus({preventScroll:true});const n=inp.value.length;inp.setSelectionRange(n,n);}}catch(e){}},typeof prefersReduceMotion===\'function\'&&prefersReduceMotion()?0:380);'));
  assert.ok(!o.includes('inp.select()'));
  /* Sur téléphone, le clavier monte avec la feuille : le focus pendant le toucher, le champ un instant tout en haut (Safari ne fait
     rien défiler), puis la feuille monte */
  const tactile = o.indexOf("if(inp&&(!inp.value||ko)&&typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches){\n    inp.style.transform='translateY(-2000px)';\n    try{inp.focus({preventScroll:true});}catch(e){}\n    requestAnimationFrame(()=>{inp.style.transform='';});");
  assert.ok(tactile > o.indexOf('if(neuf)document.body.appendChild(el);') && tactile < o.indexOf('if(neuf)requestAnimationFrame(()=>requestAnimationFrame(montrer));else montrer();'));
  assert.ok(!o.includes("inp.addEventListener('focus'") && !o.includes("inp.addEventListener('blur'"));
});
