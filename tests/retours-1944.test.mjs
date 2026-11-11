/* Elisa, 11 novembre, 19 h 43 et 19 h 44 : « Regarde maintenant dans la page selon le SGBD pour voir si tout est complet ou s’il faut
   modifier des choses. » La page relue écriture par écriture : les notes de version qui manquaient (SQL Server 2025 accepte
   CURRENT_DATE, DATETRUNC en 2022 pour la semaine aussi, TRIM en 2017, RENAME COLUMN de MySQL 8.0…), et les pièges classiques d’un
   SGBD à l’autre qui n’y étaient pas. Chaque nouvelle écriture marquée ✓ tourne vraiment dans le moteur de l’app
   (tests/sgbd-moteur.test.mjs) ; celles qu’il refuse portent le « ! ». Vérifié dans un navigateur à 393 px : rien ne déborde. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); return html.slice(i, j); };
const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
vm.runInContext(slice('const SGBD_NOMS=', 'function renderSgbdScreen(').replace(/^const /gm, 'var '), ctx);
const page = vm.runInContext('SGBD_PAGE', ctx), hors = vm.runInContext('SGBD_HORS_APP', ctx);
const ligne = (sec, debut) => { const s = page.find(x => x.id === sec); assert.ok(s, sec); const r = s.rows.find(x => x[0].startsWith(debut)); assert.ok(r, `${sec} · ${debut}`); return [r[0], [...r[1]], r[2]]; };

test('les besoins ajoutés, avec les bonnes écritures', () => {
  assert.deepEqual(ligne('nombres', 'Diviser deux nombres entiers')[1], ['3', '3', '3.5000', '3', '3.5'], 'la division entière');
  assert.deepEqual(ligne('texte', 'Comparer')[1], ['différents', 'différents', 'égaux', 'égaux', 'différents'], 'les majuscules dans une comparaison');
  assert.deepEqual(ligne('texte', 'Enlever les espaces')[1], Array(5).fill('TRIM(nom)'));
  assert.deepEqual(ligne('null', 'Les NULL dans un tri')[1], ['en premier', 'en dernier', 'en premier', 'en premier', 'en dernier']);
  assert.deepEqual(ligne('null', 'Un texte vide')[1].slice(4), ['devient NULL'], 'le texte vide d’Oracle');
  assert.deepEqual(ligne('conversion', 'Lire une date écrite')[1].slice(1), ["TO_DATE(date_fr, 'DD/MM/YYYY')", "STR_TO_DATE(date_fr, '%d/%m/%Y')", 'CONVERT(DATE, date_fr, 103)', "TO_DATE(date_fr, 'DD/MM/YYYY')"]);
  assert.deepEqual(ligne('combiner', 'Garder les lignes des deux tables')[1], ['acceptée', 'acceptée', 'refusée', 'acceptée', 'acceptée'], 'pas de FULL OUTER JOIN en MySQL');
  assert.deepEqual(ligne('combiner', 'Les lignes d’une requête absentes')[1], ['EXCEPT', 'EXCEPT', 'EXCEPT', 'EXCEPT', 'MINUS']);
  assert.deepEqual(ligne('combiner', 'Une CTE récursive')[1], ['WITH RECURSIVE', 'WITH RECURSIVE', 'WITH RECURSIVE', 'WITH', 'WITH']);
  assert.deepEqual(ligne('transactions', 'Poser un point de retour')[1], ['SAVEPOINT p', 'SAVEPOINT p', 'SAVEPOINT p', 'SAVE TRANSACTION p', 'SAVEPOINT p']);
  assert.deepEqual(ligne('transactions', 'Revenir à ce point')[1], ['ROLLBACK TO p', 'ROLLBACK TO p', 'ROLLBACK TO p', 'ROLLBACK TRANSACTION p', 'ROLLBACK TO p']);
  assert.deepEqual(ligne('tables', 'Renommer une colonne')[1][3], "EXEC sp_rename 't.nom', 'nom_client', 'COLUMN'");
});

test('les notes de version et les précisions', () => {
  const note = (sec, debut) => ligne(sec, debut)[2].note;
  assert.ok(note('dates', 'La date du jour').includes('2025'), 'SQL Server 2025 accepte CURRENT_DATE');
  assert.ok(note('dates', 'La date et l’heure').includes('UTC') && note('dates', 'La date et l’heure').includes("'localtime'"), 'l’heure universelle de SQLite');
  assert.ok(note('dates', 'Regrouper par semaine').includes('2022'));
  assert.ok(note('dates', 'Extraire l’année').includes('AS INTEGER'), 'STRFTIME renvoie du texte');
  assert.ok(note('texte', 'Assembler').includes('MySQL'), 'CONCAT et les NULL');
  assert.ok(note('pagination', 'Sauter 3 lignes').includes('ORDER BY'));
  assert.ok(note('requetes', 'Une colonne ni regroupée').includes('clé primaire'));
  assert.ok(note('tables', 'Une colonne vrai ou faux').includes('23ai'));
});

test('ce que le moteur de l’app refuse porte le « ! », et une écriture refusée n’est jamais cochée', () => {
  for (const c of ['CONVERT(DATE, date_fr, 103)', 'MINUS', 'START TRANSACTION', 'SAVE TRANSACTION p', 'ROLLBACK TRANSACTION p', 'SELECT … FOR UPDATE', 'WITH (UPDLOCK)', 'MERGE INTO …', 'INSERT … ON DUPLICATE KEY UPDATE …'])
    assert.ok(hors.has(c), c);
  const h = ctx.sgbdNeedHtml(ligne('combiner', 'Les lignes d’une requête absentes'));
  assert.ok(h.includes('<code class="sg-code">MINUS</code><i class="sg-bang"') && h.includes('<code class="sg-code">EXCEPT</code><i class="sg-check"'));
});

test('les questions d’entretien mènent à la nouvelle partie', () => {
  const c = {};
  vm.runInNewContext(html.slice(html.indexOf('const ENT_SGBD_CAT='), html.indexOf('\n', html.indexOf('const ENT_SGBD_CAT='))) + '\n'
    + html.slice(html.indexOf('function entSgbdTheme('), html.indexOf('\n}\n', html.indexOf('function entSgbdTheme(')) + 3) + ';this.f=entSgbdTheme;', c);
  assert.equal(c.f({ q: 'Quelle différence entre UNION et EXCEPT ?', a: '', cat: 'Ensembles' }), 'combiner');
  assert.equal(c.f({ q: 'Comment parcourir une hiérarchie ?', a: 'Avec WITH RECURSIVE.', cat: 'CTE' }), 'combiner');
  assert.equal(c.f({ q: 'Comment nettoyer un texte ?', a: 'Avec TRIM(nom).', cat: 'Divers' }), 'texte');
});
