/* Elisa, 15 novembre, 23 h 25 (captures de Mon compte en anglais) : « Lundi et jeudi » à traduire (et ses variantes), « Mon objectif :
   Réussir un entretien » (et les autres objectifs), « quand on fait le geste du chargement ça fait tout blanc », « quand on change de
   langue ça fait un flash blanc ».
   - La cause des jours en français : deux fonctions obLangue. La seconde (le choix de la langue de l’onboarding) remplaçait la première
     (l’appli est-elle dans une autre langue ?) : chaque obLangue() faisait vibrer, bloquait l’onboarding 3 s et répondait « français ».
   - Une place libre du moteur ({x1}) qui tient un morceau (<1>Réussir un entretien</1>) en traduit le texte.
   - Avec 0, l’anglais met le pluriel (« 0 lessons »).
   - L’heure du rappel à l’américaine (« 7:00 PM »).
   - Un rechargement voulu (tirer pour actualiser, la langue) garde la touche, le nom et l’anneau à l’écran. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), css = lire('ludique.css');

test('une seule fonction obLangue ; pas de nouvelle fonction déclarée deux fois', () => {
  const noms = [...app.matchAll(/^function ([A-Za-z0-9_$]+)\(/gm)].map(m => m[1]), vus = new Map();
  noms.forEach(n => vus.set(n, (vus.get(n) || 0) + 1));
  const doubles = [...vus].filter(([, k]) => k > 1).map(([n]) => n).sort();
  /* Les fonctions de l’onboarding redéclarées plus bas exprès (la vitrine remplace l’ancien onboarding) */
  assert.deepEqual(doubles, ['finishOnboard', 'obBack', 'obCanNext', 'obGoto', 'obNext', 'obPick', 'obRunBuild', 'paintOb', 'startOnboarding']);
  assert.ok(app.includes("function obLangueChoisir(c,btn){") && app.includes("${langueChoixHTML('ob-langue-c','obLangueChoisir')}"));
});

/* Le moteur des langues dans Node, avec le vrai langue-en.js */
const moteur = () => {
  const local = {'requete-langue-essai': '1', 'requete-langue': 'en'}, win = {};
  const ctx = {window: win, navigator: {language: 'fr-FR'}, Intl: {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: 'Europe/Paris'})})},
    location: {hostname: 'localhost', search: ''}, localStorage: {getItem: k => (k in local ? local[k] : null), setItem(k, v) { local[k] = v; }},
    document: {write() {}, documentElement: {}, title: '', addEventListener() {}, currentScript: {getAttribute: () => ''}}, console};
  vm.runInNewContext(lire('langues.js'), ctx);
  vm.runInNewContext(lire('langue-en.js'), ctx);
  return win.REQUETE_LANGUE;
};

test('les objectifs et les pluriels de 0 en anglais', () => {
  const L = moteur();
  assert.equal(L.t('Mon objectif : <1>Réussir un entretien</1>'), 'My goal: <1>Ace an interview</1>');
  assert.equal(L.t('Mon objectif : <1>Être plus efficace au travail</1>'), 'My goal: <1>Be more efficient at work</1>');
  assert.equal(L.t('Mon objectif : <1>Maîtriser SQL jusqu’au niveau avancé</1>'), 'My goal: <1>Master SQL up to an advanced level</1>');
  assert.equal(L.t('Mon objectif : <1>Apprendre par curiosité</1>'), 'My goal: <1>Learn out of curiosity</1>');
  assert.equal(L.t('Mon objectif : <1>Me reconvertir dans la data</1>'), 'My goal: <1>Move into a data career</1>');
  assert.equal(L.t('0 leçon'), '0 lessons');
  assert.equal(L.t('1 leçon'), '1 lesson');
  assert.equal(L.t('0 séance'), '0 sessions');
  assert.equal(L.t('0 leçon validée'), '0 lessons done');
  assert.equal(L.t('jours de série'), 'day streak');
  assert.equal(L.t('points en défis'), 'challenge points');
  assert.equal(L.t('À jouer'), 'Play now');
});

test('Mon compte : les compteurs au pluriel en anglais, l’heure du rappel à la manière de la langue', () => {
  assert.ok(app.includes("function plurN(n){return Math.abs(n)>1||(n===0&&typeof obLangue==='function'&&!!obLangue());}"));
  assert.ok(app.includes("<small>leçon${plurN(st.lessons)?'s':''}</small>") && app.includes("<small>jour${plurN(st.streak)?'s':''} de série</small>"));
  const f = app.slice(app.indexOf('function rappelHeureLoc(h,court){'), app.indexOf('function rappelQuand(t){'));
  const en = vm.runInNewContext(f + ';rappelHeureLoc', {obLangue: () => ({code: 'en'}), obLoc: () => 'en-US', Date});
  const fr = vm.runInNewContext(f + ';rappelHeureLoc', {obLangue: () => null, obLoc: () => 'fr-FR', Date});
  assert.match(en('19:00'), /^7:00\s?PM$/);
  assert.equal(fr('19:00'), '19:00');
  assert.match(en('19:00', 1), /^7\s?PM$/, '16 novembre : les pastilles des heures, courtes, sur une ligne');
  assert.match(en('19:30', 1), /^7:30\s?PM$/);
  assert.equal(fr('19:00', 1), '19:00');
  assert.ok(app.includes("heure:rappelHeureLoc(hour)") && app.includes(">${typeof rappelHeureLoc==='function'?rappelHeureLoc(h,1):h}</button>"));
});

test('un rechargement voulu garde la touche, le nom et l’anneau à l’écran', () => {
  assert.ok(app.includes("if(reprise){L.classList.add('is-reprise');if(voulu){L.classList.add('is-recharge');if(tVoile>0)L.style.setProperty('--rq-ph',(-Math.min(6e5,Math.max(0,Date.now()-tVoile)))+'ms');}window.__appReprise=true;return;}"));
  /* 17 novembre (« il y a comme un flash ») : on recharge quand le voile est entier (retours-1819-flash-rechargement) */
  assert.ok(app.includes("go=()=>setTimeout(()=>{ (typeof rqVoile==='function'?rqVoile():Promise.resolve()).then(()=>location.reload()); }"), 'tirer pour actualiser');
  assert.ok(app.includes("setTimeout(()=>{(typeof rqVoile==='function'?rqVoile():Promise.resolve()).then(()=>{if(!L.changer(c)){"), 'la langue');
  assert.ok(css.includes('html.lq .rq-voile,html.is-native.lq #loader.is-reprise.is-recharge{position:fixed;inset:0;z-index:2147483000;display:flex!important;'));
});
