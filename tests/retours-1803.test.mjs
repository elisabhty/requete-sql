/* Elisa, 5 novembre, 18 h 03 : « Un agent peut améliorer les questions réponses de la même manière que l’exemple en référence : bien
   formulé, avec un expert de la formulation et avec des exemples. » La référence : ent-v2-50 (1:N et N:N), sa réponse en deux
   paragraphes, ses notions, son schéma, son exemple concret commenté, sa précision et son exemple SQL.
   Les 104 cartes qui n’avaient qu’une réponse courte et un exemple SQL ont été réécrites sur ce modèle (six rédacteurs, puis trois
   relecteurs) : chaque exemple SQL a été exécuté dans SQLite sur les données de son tableau (et dans PostgreSQL pour ce que SQLite
   n’a pas). Ce test garde la forme et la typographie ; le fond a été vérifié à la main. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a0 = app.indexOf('const ENTRETIEN=['), b0 = app.indexOf('\n];', a0) + 3;
const ctx = {}; vm.runInNewContext(app.slice(a0, b0).replace('const ENTRETIEN=', 'this.E='), ctx);
const E = JSON.parse(JSON.stringify(ctx.E));
const REECRITES = ('01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 '
  + '44 45 46 47 48 49 55 57 66 68 70 73 76 77 78 79 80 81 82 83 86 87 88 89 90 91 94 96 97 103 104 105 107 109 110 112 113 114 115 116 118 119 120 '
  + '121 122 123 124 125 126 127 128 129 130 131 132 134 135 136 137 138 140').split(' ').map(n => 'ent-v2-' + n);
const NB = ' ';
const sansCode = t => t.replace(/<code>.*?<\/code>/g, 'CODE');
const typo = (id, champ, t, html) => {
  const s = html ? sansCode(t) : t;
  assert.doesNotMatch(s, / [:;?!»]/, `${id} ${champ} : une espace insécable avant « : ; ? ! » (${(s.match(/.{0,30} [:;?!»]/) || [''])[0]})`);
  assert.doesNotMatch(s, /[A-Za-zÀ-ÿ)][;?!]/, `${id} ${champ} : une espace insécable avant « ; ? ! »`);
  assert.doesNotMatch(s, /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/, `${id} ${champ} : l’apostrophe typographique dans les mots`);
  assert.doesNotMatch(s, /«(?! )|(?<! )»/, `${id} ${champ} : des espaces insécables dans les guillemets`);
};

test('la banque garde ses 142 cartes, leurs niveaux et leurs notions', () => {
  assert.equal(E.length, 142);
  assert.deepEqual(['Débutant', 'Intermédiaire', 'Avancé'].map(n => E.filter(q => q.niveau === n).length), [47, 52, 43]);
  assert.equal(new Set(E.map(q => q.id)).size, 142);
  assert.ok(REECRITES.every(id => E.some(q => q.id === id)) && REECRITES.length === 104);
  assert.ok(E.every(q => q.ex && q.notions), 'chaque carte a maintenant ses notions et son exemple concret');
});

test('les 104 cartes réécrites : la réponse en deux ou trois paragraphes, des notions, un exemple concret, un SQL qui tient sur iPhone', () => {
  for (const id of REECRITES) {
    const q = E.find(x => x.id === id);
    const paras = q.a.split('\n\n');
    assert.ok(paras.length >= 2 && paras.length <= 3 && paras.every(p => p.trim() && !p.includes('\n')), `${id} : 2 ou 3 paragraphes`);
    assert.ok(q.a.length >= 230 && q.a.length <= 760, `${id} : ${q.a.length} caractères`);
    assert.doesNotMatch(q.a.replace(/<\/?(code|b)>/g, ''), /<[^>]*>/, `${id} : seulement <code> et <b>`);
    typo(id, 'a', q.a, true);
    if (q.apres) typo(id, 'apres', q.apres, true);
    assert.ok(Array.isArray(q.notions) && q.notions.length >= 2 && q.notions.length <= 4, `${id} : 2 à 4 notions`);
    const ex = q.ex;
    assert.ok(ex.cols.length >= 2 && ex.cols.length <= 4 && ex.rows.length >= 2 && ex.rows.length <= 6, `${id} : un petit tableau`);
    assert.ok(ex.rows.every(r => r.length === ex.cols.length && r.every(c => typeof c === 'string' && c.length <= 18)), `${id} : des cellules courtes, autant que de colonnes`);
    const large = ex.cols.reduce((n, c, j) => n + Math.max(c.length, ...ex.rows.map(r => r[j].length)), 0);
    assert.ok(large <= 44, `${id} : le tableau tient sur un iPhone (${large})`);
    assert.ok((ex.mono || []).every(j => j >= 0 && j < ex.cols.length) && (ex.cut == null || (ex.cut >= 0 && ex.cut < ex.rows.length)), `${id} : mono et cut`);
    assert.equal(ex.calm, 1);
    assert.ok(ex.intro.endsWith(NB + ':') && ex.note && ex.note.split('\n').length <= 2, `${id} : l’intro finit par « : », une note de deux phrases au plus`);
    assert.ok(!(ex.precision && ex.attention), `${id} : Précision ou Attention, pas les deux`);
    for (const k of ['intro', 'note', 'precision', 'attention']) if (ex[k]) { typo(id, 'ex.' + k, ex[k], false); assert.doesNotMatch(ex[k], /<[a-z/]/i, `${id} ex.${k} : du texte, pas du HTML`); }
    for (const l of q.sql.split('\n')) assert.ok(l.length <= 30 && l === l.trimEnd(), `${id} : ligne SQL de ${l.length} caractères (${l})`);
    if (q.etoile) assert.ok([2, 4].includes(q.etoile.dims.length) && q.etoile.faits.cols.length, `${id} : le schéma`);
  }
});

test('toute la banque : une espace insécable avant « : ; ? ! », jamais une espace ordinaire', () => {
  for (const q of E) {
    typo(q.id, 'a', q.a, true);
    if (q.apres) typo(q.id, 'apres', q.apres, true);
    for (const k of ['intro', 'note', 'precision', 'attention']) if (q.ex && q.ex[k]) assert.doesNotMatch(q.ex[k], / [:;?!»]/, `${q.id} ex.${k}`);
  }
});

test('la question sur CAST mène à « Conversion de types » dans Selon le SGBD', () => {
  const c = {}; vm.runInNewContext(app.slice(app.indexOf('const ENT_SGBD_CAT='), app.indexOf('\n', app.indexOf('const ENT_SGBD_CAT='))) + '\n'
    + app.slice(app.indexOf('function entSgbdTheme('), app.indexOf('\n}\n', app.indexOf('function entSgbdTheme(')) + 3) + ';this.f=entSgbdTheme;', c);
  assert.equal(c.f(E.find(q => q.id === 'ent-v2-91')), 'conversion');
  assert.equal(c.f(E.find(q => q.id === 'ent-v2-20')), 'null', 'CASE WHEN reste avec les conditions');
});
