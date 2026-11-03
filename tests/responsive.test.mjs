/* Toutes les tailles d’écran (Elisa, 3 novembre, 11 h 38 : « Corrige pour que l’application et le site soient le plus responsive
   possible », photo de l’accueil sur un ordinateur portable).
   - Appli : sur ordinateur, elle tenait dans une colonne de 680 px au milieu de l’écran (home-journey.css), la carte du cours serrée
     à gauche, la série seule à droite au-dessus d’un grand vide, le parcours caché sous la barre du bas. Le cadre occupe maintenant la
     fenêtre ; dès 1 180 px, la barre d’onglets devient un menu à gauche ; le contenu reste centré et borné à 1 100 px.
   - Site : de 960 à 1 099 px, « Commencer » sortait de l’écran (la page glissait sur le côté) ; dès 1 100 px, les liens de la barre
     passaient sur deux lignes ; le bandeau penché des mots-clés dépassait d’un pixel.
   Vérifié dans un navigateur de 320 à 2 560 px (accueil, planning, pratiquer, bibliothèque, compte, console, défis, notes, cartes
   mémo, entretien, SGBD, stickers, cours, feuilles et premier lancement ; toutes les pages du site) : rien ne dépasse de l’écran.
   Ce test garde les règles qui l’assurent. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = lire('index.html'), css = lire('responsive.css'), sw = lire('sw.js'), vitrine = lire('decouvrir/vitrine.css');
/* Le contenu d’un bloc @media (le premier qui commence par ce texte) */
const bloc = (src, q, depuis = 0) => {
  const i = src.indexOf(`${q}{`, depuis); assert.ok(i >= 0, q);
  for (let k = src.indexOf('{', i), n = 0; k < src.length; k++) {
    if (src[k] === '{') n++;
    else if (src[k] === '}' && !--n) return src.slice(src.indexOf('{', i) + 1, k);
  }
};

test('la feuille des tailles d’écran est chargée en dernier, et rangée pour le hors ligne', () => {
  const liens = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
  assert.equal(liens.at(-1), 'responsive.css?v=1', 'après toutes les autres feuilles : c’est elle qui décide de la mise en page');
  assert.ok(sw.includes("  './responsive.css?v=1',"), 'même adresse dans le service worker');
});

test('ordinateur : le cadre occupe la fenêtre, plus de colonne de 680 px', () => {
  assert.ok(html.includes('width:100%;max-width:min(1440px,100%);'), 'cadre jusqu’à 1 440 px');
  assert.ok(!lire('home-journey.css').includes('max-width:680px'), 'home-journey.css ne bloque plus le cadre');
  const c = bloc(css, '@media (min-width:600px)');
  assert.match(c, /--rq-content:1100px/);
  assert.match(c, /html\.lq #app>\.stage>\.screen:not\(#scr-lesson\)\{\s*padding-left:max\(0px,calc\(\(100% - var\(--rq-content\)\) \/ 2\)\);/, 'le contenu centré, 1 100 px au plus');
  assert.match(bloc(css, '@media (min-width:700px)'), /#scr-lesson #lesson-body\{max-width:680px;margin-left:auto;margin-right:auto\}/, 'un cours se lit en colonne');
});

test('dès 1 180 px, la barre d’onglets devient un menu à gauche, avec le nom de l’appli', () => {
  const m = bloc(css, '@media (min-width:1180px)');
  assert.match(m, /--rq-side:232px;--tabbar-h:0px/);
  assert.match(m, /html\.lq #app>\.stage\{margin-left:var\(--rq-side\)\}/);
  assert.match(m, /html\.lq #app>\.tabbar\.tabbar\{\s*top:0;bottom:0;left:0;right:auto;width:var\(--rq-side\);/);
  assert.match(m, /flex-direction:column/);
  assert.match(m, /html\.lq #app>\.tabbar\.tabbar::before\{\s*content:">_";/, 'le logo');
  assert.match(m, /html\.lq #app>\.tabbar\.tabbar::after\{\s*content:"Requête";/, 'le nom');
  assert.match(m, /html\.lq #app>\.tabbar \.tab\{\s*flex:none!important;flex-direction:row;/, 'une ligne par onglet : icône puis nom');
  assert.match(m, /html\.lq body\.in-lesson #app>\.stage\{margin-left:0\}/, 'pendant un cours, le menu s’efface');
  assert.match(m, /html\.lq #scr-learn>\.lgtitle \.journey-brand\{display:none!important\}/, 'le nom n’est plus répété sur l’accueil');
  assert.match(m, /html\.lq body:not\(\.in-lesson\) \.kbar\{\s*left:calc\(\(100% - min\(1440px,100% - 28px\)\) \/ 2 \+ var\(--rq-side\)\);/, 'la barre de touches SQL commence après le menu');
});

test('les écrans profitent de la largeur : accueil, planning, pratiquer, bibliothèque, feuilles', () => {
  const m = bloc(css, '@media (min-width:900px)');
  assert.match(m, /html\.lq #home-hero\{grid-template-columns:minmax\(0,1fr\) clamp\(280px,32%,360px\);/, 'la carte du cours, la série et le retard à côté');
  assert.match(m, /#home-hero>\.lq-hero\{grid-column:1;grid-row:1 \/ -1;/);
  const p = bloc(css, '@media (min-width:900px)', css.indexOf('/* ---------- 4. Planning'));
  assert.match(p, /#planning-body\{grid-template-columns:minmax\(0,1fr\) clamp\(340px,36%,400px\)\}/);
  const h = bloc(css, '@media (min-width:900px)', css.indexOf('/* ---------- 5. Pratiquer'));
  assert.match(h, /html\.lq #app \.journey-hub-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(css, /html\.lq #app>\.viz,html\.lq #app>\.imp-sheet\{left:0;right:0;width:auto;max-width:min\(720px,100%\);/, 'feuilles en largeur de lecture');
  assert.match(css, /html\.lq #onboarding \.ob-foot\{padding-left:max\(24px,calc\(\(100% - 480px\) \/ 2\)\)!important;/, 'premier lancement : boutons dans la colonne');
});

test('petit téléphone : « En solo · Entre amis · Rejoindre » tient dans la carte', () => {
  const m = bloc(css, '@media (max-width:374px)');
  assert.match(m, /html\.lq \.room-seg\.is-3 \.room-opt svg\{display:none\}/);
});

test('téléphone à l’horizontale : l’appli occupe l’écran, sans cadre ni marge', () => {
  const m = bloc(css, '@media (min-width:600px) and (max-width:1179px) and (max-height:500px)');
  assert.match(m, /html\.lq body\{padding:0\}/);
  assert.match(m, /html\.lq #app\{height:100dvh;min-height:100dvh;max-width:none;border-radius:0;box-shadow:none\}/);
  assert.match(m, /html\.lq \.lv\{top:0;bottom:0;width:100%;border-radius:0;box-shadow:none\}/, 'la vidéo en plein écran');
});

test('menu vertical : les flèches haut et bas passent d’un onglet à l’autre', () => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(html.indexOf('function navigateMainTabs('), html.indexOf('function jumpToSection(')), ctx);
  let choisi = -1;
  const tabs = Array.from({ length: 5 }, (_, i) => ({ click() { choisi = i; }, focus() {} }));
  const touche = (i, key) => ctx.navigateMainTabs({ key, currentTarget: { querySelectorAll: () => tabs }, target: { closest: () => tabs[i] }, preventDefault() {} });
  touche(1, 'ArrowDown'); assert.equal(choisi, 2);
  touche(0, 'ArrowUp'); assert.equal(choisi, 4);
  touche(4, 'ArrowDown'); assert.equal(choisi, 0);
  touche(2, 'ArrowRight'); assert.equal(choisi, 3, 'gauche et droite marchent toujours');
});

test('site : la barre tient sur une ligne à toutes les largeurs d’ordinateur, la page ne glisse plus sur le côté', () => {
  const debut = vitrine.indexOf('/* ---------- Toutes les largeurs');
  assert.ok(debut > 0);
  const fin = vitrine.slice(debut);
  assert.match(bloc(fin, '@media (min-width:960px)'), /\.links a\{white-space:nowrap\}/, 'les liens ne se coupent plus');
  const compact = bloc(fin, '@media (min-width:960px) and (max-width:1279px)');
  assert.match(compact, /\.lang-btn \.lb-s\{display:inline\}\.lang-btn \.lb-l\{display:none\}/, '« FR »');
  assert.match(compact, /\.nav-cta \.login\{width:42px;height:42px;padding:0\}/, '« Se connecter » en icône');
  assert.match(compact, /\.nav-cta \.login \.lbl\{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect\(0 0 0 0\)/, 'son nom reste lu');
  assert.ok(fin.includes('@supports (overflow:clip){.nav~main{overflow-x:clip}}'), 'le bandeau penché ne dépasse plus');
});
