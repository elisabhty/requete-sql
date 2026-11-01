/* Elisa, 1er novembre, 0 h 55 : « je veux les defis sur la base aeroport mtn ». Les défis de la base du cours sont retirés ; le
   lot Facile Aéroport arrive (situation, mission, indice, solution). Moyen et Difficile : « Bientôt » le temps que leurs lots
   arrivent. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({});
vm.runInContext(cut('const CHALLENGES=[', '\nfunction defisParProgression(){').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
const DEFIS = JSON.parse(JSON.stringify(ctx.CHALLENGES));
const aero = cut("aeroport:{nom:'Aéroport',", '\n`}');
const base = () => { const d = new SQL.Database(); d.run(aero.slice(aero.indexOf('sql:`') + 5)); return d; };

test('les défis sont ceux de la base Aéroport : 10 Facile, chacun avec sa situation, sa mission, son indice', () => {
  assert.equal(DEFIS.length, 10);
  assert.deepEqual(DEFIS.map(c => c.id), ['af1', 'af2', 'af3', 'af4', 'af5', 'af6', 'af7', 'af8', 'af9', 'af10']);
  for (const c of DEFIS) {
    assert.equal(c.base, 'aeroport', c.id); assert.equal(c.niv, 'f', c.id);
    assert.ok(c.contexte && c.q && c.indice && c.sol && c.titre && Number.isInteger(c.apres), c.id);
  }
  assert.ok(!/\b(clients|commandes|produits)\b/.test(DEFIS.map(c => c.sol).join(' ')), 'plus rien sur la base du cours');
  assert.ok(app.includes('const CHALLENGE_GUIDES={};'));
});

test('chaque solution s’exécute sur Aéroport, et un défi trié n’a pas d’égalité qui rendrait l’ordre ambigu', () => {
  for (const c of DEFIS) {
    const d = base();
    const r = d.exec(c.sol);
    assert.ok(r[0] && r[0].values.length > 0, `${c.id} : au moins une ligne`);
    if (c.ordered) {
      /* SQLite renverse l’ordre de ce que ORDER BY ne fixe pas : le résultat ne doit pas bouger */
      d.run('PRAGMA reverse_unordered_selects = ON');
      assert.deepEqual(d.exec(c.sol)[0].values, r[0].values, `${c.id} : ordre entièrement fixé par la consigne`);
    }
    d.close();
  }
});

test('la consigne d’un défi : la situation, la question, « Un indice » à déplier — seul comme en salle', () => {
  vm.runInContext(cut('function defiConsigneHTML(c){', 'function defisParProgression(){'), Object.assign(ctx, { esc: s => String(s).replace(/</g, '&lt;') }));
  ctx.c = DEFIS[8];
  const html = vm.runInContext('defiConsigneHTML(c)', ctx);
  assert.ok(html.startsWith('<p class="defi-ctx">Le service qualité'));
  assert.ok(html.includes('<div class="consigne"><span class="tag">La question</span><p>Affiche l’identifiant du bagage'));
  assert.ok(html.endsWith('<details class="defi-indice"><summary>Un indice</summary><p>En SQL, on teste l’absence de valeur avec IS NULL, jamais avec = NULL.</p></details>'));
  assert.equal((app.match(/\$\{defiConsigneHTML\(c\)\}/g) || []).length, 2, 'défi seul et manche en salle');
});

test('un niveau sans défi est « Bientôt » et ne se choisit pas', () => {
  assert.ok(app.includes("<small>${vide?'Bientôt':stat(k)}</small>"));
  assert.ok(app.includes("if(!jeuChallenges(jeuNiv).length){const k=['f','m','d'].find(x=>jeuChallenges(x).length);if(k)jeuNiv=k;}"));
  assert.ok(app.includes("if(k==='niv'&&!(JEU_NIVL[v]&&jeuChallenges(v).length))return;"), 'écran Défis');
  assert.ok(app.includes("if(k==='niv'&&JEU_NIVL[v]&&jeuChallenges(v).length)J.niv=v;"), 'salle d’attente');
});
