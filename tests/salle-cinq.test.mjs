import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');

/* Elisa, 8 novembre, 21 h 58 : « montre-moi quand il y a 5 invités (dont moi) ». À cinq, la rangée des présents passait à la ligne
   au hasard (4 + 1, puis 3 + 2 dès que les points grandissaient), la 2e ligne ne tombait pas sous la 1re, et les petits points d’une
   tête de la 2e ligne touchaient le drapeau de la 1re. */
test('salle à cinq : trois colonnes égales, alignées, et la place d’une couronne entre deux lignes', () => {
  assert.ok(css.includes('html.lq #jeu-root .jeu-direct-av{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:21px 10px;margin:0;padding:15px 14px 13px 16px}'),
    'une grille de trois cases égales : chacun garde la sienne quand ses points grandissent');
  assert.ok(!css.includes('.jeu-direct-av{display:flex;flex-wrap:wrap'), 'plus de rangée qui passe à la ligne au hasard');
  const ecart = +css.match(/\.jeu-direct-av\{display:grid;[^}]*gap:(\d+)px/)[1];
  assert.ok(ecart >= 5 + 10 + 4, 'entre deux lignes : le drapeau du dessus (5 px), la coche ou les petits points du dessous (10 px) et de l’air');
  assert.ok(css.includes('  html.lq #jeu-root .jeu-direct-av{gap:19px 8px;padding:14px 11px 12px 13px}'), 'petit écran : les mêmes trois colonnes, un peu serrées');
});

test('salle à cinq : le nombre ne se coupe jamais, l’unité se cache plutôt que de déborder sur le voisin', () => {
  assert.ok(css.includes('html.lq #jeu-root .jd-j-pts{display:flex;flex-wrap:wrap;align-items:baseline;min-width:min-content;height:20px;overflow:hidden;'),
    '« pts » passe à la ligne, hors de vue, quand la case est trop étroite (gros caractères, quatre chiffres)');
  assert.ok(css.includes('html.lq #jeu-root .jd-j-pts small{color:rgba(255,255,255,.66);font:700 11.5px/20px var(--ui);letter-spacing:0}'),
    'l’unité a la hauteur de ligne du nombre : à la ligne, elle sort entièrement de la case');
  assert.ok(css.includes('@media (max-width:380px){html.lq #jeu-root .jd-j-pts small{display:none}}'),
    'sur un petit écran, plus d’unité du tout, comme « pts » dans le cadre blanc du chrono');
  assert.ok(css.includes('  html.lq #jeu-root .jeu-hud .jeu-val small{display:none}'), 'le cadre blanc fait déjà de même');
});
