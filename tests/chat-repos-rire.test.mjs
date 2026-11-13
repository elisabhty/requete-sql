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

test('13 novembre, 16 h 37 : la bienvenue à la place du chat au poisson, en boucle ; au toucher le fou rire, puis la bienvenue', () => {
  for (const f of ['chat-bienvenue.webp', 'chat-bienvenue-fixe.webp']) assert.ok(fs.existsSync(path.join(ROOT, 'assets', f)), f);
  assert.ok(app.includes("const MASCOT_BIENVENUE='assets/chat-bienvenue.webp',MASCOT_BIENVENUE_FIXE='assets/chat-bienvenue-fixe.webp';"));
  assert.ok(app.includes('bienvenue:{src:MASCOT_BIENVENUE,fixe:MASCOT_BIENVENUE_FIXE,w:302,h:360,boucle:true},'));
  assert.ok(!app.includes('MASCOT_POISSON') && !app.includes("'poisson'"), 'plus de chat au poisson dans l’appli');
  assert.ok(app.includes("intro,anim:nxt==null?'diplome':'bienvenue',uneFois:true,joue:intro}"), 'l’accueil (pas le diplômé)');
  const ctx = vm.createContext({MASCOT_RIRE_REPOS: 'assets/chat-rire-repos.webp', reduit: false, clearTimeout});
  ctx.mascotReduced = () => ctx.reduit;
  vm.runInContext(app.slice(app.indexOf('const MASCOT_COUCOU='), app.indexOf('function mascotAnimDe(')).replace(/const /g, 'var ') + fn('mascotAnimDe') + fn('mascotChatHtml') + ligne('mascotFixe') + ligne('mascotPoser') + fn('mascotCoucouJoue'), ctx);
  for (const joue of [true, false]) {
    const h = ctx.mascotChatHtml({anim: 'bienvenue', uneFois: true, joue});
    assert.ok(h.includes('class="mstk-cat is-bienvenue" src="assets/chat-bienvenue.webp" width="302" height="360"') && h.includes('data-une-fois=""') && !h.includes('data-repos'), 'animé à l’arrivée comme après : ' + joue);
  }
  const img = {src: 'assets/chat-rire.webp', getAttribute: k => k === 'data-anim' ? 'bienvenue' : k === 'src' ? img.src : null, hasAttribute: k => k === 'data-une-fois', classList: {add() {}, remove() {}}};
  ctx.mascotPoser(img);
  assert.equal(img.src, 'assets/chat-bienvenue.webp', 'après le fou rire : de nouveau la bienvenue, qui tourne');
  ctx.mascotCoucouJoue(img);
  assert.equal(img.src, 'assets/chat-bienvenue.webp', 'le coucou de l’arrivée ne la relance pas');
  ctx.reduit = true;
  assert.ok(ctx.mascotChatHtml({anim: 'bienvenue', uneFois: true, joue: true}).includes('src="assets/chat-bienvenue-fixe.webp"'), 'mouvement réduit : le sourire, fixe');
  ctx.mascotPoser(img); assert.equal(img.src, 'assets/chat-bienvenue-fixe.webp');
  assert.ok(fn('mascotToucher').includes('if(img)mascotRire(btn,img);'), 'au toucher : le fou rire');
  assert.ok(css.includes('html.lq .lq-hero.is-lecon .mascot-stk:has(.mstk-cat.is-bienvenue){width:94px;margin-right:-8px}'));
  assert.ok(css.includes('html.lq .mascot-stk .mstk-cat.is-bienvenue.is-rire{scale:1.26;translate:0 1.3%}'), 'le rire part du chat assis, sans saut');
  assert.ok(!css.includes('is-poisson'));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const f of ['chat-bienvenue.webp', 'chat-bienvenue-fixe.webp', 'chat-rire.webp']) assert.ok(sw.includes(`'./assets/${f}'`), 'hors ligne : ' + f);
  assert.ok(!sw.includes('chat-poisson'));
});
