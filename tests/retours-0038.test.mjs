/* Elisa, 5 novembre, 0 h 30 et 0 h 38 : « remplacer la voix de ref 1 et de sam et de arthur pour la remplacer par la voix de : ref 2.
   Et les supprimer du site et de l’appli (onboarding etc.) » ; « je veux remplacer arthur miya emily coralie et sam par Anais ».
   Les vingt cours de Miya (Mia), Emily, Coralie (Koraly), Arthur et Sam prennent le portrait et la voix d’Anaïs ; les cinq ne sont plus
   ni sur le site ni dans l’appli. Réf. 3 : l’écran « Action ou résultat ? » du cours Procédures et fonctions. Réf. 6 : les phrases
   dites ne nomment plus SQLite. La voix des cours changés est refaite sur le Mac (generer.mjs), sans refaire les autres. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ANAIS = '5OnMHwgTFgvPVwE8jP6B';
const COURS = ['sous-requete-in', 'sous-requete-select', 'sous-requete-from', 'insert-select', 'exists', 'any-all', 'with-cte', 'union',
  'intersect-except', 'with-recursive', 'projet-insert', 'projet-update', 'projet-merge', 'projet-delete', 'projet-ondelete',
  'projet-transaction', 'projet-savepoint', 'projet-concurrence', 'projet-procedures', 'projet-trigger'];
const PARTIS = [['formatrice-mia', 'Miya', 'mia'], ['formatrice-emily', 'Emily', 'emily'], ['formatrice-koraly', 'Coralie', 'koraly'],
  ['formateur-arthur', 'Arthur', 'arthur'], ['formateur-sam', 'Sam', 'sam']];

test('les vingt cours ont le portrait et la voix d’Anaïs', () => {
  for (const c of COURS) {
    assert.ok(read(`assets/anim/${c}.html`).includes('<html lang="fr" class="tr-f tr-anais">'), c + ' : le portrait d’Anaïs, « Votre formatrice »');
    const job = JSON.parse(read(`tools/voix/${c}.json`));
    assert.deepEqual(job.voix, {id: ANAIS, nom: 'Anaïs'}, c + ' : la voix d’Anaïs');
  }
  for (const c of ['projet-create', 'projet-alter', 'projet-drop', 'projet-schemas']) assert.equal(JSON.parse(read(`tools/voix/${c}.json`)).voix.id, ANAIS, c);
  assert.equal(JSON.parse(read('tools/voix/group-by.json')).voix.nom, 'Antoine', 'les autres modules gardent leur voix');
  assert.equal(JSON.parse(read('tools/voix/over.json')).voix.nom, 'Dorian');
  const prep = read('tools/voix/preparer.mjs');
  assert.ok(prep.includes('const AVEC_ANAIS = [...TABLES, ...SOUS_REQUETES, ...DONNEES, ...INTEGRITE, ...TRANSACTIONS, ...PROCEDURES];'));
  for (const id of ['PrwKJdvtTbJVdosRhS1O', 'p43fx6U8afP2xoq1Ai9f', 'QbsdzCokdlo98elkq4Pc', 'i32gAGa2D3T8nPzY1EsZ', 'G7ILShrCNLfmS0A37SXS'])
    assert.ok(!prep.includes(id), 'plus de voix ' + id);
});

test('les cinq formateurs ne sont plus ni dans les cours, ni dans l’appli, ni sur le site', () => {
  const css = read('assets/anim/core.css'), sw = read('sw.js'), app = read('index.html'), site = read('decouvrir/index.html'), video = read('decouvrir/video.html');
  for (const [f, nom, k] of PARTIS) {
    assert.ok(!fs.existsSync(path.join(ROOT, `assets/anim/${f}.webp`)), f + ' supprimé');
    assert.ok(!css.includes(`.tr-${k} `) && !css.includes(f), k + ' : plus de portrait dans le moteur');
    assert.ok(!sw.includes(f) && !app.includes(f) && !site.includes(f) && !video.includes(f), f);
    assert.ok(!site.includes(`<h3>${nom}</h3>`), nom + ' : plus de carte sur le site');
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html')))
    assert.ok(!/class="tr-[fm] tr-(mia|emily|koraly|arthur|sam)"/.test(read('assets/anim/' + f)), f);
  /* Le site : huit cartes, numérotées dans l’ordre ; Anaïs a les six modules (24 cours) */
  const cartes = [...site.matchAll(/<article class="trn" style="--i:(\d+)" tabindex="0" data-mods="([^"]*)">[\s\S]*?<h3>([^<]+)<\/h3>/g)].map(m => [+m[1], m[3], m[2]]);
  assert.deepEqual(cartes.map(c => c[1]), ['Agathe', 'Amina', 'Adam', 'Antoine', 'Dorian', 'Anaïs', 'Abraham', 'Anna']);
  assert.deepEqual(cartes.map(c => c[0]), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(cartes[5][2], 'Sous-requêtes et ensembles|Créer et faire évoluer les tables|Écrire et modifier les données|Intégrité des tables liées|Transactions et concurrence|Procédures et triggers');
  const ctx = vm.createContext({window: {}});
  vm.runInContext(read('decouvrir/modules.js'), ctx);
  const prog = ctx.window.MODULES[0].programme;
  assert.equal(cartes[5][2].split('|').reduce((n, t) => n + prog.find(m => m.titre === t).lecons.length, 0), 24);
  assert.ok(site.includes('<span class="trn-n">24&nbsp;cours</span>') && site.includes('<span class="rail-n" id="fn" aria-hidden="true">1 / 8</span>'));
  /* La vidéo du site : six visages, puis « +2 » */
  assert.equal((video.match(/<span class="trs-av">(.*?)<\/span>/)[1].match(/<img /g) || []).length, 6);
  assert.ok(video.includes('<b class="trs-more">+2</b>'));
});

test('réf. 3 : « Action ou résultat ? » — modifier les données, ou obtenir un résultat', () => {
  const p = read('assets/anim/projet-procedures.html');
  for (const t of ["chap({label:'Action ou résultat ?'});",
    `cap('c4', "Pose-toi une seule question :<br>est-ce que je dois modifier une donnée<br>ou simplement obtenir un résultat ?", 2.8);`,
    `cap('c5', "La demande A change une commande :<br>elle modifie les données.", 3.8);`,
    `cap('c6', "La demande B calcule des points :<br>elle renvoie un résultat.", 3.6);`,
    "const BINS1 = [['ac', 'Modifier les données', 'La demande change une information dans la base.'],",
    "  ['va', 'Obtenir un résultat', 'La demande calcule ou renvoie une valeur, sans modifier les données.']];",
    "['A · Passer la commande 13 au statut « expédiée »', 'ac',", "['B · Calculer les points obtenus pour un achat de 80 €', 'va',",
    "prompt: 'Range chaque demande : modifier les données, ou obtenir un résultat ?',", "next: '« {x} » : modifier les données, ou obtenir un résultat ?',",
    '#sd .dbn{height:auto}', '#sd .dbn .hh{display:block;white-space:normal}']) assert.ok(p.includes(t), t);
  assert.ok(!/Une action|Une valeur|Action ou calcul|c’est une action|c’est une valeur/.test(p.replace(/\/\*[\s\S]*?\*\//g, '')), 'plus d’« action » ni de « valeur » à ranger');
});

test('réf. 6 : les phrases dites des cours ne nomment plus SQLite', () => {
  for (const c of [...COURS, 'group-by']) {
    const job = JSON.parse(read(`tools/voix/${c}.json`));
    assert.ok(job.elements.every(e => !/S Q L light|SQLite/.test(e.texte)), c);
  }
  const m = read('assets/anim/projet-merge.html'), g = read('assets/anim/group-by.html');
  /* 6 novembre, 19 h : la phrase « MERGE n’existe pas » est retirée (tests/retours-1900.test.mjs). */
  assert.ok(m.includes("chap({label:'Une autre écriture'});") && !m.includes(`cap('c29',`)
    && m.includes("editor('eq', 'sans-merge.sql', [\n    ['eq0', '-- Le même résultat, sans MERGE'],"));
  assert.ok(g.includes('"L’app en choisit un, mais la plupart des autres bases refusent la requête."') && g.includes('<span class="ok">Dans l’app&nbsp;: un prénom au choix</span>'));
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/anim')).filter(f => f.endsWith('.html'))) {
    const visible = read('assets/anim/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
    assert.ok(!visible.includes('SQLite'), f + ' : ni à l’écran ni dans la voix');
  }
});
