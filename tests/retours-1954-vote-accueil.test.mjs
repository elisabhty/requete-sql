/* Elisa, 14 novembre, 19 h 54 (les pages des parcours à venir venaient d’être cachées pour la 1.0) : « Mais comment ils vont faire
   pour voter du coup ? Pour le prochain parcours ? » Le vote reste : c’est un sondage qui marche (le choix part à la base de l’appli,
   les résultats s’affichent), rien n’y est annoncé. Il vient sur l’accueil, sous les modules du parcours SQL : la même carte que sur
   la page d’un parcours (sa maquette du 11 novembre), cochée sur son vote s’il a voté. Les résultats et « En tête » ne sont lus à la
   base qu’une fois la carte à l’écran. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../ludique.css', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('/* ---------- Les parcours ----------'), app.indexOf('function renderModules(){'));

/* Le bac à sable, comme dans l’appli : les parcours à venir cachés (PARCOURS_AVENIR_MONTRES reste false) */
function sandbox({ hote = null, io = null, state = {} } = {}) {
  const calls = [];
  const ctx = vm.createContext({
    state: { lessons: {}, ...state }, save() {}, MODULES: [], TOTAL: 0, lqStkSvg: k => `<svg data-k="${k}"></svg>`, esc: String, escAttr: String, DEF_CHEV_SVG: '',
    activeTab: 'learn', switchTab() {}, returnToParent() {}, returnToHome() {}, buzz() {}, lqSay() {}, mascotReduced: () => false, prefersReduceMotion: () => true,
    requestAnimationFrame: f => f(),
    document: { getElementById: id => (id === 'home-vote' ? hote : null), querySelector: () => null, querySelectorAll: () => [] },
    clsCle: () => 'cle', clsRpc: (fn, body) => { calls.push([fn, body]); return Promise.resolve(fn === 'parcours_resultats' ? { seuil: 1, parts: { python: 50, excel: 30, powerbi: 20 } } : fn === 'parcours_en_tete' ? { parcours: null } : { ok: true }); },
    ...(io ? { IntersectionObserver: io } : {})
  });
  vm.runInContext(block, ctx);
  return { ctx, calls };
}
const plain = x => JSON.parse(JSON.stringify(x));

/* Une fausse carte : le bouton radio touché, sa carte, son bouton Voter, le choix coché */
function carte(coche) {
  const btn = { disabled: true, textContent: '', querySelector: () => null };
  const fs = { querySelector: q => (q === '.pc-vote-go' ? btn : q === 'input:checked' ? (coche.value ? coche : null) : null), closest: () => null };
  btn.closest = q => (q === '.pc-vote' ? fs : null);
  const radio = v => ({ value: v, closest: q => (q === '.pc-vote' ? fs : null) });
  return { btn, fs, radio };
}

test('l’accueil a sa place pour le vote, sous les modules ; la recherche la cache comme les modules', () => {
  assert.ok(app.includes('let PARCOURS_AVENIR_MONTRES=false;'), 'les pages des parcours à venir restent cachées');
  assert.ok(app.includes('      <div id="modules" class="group-stack lq-units"></div>\n      <div id="home-vote" class="home-vote" hidden></div>\n    </section>'));
  const mods = app.slice(app.indexOf('function renderModules(){'), app.indexOf('function toggleCatalogTools('));
  assert.ok(mods.includes("  renderParcoursVoteAccueil();\n  filterCourseCatalog(courseSearch);"), 'dessinée avec les modules, avant la recherche');
  const filtre = app.slice(app.indexOf('function filterCourseCatalog(value){'), app.indexOf('function filterCourseCatalog(value){') + 4000);
  assert.ok(filtre.includes("document.querySelectorAll('#modules>.home-module').forEach(m=>m.hidden=filtered);\n  const vote=document.getElementById('home-vote');if(vote)vote.hidden=filtered||!vote.firstElementChild;"));
  assert.ok(css.includes('html.lq #scr-learn #home-vote{padding:0 20px 28px}'), 'les marges des modules');
  assert.ok(css.includes('html.lq .pc-vote legend .pc-insec{white-space:nowrap}'), '« aimerais-tu » ne se coupe pas');
  assert.ok(css.includes('width:var(--pc-part,0%);') && !css.includes('width:var(--p,0%)'), 'les barres des résultats : --p est pris par l’anneau (@property, un nombre)');
});

test('la carte : la question et les choix de sa maquette, rien d’annoncé ; le bouton attend un choix', () => {
  const { ctx } = sandbox();
  const h = ctx.parcoursVoteAccueilHTML();
  assert.ok(h.startsWith('<fieldset class="pc-vote">'));
  assert.ok(/<legend><i class="pc-vote-ico" aria-hidden="true"><svg[\s\S]*?<\/svg><\/i><span>Quel parcours <span class="pc-insec">aimerais-tu<\/span> découvrir ensuite \?<\/span><\/legend>/.test(h));
  assert.ok(h.includes('<p class="pc-vote-sub">Ton vote nous aide à choisir le prochain !</p>'));
  for (const [id, titre, k] of [['python', 'Python pour la data', 'term'], ['excel', 'Excel et tableaux croisés', 'table'], ['powerbi', 'Power BI', 'chart']])
    assert.ok(h.includes(`<input type="radio" name="pc-vote-a" value="${id}" onchange="parcoursChoisir(this.value,this)"><i class="pc-opt-ico" aria-hidden="true"><svg data-k="${k}"></svg></i><span class="pc-opt-t">${titre}</span>`), id);
  assert.equal((h.match(/ checked/g) || []).length, 0, 'rien de coché tant qu’il n’a pas voté');
  assert.ok(/<button type="button" class="pc-vote-go" onclick="parcoursVoter\(this\)" disabled><svg[\s\S]*?<\/svg><span>Voter<\/span><\/button>/.test(h));
  assert.ok(!/À venir|En préparation|M’avertir|bientôt|prochainement/i.test(h), 'un sondage, pas une annonce');
  /* Les pages restent cachées : ni pastilles, ni « À venir » */
  assert.equal(ctx.parcoursChipsHTML(0), '');
  assert.ok(!ctx.parcoursListeHTML().includes('À venir'));
});

test('voter depuis l’accueil : le choix de sa carte part à la base ; la carte se coche sur son vote ; changer d’avis', async () => {
  const { ctx, calls } = sandbox();
  const coche = { value: '' }, c = carte(coche);
  ctx.parcoursChoisir('excel', c.radio('excel'));
  assert.equal(c.btn.disabled, false, 'un choix : le bouton s’allume');
  assert.equal(c.btn.textContent, 'Voter');
  assert.equal(vm.runInContext('parcoursVue', ctx), null, 'aucune page de parcours ne s’ouvre');
  coche.value = 'excel';
  ctx.parcoursVoter(c.btn);
  assert.equal(ctx.state.parcoursVote.id, 'excel');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(plain(calls.find(x => x[0] === 'parcours_voter')), ['parcours_voter', { p_cle: 'cle', p_parcours: 'excel' }]);
  assert.equal(ctx.state.parcoursVote.envoye, true);
  const h = ctx.parcoursVoteAccueilHTML();
  assert.ok(h.includes('value="excel" checked') && (h.match(/ checked/g) || []).length === 1, 'cochée sur son vote');
  assert.ok(h.includes('<span class="pc-opt-t">Excel et tableaux croisés<small class="pc-opt-moi">Ton vote</small></span>'));
  assert.ok(h.includes('Merci ! Ton vote : Excel et tableaux croisés.'));
  assert.ok(/onclick="parcoursVoter\(this\)" disabled><svg[\s\S]*?<\/svg><span>Vote enregistré<\/span>/.test(h));
  /* Il change d’avis */
  ctx.parcoursChoisir('powerbi', c.radio('powerbi'));
  assert.equal(c.btn.disabled, false);
  assert.equal(c.btn.textContent, 'Changer mon vote');
  coche.value = 'powerbi';
  ctx.parcoursVoter(c.btn);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(plain(calls.filter(x => x[0] === 'parcours_voter').at(-1)), ['parcours_voter', { p_cle: 'cle', p_parcours: 'powerbi' }]);
  /* SQL (déjà ouvert) ou un parcours inconnu : rien */
  const avant = [vm.runInContext('parcoursChoix', ctx), c.btn.disabled, c.btn.textContent];
  ctx.parcoursChoisir('sql', c.radio('sql'));
  ctx.parcoursChoisir('java', c.radio('java'));
  assert.deepEqual([vm.runInContext('parcoursChoix', ctx), c.btn.disabled, c.btn.textContent], avant);
  coche.value = 'sql';
  ctx.parcoursVoter(c.btn);
  assert.equal(ctx.state.parcoursVote.id, 'powerbi');
});

test('les résultats et « En tête » ne sont lus qu’une fois la carte à l’écran ; la carte n’est réécrite que si elle change', async () => {
  let ecrit = 0, html = '';
  const hote = { hidden: false, get innerHTML() { return html; }, set innerHTML(v) { ecrit++; html = v; }, querySelector: q => (q === '.pc-vote' && html ? {} : null), querySelectorAll: () => [] };
  const vus = [];
  class IO { constructor(f, o) { this.f = f; this.o = o; vus.push(this); } observe(el) { this.el = el; } }
  const { ctx, calls } = sandbox({ hote, io: IO, state: { parcoursVote: { id: 'python', le: 1, envoye: true } } });
  ctx.renderParcoursVoteAccueil();
  assert.equal(ecrit, 1);
  assert.ok(html.includes('value="python" checked'));
  assert.equal(calls.length, 0, 'rien n’est lu tant que la carte n’est pas à l’écran');
  assert.equal(vus.length, 1);
  assert.equal(vus[0].el, hote);
  assert.equal(vus[0].o.rootMargin, '0px 0px 160px 0px', 'un peu avant d’y arriver');
  vus[0].f([{ isIntersecting: false }]);
  assert.equal(calls.length, 0);
  vus[0].f([{ isIntersecting: true }]);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls.map(x => x[0]).sort(), ['parcours_en_tete', 'parcours_resultats'], 'il a voté : les résultats et le parcours en tête');
  ctx.renderParcoursVoteAccueil();
  assert.equal(ecrit, 1, 'rien n’a changé : la carte reste (le choix en cours, les barres)');
  assert.equal(vus.length, 1, 'un seul observateur');
  /* Sans vote : seulement « En tête » */
  const s2 = sandbox({ hote: { hidden: false, innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } });
  s2.ctx.renderParcoursVoteAccueil();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(s2.calls.map(x => x[0]), ['parcours_en_tete'], 'sans IntersectionObserver : lu tout de suite, sans les résultats');
});

test('le jour où tous les parcours sont ouverts : plus de carte', () => {
  const hote = { hidden: false, innerHTML: 'x', querySelector: () => null, querySelectorAll: () => [] };
  const { ctx } = sandbox({ hote });
  vm.runInContext("PARCOURS.forEach(p=>{p.dispo=true;})", ctx);
  assert.equal(ctx.parcoursVoteAccueilHTML(), '');
  ctx.renderParcoursVoteAccueil();
  assert.equal(hote.innerHTML, '');
  assert.equal(hote.hidden, true);
});

test('le code : une seule carte de vote, partagée ; la mise à jour sur place touche chaque carte affichée', () => {
  assert.ok(block.includes("    ${parcoursVoteHTML(sel,'pc-vote')}\n  </div>`;\n}"), 'la page d’un parcours garde son vote, le même');
  assert.ok(block.includes("return parcoursVoteHTML(v?v.id:'','pc-vote-a');"), 'l’accueil : son propre groupe de boutons radio');
  assert.ok(block.includes("function parcoursVotables(){return PARCOURS.filter(p=>!p.dispo);}"), 'les choix ne dépendent pas des pages montrées');
  assert.ok(block.includes("return ['parcours-body','home-vote'].map(id=>document.getElementById(id))"));
  assert.ok(block.includes("  if(carte&&!carte.closest('#parcours-body'))return;"), 'le vote de l’accueil ne change pas la page d’un parcours');
});
