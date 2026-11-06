#!/usr/bin/env node
/* Voix off : des fichiers d’ElevenLabs (tools/voix/sortie/<cours>/, faits par generer.mjs) à la page du cours.
   node tools/voix/integrer.mjs <cours> [dossier des fichiers bruts]     (ffmpeg et ffprobe requis)

   - chaque chapitre est découpé phrase par phrase : le minutage d’ElevenLabs situe la phrase, les silences placent ses bords
     (la phrase commence et finit dans un silence, sans mordre sur la voisine, sans garder toute la pause qui suit) ;
   - chaque phrase va à sa légende (même texte, dans l’ordre), la clé de la légende est celle du moteur (vkey de core.js) ;
   - les fichiers sont réencodés en mono 64 kb/s dans assets/voix/<cours>/ ;
   - la page reçoit VOICE (entre les repères « Voix off » du fichier) et voice: VOICE dans Course({…}).
   --garder (6 novembre : une phrase refaite à part, tools/voix/<cours>-retouches.json) : un fichier absent du dossier garde ce que la
   page a déjà pour lui (ses phrases calées, sa consigne), et son .mp3 reste dans assets/voix/<cours>/.
   - enfin, le volume : chaque fichier ramené au niveau des chapitres du cours (tools/voix/volume.mjs, sans réencodage ; Elisa,
     6 novembre, 19 h 56 : « il faut que le son reste homogène avec le reste »). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {aToi} from './atoi-lib.mjs';
import {mesureFichier, planifier, regler} from './volume.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--')), GARDER = process.argv.includes('--garder');
const cours = ARGS[0];
if (!cours) { console.log('Usage : node tools/voix/integrer.mjs <cours> [dossier brut] [--garder]'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(path.join(DIR, cours + '.json'), 'utf8'));
const RAW = path.resolve(ARGS[1] || path.join(DIR, 'sortie', cours));
const OUT = path.join(ROOT, 'assets', 'voix', cours);
const PAGE = path.join(ROOT, 'assets', 'anim', cours + '.html');
const r3 = x => Math.round(x * 1000) / 1000;

/* Le moteur, pour la clé des légendes (vkey) : chargé comme dans les tests, sans navigateur. */
const ctx = vm.createContext({location: {search: ''}, URLSearchParams, gsap: {config() {}, timeline: () => ({})}, document: {}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'anim', 'core.js'), 'utf8'), ctx);
const vkey = vm.runInContext('vkey', ctx);

/* Les légendes de la page, telles que l’app les voit (APP). */
let page = fs.readFileSync(PAGE, 'utf8');
/* Les retouches (tools/voix/<cours>-retouches.json, intégrées avec --garder depuis tools/voix/sortie/<cours>-retouches) : les légendes
   (legendes) et les textes dits de la page (remplacements : une consigne « À toi ») qui changent avec leur voix sont posés ici, au
   moment où la voix refaite arrive, jamais avant : jusque-là, la page garde ses textes et la voix qui les dit (Elisa, 6 novembre,
   19 h 56 : « il faut que le son reste homogène »). Chaque texte doit s’y trouver une fois, ou être déjà posé. */
const RET_F = path.join(DIR, cours + '-retouches.json');
const RET = GARDER && path.basename(RAW) === cours + '-retouches' && fs.existsSync(RET_F) ? JSON.parse(fs.readFileSync(RET_F, 'utf8')) : null;
for (const [a, b] of RET ? [].concat(RET.legendes || [], RET.remplacements || []) : []) {
  const n = page.split(a).length - 1;
  if (n === 1) page = page.replace(a, () => b);
  else if (!(n === 0 && page.includes(b))) { console.log(`Retouche introuvable dans la page (${n} fois) : ${a}`); process.exit(1); }
}
/* Les cours qui posent leurs légendes avec cap(…) (DROP, schémas) : CAPTIONS = SCH.caps, rejoué depuis « const SCH = {». */
const CAPTIONS = page.includes('const CAPTIONS = [') ? (() => {
  const capSrc = page.slice(page.indexOf('const CAPTIONS = ['), page.indexOf('\n];', page.indexOf('const CAPTIONS = [')) + 3);
  return vm.runInContext(capSrc.replace('const CAPTIONS =', 'CAPTIONS =') + ';CAPTIONS', vm.createContext({APP: true, CAPTIONS: null})); })()
  : vm.runInContext(page.slice(page.indexOf('const SCH = {'), page.indexOf('\n', page.indexOf('const CAPTIONS = SCH.caps;'))) + ';CAPTIONS', vm.createContext({APP: true}));

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
   « finit » quand la suivante commence. La parole s’arrête donc dans ce silence, et la phrase suivante part à sa fin : chaque
   coupe tombe dans le silence, sans mordre sur la voisine, et sans garder toute la pause. La fin d’un mot (un « s », un « e »
   qui s’éteint) reste sous le seuil des silences : elle se cherche au quart de ce seuil, et la phrase garde encore 0,15 s
   après elle (Elisa, 31 octobre, 13 h 20 : « parfois à la fin des phrases le dernier mot est coupé »). */
function bounds(L, spans, dur){
  const S = silences(L), low = L.thr * 0.25, n = L.rms.length;
  const still = (i, k) => { for (let j = i; j < i + k; j++) if (j >= 0 && j < n && L.rms[j] >= low) return false; return true; };
  /* Dernière trame de voix au début de la pause [s0, s1] (au quart du seuil), et première trame de voix à sa fin. */
  const tail = (s0, s1) => { let last = Math.round(s0 * 100) - 1; for (let i = last + 1; i < Math.round(s1 * 100); i++) { if (L.rms[i] >= low) last = i; else if (still(i, 6)) break; } return (last + 1) / 100; };
  const head = (s0, s1) => { let first = Math.round(s1 * 100); for (let i = first - 1; i >= Math.round(s0 * 100); i--) { if (L.rms[i] >= low) first = i; else if (still(i - 5, 6)) break; } return first / 100; };
  /* La pause entre deux phrases : le silence qui finit là où la phrase suivante commence (le minutage situe bien les débuts ;
     la fin d’une phrase, lui, la place parfois avant sa dernière syllabe, et un « t » ou un « p » y fait un court silence). */
  /* Elisa, 2 novembre, 18 h 08 : « on perd la voix : "chh. Chaque colonne…" ». Le « ch » de « Chaque » est suivi d’un blanc de 80 ms
     avant « aque » : la coupe tombait dans ce blanc, au milieu du mot. Une vraie pause entre deux phrases dure au moins 0,15 s :
     la plus proche de ces pauses-là passe d’abord, un blanc plus court ne sert que s’il n’y en a pas. */
  const pause = t => { const c = S.filter(x => x[1] >= t - 0.45 && x[1] <= t + 0.15), near = (x, y) => Math.abs(x[1] - t) - Math.abs(y[1] - t);
    return c.filter(x => x[1] - x[0] >= 0.15).sort(near)[0] || c.filter(x => x[1] >= t - 0.3).sort(near)[0]; };
  const cuts = spans.map(([s], k) => k ? pause(s) : null);
  return spans.map(([s, e], k) => {
    const pre = k ? cuts[k] : pause(s), post = k + 1 < spans.length ? cuts[k + 1] : S.filter(x => x[0] >= e - 0.3 && x[1] >= dur - 0.05)[0];
    /* Sans silence devant (la voix enchaîne dès le début du fichier, dans la continuité du chapitre d’avant) : depuis le début. */
    let a = pre ? head(pre[0], pre[1]) - 0.06 : k ? (spans[k - 1][1] + s) / 2 : 0;
    let b = post ? Math.min(tail(post[0], post[1]) + 0.15, post[1] - 0.02) : k + 1 < spans.length ? (e + spans[k + 1][0]) / 2 : dur;
    /* Jamais avant la fin de la phrase d’avant, ni dans le premier mot : quand la phrase d’avant finit sur un souffle collé au mot
       suivant, sa « fin » est ce souffle, et 0,16 s après tombait dans le mot (rapport des voix, 4 novembre : 60 débuts coupés,
       « …faut donc associer »). Le début reste avant le premier son franc, pre[1]. */
    if (pre && k) a = Math.min(Math.max(a, tail(pre[0], pre[1]) + 0.16), pre[1] - 0.04);
    return [r3(Math.max(0, a)), r3(Math.min(dur, Math.max(b, a + 0.3)))];
  });
}
/* Début et fin de la parole d’un fichier court (consigne) : premier et dernier passage au-dessus du quart du seuil. */
function speech(L, dur){
  const low = L.thr * 0.25;
  let i = 0, j = L.rms.length - 1;
  while (i < j && L.rms[i] < low) i++;
  while (j > i && L.rms[j] < low) j--;
  return [r3(Math.max(0, i / 100 - 0.06)), r3(Math.min(dur, (j + 1) / 100 + 0.15))];
}
/* Minutage d’ElevenLabs : caractères et temps (timestamps, sinon alignement forcé). */
function timing(rec){
  const a = rec.alignment || rec.normalized_alignment;
  if (a && a.characters) return {chars: a.characters, st: a.character_start_times_seconds, en: a.character_end_times_seconds};
  if (rec.forced && rec.forced.characters) return {chars: rec.forced.characters.map(c => c.text), st: rec.forced.characters.map(c => c.start), en: rec.forced.characters.map(c => c.end)};
  return null;
}
/* Où est chaque phrase dans le minutage : recherche dans l’ordre, sur le texte réduit à ses lettres et chiffres. */
const brut = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function locate(T, phrases){
  let flat = '', idx = [];
  /* Elisa, 2 novembre, 20 h 10 : le minutage du chapitre 1 de « Types de données » restait incomplet : « N° » devenait « numero » dans
     la phrase (norm), mais « n » dans le minutage, lu lettre par lettre. Ici, les deux côtés sont réduits de la même façon, sans ces remplacements. */
  T.chars.forEach((c, i) => { for (const ch of brut(c)) { flat += ch; idx.push(i); } });
  let pos = 0;
  return phrases.map(p => {
    const q = brut(p);
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

/* La fin du « À toi ! » d’une consigne : la pause qui suit le « ! » (minutage d’ElevenLabs), sinon la première pause entre 0,4 et 1,6 s. */
function apresAToi(L, T, dur){
  const S = silences(L);
  let e = null;
  if (T) { const txt = T.chars.join(''), k = txt.indexOf('!'); if (k >= 0 && k < 20 && /toi/i.test(txt.slice(0, k))) e = T.en[k]; }
  /* ElevenLabs donne au « ! » la pause qui le suit : la pause cherchée finit près de ce temps (un peu avant ou après). */
  const p = e != null ? S.filter(x => x[0] >= 0.25 && x[1] >= e - 0.3 && x[0] <= e + 0.45).sort((x, y) => Math.abs(x[1] - e) - Math.abs(y[1] - e))[0]
    : S.find(x => x[0] >= 0.4 && x[0] <= 1.6);
  if (!p) return null;
  const low = L.thr * 0.25; let i = Math.round(p[1] * 100);
  while (i > Math.round(p[0] * 100) && L.rms[i - 1] >= low) i--;   // le début du mot suivant, au quart du seuil
  return r3(Math.max(0, i / 100 - 0.06));
}
const MOMENTS_JS = page.includes('src="moments.js"');
const ATOI_DIT = job.elements.some(el => /^ch\d/.test(el.id) && (el.phrases || []).some(ph => /^À toi\s*!$/.test(ph.trim())));
fs.mkdirSync(OUT, {recursive: true});
const caps = [], say = {}, toi = {}, report = [];
let intro = null, ci = 0, total = 0, bytes = 0, gardes = 0;
/* --garder : la voix off déjà dans la page (VOICE), pour les fichiers qui ne sont pas refaits */
const ANCIEN = GARDER && page.includes('/* Voix off (tools/voix/integrer.mjs') ? vm.runInContext(page.slice(page.indexOf('const VOICE = {'),
  page.indexOf('/* Fin de la voix off */')).replace('const VOICE =', 'VOICE =') + ';VOICE', vm.createContext({})) : null;
if (GARDER && !ANCIEN) { console.log('--garder : la page n’a pas encore de voix off ; rien n’est écrit.'); process.exit(1); }
function garde(el){
  if (!el.phrases) {
    if (!ANCIEN.say || !ANCIEN.say[el.id]) return false;
    say[el.id] = ANCIEN.say[el.id]; if (ANCIEN.toi && ANCIEN.toi[el.id]) toi[el.id] = ANCIEN.toi[el.id]; return true;
  }
  if (el.id === 'ch00') { intro = ANCIEN.intro; return !!intro; }
  const kept = (ANCIEN.caps || []).filter(c => c[1] === el.id);
  kept.forEach(c => { caps.push(c); const j = CAPTIONS.findIndex((x, k) => k >= ci && vkey(x[2]) === c[0]); if (j >= 0) ci = j + 1; });
  return kept.length > 0;
}
const capN = CAPTIONS.map(c => norm(plainCap(c[2])));
for (const el of job.elements) {
  const src = path.join(RAW, el.id + '.mp3'), recf = path.join(RAW, el.id + '.json');
  if (!fs.existsSync(src)) {
    if (ANCIEN && fs.existsSync(path.join(OUT, el.id + '.mp3')) && garde(el)) { gardes++; continue; }
    report.push(`${el.id} : fichier absent`); continue;
  }
  const rec = fs.existsSync(recf) ? JSON.parse(fs.readFileSync(recf, 'utf8')) : {};
  const dst = path.join(OUT, el.id + '.mp3');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', dst]);
  const dur = probe(dst), L = levels(dst);
  total += dur; bytes += fs.statSync(dst).size;
  if (!el.phrases) {
    const sp = speech(L, dur);
    /* Elisa, 2 novembre, 18 h 08 : « on a aussi une répétition de "à toi" ». Dans les projets, la légende « À toi ! » est déjà dite
       par le chapitre, juste avant le moment : la consigne part donc après son propre « À toi ! » (la pause qui suit le « ! »). */
    if (/^at\d/.test(el.id) && ATOI_DIT) { const t = apresAToi(L, timing(rec), dur); if (t != null && t < sp[1] - 0.5) sp[0] = t; }
    /* Elisa, 2 novembre, 19 h 53 : « Dans LEFT JOIN, par exemple, [la formatrice] ne dit pas à toi ». Dans les cours à moments
       (moments.js), la légende « À toi ! » dit le début de la consigne, la feuille la suite (VOICE.toi ; tools/voix/atoi.mjs). */
    if (/^at\d/.test(el.id) && !ATOI_DIT && MOMENTS_JS) { const t = aToi(L, timing(rec), dur, sp[0], sp[1]); if (t) toi[el.id] = t; }
    say[el.id] = [el.id].concat(sp); continue;
  }
  const T = timing(rec);
  let spans = T ? locate(T, el.phrases) : null;
  if (!spans || spans.some(x => !x)) { report.push(`${el.id} : minutage incomplet, découpage aux silences`); spans = bySilence(L, el.phrases.length, dur); }
  const clips = bounds(L, spans, dur);
  if (el.id === 'ch00') { intro = [el.id, clips[0][0], clips[clips.length - 1][1]]; continue; }
  /* Chaque phrase à sa légende : la plus ressemblante parmi les suivantes, dans l’ordre. */
  el.phrases.forEach((p, k) => {
    /* legendes : le texte de la légende quand la phrase dite en diffère (code lu à voix haute, preparer.mjs). */
    const q = norm((el.legendes && el.legendes[k]) || p); let best = -1, bs = 0;
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
  say: ${JSON.stringify(say)}${Object.keys(toi).length ? `,\n  toi: ${JSON.stringify(toi)}` : ''}};
/* Fin de la voix off */
`;
let out = page;
const a = out.indexOf('/* Voix off (tools/voix/integrer.mjs'), b = out.indexOf('/* Fin de la voix off */\n');
if (a >= 0 && b > a) out = out.slice(0, a) + block + out.slice(b + '/* Fin de la voix off */\n'.length);
else {
  /* Le moteur commun : avant Course({…}) ; where.html (son propre moteur) : avant window.__ready. */
  let at = out.lastIndexOf('\nCourse({'); if (at < 0) at = out.indexOf('\nwindow.__ready = (async () => {');
  if (at < 0) { console.log('Ni Course({…}) ni window.__ready dans la page : rien n’est écrit.'); process.exit(1); }
  out = out.slice(0, at + 1) + block + out.slice(at + 1);
}
/* voice: VOICE en fin de la première ligne de Course({…}) : son début reste celui que vérifient les tests. */
if (!/\bvoice: VOICE\b/.test(out)) out = out.replace(/(\nCourse\(\{[^\n]*,)\n/, '$1 voice: VOICE,\n');
fs.writeFileSync(PAGE, out);
console.log(`${caps.length} phrases calées sur ${CAPTIONS.length} légendes, intro ${intro ? r3(intro[2] - intro[1]) + ' s' : 'absente'}, ${Object.keys(say).length} phrases à part`);
console.log(`audio : ${Math.round(total)} s, ${Math.round(bytes / 1024)} Ko dans assets/voix/${cours}${gardes ? ` ; ${gardes} fichier${gardes > 1 ? 's' : ''} gardé${gardes > 1 ? 's' : ''} tel${gardes > 1 ? 's' : ''} quel${gardes > 1 ? 's' : ''}` : ''}`);
report.forEach(l => console.log('  · ' + l));

/* Le volume du cours : les phrases et les chapitres qui s’écartent de plus de 1,5 LU de la voix qui explique y sont ramenés, sans
   réencodage (gain global des trames MP3) ; deux passes au plus, la référence bougeant à peine quand un chapitre est réglé. */
let regles = 0, refVol = null;
for (let passe = 0; passe < 3; passe++) {
  const mes = {};
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.mp3'))) mes[f.slice(0, -4)] = mesureFichier(path.join(OUT, f));
  const {ref, plan} = planifier(mes), aFaire = plan.filter(p => p.crans);
  refVol = ref;
  if (!aFaire.length) break;
  for (const p of aFaire) { const f = path.join(OUT, p.id + '.mp3'); fs.writeFileSync(f, regler(fs.readFileSync(f), p.crans).buf); regles++; }
}
console.log(`volume : référence ${refVol.toFixed(1)} LUFS, ${regles} fichier${regles > 1 ? 's' : ''} ramené${regles > 1 ? 's' : ''} au niveau du cours`);
