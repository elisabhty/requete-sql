/* Retours de 1 h 16 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « je suis sûr que tu peux améliorer l’écran de
   lancement (en mode data) : mettre des chiffres au lieu des confettis ? » La gerbe de confettis qui part de derrière la touche
   >_ devient quatorze nombres en chasse fixe : chaque chiffre défile comme sur un compteur, de gauche à droite, puis se pose
   sur sa valeur, et le nombre fait un petit bond quand il est complet. Toujours en transform et opacité seulement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));

/* Le script de l’ouverture, joué dans un bac à sable : ce qu’il insère dans #loader */
function inserer() {
  const html = [];
  const nom = { textContent: 'Requête', innerHTML: '', setAttribute() {} };
  const L = { style: {}, classList: { add() {}, remove() {}, contains: () => false }, querySelector: q => (q === '.ld-name' ? nom : null), insertAdjacentHTML: (w, h) => html.push(h) };
  const ctx = vm.createContext({
    document: { documentElement: { classList: { contains: c => c === 'is-native' } }, getElementById: id => (id === 'loader' ? L : null) },
    window: {}, Array, String, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => '' },
    navigator: {}, requestAnimationFrame() {}, setTimeout() {}
  });
  vm.runInContext(intro, ctx);
  assert.equal(html.length, 1);
  return html[0];
}
const nombres = (h) => [...h.matchAll(/<i class="in-p" aria-hidden="true" style="([^"]+)"><b class="in-n" style="--jm:(\d)">((?:<b class="in-c" style="--j:\d"><b>[\d\n]+<\/b><\/b>)+)<\/b><\/i>/g)]
  .map(m => {
    const v = Object.fromEntries(m[1].split(';').map(kv => kv.split(':')));
    const cols = [...m[3].matchAll(/<b class="in-c" style="--j:(\d)"><b>([\d\n]+)<\/b><\/b>/g)].map(c => ({ j: +c[1], lignes: c[2].split('\n') }));
    return { x: +v['--x'], y: +v['--y'], t: +v['--t'], c: v['--c'], r: +v['--r'], s: +v['--s'], d: +v['--d'], jm: +m[2], cols,
      valeur: cols.map(c => c.lignes.at(-1)).join('') };
  });

test('ouverture : quatorze nombres à la place des confettis, chacun avec ses chiffres qui défilent', () => {
  const h = inserer();
  assert.ok(!/is-(star|dot|sq)/.test(h) && !h.includes('mstk-star'), 'plus de confettis');
  assert.equal((h.match(/class="in-ring/g) || []).length, 2, 'les deux ondes restent');
  const ns = nombres(h);
  assert.equal(ns.length, 14);
  assert.deepEqual(ns.map(n => n.valeur), ['42', '1', '128', '7', '0', '0', '1', '16', '64', '99', '256', '8', '2', '3']);
  for (const n of ns) {
    assert.equal(n.jm, n.valeur.length - 1, `${n.valeur} : --jm, rang du dernier chiffre`);
    assert.deepEqual(n.cols.map(c => c.j), [...n.valeur].map((_, j) => j), 'un --j par colonne, de gauche à droite');
    for (const c of n.cols) {
      assert.equal(c.lignes.length, 7, 'six chiffres au hasard, puis le bon');
      const bon = c.lignes[6];
      assert.ok(c.lignes.slice(0, 6).every(l => /^\d$/.test(l) && l !== bon), `${n.valeur} : le bon chiffre n’apparaît qu’à la fin`);
      assert.equal(new Set(c.lignes.slice(0, 6)).size, 6, 'six chiffres différents : ça défile vraiment');
    }
    assert.ok(/^#[0-9A-F]{6}$/.test(n.c), n.c);
    assert.ok(Math.abs(n.r) <= 10, `${n.valeur} : penché d’au plus 10°, il reste lisible`);
  }
  /* Couleurs de l’appli : violets, vert, rouge, ambre */
  assert.deepEqual([...new Set(ns.map(n => n.c))].sort(), ['#169447', '#3FC98A', '#4B30CC', '#6A4DF4', '#8B6CFF', '#EF4F55', '#FFB020']);
});

test('ouverture : les nombres restent dans l’écran d’un iPhone et laissent la touche et « Requête » dégagées', () => {
  const ns = nombres(inserer());
  /* Unité = plus grand côté / 2732 : sur l’iPhone le plus étroit (430 × 932), la moitié de la largeur fait 630 unités et celle de
     la hauteur 1366. Une colonne de JetBrains Mono fait 0,6 em ; au bond, le nombre grandit de 18 %. */
  const demiLargeur = 2732 / 2 * 430 / 932;
  assert.ok(demiLargeur > 630 && demiLargeur < 631);
  for (const n of ns) {
    const l = n.valeur.length * 0.6 * n.t * n.s * 1.18;
    assert.ok(Math.abs(n.x) + l / 2 < demiLargeur - 20, `${n.valeur} : dans la largeur (${Math.round(Math.abs(n.x) + l / 2)})`);
    assert.ok(Math.abs(n.y - 14) + n.t / 2 < 1366 - 200, `${n.valeur} : loin des bords haut et bas`);
    const dansTouche = Math.abs(n.x) < 256 + l / 2 && n.y > -270 - n.t && n.y < 270 + n.t;
    assert.ok(!dansTouche, `${n.valeur} : pas sur la touche`);
    const dansNom = Math.abs(n.x) < 200 + l / 2 && n.y > 300 && n.y < 460;
    assert.ok(!dansNom, `${n.valeur} : pas sur « Requête »`);
  }
  /* Ils remplissent la hauteur : en haut comme en bas de la touche */
  assert.ok(ns.filter(n => n.y < -700).length >= 3 && ns.filter(n => n.y > 650).length >= 3);
  /* Deux nombres ne se recouvrent pas une fois posés */
  for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) {
    const A = ns[a], B = ns[b], la = A.valeur.length * .6 * A.t * A.s, lb = B.valeur.length * .6 * B.t * B.s;
    const separes = Math.abs(A.x - B.x) > (la + lb) / 2 || Math.abs(A.y - B.y) > (A.t * A.s + B.t * B.s) / 2;
    assert.ok(separes, `${A.valeur} et ${B.valeur} se recouvrent`);
  }
});

test('ouverture : le défilement et le bond, en transform seulement, finis avant la plongée dans la touche', () => {
  for (const part of [
    'html.is-native.lq #loader.is-intro .in-p{position:absolute;z-index:0;left:50%;top:var(--cy);width:0;height:0;opacity:0;will-change:transform,opacity}',
    'html.is-native.lq #loader.is-intro .in-n{position:absolute;left:0;top:0;display:flex;transform:translate(-50%,-50%);',
    'font:800 calc(var(--t)*var(--u))/1 var(--mono);color:var(--c);white-space:nowrap;font-variant-numeric:tabular-nums}',
    'html.is-native.lq #loader.is-intro .in-c{display:block;height:1em;overflow:hidden}',
    'html.is-native.lq #loader.is-intro .in-c>b{display:block;font:inherit;white-space:pre}',
    'html.is-native.lq #loader.is-intro.is-play .in-c>b{animation:introRoll calc(.28s + var(--j)*50ms) steps(6,end) calc(.14s + var(--d)*1ms) both}',
    'html.is-native.lq #loader.is-intro.is-play .in-n{animation:introLand .2s ease-out calc(.42s + var(--d)*1ms + var(--jm)*50ms) both}',
    '@keyframes introRoll{from{transform:none}to{transform:translateY(calc(1em - 100%))}}',
    '@keyframes introLand{0%,100%{transform:translate(-50%,-50%)}45%{transform:translate(-50%,-50%) scale(1.18)}}',
    '@keyframes introPartFade{0%{opacity:0}10%{opacity:1}75%{opacity:1}100%{opacity:0}}',
    'html.is-native.lq #loader.is-intro.is-play .in-p{animation:introPartMove .8s cubic-bezier(.12,.75,.3,1) calc(.14s + var(--d)*1ms) forwards,'
  ]) assert.ok(bloc.includes(part), part);
  assert.ok(!bloc.includes('.in-p.is-star') && !bloc.includes('.in-p.is-sq'), 'plus de styles de confettis');
  /* Six pas pour sept lignes : la colonne finit décalée de six lignes (1em - 100 %), sur le bon chiffre */
  const ns = nombres(inserer());
  for (const n of ns) {
    const debut = 0.14 + n.d / 1000;
    const pose = debut + 0.28 + n.jm * 0.05;                 // dernier chiffre posé
    assert.ok(pose < debut + 0.8 * 0.75, `${n.valeur} : posé avant de pâlir`);
    assert.ok(pose < 0.6, `${n.valeur} : posé à ${pose.toFixed(2)} s, avant la plongée (0,74 s)`);
    const bond = 0.42 + n.d / 1000 + n.jm * 0.05;
    assert.ok(Math.abs(bond - pose) < 1e-9, `${n.valeur} : le bond part quand le dernier chiffre tombe`);
  }
  const images = bloc.slice(bloc.indexOf('@keyframes introKey'), bloc.indexOf('/* Si le moteur SQL ne se charge pas'));
  assert.ok(!/filter|box-shadow|width|height|top|left|margin/.test(images), 'les images clés ne touchent qu’à transform et opacity');
  /* La police des chiffres est celle de l’appli, chargée d’avance : les nombres, créés dès l’ouverture, la demandent pendant que tout est
     encore invisible */
  assert.ok(css.includes("@font-face{font-family:'JBM';src:url(assets/fonts/jetbrains-mono.woff2) format('woff2');font-weight:100 800;"));
  assert.ok(app.indexOf('/* Appli iOS : l’ouverture animée') < app.indexOf('function hideLoader(){'));
});
