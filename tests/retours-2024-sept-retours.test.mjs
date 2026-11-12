// Elisa, 12 novembre, 20 h 24, sept captures :
//  1. « Je pense que cette page bug (celle d’après « Te déconnecter ? ») car parfois on voit pas tout le GIF » : « À bientôt ! »
//     comptait ses 6,1 s dès l’ouverture, image arrivée ou non, et un GIF déjà joué restait sur sa dernière image
//     (tests/retours-1302.test.mjs suit le nouveau déroulé) ;
//  2. « je trouve que la première page est floue » : les chats montrés en grand faisaient 300 px de large ;
//  3. « le GIF passe derrière la page de connexion, je veux qu’il soit devant » ;
//  4. « des flashs quand on sort, revient » et « à l’arrivée sur l’appli » : ses captures datent d’avant l’échelle en transform
//     (tests/retours-1936-fluidite.test.mjs) ; l’appli reste en veille derrière l’onboarding, mesure à l’appui ;
//  5. la fiche d’un sticker : « ne pas mettre toutes les leçons par liste, juste un % » (et la barre passait sur le texte) ;
//  6. « Schéma : mettre un petit espace avant l’ID en gris » ;
//  7. « regarde le clavier en bas, il y a qu’un bout du bouton visible ».
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';

const chemin = f => new URL('../' + f, import.meta.url);
const lire = f => readFileSync(chemin(f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), obv = lire('onboarding-vitrine.css');
const sansCom = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('les chats montrés en grand ont deux fois plus de pixels ; même dessin, mêmes images, même rythme', () => {
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  const anmf = f => { const d = []; let j = 12; while (j < f.length) { const id = f.subarray(j, j + 4).toString(), t = f.readUInt32LE(j + 4); if (id === 'ANMF') d.push(f.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); } return d; };
  /* nom : [largeur et hauteur de la balise, nombre d’images, durée, boucles] */
  const CHATS = { coucou: [289, 352, 12, 420, 0], parti: [302, 359, 12, 420, 0], aurevoir: [295, 308, 16, 380, 1] };
  for (const [k, [w, h, n, ms, boucles]] of Object.entries(CHATS)) {
    const anim = readFileSync(chemin(`assets/chat-${k}.webp`)), fixe = readFileSync(chemin(`assets/chat-${k}-fixe.webp`));
    assert.deepEqual(taille(anim), [w * 2, h * 2], k); assert.deepEqual(taille(fixe), [w * 2, h * 2], `${k} : la même toile, animé ou non`);
    assert.deepEqual(anmf(anim), Array(n).fill(ms), `${k} : les images et leur durée n’ont pas changé`);
    assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), boucles, `${k} : la boucle n’a pas changé`);
    assert.ok(anim.includes('ALPH') && fixe.includes('ALPH'), `${k} : toujours détouré`);
    assert.ok(anim.length < 350000 && fixe.length < 60000, `${k} : ${Math.round(anim.length / 1024)} Ko, encore léger`);
  }
  /* Les balises gardent leur taille (le même rapport) : la mise en page ne bouge pas */
  assert.ok(app.includes('<img class="ob-bj-chat" src="assets/chat-coucou${fixe?\'-fixe\':\'\'}.webp" width="289" height="352"'));
  /* L’outil : rejouable, et il ne repasse pas sur une image déjà agrandie */
  assert.ok(existsSync(chemin('tools/chats-nets.py')));
  const outil = lire('tools/chats-nets.py');
  assert.ok(outil.includes("MODELE, FACTEUR, QUALITE = 'acnet-gan', 2.0, 72") && outil.includes('LARGEUR_MAX = 520') && outil.includes('if source.width > LARGEUR_MAX:'));
  assert.ok(outil.includes('duration=durees, loop=boucle'), 'durées et boucle relues dans le fichier d’origine');
});

test('page de connexion : le chat à la clé est devant la feuille, plus derrière', () => {
  const r = 'html #onboarding.ob-vitrine .ob-acc-chat{position:absolute;z-index:2;right:18px;bottom:calc(100% - 26px);width:104px;height:auto;pointer-events:none;';
  assert.ok(sansCom(obv).includes(r));
  assert.ok(!/\.ob-acc-chat\{[^}]*z-index:-1/.test(sansCom(obv)), 'plus de z-index négatif');
  /* Il reste dans la feuille (c’est elle qui le porte : il la suit quand elle monte) et ne prend pas les touchers */
  assert.ok(app.includes('<div class="ob-acc-feuille"><i class="ob-acc-poignee" aria-hidden="true"></i><img class="ob-acc-chat" src="assets/chat-cle${chatFixe?\'-fixe\':\'\'}.webp"'));
  /* Les petits écrans le réduisent toujours */
  assert.ok(sansCom(obv).includes('html #onboarding.ob-vitrine.ob-fit-2 .ob-acc-chat{width:80px}'));
});

test('derrière l’onboarding, l’appli reste en veille complète (mesuré : deux fois moins de calcul à chaque page)', () => {
  assert.ok(sansCom(obv).includes('#app:has(>#onboarding.on)>.stage,#app:has(>#onboarding.on)>#tabbar{visibility:hidden;content-visibility:hidden}'));
  assert.ok(!/#app:has\(>#onboarding\.on\)>\.stage \*/.test(sansCom(obv)), 'pas de règle universelle sur le millier d’éléments de l’accueil');
  /* Rien ne redessine l’onboarding au retour de l’arrière-plan : le seul écouteur est le redimensionnement, qui ne refait rien si la page n’a pas changé */
  assert.ok(app.includes("window.addEventListener('resize',()=>{const r=document.getElementById('onboarding');if(r&&r.classList.contains('on'))obFit();});"));
  assert.ok(cut('function obFit(){', '\nfunction obFitChips(){').includes("if(meme&&root.dataset.obzSigne===signe()&&tient()){apres();return;}"));
});

test('la fiche d’un sticker à gagner : une jauge à part (stk-jauge), plus la barre des cases de la collection', () => {
  const css = sansCom(lq);
  for (const r of ['html.lq .stk-jauge{display:flex;align-items:center;gap:12px;max-width:290px;margin:18px auto 0}',
    'html.lq .stk-jauge-b{flex:1;min-width:0;display:block;height:12px;border-radius:99px;background:var(--accent-soft);overflow:hidden}',
    'html.lq .stk-jauge-b>i{display:block;height:100%;border-radius:99px;background:var(--accent)}',
    'html.lq .stk-jauge>b{flex:none;min-width:3.4ch;font:800 18px/1 var(--display);'])
    assert.ok(css.includes(r), r);
  /* « stk-prog » n’a plus qu’un sens : la petite barre des cases (marge négative, 44 px). C’est elle qui passait sur le texte. */
  assert.equal((css.match(/html\.lq \.stk-prog\{/g) || []).length, 1);
  assert.ok(css.includes('html.lq .stk-prog{display:flex;align-items:center;justify-content:center;gap:6px;margin:-4px 0 8px}'));
  assert.ok(app.includes('function stkProgHtml(s){') && !cut('function stkOpen(id){', '\nfunction stkClose(').includes('class="stk-prog"'));
  /* Le pourcentage, de 0 à 100, arrondi */
  const pct = (now, goal) => vm.runInNewContext('const s={now,goal};' + cut('const pct=s.goal>0?', '\n') + ';pct', { now, goal });
  assert.deepEqual([pct(0, 5), pct(2, 5), pct(5, 12), pct(12, 12), pct(15, 12), pct(1, 0)], [0, 40, 42, 100, 100, 0]);
});

test('schéma : un petit espace au-dessus de la ligne grise « plats.id_categorie → … »', () => {
  assert.ok(sansCom(lq).includes('html.lq #schema-sheet .umd-bvia{display:block;margin:2px 0 4px;color:var(--ink-3);font:600 11.5px/1.3 var(--ui)}'));
  assert.ok(!/\.umd-bvia\{[^}]*margin:-/.test(sansCom(lq)), 'plus de marge négative : elle collait la ligne aux pastilles');
});

test('clavier rangé : la barre garde la bande de la barre d’accueil libre, son bouton est entier', () => {
  const css = sansCom(lq);
  for (const r of ['html.lq .kbar:not(.kb-open){padding-bottom:calc(8px + var(--safe-bottom,0px))}',
    'html.lq .kbar.kb-down:not(.kb-open){padding-bottom:calc(6px + var(--safe-bottom,0px))}',
    'html.lq .kbar.kb-down .kbar-dock{width:64px;height:36px}'])
    assert.ok(css.includes(r), r);
  /* Au-dessus du clavier (kb-open), rien ne change : la zone sûre y vaut déjà zéro, et la barre ne doit pas s’en écarter */
  assert.ok(!/\.kbar\.kb-open\{[^}]*padding/.test(css));
  /* La page réserve la hauteur de la barre telle qu’elle est : rangée, elle peut être plus haute que la barre ouverte */
  const src = cut('let kbarOpenH=51;', '\n/* Dans l’éditeur de note, la requête associée');
  const essai = (classes, h, ouvert) => {
    const vars = {};
    const kbar = { classList: { contains: c => classes.includes(c) }, offsetHeight: h, style: {} };
    const ctx = vm.createContext({ document: { getElementById: id => (id === 'kbar' ? kbar : null), documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } } },
      keyboardInset: () => ouvert, kbNatif: () => ouvert, updateKbarDock() {}, noteSqlEnVue() {}, edPageRecaler() {}, requestAnimationFrame() {}, window: {}, activeTA: null });
    vm.runInContext(src + ';syncKbarOffset();', ctx);
    return [vars['--kbar-offset'], vars['--kbar-h']];
  };
  assert.deepEqual(essai(['on', 'kb-down'], 82, 0), ['82px', '82px'], 'rangée sur un iPhone à encoche : 82 pt réservés, pas 51');
  assert.deepEqual(essai(['on', 'kb-down'], 40, 0), ['51px', '51px'], 'jamais moins que la barre ouverte');
  assert.deepEqual(essai(['on', 'kb-open'], 60, 0), ['60px', '60px'], 'ouverte : sa propre hauteur, comme avant');
  assert.deepEqual(essai([], 60, 0), ['0px', '0px'], 'fermée : rien');
});
