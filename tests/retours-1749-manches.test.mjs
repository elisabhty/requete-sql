/* 13 novembre, 17 h 49 (Elisa) : « l’écran avec le 0-0, c’est ça qui doit être entre les manches, quand il y en a 2 ou 3 ; toujours
   pareil : gagné, perdu, 0-0 ». Entre amis, avant la dernière manche, les résultats de la manche s’ouvrent sur la page des points de
   la manche : son issue, tes points, le total de ta partie, et « La manche 2 démarre dans 5 s » ; elle se referme toute seule. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };
const page = o => {
  let html = '';
  const el = { classList: { add() {} }, querySelector: s => s === '.mu-go' ? null : ({ addEventListener() {}, classList: { add() {} }, focus() {}, textContent: '' }), addEventListener() {} };
  const ctx = vm.createContext({ document: { createElement: () => ({ set innerHTML(v) { html = v; }, get firstElementChild() { return el; } }), body: { appendChild() {}, classList: { add() {} } } },
    moduleUpClose() {}, JEU_COIN_SVG: '<coin>', MU_PLAY: '▶', JEU_AUTO_MS: 5000, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: s => String(s), lqSay() {}, buzz() {}, prefersReduceMotion: () => true,
    setTimeout, setInterval: () => 0, navigator: {}, Date });
  vm.runInContext('var MU=null;' + fn('jeuPtsPage'), ctx);
  ctx.jeuPtsPage(o);
  return { html, MU: ctx.MU };
};
const fin = Date.now() + 5000;

test('la page d’une manche : gagnée, perdue avec ou sans points, 0 à 0 ; sans bouton, le compte à rebours', () => {
  const v = page({ pts: 275, total: 0, solo: false, issue: 'victoire', manche: { n: 0, nb: 3, fin } });
  assert.ok(v.html.includes('>Manche 1/3 terminée</span>') && v.html.includes('>Manche gagnée !</h2>') && v.html.includes('Tu gagnes <b>275</b> points.</p>'));
  assert.ok(v.html.includes('<p class="mu-auto-t" aria-live="off"><span>La manche 2 démarre dans <b class="mu-auto-n">5</b> s</span></p><i class="mu-auto-barre"'));
  assert.ok(!v.html.includes('mu-go') && !v.html.includes('Revanche') && !v.html.includes('mu-album'), 'ni bouton ni total à la 1re manche');
  assert.equal(v.MU.manche, 0, 'elle se referme quand la manche suivante part (jeuRender)');
  const d = page({ pts: 230, total: 505, solo: false, issue: 'defaite', qui: '@lea', manche: { n: 1, nb: 3, fin } });
  assert.ok(d.html.includes('>Bien joué !</h2>') && d.html.includes('@lea remporte la manche, mais tu gagnes <b>230</b> points. Ta partie : <b>505</b> points.'));
  assert.ok(d.html.includes('<span>Ta partie</span>') && d.html.includes('La manche 3 démarre'));
  const z = page({ pts: 0, total: 0, solo: false, issue: 'defaite', qui: '@lea', manche: { n: 0, nb: 2, fin } });
  assert.ok(z.html.includes('>Pas cette fois !</h2>') && z.html.includes('@lea a trouvé, pas toi. Rattrape-toi à la manche suivante !'));
  const n = page({ pts: 0, total: 0, solo: false, issue: 'nul', manche: { n: 0, nb: 2, fin } });
  assert.ok(n.html.includes('>0 à 0 !</h2>') && n.html.includes('Personne n’a trouvé cette manche. Tout se joue à la suivante !') && n.html.includes('is-zero is-nul'));
});

test('les branchements : la vue res l’ouvre une fois, avant la dernière ; jeuRender la referme ; ses styles', () => {
  assert.ok(app.includes("const page=!sl&&!last&&typeof jeuPtsPage==='function';"));
  assert.ok(app.includes("const issue=!rk.length?'nul':moi&&moi.place===1?'victoire':'defaite',qui=issue==='defaite'&&rk[0]?((J.players[rk[0].pid]||{}).name||''):'';"));
  assert.ok(app.includes("jeuPtsPage({pts:pts,total:n>0?tot:0,solo:false,issue,qui,place:got&&moi?moi.place:0,manche:{n,nb:J.nb,fin:jeuFinAuto(n)}});"));
  assert.ok(app.includes("if(!page&&ton==='is-or'&&typeof lqConfetti==='function'"), 'les confettis une seule fois');
  assert.ok(fn('jeuRender').includes("if(typeof MU!=='undefined'&&MU&&MU.manche!=null&&v!=='res'+MU.manche&&typeof moduleUpClose==='function')moduleUpClose();"));
  assert.ok(css.includes('html.lq .mu.mu-pts .mu-auto-barre::after{content:"";display:block;height:100%;width:calc(var(--p0,0) * 100%);'));
  assert.ok(css.indexOf('.mu-auto-barre::after') < css.indexOf('Les exemples de widgets (Elisa, 13 novembre, 9 h 19'), 'hors de la galerie des widgets (sans animation)');
});
