/* 2 · Les clés : ce qu'il reste vraiment à traduire, après la récolte.
   Chaque texte récolté devient sa clé (les nombres en {1}, les mois en {m1}) ; restent de côté les données de la base (prénoms,
   villes, e-mails, numéros, code seul), les noms SQL seuls (le moteur les traduit avec la base de la langue), ce que la mémoire
   connaît déjà, et les fragments (les mots d'une légende découpée, déjà dans une phrase longue de la même vidéo : la phrase
   entière se traduit, ses mots suivent).
   node tools/langue/cles.mjs --langue en projet-vue projet-index
   → tools/langue/travail/<langue>/a-traduire.json : { "clé française": "" } à remplir, puis à recopier (ou fusionner) dans
     tools/langue/travail/<langue>/traductions.json ; a-traduire-videos.json dit où chaque clé apparaît. */
import fs from 'node:fs';
import { args, travail, memoire, cle, motsRe, donnee, IDENT, contenu, lirePage, dejaTraduit } from './commun.mjs';

const {langue, videos} = args();
const M = memoire(langue), re = motsRe(contenu(`langue-${langue}.js`).mots);
const vu = {}, ordre = [];
for (const c of videos) {
  const f = travail(langue, 'recolte', c + '.json');
  if (!fs.existsSync(f)) { console.log(`${c} : pas encore récolté (recolter.mjs)`); continue; }
  const pg = lirePage(langue, c), vals = pg ? Object.values(pg.textes) : [];
  for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const k = cle(x, re);
    if (donnee(k) || IDENT.test(k.trim()) || dejaTraduit(x, vals)) continue;
    if (!vu[k]) { vu[k] = []; ordre.push(k); }
    if (!vu[k].includes(c)) vu[k].push(c);
  }
}
const nu = k => k.replace(/<[^>]+>/g, '').trim().toLowerCase();
const fragments = new Set();
for (const c of videos) {
  const ks = ordre.filter(k => vu[k].includes(c)), longues = ks.map(nu).filter(p => p.split(/\s+/).length >= 5);
  for (const k of ks) { const p = nu(k); if (p.split(/\s+/).length <= 4 && longues.some(L => L !== p && L.includes(p))) fragments.add(k); }
}
const reste = ordre.filter(k => !Object.prototype.hasOwnProperty.call(M, k) && !fragments.has(k));
fs.writeFileSync(travail(langue, 'a-traduire.json'), JSON.stringify(Object.fromEntries(reste.map(k => [k, ''])), null, 1));
fs.writeFileSync(travail(langue, 'a-traduire-videos.json'), JSON.stringify(Object.fromEntries(reste.map(k => [k, vu[k]])), null, 1));
const frag = [...fragments].filter(k => !Object.prototype.hasOwnProperty.call(M, k));
fs.writeFileSync(travail(langue, 'fragments.json'), JSON.stringify(frag, null, 1));
console.log('textes récoltés', ordre.length, '· déjà connus', ordre.filter(k => Object.prototype.hasOwnProperty.call(M, k)).length,
  '· fragments', fragments.size, '· à traduire', reste.length);
console.log('→', travail(langue, 'a-traduire.json'));
if (frag.length) console.log('Fragments sans traduction (à vérifier après construire.mjs + verifier.mjs ; souvent rien à faire) :', frag.length);
