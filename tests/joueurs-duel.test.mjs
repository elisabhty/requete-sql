/* Elisa, 8 novembre, 14 h 27 puis 14 h 30 (capture de l’onglet Joueurs, « Pas encore d’adversaire ! ») : « Remplace par ce gif et le
   faire tourner qu’une fois » ; « C’est cette écran ». Le chat qui saluait laisse la place au duel : il cherche du regard, la main en
   visière, sort sa pancarte « VS », fait un clin d’œil, salue, puis s’arrête sur son sourire. 12 images de 500 ms, une seule fois ;
   l’image fixe (mouvements réduits) montre la pancarte. Le faux damier du GIF (avec ses pixels rosés) est effacé, l’autocollant gardé
   entier. Les salles qui se rafraîchissent ne redessinent plus l’état vide : le GIF n’est pas relancé en plein milieu. Le classement
   garde son trophée. Vérifié dans un navigateur (393 px). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

function webp(f) {
  const b = fs.readFileSync(path.join(ROOT, f));
  const o = { images: 0, durees: [] };
  for (let i = 12; i + 8 <= b.length;) {
    const id = b.toString('latin1', i, i + 4), n = b.readUInt32LE(i + 4), d = i + 8;
    if (id === 'VP8X') { o.w = 1 + b.readUIntLE(d + 4, 3); o.h = 1 + b.readUIntLE(d + 7, 3); }
    if (id === 'ANIM') o.tours = b.readUInt16LE(d + 4);
    if (id === 'ANMF') { o.images++; o.durees.push(b.readUIntLE(d + 12, 3)); }
    i = d + n + (n & 1);
  }
  return o;
}

test('le GIF du duel : 12 images de 500 ms, joué une seule fois ; son image fixe ; rangé pour le hors ligne', () => {
  const a = webp('assets/chat-duel.webp'), f = webp('assets/chat-duel-fixe.webp');
  assert.deepEqual([a.w, a.h, a.images, a.tours], [300, 308, 12, 1]);
  assert.ok(a.durees.every(ms => ms === 500), String(a.durees));
  assert.deepEqual([f.w, f.h, f.images], [300, 308, 0]);
  for (const x of ['', '-fixe']) assert.ok(sw.includes(`  './assets/chat-duel${x}.webp',\n`), `sw.js : chat-duel${x}`);
});

test('chatBonusHtml le connaît, et donne l’image fixe quand les mouvements sont réduits', () => {
  let calme = false;
  const ctx = vm.createContext({ mascotReduced: () => calme });
  vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){'), ctx);
  assert.equal(ctx.chatBonusHtml('duel', 'is-vide dx-amis-chat'), '<img class="chat-bonus is-duel is-vide dx-amis-chat" src="assets/chat-duel.webp" width="300" height="308" alt="" draggable="false">');
  calme = true;
  assert.ok(ctx.chatBonusHtml('duel').includes('src="assets/chat-duel-fixe.webp"'));
});

test('l’onglet Adversaires vide montre le duel ; déjà affiché, il n’est pas redessiné (le GIF ne repart pas) ; le classement garde son trophée', () => {
  const fn = cut('function amisListesPeindre(){', '\n  /* Refonte du 7 novembre : une seule ligne par joueur') + '\n}';
  const ls = { innerHTML: '', firstElementChild: null, closest: () => null };
  const ctx = vm.createContext({
    document: { getElementById: id => id === 'dx-amis-liste' ? ls : null },
    amisListe: () => [], amisTitre: () => '', amisSous: () => '', amisPcsHTML: () => '', defisAmisPeindre: () => {},
    chatBonusHtml: (k, cls) => `<img data-k="${k}" data-cls="${cls}">`,
  });
  vm.runInContext(fn, ctx);
  ctx.amisListesPeindre();
  /* 15 h 09 (sa maquette) : le titre « Aucun adversaire pour l’instant ! », puis sa phrase */
  assert.equal(ls.innerHTML, '<div class="dx-vide-bloc is-amis"><img data-k="duel" data-cls="is-vide dx-amis-chat"><p class="dx-vide-t">Aucun adversaire pour l’instant&nbsp;!</p><p class="dx-vide">Les joueurs que tu affrontes en salle apparaîtront ici automatiquement après une partie.</p></div>');
  /* l’état vide est à l’écran : les salles rafraîchies (defisListes) rappellent la fonction, l’image reste la même */
  ls.innerHTML = 'déjà là';
  ls.firstElementChild = { classList: { contains: c => c === 'is-amis' } };
  ctx.amisListesPeindre();
  assert.equal(ls.innerHTML, 'déjà là');
  /* un autre contenu à la place (une liste) : l’état vide revient, avec le duel */
  ls.firstElementChild = { classList: { contains: c => c === 'dx-list' } };
  ctx.amisListesPeindre();
  assert.ok(ls.innerHTML.includes('<img data-k="duel"'));
  assert.ok(!app.includes("chatBonusHtml('salut','is-vide dx-amis-chat')"), 'plus le chat qui salue ici');
  assert.ok(app.includes("chatBonusHtml('trophee','is-vide dx-cls-chat')"), 'le classement vide garde son trophée');
});
