/* 5 novembre, 20 h 32 (Elisa, capture de la carte du cours de l’accueil, « Prête pour la suite, Elisa ? ») : « mettre le % du parcours
   au total » ; 20 h 34 (capture de la carte « Ton objectif », « 4 % fait · fin prévue le 9 janvier ») : « supprimer ».
   À droite du module, la part du parcours SQL déjà faite, en anneau ; la carte de l’objectif quitte l’accueil (retours-1727). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la carte du cours : le module à gauche, le pourcentage du parcours à droite', () => {
  const calc = cut('  const pf=typeof parcoursSqlFaites', '  const sub=defi?');
  const carte = (faites, total, extra = {}) => {
    const c = vm.createContext({ parcoursSqlFaites: () => faites, TOTAL: total, esc: String, mod: { titre: 'Lire une table' }, modIndex: 1, defi: false, niv: '', meta: { sous: '' }, ...extra });
    vm.runInContext(calc.replace(/const (pf|pctHtml|chip|kicker|ch|niv)=/g, 'var $1='), c);
    return c;
  };
  let c = carte(11, 71);
  assert.equal(c.pf, 15, '11 leçons sur 71');
  assert.equal(c.chip, '<div class="lq-hero-row"><span class="lq-hero-mod"><b>Module 2</b>Lire une table</span><span class="lq-hero-pct" data-p="15"><svg class="lq-pct-ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="lq-pct-t" cx="18" cy="18" r="15"/><circle class="lq-pct-f" cx="18" cy="18" r="15" pathLength="100" stroke-dashoffset="85"/></svg><span class="lq-pct-txt"><b><span class="lq-pct-n">15</span> %</b><small>du parcours</small></span></span></div>');
  assert.equal(carte(3, 71).pf, 4, 'comme la carte « Ton objectif » l’affichait (4 % fait)');
  c = carte(0, 71);
  assert.ok(c.chip.includes('<span class="lq-pct-n">0</span>') && !c.chip.includes('lq-pct-f'), 'rien de fait : l’anneau vide, sans point');
  assert.equal(carte(80, 71).pf, 100, 'jamais plus de 100 %');
  assert.ok(!carte(5, 71, { parcoursSqlFaites: undefined }).chip.includes('lq-hero-pct'), 'sans le calcul (un test, une page à part) : pas de pourcentage');
  c = carte(5, 71, { mod: null, defi: true, niv: 'Facile' });
  assert.ok(c.chip.startsWith('<div class="lq-hero-row"><span class="lq-hero-mod"><b>Défi</b>Facile</span><span class="lq-hero-pct" data-p="7">'), 'un défi aussi');
  /* Le calcul est celui du parcours SQL (« 11 leçons validées sur 71 ») */
  assert.ok(app.includes('function parcoursSqlFaites(){return MODULES.reduce((n,m)=>n+m.lessons.filter(l=>state.lessons[l.id]&&state.lessons[l.id].done).length,0);}'));
  assert.ok(app.includes('${heading}${chip}<div class="lq-hero-main">') && app.includes('  lqSesCount(host);\n  lqPctAnime(host);\n}'));
});

test('l’anneau se remplit à la première ouverture, puis depuis la valeur déjà vue ; immobile avec les mouvements réduits', async () => {
  const anime = cut('let lqPctVu=null;', '/* L’autocollant de la mascotte est gardé');
  const monte = async ({ p, reduit = false, contexte } = {}) => {
    const n = { textContent: String(p) }, f = { style: { strokeDashoffset: '' } }, vus = [];
    const el = { dataset: { p: String(p) }, isConnected: true, querySelector: s => (s === '.lq-pct-n' ? n : s === '.lq-pct-f' ? f : null) };
    const host = { querySelector: s => (s === '.lq-hero-pct[data-p]' ? el : null) };
    let t = 0;
    const c = contexte || vm.createContext({ document: { querySelector: s => (s === '#scr-learn.active' ? {} : null) } });
    Object.assign(c, { mascotReduced: () => reduit, setTimeout: g => g(), requestAnimationFrame: g => { t += 100; vus.push(n.textContent); g(t); } });
    if (!contexte) vm.runInContext(anime, c);
    c.lqPctAnime(host);
    return { n, f, vus, c };
  };
  let x = await monte({ p: 15 });
  assert.equal(x.vus[0], '0', 'de 0…');
  assert.ok(x.vus.length > 5 && x.vus.every((v, i) => i === 0 || +v >= +x.vus[i - 1]), '… en montant');
  assert.equal(x.n.textContent, '15'); assert.equal(x.f.style.strokeDashoffset, '', 'à la fin, l’anneau reprend sa valeur écrite');
  const y = await monte({ p: 15, contexte: x.c });
  assert.equal(y.vus.length, 0, 'même valeur au retour sur l’accueil : rien ne bouge');
  const z = await monte({ p: 17, contexte: x.c });
  assert.equal(z.vus[0], '15', 'une leçon validée depuis : de 15 à 17'); assert.equal(z.n.textContent, '17');
  const r = await monte({ p: 30, reduit: true });
  assert.equal(r.vus.length, 0, 'mouvements réduits'); assert.equal(r.n.textContent, '30');
});

test('le style : l’anneau menthe, le chiffre, « du parcours » dessous ; plus étroit sous 360 px', () => {
  for (const k of ['html.lq .lq-hero-row{position:relative;z-index:1;display:flex;align-items:center;gap:10px}',
    'html.lq .lq-hero-row>.lq-hero-mod{min-width:0}',
    'html.lq .lq-hero-pct{flex:none;display:flex;align-items:center;gap:7px;margin-left:auto;color:#fff}',
    'html.lq .lq-pct-ring{flex:none;display:block;width:30px;height:30px;rotate:-90deg;overflow:visible}',
    'html.lq .lq-pct-f{fill:none;stroke:var(--mint);stroke-width:4.2;stroke-linecap:round;stroke-dasharray:100 100}',
    'html.lq .lq-pct-txt small{font:600 11px/1.1 var(--ui);color:rgba(255,255,255,.8)}',
    '@media (max-width:359px){\n  html.lq .lq-hero-row{gap:8px}\n  html.lq .lq-pct-ring{width:26px;height:26px}'])
    assert.ok(lq.includes(k), k);
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=161">'));
});
