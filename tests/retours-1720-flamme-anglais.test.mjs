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

/* 19 h 00 (« Ok et les variantes de ces trad ») : chaque variante des textes retouchés aujourd’hui (Mon compte, le Planning, la flamme
   en direct) : pluriels, jours de la semaine, heures en 24 h et à l’américaine, séances faites, prévues, en retard. */
test('toutes les variantes des textes du jour sont traduites', () => {
  const L = moteur();
  const s = n => n > 1 ? 's' : '';
  const plural = (n, m) => n + ' ' + m + s(n);
  const plur = (n, m) => n + ' ' + m + (n > 1 ? 's' : '');
  const semaine = (f, p) => !p ? 'Aucune séance prévue' : !f ? `${p} séance${s(p)} prévue${s(p)}` : f >= p ? `${p} séance${s(p)} validée${s(p)}` : `${f} séance${s(f)} validée${s(f)} sur ${p}`;
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'], Jours = JOURS.map(j => j[0].toUpperCase() + j.slice(1));
  const T = new Set();
  for (let p = 0; p <= 7; p++) for (let f = 0; f <= p; f++) T.add(semaine(f, p));
  for (const j of JOURS) { T.add(`Pas de séance prévue d’ici ${j}.`); T.add(`Tout est fait jusqu’à ${j}. Bravo !`); for (let n = 1; n <= 6; n++) T.add(`Encore ${plural(n, 'séance')} d’ici ${j}.`); }
  for (const J of Jours) { T.add(`${J}, aujourd’hui : séance terminée`); T.add(`${J}, aujourd’hui : repos`); T.add(`${J}, aujourd’hui : séance prévue`); T.add(`${J} : repos`); T.add(`${J} : séance prévue`); T.add(`${J} : séance terminée`);
    for (let t = 2; t <= 4; t++) for (let d = 1; d < t; d++) { T.add(`${J} : ${d} activité${d > 1 ? 's' : ''} sur ${t}`); T.add(`${J}, aujourd’hui : ${d} activité${d > 1 ? 's' : ''} sur ${t}`); } }
  /* Planning : les jours de la bande, la carte du jour */
  for (const lib of ['Aujourd’hui', 'Demain', 'Hier', 'Jeudi 19 novembre', 'Lundi 1 décembre', 'Samedi 21 novembre']) { T.add(lib + ' · pause'); T.add(lib + ' · terminée'); T.add(lib + ' · en retard'); for (let n = 1; n <= 4; n++) T.add(lib + ' · ' + plur(n, 'activité')); }
  for (let l = 1; l <= 4; l++) for (const d of [0, 1, 2]) for (const suf of ['', ' · en retard', ' · 1/' + l]) { const x = `${l} leçon${l > 1 ? 's' : ''}${d ? ` · ${d} défi${d > 1 ? 's' : ''}` : ''} · ~${l * 4 + 1} min${suf}`; T.add(x); }
  for (const lib of ['jeu. 19 nov.', 'lun. 23 nov.', 'demain']) T.add('Prochaine séance · ' + lib);
  ['Séance validée', 'Journée libre', 'Pas de séance prévue', 'Profites-en pour revoir tes cartes mémo ou faire un défi.', 'Envie d’un défi ? Ils t’attendent dans Pratiquer', 'Continuer la séance', 'Commencer la séance', 'Les leçons suivent l’ordre du parcours : chacune arrive après celle qui la prépare.'].forEach(x => T.add(x));
  /* La flamme en direct */
  for (const h of ['18:00', '19:00', '19:30', '21:15', '6:00 PM', '7:00 PM', '7:30 PM', '9:15 PM']) {
    T.add(`Les soirs de séance, dès ${h}, si ta flamme n’est pas encore allumée.`); T.add(`Dès ${h} les soirs de séance, quand tu ouvres l’app (toute seule avec iOS 26).`); T.add(`Activée · les soirs de séance, dès ${h}`); }
  ['Flamme en direct activée', 'Flamme en direct désactivée', 'Tu pourras la réactiver ici.', 'Flamme en direct indisponible', 'Mets l’app à jour pour l’activer.', 'Activités en direct coupées', 'Autorise-les pour Requête dans les Réglages de l’iPhone.', 'Un compte à rebours jusqu’à minuit, les soirs de séance', 'Activités en direct coupées dans les Réglages de l’iPhone', 'Ta flamme en direct'].forEach(x => T.add(x));

  const ko = [...T].filter(x => { const y = L.t(x); return y == null || y === x || /[éèàùç]|séance| d’ici | sur \d| leçon| défi/.test(y); });
  assert.deepEqual(ko, []);
  assert.ok(T.size > 300);
});

/* 20 novembre (Elisa : « Comment ça 7, c’est scandaleux, chercher d’autres ») : les libellés lus à voix haute (VoiceOver) qui
   restaient en français, et les clés à place libre départagées par tout leur texte fixe (« Regarder la vidéo · {x1} » passait devant
   « {x1} : cours {x2} en plein écran »). */
test('les libellés lus à voix haute, en anglais', () => {
  const L = moteur();
  const attendus = {
    'Module verrouillé : Filtrer les lignes': 'Locked module: Filtering rows',
    'Ouvrir la note Jointures': 'Open the note Joins',
    'Ouvrir la note sans titre': 'Open the untitled note',
    'Détail de la mission': 'Mission details',
    'Révisions à J+1, J+3, J+7, J+21, J+60': 'Reviews on day 1, 3, 7, 21 and 60',
    'Points des 10 dernières parties': 'Points from the last 10 games',
    'Classement, 3 pages : glisse pour changer de page': 'Leaderboard, 3 pages: swipe to change page',
    'Page 2 sur 3': 'Page 2 of 3',
    'Pages des bases d’entraînement': 'Practice database pages',
    'Pages des projets': 'Project pages',
    'Pages de l’historique': 'History pages',
    'Pages des confrontations': 'Head-to-head pages',
    'Regarder la vidéo · 3 min 24 : cours DISTINCT en plein écran': 'Watch the video · 3 min 24: DISTINCT lesson in full screen',
    'Revoir la vidéo · 3 min 24 : cours DISTINCT en plein écran': 'Watch the video again · 3 min 24: DISTINCT lesson in full screen',
    'C’est le mien, je me connecte juste après': 'It’s mine, I’ll sign in next'
  };
  for (const [fr, en] of Object.entries(attendus)) assert.equal(L.t(fr), en, fr);
});
