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

test('réf. 1 — la salle d’attente : le niveau et ses barres, les manches, « Chrono dès 00:00 », en autocollants', () => {
  assert.ok(!app.includes('3 min max par manche'), 'plus de « 3 min max par manche »');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes('<ul class="jeu-chips" aria-label="La partie"><li class="jeu-chip is-${J.niv}" style="--i:0">${jeuNivBars(J.niv)}${JEU_NIVL[J.niv]}</li>'));
  assert.ok(r.includes("${lqStkSvg('cards')}${J.nb} manche${J.nb>1?'s':''}</li>") && r.includes("${lqStkSvg('clock')}Chrono dès 00:00</li></ul>"));
  assert.ok(app.includes('function jeuNivBars(k){return `<i class="jeu-bars is-${k}" aria-hidden="true"><b></b><b></b><b></b></i>`;}'));
  assert.ok(r.includes('<span class="jeu-chip is-${c.niv}">${jeuNivBars(c.niv)}${JEU_NIVL[c.niv]}</span>'), 'le défi tiré garde la même pastille de niveau');
  for (const k of ['html.lq .jeu-chip{display:inline-flex;align-items:center;gap:7px;min-height:36px;', 'box-shadow:0 3px 0 var(--lip);font:700 14px/1 var(--display)!important',
    '@keyframes jeuChipIn', 'html.lq .jeu-bars.is-f b:nth-child(1){background:#169447}', 'html.lq .jeu-bars.is-m b:nth-child(-n+2){background:#E0A100}', 'html.lq .jeu-bars.is-d b{background:var(--danger-fill)}'])
    assert.ok(s49.includes(k), k);
});

test('réf. 2 et 3 — « En attente d’un joueur », des boutons secondaires et des cartes d’annonce dans la DA', () => {
  assert.ok(app.includes('<span>En attente d’un joueur…</span></li>') && !app.includes('En attente d’un ami'));
  const net = cut('function jeuNoteHTML(', '\nfunction jeuLobbyLabel(){');
  assert.ok(net.includes("jeuNoteHTML('is-off',JEU_ICO.wifi,'Connexion perdue','La partie reprendra dès que le réseau revient.')"));
  assert.ok(net.includes("jeuNoteHTML('is-soft',lqStkSvg('user'),'Tu es seul·e dans la salle','Les autres joueurs ont quitté la salle : tu peux continuer seul·e.')"));
  assert.ok(net.includes('<div class="jeu-net ${cls}" role="status"><span class="jeu-net-ico" aria-hidden="true">${ico}</span><span class="jeu-net-tx"><b>${titre}</b><small>${texte}</small></span></div>'));
  assert.ok(!app.includes('📡 Connexion perdue'), 'plus de bandeau à émoji');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("${jeuBtn2('level','Changer de niveau','openJeu()')}") && r.includes("${jeuBtn2('quit','Quitter la salle','goBack()')}"));
  assert.ok(!/class="jeu-close" onclick="[^"]+">[A-Z]/.test(r), 'chaque bouton du bas a son pictogramme');
  const ctx = vm.createContext({});
  vm.runInContext(cut('const JEU_ICO={', '\nfunction jeuHostBarHTML(){'), ctx);
  const b = vm.runInContext("jeuBtn2('flag','Clore la manche pour tous','jeuClose()')", ctx);
  assert.match(b, /^<button type="button" class="jeu-close" onclick="jeuClose\(\)"><svg viewBox="0 0 24 24" aria-hidden="true">.+<\/svg><span>Clore la manche pour tous<\/span><\/button>$/);
  for (const k of ['html.lq .jeu-close{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;', 'text-decoration:none!important;box-shadow:0 4px 0 var(--lip)',
    'html.lq .jeu-close:active{transform:translateY(4px);box-shadow:0 0 0 var(--lip)}', 'html.lq #jeu-hostbar .jeu-close svg{color:var(--danger-fill)}',
    'html.lq .jeu-net{display:flex;align-items:center;gap:12px;', 'html.lq .jeu-net.is-off{border-color:#FFE08A;', '@keyframes jeuNoteIn'])
    assert.ok(s49.includes(k), k);
});

test('du tirage à la manche : 3, 2, 1 plus courts, puis un fondu enchaîné (la scène s’efface, la manche arrive en cascade dessous)', () => {
  assert.ok(app.includes('const JEU_DRAW_STEP=700;'));
  assert.ok(app.includes('const JEU_DRAW_MS='), 'le début du chrono, le même chez tous, ne change pas');
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes('J.drawT=[1,2,3].map(k=>setTimeout(()=>jeuDrawStep(n),wait(k*JEU_DRAW_STEP)+10));'));
  assert.ok(r.includes("ghost=old.cloneNode(true);ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));"), 'une copie de la scène, sans identifiants en double');
  assert.ok(r.includes("if(fromDraw&&!prefersReduceMotion()&&root.getBoundingClientRect){"), 'pas de fondu en mouvement réduit');
  assert.ok(r.includes("if(ghost){root.appendChild(ghost);setTimeout(()=>{if(ghost.parentNode)ghost.parentNode.removeChild(ghost);},560);}"));
  assert.ok(r.includes("const fromDraw=/^draw/.test(J.view||'')&&v==='play'+J.view.slice(4);"));
  assert.ok(r.includes("if(fromDraw&&root.children){Array.from(root.children).forEach((el,i)=>{if(el.style)el.style.setProperty('--k',Math.min(i,7));});root.classList.add('jeu-cascade');}"));
  /* La cascade en vrai : un tirage puis la manche, avec de faux éléments */
  const kids = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => ({ style: { props: {}, setProperty(k, v) { this.props[k] = v; } } }));
  const cls = new Set();
  const root = { innerHTML: '', children: kids, offsetWidth: 0, classList: { add: (...a) => a.forEach(x => cls.add(x)), remove: (...a) => a.forEach(x => cls.delete(x)) } };
  for (const k of ['.jeu.jeu-cascade>*{animation:jeuCascade .5s cubic-bezier(.2,.8,.3,1.1) backwards;animation-delay:calc(.1s + var(--k,0) * 60ms)}', '.jeu.jeu-cascade>h1{animation-name:jeuCascadeTitle}', '.jeu>.jeu-ghost,.jeu.jeu-cascade>.jeu-ghost{animation:jeuGhost .46s', '@keyframes jeuGhost{0%{opacity:1;transform:none}65%{opacity:0;', '.jeu{position:relative}'])
    assert.ok(s49.includes(k), k);
  const tail = r.slice(r.indexOf('  root.innerHTML=html;'), r.indexOf("  if(v.startsWith('play')&&document.getElementById('ed-lesson')){"));
  const ctx = vm.createContext({ root, html: '<x>', keep: false, fromDraw: true, ghost: null, setTimeout });
  vm.runInContext(tail, ctx);
  assert.ok(cls.has('jeu-cascade') && !cls.has('jeu-in'));
  assert.deepEqual(kids.map(k => k.style.props['--k']), [0, 1, 2, 3, 4, 5, 6, 7, 7]);
  cls.clear(); vm.runInContext('fromDraw=false;' + tail, ctx);
  assert.ok(cls.has('jeu-in') && !cls.has('jeu-cascade'), 'les autres écrans : l’arrivée habituelle');
});

test('les points gagnés en notification animée : à la manche trouvée et en fin de partie', () => {
  const pop = cut('function jeuPtsPop(o){', '\n/* Points de la partie (une seule fois)');
  assert.ok(pop.includes("if(!o||!(o.pts>0)||typeof document==='undefined'||typeof document.createElement!=='function'"), 'rien sans points ni sans page');
  assert.ok(pop.includes('<span class="jpp-coin"><i class="jpp-ring"></i>${JEU_COIN_SVG}${\'<i class="jpp-sp"></i>\'.repeat(6)}</span>'));
  assert.ok(pop.includes('<i style="--j:0">${d.ok} réussite</i>') && pop.includes('<i class="is-vite" style="--j:2">+${d.vite} rapidité</i>'));
  assert.ok(pop.includes('Total de salle : <b data-n="${o.total}" data-from="${Math.max(0,o.total-o.pts)}" data-fmt="fr">'), 'le total roule de l’ancien au nouveau');
  assert.ok(pop.includes("if(typeof lqSay==='function')lqSay(`+${o.pts} points`"), 'le lecteur d’écran entend le résultat');
  assert.ok(pop.includes("t.setAttribute('aria-hidden','true')"));
  assert.ok(pop.includes("const st=document.getElementById('lq-streak-toast'),low=st&&st.classList.contains('on')"), 'sous la flamme du jour si elle tombe en même temps');
  const run = cut('function jeuRun(){', '\nfunction jeuStop(){');
  assert.ok(run.includes("{const x=jeuRanking(n).find(y=>y.pid===J.me);if(x)jeuPtsPop({kind:'round',pts:x.pts,detail:x});}"));
  const r = cut('function jeuRender(){', '\nfunction jeuNextRound(){');
  assert.ok(r.includes("const cg=jeuCreditGame();") && r.includes("if(cg&&cg.pts>0)setTimeout(()=>{if(JEU===J&&J.view==='final')jeuPtsPop({kind:'game',pts:cg.pts,total:cg.total});},950);"));
  assert.ok(app.includes('    return {pts,total:s.pts};\n  }catch(e){return null;}'), 'la partie créditée une seule fois renvoie ses points');
  /* Le compteur sait partir d’un nombre et écrire « 1 274 » */
  const cu = cut('function jeuCountUp(el){', '\n/* Les points gagnés, en notification');
  const frames = [];
  let t = 0;
  const el = { dataset: { n: '1274', from: '1100', fmt: 'fr' }, textContent: '1 100', isConnected: true };
  const ctx = vm.createContext({ prefersReduceMotion: () => false, performance: { now: () => t }, requestAnimationFrame: f => frames.push(f) });
  vm.runInContext(cu, ctx);
  ctx.el = el; vm.runInContext('jeuCountUp(el)', ctx);
  assert.equal(el.textContent, (1100).toLocaleString('fr-FR'));
  while (frames.length) { t += 100; frames.shift()(t); }
  assert.equal(el.textContent, (1274).toLocaleString('fr-FR'));
  for (const k of ['#jeu-pts-pop{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 14px);z-index:9991;', '#jeu-pts-pop.on{transform:translate(-50%,0);opacity:1;animation:lqStIn .7s',
    '#jeu-pts-pop.on .jpp-coin svg{animation:jppCoin', '#jeu-pts-pop.on .jpp-ring{animation:lqStRing', '#jeu-pts-pop.on .jpp-sp{animation:lqStSpark', '#jeu-pts-pop.on .jpp-pd i{animation:jppPd'])
    assert.ok(s49.includes(k), k);
  assert.ok(s49.includes('#jeu-pts-pop,#jeu-pts-pop *,.collectible.lock .memo-go>svg{animation:none!important}'), 'mouvement réduit');
});

test('réf. 4 — « Voir la leçon » d’une carte à débloquer : une pastille et sa flèche qui avance', () => {
  assert.ok(app.includes('<span class="memo-go">Voir la leçon${MEMO_GO_SVG}</span>'));
  assert.ok(app.includes("const MEMO_GO_SVG='<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6.5 18.5 12 13 17.5\""));
  for (const k of ['.collectible.lock .memo-copy>.memo-go{align-self:flex-start;display:inline-flex;align-items:center;gap:5px;', 'border-radius:999px;',
    '.collectible.lock .memo-go>svg{flex:none;width:14px;height:14px;animation:memoGo 2.6s cubic-bezier(.4,0,.2,1) infinite;animation-delay:calc(.6s + var(--i,0) * .18s)}',
    '@keyframes memoGo{0%,40%,100%{transform:none}15%{transform:translateX(4px)}27%{transform:translateX(-1px)}}'])
    assert.ok(s49.includes(k), k);
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
  assert.equal(c.calls[0].fn, 'jeu_defis');
  assert.deepEqual(c.calls[0].body, { p_cle: 'K'.repeat(32), p_defis: ['c1', 'c3'], p_niv: { f: [1, 2], m: [1, 2], d: [0, 1] } }, 'seulement les défis de l’appli, réussis');
  assert.equal(c.ctx.state.salle.defisEnv, 'c1,c3|5');
  c.ev('clsDefis()'); await flush();
  assert.equal(c.calls.length, 1, 'rien de nouveau : rien ne repart');
  c.ev("state.defis.c5=true;clsDefis()"); await flush(); await flush();
  assert.equal(c.calls.length, 2);
  assert.deepEqual(c.calls[1].body.p_defis, ['c1', 'c3', 'c5']);
  /* Une partie envoyée au classement : la liste suit */
  c = makeCls({ salle: { cle: 'K'.repeat(32) }, defis: { c2: true }, reply: fn => fn === 'jeu_score' ? [true, { id, pts: 160, parties: 1, rang: 1 }] : fn === 'jeu_defis' ? [true, { ok: true, n: 1 }] : [true, { top: [], moi: null, total: 0 }] });
  c.ev("clsEnvoyer({u:'ABCDEF1234',pts:160,n:1,ok:1,solo:1,niv:'f'})");
  for (let k = 0; k < 6; k++) await flush();
  assert.deepEqual(c.calls.map(x => x.fn).filter(f => f !== 'jeu_classement'), ['jeu_score', 'jeu_defis']);
  /* Le serveur ne connaît pas (encore) le joueur : on réessaiera plus tard */
  c = makeCls({ salle: { clsId: id, cle: 'K'.repeat(32) }, defis: { c1: true }, reply: () => [true, { ok: false, n: 1 }] });
  c.ev('clsDefis()'); await flush(); await flush();
  assert.equal(c.ctx.state.salle.defisEnv, undefined);
  /* « Retirer mes scores » oublie ce qui a été envoyé */
  assert.ok(app.includes('s.horsCls=1;s.envoi=[];delete s.clsId;delete s.defisEnv;save();'));
  assert.ok(app.includes("if(typeof salleSrc.defisEnv==='string'&&salleSrc.defisEnv.length<=4000)salle.defisEnv=salleSrc.defisEnv;"), 'gardé dans la progression');
  assert.ok(app.includes("state.defis[current.id]=true; noteActivityDay(); save(); renderDefis(); renderProgress(); renderPlanning();\n      if(typeof clsDefis==='function')clsDefis();"), 'un défi réussi en entraînement libre');
  assert.ok(app.includes("clsFlush();clsCharger();if(typeof clsDefis==='function')clsDefis();"), 'à l’ouverture des Défis');
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
  assert.ok(priv.includes('La liste des défis que tu as réussis l’accompagne (jamais tes requêtes)'));
  assert.equal(app.split('La liste de tes défis réussis l’accompagne, sans être montrée à personne').length - 1, 2);
});
