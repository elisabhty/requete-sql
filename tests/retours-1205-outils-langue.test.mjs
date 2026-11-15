/* Elisa, 15 novembre, 12 h 05 : « Oui, range les outils. Et fais ce que tu voulais faire sur la vidéo, fais tout ce que tu veux.
   Sur les vidéos en français et en anglais du coup. Pour avoir un bon modèle pour la suite. »
   - Les outils de traduction vivent dans tools/langue/ (récolte, clés, construction, vérification, comparaison au français, planches,
     vignettes, fiches) avec leur README ; leur dossier de travail n'entre pas dans le dépôt.
   - Les sous-titres : quand la phrase suivante arrive moins de 2,5 s après, la bulle reste ouverte et change de texte au lieu de se
     vider puis de revenir (moins de bulles vides : 69,8 s → 16,8 s sur 8 vidéos d'essai).
   - La pastille du chapitre, dans une autre langue que le français, se resserre (jusqu'à 72 %) si elle toucherait le logo.
   - « 1 à 20 » et « À : » se traduisent enfin (un « à » seul compte comme du texte). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const core = lire('assets/anim/core.js');
const moteur = lire('langues.js');

test('les outils de traduction sont rangés dans tools/langue, avec leur mode d’emploi', () => {
  for (const f of ['commun', 'recolter', 'cles', 'construire', 'verifier', 'francais', 'planches', 'vignettes', 'fiches'])
    assert.ok(fs.existsSync(path.join(ROOT, 'tools/langue', f + '.mjs')), f);
  const lisez = lire('tools/langue/README.md');
  for (const mot of ['recolter.mjs', 'construire.mjs', 'verifier.mjs', '--langue']) assert.ok(lisez.includes(mot), mot);
  assert.ok(lisez.includes('langueFit'), 'le README dit que seule la pastille se resserre');
  assert.ok(lire('.gitignore').includes('tools/langue/travail/'));
});

test('les outils se chargent sans erreur de syntaxe', async () => {
  for (const f of ['commun', 'cles']) {
    const src = lire('tools/langue/' + f + '.mjs');
    assert.ok(src.length > 200, f);
  }
  const commun = await import('../tools/langue/commun.mjs');
  assert.equal(typeof commun.videos, 'function');
  assert.ok(commun.videos().length >= 71);
});

test('une phrase qui suit de près garde la bulle ouverte (pas de bulle vide entre deux phrases)', () => {
  const i = core.indexOf('function chromeTimeline(');
  const bloc = core.slice(i, i + 4000);
  assert.ok(bloc.includes('const suite = captions[i + 1]'));
  assert.ok(/suite\[0\] - captions\[i\]\[1\] <= 2\.5 \? suite\[0\] : captions\[i\]\[1\]/.test(bloc));
});

test('la pastille du chapitre se resserre en anglais quand elle toucherait le logo, jamais sous 72 %', () => {
  const d = core.indexOf('const langueFit = () => {'), f = core.indexOf('};', d);
  assert.ok(d > 0);
  const src = core.slice(d, f);
  assert.ok(src.includes('if (!LG) return;'), 'rien ne bouge en français');
  assert.ok(src.includes("$('#header .brand')") && src.includes('if (f < 0.72) return;'));
  const ordre = core.indexOf('langueFit();', core.indexOf('thFit();')) ;
  assert.ok(ordre > 0 && ordre < core.indexOf('chromeTimeline(chapters, captions, duration);', ordre));
});

test('un « à » seul compte comme du texte : « 1 à 20 » et « À : » sont notés et traduits', () => {
  assert.ok(moteur.includes('/(^|[\\s\\d])[àÀ](?=[\\s\\d:\\u00a0]|$)/.test(s)'));
  assert.ok(moteur.includes('/(^|[\\s\\d])[àÀ](?=[\\s\\d:\\u00a0]|$)/.test(nu)'));
  const ex = lire('assets/anim/en/exists.js'), lo = lire('assets/anim/en/limit-offset.js');
  assert.ok(ex.includes('"À :": "To:"') && ex.includes('"Aucun": "None"'));
  assert.ok(lo.includes('"{1} à {2}": "{1} to {2}"'));
});
