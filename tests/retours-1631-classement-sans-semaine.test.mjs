/* 13 novembre, 16 h 31 (Elisa, sur Défis › Classement) : « Supprime l’onglet semaine ».
   Plus de choix « Depuis toujours / Cette semaine » : le classement est celui depuis toujours, et un ancien choix « semaine » gardé
   sur l’appareil n’est plus repris. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), css = read('ludique.css');
const cut = (t, a, b) => { const i = t.indexOf(a); assert.ok(i >= 0, a); const j = t.indexOf(b, i + a.length); assert.ok(j > i, b); return t.slice(i, j); };

test('le classement : plus de choix de période, seulement Monde, le pays et Mes adversaires', () => {
  const peindre = cut(html, 'function defisClassementPeindre(){', '\n}\n').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!peindre.includes('dx-periode') && !peindre.includes('Cette semaine') && !peindre.includes('Depuis toujours'));
  assert.ok(peindre.includes(`<div class="dx-filtres"><div class="dx-filters" role="group" aria-label="Qui">\${chip('monde','🌍 Monde')}`));
  assert.ok(peindre.includes(`\${chip('amis','Mes adversaires')}</div></div>`));
  assert.ok(!html.includes('function defisPeriode('), 'plus rien pour changer de période');
  assert.ok(!html.includes('aria-label="Période"'));
  assert.ok(!css.includes('dx-periode'), 'ni ses styles');
});

test('un ancien choix « semaine » gardé sur l’appareil n’est plus repris : on part de « depuis toujours »', () => {
  const prefs = cut(html, '(function defisPrefs(){', '})();');
  assert.ok(!prefs.includes('periode'));
  assert.ok(html.includes("const DEFIS={onglet:'jouer',carte:'',portee:'monde',periode:'tout',"));
});
