/* Voix off des cours vidéo (Elisa, 31 octobre : « Agathe ok », la voix d’ElevenLabs sur le cours « Les bases de données
   relationnelles »). La page donne ses phrases (VOICE) ; le moteur (core.js) cale chaque phrase sur sa légende et fait attendre
   l’image jusqu’à la fin de la phrase ; le lecteur de l’app (LvVoice, index.html) la joue, suit la vidéo (pause, saut, vitesse,
   son coupé) et dit à part les consignes des moments « À toi », leurs réactions et leurs indices. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const core = read('assets/anim/core.js');
const html = read('index.html');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const engine = () => {
  const ctx = vm.createContext({location: {search: '', href: 'https://exemple.fr/assets/anim/cours.html?app&embed'}, URLSearchParams, URL,
    gsap: {config() {}, timeline: () => ({getChildren: () => []})}, document: {}});
  vm.runInContext(core, ctx);
  return ctx;
};

test('moteur : la phrase de la voix fait attendre l’image jusqu’à sa fin (et la légende reste un instant)', () => {
  const ctx = engine(), holds = (c, e = 100) => JSON.stringify(ctx.captionHolds(c, e));
  /* Légende de 10 à 13 s, phrase de 4 s : partie à 10,15 s, finie à 14,15 s, la légende reste 0,3 s : 1,65 s de pause, juste avant le fondu. */
  assert.equal(holds([[10, 13, 'Une phrase.', {voice: ['ch01', 1, 5]}]]), '[[12.75,1.65]]');
  assert.equal(holds([[10, 16, 'Une phrase.', {voice: ['ch01', 1, 3]}]]), '[]', 'la phrase tient dans la légende : pas de pause');
  assert.equal(holds([[10, 13, 'x'.repeat(85), {voice: ['ch01', 0, 1]}]]), '[[12.75,2.5]]', 'lire reste possible : la plus longue des deux');
  assert.equal(holds([[10, 13, 'Une phrase.', 3, {voice: ['ch01', 0, 4]}]]), '[[12.75,1.65]]', 'la 4e valeur (nombre de lignes) reste à sa place');
  assert.equal(holds([[10, 13, 'x'.repeat(85)]]), '[[12.75,2.5]]', 'sans voix : les pauses de lecture d’origine');
  assert.equal(holds([[90, 999, 'Une phrase.', {voice: ['ch10', 0, 9]}]]), '[]', 'dernière légende : recapRest');
  /* Fin de la vidéo sur la dernière légende : l’image reste jusqu’à la fin de la phrase, puis encore 0,3 s, puis RECAP_REST. */
  assert.equal(JSON.stringify(ctx.recapRest([[10, 999, 'x', {voice: ['ch10', 0, 6.02]}]], 12)), '[[11.98,5.75]]');
});

test('moteur : chaque légende reçoit sa phrase par sa clé, et le lecteur reçoit les phrases en temps de la vidéo', () => {
  const ctx = engine(), vkey = vm.runInContext('vkey', ctx);
  assert.equal(vkey('<b>NutriBoost</b> est une boutique<br>en ligne, l’équipe…'), vkey("NutriBoost est une boutique en ligne, l'equipe"), 'balises, accents et ponctuation ne comptent pas');
  assert.notEqual(vkey('Une table par sujet.'), vkey('Une table par client.'));
  assert.ok(/^v[0-9a-z]{1,7}$/.test(vkey('Le SGBD interprète <code>email</code> comme un nouveau titre.')), 'une empreinte courte : la page ne répète pas ses légendes');
  const cfg = vm.runInContext('withVoice', ctx)({voice: {dir: '../voix/cours/', intro: ['ch00', 0.2, 4.2],
    caps: [[vkey('Bonjour à toi.'), 'ch01', 0.5, 2.5], [vkey('Absente'), 'ch01', 3, 4]],
    say: {at1: ['at1', 0.1, 2], touche1: ['touche1', 0, 1], bienvu: ['bienvu', 0, 0.8], rattrape: ['rattrape', 0, 1.1], presque: ['presque', 0, 2], indice1: ['indice1', 0, 1.5],
      finbravo: ['finbravo', 0, 2.2], fineffort: ['fineffort', 0, 3.4]}},
    captions: [[5, 8, 'Bonjour à toi.', 3], [9, 12, 'Sans voix.']]});
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.captions)), [[5, 8, 'Bonjour à toi.', 3, {voice: ['ch01', 0.5, 2.5]}], [9, 12, 'Sans voix.']]);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('VOICE_MISSING', ctx))), [vkey('Absente')], 'phrase sans légende signalée');
  const out = JSON.parse(JSON.stringify(ctx.voiceOut(cfg.captions, 1, 1, 100)));
  assert.deepEqual(out.clips, [{t: 0.35, src: 'https://exemple.fr/assets/voix/cours/ch00.mp3', o: 0.2, d: 4}, {t: 5.15, src: 'https://exemple.fr/assets/voix/cours/ch01.mp3', o: 0.5, d: 2}]);
  assert.equal(out.picks[0].src, 'https://exemple.fr/assets/voix/cours/at1.mp3'); assert.equal(out.tips[0].d, 1.5); assert.equal(out.opens[0].d, 1);
  assert.equal(out.ok.d, 0.8); assert.equal(out.late.d, 1.1); assert.equal(out.ko.d, 2);
  assert.equal(out.end.win.d, 2.2); assert.equal(out.end.retry.d, 3.4);
  assert.equal(out.files.length, 10, 'fichiers à précharger, sans doublon');
  assert.ok(core.includes("if (cfg.voice && !QS.has('novoix')) cfg = withVoice(cfg);") && core.indexOf('cfg = withVoice(cfg)') < core.indexOf('cfg = withMoments(cfg)'),
    'la voix avant les moments : chaque légende emporte sa phrase là où les moments la déplacent');
  assert.ok(core.includes('rest, introVoiceHold(chapters))') && core.includes('voice: pontVoice(voiceOut(captions, picks.length, opens.length, duration)),'), 'pause de l’intro, export au lecteur');
});

test('moteur : une pause tombe au dernier instant où rien ne bouge (sinon sur un mouvement lent)', () => {
  const ctx = engine();
  const tw = (a, d, amb) => ({startTime: () => a, totalDuration: () => d, vars: amb ? {data: 'amb'} : {}});
  const set = list => vm.runInContext('(l => { tl.getChildren = () => l; })', ctx)(list);
  set([tw(8.9, 0.6), tw(2, 30, true)]);
  assert.equal(ctx.freeAt(6, 9.35), 8.89, 'juste avant le mouvement qui passe par la fin (l’ambiance ne compte pas)');
  set([tw(5.8, 3.6), tw(9.25, 0.4)]);
  assert.equal(ctx.freeAt(6, 9.35), 9.24, 'pas d’instant libre : le mouvement lent (3,6 s) plutôt que la sortie');
  set([]);
  assert.equal(ctx.freeAt(6, 9.35), 9.35);
});

test('lecteur : une seule balise audio, déverrouillée au premier appui, qui suit la vidéo', () => {
  const sfxToAnim = cut('const LvSfx=', 'class LvAnim{');
  assert.ok(sfxToAnim.includes('const LvVoice=(()=>{'), 'LvVoice, à côté des sons du lecteur');
  const anim = cut('class LvAnim{', 'function lessonVideoOn(l)');
  for (const s of ['LvVoice.preload(this.voice.files);', "LvVoice.onBlocked(()=>{ if(!this.dead&&!this.paused&&!this._muted){ this.pause(); this._emit('blocked'); } });",
    'LvSfx.stop(); LvVoice.stop(); this.vc=-1; this.vSkip=-1; this.vwait=0;', 'set playbackRate(r){ this._rate=+r||1; LvVoice.setRate(this._rate); }', 'LvVoice.setMuted(this._muted);',
    'LvVoice.unlock(this.voice.clips.find(c=>c.t+c.d>this.t)||this.voice.clips[0]);', "LvVoice.pause(); this.vwait=0; LvSfx.stop(); LvSfx.idle(); this._emit('pause');",
    'this._voice(t,now);', 'if(q>=0||pk>=0||op>=0||end){ const vc=this.vc>=0&&this.voice?this.voice.clips[this.vc]:null; this.vSkip=vc&&vc.t+vc.d-t<=1.4?this.vc:-1; LvVoice.finish(vc); this.vc=-1; this.vwait=0; }',
    'if(k<0){ LvVoice.finish(was); return; }',
    'if(this.vwait){ if(LvVoice.ready()||now-this.vwait>2500)this.vwait=0; else{ this.last=now; this._loop(); return; } }'])
    assert.ok(anim.includes(s), s);
  assert.ok(cut('function lvPkShow(i,p){', 'function lvPkValid(').includes('if(!kept){ const V=lvVoiceV(); if(V)lvVoiceSay(V.picks[i]); }'), 'consigne du moment dite à l’ouverture (pas s’il est déjà fait)');
  assert.ok(cut('function lvPkVerdict(', 'function lvPkFrom(').includes('lvVoiceWin(first);') && cut('function lvPkVerdict(', 'function lvPkFrom(').includes('lvVoiceKo(P);'));
  assert.ok(cut('function lvPkWin(', 'function lvEndHide(').includes('lvVoiceWin(first);'), 'gestes : la même réaction');
  assert.ok(html.includes('function lvVoiceWin(first){ const V=lvVoiceV(); if(V)lvVoiceSay(first?V.ok:(V.late||V.ok)); if(LV&&LV.pk'), 'réussi après une erreur : « Bien rattrapé ! » (puis le chat dit oui, 12 novembre)');
  assert.ok(cut('function lvEndShow(root,id,win){', 'lvCardSync(id);').includes('lvVoiceSay(win?V.end.win:LV.retry?V.end.retry:null);'), 'écran de fin : leçon validée, ou « Encore un effort ! »');
  assert.ok(cut('function lvOpShow(i,o){', 'function lvOpPlace(').includes('{ const V=lvVoiceV(); if(V)lvVoiceSay(V.opens[i]); }'), 'message à toucher : sa consigne');
  assert.ok(cut('function lvPkClose(answered){', 'function lvOpShow(').includes('LvVoice.stopSay();') && cut('function lvOpClose(){', 'const LV_PK_ICO=').includes('LvVoice.stopSay();'));
});

test('lecteur : LvVoice charge, cale, recale, suit la vitesse, se tait, dit à part et rend la mémoire', async () => {
  const src = cut('const LvVoice=(()=>{', '/* ---------- Animation jouée comme une vidéo');
  const made = [], revoked = [], fetched = []; let raf = [], now = 0;
  class El {
    constructor() { this.l = {}; this.attrs = {}; this.paused = true; this.readyState = 0; this.currentTime = 0; this.seeking = false; this.ended = false; this.muted = false; this.playbackRate = 1; this.plays = 0; this._src = ''; made.push(this); }
    set src(v) { this._src = v; this.readyState = 0; this.paused = true; } get src() { return this._src; }
    setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { if (k === 'src') this._src = ''; }
    addEventListener(t, f) { (this.l[t] || (this.l[t] = [])).push(f); } fire(t) { (this.l[t] || []).forEach(f => f()); }
    load() {} play() { this.paused = false; this.plays++; return Promise.resolve(); } pause() { this.paused = true; }
  }
  const ctx = vm.createContext({document: {createElement: () => new El()}, performance: {now: () => now},
    requestAnimationFrame: f => { raf.push(f); return raf.length; }, cancelAnimationFrame: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    fetch: u => { fetched.push(u); return Promise.resolve({ok: true, blob: () => Promise.resolve({size: 10})}); },
    URL: {createObjectURL: () => 'blob:' + fetched.length, revokeObjectURL: u => revoked.push(u)}});
  vm.runInContext(src + ';this.V=LvVoice;', ctx);
  const V = ctx.V, c1 = {src: 'https://x/ch01.mp3', o: 2, d: 3}, c2 = {src: 'https://x/ch02.mp3', o: 1, d: 2};
  V.start(c1, 0.5);
  const el = made[0];
  assert.equal(el.src, 'https://x/ch01.mp3'); assert.equal(el.attrs.playsinline, ''); assert.equal(el.preservesPitch, true);
  assert.equal(V.ready(), false, 'fichier pas encore chargé : l’image attendra');
  el.readyState = 1; el.fire('loadedmetadata');
  assert.equal(el.currentTime, 2.5, 'position atteinte une fois le fichier ouvert'); assert.equal(el.paused, false, 'la phrase part');
  el.readyState = 4; assert.equal(V.ready(), true);
  el.currentTime = 4.2; now = 1000; V.keep(c1, 1.0);
  assert.equal(el.currentTime, 3, 'dérive de plus d’une seconde : recalée');
  el.currentTime = 3.6; V.keep(c1, 1.0); assert.equal(el.currentTime, 3.6, 'retard de 0,6 s (voix lente à partir) : laissée, l’image la rejoint');
  V.setRate(2); assert.equal(el.playbackRate, 2); assert.equal(el.defaultPlaybackRate, 2);
  el.currentTime = 3.5; V.keep(c1, 1.0); assert.equal(el.currentTime, 3.5, 'en lecture rapide, la marge grandit avec la vitesse');
  V.setRate(1);
  V.pause(); assert.equal(el.paused, true);
  now = 2000; V.keep(c1, 1.2); assert.equal(el.paused, false, 'reprise : la voix repart');
  V.setMuted(true); assert.equal(el.muted, true); assert.equal(el.paused, true, 'son coupé : la voix se tait');
  now = 3000; V.start(c2, 0); el.readyState = 4; el.fire('loadedmetadata'); assert.equal(el.paused, true, 'muette : rien ne joue');
  V.setMuted(false);
  /* Phrase dite à part : jusqu’à la fin de son passage. */
  const s1 = {src: 'https://x/at1.mp3', o: 0.1, d: 2};
  now = 4000; V.say(s1); el.readyState = 4; el.fire('loadedmetadata');
  assert.equal(el.src, 'https://x/at1.mp3'); assert.equal(el.currentTime, 0.1); assert.equal(el.paused, false);
  el.currentTime = 1; raf.shift()(); assert.equal(V.stats().saying, true);
  el.currentTime = 2.09; raf.shift()(); assert.equal(V.stats().saying, false, 'fin du passage : la balise s’arrête'); assert.equal(el.paused, true);
  /* Fin d’une phrase de la timeline : le son, en léger retard sur l’image, va jusqu’au bout de son passage. */
  now = 4500; V.start(c1, 2.5); el.readyState = 4; el.fire('loadedmetadata'); el.currentTime = 4.88;
  V.finish(c1); assert.equal(el.paused, false, 'le dernier mot continue');
  V.finish(null); el.currentTime = 4.95; raf.shift()(); assert.equal(el.paused, false, 'rien de neuf : la fin continue');
  el.currentTime = 4.995; raf.shift()(); assert.equal(el.paused, true, 'fin du passage : la voix s’arrête');
  /* Préchargement : les fichiers en mémoire servent ensuite. */
  V.preload([c2.src, 'https://x/ch03.mp3', 'https://x/ch04.mp3']);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fetched.length, 3);
  now = 5000; V.start(c1, 0);
  assert.equal(el.src, 'https://x/ch01.mp3', 'fichier pas préchargé : son adresse');
  V.start(c2, 0); assert.ok(el.src.startsWith('blob:'), 'fichier en mémoire : sans réseau');
  el.fire('error'); assert.equal(el.src, 'https://x/ch02.mp3', 'mémoire illisible : retour à l’adresse du fichier');
  V.release(); assert.equal(revoked.length, 3, 'fermeture du cours : la mémoire est rendue');
});

/* Elisa, 4 novembre, 3 h 01 (« pour les vidéos des cours également il n’y a pas de son ») : dans l’app iPhone, la vue web ne lit pas
   une copie en mémoire (blob:capacitor://localhost/…) et ne le signale pas ; la voix y lit les fichiers de l’app directement. */
const voiceLab = (extra = {}) => {
  const src = cut('const LvVoice=(()=>{', '/* ---------- Animation jouée comme une vidéo');
  const made = [], fetched = [], timers = []; let now = 0;
  class El {
    constructor() { this.l = {}; this.attrs = {}; this.paused = true; this.readyState = 0; this.currentTime = 0; this.seeking = false; this.ended = false; this.muted = false; this.playbackRate = 1; this.plays = 0; this.error = null; this._src = ''; made.push(this); }
    set src(v) { this._src = v; this.readyState = 0; this.paused = true; } get src() { return this._src; }
    setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { if (k === 'src') this._src = ''; }
    addEventListener(t, f) { (this.l[t] || (this.l[t] = [])).push(f); } fire(t) { (this.l[t] || []).forEach(f => f()); }
    load() {} play() { this.paused = false; this.plays++; return Promise.resolve(); } pause() { this.paused = true; }
  }
  const ctx = vm.createContext({document: {createElement: () => new El()}, performance: {now: () => now},
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setTimeout: (f, ms) => { timers.push({f, ms}); return timers.length; }, clearTimeout: id => { if (id && timers[id - 1]) timers[id - 1].f = null; },
    fetch: u => { fetched.push(u); return Promise.resolve({ok: true, blob: () => Promise.resolve({size: 10})}); },
    URL: {createObjectURL: () => 'blob:capacitor://localhost/' + fetched.length, revokeObjectURL() {}}, ...extra});
  vm.runInContext(src + ';this.V=LvVoice;', ctx);
  return {V: ctx.V, made, fetched, timers, tick: ms => { now += ms; }};
};

test('app iPhone : la voix lit les fichiers de l’app (pas de copie en mémoire, que la vue web de l’app ne lit pas)', async () => {
  const lab = voiceLab({window: {Capacitor: {isNativePlatform: () => true}}, location: {protocol: 'capacitor:'}});
  const {V, made, fetched} = lab, c1 = {src: 'assets/voix/cours/ch01.mp3', o: 2, d: 3}, c2 = {src: 'assets/voix/cours/ch02.mp3', o: 0, d: 2};
  V.preload([c1.src, c2.src]); await new Promise(r => setTimeout(r, 10));
  assert.equal(fetched.length, 0, 'rien à télécharger : les fichiers sont dans l’app');
  V.start(c1, 0.5); const el = made[0];
  assert.equal(el.src, 'assets/voix/cours/ch01.mp3', 'l’adresse du fichier, jamais blob:'); assert.equal(el.paused, false);
  el.readyState = 1; el.fire('loadedmetadata'); assert.equal(el.currentTime, 2.5);
  lab.tick(1000); V.start(c2, 0); assert.equal(el.src, 'assets/voix/cours/ch02.mp3');
  assert.equal(V.stats().direct, true);
  /* Repéré aussi sans le plugin (adresse capacitor:) ; dans Safari, la copie en mémoire reste. */
  assert.equal(voiceLab({location: {protocol: 'capacitor:'}}).V.stats().direct, true);
  assert.equal(voiceLab({window: {}, location: {protocol: 'https:'}}).V.stats().direct, false);
});

test('web : une copie en mémoire qui ne s’ouvre pas en 2 s (ni son, ni erreur) laisse la place à l’adresse du fichier', async () => {
  const lab = voiceLab({window: {}, location: {protocol: 'https:'}});
  const {V, made, timers} = lab, c1 = {src: 'https://x/ch01.mp3', o: 0, d: 3}, c2 = {src: 'https://x/ch02.mp3', o: 1.5, d: 2};
  V.preload([c1.src, c2.src]); await new Promise(r => setTimeout(r, 10));
  V.start(c1, 0); const el = made[0];
  assert.ok(el.src.startsWith('blob:'), 'copie en mémoire : sans réseau');
  const w1 = timers.at(-1); assert.equal(w1.ms, 2000, 'surveillée 2 s');
  el.readyState = 4; el.fire('loadedmetadata'); w1.f && w1.f();
  assert.ok(el.src.startsWith('blob:'), 'ouverte à temps : elle reste');
  lab.tick(1000); V.start(c2, 0.5);
  assert.ok(el.src.startsWith('blob:')); const plays = el.plays, w2 = timers.at(-1);
  w2.f();   // 2 s plus tard, toujours rien (readyState 0, pas d’erreur)
  assert.equal(el.src, 'https://x/ch02.mp3', 'repli : l’adresse du fichier');
  assert.equal(el.plays, plays + 1, 'et la phrase repart aussitôt');
  el.readyState = 1; el.fire('loadedmetadata'); assert.equal(el.currentTime, 2, 'à la même position');
  lab.tick(1000); V.start(c1, 0); assert.equal(el.src, 'https://x/ch01.mp3', 'puis plus de copie pour le reste du cours');
  assert.equal(V.stats().direct, true);
});

test('préchargement : seule une réponse « absent » (400 et plus) fait sauter un fichier ; une réponse sans code (statut 0) non', async () => {
  const st = {'https://x/a.mp3': 0, 'https://x/b.mp3': 404};
  const lab = voiceLab({window: {}, location: {protocol: 'https:'},
    fetch: u => Promise.resolve({ok: false, status: st[u], blob: () => Promise.resolve({size: 10})})});
  lab.V.preload(Object.keys(st)); await new Promise(r => setTimeout(r, 10));
  const {V, made} = lab;
  V.start({src: 'https://x/a.mp3', o: 0, d: 2}, 0); const el = made[0];
  assert.equal(el.src, 'https://x/a.mp3', 'statut 0 : lu par son adresse'); assert.equal(el.paused, false, 'et il joue');
  el.pause(); lab.tick(1000); V.start({src: 'https://x/b.mp3', o: 0, d: 2}, 0);
  assert.equal(el.paused, true, '404 : sauté'); assert.equal(V.ready(), true, 'sans faire attendre l’image');
});

test('app iPhone sans Audio Session API : le silence qui garde le son en mode silencieux est un fichier de l’app', () => {
  const sfx = cut('const LvSfx=(()=>{', '/* ---------- Voix off des cours');
  const made = [];
  const ctx = vm.createContext({window: {Capacitor: {isNativePlatform: () => true}}, location: {protocol: 'capacitor:'},
    navigator: {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X)', maxTouchPoints: 5},
    document: {createElement: () => { const a = {attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, play() { this.playing = true; return Promise.resolve(); }, pause() { this.playing = false; }}; made.push(a); return a; }},
    URL: {createObjectURL: () => 'blob:capacitor://localhost/silence'}, Blob: class {}, ArrayBuffer, DataView});
  vm.runInContext(sfx + ';this.LvSfx=LvSfx;', ctx);
  ctx.LvSfx.resume();
  assert.equal(made.length, 1); assert.equal(made[0].src, 'assets/sons/silence.wav'); assert.equal(made[0].loop, true); assert.equal(made[0].playing, true);
  /* Le fichier : exactement le silence que la page fabrique pour Safari (WAV 8 kHz, 8 bits, 0,25 s). */
  let parts = null;
  const web = vm.createContext({Blob: class { constructor(p) { parts = p; } }, ArrayBuffer, DataView});
  vm.runInContext(sfx.slice(sfx.indexOf('function silentWav(){'), sfx.indexOf('function session(on){')) + ';silentWav();', web);
  assert.deepEqual(Buffer.from(parts[0]), fs.readFileSync(path.join(ROOT, 'assets/sons/silence.wav')));
});

test('le cours « Les bases de données relationnelles » a sa voix : chaque phrase à sa légende, chaque fichier présent', () => {
  const page = read('assets/anim/bases-relationnelles.html');
  const job = JSON.parse(read('tools/voix/bases-relationnelles.json'));
  assert.equal(job.voix.nom, 'Agathe'); assert.equal(job.modele, 'eleven_v4');
  const ctx = engine(), vkey = vm.runInContext('vkey', ctx);
  const capSrc = page.slice(page.indexOf('const CAPTIONS = ['), page.indexOf('\n];', page.indexOf('const CAPTIONS = [')) + 3);
  const CAPTIONS = vm.runInContext(capSrc.replace('const CAPTIONS =', 'CAPTIONS =') + ';CAPTIONS', vm.createContext({APP: true, CAPTIONS: null}));
  const vSrc = page.slice(page.indexOf('const VOICE = {'), page.indexOf('/* Fin de la voix off */'));
  assert.ok(vSrc.length > 100, 'VOICE dans la page');
  const VOICE = vm.runInContext(vSrc.replace('const VOICE =', 'VOICE =') + ';VOICE', vm.createContext({VOICE: null}));
  assert.ok(/\nCourse\(\{duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: 539\.7, moments: MOMENTS, opens: OPENS, voice: VOICE,\n/.test(page));
  assert.equal(VOICE.dir, '../voix/bases-relationnelles/');
  const keys = new Set(CAPTIONS.map(c => vkey(c[2])));
  /* 13 novembre (Elisa, 13 h 19 : « certains textes ne sont pas parlés ») : chaque légende a sa voix, et chaque voix sa légende.
     Les compléments (ch05b, ch06b, ch06c : des phrases générées à part, tools/voix/bases-relationnelles-complements.json) comptent.
     Tant qu’ils ne sont pas générés et intégrés, ce test donne la liste des légendes encore muettes. */
  const dites = new Set(VOICE.caps.map(c => c[0])), plainCap = h => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  assert.deepEqual(CAPTIONS.filter(c => !dites.has(vkey(c[2]))).map(c => plainCap(c[2])), [], 'légendes muettes');
  assert.equal(VOICE.caps.length, CAPTIONS.length, 'une voix par légende, chapitres 1 à 11');
  for (const [k, f, a, b] of VOICE.caps) {
    assert.ok(keys.has(k), `légende trouvée : ${k}`);
    assert.ok(b - a > 0.5 && a >= 0, `${k} : passage de ${a} à ${b}`);
    assert.ok(/^ch(0[1-9]|1[01])[a-z]?$/.test(f), f);   // 20 h 10 : chapitre 11, « À retenir », lui aussi dit ; 13 novembre : ch05b…
    assert.ok(job.elements.some(e => e.id === f && e.phrases), `${f} : dans tools/voix/bases-relationnelles.json`);
  }
  /* Le cours lui-même liste ses compléments (pour l’intégration), avec les mêmes textes que le fichier qui les fait générer. */
  const comp = JSON.parse(read('tools/voix/bases-relationnelles-complements.json'));
  assert.equal(comp.cours, 'bases-relationnelles-complements'); assert.deepEqual(comp.voix, job.voix); assert.equal(comp.modele, job.modele);
  for (const e of comp.elements) assert.deepEqual(job.elements.find(x => x.id === e.id), e, `${e.id} : le même dans le cours`);
  assert.ok(VOICE.intro && VOICE.intro[0] === 'ch00' && VOICE.intro[2] - VOICE.intro[1] > 3, 'l’intro dit le titre et le sous-titre');
  const M = (page.match(/\{at: [\d.]+, from: [\d.]+, kind: /g) || []).length, O = (page.match(/\{at: OPEN\d, sel: /g) || []).length;
  for (let i = 1; i <= M; i++) assert.ok(VOICE.say['at' + i] && VOICE.say['indice' + i], `moment ${i} : consigne et indice`);
  for (let i = 1; i <= O; i++) assert.ok(VOICE.say['touche' + i], `message ${i} : consigne`);
  assert.ok(VOICE.say.bienvu && VOICE.say.presque && VOICE.say.rattrape, 'réactions : « Bien vu ! », « Bien rattrapé ! », « Pas tout à fait… »');
  assert.ok(VOICE.say.finbravo && VOICE.say.fineffort, 'écran de fin : leçon validée, ou « Encore un effort ! »');
  const files = new Set([VOICE.intro[0], ...VOICE.caps.map(c => c[1]), ...Object.values(VOICE.say).map(v => v[0])]);
  for (const f of files) {
    const p = path.join(ROOT, 'assets/voix/bases-relationnelles', f + '.mp3');
    assert.ok(fs.existsSync(p) && fs.statSync(p).size > 2000, `fichier présent : ${f}.mp3`);
  }
});

test('outils de la voix : la clé ElevenLabs reste sur le Mac, les fichiers bruts hors de Git', () => {
  const gen = read('tools/voix/generer.mjs');
  assert.ok(gen.includes("path.join(os.homedir(), '.config', 'requete', 'elevenlabs.key')") && gen.includes('{mode: 0o600}'), 'clé rangée hors du dépôt, lisible par Elisa seule');
  assert.ok(!/sk_[a-z0-9]{20,}/i.test(gen + read('tools/voix/bases-relationnelles.json')), 'aucune clé dans le dépôt');
  assert.ok(gen.includes('/with-timestamps') && gen.includes('/v1/forced-alignment'), 'minutage de chaque caractère (ou alignement forcé)');
  assert.ok(read('.gitignore').includes('\ntools/voix/sortie/\n'));
  const sw = read('sw.js');
  assert.ok(sw.includes("if (url.pathname.endsWith('.mp3') && req.headers.has('range')) return;"), 'la balise audio peut demander ses morceaux elle-même');
  const ml = read('decouvrir/mentions-legales.html');
  assert.ok(ml.includes('<li><a href="#voix">Voix des cours</a></li>') && ml.includes('<section id="voix"><h2>Voix des cours</h2><p>La voix qui lit les cours vidéo de l’appli est une <b>voix de synthèse</b>, générée avec ElevenLabs'),
    'mentions légales : la voix des cours est une voix de synthèse (ElevenLabs)');
});
