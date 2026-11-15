/* 3 · Construire : le fichier de textes de chaque vidéo (assets/anim/<langue>/<cours>.js), depuis la récolte.
   Pour chaque texte récolté : sa traduction (travail/<langue>/traductions.json d'abord, puis la mémoire), ou, pour un nom SQL seul
   (un en-tête de colonne, une table), sa traduction par le moteur avec la base de la langue et la table de la page (data-table).
   Un fichier existant est complété, jamais vidé : ses textes restent (sauf ceux que traductions.json corrige) et tout ce qui suit
   ses textes (la base propre à la page, ses tables et ses noms) est gardé tel quel.
   node tools/langue/construire.mjs --langue en projet-vue projet-index
   Ensuite : recolter.mjs (il ne doit rester que des données), verifier.mjs. */
import fs from 'node:fs';
import { args, travail, memoire, cle, motsRe, moisTraduits, parite, donnee, IDENT, contenu, moteur, lirePage, ecrirePage, pageNeuve, tablePage, dejaTraduit } from './commun.mjs';

const {langue, videos} = args();
const M = memoire(langue), base = contenu(`langue-${langue}.js`), re = motsRe(base.mots);
const tf = travail(langue, 'traductions.json'), T = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : {};
const avoir = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
let erreurs = 0;
for (const c of videos) {
  const f = travail(langue, 'recolte', c + '.json');
  if (!fs.existsSync(f)) { console.log(`${c} : pas encore récolté (recolter.mjs)`); continue; }
  const page = lirePage(langue, c) || pageNeuve(langue, c), avant = Object.keys(page.textes).length;
  const L = moteur(langue, [`assets/anim/${langue}/${c}.js`]), table = tablePage(c), manque = [];
  /* Les fragments (les mots d'une phrase qui s'écrit mot à mot) : leur phrase entière les traduit ; jamais comptés comme manquants */
  const recolte = JSON.parse(fs.readFileSync(f, 'utf8')), nu = s => String(s).replace(/<[^>]+>/g, '').trim().toLowerCase();
  const longues = recolte.map(nu).filter(p => p.split(/\s+/).length >= 5);
  const fragment = x => { const p = nu(x); return p.split(/\s+/).length <= 4 && longues.some(L => L !== p && L.includes(p)); };
  for (const x of recolte) {
    const k = cle(x, re), brut = String(x).trim();
    if (donnee(k) || dejaTraduit(x, Object.values(page.textes))) continue;
    const id = IDENT.exec(brut);
    if (id) { const t = L.sql(id[1], table); if (t && t !== id[1]) page.textes[brut] = t + id[2]; continue; }
    let v = avoir(T, k) ? T[k] : avoir(page.textes, k) ? null : avoir(M, k) ? M[k] : undefined;
    if (v === null) continue;   // déjà dans la page, et pas corrigé
    if (v === undefined || v === '') { if (!fragment(x)) manque.push(k); continue; }
    if (/\{m\d+\}/.test(k) && !/\{m\d+\}/.test(v)) v = moisTraduits(v, base.mots);
    if (!parite(k, v)) { console.log(`  PARITÉ ${c} | ${k} | ${v}`); erreurs++; continue; }
    page.textes[k] = v;
  }
  ecrirePage(langue, c, page);
  fs.writeFileSync(travail(langue, 'manque-' + c + '.json'), JSON.stringify(manque, null, 1));
  console.log(c, 'textes', Object.keys(page.textes).length, `(+${Object.keys(page.textes).length - avant})`, manque.length ? `· sans traduction ${manque.length} : ${manque.slice(0, 4).join(' | ')}` : '');
}
process.exitCode = erreurs ? 1 : 0;
