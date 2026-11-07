/* Elisa, 1er novembre, 8 h 59 : le lot Moyen (« corrige ce qu’il y a à corriger ») et les indices : « si on réussit pas du premier
   coup, commencer par un premier indice, un deuxième après, puis troisième max, mais sans jamais dévoiler la requête, même après ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({ locateFile: f => path.join(root, 'vendor/sqljs', f) });
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const ctx = vm.createContext({ esc: s => String(s).replace(/</g, '&lt;'), escCode: s => String(s).replace(/</g, '&lt;').replace(/`([^`\n]+)`/g, '<code>$1</code>'), highlight: s => s });
vm.runInContext(cut('const CHALLENGES=[', '\n/* La consigne d’un défi').replace('const CHALLENGES=', 'CHALLENGES='), ctx);
vm.runInContext(cut('function defiTables(sol){', 'function defisParProgression(){'), ctx);
vm.runInContext(cut('function normCell(v)', 'function fmtLignes(n)'), ctx);
const D = id => ctx.CHALLENGES.find(c => c.id === id);
const aero = cut("aeroport:{nom:'Aéroport',", '\n`}');
const base = () => { const d = new SQL.Database(); d.run(aero.slice(aero.indexOf('sql:`') + 5)); return d; };

test('lot Moyen : les corrections (doublon, niveau, seuil impossible, égalités)', () => {
  const moyen = ctx.CHALLENGES.filter(c => c.base === 'aeroport' && c.niv === 'm');
  assert.equal(moyen.length, 14);
  assert.ok(!moyen.some(c => /AVG\(prix\), 2\) AS prix_moyen FROM reservations GROUP BY classe/.test(c.sol)), 'le prix moyen par classe reste le Facile af21');
  assert.ok(/\(SELECT AVG\(prix\) FROM reservations WHERE classe = 'Économique'\)/.test(D('am4').sol), 'à sa place, une sous-requête');
  assert.equal(D('af33').niv, 'f', 'bagages par statut : un simple GROUP BY, en Facile');
  assert.ok(D('am9').sol.includes('> 3 ORDER BY') && !D('am9').sol.includes('> 30'), 'seuil de remplissage atteignable (3 %, 10 h 13)');
  const d = base();
  assert.equal(d.exec(D('am9').sol)[0].values.length, 5);
  assert.ok(/puis par nom, puis par prénom/.test(D('am8').tri) && D('am1').tri.includes('puis par numéro de vol'));
  d.close();
});

test('les trois indices : où chercher, la piste, la forme ; jamais la requête — un à la fois (14 h 33)', () => {
  const c = D('af5');
  const h0 = ctx.defiIndicesHTML(c, 0);
  assert.ok(h0.includes('À toi de jouer') && !h0.includes('Indice'), 'avant le premier essai raté : « À toi de jouer », aucun indice (15 h 36)');
  const h1 = ctx.defiIndicesHTML(c, 1), h2 = ctx.defiIndicesHTML(c, 2), h3 = ctx.defiIndicesHTML(c, 3), h9 = ctx.defiIndicesHTML(c, 9);
  assert.ok(h1.includes('Indice 1/3') && h1.includes('Tu auras besoin de 4 tables : <code>bagages</code>, <code>reservations</code>, <code>passagers</code> et <code>vols</code>.'));
  assert.ok(!h1.includes('Indice 2/3'));
  assert.ok(h2.includes('Indice 2/3') && h2.includes(c.indice) && !h2.includes('Indice 1/3'), 'un à la fois, pas 1 + 2');
  assert.ok(h3.includes('Indice 3/3') && h3.includes('C’était le dernier indice') && !h3.includes(c.indice));
  assert.ok(ctx.defiIndicesHTML(c, 3, 1).includes('Indice 1/3'), 'une pastille ramène à un indice déjà donné');
  assert.equal(h9, h3, 'trois au plus');
  assert.ok(ctx.defiIndicesHTML(c, 1, 0, 'On attend 1 colonne.').includes('<span class="coach-st-k">Pas encore</span><p>On attend 1 colonne.</p>'), '« Pas encore » dans la même carte');
  assert.equal(ctx.defiSquelette(c.sol), 'SELECT …\nFROM …\nJOIN … ON … = …\nJOIN … ON … = …\nJOIN … ON … = …\nWHERE … = …\nORDER BY …');
  for (const x of ctx.CHALLENGES) {
    const sq = ctx.defiSquelette(x.sol);
    for (const t of ['bagages', 'reservations', 'passagers', 'vols', 'avions', 'compagnies', 'aeroports', 'prix', 'statut', "'", '2025', '500'])
      assert.ok(!sq.includes(t), `${x.id} : « ${t} » ne doit pas paraître dans le squelette`);
  }
  assert.equal(ctx.defiSquelette(D('am4').sol).split('\n')[3], 'WHERE … = … AND … > (SELECT AVG(…) FROM … WHERE … = …)');
});

test('le diagnostic dit ce qui cloche sans rien dévoiler', () => {
  const d = base(), c = D('af1'), sol = d.exec(c.sol);
  const diag = sql => ctx.defiDiag(d.exec(sql), sol, c);
  assert.equal(diag("SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'retardé'"), 'Ta requête ne renvoie aucune ligne ; il en faut 4.');
  assert.equal(diag("SELECT numero_vol FROM vols WHERE statut = 'Retardé'"), 'On attend 3 colonnes ; ta requête en renvoie 1.');
  assert.equal(diag("SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut <> 'Annulé'"), 'Ta requête renvoie 38 lignes ; il en faut 4.');
  assert.equal(diag("SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'Retardé' ORDER BY numero_vol"), 'Les bonnes lignes sont là, mais pas dans le bon ordre : relis le tri demandé.');
  assert.equal(diag("SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'Terminé' LIMIT 4"), 'Le bon nombre de lignes, mais pas les bonnes valeurs : vérifie tes filtres et tes calculs.');
  d.close();
});

test('branché partout : défi seul, salle, fin du chrono, fin de manche ; la même requête relancée ne débloque rien', () => {
  assert.ok(app.includes("if(mode==='defi'){if(!COACH||COACH.c!==current)COACH={c:current,kind:'solo',n:0,view:0,diag:'',fx:''};coachSet(exoFails);return;}"), 'défi seul : les indices au lieu de la solution');
  assert.ok(app.includes("if(mode==='defi'&&sql!=null){const k=String(sql).replace(/\\s+/g,' ').trim();if(k===defiDernierKo){renderExoHelp();return;}defiDernierKo=k;}"));
  assert.ok(app.includes('const diag=isDefi?defiDiag(userRes,solRes,current,sql):exoFailDiag(sql,sol,userRes,solRes,ordered);'));
  assert.ok(app.includes('  jeuEssaiRate(r);\n  coachRoomTick();\n  coachKo(diag);'), 'salle');
  assert.ok(app.includes('const JEU_IND_T=[150000,300000,450000];'), 'en salle, à la même minute pour tout le monde');
  assert.ok(app.includes('Le résultat attendu reste caché&nbsp;: tu peux le recommencer.</p>') && !app.includes('Voici ce qu’il fallait obtenir'), 'fin du chrono : ni la requête ni le résultat, on peut recommencer (3 novembre, 7 h 14)');
  assert.ok(app.includes('<summary class="jeu-card-h">Le résultat attendu</summary>'), 'fin de manche');
  assert.ok(!/highlight\((c|current)\.sol\)/.test(app), 'la solution d’un défi n’est affichée nulle part');
  assert.ok(css.includes('html.lq .coach{margin:14px 0 16px;padding:14px 16px;border:2px solid var(--line);border-radius:20px;background:#fff;'));
});
