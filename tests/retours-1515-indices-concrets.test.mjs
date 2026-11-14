/* 14 novembre, 15 h 15 (Elisa, sa capture du défi « Quelles expériences sont planifiées ? », indice 2/3 « La piste » : « Ah non les
   indices sont nuls là, on comprend rien ») ; à la question, « Concret ». Trois indices lus dans la solution de chaque défi, jamais la
   requête entière :
   1. Où chercher : les tables, les colonnes à afficher (et ce qu’elles veulent dire quand le nom ne le dit pas), celles du filtre ;
   2. La méthode : la requête clause par clause, en mots, et la notion particulière s’il y en a une ;
   3. À compléter : la requête, chaque valeur et le tri final remplacés par « … » (sinon la liste des colonnes). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({ esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), escCode: s => String(s), highlight: s => s });
vm.runInContext(cut('const CHALLENGES=[', '\n/* La consigne d’un défi').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
vm.runInContext(cut('function defiTables(sol){', 'function defiIndicesHTML('), ctx);
vm.runInContext(cut('function sqlEnLignes(sql){', '\n/* La partie s’en va'), ctx);
const D = id => ctx.CHALLENGES.find(c => c.id === id);
const texte = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

test('la capture d’Elisa : les trois indices du défi des expériences planifiées', () => {
  const c = D('lf3'), [[t1, i1], [t2, i2], [t3, i3]] = ctx.defiIndices(c);
  assert.deepEqual([t1, t2, t3], ['Où chercher', 'La méthode', 'À compléter']);
  assert.equal(i1, 'Table <code>experiences</code>. À afficher : <code>nom</code>, <code>date_experience</code> (date prévue) et <code>duree_heures</code> (durée en heures). Pour filtrer : <code>statut</code>.');
  assert.equal(i2, '<ul class="coach-etapes"><li><b>SELECT</b> : les 3 colonnes</li><li><b>FROM</b> <code>experiences</code></li><li><b>WHERE</b> sur <code>statut</code></li><li><b>ORDER BY</b> : par date prévue</li></ul>');
  assert.equal(ctx.sqlEnLignes(ctx.defiACompleter(c)), "SELECT nom, date_experience, duree_heures\nFROM experiences\nWHERE statut = '…'\nORDER BY …");
  assert.ok(i3.startsWith('Remplace chaque «&nbsp;…&nbsp;».<div class="ex-code">'));
});

test('des défis plus durs : jointure, groupe, sous-requête, EXISTS, WITH, fonction de fenêtre', () => {
  const m = id => texte(ctx.defiMethode(D(id)));
  assert.match(m('af7'), /LEFT JOIN reservations, reliée par passager_id.*WHERE sur reservations\.id \(IS NULL\)/);
  assert.match(m('af31'), /GROUP BY nationalite : un groupe par valeur.*HAVING : un filtre sur le calcul de chaque groupe/);
  assert.match(m('am4'), /WHERE sur reservations\.classe, reservations\.prix, avec une sous-requête/);
  assert.match(m('am6'), /WHERE, avec EXISTS et NOT EXISTS/);
  assert.match(m('ad3'), /^WITH : prépare d’abord 2 résultats intermédiaires \(totaux, moyenne\), puis :/);
  assert.match(m('ad2'), /dont 2 calculs \(COUNT, RANK avec OVER\)/);
  assert.match(texte(ctx.defiOuChercher(D('af31'))), /nb \(à calculer, nombre de passagers/);
  assert.equal(ctx.defiACompleter(D('af31')), 'SELECT nationalite, COUNT(*) AS nb FROM passagers GROUP BY nationalite HAVING COUNT(*) >= … ORDER BY …');
});

test('les 477 défis : jamais la requête entière, chaque valeur à trouver, une méthode, aucun trou dans le texte', () => {
  assert.equal(ctx.CHALLENGES.length, 477);
  for (const c of ctx.CHALLENGES) {
    const I = ctx.defiIndices(c), t = ctx.defiACompleter(c);
    assert.ok(t.includes('…') && t.replace(/\s/g, '') !== c.sol.replace(/;\s*$/, '').replace(/\s/g, ''), `${c.id} : jamais la requête entière`);
    for (const v of c.sol.match(/'(?:[^']|'')*'/g) || []) assert.ok(!t.includes(v) || v === "''", `${c.id} : ${v} à trouver`);
    assert.ok(/<li><b>SELECT/.test(I[1][1]), `${c.id} : la méthode commence par le SELECT`);
    assert.ok(!/undefined|NaN|\[object/.test(I.map(x => x[1]).join('')), `${c.id} : rien d’indéfini`);
    assert.ok(/^Tables? <code>/.test(I[0][1]), `${c.id} : les tables nommées`);
  }
});

test('la méthode se lit : une ligne par clause, le mot-clé en gras', () => {
  for (const r of ['html.lq .coach-etapes{display:grid;gap:5px;margin:2px 0 0;padding:0;list-style:none}', 'html.lq .coach-notion{margin:10px 0 0;'])
    assert.ok(css.includes(r), r);
  assert.ok(css.indexOf('html.lq .coach-etapes{') < css.indexOf('Défis — la refonte du 7 novembre'), 'avec les autres règles des indices (hors des Défis)');
});
