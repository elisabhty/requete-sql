/* Elisa, 1er novembre, 0 h 49 : « comment on va savoir qu’une requête est juste pour l’user car il peut renommer avec des
   alias etc ? ça sera jamais pareil pareil + pareil avec les jointures qui peuvent s’inverser » → « corrige ».
   Un défi compare le résultat, pas le texte ; les colonnes peuvent maintenant venir dans n’importe quel ordre. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({});
vm.runInContext(cut('function normCell(v)', 'function fmtLignes(n)'), ctx);
const aero = cut("aeroport:{nom:'Aéroport',", '\n`}');
const d = new SQL.Database(); d.run(aero.slice(aero.indexOf('sql:`') + 5));
const juste = (user, sol, ordered = false) => { ctx.u = d.exec(user); ctx.s = d.exec(sol); ctx.c = { ordered }; return vm.runInContext('exerciseResultsMatch(u,s,c,true)', ctx); };

const PERDUS = "SELECT b.id AS id_bagage, p.prenom, p.nom, v.numero_vol FROM bagages b JOIN reservations r ON r.id = b.reservation_id JOIN passagers p ON p.id = r.passager_id JOIN vols v ON v.id = r.vol_id WHERE b.statut = 'Perdu' ORDER BY b.id";

test('alias, noms de tables, ordre des jointures : la même réponse', () => {
  assert.ok(juste("SELECT bagages.id, passagers.prenom, passagers.nom, vols.numero_vol FROM vols JOIN reservations ON reservations.vol_id = vols.id JOIN passagers ON passagers.id = reservations.passager_id JOIN bagages ON bagages.reservation_id = reservations.id WHERE bagages.statut = 'Perdu' ORDER BY bagages.id", PERDUS, true));
});

test('les colonnes dans un autre ordre sont acceptées, triées ou non', () => {
  assert.ok(juste("SELECT v.numero_vol, p.nom, p.prenom, b.id FROM bagages b JOIN reservations r ON r.id = b.reservation_id JOIN passagers p ON p.id = r.passager_id JOIN vols v ON v.id = r.vol_id WHERE b.statut = 'Perdu' ORDER BY b.id", PERDUS, true));
  assert.ok(juste("SELECT email, nom, prenom FROM passagers WHERE nationalite = 'Française'", "SELECT prenom, nom, email FROM passagers WHERE nationalite = 'Française' ORDER BY nom, prenom"));
  /* Deux colonnes aux mêmes valeurs ne trompent pas la recherche */
  assert.ok(juste('SELECT capacite, id, id FROM avions', 'SELECT id, id, capacite FROM avions'));
});

test('anti-jointure : LEFT JOIN, NOT IN ou NOT EXISTS', () => {
  const sol = 'SELECT p.prenom, p.nom, p.email FROM passagers p LEFT JOIN reservations r ON r.passager_id = p.id WHERE r.id IS NULL ORDER BY p.nom, p.prenom';
  assert.ok(juste('SELECT prenom, nom, email FROM passagers WHERE id NOT IN (SELECT passager_id FROM reservations) ORDER BY nom, prenom', sol, true));
  assert.ok(juste('SELECT email, prenom, nom FROM passagers p WHERE NOT EXISTS (SELECT 1 FROM reservations r WHERE r.passager_id = p.id) ORDER BY nom, prenom', sol, true));
});

test('toujours refusé : autres lignes, mauvais tri, colonne en trop ou en moins, colonnes mélangées entre lignes', () => {
  assert.equal(juste("SELECT id FROM bagages WHERE statut = 'Retardé'", "SELECT id FROM bagages WHERE statut = 'Perdu'"), false);
  assert.equal(juste("SELECT numero_vol FROM vols WHERE statut = 'Retardé' ORDER BY numero_vol", "SELECT numero_vol FROM vols WHERE statut = 'Retardé' ORDER BY date_depart, heure_depart", true), false);
  assert.equal(juste("SELECT prenom, nom, email, id FROM passagers", 'SELECT prenom, nom, email FROM passagers'), false);
  assert.equal(juste('SELECT prenom, nom FROM passagers', 'SELECT prenom, nom, email FROM passagers'), false);
  /* Mêmes valeurs par colonne mais pas sur les mêmes lignes : refusé */
  assert.equal(juste('SELECT p.prenom, q.nom FROM passagers p JOIN passagers q ON q.id = 56 - p.id WHERE p.id BETWEEN 1 AND 55', 'SELECT prenom, nom FROM passagers'), false);
});

test('les leçons gardent leur comparaison d’avant ; la salle de défi passe par la même vérification', () => {
  assert.ok(app.includes('return (expected||[]).every((result,i)=>isChallenge?memeResultatColonnesLibres(actual[i],result,ordered):normalize([actual[i]],ordered)===normalize([result],ordered));'));
  assert.ok(app.includes('if(resultatsDefiEgaux(userRes,solRes,c,'));
  assert.ok(app.includes('const ok=isDefi?resultatsDefiEgaux(userRes,solRes,current,'));
});
