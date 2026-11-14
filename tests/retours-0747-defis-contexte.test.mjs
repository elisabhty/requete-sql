/* Elisa, 14 novembre, 7 h 47 : « il y a des défis qui sont pas très bien expliqués pour quelqu'un qui arrive sur l'appli et qui
   connaît pas le contexte. Et notamment les indices, ils sont trop explicites. » Puis « Échelle progressive » pour les indices, et
   « Oui parfait » sur le modèle wf10 : chaque situation présente d'abord le lieu, explique les notions propres à ce lieu (« client de
   passage », « inscrit sur le site », « sortie » d'un food truck…), dit qui demande et pourquoi. Les 477 situations et les 477
   pistes sont réécrites ; les consignes (Affiche, Garde, Trie, À savoir), les solutions et les niveaux ne changent pas. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const C = vm.runInNewContext(app.slice(app.indexOf('const CHALLENGES=['), app.indexOf('const NIV=')) + ';CHALLENGES');
const S = id => C.find(c => c.id === id).situation.replace(/ /g, ' ');
const mots = s => String(s || '').split(/[\s ]+/).filter(Boolean).length;

test('wf10, le modèle validé : le lieu, les comptes fidélité, les clients de passage, les avis, puis le besoin d’Agathe', () => {
  assert.equal(S('wf10'), 'La Perle du Wok est un restaurant chinois spécialisé dans la cuisine au wok. Certains clients ont un compte fidélité : ils sont enregistrés dans la base. Les autres sont des clients de passage, sans compte. Après une commande, un client qui a un compte peut laisser un avis, une seule fois : une note, parfois avec un commentaire. Agathe, qui gère le programme fidélité, trouve que les clients laissent trop peu d’avis. Elle veut repérer toutes les commandes qui n’en ont reçu aucun, quelles qu’elles soient : même une commande annulée, même celle d’un client de passage. À toi de jouer !');
});

test('les notions propres à chaque lieu sont expliquées dans la situation', () => {
  assert.ok(S('af5').length && S('tf1').includes('deux food trucks, ces camions aménagés en cuisine, et un triporteur, un petit utilitaire électrique à trois roues'));
  assert.ok(S('kf1').includes('en damage, c’est-à-dire en cours de préparation'), 'le damage');
  assert.ok(S('bf9').includes('c’est la régulation'), 'la régulation des vélos');
  assert.ok(S('qf9').includes('Les nitrates sont un déchet des animaux qui s’accumule dans l’eau'), 'les nitrates');
  assert.ok(S('rf5').includes('la miellerie, l’atelier où l’on extrait le miel'), 'la miellerie');
  assert.ok(S('ef2').includes('un maître du jeu, qui suit l’équipe derrière les caméras'), 'le maître du jeu');
  assert.ok(S('gm3').includes('sa jauge, le nombre maximal de spectateurs qu’elle peut accueillir'), 'la jauge');
  assert.ok(S('td9').includes('on parle de rupture'), 'une rupture de stock');
  assert.ok(S('sf1').includes('Chaque adhérent, c’est-à-dire chaque membre du club'), 'un adhérent');
});

test('chaque situation : le lieu présenté, la personne et sa raison, 150 mots au plus ; chaque piste : courte et sans SQL', () => {
  assert.equal(C.length, 477);
  for (const c of C) {
    const s = c.situation.replace(/ /g, ' ');
    assert.match(s.split('. ')[0], / (est|sont|accueille|vend|travaille|rattache|permet|enregistre|pèse|demande|tient|suit|voit|garde) /, `${c.id} : une première phrase qui présente le lieu`);
    assert.ok(mots(s) >= 25 && mots(s) <= 150, `${c.id} : ${mots(s)} mots`);
    assert.ok(mots(c.indice) <= 70, `${c.id} : piste de ${mots(c.indice)} mots`);
    assert.doesNotMatch(c.indice, /`|\bSQLite\b/, `${c.id} : la piste ne nomme ni table, ni colonne, ni moteur`);
  }
});

test('les trois indices : Où chercher, La piste, L’outil ; plus de squelette de la requête', () => {
  const f = app.slice(app.indexOf('function defiIndices(c){'), app.indexOf('\n}\n', app.indexOf('function defiIndices(c){')));
  assert.ok(f.includes("['Où chercher',defiOuChercher(c)]") && f.includes("['La piste',escCode(c.indice||") && f.includes("['L’outil',defiOutils(c.sol)]"));
  assert.ok(!f.includes('defiSquelette'), 'le squelette dictait presque la requête');
});
