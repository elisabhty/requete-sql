/* Animation du cours « Renommer avec AS » (« De la table au résultat ») : le résultat est replié au début, donc plus d'espace
   vide sous la table avant que les valeurs n'arrivent. Les vols vers des lignes repliées attendent leur ouverture (flyDelay). */
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {guideEnv} from './helpers/guide-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const env = await guideEnv(root);
const OPEN_MS = 1100;   /* durée de la transition d'ouverture d'une ligne (max-height 1.1s) */

test('moteur des scènes : les vols peuvent être retardés (flyDelay) le temps que les lignes repliées s’ouvrent', () => {
  assert.ok(html.includes('(s.flyDelay||0)+i*(st||150)'), 'flyDelay s’ajoute au décalage de chaque vol');
  assert.ok(/\.pr-lane\{[^}]*transition:[^}]*max-height 1\.1s/.test(html), 'une ligne s’ouvre en 1,1 s');
});

test('cours 2, scène du concept : le résultat (en-têtes et lignes) est replié au début, puis s’ouvre avant le vol des valeurs', () => {
  const sc = env.xscenes[2][0];
  const lane = k => sc.lanes.find(l => l.k === k);
  for (const k of ['G0', 'G1', 'G2']) assert.equal(lane(k).fold, true, `ligne ${k} repliée au départ`);
  assert.ok(!lane('R1').fold && !lane('R2').fold, 'la table de départ reste visible');
  const st = sc.steps.find(s => s.fly);
  assert.equal(JSON.stringify(st.unfold), '["G0","G1","G2"]', 'les trois lignes du résultat s’ouvrent à l’étape du vol');
  assert.ok(st.flyDelay >= OPEN_MS, 'les vols attendent la fin de l’ouverture');
});

test('toute scène qui fait voler des valeurs vers une ligne repliée l’ouvre d’abord et attend son ouverture', () => {
  const all = [...Object.entries(env.scenes), ...Object.entries(env.xscenes).flatMap(([id, a]) => (a || []).map(sc => [id, sc]))];
  for (const [id, sc] of all) {
    const laneOf = new Map();
    for (const l of sc.lanes) for (const c of l.c) laneOf.set(c[0], l);
    const folded = new Set(sc.lanes.filter(l => l.fold).map(l => l.k));
    sc.steps.forEach((st, i) => {
      for (const [, to] of st.fly || []) {
        const l = laneOf.get(to);
        if (!l || !l.k || !folded.has(l.k)) continue;
        assert.ok((st.unfold || []).includes(l.k), `cours ${id}, étape ${i} : la ligne ${l.k} doit être ouverte (unfold) à l’étape du vol`);
        assert.ok((st.flyDelay || 0) >= OPEN_MS, `cours ${id}, étape ${i} : flyDelay ≥ ${OPEN_MS} ms pour viser une ligne qui s’ouvre`);
      }
      for (const k of st.unfold || []) folded.delete(k);
      for (const k of st.fold || []) folded.add(k);
    });
  }
});

test('cours 2, scène du concept : le résultat s’ouvre sur des cases vides en pointillés (pas de vide), légende sans code coupé', () => {
  const sc = env.xscenes[2][0];
  for (const k of ['G1', 'G2']) assert.ok(sc.lanes.find(l => l.k === k).c.every(c => c[2] === 'q'), `ligne ${k} : cases à remplir visibles (q)`);
  assert.ok(!/"/.test(sc.caps[1]), 'la légende du vol ne contient pas de nom entre guillemets, qui se couperait en fin de ligne');
});

test('légendes des scènes : l’ancienne s’efface avant que la nouvelle n’apparaisse (jamais deux textes superposés)', () => {
  assert.ok(/\.pr-cap\{[^}]*transition:opacity \.25s ease,transform \.25s ease\}/.test(html), 'sortie rapide');
  assert.ok(/\.pr-cap\.is-on\{opacity:1;transform:none;transition:opacity \.5s ease \.3s,transform \.5s ease \.3s\}/.test(html), 'entrée après un délai');
});

test('rejouer une scène : elle revient à sa hauteur de départ en douceur (le texte dessous ne saute pas)', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  assert.ok(/const h0=root\.offsetHeight;\s*reset\(\);/.test(mount), 'hauteur mesurée avant la remise à zéro');
  assert.ok(mount.includes("if(again&&stage.animate){await stage.animate([{opacity:1},{opacity:0}]"), 'au rejeu, la scène s’efface un instant avant de revenir au début');
  assert.ok(/if\(h0>h1\+2&&root\.animate\)root\.animate\(\[\{height:h0\+'px'\},\{height:h1\+'px'\}\],\{duration:600/.test(mount), 'repli animé en 0,6 s');
});


test('rejouer une scène : pas de « flash blanc » — les surlignages de la 1re étape sont posés avant le premier calcul de style', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  const i = mount.indexOf('reset();', mount.indexOf('const play=async()=>{'));
  const pre = mount.slice(i, mount.indexOf('const h1=root.offsetHeight;', i));
  assert.ok(pre.includes("if(again){") && pre.includes("each(s0.on,k=>{const e=q(k);if(e)e.classList.add('is-on');});") && pre.includes('s0.mark'), 'is-on et mark de l’étape 1 posés avant la mesure de hauteur');
  assert.ok(/\.pr-c\.is-win\{[^}]*background:var\(--accent-grad,[^}]*\) var\(--accent\)/.test(html), 'dégradé posé sur un fond plein (pas de case vide en le quittant)');
});

test('rejouer une scène : une ligne pâlie au départ le reste (dim posé d’avance, fondu d’entrée après les surlignages)', () => {
  const mount = html.slice(html.indexOf('function mountProbScene('), html.indexOf('/* Emplacements de requête exécutable dans le texte d’un cours. */'));
  const i = mount.indexOf('reset();', mount.indexOf('const play=async()=>{'));
  const pre = mount.slice(i, mount.indexOf('const h1=root.offsetHeight;', i));
  assert.ok(pre.includes("each(s0.dim,k=>{const e=q(k);if(e)e.classList.add('is-dim');});"), 'dim de l’étape 1 posé d’avance');
  assert.ok(pre.indexOf('stage.getAnimations()') > pre.indexOf("each(s0.dim,"), 'getAnimations() (calcul des styles) seulement après les surlignages posés d’avance');
});
