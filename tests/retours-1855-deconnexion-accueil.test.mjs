/* 18 novembre, 18 h 55 (Elisa : « je me suis déconnectée mais je reste sur un compte sans compte ; est-ce qu’on peut faire en sorte que
   la personne se retrouve à l’accueil » ; « Écran de bienvenue ») : après « Se déconnecter », tout étant parti sur le compte, l’iPhone
   est vidé et l’appli repart sur l’écran de bienvenue, comme neuve. Sinon (hors ligne, délai), on reste sans compte, comme avant. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const code = cut('async function seDeconnecter(){', '\n/* Après la déconnexion');

const page = envoi => {
  const appels = [], ls = new Map([['requete-sql-v3', '{}'], ['requete-session', 'x'], ['requete-langue', '"en"'], ['requete-langue-essai', '1'],
    ['requete-maj-canal', '"essai"'], ['requete-sql-app-version', 'v3122'], ['rq-jeu-nom', '@lea']]);
  const ctx = vm.createContext({
    appels, state: {accountMode: 'connected'}, save: () => appels.push('save'), KEY: 'requete-sql-v3', memStore: {a: 1},
    lqAsk: async () => true, chatBonusHtml: () => '', CS: {}, PRJ: {}, clearTimeout() {}, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)),
    csSync: async () => (envoi instanceof Error ? Promise.reject(envoi) : envoi),
    closePlusDetails() {}, renderCompte: () => appels.push('reste'), lqAuRevoir: f => { appels.push(['au revoir', typeof f]); setTimeout(f, 0); },
    document: {getElementById: id => (id === 'loader' ? {classList: {remove: () => appels.push('chargement')}, style: {}} : null)},
    window: {REQUETE_AUTH: {signOut: async () => appels.push('signOut')}, Capacitor: null},
    dbsIdb: async () => ({transaction: () => { const tx = {objectStore: () => ({clear: () => appels.push('projets')})}; setTimeout(() => tx.oncomplete(), 0); return tx; }}), DBS_STORE: 'bases',
    localStorage: {get length() { return ls.size; }, key: i => [...ls.keys()][i], getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), clear: () => ls.clear()},
    sessionStorage: {clear: () => appels.push('session')}, location: {reload: () => appels.push('reload')},
  });
  vm.runInContext(code, ctx);
  return {appels, ls, ctx, run: () => vm.runInContext('seDeconnecter()', ctx)};
};

test('tout est parti sur le compte : l’iPhone est vidé, puis l’appli repart sur l’écran de bienvenue (après « À bientôt ! »)', async () => {
  const x = page({progression: 0, notes: 0, projets: {envoyes: 1}});
  await x.run();
  assert.ok(x.appels.indexOf('signOut') >= 0 && x.appels.indexOf('signOut') < x.appels.indexOf('projets'), 'déconnecté d’abord');
  assert.ok(x.appels.includes('projets') && x.appels.includes('session'));
  const i = k => x.appels.findIndex(a => JSON.stringify(a) === JSON.stringify(k));
  assert.equal(i(['au revoir', 'function']), 0, 'le chat dès « Me déconnecter », avant l’envoi : le compte ne se voit plus');
  assert.ok(i('chargement') > i('session') && i('chargement') < i('reload'), 'l’écran de chargement sous le chat, avant le redémarrage');
  assert.equal(x.appels.at(-1), 'reload');
  assert.ok(!x.appels.includes('reste'));
  assert.deepEqual([...x.ls.keys()].sort(), ['requete-langue', 'requete-langue-essai', 'requete-maj-canal', 'requete-sql-app-version'],
    'restent la langue et la mise à jour à distance ; partent la progression, la session, le pseudo (une clé de joueur neuve)');
  assert.deepEqual(Object.keys(x.ctx.memStore), []);
  assert.ok(cut('function lqAuRevoir(apres){', '\nconst DEL_SVG=').includes("if(typeof apres==='function')apres();"), 'la suite, une fois la page refermée');
});

test('quelque chose n’a pas rejoint le compte (hors ligne, délai, en attente) : rien n’est vidé, on reste sans compte', async () => {
  for (const envoi of [{erreur: 'reseau'}, {progression: 2, notes: 0}, {progression: 0, notes: 1}, {progression: 0, notes: 0, projets: {erreur: 'projets'}}, new Error('x'), null]) {
    const x = page(envoi);
    await x.run();
    assert.ok(x.appels.includes('reste') && !x.appels.includes('projets') && !x.appels.includes('chargement') && !x.appels.includes('reload'), JSON.stringify(envoi));
    assert.ok(x.ls.has('requete-sql-v3') && x.ls.has('rq-jeu-nom'), 'la progression reste sur l’iPhone');
  }
  assert.ok(code.includes("envoi=await Promise.race([csSync({force:true,hist:true}),new Promise(ok=>setTimeout(()=>ok({erreur:'delai'}),8000))]);"), '8 s au plus : l’historique part aussi (19 novembre)');
});
