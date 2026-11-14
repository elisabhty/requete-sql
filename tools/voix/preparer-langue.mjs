#!/usr/bin/env node
/* Voix off dans une autre langue : prépare tools/voix/<langue>/<cours>.json pour generer.mjs (--langue <langue>), depuis
   tools/voix/<cours>.json (la voix française) et la vidéo traduite (assets/anim/<langue>/<cours>.js).
   node tools/voix/preparer-langue.mjs <cours> <id de la voix> <nom de la voix>      (lancé par Claude : il ouvre la vidéo dans un
   navigateur sans écran, Playwright, servi sur http://localhost:8765 ; PLAYWRIGHT : le chemin du module si besoin)
   - chaque fichier garde l’id du français (ch01, at1, indice1…) ;
   - ses phrases : les légendes anglaises de ses légendes françaises, dans l’ordre (VOICE.caps de la page dit quelle légende va à
     quel fichier) ; cles : la clé française (vkey) de chaque phrase, pour l’intégration ;
   - les consignes « À toi », les indices, les messages à toucher et le lien vers la leçon d’après : ceux de la vidéo traduite ;
   - la prononciation anglaise du code (DIRE : customer_id se dit « customer underscore ID », * « star »). */
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const [cours, voixId, voixNom] = process.argv.slice(2);
const R = new URL('../../', import.meta.url).pathname;
const fr = JSON.parse(fs.readFileSync(`${R}tools/voix/${cours}.json`, 'utf8'));
const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 1080, height: 1920}});
await ctx.addInitScript(() => { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', 'en'); });
const p = await ctx.newPage(); await p.goto(`http://localhost:8765/assets/anim/${cours}.html?app&embed`);
await p.evaluate(() => window.__ready);
const D = await p.evaluate(() => {
  const t = h => plain(h);   // dans la langue (fr() traduit)
  const caps = {}; CAPTIONS.forEach(c => { caps[vkey(c[2])] = t(c[2]); });
  const M = (typeof MOMENTS !== 'undefined' ? MOMENTS : []).map(m => ({prompt: t(m.prompt), tip: m.tip ? t(m.tip) : ''}));
  const O = (typeof OPENS !== 'undefined' ? OPENS : []).map(o => t(o.prompt));
  const L = typeof liensDe === 'function' ? liensDe(pontPage()) : null;
  return {caps, M, O, apres: L && L.apres ? t(L.apres) : '', avant: L && L.avant ? t(L.avant) : '', bulle: t(document.querySelector('#s0 .bubble') ? document.querySelector('#s0 .bubble').textContent : ''),
    sub: document.querySelector('#s0 .sub') ? document.querySelector('#s0 .sub').textContent : '', VOICE};
});
await b.close();
/* La prononciation anglaise : le code dit à voix haute */
const B = '(?<![\\p{L}\\d_])', E = '(?![\\p{L}\\d_])', W = (x, f = 'gu') => new RegExp(B + x + E, f);
const DIRE = s => s
  .replace(/\bstar \*/g, 'star').replace(/\*/g, 'star').replace(/\btable\.column\b/g, 'table dot column')
  .replace(/\b([a-z]+)\.(id)\b/g, '$1 dot ID')
  .replace(/\b([a-z]+(?:_[a-z]+)+)\b/g, w => w.split('_').map(x => x === 'id' ? 'ID' : x).join(' underscore '))
  .replace(W('id'), 'ID').replace(/\bno\.\s?(\d)/gi, 'number $1')
  .replace(/\bAUTOINCREMENT\b/g, 'auto increment').replace(/\bPRIMARY KEY\b/g, 'primary key').replace(/\bFOREIGN KEY\b/g, 'foreign key')
  .replace(/\bREFERENCES\b/g, 'references').replace(/\bINTEGER\b/g, 'integer').replace(/\bTEXT\b/g, 'text').replace(/\bREAL\b/g, 'real')
  .replace(/\bSELECT\b/g, 'select').replace(/\bFROM\b/g, 'from').replace(/\bINSERT INTO\b/g, 'insert into').replace(/\bAS\b/g, 'as')
  .replace(/ = /g, ' equals ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
const parFichier = {};
for (const [k, f] of D.VOICE.caps) (parFichier[f] = parFichier[f] || []).push(k);
const SAY = {bienvu: 'Nice one!', rattrape: 'Nice save!', presque: 'Not quite. Read the explanation, then try again.',
  finbravo: 'Well done! You passed the lesson.', fineffort: 'One more push! Replay the missed moments to pass the lesson.'};
const tag = el => (/^\[(\w+)\]/.exec(el.texte) || [, 'cheerful'])[1];
const out = {cours, titre: fr.titre, note: `La voix anglaise de « ${fr.titre} » (14 novembre) : chaque fichier garde l’id du français ; phrases : les légendes anglaises dites à voix haute ; cles : la légende française de chaque phrase (vkey).`,
  voix: {id: voixId, nom: voixNom}, modele: fr.modele, langue: 'en', format: fr.format, elements: []};
const manque = [];
for (const el of fr.elements) {
  let phrases = [], cles = null;
  if (el.id === 'ch00') phrases = [`First lesson: ${D.sub.toLowerCase()}.`, D.bulle];
  else if (parFichier[el.id]) { cles = parFichier[el.id]; phrases = cles.map(k => { if (!D.caps[k]) manque.push(el.id + ':' + k); return D.caps[k] || ''; }); }
  else if (/^at\d$/.test(el.id)) phrases = ['Your turn! ' + D.M[+el.id.slice(2) - 1].prompt];
  else if (/^indice\d$/.test(el.id)) phrases = [D.M[+el.id.slice(6) - 1].tip];
  else if (/^touche\d$/.test(el.id)) phrases = [D.O[+el.id.slice(6) - 1]];
  else if (el.id === 'lienapres') phrases = [D.apres];
  else if (el.id === 'lienavant') phrases = [D.avant];
  else if (SAY[el.id]) phrases = [SAY[el.id]];
  else { manque.push(el.id); continue; }
  phrases = phrases.map(DIRE);
  if (el.phrases && el.phrases.length && el.phrases.length !== phrases.length) manque.push(`${el.id} : ${el.phrases.length} phrases en français, ${phrases.length} en anglais`);
  const e = {id: el.id, titre: el.titre, texte: `[${tag(el)}] ` + phrases.join('\n\n'), avant: null, apres: null};
  if (el.phrases && el.phrases.length) e.phrases = phrases;
  if (cles) e.cles = cles;
  out.elements.push(e);
}
/* La continuité : la phrase d'avant et celle d'après, pour les chapitres */
const ch = out.elements.filter(e => e.phrases && /^ch/.test(e.id));
ch.forEach((e, i) => { if (i) e.avant = ch[i - 1].phrases.at(-1); if (i < ch.length - 1) e.apres = ch[i + 1].phrases[0]; });
fs.writeFileSync(`${R}tools/voix/en/${cours}.json`, JSON.stringify(out, null, 2) + '\n');
console.log('manque', manque, 'caracteres', out.elements.reduce((a, e) => a + e.texte.length, 0));
