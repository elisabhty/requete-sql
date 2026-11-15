/* Ce que l'app confie à l'iPhone (widgets, Live Activities, raccourcis, rappels), passé par la traduction d'une langue : la liste
   de ce qui n'a pas de traduction. node tools/langue/natif.mjs --langue en   (écrit tools/langue/travail/<langue>/natif.json) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const i = process.argv.indexOf('--langue'), LANGUE = i > 0 ? process.argv[i + 1] : 'en';
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');

function moteur() {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': LANGUE}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => null}}};
  vm.runInNewContext(lire('langues.js'), ctx); vm.runInNewContext(lire(`langue-${LANGUE}.js`), ctx);
  return win.REQUETE_LANGUE;
}

/* Une constante de l'app (un tableau ou un objet littéral), lue sans exécuter l'app. */
export function constante(nom) {
  const d = app.indexOf('const ' + nom + '=');
  if (d < 0) return null;
  let j = d + nom.length + 7, k = j, prof = 0;
  for (; k < app.length; k++) {
    const c = app[k];
    if (c === '[' || c === '{') prof++;
    else if (c === ']' || c === '}') { prof--; if (!prof) break; }
    else if (c === "'" || c === '"' || c === '`') { const q = c; k++; while (app[k] !== q) { if (app[k] === '\\') k++; k++; } }
  }
  return vm.runInNewContext('(' + app.slice(j, k + 1) + ')');
}

const L = moteur(), manque = new Map();
const essai = (x, ou) => { if (!x || !/[A-Za-zÀ-ÿ]{2}/.test(x)) return; if (L.t(x) === x) manque.set(x, ou); };

/* Les textes écrits dans le code des appels au pont : natifT('…') */
for (const m of app.matchAll(/natifT\('((?:[^'\\]|\\.)*)'\)/g)) essai(vm.runInNewContext(`'${m[1]}'`), 'natifT');
for (const m of app.matchAll(/natifT\(`((?:[^`\\]|\\.)*)`\)/g)) essai(m[1].replace(/\$\{[^}]+\}/g, '4'), 'natifT');
for (const v of Object.values(constante('ILE_OB_TITRES') || {})) essai(v, 'ILE_OB_TITRES');
for (const r of constante('RACCOURCIS') || []) { essai(r.titre, 'RACCOURCIS'); essai(r.sousTitre, 'RACCOURCIS'); }
for (const [a, b] of constante('RAPPEL_MESSAGES') || []) { essai(a, 'rappel'); essai(b, 'rappel'); }
try { for (const [a, b] of JSON.parse(lire('rappels.json')).messages || JSON.parse(lire('rappels.json'))) { essai(a, 'rappels.json'); essai(b, 'rappels.json'); } } catch (e) {}

/* La requête de poche : les trois banques */
const mots = q => q.g === 'qcm' || q.g === 'entretien' || q.m != null;
for (const nom of ['POCHE', 'POCHE_PLUS', 'POCHE_ENTRETIEN']) {
  for (const q of constante(nom) || []) {
    essai(q.e, nom); essai(q.oui, nom); essai(q.non, nom);
    for (const c of q.c || []) if (mots(q)) essai(c, nom);
    for (const l of q.q || []) { const m = /--\s?(.*)$/.exec(l); if (m) essai(m[1], nom); }
  }
}
const sortie = path.join(ROOT, 'tools/langue/travail', LANGUE);
fs.mkdirSync(sortie, {recursive: true});
const liste = [...manque].map(([fr, ou]) => ({fr, ou}));
fs.writeFileSync(path.join(sortie, 'natif.json'), JSON.stringify(liste, null, 1));
const parSource = {};
liste.forEach(x => { parSource[x.ou] = (parSource[x.ou] || 0) + 1; });
console.log(liste.length, 'textes sans traduction', parSource);
