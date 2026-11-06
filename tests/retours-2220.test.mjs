/* Elisa, 6 novembre, 22 h 20, sur sa capture d’une question d’entretien (« Question 5 sur 142 ») : « Met le suivant précédent plutôt à
   l’intérieur du cadre bleu de manière ui ux ». « Précédente » et « Suivante » passent dans la carte violette, sous la consigne
   « Réponds à voix haute, puis compare. », côte à côte : « Précédente » en verre (comme la pastille du numéro), « Suivante » blanche à
   rebord violet. Plus rien sous la réponse. Les mots courts à l’écran, « Question précédente » et « Question suivante » pour le lecteur
   d’écran ; plus aucune autre question dans l’onglet : « Retour aux questions », seul, sur toute la largeur. Vérifié aux largeurs 320,
   375, 390 et 430 : chaque mot sur une ligne, rien ne déborde. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* La question ouverte, rendue pour de vrai : la navigation selon ce que proposent entPrevTarget et entNextTarget. */
function rendu(prev, next) {
  const ctx = vm.createContext({ ENT_CHEV_SVG: '<svg></svg>', entPrevTarget: () => prev, entNextTarget: () => next });
  vm.runInContext(cut('function entStepHtml(id){', 'function renderEntretienFocus(x){'), ctx);
  return ctx.entStepHtml('q5');
}

test('la navigation est dans la carte violette, juste sous la consigne, et plus sous la réponse', () => {
  const f = cut('function renderEntretienFocus(x){', 'function renderEntretien(opts){');
  const hero = f.slice(f.indexOf('<header class="ent-focus-hero">'), f.indexOf('</header>'));
  assert.ok(hero.includes('<span>Réponds à voix haute, puis compare.</span></div>\n    ${entStepHtml(x.id)}\n'), 'sous la consigne, dans la carte');
  assert.equal(f.split('entStepHtml(').length - 1, 1, 'une seule fois');
  assert.ok(!/ent-nav|ent-next|ent-prev/.test(f), 'plus de rangée sous la réponse');
  assert.ok(!/ent-nav|class="ent-next|class="ent-prev|\.ent-next|\.ent-prev\b/.test(app + css), 'ni balisage ni style de l’ancienne rangée');
});

test('« Précédente » et « Suivante » à l’écran, « Question précédente » et « Question suivante » pour le lecteur d’écran', () => {
  const h = rendu({ id: 'q4' }, { id: 'q6' });
  assert.ok(h.startsWith('<nav class="ent-step" aria-label="Changer de question">'));
  assert.ok(h.includes(`<button type="button" class="ent-step-prev" onclick="prevEntretien('q5')" aria-label="Question précédente"><svg></svg><span>Précédente</span></button>`));
  assert.ok(h.includes(`<button type="button" class="ent-step-next" onclick="nextEntretien('q5')" aria-label="Question suivante"><span>Suivante</span><svg></svg></button>`));
  assert.ok(h.indexOf('ent-step-prev') < h.indexOf('ent-step-next'), 'précédente à gauche, suivante à droite');
});

test('plus aucune autre question dans l’onglet : « Retour aux questions », seul, sur toute la largeur', () => {
  const h = rendu(null, null);
  assert.ok(!h.includes('ent-step-prev'));
  assert.ok(h.includes(`<button type="button" class="ent-step-next" onclick="nextEntretien('q5')"><span>Retour aux questions</span><svg></svg></button>`), 'son texte est son nom');
  assert.ok(code.includes('html.lq .ent-focus .ent-step>button{flex:1 1 0;min-width:0;'), 'seul, il prend toute la largeur');
});

test('le style : du verre pour « Précédente », du blanc à rebord pour « Suivante », le bouton s’enfonce, chaque mot sur une ligne', () => {
  assert.ok(code.includes('html.lq .ent-focus .ent-step{display:flex;gap:10px;margin:16px 0 0}'));
  assert.ok(code.includes('html.lq .ent-focus .ent-step-prev{background:rgba(255,255,255,.13);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26),'), 'comme la pastille du numéro');
  assert.ok(code.includes('html.lq .ent-focus .ent-step-next{background:#fff;color:var(--accent-ink);box-shadow:0 3px 0 #2E1A9E}'));
  assert.ok(code.includes('html.lq .ent-focus .ent-step>button:active{transform:translateY(3px)}') && code.includes('html.lq .ent-focus .ent-step-next:active{box-shadow:0 0 0 #2E1A9E}'), 'il s’enfonce sous le doigt');
  assert.ok(/min-height:48px/.test(code.slice(code.indexOf('html.lq .ent-focus .ent-step>button{'))), 'une cible de 48 px');
  assert.ok(code.includes('html.lq .ent-focus .ent-step span{white-space:nowrap;text-align:center}'), 'pas de mot coupé (« Précédent / e » à 320 px)');
  assert.ok(code.includes('@media (max-width:359px){\n  html.lq .ent-focus .ent-step>button{gap:5px;padding:0 8px;font-size:14.5px}'), 'iPhone SE : un peu plus serré');
  assert.ok(code.includes('html.lq .ent-focus .ent-step>button:focus-visible{outline:3px solid var(--sun-hi);outline-offset:2px}'), 'au clavier, un contour visible sur le violet');
  assert.ok(app.includes('.ent-hero-cta svg,.ent-step svg,.ent-reveal-primary svg,.acc-row .chev,.som-item .som-arrow{transition:none!important}'), 'mouvement réduit : la flèche ne file plus');
  assert.ok(code.includes('html[data-motion="reduce"].lq .ent-focus .ent-step-next:active svg{transform:none}'));
});
