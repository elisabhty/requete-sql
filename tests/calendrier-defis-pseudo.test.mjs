/* Elisa, 31 octobre, 8 h 06 : six retours.
   Réf 1 « les activités terminées ne doivent pas être retirées du calendrier, mais bien voir qu’elles ont été validées » ;
   Réf 2 « enlever les stickers ici » (Avancement global) ;
   Réf 3 « pouvoir scroller même quand on est sur la barre du bas de nav » ;
   Réf 4 « avoir un tableau de performance pour la page défis + le trait est grossier » ;
   Réf 5 « le pseudo doit déjà être défini avant, dans l’onboarding (inscription) » ;
   Réf 6 « pour cette page (le chargement), fais un truc de chargement ou mets-le en dessous ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const s46 = css.slice(css.indexOf('/* ---------- 46.'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
/* Une fonction déclarée deux fois (l’ancien onboarding est resté plus haut) : c’est la dernière qui compte. */
const fnLast = name => { const a = app.lastIndexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };
const plain = v => JSON.parse(JSON.stringify(v));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('réf 1 — le calendrier garde les activités validées, au jour de leur validation', () => {
  assert.ok(fn('markDone').includes('if(!cur.at) cur.at=Date.now();'), 'la validation note son jour, une seule fois');
  assert.ok(app.includes('if(entry.done&&Number.isFinite(atVal)&&atVal>0) entry.at=atVal;'), 'la sauvegarde garde ce jour');
  assert.ok(!app.includes("plur(p.archive.length,'activité')"), 'plus de « … déjà terminées ont été retirées du calendrier »');
  const ctx = vm.createContext({});
  vm.runInContext(cut('function nettoyerPlan(', 'function migrerPlan(') + cut('function isDefiId(', 'function itemMeta(') + cut('function trierSessions(', 'function sessionDe('), ctx);
  const today = new Date(2026, 9, 31);
  Object.assign(ctx, {
    allLessons: [0, 1, 2, 3, 4, 5].map(id => ({ id })), NIVEAUX: [{ k: 'debutant', from: 0 }], leconsDepuis: () => [0, 1, 2, 3, 4, 5],
    parseItemId: x => x, dstr: d => iso(new Date(d)), auj: () => new Date(today), addJ: (d, n) => new Date(d.getTime() + n * 864e5),
    parseD: s => new Date(s + 'T00:00:00'), CHALLENGES: [], INTERVALS: [1, 3, 7, 21, 60], DAY: 864e5, saved: 0,
  });
  ctx.save = () => { ctx.saved++; };
  /* Un ancien planning : 0 et 2 validées puis retirées dans l’archive ; 5 aussi, mais recommencée depuis */
  ctx.state = { defis: {}, lessons: { 0: { done: true, at: +new Date(2026, 9, 27, 18) }, 2: { done: true, at: +new Date(2026, 9, 29, 9) }, 5: { done: false } },
    plan: { niveau: 'debutant', per: 3, archive: [0, 2, 5], sessions: [{ d: '2026-10-31', lessons: [3, 4] }] } };
  vm.runInContext('nettoyerPlan()', ctx);
  const plan = plain(ctx.state.plan);
  assert.deepEqual(plan.archive, [], 'plus d’archive');
  assert.deepEqual(plan.sessions, [
    { d: '2026-10-27', lessons: [0] }, { d: '2026-10-29', lessons: [2] },
    { d: '2026-10-31', lessons: [3, 4, 1] }, { d: '2026-11-01', lessons: [5] }],
  'les validées reviennent au jour de leur validation ; celle qui ne l’est plus repart dans le planning, avec la leçon manquante');
  assert.equal(ctx.saved, 1);
  vm.runInContext('nettoyerPlan()', ctx);
  assert.equal(ctx.saved, 1, 'deuxième passage : rien ne bouge');
  /* Validée sans date (avant ce relevé) : son jour de séance s’il est passé, jamais dans le futur */
  assert.equal(vm.runInContext("itemDoneDay(9,'2026-10-20')", Object.assign(ctx, { state: { lessons: { 9: { done: true } } } })), '2026-10-20');
  assert.equal(vm.runInContext("itemDoneDay(9,'2026-11-04')", ctx), '2026-10-31', 'une séance à venir : aujourd’hui');
  assert.deepEqual(plain(vm.runInContext("planMergeSessions([{d:'2026-11-02',lessons:[4]},{d:'2026-10-30',lessons:[1]}],[{d:'2026-11-02',lessons:[4,7]}])", ctx)),
    [{ d: '2026-10-30', lessons: [1] }, { d: '2026-11-02', lessons: [4, 7] }], 'réunies jour par jour, sans doublon');
  for (const f of ['decalerPlanning', 'planAdjustCommit']) assert.ok(fn(f).includes('p.sessions=planMergeSessions(planAnchorDone(p,'), f + ' : les validées restent au calendrier');
});

test('réf 3 — un glissement vertical sur la barre d’onglets fait défiler l’écran ; un toucher change toujours d’onglet', () => {
  assert.ok(cut('async function boot(){', 'function initSpotlight(){').includes('try{lqTabbarScroll();}catch(e){}'), 'branché au démarrage');
  let now = 0; const rafs = [];
  const handlers = {}, screen = { scrollTop: 0 };
  const bar = { dataset: {}, addEventListener: (t, f, o) => { handlers[t] = { f, o }; } };
  const ctx = vm.createContext({
    document: { querySelector: sel => sel === '#app>.tabbar' ? bar : sel === '#app>.stage .screen.active' ? screen : null },
    performance: { now: () => now }, Date: { now: () => now }, requestAnimationFrame: f => { rafs.push(f); return rafs.length; }, cancelAnimationFrame() {},
    prefersReduceMotion: () => false,
  });
  vm.runInContext(fn('lqTabbarScroll') + ';lqTabbarScroll();', ctx);
  assert.equal(handlers.touchmove.o.passive, false, 'le glissement est pris en main (preventDefault)');
  assert.equal(handlers.click.o, true, 'le clic est intercepté en capture');
  const touch = (t, x, y) => { let prevented = false; handlers[t].f({ touches: y == null ? [] : [{ clientX: x, clientY: y }], cancelable: true, preventDefault: () => { prevented = true; } }); return prevented; };
  touch('touchstart', 200, 800);
  for (let i = 1; i <= 8; i++) { now += 16; assert.equal(touch('touchmove', 200, 800 - i * 25), i * 25 >= 8, 'au-delà de 8 px, le geste est pris'); }
  assert.equal(screen.scrollTop, 200, 'l’écran suit le doigt');
  now += 16; touch('touchend', 0, null);
  let stopped = false;
  now += 10; handlers.click.f({ preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.ok(stopped, 'le glissement n’ouvre pas l’onglet sous le doigt');
  for (let i = 0; i < 40 && rafs.length; i++) { now += 16; rafs.shift()(now); }
  assert.ok(screen.scrollTop > 260, 'l’élan continue le défilement : ' + screen.scrollTop);
  now += 1000; stopped = false;
  touch('touchstart', 100, 800); now += 30; touch('touchend', 0, null);
  handlers.click.f({ preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.ok(!stopped, 'un simple toucher change d’onglet');
  /* Un glissement horizontal (la barre défile sur un petit écran) n’est pas pris */
  touch('touchstart', 100, 800);
  assert.equal(touch('touchmove', 160, 790), false, 'horizontal : la barre défile normalement');
});

const SALLE = { pts: 2316, parties: 8, best: 512, manches: 18, trouves: 14, tms: 14 * 83000, fast: 38000, amis: 5, pl: [2, 1, 1],
  lv: { f: [6, 6], m: [8, 6], d: [4, 2] },
  hist: [
    { at: Date.now() - 36e5, pts: 412, n: 3, ok: 3, ms: 201000, niv: 'm', solo: 0, place: 1, players: 3 },
    { at: Date.now() - 864e5, pts: 186, n: 1, ok: 1, ms: 72000, niv: 'f', solo: 1, place: 0, players: 1 },
    { at: Date.now() - 864e5 - 5000, pts: 0, n: 1, ok: 0, ms: 0, niv: 'd', solo: 1, place: 0, players: 1 },
    { at: Date.now() - 2 * 864e5, pts: 512, n: 3, ok: 3, ms: 240000, niv: 'm', solo: 0, place: 1, players: 4 },
    { at: Date.now() - 3 * 864e5, pts: 230, n: 3, ok: 2, ms: 190000, niv: 'f', solo: 0, place: 2, players: 2 }] };

function perfCtx(salle) {
  const host = { innerHTML: '', get firstElementChild() { return null; } };
  const ctx = vm.createContext({
    document: { getElementById: id => id === 'defis-perf' ? host : null }, state: { salle },
    JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, lqStkSvg: k => `<svg data-k="${k}"></svg>`, perfReveal() {}, Date, Math,
    jeuInitial: n => String(n || '?').trim().charAt(0).toUpperCase(), JEU_FRIENDS_SVG: '<svg data-k="friends"></svg>', DEF_CHEV_SVG: '<svg data-k="chev"></svg>',
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    /* Le Top 5 de tous les joueurs a ses propres tests (classement.test.mjs) */
    clsTopHTML: () => '', clsFlush() {}, clsCharger() {},
  });
  vm.runInContext(fn('jeuChrono') + fn('perfDay') + fn('perfWith') + fn('perfGame') + fn('perfBadge') + fn('perfColor') + fn('perfPodiumHTML') + fn('perfMateHTML') + fn('renderDefisPerf') + ';renderDefisPerf();', ctx);
  return host.innerHTML;
}

test('réf 4 — « Tes performances » : les chiffres, la réussite, les temps, les dernières parties, les niveaux, les podiums, l’historique', () => {
  assert.ok(app.includes('<div id="defis-room"></div>\n      <div id="defis-perf"></div>'), 'sous la salle');
  assert.ok(fn('renderDefis').includes('renderDefisRoom();renderDefisPerf();renderDefisJoin();renderDefisRules();'));
  const h = perfCtx(SALLE);
  assert.match(h, /<h2 id="perf-h">Tes performances<\/h2>/);
  assert.match(h, /class="perf-kpi is-sun" style="--i:0"><b data-count-to="2316"[^>]*>2316<\/b><small>points<\/small>/, 'les points, en jaune soleil, qui montent');
  assert.match(h, /data-count-to="8"[^>]*>8<\/b><small>parties<\/small>/);
  assert.match(h, /data-count-to="512"[^>]*>512<\/b><small>record<\/small>/);
  assert.match(h, /data-count-to="78"[^>]*>78\u202f%<\/b>/, 'réussite : 14 manches trouvées sur 18');
  assert.ok(h.includes('<small>14 manches trouvées sur 18</small>'));
  assert.ok(h.includes('<small>Temps moyen</small><b>01:23</b>') && h.includes('<small>Le plus rapide</small><b>00:38</b>'));
  const bars = h.match(/class="perf-bar[^"]*"/g);
  assert.equal(bars.length, 5, 'une barre par partie');
  assert.equal(bars.filter(b => b.includes('is-best')).length, 1, 'la meilleure partie en jaune');
  assert.ok(bars[1].includes('is-best') && bars[4].includes('is-on'), 'de la plus ancienne à la plus récente ; la dernière choisie');
  assert.match(h, /<p class="perf-cap" aria-live="polite">Aujourd’hui · Entre amis · Moyen · 3 joueurs · 412 points<\/p>/);
  assert.ok(h.includes('<li class="is-f" style="--i:0"><b>Facile</b><span class="perf-lvbar"><i style="--w:100%"></i></span><em>6/6</em></li>'));
  assert.ok(h.includes('<em>6/8</em>') && h.includes('--w:75%') && h.includes('<em>2/4</em>'));
  assert.ok(h.includes('<b>2</b><small>1re place</small>') && h.includes('Sur 5 parties entre amis.'), 'les podiums entre amis');
  const rows = h.match(/<li style="--i:\d"><span class="perf-rk/g);
  assert.equal(rows.length, 4, 'les quatre dernières parties');
  assert.ok(h.includes('<span class="perf-rk is-medal"><svg data-k="medal1"></svg></span><span class="perf-g"><b>Entre amis · Moyen · 3 joueurs</b><small>Aujourd’hui · 3/3 trouvés · 03:21</small></span><em>+412</em>'), 'la médaille autocollante, et le nombre de joueurs quand les pseudos ne sont pas connus');
  assert.ok(h.includes('<span class="perf-rk">0/1</span>') && h.includes('<span class="perf-rk">✓</span>'), 'seul : coché, ou trouvés sur joués');
  /* Avant la première partie : le même tableau, vide, qui dit ce qui s’y affichera */
  const e = perfCtx({ pts: 0, parties: 0, best: 0 });
  assert.ok(e.includes('perf-card is-empty') && e.includes('<b>—</b><small>record</small>') && e.includes('perf-chart is-ghost'));
  assert.ok(e.includes('Joue ta première partie : tes points s’afficheront ici, partie après partie.'));
  assert.ok(!e.includes('Réussite par niveau') && !e.includes('Historique'), 'pas de blocs vides');
  /* Les parties jouées avant ce tableau : les chiffres connus, le reste viendra */
  const l = perfCtx({ pts: 541, parties: 3, best: 209 });
  assert.ok(l.includes('>541</b>') && l.includes('Tes prochaines parties s’afficheront ici, en barres.') && !l.includes('Réussite par niveau'));
  /* L’arrivée à l’écran anime, une fois ; mouvement réduit : tout est là d’emblée */
  const rv = fn('perfReveal');
  assert.ok(rv.includes("new IntersectionObserver(") && rv.includes("card.classList.add('is-in');actCountUp(card);") && rv.includes("card.classList.add('is-in','is-static');actCountUp(card,true);"));
  assert.ok(fn('perfPick').includes("cap.textContent=b.dataset.cap||'';"), 'toucher une barre la détaille');
  for (const part of ['html.lq .perf-card.is-in .perf-bar i{transform:scaleY(1)}', 'html.lq .perf-card.is-in .perf-ring{stroke-dashoffset:var(--v)}',
    'html.lq .perf-card.is-in .perf-lvbar i{transform:scaleX(1)}', 'html.lq .perf-chart{position:relative;isolation:isolate;overflow:hidden;',
    'html.lq .perf-card.is-static *,html.lq .perf-card.is-static *::after{animation:none!important;transition:none!important}'])
    assert.ok(s46.includes(part), part);
  assert.ok(!/perf-[a-z-]+\{[^}]*dashed/.test(s46), 'aucun pointillé dans le tableau');
});

test('réf 4 — « le trait est grossier » : le contour ne cerne plus l’en-tête violet, la pastille choisie reste dans son rail', () => {
  assert.ok(s46.includes('html.lq .room-card{border:0!important;padding:0 18px 18px!important;box-shadow:inset 0 0 0 2px var(--line),0 5px 0 var(--lip)!important}'), 'le contour passe sous l’en-tête');
  assert.ok(s46.includes('html.lq .room-head{margin:0 -18px 4px;'), 'l’en-tête va jusqu’au bord');
  assert.ok(s46.includes('html.lq .room-seg{padding:4px 4px 7px!important}'), 'le relief de la pastille tient dans le rail');
  assert.ok(!app.includes('room-stats') && !css.includes('room-stats'), 'plus de pastilles sous un pointillé épais');
});

test('réf 4 — chaque partie nourrit le tableau ; la sauvegarde le garde propre', () => {
  const credit = fn('jeuCreditGame');
  for (const part of ['s.manches=(s.manches||0)+played.length;s.trouves=(s.trouves||0)+mine.length;s.tms=(s.tms||0)+ms;',
    'if(vs){s.amis=(s.amis||0)+1;if(place>=1&&place<=3&&pts>0)', "lv[k]=[(l[0]||0)+played.length,(l[1]||0)+mine.length];", '.concat(Array.isArray(s.hist)?s.hist:[]).slice(0,12);'])
    assert.ok(credit.includes(part), part);
  const ctx = vm.createContext({});
  vm.runInContext(cut('function normalizeState(', 'function normalize('), ctx);
  const st = ctx.normalizeState({ salle: { pts: 30, parties: 2, best: 20, manches: 3, trouves: 9, tms: -4, fast: 'x', amis: 1, pl: [1, 'a'], lv: { f: [3, 5], z: [1, 1] },
    hist: [{ at: 10, pts: 5, n: 2, ok: 7, niv: 'q', solo: 1 }, 'x', { at: 0, n: 1 }, { at: 20, pts: 9, n: 1, ok: 1, niv: 'd', place: 2, players: 3 }] } }).salle;
  assert.deepEqual(plain(st), { pts: 30, parties: 2, best: 20, manches: 3, trouves: 3, tms: 0, fast: 0, amis: 1, pl: [1, 0, 0],
    lv: { f: [3, 3], m: [0, 0], d: [0, 0] },
    hist: [{ at: 20, pts: 9, n: 1, ok: 1, ms: 0, niv: 'd', solo: 0, place: 2, players: 3 }, { at: 10, pts: 5, n: 2, ok: 2, ms: 0, niv: 'f', solo: 1, place: 0, players: 1 }], mates: {} });
  assert.deepEqual(plain(ctx.normalizeState({}).salle), { pts: 0, parties: 0, best: 0, manches: 0, trouves: 0, tms: 0, fast: 0, amis: 0, pl: [0, 0, 0], lv: { f: [0, 0], m: [0, 0], d: [0, 0] }, hist: [], mates: {} });
});

test('réf 5 — le pseudo se choisit dans l’onboarding, et la salle ne le redemande plus', () => {
  const ob = cut("}else if(slide==='name'){", "}else if(slide==='goal'){");
  assert.ok(ob.includes('<span>Ton pseudo <small class="ob-field-opt">prénom ou surnom</small></span>') && ob.includes('maxlength="16"') && ob.includes('required aria-required="true"'));
  assert.ok(ob.includes('celui que tes amis voient dans les salles de défi'), 'on dit à quoi il sert');
  assert.ok(ob.includes("obSetFooter('Continuer',()=>{if(jeuNom(draft.name))obGoto('goal');},'','','Un surnom suffit : pas besoin de ton vrai nom',!jeuNom(draft.name));"), 'l’étape n’est plus facultative');
  assert.ok(!ob.includes('Passer pour le moment'));
  assert.ok(fn('obInput').includes("if(next&&OB_SLIDES[obStep]==='name')next.disabled=!jeuNom(draft.name);"), '« Continuer » s’allume dès qu’un pseudo est tapé');
  assert.ok(fnLast('finishOnboard').includes("if(n)localStorage.setItem('rq-jeu-nom',n);"), 'le pseudo de l’onboarding devient celui de la salle');
  assert.ok(fn('saveAccountName').includes("localStorage.setItem('rq-jeu-nom',n);else localStorage.removeItem('rq-jeu-nom');"), 'Mon compte change le même pseudo');
  for (const id of ['jeu-nom', 'jeu-nom-join', 'jeu-nom-defi']) assert.ok(app.includes(`\${jeuNomField('${id}')}`), id);
  assert.ok(!app.includes('<label class="jeu-lab" for="jeu-nom">Ton pseudo</label>'), 'plus de champ vide dans la salle');
  const store = {};
  const ctx = vm.createContext({
    state: { name: 'Elisa' }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    esc: s => String(s).replace(/</g, '&lt;'), escAttr: s => String(s).replace(/"/g, '&quot;'), saved: 0,
  });
  ctx.save = () => { ctx.saved++; };
  vm.runInContext(fn('jeuNom') + fn('jeuSavedNom') + fn('jeuInitial') + fn('jeuNomField'), ctx);
  const chip = vm.runInContext("jeuNomField('jeu-nom')", ctx);
  assert.ok(chip.includes('<small>Ton pseudo</small><b>Elisa</b>') && chip.includes('<input id="jeu-nom" type="hidden" value="Elisa">') && chip.includes("onclick=\"jeuNomEdit('jeu-nom')\""));
  ctx.state.name = '';
  const field = vm.runInContext("jeuNomField('jeu-nom')", ctx);
  assert.ok(field.includes('Choisis ton pseudo') && field.includes('<input id="jeu-nom" class="jeu-input" maxlength="16"') && !field.includes('hidden'), 'pas encore de pseudo (étape passée avant) : on le demande une fois');
  /* Le pseudo tapé dans la salle devient celui de toute l’appli */
  const input = { value: '  Zoé  ', type: 'text', focus() {} };
  Object.assign(ctx, { document: { querySelector: () => input }, jeuMsgEl: () => null, renderGreeting() { ctx.greet = 1; }, renderLearnAvatar() { ctx.av = 1; } });
  vm.runInContext(fn('jeuAskNom'), ctx);
  assert.equal(vm.runInContext("jeuAskNom('jeu-nom')", ctx), 'Zoé');
  assert.equal(ctx.state.name, 'Zoé'); assert.equal(store['rq-jeu-nom'], 'Zoé'); assert.equal(ctx.saved, 1); assert.ok(ctx.greet && ctx.av, 'accueil et avatar à jour');
  vm.runInContext("jeuAskNom('jeu-nom')", ctx);
  assert.equal(ctx.saved, 1, 'le même pseudo : rien à réenregistrer');
  for (const part of ['html.lq .jeu-me{display:flex;align-items:center;', 'html.lq .jeu-me-edit{', 'html.lq #onboarding .ob-field-opt{'])
    assert.ok(s46.includes(part), part);
});

test('réf 6 — l’écran de chargement : tout s’allume d’emblée sous le logo, et il reste le temps de voir l’anneau tourner', () => {
  assert.ok(app.includes('const LOADER_MIN_MS=1000;'));
  const s37 = css.slice(css.indexOf('/* L’écran de chargement :'), css.indexOf('/* ---------- 38.'));
  const delays = ['html.lq #loader .ld-name{', 'html.lq #loader .spinner{', 'html.lq #loader p{'].map(sel => {
    const r = s37.slice(s37.indexOf(sel), s37.indexOf('}', s37.indexOf(sel)));
    const m = r.match(/animation:ldUp ([\d.]+)s ease-out ([\d.]+)s both/); assert.ok(m, sel); return [+m[1], +m[2]];
  });
  for (const [d, w] of delays) assert.ok(d <= .4 && w <= .15, `allumé en moins d’une demi-seconde (${d}s après ${w}s)`);
  let timers = [];
  const loader = { classList: { list: new Set(), add(c) { this.list.add(c); }, contains(c) { return this.list.has(c); } }, style: {} };
  const run = t => {
    loader.classList.list.clear(); loader.style = {}; timers = [];
    const ctx = vm.createContext({ window: {}, document: { getElementById: () => loader }, performance: { now: () => t }, setTimeout: (f, ms) => { timers.push([ms, f]); } });
    vm.runInContext(app.slice(app.indexOf('const LOADER_MIN_MS='), app.indexOf('\n}', app.indexOf('function hideLoader(')) + 2) + ';hideLoader();', ctx);
    return timers[0][0];
  };
  assert.equal(run(300), 700, 'ouvert en 0,3 s : l’écran attend encore 0,7 s');
  assert.equal(run(2400), 0, 'un chargement long n’attend rien de plus');
  timers[0][1]();
  assert.ok(loader.classList.contains('fade-out') && timers[1][0] === 380, 'puis il s’efface doucement');
});
