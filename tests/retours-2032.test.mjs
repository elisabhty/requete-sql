/* 5 novembre, 20 h 32 (Elisa, capture de la carte du cours de l’accueil, « Prête pour la suite, Elisa ? ») : « mettre le % du parcours
   au total » ; 20 h 34 (capture de la carte « Ton objectif », « 4 % fait · fin prévue le 9 janvier ») : « supprimer » ; 20 h 44 : « la
   partie de gauche sur la leçon (les détails) fusionnée dans le bouton, pour laisser la place au % » ; 20 h 53 : « Ton parcours,
   supprime SQL ; non, mettre le % du module ».
   À gauche de la mascotte, la part du module en grand ; la leçon passe dans le bouton ; la carte de l’objectif quitte l’accueil
   (retours-1727). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const NB = ' ';

test('la carte du cours : le module en grand à gauche de la mascotte, la leçon dans le bouton', () => {
  const calc = cut('  const chip=mod?', '  if(!lqSameHtml(host,html))');
  /* Le module en cours : 12 leçons, les « faites » premières validées ; le parcours, lui, en compte 71 (20 de plus de validées) */
  const carte = (faites, total, extra = {}) => {
    const lessons = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i }));
    const state = { lessons: Object.fromEntries(lessons.slice(0, Math.min(faites, 12)).map(l => [l.id, { done: true }])) };
    const c = vm.createContext({ state, parcoursSqlFaites: () => faites + 20, TOTAL: total, esc: String, escAttr: s => String(s).replace(/"/g, '&quot;'),
      mod: { titre: 'Lire une table', lessons }, modIndex: 1, defi: false, niv: '', meta: { titre: 'ORDER BY', sous: '' }, index: 11, kicker: 'Leçon 11 sur 12',
      ctaLabel: 'Reprendre ma leçon', mc: 1, heading: '', mascot: '<i class="m"></i>', pips: '', arg: '11', currentStep: 0, HOME_PLAY_SVG: '▶', streak: '', extras: '', ...extra });
    vm.runInContext(calc.replace(/const (chip|enMod|fait|tot|pf|parc|detail|ctaLu|html)=/g, 'var $1='), c);
    return c;
  };
  let c = carte(10, 71);
  assert.equal(c.pf, 83, '10 leçons sur les 12 du module, pas sur les 71 du parcours');
  /* 21 h 09 : plus de « Ton module » en menthe au-dessus (retours-2109) */
  assert.equal(c.parc, `<div class="lq-hero-body lq-hero-parc" data-p="83"><p class="lq-parc-n"><span class="lq-pct-n">83</span><em>${NB}%</em></p><span class="lq-parc-bar" aria-hidden="true"><i style="width:83%"></i></span><p class="lq-hero-sub">10 leçons validées sur 12</p></div>`);
  assert.ok(c.html.includes('<span class="lq-hero-mod"><b>Module 2</b>Lire une table</span><div class="lq-hero-main"><div class="lq-hero-body lq-hero-parc" data-p="83">') && c.html.includes('</div><i class="m"></i></div>'), 'le module, puis sa part et la mascotte');
  assert.ok(!c.html.includes('Ton parcours SQL'), '« SQL » retiré');
  assert.ok(c.html.includes('<button type="button" class="journey-primary lq-hero-cta lq-hero-cta-lecon" aria-label="Reprendre ma leçon : leçon 11 sur 12, ORDER BY" onclick="openItem(11,0)"><span class="lq-play" aria-hidden="true">▶</span><span class="lq-cta-t"><b>Reprendre ma leçon</b><small>Leçon 11 sur 12 · ORDER BY</small></span></button></section>'), 'la leçon dans le bouton');
  assert.ok(!c.html.includes('lq-hero-title') && !c.html.includes('lq-hero-pct'), 'plus de titre de leçon à gauche, plus d’anneau');
  assert.equal(carte(1, 71).parc.match(/<p class="lq-hero-sub">([^<]+)/)[1], '1 leçon validée sur 12');
  assert.equal(carte(0, 71).parc.match(/<p class="lq-hero-sub">([^<]+)/)[1], '12 leçons t’attendent', 'un module tout neuf : ce qui attend');
  assert.equal(carte(12, 71).pf, 100);
  /* Un défi, hors module : la part du parcours (25 leçons validées sur 71), sous « Ton parcours » */
  c = carte(5, 71, { mod: null, defi: true, niv: 'Facile', index: 0, kicker: 'Ton prochain défi', ctaLabel: 'Commencer le défi', meta: { titre: 'Le meilleur client' }, arg: '"d3"' });
  assert.equal(c.pf, 35);
  assert.ok(!c.parc.includes('lq-hero-kicker') && c.parc.includes('25 leçons validées sur 71'));
  assert.ok(c.html.includes('<span class="lq-hero-mod"><b>Défi</b>Facile</span>') && c.html.includes('<b>Commencer le défi</b><small>Le meilleur client</small>') && c.html.includes('aria-label="Commencer le défi : Le meilleur client"'), 'un défi');
  assert.equal(carte(5, 71, { mod: null, defi: true, parcoursSqlFaites: undefined }).pf, 0, 'sans le calcul (une page de test) : 0 %, sans erreur');
  /* Le calcul du parcours est celui de la page Parcours */
  assert.ok(app.includes('function parcoursSqlFaites(){return MODULES.reduce((n,m)=>n+m.lessons.filter(l=>state.lessons[l.id]&&state.lessons[l.id].done).length,0);}'));
  assert.ok(app.includes('  lqSesCount(host);\n  lqPctAnime(host);\n  lqSesAjuste(host);\n}'));
});

test('la barre se remplit à la première ouverture, puis depuis la valeur déjà vue ; immobile avec les mouvements réduits', async () => {
  const anime = cut('let lqPctVu=null;', '/* L’autocollant de la mascotte est gardé');
  const monte = async ({ p, reduit = false, contexte } = {}) => {
    const n = { textContent: String(p) }, f = { style: { width: p + '%' } }, vus = [];
    const el = { dataset: { p: String(p) }, isConnected: true, querySelector: s => (s === '.lq-pct-n' ? n : s === '.lq-parc-bar i' ? f : null) };
    const host = { querySelector: s => (s === '.lq-hero-parc[data-p]' ? el : null) };
    let t = 0;
    const c = contexte || vm.createContext({ document: { querySelector: s => (s === '#scr-learn.active' ? {} : null) } });
    Object.assign(c, { mascotReduced: () => reduit, setTimeout: g => g(), requestAnimationFrame: g => { t += 100; vus.push([n.textContent, f.style.width]); g(t); } });
    if (!contexte) vm.runInContext(anime, c);
    c.lqPctAnime(host);
    return { n, f, vus, c };
  };
  const x = await monte({ p: 15 });
  assert.deepEqual(x.vus[0], ['0', '0.00%'], 'de 0…');
  assert.ok(x.vus.length > 5 && x.vus.every((v, i) => i === 0 || +v[0] >= +x.vus[i - 1][0]), '… en montant');
  assert.equal(x.n.textContent, '15'); assert.equal(x.f.style.width, '15%');
  const y = await monte({ p: 15, contexte: x.c });
  assert.equal(y.vus.length, 0, 'même valeur au retour sur l’accueil : rien ne bouge');
  const z = await monte({ p: 17, contexte: x.c });
  assert.deepEqual(z.vus[0], ['15', '15.00%'], 'une leçon validée depuis : de 15 à 17'); assert.equal(z.n.textContent, '17');
  const r = await monte({ p: 30, reduit: true });
  assert.equal(r.vus.length, 0, 'mouvements réduits'); assert.equal(r.n.textContent, '30');
});

test('le style : grand chiffre jaune et sa barre, le bouton sur deux lignes ; rien sous l’étiquette du niveau', () => {
  for (const k of ['html.lq .lq-hero-parc{flex:1;min-width:0}',
    'html.lq .lq-parc-n{display:flex;align-items:baseline;margin:2px 0 0;font:800 46px/1 var(--display);letter-spacing:-.03em;color:var(--sun-hi);',
    'html.lq .lq-parc-bar{display:block;max-width:min(230px,calc(100% - 32px));height:9px;',
    'html.lq .lq-parc-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--sun),var(--sun-hi))}',
    'html.lq .lq-hero-parc .lq-hero-sub{max-width:calc(100% - 32px);',
    'html.lq .lq-hero .lq-hero-cta-lecon .lq-cta-t{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;max-width:calc(100% - 40px);text-align:left}',
    'html.lq .lq-hero .lq-hero-cta-lecon .lq-cta-t small{display:-webkit-box;-webkit-line-clamp:2;',
    '@media (max-width:360px){\n  html.lq .lq-parc-n{font-size:40px}\n  html.lq .lq-parc-bar,html.lq .lq-hero-parc .lq-hero-sub{max-width:calc(100% - 48px)}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.lq-hero-pct') && !lq.includes('.lq-pct-ring'), 'plus d’anneau');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=169">'));
});
