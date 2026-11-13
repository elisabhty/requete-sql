/* 11 novembre, 11 h 50 (Elisa) : « vérifie partout où il y a un clavier qu’il n’y a plus de problème ».
   Les 19 endroits où l’on tape dans l’app (onboarding : prénom, pseudo, pays ; note : texte, requête, note existante ; recherches des
   notes, du catalogue, de l’entretien ; console : nouveau projet, requête ; leçon : exercice, avis ; défi : requête ; contact : message,
   e-mail ; question (une ligne, plusieurs) ; code d’une salle ; import) ont été passés au crible, sur l’iPhone simulé, dans les deux cas :
   la vue de l’app rétrécit au-dessus du clavier (Keyboard « native »), ou non. Partout le champ reste en vue et son bouton à portée.
   Ce qu’il a fallu :
   - l’app tient dans la partie de la vue au-dessus du clavier (--app-h) tant qu’il est ouvert, que la vue ait rétréci ou non ;
   - les fenêtres posées sur l’écran (import, pays, question) montent avec le clavier de l’app ;
   - la barre d’onglets reste sous le clavier (elle cachait la recherche de l’entretien) ;
   - le champ touché est ramené en vue (le plugin retire à WebKit ce défilement), « Exécuter » avec la requête, au-dessus d’un pied
     collant (« Envoyer mon message ») ; dans un défi aussi. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };

test('l’app tient au-dessus du clavier, que la vue rétrécisse ou non', () => {
  assert.ok(html.includes("const ka=kbNatif();document.documentElement.style.setProperty('--kb-app',ka+'px');document.documentElement.style.setProperty('--app-h',(window.innerHeight-ka)+'px');"));
  for (const r of ['html.is-native.kb-ouvert body{min-height:var(--app-h,100dvh)}',
    'html.is-native.kb-ouvert #app{height:var(--app-h,100dvh);min-height:var(--app-h,100dvh)}',
    'html.lq .viz.on{bottom:calc(var(--kb,0px) - var(--kb-app,0px))!important}',
    'html.lq.is-native .imp-sheet{bottom:var(--kb-app,0px);max-height:calc(var(--app-h,100dvh) - 12px)}',
    /* 12 novembre, 23 h 04 : la feuille des pays ne monte plus au-dessus du clavier (elle sautait) ; il glisse par-dessus son bas */
    'html.is-native .pays-feuille .pays-boite{height:min(calc(var(--vue-h,100vh) * .82),760px);max-height:calc(var(--vue-h,100dvh) - var(--safe-top) - 10px);margin-bottom:calc(-1 * var(--kb-vue,0px))}',
    'html.is-native.kb-ouvert #app>.tabbar{visibility:hidden}',
    'html.lq.kb-ouvert #scr-compte .ct-pied{padding-bottom:14px}'])
    assert.ok(css.includes(r), r);
  assert.ok(!css.includes('html.is-native .pays-feuille{bottom:var(--kb-app,0px)}'));
  assert.ok(html.includes("  document.documentElement.style.setProperty('--kbar-offset',((kbLift?kb-kbNatif():0)+kh)+'px');"), 'les écrans ne réservent que la barre des touches');
  const q = cut('function lqPrompt(o){', 'el.querySelector(\'.lq-ask-back\').onclick');
  assert.ok(q.includes("el.style.height=(open?vv.height-kbNatif():window.innerHeight)+'px';") && q.includes('CLAV.forEach(n=>window.addEventListener(n,fit));')
    && q.includes('CLAV.forEach(n=>window.removeEventListener(n,fit));'), 'la question monte avec le clavier de l’app');
});

/* champEnVue, sur une page factice : un écran qui défile, un champ, le clavier de l’app (344 px sur 932), un pied collant éventuel. */
const monde = ({ haut = 640, bas = 700, pied = null, natif = true, actif = 'INPUT', dans = '' } = {}) => {
  let st = 0;
  const sc = { scrollHeight: 2000, clientHeight: 900, get scrollTop() { return st; }, set scrollTop(v) { st = v; },
    getBoundingClientRect: () => ({ top: 0, bottom: 932 }), querySelector: () => null, contains: x => x === champ || x === piedEl, parentElement: null };
  const champ = { tagName: actif, parentElement: sc, closest: q => (dans && q.includes(dans) ? {} : null), contains: x => x === champ,
    getBoundingClientRect: () => ({ top: haut - st, bottom: bas - st, left: 20, width: 380 }) };
  const piedEl = pied && { parentElement: sc, contains: () => false, getBoundingClientRect: () => ({ top: pied }) };
  const body = {};
  sc.parentElement = body;
  const ctx = vm.createContext({ window: { innerHeight: 932 }, kbNatif: () => 344, dxNatif: () => natif,
    document: { activeElement: champ, body, getElementById: () => null, elementFromPoint: (x, y) => (piedEl && y >= pied ? piedEl : champ) },
    getComputedStyle: e => ({ overflowY: e === sc ? 'auto' : 'visible', position: e === piedEl ? 'sticky' : 'static' }) });
  vm.runInContext(cut('function champEnVue(){', 'if(typeof window!==\'undefined\'&&typeof document!==\'undefined\'&&typeof window.addEventListener'), ctx);
  ctx.champEnVue();
  return st;
};

test('le champ touché revient au-dessus du clavier de l’app, sans passer sous le haut de l’écran', () => {
  assert.equal(monde(), 700 - (588 - 12), 'le bas du champ, 12 px au-dessus du clavier');
  assert.equal(monde({ haut: 200, bas: 300 }), 0, 'déjà en vue : rien');
  assert.equal(monde({ haut: 300, bas: 1100 }), 300 - 8, 'un champ plus haut que la place : son haut reste en vue');
  assert.equal(monde({ natif: false }), 0, 'Safari s’en charge lui-même');
  assert.equal(monde({ dans: '.dx-feuille' }), 0, 'les feuilles qui se placent elles-mêmes');
  assert.equal(monde({ actif: 'BUTTON' }), 0, 'seulement un champ où l’on tape');
  /* Un pied collant (« Envoyer mon message ») commence à 520 : le champ remonte encore au-dessus de lui. */
  assert.equal(monde({ pied: 520 }), 124 + (576 - 520 + 10), 'au-dessus du pied collant');
});

test('le champ revient en vue quand le clavier s’annonce, quand la vue rétrécit et quand on passe d’un champ à l’autre', () => {
  const b = cut('if(typeof window!==\'undefined\'&&typeof document!==\'undefined\'&&typeof window.addEventListener===\'function\'){\n  let cevT=[];', 'function keyboardInset(){');
  /* 13 novembre, 14 h 24 : la vue ne rétrécit plus (Keyboard « none ») : une fois le clavier arrivé, puis une vérification */
  assert.ok(b.includes("const cevBientot=()=>{cevT.forEach(clearTimeout);cevT=[KB_ANIM_MS+40,700].map(t=>setTimeout(champEnVue,t));};"));
  assert.ok(b.includes("['keyboardWillShow','keyboardDidShow'].forEach(n=>window.addEventListener(n,cevBientot));"));
  assert.ok(b.includes("window.addEventListener('resize',()=>{if(kbNatH)cevBientot();});") && b.includes("document.addEventListener('focusin',()=>{if(kbNatH)cevBientot();});"));
  /* « Exécuter » suit la requête, dans une leçon, un défi et la console (et dans Safari, ensureRunRowVisible) */
  assert.ok(html.includes("host=a.closest('.ls-main')||a.closest('#defi-solo-block')||a.closest('#scr-console')"));
  assert.ok(html.includes("const host=ta.closest('.ls-main')||ta.closest('#defi-solo-block')||ta.closest('#scr-console');"));
});
