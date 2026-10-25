/* Le son d’une réponse, dans les leçons en vidéo interactive (moments « À toi ») :
   une bonne réponse ne sonne jamais comme une erreur. Le « tampon » (un coup sourd à 140 Hz) est réservé aux repères posés sur la
   chronologie (cue) ; une réponse jouée dans la page passe par sfx(ok ? 'pop' : 'miss', …), le « pop » léger pour une bonne réponse,
   « miss » pour une erreur. Côté lecteur, la feuille « Bien vu ! » joue les deux notes de marimba (« true »), jamais un son d’erreur. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'assets/anim');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

/* Les pages à moments : celles qui donnent leurs « picks » au moteur. */
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html') && /\bpicks\s*:\s*PICKS\b/.test(read(f))).sort();

test('neuf leçons interactives, toutes passées en revue', () => {
  assert.deepEqual(pages, ['projet-alter.html', 'projet-cles.html', 'projet-create.html', 'projet-delete.html', 'projet-drop.html', 'projet-insert.html',
    'projet-normaliser.html', 'projet-ondelete.html', 'projet-savepoint.html', 'projet-transaction.html', 'projet-uml.html', 'projet-update.html', 'quel-join-choisir.html']);
});

for (const f of pages) {
  test(`${f} : une bonne réponse joue le « pop » léger, une erreur « miss », jamais le tampon`, () => {
    const src = read(f);
    // le son de la réponse : sfx(ok ? 'pop' : 'miss', …)
    const answers = [...src.matchAll(/\bsfx\(\s*ok\s*\?\s*'([a-z]+)'\s*:\s*'([a-z]+)'/g)];
    assert.ok(answers.length >= 1, 'la réponse joue un son selon ok');
    for (const [, good, bad] of answers) {
      assert.equal(good, 'pop', 'bonne réponse : le « pop » léger');
      assert.equal(bad, 'miss', 'erreur : « miss »');
    }
    // aucun son lourd ou d’erreur joué sans condition dans la page (sfx est le son immédiat d’une réponse, pas un repère de la chronologie)
    assert.ok(!/\bsfx\(\s*'(stamp|buzz|error|false|miss|empty)'/.test(src), 'aucun son d’erreur ni tampon joué à tout coup');
  });
}

test('lecteur : la feuille d’une bonne réponse joue la marimba (« true »), une erreur « false »', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes("LV.video.sfx(ok?'true':'false')"), 'la correction d’un moment : « true » si c’est réussi');
  assert.ok(html.includes("LV.video.sfx('true')"), 'la bonne réponse trouvée : « true »');
  assert.ok(!/LvSfx\.play\(\s*'(stamp|buzz|error|false|miss)'/.test(html), 'le lecteur ne joue jamais un son lourd de lui-même');
});
