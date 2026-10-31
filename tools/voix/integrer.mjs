#!/usr/bin/env node
/* Voix off : des fichiers d’ElevenLabs (tools/voix/sortie/<cours>/, faits par generer.mjs) à la page du cours.
   node tools/voix/integrer.mjs <cours> [dossier des fichiers bruts]     (ffmpeg et ffprobe requis)

   - chaque chapitre est découpé phrase par phrase : le minutage d’ElevenLabs situe la phrase, les silences placent ses bords
     (la phrase commence et finit dans un silence, sans mordre sur la voisine, sans garder toute la pause qui suit) ;
   - chaque phrase va à sa légende (même texte, dans l’ordre), la clé de la légende est celle du moteur (vkey de core.js) ;
   - les fichiers sont réencodés en mono 64 kb/s dans assets/voix/<cours>/ ;
   - la page reçoit VOICE (entre les repères « Voix off » du fichier) et voice: VOICE dans Course({…}). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const cours = process.argv[2];
if (!cours) { console.log('Usage : node tools/voix/integrer.mjs <cours> [dossier brut]'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(path.join(DIR, cours + '.json'), 'utf8'));
const RAW = path.resolve(process.argv[3] || path.join(DIR, 'sortie', cours));
const OUT = path.join(ROOT, 'assets', 'voix', cours);
const PAGE = path.join(ROOT, 'assets', 'anim', cours + '.html');
const r3 = x => Math.round(x * 1000) / 1000;

/* Le moteur, pour la clé des légendes (vkey) : chargé comme dans les tests, sans navigateur. */
const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'anim', 'core.js'), 'utf8'), ctx);
const vkey = vm.runInContext('vkey', ctx);

/* Les légendes de la page, telles que l’app les voit (APP). */
const page = fs.readFileSync(PAGE, 'utf8');
const capSrc = page.slice(page.indexOf('const CAPTIONS = ['), page.indexOf('\n];', page.indexOf('const CAPTIONS = [')) + 3);
const CAPTIONS = vm.runInContext(capSrc.replace('const CAPTIONS =', 'CAPTIONS =') + ';CAPTIONS', vm.createContext({APP: true, CAPTIONS: null}));

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/client_id/g, 'client underscore id').replace(/produit_id/g, 'produit underscore id').replace(/select \*/g, 'select etoile')
  .replace(/clients\.id/g, 'clients point id').replace(/produits\.id/g, 'produits point id').replace(/\bemail\b/g, 'e mail').replace(/n°/g, 'numero ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const plainCap = h => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
function sim(a, b){   // ressemblance de deux textes (0 à 1), sur les bigrammes
  const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let inter = 0, n = 0;
  A.forEach((v, k) => { inter += Math.min(v, B.get(k) || 0); n += v; }); B.forEach(v => { n += v; });
  return n ? 2 * inter / n : 0;
}

function probe(f){ return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim(); }
/* Niveau du son toutes les 10 ms (mono, 16 kHz). */
function levels(f){
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2), F = 160, out = new Float32Array(Math.ceil(x.length / F));
  for (let i = 0; i < out.length; i++) { let s = 0, n = 0; for (let j = i * F; j < Math.min(x.length, (i + 1) * F); j++) { s += x[j] * x[j]; n++; } out[i] = Math.sqrt(s / Math.max(1, n)); }
  const sorted = Array.from(out).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)] || 0.1;
  return {rms: out, thr: Math.max(0.004, 0.07 * p95)};
}
/* Silences d’au moins 80 ms : [début, fin] en secondes. */
function silences(L){
  const out = []; let run = 0;
  for (let i = 0; i <= L.rms.length; i++) { if (i < L.rms.length && L.rms[i] < L.thr) run++; else { if (run >= 8) out.push([(i - run) / 100, i / 100]); run = 0; } }
  return out;
}
/* Bords des phrases d’un chapitre. Le minutage d’ElevenLabs donne à la ponctuation finale le silence qui suit : une phrase
   « finit » quand la suivante commence. La parole s’arrête donc au début de ce silence, et la phrase suivante part à sa fin :
   chaque coupe tombe dans le silence, sans mordre sur la voisine, et sans garder la pause entière (0,12 s après la voix). */
function bounds(L, spans, dur){
  const S = silences(L);
  const near = (t, lo, hi, end) => S.filter(x => x[end] >= t + lo && x[end] <= t + hi).sort((x, y) => Math.abs(x[end] - t) - Math.abs(y[end] - t))[0];
  const out = spans.map(([s, e], k) => {
    const pre = near(s, -0.3, 0.15, 1), post = near(e, -0.15, 0.3, 1);
    /* Sans silence devant (la voix enchaîne dès le début du fichier, dans la continuité du chapitre d’avant) : depuis le début. */
    const a = pre ? pre[1] - 0.05 : k ? s - 0.05 : 0;
    const b = post && post[0] > s + 0.2 ? Math.min(post[0] + 0.12, post[1] - 0.02) : e + 0.05;
    return [a, b];
  });
  out.forEach((c, k) => {
    c[0] = Math.max(0, c[0], k ? out[k - 1][1] + 0.01 : 0);
    c[1] = Math.min(dur, c[1], k + 1 < out.length ? Math.max(c[0] + 0.3, spans[k + 1][0] - 0.03) : dur);
  });
  return out.map(([a, b]) => [r3(a), r3(b)]);
}
/* Début et fin de la parole d’un fichier court (consigne) : premier et dernier passage au-dessus du seuil. */
function speech(L, dur){
  let i = 0, j = L.rms.length - 1;
  while (i < j && L.rms[i] < L.thr) i++;
  while (j > i && L.rms[j] < L.thr) j--;
  return [r3(Math.max(0, i / 100 - 0.05)), r3(Math.min(dur, (j + 1) / 100 + 0.08))];
}
/* Minutage d’ElevenLabs : caractères et temps (timestamps, sinon alignement forcé). */
function timing(rec){
  const a = rec.alignment || rec.normalized_alignment;
  if (a && a.characters) return {chars: a.characters, st: a.character_start_times_seconds, en: a.character_end_times_seconds};
  if (rec.forced && rec.forced.characters) return {chars: rec.forced.characters.map(c => c.text), st: rec.forced.characters.map(c => c.start), en: rec.forced.characters.map(c => c.end)};
  return null;
}
/* Où est chaque phrase dans le minutage : recherche dans l’ordre, sur le texte réduit à ses lettres et chiffres. */
function locate(T, phrases){
  let flat = '', idx = [];
  T.chars.forEach((c, i) => { for (const ch of norm(c).replace(/ /g, '')) { flat += ch; idx.push(i); } });
  let pos = 0;
  return phrases.map(p => {
    const q = norm(p).replace(/ /g, '');
    let k = flat.indexOf(q, pos);
    if (k < 0) {   // texte prononcé un peu différent : début et fin cherchés séparément
      const h = flat.indexOf(q.slice(0, 14), pos), t = h >= 0 ? flat.indexOf(q.slice(-14), h) : -1;
      if (h < 0 || t < 0) return null;
      pos = t + 14; return [T.st[idx[h]], T.en[idx[t + 13]]];
    }
    pos = k + q.length;
    return [T.st[idx[k]], T.en[idx[k + q.length - 1]]];
  });
}
/* Sans minutage : les phrases séparées par les plus longs silences. */
function bySilence(L, n, dur){
  const gaps = []; let run = 0;
  for (let i = 0; i < L.rms.length; i++) { if (L.rms[i] < L.thr) run++; else { if (run >= 15) gaps.push([i - run, i]); run = 0; } }
  const cut = gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, n - 1).sort((x, y) => x[0] - y[0]);
  const out = []; let a = 0;
  cut.forEach(([g0, g1]) => { out.push([a, g0 / 100]); a = g1 / 100; });
  out.push([a, dur]);
  return out;
}

fs.mkdirSync(OUT, {recursive: true});
const caps = [], say = {}, report = [];
let intro = null, ci = 0, total = 0, bytes = 0;
const capN = CAPTIONS.map(c => norm(plainCap(c[2])));
for (const el of job.elements) {
  const src = path.join(RAW, el.id + '.mp3'), recf = path.join(RAW, el.id + '.json');
  if (!fs.existsSync(src)) { report.push(`${el.id} : fichier absent`); continue; }
  const rec = fs.existsSync(recf) ? JSON.parse(fs.readFileSync(recf, 'utf8')) : {};
  const dst = path.join(OUT, el.id + '.mp3');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', dst]);
  const dur = probe(dst), L = levels(dst);
  total += dur; bytes += fs.statSync(dst).size;
  if (!el.phrases) { say[el.id] = [el.id].concat(speech(L, dur)); continue; }
  const T = timing(rec);
  let spans = T ? locate(T, el.phrases) : null;
  if (!spans || spans.some(x => !x)) { report.push(`${el.id} : minutage incomplet, découpage aux silences`); spans = bySilence(L, el.phrases.length, dur); }
  const clips = bounds(L, spans, dur);
  if (el.id === 'ch00') { intro = [el.id, clips[0][0], clips[clips.length - 1][1]]; continue; }
  /* Chaque phrase à sa légende : la plus ressemblante parmi les suivantes, dans l’ordre. */
  el.phrases.forEach((p, k) => {
    const q = norm(p); let best = -1, bs = 0;
    for (let j = ci; j < Math.min(CAPTIONS.length, ci + 4); j++) { const v = sim(q, capN[j]); if (v > bs) { bs = v; best = j; } }
    if (best < 0 || bs < 0.8) { report.push(`${el.id} · phrase ${k + 1} sans légende (${Math.round(bs * 100)} %) : ${p}`); return; }
    ci = best + 1;
    caps.push([vkey(CAPTIONS[best][2]), el.id].concat(clips[k]));
  });
}

const lines = caps.map(c => '    ' + JSON.stringify(c)).join(',\n');
const block = `/* Voix off (tools/voix/integrer.mjs, voix ${job.voix.nom} d’ElevenLabs, ${job.modele}) : chaque phrase calée sur sa légende,
   [clé de la légende, fichier, début, fin] en secondes ; say : les phrases dites à part (consignes « À toi », réactions, indices). */
const VOICE = {dir: '../voix/${cours}/', intro: ${JSON.stringify(intro)},
  caps: [
${lines}],
  say: ${JSON.stringify(say)}};
/* Fin de la voix off */
`;
let out = page;
const a = out.indexOf('/* Voix off (tools/voix/integrer.mjs'), b = out.indexOf('/* Fin de la voix off */\n');
if (a >= 0 && b > a) out = out.slice(0, a) + block + out.slice(b + '/* Fin de la voix off */\n'.length);
else { const at = out.lastIndexOf('\nCourse({'); out = out.slice(0, at + 1) + block + out.slice(at + 1); }
/* voice: VOICE en fin de la première ligne de Course({…}) : son début reste celui que vérifient les tests. */
if (!/\bvoice: VOICE\b/.test(out)) out = out.replace(/(\nCourse\(\{[^\n]*,)\n/, '$1 voice: VOICE,\n');
fs.writeFileSync(PAGE, out);
console.log(`${caps.length} phrases calées sur ${CAPTIONS.length} légendes, intro ${intro ? r3(intro[2] - intro[1]) + ' s' : 'absente'}, ${Object.keys(say).length} phrases à part`);
console.log(`audio : ${Math.round(total)} s, ${Math.round(bytes / 1024)} Ko dans assets/voix/${cours}`);
report.forEach(l => console.log('  · ' + l));
