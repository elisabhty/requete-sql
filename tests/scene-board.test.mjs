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

test('style dashboard : une ligne mise en avant garde son fond blanc (filet violet à gauche), pas d’aller-retour lilas ↔ blanc', () => {
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-on{box-shadow:inset 3px 0 0 var(--accent)}'));
  assert.ok(!/\.pr-scene\.is-board \.pr-lane\.is-on\{background/.test(html));
  assert.ok(!/\.pr-scene\.is-board \.pr-lane\{[^}]*background-color/.test(html), 'plus de transition de fond sur les lignes');
});

test('cours 2, concept « De la table au résultat » : style dashboard, intitulés d’alias en pastilles pleines dans leur casse exacte', () => {
  const sc = env.xscenes[2][0];
  assert.equal(sc.board, true);
  const lane = k => sc.lanes.find(l => l.k === k);
  assert.equal(JSON.stringify(lane('H').c.map(c => c[1])), '["nom","prix"]');
  assert.equal(lane('G0').cls, 'is-head is-alias');
  assert.equal(JSON.stringify(lane('G0').c.map(c => c[1])), '["Nom du produit","Prix (€)"]');
  assert.ok(lane('G0').c.every(c => !c[2]), 'pas de cellule « th » en majuscules');
  assert.ok(html.includes('.pr-scene.is-board .pr-lane .pr-c.pr-q:empty{'), 'emplacements en pointillés tant que les valeurs n’ont pas volé');
});

test('cours DISTINCT, Problème : une ville par client (vrais clients 1 à 6), doublons signalés puis repliés, seule la liste des villes reste', () => {
  const sc = env.scenes[13];
  assert.equal(sc.board, true);
  const rows = sc.lanes.filter(l => /^R/.test(l.k)).map(l => l.c.map(c => c[1]).join(' '));
  assert.equal(JSON.stringify(rows), JSON.stringify(['Paris Sophie', 'Lyon Lucas', 'Marseille Emma', 'Paris Nathan', 'Bordeaux Chloé', 'Lyon Hugo']));
  const [s0, s1, s2] = sc.steps;
  assert.equal(JSON.stringify(s1.mark), '{"c4":"is-miss","c6":"is-miss"}', 'les répétitions de Paris et Lyon');
  assert.equal(JSON.stringify(s2.fold), '["R4","R6"]', 'les lignes en double se replient');
  assert.ok(s2.gone.includes('h2') && ['p1', 'p2', 'p3', 'p5'].every(k => s2.gone.includes(k)), 'la colonne client disparaît : il ne reste que les villes');
});
