/* Elisa, 1er novembre, 21 h 04 : « bien faire le lien entre le cours d’avant et celui d’après » (vidéos du projet), et la voix off
   d’AS, DISTINCT et WHERE (générée sur son Mac, calée ici). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const anim = f => fs.readFileSync(new URL('../assets/anim/' + f, import.meta.url), 'utf8');
const ORDRE = ['normaliser', 'cles', 'uml', 'create', 'alter', 'drop', 'schemas', 'insert', 'update', 'merge', 'delete', 'ondelete',
  'transaction', 'savepoint', 'procedures', 'trigger', 'concurrence', 'vue', 'index', 'droits'];

test('projet : chaque vidéo rappelle le chapitre d’avant (son numéro) et annonce la leçon d’après, avec les mêmes mots', () => {
  ORDRE.forEach((c, k) => {
    const s = anim(`projet-${c}.html`), n = k + 1;
    if (n > 1) assert.ok(s.includes(`Au chapitre ${n - 1}, `), `${c} : « Au chapitre ${n - 1} »`);
    if (n > 2) assert.ok(s.includes('Depuis le chapitre 1, tu construis la base des ateliers bien-être de NutriBoost.'), `${c} : le fil du projet`);
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
  for (const t of ['function voiceInit(){', 'function voiceHolds(base){', 'function voiceOut(){', '  const H0 = voiceHolds(HOLDS0);', '    voice: voiceOut()};'])
    assert.ok(w.includes(t), t);
  assert.ok(w.indexOf('const VOICE = {dir:') < w.indexOf('window.__ready = (async () => {') && w.indexOf('const VOICE = {dir:') > w.indexOf('<script>'), 'VOICE dans le script, avant __ready');
});
