/* 17 novembre (Elisa, capture de la bulle « Flamme en direct activée ») : « Est-ce que cette notification est bien traduite en
   anglais pour ceux qui ont activé l’anglais ». La bulle d’avant iOS 26 restait en français : les nombres d’une phrase sont numérotés
   dans l’ordre, ceux de la place libre compris (19:00 avant iOS 26), et la clé « … {x1} … iOS {1} » ne reconnaissait pas « iOS {3} ».
   Et l’heure s’écrit comme le rappel de séance : 7:00 PM en anglais. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');

const moteur = () => {
  const local = {'requete-langue-essai': '1', 'requete-langue': 'en'}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'localhost', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => ''}}, console};
  vm.runInNewContext(lire('langues.js'), ctx);
  vm.runInNewContext(lire('langue-en.js'), ctx);
  return win.REQUETE_LANGUE;
};

test('la bulle et la ligne de la flamme en direct, en anglais, avec iOS 26 et avant', () => {
  const L = moteur();
  assert.equal(L.t('Flamme en direct activée'), 'Live flame turned on');
  assert.equal(L.t('Les soirs de séance, dès 7:00 PM, si ta flamme n’est pas encore allumée.'), 'On session evenings, from 7:00 PM, if your flame isn’t lit yet.');
  assert.equal(L.t('Dès 7:00 PM les soirs de séance, quand tu ouvres l’app (toute seule avec iOS 26).'), 'From 7:00 PM on session evenings, when you open the app (on its own with iOS 26).');
  assert.equal(L.t('Dès 19:00 les soirs de séance, quand tu ouvres l’app (toute seule avec iOS 26).'), 'From 19:00 on session evenings, when you open the app (on its own with iOS 26).');
  assert.equal(L.t('Activée · les soirs de séance, dès 7:00 PM'), 'On · on session evenings, from 7:00 PM');
});

test('une clé avec une place libre et des nombres : les nombres de la place libre ne décalent plus les autres', () => {
  const L = moteur();
  assert.equal(L.t('Rejoindre la salle de Léa : SQL, 12, 3 joueur sur 4'), 'Join Léa’s room: SQL, 12, 3 player out of 4');
  assert.equal(L.t('Jointure de 3 tables'), 'Joining 3 tables');
});

test('l’heure de la flamme en direct s’écrit comme celle du rappel (7:00 PM en anglais)', () => {
  assert.ok(app.includes("function flammeDirectHeureVue(){const h=flammeDirectHeure();return typeof rappelHeureLoc==='function'?rappelHeureLoc(h):h;}"));
  assert.ok(app.includes('return `Activée · les soirs de séance, dès ${flammeDirectHeureVue()}`;'));
  assert.ok(app.includes("    const h=flammeDirectHeureVue();\n    if(!r)toast('Flamme en direct indisponible'"));
  /* Le calcul des soirs (la Live Activity) garde l’heure 24 h */
  assert.ok(app.includes("[h,m]=flammeDirectHeure().split(':').map(Number)"));
});
