/* Elisa, 7 novembre, 8 h 17 (une capture, sans texte) : Bibliothèque › Cartes mémo, module 02 « Lire une table ». Sur les cartes à
   débloquer, la pastille blanche « Voir la leçon » s’arrêtait après « Vo » et la flèche se posait sur le « o ».
   La cause : sa taille de texte suivait la largeur de la carte (100cqi). Safari mesurait la pastille avant de connaître cette largeur :
   min(12,5 px ; (0 - 56 px) / 6,6) donnait un texte de taille 0, donc une pastille de 38 px (marges et flèche), et il ne la remesurait
   pas une fois la carte posée. Le texte, lui, s’affichait à la bonne taille, par-dessus. Chrome, qui attend la carte, n’avait rien.
   La taille suit maintenant la largeur de l’écran (vw), toujours connue : la pastille se mesure juste du premier coup. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ludique.css'), 'utf8');
const regles = [...css.matchAll(/html\.lq \.mc-go\{([^}]*)\}/g)].map(m => m[1]);

test('« Voir la leçon » ne dépend plus de la largeur de la carte (cqi), que Safari lisait trop tôt', () => {
  assert.equal(regles.length, 2, 'la pastille et sa version des petits écrans');
  for (const r of regles) assert.ok(!/\dcq(?:i|b|w|h|min|max)\b/.test(r), r);
  assert.ok(regles[0].includes('font-size:min(calc(12.5px * var(--mc-fs)),calc((50vw - var(--gut,20px) - 92px) / 6))'), regles[0]);
  assert.ok(css.includes('@media (max-width:360px){html.lq .mc-go{gap:4px;padding:5px 6px 5px 9px;font-size:min(calc(12.5px * var(--mc-fs)),calc((50vw - var(--gut,20px) - 79px) / 6))}}'));
  assert.ok(regles[0].includes('align-self:flex-start;display:inline-flex;align-items:center;gap:5px;max-width:100%') && regles[0].includes('white-space:nowrap'),
    'toujours une pastille à la taille de son texte, sur une ligne');
  assert.ok(app.includes('<span class="mc-go">Voir la leçon${MEMO_GO_SVG}</span>'), 'le même texte, la même flèche');
});

test('la pastille tient dans la carte de 320 à 1 024 px, en texte normal et plus grand, et reste lisible', () => {
  /* Les mesures dont dépend la formule : si l’une change, la formule est à revoir */
  for (const k of ['html.lq .coll-grid.mc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:16px 12px;padding:8px 14px 18px;',
    '@media (min-width:600px){html.lq .coll-grid.mc-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}',
    '@media (max-width:360px){html.lq .coll-grid.mc-grid{gap:14px 10px;padding:8px 11px 16px}html.lq .mc--album :is(.mc-face,.mc-back){padding:10px 10px 11px}}',
    'min-height:calc(148px * var(--mc-fs));padding:11px 12px 12px;\n  border:3px solid #fff;', '@media (max-width:350px){html.lq #app{--gut:14px}}',
    'html.lq #app #scr-collection #cards-grid,', 'html.lq[data-reading="large"]{--mc-fs:1.15}', 'html.lq .mc-go svg{flex:none;width:14px;height:14px;'])
    assert.ok(css.includes(k), k);
  assert.ok(regles[0].includes('padding:5px 8px 5px 11px'));
  /* « Voir la leçon » en Bricolage Grotesque 800 : 5,93 fois la taille du texte ; en Inter, si elle manque : 6,07 */
  for (const largeur of [5.94, 6.07]) for (const mcFs of [1, 1.15]) for (let w = 320; w <= 1024; w++) {
    const etroit = w <= 360, gut = w <= 350 ? 14 : 20;
    /* Deux colonnes jusqu’à 599 px dans l’app (520 px au plus) ; au-delà, des cartes d’au moins 160 px */
    const carte = w >= 600 ? 160 : (Math.min(w, 520) - 2 * gut - 4 - (etroit ? 22 + 10 : 28 + 12)) / 2;
    const place = carte - 6 - (etroit ? 20 : 24);
    const taille = Math.min(12.5 * mcFs, (w / 2 - gut - (etroit ? 79 : 92)) / 6);
    const pastille = largeur * taille + (etroit ? 9 + 6 + 4 : 11 + 8 + 5) + 14;
    assert.ok(pastille <= place, `${w} px, texte ×${mcFs}, police ${largeur} : ${pastille.toFixed(1)} > ${place.toFixed(1)}`);
    assert.ok(taille >= 11, `${w} px : ${taille.toFixed(2)} px`);
    if (w >= 375 && mcFs === 1) assert.equal(taille, 12.5, `${w} px : la taille pleine sur un iPhone`);
  }
});
