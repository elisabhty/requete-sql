/* Voix off (Elisa, 5 novembre, 0 h 38 : « je veux remplacer arthur miya emily coralie et sam par Anais ») : les vingt cours de Miya (Mia),
   Emily, Coralie (Koraly), Arthur et Sam sont refaits avec la voix d’Anaïs, sur le Mac (generer.mjs). Un fichier fait avec une autre
   voix est refait ; une phrase sans contexte déjà dite par la même voix pour un autre cours (« Bien vu ! ») est reprise sans rien
   dépenser ; --toutes --cours a,b,c ne fait que ces leçons. */
import fs from 'node:fs';
import os from 'node:os';
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

test('preparer.mjs : les vingt cours ont la voix d’Anaïs, les autres modules gardent la leur', () => {
  for (const c of COURS) assert.deepEqual(JSON.parse(read(`tools/voix/${c}.json`)).voix, {id: ANAIS, nom: 'Anaïs'}, c);
  for (const c of ['projet-create', 'projet-alter', 'projet-drop', 'projet-schemas']) assert.equal(JSON.parse(read(`tools/voix/${c}.json`)).voix.id, ANAIS, c);
  assert.equal(JSON.parse(read('tools/voix/group-by.json')).voix.nom, 'Antoine');
  assert.equal(JSON.parse(read('tools/voix/over.json')).voix.nom, 'Dorian');
  const prep = read('tools/voix/preparer.mjs');
  assert.ok(prep.includes('const AVEC_ANAIS = [...TABLES, ...SOUS_REQUETES, ...DONNEES, ...INTEGRITE, ...TRANSACTIONS, ...PROCEDURES];'));
  for (const id of ['PrwKJdvtTbJVdosRhS1O', 'p43fx6U8afP2xoq1Ai9f', 'QbsdzCokdlo98elkq4Pc', 'i32gAGa2D3T8nPzY1EsZ', 'G7ILShrCNLfmS0A37SXS'])
    assert.ok(!prep.includes(id), 'plus de voix ' + id);
  assert.ok(read('tools/voix/A-REGENERER.md').includes('node tools/voix/generer.mjs --toutes --cours ' + COURS.join(',') + ',group-by,video-site\n'), 'la commande pour le Mac');
  /* 6 h 37, « refais stp » : la vidéo du site dit « animés par huit formateurs » (il en reste huit), avec la voix de Louis */
  const site = JSON.parse(read('tools/voix/video-site.json')), s12 = site.elements.find(e => e.id === 's12');
  assert.ok(s12.texte.includes('Plus de soixante-dix cours immersifs, animés par huit formateurs, où tu apprends') && site.voix.nom === 'Louis');
  assert.ok(!JSON.stringify(site).includes('dizaine'), 'le contexte des phrases voisines aussi');
});

test('generer.mjs : un fichier fait avec une autre voix est refait ; une phrase sans contexte déjà dite par la même voix est reprise', () => {
  const src = read('tools/voix/generer.mjs');
  const code = src.slice(src.indexOf('function fait('), src.indexOf('/* La musique est faite'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voix-'));
  const ctx = vm.createContext({fs, path, DIR: tmp});
  vm.runInContext(code + ';this.fait = fait; this.reprendre = reprendre;', ctx);
  const ecrire = (cours, id, texte, voix) => { const d = path.join(tmp, 'sortie', cours); fs.mkdirSync(d, {recursive: true});
    fs.writeFileSync(path.join(d, id + '.mp3'), 'mp3 ' + voix); fs.writeFileSync(path.join(d, id + '.json'), JSON.stringify({id, texte, voix: {id: voix}})); };
  ecrire('projet-create', 'bienvu', '[cheerful] Bien vu !', ANAIS);
  ecrire('projet-create', 'ch01', '[cheerful] Un chapitre.', ANAIS);
  ecrire('projet-merge', 'bienvu', '[cheerful] Bien vu !', 'emily');
  ecrire('projet-merge', 'ch01', '[cheerful] Un chapitre.', 'emily');
  const job = {cours: 'projet-merge', voix: {id: ANAIS, nom: 'Anaïs'}, elements: [{id: 'bienvu', texte: '[cheerful] Bien vu !'},
    {id: 'ch01', texte: '[cheerful] Un chapitre.', avant: null, apres: 'La suite.'}]};
  const out = path.join(tmp, 'sortie', 'projet-merge');
  assert.equal(ctx.fait(job, out, job.elements[0]), false, 'dit par Emily : à refaire avec Anaïs');
  assert.equal(ctx.reprendre(job, out), 1, '« Bien vu ! » d’Anaïs, repris du cours Créer les tables');
  assert.equal(fs.readFileSync(path.join(out, 'bienvu.mp3'), 'utf8'), 'mp3 ' + ANAIS);
  assert.equal(ctx.fait(job, out, job.elements[0]), true);
  assert.equal(ctx.fait(job, out, job.elements[1]), false, 'un chapitre, dit avec son contexte, est généré');
  assert.equal(ctx.fait({voix: {id: 'emily'}}, out, {id: 'ch01', texte: '[cheerful] Un chapitre.'}), true, 'même texte, même voix : rien à refaire');
  assert.ok(src.includes('repris += reprendre(job, out);') && src.includes('const todo = (job.elements || []).filter(el => !fait(job, out, el))'), '--toutes compte après la reprise');
  assert.ok(src.includes("const reste = jobs.filter(f => !seuls.length || seuls.includes(f.replace(/\\.json$/, ''))).map(f => {"), '--cours : seulement ces leçons');
  fs.rmSync(tmp, {recursive: true, force: true});
});
