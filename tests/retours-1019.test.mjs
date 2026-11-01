/* Elisa, 1er novembre, 10 h 19 : « record, en une partie (en petit) » ; « augmenter la limite pour être ok partout » (la
   description d’une base d’entraînement affichait 264 / 140). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');

test('le record dit « en une partie », en petit', () => {
  assert.ok(app.includes("${kpi('',best||null,'record<em>en une partie</em>',2)}"));
  assert.ok(css.includes('html.lq .perf-kpi small em{display:block;margin-top:2px;font:600 10.5px/1.2 var(--ui);font-style:normal;'));
});

test('les limites de description tiennent toutes les descriptions des bases', () => {
  const max = k => Number((app.match(new RegExp(`placeholder:'Ex\\.\\s:\\s${k}',max:(\\d+),`)) || [])[1]);
  const descs = [...app.matchAll(/\n    desc:'([^']+)'/g)].map(m => m[1].length);
  const tables = [...app.matchAll(/\n    tables:(\{[^\n]+\})/g)].flatMap(m => Object.values(JSON.parse(m[1])).map(v => v.length));
  assert.ok(max('les ventes 2025 de la boutique') >= Math.max(...descs), 'projet');
  assert.ok(max('une ligne par vente, avec son montant') >= Math.max(...tables), 'table');
});
