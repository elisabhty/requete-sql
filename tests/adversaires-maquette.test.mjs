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

test('l’onglet s’appelle « Adversaires »', () => {
  assert.ok(app.includes("DEFIS_ONGLETS=[['jouer','Jouer'],['classement','Classement'],['amis','Adversaires']];"));
  assert.ok(app.includes('invite des amis avec un code depuis l’onglet Adversaires.') && app.includes('>Ouvrir l’onglet Adversaires</button>'), 'le classement le nomme pareil');
});

test('le bandeau : deux épées croisées, dans le dessin des autres autocollants', () => {
  const ctx = vm.createContext({});
  vm.runInContext(cut('function lqStkSvg(k){', '\n/* Le haut de chaque page dans la DA de la vitrine'), ctx);
  const svg = ctx.lqStkSvg('epees');
  assert.ok(svg.startsWith('<svg class="lq-stk" viewBox="0 0 48 48" aria-hidden="true">'));
  /* la silhouette (l’ombre, le blanc), puis le dessin : chaque fois les deux épées, penchées l’une contre l’autre */
  assert.equal((svg.match(/<g transform="rotate\(-45 24 24\)">/g) || []).length, 3);
  assert.equal((svg.match(/<g transform="rotate\(45 24 24\)">/g) || []).length, 3);
  assert.equal((svg.match(/<g[ >]/g) || []).length, (svg.match(/<\/g>/g) || []).length, 'les groupes se ferment');
  for (const c of ['#C9BEFF', '#6A4DF4', '#FFC83D']) assert.ok(svg.includes(`fill="${c}"`), `ses couleurs : ${c}`);
  assert.ok(app.includes(`<div class="dx-amis-tete dx-bande"><span class="room-stk" aria-hidden="true">\${lqStkSvg('epees')}</span>`));
  assert.ok(!cut('function defisAmisPeindre(){', '\nfunction amisListesPeindre(){').includes("lqStkSvg('user')"), 'plus le bonhomme');
});

test('la carte vide : le duel, le titre, la phrase ; puis les deux boutons, avec leur icône', () => {
  assert.ok(app.includes("chatBonusHtml('duel','is-vide dx-amis-chat'):''}<p class=\"dx-vide-t\">Aucun adversaire pour l’instant&nbsp;!</p><p class=\"dx-vide\">Les joueurs que tu affrontes en salle apparaîtront ici automatiquement après une partie.</p></div>`"));
  const boutons = cut('  const boutons=`', '`;');
  assert.ok(boutons.indexOf('Créer ma partie') < boutons.indexOf('Rejoindre avec un code'), 'le bouton plein d’abord');
  assert.ok(boutons.includes('class="dx-sec is-main" aria-haspopup="dialog" onclick="defisCarte(\'creer\')">${DX_AJOUT_SVG}Créer ma partie</button>'));   // 9 novembre : « Créer ma partie », comme dans Jouer et la feuille qu’il ouvre
  assert.ok(boutons.includes('class="dx-sec" aria-haspopup="dialog" onclick="defisCarte(\'code\')">${DX_LIEN_SVG}Rejoindre avec un code</button>'));
  for (const k of ['DX_AJOUT_SVG', 'DX_LIEN_SVG']) {
    const d = cut(`const ${k}='`, "';");
    assert.ok(d.includes('viewBox="0 0 24 24"') && d.includes('aria-hidden="true"') && d.includes('stroke="currentColor"') && !/#[0-9A-Fa-f]{3,6}/.test(d), `${k} : la couleur du texte du bouton`);
  }
  assert.ok(lq.includes('html.lq #scr-defis .dx-sec>svg{flex:none;width:22px;height:22px}'));
  for (const k of ['Inviter un ami</button>', 'J’ai un code de salle', 'Retrouve ceux que tu as affrontés'])
    assert.ok(!app.includes(k), k);
});

test('plus de bouton pour se retirer du classement ; qui s’était retiré peut y revenir', () => {
  assert.ok(!app.includes('>Ne plus apparaître</button>'));
  assert.ok(app.includes('Tu y apparais avec ton pseudo.</p>`;') && app.includes("Tu y apparais avec ton pseudo${paysMontre()&&paysDuProfil()?' et ton drapeau':''}.`:'';"));
  assert.equal(app.split('onclick="clsQuitter()">Y apparaître avec mon pseudo</button>').length - 1, 2, 'sous le Top 5 et sous ta place');
  assert.ok(app.includes("${clsOn()?'':`<button class=\"acc-row\" type=\"button\" onclick=\"clsQuitter()\">"), 'Mon compte : la ligne pour revenir');
});
