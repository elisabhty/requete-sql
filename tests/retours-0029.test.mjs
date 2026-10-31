/* Elisa, 1er novembre, 0 h 29 : « Dans la partie défis, je ne veux pas travailler sur les défis de la base ecom : je vais te
   donner des bases avec table cohérente à intégrer pour travailler sur ça pour les défis ». Première base : Aéroport.
   « Corriger pour coller » : les remarques qui accompagnaient la base sont vraies dans les données. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sqlAero = cut("aeroport:{nom:'Aéroport',", '\n`}');
const base = () => { const d = new SQL.Database(); d.run('PRAGMA foreign_keys = ON'); d.run(sqlAero.slice(sqlAero.indexOf('sql:`') + 5)); return d; };
const col = (d, q) => (d.exec(q)[0] || { values: [] }).values.map(v => v[0]);

test('Aéroport : 7 tables, les volumes annoncés, aucune clé étrangère orpheline', () => {
  const d = base();
  const n = t => d.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
  assert.deepEqual(['passagers', 'compagnies', 'avions', 'aeroports', 'vols'].map(n), [55, 6, 14, 18, 40]);
  assert.equal(n('reservations'), 130);
  assert.equal(n('bagages'), 128);
  assert.equal(d.exec('PRAGMA foreign_key_check').length, 0);
  /* Dates et heures en texte (SQLite ne lit pas DATE '…') */
  assert.ok(!/\b(DATE|TIME) '/.test(sqlAero));
  d.close();
});

test('les remarques de la base sont vraies dans les données', () => {
  const d = base();
  assert.deepEqual(col(d, 'SELECT v.id FROM vols v LEFT JOIN reservations r ON r.vol_id=v.id WHERE r.id IS NULL ORDER BY 1'), [21, 38, 39, 40]);
  assert.deepEqual(col(d, 'SELECT p.id FROM passagers p LEFT JOIN reservations r ON r.passager_id=p.id WHERE r.id IS NULL ORDER BY 1'), [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55]);
  assert.deepEqual(col(d, 'SELECT passager_id FROM reservations GROUP BY 1 HAVING COUNT(DISTINCT vol_id) > 1 ORDER BY 1'), [1, 2, 3, 6, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 37, 38]);
  assert.deepEqual(col(d, 'SELECT vol_id FROM reservations WHERE passager_id = 1 ORDER BY 1'), [1, 6, 17, 20], 'Camille Moreau');
  assert.equal(col(d, 'SELECT COUNT(*) FROM reservations WHERE passager_id = 21')[0], 6, 'Oliver Smith');
  assert.deepEqual(col(d, 'SELECT DISTINCT r.passager_id FROM reservations r LEFT JOIN bagages b ON b.reservation_id=r.id WHERE b.id IS NULL'), [3], 'Léa Petit, seule sans bagage');
  assert.deepEqual(col(d, 'SELECT COUNT(*) FROM vols GROUP BY compagnie_id ORDER BY compagnie_id').slice(0, 2), [10, 7], 'AlphaJet et SkyWings');
  assert.deepEqual(col(d, "SELECT id FROM vols WHERE statut='Annulé' ORDER BY 1"), [21, 38]);
  assert.deepEqual(col(d, "SELECT id FROM vols WHERE statut='Retardé' ORDER BY 1"), [6, 14, 26, 32]);
  assert.deepEqual(col(d, "SELECT id FROM bagages WHERE statut='Perdu' ORDER BY 1"), [19, 59, 70]);
  assert.deepEqual(col(d, "SELECT id FROM bagages WHERE statut='Retardé' ORDER BY 1"), [15, 16, 45, 85]);
  assert.deepEqual(col(d, 'SELECT id FROM bagages WHERE poids_kg IS NULL'), [67]);
  /* Cohérence : un avion vole pour sa compagnie, pas de siège en double, pas de réservation après le départ ni sur un vol annulé */
  assert.equal(col(d, 'SELECT COUNT(*) FROM vols v JOIN avions a ON a.id=v.avion_id WHERE a.compagnie_id<>v.compagnie_id')[0], 0);
  assert.equal(col(d, 'SELECT COUNT(*) FROM (SELECT 1 FROM reservations GROUP BY vol_id, siege HAVING COUNT(*)>1)')[0], 0);
  assert.equal(col(d, 'SELECT COUNT(*) FROM reservations r JOIN vols v ON v.id=r.vol_id WHERE r.date_reservation>v.date_depart')[0], 0);
  assert.equal(col(d, "SELECT COUNT(*) FROM reservations r JOIN vols v ON v.id=r.vol_id WHERE v.statut='Annulé'")[0], 0);
  d.close();
});

test('0 h 42 : nationalités au féminin, avions qui repartent d’où ils ont atterri, vols les plus réservés', () => {
  const d = base();
  assert.deepEqual(col(d, 'SELECT DISTINCT nationalite FROM passagers ORDER BY 1'), ['Allemande', 'Américaine', 'Autrichienne', 'Britannique', 'Danoise', 'Espagnole', 'Française', 'Irlandaise', 'Italienne', 'Japonaise', 'Marocaine', 'Néerlandaise', 'Portugaise', 'Suisse']);
  /* Le même jour, le vol suivant d’un avion part de l’aéroport où il vient d’atterrir, et ses vols ne se chevauchent pas */
  assert.equal(col(d, `SELECT COUNT(*) FROM vols a JOIN vols b ON a.avion_id=b.avion_id AND a.date_depart=b.date_depart AND b.heure_depart>a.heure_arrivee
    AND b.aeroport_depart_id<>a.aeroport_arrivee_id AND NOT EXISTS (SELECT 1 FROM vols c WHERE c.avion_id=a.avion_id AND c.date_depart=a.date_depart
    AND c.heure_depart>a.heure_arrivee AND c.heure_depart<b.heure_depart)`)[0], 0);
  assert.equal(col(d, 'SELECT COUNT(*) FROM vols a JOIN vols b ON a.avion_id=b.avion_id AND a.id<b.id AND a.date_depart=b.date_depart AND a.heure_depart<b.heure_arrivee AND b.heure_depart<a.heure_arrivee')[0], 0);
  /* Les six vols annoncés « presque complets » sont les six plus réservés, nettement devant */
  const top = d.exec('SELECT vol_id, COUNT(*) n FROM reservations GROUP BY 1 ORDER BY n DESC, vol_id')[0].values;
  assert.deepEqual(top.slice(0, 6).map(v => v[0]).sort((a, b) => a - b), [6, 13, 19, 25, 31, 36]);
  assert.ok(top[5][1] >= 9 && top[6][1] <= 4);
  d.close();
});

test('un défi tourne sur sa base : exécution, correction, pas à pas, schéma et tables proposées', () => {
  assert.ok(app.includes("function defiSandbox(c){\n  const id=defiBaseId(c);if(!id)return sandbox();"), 'sans base : celle du cours');
  assert.ok(app.includes('const dU=defiSandbox(c);const t0=performance.now();') && app.includes('const dS=defiSandbox(c);try{solRes=dS.exec(c.sol);}'), 'salle de défi');
  assert.ok(app.includes('const dU=isDefi?defiSandbox(current):sandbox();') && app.includes('const dS=isDefi?defiSandbox(current):sandbox();'), 'défi seul');
  assert.ok(app.includes("tmp=taId==='ed-console'?null:(defiActif()?defiSandbox(defiActif()):sandbox());"), 'pas à pas');
  assert.ok(app.includes('const database=dId?new SQL.Database(defiBaseBytes(dId)):db;'), 'schéma de la base du défi');
  assert.ok(app.includes("tt.textContent=dId?`Schéma · base ${DEFI_BASES[dId].nom}`:'Schéma · base du cours';"));
  assert.ok(app.includes('if(dId){const d=new SQL.Database(defiBaseBytes(dId));try{tabs=listTables(d);}finally{d.close();}}'), 'tables proposées après « no such table »');
  assert.ok(app.includes("const id=dId?'defi:'+dId:(activeDbId||'cours')+':'+(database?schemaVersion(database):'-');"), 'tables et colonnes proposées au clavier');
  assert.ok(app.includes("Défi · ${NIV[c.niv].l}${defiBaseId(c)?` · Base ${esc(DEFI_BASES[defiBaseId(c)].nom)}`:''}"), 'la base dans l’en-tête du défi');
});
