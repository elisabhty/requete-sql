/* Elisa, 6 novembre : « Entretiens : des exemples originaux à la place des clients et commandes. »
   Les 142 questions d’entretien illustraient presque tout avec les tables de l’app (clients, commandes, produits : la
   boutique NutriBoost). Chaque exemple a désormais son univers, concret et le même dans toute la question (une
   bibliothèque, un festival, une compagnie aérienne, une station de ski, un food truck…), et deux questions voisines
   n’ont pas le même. La question, son niveau, ses notions et le fond de la réponse ne changent pas ; les questions
   dont l’exemple n’utilisait ni clients, ni commandes, ni produits gardent le leur.
   Et tout reste juste : chaque requête d’exemple s’exécute dans sql.js sur les données que montre l’exemple (sauf les
   blocs propres à un autre SGBD), et le tableau « Exemple concret » est exactement ce que donne la base.
   Les données : tests/fixtures/entretien-donnees.mjs.

   Elisa, 6 novembre, 22 h 50, sur les trois points laissés ouverts :
   - « Les réécrire » : les deux paires de voisines gardées dans le même univers. La question 67 (lecture sale) passe des
     comptes en banque à une compagnie aérienne (la dernière place d’un vol), la 138 (taux de conversion) de l’application
     à un service de vélos en libre-service ; la 66 garde la banque, la 139 l’application. Deux voisines n’ont donc jamais
     le même univers, sans exception.
   - « Les changer » : les prénoms de la base de l’app dans les exemples gardés (les employés des questions 26, 54, 75,
     82 et 123, les vendeurs de la 52). Plus aucun exemple ne reprend un prénom ou un nom des clients de l’app : ni
     ines@club.fr (03, 23), ni « Léa Martin » (44), ni Hugo, l’auteur (63).
   - « Ça me va » : les questions qui parlent elles-mêmes de clients, de commandes ou de produits (119, 120, 124, 125,
     140, 142) gardent ces mots dans la réponse. */
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
  /* Voisines : dans l’ordre des questions (« Question suivante »), et dans chaque thème de la liste. Sans exception
     depuis le 6 novembre (22 h 50) : les exemples gardés aussi (la 67 n’est plus à la banque comme la 66, la 138 n’est
     plus dans l’application comme la 139 et la 141). */
  const suites = [avec, ...[...new Set(E.map(q => q.cat))].map(c => avec.filter(q => q.cat === c))];
  for (const s of suites) for (let k = 1; k < s.length; k++) {
    const a = DONNEES[s[k - 1].id], b = DONNEES[s[k].id];
    assert.notEqual(a.u, b.u, `${s[k - 1].id} et ${s[k].id} se suivent avec le même univers (${a.u})`);
  }
  assert.equal(DONNEES['ent-v2-67'].u, 'compagnie aérienne');
  assert.equal(DONNEES['ent-v2-138'].u, 'location de vélos');
});

/* Les prénoms et les noms des clients de la base de l’app (Sophie Martin, Lucas Bernard, Emma Dubois…). */
const PERSONNES = [...new Set([...seed.slice(seed.indexOf('INSERT INTO clients'), seed.indexOf('INSERT INTO produits'))
  .matchAll(/\(\d+,'([^']+)','([^']+)'/g)].flatMap(m => [m[1], m[2]]))];
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const chaines = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(chaines) : v && typeof v === 'object' ? Object.values(v).flatMap(chaines) : []);

test('aucun exemple ne reprend un prénom ou un nom des clients de l’app', () => {
  assert.ok(PERSONNES.length >= 15 && ['Sophie', 'Lucas', 'Emma', 'Nathan', 'Martin', 'Petit'].every(n => PERSONNES.includes(n)), `les clients de l’app sont lus : ${PERSONNES.join(', ')}`);
  /* Toutes les chaînes de chaque question (exemple, requête, réponse…), sans tenir compte des accents ni des
     majuscules : « ines@club.fr » ou « HUGO » comptent aussi. Seul l’adjectif « petit » (« le plus petit id ») n’est
     pas un nom. */
  for (const q of E) for (const s of chaines(q)) for (const n of PERSONNES) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${sansAccent(n)}(?![\\p{L}\\p{N}_])`, 'giu');
    for (const m of sansAccent(s).matchAll(re)) {
      if (m[0] === 'petit') continue;
      assert.fail(`${q.id} : « ${n} », un client de l’app, dans « …${s.slice(Math.max(0, m.index - 30), m.index + n.length + 30)}… »`);
    }
  }
  /* Les exemples gardés ont d’autres prénoms. */
  const ex = id => JSON.stringify(E.find(q => q.id === id).ex);
  assert.ok(ex('ent-v2-26').includes('Karim, Julie') && ex('ent-v2-52').includes('Yasmine') && ex('ent-v2-54').includes('Hélène')
    && ex('ent-v2-82').includes('Claire') && ex('ent-v2-123').includes('Samia'), 'les employés et les vendeurs ont changé de prénom');
});
