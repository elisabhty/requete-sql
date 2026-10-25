import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/* Ligne de lecture sans filets parasites sur iPhone. Elisa, 25 octobre, 12 h 28, devant la leçon DELETE à 1:08 : « Regarde en bas sur la ligne de lecture il y a un bug ».
   Sur sa capture : de fins filets violets collés au haut et au bas du rond du curseur, à sa droite, et deux petits bombés au-dessus et au-dessous du rond.
   Ce sont les restes de la poignée native du curseur (::-webkit-slider-thumb), que Safari (iOS 26) repeint à moitié quand elle a grossi (transform: scale)
   puis bougé. Chromium dessine la même barre proprement : le défaut est propre à la poignée native de WebKit.
   Maintenant : la poignée native est invisible (elle sert seulement à attraper le doigt), et le rond que l’on voit est un vrai élément (.lv-knob),
   qui change de taille au lieu de passer par une transformation : rien n’est mis sur un calque à part, rien n’est à moitié repeint. */

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = html.replace(/\/\*[\s\S]*?\*\//g, '');

const take = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a >= 0 && b > a, `extrait introuvable : ${from}`);
  return html.slice(a, b);
};
/* Les règles CSS dont le sélecteur contient `part` (hors commentaires ; le JS qui passe par là est écarté : un sélecteur commence par « . »). */
const rules = part => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ sel: m[1].trim(), body: m[2].trim() }))
  .filter(r => r.sel.startsWith('.') && r.sel.includes(part));
const one = sel => {
  /* La règle « mouvement réduit » (même sélecteur, dans un @media) est vérifiée à part. */
  const found = rules(sel).filter(r => r.sel === sel && r.body !== 'transition:none!important');
  assert.equal(found.length, 1, `règle « ${sel} » : ${found.length} trouvée(s)`);
  return found[0].body;
};

test('la poignée native du curseur est invisible : ni fond, ni bordure, ni ombre, et surtout ni transition ni transformation', () => {
  const thumbs = [...rules('::-webkit-slider-thumb'), ...rules('::-moz-range-thumb')];
  assert.ok(thumbs.length >= 2, 'une règle WebKit et une règle Firefox');
  for (const t of thumbs) {
    assert.ok(!/transition|transform|animation|filter|will-change/.test(t.body), `${t.sel} : rien qui la mette sur un calque à part`);
    assert.ok(!/box-shadow:(?!none)/.test(t.body) && !/background:(?!transparent)/.test(t.body) && !/border:(?!0[;}]|0$)/.test(t.body), `${t.sel} : rien à dessiner`);
  }
  const wk = one('.lv-seek::-webkit-slider-thumb');
  assert.ok(wk.includes('-webkit-appearance:none') && wk.includes('width:18px;height:18px;margin-top:-6px') && wk.includes('background:transparent') && wk.includes('border:0') && wk.includes('box-shadow:none'),
    'poignée WebKit : 18 px, centrée sur la glissière de 6 px, transparente');
  const fx = one('.lv-seek::-moz-range-thumb');
  assert.ok(fx.includes('width:18px;height:18px;box-sizing:border-box') && fx.includes('background:transparent') && fx.includes('border:0'), 'poignée Firefox : même taille, transparente');
  assert.ok(!html.includes('.lv-seek::-webkit-slider-thumb{transition') && !html.includes('.lv-seek:focus-visible::-webkit-slider-thumb'), 'plus de transition ni d’anneau de focus sur la poignée native');
});

test('le rond du curseur est un vrai élément, posé après la glissière (donc au-dessus d’elle) et avant la bulle de temps', () => {
  const m = html.indexOf('<div class="lv-track">');
  const track = html.slice(m, html.indexOf('</div></div>', html.indexOf('<div class="lv-tip"', m)) + 12);
  const order = ['class="lv-rail"', 'class="lv-pkm"', '<input class="lv-seek"', '<i class="lv-knob" aria-hidden="true"></i>', '<div class="lv-tip"'].map(s => track.indexOf(s));
  assert.ok(order.every(i => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]), `ordre dans la barre : ${order.join(' < ')}`);
  assert.ok(html.includes('<input class="lv-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Avancement de la vidéo"><i class="lv-knob" aria-hidden="true"></i>'),
    'le rond suit directement la glissière (le sélecteur ~ du focus clavier en dépend)');
  assert.ok(html.includes("fill:root.querySelector('.lv-fill'),knob:root.querySelector('.lv-knob'),"), 'le lecteur garde son rond');
});

test('le rond ne passe jamais par un calque à part : ni transform, ni filter, ni will-change, ni opacité, ni animation', () => {
  const all = rules('.lv-knob');
  assert.ok(all.length >= 5, `règles du rond : ${all.map(r => r.sel).join(' | ')}`);
  for (const r of all) assert.ok(!/transform|filter|will-change|opacity|animation|perspective/.test(r.body), `${r.sel} : ${r.body.slice(0, 80)}`);
  assert.ok(!/@keyframes[^{]*knob/i.test(css), 'pas d’animation image par image sur le rond');
  /* Il grossit et reprend ses couleurs par des changements de taille et de couleur, qui se repeignent comme tout le reste de la page. */
  const base = one('.lv-knob::before');
  for (const prop of ['left', 'top', 'width', 'height', 'border-color', 'box-shadow']) assert.ok(new RegExp(`transition:[^;]*\\b${prop} \\.`).test(base.replace(/\s+/g, ' ')), `transition de ${prop}`);
});

test('états du rond : 18 px au repos, 22 px sous le doigt, anneau vert pour un exercice réussi, anneau violet au clavier, sans mouvement si on le demande', () => {
  const b = one('.lv-knob::before');
  assert.ok(b.includes('left:-9px;top:-9px;width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#fff;border:3px solid var(--accent,#6A4DF4);box-shadow:0 2px 6px rgba(40,20,120,.25)'), 'même rond blanc à bordure violette qu’avant');
  assert.ok(one('.lv.is-seeking .lv-knob::before').includes('left:-11px;top:-11px;width:22px;height:22px'), 'sous le doigt : 22 px, centré au même point (pas de demi-pixel : le rond reste net)');
  assert.ok(one('.lv.is-valid .lv-knob::before').includes('border-color:#169447;box-shadow:0 0 0 6px rgba(22,148,71,.22),0 2px 6px rgba(40,20,120,.25)'), 'exercice réussi : bordure et anneau verts');
  assert.equal(one('.lv-seek:focus-visible~.lv-knob::before'), 'box-shadow:0 0 0 4px rgba(106,77,244,.28)', 'focus clavier : anneau violet clair, comme avant');
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){.lv-pkm i{transition:none!important}.lv-knob::before{transition:none!important}}'), 'mouvement réduit : le rond change sans transition');
  const k = one('.lv-knob');
  assert.ok(k.includes('position:absolute') && k.includes('z-index:1') && k.includes('top:50%') && k.includes('left:9px') && k.includes('width:0;height:0') && k.includes('pointer-events:none'),
    'point d’ancrage sans taille au centre du rond, qui laisse passer les touchers vers la glissière');
});

test('même ordre d’empilement qu’avec la poignée native : points dorés < rond < badges faits (vert ou rouge) ; tout est centré sur la glissière', () => {
  assert.ok(one('.lv-track .lv-seek').includes('position:relative') && one('.lv-track .lv-seek').includes('z-index:1'), 'glissière au-dessus des points à faire');
  assert.ok(one('.lv-knob').includes('z-index:1'), 'le rond, au même niveau, vient après dans la page : il est dessus');
  assert.ok(one('.lv-pkm i.ok,.lv-pkm i.ko').includes('z-index:2'), 'les badges faits passent par-dessus le rond');
  assert.ok(!one('.lv-pkm').includes('z-index') && !one('.lv-track').includes('z-index'), 'ni les points ni la piste ne forment un empilement à part');
  /* Le rond (18 px) est centré sur l’ancre, qui est au centre de la piste ; la poignée native de 18 px est centrée sur la glissière de 6 px par margin-top:-6px. */
  assert.equal((6 - 18) / 2, -6);
  assert.ok(one('.lv-seek::-webkit-slider-runnable-track').includes('height:6px') && one('.lv-rail').includes('height:6px;margin-top:-3px'), 'glissière et rail : 6 px, centrés');
});

test('lvFill pose la partie lue et le rond au même endroit, de 9 px à 100 % − 9 px, quoi qu’on lui donne', () => {
  const seg = take('function lvFill(p){', 'function lvSyncSeek(){');
  const mk = parts => { const LV = { fill: parts.fill ? { style: {} } : null, knob: parts.knob ? { style: {} } : null }; const ctx = vm.createContext({ LV: parts.none ? null : LV, Math }); vm.runInContext(seg, ctx); return { LV, ctx }; };
  const a = mk({ fill: true, knob: true });
  const want = p => `calc(9px + ${p} * (100% - 18px))`;
  for (const [given, shown] of [[0, '0.0000'], [0.25, '0.2500'], [0.3116, '0.3116'], [1, '1.0000'], [-3, '0.0000'], [7, '1.0000'], [NaN, '0.0000'], [undefined, '0.0000'], ['0.5', '0.5000']]) {
    a.ctx.lvFill(given);
    assert.equal(a.LV.fill.style.width, want(shown), `partie lue pour ${given}`);
    assert.equal(a.LV.knob.style.left, want(shown), `rond pour ${given}`);
  }
  /* Même largeur utile que la poignée native de 18 px : la formule garde 9 px de chaque côté. */
  assert.ok(seg.includes('calc(9px + ') && seg.includes('(100% - 18px)'));
  /* Sans rond ou sans partie lue (page de test, lecteur fermé) : pas d’erreur ; sans lecteur : rien. */
  mk({ fill: true }).ctx.lvFill(0.5); mk({ knob: true }).ctx.lvFill(0.5); mk({ none: true }).ctx.lvFill(0.5);
});

test('à chaque tic de la vidéo, lvSyncSeek avance la glissière, la partie lue, le rond et le temps ensemble', () => {
  const seg = take('function lvFill(p){', 'function lvSyncPP(){');
  const cur = { textContent: '' };
  const LV = { video: { duration: 200, currentTime: 50 }, seek: { value: '0' }, fill: { style: {} }, knob: { style: {} }, root: { querySelector: s => (s === '.lv-cur' ? cur : null) } };
  const ctx = vm.createContext({ LV, Math, String, lvFmt: t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` });
  vm.runInContext(seg, ctx);
  ctx.lvSyncSeek();
  assert.equal(LV.seek.value, '250');
  assert.equal(LV.fill.style.width, 'calc(9px + 0.2500 * (100% - 18px))');
  assert.equal(LV.knob.style.left, LV.fill.style.width, 'le rond est au bout de la partie lue');
  assert.equal(cur.textContent, '0:50');
  LV.video.currentTime = 1e9; ctx.lvSyncSeek();
  assert.equal(LV.knob.style.left, 'calc(9px + 1.0000 * (100% - 18px))', 'jamais au-delà de la fin');
  LV.video.duration = 0; ctx.lvSyncSeek();
  assert.equal(LV.knob.style.left, 'calc(9px + 0.0000 * (100% - 18px))', 'durée inconnue : au début');
});

test('en glissant, le rond suit la glissière (valeur retenue incluse) et le curseur grossit par la classe is-seeking, comme avant', () => {
  assert.ok(html.includes("LV.seeking=true; root.classList.add('is-seeking');") && html.includes("LV.seeking=false; root.classList.remove('is-seeking'); lvTip(false);"), 'la classe suit le glisser');
  assert.ok(html.includes('    lvFill(seek.value/1000);\n'), 'après chaque « input », partie lue et rond reprennent la valeur de la glissière (celle qui a été retenue avant un exercice, par exemple)');
});
