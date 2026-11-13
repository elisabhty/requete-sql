/* 13 novembre, 17 h 31 (Elisa, sa capture de la page des points « Bravo ! +920 points ») : « cette page, il faut que tu la fasses
   pour tous les cas : 0-0, 1-0, perdu, gagné ; et tu dois la mettre avant la page du podium. Avant ça, sur la page où tu as mis ta
   requête, une barre qui dit : dans 5 secondes, voir les points ». Le parcours en salle est vérifié par salle-defis.test.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

/* La page, dans un petit DOM : ce qu’elle écrit pour chaque issue */
const page = o => {
  let html = '';
  const el = { classList: { add() {} }, querySelector: () => ({ addEventListener() {}, classList: { add() {} }, focus() {} }), addEventListener() {} };
  const ctx = vm.createContext({ document: { createElement: () => ({ set innerHTML(v) { html = v; }, get firstElementChild() { return el; } }), body: { appendChild() {}, classList: { add() {} } } },
    MU: null, moduleUpClose() {}, JEU_COIN_SVG: '<coin>', MU_PLAY: '▶', esc: s => String(s), lqSay() {}, buzz() {}, prefersReduceMotion: () => true, setTimeout, navigator: {} });
  vm.runInContext('var MU=null;' + fn('jeuPtsPage').replace('function jeuPtsPage(', 'function jeuPtsPage('), ctx);
  ctx.jeuPtsPage(o);
  return html;
};

test('la page des points, pour chaque issue entre amis', () => {
  const v = page({ pts: 920, total: 920, solo: false, issue: 'victoire', qui: '' });
  assert.ok(v.includes('class="mu mu-acc mu-pts is-victoire"') && v.includes('Victoire !') && v.includes('>Tu as gagné !</h2>'));
  assert.ok(v.includes('Tu gagnes <b>920</b> points. Tes points de salle passent à <b>920</b>.') && v.includes('<span class="mu-go-l">Voir le podium</span>'));
  assert.ok(v.includes('<button type="button" class="mu-later mu-rejouer">Revanche</button>'));
  const d = page({ pts: 230, total: 230, solo: false, issue: 'defaite', qui: '@lea' });
  assert.ok(d.includes('>Bien joué !</h2>') && d.includes('@lea l’emporte, mais tu gagnes <b>230</b> points.'));
  const z = page({ pts: 0, total: 500, solo: false, issue: 'defaite', qui: '@lea' });
  assert.ok(z.includes('mu-pts is-zero is-defaite') && z.includes('>Pas cette fois !</h2>') && z.includes('@lea a trouvé, pas toi. Prends ta revanche !'));
  assert.ok(z.includes('<span class="mu-tag">0 point</span>') && !z.includes('mu-album'), '0 point : ni « +0 », ni compteur de salle qui ne bouge pas');
  const n = page({ pts: 0, total: 0, solo: false, issue: 'nul' });
  assert.ok(n.includes('>0 à 0 !</h2>') && n.includes('Personne n’a trouvé. Égalité parfaite : la revanche ?') && n.includes('<span class="mu-go-l">Voir le bilan</span>'));
  const s = page({ pts: 120, total: 300, solo: true });
  assert.ok(s.includes('Partie solo terminée') && s.includes('>Bravo !</h2>') && s.includes('Voir le bilan') && !s.includes('mu-rejouer'), 'seul : comme avant');
  assert.equal(page({ pts: 0, total: 0, solo: true }), '', 'seul, sans point : pas de page');
});

test('avant le podium : la page s’ouvre à l’arrivée sur l’écran de fin, quelle que soit l’issue ; les confettis pour la victoire', () => {
  assert.ok(app.includes("if(cg)ptsPage({pts:cg.pts,total:cg.total,solo:false,issue:nul?'nul':winner?'victoire':'defaite',qui:winner||nul?'':premier&&premier.name||''},0);"));
  const f = fn('jeuPtsPage');
  assert.ok(f.includes('if(fete)lqConfetti({n:60});') && f.includes("zero=!(o.pts>0),fete=!zero&&(!issue||issue==='victoire');"));
  assert.ok(css.includes('html.lq .mu.mu-pts.is-zero .mu-coin{filter:grayscale(.9) brightness(1.08);opacity:.8}'));
});

test('la carte de la dernière manche : « Tes points arrivent dans 5 s » et sa barre, trouvée ou pas', () => {
  assert.ok(app.includes("${last?(sl?'Ton bilan arrive':'Tes points arrivent'):'La manche suivante démarre'} dans <b id=\"jeu-auto-n\">"));
  assert.ok(app.includes("const suite=sl||(last&&jeuRoundDone(n))?jeuSuiteHTML(n)"));
  assert.ok(app.includes("const rate=!mine&&jeuRoundDone(n)&&(sl||n>=J.nb-1);edOn=!mine&&!rate;"), 'pas trouvée : « Temps écoulé », puis la barre');
  assert.ok(fn('jeuPatch').includes("if(r&&n>=J.nb-1&&jeuRoundDone(n)&&!document.getElementById('jeu-auto')){J.keep=v;J.view='';jeuPaint();return;}"));
  assert.ok(!app.includes("'Le podium arrive"), 'plus « Le podium arrive »');
});
