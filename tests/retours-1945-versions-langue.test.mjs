/* 15 novembre, 19 h 26 (Elisa, sa capture de l’entretien encore en français : « je ne vois pas la traduction sur le site, tu peux
   update l’outil de trad du coup avec tout ça ? ») : les fichiers de langue gardaient la même adresse (langue-en.js?v=7) d’une
   traduction à l’autre, et un navigateur pouvait resservir l’ancienne. Leur adresse porte maintenant l’empreinte de leur contenu
   (tools/langue/versions.mjs) : une traduction qui change, c’est une adresse neuve. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { empreinte, versions } from '../tools/langue/versions.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('chaque fichier de langue a l’adresse de son contenu : rien à mettre à jour (node tools/langue/versions.mjs)', () => {
  assert.deepEqual(versions({ecrire: false}), []);
});

test('l’appli, les vidéos et le service worker demandent la version du jour', () => {
  const vl = empreinte(lire('langues.js')), app = lire('index.html'), sw = lire('sw.js'), moteur = lire('langues.js');
  assert.ok(app.includes(`<script src="langues.js?v=${vl}" data-defis></script>`));
  assert.ok(sw.includes(`'./langues.js?v=${vl}',`));
  for (const f of ['langue-en.js', 'langue-en-defis.js', 'langue-en-entretien.js']) {
    const v = empreinte(lire(f));
    assert.ok(moteur.includes(`'${f}?v=${v}'`), `${f} dans LANGUES`);
    assert.ok(sw.includes(`'./${f}?v=${v}',`), `${f} dans sw.js`);
  }
  const pages = fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html') && lire('assets/anim/' + f).includes('data-textes="{langue}/'));
  assert.equal(pages.length, 72);   // les 71 vidéos des cours, et la vidéo de la fin du SQL (16 novembre : l’anglais ouvert à tous)
  for (const p of pages) assert.ok(lire('assets/anim/' + p).includes(`src="../../langues.js?v=${vl}"`), p);
  assert.ok(!/langues?(-en)?(-defis|-entretien)?\.js\?v=\d'/.test(sw + moteur), 'plus d’adresse fixe');
});

test('les outils qui écrivent un fichier de langue mettent son adresse à jour', () => {
  for (const f of ['construire.mjs', 'defis.mjs', 'entretien.mjs', 'vignettes.mjs'])
    assert.ok(lire('tools/langue/' + f).includes("import { versions } from './versions.mjs';") && lire('tools/langue/' + f).includes('versions()'), f);
});
