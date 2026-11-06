/* Elisa, 6 novembre, 21 h 05 : les moments « À toi » qui posaient la question avant que la vidéo explique la notion → « Expliquer avant
   le moment ». La légende juste avant le moment (ou sa consigne, dite par la voix) donne ce qu’il faut savoir. Les textes changent avec
   leur voix : tools/voix/<cours>-moments.json, posés par integrer.mjs à l’intégration ; IN et les transactions, avec la voix d’Anaïs,
   sont refaits avec les 20 cours (branche voix-anais). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MOM = fs.readdirSync(path.join(ROOT, 'tools/voix')).filter(f => f.endsWith('-moments.json')).sort();
const dit = (c, id) => JSON.parse(read(`tools/voix/${c}-moments.json`)).elements.find(e => e.id === id);

test('douze moments dans onze cours (neuf ici, deux avec la voix d’Anaïs) : la voix du cours, ses phrases telles que dans le cours, des textes de page à poser', () => {
  assert.deepEqual(MOM.map(f => f.replace('-moments.json', '')), ['and-or', 'distinct', 'fenetres-glissantes', 'first-last-ntile', 'inner-join',
    'projet-create', 'projet-droits', 'projet-uml', 'self-join']);
  for (const f of MOM) {
    const r = JSON.parse(read('tools/voix/' + f)), c = f.replace('-moments.json', ''), job = JSON.parse(read(`tools/voix/${c}.json`));
    const page = read(`assets/anim/${c}.html`);
    assert.equal(r.cours, c + '-moments');
    assert.deepEqual([r.voix, r.modele], [job.voix, job.modele]);
    for (const e of r.elements) assert.deepEqual(e, job.elements.find(x => x.id === e.id), `${c}/${e.id}`);
    for (const [a, b] of [].concat(r.legendes || [], r.remplacements || [])) {
      assert.ok(!page.includes(a), `${c} : l’ancien texte n’est plus dans la page`);
      assert.equal(page.split(b).length - 1, 1, `${c} : posé une fois, avec sa voix (intégrée le 6 novembre, 21 h 30)`);
    }
  }
});

test('ce que la vidéo explique avant de demander', () => {
  assert.ok(dit('distinct', 'ch04').phrases.includes('Avec SQL, distinkte le fait pour toi : il s’écrit juste après SELECT.'));
  assert.ok(dit('and-or', 'ch05').phrases.includes('Attention : ènde est prioritaire sur or, sauf entre parenthèses.'));
  assert.ok(dit('inner-join', 'ch03').phrases.includes('Ineur djoïnne ajoute la table clients, juste après FROM ; onne dit quelles colonnes relier.'));
  assert.ok(dit('self-join', 'ch04').phrases.includes('Parmi elles, 15 lignes associent une commande à elle-même ; le signe inférieur-supérieur veut dire « différent de ».'));
  assert.ok(dit('first-last-ntile', 'ch05').phrases.includes('Les groupes sont aussi égaux que possible ; s’il en reste, les premiers reçoivent une ligne de plus.'));
  assert.ok(dit('fenetres-glissantes', 'at3').texte.includes('Sans cadre explicite, les commandes d’une même date comptent ensemble.'));
  assert.ok(dit('projet-uml', 'at2').texte.includes('La multiplicité 1 veut dire « un seul », 0 point point étoile « zéro, un ou plusieurs »'));
  assert.ok(dit('projet-uml', 'at3').texte.includes('1 point point étoile veut dire « au moins un » et 0 point point 1 « zéro ou un »'));
  assert.ok(dit('projet-create', 'at3').texte.includes('Une date a son propre type, date.'));
  assert.ok(dit('projet-droits', 'at5').texte.includes('Grant donne un droit à un compte, avec tou ; revoke le lui retire, avec FROM.'));
  const at3 = c => JSON.parse(read(`tools/voix/${c}.json`)).elements.find(e => e.id === 'at3').texte;
  assert.ok(at3('sous-requete-in').includes('Le signe égale n’attend qu’une seule valeur : ici, la base ne lit que la première de la liste.'));
  assert.ok(at3('projet-transaction').includes('Commit valide une transaction, rollback l’annule.'));
});

test('la deuxième commande, et ce qui ne change pas (LIKE, Comparer)', () => {
  const md = read('tools/voix/A-REGENERER.md');
  assert.ok(md.includes('--cours sous-requete-in,projet-transaction,distinct-moments,and-or-moments,inner-join-moments,self-join-moments,first-last-ntile-moments,fenetres-glissantes-moments,projet-uml-moments,projet-create-moments,projet-droits-moments --oui\n'));
  assert.ok(md.includes('LIKE et Comparer ne changent pas'));
  assert.ok(read('assets/anim/comparer.html').includes("['NE', '!=', 'différent de', '']"), 'la carte des six opérateurs dit ce que veut dire !=');
});
