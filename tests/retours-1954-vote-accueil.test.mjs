/* Elisa, 14 novembre. 19 h 54 : « Mais comment ils vont faire pour voter du coup ? » (le vote, d’abord en bas de l’accueil) ;
   20 h 09 : « en mode onglet comme Python : Vote pour le prochain parcours › » (une pastille et sa page) ; 20 h 54 : « supprime
   finalement l’onglet avec le vote. Je vais pas le mettre finalement, c’est pas grave. » Pas de vote dans la 1.0 : ni carte,
   ni pastille, ni page. Les votes déjà donnés restent gardés ; la carte de vote ne vit plus que sur la page d’un parcours, le jour
   où les annonces reviennent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../decouvrir/confidentialite.html', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));

function sandbox(state = {}) {
  const ctx = vm.createContext({
    state: { lessons: {}, ...state }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String,
    DEF_CHEV_SVG: '', activeTab: 'learn', switchTab() {}, returnToParent() {}, returnToHome() {}, buzz() {}, lqSay() {}, mascotReduced: () => false,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }, clsCle: () => 'cle', clsRpc: () => Promise.resolve({ ok: true })
  });
  vm.runInContext(block, ctx);
  return ctx;
}

test('pas de vote dans la 1.0 : ni carte en bas, ni pastille, ni page', () => {
  for (const k of ['id="home-vote"', 'renderParcoursVoteAccueil', 'parcoursChipVoteHTML', 'openParcoursVote', 'parcoursVotePageHTML', 'parcoursAlerteTous'])
    assert.ok(!app.includes(k), k);
  assert.ok(!css.includes('.pc-chip.is-vote') && !css.includes('#home-vote'));
  const ctx = sandbox({ parcoursVote: { id: 'excel', le: 1, envoye: true } });
  assert.equal(ctx.parcoursChipsHTML(3), '', 'un seul parcours montré : pas de rangée');
  assert.equal(vm.runInContext('PARCOURS_AVENIR_MONTRES', ctx), false);
  assert.equal(ctx.parcoursVote().id, 'excel', 'un vote déjà donné reste gardé');
});

test('le vote reste prêt pour la page d’un parcours, le jour où les annonces reviennent', () => {
  const ctx = sandbox();
  vm.runInContext('PARCOURS_AVENIR_MONTRES=true', ctx);
  const page = ctx.parcoursPageHTML(vm.runInContext("PARCOURS.find(p=>p.id==='python')", ctx));
  assert.ok(page.includes('<fieldset class="pc-vote">') && page.includes('value="python" checked'));
  assert.ok(css.includes('width:var(--pc-part,0%);') && !css.includes('width:var(--p,0%)'), 'les barres des résultats : --p est pris par l’anneau');
  assert.ok(css.includes('html.lq .pc-vote legend .pc-insec{white-space:nowrap}'));
});

test('la confidentialité parle du vote et de l’alerte au passé', () => {
  assert.ok(privacy.includes('<li><b>Vote pour le prochain parcours</b> (facultatif). Si tu as voté pour le parcours qui suivra SQL, quand l’appli le proposait,'));
  assert.ok(privacy.includes('<li><b>Alerte «&nbsp;M’avertir au lancement&nbsp;»</b> (facultatif). Si tu l’as activée, quand l’appli la proposait, et que tu as accepté les notifications,'));
});
