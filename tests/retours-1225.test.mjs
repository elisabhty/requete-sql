/* Elisa, 7 novembre, 12 h 25 (son GIF fait avec ChatGPT) : « Il parle → pastille des sous-titres (16), tête seule : sa bouche s’ouvre
   et se ferme. »
   - la pastille ronde sous la bulle des sous-titres (core.css, #cap .cap-stk) montre sa tête : les douze images du GIF, détourées
     et adoucies au bord, côte à côte dans assets/anim/chat-parle.webp (une case carrée par image, la tête assez grande pour remplir
     le rond, les oreilles dedans) ;
   - core.js choisit l’image (--parle) sur le temps de la vidéo (renderAt) : pendant une légende, une image toutes les 0,14 s dans un
     ordre qui fait parler, un clignement de temps en temps ; en pause, il se tait sur l’image du moment ; en reculant, il reprend
     au même endroit ; entre deux phrases, la bouche fermée ;
   - les cours d’un formateur ou d’une formatrice gardent leur portrait (html.tr-f, html.tr-m) : la tête du chat parle dans
     « Normalisation » et la vidéo de fin du parcours.
   Vérifié dans un navigateur (normalisation, image par image). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = lire('assets/anim/core.css'), js = lire('assets/anim/core.js'), sw = lire('sw.js');
const cutIn = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i + a.length); assert.ok(j > i, b); return s.slice(i, j); };

test('la planche de la tête : douze images côte à côte, une case carrée chacune', () => {
  const f = fs.readFileSync(path.join(ROOT, 'assets/anim/chat-parle.webp'));
  assert.equal(f.subarray(0, 4).toString(), 'RIFF'); assert.equal(f.subarray(8, 12).toString(), 'WEBP'); assert.equal(f.subarray(12, 16).toString(), 'VP8X');
  const w = f.readUIntLE(24, 3) + 1, h = f.readUIntLE(27, 3) + 1;
  assert.deepEqual([w, h], [168 * 12, 168]);
  assert.ok(f.includes('ALPH') && !f.includes('ANIM'), 'transparente, fixe : c’est core.js qui la fait parler');
  assert.ok(f.length < 150000, 'légère');
  assert.ok(sw.includes("  './assets/anim/mascotte.webp',\n  './assets/anim/chat-parle.webp',\n"), 'hors ligne');
});

test('la pastille montre l’image demandée par --parle ; les formateurs gardent leur portrait', () => {
  const stk = css.match(/#cap \.cap-stk\{([^}]*)\}/)[1];
  assert.ok(stk.includes('background:url(chat-parle.webp) calc(var(--parle, 0) * 100% / 11) 0/1200% 100% no-repeat,radial-gradient(circle at 50% 34%,#FFE08A,#FFC83D 72%);'), 'une case = la pastille ; la case n à n/11 de la planche');
  assert.ok(css.includes('html:is(.tr-f,.tr-m) #cap .cap-stk{left:-26px;overflow:visible;background:url(formatrice.webp)'), 'les formatrices');
  assert.ok(css.includes('html.tr-m #cap .cap-stk{background:url(formateur.webp)'), 'les formateurs');
});

test('il parle pendant les légendes, au temps de la vidéo ; bouche fermée entre deux phrases', () => {
  const code = cutIn(js, '  const PARLE_SEQ = [', '  function renderAt(T){');
  const valeurs = [];
  const stk = { isConnected: true, style: { setProperty: (k, v) => valeurs.push([k, v]) } };
  const ctx = vm.createContext({ captions: [[2, 9, 'Bonjour'], [10, 11, 'Encore']], document: { querySelector: s => (s === '#cap .cap-stk' ? stk : null) } });
  vm.runInContext(code + '\nthis.capParle = capParle; this.SEQ = PARLE_SEQ; this.PAS = PARLE_PAS;', ctx);
  const { capParle, SEQ, PAS } = ctx;
  assert.equal(PAS, 0.14);
  assert.ok(SEQ.every(f => Number.isInteger(f) && f >= 0 && f <= 11), 'les douze images de la planche');
  assert.ok(SEQ.includes(5) && SEQ.includes(6) && SEQ.filter(f => f === 0).length >= 3, 'un clignement ; des pauses bouche fermée');
  const a = t => { capParle(t); return stk._parle; };
  assert.equal(a(1), 0, 'avant la première phrase : bouche fermée');
  assert.equal(a(2.01), SEQ[0]); assert.equal(a(2.15), SEQ[1]); assert.equal(a(2.29), SEQ[2]);
  assert.equal(a(2 + PAS * SEQ.length + 0.01), SEQ[0], 'la suite recommence');
  assert.equal(a(9.5), 0, 'entre deux phrases');
  assert.equal(a(2.15), SEQ[1], 'en reculant : la même image au même instant');
  assert.equal(a(10.01), SEQ[0], 'la phrase suivante repart du début de la suite');
  const n = valeurs.length; a(10.02); assert.equal(valeurs.length, n, 'la même image : rien à écrire');
  assert.ok(valeurs.every(([k]) => k === '--parle'));
  /* La page WHERE a son propre moteur : la même tête qui parle (sa copie de la bulle reste celle de core.css, bulles-bouton) */
  const where = lire('assets/anim/where.html');
  assert.ok(where.includes(code.replace(/^  /gm, '').replace('const c = captions.find(', 'const c = MP.captions.find(')), 'la même suite, les mêmes 0,14 s');
  assert.ok(cutIn(where, 'function renderAt(T){', '\n}\n').includes("  document.getElementById('stage').style.setProperty('--blink', blinkOn ? 1 : 0);\n  capParle(warp(T));\n"));
  /* Appelé à chaque image de la vidéo, en pause comme en lecture (renderAt) */
  assert.ok(cutIn(js, '  function renderAt(T){', '  window.renderAt = renderAt;').includes("    stage.style.setProperty('--blink', Math.floor(T * 1.9) % 2 === 0 ? 1 : 0);\n    capParle(t);\n"));
});
