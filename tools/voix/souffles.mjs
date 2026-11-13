#!/usr/bin/env node
/* Voix off : le souffle d’avant une phrase rendu à sa phrase, dans les pages déjà intégrées (souffles-lib.mjs ; Elisa, 13 novembre,
   13 h 19, « Les bases de données relationnelles » : « un trou : clients, commandes et produits. Coupure. Elle est gérée… »).
   node tools/voix/souffles.mjs [cours…] [--appliquer]          (ffmpeg requis)

   Sans --appliquer : la liste des coupes à déplacer. Avec : VOICE.caps corrigé dans chaque page (seuls les deux bords concernés
   bougent ; le son n’est pas touché). Les nouvelles intégrations le font d’elles-mêmes (integrer.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {levels, souffles} from './souffles-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), ANIM = path.join(ROOT, 'assets', 'anim');
const args = process.argv.slice(2), APPLIQUER = args.includes('--appliquer'), seuls = args.filter(a => !a.startsWith('--'));

/* Les coupes à déplacer dans un cours : [{fichier, son, p, q, pApres, qApres}] (p, q : les deux phrases, [clé, fichier, début, fin]),
   et pour chaque phrase qui bouge, son entrée d’avant et d’après (une même phrase peut perdre son souffle de fin et gagner celui
   de son début : elle ne change qu’une fois). */
export function corrections(cours){
  const page = fs.readFileSync(path.join(ANIM, cours + '.html'), 'utf8');
  const a = page.indexOf('const VOICE = {'), z = page.indexOf('/* Fin de la voix off */');
  if (a < 0 || z < a) return [];
  const V = vm.runInContext(page.slice(a, z).replace('const VOICE =', 'VOICE =') + ';VOICE', vm.createContext({VOICE: null}));
  const dir = path.resolve(ANIM, V.dir || ''), parFichier = new Map(), out = [];
  for (const c of V.caps || []) { if (!parFichier.has(c[1])) parFichier.set(c[1], []); parFichier.get(c[1]).push(c); }
  for (const [fichier, caps] of parFichier) {
    const mp3 = path.join(dir, fichier + '.mp3');
    if (!fs.existsSync(mp3) || caps.length < 2) continue;
    caps.sort((x, y) => x[2] - y[2]);
    const {clips, changes} = souffles(levels(mp3), caps.map(c => [c[2], c[3]]));
    for (const {k, son} of changes) out.push({fichier, son, p: caps[k - 1], q: caps[k], pApres: [caps[k - 1][0], fichier, ...clips[k - 1]], qApres: [caps[k][0], fichier, ...clips[k]]});
  }
  out.caps = new Map();
  for (const c of out) for (const [vieux, neuf] of [[c.p, c.pApres], [c.q, c.qApres]]) out.caps.set(JSON.stringify(vieux), JSON.stringify(neuf));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const liste = seuls.length ? seuls : fs.readdirSync(ANIM).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
  let n = 0;
  for (const cours of liste) {
    const cs = corrections(cours);
    if (!cs.length) continue;
    let page = fs.readFileSync(path.join(ANIM, cours + '.html'), 'utf8');
    for (const c of cs) {
      n++;
      console.log(`${cours} · ${c.fichier} : souffle de ${c.son[0]} à ${c.son[1]} s ; fin de la phrase d’avant ${c.p[3]} → ${c.pApres[3]}, début de la suivante ${c.q[2]} → ${c.qApres[2]}`);
    }
    if (!APPLIQUER) continue;
    for (const [a, b] of cs.caps) {
      if (a === b) continue;
      if (page.split(a).length !== 2) { console.log(`  introuvable une seule fois dans la page : ${a} (rien n’est écrit pour ${cours})`); process.exit(1); }
      page = page.replace(a, b);
    }
    fs.writeFileSync(path.join(ANIM, cours + '.html'), page);
  }
  console.log(n ? `${n} coupe${n > 1 ? 's' : ''} ${APPLIQUER ? 'déplacée' + (n > 1 ? 's' : '') : 'à déplacer (--appliquer pour corriger)'}.` : 'Aucun souffle resté à la fin d’une phrase.');
}
