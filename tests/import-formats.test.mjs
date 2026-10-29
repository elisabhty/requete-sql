/* Import de fichiers dans la console (Elisa, 29 octobre, 18 h 19) : « pouvoir importer des fichiers Excel et tous les types possibles ».
   import-formats.js lit sans bibliothèque les classeurs Excel récents (.xlsx), anciens (.xls) et OpenDocument (.ods), et découpe
   les CSV, TSV et textes à point-virgule. On le fait tourner ici sur trois petits classeurs de test. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), sw = read('sw.js');

function load() {
  const ctx = vm.createContext({TextDecoder, DecompressionStream, Response, Blob, Uint8Array, DataView, ArrayBuffer, Math, Date, String, Number, Array, Map, Set, Error, console});
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.runInContext(read('import-formats.js'), ctx);
  return ctx.ImportFormats;
}
const F = load();
const bytes = f => new Uint8Array(fs.readFileSync(path.join(root, 'tests/fixtures', f)));
const plain = x => JSON.parse(JSON.stringify(x));

test('un classeur Excel récent (.xlsx) : chaque feuille, dates et nombres compris', async () => {
  const r = plain(await F.readWorkbook(bytes('import-classeur.xlsx'), 'import-classeur.xlsx'));
  assert.equal(r.format, 'xlsx');
  assert.deepEqual(r.sheets.map(s => s.name), ['Clients', 'Produits']);
  assert.deepEqual(r.sheets[0].rows[0], ['id', 'prénom', 'ville', 'inscrit le', 'solde']);
  assert.deepEqual(r.sheets[0].rows[1], [1, 'Sophie', 'Paris', '2023-01-15', 12.5]);
  assert.equal(r.sheets[0].rows[3][3], '2023-09-30 14:05:00', 'une date avec heure');
  assert.deepEqual(r.sheets[1].rows[2], ['Oméga 3', 24.9]);
});

test('un ancien classeur Excel (.xls) : textes accentués, dates, cases à cocher et formules', async () => {
  const r = plain(await F.readWorkbook(bytes('import-ancien.xls'), 'import-ancien.xls'));
  assert.equal(r.format, 'xls');
  const rows = r.sheets[0].rows;
  assert.equal(r.sheets[0].name, 'Ventes');
  assert.deepEqual(rows[1], [1, 'Émilie Durand', '2024-03-05', 42.5, 1]);
  assert.equal(rows[3][3], 1234567.25);
  assert.deepEqual(rows[4].slice(0, 2), [4, 'Maëlle'], 'le résultat texte d’une formule');
  assert.equal(rows[4][3], 85, 'le résultat chiffré d’une formule');
});

test('un classeur OpenDocument (.ods), cellules répétées comprises', async () => {
  const r = plain(await F.readWorkbook(bytes('import-stock.ods'), 'import-stock.ods'));
  assert.equal(r.format, 'ods');
  assert.deepEqual(r.sheets[0].rows, [['produit', 'quantité', 'arrivé le'], ['Thé vert', 120, '2024-02-01'], ['Café', null, '2024-02-03']]);
});

test('les fichiers texte : point-virgule à la française, tabulations, guillemets', () => {
  const r = plain(F.parseDelimited('nom;prix\n"Café; moulu";12,5\nThé;3\n'));
  assert.equal(r.delimiter, ';');
  assert.deepEqual(r.rows, [['nom', 'prix'], ['Café; moulu', '12,5'], ['Thé', '3']], 'un point-virgule entre guillemets reste dans la cellule');
  assert.equal(F.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
});

test('l’app accepte ces formats et charge le lecteur hors ligne', () => {
  const accept = (/id="data-import"[^>]*accept="([^"]+)"/.exec(html) || [])[1] || '';
  for (const ext of ['.xlsx', '.xls', '.ods', '.csv', '.tsv', '.json', '.sql', '.db', '.sqlite']) assert.ok(accept.split(',').includes(ext), `accept ${ext}`);
  assert.ok(html.includes('<script src="import-formats.js'), 'le lecteur est chargé');
  assert.ok(sw.includes("'./import-formats.js'"), 'le lecteur est en cache pour le hors-ligne');
  assert.ok(html.includes('async function parseImportBytes(name,bytes)'), 'un seul point d’entrée pour tous les fichiers');
});
