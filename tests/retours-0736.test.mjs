/* Elisa, 7 novembre, 7 h 36, sur deux captures de l’écran Stickers (la collection, puis le tableau avec ses boutons) :
   « Met pas terminé met juste module … » et « Au niveau espacement on est pas bon sur cette page ».
   - les légendes des modules : « Module 1 », « Module 2 »… (plus « Module 1 terminé ») ;
   - le tableau à 18 px du sous-titre, comme les blocs de Bibliothèque et de Pratiquer (il en était à 4 px) ;
   - la légende du tableau à 12 px dessous, les boutons à 16 px (12 px visibles sous leur rebord), tous à 52 px de haut ;
   - « Ta collection » à 32 px des boutons : une autre partie de la page. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = read('index.html'), lq = read('ludique.css'), sw = read('sw.js');

test('les modules : « Module 1 », sans « terminé »', () => {
  assert.ok(app.includes("return {id:STK_MODULE_IDS[i],kind:'module',num:i+1,name:m.titre,cap:`Module ${i+1}`,now,goal:m.lessons.length,"));
  assert.ok(!app.includes('cap:`Module ${i+1} terminé`'));
});

test('les écarts de la page : 18 px sous le sous-titre, 12 px pour la légende, 16 px entre les boutons, 32 px avant la collection', () => {
  for (const r of ['html.lq .stk-board-sec{margin:14px 0 32px}', 'html.lq .stk-board-bar{display:flex;flex-direction:column;gap:16px;margin-top:12px}',
    'html.lq .stk-board-bar>.stk-ajout{width:100%;min-height:52px}'])
    assert.ok(lq.includes(r), r);
  assert.ok(!lq.includes('html.lq .stk-board-sec{margin:0 0 26px}') && !lq.includes('gap:12px;margin-top:16px}'), 'les anciens écarts sont partis');
});

test('la nouvelle version arrive sur les iPhone', () => {
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=193">'));
  assert.ok(sw.includes("const CACHE = 'requete-2026-11-07-stickers-titres-v2610';") && app.includes("const SW_CACHE='requete-2026-11-07-stickers-titres-v2610';"));
});
