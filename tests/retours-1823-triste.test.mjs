/* 13 novembre, 18 h 23 (Elisa, son GIF : le chat baisse les oreilles, tout triste, joint les pattes, puis se reprend et fait signe) :
   « mettre ce GIF en disant “Tu nous quittes déjà ?” pour la déconnexion ». */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('la question de la déconnexion : « Tu nous quittes déjà ? » et le chat tout triste', () => {
  assert.ok(app.includes("if(!await lqAsk({ico:'🥺',chat:typeof chatBonusHtml==='function'?chatBonusHtml('triste'):'',titre:'Tu nous quittes déjà\\u00a0?',"));
  assert.ok(app.includes("oui:'Me déconnecter',non:'Rester connecté'"), 'les mêmes boutons');
  assert.ok(app.includes('duel:[300,308],triste:[306,343]}'), 'sa taille');
  for (const f of ['chat-triste.webp', 'chat-triste-fixe.webp']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', f)), f);
    assert.ok(sw.includes(`'./assets/${f}'`), 'hors ligne : ' + f);
  }
  const b = fs.readFileSync(path.join(ROOT, 'assets/chat-triste.webp'));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.ok(b.includes(Buffer.from('ANIM')), 'animé');
});
