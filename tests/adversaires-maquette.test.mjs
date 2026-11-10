/* Elisa, 8 novembre, 15 h 09 : la capture de l’onglet et sa maquette, avec ses corrections : « Ton prochain rival t’attend ! » au lieu
   de « Retrouve ceux que tu as affrontés » ; « Créer une partie » au lieu de « Rejoindre une partie » ; « Rejoindre avec un code » au
   lieu de « J’ai un code de salle » ; « Supprimer les boutons masquer mon profil ».
   De la maquette : l’onglet s’appelle « Adversaires » ; deux épées croisées dans le bandeau ; la carte vide : le duel, « Aucun
   adversaire pour l’instant ! », puis « Les joueurs que tu affrontes en salle apparaîtront ici automatiquement après une partie. » ;
   le bouton plein (un bonhomme et un plus) au-dessus du bouton blanc (un maillon). Les deux ouvrent les feuilles de Jouer.
   Plus de « Ne plus apparaître » (sous le Top 5 et sous ta place) ; qui s’était déjà retiré garde « Y apparaître avec mon pseudo ».
   Vérifié dans un navigateur (393 et 320 px) : vide, rempli. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('10 novembre (« Supprime l’onglet adversaire ») : deux onglets, Jouer et Classement ; l’ancien onglet ramène à Jouer', () => {
  assert.ok(app.includes("DEFIS_ONGLETS=[['jouer','Jouer'],['classement','Classement']];"));
  assert.ok(app.includes('class="room-seg is-2 dx-tabs"'));
  for (const k of ['id="defis-amis"', 'function defisAmisPeindre', 'function amisListesPeindre', 'function jeuVersAdversaires', 'l’onglet Adversaires.', '>Ouvrir l’onglet Adversaires<', 'DX_AJOUT_SVG', 'DX_LIEN_SVG'])
    assert.ok(!app.includes(k), k);
  const o = app.slice(app.indexOf('function defisOnglet(k){'));
  assert.ok(o.startsWith("function defisOnglet(k){\n  if(k==='amis')k='jouer';\n  if(!['jouer','classement','stats'].includes(k))return;"), 'un vieux lien ramène à Jouer');
  assert.ok(app.includes("if(['jouer','classement'].includes(p.onglet))DEFIS.onglet=p.onglet;"), 'un choix gardé sur l’appareil aussi');
  assert.ok(app.includes("${chip('amis','Mes adversaires')}"), 'tes adversaires restent dans le classement');
});
test('plus de bouton pour se retirer du classement ; qui s’était retiré peut y revenir', () => {
  assert.ok(!app.includes('>Ne plus apparaître</button>'));
  assert.ok(app.includes('Tu y apparais avec ton pseudo.</p>`;') && app.includes("Tu y apparais avec ton pseudo${paysMontre()&&paysDuProfil()?' et ton drapeau':''}.`:'';"));
  assert.equal(app.split('onclick="clsQuitter()">Y apparaître avec mon pseudo</button>').length - 1, 2, 'sous le Top 5 et sous ta place');
  assert.ok(app.includes("${clsOn()?'':`<button class=\"acc-row\" type=\"button\" onclick=\"clsQuitter()\">"), 'Mon compte : la ligne pour revenir');
});
