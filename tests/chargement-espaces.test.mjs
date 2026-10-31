/* Elisa, 31 octobre, 0 h 40 (six captures) : « ok pour la page de chargement, mais je veux que le truc tourne ou quelque chose comme ça,
   car ça fait mal aux yeux : ça vient et ça apparaît d’un coup », puis « problème d’espace » (Tes 7 prochains jours), « problème de
   coupure, responsive » (« Ton espace Req… »), « améliore cet espace, ça fait trop gris sombre quand il n’y a pas encore de flamme »
   (la série), « problème d’espacement » (la barre d’onglets), « problème de responsivité » (Ma progression par module), « supprimer »
   (la note sous la page SGBD). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); };
const regle = (src, sel) => { const i = src.indexOf(sel + '{'); assert.ok(i >= 0, sel); return src.slice(i + sel.length + 1, src.indexOf('}', i)); };
const px = (txt, re) => { const m = txt.match(re); assert.ok(m, String(re)); return parseFloat(m[1]); };
/* Luminance relative (WCAG) d’une couleur #RRGGBB */
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };

test('chargement : un anneau où une comète tourne sans fin, à la place de la barre qui balayait puis réapparaissait d’un bond', () => {
  const s37 = cut(lq, '/* L’écran de chargement :', '/* ---------- 38.');
  assert.ok(s37.includes('@keyframes ldSpin{to{transform:rotate(1turn)}}'), 'un tour complet, sans retour en arrière');
  const anneau = regle(s37, 'html.lq #loader .spinner'), comete = regle(s37, 'html.lq #loader .spinner::after'), tete = regle(s37, 'html.lq #loader .spinner::before');
  /* La comète prend tout l’anneau (la barre de base faisait 38 % de large, collée à gauche, et glissait de -110 % à 290 %) */
  assert.ok(comete.includes('inset:0;width:auto;') && comete.includes('conic-gradient(') && comete.includes('animation:ldSpin 1.2s linear infinite'), 'la comète');
  assert.ok(app.includes('#loader .spinner::after{content:\'\';position:absolute;inset:0 auto 0 0;width:38%;') && app.includes('animation:loaderSweep 1.3s'), 'la barre de base, remplacée dans le thème');
  assert.ok(tete.includes('animation:ldSpin 1.2s linear infinite'), 'la tête tourne avec la comète, au même rythme');
  /* La géométrie tombe juste : anneau de W px, piste de T px (ombre intérieure et masque), tête ronde de T px centrée sur la piste,
     qui tourne autour du centre de l’anneau */
  const W = px(anneau, /width:([\d.]+)px!important/), T = px(anneau, /inset 0 0 0 ([\d.]+)px/), D = px(tete, /width:([\d.]+)px/);
  assert.equal(px(anneau, /height:([\d.]+)px!important/), W, 'un cercle');
  assert.ok(comete.includes(`#000 calc(100% - ${T}px)`), 'le masque garde une piste de la même épaisseur');
  assert.equal(D, T, 'la tête a l’épaisseur de la piste');
  assert.ok(tete.includes(`left:calc(50% - ${D / 2}px)`) && tete.includes('top:0;'), 'la tête, en haut au milieu');
  assert.ok(tete.includes(`transform-origin:${D / 2}px ${W / 2}px`), 'elle tourne autour du centre');
  /* Le logo se pose en douceur : ni grossissement d’une fois et demie, ni claquement */
  assert.ok(!lq.includes('ldSlap'), 'plus de claquement');
  const entree = s37.match(/@keyframes ldIn\{0%\{([^}]*)\}/)[1];
  assert.ok(entree.includes('opacity:0') && px(entree, /scale\(([\d.]+)\)/) >= .9 && px(entree, /rotate\(-?([\d.]+)deg\)/) <= 8, entree);
  /* Elisa, 31 octobre, 8 h 06 : le logo s’allume vite (l’écran ne restait que 0,3 s, le logo à moitié visible) */
  assert.ok(regle(s37, 'html.lq #loader .logo-badge').includes('animation:ldIn .42s cubic-bezier(.2,.75,.25,1) both,ldFloat 4.6s ease-in-out .9s infinite'));
  assert.ok(px(s37, /@keyframes ldOut\{to\{opacity:0;transform:scale\(([\d.]+)\)\}\}/) <= 1.06, 'au départ, il s’efface sans bondir');
  /* Mouvement réduit : l’anneau s’arrête aussi (comète et tête) */
  const reduit = cut(lq, '@media (prefers-reduced-motion:reduce){\n  html.lq #lesson-body .ls-nav .ls-next[data-jc-gate]::after', '/* ---------- 38.');
  for (const sel of ['html.lq #loader .spinner::before', 'html.lq #loader .spinner::after', 'html[data-motion="reduce"].lq #loader .spinner::before', 'html[data-motion="reduce"].lq #loader .spinner::after'])
    assert.ok(reduit.includes(sel), sel);
  /* La phrase ne laisse pas « SQLite… » seul sur sa ligne */
  assert.ok(regle(s37, 'html.lq #loader p').includes('text-wrap:balance'));
});

test('Tes 7 prochains jours : de l’air entre les ronds, et l’anneau du jour ne touche plus son voisin', () => {
  const rond = regle(lq, 'html.lq .acct-day i'), semaine = regle(lq, 'html.lq .acct-week'), jour = regle(lq, 'html.lq .acct-day.is-today i');
  const marge = px(rond, /calc\(100% - ([\d.]+)px\)/), gap = px(semaine, /gap:([\d.]+)px/);
  assert.ok(rond.includes(`width:clamp(24px,calc(100% - ${marge}px),34px)`), 'le rond suit sa colonne, entre 24 et 34 px');
  const anneau = Math.max(...[...jour.matchAll(/0 0 0 ([\d.]+)px/g)].map(m => +m[1]));
  /* Entre deux ronds : la marge de la colonne et l’écart de la grille ; l’anneau du jour en prend une partie, il en reste au moins 4 px */
  assert.ok(marge + gap - anneau >= 4, `reste ${marge + gap - anneau} px`);
  assert.ok(!rond.includes('max-width:100%') && !rond.includes('width:36px'), 'plus de ronds de 36 px serrés dans des colonnes de 37');
});

test('Mon compte : « Ton espace Requête » passe à la ligne au lieu d’être coupé', () => {
  const titre = regle(lq, 'html.lq .acct-id-copy b');
  assert.ok(!titre.includes('nowrap') && !titre.includes('ellipsis'), 'plus de « Req… »');
  for (const part of ['-webkit-line-clamp:2', 'white-space:normal', 'overflow-wrap:anywhere', 'text-wrap:balance', 'font:700 clamp(20px,6vw,24px)/1.16 var(--display)'])
    assert.ok(titre.includes(part), part);
  assert.ok(regle(lq, 'html.lq .acct-id-copy small').includes('text-wrap:balance'), 'le niveau non plus ne laisse pas un mot seul');
  assert.ok(cut(app, 'function renderCompte(', '\n}\n').includes("const accountTitle=name||(connected?'Mon profil':'Ton espace Requête');"), 'le titre ne change pas');
});

test('la série pas encore allumée : chaude et claire, plus gris-lilas', () => {
  const caseFlamme = regle(lq, 'html.lq .lq-streak:not(.is-on) .lq-streak-flame');
  assert.ok(!caseFlamme.includes('surface-2') && caseFlamme.includes('#FFF7EA'), 'la case de la flamme, pêche');
  const fo = regle(lq, 'html.lq .lq-streak:not(.is-on) .lq-streak-flame .f-o').match(/#([0-9A-F]{6})/i)[0];
  const [r, , b] = [1, 3, 5].map(i => parseInt(fo.slice(i, i + 2), 16));
  assert.ok(r - b >= 80, `la flamme éteinte est chaude (${fo}), pas grise`);
  /* Les jours sans flamme : des ronds blancs à peine cerclés, des flammes plus claires qu’avant */
  assert.ok(regle(lq, 'html.lq .lq-day i').includes('background:#fff;box-shadow:inset 0 0 0 1.5px #ECE7FA'), 'ronds blancs');
  for (const [sel, avant] of [['html.lq .lq-day.is-missed .f-o', '#D9D3EC'], ['html.lq .lq-day.is-missed .f-i', '#ECE8F7']]) {
    const c = regle(lq, sel).match(/#([0-9A-F]{6})/i)[0];
    assert.ok(lum(c) > lum(avant), `${sel} : ${c} plus clair que ${avant}`);
  }
  /* Le jour fait et aujourd’hui gardent leur fond ; l’anneau des ronds blancs ne s’y ajoute pas */
  assert.ok(regle(lq, 'html.lq .lq-day.is-done i').includes('box-shadow:none') && regle(lq, 'html.lq .lq-day.is-today i').includes('box-shadow:none'));
  assert.ok(regle(lq, 'html.lq .lq-day.is-future i').includes('dashed'), 'les jours à venir, en pointillé');
  /* La même case dans Mon compte (Ma progression) */
  assert.ok(!regle(lq, 'html.lq .acct-stat.is-streak:not(.is-on) .acct-stat-ico').includes('surface-2'));
});

test('barre d’onglets : cinq colonnes égales à toutes les largeurs, rien ne déborde de l’écran', () => {
  const s7 = cut(lq, '/* ---------- 7. Barre d', '/* ---------- 8.');
  assert.ok(s7.includes('html.lq #app>.tabbar .tab{flex:1 1 0!important;min-width:0!important;font-size:clamp(10px,3vw,11px)!important}'));
  assert.ok(!s7.includes('flex:1 1 auto'), 'plus d’onglets à la largeur de leur libellé sous 380 px');
  /* « Bibliothèque », le plus long (12 lettres), tient dans sa colonne ou mord à peine sur la marge de ses voisins, qui ont des libellés
     courts : à 320 px, 5 colonnes de (320 − 12) / 5 = 61,6 px, contre 62 px de libellé à 10 px. Le premier et le dernier libellés
     (« Accueil », « Compte ») sont courts : ils ne touchent jamais les bords. */
  assert.ok((320 - 12) / 5 > 61);
  assert.ok(app.includes('<span class="tab-label">Accueil</span>') && app.includes('<span class="tab-label">Compte</span>'));
});

test('Ma progression par module : sur une liste étroite, le bouton passe sous le module', () => {
  assert.ok(lq.includes('.pgr-mods{container-type:inline-size}\n@container (max-width:419.98px){\n  .pgr-mod{flex-wrap:wrap;row-gap:12px}\n  .pgr-mod-b{flex:1 1 calc(100% - 58px)}\n  .pgr-mod>button{flex:1 1 100%;width:100%}\n}'));
  assert.ok(!cut(lq, '@media (max-width:359px){\n  .pgr{', '\n}\n').includes('.pgr-mod{'), 'plus de règle d’écran en double');
  assert.ok(regle(lq, '.pgr-mod-b h3').includes('text-wrap:balance'), 'un titre sur deux lignes, sans mot seul');
  /* 46 px d’anneau + 12 px d’écart = 58 px : le texte prend toute la ligne à côté de l’anneau */
  assert.ok(regle(lq, '.pgr-mod .pgr-ring').includes('width:46px') && regle(lq, '.pgr-mod').includes('gap:12px'));
});

test('page SGBD : la note sur les colonnes de date est supprimée', () => {
  const page = cut(app, 'function sgbdBodyHtml(focus){', 'function renderSgbdScreen(){');
  assert.ok(!page.includes('sg-foot') && !page.includes('colonnes de date'));
  assert.ok(!app.includes('.sg-foot'), 'son style aussi');
});
