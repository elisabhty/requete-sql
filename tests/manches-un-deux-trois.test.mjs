/* Elisa, 8 novembre, 17 h 08 : « on va partir sur 1 / 2 / 3 manches car 5 ça fait trop ». Les feuilles, la salle d’attente et la
   page d’un défi proposent 1, 2 ou 3 manches ; un ancien choix de 5 devient 3 ; le serveur accepte 2 (et encore 5, pour l’appli déjà
   installée). Le même jour, 17 h 08 aussi : une mise à jour de l’appli ne recharge plus la page en pleine partie (le rechargement
   faisait quitter la salle : « Manche abandonnée »). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('1, 2 ou 3 manches partout où on les choisit ; plus de 5', () => {
  assert.ok(app.includes('const manches=[1,2,3].map(v=>`<button type="button" role="radio" aria-checked="${jeuNb===v}" class="dx-manche'), 'les cartes des feuilles');
  assert.ok(cut('function jeuRoomSet(k,v){', '\n}\n').includes("else if(k==='nb'&&[1,2,3].includes(v))jeuNb=v;"), 'toucher une carte');
  assert.ok(cut('function jeuLobbySet(k,v){', '\n}\n').includes("else if(k==='nb'&&[1,2,3].includes(v))J.nb=v;"), 'la salle d’attente');
  assert.ok(app.includes("${[[1,'Ce défi'],[2,'2 manches'],[3,'3 manches']].map(([n,l])=>"), '« Avec des amis » sur la page d’un défi');
  assert.ok(!/\[1,3,5\]\.(includes|map)/.test(app), 'plus aucun 1 / 3 / 5');
});

test('le choix gardé : 1, 2 ou 3 restent ; 5 devient 3 ; une salle de 5 manches d’avant se reprend telle quelle', () => {
  const prefs = cut('(function jeuLoadPrefs(){', '})();');
  for (const [nb, attendu] of [[1, 1], [2, 2], [3, 3], [5, 3], [4, 1], ['3', 1]]) {
    const ctx = vm.createContext({ jeuNiv: 'f', jeuNivUser: false, jeuNb: 1, jeuMode: 'solo', jeuVis: 'pub',
      localStorage: { getItem: () => JSON.stringify({ nb }) } });
    vm.runInContext(prefs.replace(/^\(function jeuLoadPrefs\(\)\{/, '(function(){') + '})();', ctx);
    assert.equal(ctx.jeuNb, attendu, String(nb));
  }
  assert.ok(cut('function jeuReprendre(nav){', '\n}\n').includes('if([1,2,3,5].includes(nav.nb))jeuNb=nav.nb;'));
});

test('le serveur accepte 2 manches (et garde 5 pour l’appli déjà installée), sans rien changer d’autre', () => {
  const f = path.join(ROOT, 'supabase/migrations/20261108162656_salle_une_deux_trois_manches.sql');
  const sql = fs.readFileSync(f, 'utf8');
  assert.match(sql, /pg_get_functiondef\('public\.jeu_envoyer_v2\(text,jsonb,text\)'::regprocedure\)/);
  assert.match(sql, /neuf := replace\(def, 'n not in \(1,3,5\)', 'n not in \(1,2,3,5\)'\);/);
  assert.match(sql, /raise exception 'réglage des manches introuvable dans jeu_envoyer_v2'/, 'rien n’est changé si le réglage a bougé');
});

test('une mise à jour de l’appli attend la fin de la partie pour recharger la page', () => {
  assert.ok(app.includes("const _swRecharger=()=>{if(typeof JEU!=='undefined'&&JEU){setTimeout(_swRecharger,2000);return;}window.location.reload();};"));
  const sw = cut("navigator.serviceWorker.addEventListener('controllerchange',()=>{", '});');
  assert.ok(sw.includes('if(_swRefreshing||!_swHadController)return;') && sw.includes('_swRecharger();') && !sw.includes('location.reload'));
  /* La partie en cours : on attend ; quittée : on recharge */
  let recharge = 0;
  const minuteurs = [];
  const ctx = vm.createContext({ JEU: { code: 'ABC123' }, setTimeout: f => minuteurs.push(f), window: { location: { reload: () => recharge++ } } });
  vm.runInContext(app.slice(app.indexOf('const _swRecharger='), app.indexOf('\n', app.indexOf('const _swRecharger='))).replace('const _swRecharger', 'var _swRecharger') + '\n_swRecharger();', ctx);
  assert.equal(recharge, 0); assert.equal(minuteurs.length, 1);
  minuteurs.shift()(); assert.equal(recharge, 0, 'toujours en partie');
  ctx.JEU = null; minuteurs.shift()();
  assert.equal(recharge, 1, 'la salle quittée : la nouvelle version');
});
