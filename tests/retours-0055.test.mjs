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

test('les défis sont ceux de la base Aéroport : 23 Facile, chacun avec sa situation, sa mission, son indice', () => {
  /* 8 h 39 : le lot Facile n° 2 (af11 à af23) s’ajoute au premier */
  assert.equal(DEFIS.length, 23);
  assert.deepEqual(DEFIS.map(c => c.id), Array.from({ length: 23 }, (_, i) => 'af' + (i + 1)));
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

test('la consigne d’un défi : la situation et la question, sans indice (1 h 20) — seul comme en salle', () => {
  vm.runInContext(cut('function defiConsigneHTML(c){', 'function defisParProgression(){'), Object.assign(ctx, { esc: s => String(s).replace(/</g, '&lt;') }));
  ctx.c = DEFIS[8];
  const html = vm.runInContext('defiConsigneHTML(c)', ctx);
  assert.ok(html.startsWith('<p class="defi-ctx">Le service qualité'));
  assert.ok(html.endsWith('<div class="consigne"><span class="tag">La question</span><p>Affiche l’identifiant du bagage, son statut et l’identifiant de la réservation pour tous les bagages dont le poids n’est pas renseigné, triés par identifiant de bagage.</p></div>'));
  assert.ok(!app.includes('<summary>Un indice</summary>'), 'pas d’indice');
  assert.equal((app.match(/\$\{defiConsigneHTML\(c\)\}/g) || []).length, 2, 'défi seul et manche en salle');
});

test('1 h 20 : le Schéma attire l’œil pendant un défi ; un défi seul se ferme à 10 min', () => {
  assert.ok(app.includes("function schAttn(){return typeof mode!=='undefined'&&(mode==='defi'||mode==='jeu')?' sch-attn':'';}"));
  assert.ok(app.includes('class="ed-schema${schAttn()}"') && app.includes('class="btn-ghost${schAttn()}"'));
  assert.ok(app.includes("document.querySelectorAll('.sch-attn').forEach(b=>b.classList.remove('sch-attn'));"), 'ouvert une fois : il s’arrête');
  assert.ok(app.includes('if(took>=JEU_ROUND_MS){defiChronoStop();defiTempsEcoule(c);}'));
  assert.ok(app.includes("document.querySelectorAll('#defi-solo-block .btn-run').forEach(b=>b.disabled=true);"));
  assert.ok(app.includes('  defiChronoStart(c);\n  saveNav();'));
});

test('un niveau sans défi est « Bientôt » et ne se choisit pas', () => {
  assert.ok(app.includes("<small>${vide?'Bientôt':stat(k)}</small>"));
  assert.ok(app.includes("if(!jeuChallenges(jeuNiv).length){const k=['f','m','d'].find(x=>jeuChallenges(x).length);if(k)jeuNiv=k;}"));
  assert.ok(app.includes("if(k==='niv'&&!(JEU_NIVL[v]&&jeuChallenges(v).length))return;"), 'écran Défis');
  assert.ok(app.includes("if(k==='niv'&&JEU_NIVL[v]&&jeuChallenges(v).length)J.niv=v;"), 'salle d’attente');
});
