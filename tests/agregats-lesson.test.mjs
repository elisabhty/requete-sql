/* SUM, AVG, MIN et MAX (leçon 85), ajoutée le 1er novembre (Elisa, 22 h 47 : « fais la leçon de manière gamifiée ») : entre COUNT et
   GROUP BY, la leçon qui manquait. La vidéo (assets/anim/agregats.html, moteur commun) remplit les quatre compteurs du tableau de bord
   du stock, une étoile par compteur. Ici : chaque valeur montrée est celle que SQLite calcule sur la base de l’app ; la leçon est à sa
   place, branchée partout (carte mémo, recherche, liens, vitrine, hors ligne). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), page = read('assets/anim/agregats.html');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), ctx);
const lessons = vm.runInContext('MODULES', ctx).flatMap(m => m.lessons);
const ids = lessons.map(l => l.id), l85 = lessons.find(l => l.id === 85);
const SQL = await createRequire(import.meta.url)(path.join(root, 'vendor/sqljs/sql-wasm.js'))({locateFile: f => path.join(root, 'vendor/sqljs', f)});
const db = new SQL.Database(); db.run(vm.runInContext('SCHEMA_SQL', ctx));
const one = q => db.exec(q)[0].values[0];
/* Les données de la page, évaluées telles quelles */
const D = vm.createContext({APP: true});
vm.runInContext(page.slice(page.indexOf('const DURATION ='), page.indexOf('/* Pas de question en pleine vidéo')).replace(/^const /gm, 'var '), D);
const val = e => JSON.parse(vm.runInContext(`JSON.stringify(${e})`, D));
const momentsSrc = page.slice(page.indexOf('const MOMENTS = ['), page.indexOf('/* Le tableau de bord : les quatre compteurs'));

test('la leçon : entre COUNT et GROUP BY, dans le module des agrégats, une vidéo seule, trois moments', () => {
  assert.equal(ids[ids.indexOf(14) + 1], 85, 'juste après COUNT');
  assert.equal(ids[ids.indexOf(85) + 1], 16, 'juste avant GROUP BY');
  assert.equal(l85.titre, 'SUM, AVG, MIN et MAX');
  assert.equal(l85.résumé, 'Somme, moyenne, minimum et maximum');
  assert.ok(l85.leconSeule && l85.video.anim === 'assets/anim/agregats.html?app&embed' && l85.video.moments === 3 && l85.video.seuil === 2);
  const carte = vm.runInContext('CARTES[85]', ctx);
  assert.ok(carte && carte.s.includes('ROUND(AVG(prix), 2)') && carte.s.includes('MIN(prix), MAX(prix)'), 'une carte mémo à débloquer');
  assert.ok(/\n {2}85:'sum avg min max somme moyenne/.test(html), 'trouvée par la recherche');
  const sw = read('sw.js');
  assert.ok(sw.includes("'./assets/anim/agregats.html?app&embed'") && sw.includes("'./assets/anim/agregats-thumb.jpg'"), 'gardée pour le hors ligne');
  assert.ok(read('decouvrir/modules.js').includes('["SUM, AVG, MIN et MAX", "Somme, moyenne, minimum et maximum",'), 'au programme de la vitrine');
  assert.ok(read('assets/anim/liens.js').includes("{page: 'agregats', titre: 'SUM, AVG, MIN et MAX',"), 'reliée à COUNT et à GROUP BY');
});

test('chaque valeur de la vidéo est celle de SQLite, sur la base de l’app', () => {
  assert.deepEqual(one('SELECT SUM(stock), ROUND(AVG(prix), 2), MIN(prix), MAX(prix) FROM produits;'), [1075, 23.99, 12.5, 39.9]);
  assert.deepEqual(one('SELECT SUM(prix), AVG(prix), COUNT(*), MAX(stock) FROM produits;').map(v => +v.toFixed(4)), [191.9, 23.9875, 8, 500]);
  assert.deepEqual(one('SELECT AVG(age), MIN(age), MAX(age) FROM clients;'), [35.4, 26, 52]);
  assert.deepEqual(one("SELECT nom FROM produits WHERE prix = (SELECT MAX(prix) FROM produits);"), ['Collagène Marin']);
  assert.deepEqual(one("SELECT nom FROM produits WHERE prix = (SELECT MIN(prix) FROM produits);"), ['Tisane Détox']);
  /* La page reprend les mêmes produits et les mêmes clients que la base */
  assert.deepEqual(val('PRODUITS'), db.exec('SELECT nom, prix, stock FROM produits ORDER BY id;')[0].values);
  assert.deepEqual(val('CLIENTS').map(c => c[1]), db.exec('SELECT age FROM clients ORDER BY id;')[0].values.flat());
  for (const t of ['<div>1075</div>', '<div>23.99</div>', '<div>12.5</div><div>39.9</div>', '191,90&nbsp;€', '23,9875', 'AVG(age) <b>35.4</b>', 'MIN(age) <b>26</b>', 'MAX(age) <b>52</b>'])
    assert.ok(page.includes(t), `la page montre : ${t}`);
  /* Le résultat final : une ligne, quatre colonnes nommées avec AS */
  const r = db.exec('SELECT SUM(stock) AS stock_total, ROUND(AVG(prix), 2) AS prix_moyen, MIN(prix) AS prix_min, MAX(prix) AS prix_max FROM produits;')[0];
  assert.deepEqual([r.columns, r.values], [['stock_total', 'prix_moyen', 'prix_min', 'prix_max'], [[1075, 23.99, 12.5, 39.9]]]);
});

test('le jeu : quatre compteurs à remplir, jusqu’à « 4 / 4 · Tableau de bord complet » (sans étoiles à gagner)', () => {
  assert.deepEqual(val('KPIS').map(k => k[3]), ['SUM(stock)', 'AVG(prix)', 'MIN(prix)', 'MAX(prix)']);
  assert.ok(page.includes("function gagne(id, i, t){") && page.includes('✓ 4 / 4 · Tableau de bord complet') && page.includes("confetti($('#badge6'), 132.0);"));
  /* Elisa, 2 novembre, 0 h 10 : « enlève la partie gagne ces étoiles » (réf. 1) et « supprimer » la phrase de la barre la plus longue (réf. 2). */
  assert.ok(!/étoile|★|\.star/.test(page.slice(page.indexOf('<style>'), page.indexOf('</style>')) + page.slice(page.indexOf('const CAPTIONS'), page.indexOf('const QUESTIONS'))), 'plus d’étoile, ni dans le style ni dans les légendes');
  assert.ok(!page.includes('cut(10.45, 5.4);') && page.includes('cut(85.65, 4.55);') && !page.slice(page.indexOf('const CAPTIONS'), page.indexOf('const QUESTIONS')).includes('barre la plus longue'), 'les deux passages coupés');
  assert.ok(page.includes('"Elles s’utilisent sur toutes les colonnes contenant des nombres, comme, par exemple, l’âge des clients."'), 'réf. 3');
  assert.ok(page.includes("prompt: 'Associe chaque question à la fonction qui permet d’y répondre.',"), 'réf. 4');
  /* Elisa, 2 novembre, 0 h 26 : le mail de l’équipe logistique ouvre la mission ; « indicateurs » ; les deux phrases réécrites. */
  assert.ok(page.includes("qui: ['L’équipe logistique', 'EL']") && page.includes("const OPENS = [{at: MAIL_OPEN, sel: '#ml1', prompt: 'Touche le mail pour l’ouvrir.', label: 'Ouvrir le mail de l’équipe logistique'}];"), 'le mail');
  for (const c of ['"Les quatre <b>indicateurs</b> du stock sont encore vides."', '"À nous de les calculer !"', '"Ici, on veut calculer à partir des <b>valeurs</b> d’une colonne."',
    '"Quatre fonctions permettent de faire ces calculs : <code>SUM</code>, <code>AVG</code>, <code>MIN</code> et <code>MAX</code>."']) assert.ok(page.includes(c), c);
  assert.ok(!/compteur/.test(page.slice(page.indexOf('const CAPTIONS'), page.indexOf('const QUESTIONS'))), 'les légendes disent « indicateurs »');
  for (const [id, n] of [['#dash2', 0], ['#dash3', 1], ['#dash4', 2], ['#dash4', 3]]) assert.ok(page.includes(`gagne('${id}', ${n},`), `compteur ${n + 1} gagné`);
});

test('les trois moments : deviner SUM(stock), toucher la barre de MAX(prix), ranger quatre questions', () => {
  assert.equal([...momentsSrc.matchAll(/\{at: [\d.]+, from: [\d.]+, kind: '(\w+)'/g)].map(m => m[1]).join(), 'pick,tap,sort');
  assert.ok(momentsSrc.includes("{label: '1 075 unités', ok: true,") && momentsSrc.includes("{label: '8 produits', why: 'Ça, c’est <code>COUNT(*)</code>"), 'SUM ou COUNT');
  assert.ok(momentsSrc.includes('ok: i === 1,'), 'MAX(prix) : la barre du Collagène Marin');
  for (const [q, to] of [['L’âge moyen des clients', 'A'], ['Le total des quantités commandées', 'S'], ['L’âge du client le plus jeune', 'N'], ['L’âge du client le plus âgé', 'X']])
    assert.ok(momentsSrc.includes(`{label: '${q}', to: '${to}',`), q);
  /* Sur l’image du moment 2, la réponse n’est pas encore là : la barre la plus longue ne prend sa couleur qu’après */
  assert.ok(page.includes('.br .bf.gold{background:linear-gradient(90deg,#FFD66B,#F2B600);opacity:0}') && page.includes("tl.to(br[1].querySelector('.bf.gold'), {opacity: 1, duration: 0.3}, 90.6);"));
});

test('la fiche de la leçon dit les mêmes trois idées que la vidéo', () => {
  const rows = [...page.matchAll(/<div class="rrow"><div class="rico emo">([^<]+)<\/div>/g)].map(m => m[1]);
  const fiche = html.slice(html.indexOf('guide({ id:85,'), html.indexOf('guide({ id:16,'));
  const idees = [...fiche.matchAll(/\["([^"]+)","/g)].map(m => m[1]);
  assert.deepEqual(idees, rows);
  assert.deepEqual(rows, ['➕', '📏', '🧾']);
});
