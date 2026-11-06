/* Les exemples de l’écran « Entretien SQL », exécutés pour de vrai.
   Partagé par le test (tests/entretien-univers.test.mjs) et par les outils de relecture.

   Chaque question a, dans tests/fixtures/entretien-donnees.mjs, son univers et les données que montre son exemple
   (avant). La requête d’exemple (sql) est découpée en blocs, séparés par une ligne vide, puis en instructions :
   - un bloc propre à un autre SGBD (son commentaire de tête le dit : « -- SQL Server », « -- PostgreSQL, Oracle »,
     « (absent de SQLite) »…) est déclaré dans autres, et n’est pas exécuté ;
   - toutes les autres instructions s’exécutent dans sql.js, à la suite, sur les données montrées ; seules celles
     déclarées dans erreurs doivent échouer (une insertion refusée, une lecture après DROP…) ;
   - res fixe le résultat attendu d’une instruction ;
   - ex rejoue le tableau de l’exemple : une requête (ou une instruction de sql) dont le résultat donne, cellule
     par cellule, les lignes montrées (ex.rows), sur les colonnes indiquées. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export function lireEntretien(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const a = html.indexOf('const ENTRETIEN=['), b = html.indexOf('\n];', a) + 3;
  const ctx = {};
  vm.runInNewContext(html.slice(a, b).replace('const ENTRETIEN=', 'this.ENTRETIEN='), ctx);
  return JSON.parse(JSON.stringify(ctx.ENTRETIEN));
}

export async function chargerSqlJs(root) {
  const req = createRequire(import.meta.url);
  return req(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
}

/* Les blocs d’un exemple : séparés par une ligne vide ; le commentaire de tête dit à quel SGBD le bloc s’adresse. */
export function blocs(sql) {
  return sql.split(/\n[ \t]*\n/).map(texte => {
    const lignes = texte.split('\n');
    let k = 0;
    while (k < lignes.length && lignes[k].trim().startsWith('--')) k++;
    return { texte, tete: lignes.slice(0, k).join('\n'), code: lignes.slice(k).join('\n') };
  });
}

/* Un bloc propre à un autre SGBD : son commentaire de tête nomme un autre SGBD sans SQLite, ou dit que SQLite ne l’a pas. */
export const autreSgbd = tete => /(pas|absent|sans)\s+(de |dans |en )?SQLite/i.test(tete)
  || (/PostgreSQL|MySQL|SQL Server|Oracle/.test(tete) && !/SQLite/.test(tete));

/* Les instructions d’un bloc : coupées aux points-virgules, hors chaînes, commentaires et corps de trigger. */
export function instructions(code) {
  const out = [];
  let cur = '', i = 0, prof = 0, trigger = false;
  while (i < code.length) {
    const c = code[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < code.length) { if (code[j] === c) { if (code[j + 1] === c) { j += 2; continue; } break; } j++; }
      cur += code.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '-' && code[i + 1] === '-') {
      const j = code.indexOf('\n', i), fin = j < 0 ? code.length : j;
      cur += code.slice(i, fin); i = fin; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) j++;
      const mot = code.slice(i, j).toUpperCase();
      cur += code.slice(i, j); i = j;
      if (!trigger && /^\s*CREATE\s+(TEMP(ORARY)?\s+)?TRIGGER\b/i.test(cur.replace(/--[^\n]*/g, ''))) trigger = true;
      if (trigger && (mot === 'BEGIN' || mot === 'CASE')) prof++;
      if (trigger && mot === 'END') prof--;
      continue;
    }
    if (c === ';' && prof <= 0) { cur += c; out.push(cur); cur = ''; trigger = false; prof = 0; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(s => s.replace(/--[^\n]*/g, '').trim());
}

/* Les instructions à exécuter (blocs propres à un autre SGBD exclus), dans l’ordre. */
export function aExecuter(sql, autres = []) {
  const liste = [];
  blocs(sql).forEach((b, k) => { if (!autres.includes(k)) instructions(b.code).forEach(s => liste.push({ bloc: k, sql: s })); });
  return liste;
}

/* Une cellule, telle qu’on la compare : nombres sans unité ni espace (1 000 € → 1000, 12,50 → 12.5, −25 % → -25). */
const UNITE = /\s*(€|%|kg|km|min|ms|s|m|°C|°|ans|jours?|nuits?|places?|pts|points)$/;
export function cellule(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  const s = String(v).replace(/[  ]/g, ' ').trim();
  const n = s.replace(UNITE, '').replace(/^[+]/, '').replace(/^−/, '-').replace(/(\d) (?=\d{3}\b)/g, '$1').replace(/^(-?\d+),(\d+)$/, '$1.$2');
  return /^-?\d+(\.\d+)?$/.test(n) ? String(Math.round(+n * 1e6) / 1e6) : s;
}
const ligne = r => r.map(cellule).join(' | ');

/* Exécute l’exemple d’une question. Renvoie la liste des problèmes (vide si tout est juste) et ce qui a été exécuté. */
export function verifierQuestion(SQL, q, d) {
  const pbs = [], journal = [], ouvertes = [];
  const db = new SQL.Database();
  try {
    if (d.fk !== false) db.run('PRAGMA foreign_keys = ON');
    if (d.avant) {
      try { db.exec(d.avant); } catch (e) { pbs.push(`les données de l’exemple ne se chargent pas : ${e.message}`); return { pbs, journal }; }
    }
    const bl = blocs(q.sql);
    for (const k of d.autres || []) {
      if (!bl[k]) pbs.push(`bloc ${k} déclaré propre à un autre SGBD, mais il n’existe pas`);
      else if (!autreSgbd(bl[k].tete)) pbs.push(`bloc ${k} déclaré propre à un autre SGBD sans que son commentaire le dise : ${bl[k].tete || bl[k].code.split('\n')[0]}`);
    }
    const liste = aExecuter(q.sql, d.autres);
    const resultats = [];
    /* Deux sessions en parallèle (« -- Session A », « -- Session B ») : chacune a sa base, avec les mêmes données. */
    const bases = { A: db }, sessionDe = {};
    if (d.sessions) {
      let cur = 'A';
      bl.forEach((b, k) => { const m = /Session\s+(\w+)/.exec(b.tete); if (m) cur = m[1]; sessionDe[k] = cur; });
      for (const nom of new Set(Object.values(sessionDe))) if (!bases[nom]) {
        const b = new SQL.Database(); ouvertes.push(b); if (d.fk !== false) b.run('PRAGMA foreign_keys = ON'); if (d.avant) b.exec(d.avant); bases[nom] = b;
      }
    }
    liste.forEach((ins, i) => {
      let res = null, err = null;
      const base = d.sessions ? bases[sessionDe[ins.bloc]] : db;
      try { const r = base.exec(ins.sql); res = r.length ? r[r.length - 1] : { columns: [], values: [] }; } catch (e) { err = e.message; }
      resultats.push(res);
      journal.push({ i, bloc: ins.bloc, sql: ins.sql, err, res: res && res.values.length ? res.values.map(ligne) : [] });
      const attendue = (d.erreurs || []).includes(i);
      if (err && !attendue) pbs.push(`l’instruction ${i} échoue : ${ins.sql.split('\n')[0]}… → ${err}`);
      if (!err && attendue) pbs.push(`l’instruction ${i} devait échouer et réussit : ${ins.sql.split('\n')[0]}…`);
      if (d.res && d.res[i] !== undefined && res) {
        /* Sans ORDER BY, l’ordre des lignes n’est pas garanti : on compare alors les lignes triées. */
        const attendu = Array.isArray(d.res[i]) ? { rows: d.res[i] } : d.res[i];
        const pris = r => attendu.cols ? attendu.cols.map(j => r[j]) : r;
        const range = l => (/ORDER\s+BY/i.test(ins.sql) ? l : [...l].sort());
        const voulu = range(attendu.rows.map(ligne)), eu = range(res.values.map(pris).map(ligne));
        if (JSON.stringify(voulu) !== JSON.stringify(eu)) pbs.push(`l’instruction ${i} donne ${JSON.stringify(eu)} au lieu de ${JSON.stringify(voulu)}`);
      }
      if (d.colonnes && d.colonnes[i] && res && JSON.stringify(res.columns) !== JSON.stringify(d.colonnes[i])) pbs.push(`l’instruction ${i} renvoie les colonnes ${res.columns.join(', ')} au lieu de ${d.colonnes[i].join(', ')}`);
    });
    for (const k of d.erreurs || []) if (k >= liste.length) pbs.push(`erreur attendue sur l’instruction ${k}, qui n’existe pas`);
    for (const k of Object.keys(d.res || {})) if (+k >= liste.length) pbs.push(`résultat attendu pour l’instruction ${k}, qui n’existe pas`);
    /* Le tableau de l’exemple, rejoué. */
    for (const c of d.ex || []) {
      let values;
      if (c.sql) {
        /* avant : le tableau montre les données d’origine (avant une suppression, une mise à jour…). */
        const base = c.avant ? new SQL.Database() : db;
        try {
          if (c.avant) { base.run('PRAGMA foreign_keys = ON'); if (d.avant) base.exec(d.avant); }
          const r = base.exec(c.sql); values = r.length ? r[r.length - 1].values : [];
        } catch (e) { pbs.push(`la requête qui rejoue le tableau échoue : ${e.message}`); continue; }
        finally { if (c.avant) base.close(); }
      } else {
        const r = resultats[c.instr];
        if (!r) { pbs.push(`le tableau rejoue l’instruction ${c.instr}, sans résultat`); continue; }
        values = r.values;
      }
      const rows = (q.ex.rows || []).filter(c.lignes || (() => true));
      const cols = c.cols || rows[0].map((_, j) => j);
      const range = l => (c.sql || /ORDER\s+BY/i.test((journal[c.instr] || {}).sql || '') ? l : [...l].sort());
      const voulu = range(rows.map(r => cols.map(j => r[j])).map(ligne)), eu = range(values.map(r => (c.rcols ? c.rcols.map(j => r[j]) : r)).map(ligne));
      if (JSON.stringify(voulu) !== JSON.stringify(eu)) pbs.push(`le tableau de l’exemple montre ${JSON.stringify(voulu)}, la base donne ${JSON.stringify(eu)}`);
    }
    /* Un contrôle sur mesure (des colonnes, un plan d’exécution…) : renvoie un problème, ou rien. */
    if (d.verif) {
      const ouvrir = () => { const b = new SQL.Database(); if (d.avant) b.exec(d.avant); return b; };
      const p = d.verif({ rows: (q.ex || {}).rows || [], resultats, db, ouvrir, cellule });
      if (p) pbs.push(p);
    }
  } finally { db.close(); ouvertes.forEach(b => b.close()); }
  return { pbs, journal };
}

/* Les tables et les données de la boutique NutriBoost (la base de l’app) : leurs noms ne doivent plus servir d’exemple. */
/* « produit cartésien », « le produit des deux tailles », « se produit » : des mots de la boutique qui n’en parlent pas. */
export const sansFauxAmis = t => String(t).replace(/produits? cartésiens?/gi, ' ').replace(/\ble produit des\b/gi, ' ')
  .replace(/\bse produi\w*/gi, ' ').replace(/\bproduit (une|un|des|aussi|alors)\b/gi, ' ');
export const BOUTIQUE = /\b(clients?|commandes?|produits?|lignes?_commandes?|details?_commandes?|client_id|commande_id|produit_id|date_commande|numero_commande|fidelite|nutriboost)\b/i;
