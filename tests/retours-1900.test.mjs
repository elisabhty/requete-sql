/* Elisa, 6 novembre, 19 h : « Ne pas dire que le merge n’existe pas dans l’appli ». La leçon MERGE (82) ne le dit plus nulle part :
   ni la vidéo (la phrase du chapitre 7 est retirée, le chapitre s’appelle « Une autre écriture » et commence par « On obtient le même
   résultat avec ON CONFLICT »), ni son récapitulatif, ni la fiche, ni la carte mémo. La voix d’Anaïs de ce chapitre est refaite sans
   la phrase ; en attendant, la voix d’Emily joue les autres phrases du chapitre, et la phrase retirée n’a plus de légende.
   6 novembre, 21 h 45 : la voix d’Anaïs est intégrée (les 20 cours), avec ce chapitre refait. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), page = read('assets/anim/projet-merge.html'), job = JSON.parse(read('tools/voix/projet-merge.json'));
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const sansCommentaires = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const nExistePas = /MERGE(<\/code>)?\s*(<b>)?\s*n’existe pas|meurdje n’existe pas/;

test('la vidéo MERGE ne dit plus que MERGE n’existe pas dans l’app', () => {
  assert.ok(!nExistePas.test(sansCommentaires(page)), 'ni légende ni récapitulatif');
  assert.ok(!/SQLite/.test(sansCommentaires(page.slice(page.indexOf('<body'), page.indexOf('/* Voix off')))), 'ni SQLite à l’écran');
  assert.ok(page.includes("chap({label:'Une autre écriture'});\ncap('c30', \"On obtient le même résultat<br>avec <code>ON CONFLICT</code>, vu dans la leçon INSERT.\", 4.6, 0.6);"),
    'le chapitre 7 commence par la phrase qui suit');
  assert.ok(!/cap\('c29'/.test(page) && !/A\.c29|B\.c29/.test(page), 'la légende retirée, et tout ce qui s’y calait');
  assert.ok(page.includes("sceneOn('#sl', A.c30 - 0.5);\n  show('#eq', A.c30 - 0.3, {y: 40}, 0.5);"), 'l’éditeur arrive avant la légende, comme avant');
  assert.ok(page.includes("editor('eq', 'sans-merge.sql', [\n    ['eq0', '-- Le même résultat, sans MERGE'],"));
  assert.ok(page.includes('<div class="rtxt">La synchronisation peut<br>aussi s’écrire <b>autrement</b>.<span class="rs">On obtient le même résultat<br>avec <code>INSERT … ON CONFLICT DO UPDATE</code>.</span></div>'));
});

test('la voix : plus de phrase pour la légende retirée ; celle d’Anaïs refaite sans elle', () => {
  const voice = page.slice(page.indexOf('const VOICE = {'), page.indexOf('/* Fin de la voix off */'));
  assert.ok(!voice.includes('"v78wglr"'), 'l’ancienne phrase n’a plus de légende : elle ne joue plus');
  /* 6 novembre, 21 h 45 : la voix d’Anaïs est intégrée ; la première légende du chapitre 7 a sa phrase, refaite sans « MERGE n’existe pas ». */
  assert.ok(voice.includes('["v1qy1taq","ch07",'), 'la légende qui ouvre le chapitre 7 a sa phrase');
  assert.ok(page.includes('<html lang="fr" class="tr-f tr-anais">') && page.includes('voix Anaïs d’ElevenLabs'), 'la voix d’Anaïs');
  const ch07 = job.elements.find(e => e.id === 'ch07'), ch06 = job.elements.find(e => e.id === 'ch06');
  assert.ok(!nExistePas.test(JSON.stringify(job)), 'ni dite, ni en contexte');
  assert.equal(ch07.phrases[0], 'On obtient le même résultat avec onne konnflikte, vu dans la leçon innseurte.');
  assert.equal(ch06.apres, ch07.phrases[0], 'le chapitre d’avant enchaîne sur la nouvelle première phrase');
  assert.equal(ch07.legendes.length, 4);
  assert.equal(job.voix.nom, 'Anaïs');
});

test('Procédures et fonctions stockées (19 h 56) : pas non plus de « elles n’existent pas » dans la base de l’app', () => {
  const p = read('assets/anim/projet-procedures.html'), pj = JSON.parse(read('tools/voix/projet-procedures.json'));
  assert.ok(!/n’existent pas|n’en a pas/.test(sansCommentaires(p)), 'ni légende ni récapitulatif');
  assert.ok(!p.includes('"vfhdepi"'), 'la voix de la phrase retirée ne joue plus');
  assert.ok(p.includes("  hide('#eg', B.c29 - 0.1, {y: -30}, 0.4);"), 'la carte PostgreSQL s’en va avec la dernière légende qui la montre');
  assert.ok(!/existent pas/.test(JSON.stringify(pj)), 'le chapitre 7 d’Anaïs, refait sans la phrase');
  const l83 = cut('guide({ id:83, titre:"Procédures et fonctions stockées"', 'guide({ id:70,');
  assert.ok(!/n’en a pas|n’existent pas/.test(sansCommentaires(l83)) && l83.includes("duree:'3 min 17'"), 'la durée avec la voix d’Anaïs');
  const carte = cut(' 83:{k:"PROCÉDURE', '\n 57:{k:"INDEX');
  assert.ok(!carte.includes('base de l’app') && carte.includes('une procédure écrite pour PostgreSQL ne se recopie pas telle quelle ailleurs.'));
});

test('la fiche de la leçon et la carte mémo disent l’autre écriture, sans dire que MERGE manque', () => {
  const l82 = cut('guide({ id:82, titre:"MERGE"', 'guide({ id:28,');
  assert.ok(!nExistePas.test(sansCommentaires(l82)));
  assert.ok(l82.includes('["🔁","La synchronisation peut aussi s’écrire <b>autrement</b>.","On obtient le même résultat avec <code>INSERT … ON CONFLICT DO UPDATE</code>."]'));
  assert.ok(l82.includes("duree:'3 min 11'"), 'la durée remesurée avec la voix d’Anaïs (201 → 197 s sans la phrase, 191 s avec Anaïs)');
  const carte = cut(' 82:{k:"MERGE"', '\n 28:{k:"DELETE"');
  assert.ok(carte.includes('"Le même résultat s’obtient aussi avec <code>INSERT … ON CONFLICT DO UPDATE</code>."') && !carte.includes('base de l’app'));
  assert.ok(read('decouvrir/modules.js').includes('["MERGE", "Synchroniser deux tables", 191],'), 'la vitrine suit');
});
