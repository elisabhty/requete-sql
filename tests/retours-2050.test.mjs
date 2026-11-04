/* Elisa, 1er novembre, 20 h 50 : réf. 1 « les cadres n’ont pas la même largeur » ; réf. 2 « comment gérer le féminin ou le masculin ? » ;
   réf. 3 « trop sombre, et pourquoi parfois trop dézoomé sur ordi » ; réf. 4 « le temps de réaction est trop lent et cache le texte ».
   (Réf. 3 et 4 : la mécanique de la feuille de réponse est testée dans answer-sheet-fit.test.mjs.) */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const anim = f => fs.readFileSync(new URL('../assets/anim/' + f, import.meta.url), 'utf8');

test('réf. 1 : la barre « Valide la leçon » a la largeur de la carte de la vidéo', () => {
  assert.ok(css.includes('html.lq #lesson-body .ls-nav:has(.ls-next[data-jc-gate]){margin-left:0!important;margin-right:0!important;padding:0!important;background:none!important;border:0!important;box-shadow:none!important}'));
  assert.ok(css.indexOf('/* 55. Réf. 1') > css.indexOf('html.lq #lesson-body .ls-nav:has(.ls-next[data-jc-gate]){padding:6px!important;'), 'après la règle qu’elle remplace');
});

test('réf. 2 : les phrases de l’élève et pour l’élève, les mêmes pour tout le monde', () => {
  assert.ok(anim('bases-relationnelles.html').includes("const REPONSE = ['Avec plaisir !', 'On commence quand vous le voulez !'];"));
  for (const t of ['Envie d’écrire ta prochaine requête', '\'C’est bon pour moi ✓\':\'C’est bon pour moi\'', '✓ c’est bon</em>', '`En attente : ${',
    'Une question pour t’entraîner', '\'Ta première note t’attend\'', "${h.solo?'En solo':'Entre amis'}", '>En solo</button>', 'En solo ou entre amis'])
    assert.ok(app.includes(t), t);
  for (const t of ['Prêt·e pour', 'Je suis prêt', 'pas prêt</em>', 'Pas encore prêt', 'Prêt pour une question', 'Prêt pour ta première note', "['solo','Seul']", '>Seul</button>'])
    assert.ok(!app.includes(t), t);
});

test('réf. 3 : les zones où l’on range les étiquettes sont blanches, plus grisées par le violet', () => {
  const pages = fs.readdirSync(new URL('../assets/anim/', import.meta.url)).filter(f => /^projet-.*\.html$/.test(f));
  let n = 0;
  for (const f of pages) { const s = anim(f); assert.ok(!s.includes('dashed #C9BCFF;background:rgba(255,255,255,.85)'), f); if (s.includes('dashed #C9BCFF;background:#fff')) n++; }
  assert.ok(n >= 15, `${n} pages`);
});

test('le badge « Votre formatrice » : centré en bas du portrait, sans descendre vers le lecteur (21 h 04)', () => {
  assert.ok(anim('bases-relationnelles.html').includes('#cap .cap-stk::after{content:"Votre formatrice";position:absolute;left:50%;bottom:-6px;top:auto;translate:-50% 0;'));
});

test('20 h 29 : le premier cours dit ce qu’est le SQL et une requête, puis le type de donnée sur le code de la table clients', () => {
  const p = anim('bases-relationnelles.html');
  for (const t of ['[197.15, 201.35, "Le <b>SQL</b> est le langage qui permet<br>de communiquer avec le SGBD."]',
    '"Une <b>requête</b> est une instruction<br>écrite en SQL : elle demande au SGBD<br>de lire ou de modifier des données."',
    '[207.85, 212.05, "Ici, <code>SELECT * FROM produits</code><br>demande d’afficher tous les produits<br>de notre catalogue (la <b>table produits</b>)."]',
    '[212.15, 216.95, "Le SGBD l’<b>exécute</b>',
    '[290.45, 296.55, "Elle se déclare à la création de la table, avec <code>PRIMARY KEY</code> placé juste après le type de la colonne."]',
    '[296.65, 301.65, "<code>INTEGER</code> est le <b>type de donnée</b><br>de la colonne <code>id</code> : un nombre entier."]',
    '<span><code>prenom</code><b>TEXT</b></span><span><code>email</code><b>TEXT</b></span><span><code>prix</code><b>REAL</b></span>',
    "pulse($$('#rq1 .kw'), 208.1, 3, 'rgba(255,224,138,.55)');", "stackBelow('#pkty', '#pk5', 0, 34);", 'const DURATION = 527.55;'])
    assert.ok(p.includes(t), t);
  assert.ok(app.includes("thumb:'assets/anim/bases-relationnelles-thumb.webp',duree:'10 min 20'"), 'la fiche du cours : sa nouvelle durée');
});

test('20 h 56 : les étiquettes des types sans le nom de la table ; « 1er » en exposant ; le résultat de CASE au-dessus de la légende', () => {
  const dates = anim('fonctions-dates.html'), cas = anim('case.html');
  assert.ok(dates.includes('la date passe au 1<sup>er</sup> août."]') && dates.includes('["vwjy7or","ch04",5.24,9.99]') && !dates.includes('1ᵉʳ'), '1er, la voix suit');
  assert.ok(dates.includes('#cap sup{font-size:.62em;line-height:0;vertical-align:.62em;letter-spacing:0}'));
  assert.ok(cas.includes('<div class="tbl card" id="tbl6">') && cas.includes("stackBelow('#tbl6', '#s6code', 0, 24);") && cas.includes('#rows6 .tr.tc{height:42px;font-size:26px}'));
});
