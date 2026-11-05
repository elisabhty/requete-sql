/* Elisa, 31 octobre, 17 h 53 et 18 h 02 :
   « il n’y aura pas de suppression de pseudo si la personne a encore son compte (ménage) » (supabase : retours-1649) ;
   « laisse tomber le fait qu’un défi ne peut pas être rejoué s’il est réussi : il peut être rejoué, et ne pas mettre que ce sont des
     défis réussis » (le tirage : salle-defis) ;
   « réf. 1 : est-ce que tu as pris en compte quand on jouera à 6, 7, 8 joueurs dans l’historique ? » (retours-1649, réf. 6) ;
   « non, ici ce sera le prénom, et une fois connecté la première fois, une mini-page pour le choix du pseudo » (retours-1649) ;
   18 h 02 (la tuile « Défis 0/25 ») : « ici, mettre le nombre de points et le nombre de manches réussies, un chiffre dynamique (0/0,
   1/1 quand on en gagne une, 1/2 quand on en gagne une et en perd une) ; modifier le KPI ailleurs s’il est présent ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => { const a = app.indexOf(`function ${name}(`); assert.ok(a > 0, name); return app.slice(a, app.indexOf('\n}', a) + 2); };

test('l’indicateur des défis : les manches trouvées sur jouées (0/0, 1/1, 1/2…) et les points', () => {
  const ctx = vm.createContext({ state: {} });
  vm.runInContext(cut('function salleKpi(', '/* Entrée « Salle de défi »'), ctx);
  const k = s => { ctx.state = { salle: s }; return JSON.parse(JSON.stringify(vm.runInContext('salleKpi()', ctx))); };
  assert.deepEqual(k(undefined), { tr: 0, ma: 0, pts: 0, lv: {} }, 'avant la première partie : 0/0');
  assert.deepEqual(k({ manches: 1, trouves: 1, pts: 225 }), { tr: 1, ma: 1, pts: 225, lv: {} }, 'une gagnée : 1/1');
  assert.deepEqual(k({ manches: 2, trouves: 1, pts: 225, lv: { f: [2, 1] } }), { tr: 1, ma: 2, pts: 225, lv: { f: [2, 1] } }, 'une gagnée, une perdue : 1/2');
  assert.deepEqual(k({ manches: 2, trouves: 5, pts: -4 }), { tr: 2, ma: 2, pts: 0, lv: {} }, 'jamais plus de trouvées que de jouées');
  assert.equal(vm.runInContext('sallePts(1230)', ctx), '1 230 pts');
  assert.equal(vm.runInContext('sallePts(1)', ctx), '1 pt');
});

test('le KPI partout où il était : planning, Mon compte, Pratiquer, les niveaux de la salle ; plus de défis « réussis »', () => {
  const over = cut('function planOverviewHTML(st){', 'function planManageHTML(');
  /* 1er novembre, 1 h 12 : « améliore l’ui ux des kpi » */
  assert.ok(over.includes(`<div class="pgr-stat is-d"><small>Défis</small><b>\${kd.ma?\`\${kd.tr}<em>/\${kd.ma}</em>\`:'0'}</b><i class="pgr-meter" aria-hidden="true"><b style="width:\${pD}%"></b></i><p>\${kd.ma?\`réussie\${kd.tr>1?'s':''}\`:'à jouer'}</p><span class="kpi-pts">\${KPI_COIN_SVG}\${sallePts(kd.pts)}</span></div>`), 'la tuile du planning');
  assert.ok(over.includes('pD=kd.ma?Math.round(kd.tr/kd.ma*100):0'), 'la jauge : la part de manches trouvées');
  const compte = cut('function renderCompte(){', 'function accPseudoHTML(');
  assert.ok(compte.includes(`<div class="acct-stat is-defis" style="--i:2"><span class="acct-stat-ico is-stk" aria-hidden="true">\${lqStkSvg('target')}</span><b>\${(+kd.pts||0).toLocaleString('fr-FR')}</b><small>point\${kd.pts>1?'s':''} en défis</small><span class="kpi-chip\${kd.ma?'':' is-vide'}">\${kd.ma?\`\${kd.tr}/\${kd.ma} réussie\${kd.tr>1?'s':''}\`:'À jouer'}</span></div>`), 'Mon compte');
  const hub = fn('renderJourneyHub');
  /* 5 novembre, 14 h 24 : « Mes défis » ouvre Mes stats ; le cadre du haut, d’après la réf. 3 d’Elisa (retours-1424.test.mjs). */
  assert.ok(hub.includes("['defis','Mes défis',`${kd.tr}/${kd.ma} manches réussies\\u00a0· ${(+kd.pts||0).toLocaleString('fr-FR')} point${kd.pts>1?'s':''}`,\"pratiquerDefis('stats')\",kd.ma?Math.round(kd.tr/kd.ma*100):null],"), 'Pratiquer');
  assert.ok(hub.includes('<p class="journey-kicker">Salle de défi</p><h2>${typeof accord===\'function\'?accord(\'Prête\',\'Prêt\',\'Prêt·e\'):\'Prêt·e\'} à relever le défi&nbsp;?</h2>'), 'le cadre du haut de Pratiquer');
  const room = fn('renderDefisRoom');
  assert.ok(!room.includes("réussie${ok>1?'s':''}") && !room.includes('stat(k)'), 'plus de sous-texte sous les niveaux (15 h 54)');
  /* 5 novembre, 11 h 32 : le sous-titre d’Elisa */
  assert.ok(fn('renderDefis').includes('sub.textContent=`${all.length} défis pour te tester. Joue en solo, défie d’autres joueurs et grimpe dans le classement.`;'));
  for (const gone of ['réussis sur ${nDefis}', 'Tout est réussi', 'Prochain défi · ${nOk}', "/${l.length} réussis", 'défi${nOk>1?\'s\':\'\'} réussi', 'Réussis 10 défis.', 'que tu n’as pas encore réussi', 'qu’aucun de vous n’a encore réussi'])
    assert.ok(!app.includes(gone), 'retiré : ' + gone);
  assert.ok(app.includes("how:'Trouve 10 défis différents.'"));
  for (const part of ['html.lq .pgr-stat.is-d>p{margin:8px 0 0!important;', 'html.lq .acct-stat .kpi-chip{', 'html.lq .kpi-pts{'])
    assert.ok(css.includes(part), part);
  assert.ok(css.includes('html.lq .room-head{margin:0 -18px;padding:14px 18px 12px}'), 'bandeau de salle resserré');
  assert.ok(css.includes('html.lq .room-field{margin-top:12px}'), 'choix rapprochés du bandeau');
});

test('le classement sans pseudo : on peut le choisir d’ici ; Données et confidentialité : supprimer son pseudo', () => {
  const top = fn('clsTopHTML');
  assert.ok(top.includes('const meLine=!jeuSavedNom()?`<p class="perf-top-me">Choisis ton pseudo pour entrer au classement. <button type="button" class="perf-top-pick" onclick="psPage({})">Choisir mon pseudo</button></p>`'));
  const data = cut('<details class="plus-details" id="plus-data">', '</details>');
  /* 1er novembre, 1 h 01 : ni « Supprimer mon pseudo » ni « Retirer mes scores » dans Données et confidentialité */
  assert.ok(!data.includes('psSupprimer()') && !data.includes('Retirer mes scores'));
  assert.ok(data.includes('Revenir au classement général'), 'qui avait quitté le classement peut y revenir');
});
