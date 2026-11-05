/* Elisa, 1er novembre, 0 h 06, capture de « Profil et objectif » : « améliore la vue du pseudo en DA avec le site internet ».
   La ligne du pseudo devient la carte du site : aplat violet du héros, avatar contouré d’encre des avis, cadenas dans la
   pastille de l’avatar, @ en jaune, trait menthe qui se dessine sous le pseudo comme sous « le SQL ». Le texte ne bouge pas. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const site = fs.readFileSync(new URL('../decouvrir/vitrine.css', import.meta.url), 'utf8');
const siteHtml = fs.readFileSync(new URL('../decouvrir/index.html', import.meta.url), 'utf8');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); };
const sect = cut(css, '/* 52i.', '/* 53.');
const P = 'html.lq #scr-compte .plus-details-body>.acc-pseudo';

const rendu = (nom) => {
  const ctx = vm.createContext({ PS_LOCK_SVG: '<svg data-k="lock"></svg>', ACCT_CHEV: '<svg data-k="chev"></svg>', esc: v => String(v).replace(/&/g, '&amp;') });
  vm.runInContext(cut(app, 'function jeuNom(v)', '\n') + cut(app, 'function jeuInitial(name){', '\n') + cut(app, 'function accPseudoHTML(name){', 'function replayOnboarding(){'), ctx);
  return vm.runInContext(`accPseudoHTML(${JSON.stringify(nom)})`, ctx);
};

test('la carte reprend les couleurs du site : aplat violet du héros, menthe, jaune', () => {
  /* Le même dégradé que le héros et la FAQ du site (--deep) */
  const deep = site.match(/--deep:(linear-gradient\([^;]+\));/)[1];
  assert.ok(sect.includes(deep), 'aplat violet du site');
  assert.ok(sect.includes(`${P} .acc-pseudo-at{flex:none;margin-right:1px;font-style:normal;color:var(--sun)}`), 'le @ en jaune');
  assert.ok(/\.acc-pseudo-t small\{[^}]*text-transform:uppercase;color:var\(--mint\)\}/.test(sect), '« Pseudo » en surtitre menthe, comme les surtitres du site');
});

test('l’avatar est contouré d’encre comme sur les avis du site ; le drapeau dans sa pastille, à la place du cadenas (5 novembre, 21 h 01)', () => {
  assert.ok(site.includes('border:3px solid #fff;box-shadow:0 0 0 2px var(--ink),0 4px 0 2px var(--ink)'), 'le contour des avis du site');
  assert.ok(/\.acc-pseudo-av\{[^}]*border:3px solid #fff;[^}]*box-shadow:0 0 0 2px var\(--ink\),0 4px 0 2px var\(--ink\)/.test(sect), 'le même contour dans l’appli');
  assert.ok(/\.acc-pseudo-flag\{position:absolute;right:-12px;bottom:-7px;[^}]*background:#fff/.test(sect) && !sect.includes('acc-pseudo-lock'), 'la pastille blanche du drapeau, plus de cadenas');
  const html = rendu('@elisa');
  assert.ok(html.includes('<span class="acc-pseudo-av"><span aria-hidden="true">E</span></span>') && !html.includes('Pseudo verrouillé'), 'sans pays connu (ici), pas de pastille');
});

test('le trait sous le pseudo est celui de « le SQL » sur le site, et se dessine à l’ouverture', () => {
  const trait = 'd="M4 20C70 8 170 6 296 14"';
  assert.ok(siteHtml.includes(trait), 'le trait du héros du site');
  assert.ok(rendu('@elisa').includes(`<path pathLength="1" ${trait}/>`), 'le même trait sous le pseudo');
  assert.ok(sect.includes('stroke:var(--mint);stroke-width:4px;stroke-linecap:round;\n  vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:0}'), 'menthe, tracé entier au repos');
  assert.ok(sect.includes('html.lq #plus-profile-settings[open] .plus-details-body>.acc-pseudo .acc-pseudo-sw path{animation:accPsDraw'), 'dessiné à l’ouverture de la feuille');
});

test('les animations finissent sur le style au repos et s’arrêtent en mouvement réduit', () => {
  for (const k of ['accPsIn', 'accPsAv', 'accPsDraw', 'accPsConf']) {
    const m = sect.match(new RegExp(`@keyframes ${k}\\{from\\{[^}]*\\}\\}`));
    assert.ok(m, `${k} : seulement un état de départ`);
  }
  /* Chaque élément animé est coupé avec un sélecteur au moins aussi précis que celui qui l’anime (sinon le trait restait
     caché le temps de son délai). */
  const anim = [...sect.matchAll(/(html\.lq #plus-profile-settings\[open\][^{,]+)\{animation:accPs/g)].map(m => m[1]);
  assert.equal(anim.length, 5);
  const media = cut(sect, '@media (prefers-reduced-motion:reduce){', '\n}');
  for (const a of anim) {
    assert.ok(media.includes(a), `système : ${a}`);
    assert.ok(sect.includes(a.replace('html.lq ', 'html.lq[data-motion="reduce"] ')), `appli : ${a}`);
  }
});

test('un pseudo long rétrécit au lieu de sortir de la carte ; le pseudo est échappé', () => {
  assert.ok(rendu('@datanalyste_42').startsWith('<div class="acc-pseudo" style="--l:15">'));
  assert.ok(sect.includes('font:800 clamp(17px,calc(31px - var(--l,8) * .9px),24px)/1.15 var(--display)'));
  assert.ok(/\.acc-pseudo-nm\{[^}]*overflow:hidden;text-overflow:ellipsis\}/.test(sect), 'les points de suspension en dernier recours');
  assert.ok(rendu('@a&b').includes('<span class="acc-pseudo-nm">a&amp;b<svg'));
  /* Sans @ (ancien pseudo) : pas de @ ajouté */
  assert.ok(!rendu('elisa').includes('acc-pseudo-at'));
});

test('sans pseudo : la même carte, en bouton vers la mini-page du pseudo', () => {
  const html = rendu('');
  assert.ok(html.startsWith('<button type="button" class="acc-pseudo is-vide" onclick="closePlusDetails();psPage({})">'));
  assert.ok(html.includes('<small>Pseudo</small><b><span class="acc-pseudo-nm">Choisis ton pseudo</span></b>'));
  assert.ok(html.includes('<span class="acc-pseudo-go" aria-hidden="true"><svg data-k="chev"></svg></span>'));
  assert.ok(sect.includes(`${P}.is-vide:active{transform:translateY(5px);`), 's’enfonce au toucher, comme les boutons du site');
  assert.ok(sect.includes(`${P} .acc-pseudo-go svg.chev{width:20px!important;height:20px!important;color:var(--ink)!important;`), 'chevron lisible sur le jaune');
});
