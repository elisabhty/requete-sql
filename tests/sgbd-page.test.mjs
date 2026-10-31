/* Les cours suivent SQLite ; la page « Selon le SGBD » de la Bibliothèque fait la correspondance avec
   PostgreSQL, MySQL, SQL Server et Oracle. Les remarques des cours renvoient vers elle. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); return html.slice(i, j); };
const ctx = vm.createContext({esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')});
vm.runInContext(slice('const SGBD_NOMS=', 'function renderSgbdScreen(').replace(/^const /gm, 'var '), ctx);
const page = vm.runInContext('SGBD_PAGE', ctx);

test('la page compare SQLite à quatre SGBD, besoin par besoin', () => {
  assert.equal(JSON.stringify(vm.runInContext('SGBD_NOMS', ctx)), JSON.stringify(['SQLite', 'PostgreSQL', 'MySQL', 'SQL Server', 'Oracle']));
  assert.equal(new Set(page.map(s => s.id)).size, page.length, 'thèmes uniques');
  for (const s of page) for (const [besoin, codes] of s.rows) assert.equal(codes.length, 5, `${s.t} · ${besoin}`);
  const need = ctx.sgbdNeedHtml(page.find(s => s.id === 'dates').rows.find(r => r[0] === 'Extraire l’année'));
  /* Elisa, 31 octobre, 8 h 37 : « ne rien surligner et ne pas mettre cours » : SQLite s’écrit comme les autres */
  assert.match(need, /<div class="sg-row"><span class="sg-who"><span class="sg-n">SQLite<\/span><\/span><code class="sg-code">STRFTIME\('%Y', d\)<\/code>/);
  assert.ok(!need.includes('is-lite') && !need.includes('<i>cours</i>'), 'ni surlignage ni « cours »');
  assert.match(need, /PostgreSQL<\/span> · <span class="sg-n">Oracle<\/span><\/span><code class="sg-code">EXTRACT\(YEAR FROM d\)/, 'mêmes écritures regroupées');
  assert.match(ctx.sgbdNeedHtml(page.find(s => s.id === 'nombres').rows[0]), /<span class="sg-who">Partout<\/span>/, 'identique partout');
});

test('chaque renvoi des cours mène à un thème de la page, et s’ouvre dans une feuille', () => {
  const ids = new Set(page.map(s => s.id));
  const links = [...html.matchAll(/<button type='button' class='sgbd-link' data-sgbd='(\w+)'>Selon le SGBD<\/button>/g)].map(m => m[1]);
  assert.ok(links.length >= 4, `${links.length} renvois`);   // cours texte et cartes mémo (les cours en vidéo n’ont plus de texte : 65 ALTER TABLE, 66 DROP et 71 Concurrence et isolation le sont devenus)
  for (const id of links) assert.ok(ids.has(id), `thème inconnu : ${id}`);
  // « tables » et « transactions » n’ont plus de renvoi : le premier était dans l’ancien cours texte DROP (TRUNCATE), le second dans l’ancien cours texte
  // Concurrence et isolation (les niveaux d’isolation), devenus des cours en vidéo ; les deux thèmes restent dans la Bibliothèque
  for (const id of ['dates', 'nombres', 'conversion', 'agregats']) assert.ok(links.includes(id), `renvoi vers ${id}`);
  assert.ok(ids.has('transactions') && ids.has('tables'), 'les thèmes sans renvoi restent dans la page');
  assert.ok(html.includes('<div class="viz" id="sgbd-sheet" role="dialog" aria-modal="true" aria-labelledby="sgbd-sheet-title">'));
  assert.ok(html.includes("const link=t.closest('.sgbd-link[data-sgbd]');") && html.includes('openSgbdSheet(link.dataset.sgbd)'), 'clic sur un renvoi');
  assert.ok(html.includes("if(document.getElementById('sgbd-sheet')?.classList.contains('on')){closeSgbdSheet();return;}"), 'Échap ferme la feuille');
});

test('la page est une entrée de la Bibliothèque', () => {
  assert.ok(html.includes("['sgbd','Selon le SGBD','SQLite comparé à PostgreSQL, MySQL, SQL Server et Oracle.',\"switchTab('sgbd')\"]"));
  assert.ok(html.includes('<section id="scr-sgbd" class="screen">') && html.includes('<h1>Selon le SGBD</h1>'));
  assert.ok(html.includes("if(['notes','collection','stickers','entretien','sgbd','library'].includes(tab))return 'library';"), 'onglet Bibliothèque allumé');
  assert.equal((html.match(/entretien:'scr-entretien',sgbd:'scr-sgbd',/g) || []).length, 2, 'écran connu de switchTab et de screenForTab');
  assert.ok(html.includes("else if(tab==='sgbd') renderSgbdScreen();"));
});

test('les cours, les quiz et les cartes mémo n’emploient que les fonctions de SQLite', () => {
  const courses = slice('const MODULES = [', 'let state=');
  const others = ['YEAR(', 'MONTH(', 'DAY(', 'CEILING', 'GREATEST(', 'NVL(', 'ISNULL(', 'DATEADD', 'DATEDIFF', 'TO_CHAR', 'DATE_FORMAT', 'STRING_AGG', 'LISTAGG',
    'GETDATE', 'NOW()', 'CURDATE', 'LEFT(', 'RIGHT(', 'LEN(', 'CHAR_LENGTH', 'POW(', 'LN(', 'MOD(', 'TRUNC(', 'EXTRACT(', 'INTERVAL', 'SELECT TOP', 'FETCH FIRST', 'ILIKE', 'SEPARATOR'];
  for (const f of others) assert.ok(!courses.includes(f), `fonction d’un autre SGBD dans les cours : ${f}`);
  assert.ok(courses.includes("[\"🎨\",\"<code>STRFTIME()</code> change l’<b>affichage</b> d’une date :\",null,\"STRFTIME('%d/%m/%Y', date_commande)\"]"), 'réflexe du cours sur les dates');
});
