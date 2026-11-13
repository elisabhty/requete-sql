/* Elisa, 13 novembre, 11 h 49 : « je voulais savoir comment faire si je veux modifier un cours, ajouter un parcours, modifier une
   faute, etc. sans passer par une mise en prod Apple », puis, à « Tu veux que je l’installe avant ta première soumission ? » :
   « oui stp ».
   - maj.js, chargé en premier : dans l’app iPhone, une version plus récente du contenu (www/), publiée sur requeteapp.com, est
     téléchargée en arrière-plan puis installée au lancement suivant. Le plugin (@capgo/capacitor-updater) est en mode manuel :
     rien ne part chez un tiers.
   - Les garde-fous : une version qui ne confirme pas son démarrage est retirée par le plugin ; deux essais ratés, et elle est
     écartée sept jours ; une publication retirée ramène au contenu embarqué ; les adresses restent sous requeteapp.com.
   - Les versions d’essai : réservées aux iPhone « en essai » (sept touchers sur le numéro de version, dans Mon compte).
   - Côté site : scripts/maj-publier.mjs écrit maj/publication.json ; la mise en ligne lance scripts/maj-paquet.mjs --ci, qui
     fabrique maj/version.json et le manifeste, et vérifie chaque adresse.
   Le natif (le plugin lui-même) ne tourne pas ici : il est remplacé par un faux, qui note ce qu’on lui demande. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fabriquer, controler, annoncer, lister, empreinte, versionDe, adresse, FICHIERS_MIN, FICHIERS_MAX } from '../scripts/maj-paquet.mjs';
import { publier, decrire } from '../scripts/maj-publier.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MAJ = lire('maj.js'), app = lire('index.html'), sw = lire('sw.js');
const ANNONCE = 'https://requeteapp.com/maj/version.json';
const H = 'a'.repeat(64);
/* Les objets nés dans la fausse page (vm) n’ont pas les mêmes prototypes que ceux du test : on compare leur contenu. */
const clair = x => JSON.parse(JSON.stringify(x));

/* Un manifeste plausible : assez de fichiers, index.html et maj.js, des adresses sous requeteapp.com. */
function manifeste(extra = {}) {
  const m = [];
  for (const f of ['index.html', 'maj.js', 'sw.js']) m.push({file_name: f, file_hash: H, download_url: 'https://requeteapp.com/' + f});
  for (let i = 0; i < 80; i++) m.push({file_name: `assets/voix/c/${i}.mp3`, file_hash: H, download_url: `https://requeteapp.com/assets/voix/c/${i}.mp3`});
  return Object.assign(m, extra);
}

/* maj.js dans une fausse page. version : celle que porte la page. plugin : ce que répond le faux plugin. */
function page({version = 2928, natif = true, stock = {}, session = {}, plugin = {}, annonce = {version: 0}, liste = manifeste(), actuel = 'builtin', natifVersion = '1.0.0', paquets = [], enLigne = true} = {}) {
  const appels = [], adresses = [], minuteurs = [], ecoutes = {};
  const local = {...stock}, sess = {...session};
  const boite = o => ({getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }});
  const P = {};
  const repondre = (nom, defaut) => { P[nom] = opts => { appels.push([nom, opts]); const r = nom in plugin ? plugin[nom] : defaut; return typeof r === 'function' ? r(opts) : Promise.resolve(r); }; };
  repondre('set', undefined);
  repondre('reset', undefined);
  repondre('notifyAppReady', {bundle: {id: actuel}});
  repondre('current', {bundle: {id: actuel, version: actuel === 'builtin' ? 'builtin' : 'v' + version, status: 'success'}, native: natifVersion});
  repondre('list', {bundles: paquets});
  repondre('delete', undefined);
  repondre('download', opts => Promise.resolve({id: 'P' + String(opts.version).slice(1), version: opts.version, status: 'pending'}));
  const win = {
    Capacitor: natif ? {isNativePlatform: () => true, Plugins: {CapacitorUpdater: P}} : undefined,
  };
  const ctx = {
    window: win, localStorage: boite(local), sessionStorage: boite(sess), console, Promise, JSON, Math, Date, String, Array, Object, Error, parseInt, isFinite,
    navigator: {onLine: enLigne},
    document: {visibilityState: 'visible', addEventListener: (n, f) => { ecoutes[n] = f; }},
    setTimeout: (f, ms) => { minuteurs.push({f, ms}); return minuteurs.length; }, clearTimeout: () => {},
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    fetch: url => {
      adresses.push(url);
      const corps = url.startsWith(ANNONCE) ? annonce : liste;
      if (corps instanceof Error) return Promise.reject(corps);
      return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(corps)))});
    },
  };
  const source = MAJ.replace(/var NOM = '[^']+';/, `var NOM = 'requete-essai-v${version}';`);
  assert.notEqual(source, MAJ.replace(/var NOM = '[^']+';/, ''), 'maj.js porte son numéro de version');
  vm.runInNewContext(source, ctx);
  const M = win.REQUETE_MAJ;
  const lu = k => (k in local ? JSON.parse(local[k]) : null);
  const noms = () => appels.map(a => a[0]);
  /* Les micro-tâches en attente (les « catch » du plugin) */
  const souffler = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {M, win, appels, noms, adresses, minuteurs, ecoutes, local, sess, lu, souffler};
}

/* ---------- maj.js : dans un navigateur ---------- */

test('dans un navigateur, sans le plugin : rien ne se passe, mais « Version » a son numéro', async () => {
  const p = page({natif: false, version: 2931});
  assert.equal(p.M.branchee, false);
  assert.equal(p.M.version, 2931);
  assert.equal(p.win.APP_VERSION, 'requete-essai-v2931', 'l’appli iPhone n’a pas de service worker : le numéro vient de maj.js');
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'rien');
  assert.deepEqual(p.adresses, [], 'aucune requête');
  assert.deepEqual(p.minuteurs, [], 'aucun minuteur');
  assert.deepEqual(clair(p.M.etat()), {version: 2931, branchee: false, prete: 0, canal: '', retour: false, dernier: null});
  /* un plugin incomplet (une vieille appli) : comme sans plugin */
  const src = MAJ.replace(/var NOM = '[^']+';/, "var NOM = 'requete-essai-v2931';");
  const win = {Capacitor: {isNativePlatform: () => true, Plugins: {CapacitorUpdater: {set() {}}}}};
  vm.runInNewContext(src, {window: win, localStorage: {getItem: () => null, setItem() {}, removeItem() {}}, sessionStorage: {getItem: () => null, setItem() {}}, document: {addEventListener() {}}, navigator: {}, setTimeout() {}, clearTimeout() {}, Promise, JSON, Math, Date, String, Array, Object, Error, parseInt, isFinite});
  assert.equal(win.REQUETE_MAJ.branchee, false);
});

/* ---------- maj.js : le chemin normal ---------- */

test('une version plus récente est annoncée : téléchargée en arrière-plan, rien n’est installé en cours d’utilisation', async () => {
  const p = page({annonce: {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}});
  assert.deepEqual(p.noms(), [], 'au chargement, rien à installer');
  p.M.pret();
  assert.deepEqual(p.noms(), ['notifyAppReady'], 'le démarrage est confirmé au plugin');
  assert.equal(p.minuteurs.length, 1);
  assert.equal(p.minuteurs[0].ms, 8000, 'la lecture de l’annonce attend la fin du démarrage');
  p.M.pret();
  assert.deepEqual(p.noms(), ['notifyAppReady'], 'une seule confirmation');
  assert.equal(await p.M.verifier(), 'prête');
  assert.ok(p.adresses[0].startsWith(ANNONCE + '?t='), 'l’annonce est lue sans cache');
  assert.ok(p.adresses[1].startsWith('https://requeteapp.com/maj/2930/manifeste.json?t='));
  const dl = p.appels.find(a => a[0] === 'download')[1];
  assert.equal(dl.version, 'v2930');
  assert.equal(dl.url, 'https://requeteapp.com/maj/2930/manifeste.json');
  assert.equal(dl.manifest.length, 83, 'le manifeste entier est confié au plugin, qui reprend dans l’appli les fichiers inchangés');
  assert.deepEqual(Object.keys(dl.manifest[0]).sort(), ['download_url', 'file_hash', 'file_name']);
  assert.ok(!p.noms().includes('set') && !p.noms().includes('next') && !p.noms().includes('reload'), 'pas d’installation pendant l’utilisation');
  assert.equal(p.lu('requete-maj-prete').id, 'P2930');
  assert.equal(p.lu('requete-maj-prete').version, 2930);
  assert.equal(p.M.etat().prete, 2930, 'Mon compte peut dire « v2930 au prochain lancement »');
  assert.equal(p.lu('requete-maj-etat').quoi, 'prête');
  /* dans la demi-heure, on ne relit pas l’annonce */
  const n = p.adresses.length;
  assert.equal(await p.M.verifier(), 'attente');
  assert.equal(p.adresses.length, n);
});

test('au lancement suivant : la version prête s’installe tout de suite, et c’est elle qui confirmera', async () => {
  const stock = {'requete-maj-prete': JSON.stringify({id: 'P2930', version: 2930})};
  const p = page({stock});
  assert.deepEqual(clair(p.appels), [['set', {id: 'P2930'}]], 'installée dès le chargement de maj.js, avant le reste de la page');
  assert.deepEqual(p.lu('requete-maj-essais'), {2930: 1}, 'un essai compté');
  assert.equal(p.sess['requete-maj-session'], '2930');
  /* La page en cours va être remplacée : elle ne confirme rien à la place de la nouvelle, et ne télécharge rien. */
  p.M.pret();
  await p.souffler();
  assert.deepEqual(p.noms(), ['set']);
  assert.equal(await p.M.verifier(true), 'rien');
  assert.deepEqual(p.minuteurs, []);

  /* La nouvelle page (v2930) : elle confirme, et le ménage est fait. */
  const q = page({version: 2930, actuel: 'P2930', stock: p.local, session: p.sess});
  assert.deepEqual(q.noms(), [], 'rien à installer : la version prête tourne');
  q.M.pret();
  assert.deepEqual(q.noms(), ['notifyAppReady']);
  assert.equal(q.lu('requete-maj-prete'), null);
  assert.equal(q.lu('requete-maj-essais'), null);
  assert.equal(q.M.etat().prete, 0);
});

test('le démarrage a échoué (boot : pret(false)) : rien n’est confirmé, mais l’annonce est lue quand même', async () => {
  const p = page({version: 2930, actuel: 'P2930'});
  p.M.pret(false);
  assert.deepEqual(p.noms(), [], 'pas de notifyAppReady : le plugin reviendra à la version d’avant');
  assert.equal(p.minuteurs.length, 1, 'une correction publiée peut encore arriver');
});

/* ---------- maj.js : les garde-fous ---------- */

test('une version qui ne démarre pas : deux essais au plus, puis écartée sept jours', async () => {
  const annonce = {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'};
  /* 1er lancement : installée (1 essai). Elle ne confirme pas : le plugin revient au contenu embarqué et recharge la page. */
  let p = page({annonce, stock: {'requete-maj-prete': JSON.stringify({id: 'P1', version: 2930})}});
  assert.deepEqual(p.noms(), ['set']);
  /* La page d’origine revient, dans la même ouverture de l’appli : pas de nouvel essai tout de suite. */
  p = page({annonce, stock: p.local, session: p.sess, paquets: []});
  assert.deepEqual(p.noms(), [], 'pas réinstallée dans la foulée');
  p.M.pret();
  /* Le paquet a été effacé par le plugin : l’annonce le fait retélécharger. */
  assert.equal(await p.M.verifier(true), 'prête');
  assert.ok(p.noms().includes('download'));
  assert.deepEqual(p.lu('requete-maj-essais'), {2930: 1});
  /* 2e lancement (appli fermée puis rouverte : nouvelle session) : 2e essai. */
  p = page({annonce, stock: p.local});
  assert.deepEqual(p.noms(), ['set']);
  assert.deepEqual(p.lu('requete-maj-essais'), {2930: 2});
  /* Encore ratée : au retour, elle est écartée. */
  p = page({annonce, stock: p.local, session: p.sess});
  assert.deepEqual(p.noms(), [], 'plus d’installation');
  assert.equal(p.lu('requete-maj-prete'), null);
  assert.equal(p.lu('requete-maj-refus').version, 2930);
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'version écartée');
  assert.ok(!p.noms().includes('download'), 'plus de téléchargement non plus');
  /* Sept jours plus tard, elle a de nouveau sa chance ; une version plus récente l’a tout de suite. */
  const vieux = {...p.local, 'requete-maj-refus': JSON.stringify({version: 2930, le: Date.now() - 8 * 24 * 3600 * 1000})};
  p = page({annonce, stock: vieux});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'prête');
  p = page({annonce: {version: 2931, manifeste: 'https://requeteapp.com/maj/2931/manifeste.json'}, stock: {'requete-maj-refus': JSON.stringify({version: 2930, le: Date.now()})}});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'prête');
  assert.equal(p.lu('requete-maj-prete').version, 2931);
});

test('le paquet prêt n’existe plus (appli mise à jour par l’App Store) : ce n’est pas un essai, la page continue', async () => {
  const p = page({stock: {'requete-maj-prete': JSON.stringify({id: 'P2930', version: 2930})}, plugin: {set: () => Promise.reject(new Error('Update failed, id P2930 doesn’t exist'))}});
  p.M.pret();   // boot finit avant la réponse du plugin
  assert.deepEqual(p.noms(), ['set']);
  await p.souffler();
  assert.equal(p.lu('requete-maj-prete'), null);
  assert.equal(p.lu('requete-maj-essais'), null, 'l’essai n’est pas compté');
  assert.equal(p.lu('requete-maj-etat').quoi, 'installation ratée');
  assert.deepEqual(p.noms(), ['set', 'notifyAppReady'], 'la page d’origine confirme alors son propre démarrage');
  assert.equal(p.minuteurs.length, 1);
});

test('une publication retirée : l’iPhone qui l’avait téléchargée revient au contenu de son appli, au lancement suivant', async () => {
  /* v2930 téléchargée tourne ; le site n’annonce plus rien (ou une version plus ancienne). */
  let p = page({version: 2930, actuel: 'P2930', annonce: {version: 0}});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'version retirée');
  assert.deepEqual(p.lu('requete-maj-retour'), {version: 2930});
  assert.ok(!p.noms().includes('reset'), 'pas pendant l’utilisation');
  assert.equal(p.M.etat().retour, true);
  p = page({version: 2930, actuel: 'P2930', stock: p.local});
  assert.deepEqual(clair(p.appels), [['reset', {}]], 'au lancement suivant : retour au contenu embarqué');
  assert.equal(p.lu('requete-maj-retour'), null);
  /* Le contenu embarqué, lui, peut être plus récent que l’annonce (appli tout juste mise à jour) : rien à faire. */
  p = page({version: 2940, actuel: 'builtin', annonce: {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'à jour');
  assert.equal(p.lu('requete-maj-retour'), null);
  assert.ok(!p.noms().includes('download'), 'jamais de retour en arrière sur le contenu embarqué');
  /* Une version prête qui n’est plus celle annoncée est oubliée. */
  p = page({annonce: {version: 0}, stock: {'requete-maj-prete': JSON.stringify({id: 'P2930', version: 2930}), 'requete-maj-session': '"x"'}, session: {'requete-maj-session': '2930'}});
  p.M.pret();
  await p.M.verifier(true);
  assert.equal(p.lu('requete-maj-prete'), null);
});

test('les adresses restent sous requeteapp.com ; un manifeste douteux ou une annonce illisible ne déclenchent rien', async () => {
  const cas = [
    [{version: 2930, manifeste: 'https://exemple.com/maj/2930/manifeste.json'}, manifeste(), 'adresse refusée'],
    [{version: 2930, manifeste: 'https://requeteapp.com.exemple.com/m.json'}, manifeste(), 'adresse refusée'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/../x.json'}, manifeste(), 'adresse refusée'],
    [{version: '2930', manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste(), 'annonce illisible'],
    [{}, manifeste(), 'annonce illisible'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste().slice(0, 10), 'vérification ratée'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste().filter(e => e.file_name !== 'index.html'), 'vérification ratée'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste().map((e, i) => i === 5 ? {...e, download_url: 'https://exemple.com/x.mp3'} : e), 'vérification ratée'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste().map((e, i) => i === 5 ? {...e, file_name: '../x.mp3'} : e), 'vérification ratée'],
    [{version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}, manifeste().map((e, i) => i === 5 ? {...e, file_hash: 'abc'} : e), 'vérification ratée'],
    [new Error('hors ligne'), manifeste(), 'vérification ratée'],
  ];
  for (const [annonce, liste, attendu] of cas) {
    const p = page({annonce, liste});
    p.M.pret();
    assert.equal(await p.M.verifier(true), attendu, JSON.stringify(annonce).slice(0, 80));
    assert.ok(!p.noms().includes('download'), 'rien n’est téléchargé');
    assert.equal(p.lu('requete-maj-prete'), null);
    /* après une lecture ratée, on réessaie dans cinq minutes, pas dans trente */
    if (attendu === 'vérification ratée') assert.ok(Date.now() - p.lu('requete-maj-vu') > 24 * 60 * 1000);
  }
  /* hors ligne : pas même une requête */
  const p = page({enLigne: false, annonce: {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'}});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'hors ligne');
  assert.deepEqual(p.adresses, []);
});

test('une publication peut exiger une appli assez récente (natifMin)', async () => {
  const annonce = {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json', natifMin: '1.1'};
  let p = page({annonce, natifVersion: '1.0.0'});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'appli à mettre à jour');
  assert.ok(!p.noms().includes('download'));
  for (const natifVersion of ['1.1.0', '1.10.0', '2.0.0']) {
    p = page({annonce, natifVersion});
    p.M.pret();
    assert.equal(await p.M.verifier(true), 'prête', natifVersion);
  }
  p = page({annonce: {...annonce, natifMin: undefined, natifMax: '1.4'}, natifVersion: '1.10.0'});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'appli à mettre à jour', '1.10 est plus récent que 1.4 : nombre par nombre');
});

test('un téléchargement déjà fait n’est pas refait ; un vieux paquet jamais installé est effacé', async () => {
  const annonce = {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json'};
  /* déjà prête, et le paquet existe : rien à faire */
  let p = page({annonce, stock: {'requete-maj-prete': JSON.stringify({id: 'P2930', version: 2930})}, session: {'requete-maj-session': '2930'}, paquets: [{id: 'P2930', version: 'v2930', status: 'pending'}]});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'prête');
  assert.ok(!p.noms().includes('download'));
  /* l’appli a été fermée avant la réponse du plugin : le paquet fini est repris tel quel */
  p = page({annonce, paquets: [{id: 'vieux', version: 'v2929', status: 'pending'}, {id: 'fini', version: 'v2930', status: 'pending'}, {id: 'bon', version: 'v2927', status: 'success'}]});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'prête');
  assert.ok(!p.noms().includes('download'));
  assert.equal(p.lu('requete-maj-prete').id, 'fini');
  assert.deepEqual(p.appels.filter(a => a[0] === 'delete').map(a => a[1].id), ['vieux'], 'le paquet en attente d’une autre version est effacé, pas la dernière version qui a marché');
});

/* ---------- maj.js : les versions d’essai ---------- */

test('les versions d’essai : seulement pour les iPhone en essai, et on en sort proprement', async () => {
  const annonce = {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json', essai: {version: 2932, manifeste: 'https://requeteapp.com/maj/2932/manifeste.json'}};
  /* un iPhone ordinaire suit la version pour tous */
  let p = page({annonce});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'prête');
  assert.equal(p.lu('requete-maj-prete').version, 2930);
  /* en essai : la version d’essai, plus récente */
  p = page({annonce});
  p.M.pret();
  assert.equal(p.M.canal(), '');
  assert.equal(p.M.canal('essai'), 'essai');
  await p.souffler(); await p.souffler(); await p.souffler();
  assert.equal(p.lu('requete-maj-prete').version, 2932, 'changer de canal relit l’annonce tout de suite');
  assert.equal(p.M.etat().canal, 'essai');
  /* v2932 d’essai tourne ; l’iPhone sort de l’essai : retour au contenu embarqué au lancement suivant (puis v2930, pour tous) */
  p = page({version: 2932, actuel: 'P2932', annonce, stock: {'requete-maj-canal': '"essai"'}});
  p.M.pret();
  assert.equal(await p.M.verifier(true), 'à jour');
  p.M.canal('');
  await p.souffler(); await p.souffler(); await p.souffler();
  assert.deepEqual(p.lu('requete-maj-retour'), {version: 2932});
  /* une version d’essai plus ancienne que la version pour tous ne compte pas */
  p = page({annonce: {...annonce, essai: {version: 2929, manifeste: 'https://requeteapp.com/maj/2929/manifeste.json'}}, stock: {'requete-maj-canal': '"essai"'}});
  p.M.pret();
  await p.M.verifier(true);
  assert.equal(p.lu('requete-maj-prete').version, 2930);
});

/* ---------- l’appli : index.html, sw.js, la configuration ---------- */

test('index.html : maj.js en premier, le démarrage confirmé à la fin de boot, le numéro de version partout le même', () => {
  const i = app.indexOf('<script src="maj.js?v=1"></script>');
  assert.ok(i > 0 && i < app.indexOf('<script src="vendor/sqljs/sql-wasm.js"></script>') && i < app.indexOf('<style>'), 'chargé avant le moteur SQL et les styles');
  assert.ok(sw.includes("'./maj.js?v=1',"), 'gardé hors ligne comme les autres scripts');
  const nom = /var NOM = '([^']+)';/.exec(MAJ)[1];
  assert.ok(app.includes(`const SW_CACHE='${nom}';`) && sw.includes(`const CACHE = '${nom}';`), 'maj.js, index.html et sw.js : le même numéro');
  assert.equal(versionDe(MAJ), +/v(\d+)$/.exec(nom)[1]);
  const boot = app.slice(app.indexOf('async function boot(){'), app.indexOf('function initSpotlight(){'));
  assert.ok(boot.includes('let demarrageOk=false;') && boot.includes('    initStudyClock();\n    demarrageOk=true;\n  }catch(e){'), 'confirmé seulement si les écrans se sont préparés sans erreur');
  assert.ok(boot.indexOf('window.REQUETE_MAJ.pret(demarrageOk)') > boot.indexOf('demarrageOk=true;') && boot.indexOf('window.REQUETE_MAJ.pret(demarrageOk)') < boot.lastIndexOf('hideLoader();'));
  const fatal = app.slice(app.indexOf('function bootFatal(){'), app.indexOf('function bootFatal(){') + 700);
  assert.ok(fatal.includes('window.REQUETE_MAJ.pret(false)'), 'moteur SQL en panne : rien n’est confirmé');
  /* maj.js n’installe rien en cours d’utilisation : ni next, ni reload, et set seulement au chargement */
  assert.ok(!/appeler\('(next|reload)'/.test(MAJ));
  assert.equal(MAJ.split("appeler('set'").length - 1, 1);
  assert.ok(MAJ.indexOf("appeler('set'") < MAJ.indexOf('function confirmer()'));
});

test('Mon compte : le numéro de version dit ce qui attend ; sept touchers pour les versions d’essai', () => {
  assert.ok(app.includes('<p class="app-version-note" id="app-version-note" onclick="majEssaiTap()">${esc(appVersionNote())}</p>'));
  const d = app.indexOf('function appVersionLabel(){'), f = app.indexOf('function openLegal(kind){');
  const toasts = [];
  const etat = {version: 2928, branchee: true, prete: 0, canal: '', retour: false};
  const note = {textContent: ''};
  const ctx = {window: {APP_VERSION: 'requete-essai-v2928', REQUETE_MAJ: {branchee: true, etat: () => etat, canal(c) { if (arguments.length) etat.canal = c; return etat.canal; }}},
    toast: (...a) => toasts.push(a), document: {getElementById: id => (id === 'app-version-note' ? note : null)}, Date};
  vm.runInNewContext(app.slice(d, f) + ';this.api={appVersionLabel,appVersionNote,majEssaiTap};', ctx);
  assert.equal(ctx.api.appVersionNote(), 'Version v2928');
  etat.prete = 2930;
  assert.equal(ctx.api.appVersionNote(), 'Version v2928 · v2930 au prochain lancement');
  etat.prete = 0; etat.retour = true;
  assert.equal(ctx.api.appVersionNote(), 'Version v2928 · version d’origine au prochain lancement');
  etat.retour = false;
  for (let i = 0; i < 6; i++) ctx.api.majEssaiTap();
  assert.equal(etat.canal, '', 'six touchers : rien');
  ctx.api.majEssaiTap();
  assert.equal(etat.canal, 'essai');
  assert.equal(toasts[0][0], 'Versions d’essai activées');
  assert.equal(note.textContent, 'Version v2928 · versions d’essai');
  for (let i = 0; i < 7; i++) ctx.api.majEssaiTap();
  assert.equal(etat.canal, '');
  assert.equal(toasts[1][0], 'Versions d’essai désactivées');
  /* sans le plugin (le site, une vieille appli) : la ligne d’avant, et les touchers ne font rien */
  ctx.window.REQUETE_MAJ.branchee = false;
  etat.prete = 2930;
  assert.equal(ctx.api.appVersionNote(), 'Version v2928');
  for (let i = 0; i < 9; i++) ctx.api.majEssaiTap();
  assert.equal(toasts.length, 2);
});

test('la configuration : le plugin en mode manuel, rien chez un tiers ; son usage déclaré à Apple', () => {
  const cfg = JSON.parse(lire('capacitor.config.json')).plugins.CapacitorUpdater;
  assert.deepEqual(cfg, {autoUpdate: false, updateUrl: '', statsUrl: '', channelUrl: '', appReadyTimeout: 20000, responseTimeout: 60});
  const pkg = JSON.parse(lire('package.json'));
  assert.equal(pkg.dependencies['@capgo/capacitor-updater'], '8.54.2', 'version figée, comme les autres plugins');
  assert.ok(!/capgo\.app/.test(MAJ.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucune adresse de Capgo dans le code');
  assert.ok(MAJ.includes("var ORIGINE = 'https://requeteapp.com/';"));
  const priv = lire('resources/ios/widget/App/PrivacyInfo.xcprivacy');
  for (const [api, raison] of [['UserDefaults', '1C8F.1'], ['UserDefaults', 'CA92.1'], ['DiskSpace', 'E174.1'], ['FileTimestamp', 'C617.1']]) {
    const bloc = new RegExp(`<string>NSPrivacyAccessedAPICategory${api}</string>[\\s\\S]*?</array>`).exec(priv);
    assert.ok(bloc && bloc[0].includes(`<string>${raison}</string>`), `${api} ${raison}`);
  }
  assert.ok(priv.includes('ITMS-91053'), 'scripts/ios-widget.mjs le recopie tant qu’il porte ce repère');
  const conf = lire('decouvrir/confidentialite.html');
  assert.ok(conf.includes('si une version corrigée de ses cours et de ses écrans est publiée, et télécharge alors les seuls fichiers qui ont changé'), 'dit dans la politique de confidentialité');
  const ios = lire('IOS.md');
  assert.ok(ios.includes('## Corriger l’appli sans repasser par Apple (13 novembre, 11 h 49)') && ios.includes('node scripts/maj-publier.mjs --essai'));
});

/* ---------- côté site : publier, fabriquer, vérifier ---------- */

function dossier() { return fs.mkdtempSync(path.join(os.tmpdir(), 'requete-test-maj-')); }
function ecrire(racine, fichiers) {
  for (const [f, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(racine, f)), {recursive: true});
    fs.writeFileSync(path.join(racine, f), contenu);
  }
}
function fauxWww(version, extra = {}) {
  const f = {'index.html': `<html>v${version}</html>`, 'maj.js': `var NOM = 'requete-essai-v${version}';`, 'sw.js': 'sw', 'ludique.css': 'body{}', 'decouvrir/video.html': 'video'};
  for (let i = 0; i < 60; i++) f[`assets/voix/cours a/${i}.mp3`] = 'voix ' + i;
  return {...f, ...extra};
}

test('maj-publier : pour tous, en essai, retirer', () => {
  const c1 = '1'.repeat(40), c2 = '2'.repeat(40);
  let pub = publier({version: 0}, {commit: c1, version: 2930, le: '2026-11-14'});
  assert.deepEqual(pub, {version: 2930, commit: c1, le: '2026-11-14'});
  pub = publier(pub, {commit: c2, version: 2932, essai: true, le: '2026-11-15'});
  assert.deepEqual(pub, {version: 2930, commit: c1, le: '2026-11-14', essai: {version: 2932, commit: c2, le: '2026-11-15'}});
  assert.equal(decrire(pub), 'Pour tous : v2930 (commit 11111111, publiée le 2026-11-14)\nEn essai : v2932 (commit 22222222, publiée le 2026-11-15)');
  /* l’essai validé part pour tous : il n’a plus lieu d’être */
  assert.deepEqual(publier(pub, {commit: c2, version: 2932, le: '2026-11-16'}), {version: 2932, commit: c2, le: '2026-11-16'});
  /* un essai plus récent survit à une publication pour tous */
  assert.deepEqual(publier(pub, {commit: c1, version: 2931, le: '2026-11-16'}).essai.version, 2932);
  assert.deepEqual(publier(pub, {retirer: true, essai: true}), {version: 2930, commit: c1, le: '2026-11-14'});
  assert.deepEqual(publier(pub, {retirer: true}), {version: 0, essai: {version: 2932, commit: c2, le: '2026-11-15'}});
  assert.deepEqual(publier({version: 2930, commit: c1}, {retirer: true}), {version: 0});
  assert.equal(publier({version: 0}, {commit: c1, version: 2930, natifMin: '1.1', le: 'x'}).natifMin, '1.1');
  assert.throws(() => publier(pub, {commit: c2, version: 2930, essai: true}), /essai ne servirait à rien/);
  assert.throws(() => publier({}, {commit: 'abc', version: 2930}), /commit invalide/);
  assert.throws(() => publier({}, {commit: c1, version: 0}), /version invalide/);
  assert.throws(() => publier({}, {commit: c1, version: 2930, natifMin: 'bientôt'}), /natif-min/);
  assert.equal(decrire({version: 0}), 'Pour tous : aucune version publiée (les iPhone gardent le contenu de leur appli)');
  /* dans le dépôt : rien n’est publié tant qu’Elisa ne l’a pas décidé, ou alors un commit précis */
  const depot = JSON.parse(lire('maj/publication.json'));
  for (const cible of [depot, depot.essai].filter(Boolean)) {
    assert.ok(Number.isInteger(cible.version) && cible.version >= 0);
    if (cible.version) assert.match(cible.commit, /^[0-9a-f]{40}$/);
  }
});

test('maj-paquet : un fichier encore identique sur le site garde son adresse, un fichier qui a changé est recopié ; tout est vérifié', () => {
  const site = dossier(), www = dossier();
  try {
    ecrire(www, fauxWww(2930));
    /* le site a continué de changer depuis la version publiée : index.html et maj.js ne sont plus les mêmes, ludique.css a disparu */
    ecrire(site, {...fauxWww(2930), 'index.html': '<html>v2933</html>', 'maj.js': "var NOM = 'requete-essai-v2933';"});
    fs.rmSync(path.join(site, 'ludique.css'));
    const r = fabriquer({www, site, version: 2930});
    assert.equal(r.fichiers, 65);
    assert.equal(r.copies, 3);
    assert.equal(r.manifeste, 'https://requeteapp.com/maj/2930/manifeste.json');
    const m = JSON.parse(fs.readFileSync(path.join(site, 'maj/2930/manifeste.json'), 'utf8'));
    const de = f => m.find(e => e.file_name === f);
    assert.equal(de('index.html').download_url, 'https://requeteapp.com/maj/2930/www/index.html');
    assert.equal(de('ludique.css').download_url, 'https://requeteapp.com/maj/2930/www/ludique.css');
    assert.equal(de('sw.js').download_url, 'https://requeteapp.com/sw.js');
    assert.equal(de('assets/voix/cours a/7.mp3').download_url, 'https://requeteapp.com/assets/voix/cours%20a/7.mp3', 'une adresse valide, même avec une espace');
    assert.equal(de('index.html').file_hash, empreinte(path.join(www, 'index.html')));
    assert.match(de('index.html').file_hash, /^[0-9a-f]{64}$/);
    assert.equal(fs.readFileSync(path.join(site, 'maj/2930/www/index.html'), 'utf8'), '<html>v2930</html>', 'la copie est celle de la version publiée');
    assert.equal(controler({site, manifeste: m}), 65);
    /* le contrôle voit un fichier qui ne correspond plus */
    fs.writeFileSync(path.join(site, 'sw.js'), 'autre');
    assert.throws(() => controler({site, manifeste: m}), /ne sert pas ce fichier/);
    assert.throws(() => controler({site, manifeste: [{...m[0], download_url: 'https://exemple.com/x'}]}), /hors du site/);
    assert.throws(() => controler({site, manifeste: [m[0], m[0]]}), /en double/);
    /* les refus : mauvais numéro, fichier indispensable absent, trop peu de fichiers, nom dangereux */
    assert.throws(() => fabriquer({www, site, version: 2931}), /maj\.js de cette version dit v2930/);
    fs.writeFileSync(path.join(www, 'x.js.br'), 'x');
    assert.throws(() => fabriquer({www, site, version: 2930}), /nom de fichier refusé/);
    fs.rmSync(path.join(www, 'x.js.br'));
    fs.rmSync(path.join(www, 'index.html'));
    assert.throws(() => fabriquer({www, site, version: 2930}), /fichier absent de la version : index\.html/);
    const petit = dossier();
    ecrire(petit, {'index.html': 'a', 'maj.js': "var NOM = 'requete-essai-v2930';", 'sw.js': 's'});
    assert.throws(() => fabriquer({www: petit, site, version: 2930}), /hors des bornes/);
    fs.rmSync(petit, {recursive: true, force: true});
    /* les mêmes bornes que maj.js, qui refuserait le manifeste */
    assert.ok(MAJ.includes(`m.length < ${FICHIERS_MIN} || m.length > ${FICHIERS_MAX}`));
    assert.deepEqual(lister(www).filter(f => f.startsWith('.')), []);
    assert.equal(adresse('a b/é.mp3'), 'a%20b/%C3%A9.mp3');
  } finally { fs.rmSync(site, {recursive: true, force: true}); fs.rmSync(www, {recursive: true, force: true}); }
});

test('maj-paquet : l’annonce (version.json), pour tous et en essai ; rien de publié, rien d’annoncé', () => {
  const site = dossier(), a = dossier(), b = dossier();
  try {
    ecrire(a, fauxWww(2930)); ecrire(b, fauxWww(2932, {'cours-nouveau.js': 'x'}));
    ecrire(site, fauxWww(2932));
    const c1 = '1'.repeat(40), c2 = '2'.repeat(40), vus = [];
    const construire = commit => { vus.push(commit); return commit === c1 ? a : b; };
    let r = annoncer({publication: {version: 0}, site, construire, maintenant: new Date('2026-11-14T10:00:00Z')});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(site, 'maj/version.json'), 'utf8')), {version: 0, le: '2026-11-14T10:00:00.000Z'});
    assert.deepEqual(vus, []);
    r = annoncer({publication: {version: 2930, commit: c1, natifMin: '1.1', essai: {version: 2932, commit: c2}}, site, construire, maintenant: new Date('2026-11-14T10:00:00Z')});
    const annonce = JSON.parse(fs.readFileSync(path.join(site, 'maj/version.json'), 'utf8'));
    assert.deepEqual(annonce, {version: 2930, manifeste: 'https://requeteapp.com/maj/2930/manifeste.json', fichiers: 65, natifMin: '1.1',
      essai: {version: 2932, manifeste: 'https://requeteapp.com/maj/2932/manifeste.json', fichiers: 66}, le: '2026-11-14T10:00:00.000Z'});
    assert.deepEqual(vus, [c1, c2]);
    assert.equal(r.tous.copies, 2, 'index.html et maj.js de v2930 ne sont plus ceux du site');
    assert.equal(r.essai.copies, 1, 'le nouveau fichier de la version d’essai');
    /* l’annonce fabriquée est bien celle que maj.js sait lire */
    const m = JSON.parse(fs.readFileSync(path.join(site, 'maj/2932/manifeste.json'), 'utf8'));
    assert.ok(m.every(e => e.download_url.startsWith('https://requeteapp.com/') && /^[0-9a-f]{64}$/.test(e.file_hash)));
    /* un essai plus ancien que la version pour tous n’est pas annoncé ; un commit mal écrit arrête tout */
    r = annoncer({publication: {version: 2932, commit: c2, essai: {version: 2930, commit: c1}}, site, construire});
    assert.equal(r.annonce.essai, undefined);
    assert.throws(() => annoncer({publication: {version: 2930, commit: 'main'}, site, construire}), /commit invalide/);
    assert.throws(() => annoncer({publication: {version: 2931, commit: c1}, site, construire}), /dit v2930, la publication dit v2931/);
  } finally { for (const d of [site, a, b]) fs.rmSync(d, {recursive: true, force: true}); }
});

test('la mise en ligne du site fabrique l’annonce avant d’envoyer les fichiers ; rien de fabriqué n’est gardé dans Git', () => {
  const flux = lire('.github/workflows/deploy-pages.yml');
  const i = flux.indexOf('run: node scripts/maj-paquet.mjs --ci');
  assert.ok(i > flux.indexOf('actions/checkout@') && i < flux.indexOf('actions/upload-pages-artifact@'));
  const ignore = lire('.gitignore');
  assert.ok(ignore.includes('\nmaj/version.json\n') && ignore.includes('\nmaj/[0-9]*/\n'));
  assert.ok(JSON.parse(lire('package.json')).scripts['maj:publier'] === 'node scripts/maj-publier.mjs');
  /* le contenu de l’appli : les mêmes scripts que npm run build:www, et maj.js en fait partie */
  const paquet = lire('scripts/maj-paquet.mjs');
  assert.ok(paquet.includes("['scripts/compte-moteurs.mjs', 'scripts/build-www.mjs']"));
  assert.equal(JSON.parse(lire('package.json')).scripts['build:www'], 'node scripts/compte-moteurs.mjs && node scripts/build-www.mjs');
  assert.ok(lire('scripts/build-www.mjs').includes("const keepExt = new Set(['.html', '.css', '.js', '.webmanifest']);"));
});
