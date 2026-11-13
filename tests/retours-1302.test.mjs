/* Elisa, 7 novembre, 13 h 02 (ses deux autres GIF, reçus avec ceux de 12 h 54 ; elle a choisi leur place) :
   - « Se déconnecter » : il salue de la patte, se retourne et s’en va. Dans la question (avec ou sans compte), la patte qui salue en
     boucle (assets/chat-salut.webp, les 4 premières images) à la place de 👋 ; après une vraie déconnexion, la page « À bientôt ! »
     (du violet du « Bravo » de la flamme) : le GIF entier, une fois (assets/chat-aurevoir.webp, 16 images de 380 ms), il s’efface en
     sortant du cadre, puis la page de connexion, déjà ouverte dessous ; un toucher ou Échap la ferme plus tôt ; mouvement réduit : il
     salue, immobile, 2,4 s ;
   - « Base vide de la console » : il jongle avec des tables (assets/chat-jongle.webp, 16 images de 380 ms, en boucle), là où l’on
     importe un fichier ou crée sa première table, à la place de 🗂️ ; en mouvement réduit, une table attrapée.
   Vérifié dans un navigateur (393 et 320 px de large) : la question, la page « À bientôt ! » jusqu’à la connexion, la base vide. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const anmf = f => { const d = []; let j = 12; while (j < f.length) { const id = f.subarray(j, j + 4).toString(), t = f.readUInt32LE(j + 4); if (id === 'ANMF') d.push(f.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); } return d; };
const GIF = { salut: [284, 308, 4, 0], aurevoir: [295, 308, 16, 1], jongle: [304, 311, 16, 0] };

test('les trois images : la patte qui salue, le départ (une fois), le jongleur', () => {
  for (const [k, [w, h, n, boucles]] of Object.entries(GIF)) {
    const anim = fs.readFileSync(path.join(ROOT, `assets/chat-${k}.webp`)), fixe = fs.readFileSync(path.join(ROOT, `assets/chat-${k}-fixe.webp`));
    const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
    const net = k === 'aurevoir' ? 2 : 1;   // 12 novembre, 20 h 24 : montré en grand, il a deux fois plus de pixels (tools/chats-nets.py) ; la balise garde sa taille
    assert.deepEqual(taille(anim), [w * net, h * net], k); assert.deepEqual(taille(fixe), [w * net, h * net], k);
    assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'), k);
    assert.deepEqual(anmf(anim), Array(n).fill(380), k);
    assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), boucles, `${k} : ${boucles ? 'une fois' : 'en boucle'}`);
    assert.ok(anim.length < 300000 && fixe.length < 60000, `${k} : léger`);
    assert.ok(sw.includes(`  './assets/chat-${k}.webp',\n  './assets/chat-${k}-fixe.webp',\n`), `${k} : hors ligne`);
  }
  const ctx = vm.createContext({ mascotReduced: () => false });
  vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){'), ctx);
  for (const [k, [w, h]] of Object.entries(GIF)) assert.equal(ctx.chatBonusHtml(k), `<img class="chat-bonus is-${k}" src="assets/chat-${k}.webp" width="${w}" height="${h}" alt="" draggable="false">`);
});

test('la question « Se déconnecter » : la patte qui salue, à la place de 👋', () => {
  assert.ok(cut('function lqAsk(o){', 'const lqInfo=').includes("${o.ico||o.chat?'':' is-nostk'}\">${o.chat?`<span class=\"lq-ask-stk is-chat\" aria-hidden=\"true\">${o.chat}</span>`:o.ico?lqAskStk(o.ico):''}"), 'o.chat : le chat à la place de l’autocollant');
  const appels = [];
  const deco = (mode, oui) => {
    const ctx = vm.createContext({ state: { accountMode: mode }, lqAsk: async o => { appels.push(['demande', o.titre, o.chat]); return oui; }, exportProgress() {}, save() {}, closePlusDetails() {},
      startOnboarding: k => appels.push(['onboarding', k]), lqAuRevoir: () => appels.push(['au revoir']), chatBonusHtml: k => `<img data-k="${k}">`, window: {} });
    vm.runInContext(cut('async function seDeconnecter(){', '\n/* Après la déconnexion'), ctx);
    return vm.runInContext('seDeconnecter()', ctx);
  };
  return deco('guest', false).then(() => deco('connected', true)).then(() => {
    assert.deepEqual(appels, [['demande', 'Aucun compte connecté', '<img data-k="salut">'], ['demande', 'Tu nous quittes déjà\u00a0?', '<img data-k="triste">'], ['onboarding', 'account'], ['au revoir']],
      'il salue sans compte ; connecté, « Tu nous quittes déjà ? » et le chat tout triste (13 novembre, 18 h 23) ; déconnecté, la page de connexion s’ouvre, puis il s’en va par-dessus');
  });
});

test('« À bientôt ! » : le GIF une fois, en entier, puis la page de connexion ; un toucher ou Échap la ferme plus tôt', async () => {
  /* 12 novembre, 20 h 24 (Elisa : « cette page bug, parfois on voit pas tout le GIF ») : la page ne compte ses 6,1 s qu’une fois
     l’image affichée, et l’image est relue à neuf (adresse blob) pour repartir de sa première image à chaque déconnexion. */
  const monte = (reduit, plus = {}) => {
    const timers = [], ecoutes = {}, corps = [], cls = new Set(), img = { attrs: { src: 'assets/chat-aurevoir.webp' }, ecoutes: {} };
    img.getAttribute = k => img.attrs[k] ?? null; img.removeAttribute = k => { delete img.attrs[k]; };
    img.addEventListener = (e, f, o) => { assert.equal(o && o.once, true); img.ecoutes[e] = f; };
    Object.defineProperty(img, 'src', { get: () => img.attrs.src, set: v => { img.attrs.src = v; } });
    const el = { id: '', className: '', innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener: (e, f) => { ecoutes[e] = f; }, remove() { this.retire = true; },
      querySelector: s => (s === 'img.lq-flamme-chat' ? img : null), classList: { add: c => cls.add(c), contains: c => cls.has(c) } };
    const ctx = vm.createContext({ document: { getElementById: () => null, createElement: () => el, body: { appendChild: e => corps.push(e) }, addEventListener: (e, f) => { ecoutes['doc-' + e] = f; }, removeEventListener: e => { delete ecoutes['doc-' + e]; } },
      setTimeout: (f, d) => { timers.push({ f, d }); return timers.length; }, clearTimeout() {}, mascotReduced: () => reduit, accord: (f) => f, ...plus });
    vm.runInContext(cut('function chatBonusHtml(k,cls){', '\nfunction mascotReduced(){') + cut('function lqAuRevoir(){', '\nconst DEL_SVG='), ctx);
    ctx.lqAuRevoir();
    return { el, img, timers, ecoutes, corps, cls };
  };
  const m = monte(false);
  assert.equal(m.el.id, 'lq-aurevoir'); assert.equal(m.el.className, 'lq-flamme lq-aurevoir'); assert.equal(m.el.attrs.role, 'status');
  assert.ok(m.el.innerHTML.includes('<img class="chat-bonus is-aurevoir lq-flamme-chat" src="assets/chat-aurevoir.webp" width="295" height="308" alt="" draggable="false">'));
  assert.ok(m.el.innerHTML.includes('<p class="lq-flamme-bravo">À bientôt !</p><h2 class="lq-flamme-t">Tu es déconnectée</h2><p class="lq-flamme-d">Ta progression t’attend sur ton compte.</p>'), 'accordé : déconnectée');
  assert.equal(m.corps.length, 1);
  assert.deepEqual(m.timers.map(t => t.d), [2500], 'tant que l’image n’est pas là : seulement le filet (2,5 s), pas encore le compte à rebours');
  assert.ok(!m.cls.has('is-joue') && m.img.src === 'assets/chat-aurevoir.webp' && m.img.ecoutes.load && m.img.ecoutes.error, 'sans fetch : l’image d’origine, écoutée');
  m.img.ecoutes.load();
  assert.ok(m.cls.has('is-joue')); assert.deepEqual(m.timers.map(t => t.d), [2500, 6100], 'l’image affichée : le temps du GIF (16 × 380 ms)');
  m.img.ecoutes.load(); m.timers[0].f(); assert.equal(m.timers.length, 2, 'une seule fois, même si le filet sonne ensuite');
  m.ecoutes.click(); assert.ok(m.cls.has('is-sort'), 'un toucher la ferme'); assert.ok(!('doc-keydown' in m.ecoutes), 'Échap n’est plus écouté');
  m.timers.find(t => t.d === 220).f(); assert.ok(m.el.retire);
  /* L’image n’arrive jamais : le filet lance la page au bout de 2,5 s, elle ne reste pas ouverte */
  const f = monte(false); f.timers[0].f(); assert.ok(f.cls.has('is-joue')); assert.deepEqual(f.timers.map(t => t.d), [2500, 6100]);
  /* Avec fetch : une adresse blob toute neuve (le GIF repart de sa première image), rendue à la fermeture */
  const rendues = [];
  const b = monte(false, { fetch: u => { assert.equal(u, 'assets/chat-aurevoir.webp'); return Promise.resolve({ ok: true, blob: () => Promise.resolve({}) }); },
    URL: { createObjectURL: () => 'blob:neuf', revokeObjectURL: u => rendues.push(u) } });
  assert.equal(b.img.src, undefined, 'en attendant : pas d’image, donc pas de GIF déjà joué');
  await new Promise(r => setImmediate(r));
  assert.equal(b.img.src, 'blob:neuf'); b.img.ecoutes.load(); assert.ok(b.cls.has('is-joue'));
  b.timers.find(t => t.d === 6100).f(); b.timers.find(t => t.d === 220).f(); assert.ok(b.el.retire); assert.deepEqual(rendues, ['blob:neuf']);
  /* fetch échoue : l’image d’origine */
  const e = monte(false, { fetch: () => Promise.reject(new Error('hors ligne')), URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} } });
  await new Promise(r => setImmediate(r));
  assert.equal(e.img.src, 'assets/chat-aurevoir.webp'); assert.ok(e.img.ecoutes.load);
  const r = monte(true);
  assert.ok(r.el.innerHTML.includes('src="assets/chat-aurevoir-fixe.webp"') && r.timers[0].d === 2400 && r.cls.has('is-joue') && r.img.src === 'assets/chat-aurevoir.webp', 'mouvement réduit : il salue, immobile, 2,4 s, tout de suite');
  let evite = false; r.ecoutes['doc-keydown']({ key: 'Escape', preventDefault: () => { evite = true; } }); assert.ok(evite && r.cls.has('is-sort'), 'Échap');
});

test('la base vide de la console : il jongle avec des tables', () => {
  assert.ok(app.includes('<span class="console-empty-ico is-chat" aria-hidden="true"></span>\n            <b>Ta base est vide</b>'), 'la place du chat, à la place de 🗂️');
  const c = cut("    const empty=document.getElementById('console-empty');\n    if(empty){", '\n    return;');
  assert.ok(c.includes("src=`assets/chat-jongle${typeof mascotReduced==='function'&&mascotReduced()?'-fixe':''}.webp`") && c.includes("if(ico&&typeof chatBonusHtml==='function'&&(!img||img.getAttribute('src')!==src))ico.innerHTML=chatBonusHtml('jongle');"), 'redessiné seulement s’il change');
});

test('les tailles et le départ en fondu', () => {
  for (const r of ['html.lq .lq-ask-stk.is-chat{width:96px;height:auto;margin-bottom:8px;rotate:0deg}', 'html.lq .lq-aurevoir .lq-flamme-scene{width:min(54vw,210px)}',
    'html.lq .lq-aurevoir .lq-flamme-chat{opacity:0;animation:none}',
    'html.lq .lq-aurevoir.is-joue .lq-flamme-chat{opacity:1;animation:lqFlammeChat .6s cubic-bezier(.34,1.56,.64,1) .08s both,lqAuRevoirPart .9s ease-in 5.05s both}', '@keyframes lqAuRevoirPart{to{opacity:0;transform:translateX(16%)}}',
    'html.lq .console-empty-ico.is-chat{width:112px;height:auto;margin:-8px auto 6px;border-radius:0;background:none}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.includes('@media (prefers-reduced-motion:reduce){html.lq .lq-flamme,html.lq .lq-flamme *{animation:none!important}}'), 'mouvement réduit : la page de la flamme, et donc celle-ci, ne bouge pas');
});
