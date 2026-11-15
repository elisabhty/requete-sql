/* Le numéro de version des fichiers de langue = l'empreinte de leur contenu (15 novembre, 19 h 26, Elisa, sa capture de l'entretien
   encore en français : « je ne vois pas la traduction sur le site, tu peux update l'outil de trad du coup avec tout ça ? »).
   Les fichiers de langue gardaient la même adresse (langue-en.js?v=7) d'une traduction à l'autre : un navigateur ou un service worker
   qui l'avait déjà pouvait resservir l'ancienne. Désormais, chaque adresse porte les 8 premiers signes du SHA-1 du fichier : une
   traduction qui change, c'est une adresse neuve, jamais une vieille copie.

   Ce qui est tenu à jour :
   - les textes de chaque vidéo (assets/anim/<langue>/<cours>.js) : data-textes de la page (assets/anim/<cours>.html), une empreinte
     pour toutes ses langues, et leur ligne dans sw.js ;
   - langue-<langue>.js, langue-<langue>-defis.js, langue-<langue>-entretien.js : leur entrée dans LANGUES (langues.js) et sw.js ;
   - langues.js lui-même (après les lignes ci-dessus) : index.html, les 71 pages des vidéos, sw.js.

     node tools/langue/versions.mjs              # écrit les nouvelles adresses
     node tools/langue/versions.mjs --verifier   # dit ce qui n'est pas à jour, sans rien écrire (code de sortie 1)

   construire.mjs, defis.mjs construire et entretien.mjs l'appellent à la fin ; les tests vérifient qu'il n'y a rien à changer. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROOT } from './commun.mjs';

const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
export const empreinte = texte => crypto.createHash('sha1').update(texte).digest('hex').slice(0, 8);
const echappe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Les langues qui ont leurs fichiers (langue-en.js…) et les dossiers de textes des vidéos (assets/anim/en/…) */
const langues = () => fs.readdirSync(ROOT).map(f => /^langue-([a-z]{2})\.js$/.exec(f)).filter(Boolean).map(m => m[1]);
const dossiersVideo = () => fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(d => /^[a-z]{2}$/.test(d) && fs.statSync(path.join(ROOT, 'assets/anim', d)).isDirectory());

/* Calcule les adresses à jour ; ecrire : les écrire. Rend la liste des changements. */
export function versions({ecrire = true} = {}) {
  const fichiers = new Map(), changes = [];
  const lit = f => (fichiers.has(f) ? fichiers.get(f) : lire(f));
  const remplace = (f, re, neuf, quoi) => {
    const avant = lit(f), apres = avant.replace(re, neuf);
    if (apres !== avant) { fichiers.set(f, apres); changes.push(`${f} : ${quoi}`); }
  };

  /* 1. Les textes des vidéos : une empreinte par vidéo, toutes langues réunies */
  const dirs = dossiersVideo();
  for (const page of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html'))) {
    const c = page.slice(0, -5), src = `assets/anim/${page}`;
    if (!lit(src).includes(`data-textes="{langue}/${c}.js?v=`)) continue;
    const contenus = dirs.map(d => `assets/anim/${d}/${c}.js`).filter(f => fs.existsSync(path.join(ROOT, f))).map(f => lire(f));
    if (!contenus.length) continue;
    const v = empreinte(contenus.join('\n'));
    remplace(src, new RegExp(`data-textes="\\{langue\\}/${echappe(c)}\\.js\\?v=[0-9a-z]+"`), `data-textes="{langue}/${c}.js?v=${v}"`, `${c} → ${v}`);
    for (const d of dirs) remplace('sw.js', new RegExp(`'\\./assets/anim/${d}/${echappe(c)}\\.js\\?v=[0-9a-z]+'`), `'./assets/anim/${d}/${c}.js?v=${v}'`, `${d}/${c} → ${v}`);
  }

  /* 2. Les fichiers de chaque langue, dans LANGUES (langues.js) et sw.js */
  for (const l of langues()) for (const [cle, f] of [['fichier', `langue-${l}.js`], ['defis', `langue-${l}-defis.js`], ['entretien', `langue-${l}-entretien.js`]]) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const v = empreinte(lire(f)), base = echappe(f);
    remplace('langues.js', new RegExp(`${cle}: '${base}\\?v=[0-9a-z]+'`), `${cle}: '${f}?v=${v}'`, `${f} → ${v}`);
    remplace('sw.js', new RegExp(`'\\./${base}\\?v=[0-9a-z]+'`), `'./${f}?v=${v}'`, `${f} → ${v}`);
  }

  /* 3. langues.js, une fois ses propres lignes à jour : l'appli, les vidéos, sw.js */
  const vl = empreinte(lit('langues.js'));
  remplace('index.html', /<script src="langues\.js\?v=[0-9a-z]+" data-defis><\/script>/, `<script src="langues.js?v=${vl}" data-defis></script>`, `langues.js → ${vl}`);
  remplace('sw.js', /'\.\/langues\.js\?v=[0-9a-z]+'/, `'./langues.js?v=${vl}'`, `langues.js → ${vl}`);
  for (const page of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html')))
    remplace(`assets/anim/${page}`, /src="\.\.\/\.\.\/langues\.js\?v=[0-9a-z]+"/, `src="../../langues.js?v=${vl}"`, `langues.js → ${vl}`);

  if (ecrire) for (const [f, t] of fichiers) fs.writeFileSync(path.join(ROOT, f), t);
  return changes;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const verifier = process.argv.includes('--verifier'), c = versions({ecrire: !verifier});
  if (!c.length) console.log('Les adresses des fichiers de langue sont à jour.');
  else if (verifier) { console.log(`${c.length} adresses à mettre à jour (node tools/langue/versions.mjs) :\n` + c.slice(0, 20).join('\n')); process.exit(1); }
  else console.log(`${c.length} adresses mises à jour.`);
}
