// Copie les fichiers de l’app web dans www/, le dossier que Capacitor
// embarque dans l’app iOS. Les tests, notes et fichiers de travail restent dehors.
import {cpSync, rmSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {join, extname} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'www');
rmSync(out, {recursive: true, force: true});
mkdirSync(out);

const keepExt = new Set(['.html', '.css', '.js', '.webmanifest']);
const skip = new Set(['perf-probe.js']);
for (const name of readdirSync(root)) {
  const p = join(root, name);
  if (statSync(p).isFile() && keepExt.has(extname(name)) && !skip.has(name)) cpSync(p, join(out, name));
}
// La vidéo mascotte-requete.mp4 (4,5 Mo) n’est utilisée nulle part : on ne l’embarque pas.
const unused = new Set(['mascotte-requete.mp4']);
for (const dir of ['assets', 'vendor']) cpSync(join(root, dir), join(out, dir), {recursive: true, filter: src => !unused.has(src.split('/').pop())});
console.log('www/ prêt pour Capacitor');
