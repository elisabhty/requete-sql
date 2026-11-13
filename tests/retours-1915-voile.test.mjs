import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/* 13 novembre, 19 h 15 (Elisa, la partie avec Claude dans la salle SNUWBB) : « avant la page Bravo, la page qui arrive, on voit le
   podium. Alors que j’aimerais pas le voir. Je veux le voir qu’à la fin. » */
const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('l’écran de fin reste caché tant que la page des points est là, à plusieurs, seul et entre les manches', () => {
  assert.ok(app.includes("if(root.classList)root.classList[(v==='final'||/^res/.test(v))&&J.voile?'add':'remove']('jeu-voile');"));
  assert.ok(app.includes("if(cg)jeuVoiler(J,()=>ptsPage({pts:cg.pts,solo:false,") && app.includes(",apres:jeuVoileLever},0));"));
  assert.ok(app.includes("if(seul&&cg)jeuVoiler(J,()=>ptsPage(Object.assign(") && app.includes("{apres:jeuVoileLever}),0));"), 'seul : la page tout de suite (plus 700 ms de bilan avant)');
  assert.ok(app.includes("jeuVoiler(J,()=>jeuPtsPage({pts:pts,total:n>0?tot:0,solo:false,issue,qui,place:got&&moi?moi.place:0,manche:{n,nb:J.nb,fin:jeuFinAuto(n)},apres:jeuVoileLever}));"));
  assert.ok(css.includes('html.lq #jeu-root.jeu-voile{display:none!important}'));
});

test('la page se referme : l’écran apparaît, ses entrées rejouées et ses points qui montent ; un filet à 4 s', () => {
  assert.ok(fn('moduleUpClose').includes("const {el,timers,snd,apercu,apres}=MU;\n  MU=null;\n  if(typeof apres==='function')try{apres();}catch(e){}"));
  assert.ok(fn('jeuPtsPage').includes("apres:typeof o.apres==='function'?o.apres:null};"));
  assert.ok(app.includes('if(!keep&&!J.voile){') && app.includes('if(all&&!keep&&!J.voile)setTimeout(celebrate,300);'), 'pas de points qui montent ni de confettis derrière la page');
  const cls = new Set(['jeu', 'jeu-voile', 'jeu-in']);
  const b = { isConnected: true };
  const root = { classList: { contains: c => cls.has(c), add: c => cls.add(c), remove: (...a) => a.forEach(x => cls.delete(x)) }, offsetWidth: 1, querySelector: () => b };
  const comptes = [];
  const J = { voile: true };
  const ctx = vm.createContext({ JEU: J, document: { getElementById: () => root }, prefersReduceMotion: () => false, jeuCountUp: x => comptes.push(x), setTimeout: f => f(), MU: null });
  vm.runInContext(fn('jeuVoiler') + fn('jeuVoileLever'), ctx);
  ctx.jeuVoileLever();
  assert.equal(J.voile, false);
  assert.ok(!cls.has('jeu-voile') && cls.has('jeu-in'));
  assert.deepEqual(comptes, [b]);
  /* le filet : sans page ouverte, l’écran se montre */
  cls.add('jeu-voile');
  const J2 = { voile: false }; ctx.JEU = J2;
  ctx.jeuVoiler(J2, () => {});
  assert.equal(J2.voile, false); assert.ok(!cls.has('jeu-voile'));
  /* la page ouverte (MU.apres), le filet ne fait rien */
  cls.add('jeu-voile');
  const J3 = { voile: false }; ctx.JEU = J3;
  ctx.jeuVoiler(J3, () => { ctx.MU = { apres: ctx.jeuVoileLever }; });
  assert.equal(J3.voile, true); assert.ok(cls.has('jeu-voile'));
});
