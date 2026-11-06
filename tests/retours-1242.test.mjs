/* Elisa, 6 novembre, 12 h 42 : « Alors pour les points défis ? ». Les points ne dépendaient pas du niveau : un défi difficile, plus
   long, rapportait souvent moins qu’un facile. Son choix, le « Bonus de niveau » : +25 en Moyen, +50 en Difficile, rien en Facile, à
   chaque défi trouvé ; ses paliers de temps (31 octobre, 17 h 39) restent.
   - Le calcul, dans l’appli (jeuPts, jeuRanking : le niveau du défi de la manche) et sur le serveur (jeu_score_v2, jeu_score).
   - Ce qu’on voit : la valeur du défi pendant la manche, le détail des points (« Difficile +50 »), le cadre « Comment sont calculés
     les points ? » (« Niveau du défi », la manche parfaite en Difficile) et la rangée qui y mène. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const line = nom => cut(`function ${nom}(`, '\n') + '\n';
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const NB = ' ';

/* Le vrai code des points, avec trois défis, un par niveau */
const salle = () => {
  const ctx = vm.createContext({ CHALLENGES: [{ id: 'f1', niv: 'f' }, { id: 'm1', niv: 'm' }, { id: 'd1', niv: 'd' }] });
  vm.runInContext(cut('const JEU_PALIERS=', '\n') + '\n' + cut('const JEU_PTS_NIV=', '\n') + '\n' + cut('const JEU_NIVL=', '\n') + '\n'
    + line('jeuValeur') + line('jeuPts') + line('jeuNivManche') + fn('jeuRanking') + line('jeuPtsDetail') + 'var JEU=null;', ctx);
  return ctx;
};
const pur = x => JSON.parse(JSON.stringify(x));

test('le barème : +25 en Moyen, +50 en Difficile, à chaque défi trouvé ; les paliers de temps restent', () => {
  assert.ok(app.includes('const JEU_PTS_NIV={f:0,m:25,d:50};'));
  assert.ok(app.includes('const JEU_PALIERS=[[60,200],[120,175],[180,150],[240,125],[300,100],[420,75]],JEU_PTS_MIN=50,JEU_PTS_ESSAI=25,JEU_PTS_RANG=[50,30,20,10];'), 'les paliers du 31 octobre');
  const c = salle(), ev = x => pur(vm.runInContext(x, c));
  assert.deepEqual(['f', 'm', 'd'].map(k => ev(`jeuPts(30000,0,true,true,'${k}').pts`)), [225, 250, 275], 'la manche parfaite, seul');
  assert.deepEqual(['f', 'm', 'd'].map(k => ev(`jeuPts(30000,0,false,true,'${k}').pts`)), [275, 300, 325], 'la manche parfaite, entre amis');
  assert.deepEqual(ev("jeuPts(270000,2,false,false,'d')"), { val: 100, niv: 50, essai: 0, rang: 20, pts: 170 }, '4 à 5 min, 3e à trouver, en Difficile');
  assert.equal(ev('jeuPts(30000,0,true,true).pts'), 225, 'sans niveau : comme en Facile');
});

test('une manche compte le niveau de son défi (celui de la salle), sinon celui de la salle', () => {
  const c = salle();
  vm.runInContext("JEU={solo:false,niv:'f',rounds:[{cid:'d1',one:false,found:{a:30000,b:90000},first:{a:1}},{cid:'zz',one:true,found:{a:61000},first:{}}]}", c);
  assert.deepEqual(pur(vm.runInContext('jeuRanking(0)', c)).map(x => [x.pid, x.k, x.niv, x.pts]), [['a', 'd', 50, 325], ['b', 'd', 50, 255]],
    'un défi difficile : +50 à chacun de ceux qui le trouvent');
  assert.deepEqual(pur(vm.runInContext('jeuRanking(1)', c)).map(x => [x.k, x.niv, x.pts]), [['f', 0, 175]], 'un défi inconnu : le niveau de la salle');
  assert.equal(vm.runInContext("JEU=null;jeuNivManche(0)", c), 'f');
});

test('ce qu’on voit : la valeur du défi avec son bonus pendant la manche, « Difficile +50 » dans le détail des points', () => {
  const c = salle();
  assert.equal(vm.runInContext("jeuPtsDetail({val:175,niv:50,k:'d',essai:25,rang:30,place:2})", c),
    '<span class="jeu-pd"><i>Défi 175</i><i class="is-niv is-d">Difficile +50</i><i class="is-essai">1er essai +25</i><i class="is-rang">2e +30</i></span>');
  assert.equal(vm.runInContext("jeuPtsDetail({val:200,niv:25,k:'m',essai:0,rang:0,place:1})", c), '<span class="jeu-pd"><i>Défi 200</i><i class="is-niv is-m">Moyen +25</i></span>');
  assert.equal(vm.runInContext("jeuPtsDetail({val:150,niv:0,k:'f',essai:0,rang:0,place:1})", c), '<span class="jeu-pd"><i>Défi 150</i></span>', 'en Facile, pas de bonus');
  assert.ok(app.includes('<span id="jeu-val-n">${jeuValeur(Math.max(0,took0))+(JEU_PTS_NIV[jeuNivManche(n)]||0)}</span>'), 'pendant la manche : le palier et le bonus (250, 225… en Difficile)');
  assert.ok(fn('jeuTick').includes("const v=String(jeuValeur(Math.max(0,took))+(JEU_PTS_NIV[jeuNivManche(n)]||0));"), 'au fil du chrono aussi');
  for (const r of ['html.lq .jeu-pd i.is-niv.is-m{color:#B45309!important}', 'html.lq .jeu-pd i.is-niv.is-d{color:#C2323A!important}']) assert.ok(lq.includes(r), r);
});

test('« Comment sont calculés les points ? » : la ligne « Niveau du défi », la manche parfaite en Difficile, et la rangée', () => {
  const regles = fn('renderDefisRules');
  assert.ok(regles.includes('<li class="room-rule-niv"><b>🎯 Niveau du défi</b><span>jusqu’à +${JEU_PTS_NIV.d}</span><small>À chaque défi trouvé' + NB
    + ': Moyen +${JEU_PTS_NIV.m}, Difficile +${JEU_PTS_NIV.d}' + NB + '; en Facile, pas de bonus</small></li>'));
  assert.ok(regles.indexOf('room-rule-niv') > regles.indexOf('room-rule-vite') && regles.indexOf('room-rule-niv') < regles.indexOf('✨ Du premier coup'), 'juste après la vitesse');
  assert.ok(regles.includes('<span>Manche parfaite en Difficile</span><b>${top+JEU_PTS_NIV.d+JEU_PTS_ESSAI}</b>'), '275 seul, 325 entre amis (retours-1739)');
  assert.ok(app.includes('<small>Vitesse, niveau, premier coup et place dans la salle</small>'));
});

test('le serveur compte de même : jeu_score_v2 ajoute le bonus de la salle, jeu_score accepte le plafond qui va avec', () => {
  const m = lire('supabase/migrations/20261106115533_defis_bonus_de_niveau.sql');
  assert.ok(m.includes("avant := '+case when premier and (solo or rang=0) then 25 else 0 end';")
    && m.includes("execute replace(def, avant, '+(case r.niv when ''m'' then 25 when ''d'' then 50 else 0 end)' || avant);"));
  assert.ok(m.includes("avant := 'v_pts > v_ok * (case when v_solo then 225 else 275 end)';")
    && m.includes("'v_pts > v_ok * ((case when v_solo then 225 else 275 end) + (case v_niv when ''m'' then 25 when ''d'' then 50 else 0 end))'"));
  assert.ok(m.includes("raise exception 'barème de jeu_score_v2 introuvable';") && m.includes("raise exception 'plafond de jeu_score introuvable';"), 'rien ne change si la fonction a changé de forme');
  const c = salle();
  assert.deepEqual(['f', 'm', 'd'].map(k => vm.runInContext(`JEU_PTS_NIV.${k}`, c)), [0, 25, 50], 'les mêmes nombres que l’appli');
});
