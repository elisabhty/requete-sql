/* Elisa, 14 novembre, 9 h 19 : « T’as testé pour un iPhone SE pour voir si on voit tout bien ». L’appli passée à 375 × 667 (onglets,
   71 pages de départ des leçons, 477 défis, 142 questions d’entretien, console et schéma des 16 bases, salle à trois, accueil d’un
   nouvel utilisateur) : deux textes coupés. « Base relationn… » (le nom de la prochaine carte mémo, à côté de « Voir la leçon » ;
   « GROUP_CONCAT » ou « Normalisation » l’étaient aussi sur les autres iPhone) et « Choisis ton pse… » (Mon compte). */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');

test('la prochaine carte mémo : le nom va à la ligne, le bouton passe dessous s’il manque de place', () => {
  for (const r of ['html.lq #app .coll-overview-next.has-next{flex-wrap:wrap;row-gap:12px}',
    'html.lq #app .coll-overview-next.has-next>span:not(.coll-next-card){flex:1 1 150px}',
    'html.lq #app .coll-overview-next.has-next>button{flex:1 0 auto}',
    'html.lq #app .coll-overview-next.has-next b{white-space:normal!important;text-overflow:clip!important}'])
    assert.ok(css.includes(r), r);
});

test('Mon compte, sans pseudo : l’invitation tient en entier sur un écran étroit', () => {
  assert.ok(css.includes('@media (max-width:380px){html.lq #scr-compte .plus-details-body>.acc-pseudo.is-vide .acc-pseudo-t b{font-size:18px}}'));
});

/* 9 h 48 (« Ok » à la touche ▶ Exécuter) : sur iPhone SE, pendant un défi, le clavier cachait « Exécuter ». */
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

test('la barre au-dessus du clavier porte une touche ▶ Exécuter, au bout, hors de la rangée qui défile', () => {
  assert.ok(app.includes('<div class="kbar-in" id="kbar-in"></div>\n    <button type="button" class="kbar-run" id="kbar-run" hidden onclick="kbarRun()">'));
  assert.ok(css.includes('html.lq .kbar .kbar-run[hidden],html.lq .kbar.kb-down .kbar-run{display:none}'), 'clavier rangé : le bouton de la page est en vue');
  assert.ok(cut('function updateKbarDock(){', '\nfunction kbarDockToggle(){').includes('kbarRunSync();'));
  assert.ok(cut('function refreshKbarNow(ta){', '\nfunction refreshKbar(').includes('kbarRunSync();'), 'grisée avec son bouton, en tapant');
});

test('la touche fait ce que fait le bouton de son champ, et range le clavier ; rien pour une note', () => {
  const f = cut('function kbarRunBtn(ta){', '\n/* La barre « Insérer » défile de côté');
  const clics = [], btn = (txt, dis) => ({ isConnected: true, offsetParent: {}, textContent: txt, disabled: !!dis, click: () => clics.push(txt) });
  const boutons = { '#scr-lesson .run-row .btn-run': btn(' Exécuter'), '#scr-console .console-run-row .btn-run': btn(' Exécuter', true) };
  const el = { hidden: true, disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }, lab = { textContent: 'Exécuter' };
  const ctx = vm.createContext({ document: { querySelector: s => boutons[s] || null, getElementById: id => id === 'kbar-run' ? el : id === 'kbar-run-l' ? lab : null },
    activeTA: null, kbarKbDismissed: false, syncKbarOffset: () => {}, setTimeout: () => {}, buzz: () => {} });
  vm.runInContext(f, ctx);
  const ta = (id, frame) => ({ id, isConnected: true, blur() { this.flou = true; }, closest: () => frame || null });
  ctx.activeTA = ta('ed-lesson'); vm.runInContext('kbarRunSync()', ctx);
  assert.equal(el.hidden, false); assert.equal(el.disabled, false); assert.equal(el.attrs['aria-label'], 'Exécuter la requête');
  vm.runInContext('kbarRun()', ctx);
  assert.deepEqual(clics, [' Exécuter']); assert.equal(ctx.activeTA.flou, true); assert.equal(vm.runInContext('kbarKbDismissed', ctx), true, 'le clavier se range');
  ctx.activeTA = ta('ed-console'); vm.runInContext('kbarRunSync()', ctx);
  assert.equal(el.disabled, true, 'console vide : grisée comme son bouton');
  vm.runInContext('kbarRun()', ctx); assert.equal(clics.length, 1, 'grisée : rien ne part');
  ctx.activeTA = ta('ed-teste', { querySelector: () => btn(' Vérifier') }); vm.runInContext('kbarRunSync()', ctx);
  assert.equal(lab.textContent, 'Vérifier', 'une commande à vérifier : ▶ Vérifier');
  ctx.activeTA = ta('ne-sql'); vm.runInContext('kbarRunSync()', ctx);
  assert.equal(el.hidden, true, 'une note : pas de touche');
});
