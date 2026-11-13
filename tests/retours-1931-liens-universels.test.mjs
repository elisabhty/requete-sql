import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/* 13 novembre, 19 h 31 (Elisa : « Est-ce que cette invite nous emmène vraiment sur l’application ? » ; « C’est quoi les liens
   universels ? » ; « Ah oui, vas-y. ») : l’invitation https://requeteapp.com/?partie=CODE&de=pseudo, touchée dans Messages ou
   WhatsApp, ouvre l’app dans la salle quand elle est installée ; sinon le site, comme avant. */
const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('le site : le fichier qu’Apple lit, pour l’app fr.requete.app de l’équipe RN77C85JG4, seulement les invitations', () => {
  const a = JSON.parse(lire('.well-known/apple-app-site-association'));
  const d = a.applinks.details;
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].appIDs, ['RN77C85JG4.fr.requete.app']);
  const c = d[0].components;
  assert.deepEqual(c.map(x => [x['/'], x['?']]), [['/', { partie: '??????' }], ['/decouvrir/', { partie: '??????' }]], 'le reste du site s’ouvre toujours dans Safari');
  assert.ok(lire('.github/workflows/deploy-pages.yml').includes('path: .'), 'tout le dossier part sur GitHub Pages, .well-known compris');
  assert.ok(lire('IOS.md').includes('RN77C85JG4'));
});

test('l’app : le domaine associé, à côté de ce qui y était déjà', () => {
  const e = lire('resources/ios/widget/App/App.entitlements');
  assert.ok(e.includes('<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t<string>applinks:requeteapp.com</string>\n\t</array>'));
  for (const k of ['com.apple.developer.applesignin', 'aps-environment', 'com.apple.security.application-groups']) assert.ok(e.includes(`<key>${k}</key>`), k);
  assert.ok(lire('scripts/ios-widget.mjs').includes("for (const f of ['RequeteWidgetPlugin.swift', 'RequeteViewController.swift', 'App.entitlements']) copyFileSync("), 'recopié dans le projet à chaque envoi');
});

test('l’app : le lien arrive, l’app fermée ou ouverte, et devient le raccourci « partie »', () => {
  const sc = lire('resources/ios/widget/App/SceneDelegate.swift');
  assert.ok(sc.includes('for activite in connectionOptions.userActivities where activite.activityType == NSUserActivityTypeBrowsingWeb {\n            if let lien = activite.webpageURL {\n                RequeteRaccourci.ouvrir(lien)'));
  assert.ok(sc.includes('if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let lien = userActivity.webpageURL {\n            RequeteRaccourci.ouvrir(lien)\n        }\n        SceneDelegateProxy.shared.scene(scene, continue: userActivity)'));
  const p = lire('resources/ios/widget/App/RequeteWidgetPlugin.swift');
  assert.ok(p.includes('if lien.scheme == "https" {\n            invitation(lien)\n            return\n        }\n        guard lien.scheme == "requete"'), 'le lien du widget (requete://) reste comme avant');
  assert.ok(p.includes('guard hote == "requeteapp.com" || hote == "www.requeteapp.com" else { return }'));
  assert.ok(p.includes('guard code.count == 6, code.allSatisfy({ permis.contains($0) }) else { return }'));
  assert.ok(p.includes('recevoir("fr.requete.app.partie." + code + (de.isEmpty ? "" : "|" + de))'));
});

test('la page : le raccourci « partie » prend le chemin de l’invitation du site (jeuFromUrl)', () => {
  const store = new Map();
  let entrees = 0;
  const ctx = vm.createContext({
    JEU_INV: 'rq-jeu-invite', JEU_INV_DE: 'rq-jeu-invite-de',
    sessionStorage: { setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), getItem: k => store.get(k) ?? null },
    jeuFromUrl: () => { entrees++; },
    state: { onboarded: true }
  });
  vm.runInContext(fn('raccourciOuvrir'), ctx);
  ctx.raccourciOuvrir('fr.requete.app.partie.snuwbb|jjjj');
  assert.equal(store.get('rq-jeu-invite'), 'SNUWBB'); assert.equal(store.get('rq-jeu-invite-de'), 'jjjj'); assert.equal(entrees, 1);
  ctx.raccourciOuvrir('fr.requete.app.partie.ABC123');
  assert.equal(store.get('rq-jeu-invite'), 'ABC123'); assert.ok(!store.has('rq-jeu-invite-de'), 'sans pseudo, pas celui d’avant'); assert.equal(entrees, 2);
  ctx.raccourciOuvrir('fr.requete.app.partie.TROPLONG7');
  assert.equal(entrees, 2, 'un code qui n’en est pas un ne fait rien');
  assert.ok(app.includes("if(typeof C.addListener==='function')C.addListener('RequeteWidget','raccourci',e=>raccourciOuvrir(e&&e.type));"));
  assert.ok(fn('jeuInvitation').includes('code=jeuCleanCode(sessionStorage.getItem(JEU_INV)||'), 'jeuFromUrl relit l’invitation rangée');
});
