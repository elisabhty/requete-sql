/* Classement général (Top 5 de tous les joueurs), Elisa, 31 octobre, 15 h 16 : « dans la partie performance on n’a pas de top avec
   les personnes de l’appli (pas que nos amis → tous) Top 5 », « voir les 3 dernières personnes avec qui on a joué », et la publication
   sur l’App Store (pseudos filtrés, signalement, effacement de ses données). Le code de l’appli est exécuté avec une fausse base. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dir = new URL('../supabase/migrations/', import.meta.url);
const sql = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const block = app.slice(app.indexOf('/* ---------- Classement général : le Top 5 de tous les joueurs'), app.indexOf('function renderDefisPerf(){'));
assert.ok(block.includes('function clsTopHTML(') && block.includes('function jeuPseudoOk('), 'bloc du classement localisé');
const flush = () => new Promise(r => setImmediate(r));

function makeCls({ nom = 'Elisa', salle = {}, reply } = {}) {
  const calls = [], said = [], asks = [];
  const el = { innerHTML: '', classList: { remove() {}, add() {} }, offsetWidth: 0 };
  const ctx = vm.createContext({
    state: { salle: JSON.parse(JSON.stringify(salle)) }, Date, Math, JSON, Array, Set, Object, String, Number, Promise, setTimeout,
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_test',
    save() {}, jeuRand: n => 'R'.repeat(n), jeuSavedNom: () => nom, lqStkSvg: k => `<svg data-k="${k}"></svg>`,
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    escAttr: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    perfColor: () => 1, jeuInitial: n => String(n || '?').charAt(0).toUpperCase(), plur: (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`,
    lqAsk: o => { asks.push(o); return Promise.resolve(true); }, lqSay: t => said.push(t), buzz() {}, closePlusDetails() {}, renderCompte() {},
    document: { getElementById: id => (id === 'perf-top' ? el : null) },
    fetch: (url, opt) => {
      const fn = url.split('/rpc/')[1], body = JSON.parse(opt.body);
      calls.push({ fn, body, apikey: opt.headers.apikey });
      const [ok, json] = reply ? reply(fn, body) : [true, {}];
      return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(json) });
    },
  });
  vm.runInContext(block, ctx);
  const ev = code => vm.runInContext(code, ctx);
  return { ctx, ev, calls, said, asks, el, salle: () => ctx.state.salle };
}

test('pseudos : la même liste dans l’appli et sur le serveur, et les mêmes verdicts', () => {
  const fnSql = sql.slice(sql.lastIndexOf('create or replace function public.jeu_pseudo_ok'));
  const longs = fnSql.match(/v_colle ~ '\(([^)]+)\)'/)[1].split('|');
  const courts = [...fnSql.match(/v_mots && array\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const { ev } = makeCls();
  assert.deepEqual(Array.from(ev('JEU_PSEUDO_LONGS')), longs, 'mots longs');
  assert.deepEqual(Array.from(ev('JEU_PSEUDO_COURTS')), courts, 'mots entiers');
  const [, accA, accB] = fnSql.match(/translate\(v, '([^']+)', '([^']+)'\)/);
  assert.equal(Array.from(accA).length, Array.from(accB).length, 'table des accents : autant de lettres de chaque côté');
  assert.ok(ev('jeuPseudoOk.toString()').includes(`A='${accA}',B='${accB}'`), 'mêmes accents');
  /* Vérifié aussi sur la vraie base (31 octobre) : mêmes réponses */
  for (const p of ['Elisa', 'Léa', 'Kinoshita', 'Montenegro', 'Bordeleau', 'Salé', 'Isis', 'Conrad', 'Computer', 'Habite', 'Calcul', 'Nazir', 'Négrete', 'Anne-Sophie', '😀 Tom', 'Sam_92'])
    assert.equal(ev(`jeuPseudoOk(${JSON.stringify(p)})`), true, p);
  for (const p of ['connard', 'C0nn4rd', 'pute', 'Pd', 'fdp du 93', 'S4lope', 'bite', 'nique ta', 'Hitler88', 'FUCK', 'sale con', 'Nègre', 'n1gga', 'enculé', 'ntm'])
    assert.equal(ev(`jeuPseudoOk(${JSON.stringify(p)})`), false, p);
});

test('le barème du serveur : 100 à 210 points par manche trouvée entre amis, 160 au plus seul ; une partie ne compte qu’une fois', () => {
  const score = sql.slice(sql.lastIndexOf('create or replace function public.jeu_score'));
  assert.match(score, /v_pts < v_ok \* 100 or v_pts > v_ok \* \(case when v_solo then 160 else 210 end\)/);
  assert.match(score, /v_n not between 1 and 5/);
  assert.match(score, /on conflict do nothing;\n  if found then/);
  assert.ok(app.includes('const JEU_PTS_OK=100,JEU_PTS_RANG=[50,30,15],JEU_PTS_VITE=60;'), 'le barème de l’appli : 100 + 50 + 60 = 210, seul 100 + 60 = 160');
  for (const f of ['jeu_score', 'jeu_renommer', 'jeu_classement', 'jeu_signaler', 'jeu_oublier'])
    assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\(`), f);
  for (const t of ['jeu_joueur', 'jeu_partie', 'jeu_signalement']) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`), t);
  assert.match(sql, /revoke all on table public\.jeu_joueur, public\.jeu_partie, public\.jeu_signalement from anon, authenticated;/);
  assert.match(sql, /encode\(extensions\.digest\(p_cle, 'sha256'\), 'hex'\)/, 'la base ne garde que l’empreinte de la clé');
  assert.match(sql, /if \(select count\(\*\) from public\.jeu_signalement where joueur = p_joueur\) >= 3 then\n    update public\.jeu_joueur set masque = true/);
});

test('une partie terminée part au classement, une seule fois, et attend le réseau si besoin', async () => {
  const c = makeCls({ reply: fn => fn === 'jeu_score' ? [true, { id: '11111111-2222-4333-8444-555555555555', pts: 204, parties: 1, rang: 3 }] : [true, { top: [], moi: null, total: 0 }] });
  c.ev("clsEnvoyer({u:'ABCDEF1234',pts:204,n:1,ok:1,solo:0,niv:'f'})");
  await flush(); await flush();
  const sc = c.calls.find(x => x.fn === 'jeu_score');
  assert.equal(sc.body.p_cle, 'R'.repeat(32), 'la clé de l’appareil, tirée au hasard');
  assert.equal(sc.body.p_pseudo, 'Elisa');
  assert.deepEqual(sc.body.p_partie, { u: 'ABCDEF1234', pts: 204, n: 1, ok: 1, solo: 0, niv: 'f' });
  assert.equal(sc.apikey, 'sb_publishable_test', 'la clé publique seulement');
  assert.equal(c.salle().cle, 'R'.repeat(32), 'gardée dans la progression (exportée avec elle)');
  assert.equal((c.salle().envoi || []).length, 0, 'plus rien en attente');
  assert.equal(c.salle().clsId, '11111111-2222-4333-8444-555555555555');
  assert.ok(c.calls.some(x => x.fn === 'jeu_classement'), 'puis le classement est relu');
  /* Hors connexion : la partie attend */
  const off = makeCls();
  off.ctx.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  off.ev("clsEnvoyer({u:'ZZZZZZ1111',pts:100,n:1,ok:1,solo:1,niv:'m'})"); await flush(); await flush();
  assert.equal(off.salle().envoi.length, 1, 'elle repartira');
  /* Pseudo refusé par le filtre : rien n’est envoyé, le message le dit */
  const bad = makeCls({ nom: 'Connard' });
  bad.ev("clsEnvoyer({u:'YYYYYY1111',pts:100,n:1,ok:1,solo:1,niv:'m'})"); await flush();
  assert.equal(bad.calls.length, 0);
  assert.equal(bad.salle().clsRefus, 'Connard');
  bad.ev("CLS.data={top:[{id:'a',pseudo:'Léa',pts:10,parties:1,rang:1}],moi:null,total:1}");
  assert.match(bad.ev('clsTopHTML()'), /Ton pseudo « Connard » n’est pas accepté au classement : change-le dans Mon compte/);
  /* Une partie hors barème refusée par le serveur ne repart pas */
  const inv = makeCls({ reply: fn => fn === 'jeu_score' ? [false, { message: 'partie invalide' }] : [true, { top: [], total: 0 }] });
  inv.ev("clsEnvoyer({u:'XXXXXX1111',pts:999,n:1,ok:1,solo:1,niv:'f'})"); await flush(); await flush();
  assert.equal((inv.salle().envoi || []).length, 0);
  /* Ne plus apparaître : rien ne part */
  const out = makeCls({ salle: { horsCls: 1 } });
  out.ev("clsEnvoyer({u:'WWWWWW1111',pts:100,n:1,ok:1,solo:1,niv:'f'})"); await flush();
  assert.equal(out.calls.length, 0);
  assert.ok(app.includes("if(typeof clsEnvoyer==='function'&&played.length)clsEnvoyer({u:jeuRand(10),pts,n:Math.min(5,played.length),ok:mine.length,solo:J.solo?1:0,niv:k});"), 'jeuCreditGame envoie chaque partie');
});

test('le Top 5 : médailles, ta ligne, ta place si tu n’y es pas, signaler, et les états (chargement, hors ligne, absent)', async () => {
  const top = [1, 2, 3, 4, 5, 6, 7].map(i => ({ id: `0000000${i}-0000-4000-8000-00000000000${i}`, pseudo: 'Joueur' + i, pts: 1000 - i * 100, parties: i, rang: i }));
  const c = makeCls({ salle: { cle: 'K'.repeat(32), clsId: top[1].id } });
  assert.match(c.ev('clsTopHTML()'), /perf-top-list is-wait/, 'chargement : des lignes qui attendent');
  c.ev(`CLS.data=${JSON.stringify({ top, moi: { id: top[1].id, pts: 800, parties: 2, rang: 2 }, total: 42 })}`);
  let h = c.ev('clsTopHTML()');
  assert.match(h, /Top 5 · tous les joueurs/);
  assert.equal((h.match(/<li /g) || []).length, 5, 'cinq lignes');
  assert.ok(h.includes('<span class="perf-top-rk"><svg data-k="medal1"></svg></span>') && h.includes('<span class="perf-top-rk">4</span>'), 'médailles puis numéros');
  assert.ok(h.includes('<li class="is-me is-r2"') && h.includes('Joueur2 <small>(toi)</small>'), 'ta ligne');
  assert.equal((h.match(/class="perf-top-flag"/g) || []).length, 4, '« Signaler » sur les autres lignes seulement');
  assert.ok(h.includes('42 joueurs classés.') && h.includes('onclick="clsQuitter()">Ne plus apparaître</button>'));
  /* Hors du Top 5 : ta place dessous */
  c.ev(`CLS.data.moi={id:'99999999-0000-4000-8000-000000000000',pts:120,parties:1,rang:37}`);
  assert.ok(c.ev('clsTopHTML()').includes('<p class="perf-top-me"><b>Toi : 37<sup>e</sup></b> sur 42 · 120 points</p>'));
  /* Signaler : le joueur disparaît de ton classement tout de suite, le serveur est prévenu */
  c.ev(`clsSignaler('${top[0].id}')`); await flush(); await flush();
  assert.match(c.asks[0].titre, /Signaler « Joueur1 » \?/);
  assert.deepEqual(Array.from(c.salle().masques), [top[0].id]);
  h = c.ev('clsTopHTML()');
  assert.ok(!h.includes('Joueur1<') && h.includes('Joueur6'), 'masqué pour toi, le suivant remonte');
  const sig = c.calls.find(x => x.fn === 'jeu_signaler');
  assert.deepEqual(sig.body, { p_cle: 'K'.repeat(32), p_joueur: top[0].id });
  /* Hors ligne, puis absent du classement */
  c.ev("CLS.data=null;CLS.err='net'");
  assert.match(c.ev('clsTopHTML()'), /il faut une connexion internet[\s\S]*onclick="clsCharger\(true\)">Réessayer/);
  c.ev('clsQuitter()'); await flush(); await flush();
  assert.equal(c.salle().horsCls, 1);
  assert.ok(c.calls.some(x => x.fn === 'jeu_oublier' && x.body.p_cle === 'K'.repeat(32)), 'ses scores sont effacés du serveur');
  assert.match(c.ev('clsTopHTML()'), /Tu n’apparais pas au classement général[\s\S]*Y apparaître avec mon pseudo/);
  c.ev('clsQuitter()');
  assert.equal(c.salle().horsCls, undefined, 'et on peut y revenir');
  /* Personne encore */
  c.ev('CLS.data={top:[],moi:null,total:0}');
  assert.match(c.ev('clsTopHTML()'), /Personne n’est encore classé/);
});

test('la progression garde ce qu’il faut au classement, et Mon compte permet de retirer ses scores', () => {
  const ns = app.slice(app.indexOf('function normalizeState(raw){'), app.indexOf('function normalize(', app.indexOf('function normalizeState(raw){')));
  for (const k of ['salle.cle=salleSrc.cle', 'salle.clsId=salleSrc.clsId', 'salle.horsCls=1', 'salle.masques=m', 'salle.envoi=q', 'salle.clsRefus=r'])
    assert.ok(ns.includes(k), k);
  assert.ok(app.includes('<b>${clsOn()?\'Retirer mes scores du classement\':\'Revenir au classement général\'}</b>'), 'Mon compte › Données');
  assert.ok(app.includes("if(typeof clsRenommer==='function')clsRenommer();"), 'un nouveau pseudo suit au classement');
  assert.ok(app.includes("if(cle&&typeof clsRpc==='function')clsRpc('jeu_oublier',{p_cle:cle})"), 'effacer la progression efface aussi les scores du classement');
  assert.ok(app.includes('<div class="perf-block perf-top" id="perf-top">${clsTopHTML()}</div>'), 'le Top 5 dans « Tes performances »');
});
