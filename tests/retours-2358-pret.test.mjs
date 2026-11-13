/* Elisa, 13 novembre, 23 h 58 (sa capture de la salle d’attente, invitée) : « Fusionne les deux boutons en bas : Préviens, avec une
   flèche animée et un 👆 animé ». La carte « Préviens l’hôte quand tu es prête ! » et le bouton « Je suis prête » ne font plus qu’un :
   la carte se touche. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const fn = n => { const a = app.indexOf(`function ${n}(`); return app.slice(a, app.indexOf('\n}\n', a) + 2); };

test('chez l’invité, la carte est le bouton : le doigt qui tapote, la phrase, la flèche qui avance ; prête, la coche', () => {
  const e = fn('jeuLobbyEtatHTML');
  assert.ok(e.includes('<button type="button" class="jeu-lob jeu-lob-pret ${cls}" id="jeu-pret" aria-pressed="${on}" aria-label="${esc(lu).replace(/"/g,\'&quot;\')}" onclick="jeuToggleReady()">'));
  assert.ok(e.includes('${on?ico:\'<i class="jeu-doigt">👆</i>\'}') && e.includes('${on?\'\':`<i class="jeu-lob-fl" aria-hidden="true">${DEF_CHEV_SVG}</i>`}'));
  assert.ok(e.includes('Touche pour te remettre en attente.') && e.includes('Touche pour dire que tu es ${mot}.'), 'lu à voix haute : ce que fait le toucher');
  assert.ok(e.indexOf('if(!host){') < e.indexOf('return `<div class="jeu-lob ${cls}">'), 'l’hôte garde sa carte (pas un bouton)');
  assert.ok(!app.includes('class="jeu-ready${J.ready[J.me]?\' on\':\'\'}" id="jeu-ready"'), 'plus de second bouton « Je suis prête »');
  assert.ok(fn('jeuLobbyEtatMaj').includes("const garde=document.activeElement&&document.activeElement.id==='jeu-pret';"), 'la carte redessinée garde le focus');
});

test('le style : bordée de violet, en relief ; le 👆 qui tapote, la flèche qui avance ; rien ne bouge en mouvement réduit', () => {
  for (const k of ['html.lq #jeu-root .jeu-lob-pret{width:100%;margin:0;', 'html.lq #jeu-root .jeu-lob-pret.is-ok{border-color:var(--success);',
    'animation:jeuDoigt 1.4s ease-in-out infinite}', '@keyframes jeuDoigt{', 'html.lq #jeu-root .jeu-lob-fl svg{width:20px;height:20px;animation:jeuFlAvance 1.3s ease-in-out infinite}',
    '@media (prefers-reduced-motion:reduce){html.lq #jeu-root .jeu-doigt,html.lq #jeu-root .jeu-lob-fl svg{animation:none}}'])
    assert.ok(css.includes(k), k);
  const i = css.indexOf('@keyframes jeuDoigt{');
  assert.ok(i < css.indexOf('Défis — la refonte du 7 novembre') && i < css.indexOf('Les exemples de widgets (Elisa, 13 novembre, 9 h 19'), 'avant les Défis, hors des widgets');
});

test('un pseudo long se coupe, « (toi) » et « hôte » restent entiers', () => {
  assert.ok(app.includes('<span><span class="jeu-pl-nom">${esc(p.name)}</span>${me?\' <small>(toi)</small>\':\'\'}${host?\' <small class="jeu-tag">hôte</small>\':\'\'}</span>'));
  assert.ok(css.includes('html.lq #jeu-root .jeu-players .jeu-pl-nom{min-width:0;overflow:hidden;text-overflow:ellipsis}') && css.includes('html.lq #jeu-root .jeu-players li>span>small{flex:none}'));
});

test('14 novembre, 0 h 20 : « Rejouer » de l’île fait comme le bouton du podium (seul : la partie repart ; dans une salle : on vote)', () => {
  const a = fn('ileSalleAction');
  assert.ok(a.includes("if(quoi==='rejouer'&&J.over){if(J.solo)jeuAgain();else if(!(J.rv&&J.rv[J.me]))jeuRevanche();}"));
  assert.ok(!a.includes("if(quoi==='rejouer'&&J.over)jeuAgain();"), 'plus de relance qui n’attend pas les autres');
});
