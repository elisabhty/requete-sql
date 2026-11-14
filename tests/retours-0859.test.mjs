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
  const ko = ctx.defiIndicesHTML(c, 1, 0, 'La colonne <code>foo</code> n’existe pas.');
  assert.ok(ko.includes('<section class="coach has-hint has-ko" aria-live="polite">') && ko.includes('<div class="coach-st"><span class="coach-st-ico" aria-hidden="true">!</span><div class="coach-st-tx"><b class="coach-st-k">Pas tout à fait. Réessaie&nbsp;!</b><p>La colonne <code>foo</code> n’existe pas.</p></div></div>'), 'ce qui cloche, dans la carte : « Réessaie », en mode erreur SQL (9 novembre, 7 h 37 ; sous l’éditeur à 7 h 23 ; avant « Essaie encore », « Raté », « Un coup de patte ? », « Pas encore »)');
  assert.ok(ko.indexOf('class="coach-hint"') < ko.indexOf('class="coach-st"'), 'sous l’indice');
  /* 8 h 04 : l’erreur SQL comme dans la boîte « Erreur SQL » arrive en deux paragraphes, le message puis l’aide : pas de <p> de plus */
  const sq = ctx.defiIndicesHTML(c, 1, 0, '<p><code>near "q": syntax error</code></p><p>Requête mal formée — vérifie les mots-clés, les virgules et le point-virgule final.</p>');
  assert.ok(sq.includes('<b class="coach-st-k">Pas tout à fait. Réessaie&nbsp;!</b><p><code>near "q": syntax error</code></p><p>Requête mal formée — vérifie les mots-clés, les virgules et le point-virgule final.</p></div></div>') && !sq.includes('<p><p>'));
  assert.ok(ctx.defiIndicesHTML(c, 0, 0, 'Le résultat ne correspond pas à la consigne.').includes('<b class="coach-st-k">Pas tout à fait. Réessaie&nbsp;!</b><p>Le résultat ne correspond pas à la consigne.</p>'), 'avant le premier indice aussi (en salle, ils viennent à l’heure)');
  assert.ok(!h1.includes('coach-st') && !h1.includes('has-ko'), 'sans essai manqué, rien');
  assert.equal(ctx.defiSquelette(c.sol), 'SELECT …\nFROM …\nJOIN … ON … = …\nJOIN … ON … = …\nJOIN … ON … = …\nWHERE … = …\nORDER BY …');
  for (const x of ctx.CHALLENGES) {
    const sq = ctx.defiSquelette(x.sol);
    for (const t of ['bagages', 'reservations', 'passagers', 'vols', 'avions', 'compagnies', 'aeroports', 'prix', 'statut', "'", '2025', '500'])
      assert.ok(!sq.includes(t), `${x.id} : « ${t} » ne doit pas paraître dans le squelette`);
  }
  assert.equal(ctx.defiSquelette(D('am4').sol).split('\n')[3], 'WHERE … = … AND … > (SELECT AVG(…) FROM … WHERE … = …)');
});

/* 9 novembre, 7 h 55 (sa capture de « Pas tout à fait. Réessaie ! » qui disait « On attend 3 colonnes ; ta requête en renvoie 1. ») :
   « Met vraiment l’erreur sql dedans pas ce genre d’indice ». Une requête qui tourne n’a pas d’erreur SQL : ni le nombre de lignes,
   ni celui des colonnes, ni l’ordre, ni les valeurs ; seulement que le résultat ne correspond pas (comme en salle classée). */
test('un résultat faux : « Le résultat ne correspond pas à la consigne. », sans indice (7 h 55 ; avant, ce qui cloche)', () => {
  const d = base(), c = D('af1'), sol = d.exec(c.sol);
  const diag = sql => ctx.defiDiag(d.exec(sql), sol, c, sql);
  for (const sql of [
    "SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'retardé'",
    "SELECT numero_vol FROM vols WHERE statut = 'Retardé'",
    "SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut <> 'Annulé'",
    "SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'Retardé' ORDER BY numero_vol",
    "SELECT numero_vol, date_depart, heure_depart FROM vols WHERE statut = 'Terminé' LIMIT 4",
  ]) assert.equal(diag(sql), 'Le résultat ne correspond pas à la consigne.', sql);
  const f = cut('function defiDiag(', '\n}\n');
  for (const mot of ['colonne', 'ligne', 'ordre', 'valeurs', 'il en faut']) assert.ok(!f.includes(mot), mot);
  d.close();
});

test('branché partout : défi seul, salle, fin du chrono, fin de manche ; la même requête relancée ne débloque rien', () => {
  assert.ok(app.includes("if(mode==='defi'){if(!COACH||COACH.c!==current)COACH={c:current,kind:'solo',n:0,view:0,diag:'',fx:''};coachSet(exoFails);return;}"), 'défi seul : les indices au lieu de la solution');
  assert.ok(app.includes("if(mode==='defi'&&sql!=null){const k=String(sql).replace(/\\s+/g,' ').trim();if(k===defiDernierKo){renderExoHelp();return;}defiDernierKo=k;}"));
  assert.ok(app.includes('const diag=isDefi?defiDiag(userRes,solRes,current,sql):exoFailDiag(sql,sol,userRes,solRes,ordered);'));
  assert.ok(app.includes('  setLessonOut(table);   // le résultat obtenu sous l’éditeur ; dans la carte, « Pas tout à fait. Réessaie ! », sans indice (9 novembre, 7 h 55)\n  jeuEssaiRate(r);\n  coachRoomTick();\n  coachKo(diag);\n}'), 'salle');
  assert.ok(app.includes('function jeuIndT(k){const d=jeuDureeMs(k);return [d/4,d/2,d*3/4];}'), 'en salle, à la même minute pour tout le monde (au quart, à la moitié, aux trois quarts du chrono depuis le 14 novembre)');
  assert.ok(app.includes('Le résultat attendu reste caché&nbsp;: tu peux le recommencer.</p>') && !app.includes('Voici ce qu’il fallait obtenir'), 'fin du chrono : ni la requête ni le résultat, on peut recommencer (3 novembre, 7 h 14)');
  /* 16 h 04 (Elisa) : plus de « Le résultat attendu » sur les résultats de manche ; la correction est au bilan (Voir la correction) */
  assert.ok(!app.includes('<summary class="jeu-card-h">Le résultat attendu</summary>'), 'fin de manche : plus de résultat attendu');
  assert.ok(!/highlight\((c|current)\.sol\)/.test(app), 'la solution d’un défi n’est affichée nulle part');
  assert.ok(css.includes('html.lq .coach{margin:14px 0 16px;padding:14px 16px;border:2px solid var(--line);border-radius:20px;background:#fff;'));
});
