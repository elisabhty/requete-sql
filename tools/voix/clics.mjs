#!/usr/bin/env node
/* Voix off : le petit « tic » à la fin de certaines phrases (contrôle automatique des voix, Elisa, 10 novembre, 10 h 03).
   node tools/voix/clics.mjs liste.json [--souffle] [--appliquer]       liste.json : [["cours","fichier"], …]  (ffmpeg requis pour vérifier)

   Après le silence de fin, la toute dernière trame MP3 de ces fichiers rejouait un bref éclat (5 ms, entre −48 et −32 dB, après un
   silence sous −55 dB) : un « tic » à l’oreille, juste avant la phrase suivante. La correction met à zéro le gain global des deux
   granules de cette dernière trame (comme volume.mjs, sans réencoder) : la trame devient muette, la durée et le minutage ne
   changent pas, le reste du son est identique à l’échantillon près (vérifié). */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0], SR1 = [44100, 48000, 32000, 0];
const GG = {mono: [39, 98], stereo: [42, 101, 150, 209]};
function poser(b, s, off, n, v){ for (let k = 0; k < n; k++) { const x = off + k, i = s + (x >> 3), sh = 7 - (x & 7); b[i] = (b[i] & ~(1 << sh)) | (((v >> (n - 1 - k)) & 1) << sh); } }

/* Les trames audio d’un fichier : [début, longueur, mono]. */
function trames(b){
  let i = 0; const t = [];
  if (b.slice(0, 3).toString('latin1') === 'ID3') i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f)) + (b[5] & 0x10 ? 10 : 0);
  let premiere = true;
  while (i + 4 <= b.length) {
    const h = b.readUInt32BE(i);
    if ((h >>> 21) !== 0x7ff) break;
    const ver = (h >>> 19) & 3, lay = (h >>> 17) & 3, prot = (h >>> 16) & 1, br = BR1[(h >>> 12) & 15], sr = SR1[(h >>> 10) & 3], pad = (h >>> 9) & 1, mode = (h >>> 6) & 3;
    if (ver !== 3 || lay !== 1 || !br || !sr || !prot) throw new Error('trame inattendue');
    const len = Math.floor(144000 * br / sr) + pad, mono = mode === 3, tag = b.slice(i + 4 + (mono ? 17 : 32), i + 4 + (mono ? 21 : 36)).toString('latin1');
    if (!(premiere && (tag === 'Info' || tag === 'Xing'))) t.push([i, len, mono]);
    premiere = false; i += len;
  }
  return t;
}
export function muetteFin(buf, k = 1){
  const b = Buffer.from(buf), t = trames(b);
  if (t.length <= k) throw new Error('trop peu de trames');
  for (const [i, , mono] of t.slice(-k)) for (const off of GG[mono ? 'mono' : 'stereo']) poser(b, i + 4, off, 8, 0);
  return b;
}
const pcm = f => { const o = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '44100', '-'], {maxBuffer: 1 << 30}); return new Float32Array(o.buffer, o.byteOffset, o.length / 4); };
const rms = (x, a, z) => { let s = 0; for (let k = a; k < z; k++) s += x[k] * x[k]; return 20 * Math.log10(Math.sqrt(s / Math.max(1, z - a)) + 1e-9); };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [liste] = process.argv.slice(2).filter(a => !a.startsWith('--')), go = process.argv.includes('--appliquer');
  for (const [cours, id] of JSON.parse(fs.readFileSync(liste, 'utf8'))) {
    const f = path.join(ROOT, 'assets', 'voix', cours, id + '.mp3'), tmp = path.join('/tmp', `clic-${cours}-${id}.mp3`);
    const a = pcm(f), avant = rms(a, a.length - 220, a.length);
    /* Le moins de trames possible (une, puis deux, puis trois) : l’éclat peut venir de l’avant-dernière trame. Une trame n’est rendue
       muette que si le son d’origine y est déjà silencieux (sous −50 dB), en dehors de l’éclat lui-même. */
    let ok = null;
    /* --souffle : un bruit plus long (souffle, début de syllabe : jusqu’à 200 ms) qui arrive après la phrase, séparé d’elle par au
       moins 80 ms de silence (sous −70 dB). Les trames qui le portent sont rendues muettes. */
    if (process.argv.includes('--souffle')) {
      let d = a.length; while (d - 441 > 0 && rms(a, d - 441, d) > -65) d -= 441;
      const silence = rms(a, Math.max(0, d - 3528), d), long = a.length - d;
      if (silence < -70 && long > 0 && long <= 8820) {
        const k = Math.ceil(long / 1152) + 1;
        fs.writeFileSync(tmp, muetteFin(fs.readFileSync(f), k));
        const n = pcm(tmp), zone = a.length - (k + 1) * 1152;
        if (a.length !== n.length) throw new Error(`${cours}/${id} : la durée a changé`);
        let diff = 0; for (let j = 0; j < zone; j++) diff = Math.max(diff, Math.abs(a[j] - n[j]));
        if (diff > 1e-6) throw new Error(`${cours}/${id} : le son a changé avant la fin`);
        const apres = rms(n, d, n.length);
        if (apres < -60) ok = {k, apres};
      }
    }
    for (let k = 1; k <= 3 && !ok; k++) {
      const zone = a.length - (k + 1) * 1152;
      if (rms(a, Math.max(0, zone), a.length - 220) > -50) break;
      fs.writeFileSync(tmp, muetteFin(fs.readFileSync(f), k));
      const n = pcm(tmp);
      if (a.length !== n.length) throw new Error(`${cours}/${id} : la durée a changé`);
      let diff = 0; for (let j = 0; j < zone; j++) diff = Math.max(diff, Math.abs(a[j] - n[j]));
      if (diff > 1e-6) throw new Error(`${cours}/${id} : le son a changé avant la fin`);
      const apres = rms(n, n.length - 441, n.length);
      if (apres < -60) ok = {k, apres};
    }
    console.log(`${cours}/${id} : fin ${avant.toFixed(1)} dB → ${ok ? `${ok.apres.toFixed(1)} dB (${ok.k} trame${ok.k > 1 ? 's' : ''})` : 'inchangé (pas de silence assez long avant l’éclat)'}`);
    if (go && ok) fs.copyFileSync(tmp, f);
  }
}
