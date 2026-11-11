/* Elisa, 11 novembre, 19 h 56 : « J’ai eu un flash à ce moment, vérifie qu’on n’a pas le même problème ailleurs » (capture : le moment
   « Le chaînon manquant » du cours AND et OR, après « WHERE » puis « OR »). Chaque choix appelait clear() puis start() : la carte du
   moment était retirée et recréée, et la nouvelle rejouait son entrée (mbIn, depuis l’opacité 0). Elle clignotait à chaque essai.
   Vérifié dans un navigateur sur tous les cours : 17 moments à choisir avec une carte, dans 17 cours (AND et OR, ANY et ALL, CASE,
   COALESCE, conversion de types, EXISTS, GROUP BY plusieurs colonnes, HAVING, INSERT … SELECT, jointure à 3 tables, LEFT JOIN,
   RIGHT JOIN, IN, sous-requête dans le SELECT, WHERE, WITH, WITH RECURSIVE) : avant, la carte était recréée 3 fois sur 3 choix ;
   après, jamais, le voile reste et la bonne réponse s’écrit dans le trou. Les 21 cours qui ont leur propre IX (les 20 projets, quel JOIN
   choisir) ne retirent rien de fixe pendant un choix (vérifié de même) : seuls les aperçus de chaque choix changent, c’est voulu. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const moments = fs.readFileSync(new URL('../assets/anim/moments.js', import.meta.url), 'utf8');
const cut = (a, b) => { const i = moments.indexOf(a); assert.ok(i >= 0, a); const j = moments.indexOf(b, i + a.length); assert.ok(j > i, b); return moments.slice(i, j); };

test('un choix remet le moment à zéro sans recréer sa carte', () => {
  const pick = cut('    pick(i, k){', '    hint(i)');
  assert.ok(pick.startsWith('    pick(i, k){\n      start(i); reset();'), 'plus de clear() avant chaque choix');
  assert.ok(!pick.includes('clear()'));
});

test('reset() garde la carte, son voile et la scène estompée ; il retire ce que l’essai a ajouté', () => {
  const r = cut('  const reset = () => {', '\n  };');
  assert.ok(r.includes("if (c === 'mb-veiled') return true; e.classList.remove(c);"), 'la scène reste estompée');
  assert.ok(r.includes("if (e === X.board || e.classList.contains('mb-veil')) return true; e.remove();"), 'la carte et le voile restent, le reste part');
  assert.ok(r.includes('X.tm.forEach(clearTimeout)') && r.includes('X.slot0[0].innerHTML = X.slot0[1]; X.slot0 = null;'), 'les minuteurs s’arrêtent, le trou retrouve son « ? » avant le nouvel essai');
});

test('rouvrir le même moment ne recrée pas non plus sa carte', () => {
  const e = cut('    enter: i => {', '\n    /* Réglage en cours');
  assert.ok(e.includes('if (X && X.i === i) { reset(); if (P[i].kind === \'tune\') draw(i, tuneStart(P[i])); return; }'));
  assert.ok(e.includes('clear(); start(i); },'), 'un autre moment : la carte change');
});
