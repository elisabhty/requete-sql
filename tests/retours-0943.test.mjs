/* Elisa, 1er novembre, 9 h 43 : « quels sont les différents niveaux ? prendre en compte ce qu’on a mis dans l’onboarding, le
   mettre en dessous du prénom » ; à l’accueil « mettre le badge niveau » (garder la DA du site) ; Selon le SGBD : « problème
   d’espace » ; Nous contacter : « animer l’icône ». */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); const j = app.indexOf(b, i + a.length); assert.ok(j > i, b); return app.slice(i, j); };

/* Le vrai parcours : 65 leçons, les départs de l’onboarding et le module Jointures */
const lessons = [], modules = [];
for (const [titre, n] of [['Introduction', 1], ['Lire une table', 12], ['Fonctions et expressions', 6], ['Agrégats et regroupements', 4], ['Jointures', 10], ['Sous-requêtes et ensembles', 8], ['Suite', 24]]) {
  const m = { titre, lessons: [] };
  for (let k = 0; k < n; k++) { const l = { id: 1000 + lessons.length }; lessons.push(l); m.lessons.push(l); }
  modules.push(m);
}
function niveau(niv, faites = []) {
  const c = vm.createContext({ allLessons: lessons, MODULES: modules, state: { plan: niv ? { niveau: niv } : null },
    NIVEAUX: [{ k: 'debutant', from: 1000 }, { k: 'bases', from: 1011 }, { k: 'inter', from: 1033 }], itemDone: id => faites.includes(id),
    esc: s => String(s), escAttr: s => String(s) });
  vm.runInContext(cut('const ACCOUNT_LEVELS=[', 'const ACCT_OK_SVG='), c);
  return { lv: JSON.parse(JSON.stringify(vm.runInContext('niveauCompte()', c))), badge: l => vm.runInContext(`lvlBadgeHTML(${JSON.stringify(l)},'is-home')`, c) };
}

test('les cinq paliers suivent les quatre étapes de l’onboarding, puis le parcours maîtrisé', () => {
  assert.deepEqual(JSON.parse(vm.runInNewContext('JSON.stringify((' + cut('const ACCOUNT_LEVELS=', ';\n/* acquis').slice(21) + ').map(l=>[l.label,l.etape]))')),
    [['Explorateur SQL', 'SELECT'], ['Constructeur de requêtes', 'Filtres & tris'], ['Analyste relationnel', 'Jointures'], ['Analyste SQL', 'Analyses'], ['Parcours maîtrisé', 'Tout le parcours']]);
  assert.ok(app.includes("const stages=['SELECT','Filtres & tris','Jointures','Analyses'];"), 'les mêmes étapes que l’onboarding');
});

test('le niveau choisi à l’onboarding compte : « Je débute » palier 1, « Je connais les bases » palier 2, « Je pratique déjà » palier 4', () => {
  assert.deepEqual([niveau('debutant').lv.rank, niveau('bases').lv.rank, niveau('inter').lv.rank, niveau(null).lv.rank], [1, 2, 4, 1]);
  assert.equal(niveau('bases').lv.next, 'Jointures');
  /* Les leçons faites font avancer dans le palier, puis monter */
  assert.equal(niveau('debutant', lessons.slice(0, 5).map(l => l.id)).lv.pct, 45);
  assert.equal(niveau('bases', lessons.slice(11, 23).map(l => l.id)).lv.rank, 3, 'jointures commencées : analyste relationnel');
  assert.equal(niveau('inter', lessons.slice(33).map(l => l.id)).lv.label, 'Parcours maîtrisé');
});

test('le badge : la pastille jaune « Niv. 2 », puis le nom ; sous le prénom dans Mon compte et à l’accueil', () => {
  const { lv, badge } = niveau('bases');
  assert.equal(badge(lv), '<span class="lvl-badge is-home" role="img" aria-label="Niveau 2 : Constructeur de requêtes"><i aria-hidden="true"><span class="lvl-k">Niv.</span>2</i><span aria-hidden="true">Constructeur de requêtes</span></span>');
  assert.ok(app.includes("<span class=\"acct-identity-line\"><b>${esc(accountTitle)}</b>") && app.includes("</span>${lvlBadgeHTML(level,'is-on-deep')}</span>"), 'Mon compte : sous la ligne du prénom (et du pseudo)');
  assert.ok(app.includes("<div class=\"journey-session-meta\">${typeof niveauCompte==='function'?lvlBadgeHTML(niveauCompte(),'is-home'):''}"), 'accueil : sous « Bonjour », avant la séance');
  for (const part of [
    'html.lq .lvl-badge>i{flex:none;display:inline-flex;align-items:baseline;gap:3px;height:24px;padding:0 9px;border-radius:999px;background:var(--sun);',
    'html.lq .lvl-badge.is-on-deep{background:rgba(255,255,255,.14);color:var(--mint);',
    'html.lq .lvl-badge.is-home{padding:2px 12px 2px 2px;border:2px solid var(--line);background:#fff;color:var(--ink);box-shadow:0 3px 0 var(--lip)}',
    'html.lq .lq-heading .journey-session-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px 12px;margin-top:12px;font:600 14.5px/1.3 var(--ui);',
    'html.lq .lq-heading .journey-session-meta>.lvl-badge{font:700 14px/1.2 var(--display)}'])
    assert.ok(css.includes(part), part);
});

test('Selon le SGBD : la barre des thèmes sous la barre du haut ; la fusée du merci décolle puis flotte', () => {
  assert.ok(css.includes('html.lq #app .p-bar{height:calc(var(--safe-top) + 52px);'));
  assert.ok(css.includes('html.lq .sg-chips{top:calc(var(--safe-top) + 52px);padding:10px 18px 13px}'));
  assert.ok(css.includes('html.lq #scr-compte .ct-merci-stk{animation:ctDecolle .7s cubic-bezier(.2,.9,.3,1.25) both,ctFlotte 2.6s ease-in-out .7s infinite}'));
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){html.lq #scr-compte .ct-merci-stk{animation:none}}'));
});
