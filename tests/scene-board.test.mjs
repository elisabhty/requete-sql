/* Scène « dashboard » (board:true) : la scène du Problème du cours « Renommer avec AS » a l'allure du tableau de bord de la
   carte Mission accomplie — tableau blanc, en-têtes en pastilles, questions en bulles sous les en-têtes, nombres à droite. */
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

test('cours 2, Problème : scène dashboard (en-têtes nom et prix, questions repliées au départ, trois produits)', () => {
  const sc = env.scenes[2];
  assert.equal(sc.board, true);
  const lane = k => sc.lanes.find(l => l.k === k);
  assert.equal(lane('H').cls, 'is-head');
  assert.equal(JSON.stringify(lane('H').c.map(c => c[1])), '["nom","prix"]', 'au départ, les noms de la base');
  assert.equal(lane('Q').cls, 'is-ask');
  assert.equal(lane('Q').fold, true, 'les questions n’apparaissent qu’au « Besoin »');
  const last = sc.steps[sc.steps.length - 1];
  assert.equal(JSON.stringify(last.text), '{"h1":"Nom du produit","h2":"Prix (€)"}', 'à la fin, les intitulés clairs');
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
