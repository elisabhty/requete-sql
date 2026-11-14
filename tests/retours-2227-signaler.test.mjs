/* Elisa, 14 novembre, 22 h 27 : « Je ne vois pas le bloquer et signaler dans les salles ? Ou salle d’attente ? »
   Le lien « Signaler et bloquer un joueur » restait en bas de la salle, sous le pli. Chaque autre joueur de la salle (salle
   d’attente, résultats) a maintenant son « ⋯ » au bout de sa ligne ; dans « Rejoins une partie », le pseudo d’une salle ouverte
   ouvre le profil du joueur, avec « Signaler et bloquer ». Règle 1.2 d’Apple. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = nom => cut(`function ${nom}(`, '\n}\n') + '\n}\n';

test('« ⋯ » au bout de la ligne d’un autre joueur : signaler et bloquer, jamais pour soi ni pour un joueur déjà bloqué', () => {
  const ctx = vm.createContext({ state: { salle: { pseudo: '@lea', bloques: [{ n: '@deja_bloque', at: 1 }] } } });
  vm.runInContext(cut('const JEU_SIG_SVG=', ';\n') + ';' + fn('jeuCleNom') + fn('jeuSavedNom') + fn('jeuNom') + fn('jeuBloques') + fn('jeuBloque') + fn('jeuSigBoutonHTML'), ctx);
  const b = vm.runInContext("jeuSigBoutonHTML('@grossier_test','jeu-pl-sig')", ctx);
  assert.match(b, /^<button type="button" class="jeu-pl-sig" data-n="@grossier_test" onclick="jeuSignalerBloquer\(this.dataset.n\)" aria-label="Signaler et bloquer @grossier_test"><svg/);
  assert.equal(vm.runInContext("jeuSigBoutonHTML('@lea','jeu-pl-sig')", ctx), '', 'pas pour soi');
  assert.equal(vm.runInContext("jeuSigBoutonHTML('@deja_bloque','jeu-pl-sig')", ctx), '', 'déjà bloqué');
  assert.match(vm.runInContext(`jeuSigBoutonHTML('a"b<c','x')`, ctx), /data-n="a&quot;b&lt;c"/, 'échappé');
  assert.ok(fn('jeuPlayersHTML').includes("${state}${me?'':jeuSigBoutonHTML(p.name,'jeu-pl-sig')}</li>`;"), 'sur chaque ligne de joueur de la salle');
  assert.ok(css.includes('html.lq #jeu-root .jeu-pl-sig::after{content:"";position:absolute;inset:-6px}'), '44 px touchables');
  assert.ok(!/<svg[^>]*>.*flag/i.test(cut('const JEU_SIG_SVG=', ';\n')), 'trois points, pas un drapeau (confondu avec les pays)');
});

test('« Rejoins une partie » : le pseudo d’une salle ouverte ouvre le profil du joueur (avec « Signaler et bloquer »)', () => {
  const l = fn('salleLigneHTML');
  assert.ok(l.includes(`role="button" tabindex="0" data-n="\${escAttr(n)}" onclick="dxFiche(this.dataset.n)"`) && l.includes('aria-label="${escAttr(`Profil de ${n}`)}"'));
  assert.ok(fn('dxFicheHTML').includes(`<button type="button" class="dx-fiche-signal" onclick="dxFicheSignaler('\${escAttr(x?x.id:'')}')">Signaler et bloquer</button>`));
  assert.ok(app.includes("function jeuSignalerLienHTML(){return '<p class=\"jeu-signal-p\"><button type=\"button\" class=\"jeu-signal\" onclick=\"jeuSignalerChoisir()\">Signaler et bloquer un joueur</button></p>';}"), 'le lien du bas reste');
});
