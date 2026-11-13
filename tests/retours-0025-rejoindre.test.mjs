/* Elisa, 14 novembre, 0 h 25 : « Quand j’ai cliqué sur Rejoindre (salle), ça a clignoté ». Trois causes : rien ne bougeait pendant
   qu’on cherchait la salle (une à deux secondes) ; la vérification grisait « Créer ma partie » (le premier bouton .room-go de l’écran)
   le temps de la connexion ; à l’arrivée, la carte de la salle d’attente se redessinait au premier tour (data-h vide) et rejouait son
   entrée en fondu. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const secu = fs.readFileSync(path.join(ROOT, 'multiplayer-security.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('« Rejoindre » dit « Connexion… » tout de suite, et reprend son mot si la salle ne répond pas', () => {
  assert.ok(app.includes("onclick=\"sallesRejoindre('${s.code}',this)\""));
  const r = fn('sallesRejoindre');
  assert.ok(r.includes("if(b.classList.contains('is-cherche'))return;b.classList.add('is-cherche');b.disabled=true;b.dataset.txt=b.textContent;b.textContent='Connexion…';"), 'un seul toucher compte');
  assert.ok(r.includes('},12000);}'));
  assert.ok(fn('jeuInvitationEchec').includes("document.querySelectorAll('.dx-join.is-cherche').forEach("), 'salle introuvable, pleine, commencée : le bouton revient');
  assert.ok(css.includes('html.lq #scr-defis .dx-join.is-cherche{') && css.includes('@keyframes dxJoinRespire{'));
});

test('rejoindre depuis la liste ne grise plus « Créer ma partie » ; la feuille du code garde son bouton qui attend', () => {
  assert.ok(secu.includes("const button = document.querySelector('#dx-feuille .room-go') || (options.verif ? null : document.querySelector('.screen.active .room-go'));"));
});

test('la carte de la salle d’attente ne se redessine (ni ne se rejoue) que si elle change', () => {
  assert.ok(app.includes('<div class="jeu-lobby-etat" id="jeu-lobby-etat" role="status" aria-live="polite">${(J.lobH=jeuLobbyEtatHTML())}</div>'));
  const m = fn('jeuLobbyEtatMaj');
  assert.ok(m.includes('if(el&&JEU){const h=jeuLobbyEtatHTML();if(JEU.lobH!==h){') && m.includes('el.innerHTML=h;JEU.lobH=h;'));
  assert.ok(!app.includes('data-h=""'));
});
