/* Elisa, 31 octobre, 1 h 02 (cours « Jointure de 3 tables », sur iPhone) : « faire attention, car on a des cadres blancs qui restent »
   (un moment « À toi » : la carte de la requête posée dans un grand aplat lavande) et « comportement bizarre » (le chapitre « Le
   résultat » : l’email coupé net sous sa première ligne, un grand vide violet dessous). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');
const mom = lire('assets/anim/moments.js'), core = lire('assets/anim/core.js'), where = lire('assets/anim/where.html');
const style = mom.slice(mom.indexOf("s.textContent = '.pk-on"), mom.indexOf('document.head.append(s);', mom.indexOf("s.textContent = '.pk-on")));

test('moment avec carte : plus d’aplat lavande, la scène s’efface derrière la carte, posée seule sur le violet', () => {
  const veil = style.match(/'\.mb-veil\{([^}]*)\}/)[1];
  assert.ok(!/background/.test(veil), 'le voile ne peint plus rien (il était #F4F2FC, l’ancien fond des vidéos)');
  assert.ok(veil.includes('pointer-events:none'));
  assert.ok(!mom.includes('F4F2FC') && !mom.includes('mbVeil'));
  /* La scène (tout ce qui n’est ni l’habillage, ni la légende, ni la carte) s’efface le temps du moment */
  assert.ok(style.includes("'#stage.mb-veiled>:not(#progress):not(#header):not(#cap):not(.mb):not(.mb-veil):not(.mb-ln){opacity:0!important;transition:opacity .25s ease-out}'"));
  /* Posée avec le voile, retirée avec le moment : mark() note la classe, clear() la retire */
  const start = mom.slice(mom.indexOf('  const start = i => {'), mom.indexOf('  const tuneStart ='));
  assert.ok(start.includes("v.className = 'mb-veil'; st.append(v); X.add.push(v); mark(st, 'mb-veiled');"));
  assert.ok(mom.includes('X.cls.forEach(([e, c]) => e.classList.remove(c));'), 'à la fermeture, la scène revient');
  assert.ok(mom.includes("const mark = (e, c) => { if (e && !e.classList.contains(c)) { e.classList.add(c); X.cls.push([e, c]); } };"));
});

test('la carte d’un moment est la seule à prendre le style .mb : le corps des emails des cours garde le sien', () => {
  /* Aucune règle du style des moments ne vise .mb tout court (le corps d’un email s’appelle aussi .mb) */
  assert.ok(!/(^|[}'+]\s*'?)\.mb[{ ]/.test(style.replace(/#stage>\.mb/g, '')), 'règles .mb : toutes limitées à #stage > .mb');
  assert.ok(style.includes("'#stage>.mb{position:absolute;left:64px;width:952px;z-index:40;") && style.includes("'#stage>.mb .mb-q{margin-bottom:24px}'"));
  assert.ok(mom.includes("el.closest('#stage > .mb')") && mom.includes("a.closest('#stage > .mb')") && !mom.includes("closest('.mb')"));
  assert.ok(mom.includes("d.className = 'mb'") && mom.includes('st.append(d);'), 'la carte est posée directement sur la scène');
  /* Les emails : leur corps .mb est dans la carte .mail, pas posé sur la scène */
  for (const f of ['jointure-3-tables', 'union']) {
    const page = lire(`assets/anim/${f}.html`);
    assert.ok(page.includes('<script src="moments.js"></script>'), `${f} : charge moments.js`);
    const mail = page.slice(page.indexOf('<div class="abs card mail"'), page.indexOf('</section>', page.indexOf('<div class="abs card mail"')));
    assert.ok(mail.includes('<div class="mb">'), `${f} : le corps de l’email`);
    assert.ok(/\n\.mb\{padding:[^}]*\}/.test(page), `${f} : son propre style`);
  }
  /* Le bas du contenu (la feuille de réponse ne doit pas le toucher) : la carte du moment seulement */
  assert.ok(core.includes("$$(veil ? ':scope > .mb' : '.card, .code, :scope > .mb', stage).forEach(take);"));
  assert.ok(where.includes("$$('.card, .code, section.scene > .abs, :scope > .mb', stage).forEach(el => {"), 'where.html, son propre moteur, aussi');
});
