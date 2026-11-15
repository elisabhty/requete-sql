/* Elisa, 15 novembre, 14 h 40 : « Tu peux traduire les données d’exemple hein, de la base du français vers l’anglais et tout ce qui
   est base de cours et base tu vois, aquarium, machin. Il faut qu’un anglais il comprenne ce qu’il y a dans la base. Et quand il va
   exécuter les exos, il faut qu’il comprenne ce qu’il y a. »
   Les 15 bases des défis et leurs 477 défis en anglais : tools/langue/defis/en/<base>.json (tables, colonnes, valeurs, textes),
   assemblés dans langue-en-defis.js par tools/langue/defis.mjs (construire), vérifiés par le même outil (verifier : la base se
   crée, chaque solution traduite donne le résultat français, et la requête récrite en français pour les salles aussi).
   Le moteur (langues.js) y gagne une base par défi (sql(requete, null, base), versFrancais pour le serveur des salles), une valeur
   traduite selon sa colonne (« Suisse » : Swiss pour une nationalité, Switzerland pour un pays), la colonne d’un CREATE TABLE ou
   d’un INSERT INTO lue dans sa table, et l’alias devant un point gardé tel quel. Les écrans des défis et le pas à pas, en anglais. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function moteur() {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': 'en'}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => null}}};
  vm.runInNewContext(lire('langues.js'), ctx);
  vm.runInNewContext(lire('langue-en.js'), ctx);
  vm.runInNewContext(lire('langue-en-defis.js'), ctx);
  return ctx.window.REQUETE_LANGUE;
}

test('les 15 bases des défis ont leur traduction anglaise', () => {
  const L = moteur();
  for (const b of ['aeroport', 'hopital', 'wok', 'zoo', 'fromagerie', 'labo', 'voyages', 'ski', 'foodtruck', 'aquarium', 'velos', 'apiculture', 'escape', 'festival', 'salle_sport'])
    assert.ok(L.baseTraduite(b), b);
  assert.equal(L.sql('SELECT nom, couleur FROM pistes WHERE etat = \'Ouverte\';', null, 'ski'), 'SELECT name, color FROM slopes WHERE status = \'Open\';');
  assert.equal(L.versFrancais('SELECT name, color FROM slopes WHERE status = \'Open\';', 'ski'), 'SELECT nom, couleur FROM pistes WHERE etat = \'Ouverte\';');
});

test('une même valeur se traduit selon sa colonne : Suisse, nationalité ou pays', () => {
  const L = moteur();
  assert.equal(L.sql("SELECT prenom FROM passagers WHERE nationalite IN ('Suisse', 'Française');", null, 'aeroport'), "SELECT first_name FROM passengers WHERE nationality IN ('Swiss', 'French');");
  assert.equal(L.sql("SELECT nom FROM aeroports WHERE pays = 'Suisse';", null, 'aeroport'), "SELECT name FROM airports WHERE country = 'Switzerland';");
  assert.equal(L.sql("INSERT INTO passagers (id, nationalite) VALUES (1, 'Suisse');", null, 'aeroport'), "INSERT INTO passengers (id, nationality) VALUES (1, 'Swiss');");
  assert.equal(L.versFrancais("SELECT first_name FROM passengers WHERE nationality = 'Swiss';", 'aeroport'), "SELECT prenom FROM passagers WHERE nationalite = 'Suisse';");
});

test('la colonne d’un CREATE TABLE est celle de sa table, même après un REFERENCES', () => {
  const L = moteur();
  assert.equal(L.sql('CREATE TABLE inscriptions_cours (id INTEGER, adherent_id INTEGER REFERENCES adherents(id), date_inscription DATE);', null, 'salle_sport'),
    'CREATE TABLE class_bookings (id INTEGER, member_id INTEGER REFERENCES members(id), booking_date DATE);');
  assert.equal(L.sql('SELECT date_inscription FROM adherents;', null, 'salle_sport'), 'SELECT join_date FROM members;');
});

test('un alias devant un point reste l’alias ; un résultat intermédiaire du même nom se traduit', () => {
  const L = moteur();
  assert.equal(L.sql('SELECT ca.nom FROM camions ca;', null, 'foodtruck'), 'SELECT ca.name FROM trucks ca;');
  assert.equal(L.sql('WITH ca AS (SELECT camion_id, SUM(montant) AS ca FROM sorties s JOIN ventes v ON v.sortie_id = s.id GROUP BY camion_id) SELECT ca.ca FROM ca;', null, 'foodtruck'),
    'WITH revenue AS (SELECT truck_id, SUM(amount) AS revenue FROM stops s JOIN sales v ON v.stop_id = s.id GROUP BY truck_id) SELECT revenue.revenue FROM revenue;');
});

test('une solution écrite à la main se ramène en français pour les salles (Faible : Weak pour une ruche, Low pour un niveau)', () => {
  const L = moteur();
  const s = L.solution('apiculture', 'rm6');
  assert.ok(s.includes("'Low'") && s.includes('inspections'));
  assert.ok(L.versFrancais(s, 'apiculture').includes("'Faible'"));
  assert.equal(L.sql("SELECT nom FROM ruches WHERE etat = 'Faible';", null, 'apiculture'), "SELECT name FROM hives WHERE status = 'Weak';");
});

test('les textes des défis, du schéma, des indices et du pas à pas se lisent en anglais', () => {
  const L = moteur();
  const attendus = {
    'Quelles pistes noires sont ouvertes ?': 'Which black slopes are open?',
    'Quels vols sont retardés ?': 'Which flights are delayed?',
    'Schéma · base Station de ski': 'Schema · Ski Resort database',
    'Défi · Moyen · Base Escape game': 'Challenge · Medium · Escape Room database',
    'Déplier la table lift_rides': 'Expand the lift_rides table',
    'Table bookings, 7 colonnes, 131 lignes : allumer ses relations': 'Table bookings, 7 columns, 131 rows: highlight its relationships',
    '8 tables, leurs colonnes et leurs clés.': '8 tables, their columns and their keys.',
    'Pas tout à fait. Réessaie !': 'Not quite. Try again!',
    'Le résultat ne correspond pas à la consigne.': 'The result doesn’t match the instructions.',
    'Où chercher': 'Where to look',
    'À savoir': 'Good to know',
    'Étape 2 sur 4': 'Step 2 of 4',
    '3 lignes gardées sur 19': '3 rows kept out of 19',
    'Erreur SQL': 'SQL error',
    'Pas à pas': 'Step by step'
  };
  for (const [fr, en] of Object.entries(attendus)) assert.equal(L.t(fr), en, fr);
});

test('l’appli charge les défis en anglais, aussi hors ligne', () => {
  const app = lire('index.html'), sw = lire('sw.js'), moteurTxt = lire('langues.js');
  assert.ok(app.includes('<script src="langues.js?v=5" data-defis></script>'));
  assert.ok(moteurTxt.includes("defis: 'langue-en-defis.js?v=2'"));
  assert.ok(sw.includes("'./langue-en-defis.js?v=2',"));
  assert.ok(app.includes('function defisLangue') || app.includes('defisLangue'), 'les défis passent dans la langue au chargement');
});

test('tools/langue/defis.mjs verifier : aucune erreur sur les 15 bases', () => {
  const sortie = execFileSync(process.execPath, [path.join(ROOT, 'tools/langue/defis.mjs'), '--langue', 'en', 'verifier'], {cwd: ROOT, encoding: 'utf8'});
  assert.match(sortie, /Aucune erreur/);
  assert.doesNotMatch(sortie, /✗/);
});
