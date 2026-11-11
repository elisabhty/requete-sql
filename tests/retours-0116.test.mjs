/* Retours de 1 h 16 et 1 h 29 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « je suis sûr que tu peux améliorer l’écran
   de lancement (en mode data) : mettre des chiffres au lieu des confettis ? », puis, sur une gerbe de nombres lancés autour de la
   touche : « réfléchis mieux stp, on peut faire mieux ». Des nombres au hasard restaient des confettis. L’écran devient une table :
   l’appui sur la touche >_ y envoie une onde, chaque case chiffrée surgit à son passage (un halo de données autour de la touche),
   la requête allume ses résultats un à un aux couleurs de l’appli, puis on plonge dans la touche pendant que la table file sur les
   côtés. Toujours en transform et opacité seulement, toujours 1,3 s. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));

/* Le script de l’ouverture, joué dans un bac à sable à la taille d’un écran : ce qu’il insère dans #loader */
function inserer(largeur = 430, hauteur = 932) {
  const html = [];
  const nom = { textContent: 'Requête', innerHTML: '', setAttribute() {} };
  const L = { style: {}, classList: { add() {}, remove() {}, contains: () => false }, querySelector: q => (q === '.ld-name' ? nom : null), insertAdjacentHTML: (w, h) => html.push(h) };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: { innerWidth: largeur, innerHeight: hauteur }, Array, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => '' },
    navigator: {}, requestAnimationFrame() {}, setTimeout() {}
  });
  vm.runInContext(intro, ctx);
  assert.equal(html.length, 0, 'la table se prépare quand l’appli est prête, plus pendant le chargement (11 novembre)');
  ctx.window.__introJouer();
  assert.equal(html.length, 1);
  return html[0];
}
const cases = (h) => [...h.matchAll(/<i class="in-t" style="([^"]+)">([\s\S]*?)<\/i>/g)].map(m => {
  const v = Object.fromEntries(m[1].split(';').map(kv => kv.split(':')));
  const corps = m[2], roule = corps.match(/^<b><b>([\d\n]+)<\/b><\/b>/), choix = corps.match(/<s style="([^"]+)">(\d+)<\/s>$/);
  const lignes = roule ? roule[1].split('\n') : null;
  return { x: +v['--x'], y: +v['--y'], w: +v['--w'], b: v['--b'], l: v['--l'], k: v['--k'], lignes,
    valeur: lignes ? lignes.at(-1) : corps.replace(/<s .*$/, ''),
    choix: choix && { ...Object.fromEntries(choix[1].split(';').map(kv => kv.split(':'))), valeur: choix[2] } };
});
const hexa = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

test('ouverture : la table remplace les confettis, une case chiffrée tous les 128 (la touche en couvre 4 × 4)', () => {
  const h = inserer();
  assert.ok(!/in-p|is-(star|dot|sq)|in-n|in-c/.test(h), 'plus de confettis ni de nombres volants');
  assert.equal((h.match(/class="in-ring/g) || []).length, 2, 'les deux ondes restent');
  assert.ok(h.includes('<div class="in-grid" aria-hidden="true">') && h.endsWith('</div>'));
  const cs = cases(h);
  assert.ok(cs.length > 100 && cs.length < 160, `${cs.length} cases sur l’iPhone d’Elisa`);
  for (const c of cs) {
    assert.equal((Math.abs(c.x) - 64) % 128, 0); assert.equal((Math.abs(c.y) - 64) % 128, 0);
    assert.ok(!(Math.abs(c.x) < 256 && Math.abs(c.y) < 256), 'rien sous la touche');
    assert.ok(!(Math.abs(c.x) < 256 && (c.y === 320 || c.y === 448)), 'rien sous « Requête »');
    assert.ok(/^\d\d$/.test(c.valeur), `nombre à deux chiffres (${c.valeur})`);
  }
  const ids = cs.map(c => `${c.x},${c.y}`); assert.equal(new Set(ids).size, ids.length, 'une case par place');
  /* Même écran, même table : le hasard est tiré d’une graine fixe */
  assert.equal(inserer(), h);
});

test('ouverture : un halo de données, net près de la touche, fondu dans le fond au loin, et dans l’écran', () => {
  for (const [L, H] of [[430, 932], [375, 667], [1024, 1366]]) {
    const u = Math.max(L, H) / 2732, cs = cases(inserer(L, H));
    for (const c of cs) {
      const r = Math.hypot(c.x, c.y);
      assert.ok(r < 340 + 760 * 0.94, 'au-delà, la case serait invisible : pas créée');
      assert.ok(Math.abs(c.x) - 56 < L / 2 / u && c.y - 56 < H / 2 / u + 14 && c.y + 56 > -(H / 2 / u - 14), 'au moins en partie à l’écran');
    }
    /* Plus la case est loin, plus son nombre se fond dans le fond (#F4F2FC) */
    const ecart = (c) => { const [r, g, b] = hexa(c.k); return Math.abs(r - 0xF4) + Math.abs(g - 0xF2) + Math.abs(b - 0xFC); };
    const pres = cs.filter(c => Math.hypot(c.x, c.y) < 400), loin = cs.filter(c => Math.hypot(c.x, c.y) > 950);
    assert.ok(pres.length && loin.length, `${L} × ${H}`);
    assert.ok(Math.min(...pres.map(ecart)) > 4 * Math.max(...loin.map(ecart)), 'les cases lointaines sont pâles');
    assert.ok(pres.every(c => ecart(c) > 250), 'les proches, du violet de l’appli');
  }
  /* Sur l’iPhone, le haut et le bas de l’écran restent nets (la table s’arrête avant) */
  const u = 932 / 2732, cs = cases(inserer());
  assert.ok(Math.max(...cs.map(c => Math.abs(c.y))) + 56 < 932 / 2 / u - 200);
});

test('ouverture : l’onde part de la touche, la requête allume ses résultats un à un, avant la plongée', () => {
  const cs = cases(inserer());
  for (const c of cs) {
    const r = Math.hypot(c.x, c.y);
    assert.equal(c.w, Math.round(170 + (r - 256) / 1.65), 'la case surgit quand l’onde (1 650 unités par seconde, partie à 0,18 s, 9 h 28 : « trop rapide ») la touche');
    assert.ok(c.w >= 170 && c.w + 480 < 1250, `${c.w} ms : posée avant la plongée (1,25 s)`);
    if (r < 560) {
      assert.ok(c.lignes && c.lignes.length === 4, 'les proches défilent : trois nombres, puis le bon');
      assert.ok(c.lignes.every(l => /^\d\d$/.test(l)));
    } else assert.equal(c.lignes, null, 'les autres restent fixes (moins d’animations)');
  }
  const res = cs.filter(c => c.choix);
  assert.ok(res.length >= 6 && res.length <= 14, `${res.length} résultats`);
  res.forEach((c, i) => {
    assert.ok(Math.hypot(c.x, c.y) < 720, 'des résultats proches de la touche');
    assert.equal(c.choix.valeur, c.valeur, 'le résultat garde le nombre de sa case');
    assert.equal(+c.choix['--p'], 780 + i * 42, 'l’un après l’autre, de 0,78 à 1,16 s');
    assert.ok(+c.choix['--p'] >= c.w + 290, 'la case est déjà là (opaque) quand elle s’allume');
    assert.ok(+c.choix['--p'] + 360 < 1620, 'allumé avant que l’appli n’apparaisse');
  });
  /* Les quatre couleurs de l’appli, à tour de rôle */
  assert.deepEqual(res.slice(0, 4).map(c => c.choix['--c']), ['#FFC83D', '#3FC98A', '#F0616A', '#6A4DF4']);
  assert.ok(res.every(c => (c.choix['--c'] === '#FFC83D') === (c.choix['--ci'] === '#221C46')), 'encre sombre sur le jaune, blanche ailleurs');
});

test('ouverture : tout se joue en transform et opacité, et la table file sur les côtés pendant la plongée', () => {
  for (const part of [
    'html.is-native.lq #loader.is-intro .in-grid{position:absolute;inset:0;z-index:0;transform-origin:50% var(--cy)}',
    'html.is-native.lq #loader.is-intro .in-t{position:absolute;left:calc(50% + (var(--x) - 56)*var(--u));top:calc(var(--cy) + (var(--y) - 56)*var(--u));',
    'width:calc(112*var(--u));height:calc(112*var(--u));border-radius:calc(26*var(--u));background:var(--b);box-shadow:0 calc(9*var(--u)) 0 var(--l);',
    'html.is-native.lq #loader.is-intro .in-t>b{display:block;height:1em;overflow:hidden;font:inherit}',
    'html.is-native.lq #loader.is-intro .in-t>s{position:absolute;inset:0;border-radius:inherit;background:var(--c);box-shadow:0 calc(9*var(--u)) 0 var(--cl);',
    'html.is-native.lq #loader.is-intro.is-play .in-ring{animation:introWave .6s linear .18s forwards}',
    'html.is-native.lq #loader.is-intro.is-play .in-t{animation:introTile .48s cubic-bezier(.3,.7,.4,1) calc(var(--w)*1ms) both}',
    /* 9 h 28 : les nombres défilent d’un seul glissé (plus de saut par cran, qui scintillait) */
    'html.is-native.lq #loader.is-intro.is-play .in-t>b>b{animation:introRoll .6s cubic-bezier(.25,.8,.3,1) calc(var(--w)*1ms) both}',
    'html.is-native.lq #loader.is-intro.is-play .in-t>s{animation:introPick .36s cubic-bezier(.3,1.3,.5,1) calc(var(--p)*1ms) both}',
    'html.is-native.lq #loader.is-intro.is-play .in-grid{animation:introWarp .55s cubic-bezier(.42,0,.72,.42) 1.25s forwards}',
    '@keyframes introWave{0%{opacity:.9;transform:none}60%{opacity:.25}100%{opacity:0;transform:scale(5)}}',
    '@keyframes introTile{0%{opacity:0;transform:scale(.55)}60%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:none}}',
    '@keyframes introRoll{from{transform:none}to{transform:translateY(calc(1em - 100%))}}',
    '@keyframes introPick{0%{opacity:0;transform:scale(.6)}60%{opacity:1}100%{opacity:1;transform:none}}',
    '@keyframes introWarp{to{opacity:0;transform:scale(2.4)}}',
    'html.is-native.lq #loader.is-intro.fatal :is(.in-ring,.in-grid){display:none}',
    /* La plongée, deux fois plus longue, puis l’appli en fondu : 2 s en tout (9 h 28 : « trop rapide ») */
    'introZoom .55s cubic-bezier(.42,0,.72,.42) 1.25s forwards', 'html.is-native.lq #loader.is-intro.is-play{animation:introOut .4s ease-out 1.62s forwards}'
  ]) assert.ok(bloc.includes(part), part);
  /* L’onde (de la demi-touche, 256, jusqu’à 5 fois plus) va à la vitesse que le script prête aux cases */
  assert.ok(Math.abs((256 * 5 - 256) / 0.6 - 1650) / 1650 < 0.04);
  assert.ok(!bloc.includes('steps('), 'aucun défilement par crans');
  assert.ok(!/introPart|introLand|\.in-p\b|\.in-n\b|\.in-c\b/.test(bloc), 'plus de styles de confettis ni de nombres volants');
  const images = bloc.slice(bloc.indexOf('@keyframes introKey'), bloc.indexOf('/* Si le moteur SQL ne se charge pas'));
  assert.ok(!/filter|box-shadow|width|height|top|left|margin|background|color/.test(images), 'les images clés ne touchent qu’à transform et opacity');
  assert.ok(app.includes('setTimeout(ranger,2080);'), 'rangé à 2,08 s, une fois le fondu fini (1,62 + 0,4 s)');
});
