/* Elisa, 5 novembre, 23 h 27 : « J’adore ce que les agents ont fait niveau entretien je veux que les même (expert en écriture /
   formulation) explique mieux les 267 défis ». Les textes sont réécrits par base, chacun vérifié en jouant le joueur, puis relus à
   l’aveugle (267 requêtes sur 267 acceptées du premier coup). Ces tests gardent la forme qui les rend lisibles d’un coup d’œil. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const D = JSON.parse(JSON.stringify(vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';CHALLENGES')));
const defi = id => D.find(c => c.id === id);
const texte = c => [c.titre, c.situation, ...c.affiche, ...c.garde, c.tri || '', ...c.precis].join(' ');

test('les 477 défis : chaque point se lit après son verbe, la piste donne le raisonnement sans la requête', () => {
  assert.equal(D.length, 477);   // 6 novembre : les 210 des sept bases ajoutées suivent les mêmes règles
  for (const c of D) {
    assert.doesNotMatch(c.titre, /\b[A-Z_]{3,}\s*\(\s*\)/, c.id + ' : pas de fonction SQL dans le titre, la notion va dans la piste');
    for (const t of [...c.affiche, ...c.garde]) assert.match(t, /^[a-zàâçéèêîïôûœ0-9«(]/, `${c.id} : « Affiche … », « Garde … » se lisent à la suite du verbe (${t})`);
    for (const t of c.precis) assert.match(t, /^[A-ZÀÂÇÉÈÊÎÔ«0-9][\s\S]*[.!]$/, `${c.id} : « À savoir » est fait de phrases (${t})`);
    if (c.tri) for (const k of c.tri.split(/,\s*puis\s+/)) assert.match(k.trim(), /^par /, c.id + ' : chaque clé du tri commence par « par »');
    assert.doesNotMatch(c.indice, /\bSELECT\b[\s\S]*\bFROM\b/i, c.id + ' : la piste ne donne pas la requête');
    assert.doesNotMatch(c.indice.replace(/«[^»]*»/g, ''), /['"]/, c.id + ' : apostrophes et guillemets typographiques dans la piste');
    assert.doesNotMatch(c.indice, / [?!;:]/, c.id + ' : espace insécable avant la ponctuation de la piste');
    assert.doesNotMatch(texte(c), /\bl’id\b/, c.id + ' : « l’identifiant », pas « l’id »');
  }
});

test('les règles qui décident du résultat sont écrites noir sur blanc', () => {
  assert.ok(defi('wm3').precis.includes('La moyenne porte sur une valeur par commande, pas sur une valeur par ligne de commande.'), 'panier moyen du restaurant');
  assert.match(defi('fd10').precis.join(' '), /et non comme une moyenne de prix au kilo/, 'prix au kilo pondéré par les kilos');
  assert.match(defi('vm4').precis.join(' '), /une seule fois, même payée en deux fois/, 'deux paiements ne doublent pas les voyageurs');
  assert.match(defi('sm6').precis.join(' '), /ne cumulent ni leurs inscriptions ni leurs places/, 'chaque créneau se juge à part');
  assert.match(texte(defi('af20')).replace(/ /g, ' '), /strictement avant « 09:00 »/, 'un départ à 9 h pile est exclu');
});

test('les titres de la base Aéroport restent ceux d’Elisa', () => {
  assert.equal(defi('am5').titre, 'Les voyageurs fidèles');
  assert.equal(defi('am3').titre, 'Les destinations les plus populaires');
  assert.equal(defi('af1').titre, 'Quels vols sont retardés ?');
});
