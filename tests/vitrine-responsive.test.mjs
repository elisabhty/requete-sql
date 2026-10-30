/* Vitrine : les cartes restent lisibles à toutes les largeurs (Elisa, 30 octobre, 19 h 12 : « les cartes que tu as faites ne
   sont pas responsives », captures d’un téléphone : « Me reconvertir dans la data », « Débutant » et « Analyste » coupés,
   « Fiches incom… »).
   Les widgets se règlent sur la largeur de leur carte (requêtes de conteneur), pas sur celle de l’écran : une même carte
   peut être étroite sur un téléphone, dans la grille à deux colonnes d’une tablette ou à trois colonnes d’un petit
   ordinateur. Vérifié dans un navigateur de 320 à 1 440 px : aucun texte coupé, rien ne dépasse de sa carte ni de l’écran.
   Ce test garde les règles qui l’assurent. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = lire('decouvrir/vitrine.css'), vitrine = lire('decouvrir/index.html');
/* Une règle de premier niveau (en début de ligne), et le contenu d’un bloc @container */
const regle = sel => { const i = css.indexOf(`\n${sel}{`); assert.ok(i >= 0, `règle ${sel}`); return css.slice(i + 1, css.indexOf('}', i) + 1); };
const bloc = q => {
  const i = css.indexOf(`${q}{`); assert.ok(i >= 0, q);
  for (let k = css.indexOf('{', i), n = 0; k < css.length; k++) {
    if (css[k] === '{') n++;
    else if (css[k] === '}' && !--n) return css.slice(css.indexOf('{', i) + 1, k);
  }
};

test('les cartes sont des conteneurs : leurs widgets suivent la largeur de la carte, pas celle de l’écran', () => {
  assert.ok(css.includes('.bento .tile.db{container:tuile/inline-size}'), 'les atouts');
  assert.ok(css.includes('.how-list.hw>li{container:etape/inline-size}'), 'les étapes de « Comment ça marche »');
  assert.ok(css.includes('.mod{container:carte/inline-size}'), 'les cartes des parcours');
  assert.doesNotMatch(css, /\.mm2-c\.c1\{translate:-70% 8px\}/, 'l’éventail des cartes mémo ne dépend plus de la largeur de l’écran');
});

test('les grilles des cartes ne s’élargissent jamais au-delà de l’écran', () => {
  for (const sel of ['.bento', '.how-list', '.mods']) assert.match(regle(sel), /grid-template-columns:minmax\(0,1fr\)/, sel);
  assert.ok(css.includes('.bento{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'tablette');
  assert.ok(css.includes('.bento{grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}'), 'ordinateur');
  assert.match(regle('.cs2-case'), /grid-template-columns:minmax\(0,1fr\)/, 'le cas pratique ne déborde pas de sa carte');
});

test('aucun texte coupé dans les cartes : ni points de suspension, ni nombre de lignes limité', () => {
  for (const sel of ['.hw1-o b,.hw1-s b', '.hw2 ul b', '.hw3-m>span', '.mm2-top small', '.mod-body p'])
    assert.doesNotMatch(regle(sel), /text-overflow:ellipsis|line-clamp|overflow:hidden/, sel);
  assert.match(regle('.hw1-s b'), /min-width:max-content/, 'les niveaux et les durées gardent toute leur largeur');
  assert.match(regle('.hw1-o b'), /white-space:normal/, 'l’objectif passe sur deux lignes plutôt que d’être coupé');
  assert.match(regle('.hw2 ul li'), /min-height:38px/, 'une ligne de la séance grandit avec son texte');
  assert.match(regle('.hw3-m b'), /flex-wrap:wrap;.*padding-right:66px/, 'le nom de la coach ne passe pas sous « maintenant »');
  assert.match(regle('.cs2-f'), /flex-wrap:wrap/, 'le tampon « Cas résolu » passe sous la requête');
  assert.match(regle('.side .stores.side-st .store'), /min-width:max-content/, 'les badges des stores passent l’un sous l’autre');
});

test('dans une carte étroite, chaque widget change de mise en page', () => {
  /* Comment ça marche · 1 : la question au-dessus de ses réponses ; 2 : le type de l’activité sous son nom */
  assert.match(bloc('@container etape (max-width:359.98px)'), /\.hw1-r\{grid-template-columns:minmax\(0,1fr\)/);
  const s2 = bloc('@container etape (max-width:319.98px)');
  assert.match(s2, /\.hw2 ul li\{display:grid;grid-template-columns:18px minmax\(0,1fr\)/);
  assert.match(s2, /\.hw2 ul li::before\{grid-row:span 2\}/);
  /* Atouts : l’éventail des cartes mémo se resserre, l’import passe en compact puis de haut en bas */
  assert.match(bloc('@container tuile (max-width:399.98px)'), /\.mm2-c\.c1\{translate:-68% 8px\}\.mm2-c\.c2\{translate:68% 8px\}/);
  assert.match(bloc('@container tuile (max-width:279.98px)'), /\.mm2-c\{--w:112px\}/);
  assert.match(bloc('@container tuile (max-width:289.98px)'), /\.dt2-xh b\{font-size:10\.5px\}/);
  const d = bloc('@container tuile (max-width:239.98px)');
  assert.match(d, /\.dt2\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(d, /\.dt2-arr svg\{rotate:90deg\}/, 'la flèche pointe vers les tables');
  /* Parcours : les trois affiches rétrécissent ensemble au lieu d’être coupées sur les côtés */
  const a = bloc('@container carte (max-width:343.98px)');
  assert.match(a, /\.mod-top\{--k:\.95;height:calc\(168px \* var\(--k\)\)\}/);
  assert.match(a, /\.mod-top>img,\.nx\{scale:var\(--k\)\}/);
  for (const n of [1, 2, 3]) assert.match(a, new RegExp(`\\.mod-top>img:nth-child\\(${n}\\),\\.nx${n}\\{translate:`), `affiche ${n}`);
  for (const [w, k] of [['327.98', '.87'], ['299.98', '.81'], ['279.98', '.75']])
    assert.ok(css.includes(`@container carte (max-width:${w}px){.mod-top{--k:${k}}}`), `échelle ${k}`);
  assert.match(css, /\.nx-m\{position:absolute;z-index:1;right:1px;/, 'la mascotte reste dans le cadre de son affiche');
});

test('la ponctuation ne commence jamais une ligne : espace insécable avant « : ; ? ! » et dans les guillemets', () => {
  const page = vitrine.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '');
  const fautes = [...page.matchAll(/>([^<]+)</g)].map(m => m[1].trim()).filter(t => /\S [:;?!»]|« /.test(t));
  assert.deepEqual(fautes, []);
  assert.ok(vitrine.includes("'Une compétence que tu aimerais apprendre avec Requête\\u00a0? Propose-la pour un prochain parcours.'"), 'carte « Bientôt »');
  assert.ok(vitrine.includes('Déjà&nbsp;1/3.') && vitrine.includes('Aujourd’hui&nbsp;· Parcours&nbsp;progressif'), 'séance du jour');
});
