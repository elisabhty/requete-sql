/* Elisa, 11 novembre, 16 h 54 : « certaines situations, des questions dans défi sont encore mal reformulées pour une personne qui
   ne connaît pas le contexte, la base, etc. L’introduction, le début, la situation, il y en a plusieurs qui sont encore mal
   formulées. » 121 situations reprises, sur le modèle validé le 8 novembre (ed2) : le lieu et ce qu’on y fait, la donnée en jeu
   expliquée avec des mots de tous les jours, qui veut quoi et pourquoi. Plus de vocabulaire de fichier (« sa fiche garde »,
   « reste dans le fichier », « statut payé »), plus d’énumérations coincées entre deux virgules, une idée par phrase, et les mots
   du métier expliqués (rucher, dénivelé, lot, cachet, sortie d’un food truck…). Les consignes (Affiche, Garde, Trie, À savoir),
   les solutions et les niveaux ne changent pas : le serveur des salles n’a rien à redéployer. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const C = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';CHALLENGES');
const S = id => C.find(c => c.id === id).situation.replace(/ /g, ' ');

test('plus de vocabulaire de fichier dans les situations', () => {
  for (const c of C) {
    const s = c.situation.replace(/ /g, ' ');
    assert.doesNotMatch(s, /\bgarde(nt)? (sa|son|ses|leur|leurs)\b/, `${c.id} : « garde sa… »`);
    assert.doesNotMatch(s, /\bfichier\b/, `${c.id} : « fichier »`);
    assert.doesNotMatch(s, /statut payé|renseign/, `${c.id} : vocabulaire de base de données`);
    assert.doesNotMatch(s, /qui conduit les ruchers|qui organise la régulation,/, `${c.id} : un métier expliqué`);
  }
});

test('les notions du métier sont expliquées là où elles comptent', () => {
  assert.ok(S('sf1').includes('Quand un abonnement s’arrête, sa date de fin est notée : tant qu’elle ne l’est pas, l’abonnement est en cours.'), 'un abonnement en cours');
  assert.ok(S('kf2').includes('L’écart d’altitude entre les deux gares s’appelle le dénivelé.'));
  assert.ok(S('rf1').includes('les ruches sont posées dans des ruchers, des emplacements où la ferme regroupe plusieurs ruches'));
  assert.ok(S('tf3').includes('chaque sortie, c’est un véhicule installé pour la journée sur un emplacement'));
  assert.ok(S('gm8').includes('chaque artiste reçoit un cachet, la somme payée pour venir jouer'));
  assert.ok(S('rd1').includes('on calcule le rendement : les kilos récoltés divisés par le nombre de ruches qui ont donné ce miel'));
  assert.ok(S('vm1').includes('Seuls les paiements marqués « Payé » sont vraiment encaissés'), 'les paiements de l’agence de voyages');
  assert.ok(S('ff7').includes('chaque fromage arrive en lots : des pièces fabriquées ensemble'));
  assert.ok(S('ld6').includes('On dit qu’un chercheur est lié à une revue quand l’un de ses projets y a publié un article.'));
});

test('les énumérations passent entre parenthèses, plus entre deux virgules', () => {
  assert.ok(S('qf2').includes('chaque équipement (pompe, filtre ou chauffage) appartient à un bassin'));
  assert.ok(S('ff2').includes('chaque fromage vient d’un producteur (une ferme, une fromagerie ou une laiterie)'));
  assert.ok(S('km4').includes('chaque piste a sa couleur (verte, bleue, rouge ou noire)'));
  assert.ok(S('ad9').includes('dans trois classes (Économique, Premium et Affaires)'));
});

test('chaque situation reprise dit ce que la personne veut, sans rien perdre de la consigne', () => {
  for (const id of ['af26', 'gf9', 'gf10', 'qd2', 'rd10', 'kd8', 'af20'])
    assert.match(S(id), / veut /, `${id} : le besoin`);
  assert.ok(S('af26').includes('il veut la liste des avions qui ne sont pas des Airbus'));
  assert.ok(S('af20').includes('depuis Paris comme depuis les autres aéroports'), 'tous les départs, pas seulement Paris');
  assert.ok(S('vf7').includes('même annulée') && S('zf10').includes('y compris ceux qui n’ont pas encore été pesés') && S('am6').includes('même en cabine'));
});
