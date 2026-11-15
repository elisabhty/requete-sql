/* Elisa, 15 novembre, 21 h 36 : « j’ai fait la commande pour générer les voix… dis-moi s’il manque quelque chose ». Rien ne manquait
   sur le Mac (73 fichiers de voix, 1 374 fichiers) : les 52 vidéos qui restaient parlent anglais, et la vidéo du site anglais aussi.
   - Chaque vidéo a sa voix anglaise (assets/anim/en/<cours>.js, fichiers dans assets/voix/en/<cours>/), sa durée anglaise
     (LV_DUREES) et sa vignette.
   - GROUP BY a ses réactions (« Bien vu ! »…) : sur le Mac, generer.mjs les comptait faites parce qu’elles étaient dans
     sortie/en/group-by-colonnes (un dossier qui commence par « group-by- ») ; elles y ont été reprises, mot pour mot, même voix.
   - La vidéo du site anglais (decouvrir/en/video.html) a ses 17 phrases et la musique de la vidéo française. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const cours = fs.readdirSync(path.join(ROOT, 'tools/voix/en')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).filter(c => c !== 'avis' && c !== 'video-site');

test('les 71 vidéos parlent anglais : voix, fichiers, durée', () => {
  assert.equal(cours.length, 71);
  const durees = /const LV_DUREES=\{en:\{(.*?)\}\};/.exec(app);
  assert.ok(durees);
  for (const c of cours) {
    const js = lire(`assets/anim/en/${c}.js`);
    assert.ok(js.includes(`{voix: {dir: '../voix/en/${c}/'`), `${c} : sa voix`);
    const mp3 = fs.readdirSync(path.join(ROOT, `assets/voix/en/${c}`)).filter(f => f.endsWith('.mp3'));
    assert.ok(mp3.length > 15, `${c} : ${mp3.length} fichiers`);
    assert.match(durees[1], new RegExp(`'${c}':'\\d+ min \\d\\d'`), `${c} : sa durée`);
    assert.ok(fs.existsSync(path.join(ROOT, `assets/anim/en/${c}-thumb.webp`)), `${c} : sa vignette`);
  }
});

test('GROUP BY a ses réactions en anglais', () => {
  for (const id of ['bienvu', 'rattrape', 'presque', 'finbravo', 'fineffort']) {
    assert.ok(fs.existsSync(path.join(ROOT, `assets/voix/en/group-by/${id}.mp3`)), id);
    assert.ok(lire('assets/anim/en/group-by.js').includes(`"${id}":["${id}",`), id);
  }
});

test('la vidéo du site anglais a sa voix', () => {
  const v = JSON.parse(lire('decouvrir/en/voix/voix.json'));
  assert.equal(v.scenes.length, 17);
  for (const s of v.scenes) assert.ok(fs.existsSync(path.join(ROOT, `decouvrir/en/voix/${s.id}.mp3`)), s.id);
  assert.ok(fs.existsSync(path.join(ROOT, 'decouvrir/en/voix/musique.mp3')));
});
