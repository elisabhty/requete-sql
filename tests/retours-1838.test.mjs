/* 11 novembre, 18 h 38 (Elisa : « Ajoute un sticker pour faire une ligne complete », avec la planche de Mon compte où la dernière
   ligne n’avait que 2 stickers sur 3). Elle a choisi « Tes propres données » : un 15ᵉ accomplissement, gagné au 1er import réussi
   dans la Console, avec son rendu 3D comme les autres. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { STICKER_IDS } from '../account/personalisation.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const fn = name => take(`function ${name}(`, '\n}\n') + '\n}\n';
const accLines = () => { const s = fn('accomplissements'); return [...s.matchAll(/\{id:'([^']+)'/g)].map(m => m[1]); };

test('15 accomplissements : 3 par ligne, la dernière ligne est pleine', () => {
  const ids = accLines();
  assert.equal(ids.length, 15);
  assert.equal(ids.length % 3, 0, 'des lignes de 3 sans trou');
  assert.equal(ids.indexOf('donnees'), ids.indexOf('code') + 1, 'juste après « Code partagé »');
  const line = take("{id:'donnees',", '\n');
  assert.ok(line.includes("label:'Tes propres données'") && line.includes("cap:'Données importées'"));
  assert.ok(line.includes('now:ev.donnees?1:0,goal:1'));
  assert.ok(line.includes("how:'Importe tes propres données (Excel, CSV ou base) dans la Console.'"));
  assert.ok(!/bientôt|prochainement|—/.test(line), 'pas de promesse, pas de tiret long');
});

test('le sticker a son rendu 3D (768 px, fond transparent) et n’est pas holographique', () => {
  const d3 = vm.runInContext(take('const STK_3D=', 'const STK_IMG_V=') + '[...STK_3D]', vm.createContext({}));
  assert.ok(d3.includes('donnees'));
  const b = fs.readFileSync(new URL('../assets/stickers/donnees.webp', import.meta.url));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 12, 16), 'VP8X');
  assert.ok(b[20] & 0x10, 'avec transparence');
  assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [768, 768]);
  assert.ok(b.length < 100 * 1024, `${b.length} octets`);
  assert.ok(!take('const STK_HOLO=', ';').includes('donnees'), 'un sticker simple : pas de rareté');
});

test('gagné au 1er import réussi, une seule fois, après la coche « Importé »', () => {
  const imp = take('async function confirmImport(){', '  }catch(e){\n    if(point)');
  const ok = imp.indexOf("lqSay(neuf?'Projet créé':'Import terminé');");
  const gain = imp.indexOf("if(typeof stkMarquer==='function')setTimeout(()=>stkMarquer('donnees'),1300);");
  assert.ok(ok > 0 && gain > ok, 'à la fin du chemin réussi, après la micro-interaction');
  assert.equal(html.split("stkMarquer('donnees')").length - 1, 1, 'un seul déclencheur');
  /* les sorties sans import (déjà à jour, annulé) reviennent avant : pas de sticker */
  const avant = imp.slice(0, gain);
  assert.ok(avant.includes("lqInfo('Projet déjà à jour'") && avant.includes('if(!r)return;'));
  /* stkMarquer : noté une fois, puis la planche suit ; la clé passe la sauvegarde */
  const ctx = vm.createContext({ state: {}, saves: 0, after: 0 });
  ctx.save = () => { ctx.saves++; };
  ctx.stkAfterProgress = () => { ctx.after++; };
  vm.runInContext(fn('stkState') + fn('stkMarquer'), ctx);
  vm.runInContext("stkMarquer('donnees');stkMarquer('donnees')", ctx);
  assert.deepEqual({ ...ctx.state.stickers.ev }, { donnees: 1 });
  assert.deepEqual([ctx.saves, ctx.after], [1, 1]);
  const n = vm.createContext({});
  vm.runInContext(take('function normalizeState(', 'function normalize('), n);
  assert.equal(JSON.stringify(n.normalizeState({ stickers: { got: {}, fresh: {}, board: [], since: 1, ev: { code: 1, donnees: 1 } } }).stickers.ev), '{"code":1,"donnees":1}');
});

test('le catalogue de synchronisation connaît le nouveau sticker', () => {
  assert.ok(STICKER_IDS.includes('donnees'));
  assert.equal(STICKER_IDS.length, 30);
});
