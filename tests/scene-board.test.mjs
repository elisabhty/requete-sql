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

test('cours 5, étape « Inclure ou exclure la limite » : tableau des opérateurs animé (limite exclue puis incluse)', async () => {
  const vm = await import('node:vm');
  const sc = vm.runInContext('GUIDE_XSCENES[5]', env.ctx).find(s => /opérateurs/.test(s.h));
  assert.ok(sc && sc.board, 'scène dashboard');
  const lane = k => sc.lanes.find(l => l.k === k);
  assert.equal(JSON.stringify(lane('H').c.map(c => c[1])), '["opérateur","limite"]');
  for (const [k, op] of [['EQ', '='], ['NE', '!='], ['GT', '&gt;'], ['LT', '&lt;'], ['GE', '&gt;='], ['LE', '&lt;=']]) assert.ok(lane(k).c[0][1].startsWith(`<b class="pr-op">${op}</b>`), `opérateur ${op} en tête de ligne`);
  const [s0, s1, s2] = sc.steps;
  assert.ok(!s0.on, 'au départ, aucune ligne mise en avant');
  assert.equal(JSON.stringify(s1.on), '["GT","LT"]');
  assert.equal(JSON.stringify(s1.text), '{"l3":"exclue","l4":"exclue"}');
  assert.equal(JSON.stringify(s1.mark), '{"l3":"is-out","l4":"is-out"}');
  assert.equal(JSON.stringify(s2.on), '["GE","LE"]');
  assert.equal(JSON.stringify(s2.text), '{"l5":"incluse","l6":"incluse"}');
  assert.equal(JSON.stringify(s2.mark), '{"l5":"is-in","l6":"is-in"}');
  assert.ok(html.includes('font-variant-ligatures:none'), 'opérateurs sans ligatures : on voit >= et non ≥');
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-wrap .pr-c.pr-q:empty{min-width:52px}'), 'l’emplacement vide a la largeur de la pastille');
});

test('cours 5, Problème : « Suivi des stocks » en dashboard, stocks bas (60 et 45) en pastille ambrée, puis seuls les produits à recommander', () => {
  const sc = env.scenes[5];
  assert.equal(sc.board, true);
  const lane = k => sc.lanes.find(l => l.k === k);
  assert.equal(JSON.stringify(lane('H').c.map(c => c[1])), '["nom","stock"]');
  assert.equal(JSON.stringify(sc.lanes.slice(1).map(l => l.c[1][1])), '["120","80","200","60","45","90"]', 'les produits 1, 2, 3, 5, 6, 7 dans l’ordre de la table');
  const [, s1, s2] = sc.steps;
  assert.equal(JSON.stringify(s1.mark), '{"d2":"is-low","e2":"is-low"}', 'la limite (60) est signalée comme un stock plus bas (45)');
  assert.equal(JSON.stringify(s2.fold), '["R1","R2","R3","R6"]');
  assert.equal(JSON.stringify(s2.on), '["R4","R5"]');
  for (const c of sc.caps) assert.ok(!/WHERE|&lt;=|<=|opérateur|condition/.test(c), `légende générale, sans la solution : ${c}`);
  assert.ok(html.includes('.pr-scene.is-board .pr-lane:not(.is-head):not(.is-ask) .pr-c.is-low:last-child:not(:first-child){'), 'pastille « stock bas »');
});

test('cours 6 (AND et OR) : Problème « soulignés deux fois », concept « Client par client » en balayage, « Deux lectures » sans parenthèses', async () => {
  const vm = await import('node:vm');
  const p = env.scenes[6];
  assert.equal(p.board, true);
  assert.equal(JSON.stringify(p.steps[1].mark), '{"a2":"is-low","b2":"is-low","d2":"is-low","e2":"is-low","f2":"is-low"}', 'les villes Paris et Lyon soulignées');
  assert.equal(JSON.stringify(p.steps[2].mark), '{"a3":"is-low","d3":"is-low","e3":"is-low"}', 'puis les âges de plus de 30 ans');
  for (const c of p.caps) assert.ok(!/AND|OR|WHERE|parenth/.test(c), `légende générale : ${c}`);
  const xs = vm.runInContext('GUIDE_XSCENES[6]', env.ctx);
  const c = xs.find(s => /Client par client/.test(s.h)), d = xs.find(s => /Deux lectures/.test(s.h));
  assert.equal(c.steps[0].sweep, 220, 'les réponses arrivent client par client');
  assert.ok(Object.values(c.steps[0].mark).includes('is-fail') && Object.values(c.steps[1].mark).includes('is-pass'));
  assert.equal(JSON.stringify(d.steps[1].mark), '{"a2":"is-pass","d2":"is-pass","e2":"is-pass","a3":"is-skip","d3":"is-skip","e3":"is-skip"}', 'sans parenthèses, l’âge des Parisiens ne compte plus');
  assert.ok(html.includes("if(s.mark)Object.keys(s.mark).forEach((k,i)=>later(()=>q(k).classList.add(s.mark[k]),i*(s.sweep||0),now));"), 'moteur : balayage des marques');
  assert.ok(html.includes('.pr-scene.is-board .pr-lane.is-head .pr-c.is-now{'), 'en-tête de la colonne vérifiée');
});

test('cours 7 (NULL), Problème : « Envoi du questionnaire » — adresses validées une à une, cases vides signalées, puis seuls les clients sans adresse', () => {
  const p = env.scenes[7];
  assert.equal(p.board, true);
  const lane = k => p.lanes.find(l => l.k === k);
  assert.equal(JSON.stringify(lane('R4').c[1]), '["d2","","q"]', 'Hugo : case vide au départ');
  assert.equal(p.steps[1].sweep, 220, 'les adresses sont validées une à une');
  assert.equal(JSON.stringify(p.steps[2].mark), '{"d2":"is-fail","f2":"is-fail"}', 'les deux cases vides en rouge');
  assert.equal(JSON.stringify(p.steps[3].on), '["R4","R6"]', 'Hugo et Inès restent');
  for (const c of p.caps) assert.ok(!/NULL|IS |WHERE/.test(c), `légende générale : ${c}`);
});
