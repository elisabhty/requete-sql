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

test('18 h 28 : la page des −50 % aussi, « Tu nous quittes déjà ? » dans une bulle, avec le même GIF', () => {
  const html = (() => { const a = app.indexOf('function obSortieHTML(){'); return app.slice(a, app.indexOf('\n}\n', a)); })();
  assert.ok(html.includes('<img class="pw-chat is-triste" src="assets/chat-triste${fixe?\'-fixe\':\'\'}.webp" width="306" height="343" alt="" draggable="false"><p class="pw-bulle">Tu nous quittes déjà&nbsp;?</p>'));
  assert.ok(!html.includes('chat-presente'), 'plus le chat qui présente');
  const ov = fs.readFileSync(path.join(ROOT, 'onboarding-vitrine.css'), 'utf8');
  assert.ok(ov.includes('html #onboarding.ob-vitrine .pw-bulle{position:absolute;right:-6px;top:-62px;'));
  const m = ov.indexOf('html:not([data-motion="reduce"]) #onboarding.ob-vitrine.ob-enter .pw-bulle{animation:pwBulle .5s var(--v-pop) .45s both}');
  assert.ok(m > ov.indexOf('@media (prefers-reduced-motion:no-preference){', ov.indexOf('3 novembre, 17 h 32')), 'son entrée, dans le bloc des animations');
});
