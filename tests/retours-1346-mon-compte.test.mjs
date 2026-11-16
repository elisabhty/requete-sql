/* 14 novembre, 13 h 46 (Elisa, sa capture de Mon compte sans compte) : « Pour quelqu’un qui n’a pas de compte et quelqu’un qui a un
   compte, on a ces mêmes informations. Est-ce qu’il faut cacher des boutons ? » ; 13 h 48 : « Allez, let’s go. »
   - Connecté : « Se déconnecter · Ta progression reste sur ton compte » et « Supprimer mon compte », comme avant.
   - Sans compte : « Se connecter · Retrouve ta progression sur tous tes appareils » (si la connexion est branchée), plus de
     « Se déconnecter » qui ne déconnecte rien ; « Supprimer mes données · Ton pseudo, tes scores et ta progression ».
   - Les deux fenêtres de la suppression, et celle de Mon compte devant le paywall, disent « mes données » sans compte. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const conf = fs.readFileSync(path.join(ROOT, 'decouvrir/confidentialite.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const j = v => JSON.parse(JSON.stringify(v));

test('Mon compte : les lignes du bas suivent le compte', () => {
  const r = cut('function renderCompte(){', '\nfunction ');
  const i = r.indexOf('<div class="account-settings-list acct-compte-actions">');
  const bloc = r.slice(i, r.indexOf('\n          </div>', i));
  /* Les lignes, une à une : le JS du gabarit, évalué pour chaque cas */
  const expr = bloc.slice(bloc.indexOf('${connected?`<button'), bloc.indexOf("<button class=\"account-setting-row is-danger\""));
  const ligne = (connected, auth) => vm.runInNewContext('`' + expr + '`', { connected, obAuthReady: () => auth, lqStkSvg: k => `[${k}]` }).trim();
  assert.match(ligne(true, true), /onclick="seDeconnecter\(\)".*<b>Se déconnecter<\/b><small>Ta progression reste sur ton compte<\/small>/);
  assert.match(ligne(false, true), /onclick="startOnboarding\('account'\)"><span class="plus-row-icon is-stk">\[restore\]<\/span><span><b>Se connecter<\/b><small>Retrouve ta progression sur tous tes appareils<\/small>/);
  assert.equal(ligne(false, false), '', 'sans connexion branchée : rien');
  assert.ok(!bloc.includes('Aucun compte connecté sur cet appareil'), 'plus de ligne qui ne déconnecte rien');
  assert.ok(bloc.includes("<b>${connected?'Supprimer mon compte':'Supprimer mes données'}</b><small>${connected?'Ton pseudo, tes scores et toutes tes données':'Ton pseudo, tes scores et ta progression'}</small>"));
  /* « Gérer mon abonnement » reste au-dessus, pour tous */
  assert.ok(bloc.indexOf('onclick="abonnementGerer()"') < bloc.indexOf('${connected?`<button'));
});

const suppr = (mode, reponses) => {
  const vus = [];
  const ctx = vm.createContext({
    state: { accountMode: mode }, psMien: () => '@lea', window: {},
    compteSupprimerHTML: (p, c) => `[corps ${p} ${c}]`,
    lqAsk: async o => { vus.push({ titre: o.titre, texte: o.texte, corps: o.corps, oui: o.oui, non: o.non }); return reponses.shift(); },
  });
  vm.runInContext(cut('async function compteSupprimer(){', '\n}\n') + '\n}', ctx);
  return { vus, go: () => vm.runInContext('compteSupprimer()', ctx) };
};

test('la suppression, sans compte : « Supprimer tes données ? », puis « Supprimer définitivement mes données »', async () => {
  let x = suppr('guest', [false]); await x.go();
  assert.deepEqual(j(x.vus), [{ titre: 'Supprimer tes données ?', texte: 'Tu es sur le point de supprimer définitivement ton pseudo, tes scores et ta progression.',
    corps: '[corps @lea false]', oui: 'Continuer vers la confirmation', non: 'Conserver mes données' }]);
  x = suppr('guest', [true, false]); await x.go();
  assert.deepEqual(j(x.vus[1]), { titre: 'Dernière confirmation', texte: 'Tout supprimer maintenant ? Il ne sera plus possible de revenir en arrière.',
    oui: 'Supprimer définitivement mes données', non: 'Conserver mes données' });
});

test('la suppression, connecté : les textes d’avant', async () => {
  const x = suppr('connected', [true, false]); await x.go();
  assert.deepEqual(j(x.vus.map(v => [v.titre, v.oui, v.non])), [
    ['Supprimer ton compte ?', 'Continuer vers la confirmation', 'Conserver mon compte'],
    ['Dernière confirmation', 'Supprimer définitivement mon compte', 'Conserver mon compte']]);
  assert.equal(x.vus[0].texte, 'Tu es sur le point de supprimer définitivement ton compte Requête et les données associées.');
});

test('Mon compte devant le paywall, l’aide et la page Confidentialité disent « Supprimer mes données » sans compte', () => {
  assert.ok(cut('async function obGardeCompte(){', '\n}\n').includes("trois:connecte?'Supprimer mon compte':'Supprimer mes données'"));
  assert.ok(app.includes('<b>Supprimer mon compte</b> (en bas de Mon compte\\u00a0; sans compte, <b>Supprimer mes données</b>)'));
  assert.ok(conf.includes('Mon compte › «&nbsp;Supprimer mon compte&nbsp;» («&nbsp;Supprimer mes données&nbsp;» si tu ne t’es pas connecté·e) efface'));
  assert.ok(!/sans compte/i.test(conf.replace(/<!--[\s\S]*?-->/g, '').slice(conf.indexOf('<body'))), 'la page Confidentialité ne dit pas « sans compte »');
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-15-module-v3098';"), 'le cache de l’appli change');
});
