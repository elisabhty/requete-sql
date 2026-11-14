/* Elisa, 6 novembre, 12 h 42 : « Alors pour les points défis ? ». Les points ne dépendaient pas du niveau : un défi difficile, plus
   long, rapportait souvent moins qu’un facile. 12 h 42, un bonus de niveau (+25 / +50) ; 15 h, après le rapport de l’expert en game
   design (ce bonus ne comblait que 7 % de l’écart par heure), son choix : « Multiplicateur ×2 / ×4 ».
   - En Moyen, tous les points de la manche (le palier, le premier coup, la place) comptent double et chaque palier dure 3 min ; en
     Difficile, ×4 et 5 min ; le Facile ne change pas. Manche parfaite : 225, 450 ou 900 seul ; 275, 550 ou 1 100 entre amis.
   - Le calcul, dans l’appli (jeuValeur, jeuPts, jeuRanking : le niveau du défi de la manche) et sur le serveur (jeu_score_v2, jeu_score).
   - Ce qu’on voit : la valeur du défi pendant la manche, le détail des points (« Difficile ×4 »), le cadre « Comment sont calculés les
     points ? », qui montre le barème du niveau choisi au-dessus des marches. */
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
const NB = '\u00a0';
const consts = cut('const JEU_PALIERS=', '\n') + '\n' + cut('const JEU_NIV_X=', '\n') + '\n' + cut('const JEU_NIVL=', '\n') + '\n' + cut('const JEU_NIV_MANCHE=', '\n') + '\n' + cut('function jeuDureeMs(', '\n') + '\n';

/* Le vrai code des points, avec trois défis, un par niveau */
const salle = () => {
  const ctx = vm.createContext({ CHALLENGES: [{ id: 'f1', niv: 'f' }, { id: 'm1', niv: 'm' }, { id: 'd1', niv: 'd' }] });
  vm.runInContext(consts + line('jeuValeur') + line('jeuPts') + line('jeuNivManche') + fn('jeuRanking') + line('jeuPtsDetail') + 'var JEU=null;', ctx);
  return ctx;
};
const pur = x => JSON.parse(JSON.stringify(x));

test('le barème : ×2 en Moyen, ×4 en Difficile, des paliers de 2 min et 2 min 30 (14 novembre ; 3 et 5 min avant) ; le Facile, des paliers de 1 min', () => {
  assert.ok(app.includes('const JEU_NIV_X={f:1,m:2,d:4},JEU_NIV_DUREE={f:1,m:2,d:2.5};') && !app.includes('JEU_PTS_NIV'), 'plus de bonus de niveau');
  assert.ok(app.includes('const JEU_PALIERS=[[60,200],[120,175],[180,150],[240,125],[300,100],[360,75]],JEU_PTS_MIN=50,JEU_PTS_ESSAI=25,JEU_PTS_RANG=[50,30,20,10];'), 'les paliers du 31 octobre, le dernier à 6 min (14 novembre)');
  const c = salle(), ev = x => pur(vm.runInContext(x, c));
  const val = (k, ...s) => s.map(t => ev(`jeuValeur(${t * 1000},'${k}')`));
  /* 14 novembre, 7 h 17 : six paliers par manche (6, 12 ou 15 min) */
  assert.deepEqual(val('f', 60, 61, 120, 300, 301, 360), [200, 175, 175, 100, 75, 75], 'le Facile : 01:00 vaut encore 200, jusqu’à 75 à 6 min');
  assert.deepEqual(val('m', 120, 121, 400, 600, 601, 720), [400, 350, 250, 200, 150, 150], 'le Moyen : 400, puis −50 toutes les 2 min, jusqu’à 12 min');
  assert.deepEqual(val('d', 150, 151, 420, 700, 751, 900), [800, 700, 600, 400, 300, 300], 'le Difficile : 800, puis −100 toutes les 2 min 30, jusqu’à 15 min');
  /* 8 novembre, 9 h 17 : le premier coup vaut +25 à tous les niveaux (la vitesse et la place gardent ×2 et ×4) */
  assert.deepEqual(['f', 'm', 'd'].map(k => ev(`jeuPts(30000,0,true,true,'${k}').pts`)), [225, 425, 825], 'la manche parfaite, seul');
  assert.deepEqual(['f', 'm', 'd'].map(k => ev(`jeuPts(30000,0,false,true,'${k}').pts`)), [275, 525, 1025], 'la manche parfaite, entre amis');
  assert.deepEqual(['f', 'm', 'd'].map(k => ev(`jeuPts(30000,0,true,true,'${k}').essai`)), [25, 25, 25], 'le premier coup : +25 partout');
  assert.deepEqual(ev("jeuPts(420000,2,false,false,'d')"), { val: 600, x: 4, essai: 0, rang: 80, pts: 680 }, 'Difficile à 7 min, 3e à trouver (le 3e palier depuis le 14 novembre)');
  assert.equal(ev('jeuPts(30000,0,true,true).pts'), 225, 'sans niveau : comme en Facile');
});

test('une manche compte le niveau de son défi (celui de la salle), sinon celui de la salle', () => {
  const c = salle();
  vm.runInContext("JEU={solo:false,niv:'f',rounds:[{cid:'d1',one:false,found:{a:30000,b:90000},first:{a:1}},{cid:'zz',one:true,found:{a:61000},first:{}}]}", c);
  assert.deepEqual(pur(vm.runInContext('jeuRanking(0)', c)).map(x => [x.pid, x.k, x.x, x.pts]), [['a', 'd', 4, 1025], ['b', 'd', 4, 920]],
    'un défi difficile : (200 + 50) × 4 + 25 pour le premier (le premier coup ne compte pas ×4 : 8 novembre, 9 h 17), (200 + 30) × 4 pour le deuxième');
  assert.deepEqual(pur(vm.runInContext('jeuRanking(1)', c)).map(x => [x.k, x.x, x.pts]), [['f', 1, 175]], 'un défi inconnu : le niveau de la salle');
  assert.equal(vm.runInContext("JEU=null;jeuNivManche(0)", c), 'f');
});

test('ce qu’on voit : la valeur du niveau pendant la manche, « Difficile ×4 » dans le détail des points', () => {
  const c = salle();
  assert.equal(vm.runInContext("jeuPtsDetail({val:700,x:4,k:'d',essai:25,rang:120,place:2})", c),
    '<span class="jeu-pd"><i class="is-niv is-d">Difficile ×4</i><i>Défi 700</i><i class="is-essai">Du premier coup +25</i><i class="is-rang">2e +120</i></span>');
  assert.equal(vm.runInContext("jeuPtsDetail({val:400,x:2,k:'m',essai:0,rang:0,place:1})", c), '<span class="jeu-pd"><i class="is-niv is-m">Moyen ×2</i><i>Défi 400</i></span>');
  assert.equal(vm.runInContext("jeuPtsDetail({val:150,x:1,k:'f',essai:0,rang:0,place:1})", c), '<span class="jeu-pd"><i>Défi 150</i></span>', 'en Facile, rien de plus');
  assert.ok(app.includes('<span id="jeu-val-n">${jeuValeur(Math.max(0,took0),jeuNivManche(n))}</span>') && app.includes('title="Si ta première requête est la bonne">+${JEU_PTS_ESSAI}</i>') && !app.includes('JEU_PTS_ESSAI*'), 'pendant la manche : la valeur du niveau, et le premier coup à +25');
  assert.ok(fn('jeuTick').includes("const v=String(jeuValeur(Math.max(0,took),jeuNivManche(n)));"), 'au fil du chrono aussi');
  assert.ok(fn('jeuFoundHTML').includes('+${x.essai}\\u00a0✨') && fn('jeuDirectObserver').includes("b=prem&&y.essai?`+${y.essai}`:''"), 'trouvé : le premier coup du niveau (chez les autres, dans le commentateur de « En direct »)');
  for (const r of ['html.lq .jeu-pd i.is-niv.is-m{color:#B45309!important}', 'html.lq .jeu-pd i.is-niv.is-d{color:#C2323A!important}']) assert.ok(lq.includes(r), r);
});

/* Le cadre, rendu par le vrai code, niveau par niveau */
function regles(niv) {
  const host = { innerHTML: '', get firstElementChild() { return { classList: { add() {} } }; } };
  const ctx = vm.createContext({ document: { getElementById: id => (id === 'defis-rules' ? host : null) }, lqStkSvg: k => `<svg data-k="${k}"></svg>`, prefersReduceMotion: () => true });
  vm.runInContext(consts + cut('let roomRulesObs=null;', '\nfunction showScreen(){'), ctx);
  vm.runInContext(niv ? `defisRulesNiv('${niv}')` : 'renderDefisRules()', ctx);
  const h = host.innerHTML;
  return { h, marches: [...h.matchAll(/<li style="--h:\d+px;--i:\d"><b>(\d+)<\/b><i aria-hidden="true"><\/i><small aria-hidden="true">([^<]+)<\/small>/g)].map(m => [+m[1], m[2]]) };
}

test('« Comment sont calculés les points ? » : le barème du niveau choisi, ses marches, son premier coup, ses places, sa manche parfaite', () => {
  const f = regles();
  assert.ok(f.h.includes('<div class="room-rules-niv" role="radiogroup" aria-label="Le barème du niveau"><button type="button" role="radio" aria-checked="true" class="is-on" onclick="defisRulesNiv(\'f\')">Facile</button><button type="button" role="radio" aria-checked="false" class="" onclick="defisRulesNiv(\'m\')">Moyen<small>×2\u00a0pts</small></button>'), 'les trois niveaux, le Facile au départ ; « pts » après le coefficient (8 novembre, 13 h 35)');
  assert.deepEqual(f.marches, [[200, '≤ 1'], [175, '1–2'], [150, '2–3'], [125, '3–4'], [100, '4–5'], [75, '5–6']], 'le Facile : six marches de 1 min (14 novembre)');
  const m = regles('m');
  /* La manche dure 12 min en Moyen et 15 en Difficile (14 novembre, 7 h 17 ; 15 et 20 depuis le 8 novembre) : six marches dans le chrono. */
  assert.deepEqual(m.marches, [[400, '≤ 2'], [350, '2–4'], [300, '4–6'], [250, '6–8'], [200, '8–10'], [150, '10–12']], 'le Moyen : six marches de 2 min, jusqu’à la fin du chrono (12 min)');
  assert.ok(m.h.includes('Le chrono part de 12&nbsp;min&nbsp;; à 0, la manche s’arrête et la partie continue.'));
  assert.ok(m.h.includes('<span>jusqu’à 400</span>') && m.h.includes('<b>✨ Du premier coup</b><span>+25</span>') && m.h.includes('<b>🥇 Premier à trouver</b><span>+100</span><small>À plusieurs : 2e +60 · 3e +40 · 4e +20.'));
  assert.ok(m.h.includes('<span>Manche parfaite en Moyen</span><b>425</b><small>seul</small><i aria-hidden="true">·</i><b>525</b><small>à plusieurs</small>'));
  const d = regles('d');
  assert.deepEqual(d.marches, [[800, '≤ 2,5'], [700, '2,5–5'], [600, '5–7,5'], [500, '7,5–10'], [400, '10–12,5'], [300, '12,5–15']], 'le Difficile : six marches de 2 min 30 dans une manche de 15 min');
  assert.ok(d.h.includes('<em class="lq-sr"> points de 2'+NB+'min'+NB+'30 à 5'+NB+'min</em>'), 'lu à voix haute : « 2 min 30 »');
  assert.ok(d.h.includes('Le chrono part de 15&nbsp;min&nbsp;; à 0, la manche s’arrête et la partie continue.') && f.h.includes('Le chrono part de 6&nbsp;min&nbsp;; à 0, la manche s’arrête et la partie continue.'));
  assert.ok(d.h.includes('<b>✨ Du premier coup</b><span>+25</span>') && d.h.includes('<span>Manche parfaite en Difficile</span><b>825</b><small>seul</small><i aria-hidden="true">·</i><b>1\u202f025</b>'), '1 025, avec l’espace des milliers');
  assert.ok(d.h.includes('aria-checked="true" class="is-on" onclick="defisRulesNiv(\'d\')">Difficile<small>×4\u00a0pts</small></button>'));
  assert.ok(f.h.includes('<li class="room-rule-niv"><b>🎯 Niveau du défi</b><span>×2 · ×4</span><small>En Moyen, les points de vitesse et de place comptent double et chaque palier dure 2' + NB + 'min' + NB + '; en Difficile, quadruple et 2' + NB + 'min' + NB + '30. Le premier coup vaut +25 partout. Le chrono' + NB + ': 6' + NB + 'min en Facile, 12 en Moyen, 15 en Difficile.</small></li>'));
  assert.ok(app.includes('<small>Vitesse, niveau, premier coup et place dans la salle</small>'));
  for (const r of ['html.lq .room-rules-niv{display:flex;', 'html.lq .room-rules-niv button.is-on{background:#fff;', '@media (prefers-reduced-motion:reduce){html.lq .room-rules-niv button{transition:none}}']) assert.ok(lq.includes(r), r);
});

test('le serveur compte de même : jeu_score_v2 multiplie la manche et allonge les paliers, jeu_score accepte le plafond qui va avec', () => {
  const m = lire('supabase/migrations/20261106133949_defis_multiplicateur_niveau.sql');
  assert.ok(m.includes("v_x:=case r.niv when 'm' then 2 when 'd' then 4 else 1 end;") && m.includes("v_d:=case r.niv when 'm' then 3 when 'd' then 5 else 1 end;"));
  assert.ok(m.includes('(case when floor(ms/1000.0)<=60*v_d then 200 when floor(ms/1000.0)<=120*v_d then 175') && m.includes('when rang=3 then 10 else 0 end)*v_x end),0)'), 'le palier, le premier coup et la place, ×v_x');
  assert.ok(m.includes("'v_pts > v_ok * (case when v_solo then 225 else 275 end) * (case v_niv when ''m'' then 2 when ''d'' then 4 else 1 end)'"), 'le plafond');
  assert.ok(m.includes("raise exception 'plafond de jeu_score introuvable';"), 'rien ne change si la fonction a changé de forme');
  const c = salle();
  assert.deepEqual(['f', 'm', 'd'].map(k => [vm.runInContext(`JEU_NIV_X.${k}`, c), vm.runInContext(`JEU_NIV_DUREE.${k}`, c)]), [[1, 1], [2, 2], [4, 2.5]], 'les mêmes nombres que l’appli (14 novembre)');
  /* 14 novembre, 7 h 17 : des paliers de 1 min, 2 min, 2 min 30, le dernier à 6 sixièmes (20261114063120) */
  const m2 = lire('supabase/migrations/20261114063120_salle_manches_plus_courtes.sql');
  assert.ok(m2.includes("b3 constant text := $a$v_d:=case r.niv when 'm' then 2 when 'd' then 2.5 else 1 end;$a$;") && m2.includes('b4 constant text := $a$when floor(ms/1000.0)<=360*v_d then 75$a$;') && m2.includes('b1 constant text := $a$v_x integer; v_d numeric; res jsonb;$a$;'));
  assert.ok(m2.includes("when 'm' then interval '12 minutes' when 'd' then interval '15 minutes' else interval '6 minutes' end"), 'la durée de la manche');
});

/* Elisa, 8 novembre, 9 h 17 (« Ok » à la proposition de 9 h 14) : le premier coup vaut +25 à tous les niveaux, sur le serveur aussi ;
   seul son calcul change dans jeu_score_v2, et jeu_score accepte déjà ces totaux (ils restent sous ses bornes). */
test('8 novembre, 9 h 17 : le serveur compte le premier coup à +25 partout, la vitesse et la place gardent ×2 et ×4', () => {
  const dir = path.join(ROOT, 'supabase/migrations');
  const f = fs.readdirSync(dir).find(x => x.endsWith('_defis_premier_coup_fixe.sql'));
  assert.ok(f && f > fs.readdirSync(dir).find(x => x.endsWith('_salle_chrono_selon_niveau.sql')), 'la migration, après celle des durées');
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  assert.ok(sql.includes("avant constant text := '+case when premier and (seul or rang=0) then 25 else 0 end+case when seul then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end)*v_x end),0)';"));
  assert.ok(sql.includes("apres constant text := '+case when seul then 0 when rang=0 then 50 when rang=1 then 30 when rang=2 then 20 when rang=3 then 10 else 0 end)*v_x+case when premier and (seul or rang=0) then 25 else 0 end end),0)';"));
  assert.ok(sql.includes("where n.nspname = 'public' and p.proname = 'jeu_score_v2';") && sql.includes('/ length(avant) <> 1 then') && sql.includes('execute replace(def, avant, apres);'), 'une fois, ou rien');
  /* La manche parfaite la plus haute (Difficile entre amis) : (200 + 50) × 4 + 25 = 1 025, sous la borne de jeu_score (275 × 4) */
  assert.ok((200 + 50) * 4 + 25 <= 275 * 4 && 200 * 4 + 25 <= 225 * 4);
});
