/* Elisa, 8 novembre, 17 h 31 : « ça s’est bloqué à 1 s quand ça a rechargé la page sans faire exprès (pareil sur iOS quand je quitte
   et que je reviens sur la page, je ne veux pas que ça se bloque, quand je vais sur une autre appli par exemple). Pourquoi on doit
   cliquer sur le bouton pour la manche ? Il faut que ça continue seul sans interruption. » */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';
const ligne = nom => { const i = app.indexOf(`function ${nom}(`); assert.ok(i >= 0, nom); return app.slice(i, app.indexOf('\n', i)) + '\n'; };

function moteur({ live = ['a'], now = 1_000_000 } = {}) {
  const ctx = vm.createContext({ Date: { now: () => ctx.__now }, __now: now, JEU: null, CHALLENGES: [{ id: 'x', niv: 'f' }], JEU_NIV_MANCHE: { f: 600000, m: 900000, d: 1200000 },
    JEU_PING_MS: 20000, jeuLive: () => live, jeuSoloLike: () => live.length < 2 });
  vm.runInContext('const JEU_AUTO_MS=5000;' + ligne('jeuDureeMs') + ligne('jeuNivManche') + fn('jeuRoundDone') + ligne('jeuAutoAttente') + fn('jeuFinAuto') + ligne('jeuFermeeAuChrono'), ctx);
  return ctx;
}

test('quelle que soit la fin de la manche, la suite part 5 s après que ce téléphone l’a vue finie', () => {
  const ctx = moteur();
  const r = { cid: 'x', t1: 1_000_000 - 60_000, found: {} };
  ctx.JEU = { solo: false, nb: 3, over: false, rounds: [r], synced: true, syncAt: 0, echoAt: 1_000_000 };
  assert.equal(ctx.jeuFinAuto(0), 0, 'la manche se joue');
  r.closed = true;
  assert.equal(ctx.jeuFinAuto(0), 1_005_000, 'close (par l’hôte, abandonnée, ou par le serveur à son heure) : 5 s');
  ctx.__now += 3000;
  assert.equal(ctx.jeuFinAuto(0), 1_005_000, 'le même moment, d’un tick à l’autre');
  const s = { cid: 'x', t1: 1_000_000, found: { a: 42 } };
  ctx.JEU.rounds = [s];
  assert.equal(ctx.jeuFinAuto(0), 1_008_000, 'trouvée par tout le monde : aussi');
  const t = { cid: 'x', t1: ctx.__now - 600_000 - 30_000, found: {} };
  ctx.JEU.rounds = [t];
  assert.equal(ctx.jeuFinAuto(0), ctx.__now + 5000, 'de retour après la fin du chrono (une autre appli, un rechargement) : encore 5 s pour voir le résultat');
  ctx.JEU.over = true;
  assert.equal(ctx.jeuFinAuto(0), 0, 'la partie finie : plus rien');
  assert.equal(ctx.jeuAutoAttente(0), '<span class="jeu-auto-att"><i class="jeu-dot" aria-hidden="true"></i>La manche suivante arrive…</span>');
  assert.match(ctx.jeuAutoAttente(2), /Ton bilan arrive…/);
});

test('plus de bouton « Manche suivante » : la même ligne chez tous, puis « La manche suivante arrive… »', () => {
  const r = cut("}else if(v.startsWith('res')){", "}else if(v==='final'){");
  assert.ok(!r.includes("onclick=\"${last?'jeuFinish()':'jeuNextRound()'}\"") && !r.includes('Manche suivante</span>') && !r.includes('jeu-room-wait'), 'ni bouton ni attente de l’hôte');
  assert.ok(r.includes('const autoHTML=`<p class="jeu-auto jr2-auto" id="jeu-auto" style="--reste:${reste}ms;') && r.includes('">${auto&&Date.now()<auto?'), 'le compte à rebours et sa barre (15 h 48)');
  assert.ok(r.includes(':jeuAutoAttente(n)}</p>`;') && r.includes('${hero}${classement}${autoHTML}`;'));
  const tick = fn('jeuTick');
  assert.ok(tick.includes("if(an&&t){if(Date.now()<t)an.textContent=String(Math.max(1,Math.ceil((t-Date.now())/1000)));else{const al=document.getElementById('jeu-auto');if(al)al.innerHTML=jeuAutoAttente(n);}}"));
  assert.ok(tick.includes('if(t&&r&&!r.auto&&Date.now()>=t&&jeuIsHost()){r.auto=true;if(n<J.nb-1)jeuNextRound();else if(!jeuSoloLike(n))jeuFinish();}'));
  const next = fn('jeuNextRound');
  assert.ok(next.includes("const k=J.g+':'+n;if(J.lance===k)return;J.lance=k;"), 'une seule fois par manche');
  assert.ok(fn('jeuFlush').includes("J.out=J.out.filter(e=>Date.now()-e.at<600000&&!(e.m.t==='round'&&J.rounds[+e.m.n]&&J.rounds[+e.m.n].u!==e.m.u)"), 'un lancement déjà fait par un autre ne repart plus');
});

test('fermée par le serveur à son heure (de retour après la fin) : « Temps écoulé », pas « Manche abandonnée »', () => {
  const ctx = moteur();
  ctx.JEU = { rounds: [] };
  const r = { cid: 'x', srvT1: 5_000_000, closed: true, closeAt: 5_000_000 + 600_000 + 75_000 };
  assert.equal(ctx.jeuFermeeAuChrono(r, 0), true);
  assert.equal(ctx.jeuFermeeAuChrono({ ...r, closeAt: 5_000_000 + 120_000 }, 0), false, 'partie avant la fin : abandonnée');
  assert.equal(ctx.jeuFermeeAuChrono({ ...r, closeAt: 0 }, 0), false, 'sans l’heure du serveur : comme avant');
  assert.ok(app.includes("J.rounds[n]={cid:m.cid,t0,t1:t0+JEU_DRAW_MS,found:{},hist,relayAt:m.at||0,srvT1:+m.startAt||(m.at?m.at+JEU_DRAW_MS:0),"));
  assert.ok(cut("    case 'close':{", "    case 'end':").includes('r.closed=true;r.closeAt=+m.at||0;'));
  assert.ok(fn('jeuMissHTML').includes("r.closed&&!jeuFermeeAuChrono(r,JEU?JEU.rounds.indexOf(r):-1)?"));
  assert.ok(app.includes("const ab=!ok&&x.r.closed&&!jeuFermeeAuChrono(x.r,k),why=ab?(J.solo||host?'Abandonnée':'Close par l’hôte'):'Temps écoulé';"));
});

test('de retour d’une autre appli : un signe de vie avant « hello », et le serveur compte le joueur présent', () => {
  const sent = [];
  const ctx = vm.createContext({ Date, JEU: { solo: false, synced: true, full: false }, jeuSend: m => { sent.push(m.t); return 'u' + sent.length; } });
  vm.runInContext(fn('jeuResume'), ctx);
  ctx.jeuResume();
  assert.deepEqual(sent, ['ping', 'hello'], 'les envois partent dans l’ordre : le ping d’abord');
  assert.equal(ctx.JEU.resumeU, 'u2');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261108164155_salle_retour_compte_present.sql'), 'utf8');
  assert.match(sql, /avant constant text := 'update requete_private\.membre set parti=false where code=p_salle and membre\.pid=v_pid;';/);
  assert.match(sql, /replace\(def, avant, 'update requete_private\.membre set parti=false,vu=now_at where code=p_salle and membre\.pid=v_pid;'\)/);
  assert.match(sql, /raise exception 'arrivée introuvable dans jeu_envoyer_v2'/, 'rien n’est changé si la ligne a bougé');
});
