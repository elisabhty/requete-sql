/* Elisa, 6 novembre, 9 h 37 (capture du défi « Combien d’adhérents actifs compte chaque formule ? », salle de défi) : « tes agents ne
   sont pas allés aussi loin que je voulais : regarde, “L’accueil”, mais quel accueil ? C’est pas bien contextualisé et détaillé ».
   Elle choisit « Personnage + lieu » : chaque base devient un lieu nommé avec son équipe (sa présentation les annonce), et chaque
   situation dit qui demande, où, pourquoi et ce qu’on fera du résultat. Les consignes (Affiche, Garde, Trie, À savoir) et les
   solutions ne changent pas. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ctx = vm.createContext({});
const bloc = (debut, fin) => { const i = app.indexOf(debut); assert.ok(i >= 0, debut); const j = app.indexOf(fin, i); assert.ok(j > i, fin); return app.slice(i, j + fin.length); };
vm.runInContext(bloc('const CHALLENGES=[', '\n];').replace('const CHALLENGES=', 'var CHALLENGES='), ctx);
vm.runInContext(bloc('const DEFI_BASES={', '\n};').replace('const DEFI_BASES=', 'var DEFI_BASES='), ctx);
const { CHALLENGES: C, DEFI_BASES: B } = ctx;
const N = ' ';
const mots = s => String(s || '').split(/[\s ]+/).filter(Boolean).length;

/* Le lieu de chaque base et son équipe (des prénoms qu’aucune personne de la base ne porte) */
const UNIVERS = {
  aeroport: ['aéroport Paris-Charles-de-Gaulle', ['Gilles', 'Margaux', 'Rachid', 'Odile', 'Sabrina', 'Yannick', 'Lina', 'Coralie', 'Édouard', 'Thierry', 'Hervé'], ['Gilles', 'Rachid', 'Odile', 'Sabrina']],
  hopital: ['hôpital des Quatre-Vents', ['Agnès', 'Ophélie', 'Yasmine', 'Lionel', 'Bertrand', 'Hamon', 'Gérald'], ['Agnès', 'Yasmine', 'Lionel', 'Hamon', 'Bertrand']],
  wok: ['La Perle du Wok', ['Mei', 'Lin', 'Mehdi', 'Agathe'], ['Mei', 'Lin', 'Mehdi', 'Agathe']],
  zoo: ['zoo des Grands Chênes', ['Armelle', 'Raoul', 'Solène', 'Lou', 'Marius'], ['Armelle', 'Raoul', 'Solène', 'Lou', 'Marius']],
  fromagerie: ['La Meule d’Or', ['Margot', 'Julie', 'Paul', 'Baptiste', 'Nadège'], ['Margot', 'Julie', 'Paul', 'Baptiste', 'Nadège']],
  labo: ['laboratoire Hélix', ['Véronique', 'Mathis', 'Clémence', 'Rose', 'Gaspard', 'Patrice', 'Sandrine'], ['Véronique', 'Mathis', 'Clémence', 'Rose', 'Gaspard', 'Patrice']],
  voyages: ['Cap Ailleurs', ['Bérénice', 'Samuel', 'Joëlle', 'Florent', 'Maëlle'], ['Bérénice', 'Samuel', 'Joëlle', 'Florent', 'Maëlle']],
  salle_sport: ['club Pulsar', ['Inès', 'Bastien', 'Yanis', 'Mathilde'], ['Inès', 'Bastien', 'Yanis', 'Mathilde']],
  /* 6 novembre : les sept bases ajoutées, chacune avec son lieu et son équipe */
  ski: ['Blanchecombe', ['Hélène', 'Cyril', 'Bruno', 'Fanny', 'Diane'], ['Hélène', 'Cyril', 'Bruno', 'Fanny', 'Diane']],
  foodtruck: ['Popote & Pistons', ['Octave', 'Prune', 'Killian', 'Nolwenn', 'Léonie'], ['Octave', 'Prune', 'Killian', 'Nolwenn', 'Léonie']],
  aquarium: ['aquarium des Trois Marées', ['Victoire', 'Quentin', 'Sacha', 'Ulysse', 'Romane'], ['Victoire', 'Quentin', 'Sacha', 'Ulysse', 'Romane']],
  velos: ['Cyclavel', ['Nina', 'Élodie', 'Corentin', 'Karim', 'Tristan'], ['Nina', 'Élodie', 'Corentin', 'Karim', 'Tristan']],
  apiculture: ['Coteaux Blonds', ['Noémie', 'Rémi', 'Salomé', 'Capucine', 'Hervé'], ['Noémie', 'Rémi', 'Salomé', 'Capucine', 'Hervé']],
  escape: ['Cadran Fêlé', ['Bérangère', 'Jade', 'Malik', 'Théo', 'Zoé'], ['Bérangère', 'Jade', 'Malik', 'Théo', 'Zoé']],
  festival: ['festival des Hautes Herbes', ['Apolline', 'Éliott', 'Lucile', 'Moussa', 'Iris'], ['Apolline', 'Éliott', 'Lucile', 'Moussa', 'Iris']],
};
const AUTRES = /Camille Moreau|Oliver Smith|Sophie Martin|Manon Lambert|Simba|AlphaJet|cardiologue|client|voyageur|entreprise|agence|adhérent/;

test('le défi de la capture : Inès, à l’accueil du club Pulsar, et ce qu’elle doit présenter', () => {
  const c = C.find(x => x.id === 'sm7');
  assert.equal(c.situation, `Au club Pulsar, Inès tient l’accueil${N}: c’est le comptoir de l’entrée, où elle reçoit les adhérents et vend les abonnements. Lundi, en réunion d’équipe, elle doit présenter combien d’adhérents sont abonnés en ce moment à chacune des trois formules du club${N}: Annuel, Mensuel et Étudiant.`);
  assert.equal(c.titre, `Combien d’adhérents actifs compte chaque formule${N}?`, 'le titre ne change pas');
  assert.deepEqual([...c.garde], ['seulement les abonnements en cours (date de fin vide)'], 'la consigne ne change pas');
  assert.ok(!C.some(x => /^L’accueil (fait|prépare|veut|lance|vérifie|archive|attend|mesure)/.test(x.situation)), 'plus aucun « L’accueil… » sans lieu ni personne');
});

test('chaque situation nomme son lieu et qui demande, sans sujet flou, et reste courte', () => {
  assert.equal(C.length, 477);
  for (const c of C) {
    const [lieu, equipe] = UNIVERS[c.base];
    const s = c.situation;
    assert.ok(s.includes(lieu.replace(/^(aéroport|hôpital des|zoo des|laboratoire|club) /, '')), `${c.id} : le lieu (${lieu})`);
    assert.ok(equipe.some(n => s.includes(n)) || AUTRES.test(s), `${c.id} : qui demande`);
    assert.doesNotMatch(s, /^(L’accueil|Le service|La direction|Les opérations|L’équipe du|Le secrétariat|La coordination|Le planning|La billetterie|La pharmacie|La cuisine|La réserve|Le responsable|La responsable)\b/, `${c.id} : un sujet sans visage`);
    assert.ok(mots(s) >= 25 && mots(s) <= 70, `${c.id} : ${mots(s)} mots`);   // 70 au plus depuis le 8 novembre, 13 h 28 (« on peut dire 70 »)
    assert.doesNotMatch(s, / [?!;:]/, `${c.id} : espace insécable avant la ponctuation`);
    assert.doesNotMatch(s.replace(/«[^»]*»/g, ''), /['"]/, `${c.id} : apostrophes et guillemets typographiques`);
    assert.doesNotMatch(s, /SQLite|SELECT|WHERE|JOIN/, `${c.id} : pas de SQL dans la situation`);
  }
});

test('l’équipe de chaque base ne porte le prénom d’aucune personne de ses données', () => {
  for (const [id, [, equipe]] of Object.entries(UNIVERS))
    for (const n of equipe) assert.ok(!B[id].sql.includes(`'${n}'`), `${id} : ${n} est déjà dans la base`);
});

test('chaque base se présente : son lieu, son équipe, et toujours la liste de ses données', () => {
  for (const [id, [lieu, , presentes]] of Object.entries(UNIVERS)) {
    const d = B[id].desc;
    assert.ok(d.includes(lieu.replace(/^hôpital des /, 'hôpital universitaire des ')) || d.includes(lieu), `${id} : ${lieu}`);
    for (const n of presentes) assert.ok(d.includes(n), `${id} : ${n}`);
    assert.ok(/^Bienvenue (?:dans|à|au|chez) /.test(d) && d.endsWith('Explore la base pour résoudre les différentes missions.'));
    assert.ok(d.length <= 400, `${id} : ${d.length} caractères, la limite de la note d’un projet`);
    assert.ok(/Tu aides (?:son |l’)équipe\u00a0: /.test(d), `${id} : l’équipe`);
    assert.doesNotMatch(d, / [?!;:]/);
  }
  /* L’accroche de la Console (« Vols, passagers, compagnies, avions et bagages ») se lit toujours dans la présentation */
  const tag = id => (String(B[id].desc).match(/\.\s+([^.:]+?)\s*:/) || [])[1];
  assert.equal(tag('aeroport'), 'Vols, passagers, compagnies, avions et bagages');
  assert.equal(tag('salle_sport'), 'Adhérents, coachs, cours collectifs, abonnements et inscriptions');
  assert.equal(tag('fromagerie'), 'Fromages, producteurs, laits, affinages, lots et ventes');
  assert.ok(app.includes("const m=String(DEFI_BASES[id].desc).match(/\\.\\s+([^.:]+?)\\s*:/);"), 'demoTagline lit la même accroche');
});

test('des situations qui ne cachent aucune règle : les seuils qu’elles citent sont ceux de la consigne', () => {
  const plain = s => String(s).replace(/ /g, ' ');
  for (const c of C) {
    const ref = plain([c.titre, ...c.affiche, ...c.garde, c.tri || '', ...c.precis].join(' | '));
    for (const [, n] of plain(c.situation).matchAll(/plus de (\d[\d ]*)/g)) assert.ok(ref.includes(n.trim()), `${c.id} : « plus de ${n} » vient de la consigne`);
  }
  /* Les vols de tout le réseau ne sont pas confiés à la cheffe d’escale de Paris (elle ne voit que les départs de Paris) */
  for (const c of C.filter(x => x.base === 'aeroport' && x.situation.includes('Margaux'))) assert.ok(c.garde.some(g => plain(g).includes('« Paris »')), c.id);
});
