/* Elisa, 8 novembre, 18 h 01 : « pourquoi quand je rafraîchis la page ça m’amène à la manche suivante ? Et quand je reviens ça bug
   un peu l’écran comme des flash ». */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

test('rafraîchir ne ferme plus la manche : le serveur attend le retour jusqu’à la fin du chrono', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261108170654_salle_manche_attend_le_retour.sql'), 'utf8');
  assert.match(sql, /pg_get_functiondef\('requete_private\.close_if_finished\(text,integer,integer\)'::regprocedure\)/);
  assert.ok(sql.includes(") or not exists(\\n   select 1 from requete_private.membre mb where mb.code=p_code and rd.joueurs ? mb.pid and not mb.parti and mb.vu>clock_timestamp()-interval ''55 seconds''\\n )) then return; end if;"), 'personne de présent : la manche attend');
  assert.match(sql, /raise exception 'condition introuvable dans close_if_finished'/, 'rien n’est changé si la condition a bougé');
  /* Et dans l’appli, tirer pour actualiser ne recharge plus pendant une partie */
  assert.ok(app.includes("    on=false; if(busy||e.touches.length!==1)return;\n    /* Pas pendant une partie : un rechargement sans le vouloir faisait quitter la salle (Elisa, 8 novembre, 17 h 31 et 18 h 01). */\n    if(typeof JEU!=='undefined'&&JEU)return;"));
});

test('« Connexion perdue » n’apparaît qu’après 4 s sans réseau, et une seule fois', () => {
  const el = { innerHTML: '', dataset: { vu: '' } };
  let now = 1_000_000, poses = 0;
  const ctx = vm.createContext({ Date: { now: () => now }, JEU: { net: true, netBas: 0 }, JEU_ICO: { wifi: '<svg/>' },
    jeuNoteHTML: (cls, ico, t) => `<div class="jeu-net ${cls}">${t}</div>`,
    document: { getElementById: id => (id === 'jeu-netslot' ? new Proxy(el, { set(o, k, v) { if (k === 'innerHTML') poses++; o[k] = v; return true; } }) : null) } });
  vm.runInContext('const JEU_NET_MS=4000;' + fn('jeuNetHTML') + cut('function jeuNetSlot(){', '\n') + '\n' + fn('jeuNetMaj'), ctx);
  assert.equal(ctx.jeuNetSlot(), '<div id="jeu-netslot" data-vu=""></div>');
  ctx.JEU.net = false; ctx.JEU.netBas = now;
  now += 1500; ctx.jeuNetMaj();
  assert.equal(poses, 0, 'le direct qui se rebranche au retour : rien ne bouge');
  now += 3000; ctx.jeuNetMaj(); ctx.jeuNetMaj(); ctx.jeuNetMaj();
  assert.equal(poses, 1, 'au bout de 4 s : la notice, posée une fois');
  assert.match(el.innerHTML, /Connexion perdue/);
  ctx.JEU.net = true; ctx.JEU.netBas = 0; ctx.jeuNetMaj();
  assert.equal(el.innerHTML, ''); assert.equal(poses, 2);
  assert.ok(!app.includes('<div id="jeu-netslot">${jeuNetHTML()}</div>') && (app.match(/\$\{jeuNetSlot\(\)\}/g) || []).length === 7, 'partout la même place');
  assert.ok(fn('jeuPatch').includes('  jeuNetMaj();\n') && fn('jeuTick').includes('  jeuNetMaj();\n'));
  assert.ok(app.includes('J.net=ok;J.netBas=ok?0:(J.netBas||Date.now());') && fn('jeuPost').includes('J.net=false;if(!J.netBas)J.netBas=Date.now();'));
});

test('au retour, une seule reprise : un signe de vie et un « hello », pas trois', () => {
  const sent = [];
  let now = 5_000_000;
  const ctx = vm.createContext({ Date: { now: () => now }, JEU: { solo: false, synced: true, full: false }, jeuSend: m => { sent.push(m.t); return 'u' + sent.length; } });
  vm.runInContext(fn('jeuResume'), ctx);
  ctx.jeuResume(); now += 400; ctx.jeuResume(); now += 900; ctx.jeuResume();
  assert.deepEqual(sent, ['ping', 'hello']);
  now += 3000; ctx.jeuResume();
  assert.deepEqual(sent, ['ping', 'hello', 'ping', 'hello'], 'un autre retour, plus tard : une autre reprise');
});

test('après un rechargement, un écran calme le temps de retrouver sa partie (plus « Tu rejoins la salle de ton ami »)', () => {
  assert.ok(app.includes('inscrits:new Set(),tard:false,reprise:!!opts.reprise,enLecon:!!opts.enLecon};'));
  assert.ok(app.includes("  if(v==='join'&&J.reprise){\n    html=`<div class=\"jeu-reprise\" role=\"status\"><i class=\"jeu-spin\" aria-hidden=\"true\"></i><span>On reprend ta partie…</span></div>${jeuNetSlot()}`;\n  }else if(v==='join'){"));
  assert.ok(css.includes('html.lq #jeu-root .jeu-reprise{display:flex;align-items:center;justify-content:center;gap:10px;min-height:42vh;'));
});
