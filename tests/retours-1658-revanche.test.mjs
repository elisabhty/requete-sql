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

test('la page des points d’une partie entre amis : « Rejouer dans cette salle » sous « Voir le bilan »', () => {
  const page = fn('jeuPtsPage');
  assert.ok(page.includes("${o.solo?'':'<button type=\"button\" class=\"mu-later mu-rejouer\">Rejouer dans cette salle</button>'}"));
  assert.ok(page.includes("if(rj)rj.addEventListener('click',()=>{fermer();setTimeout(()=>{if(typeof jeuRevanche==='function')jeuRevanche();},60);});"));
});

test('le podium : l’hôte relance (jeuRejouer, même avant que la fin revienne) ; les autres ont la revanche', () => {
  assert.ok(app.includes('${host?`<button type="button" class="journey-primary" onclick="jeuRejouer()"><span>Rejouer dans cette salle</span>${DEF_CHEV_SVG}</button>`:jeuRevancheHTML()}'));
  assert.ok(!app.includes('<i class="jeu-dot" aria-hidden="true"></i>L’hôte peut relancer une partie dans cette salle.'), 'plus seulement une phrase');
  const ctx = vm.createContext({ JEU: { solo: false, revanche: false, hostPid: 'h', players: { h: { name: '@jjjj' } } }, DEF_CHEV_SVG: '›',
    esc: s => String(s), jeuMaj: t => t.charAt(0).toUpperCase() + t.slice(1), jeuPretMot: () => 'prête', jeuIsHost: () => false,
    jeuRejouer() { ctx.relance = (ctx.relance || 0) + 1; }, jeuRedraw() { ctx.dessins = (ctx.dessins || 0) + 1; }, buzz() {} });
  vm.runInContext(fn('jeuRevanche') + fn('jeuRevancheHTML'), ctx);
  assert.equal(ctx.jeuRevancheHTML(), '<button type="button" class="journey-primary jeu-revanche" aria-pressed="false" onclick="jeuRevanche()"><span>Rejouer dans cette salle</span>›</button>'
    + '<p class="jeu-wait jeu-revanche-n"><i class="jeu-dot" aria-hidden="true"></i>@jjjj relance la partie, ici, avec le même code.</p>');
  ctx.jeuRevanche();
  assert.equal(ctx.JEU.revanche, true); assert.equal(ctx.dessins, 1);
  assert.ok(ctx.jeuRevancheHTML().includes('class="journey-primary jeu-revanche on" aria-pressed="true" onclick="jeuRevanche()"><span>Prête pour la revanche ✓</span></button>'));
  assert.ok(ctx.jeuRevancheHTML().includes('Tu seras prête dès que @jjjj relance la partie.'));
  ctx.jeuIsHost = () => true; ctx.jeuRevanche();
  assert.equal(ctx.relance, 1, 'l’hôte : la salle est relancée');
});

test('la relance : prêt tout seul, une seule fois, jamais en relisant l’historique', () => {
  assert.ok(app.includes("const revanche=!!J.revanche&&!replay;J.revanche=false;"));
  assert.ok(app.includes("if(revanche&&!jeuIsHost())setTimeout(()=>{if(JEU===J&&!J.rounds.length&&!J.ready[J.me])jeuSend({t:'ready',on:true});},400);"));
  assert.ok(app.includes('if(winner&&!keep)setTimeout(celebrate,300);'), 'redessiné sur place : pas de deuxièmes confettis');
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
