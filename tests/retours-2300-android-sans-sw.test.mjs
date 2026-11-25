/* 25 novembre, 23 h (Elisa : « Vérifie », la mise à jour à distance sur Android, essayée sur un émulateur de GitHub) : dans
   l'appli Android (https://localhost), le service worker du site s'installait et gardait les anciens fichiers (maj.js) ; après
   une mise à jour à distance, la page tournait encore avec l'ancien maj.js et la nouvelle version finissait écartée.
   Dans l'appli, plus de service worker : la page le retire (en tête), ne l'enregistre plus, et sw.js se retire de lui-même. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const debut = app.indexOf('<script>(function(){try{\n  var C=window.Capacitor,sw=navigator.serviceWorker;');
const tete = app.slice(debut + '<script>'.length, app.indexOf('</script>', debut));

async function jouer({natif, controleur, deja = 0}) {
  const j = {retires: 0, effaces: [], recharge: 0, store: {'rq-sans-sw': String(deja)}};
  const ctx = {
    window: {}, Promise,
    navigator: {serviceWorker: {controller: controleur ? {} : null, getRegistrations: async () => [{unregister: async () => { j.retires++; return true; }}]}},
    caches: {keys: async () => ['requete-2026-11-25-module-v3156'], delete: async k => { j.effaces.push(k); return true; }},
    sessionStorage: {getItem: k => j.store[k] ?? null, setItem: (k, v) => { j.store[k] = v; }},
    location: {reload: () => { j.recharge++; }}
  };
  ctx.window.Capacitor = natif ? {isNativePlatform: () => true} : undefined;
  ctx.window.caches = ctx.caches;
  vm.createContext(ctx);
  vm.runInContext(tete, ctx);
  await new Promise(r => setTimeout(r, 20));
  return {...j, sansSW: ctx.window.__rqSansSW};
}

test('dans l’appli : le worker déjà là est retiré avec ses fichiers, la page rechargée une fois', async () => {
  const a = await jouer({natif: true, controleur: true});
  assert.equal(a.sansSW, 1); assert.equal(a.retires, 1); assert.deepEqual(a.effaces, ['requete-2026-11-25-module-v3156']); assert.equal(a.recharge, 1);
  const b = await jouer({natif: true, controleur: false});
  assert.equal(b.retires, 1); assert.equal(b.recharge, 0, 'sans worker aux commandes, pas de rechargement');
  const c = await jouer({natif: true, controleur: true, deja: 2});
  assert.equal(c.recharge, 0, 'deux rechargements au plus par ouverture');
});

test('dans un navigateur : rien ne change', async () => {
  const a = await jouer({natif: false, controleur: true});
  assert.equal(a.sansSW, undefined); assert.equal(a.retires, 0); assert.equal(a.recharge, 0);
});

test('le retrait passe avant maj.js, et l’appli n’enregistre plus de worker', () => {
  assert.ok(debut > 0 && debut < app.indexOf('<script src="maj.js?v=3"></script>'));
  assert.ok(app.includes("    if(window.__rqSansSW)return;\n    navigator.serviceWorker.register("));
});

test('sw.js : se retire de lui-même dans l’appli Android, seulement là', () => {
  const ligne = sw.slice(sw.indexOf('const DANS_L_APPLI'), sw.indexOf('\n', sw.indexOf('const DANS_L_APPLI')));
  const vaut = href => { const u = new URL(href); return vm.runInNewContext(ligne + '; DANS_L_APPLI', {self: {location: {protocol: u.protocol, hostname: u.hostname, port: u.port}}}); };
  assert.equal(vaut('https://localhost/sw.js'), true);
  for (const h of ['https://requeteapp.com/sw.js', 'http://localhost:8080/sw.js', 'http://127.0.0.1:5173/sw.js', 'https://localhost:4443/sw.js']) assert.equal(vaut(h), false, h);
  assert.ok(sw.includes("if (DANS_L_APPLI) { e.waitUntil(self.skipWaiting()); return; }"));
  assert.ok(sw.includes("try { await self.registration.unregister(); } catch (err) {}"));
  assert.ok(sw.includes("  if (DANS_L_APPLI) return;\n  const req = e.request;"));
});
