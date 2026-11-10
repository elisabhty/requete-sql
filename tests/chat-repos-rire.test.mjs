/* Elisa, 10 novembre, 8 h 12 (capture de l’accueil, le chat qui rit) : « Pour le chat, est-ce que tu peux prendre un qui lui ressemble
   à quand on le touche, pour que l’on ne voie pas de différence entre les 2 ». Sur l’accueil, au repos, le chat est la première image
   du fou rire, dans le même cadre que lui : au toucher, le rire part de cette image ; il s’y repose ensuite. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}', a) + 2); };
const ligne = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n', a)); };

test('l’image du repos : la première du fou rire, dans le même cadre', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/chat-rire-repos.webp')));
  assert.ok(app.includes("const MASCOT_RIRE_REPOS='assets/chat-rire-repos.webp';"));
  assert.ok(app.includes("anim:nxt==null?'diplome':'poisson',repos:nxt==null?'':'rire',uneFois:true,joue:intro}"), 'l’accueil seulement (pas le diplômé)');
  assert.ok(css.includes('html.lq .mascot-stk .mstk-cat.is-repos{aspect-ratio:289/352;object-fit:contain;object-position:50% 100%;scale:1.25;transform-origin:50% 100%}'));
  assert.ok(css.includes('html.lq .mascot-stk .mstk-cat.is-rire{object-fit:contain;object-position:50% 100%;scale:1.25;transform-origin:50% 100%;'), 'le même cadre que le rire');
});

test('le repos, le rire, puis de nouveau le repos', () => {
  const ctx = vm.createContext({MASCOT_RIRE_REPOS: 'assets/chat-rire-repos.webp', mascotReduced: () => false});
  vm.runInContext(app.slice(app.indexOf('const MASCOT_COUCOU='), app.indexOf('function mascotAnimDe(')).replace(/const /g, 'var ') + fn('mascotAnimDe') + fn('mascotChatHtml') + ligne('mascotFixe') + ligne('mascotPoser'), ctx);
  const repos = ctx.mascotChatHtml({anim: 'coucou', repos: 'rire', uneFois: true});
  assert.ok(repos.includes('class="mstk-cat is-coucou is-repos" src="assets/chat-rire-repos.webp"') && repos.includes('data-repos="rire"'));
  assert.ok(ctx.mascotChatHtml({anim: 'coucou', repos: 'rire', uneFois: true, joue: true}).includes('src="assets/chat-coucou.webp"'), 'le coucou à l’arrivée');
  assert.ok(!ctx.mascotChatHtml({anim: 'coucou', uneFois: true}).includes('repos'), 'ailleurs, le coucou d’avant');
  const classes = new Set();
  const img = {src: '', hasAttribute: k => k === 'data-repos', getAttribute: () => 'coucou', classList: {add: c => classes.add(c)}};
  ctx.mascotPoser(img);
  assert.equal(img.src, 'assets/chat-rire-repos.webp'); assert.ok(classes.has('is-repos'));
  assert.ok(fn('mascotRireFin').includes('if(img.isConnected)mascotPoser(img);'), 'après le rire');
  assert.ok(fn('mascotCoucouPose').includes('mascotPoser(img)'), 'après le coucou');
  assert.ok(fn('mascotRire').includes("img.classList.remove('is-repos');img.classList.add('is-rire');"));
});

test('8 h 29 : le chat au poisson à l’arrivée sur l’accueil, une fois, puis le repos', () => {
  for (const f of ['chat-poisson.webp', 'chat-poisson-fixe.webp']) assert.ok(fs.existsSync(path.join(ROOT, 'assets', f)), f);
  assert.ok(app.includes("const MASCOT_POISSON='assets/chat-poisson.webp',MASCOT_POISSON_FIXE='assets/chat-poisson-fixe.webp',MASCOT_POISSON_MS=2070;"));
  assert.ok(app.includes('poisson:{src:MASCOT_POISSON,fixe:MASCOT_POISSON_FIXE,w:376,h:402,ms:MASCOT_POISSON_MS},'));
  assert.ok(fn('mascotCoucouPose').includes('(a.ms||MASCOT_COUCOU_MS)-140'), 'le repos quand le poisson a fini (2 s)');
  assert.ok(css.includes('html.lq .mascot-stk .mstk-cat.is-poisson.is-repos{aspect-ratio:376/402;scale:1.12}') && css.includes('html.lq .mascot-stk .mstk-cat.is-poisson.is-rire{scale:1.12}'));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const f of ['chat-poisson.webp', 'chat-poisson-fixe.webp', 'chat-rire-repos.webp']) assert.ok(sw.includes(`'./assets/${f}'`), 'hors ligne : ' + f);
});
