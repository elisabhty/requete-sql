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
  assert.ok(read('tools/voix/A-REGENERER.md').includes('node tools/voix/generer.mjs --toutes --cours ' + COURS.join(',') + ',group-by\n'), 'la commande pour le Mac (lancée le 5 novembre)');
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

/* Elisa, 6 novembre, 17 h 16 : la vidéo du site dit les nombres de l’appli. Deux phrases seulement sont à refaire (Louis) : « huit formateurs »
   et « cent quarante-deux questions » ; le Mac n’a pas les fichiers d’origine de la vidéo, la relancer en entier referait tout, musique comprise. */
test('vidéo du site : les deux phrases à refaire, et seulement elles ; l’intégration garde les autres et la musique', () => {
  const site = JSON.parse(read('tools/voix/video-site.json')), job = JSON.parse(read('tools/voix/video-site-retouches.json'));
  const app = read('index.html'), questions = (app.match(/\{id:'ent-v2-\d+'/g) || []).length;
  assert.equal(questions, 142, 'les questions d’entretien de l’appli');
  const s16 = site.elements.find(e => e.id === 's16');
  assert.ok(s16.texte.includes('avec cent quarante-deux questions :') && !JSON.stringify(site).includes('quarante et une'), 'la voix dit 142, le contexte des voisines aussi');
  assert.deepEqual(job.elements.map(e => e.id), ['s12', 's16']);
  for (const e of job.elements) assert.deepEqual(e, site.elements.find(x => x.id === e.id), `${e.id} : le même texte et le même contexte`);
  assert.deepEqual([job.voix, job.modele, job.format, job.musique], [site.voix, site.modele, site.format, undefined], 'Louis, le même modèle, sans musique');
  const md = read('tools/voix/A-REGENERER.md');
  assert.ok(md.includes('cd ~/SQL && git pull --ff-only && node tools/voix/generer.mjs --toutes --cours video-site-retouches,projet-index-retouches,projet-merge,projet-procedures,insert-select,between-retouches,as-retouches,not-retouches,comparer-retouches,fonctions-numeriques-retouches,group-by-colonnes-retouches,plusieurs-conditions-on-retouches,lag-lead-retouches,quel-join-choisir-retouches,projet-create-retouches --oui\n') && md.includes('**Ne pas lancer `video-site`, `projet-index`, ni `--toutes` sans `--cours`**'));
  /* 17 h 48 : la leçon 57 ne dit plus « Bientôt » (règle d’Elisa) ; sa consigne refaite à part, intégrée avec --garder */
  const idx = JSON.parse(read('tools/voix/projet-index.json')), r = JSON.parse(read('tools/voix/projet-index-retouches.json'));
  assert.ok(!/[Bb]ientôt/.test(JSON.stringify(idx)) && !/[Bb]ientôt/.test(read('assets/anim/projet-index.html')), 'plus de « Bientôt » dans la leçon 57');
  assert.deepEqual(r.elements, idx.elements.filter(e => e.id === 'at2'));
  assert.deepEqual([r.voix, r.modele], [idx.voix, idx.modele], 'la voix du cours');
  assert.ok(read('tools/voix/integrer.mjs').includes("if (ANCIEN && fs.existsSync(path.join(OUT, el.id + '.mp3')) && garde(el)) { gardes++; continue; }"), '--garder : les autres fichiers restent');
  const integ = read('tools/voix/integrer-site.mjs');
  assert.ok(integ.includes("if (!neuf && !fs.existsSync(garde)) { manque.push(e.id); return; }") && integ.includes("else if (fs.existsSync(mGarde)) { out.musique = {d: avant.musique && avant.musique.d || +dur(mGarde).toFixed(2)};"), 'une phrase absente garde son fichier, la musique aussi');
});
