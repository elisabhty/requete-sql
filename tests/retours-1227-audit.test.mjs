/* Elisa, 14 novembre, 12 h 27 : « y a-t-il des autres failles avant la mise en production ? ». Ce que l’audit a corrigé dans l’appli :
   - un raccourci (widget, île, icône) ouvrait une leçon ou un onglet sous le paywall, sans abonnement : il ne fait plus rien ;
   - le moteur SQL pouvait venir de sites tiers (cdnjs, unpkg) sans contrôle d’empreinte si la copie locale manquait : copie
     locale seulement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('sans abonnement, un raccourci n’ouvre rien sous le paywall', () => {
  const src = cut('function raccourciOuvrir(type){', '\nfunction obBandeau(');
  const run = bloque => {
    const appels = [];
    const ctx = vm.createContext({ state: { onboarded: true }, appels, stat() {}, obGardeBloque: () => bloque,
      document: { querySelector: () => null }, switchTab: t => appels.push('onglet ' + t), openItem: i => appels.push('leçon ' + i),
      setTimeout: f => f(), toast() {}, obBandeau() {}, sessionStorage: { setItem() {}, removeItem() {} } });
    vm.runInContext(src, ctx);
    for (const k of ['requete', 'cartes']) ctx.raccourciOuvrir('fr.requete.app.' + k);
    return appels;
  };
  assert.deepEqual(run(true), [], 'le paywall garde l’appli : ni onglet, ni leçon');
  assert.deepEqual(run(false), ['onglet defis', 'onglet collection'], 'abonnée : les raccourcis marchent');
  assert.ok(src.indexOf("if(typeof obGardeBloque==='function'&&obGardeBloque())return;") > src.indexOf('if(!state.onboarded){obBandeau('));
});

test('le moteur SQL : la copie locale seulement, plus de code venu de sites tiers', () => {
  const src = cut('async function loadSqlEngine(){', '\n  let lastError=null;');
  assert.ok(src.includes("const sources=[\n    {js:'vendor/sqljs/sql-wasm.js',wasm:'vendor/sqljs/sql-wasm.wasm'}\n  ];"));
  assert.ok(!/https:\/\/(cdnjs|unpkg|cdn\.jsdelivr)/.test(app), 'aucune adresse de CDN dans l’appli');
  assert.ok(sw.includes("  './vendor/sqljs/sql-wasm.js',\n  './vendor/sqljs/sql-wasm.wasm',"), 'la copie locale est gardée hors ligne');
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-14-audit-v3007';"), 'le cache de l’appli change');
});
