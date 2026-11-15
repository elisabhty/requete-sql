/* Les bases des défis et leurs 477 défis dans une langue (Elisa, 15 novembre, 14 h 40 : « Tu peux traduire les données d'exemple
   […] la base du cours et base, tu vois, aquarium, machin. Il faut qu'un Anglais comprenne ce qu'il y a dans la base. Et quand il
   va exécuter les exos, il faut qu'il comprenne ce qu'il y a »).

     node tools/langue/defis.mjs --langue en recolter [base…]   # ce qui reste à traduire → travail/<l>/defis/<base>.md
     node tools/langue/defis.mjs --langue en construire          # tools/langue/defis/<l>/<base>.json → langue-<l>-defis.js
     node tools/langue/defis.mjs --langue en verifier [base…]    # les solutions donnent le même résultat dans les deux langues

   Une base, un fichier tools/langue/defis/<l>/<base>.json (gardé dans le dépôt) :
     tables   : {bassins: ['tanks', {nom: 'name', …}]}   les tables et leurs colonnes ;
     defauts  : {reste: 'remaining'}                       les noms des solutions hors des tables (alias, WITH) ;
     valeurs  : {'Eau douce': 'Freshwater'}                les valeurs de la base et celles écrites dans les solutions ;
     gardees  : ['aquariologistes.prenom', …]              les colonnes dont les valeurs restent telles quelles (prénoms, noms,
                                                            villes, e-mails : comme les clients de la base des cours) ;
     textes   : {'français': 'traduction'}                 la base (son nom, sa présentation, ses tables, ses colonnes) et ses défis
                                                            (titre, situation sans « À toi de jouer ! », affiche, garde, tri,
                                                            à savoir, indice).
   L'appli traduit tout ça au chargement (defisLangue, index.html) ; les salles renvoient au serveur la requête récrite pour la base
   française (REQUETE_LANGUE.versFrancais), le serveur vérifiant sur sa copie française. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, lire, travail, moteur } from './commun.mjs';

const argv = process.argv.slice(2);
const li = argv.indexOf('--langue'), LANGUE = li >= 0 ? argv[li + 1] : 'en';
const reste = argv.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
const ACTION = reste[0] || 'recolter', CHOIX = reste.slice(1);
const DOSSIER = path.join(ROOT, 'tools/langue/defis', LANGUE);
const SORTIE = `langue-${LANGUE}-defis.js`;

/* ---------- Ce que l'appli contient ---------- */
const app = lire('index.html');
const bloc = (debut, fin) => { const i = app.indexOf(debut); if (i < 0) throw Error(debut); const j = app.indexOf(fin, i); return app.slice(i + debut.length, j); };
export const CHALLENGES = vm.runInNewContext('([' + bloc('const CHALLENGES=[', '\n];\n') + '\n])');
export const DEFI_BASES = vm.runInNewContext('({' + bloc('const DEFI_BASES={', '\n};\n') + '\n})');
export const DEFI_TABLES_MOTS = vm.runInNewContext('({' + bloc('const DEFI_TABLES_MOTS={', '\n};\n') + '\n})');
export const DEMO_SQL = vm.runInNewContext('({' + bloc('const DEMO_SQL={', '\n};\n') + '\n})');
export const BASES = Object.keys(DEFI_BASES);
const propre = s => String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
/* La situation telle que l'appli l'affiche : sans son « À toi de jouer ! » final (defiSituationSeule) */
export const situationSeule = s => String(s || '').replace(/\s*À toi de jouer[\s ]*!\s*$/, '').trim();
/* Les textes d'un défi, dans l'ordre de la page */
export function textesDefi(c) {
  return [c.titre, situationSeule(c.situation), ...(c.affiche || []), ...(c.garde || []), c.tri, ...(c.precis || []), c.indice]
    .filter(x => x != null && String(x).trim()).map(propre);
}
/* Les textes d'une base : son nom, sa présentation, ses tables et ses colonnes, les mots de ses tables (indices) */
export function textesBase(id) {
  const b = DEFI_BASES[id], out = [b.nom, b.desc];
  for (const t in b.tables || {}) out.push(b.tables[t]);
  for (const t in b.cols || {}) for (const c in b.cols[t]) out.push(b.cols[t][c]);
  for (const t in DEFI_TABLES_MOTS[id] || {}) out.push(DEFI_TABLES_MOTS[id][t]);
  return out.filter(Boolean).map(propre);
}

/* ---------- SQLite ---------- */
const SQL = await createRequire(import.meta.url)(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(ROOT, 'vendor/sqljs', f)});
function ouvrir(sql) { const d = new SQL.Database(); d.run(sql); return d; }
function schema(d) {
  const tables = d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values.map(r => r[0]) || [];
  return tables.map(t => ({t, cols: d.exec(`PRAGMA table_info("${t}")`)[0].values.map(r => ({c: r[1], type: String(r[2] || '')}))}));
}
function executer(d, sql) { const r = d.exec(sql); const x = r[r.length - 1]; return x ? {cols: x.columns, rows: x.values} : {cols: [], rows: []}; }

/* ---------- Les traductions d'une base ---------- */
export function lireBase(id) {
  const f = path.join(DOSSIER, id + '.json');
  if (!fs.existsSync(f)) return {tables: {}, defauts: {}, valeurs: {}, gardees: [], textes: {}};
  const o = JSON.parse(fs.readFileSync(f, 'utf8'));
  return {tables: o.tables || {}, defauts: o.defauts || {}, valeurs: o.valeurs || {}, valeursColonnes: o.valeursColonnes || {}, valeursRetour: o.valeursRetour || {}, gardees: o.gardees || [], solutions: o.solutions || {}, textes: o.textes || {}};
}
/* Tous les textes déjà traduits, toutes bases confondues : un texte commun (« son nom », « par date ») n'a qu'une traduction */
let TOUS = null;
function tousTextes() {
  if (TOUS) return TOUS;
  TOUS = {};
  for (const id of [...BASES, '_commun']) { const t = lireBase(id).textes; for (const k in t) TOUS[propre(k)] = t[k]; }
  return TOUS;
}
const traduit = k => Object.prototype.hasOwnProperty.call(tousTextes(), propre(k));
const MOTS_SQL = new Set(('SELECT DISTINCT FROM JOIN LEFT RIGHT FULL INNER OUTER CROSS NATURAL ON USING WHERE AND OR NOT IN EXISTS LIKE GLOB BETWEEN IS NULL '
  + 'GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET CASE WHEN THEN ELSE END UNION ALL INTERSECT EXCEPT AS WITH RECURSIVE OVER PARTITION ROWS RANGE '
  + 'PRECEDING FOLLOWING UNBOUNDED CURRENT ROW TRUE FALSE CAST INTEGER REAL TEXT NUMERIC DATE TIME ESCAPE FILTER COLLATE NOCASE').split(' '));
/* Les noms d'une solution qui ne sont ni des tables ni des colonnes de sa base : alias, résultats intermédiaires (WITH) */
function nomsHorsBase(sol, sch) {
  const connus = new Set(); sch.forEach(x => { connus.add(x.t.toLowerCase()); x.cols.forEach(c => connus.add(c.c.toLowerCase())); });
  const out = new Set();
  const sans = String(sol).replace(/'(?:[^']|'')*'/g, "''");
  for (const m of sans.matchAll(/([A-Za-z_][A-Za-z0-9_]*)(\s*\()?/g)) {
    const n = m[1], u = n.toUpperCase();
    /* Un alias d'une ou deux lettres (FROM bassins b, r1) reste tel quel */
    if (MOTS_SQL.has(u) || m[2] || connus.has(n.toLowerCase()) || /^\d/.test(n) || n.length <= 2) continue;
    out.add(n);
  }
  return [...out];
}
const litteraux = sol => [...String(sol).matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"));
const estDonneeBrute = v => /^[\d\s:.,%+-]*$/.test(v) || /^(?:%[a-zA-Z][^a-zA-Z%]*)+$/.test(v) || /^\d{4}-\d{2}(-\d{2})?([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v) || /^%?[\d-]+%?$/.test(v);

/* ---------- 1. Récolter ---------- */
function recolter() {
  const dir = travail(LANGUE, 'defis'); fs.mkdirSync(dir, {recursive: true});
  let total = 0;
  for (const id of CHOIX.length ? CHOIX : BASES) {
    const B = DEFI_BASES[id], tr = lireBase(id), d = ouvrir(B.sql), sch = schema(d), L = [];
    const manque = k => !traduit(k);
    L.push(`# ${id} : ${B.nom}`, '');
    const txt = textesBase(id).filter(manque);
    if (txt.length) L.push('## Textes de la base', ...txt.map(x => '- ' + x), '');
    const tablesManquantes = [];
    L.push('## Tables, colonnes et valeurs');
    for (const {t, cols} of sch) {
      const tt = tr.tables[t];
      L.push(`### ${t}${tt ? ' → ' + tt[0] : ' (à traduire)'}`);
      if (!tt) tablesManquantes.push(t);
      for (const {c, type} of cols) {
        const ct = tt && tt[1][c];
        const garde = tr.gardees.includes(`${t}.${c}`);
        let vals = [];
        try { vals = d.exec(`SELECT "${c}", COUNT(*) FROM "${t}" WHERE typeof("${c}")='text' GROUP BY 1 ORDER BY 2 DESC, 1`)[0]?.values || []; } catch (e) {}
        const aTraduire = garde ? [] : vals.filter(([v]) => !estDonneeBrute(v) && !Object.prototype.hasOwnProperty.call(tr.valeurs, v));
        if (ct && !aTraduire.length) continue;
        L.push(`- ${c}${ct ? ' → ' + ct : ''} (${type})${garde ? ' [gardée]' : ''}${aTraduire.length ? ' : ' + aTraduire.map(([v, n]) => JSON.stringify(v) + (n > 1 ? '×' + n : '')).join(', ') : ''}`);
      }
    }
    L.push('');
    const defis = CHALLENGES.filter(c => c.base === id);
    const hors = new Set(), lits = new Set();
    for (const c of defis) {
      nomsHorsBase(c.sol, sch).forEach(n => { if (!Object.prototype.hasOwnProperty.call(tr.defauts, n.toLowerCase())) hors.add(n); });
      litteraux(c.sol).forEach(v => { if (!estDonneeBrute(v) && !Object.prototype.hasOwnProperty.call(tr.valeurs, v)) lits.add(v); });
    }
    if (hors.size) L.push('## Noms des solutions (alias, WITH)', [...hors].join(', '), '');
    if (lits.size) L.push('## Valeurs écrites dans les solutions', [...lits].map(v => JSON.stringify(v)).join(', '), '');
    if (DEMO_SQL[id]) L.push('## La requête de démo', DEMO_SQL[id], '');
    let n = 0;
    L.push('## Défis');
    for (const c of defis) {
      const k = textesDefi(c).filter(manque);
      if (!k.length) continue;
      n++;
      L.push(`### ${c.id} (${c.niv}) · sol : ${c.sol}`, ...k.map(x => '- ' + x), '');
    }
    d.close();
    fs.writeFileSync(path.join(dir, id + '.md'), L.join('\n'));
    const nb = txt.length + n + tablesManquantes.length + hors.size + lits.size;
    total += nb;
    console.log(`${id} : ${tablesManquantes.length} tables, ${txt.length} textes de la base, ${n} défis, ${hors.size} noms, ${lits.size} valeurs de solutions à traduire`);
  }
  console.log(total ? `→ tools/langue/travail/${LANGUE}/defis/<base>.md` : 'Tout est traduit.');
}

/* ---------- 2. Construire langue-<l>-defis.js ---------- */
function construire() {
  const bases = {}, textes = {};
  for (const id of BASES) {
    const tr = lireBase(id);
    if (!Object.keys(tr.tables).length) continue;
    const defauts = {}; for (const k in tr.defauts) defauts[k.toLowerCase()] = tr.defauts[k];
    bases[id] = {tables: tr.tables, defauts, valeurs: tr.valeurs};
    if (Object.keys(tr.solutions).length) bases[id].solutions = tr.solutions;
    /* Une valeur traduite autrement selon sa colonne (« Suisse » : Swiss, nationalité ; Switzerland, pays) */
    if (Object.keys(tr.valeursColonnes).length) bases[id].valeursColonnes = tr.valeursColonnes;
    /* Une valeur qu'une solution écrite à la main (solutions) traduit autrement : la salle la ramène en français */
    if (Object.keys(tr.valeursRetour).length) bases[id].valeursRetour = tr.valeursRetour;
    for (const k in tr.textes) {
      const c = propre(k);
      /* Un même texte français dans deux bases : une seule traduction possible (les textes sont communs à toute l'appli) */
      if (Object.prototype.hasOwnProperty.call(textes, c) && textes[c] !== tr.textes[k]) console.log(`  ✗ ${id} : « ${c} » traduit autrement dans une autre base (« ${textes[c]} » / « ${tr.textes[k]} »)`);
      textes[c] = tr.textes[k];
    }
  }
  /* Les étiquettes du schéma pour chaque table traduite (« Déplier la table bookings ») : la table y est écrite dans la langue */
  if (LANGUE === 'en') for (const id in bases) for (const fr in bases[id].tables) {
    const t = bases[id].tables[fr][0], k = (c, v) => { if (!Object.prototype.hasOwnProperty.call(textes, c)) textes[c] = v; };
    k(`Déplier la table ${t}`, `Expand the ${t} table`);
    k(`Plier la table ${t}`, `Collapse the ${t} table`);
    k(`Déplier la table ${t} : ses {1} colonnes`, `Expand the ${t} table: its {1} columns`);
    k(`Table ${t}, {1} lignes, {2} colonnes`, `Table ${t}, {1} rows, {2} columns`);
    k(`Table ${t}, {1} colonnes, {2} lignes : allumer ses relations`, `Table ${t}, {1} columns, {2} rows: highlight its relationships`);
  }
  /* Les textes communs à tous les défis (les notions des indices, DEFI_OUTILS) */
  const commun = lireBase('_commun');
  for (const k in commun.textes) textes[propre(k)] = commun.textes[k];
  const tete = `/* ${SORTIE} : les bases des défis et leurs défis, dans la langue (fabriqué par tools/langue/defis.mjs à partir de
   tools/langue/defis/${LANGUE}/<base>.json : ne pas modifier à la main). Chargé par l'appli seulement (langues.js, data-defis). */\n`;
  const corps = `window.REQUETE_LANGUE && window.REQUETE_LANGUE.ajouter(${JSON.stringify(LANGUE)}, {\n  bases: ${JSON.stringify(bases)},\n  textes: {\n`
    + Object.entries(textes).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }\n});\n';
  fs.writeFileSync(path.join(ROOT, SORTIE), tete + corps);
  console.log(`${SORTIE} : ${Object.keys(bases).length} bases, ${Object.keys(textes).length} textes`);
}

/* ---------- 3. Vérifier ---------- */
/* Du français resté dans une traduction : un mot outil, ou un mot en minuscules avec un accent (les noms propres, Marées, gardent les leurs) */
/* Les noms propres de plusieurs mots (« La Perle du Wok », « Trois Marées ») : leurs mots outils ne sont pas du français oublié */
const NOMS_PROPRES = /\b[A-ZÀ-Ý][\wÀ-ÿ’'-]*(?:\s+(?:du|de|des|la|le|les|aux?|et|d’|l’)\s*[A-ZÀ-Ý][\wÀ-ÿ’'-]*)+/g;
const FRANCAIS = /\b(le|la|les|des|du|une?|est|sont|avec|pour|dans|qui|que|chaque|leur|sur|par|et|ou|au|aux|ses|son|sa)\b|(^|[^A-Za-zÀ-ÿ])[a-zà-ÿ]*[àâçéèêëîïôûùœ][a-zà-ÿ]*/;
function verifier() {
  const L = moteur(LANGUE, [SORTIE]);
  let erreurs = 0, avis = 0;
  const err = m => { erreurs++; console.log('  ✗ ' + m); }, info = m => { avis++; console.log('  · ' + m); };
  for (const id of CHOIX.length ? CHOIX : BASES) {
    const B = DEFI_BASES[id], tr = lireBase(id);
    console.log(`${id}`);
    if (!L.baseTraduite(id)) { err('base sans traduction'); continue; }
    const fr = ouvrir(B.sql);
    let en;
    try { en = ouvrir(L.sql(B.sql, null, id)); } catch (e) { err('la base traduite ne se crée pas : ' + e.message); fr.close(); continue; }
    const schFr = schema(fr), schEn = schema(en);
    /* Tables et colonnes : toutes traduites, sans doublon */
    const nomsEn = new Set();
    for (const {t, cols} of schFr) {
      const x = tr.tables[t];
      if (!x) { err(`table ${t} sans traduction`); continue; }
      if (nomsEn.has(x[0])) err(`deux tables s'appellent ${x[0]}`); nomsEn.add(x[0]);
      const vus = new Set();
      for (const {c} of cols) { if (!x[1][c]) err(`colonne ${t}.${c} sans traduction`); else if (vus.has(x[1][c])) err(`deux colonnes ${x[0]}.${x[1][c]}`); vus.add(x[1][c]); }
    }
    if (schEn.map(x => x.t).join() !== schFr.map(x => tr.tables[x.t]?.[0]).join()) err('les tables de la base traduite ne sont pas celles attendues');
    /* Valeurs : toutes traduites, sauf les colonnes gardées ; une traduction n'est pas celle de deux valeurs différentes */
    const inv = {};
    const paires = [...Object.entries(tr.valeurs), ...Object.values(tr.valeursColonnes).flatMap(o => Object.entries(o)), ...Object.entries(tr.valeursRetour).map(([e, f]) => [f, e])];
    for (const [f, e] of paires) { if (inv[e] && inv[e] !== f) err(`« ${e} » traduit à la fois « ${inv[e]} » et « ${f} »`); inv[e] = f; }
    for (const {t, cols} of schFr) for (const {c} of cols) {
      if (tr.gardees.includes(`${t}.${c}`)) continue;
      const vals = fr.exec(`SELECT DISTINCT "${c}" FROM "${t}" WHERE typeof("${c}")='text'`)[0]?.values.map(r => r[0]) || [];
      const vc = tr.valeursColonnes[`${t}.${c}`] || {};
      const sans = vals.filter(v => !estDonneeBrute(v) && !Object.prototype.hasOwnProperty.call(tr.valeurs, v) && !Object.prototype.hasOwnProperty.call(vc, v));
      if (sans.length) err(`${t}.${c} : ${sans.length} valeurs sans traduction (${sans.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}…)`);
    }
    /* Une valeur d'une colonne gardée (un animal nommé « Mona ») que la base traduirait ailleurs (l'espèce « Mona ») : le SQL de la
       base les traduit toutes les deux, sans voir la colonne */
    for (const g of tr.gardees) { const [t, c] = g.split('.');
      const vals = fr.exec(`SELECT DISTINCT "${c}" FROM "${t}" WHERE typeof("${c}")='text'`)[0]?.values.map(r => r[0]) || [];
      for (const v of vals) if (Object.prototype.hasOwnProperty.call(tr.valeurs, v) && tr.valeurs[v] !== v) err(`${g} : « ${v} » serait traduit « ${tr.valeurs[v]} » (colonne gardée)`); }
    /* Textes de la base */
    const tb = textesBase(id).filter(k => !traduit(k));
    if (tb.length) err(`${tb.length} textes de la base sans traduction`);
    /* Les défis */
    for (const c of CHALLENGES.filter(x => x.base === id)) {
      const tx = textesDefi(c).filter(k => !traduit(k));
      if (tx.length) err(`${c.id} : ${tx.length} textes sans traduction`);
      for (const k of textesDefi(c)) { const v = tousTextes()[k]; if (v && FRANCAIS.test(v.replace(/`[^`]*`/g, '').replace(/[«“][^»”]*[»”]/g, '').replace(NOMS_PROPRES, ''))) info(`${c.id} : du français ? ${JSON.stringify(v).slice(0, 120)}`); }
      if (c.tri && tousTextes()[propre(c.tri)] && (propre(c.tri).split(/,\s*puis\s+/).length !== tousTextes()[propre(c.tri)].split(/,\s*then\s+/).length)) err(`${c.id} : le tri n'a pas le même nombre d'étapes (« , then »)`);
      const solEn = L.solution(id, c.id) || L.sql(c.sol, null, id);
      for (const n of nomsHorsBase(solEn, schEn)) if (/[^\x00-\x7f]/.test(n) || Object.prototype.hasOwnProperty.call(tr.defauts, n.toLowerCase()) === false && nomsHorsBase(c.sol, schFr).includes(n)) err(`${c.id} : nom resté en français dans la solution : ${n}`);
      for (const v of litteraux(solEn)) if (!estDonneeBrute(v) && !Object.values(tr.valeurs).includes(v) && litteraux(c.sol).includes(v) && !tr.gardees.length) info(`${c.id} : valeur gardée telle quelle : ${v}`);
      let rf, re, rr;
      try { rf = executer(fr, c.sol); } catch (e) { info(`${c.id} : la solution française échoue (${e.message})`); continue; }
      try { re = executer(en, solEn); } catch (e) { err(`${c.id} : la solution traduite échoue : ${e.message}\n      ${solEn}`); continue; }
      /* Le résultat traduit, ramené en français (une valeur traduite selon sa colonne, Swiss ou Switzerland, revient à « Suisse ») */
      const versFr = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(inv, v) ? inv[v] : v;
      const versEn = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(tr.valeurs, v) ? tr.valeurs[v] : v;
      /* Deux façons de comparer : le français passé en anglais (un nom gardé, « Tiger », reste lui-même), ou l'anglais ramené en
         français (une valeur traduite selon sa colonne, Swiss) ; l'une des deux suffit. */
      const avecEn = rf.rows.map(r => JSON.stringify(r.map(versEn))).join('\n') === re.rows.map(r => JSON.stringify(r)).join('\n');
      const a = avecEn ? re.rows.map(r => JSON.stringify(r)) : rf.rows.map(r => JSON.stringify(r)), b = avecEn ? a : re.rows.map(r => JSON.stringify(r.map(versFr)));
      if (rf.cols.length !== re.cols.length) err(`${c.id} : ${rf.cols.length} colonnes en français, ${re.cols.length} traduites`);
      else if (a.length !== b.length) info(`${c.id} : ${a.length} lignes en français, ${b.length} traduites (le texte le dit-il ?)`);
      else if (a.join('\n') !== b.join('\n')) {
        if ([...a].sort().join('\n') === [...b].sort().join('\n')) { if (c.ordered) info(`${c.id} : mêmes lignes, autre ordre (tri sur un texte traduit)`); }
        else info(`${c.id} : résultat différent (${a.filter(x => !b.includes(x)).slice(0, 2).join(' | ').slice(0, 160)})`);
      }
      /* Les salles : la requête traduite, récrite pour la base française, donne le résultat français */
      try { rr = executer(fr, L.versFrancais(solEn, id)); } catch (e) { err(`${c.id} : la requête récrite en français échoue : ${e.message}\n      ${L.versFrancais(solEn, id)}`); continue; }
      if (JSON.stringify(rr.rows) !== JSON.stringify(rf.rows)) err(`${c.id} : la requête récrite en français ne donne pas le résultat français\n      ${L.versFrancais(solEn, id)}`);
    }
    if (DEMO_SQL[id]) { try { executer(en, L.sql(DEMO_SQL[id], null, id)); } catch (e) { err('la requête de démo échoue : ' + e.message); } }
    fr.close(); en.close();
  }
  console.log(erreurs ? `${erreurs} erreurs, ${avis} remarques` : `Aucune erreur, ${avis} remarques`);
  if (erreurs) process.exitCode = 1;
}

if (ACTION === 'recolter') recolter();
else if (ACTION === 'construire') construire();
else if (ACTION === 'verifier') verifier();
else console.log('Actions : recolter, construire, verifier');
