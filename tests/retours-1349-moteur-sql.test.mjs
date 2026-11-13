/* Elisa, 13 novembre, 13 h 49, sur « Les bases de données relationnelles » (la première leçon) : « j’aimerais expliquer ce qu’est une
   requête, et quand on écrit, expliquer ce qu’est un moteur SQL, qui permet de taper le SELECT qu’elle tape ; de plus, tu parles de
   SELECT, ensuite jointure, ensuite les pièges sur SELECT : tu peux échanger ? »
   - Avant la première requête du cours (début du chapitre « Lire une table »), quatre phrases : ce qu’est une requête, le moteur SQL
     (la fenêtre où elle s’écrit, son bouton Exécuter), la console SQL de l’appli. La vidéo s’allonge de 20,5 s, tout le reste suit.
   - Les deux pièges viennent juste après « Choisir les colonnes », puis l’annonce des jointures, juste avant « À retenir ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(ROOT, 'assets/anim/bases-relationnelles.html'), 'utf8');
const bloc = nom => vm.runInContext(page.slice(page.indexOf(`const ${nom} = [`), page.indexOf('\n];', page.indexOf(`const ${nom} = [`)) + 3).replace(`const ${nom} =`, `${nom} =`) + `;${nom}`, vm.createContext({APP: true, DURATION: 548.05, [nom]: null}));
const CAPTIONS = bloc('CAPTIONS'), CHAPTERS = bloc('CHAPTERS');
const plain = h => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const cle = debut => CAPTIONS.find(c => plain(c[2]).startsWith(debut));

test('avant la première requête : ce qu’est une requête, le moteur SQL, la console SQL de l’appli', () => {
  const textes = ['Rappel : une requête est une instruction écrite en SQL, pour lire ou modifier des données.',
    'Une requête s’écrit dans un moteur SQL, comme cette fenêtre.',
    'On y tape la requête, puis on l’exécute : le résultat s’affiche juste en dessous.',
    'Dans l’appli, ton moteur SQL, c’est la console SQL : tu y écriras tes propres requêtes.',
    'Pour lire une table, on écrit SELECT * FROM suivi de son nom.'];
  const lignes = textes.map(t => CAPTIONS.find(c => plain(c[2]) === t));
  lignes.forEach((l, i) => assert.ok(l, textes[i]));
  for (let i = 1; i < lignes.length; i++) assert.ok(lignes[i][0] > lignes[i - 1][1], 'dans l’ordre, sans se chevaucher');
  const ch8 = CHAPTERS.find(c => c.n === 8);
  assert.ok(lignes[0][0] > ch8.a && lignes[4][1] < ch8.b, 'au début du chapitre « Lire une table »');
  /* la fenêtre, puis son étiquette « Moteur SQL », le bouton Exécuter, la console de l’appli, et seulement ensuite la frappe */
  assert.ok(page.includes('<div class="abs badge" id="mot6"><span>⚙️ Moteur SQL</span></div>') && page.includes('<div class="abs badge" id="app6"><span>📱 Dans l’appli : la console SQL</span></div>'));
  assert.ok(page.includes("show('#mot6', 411.45,") && page.includes("bump('#s6run', 417.05, 1.05, 3);") && page.includes("show('#app6', 420.95,") && page.includes("hide(['#mot6', '#app6'], 425.8,"));
  assert.ok(page.includes("te = typeLine($('#q61'), 426.3, 16, false, $('#cols7'));"), 'la frappe part après l’explication');
  /* les mots en gras ne se coupent pas sur deux lignes */
  assert.ok(page.includes('<b class=\\"nw\\">moteur SQL</b>') && page.includes('<b class=\\"nw\\">console SQL</b>'));
  /* leur voix est prête à générer avec les autres légendes muettes du cours */
  const comp = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/voix/bases-relationnelles-complements.json'), 'utf8'));
  const e = comp.elements.find(x => x.id === 'ch08a');
  assert.deepEqual(e.legendes, textes.slice(0, 4));
  assert.equal(e.apres, 'Pour lire une table, on écrit SELECT étoile FROM, suivi de son nom.');
});

test('SELECT, puis les deux pièges, puis l’annonce des jointures, puis « À retenir »', () => {
  const colonnes = cle('Elles sont regroupées dans la table clients'), piege1 = cle('Pour sélectionner plusieurs colonnes'),
    piege6 = cle('Avec une virgule de trop avant FROM'), jointures = cle('Dans une prochaine leçon, tu découvriras les jointures'),
    jointures3 = cle('Tu pourras ainsi retrouver qui a commandé quoi'), retenir = cle('Pour finir, voici les trois idées à retenir');
  assert.ok(colonnes[1] < piege1[0] && piege6[1] < jointures[0] && jointures3[1] < retenir[0]);
  const [c9, c10] = [9, 10].map(n => CHAPTERS.find(c => c.n === n));
  assert.equal(c9.label, 'Choisir les colonnes'); assert.equal(c10.label, 'Deux pièges');
  assert.ok(c9.b === c10.a && colonnes[1] <= c9.b && piege1[0] >= c10.a && jointures3[1] <= c10.b);
  /* les légendes sont dans l’ordre du temps */
  for (let i = 1; i < CAPTIONS.length; i++) assert.ok(CAPTIONS[i][0] >= CAPTIONS[i - 1][0], plain(CAPTIONS[i][2]));
  /* à l’image : la scène des colonnes s’efface avant les pièges ; le tableau des clients revient, avec la carte des jointures, après eux */
  const sOn9 = page.indexOf("sceneOn('#s9', 490.6);"), off6 = page.indexOf("sceneOff('#s6', 490.65);"), sOn6 = page.indexOf("sceneOn('#s6', 520.0);"), off9 = page.indexOf("sceneOff('#s9', 520.05);");
  assert.ok(off6 > 0 && sOn9 > off6 && off9 > sOn9 && sOn6 > off9, 'les scènes dans le nouvel ordre');
  assert.ok(page.includes("show('#jn6', 521.6, {y: 50}, 0.5);") && page.includes("hide(['#tbl6', '#badge7', '#jn6'], 533.9);"));
});

test('la fiche de la leçon et le site : la nouvelle durée', () => {
  /* 14 h 14 : les voix intégrées (la vidéo attend la fin de chaque phrase) : 10 min 48 */
  assert.ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes("thumb:'assets/anim/bases-relationnelles-thumb.webp',duree:'10 min 48'"));
  assert.ok(fs.readFileSync(path.join(ROOT, 'decouvrir/modules.js'), 'utf8').includes('["Les bases de données relationnelles", "Tables, clés et lecture avec SELECT", 648]'));
  assert.ok(page.includes('const DURATION = 548.05;') && page.includes('notesAt: 539.7,'));
});
