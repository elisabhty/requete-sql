#!/usr/bin/env node
/* Voix off dans une autre langue : prépare tools/voix/<langue>/<cours>.json pour generer.mjs (--langue <langue>), depuis
   tools/voix/<cours>.json (la voix française) et la vidéo traduite (assets/anim/<langue>/<cours>.js).
   node tools/voix/preparer-langue.mjs <cours> [<id de la voix> <nom de la voix>]    (Brielle sans voix donnée ; lancé par Claude : il ouvre la vidéo dans un
   navigateur sans écran, Playwright, servi sur http://localhost:8765 ; PLAYWRIGHT : le chemin du module si besoin)
   - chaque fichier garde l’id du français (ch01, at1, indice1…) ;
   - ses phrases : les légendes anglaises de ses légendes françaises, dans l’ordre (VOICE.caps de la page dit quelle légende va à
     quel fichier) ; cles : la clé française (vkey) de chaque phrase, pour l’intégration ;
   - les consignes « À toi », les indices, les messages à toucher et le lien vers la leçon d’après : ceux de la vidéo traduite ;
   - la prononciation anglaise du code (DIRE : customer_id se dit « customer underscore ID », * « star »). */
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright/index.mjs');
import fs from 'node:fs';
/* 15 novembre, 2 h 57 (Elisa : « on garde cette voix et cette photo pour tous les modules ») : sans voix donnée, Brielle, la voix
   anglaise de tous les cours (et, dans les vidéos, la photo de la formatrice des modules 1 et 2 : core.css). */
const [cours, voixId = '6u6JbqKdaQy89ENzLSju', voixNom = 'Brielle'] = process.argv.slice(2);
const R = new URL('../../', import.meta.url).pathname;
const fr = JSON.parse(fs.readFileSync(`${R}tools/voix/${cours}.json`, 'utf8'));
const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 1080, height: 1920}});
await ctx.addInitScript(() => { localStorage.setItem('requete-langue-essai', '1'); localStorage.setItem('requete-langue', 'en'); });
const p = await ctx.newPage(); await p.goto(`http://localhost:8765/assets/anim/${cours}.html?app&embed`);
await p.evaluate(() => window.__ready);
const D = await p.evaluate(() => {
  /* dans la langue (fr() traduit) ; WHERE a son propre moteur, sans plain() */
  const t = h => typeof plain === 'function' ? plain(h) : fr(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '\u00a0').replace(/\s+/g, ' ').trim();
  const caps = {}, caps0 = {}; CAPTIONS.forEach(c => { caps[vkey(c[2])] = t(c[2]); caps0[vkey(c[2])] = String(c[2]).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '\u00a0').replace(/\s+/g, ' ').trim(); });
  /* « Quel JOIN choisir ? » : ses moments s'appellent PICKS */
  const M = (typeof MOMENTS !== 'undefined' ? MOMENTS : typeof PICKS !== 'undefined' ? PICKS : []).map(m => ({prompt: t(m.prompt), tip: m.tip ? t(m.tip) : ''}));
  const O = (typeof OPENS !== 'undefined' ? OPENS : []).map(o => t(o.prompt));
  const page = typeof pontPage === 'function' ? pontPage() : (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const L = typeof liensDe === 'function' ? liensDe(page) : null;
  return {caps, caps0, M, O, apres: L && L.apres ? t(L.apres) : '', avant: L && L.avant ? t(L.avant) : '', bulle: t(document.querySelector('#s0 .bubble') ? document.querySelector('#s0 .bubble').textContent : ''),
    sub: document.querySelector('#s0 .sub') ? document.querySelector('#s0 .sub').textContent : '', VOICE};
});
await b.close();
/* La prononciation anglaise : le code dit à voix haute */
const B = '(?<![\\p{L}\\d_])', E = '(?![\\p{L}\\d_])', W = (x, f = 'gu') => new RegExp(B + x + E, f);
/* Module 3 (15 novembre) : les fonctions et les opérateurs dits comme on les lit (la voix française : « appeur », « deux barres
   verticales », « sub-stringue », « pourcent d, barre… ») */
const FN = {UPPER: 'upper', LOWER: 'lower', TRIM: 'trim', LENGTH: 'length', SUBSTR: 'substring', INSTR: 'in-string', REPLACE: 'replace',
  ROUND: 'round', CEIL: 'ceiling', FLOOR: 'floor', CAST: 'cast', COALESCE: 'coalesce', DATE: 'date', STRFTIME: 'string format time',
  typeof: 'type of', Typeof: 'type of', CASE: 'case', WHEN: 'when', THEN: 'then', ELSE: 'else', END: 'end', COUNT: 'count',
  /* Module 4 (15 novembre) : les agrégats */
  SUM: 'sum', AVG: 'A-V-G', MIN: 'min', MAX: 'max', GROUP_CONCAT: 'group concat',
  /* Module 7 (15 novembre) : les fonctions de fenêtre */
  ROW_NUMBER: 'row number', RANK: 'rank', DENSE_RANK: 'dense rank', LAG: 'lag', LEAD: 'lead', NTILE: 'N-tile',
  FIRST_VALUE: 'first value', LAST_VALUE: 'last value', julianday: 'julian day'};
const FNRE = Object.keys(FN).join('|');
const PARLE = s => s
  .replace(/MARTIN Sophie, (\d+), RUE DES LILAS, PARIS/g, 'MARTIN Sophie, $1, rue des Lilas, Paris')
  .replace(/\bWHEN gives the condition, THEN the value\b/g, 'The when part gives the condition, and the then part, the value')
  /* Module 13 (15 novembre) : la date américaine du trigger en toutes lettres (10/25/2026 at 14:32 : October 25, 2026, at 14:32) ;
     CURRENT_TIMESTAMP, OLD.prix et NEW.prix comme la voix française ; l’appel d’une routine (calculer_points(80) : « of 80 ») */
  .replace(/\b(1[0-2]|0?[1-9])\/(\d{1,2})\/(\d{4}) at\b/g, (t, m, d, y) => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${+d}, ${y}, at`)
  .replace(/\bCURRENT_TIMESTAMP\b/g, 'current timestamp').replace(/\b(OLD|NEW)\.([a-z_]+)\b/g, (t, a, b) => a.toLowerCase() + ' dot ' + b)
  .replace(/\b([a-z]+(?:_[a-z]+)+)\((\d+)\)/g, '$1 of $2')
  .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$1, dash, $2, dash, $3').replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, '$1, slash, $2, slash, $3')
  .replace(/'%d\/%m\/%Y'/g, 'percent d, slash, percent m, slash, percent capital Y').replace(/'%([a-zA-Z])'/g, 'percent $1')
  .replace(/'\+(\d+) (days?|months?|years?)'/g, 'plus $1 $2')
  .replace(/COALESCE\('', '([^']*)'\)/g, 'coalesce of an empty text and $1').replace(/ '' /g, ' ')
  .replace(/INSTR\(([a-z_]+), ' '\)/g, (t, a) => `in-string of ${a}, space`)
  .replace(/UPPER\(([a-z_]+)\) \+ ' ' \+ ([a-z_]+)/g, 'upper of $1, plus a space, plus $2')
  .replace(/CAST\('?([^'()]+?)'? AS ([A-Z]+)\)/gi, (t, a, b) => `cast ${a} as ${b.toLowerCase()}`)
  /* Module 5 (15 novembre) : les jointures */
  .replace(/<>/g, 'not-equal').replace(/, and AND adds\b/g, ', while the AND keyword adds')
  .replace(/\b(INNER|LEFT|RIGHT|CROSS|SELF) JOIN\b/g, (t, a) => a.toLowerCase() + ' join').replace(/\bFULL OUTER JOIN\b/g, 'full outer join').replace(/\bJOIN\b/g, 'join')
  .replace(/\b([a-z][a-z_]*\d?)\.([a-z][a-z_]*)\b/g, '$1 dot $2').replace(/'([A-Z][a-zA-Z ]*)'/g, '$1')
  .replace(/\bCOUNT\(\*\)/g, 'count star').replace(/\bCOUNT\(DISTINCT ([a-z_]+)\)/g, 'count distinct $1')
  .replace(/\bGROUP BY\b/g, 'group by').replace(/\bHAVING\b/g, 'having').replace(/, ', '\)/g, ', comma space)').replace(/separator ', '/g, 'separator comma space')
  .replace(new RegExp(`\\b(${FNRE})\\(\\)`, 'g'), (t, f) => FN[f])
  .replace(new RegExp(`\\b(${FNRE})\\(([^()]*)\\)`, 'g'), (t, f, a) => `${FN[f]} of ${a.replace(/'([^']*)'/g, '$1')}`)
  .replace(new RegExp(`\\b(${FNRE})\\(([^()]*)\\)`, 'g'), (t, f, a) => `${FN[f]} of ${a.replace(/'([^']*)'/g, '$1')}`)
  .replace(new RegExp(`\\b(${FNRE})\\b`, 'g'), f => FN[f])
  .replace(/\|\|/g, 'two vertical bars')
  .replace(/\bwith \+ instead of\b/gi, m => (m[0] === 'W' ? 'With' : 'with') + ' the plus sign instead of').replace(/\bnever \+/g, 'never the plus sign')
  .replace(/\bWith \+,/g, 'With the plus sign,').replace(/\+, -, \* and \//g, 'plus, minus, times and divided by')
  .replace(/(\S) \* (\d)/g, '$1 times $2').replace(/(\d) \/ (\d)/g, '$1 divided by $2').replace(/ × /g, ' times ').replace(/ − /g, ' minus ')
  .replace(/(\S) \+ (\S)/g, '$1 plus $2').replace(/\bThe \+ (\d)/g, 'The plus $1').replace(/\bCMD-,/g, 'C-M-D dash,')
  .replace(/'(CMD-[\d-]+|\d+|OK)'/g, '$1').replace(/\bCMD-(\d+)-(\d+)\b/g, 'C-M-D, dash, $1, dash, $2')
  /* Module 6 (15 novembre) : les sous-requêtes et les ensembles. Les mots-clés restent en capitales (EXISTS, ALL, ANY, WITH, UNION…) :
     des mots anglais que la voix lit tels quels, et qui gardent leur relief ; en minuscules, « all is true » ou « with with » se
     liraient mal. « (…) » ne se lit pas ; une date entre apostrophes se dit sans elles. */
  .replace(/ \(…\)/g, '').replace(/'(\d{4}, dash, [^']+)'/g, '$1').replace(/\bOVER\(\)/g, 'OVER').replace(/\bSELECTs\b/g, 'select queries')
  .replace(/\bwith WITH RECURSIVE\b/g, 'with the WITH RECURSIVE clause').replace(/\bwith WITH\b/g, 'with the WITH clause')
  .replace(/\bWith WITH ([a-z_]+) (as|AS),/g, 'Writing WITH $1 $2,')
  .replace(/\bback WITH\b/g, 'back, WITH')
  /* Module 7 (15 novembre) : les fenêtres. PARTITION BY et ROWS BETWEEN en minuscules comme group by ; un calcul se dit en mots
     (« 0 plus 26, divided by 2, equals 13 days », « minus 23 days ») */
  .replace(/\bOVER \(\)/g, 'OVER').replace(/\bPARTITION BY\b/g, 'partition by').replace(/\bROWS BETWEEN\b/g, 'rows between')
  .replace(/\((\d+) (?:\+|plus) (\d+)\) ÷ (\d+) (?:=|equals) /g, '$1 plus $2, divided by $3, equals ').replace(/\bntile\b/g, 'N-tile').replace(/ ÷ /g, ' divided by ').replace(/−(\d)/g, 'minus $1')
  /* Module 8 (15 novembre) : les relations (« 1 to N », « N to N », pas « 1 gives N ») et les multiplicités UML dites signe par
     signe (« zero dot dot star », « one dot dot star », « zero dot dot one ») */
  .replace(/\b([1N]) [→↔] ([1N])\b/g, '$1 to $2')
  .replace(/\b([01])\.\.(\*|[01])/g, (t, a, b) => ['zero', 'one'][a] + ' dot dot ' + (b === '*' ? 'star' : ['zero', 'one'][b]))
  /* Module 9 (15 novembre) : « ALTER TABLE … SET SCHEMA » se dit en deux temps */
  .replace(/\bALTER TABLE … SET SCHEMA\b/g, 'ALTER TABLE, then SET SCHEMA')
  /* Module 11 (15 novembre) : la règle SET NULL d’un seul tenant (NULL seul passe en minuscules plus loin : pas « SET null ») */
  .replace(/\bSET NULL\b/g, 'set null')
  /* Module 12 (15 novembre) : « SELECT … FOR UPDATE » d’un seul tenant, sans la pause des points de suspension */
  .replace(/\bSELECT … FOR UPDATE\b/g, 'select for update');
const DIRE = s => PARLE(s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'))
  /* Comme les retouches de la voix française : « Prix en euros », « l’euro entre parenthèses », « le numéro de la page moins un » */
  .replace(/Price \(€\)/g, 'Price in euros').replace(/\(€\)/g, 'the euro in parentheses')
  .replace(/\(page − 1\) × (\d+)/g, 'the page number minus one, times $1')
  .replace(/\bstar \*/g, 'star').replace(/\*/g, 'star').replace(/\btable\.column\b/g, 'table dot column')
  .replace(/\b([a-z]+)\.(id)\b/g, '$1 dot ID')
  .replace(/\b([a-z]+(?:_[a-z]+)+)\b/g, w => w.split('_').map(x => x === 'id' ? 'ID' : x).join(' underscore '))
  .replace(W('id'), 'ID').replace(/\bno\.\s?(\d)/gi, 'number $1')
  .replace(/\bAUTOINCREMENT\b/g, 'auto increment').replace(/\bPRIMARY KEY\b/g, 'primary key').replace(/\bFOREIGN KEY\b/g, 'foreign key')
  .replace(/\bREFERENCES\b/g, 'references').replace(/\bINTEGER\b/g, 'integer').replace(/\bTEXT\b/g, 'text').replace(/\bREAL\b/g, 'real')
  .replace(/\bSELECT\b/g, 'select').replace(/\bFROM\b/g, 'from').replace(/\bINSERT INTO\b/g, 'insert into').replace(/\bAS\b/g, 'as')
  /* Module 2 (15 novembre) : les mots-clés en minuscules (dits, pas épelés), les opérateurs et les dates en toutes lettres */
  .replace(/'(\d{4})-(\d{2})-(\d{2})'/g, '$1, dash, $2, dash, $3')   // comme la voix française : 2023, tiret, 03, tiret, 01
  .replace(/\bORDER BY\b/g, 'order by').replace(/\bIS NOT NULL\b/g, 'is not null').replace(/\bIS NULL\b/g, 'is null')
  .replace(/\b(WHERE|AND|OR|NOT|NULL|LIKE|IN|BETWEEN|LIMIT|OFFSET|DISTINCT)\b/g, w => w.toLowerCase())
  .replace(/\bASC\b/g, 'ascending').replace(/\bDESC\b/g, 'descending')
  .replace(/(^|\s)(<=|>=|!=|<|>|=)(?=$|[\s,.;:!?])/g, (t, a, o) => a + {'<=': 'less than or equal to', '>=': 'greater than or equal to', '!=': 'not equal to', '<': 'less than', '>': 'greater than', '=': 'equals'}[o])
  .replace(/ → /g, ' gives ').replace(/ ⇔ /g, ' is the same as ').replace(/ ≠ /g, ' is different from ')
  .replace(/'([^'\s]*)%'/g, (t, x) => `${x} percent`).replace(/%/g, ' percent ').replace(/_/g, ' underscore ')
  .replace(/ = /g, ' equals ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
const parFichier = {};
for (const [k, f] of D.VOICE.caps) (parFichier[f] = parFichier[f] || []).push(k);
const SAY = {bienvu: 'Nice one!', rattrape: 'Nice save!', presque: 'Not quite. Read the explanation, then try again.',
  finbravo: 'Well done! You passed the lesson.', fineffort: 'One more push! Replay the missed moments to pass the lesson.'};
const tag = el => (/^\[(\w+)\]/.exec(el.texte) || [, 'cheerful'])[1];
const out = {cours, titre: fr.titre, note: `La voix anglaise de « ${fr.titre} » (module 1 : 14 novembre ; module 2 : 15 novembre) : chaque fichier garde l’id du français ; phrases : les légendes anglaises dites à voix haute ; cles : la légende française de chaque phrase (vkey).`,
  voix: {id: voixId, nom: voixNom}, modele: fr.modele, langue: 'en', format: fr.format, elements: []};
const manque = [], horsAppli = [], sansIndice = [];
for (const el of fr.elements) {
  let phrases = [], cles = null;
  if (el.id === 'ch00') phrases = [`${/^Premier cours/.test(el.texte.replace(/^\[\w+\]\s*/, '')) ? 'First' : 'New'} lesson: ${D.sub.toLowerCase()}.`, D.bulle];
  else if (parFichier[el.id]) {
    cles = parFichier[el.id];
    /* Un chapitre que la vidéo de l’appli ne joue plus (le « À retenir » de WHERE, passé dans le bilan) : pas de fichier */
    /* 15 novembre : ou dont aucune légende n’est traduite (le « Pour finir, voici les trois idées à retenir » des vidéos, coupé dans
       l’appli : ses légendes restaient en français, et leur voix était générée pour rien) */
    if (cles.every(k => !D.caps[k] || D.caps[k] === D.caps0[k])) { horsAppli.push(el.id); continue; }
    phrases = cles.map(k => { if (!D.caps[k]) manque.push(el.id + ':' + k); return D.caps[k] || ''; });
  }
  else if (/^at\d$/.test(el.id)) phrases = ['Your turn! ' + D.M[+el.id.slice(2) - 1].prompt];
  else if (/^indice\d$/.test(el.id)) {
    /* L’indice joué après deux erreurs : celui qui s’affiche (tip, moments.js). 15 novembre (module 8) : un moment qui n’en a pas
       (un tri à glisser, seulement une aide sur le geste) n’affiche rien et ne joue rien : pas de fichier. */
    if (!D.M[+el.id.slice(6) - 1].tip) { sansIndice.push(el.id); continue; }
    phrases = [D.M[+el.id.slice(6) - 1].tip];
  }
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
console.log('manque', manque, 'hors appli', horsAppli, 'sans indice', sansIndice, 'caracteres', out.elements.reduce((a, e) => a + e.texte.length, 0));
