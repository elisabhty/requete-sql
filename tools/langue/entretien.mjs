/* Les questions d'entretien dans une langue (15 novembre, Elisa : « Il y a encore beaucoup de français sur l'application ») :
   les 142 questions de ENTRETIEN (index.html), leur réponse et leur syntaxe, traduites dans tools/langue/entretien/<langue>-*.txt
   (une question par bloc : « ### id », « Q: », « A: » puis la réponse, « SQL: » puis la syntaxe), les notions dans
   tools/langue/entretien/notions-<langue>.json. Ce script vérifie que chaque question a sa traduction, avec autant de morceaux de
   code (<code>) que le français, et écrit langue-<langue>-entretien.js (chargé par l'appli seulement, langues.js).

     node tools/langue/entretien.mjs --langue en */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, lire } from './commun.mjs';
import { versions } from './versions.mjs';

const i = process.argv.indexOf('--langue'), LANGUE = i > 0 ? process.argv[i + 1] : 'en';
const s = lire('index.html'), d = s.indexOf('const ENTRETIEN=['), f = s.indexOf('\n];', d);
const FR = vm.runInNewContext('(' + s.slice(d + 'const ENTRETIEN='.length, f + 2) + ')');
const dossier = path.join(ROOT, 'tools/langue/entretien');
const T = {};
for (const fic of fs.readdirSync(dossier).filter(x => x.startsWith(LANGUE + '-') && x.endsWith('.txt')).sort()) {
  for (const bloc of fs.readFileSync(path.join(dossier, fic), 'utf8').split(/^### /m).slice(1)) {
    const id = bloc.slice(0, bloc.indexOf('\n')).trim();
    const m = /\nQ: (.*)\nA:\n([\s\S]*?)(?:\nSQL:\n([\s\S]*?))?\s*$/.exec(bloc);
    if (!m) throw new Error(`${fic} : ${id} mal écrit`);
    T[id] = {q: m[1].trim(), a: m[2].trim()};
    if (m[3]) T[id].syntaxe = m[3].replace(/\s+$/, '');
  }
}
const notions = JSON.parse(fs.readFileSync(path.join(dossier, `notions-${LANGUE}.json`), 'utf8'));
const pb = [];
for (const q of FR) {
  const t = T[q.id];
  if (!t) { pb.push(`${q.id} : pas de traduction`); continue; }
  const n = x => (String(x).match(/<code>/g) || []).length;
  if (n(q.a) !== n(t.a)) pb.push(`${q.id} : ${n(q.a)} morceaux de code en français, ${n(t.a)} dans la traduction`);
  if (q.a.split('\n\n').length !== t.a.split('\n\n').length) pb.push(`${q.id} : pas le même nombre de paragraphes`);
  if (!!q.syntaxe !== !!t.syntaxe) pb.push(`${q.id} : syntaxe en trop ou en moins`);
  if (/[éèêàçùœ]/.test(t.q + t.a + (t.syntaxe || ''))) pb.push(`${q.id} : un accent français dans la traduction`);
  for (const x of q.notions || []) if (/[a-zà-ÿ]/.test(x) && !/^[A-Z_ ()0-9.,*:+%-]+$/.test(x) && notions[x] == null) pb.push(`${q.id} : notion « ${x} » sans traduction`);
}
for (const id in T) if (!FR.some(q => q.id === id)) pb.push(`${id} : traduit, mais absent de l’appli`);
if (pb.length) { console.error(pb.join('\n')); process.exit(1); }
const sortie = `/* langue-${LANGUE}-entretien.js : les questions d'entretien dans la langue (fabriqué par tools/langue/entretien.mjs à partir de
   tools/langue/entretien/ : ne pas modifier à la main). Chargé par l'appli seulement (langues.js, data-defis). */
window.REQUETE_ENTRETIEN = window.REQUETE_ENTRETIEN || {};
window.REQUETE_ENTRETIEN[${JSON.stringify(LANGUE)}] = ${JSON.stringify({notions, questions: T})};
`;
fs.writeFileSync(path.join(ROOT, `langue-${LANGUE}-entretien.js`), sortie);
console.log(`${Object.keys(T).length} questions, ${Object.keys(notions).length} notions → langue-${LANGUE}-entretien.js (${Math.round(sortie.length / 1024)} Ko)`);
const nv = versions(); if (nv.length) console.log(`${nv.length} adresses de fichiers de langue mises à jour (versions.mjs)`);
