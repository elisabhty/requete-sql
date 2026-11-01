/* Elisa, 1er novembre, 18 h 24 : « surligner quand ça concerne notre moteur (on l’a boosté : vérifie si on peut encore plus le
   booster) ». Chaque écriture de la page « Selon le SGBD » tourne dans le moteur de l’app, sauf les exceptions affichées « pas dans
   l’app » (SGBD_HORS_APP) ; et les fonctions ajoutées au moteur ce jour-là donnent le bon résultat. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({ TextEncoder, crypto });
const load = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); vm.runInContext(html.slice(i, j), ctx); };
load('function datePart(', 'function buildDb(');
load('const SGBD_NOMS=', 'function sgbdNeedHtml(');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const mk = () => {
  const d = new SQL.Database(); ctx.attachDateFns(d);
  d.run(`CREATE TABLE t(d TEXT, debut TEXT, fin TEXT, email TEXT, nom TEXT, prenom TEXT, telephone TEXT, prix REAL, stock INTEGER, x TEXT, c TEXT);
    INSERT INTO t VALUES('2026-07-02','2026-06-01','2026-07-02','lea@mail.fr','Martin','Léa','06 12 34 56 78',12.345,73,'42','a');
    INSERT INTO t VALUES('2026-02-10','2026-01-01','2026-03-01',NULL,'Bernard','Hugo','01 23',7.5,40,'7','b');
    CREATE TABLE commandes(id INTEGER); INSERT INTO commandes VALUES(1),(2);`);
  return d;
};
const one = (sql, d = mk()) => { try { const r = d.exec(sql); return r.length ? r[0].values[0][0] : null; } finally { d.close(); } };

test('toutes les écritures de la page tournent dans le moteur, sauf celles marquées « pas dans l’app »', () => {
  const page = vm.runInContext('SGBD_PAGE', ctx), hors = vm.runInContext('SGBD_HORS_APP', ctx);
  let n = 0;
  for (const s of page) for (const [besoin, codes, opt = {}] of s.rows) codes.forEach((c, i) => {
    const txt = opt.txt === true || (Array.isArray(opt.txt) && opt.txt.includes(i));
    if (txt || hors.has(c) || /^(SERIALIZABLE|READ COMMITTED|REPEATABLE READ)$/.test(c)) return;
    let q = `SELECT ${c} AS v FROM t`;
    if (/^(LIMIT|FETCH|OFFSET)/.test(c)) q = `SELECT nom FROM t ORDER BY nom ${c}`;
    else if (c.startsWith('SELECT TOP')) q = 'SELECT TOP 3 nom FROM t';
    else if (c.startsWith('id ')) q = `CREATE TABLE z(${c}, v TEXT); INSERT INTO z(v) VALUES('a'),('b'); SELECT MIN(id) FROM z`;
    else if (/^(DELETE|TRUNCATE)/.test(c)) q = `${c}; SELECT COUNT(*) FROM commandes`;
    const d = mk();
    let r; try { r = d.exec(q); } catch (e) { assert.fail(`${besoin} (${vm.runInContext('SGBD_NOMS', ctx)[i]}) : ${c} → ${e.message}`); } finally { d.close(); }
    if (c.startsWith('id ')) assert.equal(r.at(-1).values[0][0], 1, `${c} : l’identifiant s’incrémente vraiment`);
    if (/^(DELETE|TRUNCATE)/.test(c)) assert.equal(r.at(-1).values[0][0], 0, `${c} : la table est vide`);
    n++;
  });
  assert.ok(n > 100, `${n} écritures vérifiées`);
});

test('les résultats des écritures boostées sont les bons', () => {
  assert.equal(one('SELECT TRUNC(SYSDATE) = CURRENT_DATE'), 1, 'TRUNC d’une date (Oracle)');
  assert.equal(one("SELECT TRUNC('2026-07-02', 'MM')"), '2026-07-01');
  assert.equal(one("SELECT (DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day')::date FROM t"), '2026-07-31', 'intervalle composé après une fonction');
  assert.equal(one("SELECT DATE(CURRENT_DATE - 1) = DATE('now', '-1 day')"), 1, 'CURRENT_DATE - 1 : la veille');
  assert.equal(one('SELECT SUBSTRING(nom FROM 2 FOR 3) FROM t'), 'art');
  assert.equal(one("SELECT TRIM(LEADING '0' FROM '007')"), '7');
  assert.equal(one('SELECT SUBSTRING((SELECT nom FROM t), 2, 2)'), 'ar', 'le FROM d’une sous-requête n’est pas pris pour celui de SUBSTRING');
  assert.equal(one('SELECT TRY_CAST(x AS INT) FROM t'), 42);
  assert.equal(one('SELECT TIMESTAMPDIFF(DAY, debut, fin) FROM t'), 31);
  assert.equal(one('SELECT DATENAME(month, d) FROM t'), 'July');
  assert.equal(one("SELECT email ~ '@mail' FROM t"), 1);
  assert.equal(one('SELECT ~5'), -6, 'le ~ unaire reste l’opérateur binaire de SQLite');
  assert.equal(one("SELECT email RLIKE 'mail' FROM t"), 1);
  assert.equal(one('SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix) FROM t'), (12.345 + 7.5) / 2);
  assert.equal(one('SELECT MODE() WITHIN GROUP (ORDER BY stock) FROM t'), 40);
  assert.equal(one('SELECT BOOL_AND(stock > 30), BOOL_OR(stock > 70) FROM t'), 1);
  assert.equal(one("SELECT PATINDEX('%r%', nom) FROM t"), 3);
  assert.equal(one("SELECT STUFF(nom, 1, 2, 'XX') FROM t"), 'XXrtin');
  assert.equal(one("SELECT FIND_IN_SET('b', 'a,b,c')"), 2);
  assert.equal(one("SELECT NEXT_DAY('2026-07-02', 'MONDAY')"), '2026-07-06');
  assert.equal(one('SELECT ISNUMERIC(x) FROM t'), 1);
  assert.equal(one("SELECT LENGTH(UUID())"), 36);
});
