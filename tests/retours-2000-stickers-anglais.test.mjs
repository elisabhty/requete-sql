/* Stickers en anglais (Elisa, 15 novembre : « oui vas'y pour le test », puis « oui »). Les 16 stickers qui portent un mot
   (« 1re requête », « NIV. 1 », « 3 jours »…) ont leur version anglaise dans assets/stickers/en/ : même dessin, même format.
   L’appli en anglais la prend ; en français, ou pour un sticker sans texte, c’est l’originale. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const take = (a, b) => { const i = html.indexOf(a); assert.ok(i >= 0, a); const j = html.indexOf(b, i); assert.ok(j > i, b); return html.slice(i, j); };
const AVEC_TEXTE = ['requete', 'defi1', 'defis10', 'lecons10', 'premier', 'difficile', 'amis5', 'serie3', 'serie7', 'serie14', 'serie30',
  'niv1', 'niv2', 'niv3', 'niv4', 'niv5'];

function monde(code) {
  const ctx = vm.createContext(code ? { window: { REQUETE_LANGUE: { code } } } : {});
  vm.runInContext(take('const STK_3D=', 'const stkImgs=') + 'globalThis.r={en:[...STK_EN],d3:[...STK_3D]};', ctx);
  return ctx;
}

test('les 16 stickers à texte ont leur version anglaise : WebP carré de 768 px, transparent, léger', () => {
  const { r } = monde();
  assert.deepEqual([...r.en].sort(), [...AVEC_TEXTE].sort());
  for (const id of r.en) {
    assert.ok(r.d3.includes(id), `${id} : un sticker 3D`);
    const b = fs.readFileSync(new URL(`../assets/stickers/en/${id}.webp`, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF', id);
    assert.equal(b.toString('ascii', 8, 12), 'WEBP', id);
    assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${id} : format étendu (couche alpha)`);
    assert.ok(b[20] & 0x10, `${id} : avec transparence`);
    assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [768, 768], id);
    assert.ok(b.length < 120 * 1024, `${id} : ${b.length} octets`);
  }
  assert.deepEqual(fs.readdirSync(new URL('../assets/stickers/en/', import.meta.url)).filter(f => f.endsWith('.webp')).sort(), [...r.en].map(id => `${id}.webp`).sort(),
    'rien de plus dans le dossier');
  /* 16 novembre : et leur petite version (384 px), pour la planche */
  assert.deepEqual(fs.readdirSync(new URL('../assets/stickers/en/384/', import.meta.url)).sort(), [...r.en].map(id => `${id}.webp`).sort());
});

test('l’appli en anglais prend la version anglaise ; en français, ou sans texte, l’originale', () => {
  const en = monde('en');
  assert.equal(vm.runInContext("stkSrc('requete')", en), 'assets/stickers/en/requete.webp?v=1');
  assert.equal(vm.runInContext("stkSrc('niv3')", en), 'assets/stickers/en/niv3.webp?v=1');
  assert.equal(vm.runInContext("stkSrc('jointures')", en), 'assets/stickers/jointures.webp?v=1', 'pas de texte : l’originale');
  assert.equal(vm.runInContext("stkSrc('requete')", monde('fr')), 'assets/stickers/requete.webp?v=1');
  assert.equal(vm.runInContext("stkSrc('requete')", monde()), 'assets/stickers/requete.webp?v=1', 'sans moteur de langue : l’originale');
  assert.equal(vm.runInContext("stkSrc('requete',true)", en), 'assets/stickers/en/384/requete.webp?v=1', '16 novembre : la petite version');
  assert.equal(vm.runInContext("stkSrc('jointures',true)", en), 'assets/stickers/384/jointures.webp?v=1');
});
