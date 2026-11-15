/* Elisa, 15 novembre, 13 h : « fini le travail du coup avec le site, les widgets et tout ». Le dernier passage sur l’appli en
   anglais (node tools/langue/appli.mjs --langue en, trois états : tout neuf, un planning et deux leçons, tout fini) : les cartes
   01 à 72 et leur titre, le planning à créer, les modules (Revoir…, Module 01 · Terminé), la collection, le schéma et la console,
   les règles de points des défis, le pacte. Ce qui reste dans la liste s’écrit pareil en anglais (mots-clés SQL, colonnes,
   données d’exemple). Petit est un nom de famille de la base : il n’est pas traduit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');

function moteur() {
  const local = {'requete-maj-canal': '"essai"', 'requete-langue': 'en'}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'x', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => null}}};
  vm.runInNewContext(lire('langues.js'), ctx);
  vm.runInNewContext(lire('langue-en.js'), ctx);
  const L = ctx.window.REQUETE_LANGUE;
  L.valeur('prenom', () => 'Camille');
  return L;
}

test('les textes de l’appli relevés au dernier passage se lisent en anglais', () => {
  const L = moteur();
  const attendus = {
    'Carte 01, Base relationnelle : Tables, clés et SELECT': 'Card 01, Relational database: Tables, keys and SELECT',
    'Carte 06, = != > < >= <= : Comparer des valeurs': 'Card 06, = != > < >= <=: Compare values',
    'Carte 33, Jointure de 3 tables : Deux JOIN, chacun son ON': 'Card 33, Joining 3 tables: Two JOINs, each with its ON',
    'Carte 72, GRANT · REVOKE : Accorder uniquement les accès nécessaires': 'Card 72, GRANT · REVOKE: Grant only the access needed',
    'Tables, clés et SELECT': 'Tables, keys and SELECT',
    'Module 07 · Terminé': 'Module 07 · Completed',
    'Revoir Fonctions de fenêtre': 'Review Window functions',
    '1 leçon validée sur 71 · 15 modules': '1 lesson completed out of 71 · 15 modules',
    '1 module complet · encore 70 à récolter sur 72': '1 module complete · 70 more to collect out of 72',
    '0 sur 35 collectionné · À toi de jouer !': '0 of 35 collected · Your turn!',
    '<1>Bon après-midi</1>, <2>Camille</2> !': '<1>Good afternoon</1>, <2>Camille</2>!',
    'Modifier mon profil. Camille': 'Edit my profile. Camille',
    'Moi, <1>Camille</1>, je m’engage à consacrer <2>20 minutes par jour</2> à mon apprentissage.': 'I, <1>Camille</1>, commit to spending <2>20 minutes a day</2> on my learning.',
    'Ton planning personnalisé': 'Your personalized schedule',
    '~3 activités · rythme régulier': '~3 activities · steady pace',
    'Je pars de zéro': 'I’m starting from scratch',
    'Comment sont calculés les points ?<1>Jusqu’à 1 025 points par manche en Difficile</1>': 'How are points calculated?<1>Up to 1,025 points per round in Hard</1>',
    'points de 12 min 30 à 15 min': 'points from 12 min 30 s to 15 min',
    'Difficile, points multipliés par 4, niveau recommandé': 'Hard, points multiplied by 4, recommended level',
    'Table orders, 16 lignes, 7 colonnes': 'Table orders, 16 rows, 7 columns',
    'Déplier la table customers : ses 9 colonnes': 'Expand the customers table: its 9 columns',
    'Aperçu de la table : SELECT * FROM products': 'Table preview: SELECT * FROM products',
    'Ton parcours : 71 leçons validées, soit 100 %.': 'Your path: 71 lessons completed, that’s 100%.',
    'Ton niveau : niveau 5, SELECT * FROM légende. Le plus haut niveau.': 'Your level: level 5, SELECT * FROM legend. The highest level.',
    'Prêt·e pour <1>la suite</1> ?': 'Ready for <1>what’s next</1>?',
    'Tu peux être <1>fier·e de toi</1> !': 'You can be <1>proud of yourself</1>!',
    'Réussies': 'Successful',
    'navigateur': 'browser'
  };
  for (const [fr, en] of Object.entries(attendus)) assert.equal(L.t(fr), en, fr);
});

test('Petit, nom de famille de la base, reste tel quel ; la ligne technique du formulaire de contact passe par natifT', () => {
  const L = moteur();
  assert.equal(L.t('Petit'), 'Petit');
  assert.ok(app.includes("function ctInfosTexte(i){const T=typeof natifT==='function'?natifT:(x=>x);return [i.version,T(i.appareil),T(i.navigateur),T(i.mode),i.ecran]"));
});

test('les 72 cartes ont leur traduction, titre compris', () => {
  const L = moteur(), en = lire('langue-en.js');
  const cles = en.match(/^ {4}"Carte \{1\}, [^"]+":/gm) || [];
  assert.ok(cles.length >= 72, String(cles.length));
});
