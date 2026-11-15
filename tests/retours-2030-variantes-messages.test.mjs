/* Elisa, 15 novembre, 20 h 16 : « il y a plusieurs versions des félicitations etc est-ce que tu as tout pris en compte pareil pour
   les notifications message de remerciement d'envoie de message bloquer signaler exécution de la requête message d'erreur ».
   Chaque message écrit dans le code a été relevé avec toutes ses variantes (les deux branches de chaque « a ? b : c », les
   pluriels, le genre) et passé par le moteur anglais. On vérifie ici une variante de chaque famille, avec de vraies valeurs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
  return ctx.window.REQUETE_LANGUE;
}

test('les variantes des messages se lisent en anglais', () => {
  const L = moteur();
  const attendus = {
    /* le merci après un message envoyé, selon le sujet */
    'Merci pour ton idée. On lit chaque message.': 'Thanks for your idea. We read every message.',
    'Merci pour ton signalement. On lit chaque message.': 'Thanks for your report. We read every message.',
    '3 pièces jointes n’ont pas pu partir : renvoie-les dans un nouveau message.': '3 attachments couldn’t be sent: send them again in a new message.',
    'Merci pour ton commentaire ! 💜': 'Thanks for your comment! 💜',
    /* signaler, bloquer */
    'Signaler « nora » ?': 'Report “nora”?',
    'Signaler': 'Report',
    'nora est signalé et bloqué.': 'nora has been reported and blocked.',
    'Retirer tes scores du classement ?': 'Remove your scores from the leaderboard?',
    /* félicitations et résultats */
    'Sans faute, bravo !': 'No mistakes, well done!',
    'Presque ! Encore un petit effort.': 'Almost! Just a little more effort.',
    'Tout est fait jusqu’à dimanche. Bravo !': 'Everything’s done until Sunday. Well done!',
    '3e place, défi résolu !': '3rd place, challenge solved!',
    'Carton plein !': 'Full marks!',
    /* exécution d’une requête */
    '🧪 Exécuté sur une copie : la base du cours n’est pas modifiée.': '🧪 Run on a copy: the course database isn’t changed.',
    '12 exécutions': '12 runs',
    /* messages d’erreur */
    'Le script SQL contient une erreur de syntaxe près de « FROMM ». Corrige-la dans le fichier, puis réessaie.': 'The SQL script has a syntax error near “FROMM”. Fix it in the file, then try again.',
    'Ce fichier est une image, pas un tableau. Choisis un fichier Excel, CSV, JSON, SQL ou SQLite.': 'This file is an image, not a spreadsheet. Choose an Excel, CSV, JSON, SQL or SQLite file.',
    'L’hôte a lancé la partie avant ton arrivée. Retourne aux défis pour trouver une autre salle !': 'The host started the game before you arrived. Go back to challenges to find another room!',
    'Salle complète !': 'Room full!',
  };
  for (const [fr, en] of Object.entries(attendus)) assert.equal(L.t(fr), en, fr);
});

test('un mot qui est aussi une donnée de la base (Petit, Grand) n’a pas de clé', () => {
  const L = moteur();
  assert.equal(L.t('Petit'), 'Petit');
  assert.equal(L.t('Grand'), 'Grand');
});

/* Elisa, 15 novembre, 20 h 41 : « et quand une requete s'exécute le message est trad ? ». La console, une requête qui marche, une
   vide, cinq erreurs : tout passe. Restaient la ligne de l’historique (le nombre de lignes gardé en français, l’heure à la française),
   le bouton « Extraire » et le compte des pages. */
test('l’exécution d’une requête : l’historique, Extraire, les pages', () => {
  const app = lire('index.html'), L = moteur();
  assert.ok(app.includes("const T=typeof natifT==='function'?natifT:(x=>x);"), 'chaque morceau de la ligne traduit');
  assert.ok(app.includes("? [T(it.n),it.ms!=null?Math.round(it.ms)+' ms':null,fmtHistWhen(it.ts)]"));
  assert.ok(app.includes("if(L&&L.code!=='fr'&&L.locale)loc=L.locale;"), 'l’heure dans la langue de l’appli');
  assert.equal(L.t('3 lignes'), '3 rows');
  assert.equal(L.t('Erreur'), 'Error');
  assert.equal(L.t('Extraire'), 'Export');
  assert.equal(L.t('1 à 5 sur 8 exécutions'), '1 to 5 of 8 runs');
  assert.equal(L.t('6 sur 6 exécutions'), '6 of 6 runs');
});
