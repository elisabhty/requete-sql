#!/usr/bin/env node
/* Voix off : un volume homogène dans chaque cours, sans réencoder (Elisa, 6 novembre, 19 h 56 : « tu peux baisser mais il faut que
   le son reste homogène avec le reste »).
   node tools/voix/volume.mjs [cours…] [--appliquer] [--json fichier]     (ffmpeg requis pour mesurer)

   - La mesure : le volume perçu de chaque fichier (EBU R128, LUFS intégré) et sa crête vraie (dBTP), avec ffmpeg.
   - La référence d’un cours : la médiane de ses chapitres (ch01, ch02…), c’est-à-dire la voix qui explique.
   - Les phrases jouées à part (« À toi ! », « Bien vu ! », « Bravo ! », les indices, « Touche… », les liens avec les leçons voisines)
     visent la référence + 0,5 LU (une phrase courte, sans pause, se mesure un peu plus haut qu’elle ne s’entend) ; un chapitre (et
     l’ouverture, ch00), la référence. Un fichier n’est touché que s’il s’en écarte de plus de 1,5 LU : en dessous, l’oreille ne fait
     pas la différence.
   - Le réglage : le gain global de chaque granule MP3 (1,5 dB par cran, comme mp3gain). Le son n’est pas réencodé : même qualité,
     même taille, même minutage (les tables VOICE restent justes). Une phrase trop basse n’est remontée que si sa crête reste sous
     −1 dBTP.
   - D’un cours à l’autre : un cours dont la voix dépasse de plus de 1,5 LU le niveau commun (CIBLE, −29 LUFS : celui des premiers
     cours) y est baissé en entier, du même nombre de crans pour tous ses fichiers ; un cours n’est jamais remonté.
   Sans --appliquer : le plan seul, rien n’est écrit. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const VOIX = path.join(ROOT, 'assets', 'voix');
export const CRAN = 1.505;            // un cran de gain global MP3 : 2^(1/4), soit 1,505 dB
export const SEUIL = 1.5, PHRASE = 0.5, CRETE_MAX = -1.0;
/* Le niveau commun des cours : celui des premiers cours (Agathe, Adam : −29 LUFS). Un cours plus fort de plus de 1,5 LU y est
   baissé en entier (le même nombre de crans pour tous ses fichiers) : d’un cours à l’autre, la voix garde le même volume. Un cours
   n’est jamais remonté (« tu peux baisser ») : les premiers cours restent tels qu’Elisa les a validés. */
export const CIBLE = -29;

/* ---------- Mesure ---------- */
/* ffmpeg écrit son bilan sur la sortie d’erreur. */
export function mesureFichier(f){
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
  return mesureDe(r.stderr || '');
}
function mesureDe(out){
  const I = [...out.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].map(m => +m[1]), P = [...out.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].map(m => m[1] === '-inf' ? -120 : +m[1]);
  return {lufs: I.length ? I[I.length - 1] : null, crete: P.length ? P[P.length - 1] : null};
}

/* ---------- Le plan d’un cours ---------- */
export const estChapitre = id => /^ch\d+$/.test(id);
export const estExplication = id => /^ch(0[1-9]|[1-9]\d)$/.test(id);
const mediane = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
/* mesures : {id: {lufs, crete}} → {ref, decalage, plan: [{id, ecart, cible, crans, gain, apres, crete, raison}]}
   ecart et apres : par rapport à la voix du cours (ref) ; decalage : les crans de tout le cours vers le niveau commun (niveau). */
export function planifier(mesures, {niveau = CIBLE} = {}){
  const ids = Object.keys(mesures).filter(id => mesures[id].lufs != null && mesures[id].lufs > -70);
  const ref = mediane(ids.filter(estExplication).map(id => mesures[id].lufs)) ?? mediane(ids.map(id => mesures[id].lufs));
  const decalage = niveau == null || ref - niveau <= SEUIL ? 0 : Math.round((niveau - ref) / CRAN);
  const plan = [];
  for (const id of ids.sort()) {
    const {lufs, crete} = mesures[id], ecart = +(lufs - ref).toFixed(2), cible = estChapitre(id) ? 0 : PHRASE;
    let crans = (Math.abs(ecart - cible) > SEUIL ? Math.round((cible - ecart) / CRAN) : 0) + decalage;
    if (!crans) continue;
    if (crans > 0) while (crans > 0 && crete + crans * CRAN > CRETE_MAX) crans--;   // remonter sans approcher la saturation
    if (!crans) { plan.push({id, ecart, cible, crans: 0, gain: 0, apres: ecart, crete, raison: 'crête trop haute pour remonter'}); continue; }
    const gain = +(crans * CRAN).toFixed(2);
    plan.push({id, ecart, cible, crans, gain, apres: +(ecart + gain - decalage * CRAN).toFixed(2), crete, cretApres: +(crete + gain).toFixed(1)});
  }
  return {ref: +ref.toFixed(2), decalage, plan};
}

/* ---------- Le gain global des granules (MPEG-1 couche III) ---------- */
const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0], SR1 = [44100, 48000, 32000, 0];
function bits(b, s, off, n){ let v = 0; for (let k = 0; k < n; k++) { const x = off + k; v = (v << 1) | ((b[s + (x >> 3)] >> (7 - (x & 7))) & 1); } return v; }
function poser(b, s, off, n, v){ for (let k = 0; k < n; k++) { const x = off + k, i = s + (x >> 3), sh = 7 - (x & 7); b[i] = (b[i] & ~(1 << sh)) | (((v >> (n - 1 - k)) & 1) << sh); } }
/* Les positions du gain global dans les informations annexes d’une trame : mono, 2 granules (bits 39 et 98) ; stéréo, 2 × 2. */
const GG = {mono: [39, 98], stereo: [42, 101, 150, 209]};
export function regler(buf, crans){
  const b = Buffer.from(buf);
  let i = 0, trames = 0, butees = 0;
  if (b.slice(0, 3).toString('latin1') === 'ID3') i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f)) + (b[5] & 0x10 ? 10 : 0);
  let premiere = true;
  while (i + 4 <= b.length) {
    const h = b.readUInt32BE(i);
    if ((h >>> 21) !== 0x7ff) break;                                   // fin des trames (étiquette ID3v1, APE…)
    const ver = (h >>> 19) & 3, lay = (h >>> 17) & 3, prot = (h >>> 16) & 1, br = BR1[(h >>> 12) & 15], sr = SR1[(h >>> 10) & 3], pad = (h >>> 9) & 1, mode = (h >>> 6) & 3;
    if (ver !== 3 || lay !== 1 || !br || !sr) throw new Error('trame inattendue (seul le MPEG-1 couche III est pris en charge)');
    if (!prot) throw new Error('trames protégées par CRC : non prises en charge');
    const len = Math.floor(144000 * br / sr) + pad, s = i + 4, mono = mode === 3, tag = b.slice(s + (mono ? 17 : 32), s + (mono ? 21 : 36)).toString('latin1');
    if (premiere && (tag === 'Info' || tag === 'Xing')) { premiere = false; i += len; continue; }   // la trame d’en-tête LAME : pas de son
    premiere = false;
    for (const off of GG[mono ? 'mono' : 'stereo']) {
      const g = bits(b, s, off, 8), n = Math.max(0, Math.min(255, g + crans));
      if (n !== g + crans) butees++;
      poser(b, s, off, 8, n);
    }
    trames++; i += len;
  }
  if (!trames) throw new Error('aucune trame MP3');
  return {buf: b, trames, butees};
}

/* ---------- Vérification : le son réglé est le son d’origine, multiplié par le gain ---------- */
const pcm = f => { const o = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-'], {maxBuffer: 1 << 30}); return new Float32Array(o.buffer, o.byteOffset, o.length / 4); };
export function verifier(avant, apres, crans){
  const a = pcm(avant), b = pcm(apres), k = Math.pow(2, crans / 4);
  if (a.length !== b.length) return {ok: false, raison: `durée changée (${a.length} → ${b.length} échantillons)`};
  let e = 0, s = 0;
  for (let i = 0; i < a.length; i++) { const d = b[i] - a[i] * k; e += d * d; s += (a[i] * k) ** 2; }
  const snr = s ? 10 * Math.log10(s / Math.max(e, 1e-20)) : 120;
  return {ok: snr > 60, snr: +snr.toFixed(1), echantillons: a.length};
}

/* ---------- Ligne de commande ---------- */
const lancer = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lancer) {
  const args = process.argv.slice(2), opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const appliquer = args.includes('--appliquer'), sortie = opt('--json');
  const cours = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
  const liste = cours.length ? cours : fs.readdirSync(VOIX).filter(c => fs.statSync(path.join(VOIX, c)).isDirectory()).sort();
  const bilan = {};
  let touches = 0;
  for (const c of liste) {
    const d = path.join(VOIX, c);
    if (!fs.existsSync(d)) { console.log(`${c} : pas de dossier assets/voix/${c}`); continue; }
    const fichiers = fs.readdirSync(d).filter(f => f.endsWith('.mp3')).sort(), mesures = {};
    for (const f of fichiers) mesures[f.slice(0, -4)] = mesureFichier(path.join(d, f));
    const {ref, decalage, plan} = planifier(mesures);
    bilan[c] = {ref, decalage, plan};
    const faits = plan.filter(p => p.crans), dec = decalage ? `, tout le cours ${decalage > 0 ? '+' : ''}${(decalage * CRAN).toFixed(1)} dB vers ${CIBLE} LUFS` : '';
    console.log(`${c} : référence ${ref.toFixed(1)} LUFS${dec}, ${faits.length} fichier${faits.length > 1 ? 's' : ''} à régler` +
      (faits.length && !decalage ? ' — ' + faits.map(p => `${p.id} ${p.ecart > 0 ? '+' : ''}${p.ecart.toFixed(1)} → ${p.apres > 0 ? '+' : ''}${p.apres.toFixed(1)}`).join(', ') : '') +
      (plan.some(p => !p.crans) ? ` ; ${plan.filter(p => !p.crans).length} laissé(s) : crête trop haute pour remonter` : ''));
    if (!appliquer) continue;
    for (const p of faits) {
      const f = path.join(d, p.id + '.mp3'), tmp = f + '.tmp.mp3', avant = fs.readFileSync(f);
      const {buf, butees} = regler(avant, p.crans);
      fs.writeFileSync(tmp, buf);
      const v = verifier(f, tmp, p.crans);
      if (!v.ok) { fs.unlinkSync(tmp); throw new Error(`${c}/${p.id} : vérification ratée (${v.raison || 'écart ' + v.snr + ' dB'})`); }
      fs.renameSync(tmp, f);
      const m = mesureFichier(f);
      Object.assign(p, {mesureApres: m, butees, snr: v.snr});
      touches++;
    }
  }
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(bilan, null, 1));
  if (appliquer) console.log(`\n${touches} fichier${touches > 1 ? 's' : ''} réglé${touches > 1 ? 's' : ''}, sans réencodage.`);
}
