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
  /* 7 novembre, 21 h 44 : « ×2 pts », plus visible (retours-2144-defis) */
  /* 8 novembre, 11 h 08 (« ce niveau premium ») : la pièce de « Ta salle de défi » puis ×N (retours-premium-defis) */
  assert.ok(niv.includes('`<span class="room-lv-x" aria-hidden="true">${DX_PIECE_SVG}×${x}<small>pts</small></span>`'), 'la pièce, ×2, puis « pts » (8 novembre, 13 h 35)');
  assert.ok(niv.includes("lu=`${JEU_NIVL[k]}, ${x>1?`points multipliés par ${x}`:'points de base'}${k===auto?', niveau recommandé':''}`"), 'lu en toutes lettres');
  assert.ok(niv.includes("${k===auto&&!vide?'<em class=\"room-lv-auto\">Niveau recommandé</em>':''}"), 'le niveau recommandé reste');
  const ctx = vm.createContext({ JEU_NIV_X: { f: 1, m: 2, d: 4 }, JEU_NIVL: { f: 'Facile', m: 'Moyen', d: 'Difficile' }, jeuNiv: 'm', jeuNivAuto: () => 'm', jeuChallenges: () => [1], DX_PIECE_SVG: '<svg data-k="piece"></svg>' });
  vm.runInContext(niv, ctx);
  const html = ctx.jeuNiveauxHTML('lab', 'defisNiv');
  assert.deepEqual([...html.matchAll(/<span class="room-lv-x" aria-hidden="true"><svg data-k="piece"><\/svg>([^<]+)<small>pts<\/small><\/span>/g)].map(m => m[1]), ['×1', '×2', '×4']);
  assert.deepEqual([...html.matchAll(/aria-label="([^"]+)"/g)].map(m => m[1]),
    ['Facile, points de base', 'Moyen, points multipliés par 2, niveau recommandé', 'Difficile, points multipliés par 4']);
  for (const part of ['html.lq .room-level .room-lv-x{display:inline-flex;', 'html.lq .room-level.is-m .room-lv-x{background:#FDF1E2;color:var(--warn)}',
    'html.lq .room-level.is-d .room-lv-x{background:#FDE8EA;color:var(--danger)}', 'html.lq[data-reading="large"] .room-level .room-lv-x{font-size:14px;'])
    assert.ok(lq.includes(part), part);
});

test('le tirage : la version du catalogue part avec chaque message, un défi choisi exprès le dit', () => {
  assert.ok(app.includes('const JEU_CAT=2;'), '2 : les 267 défis, puis les 210 des sept bases du 6 novembre');
  assert.ok(fn('jeuSend').includes('m.u=jeuRand(8);m.cat=JEU_CAT;'));
  assert.ok(app.includes("const impose=!!J.plan[n];\n  /* Une seule fois par manche depuis ce téléphone (la suite part toute seule, 17 h 31) */\n  const k=J.g+':'+n;if(J.lance===k)return;J.lance=k;\n  const w=n===0&&Array.isArray(who)?who:null;\n  if(w)jeuSend({t:'round',n,cid:J.plan[n]||jeuPick(),imp:impose?1:0,one:w.length<2?1:0,who:w});\n  else jeuSend({t:'round',n,cid:J.plan[n]||jeuPick(),imp:impose?1:0,one:jeuLive().length<2?1:0});"));
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

/* Le serveur (migrations appliquées le 6 novembre, avec l’accord d’Elisa : « Tout mettre en ligne ») */
const mig = suffixe => { const d = path.join(ROOT, 'supabase/migrations'); const f = fs.readdirSync(d).find(x => x.endsWith(suffixe)); assert.ok(f, suffixe); return fs.readFileSync(path.join(d, f), 'utf8'); };

test('Supabase — le serveur note les défis joués et trouvés, et tire un défi qu’aucun joueur présent n’a fait', () => {
  const m = mig('_defis_deja_joues.sql');
  assert.ok(m.includes('create table if not exists requete_private.defi_joue (\n  cle text not null references public.jeu_pseudo (cle) on delete cascade,'), 'la liste suit le pseudo');
  assert.ok(m.includes('revoke all on table requete_private.defi_joue from public, anon, authenticated;') && m.includes('alter table requete_private.defi_joue enable row level security;'));
  assert.ok(m.includes("order by coalesce(p.joueurs, 0), (c.id is not distinct from p_cid) desc, coalesce(p.trouveurs, 0), p.dernier nulls first, random()"),
    'd’abord personne de présent ne l’a fait ; le défi proposé par l’hôte s’il en fait partie ; puis le moins trouvé, le plus ancien');
  assert.ok(m.includes('where c.niv = p_niv and c.depuis <= p_cat'), 'seulement des défis que tous les téléphones connaissent');
  assert.ok(m.includes("selected:=requete_private.defi_tirer(p_salle,r.generation,r.niv,v_cat,cles,p_m->>'cid',coalesce(p_m->>'imp','')='1');"), 'le tirage par le serveur');
  assert.ok(m.includes("coalesce(min(coalesce(mb.cat,1)),1)"), 'une appli d’avant (sans cat) connaît les 267 premiers');
  assert.ok(m.includes('on conflict (cle,defi) do update set trouve=coalesce(requete_private.defi_joue.trouve,excluded.trouve);'), 'trouvé : noté par le serveur');
  for (const v of ['stats_defis_joues', 'stats_defis_restants']) assert.ok(m.includes(`create or replace view public.${v} with (security_invoker = true) as`), v);
  assert.ok(m.includes('revoke all on public.stats_defis_joues, public.stats_defis_restants from anon, authenticated;'), 'fermées à l’appli');
  const c = mig('_defis_deja_joues_classement.sql');
  assert.ok(c.includes('add constraint defi_joue_classement_fkey foreign key (cle) references public.jeu_joueur (cle) on delete cascade not valid;'),
    '« Retirer mes scores » et « Effacer la progression » (jeu_oublier) effacent la liste avec la place au classement');
  assert.ok(c.includes("'v_x integer; v_d integer; res jsonb;'") && c.includes('-- les défis de la partie, notés pour ce joueur maintenant qu’il est au classement (sa première partie comprise)'));
  assert.equal((c.match(/and exists\(select 1 from public\.jeu_joueur j where j\.cle=/g) || []).length, 4, 'les trois endroits qui notent, et la fin de partie : seulement un joueur du classement');
  const b = mig('_defis_sept_bases.sql');
  assert.ok(b.includes("from unnest(array['k', 't', 'q', 'b', 'r', 'e', 'g']) as b (p)") && b.includes('select b.p || n.n || i.i, n.n, 2'), 'les 210 défis, en version 2');
  assert.ok(b.includes("if (select count(*) from requete_private.catalogue) <> 477 then raise exception"));
  /* Les identifiants générés sont bien ceux des 210 défis de l’appli */
  const ids = [...app.matchAll(/\{id:'([a-z]{2}\d+)',apres:\d+,titre:[^\n]+,base:'(ski|foodtruck|aquarium|velos|apiculture|escape|festival)'/g)].map(m => m[1]).sort();
  const gen = ['k', 't', 'q', 'b', 'r', 'e', 'g'].flatMap(p => ['f', 'm', 'd'].flatMap(n => Array.from({ length: 10 }, (_, i) => p + n + (i + 1)))).sort();
  assert.deepEqual(ids, gen);
});

/* 6 novembre, 16 h : Elisa choisit « Les deux » dernières règles de l’expert, et « Entraîne-toi » au-dessus de Pratiquer. */
test('Pratiquer : « Entraîne-toi » au-dessus du titre, la carte garde « À toi de jouer »', () => {
  assert.ok(app.includes('<div class="lgtitle"><div><div class="eyebrow">Entraîne-toi</div><h1>Pratiquer</h1>'));
  assert.ok(fn('renderJourneyHub').includes('<p class="journey-kicker">À toi de jouer</p>'));
});

test('celui qui ne joue pas ne compte pas : moins de deux joueurs ont essayé, la manche se compte comme seul', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('const JEU_PALIERS=', '\n') + '\n' + cut('const JEU_NIV_X=', '\n') + '\n' + fn('jeuValeur') + fn('jeuPts') + fn('jeuNivManche') + fn('jeuRanking') + 'var JEU={solo:false,rounds:[]};', ctx);
  vm.runInContext("JEU.rounds[0]={one:false,found:{a:30000},first:{a:1}};JEU.rounds[1]={one:false,found:{a:30000},first:{a:1},tried:{b:1}};", ctx);
  const r = n => JSON.parse(JSON.stringify(ctx.jeuRanking(n))).map(x => [x.pid, x.essai, x.rang, x.pts]);
  assert.deepEqual(r(0), [['a', 25, 0, 225]], 'l’autre téléphone n’a rien tenté : pas de bonus de place');
  assert.deepEqual(r(1), [['a', 25, 50, 275]], 'l’autre a essayé (manqué) : la place compte');
  assert.ok(app.includes("if((m.g|0)===J.g){const rt=J.rounds[+m.n];if(rt){(rt.tried=rt.tried||{})[m.pid]=1;(rt.ko=rt.ko||{})[m.pid]=(rt.ko[m.pid]||0)+1;}}"), 'un essai manqué est noté pour sa manche (et compté pour « En direct », 8 novembre)');
  assert.ok(fn('renderDefisRules').includes('Seul à jouer la manche, pas de bonus de place</small></li>'), 'le cadre des points le dit');
  const m = mig('_defis_anti_triche.sql');
  assert.ok(m.includes('(select count(distinct x.pid) from requete_private.essai x where x.code=rd.code and x.generation=rd.generation and x.numero=rd.numero)<2) as seul,'), 'le serveur compte de même');
  assert.ok(m.includes("'+case when premier and (seul or rang=0) then 25 else 0 end+case when seul then 0 when rang=0'"));
});

/* 6 novembre, 16 h : « Clore la manche », 2 min après le premier qui a trouvé. 9 novembre, 8 h 42 (Elisa) : « La manche se clôt seule
   quand tout le monde a trouvé ; l’hôte n’a pas la main pour la clore ; elle termine au mieux au chrono si personne n’a trouvé. » */
test('plus de « Clore la manche » : la manche se clôt seule (tout le monde a trouvé, ou le chrono) ; la règle du serveur reste', () => {
  for (const k of ['function jeuHostBarHTML(', 'function jeuCloreAttente(', 'const JEU_CLORE_MS=', 'function jeuClose(', 'jeuClose()', 'jeu-clore-t', 'jeu-hostbar', '<span>Clore la manche pour tous</span>', 'Tu pourras clore la manche dans'])
    assert.ok(!app.includes(k), k);
  assert.ok(!fn('jeuTick').includes('clore'), 'plus de compte à rebours de l’hôte');
  assert.ok(fn('jeuRoundDone').includes("if(r.done||r.closed||Date.now()-r.t1>=jeuDureeMs(jeuNivManche(n)))return true;") && fn('jeuRoundDone').includes('if(!jeuLive().every(p=>r.found[p]!=null))return false;'), 'tout le monde a trouvé, ou le chrono à 0');
  /* Une manche close par une version d’avant de l’appli (ou par le serveur à la fin du chrono) se lit toujours */
  assert.ok(app.includes("    case 'close':{\n      if(m.pid!==J.hostPid)return;"));
  const m = mig('_defis_anti_triche.sql');
  assert.ok(m.includes("raise exception 'clore la manche : 2 minutes après le premier qui a trouvé' using errcode='P0001';") && m.includes("raise exception 'fin de partie : 2 minutes après le premier qui a trouvé' using errcode='P0001';"), 'le serveur refuse aussi');
});
