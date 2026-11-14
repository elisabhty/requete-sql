/* Elisa, 14 novembre, 9 h 19 : « T’as testé pour un iPhone SE pour voir si on voit tout bien ». L’appli passée à 375 × 667 (onglets,
   71 pages de départ des leçons, 477 défis, 142 questions d’entretien, console et schéma des 16 bases, salle à trois, accueil d’un
   nouvel utilisateur) : deux textes coupés. « Base relationn… » (le nom de la prochaine carte mémo, à côté de « Voir la leçon » ;
   « GROUP_CONCAT » ou « Normalisation » l’étaient aussi sur les autres iPhone) et « Choisis ton pse… » (Mon compte). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');

test('la prochaine carte mémo : le nom va à la ligne, le bouton passe dessous s’il manque de place', () => {
  for (const r of ['html.lq #app .coll-overview-next.has-next{flex-wrap:wrap;row-gap:12px}',
    'html.lq #app .coll-overview-next.has-next>span:not(.coll-next-card){flex:1 1 150px}',
    'html.lq #app .coll-overview-next.has-next>button{flex:1 0 auto}',
    'html.lq #app .coll-overview-next.has-next b{white-space:normal!important;text-overflow:clip!important}'])
    assert.ok(css.includes(r), r);
});

test('Mon compte, sans pseudo : l’invitation tient en entier sur un écran étroit', () => {
  assert.ok(css.includes('@media (max-width:380px){html.lq #scr-compte .plus-details-body>.acc-pseudo.is-vide .acc-pseudo-t b{font-size:18px}}'));
});
