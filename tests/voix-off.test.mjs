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
    say: {at1: ['at1', 0.1, 2], touche1: ['touche1', 0, 1], bienvu: ['bienvu', 0, 0.8], presque: ['presque', 0, 2], indice1: ['indice1', 0, 1.5]}},
    captions: [[5, 8, 'Bonjour à toi.', 3], [9, 12, 'Sans voix.']]});
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.captions)), [[5, 8, 'Bonjour à toi.', 3, {voice: ['ch01', 0.5, 2.5]}], [9, 12, 'Sans voix.']]);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('VOICE_MISSING', ctx))), [vkey('Absente')], 'phrase sans légende signalée');
  const out = JSON.parse(JSON.stringify(ctx.voiceOut(cfg.captions, 1, 1, 100)));
  assert.deepEqual(out.clips, [{t: 0.35, src: 'https://exemple.fr/assets/voix/cours/ch00.mp3', o: 0.2, d: 4}, {t: 5.15, src: 'https://exemple.fr/assets/voix/cours/ch01.mp3', o: 0.5, d: 2}]);
  assert.equal(out.picks[0].src, 'https://exemple.fr/assets/voix/cours/at1.mp3'); assert.equal(out.tips[0].d, 1.5); assert.equal(out.opens[0].d, 1);
  assert.equal(out.ok.d, 0.8); assert.equal(out.ko.d, 2);
  assert.equal(out.files.length, 7, 'fichiers à précharger, sans doublon');
  assert.ok(core.includes("if (cfg.voice && !QS.has('novoix')) cfg = withVoice(cfg);") && core.indexOf('cfg = withVoice(cfg)') < core.indexOf('cfg = withMoments(cfg)'),
    'la voix avant les moments : chaque légende emporte sa phrase là où les moments la déplacent');
  assert.ok(core.includes('rest, introVoiceHold(chapters))') && core.includes('voice: voiceOut(captions, picks.length, opens.length, duration)};'), 'pause de l’intro, export au lecteur');
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
    'LvSfx.stop(); LvVoice.stop(); this.vc=-1; this.vwait=0;', 'set playbackRate(r){ this._rate=+r||1; LvVoice.setRate(this._rate); }', 'LvVoice.setMuted(this._muted);',
    'LvVoice.unlock(this.voice.clips.find(c=>c.t+c.d>this.t)||this.voice.clips[0]);', "LvVoice.pause(); this.vwait=0; LvSfx.stop(); LvSfx.idle(); this._emit('pause');",
    'this._voice(t,now);', 'if(q>=0||pk>=0||op>=0||end){ LvVoice.pause(); this.vc=-1; this.vwait=0; }',
    'if(this.vwait){ if(LvVoice.ready()||now-this.vwait>2500)this.vwait=0; else{ this.last=now; this._loop(); return; } }'])
    assert.ok(anim.includes(s), s);
  assert.ok(cut('function lvPkShow(i,p){', 'function lvPkValid(').includes('if(!kept){ const V=lvVoiceV(); if(V)lvVoiceSay(V.picks[i]); }'), 'consigne du moment dite à l’ouverture (pas s’il est déjà fait)');
  assert.ok(cut('function lvPkVerdict(', 'function lvPkFrom(').includes('if(first){ const V=lvVoiceV(); if(V)lvVoiceSay(V.ok); }') && cut('function lvPkVerdict(', 'function lvPkFrom(').includes('lvVoiceKo(P);'));
  assert.ok(cut('function lvPkWin(', 'function lvEndHide(').includes('if(first){ const V=lvVoiceV(); if(V)lvVoiceSay(V.ok); }'));
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
    requestAnimationFrame: f => { raf.push(f); return raf.length; }, cancelAnimationFrame: () => {},
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
  assert.equal(el.currentTime, 3, 'dérive de plus de 0,3 s : recalée');
  el.currentTime = 3.2; V.keep(c1, 1.0); assert.equal(el.currentTime, 3.2, 'petite dérive : laissée');
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
  assert.ok(/\nCourse\(\{duration: DURATION, chapters: CHAPTERS, captions: CAPTIONS, questions: QUESTIONS, notesAt: 492\.4, moments: MOMENTS, opens: OPENS, voice: VOICE,\n/.test(page));
  assert.equal(VOICE.dir, '../voix/bases-relationnelles/');
  const keys = new Set(CAPTIONS.map(c => vkey(c[2])));
  const phrases = job.elements.filter(e => e.phrases && e.id !== 'ch00').reduce((n, e) => n + e.phrases.length, 0);
  assert.equal(VOICE.caps.length, phrases, 'une phrase par légende, chapitres 1 à 10');
  for (const [k, f, a, b] of VOICE.caps) {
    assert.ok(keys.has(k), `légende trouvée : ${k}`);
    assert.ok(b - a > 0.5 && a >= 0, `${k} : passage de ${a} à ${b}`);
    assert.ok(/^ch(0[1-9]|10)$/.test(f), f);
  }
  assert.ok(VOICE.intro && VOICE.intro[0] === 'ch00' && VOICE.intro[2] - VOICE.intro[1] > 3, 'l’intro dit le titre et le sous-titre');
  const M = (page.match(/\{at: [\d.]+, from: [\d.]+, kind: /g) || []).length, O = (page.match(/\{at: OPEN\d, sel: /g) || []).length;
  for (let i = 1; i <= M; i++) assert.ok(VOICE.say['at' + i] && VOICE.say['indice' + i], `moment ${i} : consigne et indice`);
  for (let i = 1; i <= O; i++) assert.ok(VOICE.say['touche' + i], `message ${i} : consigne`);
  assert.ok(VOICE.say.bienvu && VOICE.say.presque);
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
