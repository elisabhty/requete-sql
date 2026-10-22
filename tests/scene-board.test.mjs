/* Scène « dashboard » (board:true) : l'allure du tableau de bord de la carte Mission accomplie — tableau blanc, en-têtes en
   pastilles, questions en bulles sous les en-têtes, nombres à droite (moteur et style ; les scènes des cours 2, 5, 6, 7, 13
   et 22 étaient dans le cours texte de ces cours en vidéo, retiré). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const env = await guideEnv(root);

test('moteur des scènes : board:true donne la classe is-board', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  assert.ok(mount.includes("root.classList.toggle('is-board',!!cfg.board);"));
});

test('style dashboard : la bande des questions reste lilas quand elle s’ouvre ou se replie (pas de trou blanc), seules les bulles disparaissent', () => {
  assert.ok(/\.pr-scene\.is-board \.pr-lane\.is-ask,\.pr-scene\.is-board \.pr-lane\.is-ask\.is-fold\{opacity:1;overflow:hidden;[^}]*background:var\(--accent-soft\)/.test(html), 'bande opaque, contenu rogné');
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-ask.is-fold .pr-c{opacity:0;'), 'les bulles s’effacent');
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-fold{padding-top:0;padding-bottom:0}'), 'une ligne repliée ne garde pas de marge intérieure');
});

test('style dashboard : en-tête mal compris en pointillés rouges, intitulé clair en pastille pleine', () => {
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-head .pr-c.is-miss{border-style:dashed;'));
  assert.ok(/\.pr-scene\.is-board \.pr-lane\.is-head \.pr-c\.is-got\{[^}]*background:var\(--accent-grad/.test(html));
  assert.ok(html.includes('@media (prefers-reduced-motion:reduce){.pr-scene *{transition:none!important}.pr-scene.is-board .pr-c{animation:none!important}}'), 'mouvement réduit');
});

test('style dashboard : une ligne mise en avant garde son fond blanc (filet violet à gauche), pas d’aller-retour lilas ↔ blanc', () => {
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-on{box-shadow:inset 3px 0 0 var(--accent)}'));
  assert.ok(!/\.pr-scene\.is-board \.pr-lane\.is-on\{background/.test(html));
  assert.ok(!/\.pr-scene\.is-board \.pr-lane\{[^}]*background-color/.test(html), 'plus de transition de fond sur les lignes');
});

