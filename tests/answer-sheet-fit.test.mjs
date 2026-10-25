/* La feuille de réponse d’un moment « À toi » ne touche jamais le contenu de l’image.
   Sur un grand téléphone, la feuille tient sous l’image. Sur un écran plus étroit ou plus court (iPhone 12 à 15, SE), une question
   longue ou des réponses sur deux lignes la font monter : elle recouvrait ou frôlait le bas du contenu (2 à 4 px, parfois 28 px
   de recouvrement). Le lecteur réduit alors l’image juste assez (lvPkFit) pour garder 18 px d’écart ; rien ne change quand l’écart
   suffit. Seul compte un état qui dure : pas de mesure pendant un geste ou une réponse en cours, ni entre la bonne réponse et la
   correction posée. Ici, la mécanique du lecteur est jouée avec des mesures simulées. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'assets/anim/core.js'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, `repère : ${a}`); const j = html.indexOf(b, i); assert.ok(j > i, `repère : ${b}`); return html.slice(i, j); };

/* Un lecteur simulé : largeur × hauteur du plateau d’image (haut à 0), contenu dont le bas est à B (maquette 1080 × 1920),
   plateau dont le bord haut est à top (px du lecteur). */
function player({W = 390, H = 660, B = 1381, top = 446.3} = {}) {
  const calls = {layer: 0, timers: []};
  const frame = {style: {}};
  const stage = {getBoundingClientRect: () => ({left: 0, top: 0, width: W, height: H})};
  const ctx = vm.createContext({
    Math, parseFloat, String, Number, performance: {now: () => 0}, cancelAnimationFrame() {}, requestAnimationFrame() { return 1; },
    prefersReduceMotion: () => true,
    setTimeout: (fn, ms) => { calls.timers.push({fn, ms}); return calls.timers.length; }, clearTimeout() {},
    lvPkLayerPlace: () => { calls.layer++; },
    LV: {
      root: {querySelector: () => stage, getBoundingClientRect: () => ({left: 0, top: 0, width: W, height: H + 100})},
      video: {videoWidth: 1080, videoHeight: 1920, frame, win: {__contentBottom: () => ctx.__B}}, pk: null,
    },
  });
  ctx.__B = B;
  vm.runInContext(cut('function lvPt(X,Y,raw){', 'function lvNotePlace(){') + cut('const LV_PK_GAP=', 'function lvPkClose(answered){'), ctx);
  const go = {hidden: true};      // le bouton « Continuer » : caché tant que la correction n’est pas posée
  const P = {box: {style: {top: top + 'px'}, querySelector: sel => sel === '.lv-pk-go' ? go : null}, busy: false, done: false};
  ctx.LV.pk = P;
  return {ctx, P, go, frame, calls, first: () => vm.runInContext('lvPkFit(LV.pk)', ctx), fit: () => vm.runInContext('lvPkFit(LV.pk, true)', ctx), pt: (X, Y, raw) => vm.runInContext(`lvPt(${X},${Y},${raw ? 1 : 0})`, ctx)};
}

test('le contenu trop près de la feuille : l’image se réduit pour laisser 18 px', () => {
  // 390 × 760 : la feuille monte à 446,3 px, le contenu descend jusqu’à 1381 (474,7 px) : il était recouvert de 28 px
  const p = player();
  assert.ok(p.pt(0, 1381, true).y > 446.3, 'avant : le contenu passe sous la feuille');
  p.fit();
  const z = p.ctx.LV.zoom;
  assert.ok(z < 1 && z > 0.85, `réduction mesurée (${z})`);
  assert.equal(p.frame.style.transform, `scale(${z.toFixed(4)})`, 'l’image est réduite');
  assert.equal(p.frame.style.transformOrigin, '50% 0', 'autour du milieu de son bord haut');
  assert.ok(Math.abs(446.3 - p.pt(0, 1381).y - 18) < 0.1, 'le bas du contenu laisse 18 px avant la feuille');
  assert.ok(p.calls.layer >= 1, 'les zones tactiles suivent');
});

test('assez de place : aucune réduction (grand téléphone)', () => {
  // 430 × 834 : la feuille ne monte pas, le contenu garde 19 px
  const p = player({W: 430, H: 734, B: 1445, top: 1496.1 * 0.3823});
  const before = p.pt(0, 1445).y;
  p.fit();
  assert.equal(p.ctx.LV.zoom == null ? 1 : p.ctx.LV.zoom, 1, 'pas de réduction');
  assert.equal(p.frame.style.transform, undefined, 'l’image n’est pas touchée');
  assert.equal(p.pt(0, 1445).y, before);
});

test('la réduction ne dépasse pas 70 % et ne fait que croître pendant le moment', () => {
  const p = player({top: 100});
  p.fit();
  assert.equal(p.ctx.LV.zoom, 0.7, 'plancher à 70 %');
  const q = player();
  q.fit();
  const z0 = q.ctx.LV.zoom;
  q.ctx.__B = 1100;      // la correction est plus courte : le contenu aurait de la place
  q.fit();
  assert.equal(q.ctx.LV.zoom, z0, 'l’image ne regonfle pas entre la question et la correction');
});

test('la taille de l’écran change : la réduction est recalculée', () => {
  const p = player();
  p.fit();
  const z0 = p.ctx.LV.zoom;
  assert.ok(z0 < 1);
  // le lecteur s’agrandit : même contenu, la feuille a de la place
  p.ctx.LV.root.querySelector = () => ({getBoundingClientRect: () => ({left: 0, top: 0, width: 430, height: 860})});
  p.P.box.style.top = '1000px';
  p.fit();
  assert.equal(p.ctx.LV.zoom, 1, 'retour à la taille normale');
  assert.equal(p.frame.style.transform, '');
});

test('lvPt suit la réduction (zones tactiles, gerbe), sauf pour la place de la feuille', () => {
  const p = player();
  p.fit();
  const a = p.pt(540, 1000), r = p.pt(540, 1000, true);
  assert.ok(Math.abs(a.x - r.x) < 0.01, 'le milieu reste au milieu');
  assert.ok(a.y < r.y, 'le point monte avec le contenu');
  assert.ok(Math.abs(a.s / r.s - p.ctx.LV.zoom) < 1e-9, 'les tailles suivent aussi');
  assert.equal(p.pt(0, 0, true).y, 0, 'sans réduction : repère de l’image entière');
});

test('lecteur : la feuille se place sans réduction, se règle sur le contenu et rend sa taille à l’image à la fermeture', () => {
  const place = cut('function lvPkPlace(){', 'const LV_PK_GAP=');
  assert.ok(place.includes('lvPkFit(P);') && place.indexOf("P.box.style.top=") < place.indexOf('lvPkFit(P);'), 'après avoir posé la feuille');
  const close = cut('function lvPkClose(answered){', 'function lvReplay(){');
  assert.ok(close.includes('lvZoomTo(1);') && close.includes('clearTimeout(P.fitT)'), 'à la fermeture : taille normale, minuterie libérée');
  assert.ok(html.includes('transformOrigin=\'50% 0\''), 'réduction autour du milieu du bord haut');
});

test('moteur des animations : window.__contentBottom, bas du contenu visible sur la maquette 1080 × 1920', () => {
  assert.ok(core.includes('function contentBottom(){') && core.includes('window.renderAt = renderAt;\n  window.__contentBottom = contentBottom;'),
    'exposé par le moteur, avec renderAt');
  const body = core.slice(core.indexOf('function contentBottom(){'), core.indexOf('/* ---------- Le cours ---------- */'));
  for (const part of ["$$('.card, .code', stage).forEach(take);", "$$('section.scene > *', stage).forEach(el => { if (isBox(el)) take(el); });",
    "$$('section.scene > .pack > span', stage).forEach(take);",
    "el.closest('#cap, #chapter, #chap') || shown(el) < 0.3", "(r.bottom - sr.top) / k"])
    assert.ok(body.includes(part), `mesure : ${part}`);
  assert.ok(body.includes("!el.classList.contains('stamp') && !el.classList.contains('fly')"), 'ni tampon ni ce qui s’envole');
});

test('les pastilles centrées (« 6 situations à ranger »…) comptent comme du contenu : le conteneur .pack est transparent, la pastille (span) porte le cadre', () => {
  /* Elisa, 25 octobre, 15 h 48 : au dernier moment du chapitre 10, la feuille de réponse recouvrait la pastille « 6 situations à ranger ». */
  for (const f of ['projet-insert', 'projet-update', 'projet-delete', 'projet-ondelete', 'projet-transaction', 'projet-savepoint']) {
    const page = fs.readFileSync(path.join(root, `assets/anim/${f}.html`), 'utf8');
    const pills = [...page.matchAll(/<div class="abs pack" id="([^"]+)"><span>/g)];
    assert.ok(pills.length >= 1, `${f} : au moins une pastille .pack, un span directement dedans`);
    assert.ok(/\.pack\{[^}]*\}/.test(page) && !/\.pack\{[^}]*(background|border|box-shadow)/.test(page), `${f} : le conteneur .pack n’a ni fond ni cadre`);
    assert.ok(/\.pack>span\{[^}]*background:#fff;border:3px solid[^}]*box-shadow/.test(page), `${f} : le cadre est sur la pastille .pack>span`);
  }
});

const zoomOf = p => p.ctx.LV.zoom == null ? 1 : p.ctx.LV.zoom;
const lastTimer = p => p.calls.timers[p.calls.timers.length - 1];

test('question : seules comptent la mesure de l’ouverture et celles posées 400 ms après le dernier changement', () => {
  // ouverture : la feuille manque de place, l’image se réduit tout de suite
  const p = player();
  p.first();
  const z0 = zoomOf(p);
  assert.ok(z0 < 1, 'réduite dès l’ouverture');
  assert.equal(p.calls.timers.length, 1);
  assert.equal(p.calls.timers[0].ms, 400, 'une mesure posée est programmée');
  // un changement du plateau passe par un état qui ne dure pas : il n’est pas pris en compte
  p.P.box.style.top = '380px';
  p.first();
  assert.equal(zoomOf(p), z0, 'état de passage ignoré');
  assert.equal(p.calls.timers.length, 2, 'la mesure posée est reprogrammée');
  // le plateau est posé : la mesure du moment compte
  lastTimer(p).fn();
  assert.ok(zoomOf(p) < z0, 'la mesure posée est prise en compte');
});

test('réponse en cours : rien n’est mesuré, ni l’étiquette qui vole, ni la bonne réponse sans sa correction', () => {
  // grand écran : le contenu tient avec le plateau de la question à sa place
  const p = player({W: 430, H: 734, B: 1288, top: 1421 * 0.3823});
  p.first();
  assert.equal(zoomOf(p), 1);
  // la page anime son résultat pendant que la feuille est encore la haute feuille de la question
  p.P.busy = true;
  p.P.box.style.top = String(1230 * 0.3823) + 'px';
  p.first();
  lastTimer(p).fn();
  assert.equal(zoomOf(p), 1, 'pas de mesure pendant la réponse');
  assert.equal(p.frame.style.transform, undefined, 'l’image n’est pas touchée');
  const n = p.calls.timers.length;
  assert.ok(n >= 2 && p.calls.timers[n - 1].ms === 400, 'la mesure est reprogrammée tant que l’état ne s’est pas posé');
  // bonne réponse donnée, correction pas encore posée (réponses encore là, pas de « Continuer »)
  p.P.busy = false; p.P.done = true; p.go.hidden = true;
  lastTimer(p).fn();
  assert.equal(zoomOf(p), 1, 'pas de mesure avant la correction');
  assert.ok(p.calls.timers.length > n, 'toujours reprogrammée');
  // correction posée : la feuille a retrouvé sa place, l’image n’a pas bougé
  p.go.hidden = false;
  p.P.box.style.top = String(1421 * 0.3823) + 'px';
  p.first();
  assert.equal(zoomOf(p), 1, 'la correction posée tient sous l’image');
  assert.equal(p.frame.style.transform, undefined);
});

test('bonne réponse : l’image se règle sur la correction, qui est plus courte, et reprend sa taille', () => {
  // question longue sur écran étroit : l’image est réduite
  const p = player();
  p.first();
  const z0 = zoomOf(p);
  assert.ok(z0 < 1);
  // la bonne réponse : la correction remplace les réponses, la feuille descend ; l’état de passage est ignoré, la correction posée est mesurée aussitôt
  p.P.busy = true; p.first();
  assert.equal(zoomOf(p), z0, 'rien pendant la réponse');
  p.P.busy = false; p.P.done = true; p.go.hidden = false;
  p.P.box.style.top = '520px';
  p.first();
  assert.equal(zoomOf(p), 1, 'la correction laisse la place : taille normale');
  assert.equal(p.frame.style.transform, '');
  // un état tardif de la page (un cadre qui arrive) est repris par la dernière mesure
  p.ctx.__B = 1560;
  lastTimer(p).fn();
  assert.ok(zoomOf(p) < 1, 'la dernière mesure compte aussi');
});

test('la correction posée est mesurée aussitôt, puis une dernière fois 400 ms plus tard', () => {
  const p = player();
  p.first();
  p.P.done = true; p.go.hidden = false;
  p.P.box.style.top = '520px';
  const n = p.calls.timers.length;
  p.first();
  assert.equal(zoomOf(p), 1, 'mesurée aussitôt');
  assert.ok(p.calls.timers.length > n && lastTimer(p).ms === 400, 'une dernière mesure est programmée');
});
