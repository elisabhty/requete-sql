/* Elisa, 15 novembre, 22 h 05 : « est-ce que tu peux voir si c’est ok pour les vidéos, parfois il y a des badges qui dépassent…
   surtout avant les moments j’ai l’impression que ça saute un peu ». Les 71 vidéos anglaises passées aux contrôles du moteur (?check) et
   à tools/langue/verifier.mjs, comparées aux françaises :
   - l’étincelle de l’intro tombait sur la pastille « 6 “Your turn” moments » (mesurée avant le chargement de la police) ;
   - les légendes dont les retours voulus du français donnaient 4 lignes s’équilibrent sur 3 ;
   - cinq badges ou cases qui dépassaient ; l’adresse du service client en anglais ;
   - avant un moment « À toi », l’image descend vers la feuille en douceur (0,46 s) et la caméra revient en 0,24 s. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const core = lire('assets/anim/core.js'), where = lire('assets/anim/where.html'), app = lire('index.html');

test('l’étincelle de l’intro se replace une fois les polices chargées (core.js et where.html)', () => {
  for (const [nom, s] of [['core.js', core], ['where.html', where]]) {
    assert.ok(s.includes("if (pl && s2 && sub) { s2.style.left = s2.style.top = '';"), `${nom} : depuis sa place d’origine`);
    assert.ok(s.includes("document.fonts.ready.then(placer); document.fonts.addEventListener('loadingdone', placer);") && s.includes('setTimeout(placer, 600);'), nom);
  }
});

test('une légende anglaise que les retours du français font passer à 4 lignes s’équilibre sur 3', () => {
  for (const [nom, s] of [['core.js', core], ['where.html', where]]) {
    assert.ok(s.includes("if (LG && p.querySelector('br') && capLignes(p) > Math.max(3, +(p.closest('.c').dataset.lines || 0))) p.querySelectorAll('br').forEach(b => b.replaceWith(' '));"), nom);
  }
});

test('les badges et les cases qui dépassaient en anglais', () => {
  assert.ok(lire('assets/anim/and-or.html').includes('html[lang="en"] .rgB{grid-template-columns:180px 170px 175px 76px 70px 70px 165px!important}'), '« ✕ left out » dans sa colonne');
  assert.ok(lire('assets/anim/ordre-execution.html').includes('html[lang="en"] #or2 .oh,html[lang="en"] #or2 .orow{grid-template-columns:96px 1fr 112px}'), 'la pastille 5 dans la carte');
  assert.ok(lire('assets/anim/en/bases-relationnelles.js').includes('"Service client": "Support",'), 'le curseur ne couvre plus Magnesium');
  assert.ok(lire('assets/anim/en/jointure-3-tables.js').includes('"Le prénom et le nom du client": "First and last name",'), 'l’étiquette customers table dans sa carte');
  assert.ok(lire('assets/anim/en/projet-normaliser.js').includes('"inscrit le": "enrolled",'), 'l’en-tête dans sa colonne');
  for (const c of ['projet-delete', 'projet-ondelete', 'projet-savepoint', 'projet-transaction', 'projet-update'])
    assert.ok(lire(`assets/anim/en/${c}.js`).includes('"service.client@nutriboost.fr": "support@nutriboost.fr",\n    "SC": "CS",'), c);
});

test('avant un moment « À toi » : l’image descend en douceur, la caméra revient en 0,24 s', () => {
  assert.ok(app.includes('const glisse=Math.abs(dy-d0)>40, t0=performance.now(), D=glisse?460:200;'));
  assert.ok(app.includes('e=glisse?(t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2):1-Math.pow(1-t,3);'));
  assert.ok(core.includes('const [z, o] = camAt(CAM.t || 0), t0 = performance.now(), D = 240;'));
  assert.ok(where.includes('const [z, o] = camAt(CAM.t || 0), t0 = performance.now(), D = 240;'));
});
