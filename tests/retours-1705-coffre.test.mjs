/* 18 novembre, 17 h 05 (Elisa : « J’ai supprimé l’application et j’arrive plus à me connecter » : « @elisabhty » était « déjà pris » par
   l’ancienne clé de son iPhone ; puis « je veux qu’il retrouve automatiquement son pseudo, comme s’il l’avait retrouvé avec les
   historiques ») : le coffre. La clé du joueur et une copie de la progression, rangées dans le trousseau d’iOS, qui survit à la
   suppression de l’app ; lues au démarrage quand la page n’a rien. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), pont = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
const cut = (debut, fin) => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); const j = app.indexOf(fin, i + debut.length); assert.ok(j > i, fin); return app.slice(i, j); };
const coffre = cut('const COFFRE={', "try{document.addEventListener('visibilitychange'");
const CLE = 'a1'.repeat(16), AUTRE = 'b2'.repeat(16);

/* Une page avec son pont natif imité : le trousseau est un objet, les appels sont notés. */
const page = ({natif = true, trousseau = {}, ancien = false} = {}) => {
  const appels = [], rpc = [], minuteries = [];
  const C = {
    isNativePlatform: () => natif, isPluginAvailable: () => true,
    nativePromise: async (p, m, a) => {
      appels.push([m, a]);
      if (ancien) throw new Error('not implemented');
      if (m === 'coffreLire') return {cle: trousseau.cle || '', etat: trousseau.etat || ''};
      if (m === 'coffreEcrire') { if (a.cle) trousseau.cle = a.cle; if (a.etat) trousseau.etat = a.etat; return {ok: true}; }
      if (m === 'coffreEffacer') { delete trousseau.cle; delete trousseau.etat; return {ok: true}; }
    },
  };
  const ls = {};
  const ctx = {
    window: {Capacitor: C}, localStorage: {setItem: (k, v) => { ls[k] = v; }, getItem: k => ls[k] ?? null},
    setTimeout: (f, ms) => { minuteries.push([f, ms]); return minuteries.length; }, clearTimeout: () => {}, Promise, JSON,
    state: {lessons: {}, onboarded: false}, adopte: [],
    clsRpc: async (fn, corps) => { rpc.push([fn, corps]); return {ok: true, pseudo: '@elisabhty'}; },
    psMien: () => '', psAdopter: p => ctx.adopte.push(p),
  };
  vm.createContext(ctx);
  vm.runInContext(coffre.replace('const COFFRE=', 'var COFFRE='), ctx);
  return {ctx, appels, rpc, minuteries, trousseau, ls, run: c => vm.runInContext(c, ctx)};
};
const attendre = () => new Promise(r => setImmediate(r));

test('le pont natif : coffreLire, coffreEcrire, coffreEffacer, à la fin de sa liste ; la clé par iCloud, la progression sur l’iPhone', () => {
  assert.ok(pont.includes('CAPPluginMethod(name: "iconeChoisir", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "coffreLire", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "coffreEcrire", returnType: CAPPluginReturnPromise),\n        CAPPluginMethod(name: "coffreEffacer", returnType: CAPPluginReturnPromise)\n    ]'));
  assert.ok(pont.includes('import Security'));
  assert.ok(pont.includes('RequeteCoffre.ecrire("cle", cle, true)'), 'la clé : synchronisée par le trousseau iCloud');
  assert.ok(pont.includes('RequeteCoffre.ecrire("etat", etat, false)'), 'la progression : cet iPhone seulement');
  assert.ok(pont.includes('icloud ? kSecAttrAccessibleAfterFirstUnlock : kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly'));
  for (const m of ['coffreLire', 'coffreEcrire', 'coffreEffacer']) assert.ok(pont.includes(`@objc func ${m}(_ call: CAPPluginCall)`), m);
});

test('branché : chaque save(), le démarrage (seulement sans progression), « Supprimer mon compte » avant de tout vider', () => {
  assert.ok(app.includes("function save(){ state=normalizeState(state); Store.set(KEY,state); coffreGarder(); if(typeof rappelAuto"));
  const boot = cut('async function boot(){', 'migrerEtapes();');
  assert.ok(boot.includes('if(!saved){try{saved=await coffreRetrouver();duCoffre=!!saved;}catch(e){saved=null;}}'));
  assert.ok(boot.indexOf('let saved=await Store.get(KEY);') < boot.indexOf('coffreRetrouver()'));
  const sup = cut('async function compteSupprimer(){', '\n}\n');
  assert.ok(sup.indexOf('await coffreEffacer();') > 0 && sup.indexOf('await coffreEffacer();') < sup.indexOf('localStorage.clear()'));
});

test('garder : quelques secondes après save(), puis la clé et la progression ; rien de plus si rien n’a changé', async () => {
  const x = page();
  x.run(`state={onboarded:true,lessons:{l1:{level:2}},salle:{cle:'${CLE}',pseudo:'@elisabhty',pts:385}}`);
  x.run('coffreGarder()');
  assert.equal(x.appels.length, 0, 'pas à chaque save()');
  assert.equal(x.minuteries.at(-1)[1], 4000);
  x.minuteries.at(-1)[0](); await attendre();
  assert.equal(x.appels[0][0], 'coffreEcrire');
  assert.equal(x.trousseau.cle, CLE);
  assert.deepEqual(JSON.parse(x.trousseau.etat).salle.pseudo, '@elisabhty');
  x.run('coffreGarder(true)'); await attendre();
  assert.equal(x.appels.length, 1, 'inchangé : pas réécrit');
  x.run("state.lessons.l2={level:1};coffreGarder(true)"); await attendre();
  assert.deepEqual(Object.keys(x.appels.at(-1)[1]), ['etat'], 'la clé, inchangée, ne repart pas');
});

test('l’app réinstallée sur le même iPhone : toute la progression revient, pseudo compris', async () => {
  const x = page({trousseau: {cle: CLE, etat: JSON.stringify({onboarded: true, lessons: {l1: {level: 2}}, salle: {cle: CLE, pseudo: '@elisabhty', pts: 385}})}});
  const etat = await x.run('coffreRetrouver()');
  assert.equal(etat.onboarded, true);
  assert.equal(etat.salle.cle, CLE);
  assert.equal(etat.salle.pseudo, '@elisabhty');
  assert.equal(x.ls['rq-jeu-nom'], '@elisabhty');
  assert.equal(x.run('COFFRE.repseudo'), undefined, 'le pseudo est déjà là : rien à demander');
});

test('un nouvel iPhone (la clé seule, par iCloud) : la clé, puis son pseudo demandé au serveur et adopté', async () => {
  const x = page({trousseau: {cle: CLE}});
  const etat = await x.run('coffreRetrouver()');
  assert.equal(etat.onboarded, false, 'l’onboarding se refait');
  assert.equal(etat.salle.cle, CLE);
  assert.equal(etat.salle.clsRattrape, 1, 'les zéros de l’iPhone neuf ne partent pas au classement');
  x.run('state=' + JSON.stringify(etat));
  x.run('coffreRepseudo()'); await attendre();
  assert.deepEqual(JSON.parse(JSON.stringify(x.rpc)), [['jeu_pseudo_prendre', {p_cle: CLE, p_pseudo: ''}]], 'vide : ne réserve rien, rend le pseudo de la clé');
  assert.deepEqual([...x.ctx.adopte], ['@elisabhty']);
});

test('la copie garde la clé du trousseau si elle n’en a pas ; une copie illisible : la clé seule', async () => {
  const a = page({trousseau: {cle: AUTRE, etat: JSON.stringify({onboarded: true, salle: {}})}});
  assert.equal((await a.run('coffreRetrouver()')).salle.cle, AUTRE);
  const b = page({trousseau: {cle: CLE, etat: '{pas du json'}});
  const e = await b.run('coffreRetrouver()');
  assert.equal(e.salle.cle, CLE);
  assert.equal(b.run('COFFRE.repseudo'), true);
});

test('rien dans le trousseau, le site, une app d’avant le coffre : rien ne change', async () => {
  assert.equal(await page().run('coffreRetrouver()'), null);
  const web = page({natif: false, trousseau: {cle: CLE}});
  assert.equal(await web.run('coffreRetrouver()'), null);
  web.run(`state={onboarded:true,salle:{cle:'${CLE}'}};coffreGarder(true)`);
  assert.equal(web.appels.length, 0);
  const vieux = page({ancien: true});
  assert.equal(await vieux.run('coffreRetrouver()'), null);
  vieux.run(`state={onboarded:true,salle:{cle:'${CLE}'}};coffreGarder(true)`); await attendre();
  assert.equal(vieux.run('COFFRE.dernier'), '', 'pas de pont : rien de noté comme gardé');
});

test('« Supprimer mon compte » : le trousseau vidé, et plus rien n’y est écrit ensuite', async () => {
  const x = page({trousseau: {cle: CLE, etat: '{}'}});
  await x.run('coffreEffacer()');
  assert.deepEqual(x.trousseau, {});
  x.run(`state={onboarded:true,salle:{cle:'${CLE}'}};coffreGarder(true)`); await attendre();
  assert.equal(x.appels.filter(a => a[0] === 'coffreEcrire').length, 0);
});
