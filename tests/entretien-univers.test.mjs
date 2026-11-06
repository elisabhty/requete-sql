/* Elisa, 6 novembre : « Entretiens : des exemples originaux à la place des clients et commandes. »
   Les 142 questions d’entretien illustraient presque tout avec les tables de l’app (clients, commandes, produits : la
   boutique NutriBoost). Chaque exemple a désormais son univers, concret et le même dans toute la question (une
   bibliothèque, un festival, une compagnie aérienne, une station de ski, un food truck…), et deux questions voisines
   n’ont pas le même. La question, son niveau, ses notions et le fond de la réponse ne changent pas ; les questions
   dont l’exemple n’utilisait ni clients, ni commandes, ni produits gardent le leur.
   Et tout reste juste : chaque requête d’exemple s’exécute dans sql.js sur les données que montre l’exemple (sauf les
   blocs propres à un autre SGBD), et le tableau « Exemple concret » est exactement ce que donne la base.
   Les données : tests/fixtures/entretien-donnees.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lireEntretien, chargerSqlJs, verifierQuestion, blocs, autreSgbd, BOUTIQUE, sansFauxAmis } from './helpers/entretien-exemples.mjs';
import { DONNEES } from './fixtures/entretien-donnees.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = lireEntretien(ROOT);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SQL = await chargerSqlJs(ROOT);
const reecrites = E.filter(q => DONNEES[q.id] && !DONNEES[q.id].garde);

/* Les noms de la base de l’app : ses clients (prénom et nom) et ses produits. */
const seed = html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('CREATE TABLE fidelite'));
const CLIENTS = [...seed.matchAll(/\(\d+,'([^']+)','([^']+)'/g)].map(m => `${m[1]} ${m[2]}`);
const PRODUITS = [...seed.matchAll(/\(\d+,'([^']+)','[^']*',[\d.]+,\d+\)/g)].map(m => m[1]);

test('chaque question a ses données, et un univers', () => {
  for (const q of E) {
    const d = DONNEES[q.id];
    assert.ok(d, `${q.id} : ses données dans tests/fixtures/entretien-donnees.mjs`);
    assert.ok(d.u && typeof d.u === 'string', `${q.id} : un univers`);
  }
  assert.equal(Object.keys(DONNEES).length, E.length, 'pas de données pour une question qui n’existe pas');
});

test('plus de clients, de commandes ni de produits de la boutique dans les exemples', () => {
  assert.ok(CLIENTS.length >= 10 && PRODUITS.length >= 8, 'les clients et les produits de la base de l’app sont lus');
  for (const q of reecrites) {
    const exemple = sansFauxAmis([JSON.stringify(q.ex || {}), q.sql, JSON.stringify(q.etoile || {})].join('\n'));
    const m = exemple.match(new RegExp(BOUTIQUE.source, 'gi'));
    assert.ok(!m, `${q.id} : l’exemple utilise encore la boutique (${[...new Set(m || [])].join(', ')})`);
    const code = [...(q.a + (q.apres || '')).matchAll(/<code>([\s\S]*?)<\/code>/g)].map(x => x[1]).join(' ');
    assert.doesNotMatch(code, BOUTIQUE, `${q.id} : le code cité dans la réponse utilise encore la boutique`);
    /* La réponse ne parle de clients, de commandes ou de produits que si la question elle-même en parle. */
    if (!/client|command|produit/i.test(q.q)) {
      const prose = sansFauxAmis((q.a + ' ' + (q.apres || '')).replace(/<code>[\s\S]*?<\/code>/g, ' '));
      assert.doesNotMatch(prose, /\b(clients?|commandes?|produits?)\b/i, `${q.id} : la réponse illustre encore avec la boutique`);
    }
    const tout = [exemple, q.a, q.apres || ''].join('\n');
    for (const n of [...CLIENTS, ...PRODUITS]) assert.ok(!tout.includes(n), `${q.id} : « ${n} », de la base de l’app, est encore cité`);
  }
});

test('chaque requête d’exemple s’exécute dans sql.js, et le tableau est ce que donne la base', () => {
  for (const q of E) {
    const d = DONNEES[q.id];
    if (!d) continue;
    const { pbs } = verifierQuestion(SQL, q, d);
    assert.deepEqual(pbs, [], `${q.id} (${d.u}) :\n  ${pbs.join('\n  ')}`);
    assert.ok(d.ex || d.exLibre || d.verif || !q.ex, `${q.id} : le tableau de l’exemple est rejoué (ex, verif) ou dit pourquoi il ne l’est pas (exLibre)`);
    /* Ce qui n’est pas exécuté est bien propre à un autre SGBD, et le dit. */
    for (const k of d.autres || []) assert.ok(autreSgbd(blocs(q.sql)[k].tete), `${q.id} : le bloc ${k} dit à quel SGBD il s’adresse`);
  }
});

test('lisible sur iPhone : 30 caractères au plus par ligne de requête', () => {
  for (const q of E) for (const l of q.sql.split('\n')) assert.ok(l.length <= 30, `${q.id} : ligne de ${l.length} caractères (${l})`);
});

test('des univers variés : 8 questions au plus par univers, et deux questions voisines n’ont pas le même', () => {
  const avec = E.filter(q => DONNEES[q.id]);
  const parUnivers = {};
  for (const q of avec) (parUnivers[DONNEES[q.id].u] ||= []).push(q.id);
  for (const [u, ids] of Object.entries(parUnivers)) assert.ok(ids.length <= 8, `${u} : ${ids.length} questions (${ids.join(', ')})`);
  assert.ok(Object.keys(parUnivers).length >= 20, `${Object.keys(parUnivers).length} univers seulement`);
  /* Voisines : dans l’ordre des questions (« Question suivante »), et dans chaque thème de la liste. Deux exemples
     gardés tels quels peuvent se suivre (les comptes en banque des questions 66 et 67, l’application des 138 et 139). */
  const suites = [avec, ...[...new Set(E.map(q => q.cat))].map(c => avec.filter(q => q.cat === c))];
  for (const s of suites) for (let k = 1; k < s.length; k++) {
    const a = DONNEES[s[k - 1].id], b = DONNEES[s[k].id];
    if (a.garde && b.garde) continue;
    assert.notEqual(a.u, b.u, `${s[k - 1].id} et ${s[k].id} se suivent avec le même univers (${a.u})`);
  }
});
