/* Elisa, 8 novembre, 14 h 40 puis 14 h 48 : après l’avis qu’elle a demandé sur l’onglet Joueurs, « Finalement je veux marcher qu’avec
   code » ; à la question « on ne retrouve un joueur qu’avec le code de salle ? Je retire “Rechercher un joueur” (l’ajout par pseudo),
   l’onglet garde ceux avec qui tu as joué, plus “Inviter un ami”, qui donne le code », « Oui ».
   - Plus d’ajout par pseudo nulle part : ni dans l’onglet, ni « Ajouter à mes adversaires » dans la fiche d’un joueur du classement ;
     donc plus de « × » pour retirer. Un ancien ajout reste dans la progression (rien n’est effacé) mais ne s’affiche plus.
   - L’onglet : « Ton prochain rival t’attend ! » (repris de l’avis), la mascotte, une phrase qui dit comment on s’y retrouve, et un seul
     bouton, « Inviter un ami » (une salle privée et son code). Un peu moins de vide autour de la mascotte.
   - « Mes amis » du classement : ceux avec qui tu as joué ; vide, il renvoie à l’onglet Joueurs pour inviter avec un code. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('plus d’ajout par pseudo nulle part, plus rien à retirer', () => {
  for (const k of ['function amisAjouter(', 'function amisGarder(', 'function amisRetirer(', 'function amisFormBasculer(', 'function dxFicheAjouter(',
    '>Ajouter à mes adversaires</button>', 'id="dx-ajout"', 'amisForm', 'class="dx-retirer"'])
    assert.ok(!app.includes(k), k);
  for (const k of ['.dx-ajout', '.dx-retirer', '.dx-fiche-ajout']) assert.ok(!lq.includes(k), k);
});

test('la liste et « Mes amis » : ceux avec qui tu as joué ; un ancien ajout reste dans la progression sans s’afficher', () => {
  const ctx = vm.createContext({
    state: { salle: { mates: { a: { n: '@tom', g: 3, w: 2, l: 1, at: 2 }, b: { n: '@vu', g: 0, at: 9 } }, amisAjoutes: [{ n: '@lea', at: 5 }] } },
    drapCle: v => String(v || '').toLowerCase().replace(/^@+/, ''),
  });
  vm.runInContext(cut('function amisListe(){', '\n/* Le haut de la carte') + cut('function clsAmisPseudos(){', '\nfunction clsCleV2(){'), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.amisListe().map(a => a.n))), ['@tom']);
  assert.ok(!ctx.amisListe()[0].ajout);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.clsAmisPseudos())), ['@tom', '@vu']);
  assert.ok(app.includes('const a=salleSrc.amisAjoutes.filter(x=>x&&typeof x===\'object\'&&!Array.isArray(x))'), 'la progression garde les anciens ajouts');
});

test('l’onglet : le titre, la phrase, les boutons (15 h 09 : « Créer une partie », « Rejoindre avec un code ») ; « Mes amis » vide renvoie à l’onglet', () => {
  assert.ok(app.includes("function amisTitre(n){return n?`${n} adversaire${n>1?'s':''}`:'Ton prochain rival t’attend&nbsp;!';}"));
  assert.ok(app.includes('const boutons=`<div class="dx-duo"><button type="button" class="dx-sec is-main" aria-haspopup="dialog" onclick="defisCarte(\'creer\')">${DX_AJOUT_SVG}Créer une partie</button><button type="button" class="dx-sec" aria-haspopup="dialog" onclick="defisCarte(\'code\')">${DX_LIEN_SVG}Rejoindre avec un code</button></div>`;'));
  assert.ok(app.includes('<p class="dx-vide">Les joueurs que tu affrontes en salle apparaîtront ici automatiquement après une partie.</p>'));
  assert.ok(app.includes('Aucun de tes amis n’est encore classé. Joue avec eux&nbsp;: invite-les avec un code depuis l’onglet Adversaires.'));
  assert.ok(lq.includes('html.lq #scr-defis .dx-amis.is-v2 .dx-amis-actions .dx-duo{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin:0}'), 'remplie : les boutons sur toute la largeur, l’un sous l’autre');
});

test('un peu moins de vide autour de la mascotte', () => {
  for (const k of ['html.lq #scr-defis .dx-vide-bloc.is-amis{margin:0}', 'html.lq #scr-defis .dx-vide-bloc.is-amis .chat-bonus{width:96px;margin-bottom:6px}',
    'html.lq #scr-defis .dx-amis.is-v2 .dx-amis-vide{padding:12px 16px 16px;',
    'html.lq #scr-defis .dx-amis.is-v2 .dx-amis-vide .dx-duo{display:flex;flex-direction:column;margin-top:14px;gap:10px}'])
    assert.ok(lq.includes(k), k);
});
