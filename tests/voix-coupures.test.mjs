/* Elisa, 7 novembre, 20 h 50 : « et pour les voix du coup parfois il y a des coupures comment modifier ça ».
   Sur iPhone, la voix met 0,2 à 0,6 s à vraiment partir après un départ ou un saut dans le fichier. Le lecteur la recalait sur l’image
   dès 0,3 s d’écart : un saut, qui la faisait repartir avec le même retard, puis un autre saut… une phrase hachée, parfois perdue. Et une
   consigne « À toi » (0,3 s après la fin d’une phrase, le plus souvent), ou la phrase suivante (l’intro et le lien avec la leçon d’avant :
   0,15 s), coupait le dernier mot d’une phrase encore en retard.
   Maintenant l’image suit la voix (au-delà de 0,2 s d’écart, entre la moitié et une fois et demie de sa vitesse), la voix n’est recalée
   qu’au-delà d’une seconde, et ce qui suit une phrase attend qu’elle ait fini son dernier mot. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, b); return html.slice(i, j); };
const VOICE = cut('const LvVoice=(()=>{', '/* ---------- Animation jouée comme une vidéo');
const ANIM = cut('class LvAnim{', '/* Confettis d’une vidéo');

/* Le lecteur entier (LvAnim + LvVoice) face à une balise audio « façon iPhone » : après play() ou un saut, elle attend pre ms avant
   d’avancer ; un saut prend seek ms ; un fichier s’ouvre en load ms. Les images passent toutes les frame ms ; stalls : fil principal bloqué.
   La vidéo : l’intro, le lien 0,15 s après (autre fichier), quatre phrases, un moment « À toi » 0,27 s après la quatrième (sa consigne),
   puis deux phrases. Rend ce qui manque de chaque phrase (s), les sauts entendus, et la marche de l’image. */
async function simule(P) {
  let now = 0; const rafs = [], timers = [], els = []; let rid = 0;
  const DUR = {'f/ch01.mp3': 40, 'f/ch02.mp3': 30, 'f/at1.mp3': 8};
  class A {
    constructor() { Object.assign(this, {l: {}, attrs: {}, paused: true, readyState: 0, _t: 0, seeking: false, ended: false, muted: false, playbackRate: 1,
      defaultPlaybackRate: 1, _src: '', error: null, pre: 0, seekLeft: 0, loadLeft: 0, dur: 0, played: [], jumps: 0, since: 0}); els.push(this); }
    set src(v) { Object.assign(this, {_src: v, readyState: 0, paused: true, loadLeft: v ? Math.max(1, P.load) : 0, dur: DUR[v] || 0, ended: false, _t: 0, since: 0}); }
    get src() { return this._src; }
    get currentTime() { return this._t; }
    set currentTime(v) { if (this.readyState < 1) return; if (!this.paused && this.since > 0) this.jumps++;
      Object.assign(this, {_t: Math.min(v, this.dur), seeking: true, seekLeft: P.seek, readyState: 1, ended: false, since: 0}); }
    setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { if (k === 'src') this._src = ''; }
    addEventListener(t, f) { (this.l[t] || (this.l[t] = [])).push(f); } fire(t) { (this.l[t] || []).forEach(f => f()); }
    load() {}
    play() { if (this.paused) { this.paused = false; this.pre = P.pre; if (this.ended) { this._t = 0; this.ended = false; this.restart = true; } } return Promise.resolve(); }
    pause() { this.paused = true; }
    step(ms) {
      if (!this._src) return;
      if (this.loadLeft > 0) { this.loadLeft -= ms; if (this.loadLeft <= 0) { this.readyState = 1; this.fire('loadedmetadata'); if (!this.seeking) this.readyState = 4; } return; }
      if (this.seeking) { this.seekLeft -= ms; if (this.seekLeft <= 0) { this.seeking = false; this.readyState = 4; if (!this.paused) this.pre = P.pre; } return; }
      if (this.paused || this.readyState < 3) return;
      if (this.pre > 0) { this.pre -= ms; return; }
      const nt = Math.min(this.dur, this._t + ms / 1000 * this.playbackRate);
      this.played.push([this._src, this._t, nt]); this.since += nt - this._t; this._t = nt;
      if (this._t >= this.dur) { this.ended = true; this.paused = true; }
    }
  }
  const LvSfx = {resume() {}, setMuted() {}, canStart: () => true, stuck: () => false, stop() {}, idle() {}, play() {}, release() {}};
  const ctx = vm.createContext({window: {Capacitor: {isNativePlatform: () => true}}, location: {protocol: 'capacitor:'},
    document: {createElement: () => new A(), hidden: false, addEventListener() {}}, performance: {now: () => now},
    requestAnimationFrame: f => { rafs.push({f, id: ++rid}); return rid; }, cancelAnimationFrame: id => { const r = rafs.find(r => r.id === id); if (r) r.f = null; },
    setTimeout: (f, ms) => { timers.push({f, at: now + ms}); return timers.length; }, clearTimeout: id => { if (id && timers[id - 1]) timers[id - 1].f = null; },
    LvSfx, lvConfetti() {}});
  vm.runInContext(VOICE + '\n' + ANIM + ';this.LvVoice=LvVoice;this.LvAnim=LvAnim;', ctx);
  const {LvVoice, LvAnim} = ctx, S = 'f/ch01.mp3';
  const clips = [{t: 0.35, src: S, o: 0, d: 4.2}, {t: 4.85, src: 'f/ch02.mp3', o: 0, d: 3}, {t: 8.6, src: S, o: 4.4, d: 3.6},
    {t: 12.9, src: S, o: 8.2, d: 2.9}, {t: 16.5, src: S, o: 11.3, d: 3.4}, {t: 21, src: S, o: 14.9, d: 3.1}, {t: 24.9, src: S, o: 18.2, d: 2.5}];
  const consigne = {src: 'f/at1.mp3', o: 0.3, d: 3.2}, pickT = 16.5 + 3.4 + 0.27;
  const info = {duration: 30, cues: [], chapters: [], questions: [], picks: [{t: pickT}], opens: [], captions: [], voice: {clips, files: [S]}};
  const frame = {l: {}, addEventListener(t, f) { this.l[t] = f; }, contentWindow: {__ready: Promise.resolve(info), renderAt() {}}, set src(v) {}};
  const v = new LvAnim(frame);
  /* Le moment : sa consigne dite à part, puis « Continuer » 6 s plus tard. */
  v.addEventListener('pick', () => { LvVoice.say(consigne); timers.push({f: () => { LvVoice.stopSay(); v.play(); }, at: now + 6000}); });
  await frame.l.load();
  v.playbackRate = P.rate || 1; v.play();
  const FR = P.frame || 16, tl = [];
  for (let k = 0; k < 60000 / FR && !v.ended; k++) {
    now += FR;
    for (const e of els) e.step(FR);
    timers.filter(x => x.f && x.at <= now).forEach(x => { const f = x.f; x.f = null; f(); });
    if (!(P.stalls || []).some(([a, d]) => now >= a && now < a + d)) for (const r of rafs.splice(0)) if (r.f) r.f(now);
    tl.push(v.t);
  }
  const played = els.flatMap(e => e.played);
  const manque = c => { const a = c.o + 0.03, b = c.o + c.d - 0.03; let miss = 0, at = a;
    played.filter(p => p[0] === c.src && p[2] > a && p[1] < b).map(p => [Math.max(a, p[1]), Math.min(b, p[2])]).sort((x, y) => x[0] - y[0])
      .forEach(([x, y]) => { if (x > at) miss += x - at; at = Math.max(at, y); });
    return +(miss + Math.max(0, b - at)).toFixed(3); };
  const step = FR / 1000 * (P.rate || 1); let back = 0, lent = 0, bouge = 0;
  for (let i = 1; i < tl.length; i++) { const d = tl[i] - tl[i - 1]; if (d < -1e-9) back++; if (d > 0) { bouge++; if (d < 0.95 * step) lent++; } }
  return {fin: v.ended, manque: clips.map(manque), consigne: manque(consigne), sauts: els.reduce((s, e) => s + e.jumps, 0),
    debut: els.some(e => e.restart), recul: back, lent: lent / bouge};
}

test('iPhone : une voix lente à partir n’est plus hachée ; chaque phrase et la consigne sont dites en entier', async () => {
  for (const pre of [0, 150, 280, 350, 450, 650]) {
    const r = await simule({pre, seek: 100, load: 150});
    assert.ok(r.fin, `${pre} ms : la vidéo va au bout`);
    assert.deepEqual(r.manque, [0, 0, 0, 0, 0, 0, 0], `${pre} ms : aucune phrase entamée (${r.manque})`);
    assert.equal(r.consigne, 0, `${pre} ms : la consigne du moment, en entier`);
    assert.equal(r.sauts, 0, `${pre} ms : pas un saut dans une phrase`);
    assert.equal(r.recul, 0, `${pre} ms : l’image ne recule jamais`);
    assert.equal(r.debut, false, `${pre} ms : un fichier fini ne repart pas du début`);
  }
});

test('iPhone : l’image ne ralentit que si la voix a plus de 0,2 s de retard', async () => {
  assert.ok((await simule({pre: 0, seek: 100, load: 150})).lent < 0.01, 'voix à l’heure : l’image va son train');
  assert.ok((await simule({pre: 150, seek: 100, load: 150})).lent < 0.01, '0,15 s de retard : rien ne change');
  const r = await simule({pre: 450, seek: 100, load: 150});
  assert.ok(r.lent > 0.05 && r.lent < 0.35, `0,45 s : l’image attend un peu la voix au début des phrases (${r.lent})`);
});

test('vitesse, images espacées, fil principal bloqué : rien ne se perd non plus', async () => {
  for (const P of [{rate: 1.5}, {rate: 2}, {rate: 0.75}, {frame: 33}, {stalls: [[10000, 450], [10900, 450], [11800, 450]]}, {stalls: [[2000, 700]]}]) {
    const r = await simule({pre: 250, seek: 100, load: 150, ...P});
    assert.ok(r.fin, JSON.stringify(P));
    assert.deepEqual(r.manque, [0, 0, 0, 0, 0, 0, 0], `${JSON.stringify(P)} : ${r.manque}`);
    assert.equal(r.sauts, 0, JSON.stringify(P)); assert.equal(r.recul, 0, JSON.stringify(P));
  }
});

/* La voix seule, avec des balises factices (currentTime n’avance que si le test le dit). */
const lab = () => {
  const made = [], raf = []; let now = 0;
  class El {
    constructor() { Object.assign(this, {l: {}, attrs: {}, paused: true, readyState: 0, currentTime: 0, seeking: false, ended: false, muted: false, playbackRate: 1, _src: '', seeks: 0}); made.push(this); }
    set src(v) { this._src = v; this.readyState = 0; this.paused = true; } get src() { return this._src; }
    setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { if (k === 'src') this._src = ''; }
    addEventListener(t, f) { (this.l[t] || (this.l[t] = [])).push(f); } fire(t) { (this.l[t] || []).forEach(f => f()); }
    load() {} play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; }
  }
  const ctx = vm.createContext({document: {createElement: () => new El()}, performance: {now: () => now},
    requestAnimationFrame: f => { raf.push(f); return raf.length; }, cancelAnimationFrame: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    window: {Capacitor: {isNativePlatform: () => true}}, location: {protocol: 'capacitor:'}});
  vm.runInContext(VOICE + ';this.V=LvVoice;', ctx);
  const open = el => { el.readyState = 4; el.fire('loadedmetadata'); };
  return {V: ctx.V, made, raf, open, at: ms => { now = ms; }};
};
const c1 = {src: 'assets/voix/cours/ch00.mp3', o: 0, d: 4}, c2 = {src: 'assets/voix/cours/lienavant.mp3', o: 0.1, d: 3};
const c3 = {src: 'assets/voix/cours/ch00.mp3', o: 4.2, d: 2}, s1 = {src: 'assets/voix/cours/at1.mp3', o: 0.3, d: 2};

test('la phrase suivante attend le dernier mot de la précédente (l’image l’attend)', () => {
  const {V, made, raf, open, at} = lab();
  V.start(c1, 0); const el = made[0]; open(el);
  el.currentTime = 3.8; V.finish(c1);   // l’image a fini la phrase, la voix (en retard) dit encore « …ensemble »
  at(150); V.start(c2, 0);
  assert.equal(el.src, c1.src, 'le dernier mot n’est pas coupé'); assert.equal(el.paused, false);
  assert.equal(V.ready(), false, 'l’image attend'); assert.equal(V.stats().attend, 'phrase');
  el.currentTime = 3.995; raf.shift()();
  assert.equal(el.src, c2.src, 'puis la phrase suivante part'); assert.equal(V.stats().attend, '');
  open(el); assert.equal(el.currentTime, 0.1); assert.equal(el.paused, false); assert.equal(V.ready(), true);
  /* Une voix déjà au bout (ou arrêtée) : la phrase suivante part tout de suite. */
  el.currentTime = 3.1; V.finish(c2); raf.shift()(); assert.equal(el.paused, true);
  V.start(c3, 0); assert.equal(el.src, c3.src);
});

test('la consigne d’un moment attend la fin de la phrase juste avant ; fermer le moment l’annule', () => {
  const {V, made, raf, open, at} = lab();
  V.start(c1, 0); const el = made[0]; open(el);
  el.currentTime = 3.7; V.finish(c1);
  V.say(s1);
  assert.equal(el.src, c1.src, 'la phrase finit son dernier mot'); assert.equal(V.stats().attend, 'consigne'); assert.equal(V.stats().saying, false);
  el.currentTime = 3.995; raf.shift()();
  assert.equal(el.src, s1.src, 'puis la consigne'); assert.equal(V.stats().saying, true);
  open(el); assert.equal(el.currentTime, 0.3); assert.equal(el.paused, false);
  /* Le moment fermé avant la fin de la phrase : rien ne part ensuite. */
  at(5000); V.stop(); V.start(c1, 0); open(el);
  el.currentTime = 3.7; V.finish(c1); V.say(s1); V.stopSay();
  el.currentTime = 3.995; raf.splice(0).forEach(f => f());
  assert.equal(el.src, c1.src, 'consigne annulée'); assert.equal(el.paused, true);
  /* Une réaction pendant une consigne la remplace aussitôt (l’élève a déjà répondu) : comme avant. */
  V.say(s1); open(el); V.say(c3); assert.equal(el.src, c3.src);
});

test('pause pendant cette attente : à la reprise, la phrase part de son début, pas de la fin de la précédente', () => {
  const {V, made, raf, open, at} = lab();
  V.start(c1, 0); const el = made[0]; open(el);
  el.currentTime = 3.8; V.finish(c1); at(100); V.start(c3, 0);
  V.pause(); assert.equal(el.paused, true); assert.equal(V.stats().attend, '');
  at(5000); V.keep(c3, 0); open(el);
  assert.equal(el.currentTime, 4.2, 'au début de la phrase'); assert.equal(el.paused, false);
});

test('un retard de moins d’une seconde n’est plus rattrapé par un saut ; une phrase finie avant l’image attend', () => {
  const {V, made, open, at} = lab();
  V.start(c3, 0); const el = made[0]; open(el);
  el.currentTime = 4.3; at(1000); V.keep(c3, 0.7); assert.equal(el.currentTime, 4.3, '0,6 s de retard : pas de saut');
  el.currentTime = 4.3; at(1100); V.keep(c3, 1.5); assert.equal(el.currentTime, 5.7, '1,2 s : recalée');
  /* La voix a fini la phrase (6,2 s dans le fichier) avant l’image : elle attend, sans entamer la suivante. */
  el.currentTime = 6.2; at(1200); V.keep(c3, 1.8); assert.equal(el.paused, true, 'elle s’arrête au bout de son passage');
  at(1300); V.keep(c3, 1.9); assert.equal(el.paused, true, 'et ne repart pas');
  /* Fichier fini (dernière phrase d’un chapitre) : il ne repart pas du début. */
  el.ended = true; el.currentTime = 6.2; at(1400); V.keep(c3, 1.95); assert.equal(el.paused, true);
});

test('l’horloge de la voix : sa place dans la phrase tant qu’elle la dit ; rien quand elle ne peut pas guider l’image', () => {
  const {V, made, raf, open, at} = lab();
  assert.equal(V.clock(c3), null, 'pas encore de balise');
  V.start(c3, 0); const el = made[0];
  assert.equal(V.clock(c3), null, 'fichier pas encore ouvert');
  open(el); el.currentTime = 4.5; at(100);
  assert.equal(+V.clock(c3).toFixed(3), 0.3, 'elle dit la phrase : 0,3 s après son début');
  assert.equal(V.clock(c1), null, 'une autre phrase du même fichier n’est pas la sienne');
  assert.equal(V.clock({...c3, src: 'x.mp3'}), null, 'un autre fichier non plus');
  at(800); assert.equal(+V.clock(c3).toFixed(3), 0.3, 'immobile depuis 0,7 s : l’image l’attend encore');
  at(1000); assert.equal(V.clock(c3), null, 'au-delà de 0,8 s : l’image ne l’attend plus');
  el.currentTime = 4.6; at(1050); assert.equal(+V.clock(c3).toFixed(3), 0.4, 'elle repart : l’image la suit de nouveau');
  el.seeking = true; assert.equal(V.clock(c3), null, 'pendant un saut'); el.seeking = false;
  V.pause(); assert.equal(V.clock(c3), null, 'en pause');
  at(2000); V.keep(c3, 0.4); V.finish(c3); assert.equal(V.clock(c3), null, 'pendant la fin de phrase'); raf.length = 0;
  V.setMuted(true); assert.equal(V.clock(c3), null, 'son coupé');
});

test('l’image au pas de la voix : rien sous 0,2 s d’écart, entre la moitié et une fois et demie de sa vitesse au-delà, rien au-delà d’une seconde', () => {
  const ctx = vm.createContext({LvVoice: {ecart: 1}, requestAnimationFrame() {}, cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {}, LvSfx: {}});
  vm.runInContext(ANIM + ';this.LvAnim=LvAnim;', ctx);
  const f = ctx.LvAnim.prototype._vFollow, me = (t0, rate = 1) => ({t: t0, _rate: rate});
  const dt = 0.016, t0 = 10, t = t0 + dt;
  assert.equal(f.call(me(t0), t, dt, t - 0.15), t, '0,15 s de retard : l’image va son train');
  assert.equal(f.call(me(t0), t, dt, t + 0.15), t, '0,15 s d’avance : de même');
  const lent = f.call(me(t0), t, dt, t - 0.5) - t0, vite = f.call(me(t0), t, dt, t + 0.5) - t0;
  assert.ok(lent < dt && lent >= 0.5 * dt - 1e-12, `0,5 s de retard : l’image ralentit, jamais sous la moitié (${lent / dt})`);
  assert.ok(vite > dt && vite <= 1.5 * dt + 1e-12, `0,5 s d’avance : elle accélère, jamais au-delà d’une fois et demie (${vite / dt})`);
  assert.equal(f.call(me(t0), t, dt, t - 1.5), t, 'plus d’une seconde : la voix sera recalée, l’image va son train');
  assert.equal(f.call(me(t), t, 0, t - 0.5), t, 'image arrêtée : rien');
  assert.equal(f.call(me(t0, 2), t0 + 2 * dt, dt, t0 + 2 * dt - 0.3), t0 + 2 * dt, 'en lecture rapide, la marge suit la vitesse');
  /* Branchée dans la boucle, avant les arrêts : un moment n’est jamais sauté. */
  const loop = cut('  _loop(){', '\n  }\n}');
  const at = loop.indexOf('if(this.vc>=0&&this.vc!==this.vSkip&&this.voice&&!this._muted){ const c=this.voice.clips[this.vc], p=LvVoice.clock(c); if(p!=null)t=this._vFollow(t,dt,c.t+p); }');
  assert.ok(at > loop.indexOf('let t=this.t+dt*this._rate') && at < loop.indexOf('for(let i=0;i<this.questions.length;i++)'));
});
