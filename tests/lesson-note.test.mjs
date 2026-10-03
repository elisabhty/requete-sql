/* « Ajouter dans notes » (bouton du réflexe) : la note n'est jamais vide, y compris pour les cours guide
   dont le réflexe est un récapitulatif en cartes. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('const SCHEMA_SQL ='), html.indexOf('let state=')), data);
const lessons = vm.runInContext('MODULES.flatMap(m=>m.lessons)', data);
const src = html.slice(html.indexOf('function stripNoteHtml('), html.indexOf('function noteFromRetenir('));
assert.ok(src.includes('function noteRecapHtml(') && src.includes('function lessonReflexText('), 'fonctions localisées');
/* Sans DOM (Node), noteTextFromHtml utilise le chemin « texte » : c'est celui que ce test couvre. */
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const note = l => ctx.lessonReflexText(l);

test('le cours WHERE : la note reprend les trois idées du réflexe, dans l’ordre', () => {
  const l = lessons.find(x => x.id === 4), t = note(l);
  let pos = 0;
  for (const part of ['WHERE sert à filtrer les lignes selon une condition.', 'Il agit sur le résultat, sans modifier la table.', 'Il se place après FROM', "WHERE ville = 'Paris'", 'Pour une valeur en texte, utilise des guillemets simples', "'Paris'"]) {
    const i = t.indexOf(part, pos); assert.ok(i >= 0, `« ${part} » manque ou est hors ordre dans la note : ${JSON.stringify(t)}`); pos = i + part.length;
  }
  assert.ok(!/🔎|📍|💬/.test(t), 'les emoji décoratifs des cartes ne sont pas recopiés');
});

test('aucun cours guide ne donne une note vide', () => {
  const guided = lessons.filter(l => l.guided);
  assert.ok(guided.length >= 1);
  for (const l of guided) assert.ok(note(l).trim().length > 40, `${l.titre} : note vide`);
});

test('noteRecapHtml : une carte devient un paragraphe « phrase / précision / code », le reste du HTML est intact', () => {
  const card = '<ol class="fk-syn-map is-recap" aria-label="Les idées"><li><b aria-hidden="true">🔎</b><div><strong>Une <b>idée</b>.</strong><span>Sa précision.</span><code class="fk-rc">X = 1</code></div></li><li><b aria-hidden="true">📍</b><div><strong>Seule la phrase :</strong></div></li></ol>';
  assert.equal(ctx.noteRecapHtml(`<p>avant</p>${card}<p>après</p>`), '<p>avant</p><p>Une idée.<br>Sa précision.<br>X = 1</p><p>Seule la phrase :</p><p>après</p>');
  assert.equal(ctx.noteRecapHtml('<p>rien à changer</p>'), '<p>rien à changer</p>');
  assert.equal(ctx.noteRecapHtml(''), '');
});

test('à défaut de texte dans le réflexe, la note reprend « retenir » (jamais vide)', () => {
  const l = { id: 999, studio: { reflex: {} }, retenir: 'Une phrase à retenir.' };
  assert.equal(note(l), 'Une phrase à retenir.');
});

test('le bouton du cours ouvre bien l’éditeur de note avec ce texte', () => {
  const fn = html.slice(html.indexOf('function noteFromRetenir('), html.indexOf('function lessonRetenirText('));
  assert.ok(fn.includes('txt:lessonReflexText(l)') && fn.includes('openNote(null'), 'noteFromRetenir envoie le texte du réflexe à openNote');
});
