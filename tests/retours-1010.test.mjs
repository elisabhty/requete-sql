/* Elisa, 7 novembre, 10 h 10 (une capture de l’accueil, « ⌛ 3 min aujourd’hui » à droite du bonjour) : « Enlève le badge en haut, à
   part quand le parcours est terminé (3 min aujourd’hui) ». La carte d’une leçon n’a plus l’étiquette de la séance (elle dit déjà son
   temps : « Plus que 3 min ») ; la carte de fin garde « ✓ Parcours terminé ». VoiceOver lit toujours la séance du jour.
   Vérifié dans un navigateur (320 et 393 px, leçon en cours et parcours terminé). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'index.html'), 'utf8');
const h = app.slice(app.indexOf('function renderHomeHero('), app.indexOf('\n}\n', app.indexOf('function renderHomeHero(')));

test('l’étiquette de la séance : sur la carte de fin seulement', () => {
  assert.ok(h.includes('${nxt==null?sesMeta:`<span class="lq-sr">${esc(seanceLue(session,sesEtat))}</span>`}'));
  assert.ok(!h.includes('sesCopie') && h.includes('${heading}<div class="lq-a-kick">${chip}</div>'), 'ni à droite du bonjour, ni à côté du module');
  assert.ok(h.includes("const sesTxt=sesVue==='end'?'Parcours<br>terminé'"), '« ✓ Parcours terminé » reste (sur deux lignes depuis 10 h 25)');
});

test('le bonjour seul sur sa ligne : il rapetisse puis le prénom s’abrège s’il ne tient pas (lqSesAjuste)', () => {
  const f = app.slice(app.indexOf('function lqSesAjuste(host){'), app.indexOf('\nif(typeof window', app.indexOf('function lqSesAjuste(host){')));
  assert.ok(f.includes("if(!t||typeof t.getBoundingClientRect!=='function')return;") && f.includes('  if(!m){\n    if(nat<=W)return;'));
});

test('10 h 25 : « Parcours terminé en deux lignes stp »', () => {
  const lq = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'ludique.css'), 'utf8');
  assert.ok(lq.includes('html.lq .lq-hero.has-hi .journey-session-meta>.lq-ses.is-end{border-radius:14px;padding:6px 11px 6px 9px!important;line-height:1.12!important;text-align:left}'));
  assert.ok(app.includes('<link rel="stylesheet" href="ludique.css?v=239">'));
});
