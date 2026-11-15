/* Elisa, 15 novembre, 21 h 20 : « quand je suis rentrée sur l’appli j’ai eu que l’annonce du niv 1 et pas le sticker 1re requête
   ensemble (sur la même page) ». Un stkSync passé avant stkAfterProgress (la synchro du compte pendant la page du pseudo, l’ouverture
   de l’appli) gagnait « Première requête » et le niveau 1 sans page : la page du niveau 1 venait seule, avec la médaille.
   Le niveau n’étant pas encore fêté, ses stickers et « Première requête » rejoignent maintenant sa page. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

/* stkAfterProgress, avec de faux voisins ; got : ce qu’un stkSync passé a déjà gagné sans page */
const apres = ({ won, got = {}, de = 0, a = 1, lecon = false, requete = true }) => {
  const pages = [], ctx = vm.createContext({ state: { stickers: { got: { ...got }, fresh: {}, board: [], since: 1, ev: requete ? { requete: 1 } : {} } }, mode: lecon ? 'lesson' : 'learn',
    document: { body: { classList: { contains: c => lecon && c === 'in-lesson' } } }, stkPageOuvrir: (ids, niv) => pages.push([[].concat(ids), niv || null]),
    stkSync: () => won.slice(), nivRangVu: () => de, nivRangAtteint: () => a, save: () => {}, stkEstNiv: id => /^niv[1-5]$/.test(id) });
  vm.runInContext(fn('stkState') + 'let stkLessonNew=[],stkLessonNiv=null;' + fn('stkAfterProgress'), ctx);
  ctx.stkAfterProgress();
  return { pages: JSON.parse(JSON.stringify(pages)), attente: JSON.parse(vm.runInContext('JSON.stringify({n:stkLessonNew,v:stkLessonNiv})', ctx)) };
};

test('la requête d’essai déjà gagnée en silence : « Première requête » et le niveau 1 sur la même page', () => {
  assert.deepEqual(apres({ won: [], got: { requete: 5, niv1: 5 } }).pages, [[['requete', 'niv1'], { de: 0, a: 1 }]], 'avant : la médaille seule');
  assert.deepEqual(apres({ won: [], got: { requete: 5, niv1: 5 }, lecon: true }).pages, [[['requete', 'niv1'], { de: 0, a: 1 }]], 'même dans la première leçon : tout de suite');
  assert.deepEqual(apres({ won: ['requete', 'niv1'], got: { requete: 5, niv1: 5 } }).pages, [[['requete', 'niv1'], { de: 0, a: 1 }]], 'gagnés à l’instant : pas en double');
});

test('un niveau gagné en silence (la synchro du compte) : son sticker sur sa page ; un niveau déjà fêté ne revient pas', () => {
  assert.deepEqual(apres({ won: [], got: { requete: 1, niv1: 1, niv2: 9 }, de: 1, a: 2, requete: false }).pages, [[['niv2'], { de: 1, a: 2 }]], 'sans « Première requête » au niveau 2');
  assert.deepEqual(apres({ won: [], got: { requete: 1, niv1: 1, niv2: 9, niv3: 9 }, de: 1, a: 3, requete: false }).pages, [[['niv2', 'niv3'], { de: 1, a: 3 }]]);
  assert.deepEqual(apres({ won: [], got: { requete: 1, niv1: 1 }, de: 1, a: 1 }).pages, [], 'pas de niveau de plus : pas de page');
  /* Dans une leçon, hors première requête : le bilan d’abord, avec le sticker du niveau */
  assert.deepEqual(apres({ won: ['agregats'], got: { niv3: 9 }, de: 2, a: 3, lecon: true, requete: false }).attente, { n: ['agregats', 'niv3'], v: { de: 2, a: 3 } });
});
