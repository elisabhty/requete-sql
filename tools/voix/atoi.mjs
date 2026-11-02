#!/usr/bin/env node
/* « À toi ! » dit avec sa légende, dans les cours à moments (moments.js) : node tools/voix/atoi.mjs [cours…]   (ffmpeg requis)

   Elisa, 2 novembre, 19 h 53 : « Dans LEFT JOIN, par exemple, [la formatrice] ne dit pas à toi ». Dans ces cours, la légende
   « À toi ! » que moments.js insère avant chaque moment restait muette ; le « À toi ! » n’était dit qu’avec la consigne, une fois
   la feuille ouverte. Chaque consigne (at1.mp3…) commence par son « À toi ! » : cet outil situe la pause qui le suit (dans les
   fichiers de assets/voix/<cours>/, comme integrer.mjs) et écrit VOICE.toi = {at1: [fin du « À toi ! », début de la suite], …}.
   Le moteur (moments.js) fait dire le début du fichier avec la légende, et la suite avec la feuille : un seul « À toi ! ».
   Sans argument : tous les cours à moments dont les chapitres ne disent pas déjà « À toi ! » (les chapitres du projet le disent). */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {aToi, levels} from './atoi-lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..');
const ANIM = path.join(ROOT, 'assets', 'anim');
const probe = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(ANIM).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
for (const cours of pages) {
  const file = path.join(ANIM, cours + '.html');
  if (!fs.existsSync(file)) continue;
  let page = fs.readFileSync(file, 'utf8');
  if (!page.includes('src="moments.js"') || !page.includes('const VOICE = {')) continue;
  const job = path.join(DIR, cours + '.json');
  if (fs.existsSync(job) && JSON.parse(fs.readFileSync(job, 'utf8')).elements.some(el => /^ch\d/.test(el.id) && (el.phrases || []).some(ph => /^À toi\s*!$/.test(ph.trim())))) continue;
  const m = /\n  say: (\{.*?\})(?:,\n  toi: \{.*?\})?\};\n\/\* Fin de la voix off \*\//s.exec(page);
  if (!m) { console.log(`${cours} : bloc VOICE introuvable`); continue; }
  const say = JSON.parse(m[1]), toi = {}, miss = [];
  for (const k of Object.keys(say).filter(k => /^at\d+$/.test(k)).sort((a, b) => +a.slice(2) - +b.slice(2))) {
    const f = path.join(ROOT, 'assets', 'voix', cours, say[k][0] + '.mp3');
    if (!fs.existsSync(f)) { miss.push(k); continue; }
    const t = aToi(levels(f), null, probe(f), say[k][1], say[k][2]);
    if (t) toi[k] = t; else miss.push(k);
  }
  const block = `\n  say: ${m[1]}${Object.keys(toi).length ? `,\n  toi: ${JSON.stringify(toi)}` : ''}};\n/* Fin de la voix off */`;
  page = page.slice(0, m.index) + block + page.slice(m.index + m[0].length);
  fs.writeFileSync(file, page);
  console.log(`${cours} : ${Object.keys(toi).length} « À toi ! »${miss.length ? ` (sans : ${miss.join(', ')})` : ''}`);
}
