/* Elisa, 8 novembre, 21 h 29 : « le Salle de défi en haut n’est pas centré, faire attention aux autres pages aussi » ; « on ne peut pas
   remonter complètement quand on écrit dans la requête » (Safari, le clavier ouvert : la page glissait vers le haut et son haut restait
   caché). */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('le titre de la barre au milieu de l’écran, quelle que soit la largeur du retour ; sans toucher ni le retour ni les outils', () => {
  for (const k of ['html.lq #scr-lesson .navbar{display:grid;grid-template-columns:minmax(max-content,1fr) minmax(0,max-content) minmax(var(--nav-r,46px),1fr);align-items:center;column-gap:10px}',
    'html.lq #scr-lesson .navbar.has-tools{--nav-r:96px}', 'html.lq #scr-lesson .navbar .back{grid-column:1;justify-self:start;max-width:none;min-width:0}',
    'html.lq #scr-lesson .navbar .nav-title{grid-column:2;position:static!important;min-width:0;margin:0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'])
    assert.ok(css.includes(k), k);
  assert.ok(!css.includes('margin:0 56px 0 10px') && !css.includes('.navbar.has-tools .nav-title{margin-right:106px}'), 'plus de marges qui décalaient le titre');
  /* Les autres enfants de la barre sont posés en absolu : ils ne prennent pas de colonne */
  const barre = cut('<div class="navbar">', '<div class="ls-where-panel"');
  assert.equal((barre.match(/<button class="back"/g) || []).length, 1); assert.ok(barre.includes('<div class="nav-title" id="nav-title"></div>'));
  for (const k of ['html.lq #scr-lesson .ls-where{\n  display:none;position:absolute;', 'html.lq #scr-lesson .navbar .nav-tools{position:absolute;'])
    assert.ok(css.includes(k), k);
});

function monde({ natif = false, offsetTop = 120, scrollY = 0, vvH = 380 } = {}) {
  const appels = [], ta = { closest: q => (q === '.editor-area' ? {} : null) };
  const window = { innerHeight: 800, scrollY, pageYOffset: scrollY, visualViewport: { offsetTop, height: vvH }, scrollTo: (x, y) => appels.push(['scrollTo', x, y]) };
  const ctx = vm.createContext({ window, document: { activeElement: ta }, activeTA: ta, Date, requestAnimationFrame: f => f(),
    revealSqlEditor: () => appels.push(['reveal']), ensureRunRowVisible: () => appels.push(['run']), dxNatif: () => natif, IOS_KB_OVERLAY: 100 });
  vm.runInContext(cut('function keyboardInset(){', '\n}\n') + '\n}\n' + cut('let edRecaleAt=0;', '\nif(window.visualViewport){').replace(/^let /m, 'var '), ctx);
  return { ctx, appels, window, ev: c => vm.runInContext(c, ctx) };
}

test('Safari, clavier ouvert : la page reprend sa place, l’écran défile jusqu’à la requête', () => {
  const m = monde();
  m.ev('edPageRecaler()');
  assert.deepEqual(m.appels, [['scrollTo', 0, 0], ['reveal'], ['run']], 'la page glissée remonte, la requête reste en vue (l’écran défile)');
  m.ev('edPageRecaler()'); assert.equal(m.appels.length, 3, 'pas deux fois de suite (300 ms)');
  const z = monde({ offsetTop: 0 }); z.ev('edPageRecaler()'); assert.deepEqual(z.appels, [], 'rien n’a glissé : rien');
  const y = monde({ offsetTop: 0, scrollY: 200 }); y.ev('edPageRecaler()'); assert.deepEqual(y.appels[0], ['scrollTo', 0, 0], 'glissée par la page elle-même aussi');
  const n = monde({ natif: true }); n.ev('edPageRecaler()'); assert.deepEqual(n.appels, [], 'l’app : le clavier rétrécit la page, rien ne glisse');
  const f = monde({ vvH: 680 }); f.ev('edPageRecaler()'); assert.deepEqual(f.appels, [], 'sans clavier : rien');
  const x = monde(); x.ctx.document.activeElement = null; x.ev('edPageRecaler()'); assert.deepEqual(x.appels, [], 'pas en train d’écrire : rien');
});

test('branché : à chaque déplacement de la vue ; la requête ne remonte en vue que quand le clavier arrive', () => {
  const v = cut('if(window.visualViewport){\n  const vv=window.visualViewport;\n  let kbarVvLayoutT=0,kbarVvKb=0;', '\n}\n');
  assert.ok(v.includes('const adjOffset=()=>{syncKbarOffset();edPageRecaler();};'));
  assert.ok(v.includes('const kb=keyboardInset();if(kb<40)kbarVvKb=0;') && v.includes('if(kb>40&&Math.abs(kb-kbarVvKb)>40){\n      kbarVvKb=kb;'), 'pas à chaque petit changement de la vue');
  assert.ok(v.includes('if(!kbarKbDismissed&&document.activeElement===activeTA){ layoutSqlEditor(); edPageRecaler(); }'));
});
