/* Retours de 2 h 33 (Elisa, 4 novembre), sur l’ouverture de l’appli iOS : « fais cligner des yeux au lancement de l’application,
   améliore le rendu un peu plus encore et ralentis juste un peu » ; le chat, dans l’ouverture (sa réponse à la question posée).
   Le chat surgit de derrière la touche >_, la tête et la patte qui salue par-dessus le bord, cligne des yeux, puis la touche le
   recouvre en plongeant ; un reflet passe sur la touche ; tout va un peu moins vite ; et les animations jouées ne s’appliquent
   plus, pour que Safari redessine net. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = lire('index.html');
const css = lire('ludique.css');
const bloc = css.slice(css.indexOf('/* ---------- 37 bis.'), css.indexOf('/* ---------- 38.'));
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };
const intro = cut(app, '/* Appli iOS : l’ouverture animée', '  </script>');

/* Taille d’une image WebP (VP8X, VP8L ou VP8) */
function webp(p) {
  const b = fs.readFileSync(new URL(`../${p}`, import.meta.url));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.toString('latin1', 8, 12), 'WEBP');
  const k = b.toString('latin1', 12, 16);
  if (k === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: !!(b[20] & 0x10), octets: b.length };
  if (k === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), alpha: !!((v >> 28) & 1), octets: b.length }; }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alpha: false, octets: b.length };
}

test('le chat : trois images de même taille (lui, paupières mi-closes, yeux fermés), légères, avec transparence', () => {
  const [chat, mi, clos] = ['chat', 'chat-mi-clos', 'chat-clos'].map(n => webp(`assets/intro/${n}.webp`));
  assert.deepEqual([chat.w, chat.h], [712, 612]); assert.deepEqual([mi.w, mi.h], [712, 612]); assert.deepEqual([clos.w, clos.h], [712, 612]);
  assert.ok(chat.alpha && mi.alpha && clos.alpha, 'détourées');
  assert.ok(chat.octets < 90000 && mi.octets < 20000 && clos.octets < 20000, `${chat.octets} / ${mi.octets} / ${clos.octets} octets`);
  const py = lire('tools/intro/chat.py');
  for (const l of ["SOURCE = os.path.join(RACINE, 'assets', 'anim', 'mascotte.webp')", 'COUPE = 590', 'MARGE = 22', 'YEUX = [(262, 292, 52, 54), (444, 326, 58, 51)]'])
    assert.ok(py.includes(l), l);
  assert.ok(lire('.gitignore').includes('tools/intro/sortie/'), 'l’aperçu de travail reste hors du dépôt');
});

test('le chat dans l’ouverture : devant la table, derrière la touche ; et le reflet dans la touche', () => {
  const h = cut(intro, "h+='<div class=\"in-chat\"", "L.insertAdjacentHTML('afterbegin',h);");
  assert.ok(h.includes('<div class="in-chat" aria-hidden="true"><img src="assets/intro/chat.webp" alt="" decoding="async"><img class="mi" src="assets/intro/chat-mi-clos.webp" alt="" decoding="async"><img class="clos" src="assets/intro/chat-clos.webp" alt="" decoding="async"></div>'));
  assert.ok(intro.indexOf("h+='</div>';") < intro.indexOf("h+='<div class=\"in-chat\""), 'après la table (au-dessus d’elle) ; la touche, z-index 1, reste devant');
  assert.ok(intro.includes("var kb=L.querySelector('.logo-badge');if(kb)kb.insertAdjacentHTML('beforeend','<i class=\"in-shine\" aria-hidden=\"true\"></i>');"));
  assert.ok(intro.indexOf('<div class="in-chat"') > intro.indexOf('if(!calme){'), 'mouvement réduit : ni chat ni reflet');
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro .in-chat{position:absolute;z-index:0;left:50%;top:var(--cy);width:calc(500*var(--u));height:calc(430*var(--u));'));
  assert.ok(bloc.includes('html.is-native.lq #loader.is-intro .in-chat img+img{opacity:0}'), 'les paupières cachées tant qu’il ne cligne pas');
  assert.ok(bloc.includes(':is(.in-ring,.in-grid,.in-chat,.in-shine){display:none}'), 'écran d’erreur : rien de tout cela');
});

test('géométrie : caché, le chat tient tout entier derrière la touche ; sorti, seule la coupe de l’image reste derrière son bord', () => {
  const L = 500, H = 430, haut = -656, cache = 410;          // en unités, par rapport au centre de la touche (--cy)
  assert.ok(bloc.includes(`margin:calc(${haut}*var(--u)) 0 0 calc(-250*var(--u));opacity:0;transform-origin:50% 100%}`));
  assert.ok(bloc.includes(`@keyframes introChat{0%{opacity:0;transform:translateY(calc(${cache}*var(--u))) rotate(-4deg)}`));
  assert.ok(Math.abs(L / H - 712 / 612) < 0.01, 'les proportions de l’image (712 × 612)');
  /* La touche : de -256 à +256 en hauteur et en largeur autour de --cy (le socle descend jusqu’à +284) */
  assert.ok(L / 2 < 256, 'moins large que la touche : rien ne dépasse sur les côtés');
  assert.equal(haut + H, -226, 'sorti : le bas coupé de l’image reste 30 unités sous le bord de la touche');
  assert.ok(haut + cache > -256 && haut + H + cache < 256, 'caché : de la tête au bas, derrière la touche');
});

test('le déroulé, un peu plus lent et dans l’ordre : appui, onde, chat, résultats, clignement, plongée', () => {
  const t = {
    touche: [0, 0.6], onde: [0.14, 0.14 + 0.41], chat: [0.52, 0.52 + 0.46], resultats: [0.62, 0.62 + 7 * 0.018 + 0.28],
    cligne: [1.02, 1.02 + 0.18], plongee: [1.2, 1.2 + 0.38], fondu: [1.56, 1.56 + 0.28]
  };
  for (const part of [
    '.logo-badge{animation:introKey .6s cubic-bezier(.3,.7,.3,1) both,introZoom .38s cubic-bezier(.55,0,.9,.4) 1.2s forwards}',
    '.in-ring{animation:introWave .41s linear .14s forwards}',
    '.in-chat{opacity:1;animation:introChat .46s cubic-bezier(.25,.8,.35,1) .52s backwards}',
    '.in-chat .mi{animation:introCligneMi .18s steps(1,end) 1.02s forwards}',
    '.in-chat .clos{animation:introCligneClos .18s steps(1,end) 1.02s forwards}',
    '.in-grid{animation:introWarp .42s cubic-bezier(.55,0,.9,.4) 1.2s forwards}',
    '#loader.is-intro.is-play{animation:introOut .28s linear 1.56s forwards}',
    '.in-shine::before{animation:introShine .55s cubic-bezier(.4,0,.2,1) .3s forwards}'
  ]) assert.ok(bloc.includes(part), part);
  assert.ok(t.chat[1] < t.cligne[0], 'il cligne une fois posé');
  assert.ok(t.cligne[1] <= t.plongee[0] + 1e-9, 'puis on plonge');
  assert.ok(t.resultats[1] < t.plongee[0], 'les résultats allumés avant');
  assert.ok(t.plongee[1] <= t.fondu[0] + 0.03 && intro.includes('setTimeout(ranger,1860);') && t.fondu[1] <= 1.86, 'rangé après le fondu');
  assert.ok(t.fondu[1] > 1.3 * 1.2 && t.fondu[1] < 2, '« ralentis juste un peu » : 1,84 s au lieu de 1,28 s, chat compris');
  /* Le clignement : mi-clos (45 ms), fermé (90 ms), mi-clos (45 ms), puis ouvert pour de bon ; rien avant (forwards, pas both) */
  assert.ok(bloc.includes('@keyframes introCligneMi{0%{opacity:1}25%{opacity:0}75%{opacity:1}100%{opacity:0}}'));
  assert.ok(bloc.includes('@keyframes introCligneClos{0%{opacity:0}25%{opacity:1}75%{opacity:0}100%{opacity:0}}'));
  /* La touche recule d’un rien avant de plonger */
  assert.ok(bloc.includes('@keyframes introZoom{0%{transform:none}16%{transform:scale(.94)}100%{transform:scale(9)}}'));
});

test('un rendu net : une case, un résultat ou le chat, une fois joués, ne gardent pas leur animation', () => {
  for (const sel of ['.in-t{opacity:1;animation:introTile .42s cubic-bezier(.3,.7,.4,1) calc(var(--w)*1ms) backwards}',
    '.in-t>s{opacity:1;animation:introPick .28s cubic-bezier(.3,1.5,.5,1) calc(var(--p)*1ms) backwards}',
    '.in-chat{opacity:1;animation:introChat .46s cubic-bezier(.25,.8,.35,1) .52s backwards}']) assert.ok(bloc.includes(sel), sel);
  /* Avant le départ, les règles de base les cachent ; la dernière image clé vaut leur état de repos */
  assert.ok(bloc.includes('font-variant-numeric:tabular-nums;opacity:0}') && bloc.includes('color:var(--ci);text-decoration:none;opacity:0}'));
  assert.ok(bloc.includes('70%{transform:perspective(calc(700*var(--u))) rotateX(10deg) scale(1.04)}100%{opacity:1;transform:perspective(calc(700*var(--u))) rotateX(0deg) scale(1)}}'),
    'les cases se retournent vers nous, et finissent à plat');
  const images = bloc.slice(bloc.indexOf('@keyframes introKey'), bloc.indexOf('/* Si le moteur SQL ne se charge pas'));
  assert.ok(!/filter|box-shadow|width|height|top|left|margin|background|color/.test(images), 'les images clés ne touchent qu’à transform et opacity');
});

test('l’haptique et le son suivent le chat : un léger quand il surgit, un cran quand il ferme les yeux', () => {
  assert.ok(intro.includes("var HAPTIQUE=[[108,'MEDIUM'],[200,'LIGHT'],[290,'LIGHT'],[380,'cran'],[470,'cran'],[638,'cran'],[674,'cran'],[710,'cran'],[746,'cran'],[790,'LIGHT'],[1080,'cran'],[1220,'MEDIUM']];"));
  assert.ok(Math.abs(790 - (520 + 0.58 * 460)) < 10, 'au plus haut de son élan (58 % de introChat)');
  assert.ok(1080 > 1020 + 0.25 * 180 && 1080 < 1020 + 0.75 * 180, 'pendant que ses yeux sont fermés');
  const py = lire('tools/sons/ouverture.py');
  assert.ok(py.includes('CHAT = 0.55') && py.includes('CLIGNE = (1.065, 1.155)') && py.includes('# 2 bis. Le chat surgit') && py.includes('# 3 bis. Le clignement'));
  assert.ok(Math.abs(1.065 - (1.02 + 0.25 * 0.18)) < 1e-9 && Math.abs(1.155 - (1.02 + 0.75 * 0.18)) < 1e-9);
});
