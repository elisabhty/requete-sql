/* Voix off : le souffle d’avant une phrase reste avec elle (Elisa, 13 novembre, 13 h 19, « Les bases de données relationnelles » :
   « il y a un trou : clients, commandes et produits. Coupure. Elle est gérée… »).

   Un chapitre est un seul fichier, découpé phrase par phrase (integrer.mjs). Entre deux phrases, la voix d’ElevenLabs reprend
   parfois son souffle (0,1 à 0,3 s, sans voix), ou attaque un « s » ou un « f » plus bas que le seuil des silences. Quand la coupe
   tombait après ce souffle, il restait à la fin de la phrase d’avant : « …et produits. », un souffle, puis, la vidéo laissant sa
   pause, près d’une seconde de silence avant « Elle est gérée… », dite sans lui. On entend une respiration qui ne mène nulle part,
   ou un début de mot qui part avec la phrase d’avant (« …tables. s » … « Si… »).

   La règle : un son faible (au-dessus du quart du seuil, sous le double du seuil) qui précède de 0,35 s au plus le début franc d’une
   phrase, séparé de la phrase d’avant par au moins 0,1 s de vrai silence, appartient à la phrase qui suit. La coupe passe juste
   avant lui : la phrase d’avant s’arrête dans le silence (la fin de son dernier mot est déjà sous le quart du seuil), la suivante
   commence par son souffle, comme dans l’enregistrement. Rien n’est rendu muet : le son change seulement de phrase.

   Utilisé par integrer.mjs (chaque intégration) et par souffles.mjs (la correction des pages déjà intégrées). */
import {execFileSync} from 'node:child_process';

const r3 = x => Math.round(x * 1000) / 1000;

/* Niveau du son toutes les 10 ms (mono, 16 kHz), et le seuil des silences : 7 % du niveau que dépassent 5 % des trames. */
export function levels(f){
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length >> 2), F = 160, out = new Float32Array(Math.ceil(x.length / F));
  for (let i = 0; i < out.length; i++) { let s = 0, n = 0; for (let j = i * F; j < Math.min(x.length, (i + 1) * F); j++) { s += x[j] * x[j]; n++; } out[i] = Math.sqrt(s / Math.max(1, n)); }
  const sorted = Array.from(out).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)] || 0.1;
  return {rms: out, thr: Math.max(0.004, 0.07 * p95)};
}

/* Le son faible collé au début de la phrase q (en secondes), s’il en a un : [début, fin], sinon null.
   L : levels() du fichier ; p, q : [début, fin] de deux phrases qui se suivent dans ce fichier. */
export function souffleAvant(L, p, q){
  const {rms, thr} = L, low = thr * 0.25, n = rms.length;
  /* le début franc de q : la première trame au-dessus du seuil, à partir de son début */
  let on = Math.max(0, Math.round(q[0] * 100)); const max = Math.min(n, Math.round(q[1] * 100));
  while (on < max && rms[on] < thr) on++;
  if (on >= max) return null;
  /* le dernier son faible avant lui, à 0,35 s au plus */
  let fin = on - 1; while (fin > 0 && rms[fin] < low && on - fin <= 35) fin--;
  if (fin <= 0 || rms[fin] < low) return null;
  /* son début, à travers des creux de 20 ms au plus */
  let debut = fin, creux = 0;
  for (let j = fin - 1; j > 0; j--) { if (rms[j] >= low) { debut = j; creux = 0; } else if (++creux > 2) break; }
  /* devant lui, au moins 0,1 s de vrai silence : il n’est pas la fin du dernier mot de p */
  let s = 0; for (let j = debut - 1; j >= 0 && rms[j] < low; j--) s++;
  if (s < 10 || fin - debut + 1 < 3) return null;
  /* pas de voix : jamais au-dessus du double du seuil */
  let haut = 0; for (let j = debut; j <= fin; j++) haut = Math.max(haut, rms[j]);
  if (haut >= 2 * thr) return null;
  const t0 = debut / 100;
  if (t0 < p[0] + 0.3) return null;
  return [r3(t0), r3((fin + 1) / 100)];
}

/* Les phrases d’un fichier, [début, fin] dans l’ordre : chaque souffle rendu à la phrase qu’il précède.
   Rend {clips, changes} ; changes : [{k, son, avant, apres}], k étant l’indice de la phrase qui reçoit son souffle. */
export function souffles(L, clips){
  const out = clips.map(c => c.slice()), changes = [];
  for (let k = 1; k < out.length; k++) {
    const p = out[k - 1], q = out[k], son = souffleAvant(L, p, q);
    if (!son || p[1] <= son[0] + 0.03) continue;   // la phrase d’avant s’arrête déjà avant lui
    const coupe = r3(son[0] - 0.03), avant = [p[1], q[0]];
    p[1] = coupe;
    if (q[0] > coupe) q[0] = coupe;
    changes.push({k, son, avant, apres: [p[1], q[0]]});
  }
  return {clips: out, changes};
}
