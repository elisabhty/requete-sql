/* L'appli dans une langue, parcourue dans trois états (le parcours tout neuf, un planning créé et deux leçons faites, tout fini) :
   chaque onglet, puis les écrans qui s'ouvrent sans réglage (renderX(), openX()). Ce qui s'affiche sans traduction est noté par
   le moteur (REQUETE_LANGUE.manquants) : la liste va dans tools/langue/travail/<langue>/appli-manque.json.

     node tools/langue/appli.mjs --langue en

   Le prénom est « Camille » : une clé qui le contient se lit avec {prenom}. Les noms de SGBD, les mots-clés SQL et les noms
   propres qui s'écrivent pareil dans la langue restent dans la liste : c'est normal, ils n'ont pas à être traduits. */
import fs from 'node:fs';
import { serveur, navigateur, travail } from './commun.mjs';

const i = process.argv.indexOf('--langue'), LANGUE = i > 0 ? process.argv[i + 1] : 'en';
const ONGLETS = ['learn', 'planning', 'parcours', 'practice', 'defis', 'collection', 'notes', 'console', 'entretien', 'sgbd', 'library', 'compte'];

async function parcourir(browser, base, etat, apres) {
  const ctx = await browser.newContext({viewport: {width: 393, height: 852}, serviceWorkers: 'block'});
  await ctx.route(u => !String(u).startsWith(base), r => r.fulfill({status: 404, body: ''}));
  await ctx.addInitScript(({LANGUE, etat}) => { try {
    if (sessionStorage.getItem('crawl-pret')) return;
    localStorage.clear();
    localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', LANGUE);
    localStorage.setItem('requete-sql-v3', JSON.stringify(etat));
    sessionStorage.setItem('crawl-pret', '1');
  } catch (e) {} }, {LANGUE, etat});
  const p = await ctx.newPage(), erreurs = [];
  p.on('pageerror', e => erreurs.push(String(e).slice(0, 160)));
  await p.goto(`${base}/index.html?langue=${LANGUE}`, {waitUntil: 'load'}); await p.waitForTimeout(3500);
  if (apres) { await p.evaluate(apres); await p.waitForTimeout(800); await p.reload({waitUntil: 'load'}); await p.waitForTimeout(3500); }
  const fonctions = await p.evaluate(() => Object.keys(window).filter(k => /^(render|open|show)[A-Z]\w*$/.test(k) && typeof window[k] === 'function' && window[k].length === 0
    && !/^(openLesson|openItem|showScreen|openExternal|openContact|openShare|openStore|openPaywall)/.test(k)));
  for (const t of ONGLETS) {
    await p.evaluate(t => { try { switchTab(t); } catch (e) {} }, t); await p.waitForTimeout(700);
    await p.evaluate(() => { try { window.scrollTo(0, document.body.scrollHeight); } catch (e) {} }); await p.waitForTimeout(300);
  }
  for (const f of fonctions) {
    await p.evaluate(f => { try { window[f](); } catch (e) {} }, f); await p.waitForTimeout(350);
    await p.evaluate(() => { try { document.querySelectorAll('.sheet.open,.sheet.on,[data-sheet].on').forEach(s => s.classList.remove('open', 'on')); } catch (e) {} });
  }
  const manque = await p.evaluate(() => (window.REQUETE_LANGUE && REQUETE_LANGUE.manquants ? REQUETE_LANGUE.manquants() : []));
  await ctx.close();
  return {manque, erreurs, fonctions: fonctions.length};
}

const srv = await serveur(), browser = await navigateur(), tous = new Set();
const lecons = id => ({done: true, at: 1000 + id});
const ETATS = [
  ['le parcours tout neuf', {onboarded: true, name: 'Camille'}, null],
  ['un planning et deux leçons', {onboarded: true, name: 'Camille', lessons: {0: lecons(0), 1: lecons(1)}}, () => { try {
    const b = [...document.querySelectorAll('button')].find(x => /Créer mon planning|Create my schedule/.test(x.textContent)); if (b) b.click(); } catch (e) {} }],
  ['tout fini', {onboarded: true, name: 'Camille'}, () => { try {
    allLessons.forEach(l => { state.lessons = state.lessons || {}; state.lessons[l.id] = {done: true, at: Date.now()}; }); save(); } catch (e) {} }]
];
for (const [nom, etat, apres] of ETATS) {
  const r = await parcourir(browser, srv.base, etat, apres);
  r.manque.forEach(m => tous.add(m));
  console.log(`${nom} : ${r.manque.length} textes sans traduction, ${r.fonctions} écrans ouverts, ${r.erreurs.length} erreurs`, r.erreurs.slice(0, 2));
}
await browser.close(); srv.close();
/* Ce qui s'écrit pareil (un mot-clé SQL, un SGBD, un nombre) n'est pas listé */
const pareil = s => /^[A-Z_ ()*.,0-9+]+$/.test(s) || /^(<\d>)?(SQLite|PostgreSQL|MySQL|SQL Server|Oracle|JSON|CSV|Excel|Camille|Pseudo|Stickers)(<\/\d>)?( · (<\d>)?(SQLite|PostgreSQL|MySQL|SQL Server|Oracle)(<\/\d>)?)*$/.test(s);
const liste = [...tous].filter(s => !pareil(s)).sort();
fs.writeFileSync(travail(LANGUE, 'appli-manque.json'), JSON.stringify(liste, null, 1));
console.log(`${liste.length} textes à traduire → tools/langue/travail/${LANGUE}/appli-manque.json`);
