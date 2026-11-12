// La page « bonjour », avec des autocollants animés autour du chat (Elisa, 12 novembre, 18 h 36, sa capture de la première page :
// « Améliore cette page, met des stickers tableau de bord, dashboard, chiffre, requête, animés, micro-animés »).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = lire('index.html'), obv = lire('onboarding-vitrine.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = cut('function obBonjourStickers(){', '/* Invité par un ami (5 novembre, 14 h)');
const stickers = defis => vm.runInNewContext(`${defis == null ? '' : `const CHALLENGES=new Array(${defis});`}${fn};obBonjourStickers()`);

test('la page : le chat et ses autocollants dans un même cadre, sous la bulle', () => {
  const page = cut("}else if(slide==='bonjour'){", "}else if(slide==='questions'){");
  assert.ok(page.includes(`<div class="ob-bj-autour">
          <img class="ob-bj-chat" src="assets/chat-coucou\${fixe?'-fixe':''}.webp" width="289" height="352" alt="La mascotte Requête te fait coucou" draggable="false">
          \${typeof obBonjourStickers==='function'?obBonjourStickers():''}
        </div>`));
  assert.ok(page.indexOf('ob-bj-bulle') < page.indexOf('ob-bj-autour') && page.indexOf('ob-bj-autour') < page.indexOf('ob-bj-nom'), 'la bulle, le chat, puis le nom');
});

test('quatre autocollants décoratifs : la requête, le chiffre, le tableau de bord, l’anneau ; trois étincelles', () => {
  const h = stickers(477);
  assert.ok(h.startsWith('<div class="ob-bjs-tous" aria-hidden="true">'), 'rien de tout cela n’est lu par VoiceOver');
  assert.deepEqual(h.match(/class="ob-bjs is-[a-z]+"/g), ['class="ob-bjs is-sql"', 'class="ob-bjs is-nb"', 'class="ob-bjs is-tab"', 'class="ob-bjs is-rond"']);
  assert.equal((h.match(/class="ob-bje ob-bje-\d"/g) || []).length, 3);
  /* La requête : deux lignes, chacune avec le nombre de caractères que son cache découvre */
  assert.ok(h.includes('<span class="bjs-l" style="--c:15"><b>SELECT</b> COUNT(*)<u></u></span><span class="bjs-l is-2" style="--c:11"><b>FROM</b> defis;<u></u></span>'));
  assert.equal('SELECT COUNT(*)'.length, 15); assert.equal('FROM defis;'.length, 11);
  /* Le tableau de bord : un titre, un voyant, cinq barres dont la dernière est la plus haute */
  const barres = [...h.matchAll(/<i style="--h:([\d.]+);--i:(\d)"><\/i>/g)].map(m => [+m[1], +m[2]]);
  assert.deepEqual(barres.map(b => b[1]), [0, 1, 2, 3, 4]);
  assert.equal(Math.max(...barres.map(b => b[0])), barres[4][0]);
  /* L’anneau : trois parts qui font le tour, séparées par un jour */
  const parts = [...h.matchAll(/stroke-dasharray="(\d+) (\d+)"/g)].map(m => [+m[1], +m[2]]);
  assert.equal(parts.length, 3); for (const [a, b] of parts) assert.equal(a + b, 100);
  assert.ok(parts.reduce((s, p) => s + p[0], 0) < 100);
  assert.ok(!/<img|\.webp|\.png/.test(h), 'tout est dessiné, aucune image à charger');
});

test('le chiffre est le vrai nombre de défis, un rouleau par chiffre ; inconnu, l’autocollant n’est pas montré', () => {
  for (const n of [477, 52, 1203]) {
    const h = stickers(n), roues = [...h.matchAll(/<span class="bjs-chf"><i class="bjs-roue" style="--n:(\d);--i:(\d)">((?:<b>\d<\/b>)+)<\/i><\/span>/g)];
    assert.equal(roues.map(m => m[1]).join(''), String(n));
    assert.deepEqual(roues.map(m => +m[2]), [...String(n)].map((_, i) => i));
    for (const m of roues) assert.equal(m[3].replace(/<\/?b>/g, ''), '01234567890123456789', 'deux tours de 0 à 9');
    assert.ok(h.includes('<span class="bjs-lib">défis<svg class="bjs-fleche"'));
  }
  assert.ok(!stickers(null).includes('is-nb') && !stickers(0).includes('is-nb'));
  assert.ok(stickers(null).includes('is-sql') && stickers(null).includes('is-tab'));
  assert.ok(!fn.includes('477') && !app.slice(app.indexOf("}else if(slide==='bonjour'){"), app.indexOf("}else if(slide==='questions'){")).includes('477'), 'le nombre de défis n’est écrit nulle part en dur');
  assert.ok(fn.includes("const n=String((typeof CHALLENGES!=='undefined'&&CHALLENGES.length)||''),"));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .bjs-roue{display:flex;flex-direction:column;transform:translateY(calc((var(--n) + 10) * -5%))}'), 'arrêté sur le bon chiffre du second tour');
});

test('posés autour du chat, à sa taille, sans rien recouvrir d’utile', () => {
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-bj-scene{--bjw:min(62vw,250px);align-self:stretch}'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine:is(.ob-fit-3,.ob-fit-4,.ob-fit-5) .ob-bj-scene{--bjw:min(46vw,190px)}'));
  /* La même largeur que le chat : la variable et la règle de l’image disent la même chose */
  assert.ok(obv.includes('html #onboarding.ob-vitrine :is(.ob-bj-chat,.ob-qs-chat){display:block;width:min(62vw,250px);'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine:is(.ob-fit-3,.ob-fit-4,.ob-fit-5) :is(.ob-bj-chat,.ob-qs-chat){width:min(46vw,190px)}'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-bj-autour{position:relative;align-self:center;width:min(100%,calc(var(--bjw) + 16.5em));font-size:clamp(8.4px,calc(var(--bjw) / 24),10.6px)}'));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .ob-bjs-tous{position:absolute;inset:0;z-index:2;pointer-events:none;'), 'ils ne prennent aucun toucher');
  /* Chacun dans un coin que la silhouette laisse libre */
  for (const r of ['.ob-bjs.is-sql{left:-1em;top:-3%;', '.ob-bjs.is-nb{right:-.9em;top:12%;', '.ob-bjs.is-tab{left:-.9em;bottom:1%;', '.ob-bjs.is-rond{right:-.4em;bottom:-1%;'])
    assert.ok(obv.includes('html #onboarding.ob-vitrine ' + r), r);
  assert.ok(obv.includes('html #onboarding.ob-vitrine .bjs-c{display:block;padding:.5em;border-radius:1.3em;background:#fff;box-shadow:0 .42em 0 rgba(27,22,64,.26)}'), 'découpés comme le chat : liseré blanc, ombre franche');
});

test('les animations : dans le bloc du mouvement accepté, et seulement transform et opacity', () => {
  const debut = obv.indexOf('@media (prefers-reduced-motion:no-preference){'), fin = obv.indexOf('@media (prefers-reduced-motion:reduce){', debut);
  const media = obv.slice(debut, fin), M = 'html:not([data-motion="reduce"]) #onboarding.ob-vitrine';
  for (const r of ['.ob-enter .ob-bjs{animation:obvBjColle .46s cubic-bezier(.2,.9,.3,1) var(--d,.4s) backwards}',
    ' .bjs-c{animation:obvBjFlot var(--f,6s) ease-in-out calc(var(--d,.4s) + .6s) infinite}',
    '.ob-enter .bjs-barres i{animation:obvBjPousse .5s var(--v-pop) calc(.95s + var(--i) * .07s) backwards,obvBjRespire 3.2s ease-in-out calc(2s + var(--i) * .37s) infinite}',
    '.ob-enter .bjs-roue{animation:obvBjRoule calc(.9s + var(--i) * .22s) cubic-bezier(.16,.84,.3,1) 1.86s backwards}',
    '.ob-enter .bjs-l u{animation:obvBjTape .6s steps(15,end) .74s backwards}',
    '.ob-enter .bjs-l.is-2 u{animation:obvBjTape .44s steps(11,end) 1.4s backwards}',
    '.ob-enter .bjs-l.is-2 u::before{animation:obvBjPasVu 1.38s linear,obvBjClign 1s steps(1,end) 2s infinite}',
    '.ob-enter .bjs-anneau{animation:obvBjTourne .9s cubic-bezier(.2,.8,.3,1) .86s backwards,obvBjCran 9s cubic-bezier(.5,0,.2,1) 2.6s infinite}'])
    assert.ok(media.includes('  ' + M + r), r);
  /* La requête finit de se taper (1,84 s) juste avant que le chiffre roule (1,86 s) : c’est elle qui le renvoie */
  assert.ok(1.4 + .44 <= 1.86);
  /* Hors de ce bloc, aucune règle des autocollants n’anime quoi que ce soit */
  const hors = obv.slice(0, debut) + obv.slice(fin);
  for (const l of hors.split('\n')) if (/\.(ob-bjs|bjs-|ob-bje)/.test(l) && !l.startsWith('@keyframes')) assert.ok(!/animation:/.test(l), l);
  /* Le compositeur seul : chaque image clé ne touche que transform ou opacity */
  const cles = [...obv.matchAll(/^@keyframes (obvBj(?!Chat|Nom)\w+)\{(.+)\}$/gm)];
  assert.deepEqual(cles.map(m => m[1]).sort(), ['obvBjBrille', 'obvBjClign', 'obvBjColle', 'obvBjCran', 'obvBjFlot', 'obvBjPasVu', 'obvBjPousse', 'obvBjRespire', 'obvBjRoule', 'obvBjSaute', 'obvBjTape', 'obvBjTourne', 'obvBjVoyant', 'obvBjVu']);
  for (const [, nom, corps] of cles) for (const d of corps.match(/[a-z-]+(?=:)/g) || []) assert.ok(d === 'transform' || d === 'opacity', `${nom} : ${d}`);
  for (const [, nom] of cles) assert.ok(media.includes(nom + ' '), nom + ' sert');
});

test('mouvement réduit : l’état écrit est l’état final (requête entière, curseur posé, barres hautes)', () => {
  assert.ok(obv.includes('html #onboarding.ob-vitrine .bjs-l u{position:absolute;left:0;top:0;width:100%;height:100%;background:var(--v-code);transform:translateX(100%)}'), 'le cache est rangé à droite du texte');
  assert.ok(obv.includes("html #onboarding.ob-vitrine .bjs-l u::before{content:'';position:absolute;left:.14em;top:.16em;bottom:.16em;width:.5em;border-radius:.1em;background:var(--v-sun);opacity:0}"));
  assert.ok(obv.includes('html #onboarding.ob-vitrine .bjs-l.is-2 u::before{opacity:1}'), 'un seul curseur, au bout de la dernière ligne');
  assert.ok(obv.includes('html #onboarding.ob-vitrine .bjs-barres i{width:1.2em;height:calc(var(--h) * 100%);border-radius:.36em .36em 0 0;background:var(--v-accent);transform-origin:50% 100%}'));
  assert.ok(!/\.ob-bjs\{[^}]*opacity:0/.test(obv), 'aucun autocollant n’attend une animation pour apparaître');
});
