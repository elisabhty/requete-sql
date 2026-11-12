/* 4 novembre, 8 h 19 (Elisa, capture de l’app iPhone : « Bug sur l’application ») : à l’étape du prénom, clavier ouvert, le champ
   était coupé sous « Continuer » et l’écran gardait sa taille pleine (titre, phrase, mascotte) ; dans la bulle, « ? » partait seul à
   la ligne. Dans l’app, le clavier rétrécit la vue web (Keyboard « native ») une demi-seconde après être apparu, et la hauteur de
   l’écran (100dvh) ne suit qu’après l’événement resize : obFit mesurait l’ancienne hauteur. Vérifié dans un navigateur, la vue
   rétrécie sans événement resize (comme dans l’app) : avant, le champ restait coupé (453 → 513 pour un bas à 475) ; maintenant,
   l’écran se resserre et le champ reste en vue, avec l’accueil au prénom, de 320 × 568 à 430 × 932, au prénom comme au pseudo. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = (name, next) => { const i = app.lastIndexOf(`function ${name}(`); assert.ok(i > 0, name); return app.slice(i, app.indexOf(next, i)); };

/* Un écran factice : le corps défile, le champ et l’accueil au prénom suivent son défilement. */
function ecran({ champ = [453, 513], apercu = null, actif = 'INPUT', st = 0 } = {}) {
  const body = { scrollTop: st, contains: () => true, getBoundingClientRect: () => ({ top: 0, bottom: 475 }) };
  const suite = apercu ? { hidden: false, offsetHeight: apercu[1] - apercu[0], matches: s => s.includes('.ob-name-preview'),
    getBoundingClientRect: () => ({ top: apercu[0] - body.scrollTop, bottom: apercu[1] - body.scrollTop }) } : null;
  const label = { nextElementSibling: suite, getBoundingClientRect: () => ({ top: champ[0] - body.scrollTop, bottom: champ[1] - body.scrollTop }) };
  const a = { tagName: actif, closest: () => label };
  const ctx = vm.createContext({ document: { activeElement: a, getElementById: id => (id === 'ob-body' ? body : null) } });
  vm.runInContext(cut('function obChampEnVue(){', 'if(typeof window!==\'undefined\'&&typeof document!==\'undefined\'){'), ctx);
  ctx.obChampEnVue();
  return body.scrollTop;
}

test('clavier ouvert : le champ où l’on tape revient en vue, avec l’accueil au prénom, sans passer son haut au-dessus du bord', () => {
  assert.equal(ecran(), 50, 'le champ coupé de la capture (453 → 513, bas du corps à 475) remonte de 50 : 12 de marge sous lui');
  assert.equal(ecran({ apercu: [529, 604] }), 141, '« Enchantée, Elisa ! » vient avec lui');
  assert.equal(ecran({ champ: [30, 600] }), 18, 'trop grand pour tenir : son haut reste visible');
  assert.equal(ecran({ champ: [60, 120], st: 100 }), 48, 'passé au-dessus du bord (défilé de 100) : il redescend');
  assert.equal(ecran({ champ: [200, 260] }), 0, 'déjà en vue : rien ne bouge');
  assert.equal(ecran({ actif: 'BUTTON' }), 0, 'seulement quand on tape dans un champ');
  assert.ok(fn('obFit', 'function obFitChips(').includes('const apres=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{obFitChips();obChampEnVue();}));') && /\n  metZ\(z\);\n  noter\(\);\n  obFitMemo\[cle\]=[^\n]+\n  apres\(\);\n\}/.test(fn('obFit', 'function obFitChips(')), 'obFit le ramène en vue après avoir mis la page à l’échelle (l’image suivante)');
});

test('obFit suit la vraie taille de l’onboarding et se relance pendant que le clavier s’ouvre ou se ferme', () => {
  const src = cut('if(typeof window!==\'undefined\'&&typeof document!==\'undefined\'){', '/* Même capture :');
  const wl = {}, dl = {}, ro = {}, timers = [];
  let fits = 0, on = true;
  const racine = { classList: { contains: c => c === 'on' && on } }, corps = { contains: t => t.dedans };
  const ctx = vm.createContext({
    window: { addEventListener: (n, f) => { wl[n] = f; } },
    document: { readyState: 'complete', getElementById: id => (id === 'onboarding' ? racine : id === 'ob-body' ? corps : null), addEventListener: (n, f) => { (dl[n] = dl[n] || []).push(f); } },
    ResizeObserver: class { constructor(cb) { ro.cb = cb; } observe(el) { ro.el = el; } },
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout: () => {},
    obFit: () => { fits++; },
  });
  vm.runInContext(src, ctx);
  assert.equal(ro.el, racine, 'la taille de #onboarding est suivie');
  ro.cb([{ contentRect: { height: 932 } }]); assert.equal(fits, 1);
  ro.cb([{ contentRect: { height: 932 } }]); assert.equal(fits, 1, 'même hauteur : rien à refaire');
  ro.cb([{ contentRect: { height: 587 } }]); assert.equal(fits, 2, 'le clavier rétrécit la vue : l’écran se resserre');
  on = false; ro.cb([{ contentRect: { height: 932 } }]); assert.equal(fits, 2, 'onboarding fermé : rien');
  on = true;
  dl.focusin.forEach(f => f({ target: { tagName: 'INPUT', dedans: true } }));
  assert.deepEqual(timers.map(t => t[1]), [120, 520, 900], 'au toucher du champ : trois mesures, le temps que la vue change de taille');
  timers.forEach(t => t[0]()); assert.equal(fits, 5);
  timers.length = 0; dl.focusin.forEach(f => { f({ target: { tagName: 'BUTTON', dedans: true } }); f({ target: { tagName: 'INPUT', dedans: false } }); });
  assert.equal(timers.length, 0, 'un bouton, ou un champ hors de l’onboarding : rien');
  for (const n of ['keyboardWillShow', 'keyboardDidShow', 'keyboardDidHide']) assert.equal(typeof wl[n], 'function', n);
  assert.equal(typeof wl.resize, 'undefined', 'le resize reste celui d’avant (une seule écoute)');
  assert.ok(app.includes("window.addEventListener('resize',()=>{const r=document.getElementById('onboarding');if(r&&r.classList.contains('on'))obFit();});"));
});

test('« ? » ne part plus seul à la ligne : espaces insécables devant la ponctuation, partout dans l’onboarding sauf le code', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function obTypo(s){', 'function obRhythmSummary(){'), ctx);
  assert.equal(ctx.obTypo('Salut ! Comment dois-je t’appeler ?'), 'Salut ! Comment dois-je t’appeler ?');
  assert.equal(ctx.obTypo('Cherche « Requête » et ajoute mon widget !'), 'Cherche « Requête » et ajoute mon widget !');
  assert.equal(ctx.obTypo('Dis-moi tout : ça m’aide ; merci'), 'Dis-moi tout : ça m’aide ; merci');
  assert.equal(ctx.obTypo('Comment as-tu connu Requête ?'), 'Comment as-tu connu Requête ?', 'déjà insécable : inchangé');
  const textes = [{ nodeValue: 'Salut ! Ça va ?', parentElement: { closest: () => null } },
    { nodeValue: "WHERE ville = 'Paris' ;", parentElement: { closest: s => (s.includes('code') ? {} : null) } }];
  ctx.NodeFilter = { SHOW_TEXT: 4 };
  ctx.document = { createTreeWalker: (el, quoi) => { assert.equal(quoi, 4); let i = 0; return { nextNode: () => textes[i++] || null }; } };
  ctx.obInsecables({});
  assert.deepEqual(textes.map(t => t.nodeValue), ['Salut ! Ça va ?', "WHERE ville = 'Paris' ;"], 'le code SQL reste tel quel');
  delete ctx.document.createTreeWalker; ctx.obInsecables({});   // sans TreeWalker : rien, sans erreur
  assert.ok(app.includes('  body.innerHTML=html;\n  obInsecables(body);\n') && app.includes("  if(body.parentElement)body.parentElement.scrollTop=0;\n  obFitSoon();"), 'à chaque page');
  assert.ok(app.includes('if(bulle)bulle.textContent=obTypo(OB_WT_TEXTES[p]);'), 'et dans la bulle du tutoriel du widget, qui change de texte');
});
