/* 5 novembre, 22 h 14 (Elisa) : « mets le bouton déconnexion même s’il ne fonctionne pas ».
   - « Se déconnecter » est toujours dans Mon compte › Compte et assistance, juste avant « Supprimer mon compte ».
   - Sans compte connecté (aucune connexion n’est encore branchée) : il dit où est la progression et propose d’en garder une
     sauvegarde, plutôt que de ne rien faire ; connecté : la vraie déconnexion. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la ligne « Se déconnecter » est toujours là, avant « Supprimer mon compte »', () => {
  const c = cut('function renderCompte(){', '\nfunction ');
  const ligne = "<button class=\"account-setting-row\" type=\"button\" onclick=\"seDeconnecter()\"><span class=\"plus-row-icon is-stk\">${lqStkSvg('export')}</span><span><b>Se déconnecter</b><small>${connected?'Ta progression reste sur ton compte':'Aucun compte connecté sur cet appareil'}</small></span></button>";
  assert.ok(c.includes('            ' + ligne + '\n'), 'sans condition');
  assert.ok(c.indexOf(ligne) < c.indexOf('onclick="compteSupprimer()"') && c.indexOf(ligne) > c.indexOf('<p class="account-settings-group-title">Compte et assistance</p>'));
});

const deco = ({ mode, oui }) => {
  const appels = [];
  const ctx = vm.createContext({
    state: { accountMode: mode, accountProvider: 'apple', accountLabel: 'elisa@exemple.fr' },
    lqAsk: async o => { appels.push(['demande', o.titre, o.texte, o.oui, o.non]); return oui; },
    exportProgress: () => appels.push(['sauvegarde']), save: () => appels.push(['enregistre']),
    closePlusDetails: () => appels.push(['ferme']), startOnboarding: k => appels.push(['onboarding', k]),
    window: { REQUETE_AUTH: { signOut: async () => appels.push(['signOut']) } },
  });
  vm.runInContext(cut('async function seDeconnecter(){', '\nconst DEL_SVG='), ctx);
  return { ctx, appels, go: () => vm.runInContext('seDeconnecter()', ctx) };
};

test('sans compte : « Aucun compte connecté », et la sauvegarde proposée ; rien d’autre ne bouge', async () => {
  let x = deco({ mode: 'guest', oui: true });
  await x.go();
  assert.deepEqual(JSON.parse(JSON.stringify(x.appels)), [
    ['demande', 'Aucun compte connecté', 'Ta progression est enregistrée sur cet appareil, sans compte : il n’y a rien à déconnecter. Garde-en une sauvegarde pour la retrouver ailleurs.', 'Sauvegarder ma progression', 'OK'],
    ['sauvegarde']]);
  assert.equal(x.ctx.state.accountMode, 'guest');
  x = deco({ mode: undefined, oui: false });
  await x.go();
  assert.deepEqual(x.appels.map(a => a[0]), ['demande'], '« OK » : rien');
});

test('connecté : la vraie déconnexion (confirmée), puis l’étape du compte', async () => {
  const x = deco({ mode: 'connected', oui: true });
  await x.go();
  assert.deepEqual(x.appels.map(a => a[0] === 'demande' ? a[1] : a[0]), ['Te déconnecter ?', 'signOut', 'enregistre', 'ferme', 'onboarding']);
  assert.equal(x.ctx.state.accountMode, 'guest');
  assert.ok(!('accountProvider' in x.ctx.state) && !('accountLabel' in x.ctx.state));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-08-commentateur-v2667';"), 'le cache de l’appli change');
});
