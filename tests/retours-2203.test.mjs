/* Elisa, 11 novembre, 22 h 03 (sur la page « Ta flamme du jour s’est allumée ») : « Il doit le faire qu’une fois et pas en boucle stp (gif) ».
   Le GIF du chat à la bougie ne boucle plus (son nombre de boucles passe à 1) ; à sa fin, son image fixe (sa dernière pose) prend le relais,
   au cas où un navigateur reboucle quand même. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Les morceaux d’un WebP animé : le nombre de boucles (ANIM) et la durée de chaque image (ANMF). */
function webp(f) {
  const b = fs.readFileSync(path.join(ROOT, f));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.toString('latin1', 8, 12), 'WEBP');
  let i = 12, loop = null; const durs = [];
  while (i < b.length) {
    const t = b.toString('latin1', i, i + 4), n = b.readUInt32LE(i + 4), p = i + 8;
    if (t === 'ANIM') loop = b.readUInt16LE(p + 4);
    if (t === 'ANMF') durs.push(b.readUIntLE(p + 12, 3));
    i = p + n + (n & 1);
  }
  return { loop, durs };
}

test('le chat de la flamme du jour joue son GIF une fois, puis garde sa dernière pose', () => {
  const { loop, durs } = webp('assets/chat-allumette.webp');
  assert.equal(loop, 1, 'une seule fois (0 voulait dire : en boucle)');
  const total = durs.reduce((a, b) => a + b, 0);
  assert.ok(app.includes(`const LQ_FLAMME_CHAT_MS=${total};`), 'la durée du GIF, image par image : ' + total);
  const i = app.indexOf('function lqFlammeOuvrir(){'), f = app.slice(i, app.indexOf('\n}\n', i));
  assert.ok(f.includes("const fin='assets/chat-allumette-fixe.webp';") && f.includes('chat._t=setTimeout(()=>{if(chat.isConnected)chat.src=fin;},LQ_FLAMME_CHAT_MS-160);'), 'à la fin, l’image fixe');
  assert.ok(f.includes("if(chat.complete)pose();else chat.addEventListener('load',pose,{once:true});"), 'compté depuis son arrivée à l’écran');
  assert.ok(durs.at(-1) >= 160, 'le relais tombe pendant la dernière image');
});
