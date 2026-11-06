/* Elisa, 6 novembre, 15 h 20 (capture de Pratiquer) : « oui le défi est retiré, mais est-ce que je peux suivre le nombre de défis
   joués pour chaque personne dans la base de données ? […] si je tombe sur quelqu’un qui a déjà fait un défi, je ne dois pas l’avoir
   aussi (il ne doit pas être tiré pour lui non plus, ni pour moi) / Mettre également le coefficient multiplicateur au niveau /
   Supprimer le bandeau Mes défis / Et remplace Salle de défi par À toi de jouer ».
   - Pratiquer : plus de « Mes défis » (Mes stats s’ouvre depuis la carte du joueur, dans Défis) ; la carte du haut dit « À toi de
     jouer ».
   - Les niveaux de la salle portent leur coefficient (×1, ×2, ×4), lu en toutes lettres.
   - Le tirage : l’appli dit au serveur quels défis elle connaît (JEU_CAT) et si le défi est choisi exprès (imp) ; seule ou hors
     ligne, elle ne tire plus un défi déjà trouvé tant qu’il en reste d’autres. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';

test('Pratiquer : plus de « Mes défis », la carte du haut dit « À toi de jouer »', () => {
  const hub = fn('renderJourneyHub');
  const pratique = hub.slice(hub.indexOf("const tools=tab==='practice'?["), hub.indexOf(']:['));
  assert.ok(!pratique.includes("'Mes défis'") && !pratique.includes("pratiquerDefis('stats')"), 'le bandeau Mes défis est retiré');
  assert.ok(pratique.includes("['console','Console SQL','Explore les données et teste librement tes requêtes.',\"switchTab('console')\"]"), 'la Console reste');
  assert.ok(hub.includes('<p class="journey-kicker">À toi de jouer</p><h2>'), 'À toi de jouer');
  assert.ok(!app.includes('<p class="journey-kicker">Salle de défi</p>'), 'plus « Salle de défi » sur Pratiquer');
  assert.ok(!hub.includes('salleKpi()'), 'les chiffres des défis ne sont plus calculés pour rien');
  /* Mes stats reste à un geste : la carte du joueur, dans Défis */
  assert.ok(fn('defisMoiHTML').includes(`onclick="defisOnglet('stats')"`));
});

test('les niveaux de la salle portent leur coefficient : ×1, ×2, ×4', () => {
  const niv = fn('jeuNiveauxHTML');
  assert.ok(niv.includes("x=JEU_NIV_X[k]||1"), 'le coefficient vient du barème (JEU_NIV_X)');
  assert.ok(niv.includes('`<span class="room-lv-x" aria-hidden="true">×${x}</span>`'));
  assert.ok(niv.includes("lu=`${JEU_NIVL[k]}, ${x>1?`points multipliés par ${x}`:'points de base'}${k===auto?', niveau recommandé':''}`"), 'lu en toutes lettres');
  assert.ok(niv.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Niveau recommandé</em>':''}"), 'le niveau recommandé reste');
  const ctx = vm.createContext({ JEU_NIV_X: { f: 1, m: 2, d: 4 }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, jeuNiv: 'm', jeuNivAuto: () => 'm', jeuChallenges: () => [1] });
  vm.runInContext(niv, ctx);
  const html = ctx.jeuNiveauxHTML('lab', 'defisNiv');
  assert.deepEqual([...html.matchAll(/<span class="room-lv-x" aria-hidden="true">([^<]+)<\/span>/g)].map(m => m[1]), ['×1', '×2', '×4']);
  assert.deepEqual([...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1]),
    ['Facile, points de base', 'Moyen, points multipliés par 2, niveau recommandé', 'Difficile, points multipliés par 4']);
  for (const part of ['html.lq .room-level .room-lv-x{display:inline-flex;', 'html.lq .room-level.is-m .room-lv-x{background:#FDF1E2;color:var(--warn)}',
    'html.lq .room-level.is-d .room-lv-x{background:#FDE8EA;color:var(--danger)}', 'html.lq[data-reading="large"] .room-level .room-lv-x{font-size:14px;'])
    assert.ok(lq.includes(part), part);
});

test('le tirage : la version du catalogue part avec chaque message, un défi choisi exprès le dit', () => {
  assert.ok(app.includes('const JEU_CAT=1;'), '1 : les 267 défis du 6 novembre');
  assert.ok(fn('jeuSend').includes('m.u=jeuRand(8);m.cat=JEU_CAT;'));
  assert.ok(app.includes("const impose=!!J.plan[n];\n  jeuSend({t:'round',n,cid:J.plan[n]||jeuPick(),imp:impose?1:0,one:jeuLive().length<2?1:0});"));
});

test('seul ou hors ligne : un défi déjà trouvé n’est plus tiré tant qu’il en reste', () => {
  const pick = fn('jeuPick');
  const tirer = (trouves, rounds = []) => {
    const ctx = vm.createContext({ Math, state: { defis: trouves }, JEU: { niv: 'f', rounds, recent: new Set() },
      jeuChallenges: () => ['a', 'b', 'c', 'd'].map(id => ({ id })) });
    vm.runInContext(pick, ctx);
    return new Set(Array.from({ length: 60 }, () => ctx.jeuPick()));
  };
  assert.deepEqual([...tirer({ a: true, b: true, c: true })], ['d'], 'le seul défi pas encore trouvé');
  assert.deepEqual([...tirer({})].sort(), ['a', 'b', 'c', 'd'], 'rien de trouvé : tous');
  assert.deepEqual([...tirer({ a: true, b: true, c: true, d: true })].sort(), ['a', 'b', 'c', 'd'], 'tout trouvé : on rejoue');
  assert.deepEqual([...tirer({ a: true, b: true, c: true }, [{ cid: 'd' }])].sort(), ['a', 'b', 'c'], 'déjà dans la partie : un autre');
  /* Sans état (tests, premier démarrage) : rien ne casse */
  const ctx = vm.createContext({ Math, JEU: { niv: 'f', rounds: [], recent: new Set() }, jeuChallenges: () => [{ id: 'a' }] });
  vm.runInContext(pick, ctx);
  assert.equal(ctx.jeuPick(), 'a');
});
