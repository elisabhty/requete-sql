/* Elisa, 7 novembre, 12 h 47 (son GIF fait avec ChatGPT) : « Fier de sa semaine → carte de la série (3) : il tient une petite flamme
   comme un trophée. Il doit rester lisible en tout petit (40 px). »
   - la semaine faite (« Ta semaine est en feu ») : le chat qui tient sa flamme remplace l’autocollant dans la case de la flamme ;
   - lisible en tout petit : le GIF détouré et adouci au bord, recadré au plus près (le buste et la flamme remplissent l’image), réduit
     à 160 px (4 fois les 40 px) et redessiné net : assets/chat-flamme.webp, 12 images de 330 ms, en boucle ; en mouvement réduit, la
     flamme levée, les yeux ouverts (chat-flamme-fixe.webp) ;
   - 44 px dans la case de 40 (38 dans celle de 34, petits écrans).
   Vérifié dans un navigateur (393 et 320 px de large, dimanche 8 novembre, sept jours sur sept). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = lire('index.html'), lq = lire('ludique.css'), sw = lire('sw.js');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('les deux images du trophée : petites et nettes', () => {
  const anim = fs.readFileSync(path.join(ROOT, 'assets/chat-flamme.webp')), fixe = fs.readFileSync(path.join(ROOT, 'assets/chat-flamme-fixe.webp'));
  for (const f of [anim, fixe]) { assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X'); }
  const taille = f => [f.readUIntLE(24, 3) + 1, f.readUIntLE(27, 3) + 1];
  assert.deepEqual(taille(anim), [160, 152], '4 fois les 40 px de la case'); assert.deepEqual(taille(fixe), [160, 152]);
  assert.ok(anim.includes('ANIM') && anim.includes('ALPH') && !fixe.includes('ANIM'));
  const durees = []; let j = 12;
  while (j < anim.length) { const id = anim.subarray(j, j + 4).toString(), t = anim.readUInt32LE(j + 4); if (id === 'ANMF') durees.push(anim.readUIntLE(j + 8 + 12, 3)); j += 8 + t + (t & 1); }
  assert.deepEqual(durees, Array(12).fill(330), 'au rythme du GIF');
  assert.equal(anim.readUInt16LE(anim.indexOf('ANIM') + 8 + 4), 0, 'en boucle');
  assert.ok(anim.length < 150000 && fixe.length < 30000, 'léger : il est sur l’accueil');
  assert.ok(sw.includes("  './assets/chat-flamme.webp',\n  './assets/chat-flamme-fixe.webp',\n"), 'hors ligne');
});

test('la semaine faite : le chat qui tient sa flamme, dans la case de la flamme', () => {
  const s = cut('function homeStreakHTML(', '\nfunction ');
  assert.ok(s.includes('const chat=semaineFaite?`<img class="lq-streak-chat is-trophee" src="assets/${typeof mascotReduced===\'function\'&&mascotReduced()?\'chat-flamme-fixe\':\'chat-flamme\'}.webp" width="160" height="152" alt="" draggable="false">`:\'\';'));
  assert.ok(s.includes('<span class="lq-streak-flame" aria-hidden="true">${chat||LQ_FLAME_SVG}</span>'), 'à la place de la flamme, la semaine faite seulement');
});

test('un rien plus grand que la case, pour rester lisible', () => {
  assert.ok(lq.includes('html.lq .lq-streak-chat.is-trophee{width:44px;margin:-3px -2px -1px}'), 'case de 40 px');
  assert.ok(lq.includes('@media (max-width:360px){html.lq .lq-streak-chat.is-trophee{width:38px;margin:-3px -2px -1px}}'), 'case de 34 px');
  assert.ok(lq.indexOf('.lq-streak-chat.is-trophee{') > lq.indexOf('html.lq .lq-streak-chat{display:block;width:34px;'), 'après la règle de l’autocollant');
});
