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
  const el = { classList: { add() {} }, querySelector: () => ({ addEventListener() {}, classList: { add() {} }, focus() {}, textContent: '' }), addEventListener() {} };
  const ctx = vm.createContext({ document: { createElement: () => ({ set innerHTML(v) { html = v; }, get firstElementChild() { return el; } }), body: { appendChild() {}, classList: { add() {} } } },
    MU: null, moduleUpClose() {}, JEU_COIN_SVG: '<coin>', MU_PLAY: '▶', JEU_AUTO_MS: 5000, lqStkSvg: k => `<svg data-k="${k}"></svg>`, chatBonusHtml: k => `<img data-k="${k}">`, esc: s => String(s), lqSay() {}, buzz() {}, prefersReduceMotion: () => true, setTimeout: () => 0, setInterval: () => 0, navigator: {}, Date });
  vm.runInContext('var MU=null;' + fn('jeuPtsPage').replace('function jeuPtsPage(', 'function jeuPtsPage('), ctx);
  ctx.jeuPtsPage(o);
  return html;
};

test('la page des points, pour chaque issue entre amis', () => {
  const v = page({ pts: 920, total: 920, solo: false, issue: 'victoire', qui: '', place: 1 });
  assert.ok(v.includes('class="mu mu-acc mu-pts is-victoire"') && v.includes('Victoire !') && v.includes('>Tu as gagné !</h2>'));
  assert.ok(v.includes('Tu gagnes <b>920</b> points. Tes points de salle passent à <b>920</b>.'));
  /* 18 h 11 : plus de bouton ; « Le podium s’affiche dans 6 s », la médaille de la place sur la pièce */
  assert.ok(v.includes('<span>Le podium s’affiche dans <b class="mu-auto-n">6</b> s</span>') && !v.includes('mu-go') && !v.includes('mu-rejouer'));
  assert.ok(v.includes('<coin><span class="mu-med is-1"><svg data-k="medal1"></svg></span>'));
  const d = page({ pts: 230, total: 230, solo: false, issue: 'defaite', qui: '@lea', place: 2 });
  assert.ok(d.includes('>Bien joué !</h2>') && d.includes('@lea l’emporte, mais tu gagnes <b>230</b> points.') && d.includes('<span class="mu-med is-2">'));
  const z = page({ pts: 0, total: 500, solo: false, issue: 'defaite', qui: '@lea' });
  /* 18 h 35 : « il faut justement encourager ; revanche » : le chat lève le poing à la place d’une pièce grise */
  assert.ok(z.includes('mu-pts is-zero is-encourage is-defaite') && z.includes('>La revanche t’attend !</h2>') && z.includes('@lea a trouvé cette fois. Chaque défi t’entraîne : à toi la prochaine !'));
  assert.ok(z.includes('<div class="mu-st mu-done mu-chat"><img data-k="effort"></div>') && z.includes('<span class="mu-tag">Revanche !</span>') && !z.includes('<coin>') && !z.includes('mu-album') && !z.includes('mu-med'), 'ni pièce grise, ni compteur de salle qui ne bouge pas, ni médaille');
  const n = page({ pts: 0, total: 0, solo: false, issue: 'nul' });
  assert.ok(n.includes('>Match nul !</h2>') && n.includes('Ce défi a résisté à tout le monde. Une revanche pour vous départager ?') && n.includes('<img data-k="duel">') && n.includes('<span>Le bilan s’affiche dans'));
  const s = page({ pts: 120, total: 300, solo: true });
  /* 18 h 48 (« même un défi solo raté, le bilan s’affiche, comme les autres ; sois cohérent ») */
  assert.ok(s.includes('Partie solo terminée') && s.includes('>Bravo !</h2>') && s.includes('<span>Le bilan s’affiche dans <b class="mu-auto-n">6</b> s</span>') && !s.includes('mu-go') && !s.includes('mu-rejouer'), 'seul, avec des points : le compte à rebours du bilan');
  const r = page({ pts: 0, total: 300, solo: true, issue: 'rate', nb: 1 });
  assert.ok(r.includes('mu-pts is-zero is-encourage is-rate') && r.includes('>Tu vas y arriver !</h2>') && r.includes('Ce défi t’a résisté cette fois, mais chaque essai t’entraîne.') && r.includes('<img data-k="effort">') && r.includes('<span class="mu-tag">Courage !</span>') && r.includes('<span>Le bilan s’affiche dans') && r.includes('Partie solo terminée') && !r.includes('mu-album'), 'seul, sans point : sa page, puis le bilan');
  assert.ok(page({ pts: 0, total: 0, solo: true, issue: 'rate', nb: 2 }).includes('Ces défis t’ont résisté cette fois'));
  assert.equal(page({ pts: 0, total: 0, solo: true }), '', 'sans issue ni point : pas de page');
});

test('avant le podium : la page s’ouvre à l’arrivée sur l’écran de fin, quelle que soit l’issue ; les confettis pour la victoire', () => {
  assert.ok(app.includes("if(cg)ptsPage({pts:cg.pts,total:cg.total,solo:false,issue:nul?'nul':winner?'victoire':'defaite',qui:winner||nul?'':premier&&premier.name||'',place:moi.pts>0?moi.place:0},0);"));
  assert.ok(fn('jeuPtsPage').includes('if(auto)MU.timers.push(setTimeout(()=>{if(MU&&MU.el===el)fermer();},FIN_MS));'), 'elle se referme toute seule sur le podium');
  const f = fn('jeuPtsPage');
  assert.ok(f.includes('if(fete)lqConfetti({n:60});') && f.includes("zero=!(o.pts>0),fete=!zero&&(!issue||issue==='victoire');"));
  assert.ok(css.includes('html.lq .mu.mu-pts.is-zero .mu-coin{filter:grayscale(.9) brightness(1.08);opacity:.8}'));
});

test('la carte de la dernière manche : « Tes points arrivent dans 5 s » et sa barre, trouvée ou pas', () => {
  assert.ok(app.includes("${last?'Tes points arrivent':'La manche suivante démarre'} dans <b id=\"jeu-auto-n\">"));
  assert.ok(app.includes("const suite=sl||(last&&jeuRoundDone(n))?jeuSuiteHTML(n)"));
  assert.ok(app.includes("const rate=!mine&&jeuRoundDone(n)&&(sl||n>=J.nb-1);edOn=!mine&&!rate;"), 'pas trouvée : « Temps écoulé », puis la barre');
  assert.ok(fn('jeuPatch').includes("if(r&&n>=J.nb-1&&jeuRoundDone(n)&&!document.getElementById('jeu-auto')){J.keep=v;J.view='';jeuPaint();return;}"));
  assert.ok(!app.includes("'Le podium arrive"), 'plus « Le podium arrive »');
});
