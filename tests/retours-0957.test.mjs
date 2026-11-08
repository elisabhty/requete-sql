/* Elisa, 8 novembre, 9 h 57 (capture de « Ta salle de défi ») : « Met confidentialité des parties dans le compte pas ici et met le coche
   valide à côté du pseudo ».
   - Les feuilles de Défis (Créer ma partie, le code) n’ont plus « Confidentialité des parties » ; Mon compte a une ligne de ce nom,
     juste après « Tes données, tes choix » : elle ouvre cette feuille sur la rubrique « Ta confidentialité », déjà dépliée et montrée.
   - « Tu joues en tant que » : une coche verte suit le pseudo (« Pseudo validé »), un long pseudo se coupe avant elle. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lq = fs.readFileSync(path.join(ROOT, 'ludique.css'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };
const fn = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';

test('la confidentialité quitte les feuilles de Défis', () => {
  assert.ok(!app.includes('function dxConfHTML(') && !app.includes('dx-conf') && !lq.includes('.dx-conf'));
  const f = fn('defisFeuilleHTML');
  assert.ok(!f.includes('Confidentialité') && f.includes('<small class="room-hint" id="room-vis-hint">${jeuVisTexte()}</small></div>'));
});

test('Mon compte : « Confidentialité des parties », juste après « Tes données, tes choix », ouvre la rubrique « Ta confidentialité »', () => {
  assert.ok(app.includes('<span><b>Tes données, tes choix</b><small>Ce qui est gardé, sauvegarde, effacement</small></span><span class="account-setting-end">${CHEV}</span></button>\n            <button class="account-setting-row" type="button" onclick="acctConfidParties()"><span class="plus-row-icon privacy is-stk">${lqStkSvg(\'user\')}</span><span><b>Confidentialité des parties</b><small>Ce que les autres joueurs voient de toi</small></span><span class="account-setting-end">${CHEV}</span></button>'));
  /* Le vrai code : la feuille s’ouvre (ses rubriques repartent fermées), puis « Ta confidentialité » se déplie et vient sous l’en-tête */
  const appels = [], vu = [];
  const sec = {scrollIntoView: o => vu.push(o)};
  const btn = {attrs: {'aria-expanded': 'false'}, getAttribute(k) { return this.attrs[k]; }, closest: () => sec};
  const ctx = vm.createContext({
    openPlusDetails: id => { appels.push(['ouvrir', id]); btn.attrs['aria-expanded'] = 'false'; },
    accDonnees: b => { appels.push(['deplier', b === btn]); b.attrs['aria-expanded'] = 'true'; },
    document: {getElementById: id => (id === 'dc-t-confid' ? btn : null)},
    requestAnimationFrame: f => f(), prefersReduceMotion: () => true,
  });
  vm.runInContext(fn('acctConfidParties'), ctx);
  ctx.acctConfidParties();
  assert.deepEqual(appels, [['ouvrir', 'plus-data'], ['deplier', true]]);
  assert.deepEqual(JSON.parse(JSON.stringify(vu)), [{block: 'start', behavior: 'auto'}], 'la rubrique montrée, sans animation en mouvement réduit');
  assert.ok(app.includes("{k:'confid',stk:'shield',t:'Ta confidentialité',r:'Personne ne voit tes requêtes.',c:['Dans une salle, les autres joueurs voient ton pseudo, ton drapeau, tes temps et tes réactions. Jamais tes requêtes.',"), 'ce qu’elle dit');
  assert.ok(lq.includes('html.lq #scr-compte .dc-r{scroll-margin-top:110px}'), 'sous l’en-tête collant de la feuille');
});

test('« Tu joues en tant que » : la coche verte après le pseudo', () => {
  const ctx = vm.createContext({jeuSavedNom: () => '@elisa_sql', jeuInitial: n => 'E', jeuFlag: () => '', PS_LOCK_SVG: '<svg l/>', esc: s => String(s), escAttr: s => String(s)});
  vm.runInContext(fn('jeuNomField'), ctx);
  const h = ctx.jeuNomField('jeu-nom');
  assert.ok(h.includes('<span class="jeu-me-t"><small>Tu joues en tant que</small><span class="jeu-me-nom"><b><i class="jeu-me-at">@</i>elisa_sql</b><span class="jeu-me-ok" role="img" aria-label="Pseudo validé"><svg viewBox="0 0 24 24" aria-hidden="true">'));
  assert.ok(h.includes('<input id="jeu-nom" type="hidden" value="@elisa_sql">'), 'le pseudo part toujours avec la salle');
  for (const r of ['html.lq .jeu-me-nom{display:flex;align-items:center;gap:7px;min-width:0}', 'html.lq .jeu-me-nom>b{min-width:0}',
    'html.lq .jeu-me-ok{flex:none;display:inline-grid;width:19px;height:19px;border-radius:50%;color:#1E9E57;box-shadow:0 0 0 2px #fff}'])
    assert.ok(lq.includes(r), r);
  assert.ok(lq.indexOf('html.lq .jeu-me-ok{') < lq.indexOf('Défis — la refonte du 7 novembre'), 'hors des Défis : la coche suit le pseudo partout où il s’affiche');
});
