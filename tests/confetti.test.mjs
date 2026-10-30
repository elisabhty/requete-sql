/* Confettis dans les vidéos (Elisa, 26 octobre, 7 h 18, Réf 6) : « quand on appuie sur les boutons pour lancer requête ou triggers etc et
   que c’est pas une erreur ensuite mettre des confettis ».
   La page annonce les confettis comme un son (repère « confetti » des cues, avec la position du bouton sur la scène 1080 × 1920) ; le lecteur
   de l’app les lance en direct par-dessus l’image, si bien qu’une pause de lecture ne les fige jamais en l’air. Un bouton pressé par la
   timeline (press) en reçoit d’office, sauf échec : un son d’échec juste après, un message d’erreur ou une valeur fautive qui apparaît, un
   essai d’un encadré piège sans son de réussite ; un premier essai que la suite montre insuffisant n’en reçoit pas non plus. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const core = read('assets/anim/core.js'), html = read('index.html');
const anim = f => read(`assets/anim/${f}`);

/* Le jugement des appuis (confettiCues), joué avec une timeline et une scène simulées. */
function engine({cues = [], errors = []} = {}) {
  let now = 0;
  const el = (x, y, trap = false) => ({x, y, closest: s => (s === '.trap' && trap ? {} : null)});
  const errEls = errors.map(e => ({from: e.from, parentElement: null, getBoundingClientRect: () => ({width: 120, height: 40})}));
  const ctx = vm.createContext({
    Math, Set, Number,
    document: {body: {}},
    tl: {seek(t) { now = t; }},
    $: () => ({}),
    $$: () => errEls,
    getComputedStyle: n => ({display: 'block', visibility: now >= n.from ? 'visible' : 'hidden', opacity: '1'}),
    rel: e => ({x: e.x, y: e.y, w: 100, h: 50}),
    CUES: cues.map(c => ({gain: 1, pitch: 0, ...c}))
  });
  const a = core.indexOf('const CONFETTI = [];'), b = core.indexOf('/* Frappe :');
  assert.ok(a > 0 && b > a, 'bloc des confettis');
  vm.runInContext(core.slice(a, b) + ';this.CONFETTI = CONFETTI; this.confetti = confetti; this.run = confettiCues;', ctx);
  const pressed = (e, t, force = false) => ctx.CONFETTI.push({el: e, t, press: true, force});
  return {ctx, el, pressed, out: () => ctx.CUES.filter(c => c.type === 'confetti').map(c => [c.t, c.x, c.y])};
}

test('un appui réussi annonce des confettis, juste après ; un échec n’en a pas', () => {
  const E = engine({
    cues: [{t: 10.3, type: 'error'}, {t: 20.4, type: 'tick'}, {t: 20.9, type: 'chord'}, {t: 30.4, type: 'tick'}, {t: 40.4, type: 'tick'}, {t: 60.3, type: 'miss'}, {t: 90.25, type: 'empty'}],
    errors: [{from: 50.8}, {from: 70}]
  });
  E.pressed(E.el(100, 200), 10);            // erreur juste après
  E.pressed(E.el(100, 200), 20);            // un son de réussite : les confettis partent avec lui
  E.pressed(E.el(300, 400), 30);            // rien d’échoué : 0,5 s après l’appui
  E.pressed(E.el(100, 200, true), 40);      // essai d’un encadré piège, sans son de réussite
  E.pressed(E.el(100, 200), 50);            // un message d’erreur apparaît
  E.pressed(E.el(500, 600), 60, true);      // forcé (press(…, true)) : le son des lignes supprimées n’est pas un échec
  E.ctx.confetti(E.el(700, 800), 75);       // un bouton que l’élève touche (opens) : à l’instant donné
  E.pressed(E.el(100, 200), 80);            // l’erreur affichée avant l’appui ne compte pas : elle n’apparaît pas à cause de lui
  E.pressed(E.el(100, 200), 90);            // résultat vide
  E.ctx.run();
  assert.deepEqual(E.out(), [[20.9, 150, 225], [30.5, 350, 425], [60.5, 550, 625], [75, 750, 825], [80.5, 150, 225]],
    'instant (vidéo de la timeline) et centre du bouton sur la scène');
});

test('le moteur : press note l’appui (sauf false), Course juge les appuis une fois la timeline construite', () => {
  assert.ok(core.includes("function press(btn, t, lip = '#4B30CC', depth = 9, conf){"), 'press(…, conf)');
  assert.ok(core.includes("if (conf !== false) CONFETTI.push({el: btn, t, press: true, force: conf === true});"), 'false : jamais ; true : toujours');
  assert.ok(core.includes("const FAIL_CUES = new Set(['error', 'empty', 'false', 'miss', 'buzz']), OK_CUES = new Set(['chord', 'success']);"));
  assert.ok(core.includes("cfg.build();\n    let rest = [];\n    if (RECAP_A != null) { duration = recapEnd(RECAP_A, duration); captions = captions.filter(c => c[0] < duration - 0.3); rest = recapRest(captions, duration); }\n    tl.set({}, {}, duration);\n    confettiCues();"), 'jugés après la construction (et après la fin de la vidéo, avant « À retenir »)');
  assert.ok(core.includes("const fails = () => new Set($$('.err, .emp, .ko, .bad', stage).filter(seen));"), 'message d’erreur, résultat vide, ligne écartée, valeur fautive');
  assert.ok(core.includes("out.push({t: +at.toFixed(3), type: 'confetti', gain: 1, pitch: 0, x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2)});"), 'un repère comme un son, avec sa position');
  assert.ok(core.includes('cues: CUES.filter(c => !inCut(c.t)).map(c => Object.assign({}, c, {t: unwarp(c.t)}))'), 'exportés avec les sons (position comprise), en temps de la vidéo');
});

test('le lecteur : le repère « confetti » lance une gerbe par-dessus l’image, à la place d’un son', () => {
  assert.ok(html.includes("if(c.t>this.t){ if(c.type==='confetti')lvConfetti(this.frame,c); else LvSfx.play("), 'jamais joué comme un son');
  assert.ok(html.includes('.lv-confetti{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}'), 'par-dessus l’image, sans retenir le doigt');
  const a = html.indexOf('function lvConfetti(frame,c){'), b = html.indexOf('/* Leçon en vidéo : la vidéo est son cours');
  assert.ok(a > 0 && b > a);
  const pieces = [], layer = {children: pieces, appendChild: p => pieces.push(p), className: '', setAttribute() {}, remove() { layer.removed = true; }};
  let timer = null, reduce = false;
  const root = {appendChild: l => { root.layer = l; }};
  const ctx = vm.createContext({
    Math,
    prefersReduceMotion: () => reduce,
    LV: {root},
    setTimeout: (f, ms) => { timer = {f, ms}; },
    document: {createElement: tag => tag === 'div' ? layer : {style: {}, animate(k, o) { this.k = k; this.o = o; }}}
  });
  vm.runInContext(html.slice(a, b) + ';this.go = lvConfetti;', ctx);
  /* L’image réduite à 90 % (lvPkFit) dans un cadre de 390 px ; la scène 1080 × 1920 tient dans 390 × 693,3 px, 50 px sous le haut du cadre. */
  const frame = {offsetWidth: 390, getBoundingClientRect: () => ({left: 10, top: 20, width: 351, height: 700}),
    contentDocument: {getElementById: () => ({getBoundingClientRect: () => ({left: 0, top: 50, width: 390, height: 693.3})})}};
  ctx.go(frame, {x: 540, y: 960});
  assert.equal(root.layer, layer, 'la couche est posée dans le lecteur');
  assert.equal(pieces.length, 46, '46 confettis, comme la requête à trous réussie');
  const k = 390 / 1080, z = 351 / 390;
  assert.equal(pieces[0].style.cssText.match(/left:([\d.]+)px/)[1] * 1, +(10 + 540 * k * z).toFixed(10), 'partis du bouton (x)');
  assert.ok(Math.abs(pieces[0].style.cssText.match(/top:([\d.]+)px/)[1] - (20 + (50 + 960 * k) * z)) < 1e-6, 'partis du bouton (y)');
  assert.ok(pieces.every(p => p.o && p.o.fill === 'forwards' && p.o.duration >= 1400 && p.o.duration <= 1900), 'une gerbe d’une seconde et demie environ');
  assert.equal(timer.ms, 2300); timer.f(); assert.ok(layer.removed, 'puis la couche s’en va');
  reduce = true; pieces.length = 0; root.layer = null;
  ctx.go(frame, {x: 540, y: 960});
  assert.equal(root.layer, null, 'mouvements réduits : pas de confettis');
});

test('les chapitres du projet : les boutons touchés par l’élève qui réussissent', () => {
  const trig = anim('projet-trigger.html');
  assert.ok(trig.includes("confetti($('#bcre'), CRE + 0.6);") && trig.includes("confetti($('#bmod'), MOD + 0.85);"), 'chapitre 16 : « Créer le trigger », « Modifier le prix »');
  const cc = anim('projet-concurrence.html');
  assert.ok(cc.includes("const pressPhone = (p, t) => press($(`#${p}-0`), t, '#4B30CC', 7, false);"), 'chapitre 17 : ni la double réservation, ni l’atelier complet');
  assert.ok(cc.includes("confetti($('#pl-3'), A.e9 + 0.85);"), '… mais la place de Léa Simon, réservée avec le verrou');
  const vw = anim('projet-vue.html');
  assert.ok(vw.includes("confetti($('#bcre'), CRE + 0.6);") && vw.includes("confetti($('#bexe'), EXE1 + 0.6);") && vw.includes("confetti($('#bexe'), EXE2 + 0.6);"),
    'chapitre 18 : « Créer la vue », puis « Exécuter », deux fois');
  const ix = anim('projet-index.html');
  assert.ok(ix.includes("confetti($('#bexp'), EXE1 + 0.6);") && ix.includes("confetti($('#bcix'), CIX + 0.6);") && ix.includes("confetti($('#bexp'), EXE2 + 0.6);"),
    'chapitre 19 : « Exécuter » (le plan), « Créer l’index », puis « Exécuter » (le nouveau plan)');
  const dr = anim('projet-droits.html');
  assert.ok(dr.includes("confetti($('#bs1'), EXE1 + 0.6);") && dr.includes("confetti($('#bs2'), EXE2 + 0.6);") && dr.includes("confetti($('#bs3'), EXE3 + 0.6);"),
    'chapitre 20 : « Simuler », trois fois (GRANT SELECT, GRANT UPDATE (statut), les deux REVOKE)');
  assert.ok(dr.includes("press($('#psv'), A.ea + 0.5, '#A3216A', 6, false);") && dr.includes("press($('#apb'), A.d5 + 1.6, '#0F6B33', 6);"),
    '… pas pour la modification du prix, refusée ; mais pour le colis de Léa Simon, expédié');
  assert.ok(fs.readFileSync(path.join(root, 'assets/anim/fin-sql.html'), 'utf8').includes("confetti($('#fin'), G4 + 0.5);"), '… et la fin du projet');
  const tx = anim('projet-transaction.html');
  assert.ok(tx.includes("confetti($('#bcom'), COM + 0.95);") && tx.includes("confetti($('#brol'), ROL + 0.95);") && !tx.includes("confetti($('#bhow')"), 'chapitre 13 : COMMIT et ROLLBACK, pas « Comment éviter ça ? »');
  const sp = anim('projet-savepoint.html');
  assert.ok(sp.includes("confetti($('#bsav'), SAV + 0.35);") && sp.includes("confetti($('#bval'), VAL + 1.27);"), 'chapitre 14 : retour au savepoint, validation');
  const od = anim('projet-ondelete.html');
  assert.ok(od.includes("press($('#bdel'), BTN, '#A92A31', 9, false);"), 'chapitre 12 : le lien de l’avis se brise, pas de confettis');
  /* CASCADE au chapitre 5, puis SET NULL sur le site (chapitre 8) : SET NULL n’est plus joué avant le choix de l’élève (27 octobre). */
  for (const t of ["A.e5 + 0.9", "A.g1 + 0.6"]) assert.ok(od.includes(`press($('#bdel'), ${t}, '#A92A31', 9, true);`), `chapitre 12 : la suppression réussit (${t})`);
});

test('les autres vidéos : ni la récursion sans fin, ni le site d’avant la requête, ni les premiers essais insuffisants', () => {
  assert.ok(anim('with-recursive.html').includes("press($('#r3'), 110.4, '#4B30CC', 9, false);"), 'WITH RECURSIVE : la requête sans condition d’arrêt ne s’arrête jamais');
  assert.ok(anim('limit-offset.html').includes("tapMore('#ph1', 10.4, false);"), 'LIMIT : le site tel que l’équipe le veut, avant la requête');
  const essais = ['as', 'case', 'coalesce', 'conversion-types', 'count', 'distinct', 'fenetres-glissantes', 'fonctions-dates', 'fonctions-numeriques', 'fonctions-texte',
    'group-by', 'group-concat', 'having', 'inner-join', 'left-join', 'like', 'not', 'null', 'order-by', 'plusieurs-conditions-on', 'right-join', 'over', 'fonctions-rang'];
  for (const f of essais) assert.equal(anim(`${f}.html`).split(", '#4B30CC', 9, false);   // premier essai, que la suite montre insuffisant : pas de confettis").length - 1, 1, `${f} : son premier essai`);
  /* WHERE a son propre moteur : la page pose elle-même ses confettis. */
  const where = anim('where.html');
  assert.ok(where.includes("confetti($('#s4run'), 51.35);") && where.includes("confetti($('#s6run'), te + 0.8);") && !where.includes("confetti($('#s2run')"), 'WHERE : après WHERE et le résultat, pas le premier essai');
  assert.ok(/  build\(\);\n  applyMoments\(\);\n[^]*?\n  confettiCues\(\);\n  renderAt\(0\);/.test(where), 'WHERE : posés une fois la timeline construite (et ses moments « À toi » insérés)');
});
