/* Moteur SQL : SQLite, complété par les fonctions courantes de PostgreSQL, MySQL, SQL Server et Oracle
   (bloc SQLX d’index.html). Une requête écrite à la manière d’un autre SGBD marche aussi dans l’app. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = vm.createContext({});
const load = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); vm.runInContext(html.slice(i, j), ctx); };
load('const SCHEMA_SQL =', 'let state=');
load('function datePart(', 'function buildDb(');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
const db = new SQL.Database();
db.run(vm.runInContext('SCHEMA_SQL', ctx));
ctx.attachDateFns(db);
const one = sql => db.exec(sql)[0].values[0];

test('dates : MySQL, SQL Server, PostgreSQL et Oracle', () => {
  assert.deepEqual(one("SELECT YEAR('2026-07-02'), MONTH('2026-07-02'), DAY('2026-07-02'), HOUR('2026-07-02 14:05:09'), MINUTE('2026-07-02 14:05:09')"), [2026, 7, 2, 14, 5]);
  assert.deepEqual(one("SELECT DAYOFWEEK('2026-07-02'), WEEKDAY('2026-07-02'), DAYOFYEAR('2026-07-02'), DAYNAME('2026-07-02'), MONTHNAME('2026-07-02')"), [5, 3, 183, 'Thursday', 'July']);
  assert.deepEqual(one("SELECT DATEDIFF('2026-08-03', '2026-07-02'), DATEDIFF('month', '2026-07-31', '2026-08-01')"), [32, 1]);
  assert.deepEqual(one("SELECT DATEADD('day', 7, '2026-07-28'), ADDDATE('2026-07-28', 7), ADD_MONTHS('2026-01-31', 1), LAST_DAY('2026-02-10'), EOMONTH('2026-02-10', 1)"),
    ['2026-08-04', '2026-08-04', '2026-02-28', '2026-02-28', '2026-03-31']);
  assert.deepEqual(one("SELECT DATE_PART('year', '2026-07-02'), DATE_TRUNC('month', '2026-07-18 10:22:00')"), [2026, '2026-07-01 00:00:00']);
  assert.deepEqual(one("SELECT DATE_FORMAT('2026-07-02', '%d/%m/%Y'), TO_CHAR('2026-07-02', 'DD/MM/YYYY'), TO_CHAR('2026-07-02', 'FMDD Month YYYY')"), ['02/07/2026', '02/07/2026', '2 July 2026']);
  assert.deepEqual(one("SELECT TO_DATE('02/07/2026', 'DD/MM/YYYY'), STR_TO_DATE('02/07/2026', '%d/%m/%Y'), MAKE_DATE(2026, 7, 2), DATEFROMPARTS(2026, 2, 30)"), ['2026-07-02', '2026-07-02', '2026-07-02', null]);
  assert.match(one('SELECT NOW()')[0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(one('SELECT CURDATE()')[0], /^\d{4}-\d{2}-\d{2}$/);
});

test('texte, nombres et conditions', () => {
  assert.deepEqual(one("SELECT LEFT('Sophie', 3), RIGHT('Sophie', 3), LEN('abc  '), CHAR_LENGTH('Léa'), LPAD('7', 3, '0'), INITCAP('jean-paul DUPONT'), SPLIT_PART('a,b,c', ',', 2)"),
    ['Sop', 'hie', 3, 3, '007', 'Jean-Paul Dupont', 'b']);
  assert.deepEqual(one("SELECT LOCATE('p', 'Sophie'), STRPOS('Sophie', 'h'), REPEAT('ab', 2), TRANSLATE('abc', 'ab', 'xy'), REGEXP_REPLACE('06 39 98', ' ', '')"), [3, 4, 'abab', 'xyc', '063998']);
  assert.deepEqual(one("SELECT 'sophie@mail.fr' REGEXP '^[a-z]+@', REGEXP_SUBSTR('CMD-2026-1002481', '[0-9]+')"), [1, '2026']);
  assert.deepEqual(one('SELECT CEILING(12.5), POW(2, 10), LN(1), LOG(2, 8), MOD(7, 3), TRUNC(2.789, 2), GREATEST(3, 9, 4), LEAST(3, 9, 4)'), [13, 1024, 0, 3, 1, 2.78, 9, 3]);
  assert.deepEqual(one("SELECT IF(1, 'oui', 'non'), NVL(NULL, 'x'), NVL2(NULL, 'a', 'b'), DECODE(2, 1, 'un', 2, 'deux', 'autre'), GREATEST(1, NULL)"), ['oui', 'x', 'b', 'deux', null]);
});

test('agrégats : LISTAGG d’Oracle, écarts-types et variances', () => {
  const rows = db.exec("SELECT categorie, LISTAGG(nom, ', ') FROM produits GROUP BY categorie")[0].values;
  assert.deepEqual(rows.find(r => r[0] === 'Bien-être'), ['Bien-être', 'Fibre Prébiotique, Magnésium, Oméga 3']);
  const [sd, sdPop, varPop] = one('SELECT STDDEV(prix), STDDEV_POP(prix), VAR_POP(prix) FROM produits');
  assert.ok(Math.abs(sd - 10.1426) < 1e-3 && Math.abs(sdPop - 9.4875) < 1e-3 && Math.abs(varPop - 90.0136) < 1e-3);
});

test('écritures des autres SGBD réécrites pour SQLite : TOP, FETCH FIRST, EXTRACT, INTERVAL, WITHIN GROUP…', () => {
  const col = sql => db.exec(sql)[0].values.map(r => r[0]);
  assert.deepEqual(col('SELECT TOP 2 nom FROM produits ORDER BY prix DESC'), ['Collagène Marin', 'Protéine Végétale']);
  assert.deepEqual(col('SELECT nom FROM produits ORDER BY prix DESC FETCH FIRST 2 ROWS ONLY'), ['Collagène Marin', 'Protéine Végétale']);
  assert.deepEqual(col('SELECT nom FROM produits ORDER BY prix DESC OFFSET 2 ROWS FETCH NEXT 2 ROWS ONLY'), ['Fibre Prébiotique', 'Oméga 3']);
  assert.deepEqual(one("SELECT EXTRACT(YEAR FROM '2026-07-02'), DATEADD(day, 7, '2026-07-28'), DATEDIFF(day, '2026-07-02', '2026-08-03')"), [2026, '2026-08-04', 32]);
  assert.deepEqual(one("SELECT ISNULL(NULL, 'aucun'), CONVERT(INT, '42'), CONVERT('12.7', SIGNED), CAST('2026-07-02 10:00:00' AS DATE)"), ['aucun', 42, 12, '2026-07-02']);
  assert.deepEqual(one("SELECT DATE_ADD('2026-07-28', INTERVAL 7 DAY), '2026-07-02' + INTERVAL '7 days', '2026-07-02' - INTERVAL 1 MONTH"), ['2026-08-04', '2026-07-09', '2026-06-02']);
  const rows = db.exec("SELECT categorie, LISTAGG(nom, ', ') WITHIN GROUP (ORDER BY prix DESC) FROM produits GROUP BY categorie")[0].values;
  assert.deepEqual(rows.find(r => r[0] === 'Bien-être'), ['Bien-être', 'Fibre Prébiotique, Oméga 3, Magnésium']);
  assert.deepEqual(col("SELECT prenom FROM clients WHERE prenom ILIKE 's%'"), ['Sophie']);
  assert.deepEqual(one("SELECT '42'::int + 1, '2026-07-02'::date"), [43, '2026-07-02']);
  assert.deepEqual(one("SELECT GROUP_CONCAT(nom ORDER BY prix DESC SEPARATOR ' / ') FROM produits WHERE categorie = 'Nutrition'"), ['Protéine Végétale / Vitamine D']);
  assert.deepEqual(one("SELECT POSITION('@' IN 'sophie@mail.fr'), FORMAT('2026-07-02', 'dd/MM/yyyy'), FORMAT('%d €', 12)"), [7, '02/07/2026', '12 €']);
  /* Les textes et les commentaires ne sont jamais réécrits, et date + 7 reste le piège de SQLite (2033) */
  assert.deepEqual(one("SELECT 'TOP 3 FETCH FIRST 1 ROWS ONLY', 'a::b' -- EXTRACT(YEAR FROM x)"), ['TOP 3 FETCH FIRST 1 ROWS ONLY', 'a::b']);
  assert.deepEqual(one("SELECT '2026-07-02' + 7"), [2033]);
  assert.equal(ctx.sqlCompat('SELECT ville, COUNT(*) FROM clients GROUP BY ville;'), 'SELECT ville, COUNT(*) FROM clients GROUP BY ville;');
});

test('les fonctions natives de SQLite restent celles de SQLite', () => {
  assert.deepEqual(one("SELECT STRFTIME('%d/%m/%Y', '2026-07-02'), DATE('2026-07-28', '+7 days'), MAX(1, 5), CONCAT('a', NULL, 'b')"), ['02/07/2026', '2026-08-04', 5, 'ab']);
});

test('les fonctions ajoutées sont posées sur toutes les bases, et reposées après export()', () => {
  for (const s of ['buildDb(){ if(db)db.close(); db=new SQL.Database(); attachDateFns(db);', 'const d=new SQL.Database(baseBytes); attachDateFns(d);',
    'customDbs[item.id]=attachDateFns(new SQL.Database(b64ToU8(item.b64)));', 'const b64=u8ToB64(database.export());\n    attachDateFns(database);'])
    assert.ok(html.includes(s), s);
  assert.equal((html.match(/customDbs\[(?:id|target)\]=attachDateFns\(new SQL\.Database\(\)\);/g) || []).length, 3, 'bases créées ou importées');
});
