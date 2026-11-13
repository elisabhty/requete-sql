/* Retours d’Elisa, 31 octobre, 15 h 52 (quatre captures) : réf. 1 les pastilles de la salle d’attente (un chrono qui part de 0, pas
   « 3 min max par manche ») dans la DA du site, réf. 2 « En attente d’un joueur », réf. 3 « Clore la manche » et « Les autres joueurs
   ont quitté la salle » dans la DA, le tirage qui évite les défis déjà réussis (voir salle-defis.test.mjs), le passage fluide du tirage
   à la manche, le nombre de défis réussis par joueur (statistiques Supabase), une notification animée des points gagnés, et réf. 4
   « Voir la leçon » en pastille avec une flèche animée. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const s49 = css.slice(css.indexOf('/* ---------- 49. Retours du 31 octobre, 15 h 52'));
const priv = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const dir = new URL('../supabase/migrations/', import.meta.url);
const sql = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
const flush = () => new Promise(r => setImmediate(r));

test('réf. 1 — la salle d’attente : le niveau et ses barres, les manches, « 10, 15 ou 20 min par manche » selon le niveau (8 novembre, 8 h 52), en autocollants', () => {
  assert.ok(!app.includes('3 min max par manche'), 'plus de « 3 min max par manche »');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes('<ul class="jeu-chips" aria-label="La partie"><li class="jeu-chip is-${J.niv}" style="--i:0">${jeuNivBars(J.niv)}${JEU_NIVL[J.niv]}</li>'));
  assert.ok(r.includes("${lqStkSvg('cards')}${J.nb} manche${J.nb>1?'s':''}</li>") && r.includes("${lqStkSvg('clock')}${jeuDureeMs(J.niv)/60000}\\u00a0min par manche</li></ul>") && !r.includes('Chrono dès 00:00'));
  assert.ok(app.includes('function jeuNivBars(k){return `<i class="jeu-bars is-${k}" aria-hidden="true"><b></b><b></b><b></b></i>`;}'));
  assert.ok(app.includes('function jeuDrawnHTML(c){return `<div class="jeu-drawn" id="jeu-drawn" role="status" aria-live="polite" hidden><span class="jeu-chip is-${c.niv}">${jeuNivBars(c.niv)}${JEU_NIVL[c.niv]}</span>') && r.includes('${jeuDrawnHTML(c)}'), 'le défi tiré garde la même pastille de niveau');
  for (const k of ['html.lq .jeu-chip{display:inline-flex;align-items:center;gap:7px;min-height:36px;', 'box-shadow:0 3px 0 var(--lip);font:700 14px/1 var(--display)!important',
    '@keyframes jeuChipIn', 'html.lq .jeu-bars.is-f b:nth-child(1){background:var(--accent)}', 'html.lq .jeu-bars.is-m b:nth-child(-n+2){background:#B45309}', 'html.lq .jeu-bars.is-d b{background:#C2323A}'])
    assert.ok(s49.includes(k), k);
});

test('réf. 2 et 3 — « En attente d’un joueur », des boutons secondaires et des cartes d’annonce dans la DA', () => {
  assert.ok(app.includes('<span>En attente d’un joueur…</span></li>') && !app.includes('En attente d’un ami'));
  const net = cut('function jeuNoteHTML(', '\nfunction jeuLobbyLabel(){');
  assert.ok(net.includes("jeuNoteHTML('is-off',JEU_ICO.wifi,'Connexion perdue','La partie reprend dès que le réseau revient.')"));
  /* 16 h 29 : seul dans la salle, tout se dessine comme seul : plus d’annonce « seul·e dans la salle » (retours-1629.test.mjs) */
  assert.ok(!net.includes('seul·e dans la salle'));
  assert.ok(net.includes('<div class="jeu-net ${cls}" role="status"><span class="jeu-net-ico" aria-hidden="true">${ico}</span><span class="jeu-net-tx"><b>${titre}</b><small>${texte}</small></span></div>'));
  assert.ok(!app.includes('📡 Connexion perdue'), 'plus de bandeau à émoji');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  /* 9 novembre, 10 h 37 : la fin d’une partie seule dit « Retour aux défis » (jeuFinBoutonsHTML), plus « Changer de niveau » ;
     13 novembre, 21 h 52 : dans une salle, même seule, « Quitter la salle » est celui de la carte de la revanche */
  assert.ok(cut('function jeuFinBoutonsHTML(', '\n}\n').includes("jeuBtn2('classement','Voir mon classement','jeuVersClassement()')+'</div>'") && app.includes('<button type="button" class="jeu-close jeu-rv-quit" onclick="jeuQuitterSalle()">${JEU_ICO.quit}<span>Quitter la salle</span></button>'));   // le podium : jeuRevancheHTML (13 novembre, 21 h 15)
  assert.ok(!/class="jeu-close" onclick="[^"]+">[A-Z]/.test(r), 'chaque bouton du bas a son pictogramme');
  const ctx = vm.createContext({});
  vm.runInContext(cut('const JEU_ICO={', '\nfunction jeuRedraw(){'), ctx);
  const b = vm.runInContext("jeuBtn2('quit','Quitter la salle','goBack()')", ctx);
  assert.match(b, /^<button type="button" class="jeu-close" onclick="goBack\(\)"><svg viewBox="0 0 24 24" aria-hidden="true">.+<\/svg><span>Quitter la salle<\/span><\/button>$/);
  for (const k of ['html.lq .jeu-close{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;', 'text-decoration:none!important;box-shadow:0 4px 0 var(--lip)',
    'html.lq .jeu-close:active{transform:translateY(4px);box-shadow:0 0 0 var(--lip)}', 'html.lq #jeu-hostbar .jeu-close svg{color:var(--danger-fill)}',
    'html.lq .jeu-net{display:flex;align-items:center;gap:10px;', 'html.lq .jeu-net.is-off{border-color:#FFE08A;', '@keyframes jeuNoteIn'])
    assert.ok(s49.includes(k), k);
});

test('du tirage à la manche : 3, 2, 1 plus courts, puis un fondu enchaîné (la scène s’efface, la manche arrive en cascade dessous)', () => {
  assert.ok(app.includes('const JEU_DRAW_STEP=700;'));
  assert.ok(app.includes('const JEU_DRAW_MS='), 'le début du chrono, le même chez tous, ne change pas');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(app.includes('J.drawT=[1,2,3].map(k=>setTimeout(()=>jeuDrawStep(n),wait(k*JEU_DRAW_STEP)+10));') && r.includes('jeuDrawTimers(n);'));
  assert.ok(r.includes("ghost=old.cloneNode(true);ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));"), 'une copie de la scène, sans identifiants en double');
  assert.ok(r.includes("if(fromDraw&&!prefersReduceMotion()&&root.getBoundingClientRect){"), 'pas de fondu en mouvement réduit');
  assert.ok(r.includes("if(ghost){root.appendChild(ghost);setTimeout(()=>{if(ghost.parentNode)ghost.parentNode.removeChild(ghost);},560);}"));
  assert.ok(r.includes("const fromDraw=/^draw/.test(J.view||'')&&v==='play'+J.view.slice(4);"));
  /* 8 novembre, 23 h 44 : l’ancre de la barre collée du chrono (sans hauteur, en tête) ne compte pas dans la cascade (retours-2344) */
  assert.ok(r.includes("if(fromDraw&&root.children){Array.from(root.children).filter(el=>!(el.classList&&el.classList.contains('jeu-collee-ancre'))).forEach((el,i)=>{if(el.style)el.style.setProperty('--k',Math.min(i,7));});root.classList.add('jeu-cascade');}"));
  /* La cascade en vrai : un tirage puis la manche, avec de faux éléments */
  const kids = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => ({ style: { props: {}, setProperty(k, v) { this.props[k] = v; } } }));
  const cls = new Set();
  const root = { innerHTML: '', children: kids, offsetWidth: 0, classList: { add: (...a) => a.forEach(x => cls.add(x)), remove: (...a) => a.forEach(x => cls.delete(x)) } };
  for (const k of ['.jeu.jeu-cascade>*{animation:jeuCascade .5s cubic-bezier(.2,.8,.3,1.1) backwards;animation-delay:calc(.1s + var(--k,0) * 60ms)}', '.jeu.jeu-cascade>h1{animation-name:jeuCascadeTitle}', '.jeu>.jeu-ghost,.jeu.jeu-cascade>.jeu-ghost{animation:jeuGhost .46s', '@keyframes jeuGhost{0%{opacity:1;transform:none}65%{opacity:0;', '.jeu{position:relative}'])
    assert.ok(s49.includes(k), k);
  const tail = r.slice(r.indexOf('  root.innerHTML=html;'), r.indexOf("  if(edOn&&document.getElementById('ed-lesson')){"));
  assert.ok(tail.length > 50 && !tail.includes('edOn'), 'la fin du dessin localisée');
  const ctx = vm.createContext({ root, html: '<x>', keep: false, fromDraw: true, ghost: null, setTimeout, v: 'play0', J: {} });
  vm.runInContext(tail, ctx);
  assert.ok(cls.has('jeu-cascade') && !cls.has('jeu-in'));
  assert.deepEqual(kids.map(k => k.style.props['--k']), [0, 1, 2, 3, 4, 5, 6, 7, 7]);
  cls.clear(); vm.runInContext('fromDraw=false;' + tail, ctx);
  assert.ok(cls.has('jeu-in') && !cls.has('jeu-cascade'), 'les autres écrans : l’arrivée habituelle');
});

test('les points gagnés : une page en fin de partie (11 novembre, 21 h 33), plus de pastille à la manche', () => {
  const pop = cut('function jeuPtsPage(o){', '\n/* Points de la partie (une seule fois)');
  assert.ok(pop.includes("if(!o||!(o.pts>0||o.issue)||typeof document==='undefined'||typeof document.createElement!=='function'"), 'rien sans points (seul) ni sans page ; entre amis, toutes les issues (13 novembre, 17 h 31)');
  assert.ok(pop.includes("<span class=\"mu-tag\">${enc?(issue==='rate'?'Courage\\u00a0!':M?'La suite\\u00a0!':'Revanche\\u00a0!'):zero?'0 point':`+${fmt(o.pts)} point${pl}`}</span>") && !pop.includes('mu-go-l'), 'la pièce, « +12 points » ; plus de bouton, le compte à rebours (18 h 48)');
  assert.ok(pop.includes('<b class="mu-album-n"><span>${fmt(Math.max(0,total-o.pts))}</span><span>${fmt(total)}</span></b>'), 'le total roule de l’ancien au nouveau');
  assert.ok(pop.includes("if(typeof lqSay==='function')lqSay(`${issue?h.replace(/\\u00a0/g,' ')+' ':''}${zero?'0 point':`+${o.pts} point${pl}`}`"), 'le lecteur d’écran entend le résultat (et l’issue entre amis)');
  assert.ok(!app.includes('function jeuPtsPop('), 'plus de pastille');
  const run = cut('function jeuRun(){', '\nfunction jeuStop(){');
  assert.ok(run.includes("{const x=jeuRanking(n).find(y=>y.pid===J.me);if(x&&x.pts>0&&typeof lqSay==='function')lqSay(`+${x.pts} points`);}"), 'à la manche, la carte « Trouvé » les montre ; le lecteur d’écran les dit');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("const cg=jeuCreditGame();") && r.includes("if(seul&&cg)jeuVoiler(J,()=>ptsPage(Object.assign(cg.pts>0?{pts:cg.pts,solo:!!J.solo}:{pts:0,solo:!!J.solo,issue:'rate',nb:jouees},{apres:jeuVoileLever}),0));"));
  assert.ok(app.includes('    return {pts,total:s.pts};\n  }catch(e){return null;}'), 'la partie créditée une seule fois renvoie ses points');
  /* Le compteur sait partir d’un nombre et écrire « 1 274 » */
  const cu = cut('function jeuCountUp(el){', '\n/* Les points d’une partie');
  const frames = [];
  let t = 0;
  const el = { dataset: { n: '1274', from: '1100', fmt: 'fr' }, textContent: '1 100', isConnected: true };
  const ctx = vm.createContext({ prefersReduceMotion: () => false, performance: { now: () => t }, requestAnimationFrame: f => frames.push(f) });
  vm.runInContext(cu, ctx);
  ctx.el = el; vm.runInContext('jeuCountUp(el)', ctx);
  assert.equal(el.textContent, (1100).toLocaleString('fr-FR'));
  while (frames.length) { t += 100; frames.shift()(t); }
  assert.equal(el.textContent, (1274).toLocaleString('fr-FR'));
  for (const k of ['#jeu-pts-pop{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 12px);z-index:9991;', 'border-radius:999px;background:#fff;border:2px solid var(--line);box-shadow:0 4px 0 var(--lip)',
    '#jeu-pts-pop.on{transform:translate(-50%,0);opacity:1}', '#jeu-pts-pop.on .jpp-coin svg{animation:jppCoin', '@keyframes jppCoin{0%{transform:scale(.4) rotateY(180deg)}'])
    assert.ok(s49.includes(k), k);
  assert.ok(!s49.includes('.jpp-ring') && !s49.includes('.jpp-sp') && !s49.includes('.jpp-pd'));
  assert.ok(s49.includes('#jeu-pts-pop,#jeu-pts-pop *,.collectible.lock .memo-go>svg{animation:none!important}'), 'mouvement réduit');
});

test('réf. 4 — 10 novembre (« ne plus mettre voir les leçons sur les cartes ») : la carte à débloquer n’a plus sa pastille', () => {
  assert.ok(!app.includes('Voir la leçon${MEMO_GO_SVG}') && !app.includes('MEMO_GO_SVG') && !css.includes('.mc-go'));
  assert.ok(app.includes('<span class="mc-lesson" style="--kn:${memoKn(l.titre)}">${esc(l.titre)}</span></span></button>`;'), 'le nom de la leçon, en bas ; toute la carte ouvre la leçon');
});

/* Le nombre de défis réussis par joueur, pour savoir quand en ajouter. */
function makeCls({ salle = {}, defis = {}, reply } = {}) {
  const calls = [];
  const block = app.slice(app.indexOf('/* ---------- Classement général : le Top 5 de tous les joueurs'), app.indexOf('function renderDefisPerf(){'));
  const CHALLENGES = [{ id: 'c1', niv: 'f' }, { id: 'c2', niv: 'f' }, { id: 'c3', niv: 'm' }, { id: 'c4', niv: 'm' }, { id: 'c5', niv: 'd' }];
  const ctx = vm.createContext({
    state: { salle: JSON.parse(JSON.stringify(salle)), defis }, CHALLENGES, Date, Math, JSON, Array, Set, Object, String, Number, Promise, setTimeout,
    JEU_SB: 'https://exemple.supabase.co', JEU_SB_KEY: 'sb_publishable_test',
    save() {}, jeuRand: n => 'R'.repeat(n), jeuSavedNom: () => 'Elisa', lqStkSvg: () => '', esc: s => String(s), escAttr: s => String(s),
    document: { getElementById: () => null },
    fetch: (url, opt) => {
      const fn = url.split('/rpc/')[1], body = JSON.parse(opt.body);
      calls.push({ fn, body });
      const [ok, json] = reply ? reply(fn, body) : [true, { ok: true }];
      return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(json) });
    },
  });
  vm.runInContext(block, ctx);
  return { ev: code => vm.runInContext(code, ctx), calls, ctx };
}

test('les défis réussis suivent le classement, seulement quand ils changent, jamais hors classement', async () => {
  const id = '11111111-2222-4333-8444-555555555555';
  /* Pas encore au classement (aucune partie) : rien ne part */
  let c = makeCls({ defis: { c1: true } });
  c.ev('clsDefis()'); await flush();
  assert.equal(c.calls.length, 0);
  /* Hors classement : rien ne part */
  c = makeCls({ salle: { clsId: id, horsCls: 1, cle: 'K'.repeat(32) }, defis: { c1: true } });
  c.ev('clsDefis()'); await flush();
  assert.equal(c.calls.length, 0);
  /* Au classement : la liste et, par niveau, réussis / défis de l’appli */
  c = makeCls({ salle: { clsId: id, cle: 'K'.repeat(32) }, defis: { c1: true, c3: true, c9: true, c4: false } });
  c.ev('clsDefis()'); await flush(); await flush();
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].fn, 'jeu_defis_v2');
  assert.deepEqual(c.calls[0].body, { p_cle: 'K'.repeat(32), p_defis: ['c1', 'c3'], p_niv: { f: [1, 2], m: [1, 2], d: [0, 1] } }, 'seulement les défis de l’appli, réussis');
  assert.equal(c.ctx.state.salle.defisEnv, 'c1,c3|5');
  c.ev('clsDefis()'); await flush();
  assert.equal(c.calls.length, 1, 'rien de nouveau : rien ne repart');
  c.ev("state.defis.c5=true;clsDefis()"); await flush(); await flush();
  assert.equal(c.calls.length, 2);
  assert.deepEqual(c.calls[1].body.p_defis, ['c1', 'c3', 'c5']);
  /* Une partie envoyée au classement : la liste suit */
  c = makeCls({ salle: { cle: 'K'.repeat(32) }, defis: { c2: true }, reply: fn => fn === 'jeu_score_v2' ? [true, { id, pts: 160, parties: 1, rang: 1 }] : fn === 'jeu_defis_v2' ? [true, { ok: true, n: 1 }] : [true, { top: [], moi: null, total: 0 }] });
  c.ev("clsEnvoyer({u:'ABCDEF1234',salle:'ABCDEF',g:0})");
  for (let k = 0; k < 6; k++) await flush();
  assert.deepEqual(c.calls.map(x => x.fn).filter(f => f !== 'jeu_classement'), ['jeu_score_v2', 'jeu_defis_v2']);
  /* Le serveur ne connaît pas (encore) le joueur : on réessaiera plus tard */
  c = makeCls({ salle: { clsId: id, cle: 'K'.repeat(32) }, defis: { c1: true }, reply: () => [true, { ok: false, n: 1 }] });
  c.ev('clsDefis()'); await flush(); await flush();
  assert.equal(c.ctx.state.salle.defisEnv, undefined);
  /* « Retirer mes scores » oublie ce qui a été envoyé */
  assert.ok(app.includes('s.horsCls=1;s.envoi=[];delete s.clsId;delete s.defisEnv;save();'));
  assert.ok(app.includes("if(typeof salleSrc.defisEnv==='string'&&salleSrc.defisEnv.length<=4000)salle.defisEnv=salleSrc.defisEnv;"), 'gardé dans la progression');
  assert.ok(app.includes("state.defis[current.id]=true; noteActivityDay(); save(); renderDefis(); renderProgress(); renderPlanning();\n      if(typeof clsDefis==='function')clsDefis();"), 'un défi réussi en entraînement libre');
  assert.ok(app.includes("clsFlush();if(typeof clsDefis==='function')clsDefis();"), 'à l’ouverture des stats des Défis');
});

test('la base : jeu_defis ne crée personne, vérifie ce qu’elle reçoit ; trois vues pour toi, fermées à l’appli', () => {
  const f = sql.slice(sql.lastIndexOf('create or replace function public.jeu_defis'));
  assert.match(f, /security definer\nset search_path = ''/);
  assert.match(f, /jsonb_array_length\(p_defis\) > 500/);
  assert.match(f, /where t\.x ~ '\^\[A-Za-z0-9_-\]\{1,24\}\$';/);
  assert.match(f, /update public\.jeu_joueur\n  set defis = v_ids, defis_niv = nullif\(v_niv, '\{\}'::jsonb\), defis_maj = now\(\)\n  where cle = v_cle/);
  assert.doesNotMatch(f.slice(0, f.indexOf('$$;')), /insert into/, 'aucun joueur créé');
  assert.match(sql, /grant execute on function public\.jeu_defis\(text, jsonb, jsonb\) to anon, authenticated;/);
  for (const v of ['stats_defis_joueurs', 'stats_defis_resume', 'stats_defis_par_defi'])
    assert.match(sql, new RegExp(`create or replace view public\\.${v} with \\(security_invoker = true\\) as`), v);
  assert.match(sql, /revoke all on public\.stats_defis_joueurs, public\.stats_defis_resume, public\.stats_defis_par_defi from anon, authenticated;/);
  assert.match(sql, /count\(\*\) filter \(where total > 0 and n >= total\) as ont_tout_fini/);
  /* Dit dans les textes de confidentialité (site et appli) */
  /* 17 h 53 : un défi se rejoue, on ne parle plus de défis « réussis » */
  /* 6 novembre, 15 h 20 : le serveur garde aussi les défis joués, pour ne plus les tirer (retours-1520-pratiquer) */
  assert.ok(priv.includes('La liste des défis que tu as déjà joués et trouvés l’accompagne (jamais tes requêtes)&nbsp;: elle n’est montrée à personne et nous sert seulement à ne plus te les tirer au sort, à toi comme à ceux qui jouent avec toi,'));
  assert.equal(app.split('La liste des défis que tu as déjà joués et trouvés l’accompagne, sans être montrée à personne&nbsp;: elle évite de te les tirer au sort à nouveau, à toi comme à ceux qui jouent avec toi,').length - 1, 2);
});
