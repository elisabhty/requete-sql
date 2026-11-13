/* Elisa, 13 novembre, 23 h 09 : « Quand on touche dans Notes, là où la note a été prise, genre la leçon, ça marque Leçon … : c’est pas
   le bon titre ». Le contexte gardait le numéro interne de la leçon (« Leçon 13 · DISTINCT ») ; le parcours la montre 2e de son module.
   Le numéro affiché est celui du parcours ; le contexte enregistré ne change pas (une note déjà prise se reconnaît toujours), il se lit
   à l’affichage, les notes déjà prises comprises. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); assert.ok(a > 0, n); return app.slice(a, app.indexOf('\n}\n', a) + 2); };
const ligne = n => { const a = app.indexOf(`function ${n}(`); return app.slice(a, app.indexOf('\n', a) + 1); };

test('le contexte d’une note se lit avec le numéro du parcours, anciennes notes comprises', () => {
  const MODULES = [{ lessons: [{ id: 0, titre: 'Les bases' }, { id: 2, titre: 'Renommer avec AS' }] }, { lessons: [{ id: 4, titre: 'WHERE' }, { id: 13, titre: 'DISTINCT' }] }];
  const ctx = vm.createContext({ MODULES, allLessons: MODULES.flatMap(m => m.lessons) });
  vm.runInContext('const LESSON_POS=new Map();' + fn('lessonPos') + ligne('lessonNumAffiche') + fn('noteCtxLisible'), ctx);
  assert.equal(ctx.noteCtxLisible('Leçon 13 · DISTINCT'), 'Leçon 2 · DISTINCT');
  assert.equal(ctx.noteCtxLisible('Leçon 13 · DISTINCT · Le réflexe à retenir'), 'Leçon 2 · DISTINCT · Le réflexe à retenir');
  assert.equal(ctx.noteCtxLisible('Révision · leçon 4'), 'Révision · Leçon 1 · WHERE');
  assert.equal(ctx.noteCtxLisible('Révision · leçon 4 · Le réflexe à retenir'), 'Révision · Leçon 1 · WHERE · Le réflexe à retenir');
  for (const c of ['Console', 'Carte 03 · JOIN', 'Défi · Les clients de Lyon', 'Leçon 99 · Disparue', '']) assert.equal(ctx.noteCtxLisible(c), c, c || '(vide)');
});

test('la fiche de la note, sa carte dans la liste, la recherche et les autres « Leçon N » montrent le numéro du parcours', () => {
  assert.ok(app.includes('${n.ctx?`<div class="nctx">${esc(noteCtxLisible(n.ctx))}</div>`:\'\'}'), 'la carte de la note');
  assert.ok(app.includes('${e.ctx?`<span class="cchip">${esc(noteCtxLisible(e.ctx))}</span>`:\'\'}'), 'la note ouverte');
  assert.ok(app.includes('all.filter(n=>SQ.matches(nTok,noteCtxLisible(n.ctx),plain(n),n.sql))'), 'la recherche trouve ce qu’on lit');
  assert.ok(app.includes('<div class="l-kicker">Révision · leçon ${lessonNumAffiche(l.id)}</div>'), 'l’écran de révision');
  assert.ok(app.includes('titre:l?`Leçon ${lessonNumAffiche(l.id)} · ${l.titre}`'), 'l’île (la prochaine activité)');
  assert.ok(!/`Leçon \$\{(l|current)\.id\} · \$\{(l|current)\.titre\}`:''/.test(app));
  /* Ce qui s’enregistre ne change pas : une note déjà prise se reconnaît encore */
  assert.ok(app.includes('return `Leçon ${current.id} · ${current.titre}`;') && app.includes('function lvNoteCtx(l){return `Leçon ${l.id} · ${l.titre} · ${REFLEX_TITLE}`;}'));
});
