#!/usr/bin/env node
/* Voix off et musique de la vidéo du site (decouvrir/video.html), Elisa, 2 novembre 2026.
   À lancer une fois les fichiers générés :   node tools/voix/integrer-site.mjs [dossier]
   (dossier : par défaut tools/voix/sortie/video-site). Copie chaque phrase (sNN.mp3) et la musique (musique.mp3) dans
   decouvrir/voix/, mesure leur durée (ffprobe) et écrit decouvrir/voix/voix.json : {scenes: [{id, t, fin, d}], musique: {d}}.
   t = début de la scène + 0,35 s (la scène est apparue), fin = début de la scène suivante (la fin de la vidéo pour la dernière).
   La page arrête l’image juste avant la fin d’une scène dont la phrase est plus longue qu’elle.
   Retouches (6 novembre : tools/voix/video-site-retouches.json, deux phrases refaites) : une phrase absente du dossier garde le
   fichier déjà intégré dans decouvrir/voix/, et la musique aussi ; seule une phrase qui n’existe nulle part arrête tout. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(DIR, '..', '..');
const job = JSON.parse(fs.readFileSync(path.join(DIR, 'video-site.json'), 'utf8'));
const src = process.argv[2] || path.join(DIR, 'sortie', job.cours), dst = path.join(ROOT, 'decouvrir', 'voix');
const page = fs.readFileSync(path.join(ROOT, 'decouvrir', 'video.html'), 'utf8');
const FIN = +(/const DURATION = ([\d.]+);/.exec(page) || [])[1];
if (!FIN) { console.log('DURATION introuvable dans decouvrir/video.html'); process.exit(1); }
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const enc = (a, b, o) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-codec:a', 'libmp3lame', ...o, b]);
fs.mkdirSync(dst, {recursive: true});
/* Ce qui est déjà intégré : une phrase ou une musique gardée garde aussi sa durée (mesurée sur le fichier d’origine) */
let avant = {};
try { avant = JSON.parse(fs.readFileSync(path.join(dst, 'voix.json'), 'utf8')); } catch (e) {}
const dAvant = Object.fromEntries((avant.scenes || []).map(x => [x.id, x.d]));
const scenes = [], manque = [];
job.elements.forEach((e, i) => {
  const f = path.join(src, e.id + '.mp3'), garde = path.join(dst, e.id + '.mp3');
  const neuf = fs.existsSync(f);
  if (!neuf && !fs.existsSync(garde)) { manque.push(e.id); return; }
  if (neuf) enc(f, garde, ['-ac', '1', '-b:a', '64k']);   // la voix en mono 64 kb/s, comme dans les cours
  const fin = i + 1 < job.elements.length ? job.elements[i + 1].debut : FIN, d = neuf || dAvant[e.id] == null ? +dur(neuf ? f : garde).toFixed(2) : dAvant[e.id], t = +(e.debut + .35).toFixed(2);
  scenes.push({id: e.id, t, fin, d});
  const marge = fin - t - d;
  console.log(`${e.id}  ${e.titre.padEnd(26)} ${d.toFixed(1)} s / scène ${(fin - t).toFixed(1)} s${neuf ? '' : '  (inchangée)'}${marge < .45 ? `  → l’image s’arrête ${(.45 - marge).toFixed(1)} s` : ''}`);
});
if (manque.length) { console.log('Il manque : ' + manque.join(', ')); process.exit(1); }
const out = {scenes};
const m = path.join(src, 'musique.mp3'), mGarde = path.join(dst, 'musique.mp3');
if (fs.existsSync(m)) { enc(m, mGarde, ['-ac', '2', '-b:a', '96k']); out.musique = {d: +dur(m).toFixed(2)}; console.log(`musique  ${out.musique.d.toFixed(1)} s`); }
else if (fs.existsSync(mGarde)) { out.musique = {d: avant.musique && avant.musique.d || +dur(mGarde).toFixed(2)}; console.log(`musique  ${out.musique.d.toFixed(1)} s  (inchangée)`); }
else console.log('Pas de musique : la voix seule.');
fs.writeFileSync(path.join(dst, 'voix.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`\n${scenes.length} phrases dans decouvrir/voix/ ; voix.json écrit.`);
