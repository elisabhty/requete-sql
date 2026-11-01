/* Elisa, 1er novembre, 21 h 04 : « bien faire le lien entre le cours d’avant et celui d’après » (vidéos du projet), et la voix off
   d’AS, DISTINCT et WHERE (générée sur son Mac, calée ici). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const anim = f => fs.readFileSync(new URL('../assets/anim/' + f, import.meta.url), 'utf8');
const ORDRE = ['normaliser', 'cles', 'uml', 'create', 'alter', 'drop', 'schemas', 'insert', 'update', 'merge', 'delete', 'ondelete',
  'transaction', 'savepoint', 'concurrence', 'procedures', 'trigger', 'vue', 'index', 'droits'];

test('projet : chaque vidéo rappelle la leçon d’avant et annonce la leçon d’après, avec les mêmes mots', () => {
  /* Elisa, 1er novembre, 21 h 30 : l’app montre des modules et des leçons, pas de « chapitre N » : « Dans la leçon précédente, … »,
     « Depuis le début du module 8, … » (le projet commence au module 8), et l’écran titre dit le module de la leçon. */
  const MODULE = {normaliser: 8, cles: 8, uml: 8, create: 9, alter: 9, drop: 9, schemas: 9, insert: 10, update: 10, merge: 10, delete: 10, ondelete: 11,
    transaction: 12, savepoint: 12, procedures: 13, trigger: 13, concurrence: 12, vue: 14, index: 14, droits: 15};
  ORDRE.forEach((c, k) => {
    const s = anim(`projet-${c}.html`), n = k + 1;
    if (n > 1) assert.ok(s.includes('"Dans la leçon précédente, '), `${c} : « Dans la leçon précédente »`);
    assert.ok(s.includes(`<div class="tagpill">Projet · Module ${MODULE[c]}</div>`), `${c} : module ${MODULE[c]}`);
    const vu = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/ .*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/[Cc]hapitre \d/.test(vu), `${c} : plus de « chapitre N » à l’écran`);
    if (n > 2) assert.ok(s.includes('Depuis le début du module 8, tu construis la base des ateliers bien-être de NutriBoost.'), `${c} : le fil du projet`);
    if (n < ORDRE.length && c !== 'droits') assert.ok(/Dans la prochaine leçon,/.test(s), `${c} : la leçon d’après`);
    assert.ok(!/Dans le prochain (chapitre|module)/.test(s), `${c} : une seule formule`);
  });
});

test('voix off : AS, DISTINCT et WHERE ont leurs phrases calées et leurs fichiers', () => {
  for (const c of ['as', 'distinct', 'where']) {
    const s = anim(`${c}.html`);
    assert.ok(s.includes(`const VOICE = {dir: '../voix/${c}/', intro: ["ch00",`), c);
    const dir = new URL(`../assets/voix/${c}/`, import.meta.url);
    for (const f of ['ch00.mp3', 'ch01.mp3', 'at1.mp3', 'bienvu.mp3', 'finbravo.mp3']) assert.ok(fs.existsSync(new URL(f, dir)), `${c}/${f}`);
  }
  assert.ok(anim('as.html').includes('opens: OPENS, voice: VOICE,') && anim('distinct.html').includes('voice: VOICE,'), 'branchées sur le moteur commun');
  /* WHERE a son propre moteur : la voix y est branchée de la même façon (pauses allongées, clips pour l’app) */
  const w = anim('where.html');
  for (const t of ['function voiceInit(){', 'function voiceHolds(base){', 'function voiceOut(){', '  const H0 = voiceHolds(HOLDS0);', '    voice: pontVoice(voiceOut()),'])
    assert.ok(w.includes(t), t);
  assert.ok(w.indexOf('const VOICE = {dir:') < w.indexOf('window.__ready = (async () => {') && w.indexOf('const VOICE = {dir:') > w.indexOf('<script>'), 'VOICE dans le script, avant __ready');
});
