/* Le « À toi ! » au début d’une consigne (at1.mp3…) : ce qu’utilisent atoi.mjs et integrer.mjs. Mêmes mesures que integrer.mjs :
   le niveau du son toutes les 10 ms, les silences d’au moins 80 ms. */
import {execFileSync} from 'node:child_process';
const r3 = x => Math.round(x * 1000) / 1000;
/* Niveau du son toutes les 10 ms (mono, 16 kHz). */
export function levels(f){
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2), F = 160, out = new Float32Array(Math.ceil(x.length / F));
  for (let i = 0; i < out.length; i++) { let s = 0, n = 0; for (let j = i * F; j < Math.min(x.length, (i + 1) * F); j++) { s += x[j] * x[j]; n++; } out[i] = Math.sqrt(s / Math.max(1, n)); }
  const sorted = Array.from(out).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)] || 0.1;
  return {rms: out, thr: Math.max(0.004, 0.07 * p95)};
}
export function silences(L){
  const out = []; let run = 0;
  for (let i = 0; i <= L.rms.length; i++) { if (i < L.rms.length && L.rms[i] < L.thr) run++; else { if (run >= 8) out.push([(i - run) / 100, i / 100]); run = 0; } }
  return out;
}
/* [fin du « À toi ! », début de la suite] en secondes : la pause qui suit le « ! » (minutage d’ElevenLabs T, s’il est là), sinon la
   première vraie pause (0,15 s au moins, sinon la première) entre 0,25 et 1,6 s après le début de la parole (a). La fin garde 0,12 s après le dernier son ; la suite part 0,06 s
   avant son premier son. Une consigne qui n’est que « À toi ! » : [b, b], tout pour la légende, rien pour la feuille.
   null : pas de pause nette (la consigne garde alors son « À toi ! »). */
export function aToi(L, T, dur, a = 0, b = dur){
  const S = silences(L), low = L.thr * 0.25;
  let e = null;
  if (T) { const txt = T.chars.join(''), k = txt.indexOf('!'); if (k >= 0 && k < 20 && /toi/i.test(txt.slice(0, k))) e = T.en[k]; }
  const p = e != null ? S.filter(x => x[0] >= 0.25 && x[1] >= e - 0.3 && x[0] <= e + 0.45).sort((x, y) => Math.abs(x[1] - e) - Math.abs(y[1] - e))[0]
    : (S.find(x => x[0] >= a + 0.25 && x[0] <= a + 1.6 && x[1] - x[0] >= 0.15) || S.find(x => x[0] >= a + 0.25 && x[0] <= a + 1.6));
  /* Une consigne qui n’est que « À toi ! » (rien après) : tout le fichier va à la légende. */
  if (!p) return b - a < 1.2 ? [r3(b), r3(b)] : null;
  if (p[0] >= b - 0.2) return [r3(b), r3(b)];
  let i = Math.round(p[1] * 100); while (i > Math.round(p[0] * 100) && L.rms[i - 1] >= low) i--;
  let j = Math.round(p[0] * 100) - 1; while (j < Math.round(p[1] * 100) && L.rms[j + 1] >= low) j++;
  const fin = r3(Math.min((j + 1) / 100 + 0.12, i / 100 - 0.02)), suite = r3(Math.max(fin, i / 100 - 0.06));
  return fin > a + 0.2 ? suite < b - 0.5 ? [fin, suite] : [r3(b), r3(b)] : null;
}
