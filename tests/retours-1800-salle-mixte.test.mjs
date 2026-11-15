/* Elisa, 15 novembre, 16 h 57 : « ça veut dire qu’un français et un anglais peuvent jouer ensemble sans problème ? chacun verra de son
   côté les écrans traduits ? test pour être sûr ? »
   Le test (deux onglets dans la même salle, ?jeu=local, l’un en français, l’autre en anglais : salle d’attente, manches, indices,
   temps écoulé, fin, correction, revanche) a montré la salle de défi encore en français chez le joueur anglais : le commentateur,
   la fin des manches, le podium, la correction, la revanche. Leurs textes sont dans langue-en.js ; la phrase du lecteur d’écran
   (qui en est où) se traduit joueur par joueur (jeuTr) ; les rangées d’initiales ne font plus partie des phrases (data-notrad). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html');
const { moteur } = await import(path.join(ROOT, 'tools/langue/commun.mjs'));
const L = moteur('en');
L.valeur('pseudo', () => '@sam');
L.valeur('prenom', () => 'Sam');

test('la salle de défi en anglais : du commentateur à la revanche', () => {
  const attendu = {
    'En attente des autres…': 'Waiting for the others…',
    '@lea et @noe cherchent encore': '@lea and @noe are still searching',
    'Plus que @lea en course…': 'Only @lea still in the race…',
    'Tu ouvres le score !': 'You open the scoring!',
    '@lea prend la tête !': '@lea takes the lead!',
    'Remontée de @noe, 2e !': '@noe climbs to #2!',
    'Tout le monde a trouvé !': 'Everyone found it!',
    'Manche 1/3 terminée': 'Round 1/3 over',
    'Manche unique terminée': 'Single round over',
    '2e place, bien joué !': '2nd place, well done!',
    '@lea remporte la manche. Tes points comptent quand même !': '@lea wins the round. Your points still count!',
    'Personne n’a trouvé cette manche : tout se joue à la suivante !': 'Nobody found it this round: it all comes down to the next one!',
    'Partie terminée · 2 manches': 'Game over · 2 rounds',
    'Tu as gagné !': 'You won!',
    'Devant @lea, de 40 points.': 'Ahead of @lea by 40 points.',
    '@lea l’emporte de 10 points. À toi la revanche !': '@lea wins by 10 points. Your turn for a rematch!',
    '2e : @lea, 460 points en 16 s': '#2: @lea, 460 points in 16 s',
    '1er : @sam (toi), 500 points en 9 s': '#1: @sam (you), 500 points in 9 s',
    'Voir la correction': 'See the answer',
    'Correction · manche 1': 'Answer · round 1',
    'Ta requête, acceptée : elle renvoie le même résultat.': 'Your query, accepted: it returns the same result.',
    'On rejoue ?': 'Play again?',
    '1/2 pour rejouer': '1/2 to play again',
    '0/3 pour la revanche': '0/3 for the rematch',
    '1/3 prêts': '1/3 ready',
    'On attend @lea : Revanche ou Quitter la salle.': 'Waiting for @lea: Rematch or Leave the room.',
    'Quitter la salle': 'Leave the room',
    'Temps écoulé': 'Time’s up',
    'Plus qu’une minute !': 'One minute left!',
  };
  for (const [fr, en] of Object.entries(attendu)) assert.equal(L.t(fr), en, fr);
});

test('la phrase du lecteur d’écran, joueur par joueur ; les initiales hors des phrases', () => {
  for (const [fr, en] of [['@lea : en réflexion, 0 point', '@lea: thinking, 0 points'], ['Toi : trouvé en premier, 1 200 points', 'You: found it first, 1,200 points'],
    ['@noe : teste une requête, 230 points', '@noe: testing a query, 230 points'], ['Toi : en train d’écrire, 0 point', 'You: typing, 0 points'], ['@lea : trouvé, 460 points', '@lea: found it, 460 points']])
    assert.equal(L.t(fr), en, fr);
  assert.ok(app.includes("qui:ys.map(x=>jeuTr(`${esc(x.nom)}\\u00a0: ${premier(x)?'trouvé en premier':mot[x.etat]}, ${x.pts.toLocaleString('fr-FR')}${pt(x.pts).replace('pt','point')}`)).join(jeuTrEn()?'; ':' ; ')"));
  assert.ok(app.includes('<span class="jeu-sr" id="jeu-direct-qui" data-notrad>${t.qui}</span>'));
  assert.ok(app.includes('return `<i class="jeu-prets-pts" aria-hidden="true" data-notrad>'));
  assert.ok(app.includes('<span class="jeu-rv-av" aria-hidden="true" data-notrad>${av}</span>'));
  /* jeuTr : le français tel quel, sans moteur aussi */
  const d = app.indexOf('function jeuTrEn(){'), f = app.indexOf('\n', app.indexOf('function jeuTr(s){'));
  const ctx = { window: {} };
  vm.runInNewContext(app.slice(d, f) + ';this.tr=jeuTr;this.en=jeuTrEn;', ctx);
  assert.equal(ctx.tr('Toi : en réflexion, 0 point'), 'Toi : en réflexion, 0 point');
  assert.equal(ctx.en(), false);
  ctx.window.REQUETE_LANGUE = { code: 'en', t: s => L.t(s) };
  assert.equal(ctx.tr('Toi : en réflexion, 0 point'), 'You: thinking, 0 points');
  assert.equal(ctx.en(), true);
});
