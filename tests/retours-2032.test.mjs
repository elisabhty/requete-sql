/* 5 novembre, 20 h 32 (Elisa, capture de la carte du cours de l’accueil, « Prête pour la suite, Elisa ? ») : « mettre le % du parcours
   au total » ; 20 h 34 (capture de la carte « Ton objectif », « 4 % fait · fin prévue le 9 janvier ») : « supprimer » ; 20 h 44 : « la
   partie de gauche sur la leçon (les détails) fusionnée dans le bouton, pour laisser la place au % » ; 20 h 53 : « Ton parcours,
   supprime SQL ; non, mettre le % du module ».
   À gauche de la mascotte, la part du module en grand ; la leçon passe dans le bouton ; la carte de l’objectif quitte l’accueil
   (retours-1727).
   6 novembre, 8 h 47 – 8 h 49 : la carte « La leçon d’abord » remplace le grand % (retours-0849) ; restent le bouton sur deux lignes
   et la barre qui se remplit. */
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

test('6 novembre, 8 h 49 : le grand % du module laisse la place à la leçon (la carte « La leçon d’abord »)', () => {
  const h = cut('function renderHomeHero(){', '\nconst LQ_VIDEO_SVG=');
  assert.ok(!h.includes('lq-hero-parc') && !h.includes('lq-pct-n') && !h.includes('const parc='), 'plus de grand chiffre');
  /* Le bouton garde ses deux lignes ; la seconde dit maintenant le temps qui reste (« Encore ~3 min »), la leçon est en grand au-dessus */
  assert.ok(h.includes('<span class="lq-cta-t"><b>${esc(ctaLabel)}</b><small>${esc(sub)}</small></span></button></section>'));
  assert.ok(h.includes('<h3 class="lq-a-titre">${esc(meta.titre)}</h3>'));
  /* Le calcul du parcours reste celui de la page Parcours */
  assert.ok(app.includes('function parcoursSqlFaites(){return MODULES.reduce((n,m)=>n+m.lessons.filter(l=>state.lessons[l.id]&&state.lessons[l.id].done).length,0);}'));
  assert.ok(app.includes('  lqSesAjuste(host);   // mesuré avec le vrai nombre, avant que le compteur parte de 0 (audit du 6 novembre, bug 6)\n  lqSesCount(host);\n  lqPctAnime(host);\n  if(typeof lqFlammeBravo===\'function\')lqFlammeBravo();\n}'), '10 h 30 : puis, s’il le faut, la page « Bravo » de la flamme du jour');
});

test('la barre de la leçon se remplit à la première ouverture, puis depuis la valeur déjà vue ; immobile avec les mouvements réduits', async () => {
  const anime = cut('let lqPctVu=null;', '/* L’autocollant de la mascotte est gardé');
  const monte = async ({ p, reduit = false, contexte } = {}) => {
    const f = { style: { width: p + '%' } }, vus = [];
    const el = { dataset: { p: String(p) }, isConnected: true, querySelector: s => (s === 'i' ? f : null) };
    const host = { querySelector: s => (s === '.lq-a-bar[data-p]' ? el : null) };
    let t = 0;
    const c = contexte || vm.createContext({ document: { querySelector: s => (s === '#scr-learn.active' ? {} : null) } });
    Object.assign(c, { mascotReduced: () => reduit, setTimeout: g => g(), requestAnimationFrame: g => { t += 100; vus.push(f.style.width); g(t); } });
    if (!contexte) vm.runInContext(anime, c);
    c.lqPctAnime(host);
    return { f, vus, c };
  };
  const x = await monte({ p: 15 });
  assert.equal(x.vus[0], '0.00%', 'de 0…');
  assert.ok(x.vus.length > 5 && x.vus.every((v, i) => i === 0 || parseFloat(v) >= parseFloat(x.vus[i - 1])), '… en montant');
  assert.equal(x.f.style.width, '15%');
  const y = await monte({ p: 15, contexte: x.c });
  assert.equal(y.vus.length, 0, 'même valeur au retour sur l’accueil : rien ne bouge');
  const z = await monte({ p: 40, contexte: x.c });
  assert.equal(z.vus[0], '15.00%', 'la vidéo a avancé depuis : de 15 à 40'); assert.equal(z.f.style.width, '40%');
  const r = await monte({ p: 30, reduit: true });
  assert.equal(r.vus.length, 0, 'mouvements réduits'); assert.equal(r.f.style.width, '30%');
});

test('le style : la barre jaune de la leçon, le bouton sur deux lignes ; plus de grand chiffre', () => {
  for (const k of ['html.lq .lq-a-bar{display:block;height:8px;border-radius:99px;',
    'html.lq .lq-a-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--sun),var(--sun-hi))}',
    'html.lq .lq-hero .lq-hero-cta-lecon .lq-cta-t{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;max-width:calc(100% - 40px);text-align:left}',
    'html.lq .lq-hero .lq-hero-cta-lecon .lq-cta-t small{display:-webkit-box;-webkit-line-clamp:2;',
    '@media (max-width:360px){\n  html.lq .lq-hero .lq-hero-cta-lecon .lq-cta-t b{font-size:17px}'])
    assert.ok(lq.includes(k), k);
  assert.ok(!lq.includes('.lq-parc-n') && !lq.includes('.lq-hero-parc') && !lq.includes('.lq-parc-bar'), 'le style du grand chiffre est parti avec lui');
  assert.ok(!lq.includes('.lq-hero-pct') && !lq.includes('.lq-pct-ring'), 'plus d’anneau');
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=340">'));
});
