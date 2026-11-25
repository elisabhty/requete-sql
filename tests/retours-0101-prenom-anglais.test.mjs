/* Elisa, 25 novembre, 1 h 01 (l’appli en anglais sur Android : « c’est censé être en anglais, j’ai eu une phrase en français ») :
   la réponse de la mascotte au prénom (« Enchantée, eliesX4 ! J’ai hâte d’en savoir plus sur toi. ») restait en français. Elle se
   traduit d’un bloc dans obPrenomReponse, et la page n’y touche plus (data-notrad). Et la fausse alerte de notification d’Android. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = lire('index.html'), en = lire('langue-en.js');
const fn = nom => { const i = html.indexOf('function ' + nom + '('); return html.slice(i, html.indexOf('\n}\n', i) + 2); };

test('la réponse au prénom, en anglais, quel que soit le prénom (chiffres compris)', () => {
  const D = {};
  for (const m of en.matchAll(/^ {4}"(Enchantée, <1>(?:\{prenom\}|Léa)<\/1> ! J’ai hâte d’en savoir plus sur toi\.)": "([^"]+)"/gm)) D[m[1]] = m[2];
  assert.equal(Object.keys(D).length, 2);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const anglais = vm.runInNewContext(fn('obPrenomReponse') + ';obPrenomReponse', {esc, obLangue: () => ({code: 'en', t: k => D[k] ?? null}), String});
  assert.equal(anglais('eliesX4'), 'Nice to meet you, <em>eliesX4</em>! I can’t wait to learn more about you.');
  assert.equal(anglais('<b>Zoé 2</b>'), 'Nice to meet you, <em>&lt;b&gt;Zoé 2&lt;/b&gt;</em>! I can’t wait to learn more about you.');
  assert.equal(anglais(''), 'Nice to meet you, <em>Emma</em>! I can’t wait to learn more about you.');
  const francais = vm.runInNewContext(fn('obPrenomReponse') + ';obPrenomReponse', {esc, obLangue: () => null, String});
  assert.equal(francais('Elisa'), 'Enchantée, <em>Elisa</em>&nbsp;! J’ai hâte d’en savoir plus sur toi.');
  assert.ok(fn('obPrenomBulle').includes('<span class="ob-bulle-r" aria-hidden="true"${obNt()}>'));
});

test('la fausse alerte de notification d’Android a son anglais', () => {
  assert.ok(html.includes('Autoriser Requête à vous envoyer des notifications&nbsp;?'));
  assert.ok(en.includes('"Autoriser Requête à vous envoyer des notifications ?": "Allow Requête to send you notifications?"'));
});
