/* 13 novembre, 16 h 58 (Elisa, après une partie à deux avec un 2e joueur) : « à la fin, mettre un bouton, pouvoir rejouer dans la
   même salle ». Le parcours en salle (l’ami touche « Rejouer dans cette salle », il est prêt à la relance) est vérifié par
   salle-defis.test.mjs ; ici, les branchements : la page des points, le podium, la relance et les styles. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('la page des points n’a plus de bouton : « Revanche » est sur le podium, après le compte à rebours (18 h 11, puis 18 h 48)', () => {
  const page = fn('jeuPtsPage');
  assert.ok(!page.includes('mu-rejouer') && !page.includes('mu-go') && page.includes('<div class="mu-acts mu-auto">'));
  assert.ok(!css.includes('.mu-rejouer'));
});

test('le podium : une carte en direct (qui relance, qui est là), puis « Quitter la salle » et « Revanche » (13 novembre, 21 h 15)', () => {
  assert.ok(app.includes('        ${jeuCorrListeHTML()}\n        ${jeuRevancheHTML()}`;'), 'hôte ou pas : la même carte');
  assert.ok(!app.includes('<i class="jeu-dot" aria-hidden="true"></i>L’hôte peut relancer une partie dans cette salle.'), 'plus seulement une phrase');
  const ctx = vm.createContext({ JEU: { me: 'g', solo: false, revanche: false, hostPid: 'h', players: { h: { name: '@jjjj' }, g: { name: '@sam' } } },
    JEU_ICO: { quit: '<quit>' }, esc: s => String(s), jeuMaj: t => t.charAt(0).toUpperCase() + t.slice(1), jeuPretMot: () => 'prête', jeuIsHost: () => false,
    jeuLive: () => ['g', 'h'], jeuOrder: () => ['h', 'g'], jeuInitial: n => String(n).replace('@', '').charAt(0).toUpperCase(), accord: (f, m, n) => f,
    jeuRejouer() { ctx.relance = (ctx.relance || 0) + 1; }, jeuRedraw() { ctx.dessins = (ctx.dessins || 0) + 1; }, buzz() {} });
  const relance = app.slice(app.indexOf('const JEU_RELANCE_SVG='), app.indexOf('\n', app.indexOf('const JEU_RELANCE_SVG='))).replace('const ', 'var ');
  vm.runInContext(relance + fn('jeuRevanche') + fn('jeuRevancheHTML'), ctx);
  let h = ctx.jeuRevancheHTML();
  assert.ok(h.startsWith('<div class="jeu-rv" id="jeu-rv">') && h.includes('<b>@jjjj va relancer la partie</b><small>Touche Revanche pour dire que tu en es.</small>'));
  assert.ok(h.includes('<span class="jeu-rv-av" aria-hidden="true"><b class="jeu-av" data-c="0">J</b><b class="jeu-av" data-c="1">S</b></span>2 dans la salle</span>'), 'l’hôte d’abord, puis qui est là');
  assert.ok(h.includes('<span class="jeu-rv-direct"><i aria-hidden="true"></i>En direct</span>') && h.includes('<span class="jeu-rv-ico"><svg'), 'les flèches en rond, en direct');
  assert.ok(h.includes('<button type="button" class="jeu-close jeu-rv-quit" onclick="jeuQuitterSalle()"><quit><span>Quitter la salle</span></button>') && h.includes('<button type="button" class="journey-primary jeu-revanche" aria-pressed="false" onclick="jeuRevanche()"><svg') && h.includes('</svg><span>Revanche</span></button>'), 'les flèches devant (la dernière icône d’un bouton en relief est cachée)');
  ctx.jeuRevanche();
  assert.equal(ctx.JEU.revanche, true); assert.equal(ctx.dessins, 1);
  h = ctx.jeuRevancheHTML();
  assert.ok(h.startsWith('<div class="jeu-rv is-on" id="jeu-rv">') && h.includes('class="journey-primary jeu-revanche on" aria-pressed="true" onclick="jeuRevanche()"><span>Prête ✓</span></button>') && h.includes('<b>Tu es prête\u00a0!</b><small>Tu repars dès que @jjjj relance.</small>'));
  ctx.jeuLive = () => ['g'];
  assert.ok(ctx.jeuRevancheHTML().includes('<b>L’hôte revient…</b>') && ctx.jeuRevancheHTML().includes('Tu es seule dans la salle'), 'l’hôte parti : on l’attend');
  ctx.jeuIsHost = () => true; ctx.jeuLive = () => ['h', 'g']; ctx.JEU.me = 'h';
  assert.ok(ctx.jeuRevancheHTML().includes('<b>Relance la partie</b><small>Tout le monde revient, avec le même code.</small>') && ctx.jeuRevancheHTML().includes('onclick="jeuRejouer()"'));
  ctx.jeuRevanche();
  assert.equal(ctx.relance, 1, 'l’hôte : la salle est relancée');
  /* « Quitter la salle » : l’onglet Défis, « Jouer » ; la carte suit la salle sur place */
  const q = fn('jeuQuitterSalle');
  assert.ok(q.includes("if(typeof DEFIS!=='undefined'){DEFIS.onglet='jouer';DEFIS.carte='';}") && q.includes("leaveLessonScreen('defis');") && q.includes('jeuLeaveAsk(jeuQuitterSalle)'));
  assert.ok(fn('jeuPatch').includes("const rv=v==='final'&&document.getElementById('jeu-rv');"));
  const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
  assert.ok(css.includes('html.lq #jeu-root .jeu-rv-btns{display:grid;grid-template-columns:1fr 1.15fr;gap:10px;margin-top:12px}') && css.includes('@keyframes jeuRvTourne{to{transform:rotate(360deg)}}'));
  assert.ok(css.indexOf('html.lq #jeu-root .jeu-rv{') < css.indexOf('Les exemples de widgets (Elisa, 13 novembre, 9 h 19'), 'avant les exemples de widgets');
});

test('la relance : prêt tout seul, une seule fois, jamais en relisant l’historique', () => {
  assert.ok(app.includes("const revanche=!!J.revanche&&!replay;J.revanche=false;"));
  assert.ok(app.includes("if(revanche&&!jeuIsHost())setTimeout(()=>{if(JEU===J&&!J.rounds.length&&!J.ready[J.me])jeuSend({t:'ready',on:true});},400);"));
  assert.ok(app.includes('if(!keep&&!J.voile){   // voilé (19 h 15) : jeuVoileLever\n        if(!prefersReduceMotion())setTimeout(()=>{const b=document.querySelector(\'#jeu-root .jr2-n\');if(b&&JEU===J)jeuCountUp(b);},300);\n        if(winner)setTimeout(celebrate,300);'), 'redessiné sur place : pas de deuxièmes confettis');
});

test('les styles : la revanche au vert, comme « Prête ✓ » en salle d’attente', () => {
  assert.ok(css.includes('html.lq .journey-primary.jeu-revanche.on{background:var(--success)!important;color:#fff!important;'));
  assert.ok(css.indexOf('La revanche (13 novembre') < css.indexOf('Défis — la refonte du 7 novembre'));
});

test('17 h (la partie à deux) : revenu dans une salle finie, la partie n’est pas comptée une deuxième fois', () => {
  const f = fn('jeuCreditGame');
  assert.ok(f.includes("const partie=String(J.code||'')+'-'+(J.g|0),s0=state.salle&&typeof state.salle==='object'?state.salle:null;"));
  assert.ok(f.includes('if(s0&&Array.isArray(s0.comptees)&&s0.comptees.includes(partie))return null;'));
  assert.ok(f.indexOf('s0.comptees.includes(partie))return null;') < f.indexOf('s.pts=(s.pts||0)+pts;'), 'avant les points');
  assert.ok(f.includes("s.comptees=[partie].concat(Array.isArray(s.comptees)?s.comptees.filter(x=>x!==partie):[]).slice(0,40);"));
  assert.ok(app.includes("{const c=(Array.isArray(salleSrc.comptees)?salleSrc.comptees:[]).filter(x=>typeof x==='string'&&/^[A-Za-z0-9]{4,12}-\\d{1,6}$/.test(x)).slice(0,40);if(c.length)salle.comptees=c;}"), 'gardées dans la progression');
});
